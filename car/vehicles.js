/* ============================================================================
   VEHICLE TRUTH TABLES
   ----------------------------------------------------------------------------
   This file is the single place that says, for each vehicle:
     - which parts it has and roughly where they sit
     - which cables and pipes join them (and what kind each one is)
     - which of those are "live" in each driving or charging mode
     - the order of steps to make the vehicle safe
   The drawing code (vexplorer.js) only draws what is written here, so a cable
   cannot appear on screen unless this file says it exists.

   HOW SURE ARE WE?  Every part and fact carries a "conf" tag:
     ok     = taken from an official maker document or published specification
     verify = the usual layout for this type of vehicle, NOT yet confirmed for
              this exact model. Check against the service manual before
              teaching it as fact.
   "src" names the entry in the vehicle's "sources" list that backs it up.

   Positions are a simplified map (top view, front of the car at the top).
   They show which area a part is in, not exact measurements.

   Link types: hv = high-voltage DC, ac = AC / three-phase, lv = 12 V,
               sig = signal or data wire, mech = turning shaft, fuel = petrol,
               cool = coolant.
   A part with "base" borrows its "what it does / inside / safety" text from
   the matching part in parts.js, so the wording stays the same across the app.
   ========================================================================== */
(function () {

  /* Text shared by more than one hybrid --------------------------------- */
  var ENGINE = {
    n: 'Petrol engine', k: 'mech',
    job: 'Burns petrol. In a hybrid it does two jobs: it turns the generator to make electricity, and at higher speeds it can also drive the wheels directly through a clutch.',
    safety: 'In READY the engine can start by itself at any moment, with no key turned. Keep hands, tools and clothing clear, and switch fully off before working near belts or fans.'
  };
  var GEN = {
    n: 'Generator (motor 1)', k: 'hv',
    job: 'An electric machine bolted to the engine. The engine spins it to make electricity for the drive motor and the battery. It also works as the starter motor to start the engine.',
    safety: 'It makes voltage whenever the engine turns it. Treat its orange cables as live any time the engine could run.'
  };
  var TMOTOR = { n: 'Drive motor (motor 2)', k: 'hv', base: 'motor' };
  var DHT = {
    n: 'Hybrid gearbox (DHT)', k: 'mech',
    job: 'The "dedicated hybrid transmission". It holds the gears, the differential and a clutch. With the clutch open the engine only makes electricity (series). With the clutch closed the engine also drives the wheels (parallel).',
    safety: 'Has its own special fluid, which also cools the two electric machines on many designs. Use only the fluid the maker names.'
  };
  var PCU = {
    n: 'Power control unit (inverters)', k: 'hv', base: 'inverter',
    job: 'Holds two inverters: one for the generator and one for the drive motor. It changes battery DC into three-phase AC for the motor, and changes AC from the generator and from braking back into DC.'
  };
  var TANK = {
    n: 'Fuel tank', k: 'fuel',
    job: 'Holds the petrol for the engine. A hybrid still has a full fuel system: tank, pump, lines and injectors.',
    safety: 'Petrol vapour and high-voltage sparks must never meet. Keep fuel work and high-voltage work separate, and deal with any fuel leak first.'
  };
  var HCU = {
    n: 'Hybrid control unit', k: 'lv', base: 'vcu',
    job: 'The master computer of the hybrid system. It decides, many times a second, whether the car runs on the battery, the engine, or both, and it asks the BMS to close the contactors.'
  };
  var CUT = {
    n: 'Fuse box and emergency cut point', k: 'lv',
    job: 'The 12 V fuse box under the bonnet. Next to it is a wiring loop with a special label. Rescue crews cut this loop after a crash: it removes the 12 V supply that holds the battery contactors closed, so the high-voltage system shuts down.',
    safety: 'The cut loop is for rescue crews in an emergency. In the workshop you do not cut it; you follow the isolation steps in the service manual.'
  };
  var RAD = { n: 'Radiators', k: 'cool', base: 'radiator',
    job: 'At the front of the car. A hybrid has more than one cooling loop: a hot loop for the engine and a cooler loop for the power electronics. The A/C condenser sits here too.' };

  /* Make-safe steps shared by the cars. The order follows Module 3.6 of the
     course: switch off -> disconnect -> secure -> wait -> prove dead.       */
  function carSafe(isolator, isoConf, extra) {
    var steps = [
      { t: 'Park on a dry, level floor. Select P, parking brake on, chock the wheels.' + (extra && extra.plug ? ' Unplug the charging cable.' : ''),
        why: 'The car must not move, and it must not be connected to a charger.' },
      { t: 'Switch off. Check the READY light is out. Take the smart key at least 5 metres away.',
        why: 'With the key near, the car can wake up' + (extra && extra.engine ? ' and a hybrid engine can start by itself.' : '.') },
      { t: 'Put on checked Class 0 gloves and glasses. Set up the barrier and the warning sign.',
        why: 'Protection goes on before you touch anything that could be live.' },
      { t: 'Disconnect the 12 V battery negative terminal.',
        why: 'Without 12 V the contactors inside the battery cannot close.' },
      { t: isolator.t, why: isolator.why, conf: isoConf },
      { t: 'Wait the time given in the service manual (usually 5 to 10 minutes).',
        why: 'Capacitors in the inverter hold a charge after switch-off and need time to drain.' },
      { t: 'Prove dead: test your meter on 12 V, measure the high-voltage point (+ to −, + to body, − to body), then test the meter on 12 V again.',
        why: 'A broken meter reads 0 V on a live circuit. Prove, test, prove.' }
    ];
    return steps;
  }

  var V = {};

  /* =====================================================================
     HAVAL H6 HEV  (full hybrid, no plug)
     ===================================================================== */
  V.h6hev = {
    name: 'Haval H6 HEV', short: 'Haval H6 HEV', kind: 'HEV',
    blurb: 'A full hybrid. A petrol engine and two electric machines share the work. It has a small high-voltage battery and no charging socket: the battery is filled only by the engine and by braking.',
    view: { w: 400, h: 640, outline: 'car' },
    legend: { hv: 'High voltage DC', ac: 'Three-phase AC', lv: '12 V', sig: 'Data (CAN)', mech: 'Turning shaft', fuel: 'Petrol', cool: 'Coolant' },
    facts: [
      { l: 'Engine and gearbox', v: '1.5 litre turbo petrol with a 2-speed hybrid gearbox (DHT)', conf: 'ok', src: 'h6dht' },
      { l: 'Combined output', v: '179 kW and 530 Nm', conf: 'ok', src: 'h6za' },
      { l: 'High-voltage battery', v: 'Lithium-ion, about 1.7 kWh', conf: 'ok', src: 'h6th' },
      { l: 'Battery voltage', v: 'Not confirmed. Expect a few hundred volts: treat as lethal.', conf: 'verify', src: 'course' },
      { l: 'Plug-in charging', v: 'None. It charges itself from the engine and from braking.', conf: 'ok', src: 'h6za' },
      { l: 'Isolation device', v: 'Battery safety switch under the boot floor', conf: 'ok', src: 'h6manual' },
      { l: 'Rescue cut point', v: 'Labelled wiring loop at the front of the under-bonnet fuse box', conf: 'ok', src: 'h6manual' }
    ],
    parts: {
      radiator: Object.assign({}, RAD, { s: 'Radiators', x: 110, y: 24, w: 180, h: 18, where: 'Behind the front grille.', conf: 'verify', src: 'course' }),
      engine: Object.assign({}, ENGINE, { s: 'Petrol\nengine', x: 82, y: 50, w: 80, h: 62, where: 'Under the bonnet, mounted across the car.', conf: 'ok', src: 'h6dht' }),
      gen: Object.assign({}, GEN, { s: 'Gener-\nator', x: 168, y: 50, w: 48, h: 62, where: 'Inside the hybrid gearbox housing, on the engine side.', conf: 'verify', src: 'h6dht' }),
      gear: Object.assign({}, DHT, { s: 'Gears\n+ clutch', x: 222, y: 50, w: 44, h: 62, where: 'Bolted to the end of the engine, under the bonnet.', conf: 'ok', src: 'h6dht' }),
      motor: Object.assign({}, TMOTOR, { s: 'Drive\nmotor', x: 272, y: 50, w: 46, h: 62, where: 'Inside the hybrid gearbox housing.', conf: 'verify', src: 'h6dht' }),
      compressor: { base: 'compressor', k: 'hv', n: 'Electric A/C compressor', s: 'A/C comp.', x: 82, y: 122, w: 80, h: 32, where: 'Under the bonnet, low down at the front of the engine. Look for its orange cable.', conf: 'verify', src: 'course' },
      pcu: Object.assign({}, PCU, { s: 'Power control unit', x: 168, y: 122, w: 150, h: 32, where: 'Under the bonnet, on top of or beside the hybrid gearbox. Orange cables go into it.', conf: 'verify', src: 'course' }),
      cut: Object.assign({}, CUT, { s: 'Fuse box\n+ cut loop', x: 82, y: 164, w: 62, h: 30, where: 'Under the bonnet. The labelled loop is at the front of the fuse box.', conf: 'ok', src: 'h6manual' }),
      aux12: { base: 'aux12', k: 'lv', n: '12 V battery', s: '12 V', x: 150, y: 164, w: 52, h: 30, where: 'Under the bonnet (check: some hybrids keep it in the boot).', conf: 'verify', src: 'course' },
      dcdc: { base: 'dcdc', k: 'hv', n: 'DC-DC converter', s: 'DC-DC', x: 208, y: 164, w: 54, h: 30, where: 'Usually built into the power control unit.', conf: 'verify', src: 'course' },
      hcu: Object.assign({}, HCU, { s: 'HCU', x: 276, y: 164, w: 42, h: 30, where: 'A control unit on the 12 V system; exact place not confirmed.', conf: 'verify', src: 'course' }),
      tank: Object.assign({}, TANK, { s: 'Fuel tank', x: 88, y: 390, w: 100, h: 50, where: 'Under the rear seat area.', conf: 'verify', src: 'course' }),
      battery: { base: 'battery', k: 'hv', n: 'High-voltage battery', s: 'HV battery\n(about 1.7 kWh)', x: 110, y: 500, w: 140, h: 64, where: 'At the rear, under the boot floor area. Much smaller than an EV battery: about the size of a suitcase.', conf: 'verify', src: 'h6manual',
        job: 'A small lithium-ion pack. It does not drive the car far by itself; it stores braking energy and gives it back to help the engine. It is still high voltage and still lethal.' },
      bms: { base: 'bms', k: 'lv', n: 'Battery management system (BMS)', s: 'BMS', x: 258, y: 500, w: 60, h: 30, where: 'Inside the battery case.', conf: 'verify', src: 'course' },
      sw: { k: 'hv', n: 'Battery safety switch', s: 'Safety\nswitch', x: 258, y: 534, w: 60, h: 30,
        job: 'Disconnects or connects the high-voltage supply at the battery. It is this car\'s service disconnect.',
        safety: 'The owner\'s manual says it is for service staff only. Operate it only after training, wearing Class 0 gloves, and keep the area locked off so nobody switches it back.',
        where: 'Under the boot floor. Lift the boot floor cover or spacer to see it.', conf: 'ok', src: 'h6manual' }
    },
    links: {
      eg: { t: 'mech', a: 'engine', b: 'gen', p: [[150, 81], [180, 81]] },
      gc: { t: 'mech', a: 'gen', b: 'gear', p: [[205, 81], [232, 81]] },
      mg: { t: 'mech', a: 'motor', b: 'gear', p: [[285, 81], [255, 81]] },
      dr: { t: 'mech', a: 'gear', b: 'wheels', p: [[[244, 112], [244, 117]], [[244, 117], [70, 117]], [[244, 117], [330, 117]]] },
      genac: { t: 'ac', a: 'gen', b: 'pcu', p: [[192, 112], [192, 122]] },
      motac: { t: 'ac', a: 'pcu', b: 'motor', p: [[295, 122], [295, 112]] },
      hvmain: { t: 'hv', a: 'battery', b: 'pcu', p: [[240, 500], [240, 490], [270, 490], [270, 154]] },
      hvsw: { t: 'hv', a: 'sw', b: 'battery', p: [[262, 549], [245, 549]] },
      hvdcdc: { t: 'hv', a: 'pcu', b: 'dcdc', p: [[235, 154], [235, 164]] },
      hvcomp: { t: 'hv', a: 'pcu', b: 'compressor', p: [[172, 138], [158, 138]] },
      lvdcdc: { t: 'lv', a: 'dcdc', b: 'aux12', p: [[212, 179], [198, 179]] },
      lvcut: { t: 'lv', a: 'aux12', b: 'cut', p: [[154, 179], [140, 179]] },
      can: { t: 'sig', a: 'hcu', b: 'bms', p: [[297, 194], [297, 500]] },
      fuel: { t: 'fuel', a: 'tank', b: 'engine', p: [[92, 400], [77, 400], [77, 81], [84, 81]] },
      cool1: { t: 'cool', a: 'radiator', b: 'engine', p: [[120, 42], [120, 50]] },
      cool2: { t: 'cool', a: 'radiator', b: 'pcu', p: [[286, 42], [286, 46], [324, 46], [324, 138], [316, 138]] }
    },
    always: ['aux12', 'cut', 'battery', 'sw'],
    modes: [
      { id: 'off', name: 'Off', cls: 'off',
        note: 'Contactors open. High voltage stays inside the battery case. Only the 12 V system is awake.',
        live: [], flows: [] },
      { id: 'ev', name: 'Electric drive', cls: 'drive',
        note: 'Pulling away gently: the battery alone feeds the drive motor. The engine is stopped, so the car is silent but READY.',
        live: ['pcu', 'motor', 'gear', 'dcdc', 'hcu', 'bms'],
        flows: [['hvmain', 1], ['motac', 1], ['mg', 1], ['dr', 1], ['hvdcdc', 1], ['lvdcdc', 1], ['can', 1]] },
      { id: 'series', name: 'Engine makes electricity', cls: 'ready',
        note: 'Series mode. The clutch is open. The engine turns the generator; that electricity drives the motor, and any extra tops up the battery.',
        live: ['engine', 'gen', 'pcu', 'motor', 'gear', 'dcdc', 'hcu', 'bms', 'tank', 'radiator'],
        flows: [['fuel', 1], ['eg', 1], ['genac', 1], ['motac', 1], ['mg', 1], ['dr', 1], ['hvmain', -1], ['hvdcdc', 1], ['lvdcdc', 1], ['can', 1], ['cool1', 1], ['cool2', 1]] },
      { id: 'parallel', name: 'Engine drives wheels', cls: 'drive',
        note: 'Parallel mode, at higher speed. The clutch closes so the engine drives the wheels through the gears. The motor adds help from the battery when you ask for more power.',
        live: ['engine', 'gen', 'pcu', 'motor', 'gear', 'dcdc', 'hcu', 'bms', 'tank', 'radiator'],
        flows: [['fuel', 1], ['eg', 1], ['gc', 1], ['dr', 1], ['hvmain', 1], ['motac', 1], ['mg', 1], ['hvdcdc', 1], ['lvdcdc', 1], ['can', 1], ['cool1', 1], ['cool2', 1]] },
      { id: 'regen', name: 'Braking', cls: 'regen',
        note: 'Regenerative braking. The wheels turn the motor, which now works as a generator and sends energy back into the battery.',
        live: ['pcu', 'motor', 'gear', 'dcdc', 'hcu', 'bms'],
        flows: [['dr', -1], ['mg', -1], ['motac', -1], ['hvmain', -1], ['hvdcdc', 1], ['lvdcdc', 1], ['can', 1]] }
    ],
    safe: {
      note: 'Practice the order only. On a real car you must follow the Haval service manual, under supervision.',
      steps: carSafe({ t: 'Lift the boot floor and switch off the battery safety switch, wearing gloves. Lock the area so nobody can switch it back.',
        why: 'This breaks the high-voltage circuit at the battery. The cells inside stay live.' }, 'ok', { engine: true })
    },
    rescue: [
      { v: 'Battery safety switch is under the baggage (boot) area; visible after removing the floor cover or spacer.', src: 'h6manual' },
      { v: 'Emergency cut-off point: a wiring harness with an emergency cut-off mark at the front of the under-bonnet fuse box.', src: 'h6manual' }
    ],
    sources: {
      h6manual: { t: 'Haval H6 2025 owner\'s manual, "Battery safety switch" and "Emergency cut-off point"', u: 'https://www.manualslib.com/manual/3965805/Haval-H6-2025.html?page=108' },
      h6dht: { t: 'Haval H6 HEV launch details (1.5 turbo, 2-speed DHT)', u: 'https://dealerfloor.co.za/product-news/haval-h6-hev' },
      h6za: { t: 'GWM South Africa, Haval H6 brochure (179 kW, 530 Nm, DHT, lithium-ion battery)', u: 'https://www.gwm.co.za/content/dam/gwm/pages/za/en/models/haval-h6/h6-facelift-bochure.pdf' },
      h6th: { t: 'Haval H6 2025 catalogue (lithium-ion battery 1.67 kWh)', u: 'https://autocatalogarchive.com/wp-content/uploads/2025/04/Haval-H6-2025-TH.pdf' },
      course: { t: 'This course: typical layout for this type of vehicle (not model-specific)', u: '' }
    }
  };

  /* =====================================================================
     JAECOO J7 PHEV  (plug-in hybrid, "SHS")
     ===================================================================== */
  V.j7phev = {
    name: 'Jaecoo J7 PHEV (SHS)', short: 'Jaecoo J7 PHEV', kind: 'PHEV',
    blurb: 'A plug-in hybrid. It has a petrol engine and a hybrid gearbox like the Haval, plus a much larger battery under the cabin floor that you charge from a socket. It can drive a long way on electricity alone.',
    view: { w: 400, h: 640, outline: 'car' },
    legend: { hv: 'High voltage DC', ac: 'AC', lv: '12 V', sig: 'Data (CAN)', mech: 'Turning shaft', fuel: 'Petrol', cool: 'Coolant' },
    facts: [
      { l: 'High-voltage battery', v: '339.2 V, lithium iron phosphate (LFP)', conf: 'ok', src: 'j7rescue' },
      { l: 'Battery size and place', v: '18.3 kWh, under the passenger floor', conf: 'ok', src: 'j7spec' },
      { l: 'Engine', v: '1.5 litre turbo petrol, 105 kW and 215 Nm', conf: 'ok', src: 'j7drive' },
      { l: 'Drive motor', v: '150 kW and 310 Nm, single-speed hybrid gearbox, front-wheel drive', conf: 'ok', src: 'j7drive' },
      { l: 'Hybrid modes', v: 'Electric, series, and parallel', conf: 'ok', src: 'j7modes' },
      { l: '12 V battery', v: 'In the boot, under the floor', conf: 'ok', src: 'j7rescue' },
      { l: 'Fuel tank', v: '60 litres', conf: 'ok', src: 'j7rescue' },
      { l: 'A/C refrigerant', v: 'R1234yf, 0.575 kg', conf: 'ok', src: 'j7rescue' },
      { l: 'DC fast charging', v: 'Fitted in some markets. Not confirmed for the Pakistan car.', conf: 'verify', src: 'course' },
      { l: 'Workshop isolation device', v: 'Not confirmed. The rescue sheet shows a high-voltage battery connector to disconnect.', conf: 'verify', src: 'j7rescue' }
    ],
    parts: {
      radiator: Object.assign({}, RAD, { s: 'Radiators', x: 110, y: 24, w: 180, h: 18, where: 'Behind the front grille.', conf: 'verify', src: 'course' }),
      engine: Object.assign({}, ENGINE, { s: 'Petrol\nengine', x: 82, y: 50, w: 80, h: 62, where: 'Under the bonnet.', conf: 'ok', src: 'j7manual' }),
      gen: Object.assign({}, GEN, { s: 'Gener-\nator', x: 168, y: 50, w: 48, h: 62, where: 'Inside the hybrid gearbox housing.', conf: 'verify', src: 'j7modes' }),
      gear: Object.assign({}, DHT, { s: 'Gears\n+ clutch', x: 222, y: 50, w: 44, h: 62, where: 'Bolted to the end of the engine, under the bonnet.', conf: 'ok', src: 'j7drive' }),
      motor: Object.assign({}, TMOTOR, { s: 'Drive\nmotor', x: 272, y: 50, w: 46, h: 62, where: 'Inside the hybrid gearbox housing, at the front of the car.', conf: 'ok', src: 'j7manual' }),
      compressor: { base: 'compressor', k: 'hv', n: 'Electric A/C compressor', s: 'A/C comp.', x: 82, y: 122, w: 80, h: 32, where: 'Under the bonnet. The handbook lists it as "Electric Compressor".', conf: 'ok', src: 'j7manual' },
      pcu: Object.assign({}, PCU, { n: 'Motor controller (inverters)', s: 'Motor controller', x: 168, y: 122, w: 150, h: 32, where: 'Under the bonnet. The handbook calls it the "Front Motor Controller".', conf: 'ok', src: 'j7manual' }),
      cut: Object.assign({}, CUT, { s: 'Fuse box\n+ cut loop', x: 82, y: 164, w: 66, h: 30, where: 'Under the bonnet. The rescue sheet shows a labelled wiring loop to cut here.', conf: 'ok', src: 'j7rescue' }),
      dcdc: { base: 'dcdc', k: 'hv', n: 'DC-DC converter', s: 'DC-DC', x: 154, y: 164, w: 50, h: 30, where: 'Under the bonnet; often in one box with the on-board charger.', conf: 'verify', src: 'course' },
      hcu: Object.assign({}, HCU, { s: 'HCU', x: 210, y: 164, w: 44, h: 30, where: 'A control unit on the 12 V system; exact place not confirmed.', conf: 'verify', src: 'course' }),
      obc: { base: 'obc', k: 'hv', n: 'On-board charger (OBC)', s: 'Charger', x: 260, y: 164, w: 58, h: 30, where: 'Under the bonnet; often in one box with the DC-DC converter.', conf: 'verify', src: 'course' },
      battery: { base: 'battery', k: 'hv', n: 'High-voltage battery', s: 'HV battery\n339 V · 18.3 kWh', x: 100, y: 235, w: 200, h: 150, where: 'Under the cabin floor, between the axles. Seen from under the car as a large flat metal case.', conf: 'ok', src: 'j7spec' },
      bms: { base: 'bms', k: 'lv', n: 'Battery management system (BMS)', s: 'BMS', x: 236, y: 243, w: 56, h: 26, inside: 'battery', where: 'Inside the battery case.', conf: 'verify', src: 'course' },
      tank: Object.assign({}, TANK, { s: 'Fuel tank 60 L', x: 100, y: 400, w: 110, h: 45, where: 'Behind the battery, under the rear seat area.', conf: 'verify', src: 'j7rescue' }),
      port: { base: 'port', k: 'hv', n: 'Charge port', s: 'Port', x: 292, y: 490, w: 34, h: 34, where: 'On a rear wing, on the opposite side to the fuel filler (side to be confirmed on the Pakistan car).', conf: 'verify', src: 'j7manual' },
      aux12: { base: 'aux12', k: 'lv', n: '12 V battery', s: '12 V battery', x: 150, y: 545, w: 100, h: 36, where: 'In the boot. Open the tailgate and lift out the boot floor.', conf: 'ok', src: 'j7rescue' }
    },
    links: {
      eg: { t: 'mech', a: 'engine', b: 'gen', p: [[150, 81], [180, 81]] },
      gc: { t: 'mech', a: 'gen', b: 'gear', p: [[205, 81], [232, 81]] },
      mg: { t: 'mech', a: 'motor', b: 'gear', p: [[285, 81], [255, 81]] },
      dr: { t: 'mech', a: 'gear', b: 'wheels', p: [[[244, 112], [244, 117]], [[244, 117], [70, 117]], [[244, 117], [330, 117]]] },
      genac: { t: 'ac', a: 'gen', b: 'pcu', p: [[192, 112], [192, 122]] },
      motac: { t: 'ac', a: 'pcu', b: 'motor', p: [[295, 122], [295, 112]] },
      hvmain: { t: 'hv', a: 'battery', b: 'pcu', p: [[207, 235], [207, 154]] },
      hvdcdc: { t: 'hv', a: 'pcu', b: 'dcdc', p: [[180, 154], [180, 164]] },
      hvcomp: { t: 'hv', a: 'pcu', b: 'compressor', p: [[172, 138], [158, 138]] },
      hvobc: { t: 'hv', a: 'obc', b: 'battery', p: [[275, 194], [275, 235]] },
      acport: { t: 'ac', a: 'port', b: 'obc', p: [[309, 490], [309, 194]] },
      dcport: { t: 'hv', a: 'port', b: 'battery', p: [[296, 507], [285, 507], [285, 385]], conf: 'verify' },
      lvmain: { t: 'lv', a: 'aux12', b: 'cut', p: [[150, 563], [90, 563], [90, 206], [110, 206], [110, 194]] },
      lvdcdc: { t: 'lv', a: 'dcdc', b: 'aux12', p: [[172, 194], [172, 206], [110, 206]], tap: true },
      can: { t: 'sig', a: 'hcu', b: 'bms', p: [[232, 194], [232, 222], [262, 222], [262, 243]] },
      fuel: { t: 'fuel', a: 'tank', b: 'engine', p: [[105, 422], [77, 422], [77, 81], [84, 81]] },
      cool1: { t: 'cool', a: 'radiator', b: 'engine', p: [[120, 42], [120, 50]] },
      cool2: { t: 'cool', a: 'radiator', b: 'pcu', p: [[286, 42], [286, 46], [324, 46], [324, 138], [316, 138]] }
    },
    always: ['aux12', 'cut', 'battery'],
    modes: [
      { id: 'off', name: 'Off', cls: 'off',
        note: 'Contactors open. High voltage stays inside the battery case. Only the 12 V system is awake.',
        live: [], flows: [] },
      { id: 'ev', name: 'Electric drive', cls: 'drive',
        note: 'With charge in the battery the car drives like an EV. The engine is stopped, but it can start by itself when the battery runs low or you press hard.',
        live: ['pcu', 'motor', 'gear', 'dcdc', 'hcu', 'bms'],
        flows: [['hvmain', 1], ['motac', 1], ['mg', 1], ['dr', 1], ['hvdcdc', 1], ['lvdcdc', 1], ['can', 1]] },
      { id: 'series', name: 'Engine makes electricity', cls: 'ready',
        note: 'Series mode. The clutch is open. The engine turns the generator; that electricity drives the motor, and any extra goes into the battery.',
        live: ['engine', 'gen', 'pcu', 'motor', 'gear', 'dcdc', 'hcu', 'bms', 'tank', 'radiator'],
        flows: [['fuel', 1], ['eg', 1], ['genac', 1], ['motac', 1], ['mg', 1], ['dr', 1], ['hvmain', -1], ['hvdcdc', 1], ['lvdcdc', 1], ['can', 1], ['cool1', 1], ['cool2', 1]] },
      { id: 'parallel', name: 'Engine drives wheels', cls: 'drive',
        note: 'Parallel mode, at higher speed. The clutch closes so the engine drives the wheels. The motor adds help from the battery when you ask for more power.',
        live: ['engine', 'gen', 'pcu', 'motor', 'gear', 'dcdc', 'hcu', 'bms', 'tank', 'radiator'],
        flows: [['fuel', 1], ['eg', 1], ['gc', 1], ['dr', 1], ['hvmain', 1], ['motac', 1], ['mg', 1], ['hvdcdc', 1], ['lvdcdc', 1], ['can', 1], ['cool1', 1], ['cool2', 1]] },
      { id: 'regen', name: 'Braking', cls: 'regen',
        note: 'Regenerative braking. The wheels turn the motor, which works as a generator and sends energy back into the battery.',
        live: ['pcu', 'motor', 'gear', 'dcdc', 'hcu', 'bms'],
        flows: [['dr', -1], ['mg', -1], ['motac', -1], ['hvmain', -1], ['hvdcdc', 1], ['lvdcdc', 1], ['can', 1]] },
      { id: 'ac', name: 'AC charge', cls: 'charge',
        note: 'Mains AC comes in at the port. The on-board charger turns it into DC for the battery. The car cannot drive while plugged in.',
        live: ['port', 'obc', 'dcdc', 'pcu', 'hcu', 'bms'],
        flows: [['acport', 1], ['hvobc', 1], ['hvmain', 1], ['hvdcdc', 1], ['lvdcdc', 1], ['can', 1]] },
      { id: 'dc', name: 'DC charge', cls: 'charge', conf: 'verify',
        note: 'Where fitted: the charging station sends DC straight to the battery, and the on-board charger is not used. Not confirmed for the Pakistan car.',
        live: ['port', 'dcdc', 'pcu', 'hcu', 'bms'],
        flows: [['dcport', 1], ['hvmain', 1], ['hvdcdc', 1], ['lvdcdc', 1], ['can', 1]] }
    ],
    safe: {
      note: 'Practice the order only. The exact workshop isolation step for this car is not confirmed: follow the Jaecoo service manual, under supervision.',
      steps: carSafe({ t: 'Disconnect the high-voltage battery at the point the service manual names, wearing gloves. Tag it and lock the area.',
        why: 'This breaks the high-voltage circuit. The cells inside the battery stay live.' }, 'verify', { engine: true, plug: true })
    },
    rescue: [
      { v: 'High-voltage battery: 339.2 V lithium iron phosphate.', src: 'j7rescue' },
      { v: 'After a crash that fires the airbags, the high-voltage system shuts down automatically.', src: 'j7rescue' },
      { v: 'Rescue crews, main method: open the bonnet, cut the labelled wire harness, then disconnect the high-voltage battery and the 12 V negative terminal.', src: 'j7rescue' },
      { v: 'Rescue crews, other method: cut the labelled wire harness inside the cabin, then disconnect the high-voltage battery.', src: 'j7rescue' },
      { v: '12 V battery: open the boot and remove the boot floor.', src: 'j7rescue' },
      { v: 'Fire: use large amounts of water; the battery can re-ignite later.', src: 'j7rescue' }
    ],
    sources: {
      j7rescue: { t: 'Euro NCAP rescue sheet, Jaecoo 7 PHEV (official maker rescue sheet)', u: 'https://euroncaprescuesheets.blob.core.windows.net/rescuesheets/JAECOO/JAECOO_7_PHEV_SUV_2024_5d_Hybrid_EN.pdf' },
      j7spec: { t: 'Omoda Jaecoo Australia, J7 PHEV specification sheet', u: 'https://www.omodajaecoo.com.au/sites/default/files/2025-03/153_24_Jaecoo_J7_Spec_Sheet_AU_PHEV_v11.pdf' },
      j7manual: { t: 'Jaecoo 7 PHEV owner\'s manual (parts named in the engine-bay overview)', u: 'https://omoda-jaecco-strapi-aws-s3-images-bucket.s3.eu-west-2.amazonaws.com/JAECOO_7_PHEV_user_manual_58c713d8c3_715467f0d6.pdf' },
      j7drive: { t: 'Driven Car Guide, Jaecoo J7 SHS first drive (engine, motor, gearbox figures)', u: 'https://www.drivencarguide.co.nz/reviews/jaecoo-j7-shs-phev-first-drive-super-charger/' },
      j7modes: { t: 'Jaecoo South Africa, "Hybrid 101" (electric, series and parallel modes)', u: 'https://www.jaecoo.co.za/news/hybrid-101-the-secrets-behind-omoda-jaecoo-shs-tech' },
      course: { t: 'This course: typical layout for this type of vehicle (not model-specific)', u: '' }
    }
  };

  /* =====================================================================
     JAECOO J5 EV  (battery electric)
     ===================================================================== */
  V.j5ev = {
    name: 'Jaecoo J5 EV', short: 'Jaecoo J5 EV', kind: 'BEV',
    blurb: 'A battery electric car. No engine and no fuel. One motor at the front drives the front wheels, fed by a large battery under the floor.',
    view: { w: 400, h: 640, outline: 'car' },
    legend: { hv: 'High voltage DC', ac: 'AC', lv: '12 V', sig: 'Data (CAN)', mech: 'Turning shaft', cool: 'Coolant' },
    facts: [
      { l: 'Motor', v: 'One front motor, 155 kW, front-wheel drive', conf: 'ok', src: 'j5au' },
      { l: 'Battery', v: 'LFP, about 59 to 61 kWh depending on market', conf: 'ok', src: 'j5evdb' },
      { l: 'System voltage', v: '400 V class', conf: 'ok', src: 'j5evdb' },
      { l: 'Charge port', v: 'CCS2 (Type 2 for AC), at the front on the driver\'s side', conf: 'ok', src: 'j5au' },
      { l: 'Pakistan car', v: 'Locally assembled; battery size and charger rating for Pakistan not confirmed', conf: 'verify', src: 'j5pk' },
      { l: 'Workshop isolation device', v: 'Not confirmed. No official rescue sheet found yet for this model.', conf: 'verify', src: 'course' }
    ],
    parts: {
      radiator: { base: 'radiator', k: 'cool', n: 'Radiator and chiller', s: 'Radiator', x: 110, y: 24, w: 180, h: 18, where: 'Behind the front bumper.', conf: 'verify', src: 'course' },
      inverter: { base: 'inverter', k: 'hv', n: 'Inverter (motor controller)', s: 'Inverter', x: 82, y: 50, w: 80, h: 34, where: 'Under the bonnet, on top of the motor.', conf: 'verify', src: 'course' },
      pdu: { base: 'junction', k: 'hv', n: 'HV junction box (PDU)', s: 'Junction', x: 168, y: 50, w: 54, h: 34, where: 'Under the bonnet. Several orange cables meet here.', conf: 'verify', src: 'course' },
      compressor: { base: 'compressor', k: 'hv', n: 'Electric A/C compressor', s: 'A/C', x: 228, y: 50, w: 44, h: 34, where: 'Under the bonnet, low down.', conf: 'verify', src: 'course' },
      heater: { base: 'heater', k: 'hv', n: 'PTC heater', s: 'Heat', x: 278, y: 50, w: 40, h: 34, where: 'Under the bonnet or behind the dashboard.', conf: 'verify', src: 'course' },
      motor: { base: 'motor', k: 'hv', n: 'Traction motor', s: 'Motor', x: 82, y: 92, w: 56, h: 40, where: 'Under the bonnet, between the front wheels.', conf: 'ok', src: 'j5au' },
      gear: { base: 'gearbox', k: 'mech', n: 'Reduction gear and differential', s: 'Gear', x: 142, y: 92, w: 44, h: 40, where: 'Bolted to the motor.', conf: 'verify', src: 'course' },
      obc: { base: 'obc', k: 'hv', n: 'On-board charger (OBC)', s: 'Charger', x: 196, y: 92, w: 60, h: 40, where: 'Under the bonnet.', conf: 'verify', src: 'course' },
      port: { base: 'port', k: 'hv', n: 'Charge port (CCS2)', s: 'Port', x: 286, y: 96, w: 34, h: 36, where: 'Front wing on the driver\'s side (the right side on a right-hand-drive car).', conf: 'ok', src: 'j5au' },
      aux12: { base: 'aux12', k: 'lv', n: '12 V battery', s: '12 V', x: 82, y: 146, w: 60, h: 30, where: 'Under the bonnet.', conf: 'verify', src: 'course' },
      dcdc: { base: 'dcdc', k: 'hv', n: 'DC-DC converter', s: 'DC-DC', x: 148, y: 146, w: 50, h: 30, where: 'Under the bonnet, often in one box with the charger.', conf: 'verify', src: 'course' },
      vcu: { base: 'vcu', k: 'lv', n: 'Vehicle control unit (VCU)', s: 'VCU', x: 204, y: 146, w: 46, h: 30, where: 'A control unit on the 12 V system; exact place not confirmed.', conf: 'verify', src: 'course' },
      battery: { base: 'battery', k: 'hv', n: 'High-voltage battery', s: 'HV battery\nabout 60 kWh', x: 95, y: 235, w: 210, h: 200, where: 'Under the cabin floor, between the axles.', conf: 'ok', src: 'j5evdb' },
      bms: { base: 'bms', k: 'lv', n: 'Battery management system (BMS)', s: 'BMS', x: 240, y: 243, w: 56, h: 26, inside: 'battery', where: 'Inside the battery case.', conf: 'verify', src: 'course' }
    },
    links: {
      hvmain: { t: 'hv', a: 'battery', b: 'pdu', p: [[201, 235], [201, 141], [191, 141], [191, 88], [180, 88], [180, 84]] },
      hvinv: { t: 'hv', a: 'pdu', b: 'inverter', p: [[172, 67], [158, 67]] },
      hvcomp: { t: 'hv', a: 'pdu', b: 'compressor', p: [[218, 67], [232, 67]] },
      hvheat: { t: 'hv', a: 'pdu', b: 'heater', p: [[190, 50], [190, 46], [298, 46], [298, 50]] },
      hvobc: { t: 'hv', a: 'obc', b: 'pdu', p: [[205, 92], [205, 84]] },
      hvdcdc: { t: 'hv', a: 'pdu', b: 'dcdc', p: [[191, 141], [173, 141], [173, 146]], tap: true },
      motac: { t: 'ac', a: 'inverter', b: 'motor', p: [[110, 84], [110, 92]] },
      mg: { t: 'mech', a: 'motor', b: 'gear', p: [[130, 112], [150, 112]] },
      dr: { t: 'mech', a: 'gear', b: 'wheels', p: [[[164, 132], [164, 136]], [[164, 136], [70, 136]], [[164, 136], [330, 136]]] },
      acport: { t: 'ac', a: 'port', b: 'obc', p: [[290, 114], [252, 114]] },
      dcport: { t: 'hv', a: 'port', b: 'pdu', p: [[303, 96], [303, 88], [218, 88], [218, 84]] },
      lvdcdc: { t: 'lv', a: 'dcdc', b: 'aux12', p: [[152, 161], [138, 161]] },
      can: { t: 'sig', a: 'vcu', b: 'bms', p: [[227, 176], [227, 205], [268, 205], [268, 243]] },
      cool1: { t: 'cool', a: 'radiator', b: 'inverter', p: [[120, 42], [120, 50]] }
    },
    always: ['aux12', 'battery'],
    modes: [
      { id: 'off', name: 'Off', cls: 'off',
        note: 'Contactors open. High voltage stays inside the battery case.',
        live: [], flows: [] },
      { id: 'drive', name: 'Driving', cls: 'drive',
        note: 'READY and moving. The battery feeds the inverter, which drives the motor. The DC-DC converter keeps the 12 V battery charged.',
        live: ['pdu', 'inverter', 'motor', 'gear', 'dcdc', 'vcu', 'bms', 'compressor', 'heater', 'radiator'],
        flows: [['hvmain', 1], ['hvinv', 1], ['motac', 1], ['mg', 1], ['dr', 1], ['hvdcdc', 1], ['lvdcdc', 1], ['hvcomp', 1], ['can', 1], ['cool1', 1]] },
      { id: 'regen', name: 'Braking', cls: 'regen',
        note: 'Regenerative braking. The wheels turn the motor, which works as a generator and sends energy back into the battery.',
        live: ['pdu', 'inverter', 'motor', 'gear', 'dcdc', 'vcu', 'bms', 'compressor', 'heater'],
        flows: [['dr', -1], ['mg', -1], ['motac', -1], ['hvinv', -1], ['hvmain', -1], ['hvdcdc', 1], ['lvdcdc', 1], ['can', 1]] },
      { id: 'ac', name: 'AC charge', cls: 'charge',
        note: 'Mains AC comes in at the port. The on-board charger turns it into DC, which goes through the junction box into the battery.',
        live: ['port', 'obc', 'pdu', 'dcdc', 'vcu', 'bms', 'inverter', 'compressor', 'heater'],
        flows: [['acport', 1], ['hvobc', 1], ['hvmain', -1], ['hvdcdc', 1], ['lvdcdc', 1], ['can', 1]] },
      { id: 'dc', name: 'DC fast charge', cls: 'charge',
        note: 'The station sends DC straight in through the two large pins. It goes through the junction box into the battery. The on-board charger is not used.',
        live: ['port', 'pdu', 'dcdc', 'vcu', 'bms', 'inverter', 'compressor', 'heater', 'radiator'],
        flows: [['dcport', 1], ['hvmain', -1], ['hvdcdc', 1], ['lvdcdc', 1], ['hvcomp', 1], ['can', 1]] }
    ],
    safe: {
      note: 'Practice the order only. The exact workshop isolation step for this car is not confirmed: follow the Jaecoo service manual, under supervision.',
      steps: carSafe({ t: 'Remove or disconnect the service disconnect the manual names, wearing gloves. Keep it with you and lock the area.',
        why: 'This breaks the high-voltage circuit. The cells inside the battery stay live.' }, 'verify', { plug: true })
    },
    rescue: [],
    sources: {
      j5au: { t: 'Omoda Jaecoo Australia, Jaecoo J5 EV (155 kW, CCS2, port at front driver\'s side)', u: 'https://www.omodajaecoo.com.au/models/jaecoo-j5-bev' },
      j5evdb: { t: 'EV Database, Jaecoo 5 EV (400 V architecture, LFP, battery size)', u: 'https://ev-database.org/car/3336/Jaecoo-5-EV' },
      j5pk: { t: 'The Nation, Jaecoo J5 BEV launch in Pakistan, 6 November 2026', u: 'https://www.nation.com.pk/06-Nov-2026/pakistan-s-first-locally-assembled-electric-suv' },
      course: { t: 'This course: typical layout for this type of vehicle (not model-specific)', u: '' }
    }
  };

  /* =====================================================================
     GENERIC ELECTRIC BIKE / SCOOTER  (side view)
     Follows Module 20 of the course. Not one brand: it is the layout shared
     by the common scooters sold in Pakistan.
     ===================================================================== */
  V.ebike = {
    name: 'Electric bike (generic scooter)', short: 'Electric bike', kind: 'Bike',
    blurb: 'The layout shared by most electric scooters and motorcycles sold in Pakistan: battery, controller and a motor built into the rear wheel. Every idea is the same as in a car, only smaller.',
    view: { w: 400, h: 400, outline: 'bike' },
    legend: { hv: 'Battery DC (48 to 72 V)', ac: 'Three motor phase wires', lv: '12 V', sig: 'Signal wires' },
    facts: [
      { l: 'On sale in Pakistan', v: 'Yadea, Evee, Metro, Jolta and Vlektra, among others', conf: 'ok', src: 'pkbrands' },
      { l: 'Typical motor', v: '1,000 to 2,000 W hub motor', conf: 'ok', src: 'pkprices' },
      { l: 'Typical battery', v: '72 V, 26 to 30 Ah on the popular scooters; lead-acid ("graphene") or lithium', conf: 'ok', src: 'pkscoot' },
      { l: 'Example', v: 'Yadea T5: 72 V 26 Ah graphene, about 55 km/h, 5 to 6 hours to charge', conf: 'ok', src: 'pkscoot' },
      { l: 'Real voltage', v: 'A "72 V" pack reaches 84 to 88 V when full. That is above the 60 V high-voltage limit.', conf: 'ok', src: 'm20' },
      { l: 'This drawing', v: 'A generic layout. Part positions differ between brands.', conf: 'verify', src: 'm20' }
    ],
    parts: {
      throttle: { k: 'lv', n: 'Throttle', s: 'Throttle', x: 222, y: 34, w: 74, h: 26,
        job: 'The twist grip. A Hall sensor inside sends the controller a voltage that rises as you twist: about 0.8 V closed to 4.2 V fully open, on a 5 V supply.',
        safety: 'A throttle stuck high makes the bike drive off as soon as it is switched on. Lift the rear wheel off the ground before testing.',
        where: 'Right-hand grip on the handlebar. Three thin wires: 5 V, earth and signal.', conf: 'ok', src: 'm20' },
      brake: { k: 'lv', n: 'Brake switches', s: 'Brake switches', x: 304, y: 34, w: 86, h: 26,
        job: 'A small switch on each brake lever. When you pull a lever it tells the controller to cut motor power at once, and it lights the brake lamp.',
        safety: 'A brake switch stuck "on" is the most common reason for "display on but no drive". Unplug it to test.',
        where: 'Inside each brake lever housing on the handlebar.', conf: 'ok', src: 'm20' },
      display: { k: 'lv', n: 'Display', s: 'Display', x: 240, y: 84, w: 60, h: 26,
        job: 'Shows speed and battery level. The battery gauge is only a voltage reading, so it drops when you accelerate and rises again when you stop.',
        safety: 'Do not trust the gauge alone: measure the battery with a meter.',
        where: 'Centre of the handlebar.', conf: 'ok', src: 'm20' },
      key: { k: 'lv', n: 'Key switch', s: 'Key switch', x: 312, y: 84, w: 76, h: 26,
        job: 'Sends a thin "ignition" wire at battery voltage to wake the controller and the DC-DC converter. The thick battery cables stay connected whatever the key does.',
        safety: 'Key off does NOT make the bike safe to work on: the battery cables to the controller are still live. Switch off the breaker or unplug the battery.',
        where: 'On the steering column or front panel.', conf: 'ok', src: 'm20' },
      controller: { k: 'hv', n: 'Controller', s: 'Controller', x: 150, y: 150, w: 84, h: 34,
        job: 'A small inverter. It turns battery DC into three-phase AC for the hub motor and reads the throttle, the brake switches and the motor\'s Hall sensors. It has a low-voltage cut-off to protect the battery.',
        safety: 'Its capacitors hold charge after the battery is disconnected. Wait a minute and check with a meter. A shorted controller makes the wheel hard to turn by hand.',
        where: 'Under the seat or under the floorboard. A finned aluminium box with many wires.', conf: 'ok', src: 'm20' },
      dcdc: { k: 'hv', n: 'DC-DC converter', s: 'DC-DC', x: 250, y: 150, w: 62, h: 30,
        job: 'Steps the battery voltage down to 12 V for the lights, horn and indicators.',
        safety: 'If the bike drives but has no lights or horn, check this converter and its fuse first.',
        where: 'A small sealed block near the controller or behind the front panel.', conf: 'ok', src: 'm20' },
      lights: { k: 'lv', n: 'Lights, horn and indicators', s: 'Lights\nhorn', x: 330, y: 146, w: 60, h: 38,
        job: 'Everything that runs on 12 V. Fed by the DC-DC converter, not straight from the battery.',
        safety: 'Never connect a 12 V lamp straight to the main battery: it will burn out at once.',
        where: 'Front, rear and handlebar.', conf: 'ok', src: 'm20' },
      battery: { k: 'hv', n: 'Battery', s: 'Battery\n60 or 72 V', x: 150, y: 200, w: 110, h: 66,
        job: 'Stores the energy. Lead-acid ("graphene") packs are five or six 12 V blocks joined in series. Lithium packs are one sealed case with a BMS inside.',
        safety: 'It can push hundreds of amps into a short circuit: a spanner across the terminals turns red-hot instantly. Remove rings and watches. Burns and fires are far more common than shocks.',
        where: 'Under the seat or under the floorboard.', conf: 'ok', src: 'm20' },
      bms: { k: 'lv', n: 'BMS (lithium packs only)', s: 'BMS', x: 206, y: 242, w: 48, h: 20, inside: 'battery',
        job: 'Inside every lithium pack. It watches each cell and cuts the pack off if a cell goes too low, too high or too hot. Lead-acid packs have no BMS.',
        safety: 'A lithium bike that is "completely dead" may simply have a BMS that has cut off because one cell is very low.',
        where: 'Sealed inside the lithium battery case.', conf: 'ok', src: 'm20' },
      breaker: { k: 'hv', n: 'Breaker or main fuse', s: 'Breaker', x: 276, y: 215, w: 60, h: 30,
        job: 'A switch-type circuit breaker or a large fuse in the main battery cable. It protects the wiring from a short circuit and gives you a way to switch the battery off.',
        safety: 'Switch this off (or unplug the battery connector) before any work. This is your isolation point.',
        where: 'Close to the battery, often under the seat.', conf: 'ok', src: 'm20' },
      port: { k: 'hv', n: 'Charge port', s: 'Charge port', x: 196, y: 275, w: 74, h: 24,
        job: 'Where the charger plugs in. It connects to the battery, usually through a small fuse.',
        safety: 'If the bike will not charge, measure the charger output, then check this port and its fuse.',
        where: 'On the side panel or under the seat.', conf: 'ok', src: 'm20' },
      charger: { k: 'hv', n: 'Charger (separate unit)', s: 'Charger\n(plugs into wall)', x: 190, y: 335, w: 96, h: 36,
        job: 'A separate box that turns mains AC into DC for the battery. It must match the battery\'s voltage and its chemistry.',
        safety: 'Never use a lead-acid charger on a lithium pack. Most e-bike fires start while charging: charge in an open place, never overnight unattended, and never charge a swollen or wet battery.',
        where: 'Not on the bike. The owner carries it or keeps it at home.', conf: 'ok', src: 'm20' },
      motor: { k: 'hv', n: 'Hub motor', s: 'Hub\nmotor', x: 58, y: 278, w: 64, h: 44,
        job: 'A brushless (BLDC) motor of 1 to 3 kW built into the rear wheel. Three thick phase wires carry the power. Five thin wires go to the Hall sensors that tell the controller where the rotor is.',
        safety: 'Water is its great enemy: riding through monsoon floods fills it. A jerky or noisy motor often means one failed Hall sensor or a burnt phase connector.',
        where: 'Inside the rear wheel. The cable comes out through the axle.', conf: 'ok', src: 'm20' },
      stand: { k: 'lv', n: 'Side-stand switch', s: 'Stand switch', x: 100, y: 330, w: 84, h: 24,
        job: 'Stops the bike driving while the side stand is down.',
        safety: 'A faulty stand switch gives "display on but no drive". Check it together with the brake switches.',
        where: 'On the side-stand pivot, under the bike. Not fitted to every model.', conf: 'verify', src: 'm20' }
    },
    links: {
      main: { t: 'hv', a: 'battery', b: 'breaker', p: [[254, 230], [280, 230]] },
      toctrl: { t: 'hv', a: 'breaker', b: 'controller', p: [[288, 215], [288, 196], [215, 196], [215, 184]] },
      todcdc: { t: 'hv', a: 'breaker', b: 'dcdc', p: [[304, 215], [304, 180]] },
      phase: { t: 'ac', a: 'controller', b: 'motor', p: [[154, 160], [100, 160], [100, 278]] },
      lv12: { t: 'lv', a: 'dcdc', b: 'lights', p: [[308, 165], [334, 165]] },
      thr: { t: 'sig', a: 'throttle', b: 'controller', p: [[226, 47], [175, 47], [175, 150]] },
      brk: { t: 'sig', a: 'brake', b: 'controller', p: [[320, 60], [320, 72], [195, 72], [195, 150]] },
      dsp: { t: 'sig', a: 'controller', b: 'display', p: [[207, 150], [207, 122], [262, 122], [262, 110]] },
      ign: { t: 'sig', a: 'key', b: 'controller', p: [[350, 110], [350, 134], [225, 134], [225, 150]] },
      stn: { t: 'sig', a: 'stand', b: 'controller', p: [[142, 330], [142, 176], [154, 176]] },
      chg: { t: 'hv', a: 'port', b: 'battery', p: [[233, 275], [233, 264]] },
      wall: { t: 'hv', a: 'charger', b: 'port', p: [[233, 335], [233, 299]] }
    },
    always: ['battery', 'bms'],
    modes: [
      { id: 'off', name: 'Key off', cls: 'off',
        note: 'Key off. The controller is asleep, but the battery and its main cables are still live up to the breaker and the controller.',
        live: [], flows: [] },
      { id: 'ride', name: 'Riding', cls: 'drive',
        note: 'Key on and throttle twisted. The battery feeds the controller, which drives the hub motor. The DC-DC converter feeds the 12 V lights.',
        live: ['breaker', 'controller', 'motor', 'dcdc', 'lights', 'throttle', 'key', 'display'],
        flows: [['main', 1], ['toctrl', 1], ['phase', 1], ['todcdc', 1], ['lv12', 1], ['thr', 1], ['ign', 1], ['dsp', 1]] },
      { id: 'brake', name: 'Brake pulled', cls: 'regen',
        note: 'A brake lever is pulled. The switch tells the controller to cut motor power at once. The brake lamp lights. (Some models also brake with the motor.)',
        live: ['breaker', 'controller', 'dcdc', 'lights', 'brake', 'key', 'display'],
        flows: [['main', 1], ['toctrl', 1], ['todcdc', 1], ['lv12', 1], ['brk', 1], ['ign', 1], ['dsp', 1]] },
      { id: 'charge', name: 'Charging', cls: 'charge',
        note: 'Key off, charger plugged in. DC flows from the charger through the port into the battery. On a lithium pack the BMS can stop the charge.',
        live: ['charger', 'port'],
        flows: [['wall', 1], ['chg', 1]] }
    ],
    safe: {
      note: 'Practice the order only. Small does not mean safe: these batteries cause burns and fires.',
      steps: [
        { t: 'Put the bike on its centre stand on a dry floor. Unplug the charger.', why: 'The bike must not move, and it must not be charging.' },
        { t: 'Switch off and take out the key.', why: 'This puts the controller to sleep, but the battery cables are still live.' },
        { t: 'Take off rings, watch and bracelet. Put on safety glasses.', why: 'Metal across the battery terminals turns red-hot instantly.' },
        { t: 'Switch off the breaker, or unplug the main battery connector.', why: 'This is the isolation point. It disconnects the battery from the controller.' },
        { t: 'Wait about a minute.', why: 'The capacitors in the controller need time to drain.' },
        { t: 'Prove dead: test your meter on a known voltage, measure across the controller\'s battery terminals, then test the meter again.', why: 'A broken meter reads 0 V on a live circuit. Prove, test, prove.' },
        { t: 'Cover the battery terminals or connector with insulating caps or tape.', why: 'The battery itself is always live. Covering it stops a dropped tool causing a short circuit.' }
      ]
    },
    rescue: [],
    sources: {
      m20: { t: 'This course, Module 20: Electric bikes and rickshaws', u: '' },
      pkbrands: { t: 'Electric Bikes in Pakistan, brand comparison 2026', u: 'https://electricbikesinpakistan.com.pk/electric-bike-brands-in-pakistan/' },
      pkprices: { t: 'Electric Bikes in Pakistan, model and price list 2026 (motor ratings)', u: 'https://electricbikesinpakistan.com.pk/electric-bike-prices-in-pakistan/' },
      pkscoot: { t: 'Kepto, top EV scooters in Pakistan 2026 (Yadea T5 figures)', u: 'https://www.kepto.co/blog/electric-scooters-vs-70cc-petrol-bikes-cost-comparison-pakistan-2026' }
    }
  };

  window.EV_VEHICLES = V;
  if (typeof module !== 'undefined') module.exports = V;   // lets the test script read this file
})();
