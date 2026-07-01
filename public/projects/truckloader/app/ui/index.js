// Public API of the ui/ folder — chrome that doesn't own a specific
// feature surface (banners, context menus, metric strip, etc.).

import { initMetrics } from "./metrics.js";
import { initContextMenu } from "./contextMenu.js";

// Convenience: one-shot bootstrap call wiring every ui/* component.
export function initUi(ctx) {
  initMetrics(ctx);
  initContextMenu(ctx);
}

export { planBanner } from "./statusBanner.js";
export { hideIsoContextMenu, showIsoContextMenu } from "./contextMenu.js";
export { updateMetricsBar, updatePanelCounts } from "./metrics.js";
