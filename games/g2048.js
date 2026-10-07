/* 2048 — classic tile merge puzzle. Arrow keys / WASD / swipe */
(function (MA) {
  'use strict';
  var N = 4;

  function emptyCells(g) {
    var out = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (!g[r][c]) out.push([r, c]);
    return out;
  }
  function addRandom(g) {
    var e = emptyCells(g);
    if (!e.length) return false;
    var p = e[Math.floor(Math.random() * e.length)];
    g[p[0]][p[1]] = Math.random() < 0.9 ? 2 : 4;
    return true;
  }
  function line(arr) {
    var a = arr.filter(function (v) { return v; });
    var out = [], gained = 0;
    for (var i = 0; i < a.length; i++) {
      if (a[i] === a[i + 1]) { out.push(a[i] * 2); gained += a[i] * 2; i++; }
      else out.push(a[i]);
    }
    while (out.length < N) out.push(0);
    return { out: out, gained: gained, moved: out.join() !== arr.join() };
  }
  function canMove(g) {
    if (emptyCells(g).length) return true;
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      if (c + 1 < N && g[r][c] === g[r][c + 1]) return true;
      if (r + 1 < N && g[r][c] === g[r + 1][c]) return true;
    }
    return false;
  }

  MA.start2048 = function (host) {
    host.innerHTML = '';
    var board = MA.el('div', 'b2048');
    host.appendChild(board);
    var hud = MA.el('div', 'hud');
    host.appendChild(hud);
    var hint = MA.el('div', 'hint', 'Arrow keys / WASD / swipe to move. Merge tiles to reach 2048.');
    host.appendChild(hint);
    var row = MA.el('div', 'row');
    host.appendChild(row);

    var g, score, dead, won;

    function setHud() {
      hud.innerHTML = '';
      var s = MA.el('span');
      s.appendChild(document.createTextNode('Score '));
      s.appendChild(MA.el('b', null, String(score)));
      hud.appendChild(s);
      var b = MA.el('span');
      b.appendChild(document.createTextNode('Best '));
      b.appendChild(MA.el('b', null, String(MA.best('p2048'))));
      hud.appendChild(b);
    }

    function render() {
      board.innerHTML = '';
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var v = g[r][c];
        var d = document.createElement('div');
        if (v) { d.className = 't' + v; d.textContent = v; }
        board.appendChild(d);
      }
    }

    function reset() {
      g = [];
      for (var i = 0; i < N; i++) g.push([0, 0, 0, 0]);
      score = 0; dead = false; won = false;
      addRandom(g); addRandom(g);
      row.innerHTML = '';
      hint.textContent = 'Arrow keys / WASD / swipe to move. Merge tiles to reach 2048.';
      render(); setHud();
    }

    function move(dir) {
      if (dead) return;
      var gained = 0, moved = false;
      var r, c, res, arr;
      if (dir === 'left' || dir === 'right') {
        for (r = 0; r < N; r++) {
          arr = g[r].slice();
          if (dir === 'right') arr.reverse();
          res = line(arr);
          if (dir === 'right') res.out.reverse();
          if (res.moved) moved = true;
          gained += res.gained;
          g[r] = res.out;
        }
      } else {
        for (c = 0; c < N; c++) {
          arr = [];
          for (r = 0; r < N; r++) arr.push(g[r][c]);
          if (dir === 'down') arr.reverse();
          res = line(arr);
          if (dir === 'down') res.out.reverse();
          if (res.moved) moved = true;
          gained += res.gained;
          for (r = 0; r < N; r++) g[r][c] = res.out[r];
        }
      }
      if (!moved) return;
      score += gained;
      MA.setBest('p2048', score);
      addRandom(g);
      render(); setHud();
      if (!won && score >= 2048) { won = true; hint.textContent = 'You reached 2048! Keep going for a higher score.'; }
      if (!canMove(g)) {
        dead = true;
        hint.textContent = 'No moves left — final score ' + score + '.';
        row.innerHTML = '';
        row.appendChild(MA.button('New game', function () { reset(); }, true));
        MA.onRoundEnd();
      }
    }

    var KEY = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
      a: 'left', d: 'right', w: 'up', s: 'down',
      A: 'left', D: 'right', W: 'up', S: 'down'
    };
    function onKey(e) {
      var d = KEY[e.key];
      if (d) { e.preventDefault(); move(d); }
    }

    var sx = 0, sy = 0, tracking = false;
    function down(e) { tracking = true; sx = e.clientX; sy = e.clientY; }
    function up(e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
      else move(dy > 0 ? 'down' : 'up');
    }

    document.addEventListener('keydown', onKey);
    board.addEventListener('pointerdown', down);
    board.addEventListener('pointerup', up);
    MA._2048Cleanup = function () {
      document.removeEventListener('keydown', onKey);
      board.removeEventListener('pointerdown', down);
      board.removeEventListener('pointerup', up);
    };

    reset();
  };
})(window.MiniArcade);
