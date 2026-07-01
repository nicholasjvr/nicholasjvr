// Top-down planning view. Paints #truck-canvas at deck dimensions × current
// scale, populates placed blocks via loads/placement.renderBlockEl.

import { S } from "../core/state.js";
import { syncCabMarker } from "../truckcab/index.js";
import {
  renderSectionDividers,
  setTopDimLabels,
  updateTopViewMetrics,
  updateGridOverlayFromScale,
} from "../deck/index.js";
import { renderBlockEl } from "../loads/placement.js";

let _getCurrentBed = function() { return null; };
let _getIso = function() { return null; };

export function initTopView(ctx) {
  if (ctx && typeof ctx.getCurrentBed === "function") _getCurrentBed = ctx.getCurrentBed;
  if (ctx && typeof ctx.getIso        === "function") _getIso        = ctx.getIso;
}

export function renderTopView() {
  const iso = _getIso();
  if (iso) iso.stopIsoAnimation();
  document.getElementById("iso-canvas").style.display = "none";
  const isoVp = document.getElementById("iso-viewport");
  if (isoVp) isoVp.hidden = true;
  const i3 = document.getElementById("iso-three");
  if (i3) i3.style.display = "none";
  const cp = document.getElementById("iso-cam-presets");
  if (cp) cp.style.display = "none";

  const bed = _getCurrentBed() || { length: 8, width: 2.4 };
  const cvs = document.getElementById("truck-canvas");
  cvs.style.width   = Math.round(bed.length * S.scale) + "px";
  cvs.style.height  = Math.round(bed.width  * S.scale) + "px";
  cvs.style.display = "block";

  cvs.querySelectorAll(".load-block").forEach(function(el) { el.remove(); });
  S.placedBlocks.forEach(function(block) { renderBlockEl(block); });

  renderSectionDividers("top");
  setTopDimLabels(bed);
  updateTopViewMetrics();
  updateGridOverlayFromScale();
  syncCabMarker();
}
