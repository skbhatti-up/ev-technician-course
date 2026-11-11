/* Fault-finding mode for the car explorer. Follows Module 18: listen, confirm, basics,
   scan, research, test and prove, repair, verify. Loaded before car.js; plugs in through CarHooks. */
(function () {
  'use strict';
  var H = window.CarHooks = window.CarHooks || {};
  var A;                                   // CarAPI, set in init
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- the jobs ----------
  var ANSWERS = [
    ['aux12', 'Charge or replace the 12 V battery'],
    ['hvil', 'Reseat and latch the HV connector at the A/C compressor'],
    ['compressor', 'Replace the A/C compressor (and use only POE oil)'],
    ['pump', 'Replace the coolant pump'],
    ['obc', 'Replace the on-board charger'],
    ['home', 'No fault in the car: customer’s home charger or supply'],
    ['brake', 'Repair the sticking front-left brake caliper'],
    ['refer', 'Refer to a battery specialist: fault inside the pack'],
    ['battery', 'Replace the high-voltage battery'],
    ['inverter', 'Replace the inverter']
  ];

  var JOBS = {
    flat12: {
      title: 'Car is completely dead', soc: 0.6, answer: 'aux12', proof: ['12v', 'test:aux12'],
      complaint: '“The car was parked at my village for three weeks. Now nothing happens when I press the start button.”',
      explain: 'The 12 V battery had run down to 11.3 V while parked. Without 12 V the computers cannot wake up, so the high-voltage system never switches on, even though the big battery is 60% full. Module 18, case 1: always measure the 12 V battery first.'
    },
    hvil: {
      title: 'Will not go to READY after A/C work', soc: 0.6, answer: 'hvil', proof: ['inspect:compressor', 'test:interlock'],
      codes: ['P0A0A — HV interlock (HVIL) circuit'],
      complaint: '“Another workshop re-gassed my A/C yesterday. This morning it would not go to READY and shows Check EV system.”',
      explain: 'The HV connector on the A/C compressor was not fully latched after yesterday’s A/C work, so the interlock loop was open and the BMS would not close the contactors. Module 18, case 6: go back to what was touched last.'
    },
    insul: {
      title: 'Warning when A/C is switched on', soc: 0.6, answer: 'compressor', proof: ['test:compressor'],
      codes: ['P0AA6 — HV system insulation fault (stored when the A/C was switched on)'],
      complaint: '“When I switch on the A/C a warning comes up and the A/C stops working. It started after a local garage topped up the A/C oil.”',
      explain: 'The garage used ordinary PAG oil. In an electric compressor the oil touches the motor windings, so it must be insulating POE oil. The compressor now leaks current to the body. The insulation test proved it: 0.2 MΩ on the compressor, every other part over 500 MΩ. Module 18, case 2 and Module 15.'
    },
    pump: {
      title: 'Loses power in the afternoon heat', soc: 0.75, answer: 'pump', proof: ['test:pump'], tInv: 45,
      codes: ['Maker code: inverter over-temperature, power limited'],
      complaint: '“On the motorway in the afternoon the car loses power and a tortoise light comes on. After it rests it is fine again.”',
      explain: 'The coolant pump has failed, so heat is not carried away from the inverter and motor. When the inverter passes about 85 °C the car limits power to protect it. The code says “over-temperature”, which is a clue, not a verdict: the pump test proved the cause. Module 18, case 5.'
    },
    obc: {
      title: 'Will not charge at home', soc: 0.4, answer: 'obc', proof: ['charger'],
      codes: ['Maker code: AC charging failed to start'],
      complaint: '“It will not charge on my home wallbox any more. The fast charger at the petrol station still works.”',
      explain: 'AC charging failed on two known-good chargers in the workshop, but DC fast charging works. DC charging bypasses the on-board charger, and AC charging must go through it, so the on-board charger is the fault. Module 18, case 4 and Module 14.'
    },
    home: {
      title: 'Will not charge at home (2)', soc: 0.3, answer: 'home', proof: ['charger'],
      complaint: '“Since last week it will not charge on my home wallbox. I have not tried anywhere else.”',
      explain: 'The car charges normally on the workshop charger and on a second charger, and there are no fault codes. The fault is in the customer’s wallbox, cable or house supply, not in the car. Substitution is the quickest test. Module 18, case 4.'
    },
    drag: {
      title: 'Range has dropped', soc: 0.8, answer: 'brake', proof: ['test:gearbox', 'inspect:gearbox'],
      complaint: '“My range has dropped from about 380 km to under 300 km in the last month. Same route, same weather.”',
      explain: 'The battery is healthy (SOH 95%, cells balanced). The front-left brake caliper is sticking, so the car is always driving against a brake. That wastes energy as heat. Module 18, case 3: check tyres, brake drag and alignment before blaming the battery.'
    },
    precharge: {
      title: 'Clicks, then “EV system fault”', soc: 0.6, answer: 'refer', proof: ['live'],
      codes: ['Maker code: pre-charge failure (pre-charge time too long)'],
      complaint: '“When I press start I hear a click from under the car, then it says EV system fault and will not drive.”',
      explain: 'The 12 V battery, HVIL and insulation are all fine. Live data shows the inverter capacitor reached only about 20 V during pre-charge, so the pre-charge resistor or contactor inside the pack has failed. That is inside the battery pack: a specialist job. Module 18.4: know your limits.'
    }
  };
  var JOB_IDS = Object.keys(JOBS);

  var HV_INSUL = ['compressor', 'heater', 'inverter', 'motor', 'obc', 'dcdc', 'junction', 'hvcable', 'port'];
  var ISO_STEPS = [
    ['off', 'Switch the car off'],
    ['12v', 'Disconnect the 12 V battery'],
    ['msd', 'Remove the service plug and keep it in your pocket'],
    ['wait', 'Wait the time in the manual (usually 5–10 minutes)'],
    ['prove', 'Prove dead: test the meter, measure the HV terminals, test the meter again']
  ];

  // ---------- state ----------
  var F = null;            // the job in progress
  var store = load();
  function load() { try { return JSON.parse(localStorage.getItem('evcar.faults')) || {}; } catch (e) { return {}; } }
  function save() {
    try { localStorage.setItem('evcar.faults', JSON.stringify(store)); } catch (e) { }
    try { window.dispatchEvent(new Event('evcar')); } catch (e) { }
  }
  function job() { return F ? JOBS[F.id] : null; }
  function is(id) { return !!F && F.id === id; }

  function startJob(id) {
    if (!id) {
      var fresh = JOB_IDS.filter(function (j) { return !store[j]; });
      var pool = fresh.length ? fresh : JOB_IDS;
      id = pool[Math.floor(Math.random() * pool.length)];
    }
    var j = JOBS[id], S = A.S;
    F = { id: id, mins: 0, log: [], did: {}, mistakes: 0, isolated: false, iso: [], isoOpen: false, dist: 0, insulSeen: false, pre: null, done: null };
    S.seq = null; S.mode = 'off'; S.v = 0; S.pedal = 0; S.k.neg = S.k.pre = S.k.pos = false; S.bus = 0;
    S.warn = {}; S.climate = false; S.soc = j.soc; S.whkm = 0; S.tInv = j.tInv || 35; S.tBatt = 30;
    $('climate').checked = false; $('pedal').value = 0; $('seq').innerHTML = '';
    if (id === 'hvil' || id === 'precharge') S.warn.ev = 1;
    if (id === 'insul') S.warn.insul = 1;
    A.note('', 1);
    A.paintMode();
    render();
    if (A.selected()) refreshPartTools(A.selected());
    $('fault').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function endJob() {
    var S = A.S;
    F = null; S.warn = {}; S.mode = 'off'; S.seq = null; S.k.neg = S.k.pre = S.k.pos = false;
    document.querySelector('#car g.part[data-id=msd]').classList.remove('removed');
    A.paintMode(); render();
    if (A.selected()) refreshPartTools(A.selected());
  }

  function add(kind, title, html, cls, mins, did) {
    F.mins += mins || 0;
    if (did) did.split(' ').forEach(function (d) { F.did[d] = 1; });
    F.log.unshift({ title: title, html: html, cls: cls || '' });
    render();
  }

  // ---------- workshop tools ----------
  function twelveV() {
    var S = A.S;
    if (is('flat12')) return 11.3;
    if (F && F.isolated) return 12.6;
    return (S.mode === 'off' ? 12.6 : 14.2);
  }

  function measure12() {
    var v = twelveV(), bad = v < 12;
    add('meter', 'Measure 12 V battery', '<b>' + v.toFixed(1) + ' V</b>. ' + (bad ? 'Below 12.0 V: charge or replace it, then retest.' : A.S.mode === 'off' ? 'Good (a healthy 12 V battery rests at about 12.6 V).' : 'Good: the DC-DC converter is charging it.'), bad ? 'bad' : '', 3, 'basics 12v');
  }

  function scanBlocked() {
    if (F.isolated) return 'The scan tool will not connect: the 12 V battery is disconnected.';
    if (is('flat12')) return 'The scan tool will not connect: the 12 V supply is too low for the computers to wake up.';
    return '';
  }

  function readCodes() {
    var b = scanBlocked();
    if (b) return add('scan', 'Read fault codes', b, 'bad', 5, 'basics');
    var c = job().codes;
    add('scan', 'Read fault codes', c ? '<ul>' + c.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>A code is a clue, not a verdict. Now prove the cause.' : 'No fault codes stored.', c ? 'key' : '', 5, 'scan');
  }

  function liveData() {
    var b = scanBlocked();
    if (b) return add('scan', 'Live data', b, 'bad', 5, 'basics');
    var S = A.S, hv = S.k.neg && S.k.pos, rows = [];
    rows.push(['12 V supply', twelveV().toFixed(1) + ' V']);
    rows.push(['HVIL loop', is('hvil') ? 'OPEN' : 'closed']);
    rows.push(['Insulation resistance now', '> 20 MΩ']);
    if (is('insul')) rows.push(['Lowest recorded (A/C switched on)', '0.2 MΩ']);
    rows.push(['Battery charge (SOC)', Math.round(S.soc * 100) + ' %']);
    rows.push(['Battery health (SOH)', '95 %']);
    rows.push(['Cell voltage spread', '12 mV (balanced)']);
    rows.push(['Battery temperature', Math.round(S.tBatt) + ' °C']);
    rows.push(['Inverter temperature', Math.round(S.tInv) + ' °C']);
    rows.push(['Coolant pump', !hv ? 'off (car not in READY)' : is('pump') ? 'commanded ON, 0 rpm' : 'running, 3,200 rpm']);
    if (S.whkm) rows.push(['Average consumption', Math.round(S.whkm) + ' Wh/km (normal for this car: about 140 at 80 km/h, 170 at 100 km/h)']);
    if (F.pre != null || is('precharge')) rows.push(['Last start: pre-charge voltage', (F.pre != null ? Math.round(F.pre) : 20) + ' V (needs about 375 V)']);
    if (is('obc') && F.did.triedAC) rows.push(['On-board charger', 'no output']);
    add('scan', 'Live data', '<table>' + rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>' +
      (is('drag') && !S.whkm ? '<p>Tip: road-test the car first, then read live data again to see consumption.</p>' : ''), '', 5, 'scan live');
  }

  function otherCharger() {
    var t;
    if (is('obc')) t = 'Workshop AC charger and a second known-good AC charger: <b>neither starts charging</b>. DC fast charger: charges normally.';
    else if (is('home')) t = 'Workshop AC charger: <b>charges normally</b> at 7 kW. Second charger: also normal.';
    else t = 'The car charges normally on a known-good charger.';
    add('charger', 'Try a different charger', t, is('obc') ? 'key' : '', 10, 'charger test');
  }

  // ---------- making the car safe ----------
  function isoClick(step) {
    var S = A.S, next = ISO_STEPS[F.iso.length][0];
    if (step !== next) {
      F.mistakes++;
      A.note('Not yet. Think about what must come first. (Safety mistake recorded.)', 5000);
      return render();
    }
    if (step === 'off') {
      if (S.v > 0.1) { F.mistakes++; A.note('Stop the car first.'); return render(); }
      if (S.mode !== 'off') { S.mode = 'off'; S.seq = null; S.k.neg = S.k.pre = S.k.pos = false; A.paintMode(); }
    }
    F.iso.push(step);
    if (F.iso.length === ISO_STEPS.length) {
      F.isolated = true; F.isoOpen = false;
      document.querySelector('#car g.part[data-id=msd]').classList.add('removed');
      add('safe', 'Car made safe', 'Switched off, 12 V disconnected, service plug removed, waited, proved dead. You may now test high-voltage parts.', '', 15, 'safe');
      return;
    }
    render();
  }
  function restore() {
    F.isolated = false; F.iso = [];
    document.querySelector('#car g.part[data-id=msd]').classList.remove('removed');
    add('safe', 'Car restored', 'Service plug refitted and 12 V reconnected.', '', 5);
  }

  // ---------- looking at and testing one part ----------
  function inspect(id) {
    var name = (window.CAR_PARTS[id] || {}).name || id, t = 'Looks normal: no damage, leaks, burn marks or loose connectors.', cls = '';
    if (id === 'compressor' && is('hvil')) { t = 'The HV connector on the compressor is <b>not fully latched</b>. There is a fresh A/C service sticker on the front panel.'; cls = 'bad'; }
    else if (id === 'compressor' && is('insul')) { t = 'A/C service sticker from a local garage: <b>“Oil added: PAG 46”</b>. This car needs insulating POE oil.'; cls = 'bad'; }
    else if (id === 'gearbox' && is('drag')) { t = 'The front-left brake disc is <b>blue and discoloured</b>, a sign it has been very hot.'; cls = 'bad'; }
    else if (id === 'aux12') t = 'Terminals tight and clean. Label shows the battery is 4 years old.';
    else if (id === 'pump' || id === 'radiator') t = 'Coolant level correct. No leaks. Radiator fins clean.';
    else if (id === 'battery' || id === 'contactors' || id === 'bms') t = 'Pack case: no damage, swelling, leaks or smell.';
    else if (id === 'msd') t = F.isolated ? 'Service plug is out and in your pocket.' : 'Service plug fitted and locked.';
    add('inspect', 'Look at: ' + name, t, cls, 5, 'basics inspect:' + id);
    return t;
  }

  function test(id) {
    var name = (window.CAR_PARTS[id] || {}).name || id, t, cls = '', mins = 15;
    if (HV_INSUL.indexOf(id) >= 0) {
      if (!F.isolated) {
        F.mistakes++;
        add('stop', 'STOP: ' + name, 'The high-voltage system is <b>not isolated</b>. Never test HV parts until you have made the car safe. (Safety mistake recorded.)', 'bad', 0);
        return 'Not isolated: make the car safe first.';
      }
      if (id === 'compressor' && is('insul')) { t = 'Insulation test, compressor HV pins to case: <b>0.2 MΩ. FAIL</b>.'; cls = 'bad'; }
      else t = 'Insulation test, HV pins to case: <b>over 500 MΩ. Pass.</b>';
      if (id === 'motor') t += ' Phase resistances equal on all three pairs.';
      if (id === 'obc') t += ' The charger itself cannot be bench-tested here. Prove it by substitution: try a known-good charger.';
    } else if (id === 'battery') {
      if (!F.isolated) { F.mistakes++; add('stop', 'STOP: ' + name, 'Not isolated. Make the car safe before any HV test. (Safety mistake recorded.)', 'bad', 0); return 'Not isolated.'; }
      t = 'Pack insulation, + and − to case: <b>over 20 MΩ. Pass.</b> Anything deeper is inside the pack: read BMS data with the scan tool or refer to a specialist.';
    } else if (id === 'contactors' || id === 'bms') {
      var b = scanBlocked();
      t = b || 'These are inside the battery pack. You do not open the pack: use scan-tool data (contactor state, pre-charge voltage) and refer pack work to a specialist.';
      mins = 5;
    } else if (id === 'msd') {
      t = 'Service plug contacts clean and tight.'; mins = 5;
    } else if (id === 'interlock') {
      if (F.isolated) t = 'Loop reads open, but the service plug is out and is part of the loop. Refit it to test properly.';
      else if (is('hvil')) { t = 'HVIL loop: <b>OPEN circuit</b>. Follow the loop connector by connector.'; cls = 'bad'; }
      else t = 'HVIL loop: closed.';
      mins = 10;
    } else if (id === 'pump') {
      if (scanBlocked()) t = scanBlocked();
      else if (is('pump')) { t = 'Commanded ON with the scan tool: <b>no sound, no flow</b>. 12 V and the control signal are present at the pump connector, so the pump itself has failed.'; cls = 'bad'; }
      else t = 'Commanded ON with the scan tool: pump runs, coolant flows well.';
    } else if (id === 'radiator') {
      t = 'Fan runs when commanded. Radiator and condenser clean.'; mins = 10;
    } else if (id === 'aux12') {
      if (is('flat12')) { t = '<b>11.3 V</b>. After a charge it fails the load test: the battery is weak and should be replaced.'; cls = 'bad'; }
      else t = twelveV().toFixed(1) + ' V. Passes the load test.';
      mins = 10;
    } else if (id === 'gearbox') {
      if (is('drag')) { t = 'Car raised, each wheel spun by hand: <b>front-left is hard to turn</b> and was hot after the road test. The caliper is sticking.'; cls = 'bad'; }
      else t = 'Car raised, each wheel spun by hand: all turn freely. Alignment within limits.';
    } else if (id === 'vcu') {
      t = scanBlocked() || 'Communicates with the scan tool. No internal fault.'; mins = 5;
    } else {
      t = 'Nothing abnormal found.';
    }
    add('test', 'Test: ' + name, t, cls, mins, 'test:' + id + ' test');
    return t;
  }

  // ---------- finishing ----------
  function finish() {
    var pick = $('fAnswer').value; if (!pick) return;
    var j = job(), ok = pick === j.answer;
    var proved = j.proof.some(function (p) { return F.did[p]; });
    var checks = [
      ['Listened to the customer', true],
      ['Confirmed the fault yourself', !!F.did.confirm],
      ['Checked the basics (12 V, a visual check)', !!F.did.basics],
      ['Read the codes / live data', !!(F.did.scan || is('flat12'))],
      ['Proved the cause by a test, not a guess', proved],
      ['Worked safely (no HV test before isolating, isolation in the right order)', F.mistakes === 0]
    ];
    var stars = checks.filter(function (c) { return c[1]; }).length;
    F.done = { ok: ok, pick: pick, checks: checks, stars: stars };
    if (A.selected()) refreshPartTools(A.selected());
    var prev = store[F.id];
    if (!prev || (ok && !prev.ok) || (ok === prev.ok && stars > prev.stars)) store[F.id] = { ok: ok, stars: stars, mins: F.mins, at: Date.now(), t: job().title };
    save();
    render();
  }

  // ---------- drawing the card ----------
  function render() {
    var el = $('fault'), h;
    if (!F) {
      var solved = JOB_IDS.filter(function (j) { return store[j] && store[j].ok; }).length;
      h = '<h3>Fault finding</h3><p class="muted">Take a job card, find the fault the way Module 18 teaches, and give your diagnosis. The car will really behave as the customer says.</p>' +
        '<button class="btn wide" id="fStart">Take a job card</button>' +
        '<p class="muted" style="text-align:center;margin-top:8px">Jobs solved: ' + solved + ' of ' + JOB_IDS.length + '</p>';
      el.innerHTML = h;
      $('fStart').onclick = function () { startJob(); };
      return;
    }
    var j = job();
    h = '<h3>Job card <span class="clock">' + F.mins + ' min</span></h3>' +
      '<div class="jobcard"><b>Customer says</b>' + esc(j.complaint) + '</div>';

    if (F.done) {
      var d = F.done;
      h += '<div class="result ' + (d.ok ? 'ok' : 'no') + '"><b>' + (d.ok ? 'Correct diagnosis.' : 'Not the right diagnosis.') + '</b>' +
        (d.ok ? '' : ' The answer was: ' + esc(ANSWERS.filter(function (a) { return a[0] === j.answer; })[0][1]) + '.') +
        '<p>' + esc(j.explain) + '</p><ul>' + d.checks.map(function (c) { return '<li>' + (c[1] ? '✔ ' : '✘ ') + esc(c[0]) + '</li>'; }).join('') + '</ul>' +
        '<p>Method score: ' + d.stars + ' of 6 · Time: ' + F.mins + ' min</p></div>' +
        '<button class="btn wide" id="fNext">Next job</button><button class="btn alt wide" id="fClose">Finish fault finding</button>';
      el.innerHTML = h;
      $('fNext').onclick = function () { startJob(); };
      $('fClose').onclick = endJob;
      return;
    }

    h += '<p class="muted">Use the car above to confirm the fault. Tap a part to look at it or test it.</p>' +
      '<div class="tools">' +
      '<button data-t="12">Measure 12 V</button>' +
      '<button data-t="codes">Read fault codes</button>' +
      '<button data-t="live">Live data</button>' +
      '<button data-t="chg">Try another charger</button>' +
      (F.isolated ? '<button class="safe isolated" data-t="restore">Isolated · Restore car</button>'
        : '<button class="safe" data-t="iso">Make the car safe</button>') +
      '</div>';

    if (F.isoOpen && !F.isolated) {
      var order = F.isoOrder || (F.isoOrder = ISO_STEPS.slice().sort(function () { return Math.random() - 0.5; }));
      h += '<div class="iso"><p><b>Isolate the high-voltage system.</b> Tap the steps in the correct order.</p>' +
        order.map(function (s) { var done = F.iso.indexOf(s[0]) >= 0; return '<button data-iso="' + s[0] + '"' + (done ? ' class="done" disabled' : '') + '>' + (done ? '✔ ' : '') + esc(s[1]) + '</button>'; }).join('') + '</div>';
    }

    h += '<div class="finish"><select id="fAnswer"><option value="">Your diagnosis…</option>' +
      ANSWERS.map(function (a) { return '<option value="' + a[0] + '">' + esc(a[1]) + '</option>'; }).join('') +
      '</select><button class="btn wide" id="fFinish">Give diagnosis</button></div>';

    h += F.log.length ? '<ul class="findings">' + F.log.map(function (l) { return '<li class="' + l.cls + '"><small>' + esc(l.title) + '</small>' + l.html + '</li>'; }).join('') + '</ul>'
      : '<p class="muted">Your findings will appear here.</p>';
    h += '<button class="mini" id="fQuit" style="margin-top:8px">Give up this job</button>';
    el.innerHTML = h;

    Array.prototype.forEach.call(el.querySelectorAll('[data-t]'), function (b) {
      b.onclick = function () {
        var t = b.getAttribute('data-t');
        if (t === '12') measure12();
        else if (t === 'codes') readCodes();
        else if (t === 'live') liveData();
        else if (t === 'chg') otherCharger();
        else if (t === 'iso') { F.isoOpen = !F.isoOpen; render(); }
        else if (t === 'restore') restore();
      };
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-iso]'), function (b) {
      b.onclick = function () { isoClick(b.getAttribute('data-iso')); };
    });
    $('fFinish').onclick = finish;
    $('fQuit').onclick = endJob;
  }

  function refreshPartTools(id) {
    var body = $('iBody'), old = body.querySelector('.ptools');
    if (old) old.remove();
    var r = body.querySelector('.presult'); if (r) r.remove();
    if (F && !F.done) H.afterSelect(id, body);
  }

  // ---------- hooks into the car ----------
  H.init = function () {
    A = window.CarAPI;
    render();
    setInterval(function () {
      if (!F || F.done) return;
      var S = A.S;
      F.dist += S.v * 0.5;
      if (is('pump') && S.warn.turtle) F.did.confirm = 1;
      if (is('drag') && F.dist > 1000) F.did.confirm = 1;
    }, 500);
  };
  H.canWake = function () {
    if (!F) return '';
    if (F.isolated) return 'The service plug is out and the 12 V battery is disconnected. Restore the car first.';
    if (is('flat12')) { F.did.confirm = 1; return 'Nothing happens. The dashboard flickers once and goes dark.'; }
    return '';
  };
  H.startStep = function (i) {
    if (is('hvil') && i === 1) { F.did.confirm = 1; return 'The BMS found the interlock loop (HVIL) open, so it will not close the contactors. Warning: Check EV system.'; }
    return null;
  };
  H.preBlocked = function () { return is('precharge'); };
  H.chargeBlock = function (m) {
    if (!F) return null;
    if (m === 'ac') F.did.triedAC = 1;
    if (is('obc') && m === 'ac') { F.did.confirm = 1; return 'AC charging does not start. The charge-port light flashes red.'; }
    if (is('home') && m === 'ac') F.did.confirm = 1;
    return null;
  };
  H.climateFault = function () { return is('insul'); };
  H.pumpOk = function () { return !is('pump'); };
  H.extraDrag = function () { return is('drag') ? 260 : 0; };
  H.onEvent = function (e, msg) {
    if (!F) return;
    var S = A.S;
    if (e === 'startFail') { S.warn.ev = 1; F.did.confirm = 1; if (is('precharge')) F.pre = S.bus; }
    if (e === 'insul') F.did.confirm = 1;
  };
  H.afterSelect = function (id, body) {
    if (!F || F.done) return;
    var d = document.createElement('div');
    d.className = 'ptools';
    d.innerHTML = '<button data-a="look">Look at it (5 min)</button><button data-a="test">Test it</button>';
    body.appendChild(d);
    var out = document.createElement('p');
    out.className = 'presult muted';
    body.appendChild(out);
    d.querySelector('[data-a=look]').onclick = function () { out.innerHTML = inspect(id); };
    d.querySelector('[data-a=test]').onclick = function () { out.innerHTML = test(id); };
  };

  window.__faults = { start: startJob, state: function () { return F; }, jobs: JOBS };
})();
