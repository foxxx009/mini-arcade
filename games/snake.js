/* Snake — eat, grow, don't bite yourself. Arrows / WASD / swipe */
(function (MA) {
  'use strict';
  var COLS = 20, ROWS = 20, CELL = 18, W = COLS * CELL, H = ROWS * CELL;

  MA.startSnake = function (host) {
    host.innerHTML = '';
    var cv = document.createElement('canvas');
    var ctx = MA.fitCanvas(cv, W, H);
    host.appendChild(cv);
    var hud = MA.el('div', 'hud');
    host.appendChild(hud);
    var hint = MA.el('div', 'hint', 'Arrow keys / WASD / swipe to steer.');
    host.appendChild(hint);
    var row = MA.el('div', 'row');
    host.appendChild(row);

    var snake, dir, nextDirs, food, score, dead, acc, step;

    function setHud() {
      hud.innerHTML = '';
      var s = MA.el('span');
      s.appendChild(document.createTextNode('Score '));
      s.appendChild(MA.el('b', null, String(score)));
      hud.appendChild(s);
      var b = MA.el('span');
      b.appendChild(document.createTextNode('Best '));
      b.appendChild(MA.el('b', null, String(MA.best('snake'))));
      hud.appendChild(b);
    }

    function placeFood() {
      var free = [];
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var taken = false;
        for (var i = 0; i < snake.length; i++) if (snake[i][0] === c && snake[i][1] === r) { taken = true; break; }
        if (!taken) free.push([c, r]);
      }
      if (!free.length) { food = null; return; }
      food = free[Math.floor(Math.random() * free.length)];
    }

    function reset() {
      snake = [[8, 10], [7, 10], [6, 10]];
      dir = [1, 0]; nextDirs = [];
      score = 0; dead = false; acc = 0; step = 120;
      placeFood();
      row.innerHTML = '';
      hint.textContent = 'Arrow keys / WASD / swipe to steer.';
      setHud();
    }

    function tick() {
      if (nextDirs.length) {
        var nd = nextDirs.shift();
        if (nd[0] !== -dir[0] || nd[1] !== -dir[1]) dir = nd;
      }
      var head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
      if (head[0] < 0 || head[0] >= COLS || head[1] < 0 || head[1] >= ROWS) return die();
      for (var i = 1; i < snake.length - 1; i++) if (snake[i][0] === head[0] && snake[i][1] === head[1]) return die();
      snake.unshift(head);
      if (food && head[0] === food[0] && head[1] === food[1]) {
        score++;
        MA.setBest('snake', score);
        if (step > 62) step -= 3;
        placeFood();
        setHud();
      } else {
        snake.pop();
      }
    }

    function die() {
      dead = true;
      MA.setBest('snake', score);
      setHud();
      hint.textContent = 'Game over — you ate ' + score + ' pellets.';
      row.innerHTML = '';
      row.appendChild(MA.button('Play again', function () { reset(); }, true));
      MA.onRoundEnd();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0a0c18';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(110,231,255,.05)';
      for (var g = 0; g <= W; g += CELL) {
        ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(W, g); ctx.stroke();
      }
      if (food) {
        ctx.fillStyle = '#fb7185';
        ctx.beginPath();
        ctx.arc(food[0] * CELL + CELL / 2, food[1] * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
      }
      for (var i = 0; i < snake.length; i++) {
        var s = snake[i];
        var t = i / Math.max(snake.length - 1, 1);
        ctx.fillStyle = 'hsl(' + (150 - t * 60) + ',75%,' + (62 - t * 14) + '%)';
        var pad = i === 0 ? 1 : 2;
        ctx.fillRect(s[0] * CELL + pad, s[1] * CELL + pad, CELL - pad * 2, CELL - pad * 2);
      }
      if (dead) {
        ctx.fillStyle = 'rgba(10,12,24,.72)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#e8ecff';
        ctx.font = '700 22px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Game over', W / 2, H / 2);
      }
    }

    var last = 0, raf;
    function loop(t) {
      if (!last) last = t;
      var dt = t - last; last = t;
      if (!dead) {
        acc += dt;
        if (acc >= step) { acc = 0; tick(); }
      }
      draw();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    var KEY = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1],
      A: [-1, 0], D: [1, 0], W: [0, -1], S: [0, 1]
    };
    function onKey(e) {
      var d = KEY[e.key];
      if (d) { e.preventDefault(); if (nextDirs.length < 3) nextDirs.push(d); }
    }
    var sx = 0, sy = 0, tracking = false;
    function pdown(e) { tracking = true; sx = e.clientX; sy = e.clientY; }
    function pup(e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      var d = Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1];
      if (nextDirs.length < 3) nextDirs.push(d);
    }
    document.addEventListener('keydown', onKey);
    cv.addEventListener('pointerdown', pdown);
    cv.addEventListener('pointerup', pup);
    MA._snakeCleanup = function () {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      cv.removeEventListener('pointerdown', pdown);
      cv.removeEventListener('pointerup', pup);
    };

    reset();
  };
})(window.MiniArcade);
