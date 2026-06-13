import { describe, test, expect } from 'bun:test';
import { loadApp, setValue, click } from './helpers/load-app.js';

const players = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

describe('Game setup', () => {
  test('shows the setup view when no game is in progress', () => {
    const { document } = loadApp({ storage: { hoops_players: players } });

    expect(document.getElementById('play-setup').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('play-active').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('start-game-btn').disabled).toBe(false);
  });

  test('start button is disabled when there are no players', () => {
    const { document } = loadApp();
    expect(document.getElementById('start-game-btn').disabled).toBe(true);
  });

  test('requires at least one player assigned to each team', () => {
    const { document, alerts, localStorage } = loadApp({ storage: { hoops_players: players } });

    // Assign both players to team A only.
    const rows = document.querySelectorAll('#setup-players-list .assign-row');
    click(rows[0].querySelectorAll('.assign-btn')[0]); // Alice -> A
    click(rows[1].querySelectorAll('.assign-btn')[0]); // Bob -> A

    click(document.getElementById('start-game-btn'));

    expect(alerts.some(a => a.includes('Assign at least one player to each team'))).toBe(true);
    expect(localStorage.getItem('hoops_current_game')).toBeNull();
  });

  test('starting a game with custom team names creates the game and switches views', () => {
    const { document, window } = loadApp({ storage: { hoops_players: players } });

    setValue(window, document.getElementById('team-a-name-input'), 'Reds');
    setValue(window, document.getElementById('team-b-name-input'), 'Blues');

    const rows = document.querySelectorAll('#setup-players-list .assign-row');
    click(rows[0].querySelectorAll('.assign-btn')[0]); // Alice -> A
    click(rows[1].querySelectorAll('.assign-btn')[1]); // Bob -> B

    click(document.getElementById('start-game-btn'));

    expect(document.getElementById('play-setup').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('play-active').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('team-a-name').textContent).toBe('Reds');
    expect(document.getElementById('team-b-name').textContent).toBe('Blues');
    expect(document.getElementById('team-a-score').textContent).toBe('0');
    expect(document.getElementById('team-b-score').textContent).toBe('0');
  });

  test('toggling a team assignment off returns the player to unassigned', () => {
    const { document } = loadApp({ storage: { hoops_players: players } });

    const row = document.querySelectorAll('#setup-players-list .assign-row')[0];
    const [btnA] = row.querySelectorAll('.assign-btn');

    click(btnA);
    expect(btnA.classList.contains('active')).toBe(true);

    click(btnA);
    expect(btnA.classList.contains('active')).toBe(false);
  });
});
