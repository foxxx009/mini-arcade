/* Stack Tower — drop moving blocks, keep only the overlapping part */
(function (MA) {
  'use strict';
  var W = 340, H = 540, BH = 24, START_W = 170;

  MA.startStack = function (host) {
    host.innerHTML = '';
    var cv = document.createElement('canvas');
    var ctx = MA.fitCanvas(cv, W, H);
    host.appendChild(cv);

    var hud = MA.hud([['Score', 0], ['Best', MA.best('stack')]]);
    host.appendChild(hud);
    var hint = MA.el('div', 'hint', 'Click / tap / press SPACE to drop the block');
    host.appendChild(hint);
    var row = MA.el('div', 'row');
    host.appendChild(row);

    var blocks = [], falling = [], score = 0, scroll = 0, over = false, flash = 0, combo = 0;
    var mov;

    function hue(i) { return (i * 26 + 190) % 360; }

    function reset() {
      blocks = []; falling = []; score = 0; scroll = 0; over = false; combo = 0; flash = 0;
      row.innerHTML = '';
      blocks.push({ x: (W - START_W) / 2, w: START_W });
      newBlock();
      setHud();
    }

    function newBlock() {
      var top = blocks[blocks.length - 1];
      var w = top.w;
      var speed = Math.min(1.5 + score * 0.09, 6.2);
      mov = { x: 0, w: w, dir: 1, speed: speed, y: blocks.length };
      if (Math.random() < 0.5) { mov.x = -w; mov.dir = 1; } else { mov.x = W; mov.dir = -1; }
    }

    function setHud() {
      hud.innerHTML = '';
      var s = MA.el('span');
      s.appendChild(document.createTextNode('Score '));
      s.appendChild(MA.el('b', null, String(score)));
      hud.appendChild(s);
      var b2 = MA.el('span');
      b2.appendChild(document.createTextNode('Best '));
      b2.appendChild(MA.el('b', null, String(MA.best('stack'))));
      hud.appendChild(b2);
    }

    function drop() {
      if (over) return;
      var top = blocks[blocks.length - 1];
      var l = Math.max(mov.x, top.x);
      var r = Math.min(mov.x + mov.w, top.x + top.w);
      var nw = r - l;

      if (nw <= 0.5) { gameOver(); return; }

      var perfect = Math.abs(mov.x - top.x) < 2.5;
      if (perfect) {
        nw = Math.min(top.w + (combo >= 2 ? 12 : 8), 240);
        mov.x = top.x + (top.w - nw) / 2;
        combo++; flash = 1;
      } else {
        combo = 0;
      }

      // leftover pieces fall away
      if (mov.x < l) falling.push({ x: mov.x, w: l - mov.x, y: blocks.length, vy: 0, side: -1 });
      if (mov.x + mov.w > r) falling.push({ x: r, w: mov.x + mov.w - r, y: blocks.length, vy: 0, side: 1 });

      blocks.push({ x: mov.x, w: nw });
      score++;
      if (MA.setBest('stack', score)) { }
      setHud();
      if (blocks.length > 6) scroll = blocks.length - 6;
      newBlock();
    }

    function gameOver() {
      over = true;
      MA.setBest('stack', score);
      setHud();
      hint.textContent = 'Game over — you stacked ' + score + ' blocks.';
      row.innerHTML = '';
      row.appendChild(MA.button('Play again', function () { reset(); }, true));
      MA.onRoundEnd();
    }

    function screenY(idx) { return H - 70 - (idx - scroll) * BH; }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      // backdrop grid
      ctx.strokeStyle = 'rgba(110,231,255,.06)';
      ctx.lineWidth = 1;
      for (var g = 0; g < H; g += 34) { ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(W, g); ctx.stroke(); }

      for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i];
        var y = screenY(i);
        if (y > H + BH || y < -BH) continue;
        var c = 'hsl(' + hue(i) + ',72%,' + (52 + (i % 3) * 4) + '%)';
        ctx.fillStyle = c;
        ctx.fillRect(b.x, y, b.w, BH);
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        ctx.fillRect(b.x, y, b.w, 5);
        ctx.strokeStyle = 'rgba(0,0,0,.28)';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x + .5, y + .5, b.w - 1, BH - 1);
      }

      for (var f = 0; f < falling.length; f++) {
        var p = falling[f];
        var py = screenY(p.y) + p.vy;
        ctx.globalAlpha = Math.max(0, 1 - p.vy / 400);
        ctx.fillStyle = 'hsl(' + hue(p.y) + ',72%,52%)';
        ctx.fillRect(p.x, py, p.w, BH);
        ctx.globalAlpha = 1;
      }

      if (!over && mov) {
        var my = screenY(mov.y);
        ctx.fillStyle = 'hsl(' + hue(mov.y) + ',80%,62%)';
        ctx.fillRect(mov.x, my, mov.w, BH);
        ctx.fillStyle = 'rgba(255,255,255,.22)';
        ctx.fillRect(mov.x, my, mov.w, 5);
      }

      if (flash > 0) {
        ctx.globalAlpha = flash;
        ctx.fillStyle = '#34d399';
        ctx.font = '700 26px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(perfectText(), W / 2, 120);
        ctx.globalAlpha = 1;
      }
    }
    function perfectText() { return combo >= 2 ? combo + 'x PERFECT' : 'PERFECT'; }

    var last = 0;
    function loop(t) {
      var dt = Math.min((t - last) / 16.67, 3); last = t;
      if (!over && mov) {
        mov.x += mov.dir * mov.speed * dt;
        if (mov.x + mov.w > W) { mov.x = W - mov.w; mov.dir = -1; }
        if (mov.x < 0) { mov.x = 0; mov.dir = 1; }
      }
      for (var i = falling.length - 1; i >= 0; i--) {
        falling[i].vy += 6 * dt;
        if (falling[i].vy > 420) falling.splice(i, 1);
      }
      if (flash > 0) flash -= 0.03 * dt;
      draw();
      raf = requestAnimationFrame(loop);
    }
    var raf = requestAnimationFrame(loop);

    function onTap(e) { if (e) e.preventDefault(); drop(); }
    cv.addEventListener('pointerdown', onTap);
    var onKey = function (e) { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); drop(); } };
    document.addEventListener('keydown', onKey);

    MA._stackCleanup = function () { cancelAnimationFrame(raf); cv.removeEventListener('pointerdown', onTap); document.removeEventListener('keydown', onKey); };

    reset();
  };
})(window.MiniArcade);
