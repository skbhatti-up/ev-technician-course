/* ============================================================================
   VEHICLE EXPLORER
   ----------------------------------------------------------------------------
   Draws the vehicles described in vehicles.js and lets the trainee:
     1. Explore   - tap a part to read about it; pick a mode to see what is live
     2. Find it   - a quiz: "tap the 12 V battery" with the labels hidden
     3. Make safe - put the isolation steps in the right order
     4. Sources   - where every fact came from, and how sure we are
   The first choice in the vehicle bar, "Generic EV", is the original simulator
   (car.js). This file leaves that simulator alone and only shows or hides it.
   ========================================================================== */
(function () {
  var VEH = window.EV_VEHICLES, BASE = window.CAR_PARTS || {};
  var view = document.getElementById('carView');
  if (!VEH || !view) return;

  var NS = 'http://www.w3.org/2000/svg';
  var KEY = 'evcar.vx';                       // where progress is saved on the phone
  var store = { seen: {}, find: {}, safe: {}, last: 'generic' };
  try { var s = JSON.parse(localStorage.getItem(KEY)); if (s) for (var k in s) store[k] = s[k]; } catch (e) { }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { }
    try { window.dispatchEvent(new Event('evcar')); } catch (e) { }   // tells the app to refresh its report
  }

  var cur = null;        // the vehicle on screen
  var curId = '';
  var mode = null;       // the mode on screen
  var tab = 'explore';   // explore | find | safe | src
  var sel = '';          // the part the trainee tapped
  var quiz = null;       // state of the "find it" quiz
  var drill = null;      // state of the "make safe" drill

  /* ---------- small helpers ---------- */
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function $(id) { return document.getElementById(id); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // The text for a part: its own words first, then the shared wording from parts.js
  function txt(p, field) { return p[field] || (p.base && BASE[p.base] && BASE[p.base][field]) || ''; }
  function badge(conf) {
    return conf === 'ok' ? '<span class="vx-b ok">Confirmed</span>' : '<span class="vx-b ver">To verify</span>';
  }
  function srcLine(v, key) {
    var s = v.sources[key]; if (!s) return '';
    return s.u ? '<a href="' + esc(s.u) + '" target="_blank" rel="noopener">' + esc(s.t) + '</a>' : esc(s.t);
  }

  /* ---------- page skeleton (built once) ---------- */
  var generic = $('genericCar');
  var bar = $('vxBar'), root = $('vx');
  if (!generic || !bar || !root) return;

  var kinds = { HEV: 'Hybrid', PHEV: 'Plug-in hybrid', BEV: 'Battery electric', Bike: 'Two-wheeler' };
  var chips = '<button type="button" data-v="generic">Generic EV</button>';
  Object.keys(VEH).forEach(function (id) { chips += '<button type="button" data-v="' + id + '">' + esc(VEH[id].short) + '</button>'; });
  bar.innerHTML = chips;
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (b) choose(b.getAttribute('data-v'));
  });

  root.innerHTML =
    '<div class="vx-wrap">' +
      '<section class="stage">' +
        '<div class="statebar"><span id="vxState" class="state off">Off</span><span id="vxHint" class="muted"></span></div>' +
        '<svg id="vxSvg" role="img"></svg>' +
        '<div class="legend" id="vxLegend"></div>' +
        '<p class="muted vx-map">Simplified map, not to scale. It shows which area each part is in.</p>' +
      '</section>' +
      '<section>' +
        '<div class="card"><div class="vx-modes" id="vxModes" role="group" aria-label="Vehicle state"></div><p class="vx-note" id="vxNote"></p></div>' +
        '<div class="vx-tabs" id="vxTabs" role="tablist">' +
          '<button type="button" data-t="explore">Explore</button><button type="button" data-t="find">Find it</button>' +
          '<button type="button" data-t="safe">Make safe</button><button type="button" data-t="src">Facts</button>' +
        '</div>' +
        '<div class="card" id="vxPanel"></div>' +
      '</section>' +
    '</div>';

  $('vxTabs').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    tab = b.getAttribute('data-t');
    quiz = null; drill = null; sel = '';
    paint();
  });
  $('vxModes').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    mode = cur.modes.filter(function (m) { return m.id === b.getAttribute('data-m'); })[0];
    paint();
  });
  $('vxSvg').addEventListener('click', function (e) {
    var g = e.target.closest('.vx-part'); if (g) tapPart(g.getAttribute('data-id'));
  });
  $('vxPanel').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'quiz') startQuiz();
    if (act === 'drill') startDrill();
    if (act === 'step') tapStep(+b.getAttribute('data-i'), b);
  });

  /* ---------- choosing a vehicle ---------- */
  function choose(id) {
    if (id !== 'generic' && !VEH[id]) id = 'generic';
    store.last = id; save();
    [].forEach.call(bar.children, function (b) { b.classList.toggle('on', b.getAttribute('data-v') === id); });
    var isGeneric = id === 'generic';
    generic.hidden = !isGeneric;
    root.hidden = isGeneric;
    if (isGeneric) return;
    cur = VEH[id]; curId = id; mode = cur.modes[0]; tab = 'explore'; sel = ''; quiz = null; drill = null;
    draw();
    paint();
  }

  /* ---------- drawing the vehicle (done once per vehicle) ---------- */
  function draw() {
    var svg = $('vxSvg'), v = cur, W = v.view.w, H = v.view.h;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('aria-label', v.name + '. ' + (v.view.outline === 'car' ? 'Top view, front of the car at the top.' : 'Side view.'));
    svg.setAttribute('class', v.view.outline === 'bike' ? 'bike' : 'car');

    var bg = el('g', { 'class': 'vx-body' }, svg);
    if (v.view.outline === 'car') {
      el('rect', { x: 70, y: 12, width: 260, height: 616, rx: 62 }, bg);
      [[52, 52], [330, 52], [52, 498], [330, 498]].forEach(function (w) { el('rect', { 'class': 'vx-wheel', x: w[0], y: w[1], width: 18, height: 62, rx: 6 }, bg); });
      // dashed lines split the car into the three areas a technician opens
      [[215, 'UNDER BONNET', 110], [480, 'CABIN FLOOR', 348], [0, 'BOOT', 555]].forEach(function (z) {
        if (z[0]) el('line', { 'class': 'vx-zone', x1: 74, y1: z[0], x2: 326, y2: z[0] }, bg);
        var t = el('text', { 'class': 'vx-zlbl', transform: 'translate(34 ' + z[2] + ') rotate(-90)' }, bg); t.textContent = z[1];
      });
      var f = el('text', { 'class': 'vx-zlbl', x: 200, y: 9, 'text-anchor': 'middle' }, bg); f.textContent = 'FRONT';
    } else {
      // a simple scooter seen from the side: two wheels, floorboard, seat, steering column
      el('circle', { 'class': 'vx-tyre', cx: 90, cy: 300, r: 50 }, bg);
      el('circle', { 'class': 'vx-tyre', cx: 330, cy: 300, r: 50 }, bg);
      el('path', { 'class': 'vx-frame', d: 'M90 300 L120 262 L286 262 L310 120 M286 262 L330 300 M300 78 L330 300' }, bg);
      el('path', { 'class': 'vx-seat', d: 'M52 132 Q60 118 90 120 L226 126 Q240 128 240 140 L240 146 L56 146 Z' }, bg);
      el('path', { 'class': 'vx-frame', d: 'M214 70 L392 70' }, bg);
      var t1 = el('text', { 'class': 'vx-zlbl', x: 300, y: 22, 'text-anchor': 'middle' }, bg); t1.textContent = 'HANDLEBAR';
      var t2 = el('text', { 'class': 'vx-zlbl', x: 146, y: 112, 'text-anchor': 'middle' }, bg); t2.textContent = 'UNDER SEAT';
      var t3 = el('text', { 'class': 'vx-zlbl', x: 90, y: 372, 'text-anchor': 'middle' }, bg); t3.textContent = 'REAR WHEEL';
    }

    // cables and pipes go underneath the part boxes
    var lg = el('g', { 'class': 'vx-links' }, svg);
    Object.keys(v.links).forEach(function (id) {
      var L = v.links[id], segs = Array.isArray(L.p[0][0]) ? L.p : [L.p];
      var d = segs.map(function (s) { return 'M' + s.map(function (pt) { return pt[0] + ' ' + pt[1]; }).join(' L'); }).join(' ');
      el('path', { 'class': 'vx-ln lt-' + L.t, 'data-id': id, d: d }, lg);
    });

    // the tappable part boxes
    var pg = el('g', {}, svg);
    Object.keys(v.parts).forEach(function (id) {
      var p = v.parts[id];
      var g = el('g', { 'class': 'vx-part pk-' + p.k + (p.inside ? ' inner' : ''), 'data-id': id, tabindex: 0, role: 'button', 'aria-label': p.n }, pg);
      el('rect', { 'class': 'vx-box', x: p.x, y: p.y, width: p.w, height: p.h, rx: 7 }, g);
      var lines = String(p.s).split('\n'), small = p.w < 56 || lines.length > 1 || p.s.length * 6.2 > p.w;
      // a box with another part drawn inside it (a battery with its BMS): put its name top-left, clear of the inner box
      var big = Object.keys(v.parts).some(function (o) { return v.parts[o].inside === id; }) || (p.w > 130 && p.h > 60);
      var cy = big ? p.y + 22 : p.y + p.h / 2 - (lines.length - 1) * 5.5 + 3.5;
      var cx = big ? p.x + 12 : p.x + p.w / 2;
      lines.forEach(function (ln, i) {
        var t = el('text', { 'class': 'vx-lbl' + (small && !big ? ' sm' : '') + (i ? ' sub' : ''), x: cx, y: cy + i * 11.5, 'text-anchor': big ? 'start' : 'middle' }, g);
        t.textContent = ln;
      });
      var q = el('text', { 'class': 'vx-q', x: p.x + p.w / 2, y: p.y + p.h / 2 + 5, 'text-anchor': 'middle' }, g); q.textContent = '?';
    });

    // legend: only the cable types this vehicle uses
    var used = {};
    Object.keys(v.links).forEach(function (id) { used[v.links[id].t] = 1; });
    $('vxLegend').innerHTML = Object.keys(v.legend).filter(function (t) { return used[t]; }).map(function (t) {
      return '<span><i class="vx-key lt-' + t + '"></i>' + esc(v.legend[t]) + '</span>';
    }).join('');

    $('vxModes').innerHTML = v.modes.map(function (m) { return '<button type="button" data-m="' + m.id + '">' + esc(m.name) + '</button>'; }).join('');
  }

  /* ---------- which parts are live in the mode on screen ---------- */
  function liveSet() {
    var set = {};
    (cur.always || []).forEach(function (id) { set[id] = 'always'; });
    mode.live.forEach(function (id) { set[id] = 'on'; });
    return set;
  }

  /* ---------- repaint everything that changes ---------- */
  function paint() {
    var v = cur, svg = $('vxSvg'), live = liveSet(), flows = {};
    mode.flows.forEach(function (f) { flows[f[0]] = f[1]; });

    [].forEach.call(svg.querySelectorAll('.vx-ln'), function (ln) {
      var d = flows[ln.getAttribute('data-id')];
      ln.classList.toggle('live', !!d);
      ln.classList.toggle('rev', d === -1);
    });
    [].forEach.call(svg.querySelectorAll('.vx-part'), function (g) {
      var id = g.getAttribute('data-id');
      g.classList.toggle('live', live[id] === 'on');
      g.classList.toggle('sel', id === sel);
    });
    svg.classList.toggle('quiz', tab === 'find' && !!quiz && !quiz.done);

    [].forEach.call($('vxModes').children, function (b) { b.classList.toggle('on', b.getAttribute('data-m') === mode.id); });
    [].forEach.call($('vxTabs').children, function (b) { b.classList.toggle('on', b.getAttribute('data-t') === tab); });
    $('vxState').className = 'state ' + mode.cls;
    $('vxState').textContent = mode.name;
    $('vxHint').textContent = tab === 'find' && quiz && !quiz.done ? 'Labels are hidden. Tap the part you are asked for.' : 'Tap any part to learn about it.';
    $('vxNote').innerHTML = esc(mode.note) + (mode.conf === 'verify' ? ' ' + badge('verify') : '');

    var P = $('vxPanel');
    if (tab === 'explore') P.innerHTML = sel ? partHtml(sel, live) : introHtml();
    else if (tab === 'find') P.innerHTML = quizHtml();
    else if (tab === 'safe') P.innerHTML = drillHtml();
    else P.innerHTML = factsHtml();
  }

  function seenCount() { return Object.keys(store.seen[curId] || {}).length; }

  function introHtml() {
    var v = cur, n = Object.keys(v.parts).length;
    return '<h3>' + esc(v.name) + ' <span class="vx-kind">' + kinds[v.kind] + '</span></h3><p>' + esc(v.blurb) + '</p>' +
      '<p class="muted">Tap a part on the drawing. Then press the mode buttons above to see which cables carry power and which way it flows.</p>' +
      '<p class="muted">' + seenCount() + ' of ' + n + ' parts explored.</p>';
  }

  function partHtml(id, live) {
    var v = cur, p = v.parts[id], now;
    if (live[id] === 'on') now = 'Working in this mode (' + mode.name + ').';
    else if (live[id] === 'always') now = 'Always live or always connected, even with the vehicle off.';
    else now = 'Not powered in this mode (' + mode.name + ').';
    var h = '<h3>' + esc(p.n) + ' ' + badge(p.conf) + '</h3>';
    h += '<p><b>What it does.</b> ' + esc(txt(p, 'job')) + '</p>';
    if (txt(p, 'inside')) h += '<p><b>Inside.</b> ' + esc(txt(p, 'inside')) + '</p>';
    h += '<p class="vx-where"><b>Where to find it.</b> ' + esc(p.where) + '</p>';
    if (txt(p, 'safety')) h += '<p class="safety"><b>Safety.</b> ' + esc(txt(p, 'safety')) + '</p>';
    h += '<p class="livep"><b>Now:</b> ' + esc(now) + '</p>';
    h += '<p class="muted vx-src">' + (p.conf === 'ok' ? 'Source: ' : 'Typical layout, not yet confirmed for this model. Basis: ') + srcLine(v, p.src) + '</p>';
    return h;
  }

  function tapPart(id) {
    if (tab === 'find' && quiz && !quiz.done) { answer(id); return; }
    if (tab !== 'explore') { tab = 'explore'; quiz = null; drill = null; }
    sel = id;
    store.seen[curId] = store.seen[curId] || {};
    if (!store.seen[curId][id]) { store.seen[curId][id] = 1; save(); }
    paint();
    if (window.innerWidth < 820) $('vxPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- "Find it" quiz ---------- */
  function startQuiz() {
    quiz = { order: shuffle(Object.keys(cur.parts)), i: 0, right: 0, tries: 0, msg: '', done: false };
    paint();
  }
  function answer(id) {
    var want = quiz.order[quiz.i];
    if (id === want) {
      if (quiz.tries === 0) quiz.right++;
      quiz.msg = '<span class="vx-ok">Correct: ' + esc(cur.parts[want].n) + '.</span> ' + esc(cur.parts[want].where);
      quiz.i++; quiz.tries = 0;
      if (quiz.i >= quiz.order.length) {
        quiz.done = true;
        store.find[curId] = Math.max(store.find[curId] || 0, quiz.right); save();
      }
    } else {
      quiz.tries++;
      quiz.msg = '<span class="vx-no">Not that one.</span> You tapped the ' + esc(cur.parts[id].n) + '. Try again.';
    }
    paint();
  }
  function quizHtml() {
    var n = Object.keys(cur.parts).length, best = store.find[curId];
    if (!quiz) {
      return '<h3>Find it</h3><p>The labels are hidden. You are asked for one part at a time: tap where it is on the drawing.</p>' +
        '<p class="muted">You score a point only when your first tap is right.' + (best != null ? ' Best so far: ' + best + ' of ' + n + '.' : '') + '</p>' +
        '<button type="button" class="btn wide" data-act="quiz">Start</button>';
    }
    if (quiz.done) {
      return '<h3>Find it: finished</h3><div class="vx-big">' + quiz.right + ' / ' + n + '</div><p class="muted">right on the first tap</p>' +
        '<p>' + quiz.msg + '</p><button type="button" class="btn wide" data-act="quiz">Try again</button>';
    }
    return '<h3>Find it <span class="vx-kind">' + (quiz.i + 1) + ' of ' + n + '</span></h3>' +
      '<p class="vx-ask">Tap the <b>' + esc(cur.parts[quiz.order[quiz.i]].n) + '</b></p>' +
      (quiz.msg ? '<p>' + quiz.msg + '</p>' : '');
  }

  /* ---------- "Make safe" drill ---------- */
  function startDrill() {
    var idx = cur.safe.steps.map(function (s, i) { return i; });
    drill = { order: shuffle(idx), next: 0, slips: 0, msg: '' };
    paint();
  }
  function tapStep(i, btn) {
    if (i === drill.next) {
      drill.next++; drill.msg = '';
      if (drill.next >= cur.safe.steps.length) {
        store.safe[curId] = Math.min(store.safe[curId] == null ? 99 : store.safe[curId], drill.slips); save();
      }
      paint();
    } else {
      drill.slips++;
      drill.msg = 'Not yet. Think: switch off, disconnect, secure, wait, prove dead.';
      paint();
    }
  }
  function drillHtml() {
    var S = cur.safe, n = S.steps.length, h;
    if (!drill) {
      return '<h3>Make it safe</h3><p>The steps to isolate this vehicle are shuffled. Tap them in the order you would do them.</p>' +
        '<p class="safety">' + esc(S.note) + '</p>' +
        (store.safe[curId] != null ? '<p class="muted">Best so far: finished with ' + store.safe[curId] + ' wrong tap' + (store.safe[curId] === 1 ? '' : 's') + '.</p>' : '') +
        '<button type="button" class="btn wide" data-act="drill">Start</button>';
    }
    var done = drill.next >= n;
    h = '<h3>Make it safe <span class="vx-kind">' + (done ? 'done' : 'step ' + (drill.next + 1) + ' of ' + n) + '</span></h3>';
    h += '<ol class="vx-done">';
    for (var i = 0; i < drill.next; i++) {
      h += '<li>' + esc(S.steps[i].t) + (S.steps[i].conf ? ' ' + badge(S.steps[i].conf) : '') + '<small>' + esc(S.steps[i].why) + '</small></li>';
    }
    h += '</ol>';
    if (done) {
      h += '<p class="vx-ok">Correct order, with ' + drill.slips + ' wrong tap' + (drill.slips === 1 ? '' : 's') + '.</p><p class="safety">' + esc(S.note) + '</p>' +
        '<button type="button" class="btn wide" data-act="drill">Do it again</button>';
      return h;
    }
    if (drill.msg) h += '<p class="vx-no">' + esc(drill.msg) + '</p>';
    h += '<p class="muted">What do you do next?</p><div class="vx-steps">';
    drill.order.forEach(function (i) {
      if (i >= drill.next) h += '<button type="button" data-act="step" data-i="' + i + '">' + esc(S.steps[i].t) + '</button>';
    });
    return h + '</div>';
  }

  /* ---------- "Facts" tab: key figures, rescue notes and sources ---------- */
  function factsHtml() {
    var v = cur, h = '<h3>' + esc(v.name) + ': key facts</h3><table class="vx-facts">';
    v.facts.forEach(function (f) {
      h += '<tr><th>' + esc(f.l) + '</th><td>' + esc(f.v) + '<br>' + badge(f.conf) + ' <span class="muted vx-src">' + srcLine(v, f.src) + '</span></td></tr>';
    });
    h += '</table>';
    if (v.rescue && v.rescue.length) {
      h += '<h3 class="vx-h">From the maker\'s rescue information</h3><ul class="vx-list">';
      v.rescue.forEach(function (r) { h += '<li>' + esc(r.v) + ' <span class="muted vx-src">(' + srcLine(v, r.src) + ')</span></li>'; });
      h += '</ul><p class="muted">Rescue methods are for fire and rescue crews. Workshop isolation follows the service manual.</p>';
    }
    h += '<h3 class="vx-h">What the labels mean</h3><p>' + badge('ok') + ' Taken from an official maker document or a published specification.</p>' +
      '<p>' + badge('verify') + ' The usual layout for this type of vehicle. Not yet checked against this model\'s service manual, so do not rely on it for real work.</p>';
    return h;
  }

  // keyboard: Enter or Space on a part works like a tap
  $('vxSvg').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var g = e.target.closest('.vx-part'); if (g) { e.preventDefault(); tapPart(g.getAttribute('data-id')); }
  });

  choose(store.last || 'generic');
})();
