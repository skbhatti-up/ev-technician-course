/* EV car explorer — local draft. Numbers follow the Module 11 worked example:
   60 kWh pack at about 400 V, 400 A limit (160 kW), 150 kW / 310 Nm motor,
   10:1 reduction gear, 0.33 m wheel radius, 1,750 kg car. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var SVGNS = 'http://www.w3.org/2000/svg';

  // ---- car data ----
  var CAR = {
    mass: 1750, wheelR: 0.33, gear: 10, eff: 0.95,
    tMax: 310, pMotor: 150, maxRpm: 12000,
    packKWh: 60, iMax: 400, rInt: 0.025,
    regenKW: 60, regenNm: 200,
    cdA: 0.7, rollC: 0.012,
    acKW: 7, dcKW: 100, auxKW: 0.3, climateKW: 1.5
  };

  // ---- cables: [id, kind, path, parts it belongs to] — each path is drawn from source to destination ----
  var CABLES = [
    ['hvBatt', 'hv', 'M200 316 V245', 'hvcable'],
    ['hvInv', 'hv', 'M220 215 V196 H245 V108', 'hvcable'],
    ['ac3', 'ac', 'M165 108 V132', 'hvcable'],
    ['hvDcdc', 'hv', 'M230 241 H255', 'hvcable'],
    ['hvObc', 'hv', 'M230 224 H242 V214 H255', 'hvcable'],
    ['hvComp', 'hv', 'M178 215 V204 H114 V102', 'hvcable'],
    ['hvHeat', 'hv', 'M178 245 V256 H110 V266', 'hvcable'],
    ['acPort', 'ac', 'M326 748 H334 H331 V214 H322', 'hvcable'],
    ['dcPort', 'hv', 'M326 740 H325 V270 H222 V245', 'hvcable'],
    ['lvDcdc', 'lv', 'M255 256 H240 V262 H104 V244', 'aux12'],
    ['lvVcu', 'lv', 'M130 230 H160 V268', 'vcu'],
    ['coolMain', 'cool', 'M300 95 V590 H100 V300 H70 V42 H90', 'pump'],
    ['coolRad', 'cool', 'M300 52 V69', 'radiator'],
    ['coolInv', 'cool', 'M287 84 H250', 'pump'],
    ['hvil', 'il', 'M230 332 H250 V309 M250 291 V250 H226 M226 215 V200 H246 V112 M150 98 H140 M114 102 V112 M255 210 H250 V250', 'interlock']
  ];
  var flowEl = {};

  function buildCables() {
    var g = $('cables');
    CABLES.forEach(function (c) {
      ['cable ' + c[1], 'flow ' + c[1], 'cable tap'].forEach(function (cls, i) {
        var p = document.createElementNS(SVGNS, 'path');
        p.setAttribute('d', c[2]);
        p.setAttribute('class', cls);
        if (i === 2) { p.setAttribute('data-id', c[3]); p.classList.add('part'); }
        g.appendChild(p);
        if (i === 1) flowEl[c[0]] = p;
        if (i === 0) flowEl[c[0] + '_cable'] = p;
      });
    });
  }

  // ---- state ----
  var S = {
    mode: 'off',          // off | starting | ready | stopping | ac | dc
    v: 0,                 // m/s
    soc: 0.70,
    bus: 0,               // inverter capacitor voltage
    k: { neg: false, pre: false, pos: false },
    pedal: 0,
    climate: false,
    seqT: 0, seq: null,
    tInv: 35, tBatt: 30,  // °C
    warn: {},             // dashboard warning lights
    out: {}
  };
  var H = window.CarHooks = window.CarHooks || {};   // filled in by faults.js
  var store = load();

  function load() {
    try { return JSON.parse(localStorage.getItem('evcar.v1')) || { parts: {}, modes: {} }; }
    catch (e) { return { parts: {}, modes: {} }; }
  }
  function save() {
    try { localStorage.setItem('evcar.v1', JSON.stringify(store)); } catch (e) { }
    try { window.dispatchEvent(new Event('evcar')); } catch (e) { }   // lets the study app share progress
  }
  function mark(kind, id) { if (!store[kind][id]) { store[kind][id] = Date.now(); save(); showExplored(); } }

  // ---- battery ----
  function vOpen() { return 350 + 60 * S.soc; }               // 350 V empty, 410 V full
  function battPowerLimit() {                                   // kW the BMS allows out
    var Vload = vOpen() - CAR.iMax * CAR.rInt;                  // voltage sags under load
    var lim = Math.min(160, Vload * CAR.iMax / 1000);           // 400 A at about 400 V = 160 kW
    if (S.soc < 0.10) lim *= Math.max(0.25, S.soc / 0.10);      // low charge: less power
    return lim;
  }
  function regenLimit() {                                       // kW the BMS allows in
    if (S.soc >= 0.98) return 0;
    if (S.soc > 0.90) return CAR.regenKW * (0.98 - S.soc) / 0.08;
    return CAR.regenKW;
  }
  function dcAccept() {                                         // DC charge taper
    if (S.soc < 0.5) return CAR.dcKW;
    if (S.soc < 0.8) return CAR.dcKW - (S.soc - 0.5) / 0.3 * 50;
    return Math.max(5, 50 - (S.soc - 0.8) / 0.2 * 45);
  }

  // ---- start-up and shut-down sequences ----
  var START = [
    [0.0, '12 V battery wakes the VCU and BMS', function () { }],
    [0.6, 'BMS checks cell voltages, insulation and the interlock loop', function () { }],
    [1.3, 'Main negative contactor closes', function () { S.k.neg = true; }],
    [1.8, 'Pre-charge contactor closes. Current flows through the resistor and the capacitor charges', function () { S.k.pre = true; }],
    [3.4, 'Capacitor is above 95% of pack voltage, so main positive contactor closes', function () { S.k.pos = true; }],
    [3.7, 'Pre-charge contactor opens. READY', function () { S.k.pre = false; setMode('ready', true); }]
  ];
  var STOP = [
    [0.0, 'Driver switches off. VCU asks for zero torque', function () { }],
    [0.4, 'Main positive and negative contactors open', function () { S.k.pos = false; S.k.neg = false; }],
    [0.5, 'Inverter discharges its capacitor to a safe voltage', function () { }],
    [2.6, 'Bus voltage is below 60 V. High voltage is off (but the pack itself is always live)', function () { setMode('off', true); }]
  ];

  function runSeq(list, mode) {
    S.seq = list; S.seqT = 0; S.seqI = 0; S.mode = mode;
    var ol = $('seq'); ol.innerHTML = '';
    list.forEach(function (s) { var li = document.createElement('li'); li.textContent = s[1]; ol.appendChild(li); });
    paintMode();
  }
  function tickSeq(dt) {
    if (!S.seq) return;
    S.seqT += dt;
    var lis = $('seq').children;
    while (S.seqI < S.seq.length && S.seqT >= S.seq[S.seqI][0]) {
      for (var j = 0; j < lis.length; j++) lis[j].className = j < S.seqI ? 'done' : '';
      if (lis[S.seqI]) lis[S.seqI].className = 'now';
      var list = S.seq, i = S.seqI;
      if (list === START) {
        var err = H.startStep ? H.startStep(i) : null;
        if (!err && i === 4 && S.bus < 0.95 * vOpen())
          err = 'Pre-charge failed: the capacitor reached only ' + Math.round(S.bus) + ' V of ' + Math.round(vOpen()) + ' V, so the main contactor was not closed. Warning: EV system fault.';
        if (err) return abortSeq(err, i);
      }
      S.seqI++;
      list[i][2]();
      if (S.seq !== list) return;            // the step changed mode
    }
    if (S.seqI >= S.seq.length) { for (var k = 0; k < lis.length; k++) lis[k].className = 'done'; S.seq = null; paintMode(); }
  }

  function abortSeq(msg, i) {
    var lis = $('seq').children;
    for (var j = 0; j < lis.length; j++) lis[j].className = j < i ? 'done' : j === i ? 'fail' : '';
    S.seq = null; S.k.neg = S.k.pre = S.k.pos = false; S.mode = 'off';
    if (H.onEvent) H.onEvent('startFail', msg);
    note(msg, 9000); paintMode();
  }

  // ---- modes ----
  function setMode(m, fromSeq) {
    if (S.seq && !fromSeq) return;
    var cur = S.mode;
    if (m === cur && !fromSeq) return;
    if (H.onEvent && !fromSeq) H.onEvent('mode', m);
    if (m !== 'off' && !fromSeq && H.canWake) { var w = H.canWake(); if (w) { note(w, 6000); return; } }
    if (m === 'ready' && !fromSeq) {
      if (cur === 'off') return runSeq(START, 'starting');
      // from charging straight to ready: contactors stay closed
    }
    if (m === 'off' && !fromSeq) {
      if (S.v > 0.5) { note('Stop the car before switching off.'); return; }
      return runSeq(STOP, 'stopping');
    }
    if ((m === 'ac' || m === 'dc') && !fromSeq) {
      if (S.v > 0.1) { note('Stop the car before plugging in.'); return; }
      if (S.soc >= 0.995) { note('Battery is full. Charging will not start.'); return; }
      var cb = H.chargeBlock ? H.chargeBlock(m) : null;
      if (cb) { S.warn.charge = 1; note(cb, 8000); return; }
      if (cur === 'off') {
        S.k.neg = S.k.pos = true; S.bus = vOpen();
        $('seq').innerHTML = '<li class="done">Plug in: charger and car agree the charge (handshake), then the contactors close</li>';
      }
    }
    S.mode = m;
    if (m === 'ready' || m === 'ac' || m === 'dc') { S.k.neg = S.k.pos = true; S.k.pre = false; }
    if (m !== 'ready') { S.pedal = 0; $('pedal').value = 0; }
    mark('modes', m);
    paintMode();
  }

  function paintMode() {
    var m = S.mode;
    var btns = document.querySelectorAll('.modes button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], bm = b.getAttribute('data-mode');
      b.classList.toggle('on', bm === m || (bm === 'ready' && m === 'starting') || (bm === 'off' && m === 'stopping'));
      b.disabled = !!S.seq;
    }
    $('pedal').disabled = m !== 'ready';
    $('release').disabled = m !== 'ready';
    $('socSet').disabled = !(m === 'off' || (m === 'ready' && S.v < 0.1));
  }

  // ---- physics step ----
  function step(dt) {
    var m = S.mode, o = {};
    var Voc = vOpen();
    var wheelW = S.v / CAR.wheelR;                       // rad/s at the wheel
    var motorW = wheelW * CAR.gear;                      // rad/s at the motor
    var rpm = motorW * 60 / (2 * Math.PI);
    var torque = 0, mechKW = 0, frictionBrake = 0, limitedBy = '';
    var battKW = 0;                                      // + = out of battery
    var aux = (m === 'off' ? 0 : CAR.auxKW) + (S.climate && m !== 'off' ? CAR.climateKW : 0);

    if (m === 'ready') {
      var p = S.pedal / 100;
      if (p > 0) {
        torque = p * CAR.tMax;
        var pLim = Math.min(CAR.pMotor, (battPowerLimit() - aux) * CAR.eff);
        if (S.tInv > 85) { pLim = Math.min(pLim, 40); S.warn.turtle = 1; }
        if (motorW > 1 && torque * motorW / 1000 > pLim) { torque = pLim * 1000 / motorW; limitedBy = S.tInv > 85 ? 'heat' : pLim < CAR.pMotor - 1 ? 'battery' : 'motor power'; }
        if (rpm > CAR.maxRpm) { torque = 0; limitedBy = 'top speed'; }
      } else if (p < 0) {
        var wantDecel = -p * 7;                          // m/s² asked for by the brake pedal
        var wantForce = wantDecel * CAR.mass;
        var regenT = 0;
        if (S.v > 1.5) {
          regenT = Math.min(CAR.regenNm, wantForce * CAR.wheelR / CAR.gear);
          var rl = regenLimit();
          if (regenT * motorW / 1000 > rl) regenT = rl * 1000 / motorW;
          if (S.v < 4) regenT *= (S.v - 1.5) / 2.5;      // regen fades at walking speed
        }
        torque = -regenT;
        frictionBrake = Math.max(0, wantForce - regenT * CAR.gear / CAR.wheelR);
        if (S.v < 0.05) frictionBrake = 0;
      }
      mechKW = torque * motorW / 1000;
    }

    // forces on the car
    var drive = torque * CAR.gear / CAR.wheelR * (torque > 0 ? 0.97 : 1);
    var drag = 0.5 * 1.2 * CAR.cdA * S.v * S.v;
    var roll = S.v > 0.05 ? CAR.rollC * CAR.mass * 9.81 : 0;
    var hold = m !== 'ready' ? 2000 : 0;                 // parked: handbrake / P lock
    var extra = S.v > 0.05 && H.extraDrag ? H.extraDrag() : 0;
    var resist = drag + roll + frictionBrake + hold + extra;
    var a = (drive - (S.v > 0 ? resist : 0)) / CAR.mass;
    if (S.v <= 0 && drive <= resist) a = Math.max(0, a);
    S.v = Math.max(0, S.v + a * dt);
    if (S.v < 0.15 && drive <= 0 && (S.pedal < 0 || m !== 'ready')) S.v = 0;   // brakes hold the car at rest
    else if (S.v < 0.03 && drive <= 0) S.v = 0;
    o.accel = a;

    // electrical side
    if (m === 'ready' || m === 'starting' || m === 'stopping') {
      battKW = (mechKW >= 0 ? mechKW / CAR.eff : mechKW * CAR.eff) + aux;
    }
    var timeScale = 1;
    if (m === 'ac') { battKW = -(CAR.acKW * 0.92 - aux); timeScale = 60; }
    if (m === 'dc') { battKW = -(dcAccept() - aux); timeScale = 60; }
    if ((m === 'ac' || m === 'dc') && S.soc >= 0.995) {
      S.soc = 1; battKW = 0; note('Charging finished. Battery is full, so the contactors open.');
      S.mode = 'off'; S.k.neg = S.k.pos = false; m = 'off'; paintMode();
    }
    var hvOn = S.k.neg && S.k.pos;
    // current from power: I = P / V, with the voltage dropping under load
    var I = 0, V = Voc;
    if (hvOn) {
      // V = Voc - I R, P = V I  ->  R I² - Voc I + P = 0
      var P = battKW * 1000, R = CAR.rInt, disc = Voc * Voc - 4 * R * P;
      I = disc > 0 ? (Voc - Math.sqrt(disc)) / (2 * R) : Voc / (2 * R);
      V = Voc - I * R;
    }
    S.soc = Math.min(1, Math.max(0, S.soc - battKW * dt * timeScale / 3600 / CAR.packKWh));

    // inverter capacitor (bus) voltage
    // insulation monitor: a faulty compressor leaks to the body as soon as it runs
    if (S.climate && hvOn && H.climateFault && H.climateFault()) {
      S.climate = false; $('climate').checked = false; S.warn.insul = 1;
      if (H.onEvent) H.onEvent('insul');
      note('Warning: insulation fault. The car switched the A/C off.', 8000);
    }

    // temperatures: inverter heat from losses, removed by the coolant pump
    var pumpOn = hvOn && (!H.pumpOk || H.pumpOk());
    var heat = Math.abs(mechKW) * 0.05;
    var k = pumpOn ? 0.25 : 0.012;                      // healthy: about 65 °C even at full power
    S.tInv += (heat - k * (S.tInv - 35)) / 1.5 * dt;
    if (S.tInv < 70) delete S.warn.turtle;
    var battHeat = I * I * CAR.rInt / 1000;                                       // kW of heat inside the pack
    S.tBatt += (battHeat - (pumpOn ? 0.3 : 0.02) * (S.tBatt - 30)) * dt * timeScale / 600;

    var preOk = !(H.preBlocked && H.preBlocked());
    if (S.k.neg && S.k.pre && !S.k.pos) S.bus += ((preOk ? Voc : Voc * 0.05) - S.bus) * (1 - Math.exp(-dt / 0.45));
    else if (hvOn) S.bus = V;
    else if (S.mode === 'stopping' || !S.k.neg) S.bus *= Math.exp(-dt / 0.45);
    if (S.bus < 1) S.bus = 0;

    // range from a smoothed consumption figure
    var kmh = S.v * 3.6;
    if (m === 'ready' && kmh > 5) {
      var whkm = Math.max(-200, Math.min(600, battKW * 1000 / kmh));
      S.whkm = (S.whkm || 160) + (whkm - (S.whkm || 160)) * Math.min(1, dt / 25);   // slow average, like the car's own display
    }
    var cons = Math.min(400, Math.max(110, S.whkm || 160));

    o.kmh = kmh; o.rpm = rpm; o.torque = torque; o.battKW = battKW; o.V = hvOn ? V : 0; o.I = I;
    o.mechKW = mechKW; o.friction = frictionBrake; o.limitedBy = limitedBy; o.cons = cons;
    o.range = S.soc * CAR.packKWh * 1000 / cons;
    o.state = stateOf(m, S.pedal, torque, frictionBrake, kmh);
    S.out = o;
  }

  function stateOf(m, pedal, torque, friction, kmh) {
    if (m === 'starting') return ['Starting…', 'busy'];
    if (m === 'stopping') return ['Switching off…', 'busy'];
    if (m === 'ac') return ['AC charging', 'charge'];
    if (m === 'dc') return ['DC fast charging', 'charge'];
    if (m === 'off') return ['Off', 'off'];
    if (torque > 0.5) return ['Driving', 'drive'];
    if (torque < -0.5) return ['Braking: regen', 'regen'];
    if (friction > 0 && kmh > 0.1) return ['Braking: friction', 'regen'];
    if (kmh > 0.5) return ['Coasting', 'ready'];
    return ['Ready', 'ready'];
  }

  // ---- drawing ----
  var LIVE_HV = ['battery', 'contactors', 'msd', 'junction', 'hvcable', 'interlock'];
  function liveParts(o) {
    var m = S.mode, l = ['aux12'];
    var hv = S.k.neg && S.k.pos;
    if (m !== 'off') l.push('bms', 'vcu');
    if (hv || S.bus > 60) l = l.concat(LIVE_HV, ['inverter', 'dcdc']);
    if (m === 'ready' && Math.abs(o.mechKW) > 0.2) l.push('motor', 'pump', 'radiator');
    if (o.kmh > 0.3) l.push('gearbox');
    if (m === 'ac') l.push('obc', 'port', 'pump');
    if (m === 'dc') l.push('port', 'pump', 'compressor', 'radiator');
    if (S.climate && hv) l.push('compressor', 'heater');
    return l;
  }

  function flowsFor(o) {
    // [cable id, reverse?, kW for speed]
    var f = [], m = S.mode, hv = S.k.neg && S.k.pos;
    if (!hv) return f;
    var kw = o.battKW, motorKW = Math.abs(o.mechKW);
    f.push(['hvBatt', kw < 0, Math.abs(kw)]);
    f.push(['hvDcdc', false, CAR.auxKW], ['lvDcdc', false, CAR.auxKW], ['lvVcu', false, 0.1]);
    if (m === 'ready' && motorKW > 0.2) {
      f.push(['hvInv', o.mechKW < 0, motorKW], ['ac3', o.mechKW < 0, motorKW]);
      f.push(['coolMain', false, 5], ['coolRad', false, 5], ['coolInv', false, 5]);
    }
    if (m === 'ac') f.push(['acPort', false, CAR.acKW], ['hvObc', true, CAR.acKW], ['coolMain', false, 3], ['coolInv', false, 3]);
    if (m === 'dc') f.push(['dcPort', false, Math.abs(kw)], ['hvComp', false, 3], ['coolMain', false, 8], ['coolRad', false, 8]);
    if (S.climate) f.push(['hvComp', false, CAR.climateKW]);
    return f;
  }

  var lastLive = '', lastFlow = '';
  function paint() {
    var o = S.out;
    $('stateName').textContent = o.state[0];
    $('stateName').className = 'state ' + o.state[1];
    paintWarn();

    $('rSpeed').textContent = o.kmh.toFixed(0);
    $('rRpm').textContent = Math.round(o.rpm / 10) * 10;
    $('rTorque').textContent = o.torque.toFixed(0);
    $('rPower').textContent = o.battKW.toFixed(Math.abs(o.battKW) < 10 ? 1 : 0);
    $('rVolt').textContent = o.V.toFixed(0);
    $('rAmp').textContent = o.I.toFixed(0);
    $('rSoc').textContent = (S.soc * 100).toFixed(S.mode === 'ac' || S.mode === 'dc' ? 1 : 0);
    if (S.mode === 'ac' || S.mode === 'dc') {
      var kw = -o.battKW, toFull = kw > 0.1 ? (1 - S.soc) * CAR.packKWh / kw * 60 : 0;
      $('rLabel8').textContent = 'Time to full (about)'; $('rRange').textContent = toFull > 0 ? Math.round(toFull) : '–'; $('rUnit8').textContent = 'min';
    } else {
      $('rLabel8').textContent = 'Range (at ' + Math.round(o.cons) + ' Wh/km)'; $('rRange').textContent = Math.round(o.range); $('rUnit8').textContent = 'km';
    }

    // pedal text and notes
    var p = S.pedal;
    $('pedalTxt').textContent = p > 0 ? 'Accelerator ' + p + '%' : p < 0 ? 'Brake ' + (-p) + '%' : 'Coasting';
    var n = '';
    if (S.mode === 'off') n = 'Press Ready to start the car.';
    else if (o.limitedBy === 'heat') n = 'Power reduced to 40 kW: the inverter is too hot (' + Math.round(S.tInv) + ' °C).';
    else if (o.limitedBy === 'battery') n = 'The battery is the weakest link: the BMS allows ' + Math.round(battPowerLimit()) + ' kW' + (S.soc < 0.1 ? ' because the charge is low' : ' (400 A limit, and voltage drops as charge falls)') + '. The motor could give 150 kW.';
    else if (o.limitedBy === 'motor power') n = 'Motor at full power: ' + Math.round(o.mechKW) + ' kW. Torque falls as speed rises (P = T × rpm ÷ 9,550).';
    else if (o.limitedBy === 'top speed') n = 'Top speed: motor at its maximum rpm.';
    else if (p < 0 && o.friction > 50 && o.kmh > 1) n = regenLimit() < 1 ? 'Battery nearly full, so no regen. The friction brakes do all the work.' : 'Regen at its limit. The friction brakes add the rest.';
    else if (S.mode === 'dc') n = 'Charging is shown 60 times faster. The charger slows down above 50% and much more above 80%.';
    else if (S.mode === 'ac') n = 'Charging is shown 60 times faster. AC goes through the on-board charger (7 kW).';
    else if (S.mode === 'ready' && o.torque > 0) n = o.mechKW.toFixed(0) + ' kW at the motor = ' + o.torque.toFixed(0) + ' Nm × ' + Math.round(o.rpm) + ' rpm ÷ 9,550';
    if (noteUntil > Date.now()) n = noteText;
    $('note').textContent = n;

    // battery fill
    var h = 236 * S.soc; $('socFill').setAttribute('y', 356 + 236 - h); $('socFill').setAttribute('height', h);

    // contactors
    ['neg', 'pre', 'pos'].forEach(function (k) {
      var g = $('k' + k.charAt(0).toUpperCase() + k.slice(1));
      g.classList.toggle('closed', S.k[k]);
      var bl = g.querySelector('.blade');
      var x = +bl.getAttribute('x1'), y = +bl.getAttribute('y1');
      bl.setAttribute('transform', S.k[k] ? 'rotate(' + 22 + ' ' + x + ' ' + y + ')' : '');
    });
    $('kPackV').textContent = vOpen().toFixed(0) + ' V';
    $('kBusV').textContent = S.bus.toFixed(0) + ' V';
    $('busBar').style.width = Math.min(100, S.bus / 4) + '%';

    // live parts
    var live = liveParts(o), key = live.join();
    if (key !== lastLive) {
      lastLive = key;
      var parts = document.querySelectorAll('#car g.part');
      for (var i = 0; i < parts.length; i++) parts[i].classList.toggle('live', live.indexOf(parts[i].getAttribute('data-id')) >= 0);
    }

    // flows
    var fl = flowsFor(o), seen = {};
    fl.forEach(function (f) {
      var el = flowEl[f[0]]; seen[f[0]] = 1;
      el.classList.add('on'); el.classList.toggle('rev', f[1]);
      el.style.setProperty('--dur', (2.4 / (1 + f[2] / 15)).toFixed(2) + 's');
      flowEl[f[0] + '_cable'].classList.add('on-cable');
    });
    CABLES.forEach(function (c) {
      if (!seen[c[0]]) { flowEl[c[0]].classList.remove('on'); flowEl[c[0] + '_cable'].classList.remove('on-cable'); }
    });
    if (selected === 'interlock') { flowEl.hvil.classList.add('on'); flowEl.hvil_cable.classList.add('on-cable'); }

    // turning parts
    var car = $('car');
    car.classList.toggle('spin', o.kmh > 0.3);
    if (o.kmh > 0.3) car.style.setProperty('--wdur', Math.max(0.08, 6 / o.kmh).toFixed(2) + 's');
  }

  var noteText = '', noteUntil = 0;
  function note(t, ms) { noteText = t; noteUntil = Date.now() + (ms || 3500); }
  var WARN = { ev: 'Check EV system', insul: 'Insulation fault', turtle: 'Power reduced', charge: 'Charging fault' };
  var lastWarn = '';
  function paintWarn() {
    var keys = Object.keys(S.warn).filter(function (k) { return S.warn[k] && WARN[k]; });
    var key = keys.join();
    if (key === lastWarn) return; lastWarn = key;
    $('warn').innerHTML = key ? keys.map(function (k) { return '<span>⚠ ' + WARN[k] + '</span>'; }).join('') : '';
  }

  // ---- part info ----
  var selected = null;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function select(id) {
    var P = (window.CAR_PARTS || {})[id];
    if (!P) return;
    selected = id;
    var parts = document.querySelectorAll('#car g.part');
    for (var i = 0; i < parts.length; i++) parts[i].classList.toggle('sel', parts[i].getAttribute('data-id') === id);
    $('iName').textContent = P.name;
    $('iUrdu').textContent = P.urdu || '';
    var h = '<p>' + esc(P.job) + '</p>';
    if (P.inside) h += '<p>' + esc(P.inside) + '</p>';
    if (P.live) h += '<p class="livep">' + esc(P.live) + '</p>';
    if (P.safety) h += '<p class="safety">' + esc(P.safety) + '</p>';
    var inApp = !!document.querySelector('nav.tabs');            // inside the study app, chips open the module
    if (P.modules && P.modules.length) h += '<div class="mods">' + P.modules.map(function (m) { return inApp ? '<a href="#m/' + m + '">Module ' + m + '</a>' : '<span>Module ' + m + '</span>'; }).join('') + '</div>';
    $('iBody').innerHTML = h;
    if (H.afterSelect) H.afterSelect(id, $('iBody'));
    mark('parts', id);
    if (window.innerWidth < 820) $('info').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function showExplored() {
    var total = Object.keys(window.CAR_PARTS || {}).length;
    var n = Object.keys(store.parts).filter(function (k) { return (window.CAR_PARTS || {})[k]; }).length;
    $('explored').textContent = 'Parts explored: ' + n + ' of ' + total + ' · States tried: ' + ['ready', 'drive', 'ac', 'dc'].filter(function (k) { return store.modes[k]; }).length + ' of 4';
  }

  // ---- wiring ----
  buildCables();
  $('car').addEventListener('click', function (e) {
    var g = e.target.closest('.part'); if (g) select(g.getAttribute('data-id'));
  });
  $('car').addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('part')) { e.preventDefault(); select(e.target.getAttribute('data-id')); }
  });
  Array.prototype.forEach.call(document.querySelectorAll('.modes button'), function (b) {
    b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
  });
  $('pedal').addEventListener('input', function () { S.pedal = +this.value; if (S.pedal > 0) mark('modes', 'drive'); });
  $('release').addEventListener('click', function () { S.pedal = 0; $('pedal').value = 0; });
  $('climate').addEventListener('change', function () { S.climate = this.checked; });
  $('socSet').addEventListener('input', function () { S.soc = this.value / 100; $('socSetTxt').textContent = this.value + '%'; S.whkm = 0; });

  showExplored();
  paintMode();
  var last = performance.now();
  var host = $('carView');
  function frame(t) {
    var dt = Math.min(0.1, (t - last) / 1000); last = t;
    if (host && host.hidden) { requestAnimationFrame(frame); return; }   // another app tab is showing: pause
    tickSeq(dt);
    step(dt);
    paint();
    if (S.mode === 'ready' || S.mode === 'off') $('socSetTxt').textContent = Math.round(S.soc * 100) + '%';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // test hook for the local draft
  window.__car = S;
  window.CarAPI = {
    S: S, CAR: CAR, setMode: setMode, note: note, vOpen: vOpen, paintMode: paintMode, select: select,
    selected: function () { return selected; },
    tick: function (secs) { for (var t = 0; t < secs; t += 0.05) { tickSeq(0.05); step(0.05); } paint(); }   // for testing
  };
  if (H.init) H.init();
})();
