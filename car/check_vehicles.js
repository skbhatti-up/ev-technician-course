/* ============================================================================
   AUTOMATIC CHECKS FOR vehicles.js
   Run with:   node car/check_vehicles.js
   It reads every vehicle's truth table and tests rules that must always hold.
   If someone edits vehicles.js and breaks a rule, this script says which one.
   ========================================================================== */
global.window = {};
var V = require('./vehicles.js');
var BASE = (function () { require('./parts.js'); return global.window.CAR_PARTS; })();

var fails = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { fails++; console.log('  FAIL: ' + msg); } }
function has(arr, x) { return arr.indexOf(x) >= 0; }

Object.keys(V).forEach(function (vid) {
  var v = V[vid], P = v.parts, L = v.links;
  console.log(v.name);
  var always = v.always || [];

  // ---- every part is complete and has a source
  Object.keys(P).forEach(function (id) {
    var p = P[id];
    ok(p.n && p.s && p.where, id + ': needs a name, a short label and a "where to find it"');
    ok(p.job || (p.base && BASE[p.base] && BASE[p.base].job), id + ': needs "what it does" text (own or borrowed)');
    ok(!p.base || BASE[p.base], id + ': borrows from a part that does not exist in parts.js (' + p.base + ')');
    ok(p.conf === 'ok' || p.conf === 'verify', id + ': must be tagged ok or verify');
    ok(v.sources[p.src], id + ': its source "' + p.src + '" is not in the sources list');
    ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= v.view.w && p.y + p.h <= v.view.h, id + ': drawn outside the picture');
  });

  // ---- no two part boxes overlap (unless one is drawn inside the other on purpose)
  var ids = Object.keys(P);
  for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) {
    var a = P[ids[i]], b = P[ids[j]];
    if (a.inside === ids[j] || b.inside === ids[i]) continue;
    var apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
    ok(apart, ids[i] + ' and ' + ids[j] + ': boxes overlap');
  }

  // ---- every cable joins two real parts, and starts and ends on them
  function within(pt, p, slack) { return pt[0] >= p.x - slack && pt[0] <= p.x + p.w + slack && pt[1] >= p.y - slack && pt[1] <= p.y + p.h + slack; }
  Object.keys(L).forEach(function (id) {
    var l = L[id];
    ok(P[l.a], id + ': starts at unknown part ' + l.a);
    ok(P[l.b] || l.b === 'wheels', id + ': ends at unknown part ' + l.b);
    var segs = Array.isArray(l.p[0][0]) ? l.p : [l.p];
    var first = segs[0][0], last = segs[segs.length - 1][segs[segs.length - 1].length - 1];
    // a cable marked "tap" branches off another cable, so one end is not on a part box
    if (P[l.a]) ok(within(first, P[l.a], 2) || l.tap, id + ': first point is not on ' + l.a);
    if (P[l.b]) ok(within(last, P[l.b], 2) || l.tap, id + ': last point is not on ' + l.b);
  });

  // ---- facts and steps carry sources and tags
  v.facts.forEach(function (f) {
    ok(f.conf === 'ok' || f.conf === 'verify', 'fact "' + f.l + '": must be tagged ok or verify');
    ok(v.sources[f.src], 'fact "' + f.l + '": unknown source ' + f.src);
  });
  (v.rescue || []).forEach(function (r) { ok(v.sources[r.src], 'rescue note: unknown source ' + r.src); });

  // ---- modes
  ok(v.modes[0].id === 'off' || v.modes[0].cls === 'off', 'the first mode must be the off state');
  v.modes.forEach(function (m) {
    var live = m.live.concat(always), flowIds = m.flows.map(function (f) { return f[0]; });
    m.live.forEach(function (id) { ok(P[id], m.id + ': lists unknown live part ' + id); });
    m.flows.forEach(function (f) {
      ok(L[f[0]], m.id + ': flow on unknown cable ' + f[0]);
      ok(f[1] === 1 || f[1] === -1, m.id + ': flow direction on ' + f[0] + ' must be 1 or -1');
    });

    // RULE: nothing flows when the vehicle is off
    if (m.cls === 'off') {
      ok(m.flows.length === 0, m.id + ': no cable may carry power when off');
      ok(m.live.length === 0, m.id + ': no part may be working when off (only the always-live ones)');
    }
    // RULE: a cable can only carry power between parts that are live in that mode
    m.flows.forEach(function (f) {
      var l = L[f[0]]; if (!l) return;
      ok(has(live, l.a), m.id + ': cable ' + f[0] + ' carries power but ' + l.a + ' is not live');
      ok(l.b === 'wheels' || has(live, l.b), m.id + ': cable ' + f[0] + ' carries power but ' + l.b + ' is not live');
    });
    // RULE: petrol flows and the engine shaft turns only when the engine is running
    ['fuel', 'eg', 'gc'].forEach(function (id) {
      if (has(flowIds, id)) ok(has(m.live, 'engine'), m.id + ': ' + id + ' is active but the engine is not running');
    });
    // RULE: if the engine runs, petrol must flow to it
    if (has(m.live, 'engine')) ok(has(flowIds, 'fuel'), m.id + ': engine running without fuel flow');
    // RULE: the 12 V battery is charged through the DC-DC converter whenever high voltage is on
    if (L.lvdcdc && m.cls !== 'off') ok(has(flowIds, 'lvdcdc') && has(m.live, 'dcdc'), m.id + ': DC-DC should be charging the 12 V battery');
    // RULE: AC charging goes through the on-board charger and the motor does not drive
    if (m.id === 'ac') {
      ok(has(m.live, 'obc') && has(m.live, 'port') && has(flowIds, 'acport'), 'ac: must use the port and the on-board charger');
      ok(!has(flowIds, 'motac') && !has(m.live, 'motor'), 'ac: the motor must not drive while charging');
    }
    // RULE: DC fast charging bypasses the on-board charger
    if (m.id === 'dc') {
      ok(!has(m.live, 'obc') && !has(flowIds, 'acport') && !has(flowIds, 'hvobc'), 'dc: the on-board charger must NOT be used');
      ok(has(flowIds, 'dcport') && has(m.live, 'port'), 'dc: power must come in through the port');
      ok(!has(flowIds, 'motac') && !has(m.live, 'motor'), 'dc: the motor must not drive while charging');
    }
    // RULE: in braking, energy flows back towards the battery
    if (m.id === 'regen') {
      var back = m.flows.filter(function (f) { return f[0] === 'hvmain'; })[0];
      ok(back && back[1] === -1, 'regen: main cable must flow back into the battery');
    }
  });

  // ---- vehicle-type rules
  if (v.kind === 'HEV') {
    ok(!P.port && !P.obc, 'a full hybrid has no charge port and no on-board charger');
    ok(!v.modes.some(function (m) { return m.cls === 'charge'; }), 'a full hybrid has no plug-in charging mode');
    ok(P.engine && P.tank && P.gen, 'a hybrid needs an engine, a fuel tank and a generator');
  }
  if (v.kind === 'PHEV') ok(P.port && P.obc && P.engine && P.tank, 'a plug-in hybrid needs a port, a charger, an engine and a tank');
  if (v.kind === 'BEV') ok(P.port && P.obc && !P.engine && !P.tank, 'a battery electric car has a port and charger but no engine or tank');
  ok(has(always, 'battery'), 'the battery must be marked always live');

  // ---- make-safe drill: the order must follow switch off -> disconnect -> wait -> prove dead
  var steps = v.safe.steps.map(function (s) { return s.t.toLowerCase(); });
  function at(word) { for (var i = 0; i < steps.length; i++) if (steps[i].indexOf(word) >= 0) return i; return -1; }
  ok(steps.length >= 6, 'make-safe drill needs at least 6 steps');
  ok(at('switch off') >= 0 && at('wait') > at('switch off'), 'make-safe: "wait" must come after "switch off"');
  ok(at('prove dead') > at('wait'), 'make-safe: "prove dead" must come after "wait"');
  v.safe.steps.forEach(function (s) { ok(s.t && s.why, 'make-safe: every step needs a reason'); });
});

console.log('\n' + checks + ' checks, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
