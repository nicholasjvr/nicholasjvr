// Deck grid — the snap-grid that overlays the 2D planning canvas.
// Owns:
//   - the px-per-grid-step calculation (gridStepPx)
//   - snapping pixel coords to the grid (snapPx)
//   - applying the --grid-step CSS variable to #truck-canvas so .grid-overlay
//     and .section-panel backgrounds line up with placed blocks
//
// Read by drag/drop and placement code; nothing else should be computing
// grid-step pixels in parallel.

import { S } from "../core/state.js";
import { GRID_STEP_M, MIN_PLACE_PX } from "../core/constants.js";

// Grid step in pixels — clamped to MIN_PLACE_PX so very small scales still
// produce a tappable snap target.
export function gridStepPx() {
  return Math.max(GRID_STEP_M * S.scale, MIN_PLACE_PX);
}

// Snap a canvas-pixel coordinate to the nearest grid step.
export function snapPx(v) {
  const s = gridStepPx();
  return Math.round(v / s) * s;
}

// Push the current grid step into #truck-canvas as --grid-step. Both
// .grid-overlay and .section-panel read this CSS variable for their
// background-size, so a single update propagates to every visual layer.
export function updateGridOverlayFromScale() {
  const cvs = document.getElementById("truck-canvas");
  if (!cvs) return;
  const step = gridStepPx();
  cvs.style.setProperty("--grid-step", step + "px");
  const el = cvs.querySelector(".grid-overlay");
  if (el) {
    const major = step * 5;
    el.style.backgroundSize =
      step + "px " + step + "px, " +
      step + "px " + step + "px, " +
      major + "px " + major + "px, " +
      major + "px " + major + "px";
  }
}
