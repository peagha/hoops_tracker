import { describe, test, expect } from 'bun:test';
import { loadApp, click } from './helpers/load-app.js';

describe('Bottom nav', () => {
  test('play view is active by default', () => {
    const { document } = loadApp();

    expect(document.getElementById('view-play').classList.contains('active')).toBe(true);
    expect(document.querySelector('.nav-btn[data-view="play"]').classList.contains('active')).toBe(true);
  });

  test('switching views toggles the active view and nav button', () => {
    const { document } = loadApp();

    click(document.querySelector('.nav-btn[data-view="players"]'));

    expect(document.getElementById('view-players').classList.contains('active')).toBe(true);
    expect(document.getElementById('view-play').classList.contains('active')).toBe(false);
    expect(document.querySelector('.nav-btn[data-view="players"]').classList.contains('active')).toBe(true);
    expect(document.querySelector('.nav-btn[data-view="play"]').classList.contains('active')).toBe(false);
  });

  test('menu view shows the app version', () => {
    const { document } = loadApp();

    click(document.querySelector('.nav-btn[data-view="menu"]'));

    expect(document.getElementById('view-menu').classList.contains('active')).toBe(true);
    expect(document.getElementById('app-version').textContent).toBe('TEST');
  });
});
