// Per-load placement accounting.
//
// Each placed block represents exactly ONE unit of its source load — so a
// load with units = 10 can spawn up to 10 placed blocks. This module is the
// single source of truth for that arithmetic; any code that needs to know
// "how many units of this load are on the deck" or "can I place another"
// must come through here.

import { S } from "../core/state.js";

// Count placed blocks for a given source load id.
export function placedUnitsForLoad(loadId) {
  let n = 0;
  for (let i = 0; i < S.placedBlocks.length; i++) {
    if (S.placedBlocks[i].loadId === loadId) n++;
  }
  return n;
}

// How many units of `load` haven't been placed yet (0 if everything is on the deck).
export function remainingUnitsForLoad(load) {
  if (!load) return 0;
  const total = parseInt(load.units, 10) || 0;
  return Math.max(0, total - placedUnitsForLoad(load.id));
}

// Sum of unplaced units across every load in `loads`.
export function totalUnplacedUnits(loads) {
  if (!loads || !loads.length) return 0;
  let n = 0;
  for (let i = 0; i < loads.length; i++) n += remainingUnitsForLoad(loads[i]);
  return n;
}

// True when every unit of `load` is on the deck — used to gate drag-start
// and reject drops that would exceed the load's declared unit count.
export function isLoadFullyPlaced(load) {
  return remainingUnitsForLoad(load) <= 0;
}
