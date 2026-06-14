import { describe, test, expect } from 'bun:test';
import { loadApp, click } from './helpers/load-app.js';

const players = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
  { id: 'p3', name: 'Charlie' },
];

function activeGame() {
  return {
    id: 'g1',
    startedAt: new Date().toISOString(),
    teams: {
      A: { name: 'Reds', playerIds: ['p1', 'p3'] },
      B: { name: 'Blues', playerIds: ['p2'] },
    },
    stats: {
      p1: { shots: { 1: 0, 2: 0, 3: 0 }, assists: 0 },
      p2: { shots: { 1: 0, 2: 0, 3: 0 }, assists: 0 },
      p3: { shots: { 1: 0, 2: 0, 3: 0 }, assists: 0 },
    },
    log: [],
    undoStack: [],
  };
}

function quickBtn(document, team, points) {
  return document.querySelector(`.quick-btn[data-team="${team}"][data-points="${points}"]`);
}

describe('Scoring an active game', () => {
  test('shows large +3/+2 quick-score buttons for each team', () => {
    const { document } = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    expect(quickBtn(document, 'A', '3')).not.toBeNull();
    expect(quickBtn(document, 'A', '2')).not.toBeNull();
    expect(quickBtn(document, 'B', '3')).not.toBeNull();
    expect(quickBtn(document, 'B', '2')).not.toBeNull();
    expect(document.getElementById('picker-overlay').classList.contains('hidden')).toBe(true);
  });

  test('tapping a quick button for a single-player team records the shot directly', () => {
    const { document, localStorage } = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    click(quickBtn(document, 'B', '2'));

    expect(document.getElementById('picker-overlay').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('team-b-score').textContent).toBe('2');
    expect(document.getElementById('feed').textContent).toContain('+2');
    expect(document.getElementById('feed').textContent).toContain('Bob');

    const stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.stats.p2.shots[2]).toBe(1);
    expect(stored.log).toHaveLength(1);
    expect(document.getElementById('undo-btn').disabled).toBe(false);
  });

  test('tapping a quick button for a multi-player team opens a player picker', () => {
    const { document, localStorage } = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    click(quickBtn(document, 'A', '3'));

    expect(document.getElementById('picker-overlay').classList.contains('hidden')).toBe(false);
    const options = document.querySelectorAll('#picker-list .picker-btn');
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toBe('Alice');
    expect(options[1].textContent).toBe('Charlie');

    click(options[0]);

    expect(document.getElementById('picker-overlay').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('team-a-score').textContent).toBe('3');
    expect(document.getElementById('feed').textContent).toContain('+3');
    expect(document.getElementById('feed').textContent).toContain('Alice');

    const stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.stats.p1.shots[3]).toBe(1);
  });

  test('cancelling the player picker records nothing', () => {
    const { document, localStorage } = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    click(quickBtn(document, 'A', '2'));
    expect(document.getElementById('picker-overlay').classList.contains('hidden')).toBe(false);

    click(document.getElementById('picker-cancel'));

    expect(document.getElementById('picker-overlay').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('team-a-score').textContent).toBe('0');
    const stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.log).toHaveLength(0);
  });

  test('a fresh shot shows contextual AST and +1 actions on its feed row', () => {
    const { document } = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    click(quickBtn(document, 'B', '2'));

    const feedItem = document.querySelector('#feed .feed-item');
    expect(feedItem.querySelector('[data-action="and-one"]')).not.toBeNull();
    // Team B only has one player, so there's no one to credit an assist to.
    expect(feedItem.querySelector('[data-action="ast"]')).toBeNull();
  });

  test('tapping AST opens a teammate picker and resolves to a badge', () => {
    const { document, localStorage } = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    click(quickBtn(document, 'A', '3'));
    click(document.querySelectorAll('#picker-list .picker-btn')[0]); // Alice scores

    const astBtn = document.querySelector('#feed [data-action="ast"]');
    expect(astBtn).not.toBeNull();
    click(astBtn);

    expect(document.getElementById('picker-overlay').classList.contains('hidden')).toBe(false);
    const options = document.querySelectorAll('#picker-list .picker-btn');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toBe('Charlie');

    click(options[0]);

    expect(document.getElementById('picker-overlay').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('feed').textContent).toContain('AST Charlie');
    expect(document.querySelector('#feed [data-action="ast"]')).toBeNull();

    const stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.stats.p3.assists).toBe(1);
    expect(stored.log).toHaveLength(1);
    expect(stored.log[0].assist).toEqual({ playerId: 'p3', playerName: 'Charlie' });
    expect(stored.undoStack.map(a => a.type)).toEqual(['shot', 'assist']);
  });

  test('tapping +1 records an and-one for the scorer and shows a badge', () => {
    const { document, localStorage } = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    click(quickBtn(document, 'A', '3'));
    click(document.querySelectorAll('#picker-list .picker-btn')[0]); // Alice scores

    click(document.querySelector('#feed [data-action="and-one"]'));

    expect(document.getElementById('team-a-score').textContent).toBe('4');
    expect(document.getElementById('feed').textContent).toContain('+1');
    expect(document.querySelector('#feed [data-action="and-one"]')).toBeNull();

    const stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.stats.p1.shots[1]).toBe(1);
    expect(stored.log).toHaveLength(1);
    expect(stored.log[0].andOne).toBe(true);
    expect(stored.undoStack.map(a => a.type)).toEqual(['shot', 'andOne']);
  });

  test('undo asks for confirmation before reverting the last action', () => {
    const { document, localStorage, confirms, setConfirmResult } = loadApp({
      storage: { hoops_players: players, hoops_current_game: activeGame() },
      confirmReturn: false,
    });

    click(quickBtn(document, 'B', '2'));
    expect(document.getElementById('team-b-score').textContent).toBe('2');

    click(document.getElementById('undo-btn'));

    expect(confirms.some(c => c.toLowerCase().includes('undo'))).toBe(true);
    expect(document.getElementById('team-b-score').textContent).toBe('2');
    let stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.log).toHaveLength(1);

    setConfirmResult(true);
    click(document.getElementById('undo-btn'));

    expect(document.getElementById('team-b-score').textContent).toBe('0');
    expect(document.getElementById('undo-btn').disabled).toBe(true);
    stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.log).toHaveLength(0);
    expect(stored.undoStack).toHaveLength(0);
  });

  test('undo is disabled and asks nothing when the log is empty', () => {
    const { document, localStorage, confirms } = loadApp({ storage: { hoops_players: players, hoops_current_game: activeGame() } });

    expect(document.getElementById('undo-btn').disabled).toBe(true);

    click(document.getElementById('undo-btn'));

    expect(confirms).toHaveLength(0);
    const stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.log).toHaveLength(0);
  });

  test('undo reverts and-one, then assist, then the shot itself, in order', () => {
    const { document, localStorage } = loadApp({
      storage: { hoops_players: players, hoops_current_game: activeGame() },
      confirmReturn: true,
    });

    click(quickBtn(document, 'A', '3'));
    click(document.querySelectorAll('#picker-list .picker-btn')[0]); // Alice scores +3

    click(document.querySelector('#feed [data-action="and-one"]')); // Alice and-one
    click(document.querySelector('#feed [data-action="ast"]'));
    click(document.querySelectorAll('#picker-list .picker-btn')[0]); // Charlie assists

    let stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.undoStack.map(a => a.type)).toEqual(['shot', 'andOne', 'assist']);
    expect(document.getElementById('team-a-score').textContent).toBe('4');

    // Undo the assist.
    click(document.getElementById('undo-btn'));
    stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.log[0].assist).toBeUndefined();
    expect(stored.stats.p3.assists).toBe(0);
    expect(stored.undoStack.map(a => a.type)).toEqual(['shot', 'andOne']);

    // Undo the and-one.
    click(document.getElementById('undo-btn'));
    stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.log[0].andOne).toBeUndefined();
    expect(stored.stats.p1.shots[1]).toBe(0);
    expect(document.getElementById('team-a-score').textContent).toBe('3');
    expect(stored.undoStack.map(a => a.type)).toEqual(['shot']);

    // Undo the shot itself.
    click(document.getElementById('undo-btn'));
    stored = JSON.parse(localStorage.getItem('hoops_current_game'));
    expect(stored.log).toHaveLength(0);
    expect(stored.stats.p1.shots[3]).toBe(0);
    expect(document.getElementById('team-a-score').textContent).toBe('0');
    expect(document.getElementById('undo-btn').disabled).toBe(true);
  });
});
