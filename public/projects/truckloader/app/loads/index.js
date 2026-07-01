// Public API of the loads/ folder.
// Bootstrap calls initLoads(ctx) once; everything else uses the named exports.

import { initLoadList, applyLoadFilters } from "./loadList.js";
import { initPlacement, removeBlock } from "./placement.js";

export function initLoads(ctx) {
  initPlacement({
    getCurrentBed: ctx.getCurrentBed,
    getIso:        ctx.getIso,
    refreshView:   ctx.refreshView,
    renderTopView: ctx.renderTopView,
  });
  initLoadList({
    onListChanged:      ctx.onListChanged,
    onRemovePlacedBlock: removeBlock,
  });
}

// Unit accounting
export {
  placedUnitsForLoad,
  remainingUnitsForLoad,
  totalUnplacedUnits,
  isLoadFullyPlaced,
} from "./units.js";

// Load list + bottom strip
export {
  renderLoadList,
  applyLoadFilters,
  setupLoadFilters,
  getAllLoads,
  getLoadFilters,
  createAvailableLoadCard,
} from "./loadList.js";

// Placement (block lifecycle, drag/drop)
export {
  placeBlock,
  removeBlock,
  rotateBlock,
  liftBlock,
  lowerBlock,
  startBlockDrag,
  wouldBlockMoveCollide,
  moveBlockToMeters,
  previewLoadPlacementAtMeters,
  previewLoadPlacementAtMetersWithPolicy,
  previewBlockMoveToMeters,
  previewBlockMoveToMetersWithPolicy,
  updatePlacedList,
  setupCanvasDropZone,
  hideDropGhost,
  updateDropGhost,
  getDropPixelCoords,
  setDragPayload,
  getDragPayload,
  clearDragPayload,
} from "./placement.js";
