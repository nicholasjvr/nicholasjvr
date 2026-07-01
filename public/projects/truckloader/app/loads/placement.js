// Placement — block lifecycle (place / remove / rotate / lift / lower / move),
// plus the canvas drop zone, drop ghost, and in-canvas block dragging.
//
// One drop = one unit. A load with `units = N` can spawn up to N placed
// blocks; `placeBlock` rejects with a banner if you exceed that. See
// loads/units.js for the accounting.

import { S } from "../core/state.js";
import { EPS, ISO_MAX_H } from "../core/constants.js";
import { typeKey, typeLabel, escapeHtml, footprintPx } from "../core/utils.js";
import { snapPx, gridStepPx } from "../deck/deckGrid.js";
import {
  blockFootprintM,
  blockConflictsWithAny,
  computeAutoStackZ,
  rectanglesOverlapFootprint,
} from "../core/collision.js";
import { planBanner } from "../ui/statusBanner.js";
import { updateMetricsBar, updatePanelCounts } from "../ui/metrics.js";
import { placedUnitsForLoad, isLoadFullyPlaced } from "./units.js";
import { getDragPayload, clearDragPayload } from "./dragPayload.js";
import { applyLoadFilters } from "./loadList.js";

export {
  setDragPayload,
  getDragPayload,
  clearDragPayload,
} from "./dragPayload.js";

// ── INJECTED CONTEXT ────────────────────────────────────────────────────────
// Set once at bootstrap via initPlacement(ctx). Lets us call into planner.js
// (or future main.js) without importing it.
let _getCurrentBed = function () {
  return null;
};
let _getIso = function () {
  return null;
}; // returns the loaded iso/ module or null
let _refreshView = function () {}; // generic view refresh (non-top, non-iso)
let _renderTopView = function () {}; // full top-view rerender

export function initPlacement(ctx) {
  if (!ctx) return;
  if (typeof ctx.getCurrentBed === "function")
    _getCurrentBed = ctx.getCurrentBed;
  if (typeof ctx.getIso === "function") _getIso = ctx.getIso;
  if (typeof ctx.refreshView === "function") _refreshView = ctx.refreshView;
  if (typeof ctx.renderTopView === "function")
    _renderTopView = ctx.renderTopView;
}

// ── DROP COORD HELPERS ──────────────────────────────────────────────────────
function getTopViewPixelSize() {
  const bed = _getCurrentBed();
  if (!bed) return { w: S.topPxW || 300, h: S.topPxH || 200 };
  return {
    w: Math.round(bed.length * S.scale),
    h: Math.round(bed.width * S.scale),
  };
}

function clampTopCorners(rawX, rawY, bw, bh, cw, ch) {
  let x = snapPx(rawX);
  let y = snapPx(rawY);
  const maxX = Math.max(0, cw - bw);
  const maxY = Math.max(0, ch - bh);
  x = Math.min(Math.max(0, x), maxX);
  y = Math.min(Math.max(0, y), maxY);
  return { x: x, y: y };
}

const OVERLAP_TOOLTIP_OFFSET_PX = 8;
const STACK_HOLD_MS = 700;
const STACK_MIN_OVERLAP_RATIO = 0.28;
let _stackHoldState = { key: "", startedAt: 0, armed: false };

/** Prefix banner / revert text when placement fails due to XY overlap (3D conflict). */
function accentOverlapMessage(msg, fallback) {
  const base = String(msg || fallback || "").trim();
  if (!base) return "";
  if (/overlap/i.test(base)) return "\u26A0 Cannot place here \u2014 " + base;
  return base;
}

function hideOverlapTooltip() {
  const tip = document.getElementById("overlap-tooltip");
  if (!tip) return;
  tip.hidden = true;
  tip.classList.add("hidden");
  tip.textContent = "";
  tip.removeAttribute("role");
}

function resetStackHoldState() {
  _stackHoldState.key = "";
  _stackHoldState.startedAt = 0;
  _stackHoldState.armed = false;
}

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function overlapAreaM(a, b) {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.L, b.x + b.L);
  const y1 = Math.min(a.y + a.W, b.y + b.W);
  return Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
}

function boxesOverlap1D(a0, a1, b0, b1) {
  return a0 < b1 && a1 > b0;
}

function snapNearNeighborEdges(x, y, w, h, excludeId, cw, ch) {
  const tol = Math.max(2, gridStepPx() * 0.55);
  let bestX = x;
  let bestY = y;
  let bestDx = tol + 1;
  let bestDy = tol + 1;

  const candTop = y;
  const candBottom = y + h;
  const candLeft = x;
  const candRight = x + w;

  for (let i = 0; i < S.placedBlocks.length; i++) {
    const o = S.placedBlocks[i];
    if (!o || o.id === excludeId) continue;
    const oy0 = o.y;
    const oy1 = o.y + o.h;
    const ox0 = o.x;
    const ox1 = o.x + o.w;

    if (boxesOverlap1D(candTop, candBottom, oy0, oy1)) {
      const leftFlush = ox0 - w;
      const rightFlush = ox1;
      const dLeft = Math.abs(x - leftFlush);
      const dRight = Math.abs(x - rightFlush);
      if (dLeft < bestDx && dLeft <= tol) {
        bestDx = dLeft;
        bestX = leftFlush;
      }
      if (dRight < bestDx && dRight <= tol) {
        bestDx = dRight;
        bestX = rightFlush;
      }
    }

    if (boxesOverlap1D(candLeft, candRight, ox0, ox1)) {
      const topFlush = oy0 - h;
      const bottomFlush = oy1;
      const dTop = Math.abs(y - topFlush);
      const dBottom = Math.abs(y - bottomFlush);
      if (dTop < bestDy && dTop <= tol) {
        bestDy = dTop;
        bestY = topFlush;
      }
      if (dBottom < bestDy && dBottom <= tol) {
        bestDy = dBottom;
        bestY = bottomFlush;
      }
    }
  }

  const maxX = Math.max(0, cw - w);
  const maxY = Math.max(0, ch - h);
  bestX = Math.min(Math.max(0, bestX), maxX);
  bestY = Math.min(Math.max(0, bestY), maxY);
  return { x: bestX, y: bestY };
}

function computeStackSupport(F, z, excludeId) {
  const supporters = [];
  for (let i = 0; i < S.placedBlocks.length; i++) {
    const o = S.placedBlocks[i];
    if (!o || o.id === excludeId) continue;
    const top = (parseFloat(o.z) || 0) + (parseFloat(o.height) || 0);
    if (Math.abs(top - z) > EPS) continue;
    const of = blockFootprintM(o);
    const area = overlapAreaM(F, of);
    if (area > EPS) supporters.push({ id: o.id, area: area });
  }
  if (!supporters.length) return null;
  const footprintArea = Math.max(EPS, F.L * F.W);
  const maxArea = supporters.reduce(function (m, s) {
    return Math.max(m, s.area);
  }, 0);
  const overlapRatio = maxArea / footprintArea;
  const ids = supporters
    .map(function (s) {
      return String(s.id);
    })
    .sort()
    .join(",");
  return { ids: ids, overlapRatio: overlapRatio };
}

function stackHoldStatus(key, touchArmClock) {
  const now = Date.now();
  if (key !== _stackHoldState.key) {
    _stackHoldState.key = key;
    _stackHoldState.startedAt = now;
    _stackHoldState.armed = false;
  }
  if (touchArmClock) {
    _stackHoldState.armed = now - _stackHoldState.startedAt >= STACK_HOLD_MS;
  }
  const elapsed = Math.max(0, now - _stackHoldState.startedAt);
  return {
    armed: _stackHoldState.armed,
    elapsedMs: elapsed,
    remainingMs: Math.max(0, STACK_HOLD_MS - elapsed),
  };
}

function showOverlapTooltip(truck, preview) {
  const tip = document.getElementById("overlap-tooltip");
  if (!tip || !truck || !preview || preview.valid) {
    hideOverlapTooltip();
    return;
  }
  const msg = preview.message || "Cannot place here.";
  tip.textContent = msg;
  tip.hidden = false;
  tip.classList.remove("hidden");
  tip.setAttribute("role", "alert");

  requestAnimationFrame(function () {
    const tw = truck.clientWidth;
    const th = truck.clientHeight;
    const tipW = Math.max(1, tip.offsetWidth);
    const minCx = tipW / 2 + 4;
    const maxCx = Math.max(minCx, tw - tipW / 2 - 4);
    let cx = preview.rawX + preview.w / 2;
    cx = Math.min(Math.max(minCx, cx), maxCx);
    let ty = preview.rawY - tip.offsetHeight - OVERLAP_TOOLTIP_OFFSET_PX;
    if (ty < 2) {
      ty = preview.rawY + preview.h + OVERLAP_TOOLTIP_OFFSET_PX;
    }
    ty = Math.min(Math.max(2, ty), Math.max(2, th - tip.offsetHeight - 2));
    tip.style.left = cx + "px";
    tip.style.top = ty + "px";
    tip.style.transform = "translateX(-50%)";
  });
}

function overlapsSectionGap(x, y, w, h) {
  const truck = document.getElementById("truck-canvas");
  if (!truck) return false;
  const gaps = truck.querySelectorAll(".section-gap");
  if (!gaps.length) return false;
  const left = x;
  const right = x + w;
  const top = y;
  const bottom = y + h;
  for (let i = 0; i < gaps.length; i++) {
    const g = gaps[i];
    const gx = g.offsetLeft;
    const gy = g.offsetTop;
    const gw = g.offsetWidth;
    const gh = g.offsetHeight;
    const gRight = gx + gw;
    const gBottom = gy + gh;
    if (left < gRight && right > gx && top < gBottom && bottom > gy)
      return true;
  }
  return false;
}

function computePlacementPreview(
  rawX,
  rawY,
  bw,
  bh,
  height,
  excludeId,
  tooLargeMessage,
  stackPolicy,
) {
  const bed = _getCurrentBed();
  if (!bed) return null;
  const cw = Math.round(bed.length * S.scale);
  const ch = Math.round(bed.width * S.scale);
  if (bw > cw || bh > ch) {
    return {
      valid: false,
      message:
        tooLargeMessage || "Load footprint is larger than the active deck.",
    };
  }

  const xy = clampTopCorners(rawX, rawY, bw, bh, cw, ch);
  const edgeSnapped = snapNearNeighborEdges(
    xy.x,
    xy.y,
    bw,
    bh,
    excludeId,
    cw,
    ch,
  );
  xy.x = edgeSnapped.x;
  xy.y = edgeSnapped.y;
  const F = {
    x: xy.x / S.scale,
    y: xy.y / S.scale,
    L: bw / S.scale,
    W: bh / S.scale,
  };
  const z = computeAutoStackZ(F, excludeId);
  const h = parseFloat(height) || 0.3;
  const candidate = {
    id: excludeId || null,
    x: xy.x,
    y: xy.y,
    w: bw,
    h: bh,
    z: z,
    height: h,
  };

  if (overlapsSectionGap(candidate.x, candidate.y, candidate.w, candidate.h)) {
    return Object.assign(candidate, F, {
      valid: false,
      message: "Cannot place in the connector gap between sections.",
      rawX: xy.x,
      rawY: xy.y,
      xM: F.x,
      yM: F.y,
      lengthM: F.L,
      widthM: F.W,
      heightM: h,
    });
  }

  if (z > EPS && stackPolicy && stackPolicy.requireHold) {
    const support = computeStackSupport(F, z, excludeId);
    const ratio = support ? clamp01(support.overlapRatio) : 0;
    if (ratio < STACK_MIN_OVERLAP_RATIO) {
      return Object.assign(candidate, F, {
        valid: false,
        message:
          "Move further onto the load to stack (" +
          Math.round(STACK_MIN_OVERLAP_RATIO * 100) +
          "% overlap min).",
        rawX: xy.x,
        rawY: xy.y,
        xM: F.x,
        yM: F.y,
        lengthM: F.L,
        widthM: F.W,
        heightM: h,
      });
    }
    const key =
      (support ? support.ids : "none") +
      "|" +
      Math.round(F.x * 20) +
      "|" +
      Math.round(F.y * 20) +
      "|" +
      z.toFixed(3);
    const hold = stackHoldStatus(key, !!stackPolicy.touchArmClock);
    if (!hold.armed) {
      return Object.assign(candidate, F, {
        valid: false,
        message:
          "Hold to stack... " + (hold.remainingMs / 1000).toFixed(1) + "s",
        rawX: xy.x,
        rawY: xy.y,
        xM: F.x,
        yM: F.y,
        lengthM: F.L,
        widthM: F.W,
        heightM: h,
      });
    }
  }

  if (z + h > ISO_MAX_H + EPS) {
    return Object.assign(candidate, F, {
      valid: false,
      message: "Stack height would exceed maximum (" + ISO_MAX_H + " m).",
      rawX: xy.x,
      rawY: xy.y,
      xM: F.x,
      yM: F.y,
      lengthM: F.L,
      widthM: F.W,
      heightM: h,
    });
  }
  if (blockConflictsWithAny(candidate, excludeId)) {
    return Object.assign(candidate, F, {
      valid: false,
      message: "Placement overlaps another load in 3D. Try another position.",
      rawX: xy.x,
      rawY: xy.y,
      xM: F.x,
      yM: F.y,
      lengthM: F.L,
      widthM: F.W,
      heightM: h,
    });
  }

  return Object.assign(candidate, F, {
    valid: true,
    message: "",
    rawX: xy.x,
    rawY: xy.y,
    xM: F.x,
    yM: F.y,
    lengthM: F.L,
    widthM: F.W,
    heightM: h,
  });
}

export function previewLoadPlacement(load, rawX, rawY, rotated) {
  const bed = _getCurrentBed();
  if (!load || !bed) return null;
  let fp = footprintPx(load.length, load.width);
  let bw = fp.w;
  let bh = fp.h;
  if (rotated) {
    const t = bw;
    bw = bh;
    bh = t;
  }
  return computePlacementPreview(
    rawX,
    rawY,
    bw,
    bh,
    load.height || 0.3,
    null,
    "Load footprint (" +
      load.length +
      "×" +
      load.width +
      " m) is larger than the bed (" +
      bed.length +
      "×" +
      bed.width +
      " m).",
    null,
  );
}

export function previewLoadPlacementAtMeters(load, xM, yM, rotated) {
  return previewLoadPlacement(load, xM * S.scale, yM * S.scale, rotated);
}

export function previewLoadPlacementAtMetersWithPolicy(
  load,
  xM,
  yM,
  rotated,
  stackPolicy,
) {
  const bed = _getCurrentBed();
  if (!load || !bed) return null;
  let fp = footprintPx(load.length, load.width);
  let bw = fp.w;
  let bh = fp.h;
  if (rotated) {
    const t = bw;
    bw = bh;
    bh = t;
  }
  return computePlacementPreview(
    xM * S.scale,
    yM * S.scale,
    bw,
    bh,
    load.height || 0.3,
    null,
    "Load footprint (" +
      load.length +
      "×" +
      load.width +
      " m) is larger than the bed (" +
      bed.length +
      "×" +
      bed.width +
      " m).",
    stackPolicy || null,
  );
}

export function previewBlockMoveToMeters(blockId, xM, yM) {
  const block = S.placedBlocks.find(function (b) {
    return b.id === blockId;
  });
  if (!block) return null;
  return computePlacementPreview(
    xM * S.scale,
    yM * S.scale,
    block.w,
    block.h,
    block.height || 0.3,
    block.id,
    "Load footprint is larger than the active deck.",
    null,
  );
}

export function previewBlockMoveToMetersWithPolicy(
  blockId,
  xM,
  yM,
  stackPolicy,
) {
  const block = S.placedBlocks.find(function (b) {
    return b.id === blockId;
  });
  if (!block) return null;
  return computePlacementPreview(
    xM * S.scale,
    yM * S.scale,
    block.w,
    block.h,
    block.height || 0.3,
    block.id,
    "Load footprint is larger than the active deck.",
    stackPolicy || null,
  );
}

// Compute the top-view drop corner (px) for a load placed at clientX/clientY.
// Used by BOTH the drop-ghost preview and the actual drop handler so the load
// always lands exactly where the ghost was — centered on cursor, snapped, clamped.
function computeTopDropCorner(clientX, clientY, bw, bh) {
  const truck = document.getElementById("truck-canvas");
  if (!truck) return null;
  const rect = truck.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = snapPx(clientX - rect.left - bw / 2);
  const y = snapPx(clientY - rect.top - bh / 2);
  return clampTopCorners(x, y, bw, bh, S.topPxW, S.topPxH);
}

// Map screen position to drop-pixel coords in #truck-canvas space.
export function getDropPixelCoords(clientX, clientY) {
  const dragLoad = getDragPayload();
  if (S.viewMode === "top" && dragLoad) {
    const fp = footprintPx(dragLoad.length, dragLoad.width);
    const corner = computeTopDropCorner(clientX, clientY, fp.w, fp.h);
    if (corner) return { rawX: corner.x, rawY: corner.y };
  }
  if (S.viewMode === "iso" && dragLoad) {
    const iso = _getIso();
    if (iso && iso.getIsoDeckDropPixels) {
      const coords = iso.getIsoDeckDropPixels(
        clientX,
        clientY,
        dragLoad,
        false,
      );
      if (coords) return coords;
    }
    return null;
  }
  const sz = getTopViewPixelSize();
  const tw = document.getElementById("truck-canvas");
  const iso = document.getElementById("iso-three");
  const wrap = document.querySelector(".canvas-wrapper");
  let rect = null;
  if (
    tw &&
    tw.style.display !== "none" &&
    iso &&
    iso.style.display === "none"
  ) {
    rect = tw.getBoundingClientRect();
  } else if (iso && iso.style.display !== "none") {
    rect = iso.getBoundingClientRect();
  } else if (tw) {
    rect = tw.getBoundingClientRect();
  } else {
    rect = wrap.getBoundingClientRect();
  }
  const nx = (clientX - rect.left) / Math.max(rect.width, 1);
  const ny = (clientY - rect.top) / Math.max(rect.height, 1);
  return { rawX: nx * sz.w, rawY: ny * sz.h };
}

// ── DROP GHOST ──────────────────────────────────────────────────────────────
export function hideDropGhost(ghost) {
  if (!ghost) return;
  ghost.style.display = "none";
  ghost.classList.remove("is-invalid");
  hideOverlapTooltip();
}

export function updateDropGhost(e, ghost, truck) {
  const dragLoad = getDragPayload();
  if (!ghost || !truck || S.viewMode !== "top" || !dragLoad) {
    if (ghost) ghost.style.display = "none";
    hideOverlapTooltip();
    return;
  }
  const bed = _getCurrentBed();
  if (!bed) {
    hideOverlapTooltip();
    return;
  }
  const fp = footprintPx(dragLoad.length, dragLoad.width);
  const bw = fp.w;
  const bh = fp.h;
  if (bw > S.topPxW || bh > S.topPxH) {
    ghost.style.display = "none";
    hideOverlapTooltip();
    return;
  }
  const c = computeTopDropCorner(e.clientX, e.clientY, bw, bh);
  if (!c) {
    ghost.style.display = "none";
    hideOverlapTooltip();
    return;
  }
  const preview = computePlacementPreview(
    c.x,
    c.y,
    bw,
    bh,
    dragLoad.height || 0.3,
    null,
    "Load footprint (" +
      dragLoad.length +
      "×" +
      dragLoad.width +
      " m) is larger than the bed (" +
      bed.length +
      "×" +
      bed.width +
      " m).",
    { requireHold: true, touchArmClock: true },
  );
  if (!preview) {
    ghost.style.display = "none";
    hideOverlapTooltip();
    return;
  }
  ghost.style.display = "block";
  ghost.classList.toggle("is-invalid", !preview.valid);
  ghost.title =
    preview.message ||
    (preview.z > 0 ? "Will stack at " + preview.z.toFixed(2) + "m" : "");
  ghost.style.left = preview.rawX + "px";
  ghost.style.top = preview.rawY + "px";
  ghost.style.width = preview.w + "px";
  ghost.style.height = preview.h + "px";
  if (!preview.valid) {
    showOverlapTooltip(truck, preview);
  } else {
    hideOverlapTooltip();
    if (!(preview.z > EPS)) resetStackHoldState();
  }
}

// ── BLOCK LIFECYCLE ─────────────────────────────────────────────────────────
function refreshAfterBlockChange() {
  if (S.viewMode === "top") {
    _renderTopView();
  } else {
    const iso = _getIso();
    if (S.viewMode === "iso" && iso && iso.isIsoReady()) {
      iso.syncIsoThreeLoadsOnly();
    } else {
      _refreshView();
    }
  }
  updatePlacedList();
  updateMetricsBar();
  updatePanelCounts();
}

// Place ONE unit of `load` at the snapped/clamped pixel-corner (rawX, rawY).
// Refuses if the load is already fully placed (its `units` cap is hit).
export function placeBlock(load, rawX, rawY, rotated) {
  const bed = _getCurrentBed();
  if (!load || !bed) return;

  if (isLoadFullyPlaced(load)) {
    const total = parseInt(load.units, 10) || 0;
    planBanner(
      "All " +
        total +
        " unit" +
        (total !== 1 ? "s" : "") +
        " of " +
        (load.id || "this load") +
        " are already on the deck.",
    );
    return;
  }

  const tk = typeKey(load.loadType);
  let fp = footprintPx(load.length, load.width);
  let bw = fp.w;
  let bh = fp.h;
  if (rotated) {
    const t = bw;
    bw = bh;
    bh = t;
  }
  const preview = computePlacementPreview(
    rawX,
    rawY,
    bw,
    bh,
    load.height || 0.3,
    null,
    "Load footprint (" +
      load.length +
      "×" +
      load.width +
      " m) is larger than the bed (" +
      bed.length +
      "×" +
      bed.width +
      " m).",
    { requireHold: true, touchArmClock: false },
  );
  if (!preview || !preview.valid) {
    planBanner(
      accentOverlapMessage(
        (preview && preview.message) || "",
        "Cannot place load here.",
      ) || "Cannot place load here.",
    );
    return;
  }

  const block = {
    id: S.nextId++,
    loadId: load.id,
    loadType: tk,
    description: load.description || "",
    isoType: load.isoType || "",
    units: 1, // each placed block = 1 unit of the source load
    length: load.length,
    width: load.width,
    height: preview.heightM,
    z: +preview.z.toFixed(3),
    x: preview.rawX,
    y: preview.rawY,
    w: preview.w,
    h: preview.h,
    rotated: rotated,
    placedAt: Date.now(),
  };

  planBanner("");
  S.placedBlocks.push(block);

  if (S.viewMode === "top") {
    renderBlockEl(block);
  } else {
    const iso = _getIso();
    if (S.viewMode === "iso" && iso && iso.isIsoReady()) {
      iso.syncIsoThreeLoadsOnly();
    } else {
      _refreshView();
    }
  }
  updatePlacedList();
  updateMetricsBar();
  updatePanelCounts();
}

export function renderBlockEl(block) {
  const canvas = document.getElementById("truck-canvas");
  if (!canvas) return;
  const el = document.createElement("div");
  el.className = "load-block type-" + block.loadType;
  el.id = "block-" + block.id;
  el.style.left = block.x + "px";
  el.style.top = block.y + "px";
  el.style.width = block.w + "px";
  el.style.height = block.h + "px";

  const showLabel = block.w > 36 && block.h > 22;
  el.innerHTML =
    (showLabel
      ? '<span class="block-label">' + escapeHtml(block.loadId) + "</span>"
      : '<span class="block-label">' + escapeHtml(block.loadId) + "</span>") +
    (block.z > 0 ? '<span class="z-badge">↕ ' + block.z + "m</span>" : "") +
    '<div class="block-controls">' +
    '<button class="block-btn lift-btn"   title="Stack up">↑</button>' +
    '<button class="block-btn lower-btn"  title="Stack down">↓</button>' +
    '<button class="block-btn rotate-btn" title="Rotate">↻</button>' +
    '<button class="block-btn remove-btn" title="Remove">✕</button>' +
    "</div>";

  el.querySelector(".remove-btn").addEventListener("click", function (e) {
    e.stopPropagation();
    removeBlock(block.id);
  });
  el.querySelector(".rotate-btn").addEventListener("click", function (e) {
    e.stopPropagation();
    rotateBlock(block.id);
  });
  el.querySelector(".lift-btn").addEventListener("click", function (e) {
    e.stopPropagation();
    liftBlock(block.id);
  });
  el.querySelector(".lower-btn").addEventListener("click", function (e) {
    e.stopPropagation();
    lowerBlock(block.id);
  });
  el.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    if (e.target.closest(".block-btn")) return;
    startBlockDrag(e, block.id);
  });

  canvas.appendChild(el);
}

export function removeBlock(blockId) {
  S.placedBlocks = S.placedBlocks.filter(function (b) {
    return b.id !== blockId;
  });
  if (S.viewMode === "top") {
    const el = document.getElementById("block-" + blockId);
    if (el) el.remove();
  } else {
    const iso = _getIso();
    if (S.viewMode === "iso" && iso && iso.isIsoReady()) {
      iso.syncIsoThreeLoadsOnly();
    } else {
      _refreshView();
    }
  }
  updatePlacedList();
  updateMetricsBar();
  updatePanelCounts();
}

export function rotateBlock(blockId) {
  const block = S.placedBlocks.find(function (b) {
    return b.id === blockId;
  });
  if (!block) return;

  const bed = _getCurrentBed();
  if (!bed) return;
  const cw = Math.round(bed.length * S.scale);
  const ch = Math.round(bed.width * S.scale);
  const newW = block.h;
  const newH = block.w;

  if (newW > cw || newH > ch) {
    planBanner("Rotated load would not fit the truck bed.");
    return;
  }

  const prev = {
    x: block.x,
    y: block.y,
    w: block.w,
    h: block.h,
    z: block.z,
    rotated: block.rotated,
  };
  block.x = snapPx(Math.min(block.x, Math.max(0, cw - newW)));
  block.y = snapPx(Math.min(block.y, Math.max(0, ch - newH)));
  block.w = newW;
  block.h = newH;
  block.rotated = !block.rotated;

  const F = blockFootprintM(block);
  block.z = +computeAutoStackZ(F, block.id).toFixed(3);

  if (block.z + block.height > ISO_MAX_H + EPS) {
    Object.assign(block, prev);
    planBanner(
      "Cannot rotate: stack would exceed max height (" + ISO_MAX_H + " m).",
    );
    return;
  }
  if (overlapsSectionGap(block.x, block.y, block.w, block.h)) {
    Object.assign(block, prev);
    planBanner("Cannot rotate into the connector gap between sections.");
    return;
  }
  if (blockConflictsWithAny(block, block.id)) {
    Object.assign(block, prev);
    planBanner("Cannot rotate: would overlap another load.");
    return;
  }

  planBanner("");
  refreshAfterBlockChange();
}

export function liftBlock(blockId) {
  const block = S.placedBlocks.find(function (b) {
    return b.id === blockId;
  });
  if (!block) return;

  const F = blockFootprintM(block);
  const tops = [0];
  S.placedBlocks.forEach(function (o) {
    if (o.id === block.id) return;
    if (rectanglesOverlapFootprint(F, blockFootprintM(o)))
      tops.push(o.z + o.height);
  });
  const candidates = tops.filter(function (t) {
    return t > block.z + EPS;
  });
  if (!candidates.length) {
    planBanner("Stack up: overlap another load below, then lift onto it.");
    return;
  }
  const newZ = Math.min.apply(null, candidates);
  const prevZ = block.z;
  block.z = +newZ.toFixed(3);

  if (block.z + block.height > ISO_MAX_H + EPS) {
    block.z = prevZ;
    planBanner("Would exceed max stack height (" + ISO_MAX_H + " m).");
    return;
  }
  if (blockConflictsWithAny(block, block.id)) {
    block.z = prevZ;
    planBanner("Cannot stack here — collision.");
    return;
  }

  planBanner("");
  refreshAfterBlockChange();
}

export function lowerBlock(blockId) {
  const block = S.placedBlocks.find(function (b) {
    return b.id === blockId;
  });
  if (!block) return;

  const F = blockFootprintM(block);
  const below = [0];
  S.placedBlocks.forEach(function (o) {
    if (o.id === block.id) return;
    if (!rectanglesOverlapFootprint(F, blockFootprintM(o))) return;
    const top = o.z + o.height;
    if (top < block.z - EPS) below.push(top);
  });
  const newZ = Math.max.apply(null, below);
  const prevZ = block.z;
  block.z = +newZ.toFixed(3);

  if (blockConflictsWithAny(block, block.id)) {
    block.z = prevZ;
    planBanner("Cannot lower — collision.");
    return;
  }

  planBanner("");
  refreshAfterBlockChange();
}

// In-canvas drag for an already-placed block (mouse-down → move → up).
export function startBlockDrag(e, blockId) {
  const el = document.getElementById("block-" + blockId);
  const block = S.placedBlocks.find(function (b) {
    return b.id === blockId;
  });
  if (!el || !block || S.viewMode !== "top") return;

  const canvas = document.getElementById("truck-canvas");
  if (!canvas) return;
  const cr = canvas.getBoundingClientRect();
  const offX = e.clientX - cr.left - block.x;
  const offY = e.clientY - cr.top - block.y;
  const bed = _getCurrentBed();
  if (!bed) return;
  const cw = Math.round(bed.length * S.scale);
  const ch = Math.round(bed.width * S.scale);

  const ox = block.x;
  const oy = block.y;
  const oz = block.z;

  el.classList.add("dragging");

  function onMove(ev) {
    const nx = Math.min(
      Math.max(0, snapPx(ev.clientX - cr.left - offX)),
      Math.max(0, cw - block.w),
    );
    const ny = Math.min(
      Math.max(0, snapPx(ev.clientY - cr.top - offY)),
      Math.max(0, ch - block.h),
    );
    const movePreview = computePlacementPreview(
      nx,
      ny,
      block.w,
      block.h,
      block.height || 0.3,
      block.id,
      "Load footprint is larger than the active deck.",
      { requireHold: true, touchArmClock: true },
    );
    if (movePreview) {
      block.x = movePreview.rawX;
      block.y = movePreview.rawY;
      el.style.left = block.x + "px";
      el.style.top = block.y + "px";
    }
    if (movePreview && !movePreview.valid) {
      showOverlapTooltip(canvas, movePreview);
    } else {
      hideOverlapTooltip();
      if (movePreview && !(movePreview.z > EPS)) resetStackHoldState();
    }
  }

  function onUp() {
    el.classList.remove("dragging");
    hideOverlapTooltip();
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);

    const revert = function (msg) {
      block.x = ox;
      block.y = oy;
      block.z = oz;
      planBanner(
        accentOverlapMessage(msg, "Cannot move here.") ||
          msg ||
          "Cannot move here.",
      );
      _renderTopView();
    };

    const preview = computePlacementPreview(
      block.x,
      block.y,
      block.w,
      block.h,
      block.height || 0.3,
      block.id,
      "Load footprint is larger than the active deck.",
      { requireHold: true, touchArmClock: false },
    );
    if (!preview || !preview.valid) {
      revert((preview && preview.message) || "Cannot move here.");
      return;
    }
    block.x = preview.rawX;
    block.y = preview.rawY;
    block.z = +preview.z.toFixed(3);

    planBanner("");
    _renderTopView();
    const iso = _getIso();
    if (iso) iso.syncIsoThreeLoadsOnly();
    updatePlacedList();
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

// Non-destructive collision check for an ISO drag preview. xM/yM are deck-
// relative metres (top-left corner = 0,0). Pure read of S, no mutation —
// safe to call every pointermove.
export function wouldBlockMoveCollide(blockId, xM, yM) {
  const preview = previewBlockMoveToMeters(blockId, xM, yM);
  return !!(preview && !preview.valid);
}

// Commit an ISO move. xM/yM are deck-relative metres of the load's TOP-LEFT
// corner. Mirrors startBlockDrag's tail: clamp → snap → recompute Z → enforce
// max height → reject on collision. Returns true on success.
export function moveBlockToMeters(blockId, xM, yM) {
  const block = S.placedBlocks.find(function (b) {
    return b.id === blockId;
  });
  const bed = _getCurrentBed();
  if (!block || !bed) return false;

  const stackPolicy = arguments.length > 3 ? arguments[3] : null;
  const preview = previewBlockMoveToMetersWithPolicy(
    blockId,
    xM,
    yM,
    stackPolicy,
  );
  if (!preview || !preview.valid) {
    planBanner(
      accentOverlapMessage(
        (preview && preview.message) || "",
        "Cannot move here.",
      ) || "Cannot move here.",
    );
    refreshAfterBlockChange();
    return false;
  }
  block.x = preview.rawX;
  block.y = preview.rawY;
  block.z = +preview.z.toFixed(3);

  planBanner("");
  refreshAfterBlockChange();
  return true;
}

// ── Load strip (available + on-deck) ───────────────────────────────────────
export function updatePlacedList() {
  applyLoadFilters();
}

// ── CANVAS DROP ZONE ────────────────────────────────────────────────────────
export function setupCanvasDropZone() {
  const wrap = document.querySelector(".canvas-wrapper");
  const ghost = document.getElementById("drop-ghost");
  const truck = document.getElementById("truck-canvas");
  if (!wrap) return;

  wrap.addEventListener("dragover", function (e) {
    const dragLoad = getDragPayload();
    if (!S.selectedTruck || !dragLoad) return;
    // Read-only ortho views: refuse the drop so the cursor shows "not allowed".
    if (
      S.viewMode === "left" ||
      S.viewMode === "right" ||
      S.viewMode === "front" ||
      S.viewMode === "back"
    ) {
      e.dataTransfer.dropEffect = "none";
      hideDropGhost(ghost);
      hideOverlapTooltip();
      const iso = _getIso();
      if (iso && iso.hideIsoDropGhost) iso.hideIsoDropGhost();
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    wrap.classList.add("drag-active");
    if (S.viewMode === "iso") {
      hideDropGhost(ghost);
      hideOverlapTooltip();
      const iso = _getIso();
      if (iso && iso.updateIsoDropGhost)
        iso.updateIsoDropGhost(e.clientX, e.clientY, dragLoad, false);
    } else {
      const iso = _getIso();
      if (iso && iso.hideIsoDropGhost) iso.hideIsoDropGhost();
      updateDropGhost(e, ghost, truck);
    }
  });

  wrap.addEventListener("dragleave", function () {
    wrap.classList.remove("drag-active");
    hideDropGhost(ghost);
    resetStackHoldState();
    const iso = _getIso();
    if (iso && iso.hideIsoDropGhost) iso.hideIsoDropGhost();
  });

  wrap.addEventListener("drop", function (e) {
    e.preventDefault();
    wrap.classList.remove("drag-active");
    hideDropGhost(ghost);
    const iso = _getIso();
    if (iso && iso.hideIsoDropGhost) iso.hideIsoDropGhost();
    const dragLoad = getDragPayload();
    if (!dragLoad || !S.selectedTruck) return;
    if (
      S.viewMode === "left" ||
      S.viewMode === "right" ||
      S.viewMode === "front" ||
      S.viewMode === "back"
    ) {
      clearDragPayload();
      return;
    }
    const coords = getDropPixelCoords(e.clientX, e.clientY);
    if (!coords) {
      clearDragPayload();
      return;
    }
    placeBlock(dragLoad, coords.rawX, coords.rawY, false);
    resetStackHoldState();
    clearDragPayload();
  });
}
