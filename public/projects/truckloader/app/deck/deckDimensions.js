// Deck dimension labels — the #dim-label-top and #dim-label-side captions
// that sit beside the planning canvas. Also owns updateTopViewMetrics, which
// pushes the deck's pixel footprint into shared state for downstream use.

import { S } from "../core/state.js";
import { ISO_MAX_H } from "../core/constants.js";

let _getCurrentBed = function() { return null; };

export function initDeckDimensions(ctx) {
  if (ctx.getCurrentBed) _getCurrentBed = ctx.getCurrentBed;
}

// Cache the deck's pixel footprint on S so callers reading topPxW/H (e.g. the
// sides-preview strip) stay in sync with the canvas.
export function updateTopViewMetrics() {
  const bed = _getCurrentBed();
  if (!bed) return;
  // Deck only — #cab-marker is decorative; never add cab width/height here.
  S.topPxW = Math.round(bed.length * S.scale);
  S.topPxH = Math.round(bed.width * S.scale);
}

export function setTopDimLabels(bed) {
  const top  = document.getElementById("dim-label-top");
  const side = document.getElementById("dim-label-side");
  if (top)  top.textContent  = "Length: " + bed.length + "m";
  if (side) side.textContent = "Width: "  + bed.width  + "m";
}

// dir: 'left' | 'right' | 'front' | 'back'. Lateral views show length along the
// dimension axis; front/back show width.
export function setOrthoDimLabels(bed, dir) {
  const isLateral = (dir === "left" || dir === "right");
  const dimLabel = isLateral
    ? "Length: " + bed.length + "m"
    : "Width: "  + bed.width  + "m";
  const top  = document.getElementById("dim-label-top");
  const side = document.getElementById("dim-label-side");
  if (top)  top.textContent  = dimLabel;
  if (side) side.textContent = "Height (max " + ISO_MAX_H + "m)";
}

export function clearDimLabels() {
  const top  = document.getElementById("dim-label-top");
  const side = document.getElementById("dim-label-side");
  if (top)  top.textContent  = "";
  if (side) side.textContent = "";
}
