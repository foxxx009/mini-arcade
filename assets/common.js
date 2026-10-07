/* Mini Arcade — shared runtime: ads, best-score storage, UI helpers */
(function () {
  'use strict';
  var MA = (window.MiniArcade = window.MiniArcade || {});

  /* ---------- config ----------
     Fill AD_CONFIG slots with the ad-network snippet each network gives you.
     Leave a slot as "" and nothing is rendered (no empty boxes, no layout shift).
     Networks that pay out in crypto (USDT/BTC) and accept free hosting:
       Adsterra  -> https://adsterra.com   (Bitcoin / USDT, min $5)
       Monetag   -> https://monetag.com    (USDT TRC20, min $5)
     Paste their snippet raw, it may be <script src="..."> or plain html.
  --------------------------------------------------------------- */
  var AD_CONFIG = (window.AD_CONFIG = window.AD_CONFIG || {
    enabled: false,
    slots: {
      'ad-top': '',
      'ad-home': '',
      'ad-game': '',
      'ad-interstitial': ''
    },
    interstitialEvery: 3 // show interstitial after every N finished rounds
  });

  function injectHTML(el, html) {
    if (!el || !html) return;
    el.innerHTML = html;
    // re-create <script> nodes: innerHTML-inserted scripts do not execute
    var scripts = el.querySelectorAll('script');
    Array.prototype.forEach.call(scripts, function (old) {
      var s = document.createElement('script');
      Array.prototype.forEach.call(old.attributes, function (a) { s.setAttribute(a.name, a.value); });
      s.text = old.text;
      old.parentNode.replaceChild(s, old);
    });
  }

  MA.renderAds = function () {
    if (!AD_CONFIG.enabled) return;
    Object.keys(AD_CONFIG.slots || {}).forEach(function (id) {
      if (id === 'ad-interstitial') return; // injected on demand
      injectHTML(document.getElementById(id), AD_CONFIG.slots[id]);
    });
  };

  /** Call at the end of a round. Shows an interstitial every N rounds. */
  MA.onRoundEnd = function () {
    if (!AD_CONFIG.enabled) return;
    try {
      var n = (parseInt(localStorage.getItem('ma_rounds') || '0', 10) || 0) + 1;
      localStorage.setItem('ma_rounds', String(n));
      var every = AD_CONFIG.interstitialEvery || 3;
      if (n % every !== 0) return;
      var html = AD_CONFIG.slots['ad-interstitial'];
      if (!html) return;
      var ov = document.createElement('div');
      ov.className = 'overlay';
      ov.innerHTML =
        '<div class="box"><div class="adlabel">Advertisement</div><div class="adbody"></div>' +
        '<div style="margin-top:14px"><button class="btn primary" id="maClose">' +
        'Continue playing</button></div></div>';
      document.body.appendChild(ov);
      injectHTML(ov.querySelector('.adbody'), html);
      ov.querySelector('#maClose').addEventListener('click', function () {
        ov.remove();
      });
    } catch (e) { /* storage blocked: skip */ }
  };

  /* ---------- best score ---------- */
  MA.best = function (key) {
    try { return parseInt(localStorage.getItem('ma_best_' + key) || '0', 10) || 0; } catch (e) { return 0; }
  };
  MA.setBest = function (key, val) {
    try {
      var cur = MA.best(key);
      var better = MA.higherIsBetter(key) ? val > cur : (cur === 0 || val < cur);
      if (better) { localStorage.setItem('ma_best_' + key, String(val)); return true; }
    } catch (e) { }
    return false;
  };
  var LOWER_IS_BETTER = { reflex: true }; // reaction time in ms
  MA.higherIsBetter = function (key) { return !LOWER_IS_BETTER[key]; };

  /* ---------- ui helpers ---------- */
  MA.el = function (tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  MA.hud = function (pairs) {
    var d = MA.el('div', 'hud');
    pairs.forEach(function (p) {
      var s = MA.el('span');
      s.appendChild(document.createTextNode(p[0] + ' '));
      var b = MA.el('b', null, String(p[1]));
      s.appendChild(b);
      d.appendChild(s);
    });
    return d;
  };
  MA.button = function (label, onClick, primary) {
    var b = MA.el('button', 'btn' + (primary ? ' primary' : ''), label);
    b.addEventListener('click', onClick);
    return b;
  };

  /* ---------- canvas helpers ---------- */
  MA.fitCanvas = function (cv, w, h) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  };

  document.addEventListener('DOMContentLoaded', function () { MA.renderAds(); });
})();
