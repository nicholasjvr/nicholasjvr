// Collision / stacking maths for placed blocks.
// Reads scale + placed-block list from the shared state (core/state.js) so call
// sites in planner.js keep their original signatures during the modularisation.
// Future feature folders can keep using these wrappers, or import S directly
// if they need different behaviour.

import { EPS } from "./constants.js";
import { S } from "./state.js";

// Convert a placed-block (pixel-space) to its footprint in metres.
export function blockFootprintM(block) {
  var sc = S.scale;
  return { x: block.x / sc, y: block.y / sc, L: block.w / sc, W: block.h / sc };
}

export function rectsOverlap2D(ax, ay, aL, aW, bx, by, bL, bW) {
  return ax < bx + bL - EPS
      && ax + aL > bx + EPS
      && ay < by + bW - EPS
      && ay + aW > by + EPS;
}

export function rectanglesOverlapFootprint(Fa, Fb) {
  return rectsOverlap2D(Fa.x, Fa.y, Fa.L, Fa.W, Fb.x, Fb.y, Fb.L, Fb.W);
}

// True if two placed blocks share volume (XY footprint + Z height range).
export function blocksVolumeOverlap(b1, b2) {
  if (b1.id === b2.id) return false;
  var F1 = blockFootprintM(b1);
  var F2 = blockFootprintM(b2);
  if (!rectanglesOverlapFootprint(F1, F2)) return false;
  var z1a = b1.z || 0;
  var z1b = z1a + (b1.height || 0.3);
  var z2a = b2.z || 0;
  var z2b = z2a + (b2.height || 0.3);
  return z1a < z2b - EPS && z2a < z1b - EPS;
}

// True if `candidate` collides with any block in S.placedBlocks (excluding `excludeId`).
export function blockConflictsWithAny(candidate, excludeId) {
  for (var i = 0; i < S.placedBlocks.length; i++) {
    var o = S.placedBlocks[i];
    if (excludeId && o.id === excludeId) continue;
    if (blocksVolumeOverlap(candidate, o)) return true;
  }
  return false;
}

// Lowest Z (metres) a new block with footprint `F` can sit at without overlap.
export function computeAutoStackZ(F, excludeId) {
  var tops = [0];
  S.placedBlocks.forEach(function(b) {
    if (excludeId && b.id === excludeId) return;
    if (rectanglesOverlapFootprint(F, blockFootprintM(b))) tops.push(b.z + b.height);
  });
  return Math.max.apply(null, tops);
}
