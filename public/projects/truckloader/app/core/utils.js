// Small pure utilities shared across folders. No DOM, no Zoho.

import { S } from "./state.js";

// Normalise a load-type label to a CSS-safe class name + display key.
export function typeKey(loadType) {
  const t = (loadType || "").toLowerCase();
  if (t.includes("pallet"))    return "pallets";
  if (t.includes("container")) return "containers";
  if (t.includes("bag"))       return "bags";
  return "pallets";
}

export function typeLabel(loadType) {
  const k = typeKey(loadType);
  return k.charAt(0).toUpperCase() + k.slice(1);
}

// HTML-escape a value for safe innerHTML interpolation.
export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Load footprint on canvas: exact metres × scale (not snapped). Positions snap,
// dimensions don't. Used both for drag-ghost sizing and the actual block dims.
export function footprintPx(lenM, widM) {
  return {
    w: Math.max(Math.round(lenM * S.scale), 2),
    h: Math.max(Math.round(widM * S.scale), 2),
  };
}
