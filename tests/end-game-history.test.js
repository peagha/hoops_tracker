import { describe, test, expect } from 'bun:test';
import { loadApp, click } from './helpers/load-app.js';

const players = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

function activeGameWithScore() {
  return {
    id: 'g1',
    startedAt: new Date().toISOString(),
    teams: {
      A: { name: 'Reds', playerIds: ['p1'] },
      B: { name: 'Blues', playerIds: ['p2'] },
    },
    stats: {
      p1: { shots: { 1: 1, 2: 1, 3: 1 }, assists: 0 },
      p2: { shots: { 1: 0, 2: 0, 3: 0 }, assists: 1 },
    },
    log: [
      { id: 'e1', playerId: 'p1', playerName: 'Alice', stat: '2', at: new Date().toISOString(), assist: { playerId: 'p2', playerName: 'Bob' } },
      { id: 'e2', playerId: 'p1', playerName: 'Alice', stat: '3', at: new Date().toISOString() },
      { id: 'e3', playerId: 'p1', playerName: 'Alice', stat: '1', at: new Date().toISOString(), andOne: true },
    ],
    undoStack: [],
  };
}

describe('Ending and discarding a game', () => {
  test('ending a game saves it to history with correct totals and clears the active game', () => {
    const { document, localStorage } = loadApp({
      storage: { hoops_players: players, hoops_current_game: activeGameWithScore() },
      confirmReturn: true,
    });

    click(document.getElementById('end-game-btn'));

    expect(localStorage.getItem('hoops_current_game')).toBeNull();
    expect(document.getElementById('play-setup').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('play-active').classList.contains('hidden')).toBe(true);

    const games = JSON.parse(localStorage.getItem('hoops_games'));
    expect(games).toHaveLength(1);
    const [game] = games;
    expect(game.teams.A.score).toBe(6); // 1 + 2 + 3
    expect(game.teams.B.score).toBe(0);
    expect(game.events).toHaveLength(3);

    const alice = game.teams.A.players.find(p => p.id === 'p1');
    expect(alice.points).toBe(6);
    expect(alice.assists).toBe(0);
    expect(alice.shots).toEqual({ 1: 1, 2: 1, 3: 1 });

    const bob = game.teams.B.players.find(p => p.id === 'p2');
    expect(bob.assists).toBe(1);
  });

  test('declining the end-game confirmation keeps the game active', () => {
    const { document, localStorage } = loadApp({
      storage: { hoops_players: players, hoops_current_game: activeGameWithScore() },
      confirmReturn: false,
    });

    click(document.getElementById('end-game-btn'));

    expect(localStorage.getItem('hoops_current_game')).not.toBeNull();
    expect(localStorage.getItem('hoops_games')).toBeNull();
    expect(document.getElementById('play-active').classList.contains('hidden')).toBe(false);
  });

  test('discarding a game clears it without adding to history', () => {
    const { document, localStorage } = loadApp({
      storage: { hoops_players: players, hoops_current_game: activeGameWithScore() },
      confirmReturn: true,
    });

    click(document.getElementById('discard-game-btn'));

    expect(localStorage.getItem('hoops_current_game')).toBeNull();
    expect(localStorage.getItem('hoops_games')).toBeNull();
    expect(document.getElementById('play-setup').classList.contains('hidden')).toBe(false);
  });
});

describe('History view', () => {
  function pastGame(id, scoreA, scoreB) {
    return {
      id,
      startedAt: new Date('2026-01-01T12:00:00Z').toISOString(),
      endedAt: new Date('2026-01-01T13:00:00Z').toISOString(),
      teams: {
        A: { name: 'Reds', score: scoreA, players: [] },
        B: { name: 'Blues', score: scoreB, players: [] },
      },
      events: [],
    };
  }

  test('shows an empty state when there are no games', () => {
    const { document } = loadApp();
    expect(document.getElementById('history-list').textContent).toContain('No games yet');
  });

  test('renders past games with their final score', () => {
    const { document } = loadApp({ storage: { hoops_games: [pastGame('g1', 21, 18)] } });

    const entry = document.querySelector('#history-list .game-entry');
    expect(entry.textContent).toContain('Reds');
    expect(entry.textContent).toContain('Blues');
    expect(entry.textContent).toContain('21');
    expect(entry.textContent).toContain('18');
  });

  test('deleting a game removes it from history and storage', () => {
    const { document, localStorage, confirms } = loadApp({
      storage: { hoops_games: [pastGame('g1', 21, 18), pastGame('g2', 10, 12)] },
      confirmReturn: true,
    });

    expect(document.querySelectorAll('#history-list .game-entry')).toHaveLength(2);

    click(document.querySelector('#history-list .delete-game-btn'));

    expect(confirms.some(c => c.includes('Delete this game'))).toBe(true);
    expect(document.querySelectorAll('#history-list .game-entry')).toHaveLength(1);

    const stored = JSON.parse(localStorage.getItem('hoops_games'));
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('g2');
  });
});
