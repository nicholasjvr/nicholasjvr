// Shared numeric/dimension constants for the Break Bulk widget.
// No DOM, no Zoho — safe to import from anywhere.

// ── TRUCK BED DIMENSIONS (metres) ───────────────────────────────────────────
export const TRUCK_BEDS = {
  "4-Wheels":  { length: 4,  width: 2.0 },
  "6-Wheels":  { length: 6,  width: 2.4 },
  "8-Wheels":  { length: 8,  width: 2.4 },
  "10-Wheels": { length: 9,  width: 2.4 },
  "14-Wheels": { length: 12, width: 2.4 },
  "22-Wheels": { length: 16, width: 2.4 },
};

// Nominal deck width (m) when Creator has no per-type width.
export const DEFAULT_TRAILER_DECK_WIDTH = 2.45;

// ── CANVAS / GRID SETTINGS ──────────────────────────────────────────────────
// Placement snap grid in metres (every 10 cm). Visual grid + drag/drop use this
// via px = m × scale.
export const GRID_STEP_M = 0.1;
export const MIN_PLACE_PX = 6;
// Fallback pixel budget when `.canvas-stage` has no size yet (first paint).
export const FALLBACK_CVS_W = 720;
export const FALLBACK_CVS_H = 360;
export const MIN_SCALE_PX_PER_M = 12;

// ── ISO VIEW CONSTANTS ──────────────────────────────────────────────────────
export const ISO_MAX_H = 3.0; // metres — ceiling for side + iso view height axis

// ── NUMERIC TOLERANCE ───────────────────────────────────────────────────────
export const EPS = 1e-4;
