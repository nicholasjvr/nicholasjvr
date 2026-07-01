// Metrics strip + load-strip counts.
// Owns: #m-deck, #m-placed, #m-remaining, #m-util, #m-util-fill, #m-weight,
//       #load-strip-counts.

import { S } from "../core/state.js";
import { EPS } from "../core/constants.js";
import { totalUnplacedUnits } from "../loads/units.js";

let _getCurrentBed = function () {
  return null;
};
let _getAllLoads = function () {
  return [];
};
let _getLoadFilters = function () {
  return { search: "", type: "all" };
};
let _typeKey = function () {
  return "pallets";
};

export function initMetrics(ctx) {
  if (ctx) {
    if (typeof ctx.getCurrentBed === "function")
      _getCurrentBed = ctx.getCurrentBed;
    if (typeof ctx.getAllLoads === "function") _getAllLoads = ctx.getAllLoads;
    if (typeof ctx.getLoadFilters === "function")
      _getLoadFilters = ctx.getLoadFilters;
    if (typeof ctx.typeKey === "function") _typeKey = ctx.typeKey;
  }
}

// Load-strip summary: filtered available card count vs total pool + on-deck blocks.
export function updatePanelCounts() {
  const allLoads = _getAllLoads();
  const filters = _getLoadFilters();
  const lc = document.getElementById("load-strip-counts");
  if (!lc) return;

  const n = allLoads.length;
  const q = String(filters.search || "").trim();
  const t = filters.type || "all";
  const onDeck =
    S.placedBlocks && S.placedBlocks.length ? S.placedBlocks.length : 0;

  let availPart = String(n);
  const filtering = q || t !== "all";
  if (filtering) {
    const visible = allLoads.filter(function (l) {
      if (t !== "all" && _typeKey(l.loadType) !== t) return false;
      if (!q) return true;
      const hay = [l.id, l.loadType, l.isoType, l.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.indexOf(q.toLowerCase()) !== -1;
    }).length;
    availPart = visible + " / " + n;
  }
  lc.textContent = availPart + " avail · " + onDeck + " on deck";
}

// Top metrics strip: deck dims, placed count, remaining unplaced, floor
// utilisation %; rig summary is in #plan-summary-chips (Info popover).
export function updateMetricsBar() {
  const bed = _getCurrentBed();
  const sc = S.scale || 1;
  const allLoads = _getAllLoads();

  const deckEl = document.getElementById("m-deck");
  const placedEl = document.getElementById("m-placed");
  const remainingEl = document.getElementById("m-remaining");
  const utilEl = document.getElementById("m-util");
  const utilFillEl = document.getElementById("m-util-fill");
  const weightEl = document.getElementById("m-weight");

  if (deckEl)
    deckEl.textContent = bed ? bed.length + "m × " + bed.width + "m" : "—";
  if (placedEl) placedEl.textContent = String(S.placedBlocks.length);

  if (remainingEl)
    remainingEl.textContent = String(totalUnplacedUnits(allLoads));

  let pct = 0;
  if (bed && bed.length && bed.width) {
    const deckArea = bed.length * bed.width;
    let used = 0;
    S.placedBlocks.forEach(function (b) {
      if ((b.z || 0) > EPS) return;
      used += (b.w / sc) * (b.h / sc);
    });
    pct = Math.min(999, Math.round((used / deckArea) * 100));
  }
  if (utilEl) utilEl.textContent = pct + "%";
  if (utilFillEl) {
    utilFillEl.style.width = Math.min(100, pct) + "%";
    utilFillEl.classList.toggle("is-high", pct >= 80 && pct < 100);
    utilFillEl.classList.toggle("is-overflow", pct >= 100);
  }

  if (weightEl) {
    let totalKg = 0;
    let hasWeight = false;
    S.placedBlocks.forEach(function (b) {
      const w = parseFloat(b.weight || b.weightPerUnit || 0);
      const u = parseFloat(b.units) || 1;
      if (w > 0) {
        hasWeight = true;
        totalKg += w * u;
      }
    });
    weightEl.textContent = hasWeight
      ? totalKg >= 1000
        ? (totalKg / 1000).toFixed(1) + " t"
        : Math.round(totalKg) + " kg"
      : "—";
  }
}
