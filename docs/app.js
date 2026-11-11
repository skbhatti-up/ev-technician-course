/* EV & Hybrid Technician course app: study tracking, quizzes, exam, report and sync. */
(function () {
  'use strict';
  var CFG = window.EV_CONFIG || {};
  var BANK = window.BANK || [];
  var KEY = 'evhtc-v1';
  var PASS = 0.8, EXAM_N = 40, EXAM_SAFE = 10, EXAM_MIN = 45, COOLDOWN_H = 6, MIN_READ_S = 120;
  var view = document.getElementById('view');
  var barTitle = document.getElementById('bartitle');
  var backBtn = document.getElementById('back');
  var syncEl = document.getElementById('syncstate');

  // ---------- catalogue of modules and appendices (from <template> elements)
  var MODS = [], APX = [];
  document.querySelectorAll('template[data-m]').forEach(function (t) {
    MODS.push({ m: +t.dataset.m, title: t.dataset.title, part: t.dataset.part, tpl: t });
  });
  document.querySelectorAll('template[data-apx]').forEach(function (t) {
    APX.push({ k: t.dataset.apx, title: t.dataset.title, tpl: t });
  });
  var QUIZ_MODS = MODS.filter(function (x) { return x.tpl.content.querySelector('.quiz'); }).map(function (x) { return x.m; });

  // ---------- state
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
  }
  var S = load() || { v: 1, id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), name: '', created: Date.now(), mods: {}, days: {}, practice: { n: 0, right: 0 }, exams: [], lastSync: 0, dirty: true };
  S.help = S.help || {}; S.notes = S.notes || {};
  function save() { S.dirty = true; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
  function mod(m) { return S.mods[m] || (S.mods[m] = { t: 0, read: false, qbest: -1, qn: 0, qtries: 0 }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtTime(s) { var h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? h + ' h ' + m + ' min' : m + ' min'; }
  function fmtDate(ts) { return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---------- derived numbers
  function stats() {
    var total = 0, dayCount = 0, read = 0, qpass = 0, qsum = 0, qdone = 0;
    Object.keys(S.days).forEach(function (d) { total += S.days[d]; if (S.days[d] >= 300) dayCount++; });
    MODS.forEach(function (x) { if (mod(x.m).read) read++; });
    QUIZ_MODS.forEach(function (m) { var o = mod(m); if (o.qbest >= 0) { qdone++; qsum += o.qbest / o.qn; if (o.qbest / o.qn >= PASS) qpass++; } });
    var done = S.exams.filter(function (e) { return !e.abandoned; });
    var passes = done.filter(function (e) { return e.pass; });
    var passDays = {}; passes.forEach(function (e) { passDays[new Date(e.ts).toDateString()] = 1; });
    var best = done.reduce(function (b, e) { return !b || e.score / e.total > b.score / b.total ? e : b; }, null);
    var c1 = read === MODS.length, c2 = qpass === QUIZ_MODS.length, c3 = Object.keys(passDays).length >= 2;
    return { total: total, days: dayCount, read: read, qpass: qpass, qdone: qdone, qavg: qdone ? Math.round(100 * qsum / qdone) : 0, exams: done.length, abandoned: S.exams.length - done.length, passes: passes.length, best: best, c1: c1, c2: c2, c3: c3, ready: c1 && c2 && c3 };
  }

  // ---------- study timer: counts only while the app is visible and recently touched
  var current = null, lastTouch = Date.now();
  ['scroll', 'touchstart', 'click', 'keydown', 'mousemove'].forEach(function (ev) { window.addEventListener(ev, function () { lastTouch = Date.now(); }, { passive: true }); });
  setInterval(function () {
    if (document.hidden || !current || Date.now() - lastTouch > 120000) return;
    var d = today(); S.days[d] = (S.days[d] || 0) + 5;
    if (current.m) { var o = mod(current.m); o.t += 5; if (current.atEnd && !o.read && o.t >= MIN_READ_S) { o.read = true; markRead(); } }
    save();
  }, 5000);

  // ---------- sync
  function payload() {
    var st = stats();
    return {
      id: S.id, name: S.name, sent: new Date().toISOString(), app: CFG.version || '',
      studySeconds: st.total, studyDays: st.days, modulesRead: st.read, modulesTotal: MODS.length,
      quizzesPassed: st.qpass, quizzesTotal: QUIZ_MODS.length, quizAverage: st.qavg,
      practiceAnswered: S.practice.n, practiceCorrect: S.practice.right,
      examAttempts: st.exams, examAbandoned: st.abandoned, examPasses: st.passes,
      bestExam: st.best ? Math.round(100 * st.best.score / st.best.total) : null,
      bestExamSafety: st.best ? st.best.safeRight + '/' + st.best.safeTotal : null,
      lastExam: S.exams.length ? new Date(S.exams[S.exams.length - 1].ts).toISOString() : null,
      ready: st.ready,
      needHelp: Object.keys(S.help).slice(0, 60),
      comments: Object.keys(S.notes).map(function (m) { return 'M' + m + ': ' + S.notes[m]; }).join(' | ').slice(0, 3000),
      examWeak: weakMods(),
      modules: MODS.map(function (x) { var o = mod(x.m); return { m: x.m, seconds: o.t, read: o.read, quizBest: o.qbest < 0 ? null : o.qbest + '/' + o.qn, quizTries: o.qtries }; })
    };
  }
  function weakMods() {
    var c = {}; S.exams.forEach(function (e) { (e.weak || []).forEach(function (m) { c[m] = (c[m] || 0) + 1; }); });
    return Object.keys(c).map(Number).sort(function (a, b) { return c[b] - c[a] || a - b; }).slice(0, 8).map(function (m) { return 'M' + m + (c[m] > 1 ? ' x' + c[m] : ''); }).join(', ');
  }
  function showSync() {
    if (!CFG.syncUrl) { syncEl.textContent = ''; return; }
    syncEl.textContent = S.dirty ? (navigator.onLine ? 'saving…' : 'offline') : 'synced ✓';
  }
  var syncing = false;
  function sync(force) {
    showSync();
    if (!CFG.syncUrl || !S.name || syncing || !navigator.onLine) return;
    if (!S.dirty && !force) return;
    if (!force && Date.now() - S.lastSync < 10 * 60000) return;
    syncing = true;
    fetch(CFG.syncUrl, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload()) })
      .then(function () { S.lastSync = Date.now(); S.dirty = false; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } })
      .catch(function () { })
      .then(function () { syncing = false; showSync(); });
  }
  window.addEventListener('online', function () { sync(true); });
  document.addEventListener('visibilitychange', function () { sync(document.hidden); });
  setInterval(function () { sync(false); }, 15 * 60000);

  // ---------- navigation helpers
  var activeTimer = null;
  function nav(h) { if (location.hash === h) route(); else location.hash = h; }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (a && a.getAttribute('href') === location.hash) { e.preventDefault(); route(); }
  });

  // ---------- chrome
  function chrome(title, tab, back) {
    barTitle.textContent = title;
    backBtn.style.display = back ? 'block' : 'none';
    backBtn.onclick = function () { nav(back); };
    document.querySelectorAll('.tabs a').forEach(function (a) { a.classList.toggle('on', a.dataset.tab === tab); });
    view.className = '';
    window.scrollTo(0, 0);
  }

  // ---------- screens
  function welcome() {
    current = null; chrome('Welcome', 'home');
    view.innerHTML = '<div class="card"><h3>EV &amp; Hybrid Technician Foundation Course</h3>' +
      '<p>This app holds the full course, tracks your study time and quiz results, and has a final exam.</p>' +
      '<p class="muted">Your progress is saved on this phone' + (CFG.syncUrl ? ' and shared automatically with your course sponsor.' : '.') + '</p>' +
      '<p><b>Your name</b></p><input class="txt" id="nm" maxlength="40" autocomplete="name" placeholder="Type your full name">' +
      '<button class="btn wide" id="go">Start</button></div>';
    document.getElementById('go').onclick = function () {
      var v = document.getElementById('nm').value.trim();
      if (v.length < 2) return;
      S.name = v; save(); sync(true); location.hash = '#home'; route();
    };
  }

  function home() {
    current = { q: 1 }; chrome('EV Technician Course', 'home');
    var st = stats();
    var next = MODS.filter(function (x) { return !mod(x.m).read; })[0];
    var pct = Math.round(100 * (st.read + st.qpass + Math.min(st.passes, 2)) / (MODS.length + QUIZ_MODS.length + 2));
    view.innerHTML =
      '<div class="card"><p class="muted">Welcome back, ' + esc(S.name) + '</p><div class="big">' + pct + '% complete</div>' +
      '<div class="meter"><i style="width:' + pct + '%"></i></div>' +
      (next ? '<a class="btn wide" href="#m/' + next.m + '">Continue: Module ' + next.m + '</a>' : '<a class="btn wide" href="#quiz">Go to the exam</a>') + '</div>' +
      '<div class="row"><div class="card"><p class="muted">Study time</p><div class="big">' + fmtTime(st.total) + '</div><p class="muted">' + st.days + ' study day' + (st.days === 1 ? '' : 's') + '</p></div>' +
      '<div class="card"><p class="muted">Modules read</p><div class="big">' + st.read + ' / ' + MODS.length + '</div><p class="muted">quizzes passed ' + st.qpass + ' / ' + QUIZ_MODS.length + '</p></div></div>' +
      '<div class="card"><h3>Ready for hands-on training?' + (st.ready ? '<span class="chip ok">READY</span>' : '<span class="chip wait">not yet</span>') + '</h3><ul class="check">' +
      '<li class="' + (st.c1 ? 'ok' : '') + '">Read all ' + MODS.length + ' modules (' + st.read + ' done)</li>' +
      '<li class="' + (st.c2 ? 'ok' : '') + '">Score 80% or more in every module quiz (' + st.qpass + ' of ' + QUIZ_MODS.length + ')</li>' +
      '<li class="' + (st.c3 ? 'ok' : '') + '">Pass the exam twice, on two different days, with every safety question correct (' + st.passes + ' pass' + (st.passes === 1 ? '' : 'es') + ')</li></ul></div>' +
      '<div class="card"><h3>Remember</h3><p class="muted">This course gives knowledge only. Never touch orange cables or high-voltage parts until you have completed supervised practical training.</p></div>';
  }

  function course() {
    current = { q: 1 }; chrome('Course', 'course');
    var html = '', part = '';
    MODS.forEach(function (x) {
      if (x.part !== part) { if (part) html += '</ul>'; part = x.part; html += '<div class="parthead">' + esc(part) + '</div><ul class="list">'; }
      var o = mod(x.m), chips = '';
      chips += o.read ? '<span class="chip ok">read</span>' : (o.t > 0 ? '<span class="chip part">started</span>' : '');
      if (o.qbest >= 0) chips += '<span class="chip ' + (o.qbest / o.qn >= PASS ? 'ok' : 'no') + '">quiz ' + o.qbest + '/' + o.qn + '</span>';
      html += '<li><a href="#m/' + x.m + '"><span class="num">' + x.m + '</span><span class="t">' + esc(x.title) + '<small>' + (o.t ? fmtTime(o.t) + ' studied' : 'not started') + '</small></span>' + chips + '</a></li>';
    });
    html += '</ul><div class="parthead">Reference</div><ul class="list">';
    APX.forEach(function (a) { html += '<li><a href="#apx/' + a.k + '"><span class="num">' + a.k + '</span><span class="t">' + esc(a.title) + '</span></a></li>'; });
    html += '<li><a href="EV-Hybrid-Technician-Course.pdf" target="_blank" rel="noopener"><span class="num">⇩</span><span class="t">Download the course as a PDF<small>for printing</small></span></a></li></ul>';
    view.innerHTML = html;
  }

  function markRead() {
    var el = document.getElementById('readmark');
    if (el) el.innerHTML = '<span class="chip ok">Module marked as read ✓</span>';
    sync(false);
  }

  function reader(m) {
    var x = MODS.filter(function (y) { return y.m === m; })[0];
    if (!x) { location.hash = '#course'; return; }
    chrome('Module ' + m, 'course', '#course');
    view.className = 'reader';
    view.innerHTML = '';
    view.appendChild(x.tpl.content.cloneNode(true));
    var o = mod(m);
    current = { m: m, atEnd: false };
    var foot = document.createElement('div');
    var prev = MODS[MODS.indexOf(x) - 1], nxt = MODS[MODS.indexOf(x) + 1];
    foot.innerHTML = '<p class="readmark" id="readmark">' + (o.read ? '<span class="chip ok">Module marked as read ✓</span>' : '<span class="chip wait">Read to the end to complete this module</span>') + '</p>' +
      '<div class="nextmod">' + (prev ? '<a class="btn alt" href="#m/' + prev.m + '">← Module ' + prev.m + '</a>' : '') +
      (nxt ? '<a class="btn" href="#m/' + nxt.m + '">Module ' + nxt.m + ' →</a>' : '<a class="btn" href="#quiz">Go to the exam →</a>') + '</div><div id="endmark" style="height:1px"></div>';
    view.appendChild(foot);
    // 'I need help with this' flag under every section heading
    view.querySelectorAll('section.mod > h3').forEach(function (h) {
      var key = h.textContent.trim().slice(0, 70);
      var b = document.createElement('button'); b.className = 'helpbtn'; b.type = 'button';
      function paint() { var on = !!S.help[key]; b.classList.toggle('on', on); b.textContent = on ? 'Marked: I need help with this ✓' : 'I need help with this'; }
      b.onclick = function () { if (S.help[key]) delete S.help[key]; else S.help[key] = Date.now(); save(); paint(); sync(false); };
      paint(); h.insertAdjacentElement('afterend', b);
    });
    var fb = document.createElement('div'); fb.className = 'fb';
    fb.innerHTML = '<h4>What was hard to understand?</h4><p class="muted">Write in English, Urdu or Roman Urdu. Your sponsor will see this and can arrange extra help.</p>' +
      '<textarea class="txt" id="note" maxlength="500" placeholder="For example: I do not understand why pre-charge is needed"></textarea>' +
      '<button class="btn alt" id="notesave" type="button">Save comment</button>';
    view.insertBefore(fb, foot);
    var ta = fb.querySelector('#note'); ta.value = S.notes[m] || '';
    fb.querySelector('#notesave').onclick = function () {
      var v = ta.value.trim(); if (v) S.notes[m] = v; else delete S.notes[m];
      save(); S.lastSync = 0; sync(true); this.textContent = 'Saved ✓';
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es, ob) {
        if (es[0].isIntersecting && current && current.m === m) { current.atEnd = true; if (!o.read && o.t >= MIN_READ_S) { o.read = true; save(); markRead(); } ob.disconnect(); }
      }).observe(document.getElementById('endmark'));
    } else { current.atEnd = true; }
    // in-module quiz
    view.querySelectorAll('.quiz').forEach(function (q) {
      var qs = q.querySelectorAll('ol>li'), right = 0, done = 0;
      var sc = document.createElement('p'); sc.className = 'score'; q.appendChild(sc);
      if (o.qbest >= 0) sc.textContent = 'Your best so far: ' + o.qbest + ' / ' + o.qn;
      qs.forEach(function (li) {
        var ul = li.querySelector('ul'); shuffle([].slice.call(ul.children)).forEach(function (c) { ul.appendChild(c); });
        ul.querySelectorAll('li').forEach(function (op) {
          op.addEventListener('click', function () {
            if (li.dataset.done) return; li.dataset.done = 1; done++;
            var ok = op.hasAttribute('data-c'); if (ok) right++;
            op.classList.add(ok ? 'ok' : 'no'); if (!ok) li.querySelector('[data-c]').classList.add('ok');
            sc.textContent = 'Score: ' + right + ' / ' + qs.length;
            if (done === qs.length) {
              o.qtries++; o.qn = qs.length; if (right > o.qbest) o.qbest = right; save(); sync(true);
              sc.textContent += right / qs.length >= PASS ? ' — passed' : ' — below 80%: read the module again, then reopen it to retry';
            }
          });
        });
      });
    });
  }

  function appendix(k) {
    var a = APX.filter(function (y) { return y.k === k; })[0];
    if (!a) { location.hash = '#course'; return; }
    current = { q: 1 }; chrome('Appendix ' + k, 'course', '#course');
    view.className = 'reader'; view.innerHTML = ''; view.appendChild(a.tpl.content.cloneNode(true));
  }

  function quizHome() {
    current = { q: 1 }; chrome('Quiz', 'quiz');
    var st = stats(), last = S.exams[S.exams.length - 1];
    var wait = last ? last.ts + COOLDOWN_H * 3600000 - Date.now() : 0;
    var opts = '<option value="0">All modules</option>' + MODS.map(function (x) { var t = x.title.length > 24 ? x.title.slice(0, 23) + '…' : x.title; return '<option value="' + x.m + '">' + x.m + ' · ' + esc(t) + '</option>'; }).join('');
    var hist = S.exams.slice().reverse().map(function (e) {
      return '<li>' + fmtDate(e.ts) + ' — ' + (e.abandoned ? '<span class="chip wait">not finished</span>' : Math.round(100 * e.score / e.total) + '% · safety ' + e.safeRight + '/' + e.safeTotal + (e.pass ? '<span class="chip ok">pass</span>' : '<span class="chip no">fail</span>')) + '</li>';
    }).join('');
    view.innerHTML =
      '<div class="card"><h3>Practice</h3><p class="muted">10 questions. You see the right answer after each one. ' + BANK.length + ' questions in the bank.</p>' +
      '<select class="txt" id="pm">' + opts + '</select><button class="btn wide" id="pgo">Start practice</button>' +
      '<p class="muted">Practice so far: ' + S.practice.right + ' correct of ' + S.practice.n + '</p></div>' +
      '<div class="card"><h3>Exam</h3><p class="muted">' + EXAM_N + ' questions, ' + EXAM_MIN + ' minutes, no feedback until the end. To pass: 80% overall <b>and</b> all ' + EXAM_SAFE + ' safety questions correct. You can sit one exam every ' + COOLDOWN_H + ' hours.</p>' +
      (wait > 0 ? '<button class="btn wide" disabled>Next exam available in ' + Math.ceil(wait / 3600000) + ' h</button>' : '<button class="btn wide warn" id="ego">Start exam</button>') +
      (hist ? '<p><b>Exam history</b></p><ul>' + hist + '</ul>' : '') + '</div>';
    document.getElementById('pgo').onclick = function () {
      var m = +document.getElementById('pm').value;
      var pool = BANK.filter(function (q) { return !m || q.m === m; });
      run({ title: 'Practice', qs: shuffle(pool).slice(0, 10), exam: false });
    };
    var eg = document.getElementById('ego');
    if (eg) eg.onclick = function () {
      if (!confirm('Start the exam now? It must be finished in one sitting, and the next attempt is only possible after ' + COOLDOWN_H + ' hours.')) return;
      var safe = shuffle(BANK.filter(function (q) { return q.s; })).slice(0, EXAM_SAFE);
      var rest = shuffle(BANK.filter(function (q) { return !q.s; })).slice(0, EXAM_N - safe.length);
      var rec = { ts: Date.now(), abandoned: true }; S.exams.push(rec); save(); sync(true);
      run({ title: 'Exam', qs: shuffle(safe.concat(rest)), exam: true, rec: rec });
    };
  }

  // one-question-at-a-time runner for practice and exam
  function run(o) {
    current = { q: 1 }; chrome(o.title, 'quiz', o.exam ? null : '#quiz');
    var i = 0, right = 0, safeRight = 0, safeTotal = 0, wrongMods = {}, start = Date.now(), finished = false;
    function finish(timeUp) {
      if (finished) return; finished = true; clearInterval(activeTimer);
      var n = o.qs.length, html;
      if (o.exam) {
        var pass = right / n >= PASS && safeRight === safeTotal;
        o.rec.weak = Object.keys(wrongMods).map(Number);
        o.rec.abandoned = false; o.rec.score = right; o.rec.total = n; o.rec.safeRight = safeRight; o.rec.safeTotal = safeTotal; o.rec.pass = pass; o.rec.dur = Math.round((Date.now() - start) / 1000);
        save(); sync(true);
        var rev = Object.keys(wrongMods).map(Number).sort(function (a, b) { return a - b; });
        html = '<div class="card"><h3>Exam result ' + (pass ? '<span class="chip ok">PASS</span>' : '<span class="chip no">NOT PASSED</span>') + '</h3>' +
          (timeUp ? '<p><b>Time was up.</b></p>' : '') +
          '<div class="big">' + Math.round(100 * right / n) + '%</div><p>' + right + ' of ' + n + ' correct · safety questions ' + safeRight + ' of ' + safeTotal + '</p>' +
          (safeRight < safeTotal ? '<p class="muted">Every safety question must be correct. Study Module 3 again.</p>' : '') +
          (rev.length ? '<p><b>Modules to review:</b> ' + rev.map(function (m) { return '<a href="#m/' + m + '">' + m + '</a>'; }).join(', ') + '</p>' : '') +
          '<a class="btn wide" href="#home">Done</a></div>';
      } else {
        html = '<div class="card"><h3>Practice finished</h3><div class="big">' + right + ' / ' + n + '</div><a class="btn wide" href="#quiz">Back to quiz</a></div>';
      }
      chrome(o.title, 'quiz', '#quiz'); view.innerHTML = html;
    }
    function show() {
      if (i >= o.qs.length) return finish(false);
      var q = o.qs[i], opts = shuffle([q.c].concat(q.w)), picked = null, answered = false;
      var left = o.exam ? Math.max(0, EXAM_MIN * 60 - Math.round((Date.now() - start) / 1000)) : 0;
      view.innerHTML = '<div class="card"><div class="qhead"><span>Question ' + (i + 1) + ' of ' + o.qs.length + '</span><span id="clock">' + (o.exam ? Math.ceil(left / 60) + ' min left' : 'Module ' + q.m) + '</span></div>' +
        '<div class="meter"><i style="width:' + Math.round(100 * i / o.qs.length) + '%"></i></div>' +
        '<p class="qtext">' + esc(q.q) + '</p><ul class="opts">' + opts.map(function (t, k) { return '<li data-k="' + k + '">' + esc(t) + '</li>'; }).join('') + '</ul>' +
        '<p id="fb" class="muted"></p><button class="btn wide" id="nx" disabled>' + (i + 1 === o.qs.length ? 'Finish' : 'Next') + '</button></div>';
      var nx = document.getElementById('nx'), lis = view.querySelectorAll('.opts li');
      function mark() {
        var ok = opts[picked] === q.c;
        if (ok) right++; else wrongMods[q.m] = 1;
        if (q.s) { safeTotal++; if (ok) safeRight++; }
        if (!o.exam) { S.practice.n++; if (ok) S.practice.right++; save(); }
        return ok;
      }
      lis.forEach(function (li) {
        li.onclick = function () {
          if (answered) return;
          picked = +li.dataset.k;
          if (o.exam) { lis.forEach(function (l) { l.classList.remove('sel'); }); li.classList.add('sel'); nx.disabled = false; return; }
          answered = true; var ok = mark();
          li.classList.add(ok ? 'ok' : 'no');
          if (!ok) { lis.forEach(function (l) { if (opts[+l.dataset.k] === q.c) l.classList.add('ok'); }); document.getElementById('fb').innerHTML = 'Review <a href="#m/' + q.m + '">Module ' + q.m + '</a> for this topic.'; }
          nx.disabled = false;
        };
      });
      nx.onclick = function () { if (o.exam) { if (picked === null) return; mark(); } i++; show(); };
    }
    if (o.exam) activeTimer = setInterval(function () {
      var left = EXAM_MIN * 60 - Math.round((Date.now() - start) / 1000);
      var c = document.getElementById('clock'); if (c) c.textContent = Math.max(0, Math.ceil(left / 60)) + ' min left';
      if (left <= 0) finish(true);
    }, 5000);
    show();
  }

  function reportText() {
    var st = stats();
    return 'EV & Hybrid course report\n' + S.name + ' — ' + fmtDate(Date.now()) + '\n\n' +
      'Study time: ' + fmtTime(st.total) + ' over ' + st.days + ' day(s)\n' +
      'Modules read: ' + st.read + ' of ' + MODS.length + '\n' +
      'Module quizzes passed: ' + st.qpass + ' of ' + QUIZ_MODS.length + (st.qdone ? ' (average ' + st.qavg + '%)' : '') + '\n' +
      'Exam attempts: ' + st.exams + (st.abandoned ? ' (+' + st.abandoned + ' not finished)' : '') + ', passes: ' + st.passes + '\n' +
      (st.best ? 'Best exam: ' + Math.round(100 * st.best.score / st.best.total) + '%, safety ' + st.best.safeRight + '/' + st.best.safeTotal + '\n' : '') +
      'Ready for hands-on training: ' + (st.ready ? 'YES' : 'not yet') +
      (Object.keys(S.help).length ? '\n\nI need help with:\n- ' + Object.keys(S.help).join('\n- ') : '') +
      (Object.keys(S.notes).length ? '\n\nMy comments:\n' + Object.keys(S.notes).map(function (m) { return 'Module ' + m + ': ' + S.notes[m]; }).join('\n') : '');
  }
  function report() {
    current = { q: 1 }; chrome('Report', 'report');
    var txt = reportText();
    view.innerHTML = '<div class="card"><h3>My progress report</h3><pre class="report">' + esc(txt) + '</pre>' +
      '<a class="btn wide" href="https://wa.me/?text=' + encodeURIComponent(txt) + '" target="_blank" rel="noopener">Share on WhatsApp</a>' +
      '<button class="btn alt wide" id="cp">Copy report</button></div>' +
      '<div class="card"><h3>Automatic sharing</h3><p class="muted">' + (CFG.syncUrl
        ? 'Your study time and quiz results are sent automatically to your course sponsor whenever the app is open and online. Last sent: ' + (S.lastSync ? new Date(S.lastSync).toLocaleString() : 'not yet') + '.'
        : 'Automatic sharing is not switched on yet. Use the WhatsApp button above.') + '</p>' +
      (CFG.syncUrl ? '<button class="btn alt wide" id="sy">Send now</button>' : '') + '</div>' +
      '<div class="card"><h3>Topics I need help with</h3>' + (Object.keys(S.help).length ? '<ul>' + Object.keys(S.help).map(function (k) { return '<li>' + esc(k) + '</li>'; }).join('') + '</ul>' : '<p class="muted">None marked. Inside any module, tap "I need help with this" under a heading you find difficult.</p>') + '</div>' +
      '<div class="card"><h3>Profile</h3><p class="muted">Name: ' + esc(S.name) + '<br>Started: ' + fmtDate(S.created) + '<br>App version: ' + esc(CFG.version || '') + '</p></div>';
    document.getElementById('cp').onclick = function () { if (navigator.clipboard) navigator.clipboard.writeText(txt); this.textContent = 'Copied'; };
    var sy = document.getElementById('sy'); if (sy) sy.onclick = function () { S.dirty = true; sync(true); this.textContent = 'Sent'; };
  }

  // ---------- router
  function route() {
    clearInterval(activeTimer); activeTimer = null;
    if (!S.name) return welcome();
    var h = location.hash.replace(/^#/, '') || 'home', p = h.split('/');
    if (p[0] === 'm') return reader(+p[1]);
    if (p[0] === 'apx') return appendix(p[1]);
    if (p[0] === 'course') return course();
    if (p[0] === 'quiz') return quizHome();
    if (p[0] === 'report') return report();
    return home();
  }
  window.onhashchange = route;
  route(); sync(false); showSync();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { });
})();
