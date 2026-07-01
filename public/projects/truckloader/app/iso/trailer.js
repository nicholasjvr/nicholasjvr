// app/iso/trailer.js
// Three.js builders for the trailer deck: wheels, axles, section grids, dashed
// section dividers, height guide, and the assembled bed group. No DOM, no app
// state — everything needed is passed in by scene.js.

import { addTrailerBrandingDecals, getCachedBadgeTexture } from "./brand.js";

// ── CONSTANTS shared with tractor.js / scene.js ──────────────────────────────

/** Per-layout axle positions as fraction of body length. Used for **rigid
 *  trucks** that carry the cargo deck on their own chassis (no trailer).
 *  The horse (tractor) uses HORSE_AXLE_TEMPLATES instead — see below. */
export const TRACTOR_AXLE_TEMPLATES = {
  "4-Wheels": [
    { pos: 0.22, type: "single" },
    { pos: 0.82, type: "single" },
  ],
  "6-Wheels": [
    { pos: 0.2, type: "single" },
    { pos: 0.82, type: "dual" },
  ],
  "8-Wheels": [
    { pos: 0.2, type: "dual" },
    { pos: 0.82, type: "dual" },
  ],
  "10-Wheels": [
    { pos: 0.18, type: "single" },
    { pos: 0.72, type: "dual" },
    { pos: 0.88, type: "dual" },
  ],
  "14-Wheels": [
    { pos: 0.14, type: "single" },
    { pos: 0.58, type: "dual" },
    { pos: 0.74, type: "dual" },
    { pos: 0.9, type: "dual" },
  ],
  "22-Wheels": [
    { pos: 0.1, type: "single" },
    { pos: 0.38, type: "dual" },
    { pos: 0.5, type: "dual" },
    { pos: 0.66, type: "dual" },
    { pos: 0.8, type: "dual" },
    { pos: 0.94, type: "dual" },
  ],
};

/** Tractor horse axle configurations — real-world Scania/Volvo/MAN layouts.
 *  The horse never carries more than 4 axles; remaining wheels belong to the
 *  trailer (which gets its own tridem-per-section axles from
 *  `getTrailerAxlesForSections`). Positions are fraction of horse body length.
 *
 *    horse4x2 — 1 steer + 1 drive (4 tyres total, light short-haul)
 *    horse6x2 — 1 steer + 1 tag single + 1 drive dual (6 tyres, fuel-saver)
 *    horse6x4 — 1 steer + 2 drive duals (10 tyres, classic heavy haul)
 *    horse8x4 — 2 steer + 2 drive duals (12 tyres, heavy specialty)        */
/* Axle positions tuned to real Scania wheelbases and tandem spread. The
 * drive tandem on 6x4/8x4 sits ~1.35 m apart in reality; previous
 * 0.72/0.88 (≈ 0.86 m on a 5.4 m body) looked visually packed. Spreading
 * to 0.72/0.93 puts the drive pair where a real Scania 6x4 has it. */
export const HORSE_AXLE_TEMPLATES = {
  horse4x2: [
    { pos: 0.22, type: "single" },
    { pos: 0.86, type: "dual" },
  ],
  horse6x2: [
    { pos: 0.18, type: "single" },
    { pos: 0.74, type: "single" },
    { pos: 0.91, type: "dual" },
  ],
  horse6x4: [
    { pos: 0.18, type: "single" },
    { pos: 0.72, type: "dual" },
    { pos: 0.93, type: "dual" },
  ],
  horse8x4: [
    { pos: 0.14, type: "single" },
    { pos: 0.3, type: "single" },
    { pos: 0.74, type: "dual" },
    { pos: 0.94, type: "dual" },
  ],
};

/** Map the truck's TOTAL wheel layout to a sensible horse axle config.
 *  The remaining wheels live under the trailer (handled separately). */
export function deriveHorseAxleLayout(truckLayoutKey) {
  switch (truckLayoutKey) {
    case "4-Wheels":
    case "6-Wheels":
      return "horse4x2";
    case "8-Wheels":
      return "horse6x2";
    case "10-Wheels":
    case "14-Wheels":
      return "horse6x4";
    case "22-Wheels":
      return "horse8x4";
    default:
      return "horse6x4";
  }
}

/** Horse body length in metres, scaled by axle count so cabs don't float on
 *  short rigs and 4-axle horses don't look stubby. Bumped up from the first
 *  pass (5.4 m for 6x4) — feedback was the truck looked packed and tall;
 *  giving the wheels more chassis to spread across reads as a real tractor. */
const HORSE_BODY_LENGTH_BY_LAYOUT_M = {
  horse4x2: 5.2,
  horse6x2: 5.9,
  horse6x4: 6.2,
  horse8x4: 6.7,
};

export function getHorseBodyLengthM(horseLayoutKey) {
  return HORSE_BODY_LENGTH_BY_LAYOUT_M[horseLayoutKey] || 5.4;
}

/** Tridem at the rear of every trailer section — offsets from section rear edge. */
const TRAILER_SECTION_REAR_AXLE_OFFSETS_M = [1.5, 2.82, 4.14];

export const WHEEL_RADIUS_M = 0.5;
const WHEEL_WIDTH_M = 0.27;
const WHEEL_INBOARD_GAP_M = 0.05;

/** Metres — ceiling for side + iso view height axis (drives dividers / height guide). */
export const ISO_MAX_H = 3.0;

// ── AXLE LAYOUT ──────────────────────────────────────────────────────────────

function getTrailerAxlesForSections(sections) {
  var axles = [];
  if (!sections || !sections.length) return axles;
  var cum = 0;
  for (var i = 0; i < sections.length; i++) {
    var L = sections[i] && sections[i].lengthM;
    if (!(L > 0)) continue;
    var rear = cum + L;
    for (var j = 0; j < TRAILER_SECTION_REAR_AXLE_OFFSETS_M.length; j++) {
      var off = TRAILER_SECTION_REAR_AXLE_OFFSETS_M[j];
      if (off >= L - 0.2) continue;
      axles.push({ x: rear - off, type: "dual" });
    }
    cum = rear;
  }
  return axles;
}

// ── WHEELS ───────────────────────────────────────────────────────────────────

function buildTyreWheelAssembly(THREE, tyreMat, hubMat, tyreOpts) {
  tyreOpts = tyreOpts || {};
  var rm = tyreOpts.radiusMul ? tyreOpts.radiusMul : 1;
  var wm = tyreOpts.widthMul ? tyreOpts.widthMul : 1;
  var r = WHEEL_RADIUS_M * rm;
  var w = WHEEL_WIDTH_M * wm;
  var group = new THREE.Group();
  var seg = 22;
  /* Sidewall bulge — wider at outer tread, narrower at rim for industrial read. */
  var tyreGeom = new THREE.CylinderGeometry(
    r * 1.06,
    r * 0.94,
    w * 1.08,
    seg,
    1,
    false,
  );
  var tyre = new THREE.Mesh(tyreGeom, tyreMat);
  tyre.rotation.x = Math.PI / 2;
  tyre.castShadow = true;
  tyre.receiveShadow = true;
  group.add(tyre);
  var hub = hubMat || tyreMat;
  var discR = r * 0.42;
  var discT = Math.max(0.032, w * 0.16);
  var discGeom = new THREE.CylinderGeometry(discR, discR * 0.88, discT, 14);
  var dA = new THREE.Mesh(discGeom, hub);
  dA.rotation.x = Math.PI / 2;
  dA.position.z = w * 0.5 - discT * 0.42;
  dA.castShadow = true;
  dA.receiveShadow = true;
  group.add(dA);
  var dB = dA.clone();
  dB.position.z = -w * 0.5 + discT * 0.42;
  group.add(dB);
  /* Rim face inset — shallow dish reads as steel wheel, not flat disc. */
  var faceR = discR * 0.72;
  var faceT = Math.max(0.018, discT * 0.55);
  var faceGeom = new THREE.CylinderGeometry(faceR, faceR * 0.92, faceT, 12);
  var faceA = new THREE.Mesh(faceGeom, hub);
  faceA.rotation.x = Math.PI / 2;
  faceA.position.z = w * 0.5 - discT * 0.78;
  faceA.castShadow = true;
  group.add(faceA);
  var faceB = faceA.clone();
  faceB.position.z = -w * 0.5 + discT * 0.78;
  group.add(faceB);
  var lugN = 6;
  var lugR = 0.028 * Math.max(0.95, rm);
  var lugGeo = new THREE.CylinderGeometry(lugR, lugR, 0.022, 6);
  var orbit = discR * 0.58;
  for (var i = 0; i < lugN; i++) {
    var ang = (i / lugN) * Math.PI * 2;
    var lug = new THREE.Mesh(lugGeo, hub);
    lug.rotation.x = Math.PI / 2;
    lug.position.set(
      Math.cos(ang) * orbit,
      Math.sin(ang) * orbit,
      w * 0.5 - discT * 0.32,
    );
    lug.castShadow = true;
    lug.receiveShadow = true;
    group.add(lug);
  }
  /* Steel-rim cues: raised outer ring, vent holes, and a center cap. */
  var ringR = discR * 0.88;
  var ringTube = Math.max(0.008, discT * 0.2);
  var ringGeo = new THREE.TorusGeometry(ringR, ringTube, 10, 24);
  var ringA = new THREE.Mesh(ringGeo, hub);
  ringA.rotation.x = Math.PI / 2;
  ringA.position.z = w * 0.5 - discT * 0.72;
  ringA.castShadow = true;
  ringA.receiveShadow = true;
  group.add(ringA);
  var ringB = ringA.clone();
  ringB.position.z = -w * 0.5 + discT * 0.72;
  group.add(ringB);

  var ventN = 10;
  var ventOrbit = discR * 0.74;
  var ventR = Math.max(0.011, discR * 0.09);
  var ventDepth = Math.max(0.01, discT * 0.55);
  var ventMat = new THREE.MeshStandardMaterial({
    color: 0x20262c,
    metalness: 0.18,
    roughness: 0.7,
  });
  var ventGeo = new THREE.CylinderGeometry(ventR, ventR, ventDepth, 10);
  for (var vi = 0; vi < ventN; vi++) {
    var va = (vi / ventN) * Math.PI * 2;
    var vx = Math.cos(va) * ventOrbit;
    var vy = Math.sin(va) * ventOrbit;
    var ventA = new THREE.Mesh(ventGeo, ventMat);
    ventA.rotation.x = Math.PI / 2;
    ventA.position.set(vx, vy, w * 0.5 - discT * 0.66);
    ventA.castShadow = true;
    ventA.receiveShadow = true;
    group.add(ventA);
    var ventB = ventA.clone();
    ventB.position.z = -w * 0.5 + discT * 0.66;
    group.add(ventB);
  }

  var capGeo = new THREE.CylinderGeometry(discR * 0.2, discR * 0.22, 0.03, 14);
  var capA = new THREE.Mesh(capGeo, hub);
  capA.rotation.x = Math.PI / 2;
  capA.position.z = w * 0.5 - discT * 0.2;
  capA.castShadow = true;
  capA.receiveShadow = true;
  group.add(capA);
  var capB = capA.clone();
  capB.position.z = -w * 0.5 + discT * 0.2;
  group.add(capB);
  return group;
}

function isoPresentationAddWheelContact(
  THREE,
  parent,
  worldX,
  worldZ,
  radius,
  groundY,
) {
  var r = radius * 1.22;
  var geom = new THREE.CircleGeometry(r, 20);
  var mat = new THREE.MeshBasicMaterial({
    color: 0x050608,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  var m = new THREE.Mesh(geom, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(worldX, groundY + 0.012, worldZ);
  m.renderOrder = -1;
  parent.add(m);
}

/** Place tyres + thin axle bar for each axle. Tyres sit below deck (y=0).
 *  `tyreOpts`: { radiusMul, widthMul, dualTyreGapMul } — tractor tunes these. */
export function placeAxleWheels(
  THREE,
  parent,
  axles,
  bodyWidth,
  tyreMat,
  tyreOpts,
  hubMat,
  groundY,
) {
  if (!axles || !axles.length) return;
  var rm = tyreOpts && tyreOpts.radiusMul ? tyreOpts.radiusMul : 1;
  var wm = tyreOpts && tyreOpts.widthMul ? tyreOpts.widthMul : 1;
  var gapMul =
    tyreOpts && tyreOpts.dualTyreGapMul != null ? tyreOpts.dualTyreGapMul : 1;
  var R = WHEEL_RADIUS_M * rm;
  var W = WHEEL_WIDTH_M * wm;
  var yC = -R;
  var inset = WHEEL_INBOARD_GAP_M;
  var dualGap = (0.052 + 0.028 * wm) * gapMul;
  var barMat = hubMat || tyreMat;
  axles.forEach(function (axle) {
    [
      { isLeft: true, outerZ: -inset },
      { isLeft: false, outerZ: bodyWidth + inset },
    ].forEach(function (side) {
      if (axle.type === "dual") {
        var outerCenter = side.isLeft
          ? side.outerZ - W / 2
          : side.outerZ + W / 2;
        var innerCenter = side.isLeft
          ? outerCenter - W - dualGap
          : outerCenter + W + dualGap;
        var t1 = buildTyreWheelAssembly(THREE, tyreMat, hubMat, tyreOpts);
        t1.position.set(axle.x, yC, outerCenter);
        parent.add(t1);
        var t2 = buildTyreWheelAssembly(THREE, tyreMat, hubMat, tyreOpts);
        t2.position.set(axle.x, yC, innerCenter);
        parent.add(t2);
        if (groundY != null) {
          isoPresentationAddWheelContact(
            THREE,
            parent,
            axle.x,
            outerCenter,
            R,
            groundY,
          );
          isoPresentationAddWheelContact(
            THREE,
            parent,
            axle.x,
            innerCenter,
            R,
            groundY,
          );
        }
      } else {
        var z = side.isLeft ? side.outerZ - W / 2 : side.outerZ + W / 2;
        var t = buildTyreWheelAssembly(THREE, tyreMat, hubMat, tyreOpts);
        t.position.set(axle.x, yC, z);
        parent.add(t);
        if (groundY != null)
          isoPresentationAddWheelContact(THREE, parent, axle.x, z, R, groundY);
      }
    });
    var barR = 0.048 * Math.max(1, (rm + wm) * 0.5);
    var barGeom = new THREE.CylinderGeometry(barR, barR, bodyWidth + 0.32, 8);
    var bar = new THREE.Mesh(barGeom, barMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(axle.x, yC - 0.02 * rm, bodyWidth / 2);
    bar.castShadow = true;
    bar.receiveShadow = true;
    parent.add(bar);
  });
}

// ── SECTION GRIDS / DIVIDERS / HEIGHT GUIDE ──────────────────────────────────

/** Compute per-section drawing bounds, shrinking each section by `gap/2` on its
 *  inner edges so a visible gap appears between adjacent sections. Outer edges
 *  (the very front + very back of the trailer) remain flush. */
function computeSectionDrawBounds(sections, bedLength, gap) {
  gap = gap > 0 ? gap : 0;
  var raw = [];
  if (sections && sections.length) {
    var cum = 0;
    for (var i = 0; i < sections.length; i++) {
      var L = sections[i] && sections[i].lengthM;
      if (!(L > 0)) continue;
      raw.push({ x0: cum, x1: cum + L, index: raw.length });
      cum += L;
    }
    if (raw.length && raw[raw.length - 1].x1 > bedLength + 1e-6) {
      raw[raw.length - 1].x1 = bedLength;
    }
  }
  if (!raw.length) raw.push({ x0: 0, x1: bedLength, index: 0 });

  var gapHalf = gap * 0.5;
  for (var k = 0; k < raw.length; k++) {
    if (k > 0) raw[k].x0 += gapHalf;
    if (k < raw.length - 1) raw[k].x1 -= gapHalf;
  }
  return raw;
}

/** Per-section grid overlays on the deck plane. With no sections, one grid covers the whole bed. */
function addIsoSectionGrids(THREE, parent, bed, sections, gap) {
  var bounds = computeSectionDrawBounds(sections, bed.length, gap || 0);

  var tintsMajor = [0x4db6ac, 0xff8a65, 0x9575cd, 0xffd54f];
  var tintsMinor = [0xb2dfdb, 0xffccbc, 0xd1c4e9, 0xfff59d];
  var step = 0.5;
  var yLine = 0.004;

  bounds.forEach(function (seg) {
    var grp = new THREE.Group();
    grp.name = "isoSectionGrid_" + seg.index;
    var majorMat = new THREE.LineBasicMaterial({
      color: tintsMajor[seg.index % tintsMajor.length],
      transparent: true,
      opacity: 0.6,
    });
    var minorMat = new THREE.LineBasicMaterial({
      color: tintsMinor[seg.index % tintsMinor.length],
      transparent: true,
      opacity: 0.4,
    });
    var minorPts = [];
    var majorPts = [];

    for (var x = seg.x0; x <= seg.x1 + 1e-6; x += step) {
      var xc = Math.min(x, seg.x1);
      var isMajor = Math.abs(xc - Math.round(xc)) < 1e-3;
      var bin = isMajor ? majorPts : minorPts;
      bin.push(new THREE.Vector3(xc, yLine, 0));
      bin.push(new THREE.Vector3(xc, yLine, bed.width));
    }
    for (var z = 0; z <= bed.width + 1e-6; z += step) {
      var zc = Math.min(z, bed.width);
      var isMajorZ = Math.abs(zc - Math.round(zc)) < 1e-3;
      var binZ = isMajorZ ? majorPts : minorPts;
      binZ.push(new THREE.Vector3(seg.x0, yLine, zc));
      binZ.push(new THREE.Vector3(seg.x1, yLine, zc));
    }

    if (minorPts.length) {
      grp.add(
        new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(minorPts),
          minorMat,
        ),
      );
    }
    if (majorPts.length) {
      grp.add(
        new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(majorPts),
          majorMat,
        ),
      );
    }
    parent.add(grp);
  });
}

/** Text billboard for height markers in the iso scene. */
function isoHeightLabelSprite(THREE, text) {
  var canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 44;
  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.93)";
  ctx.fillRect(6, 6, 116, 32);
  ctx.strokeStyle = "rgba(84,110,122,0.88)";
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, 116, 32);
  ctx.font = "bold 20px system-ui,Segoe UI,sans-serif";
  ctx.fillStyle = "#37474f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 22);
  var tex = new THREE.CanvasTexture(canvas);
  var mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  var s = new THREE.Sprite(mat);
  s.scale.set(0.72, 0.25, 1);
  return s;
}

function addIsoHeightGuide(THREE, parent, bed) {
  var grp = new THREE.Group();
  grp.name = "isoHeightGuide";
  var lineMat = new THREE.LineBasicMaterial({
    color: 0x546e7a,
    transparent: true,
    opacity: 0.9,
  });
  var faint = new THREE.LineBasicMaterial({
    color: 0x78909c,
    transparent: true,
    opacity: 0.45,
  });

  var postX = bed.length - 0.14;
  var lineZ = bed.width + 0.08;
  var postGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(postX, 0.02, lineZ),
    new THREE.Vector3(postX, ISO_MAX_H, lineZ),
  ]);
  grp.add(new THREE.Line(postGeom, lineMat));

  var tickY = 0.5;
  while (tickY <= ISO_MAX_H - 1e-6) {
    var tickGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(postX, tickY, lineZ),
      new THREE.Vector3(postX - 0.14, tickY, lineZ),
    ]);
    grp.add(new THREE.Line(tickGeom, faint));
    tickY += 0.5;
  }

  for (var ym = 1; ym <= ISO_MAX_H - 1e-6; ym += 1) {
    var hGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.04, ym, lineZ),
      new THREE.Vector3(bed.length - 0.04, ym, lineZ),
    ]);
    grp.add(new THREE.Line(hGeom, faint));
    var sp = isoHeightLabelSprite(THREE, ym + " m");
    sp.position.set(bed.length * 0.5, ym + 0.12, lineZ + 0.28);
    grp.add(sp);
  }

  parent.add(grp);
}

/** "NFL yard line" spray-paint colour. Single constant so the whole marker
 *  strip can be re-tinted in one place. Milltrans red. */
const YARD_PAINT_RGB = "211,47,47";
const YARD_PAINT_SECTION_RGB = "255,82,82";

/** Rounded-rectangle path helper (clean painted-marking edges). */
function _roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Paint a clean vertical tick — a crisp rounded bar with a faint inner
 *  highlight so it reads as fresh road paint, not a noisy spatter. */
function _paintTick(ctx, xPx, yTop, yBot, halfW, rgb, alpha) {
  ctx.fillStyle = "rgba(" + rgb + "," + alpha.toFixed(3) + ")";
  _roundRectPath(ctx, xPx - halfW, yTop, halfW * 2, yBot - yTop, halfW);
  ctx.fill();
  /* Subtle centre highlight for a slight painted sheen. */
  ctx.fillStyle = "rgba(255,255,255," + (alpha * 0.16).toFixed(3) + ")";
  _roundRectPath(
    ctx,
    xPx - halfW * 0.32,
    yTop + (yBot - yTop) * 0.06,
    halfW * 0.64,
    (yBot - yTop) * 0.88,
    halfW * 0.32,
  );
  ctx.fill();
}

/** Paint a clean continuous horizontal band ("sideline" rail). */
function _paintRail(ctx, x0, x1, yCenter, halfH, rgb, alpha) {
  ctx.fillStyle = "rgba(" + rgb + "," + alpha.toFixed(3) + ")";
  _roundRectPath(ctx, x0, yCenter - halfH, x1 - x0, halfH * 2, halfH);
  ctx.fill();
}

/** Draw label with optional per-character spacing for readability. */
function _drawSpacedText(ctx, text, x, y, trackingPx) {
  var s = String(text || "");
  if (!s) return;
  if (!(trackingPx > 0) || s.length < 2) {
    ctx.fillText(s, x, y);
    return;
  }
  var totalW = 0;
  for (var i = 0; i < s.length; i++) {
    totalW += ctx.measureText(s[i]).width;
  }
  totalW += trackingPx * (s.length - 1);
  var cx = x - totalW / 2;
  for (var j = 0; j < s.length; j++) {
    var ch = s[j];
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + trackingPx;
  }
}

function _strokeSpacedText(ctx, text, x, y, trackingPx) {
  var s = String(text || "");
  if (!s) return;
  if (!(trackingPx > 0) || s.length < 2) {
    ctx.strokeText(s, x, y);
    return;
  }
  var totalW = 0;
  for (var i = 0; i < s.length; i++) {
    totalW += ctx.measureText(s[i]).width;
  }
  totalW += trackingPx * (s.length - 1);
  var cx = x - totalW / 2;
  for (var j = 0; j < s.length; j++) {
    var ch = s[j];
    ctx.strokeText(ch, cx, y);
    cx += ctx.measureText(ch).width + trackingPx;
  }
}

/** Spray-painted running distance markers ("yard lines") on the ground strip
 *  alongside the trailer, on the camera-facing (+Z) side. Replaces the old
 *  dashed vertical section dividers + floating labels.
 *
 *  - clean framing rails (top trailer-facing sideline + bottom rail)
 *  - minor ticks every 0.5 m, major tick + metre number every 1 m
 *  - section boundaries (from trailerType.sections) get a bolder, brighter
 *    double bar so the section splits stay readable
 *  - drawn flat on the ground plane (~1 m below the deck) as crisp painted lane
 */
function addIsoGroundYardMarkers(THREE, parent, bed, trailerType, markerOpts) {
  markerOpts = markerOpts || {};
  var startX = Number(markerOpts.startX);
  if (!Number.isFinite(startX)) startX = 0;
  var endX = Number(markerOpts.endX);
  if (!Number.isFinite(endX)) endX = bed.length;
  var cabLengthM = Number(markerOpts.cabLengthM);
  if (!Number.isFinite(cabLengthM) || cabLengthM < 0) cabLengthM = 0;
  var lengthM = endX - startX;
  if (!(lengthM > 0)) return;

  /* Section boundary positions in metres (cumulative section lengths, excluding
     the trailing end-of-deck). */
  var boundaries = [];
  if (trailerType && trailerType.sections) {
    var cum = 0;
    for (var i = 0; i < trailerType.sections.length - 1; i++) {
      var sec = trailerType.sections[i];
      if (!sec || !(sec.lengthM > 0)) continue;
      cum += sec.lengthM;
      boundaries.push(cum);
    }
  }

  /* Canvas: X = length (left→right = 0→lengthM), Y = strip depth. High
     resolution so the oversized numbers stay crisp. */
  var pxPerM = 72;
  var canvasW = Math.max(160, Math.round(lengthM * pxPerM));
  var canvasH = 224;
  var canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvasW, canvasH);

  var xAt = function (worldX) {
    return ((worldX - startX) / lengthM) * canvasW;
  };
  /* Clean "measurement lane" layout, top→bottom: top rail · numbers · major +
     minor ticks · bottom rail. All proportional to canvasH so the whole lane
     scales from one place. */
  var edgePad = canvasW * 0.004;
  var topRailY = canvasH * 0.12;
  var numY = canvasH * 0.36;
  var tickTop = canvasH * 0.56;
  var tickBot = canvasH * 0.9;
  var minorTop = canvasH * 0.68;
  var bottomRailY = canvasH * 0.95;
  var railHalfH = canvasH * 0.018;
  var minorHalfW = canvasH * 0.014;
  var majorHalfW = canvasH * 0.026;
  var sectionHalfW = canvasH * 0.034;

  /* Two clean continuous rails frame the lane (top = trailer-facing sideline). */
  _paintRail(
    ctx,
    edgePad,
    canvasW - edgePad,
    topRailY,
    railHalfH,
    YARD_PAINT_RGB,
    0.95,
  );
  _paintRail(
    ctx,
    edgePad,
    canvasW - edgePad,
    bottomRailY,
    railHalfH * 0.8,
    YARD_PAINT_RGB,
    0.85,
  );

  /* Segment cue bands: CAB zone (blue) and TRAILER zone (red tint). */
  var trailerStartX = 0;
  var trailerStartPx = xAt(trailerStartX);
  var cabStartX = Math.max(startX, trailerStartX - cabLengthM);
  var cabStartPx = xAt(cabStartX);
  var bandTop = topRailY + canvasH * 0.02;
  var bandBot = tickTop - canvasH * 0.06;
  if (trailerStartPx > edgePad + 1) {
    ctx.fillStyle = "rgba(52,108,196,0.22)";
    _roundRectPath(
      ctx,
      edgePad,
      bandTop,
      Math.max(0, trailerStartPx - edgePad),
      bandBot - bandTop,
      canvasH * 0.02,
    );
    ctx.fill();
  }
  if (endX > trailerStartX + 0.01) {
    ctx.fillStyle = "rgba(211,47,47,0.11)";
    _roundRectPath(
      ctx,
      Math.max(edgePad, trailerStartPx),
      bandTop,
      Math.max(0, canvasW - edgePad - Math.max(edgePad, trailerStartPx)),
      bandBot - bandTop,
      canvasH * 0.02,
    );
    ctx.fill();
  }

  var drawSegmentTag = function (label, x0, x1, fill, textFill) {
    if (!(x1 > x0 + 16)) return;
    var cx = (x0 + x1) * 0.5;
    var ty = bandTop + (bandBot - bandTop) * 0.5;
    ctx.font = "700 " + Math.round(canvasH * 0.09) + "px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var tw = ctx.measureText(label).width + canvasH * 0.1;
    var th = canvasH * 0.12;
    ctx.fillStyle = fill;
    _roundRectPath(ctx, cx - tw / 2, ty - th / 2, tw, th, th * 0.45);
    ctx.fill();
    ctx.fillStyle = textFill;
    ctx.fillText(label, cx, ty + 1);
  };
  if (cabLengthM > 0 && trailerStartPx > edgePad + 12) {
    drawSegmentTag(
      "CAB " + cabLengthM.toFixed(1) + "m",
      edgePad,
      trailerStartPx,
      "rgba(24,67,138,0.86)",
      "rgba(235,244,255,1)",
    );
  }
  if (endX > trailerStartX + 0.01) {
    drawSegmentTag(
      "TRAILER " + (endX - trailerStartX).toFixed(1) + "m",
      Math.max(edgePad, trailerStartPx),
      canvasW - edgePad,
      "rgba(156,28,28,0.78)",
      "rgba(255,240,240,1)",
    );
  }

  /* Strong divider where trailer deck starts (x = 0). */
  if (trailerStartX >= startX - 1e-6 && trailerStartX <= endX + 1e-6) {
    var tx = xAt(trailerStartX);
    _paintTick(
      ctx,
      tx,
      topRailY - canvasH * 0.01,
      tickBot + canvasH * 0.01,
      sectionHalfW * 1.08,
      "66,165,245",
      0.98,
    );
  }

  /* Minor ticks every 0.5 m. */
  var halfTickStart = Math.ceil(startX * 2) / 2;
  for (var hm = halfTickStart; hm < endX - 1e-6; hm += 0.5) {
    var isMajorHalf = Math.abs(hm - Math.round(hm)) < 1e-3;
    if (isMajorHalf) continue;
    _paintTick(
      ctx,
      xAt(hm),
      minorTop,
      tickBot,
      minorHalfW,
      YARD_PAINT_RGB,
      0.78,
    );
  }

  /* Major ticks + big numbers every 1 m (include the final end-of-deck mark). */
  ctx.font =
    "900 " + Math.round(canvasH * 0.22) + "px 'Arial Narrow', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  var metreSlotW = canvasW / Math.max(lengthM, 1);
  var majorTickStart = Math.ceil(startX);
  for (var m = majorTickStart; m <= endX + 1e-6; m += 1) {
    var mm = Math.min(m, endX);
    _paintTick(
      ctx,
      xAt(mm),
      tickTop,
      tickBot,
      majorHalfW,
      YARD_PAINT_RGB,
      0.95,
    );
    /* Number (skip 0 to avoid clutter at the very front). */
    if (mm >= 1 - 1e-6) {
      var label = String(Math.round(mm));
      var lx = xAt(mm);
      var isDouble = label.length >= 2;
      /* Fit text inside each 1 m slot so adjacent double-digit labels cannot
         visually fuse into "21/31/41" style artifacts. */
      var fontPx = Math.round(
        Math.min(
          isDouble ? canvasH * 0.165 : canvasH * 0.195,
          isDouble ? metreSlotW * 0.42 : metreSlotW * 0.5,
        ),
      );
      fontPx = Math.max(16, fontPx);
      var trackingPx = isDouble ? Math.max(2, Math.round(canvasH * 0.014)) : 0;
      while (fontPx > 14) {
        ctx.font =
          "900 " + fontPx + "px 'Arial Narrow', Arial, sans-serif";
        var measuredW = ctx.measureText(label).width + trackingPx * (label.length - 1);
        if (measuredW <= metreSlotW * 0.76) break;
        fontPx -= 1;
      }
      var numPadX = isDouble ? canvasH * 0.11 : canvasH * 0.08;
      var numPadY = canvasH * 0.05;
      var textW = ctx.measureText(label).width + trackingPx * (label.length - 1);
      var boxW = Math.min(
        metreSlotW * 0.9,
        textW + numPadX * 2 + (isDouble ? canvasH * 0.04 : 0),
      );
      var boxH = canvasH * 0.19;
      ctx.fillStyle = "rgba(14,20,26,0.52)";
      _roundRectPath(
        ctx,
        lx - boxW / 2,
        numY - boxH / 2 - numPadY * 0.1,
        boxW,
        boxH,
        boxH * 0.36,
      );
      ctx.fill();
      ctx.lineWidth = canvasH * 0.045;
      ctx.strokeStyle = "rgba(10,14,20,0.96)";
      _strokeSpacedText(ctx, label, lx, numY, trackingPx);
      ctx.fillStyle = "rgba(255,255,255,0.99)";
      _drawSpacedText(ctx, label, lx, numY, trackingPx);
    }
  }

  /* Section boundaries — bolder, brighter "goal line" double bar. */
  boundaries.forEach(function (bM) {
    var bx = xAt(bM);
    var off = canvasH * 0.03;
    _paintTick(
      ctx,
      bx - off,
      topRailY,
      tickBot,
      sectionHalfW,
      YARD_PAINT_SECTION_RGB,
      0.98,
    );
    _paintTick(
      ctx,
      bx + off,
      topRailY,
      tickBot,
      sectionHalfW,
      YARD_PAINT_SECTION_RGB,
      0.98,
    );
  });

  var tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  /* Prominent but tidy ground lane. Tweak stripDepthM / pxPerM / canvasH to
     scale the whole marker system from one place. */
  var stripDepthM = 1.55;
  var mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.98,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  var plane = new THREE.Mesh(
    new THREE.PlaneGeometry(lengthM, stripDepthM),
    mat,
  );
  plane.name = "isoGroundYardMarkers";
  plane.rotation.x = -Math.PI / 2;
  /* Ground sits ~1 m below the deck (wheels of radius WHEEL_RADIUS_M). Lift the
     strip a hair above it to dodge z-fighting. */
  var groundY = -WHEEL_RADIUS_M * 2 - 0.02;
  plane.position.set(
    startX + lengthM / 2,
    groundY + 0.012,
    bed.width + 0.26 + stripDepthM / 2,
  );
  plane.receiveShadow = true;
  parent.add(plane);
}

// ── BED GROUP (deck + rails + wheels + grids + dividers + height guide) ─────

/** Build the trailer bed as a single THREE.Group ready to add to the scene.
 *  Scene.js handles old-bed disposal + scene attachment.
 *
 *  opts:
 *    trailerType:    active trailer-type object ({ sections: [{ lengthM }] }) or null
 *    trailerActive:  bool — driving a trailer (vs. a rigid truck)
 *    truckLayoutKey: normalised layout key for rigid truck (used when !trailerActive)
 *    addTractorHorse: function(parent) — optional callback to drop in the tractor horse
 */
export function buildBedGroup(THREE, bed, opts) {
  opts = opts || {};
  var g = new THREE.Group();

  /* When the active trailer type has multiple sections, render each section as
     its own deck+chassis+perimeter-rails with a visible gap between sections.
     This communicates a link/drawbar combo as two physically coupled decks. */
  var sections = opts.trailerType && opts.trailerType.sections;
  var multiSection =
    sections &&
    sections.filter(function (s) {
      return s && s.lengthM > 0;
    }).length >= 2;
  var SECTION_GAP_M = 0.32;
  var drawBounds = multiSection
    ? computeSectionDrawBounds(sections, bed.length, SECTION_GAP_M)
    : [{ x0: 0, x1: bed.length, index: 0 }];

  var deckMat = new THREE.MeshStandardMaterial({
    color: 0xbfc8ce,
    metalness: 0.05,
    roughness: 0.86,
    envMapIntensity: 0.18,
    side: THREE.DoubleSide,
  });
  var underMat = new THREE.MeshStandardMaterial({
    color: 0x15191c,
    metalness: 0.08,
    roughness: 0.96,
    envMapIntensity: 0.06,
  });
  var railMat = new THREE.MeshStandardMaterial({
    color: 0x90a4ae,
    metalness: 0.05,
    roughness: 0.75,
  });
  var frameMat = new THREE.MeshStandardMaterial({
    color: 0x2a3036,
    metalness: 0.22,
    roughness: 0.82,
    envMapIntensity: 0.12,
  });
  var markerAmberMat = new THREE.MeshStandardMaterial({
    color: 0xffb74d,
    metalness: 0.06,
    roughness: 0.42,
    emissive: 0xff9100,
    emissiveIntensity: 0.75,
  });
  var markerRedMat = new THREE.MeshStandardMaterial({
    color: 0xef5350,
    metalness: 0.05,
    roughness: 0.45,
    emissive: 0xc62828,
    emissiveIntensity: 0.65,
  });
  var reflectiveMat = new THREE.MeshStandardMaterial({
    color: 0xf5d742,
    metalness: 0.12,
    roughness: 0.35,
    emissive: 0xd4a012,
    emissiveIntensity: 0.35,
  });
  /* Taller perimeter rail (0.19 → 0.24) so the deck edge reads as an engineered
   * side beam rather than a thin floating lip — the biggest "weight" win from a
   * side-on view. */
  var rh = 0.24;
  function rail(parent, w, d, cx, cz) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, rh, d), railMat);
    m.position.set(cx, rh / 2, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
  }
  /* Dark satin side rub-rail — a structural under-deck beam material shared by
   * the rub-rails and rear support posts below. */
  var rubRailMat = new THREE.MeshStandardMaterial({
    color: 0x1f242a,
    metalness: 0.3,
    roughness: 0.8,
    envMapIntensity: 0.1,
  });

  drawBounds.forEach(function (seg, idx) {
    var segLen = Math.max(0.01, seg.x1 - seg.x0);
    var segCx = (seg.x0 + seg.x1) * 0.5;

    var deck = new THREE.Mesh(
      new THREE.PlaneGeometry(segLen, bed.width),
      deckMat,
    );
    /* Every section deck is a valid drop target — the iso raycaster (scene.js)
       picks up any mesh tagged with userData.planningDeck. The first section
       additionally keeps the legacy "planningDeck" name for any consumer that
       looks it up by name. */
    deck.userData.planningDeck = true;
    deck.name = idx === 0 ? "planningDeck" : "planningDeck_" + idx;
    deck.rotation.x = -Math.PI / 2;
    deck.position.set(segCx, 0, bed.width / 2);
    deck.receiveShadow = true;
    g.add(deck);

    var under = new THREE.Mesh(
      new THREE.BoxGeometry(segLen * 0.96, 0.28, bed.width * 0.9),
      underMat,
    );
    under.position.set(segCx, -0.17, bed.width / 2);
    under.receiveShadow = true;
    under.castShadow = true;
    g.add(under);

    /* Longitudinal frame rails — heavier industrial understructure. */
    var railY = -0.22;
    var railH = 0.12;
    var railW = 0.09;
    var railZOff = 0.22;
    var frameRailL = new THREE.Mesh(
      new THREE.BoxGeometry(segLen * 0.94, railH, railW),
      frameMat,
    );
    frameRailL.position.set(segCx, railY, railZOff);
    frameRailL.castShadow = true;
    frameRailL.receiveShadow = true;
    g.add(frameRailL);
    var frameRailR = frameRailL.clone();
    frameRailR.position.z = bed.width - railZOff;
    g.add(frameRailR);
    /* Cross beams every ~1.2 m for engineered weight read. */
    var beamStep = 1.2;
    for (var bx = seg.x0 + 0.35; bx < seg.x1 - 0.2; bx += beamStep) {
      var beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, railH * 0.85, bed.width * 0.78),
        frameMat,
      );
      beam.position.set(bx, railY - 0.02, bed.width / 2);
      beam.castShadow = true;
      g.add(beam);
    }

    /* Rear structure — emissive tail lights + reflective chevron strip. */
    if (opts.trailerActive) {
      var rearX = seg.x1 - 0.04;
      var tailY = 0.14;
      var tailL = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.12, 0.14),
        markerRedMat,
      );
      tailL.position.set(rearX, tailY, bed.width * 0.28);
      g.add(tailL);
      var tailR = tailL.clone();
      tailR.position.z = bed.width * 0.72;
      g.add(tailR);
      var tailBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.06, bed.width * 0.55),
        markerRedMat,
      );
      tailBar.position.set(rearX, tailY - 0.08, bed.width / 2);
      g.add(tailBar);
      var chevron = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.08, bed.width * 0.88),
        reflectiveMat,
      );
      chevron.position.set(rearX - 0.02, 0.04, bed.width / 2);
      g.add(chevron);
      /* Amber side marker at rear corner. */
      var sideMarker = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.05, 0.05),
        markerAmberMat,
      );
      sideMarker.position.set(rearX - 0.01, 0.22, bed.width + 0.02);
      g.add(sideMarker);
      var sideMarkerL = sideMarker.clone();
      sideMarkerL.position.z = -0.02;
      g.add(sideMarkerL);

      /* Rear support frame — two vertical posts dropping from the deck edge to
         the underbody, bridged by a cross beam. Gives the trailer tail real
         engineered depth instead of a thin floating edge. */
      var postH = 0.34;
      var postW = 0.07;
      var postY = -postH / 2;
      var postZ = bed.width * 0.18;
      var postL = new THREE.Mesh(
        new THREE.BoxGeometry(postW, postH, postW),
        rubRailMat,
      );
      postL.position.set(rearX - 0.06, postY, postZ);
      postL.castShadow = true;
      postL.receiveShadow = true;
      g.add(postL);
      var postR = postL.clone();
      postR.position.z = bed.width - postZ;
      g.add(postR);
      var rearBeam = new THREE.Mesh(
        new THREE.BoxGeometry(postW, postW, bed.width - postZ * 2),
        rubRailMat,
      );
      rearBeam.position.set(rearX - 0.06, -0.28, bed.width / 2);
      rearBeam.castShadow = true;
      g.add(rearBeam);
    }

    /* Perimeter rails per section. Side rails span the section length; the
       front/back rails sit at THIS section's own edges (so a 2-section trailer
       gets four end-caps and reads as two coupled decks). */
    rail(g, segLen + 0.06, 0.07, segCx, 0);
    rail(g, segLen + 0.06, 0.07, segCx, bed.width);
    rail(g, 0.07, bed.width + 0.06, seg.x0, bed.width / 2);
    rail(g, 0.07, bed.width + 0.06, seg.x1, bed.width / 2);

    /* Side rub-rail — a chunky dark beam running the section length just under
       the deck edge on both flanks. This is the dominant "I-beam chassis" read
       from a side-on (drive-off) view and gives the deck real visual mass. */
    var rubY = -0.05;
    var rubH = 0.14;
    var rubD = 0.06;
    var rubL = new THREE.Mesh(
      new THREE.BoxGeometry(segLen * 0.98, rubH, rubD),
      rubRailMat,
    );
    rubL.position.set(segCx, rubY, 0.02);
    rubL.castShadow = true;
    rubL.receiveShadow = true;
    g.add(rubL);
    var rubR = rubL.clone();
    rubR.position.z = bed.width - 0.02;
    g.add(rubR);

    /* Milltrans side branding band — sits below deck so cargo stays visible. */
    if (opts.trailerActive && opts.branding) {
      addTrailerBrandingDecals(THREE, g, seg, bed, getCachedBadgeTexture());
    }
  });

  /* Drawbar / coupling link — small visual prop that bridges each pair of
     adjacent sections so the gap reads as "two trailers physically coupled"
     rather than "two trailers floating apart". */
  if (multiSection) {
    var linkMat = new THREE.MeshStandardMaterial({
      color: 0x4b5258,
      metalness: 0.45,
      roughness: 0.55,
    });
    var hitchMat = new THREE.MeshStandardMaterial({
      color: 0x2b2f33,
      metalness: 0.55,
      roughness: 0.5,
    });
    for (var lb = 0; lb < drawBounds.length - 1; lb++) {
      var aSeg = drawBounds[lb];
      var bSeg = drawBounds[lb + 1];
      var linkX0 = aSeg.x1;
      var linkX1 = bSeg.x0;
      var linkLen = Math.max(0.01, linkX1 - linkX0);
      var linkCx = (linkX0 + linkX1) * 0.5;
      var linkY = -0.04; /* sit just below the deck plane */
      var zCenter = bed.width / 2;
      /* Two parallel side rails of the drawbar — flank the centre, evoking a
         twin-tow-bar coupling. */
      var sideZ = Math.min(0.4, bed.width * 0.22);
      var sideThk = 0.06;
      var sideTube1 = new THREE.Mesh(
        new THREE.BoxGeometry(linkLen + 0.1, sideThk, sideThk),
        linkMat,
      );
      sideTube1.position.set(linkCx, linkY, zCenter - sideZ);
      sideTube1.castShadow = true;
      sideTube1.receiveShadow = true;
      g.add(sideTube1);
      var sideTube2 = new THREE.Mesh(
        new THREE.BoxGeometry(linkLen + 0.1, sideThk, sideThk),
        linkMat,
      );
      sideTube2.position.set(linkCx, linkY, zCenter + sideZ);
      sideTube2.castShadow = true;
      sideTube2.receiveShadow = true;
      g.add(sideTube2);
      /* Centre hitch block — chunkier piece where the two sides converge. */
      var hitch = new THREE.Mesh(
        new THREE.BoxGeometry(linkLen + 0.04, 0.12, 0.18),
        hitchMat,
      );
      hitch.position.set(linkCx, linkY - 0.02, zCenter);
      hitch.castShadow = true;
      hitch.receiveShadow = true;
      g.add(hitch);
      /* Kingpin / pintle ring — small vertical pin centred on the hitch. */
      var pin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.16, 10),
        hitchMat,
      );
      pin.position.set(linkCx, linkY + 0.08, zCenter);
      pin.castShadow = true;
      pin.receiveShadow = true;
      g.add(pin);
    }
  }

  addIsoSectionGrids(THREE, g, bed, sections, multiSection ? SECTION_GAP_M : 0);

  var tyreMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    metalness: 0.02,
    roughness: 0.94,
    envMapIntensity: 0.06,
  });
  var hubMat = new THREE.MeshStandardMaterial({
    color: 0x3e454c,
    metalness: 0.52,
    roughness: 0.5,
    envMapIntensity: 0.4,
  });
  var groundContactY = -WHEEL_RADIUS_M * 2 - 0.02;
  if (opts.trailerActive) {
    var axleSections =
      sections && sections.length ? sections : [{ lengthM: bed.length }];
    placeAxleWheels(
      THREE,
      g,
      getTrailerAxlesForSections(axleSections),
      bed.width,
      tyreMat,
      null,
      hubMat,
      groundContactY,
    );
    if (opts.addTractorHorse) opts.addTractorHorse(g);
  } else if (opts.truckLayoutKey) {
    var tmpl =
      TRACTOR_AXLE_TEMPLATES[opts.truckLayoutKey] ||
      TRACTOR_AXLE_TEMPLATES["10-Wheels"];
    var rigidAxles = tmpl.map(function (a) {
      return { x: a.pos * bed.length, type: a.type };
    });
    placeAxleWheels(
      THREE,
      g,
      rigidAxles,
      bed.width,
      tyreMat,
      null,
      hubMat,
      groundContactY,
    );
  }

  addIsoHeightGuide(THREE, g, bed);
  addIsoGroundYardMarkers(THREE, g, bed, opts.trailerType, {
    startX:
      opts.groundMarkerStartX != null ? Number(opts.groundMarkerStartX) : 0,
    endX: opts.groundMarkerEndX != null ? Number(opts.groundMarkerEndX) : bed.length,
    cabLengthM:
      opts.groundMarkerCabLengthM != null
        ? Number(opts.groundMarkerCabLengthM)
        : 0,
  });

  return g;
}
