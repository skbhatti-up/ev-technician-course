window.CAR_PARTS = {
  battery: {
    name: "High-voltage battery",
    urdu: "بیٹری",
    job: "Stores the energy that drives the car. It gives DC power, usually 300–800 V, to the rest of the high-voltage system.",
    inside: "Hundreds of cells joined in series and parallel, often in modules, inside a sealed metal case. The case also holds the BMS, contactors, fuses, sensors and a cooling plate.",
    safety: "The inside of the pack is always live: the contactors and service plug cannot switch off the cells themselves.",
    modules: [7, 6, 8, 5],
    live: "Always live inside; it sends voltage out to the car only when the contactors are closed, in READY or while charging."
  },
  bms: {
    name: "Battery management system (BMS)",
    urdu: "",
    job: "The battery's brain. It watches every cell, works out the state of charge and health, and protects the pack.",
    inside: "A master controller plus small boards on the modules that measure each cell's voltage and temperature. It controls the contactors, balances the cells, checks insulation and talks to other computers over CAN bus.",
    safety: "On a scan tool, look at the gap between the highest and lowest cell voltage: a large spread points to a weak cell or module.",
    modules: [8, 7, 16, 14],
    live: "Works on 12 V power whenever the car is awake, in READY or charging; it cannot wake up if the 12 V battery is flat."
  },
  contactors: {
    name: "Contactors and pre-charge circuit",
    urdu: "کنٹیکٹر / ریلے — بجلی سے چلنے والا سوئچ",
    job: "Heavy-duty switches inside the pack that connect the battery to the car and disconnect it when the car is off.",
    inside: "Large relays worked by 12 V signals from the BMS. At start-up the pre-charge contactor and resistor first fill the inverter capacitor gently, then the main positive contactor closes and the car shows READY.",
    safety: "A welded contactor or a pre-charge failure will stop the car going to READY; scan for these fault codes.",
    modules: [8, 3, 17, 18],
    live: "Closed, passing high voltage, only in READY or while charging; open whenever the car is off."
  },
  msd: {
    name: "Manual service disconnect (service plug)",
    urdu: "",
    job: "A plug or switch that the technician removes to break the high-voltage circuit before work.",
    inside: "A removable link in the battery's main circuit, often in the middle of the pack, between the two halves of the cells.",
    safety: "Remove it wearing insulating gloves and keep it in your pocket or a locked box so nobody can refit it (lock out, tag out).",
    modules: [3, 7],
    live: "Connected to live cells at all times; removing it breaks the circuit, but the cells on each side stay live."
  },
  junction: {
    name: "HV junction box (PDU)",
    urdu: "",
    job: "Shares high-voltage power from the battery out to each high-voltage part: inverter, on-board charger, DC-DC converter, A/C compressor and heater.",
    inside: "Bus bars with a fuse for each high-voltage part, and sometimes relays.",
    safety: "If one high-voltage part stops working, a blown fuse here is a possible cause; check fuses only with the system isolated and proven dead.",
    modules: [10, 5, 17],
    live: "Live whenever the contactors are closed: in READY and while charging."
  },
  inverter: {
    name: "Inverter (motor controller)",
    urdu: "انورٹر — ڈی سی کو اے سی میں بدلتا ہے",
    job: "Changes battery DC into three-phase AC to drive the motor, and changes it back to DC during regenerative braking.",
    inside: "Six fast electronic switches (IGBT or SiC) turned on and off thousands of times a second, a large DC-link capacitor, a control board, current sensors and a cooling plate. The AC frequency sets motor speed; the current sets torque.",
    safety: "The capacitor can hold battery voltage after switch-off, so wait the time in the manual and prove dead before touching.",
    modules: [10, 9, 5, 3],
    live: "Live whenever the contactors are closed; its capacitor can stay charged after switch-off until the discharge circuit drains it."
  },
  motor: {
    name: "Traction motor",
    urdu: "موٹر",
    job: "Turns electrical power into rotation to drive the wheels. During braking it works as a generator and sends energy back to the battery.",
    inside: "A fixed stator with copper windings and a rotor, usually with permanent magnets, on the shaft. The stator makes a rotating magnetic field that pulls the rotor round; a resolver tells the inverter the rotor position.",
    safety: "A permanent-magnet motor makes voltage whenever it turns, so never spin the driven wheels with high-voltage parts exposed.",
    modules: [9, 10, 12, 17],
    live: "Powered by the inverter in READY; it also makes voltage whenever the rotor turns, even with the battery disconnected."
  },
  gearbox: {
    name: "Reduction gear and differential",
    urdu: "گیئر",
    job: "A single-speed gearbox that lowers motor speed and multiplies torque, then shares the drive between the two wheels.",
    inside: "Usually two stages of gears giving a total ratio of about 8:1 to 12:1, plus a differential. There is no reverse gear (the motor spins backwards); Park uses a locking pawl.",
    safety: "It has its own gear oil; use only the fluid the maker names and change it if the service schedule says so.",
    modules: [12, 5, 19],
    live: "Not electrical; it turns whenever the wheels turn."
  },
  dcdc: {
    name: "DC-DC converter",
    urdu: "",
    job: "Steps high voltage down to about 13.5–14.8 V to run the 12 V system and charge the 12 V battery. It replaces the alternator.",
    inside: "A power electronic converter, typically 1.5–3 kW (over 100 A) output, often cooled by the same coolant loop as the motor and inverter.",
    safety: "Simple safe test: the 12 V battery should read about 12.4–12.8 V with the car off and rise to about 13.5–14.8 V in READY.",
    modules: [10, 16, 5],
    live: "Works only in READY or while charging."
  },
  obc: {
    name: "On-board charger (OBC)",
    urdu: "چارجر",
    job: "Changes AC from the mains into DC to charge the high-voltage battery. Its rating, often 3.3–22 kW, sets the top AC charging speed.",
    inside: "A power electronic converter from AC to DC, usually cooled by the drive coolant loop. Some are bidirectional and can give 230 V AC out of the car (V2L).",
    safety: "If a car will not charge on AC but charges on DC, suspect the OBC, but first try another cable and socket.",
    modules: [10, 14, 5],
    live: "Works only during AC charging (or V2L); it is bypassed during DC fast charging."
  },
  port: {
    name: "Charge port (AC and DC pins)",
    urdu: "",
    job: "Where the charging cable plugs in. In Pakistan, official cars use Type 2 for AC and CCS2 for DC; grey imports from China use GB/T.",
    inside: "Power pins (AC phases, neutral and earth, plus two large DC pins for fast charging) and small signal pins such as CP and PP. The car and charger talk on these signal pins before any power flows.",
    safety: "Burnt or melted pins mean poor contact, a cheap adapter, water or dirt; replace both the inlet and the damaged cable.",
    modules: [14, 19],
    live: "Its pins are live only while charging, after the handshake is complete; with no plug in they are not live."
  },
  aux12: {
    name: "12 V battery",
    urdu: "بیٹری",
    job: "Powers the computers, lights, locks and wipers, and the contactors. If it is flat the car cannot wake up, even with a full high-voltage battery.",
    inside: "A small battery, usually AGM lead-acid; some cars (BYD) use a small 12 V lithium battery. Typical life is 3–5 years, less in heat.",
    safety: "A weak 12 V battery is the most common reason an EV or hybrid will not start, so check it first, every time.",
    modules: [16, 3, 18],
    live: "Always connected; it is recharged by the DC-DC converter only in READY or while charging."
  },
  vcu: {
    name: "Vehicle control unit (VCU)",
    urdu: "",
    job: "The master computer. It reads the accelerator, brake and gear selector, decides how much torque to ask from the motor, and coordinates the other control units.",
    inside: "A control unit that runs on 12 V and talks to the BMS, inverter, charger and other computers over CAN bus.",
    safety: "A fault code starting with U means a control unit is not heard on the network; check its power, earth and connectors before replacing it.",
    modules: [16, 5, 10],
    live: "Works on 12 V whenever the car is switched on."
  },
  compressor: {
    name: "Electric A/C compressor",
    urdu: "",
    job: "Pumps the refrigerant for the air-conditioning. On many EVs it also cools the battery through the chiller.",
    inside: "One sealed housing with a scroll pump, a small three-phase motor and a small inverter. It has an orange high-voltage connector and a low-voltage connector for 12 V, earth and LIN/CAN.",
    safety: "Use only the specified insulating POE oil: normal PAG oil can cause an insulation fault and can make the compressor case live.",
    modules: [15, 7, 18],
    live: "Runs only when cooling is requested and high voltage is present: car in READY or charging."
  },
  heater: {
    name: "PTC heater",
    urdu: "",
    job: "Heats the cabin, and on some cars the battery, because there is no hot engine.",
    inside: "An electric heating element that runs on high voltage, typically 3–6 kW. It uses 1 kW of battery energy to make 1 kW of heat.",
    safety: "A PTC heater that has let coolant inside is a classic cause of insulation faults.",
    modules: [15, 18],
    live: "Can work only when high voltage is present (contactors closed) and heat is requested."
  },
  pump: {
    name: "Electric coolant pump",
    urdu: "",
    job: "Moves coolant around a cooling loop. Each loop, for example the drive loop and the battery loop, has its own electric pump.",
    inside: "A small 12 V electric pump switched by the thermal management controller. There is no engine-driven water pump.",
    safety: "A failed pump makes the inverter or battery overheat; on Toyota hybrids, check that coolant moves in the inverter reservoir in READY.",
    modules: [15, 10, 7],
    live: "Runs on 12 V when the controller asks for cooling, in READY and often while charging."
  },
  radiator: {
    name: "Radiator and chiller",
    urdu: "",
    job: "The radiator at the front gives heat from the coolant to the outside air. The chiller lets cold A/C refrigerant take heat out of the battery coolant in hot weather.",
    inside: "The radiator is a heat exchanger with a fan. The chiller is a second evaporator in the A/C system, with its own expansion valve.",
    safety: "Dust, insects and plastic bags block radiators and condensers quickly; clean them gently from the back with low-pressure water.",
    modules: [15, 7, 19],
    live: "Not powered itself (its fan is); it works whenever coolant or refrigerant flows through it."
  },
  hvcable: {
    name: "Orange high-voltage cables",
    urdu: "کیبل / تار",
    job: "Carry high-voltage power between the battery, junction box, inverter, motor, charger and other high-voltage parts.",
    inside: "Thick insulated cables with orange covering and orange connectors. The high-voltage circuit is not connected to the car body; both + and − are insulated.",
    safety: "Orange means do not touch until the system is isolated, you have waited, and you have proved it dead.",
    modules: [3, 2, 18, 19],
    live: "Live whenever the contactors are closed (READY or charging); motor cables can also become live if the wheels turn."
  },
  interlock: {
    name: "High-voltage interlock loop (HVIL)",
    urdu: "",
    job: "A safety loop that opens the contactors if any high-voltage connector or cover is unplugged or opened.",
    inside: "A small low-voltage wire that runs in a loop through every high-voltage connector and cover. If any connector is opened, the loop breaks.",
    safety: "After any repair, check every connector is fully seated: a loose one opens the HVIL and the car will not go to READY.",
    modules: [3, 17, 18],
    live: "A low-voltage signal loop; if it breaks while the system is on, the contactors open at once."
  }
};
