// Public API of the planning2d/ folder.
// One-shot bootstrap via initPlanning2d(ctx); use the named exports thereafter.

import { initTopView } from "./topView.js";
import { initOrthoView } from "./orthoView.js";
import { initSidesPreview } from "./sidesPreview.js";

export function initPlanning2d(ctx) {
  initTopView(ctx);
  initOrthoView(ctx);
  initSidesPreview(ctx);
}

export { renderTopView } from "./topView.js";
export { renderOrthoView } from "./orthoView.js";
export { renderSidesPreview } from "./sidesPreview.js";
