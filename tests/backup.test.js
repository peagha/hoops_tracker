import { describe, test, expect } from 'bun:test';
import { loadApp, click } from './helpers/load-app.js';

const flush = () => new Promise(r => setTimeout(r, 0));

describe('Backup export', () => {
  test('export builds a JSON blob containing players and games', async () => {
    const players = [{ id: 'p1', name: 'Alice' }];
    const games = [{
      id: 'g1',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      teams: {
        A: { name: 'Reds', score: 1, players: [] },
        B: { name: 'Blues', score: 0, players: [] },
      },
      events: [],
    }];

    const { document } = loadApp({ storage: { hoops_players: players, hoops_games: games } });

    let capturedBlob = null;
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob) => { capturedBlob = blob; return 'blob:mock'; };

    try {
      click(document.getElementById('export-btn'));
      await flush();
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
    }

    expect(capturedBlob).not.toBeNull();
    const data = JSON.parse(await capturedBlob.text());
    expect(data.players).toEqual(players);
    expect(data.games).toEqual(games);
    expect(typeof data.exportedAt).toBe('string');
  });
});

describe('Backup import', () => {
  test('importing a valid backup replaces players and games', async () => {
    const { document, localStorage, alerts } = loadApp({
      storage: { hoops_players: [{ id: 'old', name: 'Old Player' }] },
      confirmReturn: true,
    });

    const backup = { players: [{ id: 'x1', name: 'Zoe' }], games: [] };
    const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' });

    const input = document.getElementById('import-input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new (input.ownerDocument.defaultView.Event)('change', { bubbles: true }));

    await flush();

    expect(JSON.parse(localStorage.getItem('hoops_players'))).toEqual(backup.players);
    expect(document.getElementById('players-list').textContent).toContain('Zoe');
    expect(document.getElementById('players-list').textContent).not.toContain('Old Player');
    expect(alerts.some(a => a.includes('imported successfully'))).toBe(true);
  });

  test('declining the confirmation leaves existing data untouched', async () => {
    const { document, localStorage } = loadApp({
      storage: { hoops_players: [{ id: 'old', name: 'Old Player' }] },
      confirmReturn: false,
    });

    const backup = { players: [{ id: 'x1', name: 'Zoe' }], games: [] };
    const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' });

    const input = document.getElementById('import-input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new (input.ownerDocument.defaultView.Event)('change', { bubbles: true }));

    await flush();

    expect(JSON.parse(localStorage.getItem('hoops_players'))).toEqual([{ id: 'old', name: 'Old Player' }]);
    expect(document.getElementById('players-list').textContent).toContain('Old Player');
  });

  test('importing an invalid file shows an error and does not change storage', async () => {
    const { document, localStorage, alerts } = loadApp({
      storage: { hoops_players: [{ id: 'p1', name: 'Alice' }] },
    });

    const file = new File(['not json'], 'backup.json', { type: 'application/json' });
    const input = document.getElementById('import-input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new (input.ownerDocument.defaultView.Event)('change', { bubbles: true }));

    await flush();

    expect(alerts.some(a => a.startsWith('Could not import file'))).toBe(true);
    expect(JSON.parse(localStorage.getItem('hoops_players'))).toHaveLength(1);
  });
});
