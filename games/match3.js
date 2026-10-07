/* Match-3 / 消消乐 — swap, match, chain. Special candies, combos, levels. */
(function (MA) {
  'use strict';

  var COLS = 8, ROWS = 8, TYPES = 6;
  var COLORS = ['#ff4d6d', '#ff9f1c', '#ffd93d', '#4ade80', '#38bdf8', '#c084fc'];
  var DARK = ['#c9184a', '#d97706', '#e6b800', '#16a34a', '#0284c7', '#9333ea'];

  // specials: 0 none, 1 horizontal stripe, 2 vertical stripe, 3 wrapped bomb, 4 rainbow
  var SP = { NONE: 0, H: 1, V: 2, BOMB: 3, RAINBOW: 4 };

  function rand(n) { return Math.floor(Math.random() * n); }

  MA.startMatch3 = function (host) {
    host.innerHTML = '';

    // ---------- layout ----------
    var hostW = host.clientWidth || 360;
    var CELL = Math.floor(Math.min(Math.min(hostW, 420), 420) / COLS);
    var W = CELL * COLS, H = CELL * ROWS;

    var cv = document.createElement('canvas');
    var ctx = MA.fitCanvas(cv, W, H);
    cv.style.borderRadius = '14px';
    host.appendChild(cv);

    var bar = MA.el('div', 'goalbar');
    var fill = MA.el('div', 'goalfill');
    bar.appendChild(fill);
    host.appendChild(bar);

    var hud = MA.el('div', 'hud');
    host.appendChild(hud);

    var hint = MA.el('div', 'hint', 'Swap two candies to match 3 or more');
    host.appendChild(hint);

    var row = MA.el('div', 'row');
    host.appendChild(row);

    // ---------- state ----------
    var grid = [], particles = [], floaters = [];
    var score = 0, level = 1, moves = 25, target = 1500;
    var combo = 0, state = 'idle', shake = 0, banner = null;
    var sel = null, swapPair = null, spawnQueue = [];
    var sound = true, dead = false, won = false;

    function idx(r, c) { return r * COLS + c; }

    function newTile(r, c, py) {
      return { t: rand(TYPES), sp: SP.NONE, px: c * CELL, py: py != null ? py : -CELL, sc: 1, dying: false };
    }

    function build() {
      grid = [];
      for (var r = 0; r < ROWS; r++) {
        grid[r] = [];
        for (var c = 0; c < COLS; c++) grid[r][c] = newTile(r, c, -CELL * (ROWS - r));
      }
      // remove pre-made matches
      var guard = 0;
      while (findMatches().length && guard++ < 200) {
        var m = findMatches()[0];
        for (var i = 0; i < m.cells.length; i++) grid[m.cells[i].r][m.cells[i].c].t = rand(TYPES);
      }
    }

    // ---------- matching ----------
    function runs() {
      var out = [], r, c, t, len;
      for (r = 0; r < ROWS; r++) {
        len = 1;
        for (c = 1; c <= COLS; c++) {
          var same = c < COLS && grid[r][c] && grid[r][c - 1] && grid[r][c].t === grid[r][c - 1].t && !grid[r][c].dying;
          if (same) len++;
          else { if (len >= 3) { var cells = []; for (var k = 0; k < len; k++) cells.push({ r: r, c: c - len + k }); out.push({ cells: cells, dir: 'h' }); } len = 1; }
        }
      }
      for (c = 0; c < COLS; c++) {
        len = 1;
        for (r = 1; r <= ROWS; r++) {
          var same2 = r < ROWS && grid[r][c] && grid[r - 1][c] && grid[r][c].t === grid[r - 1][c].t && !grid[r][c].dying;
          if (same2) len++;
          else { if (len >= 3) { var cells2 = []; for (var k2 = 0; k2 < len; k2++) cells2.push({ r: r - len + k2, c: c }); out.push({ cells: cells2, dir: 'v' }); } len = 1; }
        }
      }
      return out;
    }

    /** Merge runs that share a cell into groups (L / T shapes). */
    function findMatches() {
      var rs = runs();
      if (!rs.length) return [];
      var groups = [], used = new Array(rs.length).fill(false);
      for (var i = 0; i < rs.length; i++) {
        if (used[i]) continue;
        var set = {}, cells = [], dirs = {}, maxLen = 0;
        var stack = [i];
        used[i] = true;
        while (stack.length) {
          var j = stack.pop();
          dirs[rs[j].dir] = true;
          maxLen = Math.max(maxLen, rs[j].cells.length);
          for (var k = 0; k < rs[j].cells.length; k++) {
            var cell = rs[j].cells[k];
            var key = idx(cell.r, cell.c);
            if (!set[key]) { set[key] = true; cells.push(cell); }
          }
          for (var m = 0; m < rs.length; m++) {
            if (used[m]) continue;
            for (var n = 0; n < rs[m].cells.length; n++) {
              if (set[idx(rs[m].cells[n].r, rs[m].cells[n].c)]) { used[m] = true; stack.push(m); break; }
            }
          }
        }
        groups.push({ cells: cells, maxLen: maxLen, cross: Object.keys(dirs).length > 1 });
      }
      return groups;
    }

    function specialFor(g) {
      if (g.maxLen >= 5) return SP.RAINBOW;
      if (g.cross) return SP.BOMB;
      if (g.maxLen === 4) return g.cells[0].r === g.cells[1].r ? SP.V : SP.H;
      return SP.NONE;
    }

    /** Expand a clear set through special candies (chain reactions). */
    function collectClear(seeds) {
      var seen = {}, out = [], queue = seeds.slice();
      var guard = 0;
      while (queue.length && guard++ < 800) {
        var cell = queue.shift();
        var key = idx(cell.r, cell.c);
        if (seen[key]) continue;
        if (cell.r < 0 || cell.r >= ROWS || cell.c < 0 || cell.c >= COLS) continue;
        seen[key] = true;
        var tile = grid[cell.r][cell.c];
        if (!tile) continue;
        out.push(cell);
        if (tile.sp === SP.H || tile.sp === SP.V) {
          if (tile.sp === SP.H) for (var c = 0; c < COLS; c++) queue.push({ r: cell.r, c: c });
          else for (var r = 0; r < ROWS; r++) queue.push({ r: r, c: cell.c });
        } else if (tile.sp === SP.BOMB) {
          for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) queue.push({ r: cell.r + dr, c: cell.c + dc });
        } else if (tile.sp === SP.RAINBOW) {
          var t = tile.t;
          for (var rr = 0; rr < ROWS; rr++) for (var cc = 0; cc < COLS; cc++) if (grid[rr][cc] && grid[rr][cc].t === t) queue.push({ r: rr, c: cc });
        }
      }
      return out;
    }

    // ---------- flow ----------
    function doSwap(a, b, back) {
      var t = grid[a.r][a.c];
      grid[a.r][a.c] = grid[b.r][b.c];
      grid[b.r][b.c] = t;
      state = back ? 'swapback' : 'swap';
      swapPair = [a, b];
    }

    function resolve() {
      var groups = findMatches();
      if (!groups.length) {
        if (state === 'swap') { doSwap(swapPair[0], swapPair[1], true); sel = null; return; }
        state = 'idle'; swapPair = null;
        endOfCascadeCheck();
        return;
      }
      if (state === 'swap') { moves--; swapPair = null; }
      combo++;
      processGroups(groups);
    }

    function processGroups(groups) {
      var seed = [], spawns = [];
      for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        var sp = specialFor(g);
        if (sp !== SP.NONE) {
          // keep one cell: it becomes the special candy
          var at = pickSpawnCell(g);
          spawns.push({ r: at.r, c: at.c, sp: sp, t: grid[at.r][at.c].t });
          for (var k = 0; k < g.cells.length; k++) {
            if (!(g.cells[k].r === at.r && g.cells[k].c === at.c)) seed.push(g.cells[k]);
          }
        } else {
          seed = seed.concat(g.cells);
        }
      }

      var cells = collectClear(seed);
      // never clear a cell reserved for a new special
      var reserved = {};
      spawns.forEach(function (s) { reserved[idx(s.r, s.c)] = true; });
      cells = cells.filter(function (c) { return !reserved[idx(c.r, c.c)]; });

      var gained = Math.round(30 * cells.length * (1 + 0.5 * (combo - 1)));
      score += gained;
      MA.setBest('match3', score);

      cells.forEach(function (c) {
        var tile = grid[c.r][c.c];
        if (!tile) return;
        tile.dying = true;
        burst(c.px !== undefined ? tile.px : c.c * CELL + CELL / 2, tile.py + CELL / 2, COLORS[tile.t], 6);
      });

      spawns.forEach(function (s) {
        var tile = grid[s.r][s.c];
        tile.sp = s.sp; tile.sc = 1.25; tile.dying = false;
        burst(s.c * CELL + CELL / 2, s.r * CELL + CELL / 2, '#ffffff', 10);
        floaters.push({ x: s.c * CELL + CELL / 2, y: s.r * CELL + CELL / 2, text: spName(s.sp), life: 1, color: '#fff' });
      });

      if (cells.length) {
        var mid = cells[Math.floor(cells.length / 2)];
        floaters.push({
          x: mid.c * CELL + CELL / 2, y: mid.r * CELL + CELL / 2,
          text: '+' + gained, life: 1, color: '#fff'
        });
        if (combo > 1) {
          banner = { text: comboWord(combo), life: 1 };
          shake = Math.min(4 + combo * 2, 14);
        }
        shake = Math.max(shake, Math.min(cells.length, 10));
      }

      beep(360 + Math.min(combo, 8) * 70, 0.09);
      state = 'clearing';
      spawnQueue = spawns;
    }

    function spName(sp) {
      return sp === SP.H ? 'STRIPED!' : sp === SP.V ? 'STRIPED!' : sp === SP.BOMB ? 'BOMB!' : 'RAINBOW!';
    }
    function comboWord(n) {
      return n >= 5 ? 'UNBELIEVABLE!' : n === 4 ? 'AMAZING!' : n === 3 ? 'GREAT!' : 'NICE!';
    }
    function pickSpawnCell(g) {
      // prefer a cell the player just touched
      if (lastTouched) {
        for (var i = 0; i < g.cells.length; i++) {
          if ((g.cells[i].r === lastTouched.r && g.cells[i].c === lastTouched.c)) return g.cells[i];
        }
      }
      return g.cells[Math.floor(g.cells.length / 2)];
    }

    function applyGravity() {
      for (var c = 0; c < COLS; c++) {
        var write = ROWS - 1;
        for (var r = ROWS - 1; r >= 0; r--) {
          if (grid[r][c]) {
            if (write !== r) { grid[write][c] = grid[r][c]; grid[r][c] = null; }
            write--;
          }
        }
        var above = 1;
        for (var rr = write; rr >= 0; rr--) {
          grid[rr][c] = newTile(rr, c, -CELL * above);
          above++;
        }
      }
      state = 'falling';
    }

    function endOfCascadeCheck() {
      combo = 0;
      if (score >= target) {
        levelUp();
        return;
      }
      if (moves <= 0) { gameOver(); return; }
      if (!hasMove()) {
        hint.textContent = 'No moves left — shuffling the board…';
        setTimeout(function () { build(); state = 'idle'; hint.textContent = 'Swap two candies to match 3 or more'; }, 700);
      }
    }

    function levelUp() {
      won = true;
      banner = { text: 'LEVEL ' + (level + 1) + ' UNLOCKED', life: 1.6 };
      shake = 10;
      beep(660, 0.12); setTimeout(function () { beep(880, 0.16); }, 120);
      level++;
      moves = 25;
      target = score + 1500 + (level - 1) * 700;
      won = false;
      setHud();
    }

    function gameOver() {
      dead = true;
      MA.setBest('match3', score);
      setHud();
      hint.textContent = 'Out of moves — final score ' + score + ' (level ' + level + ').';
      row.innerHTML = '';
      row.appendChild(MA.button('Play again', function () { reset(); }, true));
      MA.onRoundEnd();
    }

    function reset() {
      score = 0; level = 1; moves = 25; target = 1500; combo = 0;
      state = 'idle'; dead = false; sel = null; swapPair = null;
      particles = []; floaters = []; banner = null;
      row.innerHTML = '';
      row.appendChild(MA.button('Restart', function () { reset(); }));
      row.appendChild(MA.button(sound ? 'Sound: on' : 'Sound: off', function () {
        sound = !sound; this.textContent = sound ? 'Sound: on' : 'Sound: off';
      }));
      hint.textContent = 'Swap two candies to match 3 or more';
      build(); setHud();
    }

    function hasMove() {
      var r, c;
      function trySwap(r1, c1, r2, c2) {
        var a = grid[r1][c1], b = grid[r2][c2];
        if (!a || !b) return false;
        grid[r1][c1] = b; grid[r2][c2] = a;
        var ok = findMatches().length > 0;
        grid[r1][c1] = a; grid[r2][c2] = b;
        return ok;
      }
      for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
        if (c + 1 < COLS && trySwap(r, c, r, c + 1)) return true;
        if (r + 1 < ROWS && trySwap(r, c, r + 1, c)) return true;
      }
      return false;
    }

    // ---------- fx ----------
    function burst(x, y, color, n) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3.4;
        particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 1, color: color, r: 2 + Math.random() * 3 });
      }
    }

    var actx = null;
    function beep(freq, dur) {
      if (!sound) return;
      try {
        if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'triangle'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.05, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
        o.connect(g); g.connect(actx.destination);
        o.start(); o.stop(actx.currentTime + dur);
      } catch (e) { sound = false; }
    }

    // ---------- input ----------
    var lastTouched = null;
    var drag = null;

    function cellAt(x, y) {
      var c = Math.floor(x / CELL), r = Math.floor(y / CELL);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
      return { r: r, c: c };
    }
    function localXY(e) {
      var b = cv.getBoundingClientRect();
      return { x: (e.clientX - b.left) * (W / b.width), y: (e.clientY - b.top) * (H / b.height) };
    }
    function adjacent(a, b) {
      return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
    }

    function tryMove(a, b) {
      if (state !== 'idle' || dead) return;
      lastTouched = b;
      doSwap(a, b, false);
      beep(520, 0.05);
    }

    cv.addEventListener('pointerdown', function (e) {
      var p = localXY(e), cell = cellAt(p.x, p.y);
      if (!cell || state !== 'idle' || dead) return;
      if (sel && adjacent(sel, cell)) { var a = sel; sel = null; tryMove(a, cell); return; }
      sel = cell; drag = { from: cell, x: p.x, y: p.y };
      beep(300, 0.03);
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drag || state !== 'idle' || dead) return;
      var p = localXY(e), dx = p.x - drag.x, dy = p.y - drag.y;
      if (Math.abs(dx) < CELL * 0.45 && Math.abs(dy) < CELL * 0.45) return;
      var to = { r: drag.from.r, c: drag.from.c };
      if (Math.abs(dx) > Math.abs(dy)) to.c += dx > 0 ? 1 : -1; else to.r += dy > 0 ? 1 : -1;
      if (to.r < 0 || to.r >= ROWS || to.c < 0 || to.c >= COLS) { drag = null; sel = null; return; }
      var a = drag.from; drag = null; sel = null;
      tryMove(a, to);
    });
    cv.addEventListener('pointerup', function () { drag = null; });
    cv.addEventListener('pointerleave', function () { drag = null; });

    // ---------- hud ----------
    function setHud() {
      hud.innerHTML = '';
      function item(label, val) {
        var s = MA.el('span');
        s.appendChild(document.createTextNode(label + ' '));
        s.appendChild(MA.el('b', null, String(val)));
        return s;
      }
      hud.appendChild(item('Level', level));
      hud.appendChild(item('Score', score));
      hud.appendChild(item('Moves', moves));
      var pct = Math.max(0, Math.min(100, Math.round((score / target) * 100)));
      fill.style.width = pct + '%';
      bar.setAttribute('title', score + ' / ' + target);
    }

    // ---------- drawing ----------
    function shape(g, type, x, y, s) {
      var i = s / 2;
      g.beginPath();
      switch (type) {
        case 0: g.arc(x, y, i * 0.86, 0, Math.PI * 2); break;                      // circle
        case 1: rr(g, x - i * 0.78, y - i * 0.78, i * 1.56, i * 1.56, i * 0.3); break; // rounded square
        case 2: star(g, x, y, i * 0.95, i * 0.44, 5); break;                        // star
        case 3: g.moveTo(x, y - i * 0.9); g.lineTo(x + i * 0.85, y); g.lineTo(x, y + i * 0.9); g.lineTo(x - i * 0.85, y); g.closePath(); break; // diamond
        case 4: g.moveTo(x, y - i * 0.92); g.quadraticCurveTo(x + i * 0.95, y + i * 0.15, x, y + i * 0.85); g.quadraticCurveTo(x - i * 0.95, y + i * 0.15, x, y - i * 0.92); g.closePath(); break; // drop
        default: hex(g, x, y, i * 0.88); break;                                      // hexagon
      }
    }
    function rr(g, x, y, w, h, r) {
      g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }
    function star(g, cx, cy, ro, ri, n) {
      for (var i = 0; i < n * 2; i++) {
        var rad = i % 2 ? ri : ro, a = (Math.PI / n) * i - Math.PI / 2;
        var x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    }
    function hex(g, cx, cy, r) {
      for (var i = 0; i < 6; i++) {
        var a = (Math.PI / 3) * i - Math.PI / 2;
        var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    }

    function drawTile(t, px, py, size) {
      var cx = px + CELL / 2, cy = py + CELL / 2, s = size * t.sc;
      if (s <= 0.5) return;
      ctx.save();
      ctx.globalAlpha = t.dying ? Math.max(0, t.sc) : 1;
      // glow
      ctx.shadowColor = COLORS[t.t]; ctx.shadowBlur = t.sp ? 16 : 7;
      if (t.sp === SP.RAINBOW) {
        var grd = ctx.createLinearGradient(cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2);
        COLORS.forEach(function (c, i) { grd.addColorStop(i / (COLORS.length - 1), c); });
        ctx.fillStyle = grd;
      } else ctx.fillStyle = COLORS[t.t];
      shape(ctx, t.t, cx, cy, s);
      ctx.fill();
      ctx.shadowBlur = 0;
      // inner highlight
      ctx.fillStyle = 'rgba(255,255,255,.42)';
      ctx.beginPath(); ctx.ellipse(cx - s * 0.16, cy - s * 0.2, s * 0.16, s * 0.11, -0.5, 0, Math.PI * 2); ctx.fill();
      // rim
      ctx.strokeStyle = DARK[t.t]; ctx.lineWidth = Math.max(1, s * 0.05);
      shape(ctx, t.t, cx, cy, s); ctx.stroke();
      // special markers
      if (t.sp === SP.H || t.sp === SP.V) {
        ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = Math.max(2, s * 0.1);
        ctx.beginPath();
        if (t.sp === SP.H) { ctx.moveTo(cx - s * 0.42, cy); ctx.lineTo(cx + s * 0.42, cy); }
        else { ctx.moveTo(cx, cy - s * 0.42); ctx.lineTo(cx, cy + s * 0.42); }
        ctx.stroke();
      } else if (t.sp === SP.BOMB) {
        ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = Math.max(2, s * 0.09);
        ctx.beginPath(); ctx.arc(cx, cy, s * 0.44, 0, Math.PI * 2); ctx.stroke();
      } else if (t.sp === SP.RAINBOW) {
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        ctx.beginPath(); ctx.arc(cx, cy, s * 0.14, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    function draw() {
      ctx.save();
      if (shake > 0.4) { ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); }
      // board background
      var bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#3b1e6e'); bg.addColorStop(.5, '#5b2a86'); bg.addColorStop(1, '#1e2a6b');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.02)';
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
      // selection
      if (sel && state === 'idle') {
        var pulse = 0.55 + 0.35 * Math.sin(performance.now() / 160);
        ctx.strokeStyle = 'rgba(255,255,255,' + pulse.toFixed(2) + ')';
        ctx.lineWidth = 3;
        ctx.strokeRect(sel.c * CELL + 2, sel.r * CELL + 2, CELL - 4, CELL - 4);
      }
      // tiles
      for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) {
        var t = grid[r2][c2];
        if (t) drawTile(t, t.px, t.py, CELL * 0.82);
      }
      // particles
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // floating text
      ctx.textAlign = 'center';
      for (var f = 0; f < floaters.length; f++) {
        var fl = floaters[f];
        ctx.globalAlpha = Math.max(0, fl.life);
        ctx.font = '800 ' + Math.round(CELL * 0.42) + 'px system-ui';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.45)';
        ctx.strokeText(fl.text, fl.x, fl.y);
        ctx.fillStyle = fl.color;
        ctx.fillText(fl.text, fl.x, fl.y);
      }
      ctx.globalAlpha = 1;
      // combo banner
      if (banner) {
        ctx.globalAlpha = Math.min(1, banner.life);
        ctx.font = '900 ' + Math.round(CELL * 0.72) + 'px system-ui';
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.5)';
        ctx.strokeText(banner.text, W / 2, H / 2);
        var g2 = ctx.createLinearGradient(0, H / 2 - 30, 0, H / 2 + 10);
        g2.addColorStop(0, '#fff'); g2.addColorStop(1, '#ffd93d');
        ctx.fillStyle = g2;
        ctx.fillText(banner.text, W / 2, H / 2);
        ctx.globalAlpha = 1;
      }
      if (dead) {
        ctx.fillStyle = 'rgba(10,6,26,.72)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(CELL * 0.52) + 'px system-ui';
        ctx.fillText('Out of moves', W / 2, H / 2 - 6);
        ctx.font = '600 ' + Math.round(CELL * 0.32) + 'px system-ui';
        ctx.fillText('Score ' + score, W / 2, H / 2 + CELL * 0.42);
      }
      ctx.restore();
    }

    // ---------- loop ----------
    var last = 0, raf;
    function settled() {
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var t = grid[r][c];
        if (!t) continue;
        var tx = c * CELL, ty = r * CELL;
        if (Math.abs(t.px - tx) > 0.8 || Math.abs(t.py - ty) > 0.8) return false;
      }
      return true;
    }

    function loop(now) {
      var dt = last ? Math.min((now - last) / 16.67, 3) : 1; last = now;

      // movement easing
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var t = grid[r][c];
        if (!t) continue;
        var tx = c * CELL, ty = r * CELL;
        t.px += (tx - t.px) * Math.min(1, 0.24 * dt);
        t.py += (ty - t.py) * Math.min(1, 0.24 * dt);
        if (t.dying) t.sc -= 0.09 * dt;
        else if (t.sc > 1) t.sc -= 0.05 * dt;
        else if (t.sc < 1) t.sc = 1;
      }

      // particles / floaters
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.16 * dt; p.life -= 0.03 * dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (var f = floaters.length - 1; f >= 0; f--) {
        floaters[f].y -= 0.9 * dt; floaters[f].life -= 0.022 * dt;
        if (floaters[f].life <= 0) floaters.splice(f, 1);
      }
      if (banner) { banner.life -= 0.018 * dt; if (banner.life <= 0) banner = null; }
      if (shake > 0) shake = Math.max(0, shake - 0.6 * dt);

      // state machine
      if (!dead) {
        if (state === 'swap' || state === 'swapback') {
          if (settled()) resolve();
        } else if (state === 'clearing') {
          var pending = false;
          for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) {
            var t2 = grid[r2][c2];
            if (t2 && t2.dying && t2.sc > 0.05) { pending = true; }
          }
          if (!pending) {
            for (var r3 = 0; r3 < ROWS; r3++) for (var c3 = 0; c3 < COLS; c3++) if (grid[r3][c3] && grid[r3][c3].dying) grid[r3][c3] = null;
            applyGravity();
            setHud();
          }
        } else if (state === 'falling') {
          if (settled()) {
            var g = findMatches();
            if (g.length) { combo++; processGroups(g); }
            else { state = 'idle'; endOfCascadeCheck(); }
          }
        }
      }

      draw();
      raf = requestAnimationFrame(loop);
    }

    function onResize() {
      var w = host.clientWidth || 360;
      var nc = Math.floor(Math.min(Math.min(w, 420), 420) / COLS);
      if (nc !== CELL) {
        CELL = nc; W = CELL * COLS; H = CELL * ROWS;
        ctx = MA.fitCanvas(cv, W, H);
      }
    }
    window.addEventListener('resize', onResize);

    MA._match3Cleanup = function () { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };

    // small debug hook used by smoke_test.js (harmless in production)
    MA._match3Debug = function () {
      return {
        grid: grid, findMatches: findMatches, hasMove: hasMove,
        st: function () { return state; }, score: function () { return score; },
        moves: function () { return moves; }, cell: CELL, COLS: COLS, ROWS: ROWS,
        swap: function (a, b) { tryMove(a, b); }
      };
    };

    reset();
    raf = requestAnimationFrame(loop);
  };
})(window.MiniArcade);
