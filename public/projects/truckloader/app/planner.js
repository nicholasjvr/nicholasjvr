// ── CORE IMPORTS ────────────────────────────────────────────────────────────
// Shared foundations live in ./core/ — pure helpers, constants, state.
// Anything imported here is safe to use from any feature folder.
import {
  TRUCK_BEDS,
  DEFAULT_TRAILER_DECK_WIDTH,
  GRID_STEP_M,
  MIN_PLACE_PX,
  FALLBACK_CVS_W,
  FALLBACK_CVS_H,
  MIN_SCALE_PX_PER_M,
  ISO_MAX_H,
  EPS,
} from "./core/constants.js";
import { S } from "./core/state.js";
import {
  blockFootprintM,
  rectsOverlap2D,
  rectanglesOverlapFootprint,
  blocksVolumeOverlap,
  blockConflictsWithAny,
  computeAutoStackZ,
} from "./core/collision.js";
import {
  initCabMarker,
  syncCabMarker,
  cabExtraLenMForTop,
} from "./truckcab/index.js";
import {
  initDeck,
  gridStepPx,
  snapPx,
  updateGridOverlayFromScale,
  parseSectionLength,
  renderSectionDividers,
  updateTopViewMetrics,
  setTopDimLabels,
  setOrthoDimLabels,
  clearDimLabels,
} from "./deck/index.js";
import { getDemoScenarios, getDemoScenarioById } from "./data/index.js";
import {
  initUi,
  planBanner,
  hideIsoContextMenu,
  showIsoContextMenu,
  updateMetricsBar,
  updatePanelCounts,
} from "./ui/index.js";
import { typeKey, typeLabel, escapeHtml, footprintPx } from "./core/utils.js";
import {
  initLoads,
  renderLoadList,
  applyLoadFilters,
  setupLoadFilters,
  getAllLoads,
  getLoadFilters,
  placeBlock,
  removeBlock,
  rotateBlock,
  moveBlockToMeters,
  previewLoadPlacementAtMeters,
  previewLoadPlacementAtMetersWithPolicy,
  previewBlockMoveToMeters,
  previewBlockMoveToMetersWithPolicy,
  updatePlacedList,
  setupCanvasDropZone,
} from "./loads/index.js";
import { renderBlockEl } from "./loads/placement.js";
import {
  initPlanning2d,
  renderTopView,
  renderOrthoView,
} from "./planning2d/index.js";

// ── DEMO FLAGS ──────────────────────────────────────────────────────────────
// Plays a short "load dispatched" cinematic on Save (cut to side view, the
// loaded rig drives off-screen, then resets). Demo polish only — set false to
// restore an instant, animation-free Save.
const DEMO_SAVE_CINEMATIC = true;

// ── ISO 3D MODULE FACADE ────────────────────────────────────────────────────
// All Three.js (scene / tractor / trailer) lives under ./iso. We lazy-load on
// first 3D view entry and stash the loaded module so synchronous callers (drop
// handlers, block edits) can route through it without awaiting again.
var _iso = null;
var _isoLoadPromise = null;
function ensureIso() {
  if (_isoLoadPromise) return _isoLoadPromise;
  _isoLoadPromise = import("./iso/scene.js").then(function (mod) {
    mod.initIso({
      getCurrentBed: getCurrentBed,
      getActiveTrailerType: getActiveTrailerType,
      normalizeLayoutKey: normalizeLayoutKey,
      planBanner: planBanner,
      getViewMode: function () {
        return S.viewMode;
      },
      getSelectedTruck: function () {
        return S.selectedTruck;
      },
      getSelectedTrailer: function () {
        return S.selectedTrailer;
      },
      getPlacedBlocks: function () {
        return S.placedBlocks;
      },
      getScale: function () {
        return S.scale;
      },
      getShowIsoLabels: function () {
        return !!S.showIsoLabels;
      },
      moveBlockToMeters: moveBlockToMeters,
      previewLoadPlacementAtMeters: previewLoadPlacementAtMeters,
      previewLoadPlacementAtMetersWithPolicy:
        previewLoadPlacementAtMetersWithPolicy,
      previewBlockMoveToMeters: previewBlockMoveToMeters,
      previewBlockMoveToMetersWithPolicy: previewBlockMoveToMetersWithPolicy,
      onIsoBlockContextMenu: showIsoContextMenu,
      onIsoEmptyContextMenu: hideIsoContextMenu,
    });
    _iso = mod;
    return mod;
  });
  return _isoLoadPromise;
}

var _canvasStageRo = null;

// ── UTILITIES ────────────────────────────────────────────────────────────────
function normalizeLayoutKey(layoutRaw) {
  var raw = String(layoutRaw || "").trim();
  if (TRUCK_BEDS[raw]) return raw;
  var compact = raw.toLowerCase().replace(/[\s-]+/g, "");
  for (var k in TRUCK_BEDS) {
    if (!Object.prototype.hasOwnProperty.call(TRUCK_BEDS, k)) continue;
    var kk = k.toLowerCase().replace(/[\s-]+/g, "");
    if (kk === compact) return k;
  }
  return raw;
}

/** Resolved bed length/width in metres for the selected truck.
 *  Side-effect: sets `truck._layoutWarning` to a user-facing string when the layout
 *  is unrecognised and we fall through to the 8×2.4 default — so the UI can warn
 *  ops that planning is happening against a guess. Cleared on every successful match.
 */
function resolveBedDims(truck) {
  if (!truck) return null;
  var L = parseFloat(truck.bedLengthM);
  var W = parseFloat(truck.bedWidthM);
  if (Number.isFinite(L) && L > 0.1 && Number.isFinite(W) && W > 0.1) {
    truck._layoutWarning = "";
    return { length: L, width: W };
  }
  var key = normalizeLayoutKey(truck.layout);
  var b = TRUCK_BEDS[key] || TRUCK_BEDS[truck.layout];
  if (b) {
    truck._layoutWarning = "";
    return { length: b.length, width: b.width };
  }
  truck._layoutWarning =
    "Truck '" +
    (truck.fleetNumber || truck.id) +
    "' has no recognised Truck_Layout ('" +
    (truck.layout || "") +
    "') — defaulting to 8×2.4 m.";
  return { length: 8, width: 2.4 };
}

/** Active planning bed: trailer overrides truck when a trailer type is selected. */
function getPlanningBed() {
  if (!S.selectedTruck) return null;
  if (S.selectedTrailer && S.selectedTrailer.bedLengthM > 0) {
    var w = S.selectedTrailer.bedWidthM;
    if (!Number.isFinite(w) || w <= 0) w = DEFAULT_TRAILER_DECK_WIDTH;
    return { length: S.selectedTrailer.bedLengthM, width: w };
  }
  return resolveBedDims(S.selectedTruck);
}

// ── BED + PLACEMENT VALIDATION (metres / px) ────────────────────────────────
function getCurrentBed() {
  if (!S.selectedTruck) return null;
  return getPlanningBed();
}

function getPlanningCanvasPixelBudget() {
  var stage = document.querySelector(".canvas-stage");
  if (!stage) return { w: FALLBACK_CVS_W, h: FALLBACK_CVS_H };
  var r = stage.getBoundingClientRect();
  var padX = 24;
  var padY = 32;
  var w = Math.floor(r.width - padX * 2);
  var h = Math.floor(r.height - padY * 2);
  w = Math.max(260, Math.min(w, 2000));
  h = Math.max(180, Math.min(h, 1200));
  return { w: w, h: h };
}

/**
 * Recompute px-per-metre from the current stage budget AND rescale every placed
 * block by the new/old ratio so loads stay anchored to their metre-position when
 * the canvas grows or shrinks. Every caller (buildCanvas, ResizeObserver,
 * applyExpandedLayout) goes through here, so the rescale can never be skipped.
 */
function recomputeScaleFromBed(bed) {
  var bud = getPlanningCanvasPixelBudget();
  var denomW = bed.length + cabExtraLenMForTop(bed);
  var s = Math.min(bud.w / denomW, bud.h / bed.width, bud.h / ISO_MAX_H);
  if (!Number.isFinite(s) || s <= 0) {
    s = FALLBACK_CVS_W / Math.max(bed.length, 0.01);
  }
  var next = Math.max(s, MIN_SCALE_PX_PER_M);
  var prev = S.scale;
  S.scale = next;
  if (prev && next && Math.abs(next - prev) > EPS && S.placedBlocks.length) {
    var k = next / prev;
    S.placedBlocks.forEach(function (b) {
      b.x = b.x * k;
      b.y = b.y * k;
      b.w = b.w * k;
      b.h = b.h * k;
    });
  }
}

function installCanvasStageResizeObserver() {
  var stage = document.querySelector(".canvas-stage");
  if (!stage || _canvasStageRo) return;
  _canvasStageRo = new ResizeObserver(function () {
    if (!S.selectedTruck) return;
    var bed = getPlanningBed();
    if (!bed) return;
    recomputeScaleFromBed(bed);
    if (S.viewMode === "iso") return;
    refreshView();
  });
  _canvasStageRo.observe(stage);
}

// ── 3D label visibility toggle ────────────────────────────────────────────────

function setupIsoLabelToggle() {
  var box = document.getElementById("iso-labels-toggle");
  if (!box) return;
  box.checked = !!S.showIsoLabels;
  box.addEventListener("change", function () {
    S.showIsoLabels = !!box.checked;
    if (_iso && _iso.applyIsoLabelVisibility) {
      _iso.applyIsoLabelVisibility(S.showIsoLabels);
    }
  });
}

/** Toggle read-only state for the planning canvas on non-Top ortho views. */
function applyReadOnlyView() {
  var wrap = document.querySelector(".canvas-wrapper");
  var veil = document.getElementById("view-readonly-veil");
  if (!wrap || !veil) return;
  var v = S.viewMode;
  var readonly = v === "left" || v === "right" || v === "front" || v === "back";
  wrap.classList.toggle("canvas-wrapper--readonly", readonly);
  veil.hidden = !readonly;
}

// ── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", function () {
  initCabMarker({ getCurrentBed: getCurrentBed });
  initDeck({
    getCurrentBed: getCurrentBed,
    getActiveTrailerType: getActiveTrailerType,
  });
  initPlanning2d({
    getCurrentBed: getCurrentBed,
    getIso: function () {
      return _iso;
    },
  });
  initLoads({
    getCurrentBed: getCurrentBed,
    getIso: function () {
      return _iso;
    },
    refreshView: refreshView,
    renderTopView: renderTopView,
    onListChanged: updatePanelCounts,
  });
  initUi({
    getCurrentBed: getCurrentBed,
    getAllLoads: getAllLoads,
    getLoadFilters: getLoadFilters,
    typeKey: typeKey,
    onMove: function (id) {
      if (_iso && _iso.beginMoveMode) _iso.beginMoveMode(id);
    },
    onRotate: rotateBlock,
    onRemove: removeBlock,
  });
  wireButtons();
  setupCanvasDropZone();
  installCanvasStageResizeObserver();
  setupFocusWorkspace();
  setupWorkModeAndViews();
  setupLoadFilters();
  setupIsoLabelToggle();
  updateMetricsBar();
  updatePanelCounts();

  initDemo();
});

// ── DEMO SCENARIOS ───────────────────────────────────────────────────────────
function renderScenarioDropdown() {
  var sel = document.getElementById("scenario-select");
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select scenario —</option>';
  getDemoScenarios().forEach(function (s) {
    var opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    sel.appendChild(opt);
  });
}

function initDemo() {
  renderScenarioDropdown();
  var scenarios = getDemoScenarios();
  if (!scenarios.length) {
    planBanner("No demo scenarios configured.");
    return;
  }
  applyScenario(scenarios[0].id);
  var sel = document.getElementById("scenario-select");
  if (sel) sel.value = scenarios[0].id;
}

function applyScenario(scenarioId) {
  var scenario = getDemoScenarioById(scenarioId);
  if (!scenario) {
    console.warn("[LoadPlanner] applyScenario: unknown id:", scenarioId);
    return;
  }

  S.selectedScenarioId = scenario.id;
  S.selectedTruck = scenario.truck ? Object.assign({}, scenario.truck) : null;
  S.selectedTrailer = scenario.trailer
    ? Object.assign({}, scenario.trailer)
    : null;
  S.trailerTypes = scenario.trailerType ? [scenario.trailerType] : [];
  S.loads = (scenario.loads || []).map(function (l) {
    return Object.assign({}, l);
  });
  S.placedBlocks = [];

  if (!S.selectedTruck) {
    resetCanvas();
    renderFleetBar(null);
    renderLoadList([]);
    planBanner("Scenario has no truck configuration.");
    return;
  }

  buildCanvas(S.selectedTruck);
  renderFleetBar(S.selectedTruck);
  renderLoadList(S.loads);
  updateMetricsBar();
  updatePanelCounts();
  planBanner("");

  if (S.selectedTruck._layoutWarning) {
    planBanner(S.selectedTruck._layoutWarning);
  }
}

function onScenarioChange(scenarioId) {
  if (!scenarioId) {
    S.selectedScenarioId = null;
    S.selectedTruck = null;
    S.selectedTrailer = null;
    S.loads = [];
    S.trailerTypes = [];
    S.placedBlocks = [];
    resetCanvas();
    renderFleetBar(null);
    renderLoadList([]);
    updateMetricsBar();
    updatePanelCounts();
    return;
  }
  applyScenario(scenarioId);
}

// ── CANVAS ───────────────────────────────────────────────────────────────────
function buildCanvas(truck) {
  const bed = getPlanningBed();
  if (!bed) return;

  recomputeScaleFromBed(bed);

  const pxW = Math.round(bed.length * S.scale);
  const pxH = Math.round(bed.width * S.scale);

  const canvas = document.getElementById("truck-canvas");
  canvas.style.width = pxW + "px";
  canvas.style.height = pxH + "px";
  canvas.style.display = "block";
  canvas.querySelectorAll(".load-block").forEach(function (el) {
    el.remove();
  });

  document.getElementById("iso-canvas").style.display = "none";
  var isoVp = document.getElementById("iso-viewport");
  if (isoVp) isoVp.hidden = true;
  var isoEl = document.getElementById("iso-three");
  if (isoEl) {
    isoEl.style.display = "none";
    isoEl.innerHTML = "";
  }
  if (_iso) _iso.disposeIsoThree();

  const ph = document.getElementById("canvas-placeholder");
  if (ph) ph.style.display = "none";

  S.viewMode = "top";
  S.lastPlanView = "top";
  document.querySelectorAll(".view-btn").forEach(function (b) {
    b.classList.toggle("active", b.dataset.view === "top");
  });

  syncWorkModeUI();
  renderTopView();
}

function resetCanvas() {
  if (_iso) _iso.disposeIsoThree();
  var isoVp = document.getElementById("iso-viewport");
  if (isoVp) isoVp.hidden = true;
  var isoEl = document.getElementById("iso-three");
  if (isoEl) {
    isoEl.style.display = "none";
    isoEl.innerHTML = "";
  }
  document.getElementById("iso-canvas").style.display = "none";
  const canvas = document.getElementById("truck-canvas");
  canvas.style.width = "300px";
  canvas.style.height = "200px";
  canvas.querySelectorAll(".load-block").forEach(function (el) {
    el.remove();
  });
  const ph = document.getElementById("canvas-placeholder");
  if (ph) ph.style.display = "flex";
  clearDimLabels();
  S.viewMode = "top";
  S.lastPlanView = "top";
  document.querySelectorAll(".view-btn").forEach(function (b) {
    b.classList.toggle("active", b.dataset.view === "top");
  });
  syncWorkModeUI();
  syncCabMarker();
}

// ── Retractable scenario summary popover (`#plan-summary-chips`) ────────────
function fleetChip(label, value, tip) {
  var titleAttr =
    typeof tip === "string" && tip.trim()
      ? ' title="' + escapeHtml(tip.trim()) + '"'
      : "";
  return (
    '<span class="fleet-bar__chip"' +
    titleAttr +
    '><span class="fleet-bar__label">' +
    escapeHtml(label) +
    '</span><span class="fleet-bar__value">' +
    escapeHtml(value) +
    "</span></span>"
  );
}

function renderFleetBar(truck) {
  var el = document.getElementById("plan-summary-chips");
  if (!el) return;

  if (!S.selectedScenarioId) {
    el.innerHTML =
      '<p class="fleet-bar__empty">Choose a scenario, then open Info for the summary.</p>';
    return;
  }

  var scenario = getDemoScenarioById(S.selectedScenarioId);
  var scenarioLabel = scenario ? scenario.label : S.selectedScenarioId;
  var parts = [];
  parts.push(fleetChip("Scenario", scenarioLabel));

  if (!truck) {
    parts.push(fleetChip("Vehicle", "Not loaded"));
    el.innerHTML =
      '<div class="plan-summary-chip-row plan-summary-chip-row--stack">' +
      parts.join("") +
      "</div>";
    return;
  }

  var tipParts = [];
  if (truck.layout) tipParts.push(String(truck.layout));
  var truckBed = resolveBedDims(truck);
  tipParts.push("Truck bed " + truckBed.length + "m × " + truckBed.width + "m");
  parts.push(
    fleetChip("Truck", truck.fleetNumber || "—", tipParts.join(" · ")),
  );

  var planningBed = getPlanningBed();
  if (planningBed) {
    parts.push(
      fleetChip(
        "Planning deck",
        planningBed.length + "m × " + planningBed.width + "m",
        S.selectedTrailer ? "Trailer deck" : "Truck bed",
      ),
    );
  }

  if (S.selectedTrailer) {
    var tr = S.selectedTrailer;
    var rig =
      String(tr.trailerType || tr.trailerTypeLabel || "Trailer").trim() ||
      "Trailer";
    var typeDef = tr.typeId
      ? (S.trailerTypes || []).find(function (tt) {
          return String(tt.id) === String(tr.typeId);
        })
      : null;
    var rigTipParts = [];
    rigTipParts.push(tr.bedLengthM + "m × " + tr.bedWidthM + "m deck");
    if (typeDef && typeDef.sections && typeDef.sections.length) {
      rigTipParts.push(
        typeDef.sections.length + " sections · " + typeDef.totalLengthM + "m",
      );
    }
    parts.push(fleetChip("Trailer", rig, rigTipParts.join(" · ")));
  } else {
    parts.push(fleetChip("Rig", "Truck-only", ""));
  }

  el.innerHTML =
    '<div class="plan-summary-chip-row plan-summary-chip-row--stack">' +
    parts.join("") +
    "</div>";
}

let _modalPendingResolve = null;
let _modalKeyHandlerBound = false;
let _modalMode = "confirm";

function showAppModal(opts) {
  const modal = document.getElementById("app-modal");
  const titleEl = document.getElementById("app-modal-title");
  const msgEl = document.getElementById("app-modal-message");
  const okBtn = document.getElementById("app-modal-ok");
  const cancelBtn = document.getElementById("app-modal-cancel");
  if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) {
    return Promise.resolve(false);
  }

  const title = (opts && opts.title) || "Confirm action";
  const message = (opts && opts.message) || "";
  const okText = (opts && opts.okText) || "OK";
  const cancelText = (opts && opts.cancelText) || "Cancel";
  const mode = (opts && opts.mode) || "confirm"; // confirm | info
  _modalMode = mode;

  titleEl.textContent = title;
  msgEl.textContent = message;
  okBtn.textContent = okText;
  cancelBtn.textContent = cancelText;
  cancelBtn.hidden = mode === "info";

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");

  function close(result) {
    if (modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    if (_modalPendingResolve) {
      const resolve = _modalPendingResolve;
      _modalPendingResolve = null;
      resolve(!!result);
    }
  }

  return new Promise(function (resolve) {
    _modalPendingResolve = resolve;

    okBtn.onclick = function () {
      close(true);
    };
    cancelBtn.onclick = function () {
      close(false);
    };
    modal.onclick = function (e) {
      const t = e.target;
      if (
        t &&
        t.getAttribute &&
        t.getAttribute("data-modal-close") === "1" &&
        mode !== "info"
      ) {
        close(false);
      }
    };
    if (!_modalKeyHandlerBound) {
      _modalKeyHandlerBound = true;
      document.addEventListener("keydown", function (e) {
        if (!modal || modal.hidden || !_modalPendingResolve) return;
        if (e.key === "Escape" && _modalMode !== "info") {
          e.preventDefault();
          close(false);
        } else if (e.key === "Enter") {
          e.preventDefault();
          close(true);
        }
      });
    }
  });
}

function appConfirm(title, message, okText, cancelText) {
  return showAppModal({
    mode: "confirm",
    title: title,
    message: message,
    okText: okText || "OK",
    cancelText: cancelText || "Cancel",
  });
}

function appNotice(title, message, okText) {
  return showAppModal({
    mode: "info",
    title: title,
    message: message,
    okText: okText || "OK",
    cancelText: "",
  });
}

// ── CLEAR & SAVE ──────────────────────────────────────────────────────────────
async function clearCanvas() {
  if (!S.placedBlocks.length) return;
  const confirmed = await appConfirm(
    "Clear placed loads",
    "Remove all placed loads from the truck?",
    "Clear",
    "Cancel",
  );
  if (!confirmed) return;
  S.placedBlocks = [];
  document
    .getElementById("truck-canvas")
    .querySelectorAll(".load-block")
    .forEach(function (el) {
      el.remove();
    });
  var isoCvs = document.getElementById("iso-canvas");
  var ctx = isoCvs.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, isoCvs.width, isoCvs.height);
  if (_iso) _iso.syncIsoThreeLoadsOnly();
  updatePlacedList();
  updateMetricsBar();
  updatePanelCounts();
  planBanner("");
}

async function saveLayout() {
  if (!S.selectedTruck) {
    await appNotice("No truck selected", "Please select a truck first.");
    return;
  }
  if (!S.placedBlocks.length) {
    await appNotice("No loads on deck", "No loads placed on the truck yet.");
    return;
  }

  // Build payload for demo — logged to console on Save
  const payload = {
    scenarioId: S.selectedScenarioId,
    truck: {
      id: S.selectedTruck.id,
      fleetNumber: S.selectedTruck.fleetNumber,
      layout: S.selectedTruck.layout,
    },
    trailer: S.selectedTrailer
      ? {
          id: S.selectedTrailer.id,
          trailerType: S.selectedTrailer.trailerType,
          bedLengthM: S.selectedTrailer.bedLengthM,
          bedWidthM: S.selectedTrailer.bedWidthM,
        }
      : null,
    planningDeck: (function () {
      var b = getCurrentBed();
      return {
        length_m: b.length,
        width_m: b.width,
        source: S.selectedTrailer ? "trailer" : "truck",
      };
    })(),
    loads: S.placedBlocks.map(function (b) {
      var sc = S.scale;
      return {
        loadId: b.loadId,
        loadType: b.loadType,
        description: b.description,
        units: b.units,
        x_m: +(b.x / sc).toFixed(4),
        y_m: +(b.y / sc).toFixed(4),
        z_m: +(b.z || 0).toFixed(4),
        length_m: +(b.w / sc).toFixed(4),
        width_m: +(b.h / sc).toFixed(4),
        height_m: +(b.height || 0.3).toFixed(4),
        rotated: b.rotated,
        x_px: b.x,
        y_px: b.y,
        w_px: b.w,
        h_px: b.h,
      };
    }),
    savedAt: new Date().toISOString(),
  };

  console.log(
    "Load Planner Demo — layout payload:",
    JSON.stringify(payload, null, 2),
  );

  if (DEMO_SAVE_CINEMATIC) {
    await playSaveCinematic();
  }

  await appNotice(
    "Layout saved",
    "Layout saved for truck " +
      S.selectedTruck.fleetNumber +
      " with " +
      S.placedBlocks.length +
      " load(s).\nSee browser console for payload.",
  );
}

// ── DEMO: SAVE DRIVE-OFF CINEMATIC ───────────────────────────────────────────
/** Ensure the 3D preview is live, then play the drive-off cinematic. Best-effort:
 *  any failure falls through so the "Layout saved" modal still confirms the save. */
async function playSaveCinematic() {
  try {
    const iso = await ensureIso();
    if (!iso || !iso.playIsoSaveCinematic) return;
    if (iso.isIsoCinematicPlaying && iso.isIsoCinematicPlaying()) return;

    /* Saved from the planning view — switch into 3D Preview first. */
    if (S.viewMode !== "iso") {
      S.lastPlanView = S.viewMode;
      S.viewMode = "iso";
      document.querySelectorAll(".view-btn").forEach(function (b) {
        b.classList.toggle("active", false);
      });
      syncWorkModeUI();
      refreshView();
    }

    /* The iso scene builds asynchronously (module import + texture preload), so
     * wait for it to be ready before driving the rig off-screen. */
    const ready = await waitForIsoReady(iso, 4000);
    if (!ready) return;

    await iso.playIsoSaveCinematic();
  } catch (err) {
    console.warn("Save cinematic skipped:", err);
  }
}

/** Poll until the iso scene has finished building (or the timeout elapses). */
function waitForIsoReady(iso, timeoutMs) {
  return new Promise(function (resolve) {
    const start = Date.now();
    (function poll() {
      if (iso.isIsoReady && iso.isIsoReady()) {
        resolve(true);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(poll, 60);
    })();
  });
}

// ── MULTI-VIEW ────────────────────────────────────────────────────────────────
function syncWorkModeUI() {
  var is3d = S.viewMode === "iso";
  var qc = document.getElementById("iso-quick-config");
  var isoVp = document.getElementById("iso-viewport");
  if (qc) qc.hidden = !is3d;
  if (isoVp) isoVp.hidden = !is3d;
  var chipPlan = document.getElementById("work-mode-plan");
  var chipPrev = document.getElementById("work-mode-preview");
  if (chipPlan) {
    chipPlan.classList.toggle("active", !is3d);
    chipPlan.classList.toggle("ws-tab--active", !is3d);
    chipPlan.setAttribute("aria-selected", !is3d ? "true" : "false");
  }
  if (chipPrev) {
    chipPrev.classList.toggle("active", is3d);
    chipPrev.classList.toggle("ws-tab--active", is3d);
    chipPrev.setAttribute("aria-selected", is3d ? "true" : "false");
  }
  var wrap = document.querySelector(".canvas-wrapper");
  var st = document.querySelector(".canvas-stage");
  var ws = document.querySelector(".workspace");
  if (wrap) wrap.classList.toggle("canvas-wrapper--iso", is3d);
  if (st) st.classList.toggle("canvas-stage--iso", is3d);
  if (ws) ws.classList.toggle("workspace--iso", is3d);
  /* Leaving 3D — make sure any open context menu / armed move-mode is reset. */
  if (!is3d) {
    hideIsoContextMenu();
    if (_iso && _iso.cancelMoveMode) _iso.cancelMoveMode();
  }
  applyReadOnlyView();
}

function setupFocusWorkspace() {
  var btn = document.getElementById("focus-workspace-btn");
  var main = document.querySelector(".main");
  if (!btn || !main) return;
  function applyExpandedLayout() {
    requestAnimationFrame(function () {
      if (!S.selectedTruck) return;
      var bed = getPlanningBed();
      if (!bed) return;
      recomputeScaleFromBed(bed);
      refreshView();
    });
  }
  btn.addEventListener("click", function () {
    S.workspaceExpanded = !S.workspaceExpanded;
    main.classList.toggle("main--focus", S.workspaceExpanded);
    btn.textContent = S.workspaceExpanded ? "Show trip panel" : "Expand canvas";
    applyExpandedLayout();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !S.workspaceExpanded) return;
    S.workspaceExpanded = false;
    main.classList.remove("main--focus");
    btn.textContent = "Expand canvas";
    applyExpandedLayout();
  });
}

function setupWorkModeAndViews() {
  document.querySelectorAll(".view-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!S.selectedTruck) return;
      var v = btn.dataset.view;
      if (!v) return;
      S.lastPlanView = v;
      S.viewMode = v;
      document.querySelectorAll(".view-btn").forEach(function (b) {
        b.classList.toggle("active", b.dataset.view === S.viewMode);
      });
      syncWorkModeUI();
      refreshView();
    });
  });

  var chipPlan = document.getElementById("work-mode-plan");
  var chipPrev = document.getElementById("work-mode-preview");
  if (chipPlan) {
    chipPlan.addEventListener("click", function () {
      if (!S.selectedTruck) return;
      /* Side views (left/right/front/back) no longer have UI buttons — they're
         shown as live mini-previews instead. Force any stale lastPlanView to
         top so chipPlan can never surface a removed ortho mode. */
      var back = S.lastPlanView || "top";
      if (back !== "top") back = "top";
      S.viewMode = back;
      document.querySelectorAll(".view-btn").forEach(function (b) {
        b.classList.toggle("active", b.dataset.view === S.viewMode);
      });
      syncWorkModeUI();
      refreshView();
    });
  }
  if (chipPrev) {
    chipPrev.addEventListener("click", function () {
      if (!S.selectedTruck) return;
      if (S.viewMode !== "iso") S.lastPlanView = S.viewMode;
      S.viewMode = "iso";
      document.querySelectorAll(".view-btn").forEach(function (b) {
        b.classList.toggle("active", false);
      });
      syncWorkModeUI();
      refreshView();
    });
  }
}

function refreshView() {
  if (!S.selectedTruck) return;
  switch (S.viewMode) {
    case "top":
      renderTopView();
      break;
    case "left":
      renderOrthoView("left");
      break;
    case "right":
      renderOrthoView("right");
      break;
    case "front":
      renderOrthoView("front");
      break;
    case "back":
      renderOrthoView("back");
      break;
    case "iso":
      renderIsoView();
      break;
    default:
      S.viewMode = "top";
      document.querySelectorAll(".view-btn").forEach(function (b) {
        b.classList.toggle("active", b.dataset.view === "top");
      });
      renderTopView();
      break;
  }
  syncWorkModeUI();
}

/** Return the selected trailer's resolved type-definition (with sections), or null. */
function getActiveTrailerType() {
  if (!S.selectedTrailer || !S.selectedTrailer.typeId) return null;
  var tt = (S.trailerTypes || []).find(function (t) {
    return String(t.id) === String(S.selectedTrailer.typeId);
  });
  if (!tt || !tt.sections || !tt.sections.length) return null;
  return tt;
}

function renderIsoView() {
  /* Hide 2D canvases up-front so the user sees the iso container immediately;
   * the iso module finishes scene setup once the dynamic import resolves. */
  if (_iso) _iso.stopIsoAnimation();
  syncCabMarker();
  ensureIso()
    .then(function (iso) {
      iso.renderIsoView();
    })
    .catch(function (err) {
      console.error("ISO module failed to load:", err);
      planBanner(
        '3D viewer failed to load — check network and that an import map for "three" is in the page.',
      );
    });
}

// ── BUTTON WIRING ─────────────────────────────────────────────────────────────
function wireButtons() {
  var scenarioSel = document.getElementById("scenario-select");
  if (scenarioSel) {
    scenarioSel.addEventListener("change", function (e) {
      onScenarioChange(e.target.value);
    });
  }
  document.getElementById("clear-btn").addEventListener("click", clearCanvas);
  document.getElementById("save-btn").addEventListener("click", saveLayout);
}
