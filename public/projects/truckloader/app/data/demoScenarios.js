// Static demo scenarios — truck, optional trailer, and loads for the load-planner demo.
// Object shapes match what planner.js / loads/ already expect from the former Zoho layer.

import { TRUCK_BEDS, DEFAULT_TRAILER_DECK_WIDTH } from "../core/constants.js";

function truck(id, fleetNumber, layout) {
  var bed = TRUCK_BEDS[layout] || TRUCK_BEDS["8-Wheels"];
  return {
    id: id,
    fleetNumber: fleetNumber,
    regNumber: "",
    layout: layout,
    bedLengthM: bed.length,
    bedWidthM: bed.width,
  };
}

function trailer(id, label, typeId, bedLengthM, sections) {
  var secs = sections || [{ lengthM: bedLengthM }];
  var total = secs.reduce(function (a, s) {
    return a + (s.lengthM || 0);
  }, 0);
  return {
    trailer: {
      id: id,
      trailerType: label,
      trailerTypeLabel: label,
      typeId: typeId,
      bedLengthM: bedLengthM,
      bedWidthM: DEFAULT_TRAILER_DECK_WIDTH,
    },
    trailerType: {
      id: typeId,
      label: label,
      prefix: "",
      sections: secs.map(function (s, i) {
        return { id: String(i + 1), lengthM: s.lengthM };
      }),
      totalLengthM: total > 0 ? total : bedLengthM,
    },
  };
}

function load(
  recordId,
  id,
  description,
  loadType,
  units,
  length,
  width,
  height,
  isoType,
) {
  return {
    recordId: recordId,
    id: id,
    description: description,
    loadType: loadType,
    units: units,
    length: length,
    width: width,
    height: height || 0.3,
    isoType: isoType || "",
    rate: "",
  };
}

export const DEMO_SCENARIOS = [
  {
    id: "rig-6w-local",
    label: "6-Wheel truck only (local)",
    truck: truck("truck-6w", "Demo Truck 1", "6-Wheels"),
    trailer: null,
    trailerType: null,
    loads: [
      load(
        "ld-101",
        "LD-101",
        "Euro pallets — mixed goods",
        "Pallets",
        6,
        1.2,
        0.8,
        1.5,
      ),
      load(
        "ld-102",
        "LD-102",
        "1 Ton bags — grain",
        "1 Ton Bags",
        8,
        1.0,
        1.0,
        1.0,
      ),
      load(
        "ld-103",
        "LD-103",
        "Half pallets — hardware",
        "Pallets",
        4,
        0.6,
        0.8,
        1.2,
      ),
    ],
  },
  {
    id: "rig-8w-flat-12",
    label: "8-Wheel truck + Flatbed 12 m",
    truck: truck("truck-8w", "Demo Truck 2", "8-Wheels"),
    ...trailer("trl-flat-12", "Flatbed 12 m", "tt-flat-12", 12, [
      { lengthM: 6 },
      { lengthM: 6 },
    ]),
    loads: [
      load(
        "ld-201",
        "LD-201",
        "Standard pallets",
        "Pallets",
        10,
        1.2,
        0.8,
        1.5,
      ),
      load(
        "ld-202",
        "LD-202",
        "20 ft container unit",
        "Container",
        1,
        6.1,
        2.4,
        2.6,
        "20GP",
      ),
      load("ld-203", "LD-203", "Steel coil skid", "Pallets", 2, 1.8, 1.2, 1.0),
    ],
  },
  {
    id: "rig-10w-taut-15",
    label: "10-Wheel truck + Tautliner 15 m",
    truck: truck("truck-10w", "Demo Truck 3", "10-Wheels"),
    ...trailer("trl-taut-15", "Tautliner 15 m", "tt-taut-15", 15, [
      { lengthM: 5 },
      { lengthM: 5 },
      { lengthM: 5 },
    ]),
    loads: [
      load(
        "ld-301",
        "LD-301",
        "40 ft high-cube",
        "Container",
        1,
        12.0,
        2.4,
        2.9,
        "40HC",
      ),
      load(
        "ld-302",
        "LD-302",
        "Bulk bags — cement",
        "1 Ton Bags",
        12,
        1.0,
        1.0,
        1.0,
      ),
      load(
        "ld-303",
        "LD-303",
        "Oversize pallet crate",
        "Pallets",
        3,
        2.0,
        1.2,
        1.8,
      ),
    ],
  },
  {
    id: "rig-14w-taut-18",
    label: "14-Wheel truck + Tautliner 18 m",
    truck: truck("truck-14w", "Demo Truck 4", "14-Wheels"),
    ...trailer("trl-taut-18", "Tautliner 18 m", "tt-taut-18", 18, [
      { lengthM: 6 },
      { lengthM: 6 },
      { lengthM: 6 },
    ]),
    loads: [
      load(
        "ld-401",
        "LD-401",
        "Heavy machinery skid",
        "Pallets",
        2,
        3.0,
        2.2,
        2.0,
      ),
      load(
        "ld-402",
        "LD-402",
        "20 ft container",
        "Container",
        2,
        6.1,
        2.4,
        2.6,
        "20GP",
      ),
      load(
        "ld-403",
        "LD-403",
        "Stackable pallets",
        "Pallets",
        14,
        1.2,
        0.8,
        1.5,
      ),
      load(
        "ld-404",
        "LD-404",
        "Fertilizer bags",
        "1 Ton Bags",
        6,
        1.0,
        1.0,
        1.0,
      ),
    ],
  },
  {
    id: "rig-22w-max",
    label: "22-Wheel truck only (max deck)",
    truck: truck("truck-22w", "Demo Truck 5", "22-Wheels"),
    trailer: null,
    trailerType: null,
    loads: [
      load(
        "ld-501",
        "LD-501",
        "Small cartons — stack demo",
        "Pallets",
        20,
        0.8,
        0.6,
        0.5,
      ),
      load("ld-502", "LD-502", "Medium pallets", "Pallets", 8, 1.2, 0.8, 1.5),
      load(
        "ld-503",
        "LD-503",
        "Bag units — stacking",
        "1 Ton Bags",
        10,
        1.0,
        1.0,
        1.0,
      ),
      load("ld-504", "LD-504", "Flat pack skid", "Pallets", 4, 2.4, 1.2, 0.4),
    ],
  },
];

export function getDemoScenarios() {
  return DEMO_SCENARIOS.slice();
}

export function getDemoScenarioById(id) {
  if (!id) return null;
  return (
    DEMO_SCENARIOS.find(function (s) {
      return String(s.id) === String(id);
    }) || null
  );
}
