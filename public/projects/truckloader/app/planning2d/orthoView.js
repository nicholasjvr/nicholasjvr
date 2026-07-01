// Lateral / longitudinal ortho views (left / right / front / back) on the
// main #truck-canvas. Read-only — block placement is disallowed in these
// directions (the user must switch to top to edit). Blocks are projected
// onto the chosen axis using their stored pixel coords + Z.

import { S } from "../core/state.js";
import { ISO_MAX_H, MIN_PLACE_PX } from "../core/constants.js";
import { escapeHtml } from "../core/utils.js";
import { syncCabMarker } from "../truckcab/index.js";
import {
  renderSectionDividers,
  setOrthoDimLabels,
  updateGridOverlayFromScale,
} from "../deck/index.js";

let _getCurrentBed = function() { return null; };
let _getIso = function() { return null; };

export function initOrthoView(ctx) {
  if (ctx && typeof ctx.getCurrentBed === "function") _getCurrentBed = ctx.getCurrentBed;
  if (ctx && typeof ctx.getIso        === "function") _getIso        = ctx.getIso;
}

// dir: 'left' | 'right' | 'front' | 'back'
export function renderOrthoView(dir) {
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
  const sc  = S.scale;
  const isLateral = (dir === "left" || dir === "right");
  const canvasWpx = Math.round((isLateral ? bed.length : bed.width) * sc);
  const canvasHpx = Math.ceil(ISO_MAX_H * sc);

  const cvs = document.getElementById("truck-canvas");
  cvs.style.width   = canvasWpx + "px";
  cvs.style.height  = canvasHpx + "px";
  cvs.style.display = "block";
  cvs.querySelectorAll(".load-block").forEach(function(el) { el.remove(); });

  S.placedBlocks.forEach(function(block) {
    let bx, bw;
    if (dir === "left")  { bx = block.x;                       bw = block.w; }
    if (dir === "right") { bx = canvasWpx - block.x - block.w; bw = block.w; }
    if (dir === "front") { bx = block.y;                       bw = block.h; }
    if (dir === "back")  { bx = canvasWpx - block.y - block.h; bw = block.h; }

    const bh = Math.max(Math.round(block.height * sc), MIN_PLACE_PX);
    const el = document.createElement("div");
    el.className           = "load-block type-" + block.loadType;
    el.style.left          = bx + "px";
    el.style.width         = bw + "px";
    el.style.height        = bh + "px";
    el.style.bottom        = Math.round((block.z || 0) * sc) + "px";
    el.style.top           = "auto";
    el.style.cursor        = "default";
    el.style.pointerEvents = "none";
    el.innerHTML = '<span class="block-label">' + escapeHtml(block.loadId) +
                   (block.z > 0 ? "<br>↕" + block.z + "m" : "") + "</span>";
    cvs.appendChild(el);
  });

  renderSectionDividers(dir);
  setOrthoDimLabels(bed, dir);
  updateGridOverlayFromScale();
  syncCabMarker();
}
