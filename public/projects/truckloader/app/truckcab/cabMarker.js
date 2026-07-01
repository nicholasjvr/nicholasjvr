// Cab marker — the decorative truck-cab strip beside the deck in top / left /
// right views. Owns #cab-marker entirely: paints the SVG art on init, sizes
// itself per view, and toggles top vs side orientation. Nothing else in the
// app should touch #cab-marker.

import { S } from "../core/state.js";
import { ISO_MAX_H } from "../core/constants.js";
import { cabSvgTop } from "./cabSvgTop.js";
import { cabSvgSide } from "./cabSvgSide.js";

const TOP_CAB_VIEWBOX_W = 300;
const TOP_CAB_VIEWBOX_H = 220;

// Injected by initCabMarker — lets us read bed dimensions without coupling to
// planner.js internals.
let _getCurrentBed = function() { return null; };

export function initCabMarker(ctx) {
  _getCurrentBed = ctx.getCurrentBed || _getCurrentBed;
  paintCabArt();
}

// Injects both SVGs into the cab marker slot. CSS toggles which is visible
// based on `.cab-marker--top` vs `.cab-marker--side`.
function paintCabArt() {
  const slot = document.querySelector("#cab-marker .cab-art-slot");
  if (!slot) return;
  slot.innerHTML = cabSvgTop() + cabSvgSide();
}

// Extra length (m) reserved beside the deck in top view for the cab strip.
// Used by planner.js when computing px-per-metre — keep the formula in sync
// with the width caps inside `applyMarkerSize` (viewBox width / height ratio).
export function cabExtraLenMForTop(bed) {
  return Math.min(bed.width * (TOP_CAB_VIEWBOX_W / TOP_CAB_VIEWBOX_H), bed.length * 0.34);
}

// Apply width to #cab-marker for the current view. Visual only — does not
// affect bed length/width, drag coords, or labels.
function applyMarkerSize(cm) {
  if (!S.selectedTruck) {
    cm.style.removeProperty("width");
    return;
  }
  if (S.viewMode !== "top" && S.viewMode !== "left" && S.viewMode !== "right") {
    cm.style.removeProperty("width");
    return;
  }
  const bed = _getCurrentBed();
  if (!bed) {
    cm.style.removeProperty("width");
    return;
  }
  const sc = S.scale;
  if (S.viewMode === "top") {
    const deckHPx = bed.width * sc;
    // viewBox 300×220 — cab width (vehicle lateral) maps to deck width.
    const wIdeal = deckHPx * (TOP_CAB_VIEWBOX_W / TOP_CAB_VIEWBOX_H);
    const wCap = bed.length * sc * 0.34;
    cm.style.width = Math.round(Math.min(wIdeal, wCap)) + "px";
  } else if (S.viewMode === "left" || S.viewMode === "right") {
    const orthoHPx = ISO_MAX_H * sc;
    const wIdeal = orthoHPx * (52 / 108);
    const wCap = bed.width * sc * 1.35;
    cm.style.width = Math.round(Math.min(wIdeal, wCap)) + "px";
  }
}

// Public: refresh the cab marker for the current view. Call after any change
// to selectedTruck, viewMode, or scale. Replaces the old
// syncCabOrientation() + syncCabMarkerSize() pair in planner.js.
export function syncCabMarker() {
  const row = document.getElementById("bed-and-cab");
  if (!row) return;
  const cm = document.getElementById("cab-marker");

  if (!S.selectedTruck) {
    row.classList.add("bed-and-cab--idle");
    row.classList.remove("cab-on-trailer-end");
    row.style.display = "";
    if (cm) {
      cm.classList.remove("cab-marker--top", "cab-marker--side");
      cm.hidden = false;
      cm.style.removeProperty("width");
    }
    return;
  }

  row.classList.remove("bed-and-cab--idle");
  const cabViews = S.viewMode === "top" || S.viewMode === "left" || S.viewMode === "right";
  row.style.display = S.viewMode === "iso" ? "none" : "";
  row.classList.toggle("cab-on-trailer-end", S.viewMode === "right");

  if (!cm) return;
  if (cabViews) {
    cm.hidden = false;
    cm.classList.remove("cab-marker--top", "cab-marker--side");
    cm.classList.add(S.viewMode === "top" ? "cab-marker--top" : "cab-marker--side");
    applyMarkerSize(cm);
  } else {
    cm.hidden = true;
    cm.classList.remove("cab-marker--top", "cab-marker--side");
    cm.style.removeProperty("width");
  }
}
