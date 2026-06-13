import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const html = readFileSync(join(root, 'index.html'), 'utf-8');
const appSource = readFileSync(join(root, 'app.js'), 'utf-8');

const bodyHtml = html
  .match(/<body>([\s\S]*)<\/body>/)[1]
  .replace(/<script[\s\S]*?<\/script>/g, '');

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock';
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}

const runApp = new Function(
  'window', 'document', 'localStorage', 'navigator', 'confirm', 'alert', 'crypto',
  appSource
);

// Loads a fresh copy of index.html + app.js into an isolated jsdom window.
// Each call gets its own document and localStorage, so tests don't bleed into each other.
// `storage` lets a test pre-seed localStorage before app.js's init code runs.
export function loadApp({ confirmReturn = true, storage = {}, rawStorage = {} } = {}) {
  // A virtual console that isn't forwarded anywhere silences jsdom's noisy
  // "Not implemented" warnings (e.g. anchor-click navigation) during export tests.
  const virtualConsole = new VirtualConsole();

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/', virtualConsole });
  const { window } = dom;
  const document = window.document;
  document.body.innerHTML = bodyHtml;
  window.APP_VERSION = 'TEST';

  Object.entries(storage).forEach(([key, value]) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  });
  Object.entries(rawStorage).forEach(([key, value]) => {
    window.localStorage.setItem(key, value);
  });

  const alerts = [];
  const confirms = [];
  let confirmResult = confirmReturn;

  const alertFn = (msg) => { alerts.push(msg); };
  const confirmFn = (msg) => { confirms.push(msg); return confirmResult; };

  runApp(window, document, window.localStorage, window.navigator, confirmFn, alertFn, crypto);

  return {
    window,
    document,
    localStorage: window.localStorage,
    alerts,
    confirms,
    setConfirmResult: (v) => { confirmResult = v; },
  };
}

export function click(el) {
  el.click();
}

export function setValue(window, el, value) {
  el.value = value;
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
}

export function submitForm(window, form) {
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}
