import { describe, test, expect } from 'bun:test';
import { loadApp, click } from './helpers/load-app.js';

const players = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

function activeGame() {
  return {
    id: 'g1',
    startedAt: new Date().toISOString(),
    teams: {
      A: { name: 'Reds', playerIds: ['p1'] },
      B: { name: 'Blues', playerIds: ['p2'] },
    },
    stats: {
      p1: { shots: { 1: 0, 2: 0, 3: 0 }, assists: 0 },
      p2: { shots: { 1: 0, 2: 0, 3: 0 }, assists: 0 },
    },
    log: [],
  };
}

describe('Persistence across reloads', () => {
  test('an in-progress game is restored after reload', () => {
    const first = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    click(first.document.querySelector('.quick-btn[data-team="A"][data-points="3"]'));

    const savedGame = JSON.parse(first.localStorage.getItem('hoops_current_game'));

    // Simulate a page reload: fresh window seeded with the persisted storage.
    const second = loadApp({ storage: { hoops_players: players, hoops_current_game: savedGame } });

    expect(second.document.getElementById('play-active').classList.contains('hidden')).toBe(false);
    expect(second.document.getElementById('team-a-score').textContent).toBe('3');
    expect(second.document.getElementById('feed').textContent).toContain('Alice');
    expect(second.document.getElementById('undo-btn').disabled).toBe(false);
  });

  test('players and game history persist independently of the active game', () => {
    const games = [{
      id: 'g0',
      startedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
      endedAt: new Date('2026-01-01T01:00:00Z').toISOString(),
      teams: {
        A: { name: 'Reds', score: 10, players: [] },
        B: { name: 'Blues', score: 8, players: [] },
      },
      events: [],
    }];

    const { document } = loadApp({ storage: { hoops_players: players, hoops_games: games } });

    expect(document.getElementById('players-list').textContent).toContain('Alice');
    expect(document.getElementById('players-list').textContent).toContain('Bob');
    expect(document.querySelectorAll('#history-list .game-entry')).toHaveLength(1);
    // No active game, so setup view is shown.
    expect(document.getElementById('play-setup').classList.contains('hidden')).toBe(false);
  });

  test('a corrupt localStorage value falls back to defaults instead of crashing', () => {
    let document;
    expect(() => {
      ({ document } = loadApp({ rawStorage: { hoops_players: 'not json', hoops_games: '{broken' } }));
    }).not.toThrow();

    expect(document.getElementById('players-list').textContent).toContain('No players yet');
    expect(document.getElementById('history-list').textContent).toContain('No games yet');
  });
});
