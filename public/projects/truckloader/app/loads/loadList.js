// Bottom load strip — available loads + on-deck cards. Owns filters and drag metadata.
//
// Holds the canonical _allLoads cache for the current scenario + the active filter state.

import { S } from "../core/state.js";
import { typeKey, typeLabel, escapeHtml } from "../core/utils.js";
import { remainingUnitsForLoad, isLoadFullyPlaced } from "./units.js";
import { setDragPayload } from "./dragPayload.js";

let _allLoads = [];
const _loadFilters = { search: "", type: "all" };

let _onListChanged = function () {};
let _removePlacedBlock = function (/* blockId */) {};

export function initLoadList(ctx) {
  if (ctx && typeof ctx.onListChanged === "function") {
    _onListChanged = ctx.onListChanged;
  }
  if (ctx && typeof ctx.onRemovePlacedBlock === "function") {
    _removePlacedBlock = ctx.onRemovePlacedBlock;
  }
}

export function getAllLoads() {
  return _allLoads;
}
export function getLoadFilters() {
  return _loadFilters;
}

export function renderLoadList(loads) {
  _allLoads = loads || [];
  applyLoadFilters();
}

export function applyLoadFilters() {
  const q = String(_loadFilters.search || "")
    .trim()
    .toLowerCase();
  const t = _loadFilters.type || "all";
  const filtered = _allLoads.filter(function (l) {
    if (t !== "all" && typeKey(l.loadType) !== t) return false;
    if (!q) return true;
    const hay = [l.id, l.loadType, l.isoType, l.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.indexOf(q) !== -1;
  });
  _renderLoadStrip(filtered);
  _onListChanged();
}

function updateLoadStripSectionPills(onDeckUnits, deckGroupCount, availCount) {
  var deckP = document.getElementById("load-strip-pill-deck");
  var avP = document.getElementById("load-strip-pill-avail");
  if (deckP) {
    deckP.textContent =
      !onDeckUnits && !deckGroupCount
        ? "On deck (0 u · 0 loads)"
        : "On deck (" +
          onDeckUnits +
          " u · " +
          deckGroupCount +
          " load" +
          (deckGroupCount !== 1 ? "s" : "") +
          ")";
  }
  if (avP) avP.textContent = "Available (" + availCount + ")";
}

function loadDisplayName(item) {
  return (item && (item.description || item.id)) || "\u2014";
}

/**
 * Returns groups in first-seen order on the strip.
 */
function groupOnDeckBlocksByLoadId(onDeck) {
  const orderedKeys = [];
  const map = Object.create(null);

  onDeck.forEach(function (b) {
    const key =
      b.loadId != null && String(b.loadId) !== ""
        ? String(b.loadId)
        : "id-" + b.id;
    if (!map[key]) {
      map[key] = [];
      orderedKeys.push(key);
    }
    map[key].push(b);
  });

  return orderedKeys.map(function (k) {
    return { loadIdKey: k, blocks: map[k] };
  });
}

/** One compact summary card per consignment — not draggable; remove peels last-placed unit. */
function createOnDeckGroupCard(group) {
  const blocks = group.blocks;
  const first = blocks[0];
  const tk = first.loadType || "pallets";
  const lbl = typeLabel(first.loadType);
  const count = blocks.length;

  const byTime = blocks.slice().sort(function (a, b) {
    return (b.placedAt || 0) - (a.placedAt || 0);
  });
  const mostRecentBlockId = byTime.length ? byTime[0].id : null;

  const card = document.createElement("div");
  card.className = "load-card load-card--on-deck-summary type-" + tk;
  card.dataset.loadId = String(first.loadId || "");
  card.draggable = false;

  const stacks = blocks.some(function (x) {
    return (x.z || 0) > 0;
  });
  const subtitle = stacks ? "Includes stacks" : "Floor";

  card.innerHTML =
    '<div class="load-card-summary-top">' +
    '<div class="load-card-summary-badges">' +
    '<span class="type-badge badge-' +
    tk +
    '">' +
    escapeHtml(lbl) +
    "</span>" +
    '<span class="on-deck-badge on-deck-badge--mini">deck</span>' +
    "</div>" +
    '<div class="load-card-summary-metrics">' +
    '<span class="on-deck-count" title="Units placed on deck for this load">' +
    escapeHtml(String(count)) +
    "</span>" +
    '<button type="button" class="load-card-remove load-card-remove--mini"' +
    ' title="Remove one unit (most recently placed slot for this load)"' +
    ' aria-label="Remove one unit">' +
    "-1</button>" +
    "</div>" +
    "</div>" +
    '<div class="load-card-name load-card-name--deck" title="' +
    escapeHtml(loadDisplayName(first) + " · " + (first.loadId || "")) +
    '">' +
    escapeHtml(loadDisplayName(first)) +
    "</div>" +
    '<div class="load-card-ref load-card-ref--mini">' +
    escapeHtml(String(first.loadId || "")) +
    "</div>" +
    '<div class="load-card-detail load-card-detail--mini">' +
    escapeHtml(subtitle) +
    "</div>";

  const rm = card.querySelector(".load-card-remove");
  if (rm && mostRecentBlockId != null) {
    rm.addEventListener("click", function (e) {
      e.stopPropagation();
      _removePlacedBlock(mostRecentBlockId);
    });
  }
  return card;
}

export function createAvailableLoadCard(load) {
  const tk = typeKey(load.loadType);
  const lbl = typeLabel(load.loadType);

  const dimStr =
    load.length && load.width
      ? load.length + "m × " + load.width + "m"
      : "dims not set";

  const totalUnits = parseInt(load.units, 10) || 0;
  const remainingUnits = remainingUnitsForLoad(load);
  const placedUnits = totalUnits - remainingUnits;
  const fullyPlaced = isLoadFullyPlaced(load);

  const card = document.createElement("div");
  card.className =
    "load-card load-card--compact type-" +
    tk +
    (fullyPlaced ? " load-card--full" : "");
  card.draggable = !fullyPlaced;
  card.dataset.id = load.id;

  const isoChip = load.isoType
    ? '<span class="iso-chip">' + escapeHtml(load.isoType) + "</span>"
    : "";
  const fullPill = fullyPlaced
    ? '<span class="full-pill">All placed</span>'
    : "";
  const hint = fullyPlaced
    ? "All " + totalUnits + " unit" + (totalUnits !== 1 ? "s" : "") + " on deck"
    : "Drag onto deck ↗";

  card.innerHTML =
    '<div class="load-card-top">' +
    '<div class="load-card-top-badges">' +
    '<span class="type-badge badge-' +
    tk +
    '">' +
    escapeHtml(lbl) +
    "</span>" +
    isoChip +
    fullPill +
    "</div>" +
    '<span class="load-card-ref">' +
    escapeHtml(load.id) +
    "</span>" +
    "</div>" +
    '<div class="load-card-name">' +
    escapeHtml(loadDisplayName(load)) +
    "</div>" +
    '<div class="load-card-detail">' +
    '<span class="units-progress">' +
    placedUnits +
    " / " +
    totalUnits +
    " unit" +
    (totalUnits !== 1 ? "s" : "") +
    "</span> · " +
    dimStr +
    "</div>" +
    '<div class="load-card-hint">' +
    hint +
    "</div>";

  if (!fullyPlaced) {
    card.addEventListener("dragstart", function (e) {
      _onCardDragStart(e, load);
    });
  } else {
    card.addEventListener("dragstart", function (e) {
      e.preventDefault();
    });
  }
  return card;
}

function _onCardDragStart(e, load) {
  if (isLoadFullyPlaced(load)) {
    e.preventDefault();
    return;
  }
  setDragPayload(load);
  e.dataTransfer.effectAllowed = "copy";
  const ghost = document.createElement("div");
  ghost.style.cssText =
    "position:fixed;top:-200px;left:-200px;width:1px;height:1px;opacity:0;";
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 0, 0);
  setTimeout(function () {
    ghost.remove();
  }, 0);
}

function _renderLoadStrip(filteredAvailable) {
  const container = document.getElementById("load-strip-track");
  if (!container) return;

  const hasEquipment = !!S.selectedTruck;
  const onDeck = (S.placedBlocks || []).slice();
  const deckGroups = onDeck.length ? groupOnDeckBlocksByLoadId(onDeck) : [];

  updateLoadStripSectionPills(
    onDeck.length,
    deckGroups.length,
    filteredAvailable.length,
  );

  if (!hasEquipment) {
    updateLoadStripSectionPills(0, 0, 0);
    container.innerHTML =
      '<p class="empty-msg empty-msg--strip">' +
      "Select a scenario to show available loads." +
      "</p>";
    return;
  }

  if (!filteredAvailable.length && !onDeck.length) {
    const msg = _allLoads.length
      ? "No loads match the current filter"
      : "No loads in this scenario";
    container.innerHTML =
      '<p class="empty-msg empty-msg--strip">' + msg + "</p>";
    return;
  }

  container.innerHTML = "";

  /* Single left-to-right stream: on-deck summaries first, then available cards (no gap pills). */
  deckGroups.forEach(function (g) {
    container.appendChild(createOnDeckGroupCard(g));
  });

  if (!filteredAvailable.length) {
    const p = document.createElement("p");
    p.className = "empty-msg empty-msg--strip empty-msg--inline";
    p.textContent = "Nothing left in this filtered view.";
    container.appendChild(p);
  } else {
    filteredAvailable.forEach(function (load) {
      container.appendChild(createAvailableLoadCard(load));
    });
  }
}

export function setupLoadFilters() {
  const root = document.getElementById("load-strip");
  const input = document.getElementById("load-search");
  if (input) {
    input.addEventListener("input", function () {
      _loadFilters.search = input.value;
      applyLoadFilters();
    });
  }
  const chips = root
    ? root.querySelectorAll(".filter-chips .chip")
    : document.querySelectorAll(".filter-chips .chip");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      chips.forEach(function (c) {
        c.classList.remove("chip--active");
      });
      chip.classList.add("chip--active");
      _loadFilters.type = chip.dataset.filter || "all";
      applyLoadFilters();
    });
  });
}
