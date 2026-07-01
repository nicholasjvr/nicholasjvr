// Centralised application state.
// Mutated directly by planner.js (and, post-migration, by each feature folder).
// Cross-folder readers should import S and access fields rather than declaring
// their own copies.

export const S = {
  trailerTypes: [],
  loads: [],
  selectedScenarioId: null,
  selectedTruck: null,
  selectedTrailer: null,
  // { id, loadId, loadType, description, units, height, x, y, w, h, rotated, z }
  placedBlocks: [],
  nextId: 1,
  // px per metre — recalculated on scenario select
  scale: 40,
  // 'top' | 'left' | 'right' | 'front' | 'back' | 'iso'
  viewMode: "top",
  lastPlanView: "top",
  workspaceExpanded: false,
  // 3D label sprites — toggled from the camera subbar
  showIsoLabels: false,
  topPxW: 300,
  topPxH: 200,
};
