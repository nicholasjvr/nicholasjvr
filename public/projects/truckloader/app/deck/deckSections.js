// Deck sections — multi-section trailer geometry on the 2D planning canvas.
//
// Owns:
//   - parsing Creator's Sections subform display strings ("<row_id>,<length>")
//     into { lengthM } numbers
//   - rendering per-section panels (top view) and dashed dividers (ortho views)
//     onto #truck-canvas
//
// Block placement / drop math is unaffected — every overlay element is a
// visual-only absolutely-positioned child of #truck-canvas.

import { S } from "../core/state.js";
import { ISO_MAX_H } from "../core/constants.js";

let _getCurrentBed = function() { return null; };
let _getActiveTrailerType = function() { return null; };
const TOP_SECTION_GAP_M = 0.32;

export function initDeckSections(ctx) {
  if (ctx.getCurrentBed) _getCurrentBed = ctx.getCurrentBed;
  if (ctx.getActiveTrailerType) _getActiveTrailerType = ctx.getActiveTrailerType;
}

// Sections subform display_value comes through as "<row_id>,<length>" (e.g.
// "4885379000000966112,6.00") — the last numeric token <1000 is the metre size;
// the larger 19-digit number is the Zoho record ID.
export function parseSectionLength(displayValue) {
  if (displayValue == null) return 0;
  const parts = String(displayValue).trim().split(/[\s,]+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    const n = parseFloat(parts[i]);
    if (Number.isFinite(n) && n > 0 && n < 1000) return n;
  }
  return 0;
}

// View-aware section overlay renderer:
//   top         → injects per-section grid PANELS (one deck rectangle per
//                  section, each with its own border + grid background). The
//                  global .grid-overlay is hidden via .has-section-panels.
//   left        → vertical dashed dividers across deck height (length L→R)
//   right       → vertical dashed dividers (length axis MIRRORED, R→L)
//   front/back  → no-op (boundaries are edge-on)
export function renderSectionDividers(viewMode) {
  const cvs = document.getElementById("truck-canvas");
  if (!cvs) return;
  cvs.querySelectorAll(".section-divider, .section-label, .section-panel, .section-gap")
    .forEach(function(el) { el.remove(); });
  cvs.classList.remove("has-section-panels");

  if (viewMode === "front" || viewMode === "back") return;
  const tt = _getActiveTrailerType();
  if (!tt) return;

  const bed = _getCurrentBed() || { length: 0, width: 0 };
  const canvasWpx = Math.round(bed.length * S.scale);
  const canvasHpx = (viewMode === "top")
    ? Math.round(bed.width * S.scale)
    : Math.ceil(ISO_MAX_H * S.scale);

  if (viewMode === "top") {
    if (tt.sections.length < 2) return; // single section → keep global grid-overlay
    cvs.classList.add("has-section-panels");
    const gapPx = Math.max(8, Math.round(TOP_SECTION_GAP_M * S.scale));
    const gapHalf = Math.round(gapPx / 2);

    let cumulativeM = 0;
    for (let t = 0; t < tt.sections.length; t++) {
      const sec = tt.sections[t];
      if (!sec || !(sec.lengthM > 0)) continue;
      const startM = cumulativeM;
      cumulativeM += sec.lengthM;

      let startPx = Math.round(startM * S.scale);
      let endPx   = Math.round(cumulativeM * S.scale);
      if (t > 0) startPx += gapHalf;
      if (t < tt.sections.length - 1) endPx -= gapHalf;
      const widthPx = Math.max(1, endPx - startPx);

      const panel = document.createElement("div");
      panel.className = "section-panel";
      panel.style.cssText =
        "position:absolute;left:" + startPx + "px;top:0;" +
        "width:" + widthPx + "px;height:" + canvasHpx + "px;" +
        "pointer-events:none;z-index:0;";
      cvs.appendChild(panel);

      const midPx = startPx + Math.round(widthPx / 2);
      const lbl = document.createElement("div");
      lbl.className = "section-label";
      lbl.textContent = "S" + (t + 1) + " · " + sec.lengthM + "m";
      lbl.style.cssText =
        "position:absolute;left:" + midPx + "px;top:4px;transform:translateX(-50%);" +
        "font-size:11px;font-weight:600;color:rgba(15,118,110,0.9);" +
        "background:rgba(255,255,255,0.85);padding:1px 5px;border-radius:3px;" +
        "pointer-events:none;z-index:3;white-space:nowrap;";
      cvs.appendChild(lbl);

      // Physical inter-deck no-load zone (drawbar connector) shown as a true gap.
      if (t < tt.sections.length - 1) {
        const boundaryPx = Math.round(cumulativeM * S.scale);
        const gapLeft = boundaryPx - Math.floor(gapPx / 2);
        const gapEl = document.createElement("div");
        gapEl.className = "section-gap";
        gapEl.style.cssText =
          "position:absolute;left:" + gapLeft + "px;top:0;" +
          "width:" + gapPx + "px;height:" + canvasHpx + "px;" +
          "pointer-events:none;z-index:1;";
        cvs.appendChild(gapEl);
      }
    }
    return;
  }

  // Left / Right ortho views — dashed dividers + labels along length axis.
  let cumulativeM = 0;
  for (let i = 0; i < tt.sections.length; i++) {
    const sec = tt.sections[i];
    if (!sec || !(sec.lengthM > 0)) continue;
    const startM = cumulativeM;
    cumulativeM += sec.lengthM;

    const dividerXpx = (viewMode === "right")
      ? Math.round(canvasWpx - cumulativeM * S.scale)
      : Math.round(cumulativeM * S.scale);
    const labelXpx = (viewMode === "right")
      ? Math.round(canvasWpx - (startM + sec.lengthM / 2) * S.scale)
      : Math.round((startM + sec.lengthM / 2) * S.scale);

    if (i < tt.sections.length - 1) {
      const line = document.createElement("div");
      line.className = "section-divider";
      line.style.cssText =
        "position:absolute;left:" + dividerXpx + "px;top:0;width:0;height:" + canvasHpx + "px;" +
        "border-left:2px dashed rgba(15,118,110,0.75);pointer-events:none;z-index:2;";
      cvs.appendChild(line);
    }

    const lbl = document.createElement("div");
    lbl.className = "section-label";
    lbl.textContent = "S" + (i + 1) + " · " + sec.lengthM + "m";
    lbl.style.cssText =
      "position:absolute;left:" + labelXpx + "px;top:4px;transform:translateX(-50%);" +
      "font-size:11px;font-weight:600;color:rgba(15,118,110,0.9);" +
      "background:rgba(255,255,255,0.85);padding:1px 5px;border-radius:3px;" +
      "pointer-events:none;z-index:2;white-space:nowrap;";
    cvs.appendChild(lbl);
  }
}
