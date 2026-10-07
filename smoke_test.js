/* Headless smoke test: load every page, run every game, assert no runtime errors.
   Run:  NODE_PATH=<node workspace>/node_modules node smoke_test.js                    */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = __dirname;
const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

function mockCanvas(w) {
  const noop = () => { };
  const grad = { addColorStop: noop };
  w.HTMLCanvasElement.prototype.getContext = function () {
    const base = {
      canvas: this,
      createLinearGradient: () => grad,
      createRadialGradient: () => grad,
      measureText: () => ({ width: 10 })
    };
    return new Proxy(base, {
      get: (t, k) => (k in t ? t[k] : noop),
      set: (t, k, v) => (t[k] = v, true)
    });
  };
  w.HTMLCanvasElement.prototype.getBoundingClientRect = function () {
    return { left: 0, top: 0, right: 420, bottom: 420, width: 420, height: 420, x: 0, y: 0 };
  };
}

function makeDom(rel) {
  const file = path.join(ROOT, rel);
  const html = fs.readFileSync(file, 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost/mini-arcade/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const w = dom.window;
  w.addEventListener('error', e => errors.push(rel + ' :: ' + e.message));
  mockCanvas(w);
  const base = path.dirname(file);
  [...w.document.querySelectorAll('script[src]')].forEach(s => {
    const p = path.join(base, s.getAttribute('src'));
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { errors.push(rel + ' :: ' + s.getAttribute('src') + ' :: ' + e.message); }
  });
  [...w.document.querySelectorAll('script:not([src])')].forEach(s => {
    if (!s.textContent.trim()) return;
    try { w.eval(s.textContent); }
    catch (e) { errors.push(rel + ' :: inline :: ' + e.message); }
  });
  return dom;
}

async function check(rel, assertions, waitMs) {
  const dom = makeDom(rel);
  if (waitMs) await sleep(waitMs);
  const w = dom.window, doc = w.document;
  try { if (assertions) await assertions(w, doc); }
  catch (e) { errors.push(rel + ' :: assert :: ' + e.message); }
  dom.window.close();
}

function findGoodSwap(dbg) {
  const g = dbg.grid;
  const D = [[0, 1], [1, 0]];
  for (let r = 0; r < dbg.ROWS; r++) for (let c = 0; c < dbg.COLS; c++) {
    for (const d of D) {
      const r2 = r + d[0], c2 = c + d[1];
      if (r2 >= dbg.ROWS || c2 >= dbg.COLS) continue;
      const a = g[r][c], b = g[r2][c2];
      if (!a || !b) continue;
      g[r][c] = b; g[r2][c2] = a;
      const ok = dbg.findMatches().length > 0;
      g[r][c] = a; g[r2][c2] = b;
      if (ok) return [{ r: r, c: c }, { r: r2, c: c2 }];
    }
  }
  return null;
}

function countTiles(dbg) {
  let n = 0;
  for (let r = 0; r < dbg.ROWS; r++) for (let c = 0; c < dbg.COLS; c++) if (dbg.grid[r][c]) n++;
  return n;
}

(async function main() {
  /* ---------- static pages ---------- */
  for (const f of ['index.html', 'privacy/index.html', 'about/index.html']) {
    await check(f, function (w, doc) {
      if (!doc.querySelector('.brand')) throw new Error('missing header');
      if (f === 'index.html' && !w.MiniArcade) throw new Error('MiniArcade missing on home');
    });
  }

  /* ---------- 2048 ---------- */
  await check('2048/index.html', function (w, doc) {
    const board = doc.querySelector('.b2048');
    if (!board) throw new Error('board not created');
    const filled = [...board.children].filter(d => d.textContent).length;
    if (filled !== 2) throw new Error('should start with 2 tiles, got ' + filled);
    for (let i = 0; i < 6; i++) doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    if (board.children.length !== 16) throw new Error('grid lost cells: ' + board.children.length);
    if (!doc.querySelector('.hud')) throw new Error('hud missing');
  });

  /* ---------- reflex ---------- */
  await check('reflex/index.html', function (w, doc) {
    const pad = doc.querySelector('.reflex');
    if (!pad) throw new Error('pad missing');
    pad.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    if (!/Wait/.test(pad.textContent)) throw new Error('did not enter wait state: ' + pad.textContent);
  });

  /* ---------- stack ---------- */
  await check('stack/index.html', function (w, doc) {
    const cv = doc.querySelector('canvas');
    if (!cv) throw new Error('canvas missing');
    cv.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
    doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));
    const hud = doc.querySelector('.hud');
    if (!hud || !hud.textContent) throw new Error('hud empty');
  }, 200);

  /* ---------- snake ---------- */
  await check('snake/index.html', function (w, doc) {
    if (!doc.querySelector('canvas')) throw new Error('canvas missing');
    doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    if (!doc.querySelector('.hud')) throw new Error('hud missing');
  }, 200);

  /* ---------- match-3: the main game ---------- */
  await check('match3/index.html', async function (w, doc) {
    if (!doc.querySelector('canvas')) throw new Error('canvas missing');
    if (!doc.querySelector('.goalbar')) throw new Error('goal bar missing');
    const dbg = w.MiniArcade._match3Debug();
    if (!dbg) throw new Error('debug hook missing');

    if (countTiles(dbg) !== dbg.ROWS * dbg.COLS) throw new Error('board not full at start: ' + countTiles(dbg));
    if (dbg.findMatches().length) throw new Error('board starts with a pre-made match');
    if (!dbg.hasMove()) throw new Error('board starts with no legal move');

    const pair = findGoodSwap(dbg);
    if (!pair) throw new Error('no legal swap found');
    const movesBefore = dbg.moves(), scoreBefore = dbg.score();
    dbg.swap(pair[0], pair[1]);
    await sleep(1800);

    if (dbg.moves() !== movesBefore - 1) throw new Error('move not consumed: ' + movesBefore + ' -> ' + dbg.moves());
    if (dbg.score() <= scoreBefore) throw new Error('score did not increase: ' + dbg.score());
    if (dbg.st() !== 'idle') throw new Error('did not settle back to idle: ' + dbg.st());
    if (countTiles(dbg) !== dbg.ROWS * dbg.COLS) throw new Error('board not refilled: ' + countTiles(dbg));
  }, 300);

  console.log(errors.length ? 'FAILURES (' + errors.length + '):\n' + errors.join('\n') : 'ALL SMOKE CHECKS PASSED');
  process.exit(errors.length ? 1 : 0);
})();
