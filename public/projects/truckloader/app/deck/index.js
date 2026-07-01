// Public API of the deck/ folder.
// Single entry point — call initDeck(ctx) once at bootstrap, then use the
// other exports anywhere. Other folders should import from here, not from
// individual files inside.

import { initDeckSections } from "./deckSections.js";
import { initDeckDimensions } from "./deckDimensions.js";

export function initDeck(ctx) {
  initDeckSections(ctx);
  initDeckDimensions(ctx);
}

export { gridStepPx, snapPx, updateGridOverlayFromScale } from "./deckGrid.js";
export { parseSectionLength, renderSectionDividers } from "./deckSections.js";
export {
  updateTopViewMetrics,
  setTopDimLabels,
  setOrthoDimLabels,
  clearDimLabels,
} from "./deckDimensions.js";
