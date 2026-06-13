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

describe('Scoring an active game', () => {
  test('scoring bar is empty until a player is selected', () => {
    const { document } = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    expect(document.getElementById('scoring-bar').classList.contains('empty')).toBe(true);
    document.querySelectorAll('#scoring-bar .action-btn').forEach(btn => {
      expect(btn.disabled).toBe(true);
    });
  });

  test('selecting a player enables the scoring bar and shows their stats', () => {
    const { document } = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    click(document.querySelector('#active-players-list-a .player-chip'));

    expect(document.getElementById('scoring-bar').classList.contains('empty')).toBe(false);
    expect(document.getElementById('scoring-player-name').textContent).toBe('Alice');
    expect(document.getElementById('scoring-player-stats').textContent).toBe('0 PTS · 0 AST');
    document.querySelectorAll('#scoring-bar .action-btn').forEach(btn => {
      expect(btn.disabled).toBe(false);
    });
  });

  test('recording a 2pt shot updates the player chip, scoreboard and event log', () => {
    const { document, localStorage } = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    click(document.querySelector('#active-players-list-a .player-chip'));
    click(document.querySelector('#scoring-bar .action-btn[data-stat="2"]'));

    expect(document.getElementById('team-a-score').textContent).toBe('2');
    expect(document.querySelector('#active-players-list-a .player-chip-stats').textContent).toBe('2 PTS · 0 AST');
    expect(document.getElementById('scoring-player-stats').textContent).toBe('2 PTS · 0 AST');
    expect(document.getElementById('scoring-player-breakdown').textContent).toBe('1PT ×0 · 2PT ×1 · 3PT ×0');
    expect(document.getElementById('event-log-count').textContent).toBe('1');
    expect(document.getElementById('event-log-list').textContent).toContain('Alice +2PT');

    const stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.stats.p1.shots[2]).toBe(1);
    expect(stored.log).toHaveLength(1);

    expect(document.getElementById('undo-btn').disabled).toBe(false);
  });

  test('recording an assist does not affect the score', () => {
    const { document } = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    click(document.querySelector('#active-players-list-a .player-chip'));
    click(document.querySelector('#scoring-bar .action-btn[data-stat="assists"]'));

    expect(document.getElementById('team-a-score').textContent).toBe('0');
    expect(document.getElementById('scoring-player-stats').textContent).toBe('0 PTS · 1 AST');
    expect(document.getElementById('event-log-list').textContent).toContain('Alice +AST');
  });

  test('undo reverts the last stat and updates the scoreboard', () => {
    const { document, localStorage } = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    click(document.querySelector('#active-players-list-a .player-chip'));
    click(document.querySelector('#scoring-bar .action-btn[data-stat="3"]'));
    expect(document.getElementById('team-a-score').textContent).toBe('3');

    click(document.getElementById('undo-btn'));

    expect(document.getElementById('team-a-score').textContent).toBe('0');
    expect(document.getElementById('event-log-count').textContent).toBe('0');
    expect(document.getElementById('undo-btn').disabled).toBe(true);

    const stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.stats.p1.shots[3]).toBe(0);
    expect(stored.log).toHaveLength(0);
  });

  test('undo is disabled and does nothing when the log is empty', () => {
    const { document, localStorage } = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    expect(document.getElementById('undo-btn').disabled).toBe(true);

    click(document.getElementById('undo-btn'));

    const stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.log).toHaveLength(0);
  });
});
