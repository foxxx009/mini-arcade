/* Reflex Test — measure your reaction time, 5 rounds, average in ms */
(function (MA) {
  'use strict';
  var ROUNDS = 5;

  MA.startReflex = function (host) {
    host.innerHTML = '';
    var pad = MA.el('div', 'reflex wait', 'Click to start');
    host.appendChild(pad);
    var hud = MA.el('div', 'hud');
    host.appendChild(hud);
    var hint = MA.el('div', 'hint', 'Wait for green, then click as fast as you can.');
    host.appendChild(hint);
    var row = MA.el('div', 'row');
    host.appendChild(row);

    var state = 'idle', t0 = 0, times = [], timer = null;

    function setHud() {
      hud.innerHTML = '';
      var avg = times.length ? Math.round(times.reduce(function (a, b) { return a + b; }, 0) / times.length) : 0;
      var s = MA.el('span');
      s.appendChild(document.createTextNode('Average '));
      s.appendChild(MA.el('b', null, avg ? avg + ' ms' : '—'));
      hud.appendChild(s);
      var b = MA.el('span');
      b.appendChild(document.createTextNode('Best '));
      var bv = MA.best('reflex');
      b.appendChild(MA.el('b', null, bv ? bv + ' ms' : '—'));
      hud.appendChild(b);
      var r = MA.el('span');
      r.appendChild(document.createTextNode('Round '));
      r.appendChild(MA.el('b', null, Math.min(times.length + 1, ROUNDS) + '/' + ROUNDS));
      hud.appendChild(r);
    }

    function finish() {
      var avg = Math.round(times.reduce(function (a, b) { return a + b; }, 0) / times.length);
      var isBest = MA.setBest('reflex', avg);
      state = 'done';
      pad.className = 'reflex done';
      pad.innerHTML = 'Average <span style="color:var(--good)">' + avg + ' ms</span><br>' +
        '<span style="font-size:14px;font-weight:400;color:var(--dim)">' +
        (avg < 200 ? 'Excellent — top-tier reflexes' : avg < 270 ? 'Above average' : avg < 350 ? 'Typical human range' : 'A bit slow — try again') +
        '</span>';
      hint.textContent = isBest ? 'New personal best!' : 'Best so far: ' + MA.best('reflex') + ' ms';
      row.innerHTML = '';
      row.appendChild(MA.button('Try again', function () { reset(); }, true));
      setHud();
      MA.onRoundEnd();
    }

    function wait() {
      state = 'wait';
      pad.className = 'reflex wait';
      pad.textContent = 'Wait for green…';
      hint.textContent = 'Do not click yet.';
      timer = setTimeout(function () {
        state = 'go';
        pad.className = 'reflex go';
        pad.textContent = 'CLICK!';
        t0 = performance.now();
      }, 1200 + Math.random() * 2800);
    }

    function reset() {
      times = []; state = 'idle'; clearTimeout(timer);
      row.innerHTML = '';
      hint.textContent = 'Wait for green, then click as fast as you can.';
      pad.className = 'reflex wait';
      pad.textContent = 'Click to start';
      setHud();
    }

    function onTap() {
      if (state === 'idle') { wait(); return; }
      if (state === 'wait') {
        clearTimeout(timer);
        state = 'idle';
        pad.className = 'reflex wait';
        pad.textContent = 'Too early — click to retry';
        hint.textContent = 'You clicked before green. Try again.';
        return;
      }
      if (state === 'go') {
        var ms = Math.round(performance.now() - t0);
        times.push(ms);
        state = 'idle';
        pad.className = 'reflex done';
        pad.innerHTML = '<span style="color:var(--good)">' + ms + ' ms</span>';
        setHud();
        if (times.length >= ROUNDS) { setTimeout(finish, 700); }
        else { hint.textContent = 'Round ' + times.length + ' of ' + ROUNDS + ' done.'; setTimeout(wait, 900); }
        return;
      }
      if (state === 'done') { reset(); }
    }

    pad.addEventListener('click', onTap);
    MA._reflexCleanup = function () { clearTimeout(timer); pad.removeEventListener('click', onTap); };
    setHud();
  };
})(window.MiniArcade);
