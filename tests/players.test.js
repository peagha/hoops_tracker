import { describe, test, expect } from 'bun:test';
import { loadApp, setValue, submitForm, click } from './helpers/load-app.js';

describe('Players', () => {
  test('shows empty state when there are no players', () => {
    const { document } = loadApp();
    expect(document.getElementById('players-list').textContent).toContain('No players yet');
  });

  test('adding a player renders it in the list and persists to localStorage', () => {
    const { document, window, localStorage } = loadApp();

    setValue(window, document.getElementById('new-player-name'), 'Alice');
    submitForm(window, document.getElementById('add-player-form'));

    const list = document.getElementById('players-list');
    expect(list.textContent).toContain('Alice');

    const stored = JSON.parse(localStorage.getItem('hoops_players'));
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Alice');
    expect(typeof stored[0].id).toBe('string');
  });

  test('submitting an empty name does not add a player', () => {
    const { document, window } = loadApp();

    setValue(window, document.getElementById('new-player-name'), '   ');
    submitForm(window, document.getElementById('add-player-form'));

    expect(document.getElementById('players-list').textContent).toContain('No players yet');
  });

  test('removing a player deletes it from the list and storage', () => {
    const { document, window, localStorage } = loadApp();

    setValue(window, document.getElementById('new-player-name'), 'Alice');
    submitForm(window, document.getElementById('add-player-form'));

    const removeBtn = document.querySelector('#players-list .player-row button');
    click(removeBtn);

    expect(document.getElementById('players-list').textContent).toContain('No players yet');
    expect(JSON.parse(localStorage.getItem('hoops_players'))).toHaveLength(0);
  });

  test('cannot remove a player who is currently in a game', () => {
    const players = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ];
    const currentGame = {
      id: 'g1',
      startedAt: new Date().toISOString(),
      teams: {
        A: { name: 'Team A', playerIds: ['p1'] },
        B: { name: 'Team B', playerIds: ['p2'] },
      },
      stats: {
        p1: { shots: { 1: 0, 2: 0, 3: 0 }, assists: 0 },
        p2: { shots: { 1: 0, 2: 0, 3: 0 }, assists: 0 },
      },
      log: [],
    };

    const { document, localStorage, alerts } = loadApp({
      storage: { hoops_players: players, hoops_current_game: currentGame },
    });

    const removeBtn = document.querySelectorAll('#players-list .player-row button')[0];
    click(removeBtn);

    expect(alerts.some(a => a.includes('Cannot remove a player'))).toBe(true);
    expect(JSON.parse(localStorage.getItem('hoops_players'))).toHaveLength(2);
  });
});
