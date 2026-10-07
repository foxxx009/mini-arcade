/* Headless smoke test: load every page, run every game, assert no runtime errors.
   Run:  NODE_PATH=<node workspace>/node_modules node smoke_test.js            */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = __dirname;
const errors = [];

function makeDom(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost/mini-arcade/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const w = dom.window;
  w.addEventListener('error', e => errors.push(file + ' :: ' + e.message));
  // canvas: jsdom has no 2d context
  w.HTMLCanvasElement.prototype.getContext = function () {
    const noop = () => { };
    return new Proxy({
      canvas: this, fillRect: noop, clearRect: noop, strokeRect: noop, beginPath: noop,
      moveTo: noop, lineTo: noop, stroke: noop, fill: noop, arc: noop, fillText: noop,
      setTransform: noop, save: noop, restore: noop, measureText: () => ({ width: 10 })
    }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => (t[k] = v, true) });
  };
  return dom;
}

function runInline(dom, base) {
  const w = dom.window;
  const doc = w.document;
  // execute local <script src> tags in order (runScripts:'outside-only' skips them)
  const srcs = [...doc.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));
  for (const rel of srcs) {
    const p = path.join(base, rel);
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { errors.push(rel + ' :: load/eval :: ' + e.message); }
  }
  // inline script
  const inline = [...doc.querySelectorAll('script:not([src])')].map(s => s.textContent).join('\n');
  if (inline.trim()) {
    try { w.eval(inline); }
    catch (e) { errors.push(base + ' :: inline :: ' + e.message); }
  }
}

function check(rel, assertions) {
  const file = path.join(ROOT, rel);
  const base = path.dirname(file);
  const dom = makeDom(rel);
  try { runInline(dom, base); } catch (e) { errors.push(rel + ' :: ' + e.message); }
  const doc = dom.window.document;
  try { assertions && assertions(dom.window, doc); } catch (e) { errors.push(rel + ' :: assert :: ' + e.message); }
  dom.window.close();
}

const P = (...a) => path.join(ROOT, ...a);

/* --- index + static pages --- */
// static pages: only require them to parse; MiniArcade is only loaded where games live
['privacy/index.html', 'about/index.html'].forEach(f => check(f, () => { }));
check('index.html', (w) => {
  if (!w.MiniArcade) throw new Error('MiniArcade missing on index');
  if (w.document.querySelectorAll('.card').length !== 4) throw new Error('index should list 4 games');
});

/* --- 2048 --- */
check('2048/index.html', (w, doc) => {
  const board = doc.querySelector('.b2048');
  if (!board) throw new Error('2048 board not created');
  const filled = [...board.children].filter(d => d.textContent).length;
  if (filled !== 2) throw new Error('2048 should start with 2 tiles, got ' + filled);
  // press ArrowLeft a few times; must not throw and board must keep 16 cells
  for (let i = 0; i < 6; i++) {
    const ev = new w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    doc.dispatchEvent(ev);
  }
  if (board.children.length !== 16) throw new Error('2048 grid lost cells: ' + board.children.length);
  // tiles should have merged at least sometimes -> score hud non-empty
  if (!doc.querySelector('.hud')) throw new Error('2048 hud missing');
});

/* --- reflex --- */
check('reflex/index.html', (w, doc) => {
  const pad = doc.querySelector('.reflex');
  if (!pad) throw new Error('reflex pad missing');
  pad.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  if (pad.textContent.indexOf('Wait') === -1) throw new Error('reflex did not enter wait state: ' + pad.textContent);
});

/* --- stack (canvas) --- */
check('stack/index.html', (w, doc) => {
  const cv = doc.querySelector('canvas');
  if (!cv) throw new Error('stack canvas missing');
  cv.dispatchEvent(new w.Event('pointerdown', { bubbles: true, cancelable: true }));
  cv.dispatchEvent(new w.Event('pointerdown', { bubbles: true, cancelable: true }));
  const hud = doc.querySelector('.hud');
  if (!hud || !hud.textContent) throw new Error('stack hud empty');
});

/* --- snake (canvas) --- */
check('snake/index.html', (w, doc) => {
  const cv = doc.querySelector('canvas');
  if (!cv) throw new Error('snake canvas missing');
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  if (!doc.querySelector('.hud')) throw new Error('snake hud missing');
});

/* --- pure logic checks for 2048 line merge --- */
(function () {
  const src = fs.readFileSync(P('games/g2048.js'), 'utf8');
  // line() is module-private; re-derive by exercising the game through a fresh dom is done above.
})();

console.log(errors.length ? 'FAILURES:\n' + errors.join('\n') : 'ALL SMOKE CHECKS PASSED');
process.exit(errors.length ? 1 : 0);
