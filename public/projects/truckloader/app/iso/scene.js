// app/iso/scene.js
// ISO 3D scene — orchestrator. Owns the Three.js renderer/scene/camera, the
// animation loop, camera presets, load mesh syncing, drop raycasting, and the
// public API consumed by planner.js. Geometry builders for the deck and the
// tractor horse live in trailer.js and tractor.js respectively.

import { buildBedGroup, ISO_MAX_H } from "./trailer.js";
import {
  addIsoTractorHorse,
  HORSE_BODY_LENGTH_M,
  getHorseBodyLengthForTruckLayout,
  getEstimatedTractorCabLengthM,
  getTractorCabTheme,
} from "./tractor.js";
import { preloadBrandTextures } from "./brand.js";
import { buildLoadMesh, disposeLoadMeshTextureCache } from "./loadMeshes.js";

// ── PRESENTATION CONSTANTS ───────────────────────────────────────────────────

/** ISO 3D — presentation only (camera, fog, framing). */
const ISO_PRESENTATION = {
  CAM_FOV: 33,
  FRAMING_D: 1.16,
  TARGET_Y: 0.24,
  ISO_CAM_X_MUL: 0.84,
  ISO_CAM_Y_MUL: 0.54,
  ISO_CAM_Z_MUL: 0.88,
  MIN_POLAR: 0.14,
  MAX_POLAR: Math.PI * 0.48,
  /* Nudged 1.02 → 1.06: a brighter filmic key lifts the fleet-white paint and
   * gives the whole scene a more confident, showroom feel. */
  TONE_EXPOSURE: 1.06,
};

// ── MODULE STATE ─────────────────────────────────────────────────────────────

/** Set once by planner.js via initIso(). All app/state access flows through here. */
var _app = null;

/** All Three.js handles + the live scene graph references. */
var _isoThree = {
  THREE: null,
  OrbitCtrls: null,
  RoomEnv: null,
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  loadGroup: null,
  bedGroup: null,
  backdropGroup: null,
  rafId: null,
  truckSig: null,
  _ro: null,
  /** Active drive-off tween (Save cinematic). Shape:
   *  { startTs, duration, fromX, toX, onComplete }. Null when idle. */
  rigTween: null,
};

var _threeModulePromise = null;

/** Active Save-cinematic state ({ resolve }) or null. Guards re-entry so a
 *  double-click on Save can't stack two drive-offs. */
var _isoCinematic = null;

/** Translucent box positioned under the cursor during drag-over (drop preview). */
var _isoDropGhost = null;

/** Drag state for click-to-move on placed loads. `null` when idle.
 *  Shape: { blockId, mesh, ghostValid, lenM, widM, hM, originalXm, originalYm }
 *  (the load mesh is a Group; original material opacity is stashed per-material
 *  by `_dimLoadMesh` rather than on this object). */
var _isoMoveDrag = null;

/** Idempotency flag — pointer handlers are installed once per renderer canvas. */
var _isoMoveHandlersInstalled = false;

function _isoSyncPreviewBanner(preview) {
  if (!_app || !_app.planBanner) return;
  if (!preview) {
    _app.planBanner("");
    return;
  }
  if (preview.valid) {
    _app.planBanner("");
    return;
  }
  if (preview.message) {
    _app.planBanner(preview.message);
  } else {
    _app.planBanner("Cannot place load here.");
  }
}

// ── PUBLIC API ───────────────────────────────────────────────────────────────

/** Inject planner-side accessors. Required before any other public call.
 *
 * ctx: {
 *   getCurrentBed(): { length, width } | null,
 *   getActiveTrailerType(): { id, sections: [{ lengthM }] } | null,
 *   normalizeLayoutKey(layoutStr): string,
 *   planBanner(msg): void,
 *   getViewMode(): "top" | "iso" | ...,
 *   getSelectedTruck(): truck | null,
 *   getSelectedTrailer(): trailer | null,
 *   getPlacedBlocks(): block[],
 *   getScale(): pxPerMetre,
 * }
 */
export function initIso(ctx) {
  _app = ctx;
}

/** True when the iso scene is initialised and has a load group ready to receive meshes. */
export function isIsoReady() {
  return !!_isoThree.THREE && !!_isoThree.loadGroup;
}

/** Re-sync only the placed-load meshes (cheap incremental update during 3D editing). */
export function syncIsoThreeLoadsOnly() {
  if (!_app || _app.getViewMode() !== "iso") return;
  if (!_isoThree.loadGroup || !_isoThree.THREE) return;
  syncIsoLoadMeshes(_isoThree.THREE);
}

export function stopIsoAnimation() {
  if (_isoThree.rafId) {
    cancelAnimationFrame(_isoThree.rafId);
    _isoThree.rafId = null;
  }
}

/** Abort any in-flight Save cinematic and resolve its Promise so the caller
 *  (planner.js) is never left awaiting a sequence that the scene tore down. */
function _abortIsoCinematic() {
  _isoThree.rigTween = null;
  if (_isoCinematic) {
    var done = _isoCinematic.resolve;
    _isoCinematic = null;
    if (done) done();
  }
}

export function disposeIsoThree() {
  stopIsoAnimation();
  _abortIsoCinematic();
  /* Free the cached canvas textures shared by the per-type load meshes so a
     scene rebuild (truck/trailer change) doesn't leak GPU memory. */
  disposeLoadMeshTextureCache();
  if (_isoThree._ro) {
    try {
      _isoThree._ro.disconnect();
    } catch (err) {
      /* noop */
    }
    _isoThree._ro = null;
  }
  if (_isoThree.controls) {
    _isoThree.controls.dispose();
    _isoThree.controls = null;
  }
  if (_isoThree.pmrem) {
    try {
      _isoThree.pmrem.dispose();
    } catch (err) {
      /* noop */
    }
    _isoThree.pmrem = null;
  }
  if (_isoThree.scene && _isoThree.scene.environment) {
    try {
      _isoThree.scene.environment.dispose();
    } catch (err) {
      /* noop */
    }
    _isoThree.scene.environment = null;
  }
  if (
    _isoThree.scene &&
    _isoThree.scene.background &&
    _isoThree.scene.background.isTexture
  ) {
    try {
      _isoThree.scene.background.dispose();
    } catch (err) {
      /* noop */
    }
  }
  if (_isoThree.renderer) {
    _isoThree.renderer.dispose();
    if (
      _isoThree.renderer.domElement &&
      _isoThree.renderer.domElement.parentNode
    ) {
      _isoThree.renderer.domElement.parentNode.removeChild(
        _isoThree.renderer.domElement,
      );
    }
    _isoThree.renderer = null;
  }
  _isoThree.scene = null;
  _isoThree.camera = null;
  _isoThree.loadGroup = null;
  _isoThree.bedGroup = null;
  _isoThree.backdropGroup = null;
  _isoThree.truckSig = null;
  _isoDropGhost = null;
  _isoMoveDrag = null;
  _isoMoveHandlersInstalled = false;
}

/** Raycast onto the 3D deck; return top-view pixel coords for `placeBlock`. */
export function getIsoDeckDropPixels(clientX, clientY, load, rotated) {
  var THREE = _isoThree.THREE;
  var bed = _app ? _app.getCurrentBed() : null;
  if (
    !THREE ||
    !bed ||
    !_isoThree.camera ||
    !_isoThree.renderer ||
    !_isoThree.scene ||
    !load
  )
    return null;

  var rect = _isoThree.renderer.domElement.getBoundingClientRect();
  var ndcX = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  var ndcY = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;

  var raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), _isoThree.camera);
  var hits = raycaster.intersectObjects(_isoThree.scene.children, true);
  var hit = null;
  for (var i = 0; i < hits.length; i++) {
    var o = hits[i].object;
    if (o.name === "planningDeck" || (o.userData && o.userData.planningDeck)) {
      hit = hits[i];
      break;
    }
  }
  if (!hit) return null;

  var lenM = parseFloat(load.length) || 1;
  var widM = parseFloat(load.width) || 1;
  if (rotated) {
    var t = lenM;
    lenM = widM;
    widM = t;
  }
  var hx = hit.point.x;
  var hz = hit.point.z;
  var topLeftXm = hx - lenM / 2;
  var topLeftZm = hz - widM / 2;
  topLeftXm = Math.max(0, Math.min(bed.length - lenM, topLeftXm));
  topLeftZm = Math.max(0, Math.min(bed.width - widM, topLeftZm));
  var scale = _app.getScale();
  if (
    _app.previewLoadPlacementAtMetersWithPolicy ||
    _app.previewLoadPlacementAtMeters
  ) {
    var preview = _app.previewLoadPlacementAtMetersWithPolicy
      ? _app.previewLoadPlacementAtMetersWithPolicy(
          load,
          topLeftXm,
          topLeftZm,
          !!rotated,
          { requireHold: true, touchArmClock: false },
        )
      : _app.previewLoadPlacementAtMeters(
          load,
          topLeftXm,
          topLeftZm,
          !!rotated,
        );
    if (preview && preview.rawX != null && preview.rawY != null) {
      return { rawX: preview.rawX, rawY: preview.rawY, valid: preview.valid };
    }
  }
  return { rawX: topLeftXm * scale, rawY: topLeftZm * scale };
}

/** Translucent box on the deck following the cursor — call from `dragover`. */
export function updateIsoDropGhost(clientX, clientY, load, rotated) {
  var THREE = _isoThree.THREE;
  var bed = _app ? _app.getCurrentBed() : null;
  if (
    !THREE ||
    !bed ||
    !_isoThree.camera ||
    !_isoThree.renderer ||
    !_isoThree.scene ||
    !load
  ) {
    _isoSyncPreviewBanner(null);
    return null;
  }

  var rect = _isoThree.renderer.domElement.getBoundingClientRect();
  var ndcX = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  var ndcY = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;

  var raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), _isoThree.camera);
  var hits = raycaster.intersectObjects(_isoThree.scene.children, true);
  var hit = null;
  for (var i = 0; i < hits.length; i++) {
    var o = hits[i].object;
    if (o.userData && o.userData.isDropGhost) continue;
    if (o.name === "planningDeck" || (o.userData && o.userData.planningDeck)) {
      hit = hits[i];
      break;
    }
  }
  if (!hit) {
    hideIsoDropGhost();
    return null;
  }

  var lenM = parseFloat(load.length) || 1;
  var widM = parseFloat(load.width) || 1;
  var hM = parseFloat(load.height) || 0.3;
  if (rotated) {
    var tmp = lenM;
    lenM = widM;
    widM = tmp;
  }

  var leftXm = Math.max(0, Math.min(bed.length - lenM, hit.point.x - lenM / 2));
  var leftZm = Math.max(0, Math.min(bed.width - widM, hit.point.z - widM / 2));
  var preview =
    _app.previewLoadPlacementAtMetersWithPolicy ||
    _app.previewLoadPlacementAtMeters
      ? _app.previewLoadPlacementAtMetersWithPolicy
        ? _app.previewLoadPlacementAtMetersWithPolicy(
            load,
            leftXm,
            leftZm,
            !!rotated,
            { requireHold: true, touchArmClock: true },
          )
        : _app.previewLoadPlacementAtMeters(load, leftXm, leftZm, !!rotated)
      : null;
  _isoSyncPreviewBanner(preview);
  var valid = !preview || !!preview.valid;
  if (preview && (preview.rawX == null || preview.rawY == null)) {
    hideIsoDropGhost();
    return preview;
  }
  var ghostX = preview ? preview.xM : leftXm;
  var ghostZ = preview ? preview.yM : leftZm;
  var ghostY = preview ? preview.z : hit.point.y;
  if (preview) {
    lenM = preview.lengthM;
    widM = preview.widthM;
    hM = preview.heightM;
  }

  if (!_isoDropGhost) {
    var geo = new THREE.BoxGeometry(1, 1, 1);
    var mat = new THREE.MeshBasicMaterial({
      color: 0x14b8a6,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1000;
    var edges = new THREE.EdgesGeometry(geo);
    var lineMat = new THREE.LineBasicMaterial({
      color: 0x0f766e,
      transparent: true,
      opacity: 0.95,
    });
    mesh.add(new THREE.LineSegments(edges, lineMat));
    mesh.userData.isDropGhost = true;
    mesh.visible = false;
    _isoThree.scene.add(mesh);
    _isoDropGhost = mesh;
  }

  _isoDropGhost.material.color.setHex(valid ? 0x14b8a6 : 0xef4444);
  _isoDropGhost.material.opacity = valid ? 0.34 : 0.4;
  if (_isoDropGhost.children[0] && _isoDropGhost.children[0].material) {
    _isoDropGhost.children[0].material.color.setHex(
      valid ? 0x0f766e : 0xb91c1c,
    );
  }
  _isoDropGhost.scale.set(lenM, hM, widM);
  _isoDropGhost.position.set(
    ghostX + lenM / 2,
    ghostY + hM / 2,
    ghostZ + widM / 2,
  );
  _isoDropGhost.visible = true;

  var scale = _app.getScale();
  return preview
    ? {
        rawX: preview.rawX,
        rawY: preview.rawY,
        valid: preview.valid,
        z: preview.z,
      }
    : { rawX: leftXm * scale, rawY: leftZm * scale, valid: true, z: 0 };
}

/** Hide the drop preview ghost — call from `dragleave`, `drop`, and 3D teardown. */
export function hideIsoDropGhost() {
  if (_isoDropGhost) _isoDropGhost.visible = false;
  _isoSyncPreviewBanner(null);
}

// ── CLICK-TO-MOVE: drag placed loads to a new deck position ──────────────────

/** Dim a placed-load mesh during Move-mode. The load is a multi-mesh Group
 *  (loadMeshes.js), so we traverse and fade every mesh material, stashing each
 *  material's original { transparent, opacity } once so it can be restored. */
function _dimLoadMesh(group, opacity) {
  if (!group) return;
  group.traverse(function (obj) {
    if (!obj.isMesh || !obj.material) return;
    var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(function (m) {
      if (!m.userData._origSet) {
        m.userData._origSet = true;
        m.userData._origTransparent = m.transparent;
        m.userData._origOpacity = m.opacity;
      }
      m.transparent = true;
      m.opacity = opacity;
    });
  });
}

/** Restore a placed-load Group's materials after Move-mode ends. */
function _restoreLoadMesh(group) {
  if (!group) return;
  group.traverse(function (obj) {
    if (!obj.isMesh || !obj.material) return;
    var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(function (m) {
      if (!m.userData._origSet) return;
      m.transparent = m.userData._origTransparent;
      m.opacity = m.userData._origOpacity;
      m.userData._origSet = false;
    });
  });
}

/** Walk up an intersected object's parent chain until we find a node carrying
 *  a placed-block reference (userData.block). Used to map clicks on label
 *  sprites / edge-line children back to the owning load mesh. */
function _findOwningBlockMesh(obj) {
  while (obj) {
    if (obj.userData && obj.userData.block) return obj;
    obj = obj.parent;
  }
  return null;
}

/** Raycast loadGroup; return the first placed-load mesh hit, or null. */
function _isoPickPlacedMesh(clientX, clientY) {
  if (!_isoThree.loadGroup || !_isoThree.camera || !_isoThree.renderer)
    return null;
  var THREE = _isoThree.THREE;
  var rect = _isoThree.renderer.domElement.getBoundingClientRect();
  var ndcX = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  var ndcY = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
  var raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), _isoThree.camera);
  var hits = raycaster.intersectObjects(_isoThree.loadGroup.children, true);
  for (var i = 0; i < hits.length; i++) {
    var owner = _findOwningBlockMesh(hits[i].object);
    if (owner) return owner;
  }
  return null;
}

/** Raycast the planning deck and return the hit point in deck-local world
 *  metres, or null if the cursor isn't over the deck. */
function _isoRaycastDeck(clientX, clientY) {
  if (!_isoThree.scene || !_isoThree.camera || !_isoThree.renderer) return null;
  var THREE = _isoThree.THREE;
  var rect = _isoThree.renderer.domElement.getBoundingClientRect();
  var ndcX = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  var ndcY = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
  var raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), _isoThree.camera);
  var hits = raycaster.intersectObjects(_isoThree.scene.children, true);
  for (var i = 0; i < hits.length; i++) {
    var o = hits[i].object;
    if (o.userData && o.userData.isDropGhost) continue;
    if (o.name === "planningDeck" || (o.userData && o.userData.planningDeck)) {
      return hits[i].point;
    }
  }
  return null;
}

/** Show / move / colour the ghost during a click-to-move drag.
 *  Returns { xM, yM, valid } or null if cursor is off the deck. */
function _isoMoveUpdateGhost(clientX, clientY) {
  if (!_isoMoveDrag) return null;
  var THREE = _isoThree.THREE;
  var bed = _app && _app.getCurrentBed();
  if (!THREE || !bed) return null;

  var pt = _isoRaycastDeck(clientX, clientY);
  if (!pt) return null;

  var lenM = _isoMoveDrag.lenM;
  var widM = _isoMoveDrag.widM;
  var hM = _isoMoveDrag.hM;
  var leftXm = Math.max(0, Math.min(bed.length - lenM, pt.x - lenM / 2));
  var leftZm = Math.max(0, Math.min(bed.width - widM, pt.z - widM / 2));
  var preview =
    _app &&
    (_app.previewBlockMoveToMetersWithPolicy || _app.previewBlockMoveToMeters)
      ? _app.previewBlockMoveToMetersWithPolicy
        ? _app.previewBlockMoveToMetersWithPolicy(
            _isoMoveDrag.blockId,
            leftXm,
            leftZm,
            { requireHold: true, touchArmClock: true },
          )
        : _app.previewBlockMoveToMeters(_isoMoveDrag.blockId, leftXm, leftZm)
      : null;
  var valid = preview ? !!preview.valid : true;
  if (preview && (preview.rawX == null || preview.rawY == null)) {
    _isoSyncPreviewBanner(preview);
    hideIsoDropGhost();
    return preview;
  }
  _isoSyncPreviewBanner(preview);
  var ghostX = preview ? preview.xM : leftXm;
  var ghostZ = preview ? preview.yM : leftZm;
  var ghostY = preview ? preview.z : pt.y;
  if (preview) {
    lenM = preview.lengthM;
    widM = preview.widthM;
    hM = preview.heightM;
  }

  /* Lazy-create the ghost (shared with drag-over from the load list). */
  if (!_isoDropGhost) {
    var geo = new THREE.BoxGeometry(1, 1, 1);
    var mat = new THREE.MeshBasicMaterial({
      color: 0x14b8a6,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1000;
    var edges = new THREE.EdgesGeometry(geo);
    mesh.add(
      new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
          color: 0x0f766e,
          transparent: true,
          opacity: 0.95,
        }),
      ),
    );
    mesh.userData.isDropGhost = true;
    _isoThree.scene.add(mesh);
    _isoDropGhost = mesh;
  }

  _isoDropGhost.material.color.setHex(valid ? 0x14b8a6 : 0xef4444);
  _isoDropGhost.material.opacity = valid ? 0.34 : 0.4;
  /* Recolor the edge line (first child). */
  if (_isoDropGhost.children[0] && _isoDropGhost.children[0].material) {
    _isoDropGhost.children[0].material.color.setHex(
      valid ? 0x0f766e : 0xb91c1c,
    );
  }
  _isoDropGhost.scale.set(lenM, hM, widM);
  _isoDropGhost.position.set(
    ghostX + lenM / 2,
    ghostY + hM / 2,
    ghostZ + widM / 2,
  );
  _isoDropGhost.visible = true;
  _isoMoveDrag.ghostValid = valid;
  return { xM: ghostX, yM: ghostZ, valid: valid };
}

/** End an active move-drag without committing. Restores the source mesh and
 *  re-enables orbit. `mode` is "cancel" (Esc / off-deck) or "click" (no move). */
function _isoEndMoveDrag(mode) {
  if (!_isoMoveDrag) return;
  var m = _isoMoveDrag.mesh;
  if (m) {
    _restoreLoadMesh(m);
    m.visible = true;
  }
  hideIsoDropGhost();
  _isoSyncPreviewBanner(null);
  if (_isoThree.controls) _isoThree.controls.enabled = true;
  _isoMoveDrag = null;
}

/** Enter Move-mode programmatically (from the right-click context menu in
 *  planner.js). Finds the mesh for `blockId`, dims it, parks the ghost at the
 *  load's current position, and suspends OrbitControls until commit/cancel. */
export function beginMoveMode(blockId) {
  if (_isoMoveDrag) cancelMoveMode();
  if (!_isoThree.loadGroup || !_isoThree.THREE) return false;
  var mesh = null;
  _isoThree.loadGroup.children.forEach(function (m) {
    if (
      m.userData &&
      m.userData.block &&
      String(m.userData.block.id) === String(blockId)
    )
      mesh = m;
  });
  if (!mesh) return false;

  var THREE = _isoThree.THREE;
  var block = mesh.userData.block;
  var sc = _app.getScale();
  _isoMoveDrag = {
    blockId: block.id,
    mesh: mesh,
    lenM: block.w / sc,
    widM: block.h / sc,
    hM: block.height || 0.3,
    originalXm: block.x / sc,
    originalYm: block.y / sc,
  };
  _dimLoadMesh(mesh, 0.26);
  if (_isoThree.controls) _isoThree.controls.enabled = false;
  document.body.classList.add("iso-move-mode");

  /* Park the ghost on top of the source mesh so the user has visual continuity
     before they move the cursor. Recolor to default valid-teal. */
  if (!_isoDropGhost) {
    var geo = new THREE.BoxGeometry(1, 1, 1);
    var mat = new THREE.MeshBasicMaterial({
      color: 0x14b8a6,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    var gm = new THREE.Mesh(geo, mat);
    gm.renderOrder = 1000;
    var edges = new THREE.EdgesGeometry(geo);
    gm.add(
      new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
          color: 0x0f766e,
          transparent: true,
          opacity: 0.95,
        }),
      ),
    );
    gm.userData.isDropGhost = true;
    _isoThree.scene.add(gm);
    _isoDropGhost = gm;
  }
  _isoDropGhost.scale.set(
    _isoMoveDrag.lenM,
    _isoMoveDrag.hM,
    _isoMoveDrag.widM,
  );
  _isoDropGhost.position.copy(mesh.position);
  _isoDropGhost.material.color.setHex(0x14b8a6);
  _isoDropGhost.material.opacity = 0.34;
  if (_isoDropGhost.children[0] && _isoDropGhost.children[0].material) {
    _isoDropGhost.children[0].material.color.setHex(0x0f766e);
  }
  _isoDropGhost.visible = true;
  return true;
}

/** Cancel an active Move-mode session — restores source mesh and orbit. */
export function cancelMoveMode() {
  if (!_isoMoveDrag) return;
  _isoEndMoveDrag("cancel");
  document.body.classList.remove("iso-move-mode");
}

/** Apply/clear the load-name label sprite visibility on every placed load
 *  mesh. Idempotent. Called from the planner's "Show labels" toggle and
 *  re-applied at the end of every `syncIsoLoadMeshes` rebuild. */
export function applyIsoLabelVisibility(visible) {
  if (!_isoThree.loadGroup) return;
  _isoThree.loadGroup.children.forEach(function (mesh) {
    if (!mesh.children) return;
    mesh.children.forEach(function (child) {
      if (child && child.isSprite) child.visible = !!visible;
    });
  });
}

/** Install pointer handlers on the renderer canvas — idempotent. Wires:
 *  • `contextmenu` → pick a placed mesh and ask planner.js to show its menu.
 *  • `pointermove` → live ghost while Move-mode is active.
 *  • `click` (left) → commit Move-mode if cursor is over a valid spot.
 *  • `keydown Escape` → cancel an active Move-mode. */
function _installLoadMoveHandlers() {
  if (_isoMoveHandlersInstalled) return;
  if (!_isoThree.renderer || !_isoThree.renderer.domElement) return;
  var dom = _isoThree.renderer.domElement;

  /* RIGHT-CLICK → context menu (handled in planner.js via _app callback). */
  dom.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    /* Right-click during an active Move-mode acts as "cancel". */
    if (_isoMoveDrag) {
      cancelMoveMode();
      return;
    }
    if (!_app || !_app.onIsoBlockContextMenu) return;
    var owner = _isoPickPlacedMesh(e.clientX, e.clientY);
    if (owner && owner.userData && owner.userData.block) {
      _app.onIsoBlockContextMenu(owner.userData.block, e.clientX, e.clientY);
    } else if (_app.onIsoEmptyContextMenu) {
      _app.onIsoEmptyContextMenu();
    }
  });

  /* POINTERMOVE → only meaningful when Move-mode is active. */
  dom.addEventListener("pointermove", function (e) {
    if (!_isoMoveDrag) return;
    _isoMoveUpdateGhost(e.clientX, e.clientY);
  });

  /* CLICK (left) → commit Move-mode at the cursor, or no-op when idle so
     OrbitControls owns the normal left-button drag. */
  dom.addEventListener("click", function (e) {
    if (e.button !== 0) return;
    if (!_isoMoveDrag) return;
    var info = _isoMoveUpdateGhost(e.clientX, e.clientY);
    if (!info) return; /* off-deck: stay armed, let the user retry */
    if (!info.valid) return; /* collision/over-height: stay armed */
    var drag = _isoMoveDrag;
    var committed = false;
    if (_app && _app.moveBlockToMeters) {
      committed = _app.moveBlockToMeters(drag.blockId, info.xM, info.yM, {
        requireHold: true,
        touchArmClock: false,
      });
    }
    if (committed) {
      /* refreshAfterBlockChange rebuilds load meshes — drag.mesh is now
         stale, no restore needed. Just clear state + re-enable orbit. */
      hideIsoDropGhost();
      if (_isoThree.controls) _isoThree.controls.enabled = true;
      _isoMoveDrag = null;
      document.body.classList.remove("iso-move-mode");
    } else {
      cancelMoveMode();
    }
  });

  /* Esc aborts Move-mode at any time. */
  window.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !_isoMoveDrag) return;
    cancelMoveMode();
  });

  _isoMoveHandlersInstalled = true;
}

/** Lazy CDN module load — Three core + OrbitControls + RoomEnvironment.
 *  Resolves to the populated `_isoThree` slice that holds module refs. */
export function loadThreeModules() {
  if (_threeModulePromise) return _threeModulePromise;
  _threeModulePromise = Promise.all([
    /* OrbitControls + RoomEnvironment import bare "three" — requires <script type="importmap"> in widget.html */
    import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"),
    import("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js"),
    import("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js"),
  ]).then(function (mods) {
    _isoThree.THREE = mods[0];
    _isoThree.OrbitCtrls = mods[1].OrbitControls;
    _isoThree.RoomEnv = mods[2].RoomEnvironment;
    return _isoThree;
  });
  return _threeModulePromise;
}

/** Public entry — show 3D view, build (or reuse) the scene, kick the animation loop. */
export function renderIsoView() {
  if (!_app) {
    console.error("iso/scene.js: renderIsoView() called before initIso()");
    return;
  }
  var bed = _app.getCurrentBed() || { length: 8, width: 2.4 };

  document.getElementById("truck-canvas").style.display = "none";
  document.getElementById("iso-canvas").style.display = "none";

  var isoVp = document.getElementById("iso-viewport");
  if (isoVp) isoVp.hidden = false;

  var isoEl = document.getElementById("iso-three");
  isoEl.style.display = "block";
  var cp = document.getElementById("iso-cam-presets");
  if (cp) {
    cp.style.display = "flex";
    Array.prototype.forEach.call(cp.querySelectorAll(".cam-btn"), function (b) {
      b.classList.toggle("cam-btn--active", b.dataset.cam === "iso");
    });
  }
  wireIsoCameraPresets();

  document.getElementById("dim-label-top").textContent =
    "Length: " + bed.length + "m";
  document.getElementById("dim-label-side").textContent =
    "Isometric (drag to orbit)";

  stopIsoAnimation();
  /* planner-side cab marker / orientation is managed by planner.js around this call. */

  loadThreeModules()
    .then(function () {
      if (_app.getViewMode() !== "iso" || !_app.getSelectedTruck()) return;
      var THREE = _isoThree.THREE;
      var OC = _isoThree.OrbitCtrls;
      return preloadBrandTextures(THREE).then(function () {
        buildIsoScene(THREE, OC, bed);
        isoAnimateLoop();
      });
    })
    .catch(function (err) {
      console.error("Three.js failed to load:", err);
      _app.planBanner(
        '3D viewer failed to load — check network, Zoho widget URL whitelist (cdn.jsdelivr.net), and that an import map for "three" is in the page.',
      );
    });
}

// ── INTERNAL: dispose / framing / sky+ground+backdrop helpers ────────────────

function disposeObject3D(root) {
  root.traverse(function (obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(function (m) {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

/** Active rig centre + framing radius (m) for ISO camera / fog — shared by
 *  scene build and preset tweens. */
function isoPresentationComputeRigFrame(bed) {
  var sel = _app.getSelectedTrailer();
  var truck = _app.getSelectedTruck();
  var trailerActive = !!(sel && sel.bedLengthM > 0 && truck);
  /* Camera framing must match the actual horse length built by tractor.js so a
   * 4x2 horse doesn't leave huge negative-X dead space and an 8x4 horse isn't
   * partially off-screen. */
  var horseLen = HORSE_BODY_LENGTH_M;
  if (trailerActive && truck) {
    var lk = _app.normalizeLayoutKey(truck.layout);
    horseLen = getHorseBodyLengthForTruckLayout(lk);
  }
  var xMin = trailerActive ? -(horseLen + 0.4) : 0;
  var totalLen = bed.length - xMin;
  var cx = (xMin + bed.length) / 2;
  var cz = bed.width / 2;
  var d = Math.max(totalLen, bed.width, ISO_MAX_H) * ISO_PRESENTATION.FRAMING_D;
  return {
    trailerActive: trailerActive,
    xMin: xMin,
    cx: cx,
    cz: cz,
    totalLen: totalLen,
    d: d,
  };
}

/** Subtle default-orbit offsets per cab style — composition-first. */
function isoPresentationStyleCamNudge(styleId) {
  var sid = String(styleId || "modernEuro");
  if (sid === "americanLongnose")
    return { tx: 0.02, ty: 0.03, tz: 0, px: 0.05, py: -0.04, pz: -0.06 };
  if (sid === "industrialCabover")
    return { tx: -0.03, ty: 0.05, tz: 0, px: -0.06, py: -0.03, pz: 0.04 };
  if (sid === "futuristicEV")
    return { tx: 0, ty: 0.02, tz: 0, px: 0.03, py: -0.05, pz: 0.05 };
  return { tx: 0, ty: 0.02, tz: 0, px: 0.02, py: -0.03, pz: 0.02 };
}

function isoPresentationCreateSkyTexture(THREE) {
  var c = document.createElement("canvas");
  c.width = 2;
  c.height = 720;
  var g = c.getContext("2d");
  var grad = g.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0.0, "#5c6b78");
  grad.addColorStop(0.18, "#8a9bab");
  grad.addColorStop(0.38, "#c5d0d8");
  grad.addColorStop(0.55, "#eef2f5");
  grad.addColorStop(0.72, "#f5e6d8");
  grad.addColorStop(0.88, "#c9b8a8");
  grad.addColorStop(1.0, "#8a939c");
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 720);
  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Radial parking-lot read — darker under the rig, lighter at horizon merge. */
function isoPresentationCreateGroundTexture(THREE) {
  var n = 512;
  var c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  var g = c.getContext("2d");
  var rad = g.createRadialGradient(
    n * 0.5,
    n * 0.5,
    n * 0.06,
    n * 0.5,
    n * 0.5,
    n * 0.52,
  );
  rad.addColorStop(0, "#36424d");
  rad.addColorStop(0.35, "#4b5661");
  rad.addColorStop(0.72, "#5f6973");
  rad.addColorStop(1, "#838d97");
  g.fillStyle = rad;
  g.fillRect(0, 0, n, n);
  var tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Lightweight far silhouettes — depot / port read, low triangle count. */
function isoPresentationAddBackdrop(THREE, scene, cx, cz, span) {
  var grp = new THREE.Group();
  grp.name = "isoPresentationBackdrop";
  var perimeterMat = new THREE.MeshStandardMaterial({
    color: 0x5d6973,
    metalness: 0.04,
    roughness: 0.94,
    envMapIntensity: 0.05,
    transparent: true,
    opacity: 0.92,
  });
  var contextMat = new THREE.MeshStandardMaterial({
    color: 0x6a747f,
    metalness: 0.05,
    roughness: 0.92,
    envMapIntensity: 0.06,
    transparent: true,
    opacity: 0.72,
  });
  var far = span * 1.68;
  var wallH = 0.72;
  var wallT = Math.max(0.22, span * 0.03);
  var wallLong = span * 4.5;
  var wallWide = span * 3.7;
  var walls = [
    { x: cx, y: wallH / 2, z: cz - far, w: wallLong, h: wallH, d: wallT },
    { x: cx, y: wallH / 2, z: cz + far, w: wallLong, h: wallH, d: wallT },
    {
      x: cx - far * 0.92,
      y: wallH / 2,
      z: cz,
      w: wallT,
      h: wallH,
      d: wallWide,
    },
    {
      x: cx + far * 0.92,
      y: wallH / 2,
      z: cz,
      w: wallT,
      h: wallH,
      d: wallWide,
    },
  ];
  walls.forEach(function (wall) {
    var mesh = new THREE.Mesh(
      new THREE.BoxGeometry(wall.w, wall.h, wall.d),
      perimeterMat,
    );
    mesh.position.set(wall.x, wall.y, wall.z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    grp.add(mesh);
  });
  var shed = new THREE.Mesh(
    new THREE.BoxGeometry(span * 0.5, 0.95, span * 0.62),
    contextMat,
  );
  shed.position.set(cx + far * 0.62, 0.48, cz + span * 0.9);
  shed.castShadow = false;
  shed.receiveShadow = false;
  grp.add(shed);
  var shed2 = shed.clone();
  shed2.position.set(cx + far * 0.68, 0.44, cz - span * 0.96);
  shed2.scale.set(0.88, 0.82, 1.04);
  grp.add(shed2);
  var berm = new THREE.Mesh(
    new THREE.BoxGeometry(span * 7.4, 0.52, span * 0.95),
    contextMat,
  );
  berm.position.set(cx - far * 0.34, 0.24, cz + span * 1.2);
  berm.castShadow = false;
  berm.receiveShadow = false;
  grp.add(berm);
  scene.add(grp);
  return grp;
}

function _isoBackdropSetOpacity(opacity) {
  if (!_isoThree.backdropGroup) return;
  var alpha = Math.max(0.14, Math.min(1, opacity));
  _isoThree.backdropGroup.traverse(function (obj) {
    if (!obj.material) return;
    var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(function (mat) {
      mat.transparent = true;
      mat.opacity = alpha;
    });
  });
}

function _updateIsoBackdropFadeForCamera() {
  if (!_isoThree.camera || !_isoThree.controls || !_isoThree.backdropGroup)
    return;
  var cam = _isoThree.camera.position;
  var tgt = _isoThree.controls.target;
  var dx = Math.abs(cam.x - tgt.x);
  var dz = Math.abs(cam.z - tgt.z);
  var planar = Math.max(0.0001, dx + dz);
  var sideRatio = dz / planar;
  var start = 0.64;
  var end = 0.86;
  var t = (sideRatio - start) / (end - start);
  t = Math.max(0, Math.min(1, t));
  var keep = 0.95 - t * 0.77;
  _isoBackdropSetOpacity(keep);
}

// ── LOAD MESHES + BLOCK LABELS ───────────────────────────────────────────────

function syncIsoLoadMeshes(THREE) {
  if (!_isoThree.loadGroup) return;
  var grp = _isoThree.loadGroup;
  while (grp.children.length) {
    var ch = grp.children[0];
    grp.remove(ch);
    disposeObject3D(ch);
  }
  var sc = _app.getScale();
  _app.getPlacedBlocks().forEach(function (block) {
    var L = block.w / sc;
    var Wd = block.h / sc;
    var H = block.height || 0.3;
    var x0 = block.x / sc;
    var y0 = block.y / sc;

    /* Per-load-type silhouette builder (loadMeshes.js). Returns a bottom-origin
       Group (y = 0 at deck level), so position with y = block.z directly — no
       half-height offset like the old centred BoxGeometry needed. */
    var group = buildLoadMesh(THREE, block, sc);
    group.position.set(x0 + L / 2, block.z, y0 + Wd / 2);
    group.userData.block = block;
    group.userData.targetY = block.z;

    var labelText =
      block.description || block.isoType || block.loadId || "Load " + block.id;
    var labelSprite = makeIsoBlockLabel(THREE, labelText);
    /* Sit the label just above the top of the load (bottom-origin group). */
    labelSprite.position.set(0, H + 0.22, 0);
    /* Respect the user's "Show labels" preference at creation time; the toggle
       handler also runs `applyIsoLabelVisibility` post-hoc when flipped. */
    if (_app && _app.getShowIsoLabels && !_app.getShowIsoLabels()) {
      labelSprite.visible = false;
    }
    group.add(labelSprite);

    grp.add(group);
  });
}

/** Canvas-textured Sprite for labelling a placed cargo block. */
function makeIsoBlockLabel(THREE, text) {
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var pad = 14;
  var probe = document.createElement("canvas").getContext("2d");
  probe.font = "600 22px 'Segoe UI', system-ui, sans-serif";
  var label = (text || "").trim();
  if (label.length > 28) label = label.slice(0, 27) + "…";
  var w = Math.ceil(probe.measureText(label).width) + pad * 2;
  var h = 38;
  var c = document.createElement("canvas");
  c.width = w * DPR;
  c.height = h * DPR;
  var g = c.getContext("2d");
  g.scale(DPR, DPR);
  var r = 10;
  g.fillStyle = "rgba(38, 50, 56, 0.92)";
  g.beginPath();
  g.moveTo(r, 0);
  g.lineTo(w - r, 0);
  g.quadraticCurveTo(w, 0, w, r);
  g.lineTo(w, h - r);
  g.quadraticCurveTo(w, h, w - r, h);
  g.lineTo(r, h);
  g.quadraticCurveTo(0, h, 0, h - r);
  g.lineTo(0, r);
  g.quadraticCurveTo(0, 0, r, 0);
  g.closePath();
  g.fill();
  g.fillStyle = "#ffffff";
  g.font = "600 22px 'Segoe UI', system-ui, sans-serif";
  g.textBaseline = "middle";
  g.fillText(label, pad, h / 2 + 1);

  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  var mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  var sp = new THREE.Sprite(mat);
  var worldW = w * 0.012;
  var worldH = h * 0.012;
  sp.scale.set(worldW, worldH, 1);
  return sp;
}

// ── SCENE BUILD ──────────────────────────────────────────────────────────────

function buildIsoScene(THREE, OrbitControls, bed) {
  var cont = document.getElementById("iso-three");
  var ttSig = "";
  var ttActive = _app.getActiveTrailerType();
  if (ttActive) {
    ttSig =
      ttActive.id +
      ":" +
      ttActive.sections
        .map(function (s) {
          return s.lengthM;
        })
        .join(",");
  }
  var theme = getTractorCabTheme();
  var truck = _app.getSelectedTruck();
  var trailer = _app.getSelectedTrailer();
  var layoutKey = truck ? _app.normalizeLayoutKey(truck.layout) : "";
  var fleetNumber = truck && truck.fleetNumber ? String(truck.fleetNumber) : "";
  var branding = { fleetNumber: fleetNumber };
  var sig =
    String(theme.styleId || "") +
    "|" +
    (truck && truck.id ? truck.id : "") +
    "|" +
    fleetNumber +
    "|" +
    (trailer ? String(trailer.id) : "truckdeck") +
    "|" +
    bed.length +
    "x" +
    bed.width +
    "|" +
    ttSig +
    "|" +
    layoutKey;
  var needNew = !_isoThree.renderer || _isoThree.truckSig !== sig;

  if (needNew) {
    disposeIsoThree();
    _isoThree.truckSig = sig;
    _isoThree.scene = new THREE.Scene();

    _isoThree.scene.background = isoPresentationCreateSkyTexture(THREE);

    var aspect = cont.clientWidth / Math.max(cont.clientHeight, 1);
    _isoThree.camera = new THREE.PerspectiveCamera(
      ISO_PRESENTATION.CAM_FOV,
      aspect,
      0.1,
      500,
    );
    _isoThree.camera.up.set(0, 1, 0);

    _isoThree.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    _isoThree.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    _isoThree.renderer.setSize(cont.clientWidth, cont.clientHeight);
    /* sRGB output + ACES Filmic tone mapping — the two settings that take Three.js
     * from "WebGL demo" to "product render" without changing a single material. */
    _isoThree.renderer.outputColorSpace = THREE.SRGBColorSpace;
    _isoThree.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _isoThree.renderer.toneMappingExposure = ISO_PRESENTATION.TONE_EXPOSURE;
    /* r155+ uses physical light units by default; the legacy flag is deprecated. */
    _isoThree.renderer.shadowMap.enabled = true;
    _isoThree.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    cont.innerHTML = "";
    cont.appendChild(_isoThree.renderer.domElement);

    /* Image-based lighting via RoomEnvironment. PMREMGenerator builds a pre-filtered
     * mipmapped radiance environment that drives reflections on every MeshStandardMaterial. */
    if (_isoThree.RoomEnv) {
      var pmrem = new THREE.PMREMGenerator(_isoThree.renderer);
      pmrem.compileEquirectangularShader();
      _isoThree.scene.environment = pmrem.fromScene(
        new _isoThree.RoomEnv(),
        0.04,
      ).texture;
      _isoThree.pmrem = pmrem;
    }

    _isoThree.controls = new OrbitControls(
      _isoThree.camera,
      _isoThree.renderer.domElement,
    );
    _isoThree.controls.enableDamping = true;
    _isoThree.controls.dampingFactor = 0.06;
    _isoThree.controls.enableZoom = true;
    _isoThree.controls.minPolarAngle = ISO_PRESENTATION.MIN_POLAR;
    _isoThree.controls.maxPolarAngle = ISO_PRESENTATION.MAX_POLAR;

    /* Click-to-move on placed load meshes — install once per renderer. */
    _installLoadMoveHandlers();

    var rf = isoPresentationComputeRigFrame(bed);
    var cx = rf.cx;
    var cz = rf.cz;
    var d = rf.d;
    var totalLen = rf.totalLen;
    var nu = isoPresentationStyleCamNudge(theme.styleId);
    _isoThree.controls.target.set(
      cx + nu.tx,
      ISO_PRESENTATION.TARGET_Y + nu.ty,
      cz + nu.tz,
    );
    _isoThree.camera.position.set(
      cx + d * ISO_PRESENTATION.ISO_CAM_X_MUL + nu.px,
      d * ISO_PRESENTATION.ISO_CAM_Y_MUL + nu.py,
      cz + d * ISO_PRESENTATION.ISO_CAM_Z_MUL + nu.pz,
    );
    _isoThree.controls.minDistance = Math.max(2.2, d * 0.26);
    _isoThree.controls.maxDistance = d * 3.6;

    _isoThree.scene.fog = new THREE.Fog(
      0xc8d2db,
      Math.max(5, d * 0.3),
      Math.max(44, d * 5.9),
    );

    /* 3-light rig: hemisphere fills the shadow side with sky/ground bounce; the sun
     * is the only shadow-caster (warm-tinted, low angle); a cool fill from behind
     * keeps silhouettes readable on the dark side without washing out the shadow. */
    _isoThree.scene.add(new THREE.HemisphereLight(0xd8e8f8, 0xc8b8a0, 0.52));

    /* Warm key sun — brighter (2.45 → 2.85) and a touch lower in the sky
     * (7.2 → 6.0 × ISO_MAX_H) so it rakes across the rig, deepening the shadows
     * on the loads and reading the cab/trailer forms more clearly. */
    var sun = new THREE.DirectionalLight(0xffe8c8, 2.85);
    sun.position.set(bed.length * 1.42, ISO_MAX_H * 6.0, bed.width * 1.22);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    var shadowExtent = Math.max(totalLen, bed.width) * 1.5;
    sun.shadow.camera.left = -shadowExtent;
    sun.shadow.camera.right = shadowExtent;
    sun.shadow.camera.top = shadowExtent;
    sun.shadow.camera.bottom = -shadowExtent;
    sun.shadow.bias = -0.00028;
    sun.shadow.normalBias = 0.018;
    sun.shadow.radius = 3.2;
    _isoThree.scene.add(sun);

    /* Cool fill — pulled back (0.28 → 0.22) so the shadow side stays readable
     * without flattening the contrast the lower sun now gives us. */
    var fill = new THREE.DirectionalLight(0x9eb4dc, 0.22);
    fill.position.set(-bed.length * 1.1, ISO_MAX_H * 2.8, -bed.width * 1.2);
    _isoThree.scene.add(fill);

    var rim = new THREE.DirectionalLight(0xe8f0ff, 0.32);
    rim.position.set(cx, ISO_MAX_H * 3.6, -bed.width * 2.2);
    _isoThree.scene.add(rim);

    var groundSize = Math.max(totalLen, bed.width) * 8;
    var gTex = isoPresentationCreateGroundTexture(THREE);
    /* WHEEL_RADIUS_M would belong on the trailer module; duplicate the magic 0.5
     * here for ground positioning to avoid cross-module reach for one literal. */
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundSize, groundSize),
      new THREE.MeshStandardMaterial({
        map: gTex,
        color: 0xffffff,
        metalness: 0.04,
        roughness: 0.93,
        envMapIntensity: 0.1,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx, -0.5 * 2 - 0.02, cz);
    ground.receiveShadow = true;
    _isoThree.scene.add(ground);
    _isoThree.ground = ground;

    _isoThree.backdropGroup = isoPresentationAddBackdrop(
      THREE,
      _isoThree.scene,
      cx,
      cz,
      Math.max(totalLen, bed.width),
    );

    _isoThree.loadGroup = new THREE.Group();
    _isoThree.scene.add(_isoThree.loadGroup);

    /* Build the bed group via trailer.js; drop in the tractor horse via tractor.js. */
    var trailerActive = !!(trailer && trailer.bedLengthM > 0);
    if (_isoThree.bedGroup) {
      _isoThree.scene.remove(_isoThree.bedGroup);
      disposeObject3D(_isoThree.bedGroup);
    }
    _isoThree.bedGroup = buildBedGroup(THREE, bed, {
      trailerType: ttActive,
      trailerActive: trailerActive,
      truckLayoutKey: !trailerActive && truck ? layoutKey : "",
      /* Ground metric lane for demo readability:
       * - extend to the front nose zone so it feels like one continuous ruler
       * - expose cab-length metric separately so users can read cab vs trailer */
      groundMarkerStartX:
        trailerActive && truck
          ? -Math.max(
              getEstimatedTractorCabLengthM() + 1.35,
              getHorseBodyLengthForTruckLayout(layoutKey) + 0.85,
            )
          : 0,
      groundMarkerEndX: bed.length,
      groundMarkerCabLengthM:
        trailerActive && truck ? getEstimatedTractorCabLengthM() : 0,
      branding: branding,
      addTractorHorse:
        trailerActive && truck
          ? function (parent) {
              addIsoTractorHorse(THREE, parent, layoutKey, {
                bedWidth: bed.width,
                branding: branding,
              });
            }
          : null,
    });
    _isoThree.scene.add(_isoThree.bedGroup);

    if (_isoThree._ro)
      try {
        _isoThree._ro.disconnect();
      } catch (e2) {
        /* noop */
      }
    _isoThree._ro = new ResizeObserver(function () {
      if (!_isoThree.renderer || _app.getViewMode() !== "iso") return;
      var c = document.getElementById("iso-three");
      var w = c.clientWidth;
      var h = c.clientHeight;
      if (w < 8 || h < 8) return;
      _isoThree.camera.aspect = w / h;
      _isoThree.camera.updateProjectionMatrix();
      _isoThree.renderer.setSize(w, h);
    });
    _isoThree._ro.observe(cont);
  }

  syncIsoLoadMeshes(THREE);
  if (_isoThree.controls) _isoThree.controls.update();
  _updateIsoBackdropFadeForCamera();
}

// ── ANIMATION + CAMERA PRESETS ───────────────────────────────────────────────

/** Ease-out back: overshoots slightly then settles — placement gets physical weight
 *  without a real physics solver. s≈1.7 is the standard easings overshoot constant. */
function _easeOutBack(t) {
  var s = 1.70158;
  t = t - 1;
  return t * t * ((s + 1) * t + s) + 1;
}

function _easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Ease-in cubic: slow start, accelerating finish — reads as a truck pulling
 *  away from a standstill. */
function _easeInCubic(t) {
  return t * t * t;
}

function isoAnimateLoop() {
  if (!_isoThree.renderer || !_app || _app.getViewMode() !== "iso") return;
  _isoThree.rafId = requestAnimationFrame(isoAnimateLoop);

  /* Camera preset tween — runs before controls.update() so OrbitControls picks
   * up the new position/target on the very next frame without fighting us. */
  if (_isoThree.camTween) {
    var ct = _isoThree.camTween;
    var t = (Date.now() - ct.startTs) / ct.duration;
    if (t >= 1) {
      _isoThree.camera.position.set(ct.toPos.x, ct.toPos.y, ct.toPos.z);
      if (_isoThree.controls) {
        _isoThree.controls.target.set(
          ct.toTarget.x,
          ct.toTarget.y,
          ct.toTarget.z,
        );
        /* Keep controls locked while a Save cinematic is mid-flight — the
         * opening "cut to side" tween must not hand orbit back to the user
         * before the rig has finished driving off. */
        _isoThree.controls.enabled = !_isoCinematic;
      }
      _isoThree.camTween = null;
    } else {
      var k = _easeInOutCubic(t);
      _isoThree.camera.position.set(
        ct.fromPos.x + (ct.toPos.x - ct.fromPos.x) * k,
        ct.fromPos.y + (ct.toPos.y - ct.fromPos.y) * k,
        ct.fromPos.z + (ct.toPos.z - ct.fromPos.z) * k,
      );
      if (_isoThree.controls) {
        _isoThree.controls.target.set(
          ct.fromTarget.x + (ct.toTarget.x - ct.fromTarget.x) * k,
          ct.fromTarget.y + (ct.toTarget.y - ct.fromTarget.y) * k,
          ct.fromTarget.z + (ct.toTarget.z - ct.fromTarget.z) * k,
        );
      }
    }
  }

  /* Drive-off tween (Save cinematic): slide the whole rig — bed group AND the
   * cargo group, in lockstep so loads ride with the trailer — along -X until it
   * clears the left edge of the side-view frame. Ease-in reads as a truck
   * pulling away. onComplete resets the rig + resolves the caller's Promise. */
  if (_isoThree.rigTween) {
    var rt = _isoThree.rigTween;
    var rtp = (Date.now() - rt.startTs) / rt.duration;
    var rx;
    if (rtp >= 1) {
      rx = rt.toX;
    } else {
      rx = rt.fromX + (rt.toX - rt.fromX) * _easeInCubic(rtp);
    }
    if (_isoThree.bedGroup) _isoThree.bedGroup.position.x = rx;
    if (_isoThree.loadGroup) _isoThree.loadGroup.position.x = rx;
    if (rtp >= 1) {
      var onDone = rt.onComplete;
      _isoThree.rigTween = null;
      if (onDone) onDone();
    }
  }

  if (_isoThree.controls) _isoThree.controls.update();
  _updateIsoBackdropFadeForCamera();

  /* Drop-in animation: any mesh whose block has placedAt within the last ~600ms
   * is offset upward and eased back into place. */
  if (_isoThree.loadGroup && _isoThree.loadGroup.children.length) {
    var now = Date.now();
    var DUR = 600;
    var DROP_M = 2.2;
    _isoThree.loadGroup.children.forEach(function (mesh) {
      var b = mesh.userData && mesh.userData.block;
      if (!b || !b.placedAt) return;
      var elapsed = now - b.placedAt;
      if (elapsed >= DUR) {
        mesh.position.y = mesh.userData.targetY;
        return;
      }
      var tt = elapsed / DUR;
      var eased = _easeOutBack(tt);
      mesh.position.y = mesh.userData.targetY + DROP_M * (1 - eased);
    });
  }

  _isoThree.renderer.render(_isoThree.scene, _isoThree.camera);
}

/** Compute camera position + look-at target for a given preset name in metres.
 *  Uses the same rig framing as buildIsoScene. */
function cameraPresetFrame(name, bed) {
  var rf = isoPresentationComputeRigFrame(bed);
  var cx = rf.cx;
  var cz = rf.cz;
  var d = rf.d;
  var xMin = rf.xMin;
  var theme = getTractorCabTheme();
  var nu = isoPresentationStyleCamNudge(theme.styleId);
  var ty = ISO_PRESENTATION.TARGET_Y + nu.ty;
  switch (name) {
    case "top":
      return {
        pos: { x: cx + nu.tx * 0.15, y: d * 1.42, z: cz + 0.001 },
        target: { x: cx + nu.tx * 0.15, y: 0, z: cz + nu.tz * 0.15 },
      };
    case "front":
      return {
        pos: { x: xMin - d * 0.6, y: d * 0.28, z: cz + nu.tz },
        target: { x: cx + d * 0.06, y: ty + 0.38, z: cz + nu.tz },
      };
    case "rear":
      return {
        pos: { x: bed.length + d * 0.62, y: d * 0.28, z: cz + nu.tz },
        target: { x: cx - d * 0.04, y: ty + 0.38, z: cz + nu.tz },
      };
    case "side":
      return {
        pos: { x: cx + nu.tx, y: d * 0.3, z: cz + d * 1.05 },
        target: { x: cx + nu.tx, y: ty + 0.36, z: cz + nu.tz },
      };
    case "iso":
    default:
      return {
        pos: {
          x: cx + d * ISO_PRESENTATION.ISO_CAM_X_MUL + nu.px,
          y: d * ISO_PRESENTATION.ISO_CAM_Y_MUL + nu.py,
          z: cz + d * ISO_PRESENTATION.ISO_CAM_Z_MUL + nu.pz,
        },
        target: { x: cx + nu.tx, y: ty, z: cz + nu.tz },
      };
  }
}

/** Start a camera tween from the current camera position/target to the given preset. */
function tweenIsoCameraToPreset(name) {
  if (!_isoThree.renderer || !_isoThree.camera || !_isoThree.controls) return;
  var bed = _app.getCurrentBed();
  if (!bed) return;

  var frame = cameraPresetFrame(name, bed);
  var c = _isoThree.camera;
  var t = _isoThree.controls.target;
  _isoThree.camTween = {
    fromPos: { x: c.position.x, y: c.position.y, z: c.position.z },
    toPos: frame.pos,
    fromTarget: { x: t.x, y: t.y, z: t.z },
    toTarget: frame.target,
    startTs: Date.now(),
    duration: 700,
  };
}

/** Reflect the active camera preset in the toolbar button row (cosmetic). */
function _setActiveCamButton(name) {
  var bar = document.getElementById("iso-cam-presets");
  if (!bar) return;
  Array.prototype.forEach.call(bar.querySelectorAll(".cam-btn"), function (b) {
    b.classList.toggle("cam-btn--active", b.dataset.cam === name);
  });
}

/** True while the Save drive-off cinematic is running. Lets planner.js avoid
 *  stacking a second sequence on a rapid double Save. */
export function isIsoCinematicPlaying() {
  return !!_isoCinematic;
}

/**
 * Demo "load dispatched" cinematic: cut to the side view, then drive the loaded
 * rig off the left edge of the frame before resetting it back to centre.
 *
 * Deliberately lightweight — it reuses the existing camera-preset tween and a
 * single position tween in the animation loop (no fog/sky/light changes, no
 * wheel spin, no postprocessing). Resolves once the rig is off-screen so the
 * caller can show its "Layout saved" modal, whose overlay hides the instant
 * reset back to the planning pose.
 *
 * @returns {Promise<void>} resolves when the drive-off finishes (or immediately
 *   if the scene isn't ready / a cinematic is already playing).
 */
export function playIsoSaveCinematic() {
  return new Promise(function (resolve) {
    if (
      _isoCinematic ||
      !_isoThree.renderer ||
      !_isoThree.camera ||
      !_isoThree.controls ||
      !_isoThree.bedGroup
    ) {
      resolve();
      return;
    }
    var bed = _app && _app.getCurrentBed();
    if (!bed) {
      resolve();
      return;
    }

    _isoCinematic = { resolve: resolve };
    /* Lock orbit for the whole sequence; the opening side-tween completion is
     * guarded against re-enabling it (see isoAnimateLoop camTween block). */
    _isoThree.controls.enabled = false;

    /* Phase 1 — cut to the side profile (reuses the Side preset tween). */
    tweenIsoCameraToPreset("side");
    _setActiveCamButton("side");

    /* Phase 2 — once the camera has settled on the side, drive the rig left
     * (-X) far enough that the whole horse + trailer + cargo clears the frame. */
    var CAM_SETTLE_MS = 760;
    setTimeout(function () {
      if (!_isoCinematic) return; /* scene was torn down mid-sequence */
      var rf = isoPresentationComputeRigFrame(bed);
      var clearX = -(rf.totalLen + rf.d * 1.3);
      _isoThree.rigTween = {
        startTs: Date.now(),
        duration: 2500,
        fromX: 0,
        toX: clearX,
        onComplete: _finishIsoSaveCinematic,
      };
    }, CAM_SETTLE_MS);
  });
}

/** Reset the rig to its planning pose, return the camera to the default iso
 *  framing, hand control back to the user, and resolve the cinematic Promise. */
function _finishIsoSaveCinematic() {
  if (_isoThree.bedGroup) _isoThree.bedGroup.position.x = 0;
  if (_isoThree.loadGroup) _isoThree.loadGroup.position.x = 0;
  _isoThree.rigTween = null;

  var done = _isoCinematic && _isoCinematic.resolve;
  _isoCinematic =
    null; /* clear before the tween so controls re-enable on settle */

  tweenIsoCameraToPreset("iso");
  _setActiveCamButton("iso");
  if (_isoThree.controls) _isoThree.controls.enabled = true;

  if (done) done();
}

/** Idempotent — safe to call on every iso view entry. */
function wireIsoCameraPresets() {
  var bar = document.getElementById("iso-cam-presets");
  if (!bar || bar.dataset.bound === "1") return;
  bar.dataset.bound = "1";
  bar.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".cam-btn");
    if (!btn) return;
    var name = btn.dataset.cam;
    if (!name) return;
    Array.prototype.forEach.call(
      bar.querySelectorAll(".cam-btn"),
      function (b) {
        b.classList.toggle("cam-btn--active", b === btn);
      },
    );
    tweenIsoCameraToPreset(name);
  });
}
