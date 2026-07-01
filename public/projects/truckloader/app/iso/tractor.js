// app/iso/tractor.js
// Procedural ISO tractor (horse) cab. Layered, low-poly, no external geometry.
// Public entry: addIsoTractorHorse(THREE, parent, layoutKey, opts).
// opts.bedWidth lets the caller centre the horse on the trailer's lateral axis.

import {
  HORSE_AXLE_TEMPLATES,
  deriveHorseAxleLayout,
  getHorseBodyLengthM,
  WHEEL_RADIUS_M,
  placeAxleWheels,
} from "./trailer.js";
import {
  MILLTRANS,
  addCabBrandingDecals,
  makeDecalPlane,
  getCachedBadgeTexture,
} from "./brand.js";

// ── CONSTANTS ────────────────────────────────────────────────────────────────

/** Default horse length (back-compat for any consumer that still imports the
 *  constant). The active per-rig length now comes from
 *  `getHorseBodyLengthForTruckLayout` so cab framing scales with axle count. */
export const HORSE_BODY_LENGTH_M = 5.4;

/** Resolve horse body length for the truck's TOTAL wheel layout key. Wraps
 *  the trailer-side derive + length lookup so scene.js can use a single call
 *  for camera framing without knowing about the horse axle map. */
export function getHorseBodyLengthForTruckLayout(truckLayoutKey) {
  return getHorseBodyLengthM(deriveHorseAxleLayout(truckLayoutKey));
}

/** Approximate visible cab body length in metres (nose-to-cab shell).
 *  Used by scene overlays (ground metrics lane) for presentation labels. */
export function getEstimatedTractorCabLengthM() {
  var st = isoTractorResolveStyle(ISO_TRACTOR_CAB_THEME.styleId);
  return Math.max(1.28, 2.02 * st.mainCabLMul - st.cabLenShift);
}

/**
 * Procedural ISO tractor cab theme — paint / trim / glass colours.
 * Only one cab silhouette is supported: a modern heavy-duty cab-over (Scania /
 * Volvo / MAN style). Multi-style support was removed to focus quality on a
 * single believable rig instead of spreading effort across stylized variants.
 */
const ISO_TRACTOR_CAB_THEME = {
  paintHex: MILLTRANS.paintHex,
  trimHex: 0x1c2529,
  glassHex: 0x0d1b2a,
  /** 0 = day cab (shorter rear), 1 = high-roof sleeper. Blended from axle layout. */
  sleeperStrength: 1,
  /** Retained for compatibility (scene.js reads it for camera nudges + truckSig). */
  styleId: "industrialCabover",
};

/** Public — scene.js reads styleId for camera nudges + truckSig. */
export function getTractorCabTheme() {
  return ISO_TRACTOR_CAB_THEME;
}

/**
 * Industrial cab-over style — single source of truth for the cab silhouette.
 *
 * Key choices (vs. the old multi-preset code):
 *   - `hoodLenMul: 0.22`     The "hood" collapses to a short bumper/grille stub
 *                            (~0.42 m) because real cab-over trucks have no hood.
 *                            The engine sits *under* the cab; the front face of
 *                            the truck IS the cab front face. Bumper / grille /
 *                            headlights still anchor to this short fascia.
 *   - `mainCabHMul: 1.28`    Tall, imposing main cab (~3.2 m above the floor).
 *                            Gives the rig the vertical presence of a real Euro
 *                            cab — no more toy-like squashed proportions.
 *   - `mainCabLMul: 1.18`    Slightly longer cab so the vertical front face has
 *                            room for a proper raked-upper-windshield section.
 *   - `cabLenShift: -0.34`   Shift the cab forward — the cab now sits over the
 *                            front axle (the defining cab-over geometry).
 *   - `wsForward`           Pushes windshield center +X into the raked glass.
 *   - `glassBeltMul`       Shoulder / glass beltline (matches cab shell when equal).
 *   - `glassTopMul`        Single top Y for windshield + side glass + frames.
 *   - `windshieldTiltAdd`  Extra rake on windshield (with base tilt in code).
 *   - `roofCapPeak` / `fairingScale`  Roof cap when sleeper is taller than cab.
 *   - `cabForwardLean`     Mostly vertical cab-over front face.
 */
var ISO_TRACTOR_STYLE = {
  /* ── Overall mass ─────────────────────────────────────────────── *
   * Modern Euro cab-over silhouette (Scania/Volvo/MAN). No hood — the
   * cab sits OVER the front axle and its front face IS the truck's
   * front. The "hood" collapses to a low bumper/grille fascia stub.
   * Cab ≈ 3.2 m tall, ≈ 2.4 m long. Sleeper auto-sizes from remaining
   * body length.                                                    */
  hoodLenMul: 0.22,
  bodyWidAdd: 0.04,
  /* Cab proportions tuned to a real Scania S: cab is ~2.5 m tall × ~2.4 m
   * long × ~2.5 m wide (close to a cube). 1.04 multiplier puts the cab at
   * ~2.4 m long, matching reference photos where the cab is slightly
   * taller than long. */
  /* Nudged 1.02 → 1.04: a touch more vertical mass gives the cab the imposing
   * Scania-S stance. Scales proportionally through the glass band, shoulder
   * seam and roof markers (all derive from mainCabH), and grows the painted
   * header above the windshield rather than shrinking it — so it stays clear
   * of the glassTopMul see-through-gap issue documented below. */
  mainCabHMul: 1.04,
  mainCabLMul: 1.04,
  cabLenShift: -0.34,
  /* ── Windshield + glass band ──────────────────────────────────── *
   * wsForward pushes the windshield slab deeper into +X (into the rake).
   * glassBeltMul matches cab-shell shoulder; glassTopMul is ONE top edge for WS + trims. */
  wsForward: 0.34,
  /* Nudged 0.2 → 0.22 for a slightly stronger windshield rake (more aero,
   * more Scania). Small enough not to disturb the resolved glass-band/door
   * rectangle alignment. */
  windshieldTiltAdd: 0.22,
  glassBeltMul: 0.535,
  /* Lowered from 0.912 → 0.88. With the old value the windshield top
   * (cabH * 0.912 = 2.31 m) sat INSIDE the cab shell's front-top rounded
   * corner (which starts at cabH - roundR ≈ 2.29 m). The 17 mm sliver of
   * paint above the glass read as a see-through gap from 3/4 / cab angles.
   * 0.88 leaves a proper ~18 cm painted header between window top and roof,
   * matching real Scania S-cab proportions. */
  glassTopMul: 0.88,
  glassWidthZFrac: 0.86,
  cheekTiltBlend: 0.48,
  /* ── Roof fairing / aero deflector ─────────────────────────────── *
   * Modern Euro cabs (Scania S-series, Volvo FH) have a flat roof —
   * cab and sleeper share one continuous roofline. The "cap" collapses
   * to a thin aero strip with only a hint of curvature at the very front. */
  fairingScale: 1.0,
  fairingRotX: -0.48,
  /* Nudged 0.06 → 0.08: a hair more aero-lip curvature on the highline roof
   * cap (only drawn when the sleeper sits taller than the cab). */
  roofCapPeak: 0.08,
  /* ── Sleeper (behind the cab) ─────────────────────────────────── *
   * sleeperLMul keeps the sleeper visually shorter than the cab so the
   * tractor reads as a tight Scania-style high-roof rig rather than a
   * stretched conventional. */
  /* Sleeper sits flush with the cab roof on a flat-roof Scania. The +4 %
   * bump in addIsoTractorHorse handles the gentle highline arc.
   * sleeperLMul dropped from 0.78 → 0.34 so the sleeper reads as a small
   * extension behind the cab (1/3 the cab length) rather than a second cab
   * box. On reference Scania S photos the sleeper is ~0.8–1.0 m long
   * vs. the cab's ~2.4 m. */
  sleeperHMul: 1.0,
  sleeperLMul: 0.34,
  /* ── Industrial fascia detail ─────────────────────────────────── */
  grilleSlats: 7,
  exhaustStacks: 2,
  tyreRadiusMul: 1.1,
  tyreWidthMul: 1.14,
  headlightInset: 0.04,
  hoodRoofYMul: 1.0,
  hoodNoseYMul: 1.0,
  bumperMassMul: 1.1,
  dualTyreGapMul: 0.98,
  stackHeightMul: 1.06,
  /* ── Material tweaks ──────────────────────────────────────────── */
  paintEnvMul: 0.94,
  roughnessShift: 0.04,
  chromeRoughAdd: 0.06,
  /* ── Silhouette / shape language ──────────────────────────────── */
  hoodNoseTaper: 0.96,
  shoulderLineYMul: 0.66,
  cabForwardLean: 0.05,
};

/**
 * Style lookup — there is now only one cab style, so this is a thin pass-through.
 * Kept as a function so `addIsoTractorHorse` doesn't need to change shape.
 */
function isoTractorResolveStyle(/* styleId */) {
  return ISO_TRACTOR_STYLE;
}

// ── MESH HELPERS ─────────────────────────────────────────────────────────────

/** Shared mesh helper — optional euler rotations in radians. */
function isoTractorAddMesh(
  grp,
  THREE,
  geom,
  mat,
  px,
  py,
  pz,
  rx,
  ry,
  rz,
  skipShadow,
) {
  var m = new THREE.Mesh(geom, mat);
  m.position.set(px, py, pz);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  if (rz) m.rotation.z = rz;
  if (!skipShadow) {
    m.castShadow = true;
    m.receiveShadow = true;
  } else {
    m.castShadow = false;
    m.receiveShadow = false;
  }
  grp.add(m);
  return m;
}

/** Sculpt extruded geometry by tapering its Z (depth) range as a function of X position. */
function isoTractorTaperExtrudeAlongX(geo, xMin, xMax, scaleFn) {
  var pos = geo.attributes.position;
  geo.computeBoundingBox();
  var bb = geo.boundingBox;
  var zCenter = (bb.min.z + bb.max.z) * 0.5;
  var span = Math.max(1e-6, xMax - xMin);
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i);
    var z = pos.getZ(i);
    var nx = (x - xMin) / span;
    if (nx < 0) nx = 0;
    else if (nx > 1) nx = 1;
    var s = scaleFn(nx);
    pos.setZ(i, zCenter + (z - zCenter) * s);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/** Round top edges of an extruded geometry in 3D by drawing Z (depth) inward toward the
 *  shape's centerline as Y approaches the top. Smoothstep falloff over `falloff` metres. */
function isoTractorRoundExtrudeTop(geo, topY, falloff, intensity) {
  var pos = geo.attributes.position;
  geo.computeBoundingBox();
  var bb = geo.boundingBox;
  var zCenter = (bb.min.z + bb.max.z) * 0.5;
  for (var i = 0; i < pos.count; i++) {
    var y = pos.getY(i);
    var d = topY - y;
    if (d < 0 || d > falloff) continue;
    var t = 1 - d / falloff;
    var ease = t * t * (3 - 2 * t);
    var s = 1 - intensity * ease;
    var z = pos.getZ(i);
    pos.setZ(i, zCenter + (z - zCenter) * s);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

// ── MATERIALS ────────────────────────────────────────────────────────────────

function isoTractorCreateMaterials(
  THREE,
  paintHex,
  trimHex,
  glassHex,
  matTweaks,
) {
  matTweaks = matTweaks || {};
  var rShift = matTweaks.roughnessShift != null ? matTweaks.roughnessShift : 0;
  var cr = matTweaks.chromeRoughAdd != null ? matTweaks.chromeRoughAdd : 0;
  var pEnv = matTweaks.paintEnvMul != null ? matTweaks.paintEnvMul : 1;

  var paint = THREE.MeshPhysicalMaterial
    ? new THREE.MeshPhysicalMaterial({
        color: paintHex,
        metalness: 0.08,
        roughness: Math.min(0.95, Math.max(0.06, 0.3 + rShift)),
        clearcoat: 1,
        /* Crisper clearcoat (0.12 → 0.09) — tighter environment highlights read
         * as freshly-detailed premium fleet paint without going mirror-like. */
        clearcoatRoughness: 0.09,
        envMapIntensity: 1.12 * pEnv,
      })
    : new THREE.MeshStandardMaterial({
        color: paintHex,
        metalness: 0.06,
        roughness: Math.min(0.9, 0.42 + rShift),
      });

  var trim = THREE.MeshPhysicalMaterial
    ? new THREE.MeshPhysicalMaterial({
        color: trimHex,
        metalness: 0.34,
        roughness: Math.min(0.95, Math.max(0.08, 0.48 + rShift)),
        clearcoat: 0.32,
        clearcoatRoughness: 0.36,
        envMapIntensity: 0.5,
      })
    : new THREE.MeshStandardMaterial({
        color: trimHex,
        metalness: 0.32,
        roughness: Math.min(0.92, 0.65 + rShift),
      });

  var satinTrim = THREE.MeshPhysicalMaterial
    ? new THREE.MeshPhysicalMaterial({
        color: trimHex,
        metalness: 0.22,
        roughness: Math.min(0.95, Math.max(0.15, 0.62 + rShift)),
        clearcoat: 0.15,
        clearcoatRoughness: 0.45,
        envMapIntensity: 0.42,
      })
    : new THREE.MeshStandardMaterial({
        color: trimHex,
        metalness: 0.22,
        roughness: Math.min(0.94, 0.72 + rShift),
      });

  var chassis = new THREE.MeshStandardMaterial({
    color: 0x323d44,
    metalness: 0.28,
    roughness: Math.min(0.97, 0.74 + rShift),
    envMapIntensity: 0.28,
  });
  var rubber = new THREE.MeshStandardMaterial({
    color: 0x0c0c0c,
    metalness: 0.02,
    roughness: Math.min(0.99, 0.97 + rShift),
    envMapIntensity: 0.08,
  });
  var rimSteel = new THREE.MeshStandardMaterial({
    color: 0x353c43,
    metalness: 0.58,
    roughness: Math.min(0.92, 0.44 + rShift * 0.5),
    envMapIntensity: 0.48,
  });
  var glass = new THREE.MeshPhysicalMaterial()
    ? new THREE.MeshPhysicalMaterial({
        color: glassHex,
        metalness: 0.52,
        roughness: Math.min(0.95, Math.max(0.04, 0.07 + rShift * 0.5)),
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        envMapIntensity: 1.28,
      })
    : new THREE.MeshStandardMaterial({
        color: glassHex,
        metalness: 0.35,
        roughness: 0.18,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      });

  var chrome = THREE.MeshPhysicalMaterial
    ? new THREE.MeshPhysicalMaterial({
        color: 0xf5f7fa,
        metalness: 0.9,
        roughness: Math.min(0.95, Math.max(0.04, 0.22 + cr + rShift * 0.3)),
        clearcoat: 0.85,
        clearcoatRoughness: 0.14,
        envMapIntensity: 1.28,
      })
    : new THREE.MeshStandardMaterial({
        color: 0xdfe4e8,
        metalness: 0.82,
        roughness: Math.min(0.92, 0.32 + cr),
      });

  var brushed = THREE.MeshPhysicalMaterial
    ? new THREE.MeshPhysicalMaterial({
        color: 0xc5cdd4,
        metalness: 0.55,
        roughness: Math.min(0.95, Math.max(0.25, 0.52 + rShift)),
        envMapIntensity: 0.75,
      })
    : new THREE.MeshStandardMaterial({
        color: 0xc5cdd4,
        metalness: 0.45,
        roughness: 0.58 + rShift,
      });

  var grille = new THREE.MeshStandardMaterial({
    color: 0x121a1e,
    metalness: 0.18,
    roughness: Math.min(0.96, 0.8 + rShift),
    envMapIntensity: 0.25,
  });

  var darkPlastic = new THREE.MeshStandardMaterial({
    color: 0x080c0f,
    metalness: 0.1,
    roughness: Math.min(0.98, 0.9 + rShift),
    envMapIntensity: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  var headlight = new THREE.MeshStandardMaterial({
    color: 0xf8fbff,
    metalness: 0.12,
    roughness: 0.22,
    emissive: 0xfff6e0,
    emissiveIntensity: 0.95,
  });

  /** Cool-white DRL — separate from warm main beam. */
  var drl = new THREE.MeshStandardMaterial({
    color: 0xe8f4ff,
    metalness: 0.08,
    roughness: 0.28,
    emissive: 0xcfe8ff,
    emissiveIntensity: 0.75,
  });

  var markerLight = new THREE.MeshStandardMaterial({
    color: 0xffb74d,
    metalness: 0.08,
    roughness: 0.45,
    emissive: 0xff9100,
    emissiveIntensity: 0.85,
  });
  var markerRed = new THREE.MeshStandardMaterial({
    color: 0xef5350,
    metalness: 0.06,
    roughness: 0.5,
    emissive: 0xc62828,
    emissiveIntensity: 0.55,
  });

  return {
    paint: paint,
    trim: trim,
    satinTrim: satinTrim,
    chassis: chassis,
    rubber: rubber,
    glass: glass,
    chrome: chrome,
    brushed: brushed,
    grille: grille,
    headlight: headlight,
    drl: drl,
    darkPlastic: darkPlastic,
    markerLight: markerLight,
    markerRed: markerRed,
    rimSteel: rimSteel,
  };
}

// ── GEOMETRY BUILDERS (hood / roof cap / cab / sleeper shells) ───────────────

/**
 * Front fascia — handles both conventional long-nose hoods AND short
 * cab-over bumper stubs through one parametric shape.
 *
 * Hood height scales with hoodLen so that short hoods (cab-over, HL ≤ ~0.6 m)
 * render as a low bumper/grille fascia rather than a tall mid-air block.
 * Long hoods (conventional, HL ≥ ~1.2 m) retain the original ~1.05 m height.
 *
 * Side profile (X = length, Y = height above floor):
 *
 *   hoodH ┐               ___________________
 *         │              /                  │  ← cowl, slightly raised
 *         │  nose       /                   │
 *         │  chamfer __/                    │
 *      0  └─────────────────────────────────┘
 *         0                                 HL
 */
function isoTractorCreateHoodExtrudeGeometry(THREE, hoodLen, bodyWid, st) {
  st = st || {};
  var noseTaper = st.hoodNoseTaper != null ? st.hoodNoseTaper : 0.96;
  var HL = hoodLen;
  /* hoodH scales: stub (HL=0.42) → ~0.55 m bumper; full hood (HL≥1.2) → 1.05 m. */
  var hoodH = HL < 0.7 ? Math.max(0.35, HL * 1.35) : 1.05;
  var noseChamfer = Math.min(0.18, HL * 0.1);
  var noseFrontH = hoodH * 0.78;

  var shape = new THREE.Shape();
  shape.moveTo(0, 0); /* front bottom */
  shape.lineTo(HL, 0); /* along floor to rear */
  shape.lineTo(HL, hoodH + 0.04); /* up rear face (slight cowl lift) */
  shape.lineTo(noseChamfer + 0.02, hoodH); /* flat top sloping gently to nose */
  shape.quadraticCurveTo(
    0.04,
    hoodH,
    0,
    noseFrontH,
  ); /* round the front-top into nose */
  shape.lineTo(0, 0); /* nose front down to floor */
  shape.closePath();

  var d = bodyWid * 0.78;
  var geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: false,
    steps: 2,
    curveSegments: 8,
  });
  geo.translate(0, 0, -d * 0.5);

  /* Taper depth-wise toward the nose so the hood narrows slightly at the front. */
  isoTractorTaperExtrudeAlongX(geo, 0, HL, function (nx) {
    if (nx > 0.3) return 1.0;
    var t = (0.3 - nx) / 0.3;
    var ease = t * t * (3 - 2 * t);
    return 1.0 - (1.0 - noseTaper) * ease;
  });
  /* Soften the top edges in depth so the hood reads as sculpted, not slab-sided. */
  isoTractorRoundExtrudeTop(geo, hoodH + 0.04, 0.3, 0.06);
  return geo;
}

/** Continuous aero roof cap spanning windshield → cab top → sleeper top. */
function isoTractorCreateRoofCapGeometry(
  THREE,
  capLen,
  sleeperStartLocal,
  sleeperTop,
  bodyWid,
  st,
) {
  st = st || {};
  var fairScale = st.fairingScale != null ? st.fairingScale : 1;
  var peakBase = (st.roofCapPeak != null ? st.roofCapPeak : 0.18) * fairScale;
  /* Modest peak floor — keeps the spoiler subtle for the small +4 cm
   * sleeperTopRel introduced in addIsoTractorHorse. The old floor of +0.18
   * produced a dome-shaped canopy on a flat-roof Scania, which read as
   * cartoonish. +0.04 lets the cap arc gently from cab roof to sleeper. */
  var peak = Math.max(peakBase, sleeperTop + 0.04);
  var thickness = 0.08;

  var L = capLen;
  var sL = Math.min(L * 0.88, Math.max(0.3, sleeperStartLocal));

  var shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(
    0.14,
    peak * 0.42,
    sL * 0.34,
    peak * 0.96,
    sL * 0.55,
    peak,
  );
  shape.bezierCurveTo(
    sL * 0.78,
    peak * 0.94,
    sL - 0.1,
    (peak + sleeperTop) * 0.55,
    sL,
    sleeperTop + (peak - sleeperTop) * 0.28,
  );
  shape.bezierCurveTo(
    sL + 0.18,
    sleeperTop + 0.04,
    sL + 0.45,
    sleeperTop + 0.005,
    sL + 0.65,
    sleeperTop,
  );
  shape.bezierCurveTo(
    L - 0.58,
    sleeperTop - 0.005,
    L - 0.18,
    sleeperTop - 0.04,
    L,
    sleeperTop - 0.08,
  );
  var bottomY = Math.min(0, sleeperTop) - thickness;
  shape.lineTo(L, bottomY);
  shape.lineTo(0, bottomY);
  shape.closePath();

  var d = bodyWid * 0.96;
  var geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: false,
    steps: 2,
    curveSegments: 14,
  });
  geo.translate(0, 0, -d * 0.5);

  isoTractorTaperExtrudeAlongX(geo, 0, L, function (nx) {
    if (nx < 0.06) return 0.94 + (nx / 0.06) * 0.05;
    if (nx > 0.94) return 0.95 + ((1 - nx) / 0.06) * 0.04;
    return 0.99;
  });
  return geo;
}

/**
 * Modern Euro cab-over cab body — extruded XY side profile.
 *
 * Defining features:
 *   - Lower portion of the front face is essentially VERTICAL (the cab sits
 *     OVER the front axle — there is no hood in front of it).
 *   - Upper portion rakes back significantly to form a steep windshield
 *     section. The bend point (shoulderY) sits around dash height.
 *   - Roof arches gently from the front-top corner back to the rear-top
 *     corner.
 *
 * Side profile (front = -X, rear = +X, floor = Y=0):
 *
 *                      roof arch
 *               ──────────────────────
 *              /                     │
 *    raked    /                      │
 *    upper   /                       │  ← rear-top corner rounded
 *    WS     /                        │
 *          |                         │
 *          |   shoulder / dash line  │
 *          |                         │
 *          |   vertical lower face   │
 *          |                         │
 *          └─────────────────────────┘
 *         front-bottom (chamfered)
 *         0                       cabL
 */
function isoTractorCreateCabShellGeometry(THREE, cabL, cabH, bodyWid, st) {
  st = st || {};

  /* Front-top corner kept SHARPER (cap 0.12 m, was 0.25 m). On a Scania
   * S-cab the front roof edge is a fairly crisp line, not a blob — the
   * old 0.24 m radius pushed the cab's front-face top below the window
   * top, leaving the window glass poking into the curved corner area. */
  var roundR = Math.min(0.12, cabH * 0.05, cabL * 0.2);
  var rearTopR = Math.min(0.32, cabH * 0.14);
  var bottomChamfer = Math.min(0.09, cabL * 0.055);

  var shoulderRatio =
    st.cabShoulderRatio != null
      ? st.cabShoulderRatio
      : st.glassBeltMul != null
        ? st.glassBeltMul
        : 0.535;
  var lowerLean = cabL * 0.018; // slight forward lean at bottom
  var upperRake = cabL * 0.205; // stronger windshield rake
  var shoulderY = cabH * shoulderRatio;

  var hx = cabL * 0.5;
  var frontBottomX = -hx;
  var frontShoulder = frontBottomX + lowerLean;
  var frontTopX = frontShoulder + upperRake;

  var shape = new THREE.Shape();

  // Bottom floor
  shape.moveTo(frontBottomX + bottomChamfer, 0);
  shape.lineTo(hx, 0);

  // Rear wall with rounded top corner
  shape.lineTo(hx, cabH - rearTopR);
  shape.quadraticCurveTo(hx, cabH, hx - rearTopR, cabH);

  // Roof curve - more natural and slightly domed
  shape.bezierCurveTo(
    hx * 0.42,
    cabH + 0.06,
    frontTopX * 0.38,
    cabH + 0.09,
    frontTopX + roundR * 0.7,
    cabH - 0.02,
  );
  shape.quadraticCurveTo(frontTopX, cabH, frontTopX, cabH - roundR);

  // Strong shoulder line with a subtle step (very characteristic of modern cabs)
  shape.lineTo(frontShoulder + 0.06, shoulderY + 0.03); // slight outward step
  shape.lineTo(frontShoulder, shoulderY);

  // Lower front face - almost vertical (true cab-over behavior)
  shape.quadraticCurveTo(
    frontBottomX + lowerLean * 0.6,
    shoulderY - 0.08,
    frontBottomX + bottomChamfer * 0.6,
    bottomChamfer * 0.8,
  );
  shape.lineTo(frontBottomX + bottomChamfer, 0);

  shape.closePath();

  var d = bodyWid * 0.96;
  var geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: false,
    steps: 2,
    curveSegments: 24 /* smoother roof arch in 3/4 view */,
  });
  geo.translate(0, 0, -d * 0.5);

  /* Scania/Volvo cabs are visibly wider at the door beltline than at the
   * roof. Pull the top edge inward more aggressively (≈ 8 cm on a 2.5 m cab)
   * across a wider falloff so the waist is visible from the iso camera. */
  isoTractorRoundExtrudeTop(geo, cabH, 0.62, 0.092);

  /* Lengthwise (X) taper — keep the door region at full width and tuck the
   * extreme front/rear corners ever so slightly. */
  isoTractorTaperExtrudeAlongX(geo, -hx * 0.6, hx * 0.6, function (nx) {
    return 0.96 + Math.sin(nx * Math.PI) * 0.045;
  });

  return geo;
}

/** Modern Euro sleeper body: flat rear wall, flat top, small front-top chamfer
 *  to blend visually into the cab roof. No bezier dome — Scania/Volvo sleepers
 *  read as a clean rectangular block from the side and rear. */
function isoTractorCreateSleeperShellGeometry(
  THREE,
  sleeperL,
  sleeperH,
  bodyWid,
  st,
) {
  st = st || {};

  var frontR = Math.min(0.14, sleeperH * 0.065, sleeperL * 0.08);
  var rearR = Math.min(0.18, sleeperH * 0.09);
  var hx = sleeperL * 0.5;

  var shape = new THREE.Shape();

  shape.moveTo(-hx, 0); // front bottom

  // Bottom floor
  shape.lineTo(hx, 0);

  // Rear wall with proper rounded top corner
  shape.lineTo(hx, sleeperH - rearR);
  shape.quadraticCurveTo(hx, sleeperH, hx - rearR, sleeperH);

  // Roof - very slight downward slope toward front (typical on high-roof sleepers)
  shape.lineTo(-hx + frontR * 1.1, sleeperH - 0.04);

  // Front top rounded corner
  shape.quadraticCurveTo(-hx, sleeperH, -hx, sleeperH - frontR);

  // Front wall - slight backward lean
  shape.lineTo(-hx - 0.04, 0.08);
  shape.lineTo(-hx, 0);

  shape.closePath();

  var d = bodyWid * 0.935;
  var geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: false,
    steps: 2,
    curveSegments: 12,
  });
  geo.translate(0, 0, -d * 0.5);

  // Light top rounding
  isoTractorRoundExtrudeTop(geo, sleeperH, 0.25, 0.04);

  // Very subtle side taper
  isoTractorTaperExtrudeAlongX(geo, -hx * 0.7, hx * 0.7, function (nx) {
    return 0.97 + Math.pow(Math.abs(nx - 0.5) * 2, 2) * 0.035;
  });

  return geo;
}
// ── FASCIA / TRIM ────────────────────────────────────────────────────────────

function isoTractorCreateBodyShoulderStrip(
  grp,
  THREE,
  accentMat,
  x0,
  x1,
  y,
  bodyWid,
) {
  if (!(x1 > x0 + 0.1)) return;
  var len = x1 - x0;
  var cx = (x0 + x1) * 0.5;
  var g = new THREE.BoxGeometry(len, 0.028, 0.05);
  isoTractorAddMesh(grp, THREE, g, accentMat, cx, y, 0.05, 0, 0, 0, false);
  isoTractorAddMesh(
    grp,
    THREE,
    g.clone(),
    accentMat,
    cx,
    y,
    bodyWid - 0.05,
    0,
    0,
    0,
    false,
  );
}

function isoTractorCreateSeamStrip(
  grp,
  THREE,
  darkPlasticMat,
  x0,
  x1,
  y0,
  y1,
  zPlane,
  thickness,
) {
  var dx = Math.max(0.04, x1 - x0);
  var dy = Math.max(0.04, y1 - y0);
  var g = new THREE.BoxGeometry(dx, dy, thickness);
  isoTractorAddMesh(
    grp,
    THREE,
    g,
    darkPlasticMat,
    (x0 + x1) * 0.5,
    (y0 + y1) * 0.5,
    zPlane,
    0,
    0,
    0,
    false,
  );
}

/**
 * Scania/Volvo-style front grille on the cab front face. Tall, wide black
 * panel with horizontal chrome slats and a chrome badge/emblem bar across
 * the top. Sits below the windshield, above the bumper.
 *
 *   y0+frameH ┐ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  ← chrome emblem bar
 *             │ ──────────────────  ← chrome slats (×slats)
 *             │ ──────────────────
 *             │ ──────────────────
 *             │ ──────────────────
 *          y0 └ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
 */
function isoTractorCreateGrilleSection(
  grp,
  THREE,
  grilleMat,
  chromeMat,
  darkPlasticMat,
  noseX,
  y0,
  bodyWid,
  slats,
) {
  slats = slats || 7;

  /* Narrower grille — the V-shape headlights now sit on either side of it
   * (previously they overlapped because the grille was 62 % of bodyWid).
   * 42 % leaves room for headlights to flank without crowding. */
  var grilleW = bodyWid * 0.42;
  var grilleH = 0.72;
  var depth = 0.095;

  // 1. Recessed dark backing panel
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(depth, grilleH, grilleW),
    darkPlasticMat,
    noseX + 0.02,
    y0 + grilleH * 0.5,
    bodyWid / 2,
    0,
    0,
    0,
    false,
  );

  // 2. Chrome outer frame (slightly larger than the grille)
  var frameThick = 0.048;
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(
      depth * 0.7,
      grilleH + frameThick * 2,
      grilleW + frameThick * 2,
    ),
    chromeMat,
    noseX + 0.005,
    y0 + grilleH * 0.5,
    bodyWid / 2,
    0,
    0,
    0,
    false,
  );

  // 3. Horizontal grille slats
  var slatH = 0.042;
  var totalSlatArea = grilleH - 0.18; // leave space for emblem bar at top
  var gap = (totalSlatArea - slatH * slats) / (slats + 1);

  for (var i = 0; i < slats; i++) {
    var y = y0 + 0.14 + gap + i * (slatH + gap) + slatH * 0.5;
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(depth * 0.75, slatH, grilleW * 0.9),
      grilleMat,
      noseX + 0.01,
      y,
      bodyWid / 2,
      0,
      0,
      0,
      false,
    );
  }

  // 4. Top chrome emblem / badge bar (Scania/Volvo style)
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(depth * 0.65, 0.105, grilleW * 0.94),
    chromeMat,
    noseX + 0.015,
    y0 + grilleH - 0.085,
    bodyWid / 2,
    0,
    0,
    0,
    false,
  );

  // 5. Optional subtle vertical dividers for extra realism
  var vertCount = 3;
  var vertW = 0.032;
  var step = grilleW / (vertCount + 1);
  for (var v = 1; v <= vertCount; v++) {
    var z = bodyWid / 2 - grilleW / 2 + v * step;
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(depth * 0.8, grilleH * 0.88, vertW),
      chromeMat,
      noseX + 0.012,
      y0 + grilleH * 0.5,
      z,
      0,
      0,
      0,
      false,
    );
  }
}

function isoTractorCreateHoodSeams(
  grp,
  THREE,
  seamMat,
  noseTipX,
  hoodLen,
  cabFloorY,
  bodyWid,
) {
  /* For cab-over bumper stubs the hood collapses too short for a cowl seam to
     make sense — only the lower fascia trim is drawn. Match seam Y to the
     actual hood height computed in isoTractorCreateHoodExtrudeGeometry. */
  var hoodH = hoodLen < 0.7 ? Math.max(0.35, hoodLen * 1.35) : 1.05;
  var y1 = cabFloorY + hoodH * 0.52;
  var z0 = 0.04;
  var z1 = bodyWid - 0.04;
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(hoodLen * 0.85, 0.018, 0.04),
    seamMat,
    noseTipX + hoodLen * 0.42,
    y1,
    z0,
    0,
    0,
    0.04,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(hoodLen * 0.85, 0.018, 0.04),
    seamMat,
    noseTipX + hoodLen * 0.42,
    y1,
    z1,
    0,
    0,
    -0.04,
    false,
  );
  if (hoodLen >= 0.7) {
    var y2 = cabFloorY + hoodH + 0.01;
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(hoodLen * 0.88, 0.018, bodyWid * 0.72),
      seamMat,
      noseTipX + hoodLen * 0.5,
      y2,
      bodyWid / 2,
      0,
      0,
      0,
      false,
    );
  }
}

function isoTractorCreateFrontBumperStack(
  grp,
  THREE,
  rubberMat,
  satinMat,
  chromeMat,
  noseTipX,
  cabFloorY,
  bodyWid,
  massMul,
) {
  var m = massMul != null ? massMul : 1;
  var wRub = bodyWid * (1.04 + (m - 1) * 0.12);
  var wSat = bodyWid * (1.02 + (m - 1) * 0.1);
  var xPush = (m - 1) * 0.06;
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.62 * m, 0.12, wRub),
    rubberMat,
    noseTipX + 0.34 + xPush,
    cabFloorY + 0.06,
    bodyWid / 2,
    0,
    0,
    0,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.58 * m, 0.12, wSat),
    satinMat,
    noseTipX + 0.36 + xPush,
    cabFloorY + 0.18,
    bodyWid / 2,
    0,
    0,
    0,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.62 * m, 0.06, bodyWid * (1.06 + (m - 1) * 0.08)),
    chromeMat,
    noseTipX + 0.34 + xPush,
    cabFloorY + 0.25,
    bodyWid / 2,
    0,
    0,
    0,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.4 * m, 0.08, wSat),
    rubberMat,
    noseTipX + 0.48 + xPush,
    cabFloorY + 0.03,
    bodyWid / 2,
    0.35 + (m - 1) * 0.08,
    0,
    0,
    false,
  );
}

function isoTractorCreateSideIntakes(
  grp,
  THREE,
  satinMat,
  cx,
  cy,
  zSide,
  rotY,
) {
  var main = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.5, 0.14), satinMat);
  main.position.set(cx, cy, zSide);
  main.rotation.y = rotY;
  main.castShadow = true;
  main.receiveShadow = true;
  grp.add(main);
  var wing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.2), satinMat);
  wing.position.set(
    cx + 0.1 * (rotY < 0 ? -1 : 1),
    cy - 0.08,
    zSide + 0.08 * (rotY < 0 ? -1 : 1),
  );
  wing.rotation.y = rotY + 0.25 * (rotY < 0 ? 1 : -1);
  wing.castShadow = true;
  wing.receiveShadow = true;
  grp.add(wing);
}

function isoTractorCreatePanelInset(
  grp,
  THREE,
  trimMat,
  x0,
  x1,
  y0,
  y1,
  zPlane,
  thickness,
) {
  var dx = Math.max(0.04, x1 - x0);
  var dy = Math.max(0.04, y1 - y0);
  var g = new THREE.BoxGeometry(dx, dy, thickness);
  isoTractorAddMesh(
    grp,
    THREE,
    g,
    trimMat,
    (x0 + x1) * 0.5,
    (y0 + y1) * 0.5,
    zPlane,
    0,
    0,
    0,
    false,
  );
}

function isoTractorCreateWheelArchSet(
  grp,
  THREE,
  axleX,
  bodyWid,
  trimMat,
  rubberMat,
  plasticMat,
  isLeft,
  tyreOpts,
) {
  var rm = tyreOpts && tyreOpts.radiusMul ? tyreOpts.radiusMul : 1;
  var Reff = WHEEL_RADIUS_M * rm + 0.1;
  var zOut = isLeft ? 0.26 : bodyWid - 0.26;
  var arc = new THREE.Mesh(
    new THREE.CylinderGeometry(
      Reff,
      Reff,
      0.54,
      16,
      1,
      false,
      Math.PI * 0.08,
      Math.PI * 0.92,
    ),
    trimMat,
  );
  arc.rotation.z = Math.PI / 2;
  arc.rotation.y = isLeft ? -0.12 : 0.12;
  arc.position.set(axleX - 0.04, -WHEEL_RADIUS_M * rm * 0.22, zOut);
  arc.castShadow = true;
  arc.receiveShadow = true;
  grp.add(arc);
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.84, 0.12, 0.44),
    rubberMat,
    axleX - 0.02,
    0.05,
    zOut + (isLeft ? 0.12 : -0.12),
    0.38,
    0,
    isLeft ? -0.18 : 0.18,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.14, 0.26, 0.12),
    plasticMat,
    axleX,
    -WHEEL_RADIUS_M * rm * 0.12,
    zOut,
    -0.15,
    0,
    isLeft ? 0.08 : -0.08,
    false,
  );
}

function isoTractorCreateFuelTanks(
  grp,
  THREE,
  brushedMat,
  chromeMat,
  darkMat,
  x0,
  x1,
  bodyWid,
  cabFloorY,
  tyreOpts,
) {
  if (!(x1 > x0 + 0.3)) return;
  var rm = tyreOpts && tyreOpts.radiusMul ? tyreOpts.radiusMul : 1;
  var cx = (x0 + x1) * 0.5;
  var tankR = 0.22;
  var tankLen = Math.min(1.85, x1 - x0 - 0.15);
  var y = cabFloorY - WHEEL_RADIUS_M * rm - 0.02 + tankR;
  var zL = 0.34;
  var zR = bodyWid - 0.34;
  var tg = new THREE.CylinderGeometry(tankR, tankR, tankLen, 14);
  isoTractorAddMesh(
    grp,
    THREE,
    tg,
    brushedMat,
    cx,
    y,
    zL,
    0,
    0,
    Math.PI / 2,
    false,
  );
  var t2 = tg.clone();
  var m2 = new THREE.Mesh(t2, brushedMat);
  m2.position.set(cx, y, zR);
  m2.rotation.z = Math.PI / 2;
  m2.castShadow = true;
  m2.receiveShadow = true;
  grp.add(m2);
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.CylinderGeometry(0.055, 0.055, 0.04, 10),
    darkMat,
    cx - tankLen * 0.35,
    y + tankR * 0.2,
    zL,
    0,
    0,
    Math.PI / 2,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.CylinderGeometry(0.04, 0.04, 0.02, 10),
    chromeMat,
    cx - tankLen * 0.35,
    y + tankR * 0.2 + 0.03,
    zL,
    0,
    0,
    Math.PI / 2,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.CylinderGeometry(0.055, 0.055, 0.04, 10),
    darkMat,
    cx - tankLen * 0.35,
    y + tankR * 0.2,
    zR,
    0,
    0,
    Math.PI / 2,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.CylinderGeometry(0.04, 0.04, 0.02, 10),
    chromeMat,
    cx - tankLen * 0.35,
    y + tankR * 0.2 + 0.03,
    zR,
    0,
    0,
    Math.PI / 2,
    false,
  );
}

function isoTractorCreateSideSkirts(
  grp,
  THREE,
  trimMat,
  darkPlasticMat,
  xMin,
  xMax,
  bodyWid,
  skirtTopY,
  tyreOpts,
) {
  if (!(xMax > xMin + 0.2)) return;
  var rm = tyreOpts && tyreOpts.radiusMul ? tyreOpts.radiusMul : 1;
  var rEff = WHEEL_RADIUS_M * rm;
  var cx = (xMin + xMax) * 0.5;
  var h = Math.max(0.28, skirtTopY - (-rEff - 0.02));
  var y = -rEff - 0.02 + h * 0.5;
  var th = 0.06;
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(xMax - xMin, h, th),
    trimMat,
    cx,
    y,
    0.14 + th / 2,
    0,
    0,
    0,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(xMax - xMin, h, th),
    trimMat,
    cx,
    y,
    bodyWid - 0.14 - th / 2,
    0,
    0,
    0,
    false,
  );
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    darkPlasticMat,
    xMin + 0.05,
    xMax - 0.05,
    y + h * 0.5 - 0.015,
    y + h * 0.5 + 0.005,
    0.11,
    0.02,
  );
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    darkPlasticMat,
    xMin + 0.05,
    xMax - 0.05,
    y + h * 0.5 - 0.015,
    y + h * 0.5 + 0.005,
    bodyWid - 0.11,
    0.02,
  );
}

function isoTractorCreateExhaustStacks(
  grp,
  THREE,
  trimMat,
  chromeMat,
  stackBaseX,
  y0,
  bodyWid,
  stackTopY,
  stackCount,
  stackHeightMul,
) {
  var n = stackCount != null ? stackCount : 2;
  if (n < 1) return;
  var vm = stackHeightMul != null ? stackHeightMul : 1;
  var h = Math.max(0.85, stackTopY - y0) * vm;
  var g = new THREE.CylinderGeometry(0.07, 0.09, h, 10);
  if (n >= 1) {
    isoTractorAddMesh(
      grp,
      THREE,
      g,
      trimMat,
      stackBaseX,
      y0 + h * 0.5,
      0.42,
      0,
      0,
      0,
      false,
    );
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10),
      chromeMat,
      stackBaseX,
      y0 + h + 0.03,
      0.42,
      0,
      0,
      0,
      false,
    );
  }
  if (n >= 2) {
    isoTractorAddMesh(
      grp,
      THREE,
      g.clone(),
      trimMat,
      stackBaseX,
      y0 + h * 0.5,
      bodyWid - 0.42,
      0,
      0,
      0,
      false,
    );
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10),
      chromeMat,
      stackBaseX,
      y0 + h + 0.03,
      bodyWid - 0.42,
      0,
      0,
      0,
      false,
    );
  }
}

function isoTractorAddCabMicroDetails(grp, THREE, mats, ctx) {
  var bodyWid = ctx.bodyWid;
  var cabFloorY = ctx.cabFloorY;
  var mainCabH = ctx.mainCabH;
  var wsX = ctx.wsX;
  var tilt = ctx.windshieldTilt;
  var cabBaseCenterX = ctx.cabBaseCenterX;
  var mainCabL = ctx.mainCabL;
  var noseTipX = ctx.noseTipX;
  var xRearAxle = ctx.xRearAxle;

  var cz = bodyWid * 0.5;
  /* (Removed: vertical 1.3 m wiper/centre-divider bar and two windshield trim
     strips. They read as a black bar across the glass on a clean cab-over
     and were tilted on the old rx axis which compounded the visual error.) */
  var doorX = cabBaseCenterX + mainCabL * 0.08;
  var doorY = cabFloorY + mainCabH * 0.42;
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.05, 0.04, 0.12),
    mats.chrome,
    doorX,
    doorY,
    0.08,
    0,
    0,
    0,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.05, 0.04, 0.12),
    mats.chrome,
    doorX,
    doorY,
    bodyWid - 0.08,
    0,
    0,
    0,
    false,
  );
  var sx = cabBaseCenterX + mainCabL * 0.12;
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.24, 0.06, 0.38),
    mats.satinTrim,
    sx,
    cabFloorY + 0.08,
    0.1,
    0,
    0,
    0.15,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.24, 0.06, 0.38),
    mats.satinTrim,
    sx,
    cabFloorY + 0.02,
    0.12,
    0,
    0,
    0.12,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.24, 0.06, 0.38),
    mats.satinTrim,
    sx,
    cabFloorY + 0.08,
    bodyWid - 0.1,
    0,
    0,
    -0.15,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.24, 0.06, 0.38),
    mats.satinTrim,
    sx,
    cabFloorY + 0.02,
    bodyWid - 0.12,
    0,
    0,
    -0.12,
    false,
  );
  var ladX = cabBaseCenterX - mainCabL * 0.42;
  var ladY0 = cabFloorY + 0.12;
  for (var lr = 0; lr < 5; lr++) {
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(0.04, 0.03, 0.28),
      mats.satinTrim,
      ladX,
      ladY0 + lr * 0.34,
      0.06,
      0,
      0,
      0,
      false,
    );
  }
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.02, 0.14, 0.06),
    mats.markerLight,
    cabBaseCenterX + mainCabL * 0.35,
    cabFloorY + mainCabH * 0.22,
    0.04,
    0,
    0,
    0,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.02, 0.14, 0.06),
    mats.markerLight,
    cabBaseCenterX + mainCabL * 0.35,
    cabFloorY + mainCabH * 0.22,
    bodyWid - 0.04,
    0,
    0,
    0,
    false,
  );
  if (xRearAxle != null) {
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(0.04, 0.36, 0.56),
      mats.rubber,
      xRearAxle - 0.12,
      0.02,
      0.14,
      0,
      0,
      0.06,
      false,
    );
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(0.04, 0.36, 0.56),
      mats.rubber,
      xRearAxle - 0.12,
      0.02,
      bodyWid - 0.14,
      0,
      0,
      -0.06,
      false,
    );
  }
  /* (Removed: two orange marker-light boxes + two chrome cylinder pieces that
     were positioned at fairY/fairCx — coordinates derived from the old roof
     cap mesh. With the cap no longer rendered (sleeperH == mainCabH), those
     meshes floated 0.16–0.36 m above the cab roof in mid-air.
     Also removed: the two red markerRed boxes ahead of the cab face — with
     the new rectangular LED headlights they were redundant and the only
     other meshes between the bumper and cab front face.) */
  if (ctx.sleeperCenterX != null && ctx.sleeperH > 0.3 && ctx.sleeperL > 0.4) {
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(ctx.sleeperL * 0.75, 0.014, 0.04),
      mats.grille,
      ctx.sleeperCenterX - 0.06,
      cabFloorY + ctx.sleeperH * 0.55,
      0.06,
      0,
      0,
      0,
      false,
    );
  }
}

/** Lightweight chassis detail — mud flaps, air/battery boxes, side step rails. */
function isoTractorAddIndustrialDetails(grp, THREE, mats, ctx) {
  var bodyWid = ctx.bodyWid;
  var cabFloorY = ctx.cabFloorY;
  var xRearAxle = ctx.xRearAxle;
  var xFirstAxle = ctx.xFirstAxle;
  var xOffset = ctx.xOffset;
  var bodyLen = ctx.bodyLen;

  if (xRearAxle != null) {
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(0.05, 0.42, 0.62),
      mats.rubber,
      xRearAxle - 0.14,
      0.04,
      0.12,
      0,
      0,
      0.05,
      false,
    );
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(0.05, 0.42, 0.62),
      mats.rubber,
      xRearAxle - 0.14,
      0.04,
      bodyWid - 0.12,
      0,
      0,
      -0.05,
      false,
    );
  }

  if (xFirstAxle != null && xRearAxle != null) {
    var midX = (xFirstAxle + xRearAxle) * 0.5;
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(0.38, 0.28, 0.22),
      mats.chassis,
      midX - 0.4,
      cabFloorY - 0.38,
      0.18,
      0,
      0,
      0,
      false,
    );
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(0.22, 0.18, 0.16),
      mats.darkPlastic,
      midX - 0.15,
      cabFloorY - 0.32,
      bodyWid - 0.22,
      0,
      0,
      0,
      false,
    );
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.CylinderGeometry(0.09, 0.09, 0.55, 10),
      mats.brushed,
      midX + 0.35,
      cabFloorY - 0.42,
      bodyWid - 0.28,
      0,
      0,
      Math.PI / 2,
      false,
    );
  }

  var stepRailX0 = xOffset + bodyLen * 0.38;
  var stepRailX1 = xOffset + bodyLen * 0.62;
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    mats.satinTrim,
    stepRailX0,
    stepRailX1,
    cabFloorY - 0.52,
    cabFloorY - 0.48,
    0.08,
    0.04,
  );
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    mats.satinTrim,
    stepRailX0,
    stepRailX1,
    cabFloorY - 0.52,
    cabFloorY - 0.48,
    bodyWid - 0.08,
    0.04,
  );
}

/**
 * Modern Scania mirror — single chrome arm extending outboard from the cab,
 * with a vertical main housing PLUS a smaller spotter mirror mounted just
 * below it. The spotter is the small downward-angled mirror Scania drivers
 * use to see the kerb directly beside the cab door — instantly recognisable.
 *
 *   cab side                                outboard
 *     │═══════════════════╗   ← chrome arm
 *     │                   ║─┐
 *     │                   ║ │  main housing
 *     │                   ║ │
 *     │                   ║─┘
 *     │                   ║─┐  ← spotter (smaller, slightly angled)
 *     │                   ║─┘
 *
 * mirrorMat (chrome) controls the arm + housing; glassMat the lens faces.
 * trimMat is retained in the signature for back-compat with addCabHorse.
 */
function isoTractorCreateMirrorAssemblies(
  grp,
  THREE,
  trimMat,
  glassMat,
  mirrorX,
  mirrorY,
  bodyWid,
  chromeMat,
) {
  /* Fall back to trimMat if no chrome is passed (back-compat for any other
   * caller). Inside addIsoTractorHorse we now pass mats.chrome explicitly. */
  var mirrorMat = chromeMat || trimMat;
  function oneSide(isLeft) {
    var sign = isLeft ? -1 : 1;
    var cabSideZ = isLeft ? 0.06 : bodyWid - 0.06;
    var housingZ = cabSideZ + sign * 0.26; /* slightly wider stance */
    var armCenterZ = (cabSideZ + housingZ) * 0.5;
    var armLen = Math.abs(housingZ - cabSideZ);

    /* Single chrome arm bracket — chunkier than the old flat pair so it
     * reads as one structural piece. Sits at the housing's vertical
     * midpoint. */
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(0.06, 0.05, armLen),
      mirrorMat,
      mirrorX,
      mirrorY + 0.04,
      armCenterZ,
      0,
      0,
      0,
      false,
    );

    /* Main mirror housing — vertical block at the outboard end. */
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(0.1, 0.42, 0.14),
      mirrorMat,
      mirrorX,
      mirrorY,
      housingZ,
      0,
      0,
      0,
      false,
    );
    /* Main mirror glass — rear-facing. */
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(0.025, 0.34, 0.1),
      glassMat,
      mirrorX + 0.055,
      mirrorY + 0.02,
      housingZ,
      0,
      0,
      0,
      true,
    );

    /* Spotter mirror — smaller secondary housing below the main mirror,
     * slightly angled downward (rotated around Z so glass tilts toward the
     * road). This is the Scania kerb-view mirror. */
    var spotY = mirrorY - 0.3;
    var spotZ = housingZ + sign * 0.01;
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(0.085, 0.13, 0.12),
      mirrorMat,
      mirrorX,
      spotY,
      spotZ,
      0,
      0,
      0.18 * sign,
      false,
    );
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(0.022, 0.1, 0.085),
      glassMat,
      mirrorX + 0.048,
      spotY,
      spotZ,
      0,
      0,
      0.18 * sign,
      true,
    );
  }
  oneSide(true);
  oneSide(false);
}

function isoTractorCreateFifthWheel(
  grp,
  THREE,
  trimMat,
  chromeMat,
  plateX,
  deckY,
  bodyWid,
) {
  var fw = isoTractorAddMesh(
    grp,
    THREE,
    new THREE.CylinderGeometry(0.52, 0.52, 0.11, 26),
    trimMat,
    plateX,
    deckY + 0.055,
    bodyWid / 2,
    0,
    0,
    0,
    false,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.CylinderGeometry(0.09, 0.09, 0.1, 12),
    chromeMat,
    plateX,
    deckY + 0.12,
    bodyWid / 2,
    0,
    0,
    0,
    false,
  );
  return fw;
}

/**
 * Curved windshield — open vertical cylinder arc with ≈ 8 cm outward bow.
 *
 * The bow is generated by a `CylinderGeometry` opened to only the front
 * sector (`thetaStart … thetaStart + thetaLength`) so the visible surface
 * curves outward toward -X. A pivot group wraps the mesh so we can tilt the
 * top rearward around the surface midpoint at (centerX, midY, cz) instead of
 * the cylinder center — the cylinder center sits `r` metres behind the
 * surface, and rotating around it would translate the windshield by ~2 m.
 *
 * Top-down (looking down -Y) — arc bows outward toward -X:
 *
 *         z
 *         ▲
 *   wing  │  wing
 *      ╲  │  ╱
 *       ╲ │ ╱
 *        ─┼─    centerX
 *      midpoint (deepest -X)
 */
function isoTractorCreateWindshield(
  grp,
  THREE,
  glassMat,
  centerX,
  baseY,
  topY,
  bodyWid,
  tiltRad,
  widthZFracOpt,
) {
  var wzf = widthZFracOpt != null ? widthZFracOpt : 0.88;
  var h = Math.max(0.35, topY - baseY);
  var cz = bodyWid * 0.5;
  var midY = (baseY + topY) * 0.5;
  /* Half-angle ≈ 0.15 rad (~8.6°). r is solved from the desired chord
   * length so the windshield spans exactly bodyWid * wzf in Z. Resulting
   * bow depth ≈ 8 cm — visible from the iso camera, not cartoonish. */
  var halfTheta = 0.15;
  var chord = bodyWid * wzf;
  var r = chord / (2 * Math.sin(halfTheta));
  var seg = 14;
  /* IMPORTANT — Three.js CylinderGeometry vertices use
   *   x = R * sin(theta)
   *   z = R * cos(theta)
   * (not the textbook cos/sin assignment). For our arc to span the cab's
   * Z (width) axis with its bow along -X (cab forward), we centre the arc
   * on theta = -PI/2:
   *   sin(-PI/2) = -1  → vertices at x ≈ -R   (good: offset by +R brings them to x ≈ 0)
   *   cos(-PI/2) =  0  → vertices at z ≈ 0    (varies a little, forming the chord)
   * Earlier this used theta = PI which put the arc at z ≈ -R and made
   * mesh.position.set(r,0,0) shove the windshield ~6 m into negative Z. */
  var geo = new THREE.CylinderGeometry(
    r,
    r,
    h,
    seg,
    1,
    true,
    -Math.PI / 2 - halfTheta,
    2 * halfTheta,
  );

  var pivot = new THREE.Group();
  var mesh = new THREE.Mesh(geo, glassMat);
  /* Offset the cylinder mesh by +r so the surface midpoint sits at the
   * pivot origin. Now pivot rotation = surface rotation. */
  mesh.position.set(r, 0, 0);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  pivot.add(mesh);
  pivot.position.set(centerX, midY, cz);
  pivot.rotation.z = tiltRad;
  grp.add(pivot);
  return mesh;
}

/**
 * Shared glass-band layout — one beltline/top for windshield, quarter glass,
 * side windows, trims, grille spacing, A-pillar, and fascia seams.
 */
function isoTractorResolveGlassBand(
  cabFloorY,
  mainCabH,
  cabFrontX,
  cabBaseCenterX,
  mainCabL,
  st,
) {
  st = st || {};
  var beltM = st.glassBeltMul != null ? st.glassBeltMul : 0.535;
  var topM = st.glassTopMul != null ? st.glassTopMul : 0.912;
  var beltlineY = cabFloorY + mainCabH * beltM;
  var topY = cabFloorY + mainCabH * topM;
  var doorFrontX = cabFrontX + mainCabL * 0.268;
  var doorRearX = cabBaseCenterX + mainCabL * 0.173;
  return {
    beltlineY: beltlineY,
    topY: topY,
    tiltRad:
      -0.475 + (st.windshieldTiltAdd != null ? st.windshieldTiltAdd : 0.2),
    wsCenterX: cabFrontX - 0.38 + (st.wsForward != null ? st.wsForward : 0.34),
    widthZFrac: st.glassWidthZFrac != null ? st.glassWidthZFrac : 0.86,
    cheekBlend: st.cheekTiltBlend != null ? st.cheekTiltBlend : 0.48,
    doorFrontX: doorFrontX,
    doorRearX: doorRearX,
    doorBotY: cabFloorY + mainCabH * 0.22,
    doorTopY: topY + Math.max(0.04, mainCabH * 0.018),
    grilleTopGap: 0.085,
    quarterFrontX: cabFrontX + 0.048,
  };
}

/** Dark frame strips around one rectangular glazing at world-Z zPlane. */
function isoTractorAddGlazingFrameRect(
  grp,
  THREE,
  seamMat,
  xL,
  xR,
  yBot,
  yTop,
  zPlane,
  wfMargin,
  wfThick,
) {
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    seamMat,
    xL,
    xR,
    yTop - wfMargin * 0.5,
    yTop + wfMargin * 0.5,
    zPlane,
    wfThick,
  );
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    seamMat,
    xL,
    xR,
    yBot - wfMargin * 0.5,
    yBot + wfMargin * 0.5,
    zPlane,
    wfThick,
  );
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    seamMat,
    xL - wfMargin * 0.5,
    xL + wfMargin * 0.5,
    yBot,
    yTop,
    zPlane,
    wfThick,
  );
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    seamMat,
    xR - wfMargin * 0.5,
    xR + wfMargin * 0.5,
    yBot,
    yTop,
    zPlane,
    wfThick,
  );
}

/** Windshield + quarter glass + curved-corner side glass + chrome surrounds. */
function isoTractorCreateGlassBandWrap(
  grp,
  THREE,
  mats,
  bodyWid,
  gb,
  cabFrontX,
) {
  var belt = gb.beltlineY;
  var topY = gb.topY;
  var tilt = gb.tiltRad;
  var qh = Math.max(0.2, topY - belt);
  var midY = (belt + topY) * 0.5;

  isoTractorCreateWindshield(
    grp,
    THREE,
    mats.glass,
    gb.wsCenterX,
    belt,
    topY,
    bodyWid,
    tilt,
    gb.widthZFrac,
  );

  var doorLen = gb.doorRearX - gb.doorFrontX;
  var sideWinL = doorLen * 0.82;
  var sideCx = (gb.doorFrontX + gb.doorRearX) * 0.5;
  var sx0 = sideCx - sideWinL * 0.5;
  var sx1 = sideCx + sideWinL * 0.5;
  /* Rounded front-top corner — visually continues the windshield arc into
   * the A-pillar, replacing the old separate "cheek glass" cleavage piece. */
  var rCorner = Math.min(qh * 0.45, sideWinL * 0.18);
  var winShape = new THREE.Shape();
  winShape.moveTo(sx0 + rCorner, topY);
  winShape.lineTo(sx1, topY);
  winShape.lineTo(sx1, belt);
  winShape.lineTo(sx0, belt);
  winShape.lineTo(sx0, topY - rCorner);
  winShape.quadraticCurveTo(sx0, topY, sx0 + rCorner, topY);
  winShape.closePath();
  var winThick = 0.04;
  var winGeoTpl = new THREE.ExtrudeGeometry(winShape, {
    depth: winThick,
    bevelEnabled: false,
    curveSegments: 8,
  });

  var winGeoL = winGeoTpl.clone();
  winGeoL.translate(0, 0, 0.018);
  var winMeshL = new THREE.Mesh(winGeoL, mats.glass);
  winMeshL.castShadow = false;
  winMeshL.receiveShadow = false;
  grp.add(winMeshL);

  var winGeoR = winGeoTpl.clone();
  winGeoR.translate(0, 0, bodyWid - 0.018 - winThick);
  var winMeshR = new THREE.Mesh(winGeoR, mats.glass);
  winMeshR.castShadow = false;
  winMeshR.receiveShadow = false;
  grp.add(winMeshR);

  /* Tiny quarter-glass between A-pillar and door front — kept as a flat
   * slab; on Scania this is a real fixed glass panel. */
  var qgRear = gb.doorFrontX - 0.022;
  var qgFront = gb.quarterFrontX;
  var qSpan = qgRear - qgFront;
  if (qSpan > 0.088) {
    var qMx = (qgFront + qgRear) * 0.5;
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(qSpan * 0.92, qh, 0.034),
      mats.glass,
      qMx,
      midY,
      0.036,
      0,
      0,
      0,
      true,
    );
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(qSpan * 0.92, qh, 0.034),
      mats.glass,
      qMx,
      midY,
      bodyWid - 0.036,
      0,
      0,
      0,
      true,
    );
  }

  /* (Cheek glass at line ~988 in the previous code is gone — the rounded
   * front-top corner of the side window already bridges the visual gap to
   * the A-pillar, so we don't need a separately tilted slab there.) */

  var pillarW = 0.068;
  var pillarD = 0.048;
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(pillarW, qh + 0.05, pillarD),
    mats.darkPlastic,
    cabFrontX - 0.048,
    midY + 0.025,
    pillarD * 0.65 + 0.04,
    0,
    tilt * 0.52,
    tilt * 0.08,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(pillarW, qh + 0.05, pillarD),
    mats.darkPlastic,
    cabFrontX - 0.048,
    midY + 0.025,
    bodyWid - pillarD * 0.65 - 0.04,
    0,
    -tilt * 0.52,
    -tilt * 0.08,
  );

  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.055, 0.052, bodyWid * gb.widthZFrac * 0.94),
    mats.darkPlastic,
    gb.wsCenterX - 0.035,
    topY + 0.026,
    bodyWid * 0.5,
    0,
    0,
    tilt * 0.38,
  );

  var wfMargin = 0.022;
  var wfThick = 0.028;
  var zFrames = [0.02, bodyWid - 0.02];
  var fi;
  for (fi = 0; fi < zFrames.length; fi++) {
    var zPl = zFrames[fi];
    isoTractorAddGlazingFrameRect(
      grp,
      THREE,
      mats.darkPlastic,
      sx0,
      sx1,
      belt,
      topY,
      zPl,
      wfMargin,
      wfThick,
    );
    if (qSpan > 0.088) {
      isoTractorAddGlazingFrameRect(
        grp,
        THREE,
        mats.darkPlastic,
        qgFront,
        qgRear,
        belt,
        topY,
        zPl,
        wfMargin,
        wfThick,
      );
    }
  }

  /* Chrome window surround — thin polished trim along the top of each side
   * window. The single most effective "premium Euro cab" detail per gram of
   * geometry. Two strips per side: top (above the window) and beltline
   * (below the window, doubling as the upper door trim). */
  var chromeThick = 0.016;
  var chromeOffset = 0.006;
  var chromeWinTop = topY + wfMargin * 0.5 + chromeOffset;
  var chromeWinBot = belt - wfMargin * 0.5 - chromeOffset;
  for (fi = 0; fi < zFrames.length; fi++) {
    var zChr = zFrames[fi];
    isoTractorCreateSeamStrip(
      grp,
      THREE,
      mats.chrome,
      sx0,
      sx1,
      chromeWinTop - chromeThick * 0.5,
      chromeWinTop + chromeThick * 0.5,
      zChr,
      0.026,
    );
    isoTractorCreateSeamStrip(
      grp,
      THREE,
      mats.chrome,
      sx0 + 0.06,
      sx1 - 0.06,
      chromeWinBot - chromeThick * 0.6,
      chromeWinBot + chromeThick * 0.6,
      zChr,
      0.022,
    );
  }

  /* Chrome strip across the windshield header — top edge of the windshield
   * opening from A-pillar to A-pillar. */
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.045, 0.022, bodyWid * gb.widthZFrac * 0.88),
    mats.chrome,
    gb.wsCenterX - 0.012,
    topY + 0.06,
    bodyWid * 0.5,
    0,
    0,
    tilt * 0.38,
  );

  isoTractorCreateSeamStrip(
    grp,
    THREE,
    mats.darkPlastic,
    cabFrontX - 0.11,
    gb.doorFrontX + Math.max(doorLen, 0.5) * 0.52,
    belt - 0.028,
    belt - 0.01,
    0.052,
    0.022,
  );
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    mats.darkPlastic,
    cabFrontX - 0.11,
    gb.doorFrontX + Math.max(doorLen, 0.5) * 0.52,
    belt - 0.028,
    belt - 0.01,
    bodyWid - 0.052,
    0.022,
  );

  var cz = bodyWid * 0.5;
  var ziL = cz - bodyWid * gb.widthZFrac * 0.18;
  var ziR = cz + bodyWid * gb.widthZFrac * 0.18;
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.035, 0.024, bodyWid * gb.widthZFrac * 0.34),
    mats.darkPlastic,
    gb.wsCenterX - 0.018,
    belt + 0.042,
    ziL,
    0,
    0,
    tilt * 0.48,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.035, 0.024, bodyWid * gb.widthZFrac * 0.34),
    mats.darkPlastic,
    gb.wsCenterX - 0.018,
    belt + 0.042,
    ziR,
    0,
    0,
    -tilt * 0.48,
  );

  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.09, 0.065, bodyWid * gb.widthZFrac),
    mats.trim,
    cabFrontX - 0.028,
    topY + 0.064,
    cz,
    0,
    0,
    -0.055,
    false,
  );
}

/**
 * Scania-signature V-shape headlight cluster — slanted housing with inboard
 * edge lower than outboard, plus a dark lower wing bar trailing down toward
 * the bumper line. Left/right are mirrored: the V opens upward and outward.
 *
 *      outboard         inboard
 *      ─────              ╲
 *      │   │               ╲  ← lower wing
 *      │ ▓ │ chrome bezel   ╲
 *      │ ▓ │                 ╲
 *      ─────                  ╲
 *                              ▼ (toward grille center)
 *
 * Roll angle: positive on left side (inboard edge dips toward +X, +Z), negated
 * on right. Combined with the existing inward yaw, the cluster face sweeps
 * toward the grille like an angled jewel — the most recognisable Scania cue.
 */
function isoTractorCreateHeadlightCluster(
  grp,
  THREE,
  mats,
  isLeft,
  bodyWid,
  cx0,
  ay,
  inset,
) {
  /* cx0 sits on the outer cab skin; forward is −X toward the grille face. */
  var hlEdge = bodyWid * 0.135;
  var hlW = 0.352;
  var hlH = 0.446;
  var hlT = 0.058;
  var cz = isLeft ? hlEdge + hlW * 0.5 : bodyWid - hlEdge - hlW * 0.5;
  var yaw = isLeft ? 0.045 : -0.045;
  /* Slant the cluster so the inboard edge sits lower than the outboard
   * edge. 12° feels right at iso scale — clearly read as a V from the
   * front 3/4 view without looking falling-off-the-cab cartoonish. */
  var roll = (isLeft ? 1 : -1) * 0.21;
  inset = inset != null ? inset : 0.04;

  var housingX = cx0 + hlT * 0.5;
  var chromeX = cx0 + hlT * 0.62;
  var lensX = cx0 - hlT * 0.22;

  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(hlT, hlH * 1.06, hlW * 1.06),
    mats.darkPlastic,
    housingX,
    ay,
    cz,
    0,
    yaw,
    roll,
    false,
  );

  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(hlT * 0.64, hlH * 0.97, hlW * 0.995),
    mats.chrome,
    chromeX,
    ay,
    cz,
    0,
    yaw * 0.92,
    roll,
    false,
  );

  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(hlT * 0.42, hlH * 0.58, hlW * 0.68),
    mats.headlight,
    lensX + inset * 0.05,
    ay - 0.018,
    cz,
    0,
    0,
    roll,
    false,
  );

  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(hlT * 0.32, 0.055, hlW * 0.76),
    mats.drl,
    lensX - inset * 0.06,
    ay - hlH * 0.36,
    cz,
    0,
    yaw * 0.5,
    roll,
    false,
  );

  /* Inboard amber marker — sits on the outboard end of the slanted housing. */
  var azOff = isLeft ? hlW * 0.4 : -hlW * 0.4;
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(hlT * 0.32, 0.085, 0.1),
    mats.markerLight,
    housingX + hlT * 0.42,
    ay + hlH * 0.39,
    cz + azOff,
    0,
    yaw * 0.5,
    roll,
    false,
  );

  /* Eyebrow trim — paint-coloured curve above the housing, matches the roll. */
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(hlT * 0.92, 0.038, hlW * 1.06),
    mats.paint,
    chromeX + hlT * 0.15,
    ay + hlH * 0.515,
    cz,
    0.1 * (isLeft ? 1 : -1),
    yaw,
    roll,
    false,
  );

  /* Lower wing — dark bar extending from the inboard-lower corner of the
   * headlight down toward the bumper, sealing the V and matching real
   * Scania trim where the headlight pocket runs into the lower fascia. */
  var wingLen = hlW * 0.55;
  var wingX = lensX - inset * 0.02;
  var inboardZ = isLeft ? cz - hlW * 0.4 : cz + hlW * 0.4;
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(hlT * 0.55, 0.06, wingLen),
    mats.darkPlastic,
    wingX,
    ay - hlH * 0.42,
    inboardZ,
    0,
    yaw,
    roll * 1.4,
    false,
  );
}

/** Horizontal belt crease + vertical grille creases + headlight-well insets + corner drip lines. */
function isoTractorCreateFrontFasciaContours(grp, THREE, mats, ctx) {
  var fx = ctx.cabFrontX;
  var belt = ctx.beltlineY;
  var bodyWid = ctx.bodyWid;
  var cz = bodyWid * 0.5;
  var grHalf =
    ctx.grilleHalfWidth != null ? ctx.grilleHalfWidth : bodyWid * 0.31;
  var zCreL = cz - grHalf - 0.03;
  var zCreR = cz + grHalf + 0.03;
  var gv = fx - 0.082;
  var yGrilleLow =
    ctx.grilleFloorY != null ? ctx.grilleFloorY : ctx.cabFloorY + 0.34;
  var yGrilleHigh = belt - 0.05;

  isoTractorCreateSeamStrip(
    grp,
    THREE,
    mats.darkPlastic,
    fx - 0.07,
    fx + ctx.mainCabL * 0.28,
    belt - 0.016,
    belt - 0.004,
    0.062,
    0.017,
  );
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    mats.darkPlastic,
    fx - 0.07,
    fx + ctx.mainCabL * 0.28,
    belt - 0.016,
    belt - 0.004,
    bodyWid - 0.062,
    0.017,
  );

  if (yGrilleHigh > yGrilleLow + 0.12) {
    isoTractorCreateSeamStrip(
      grp,
      THREE,
      mats.darkPlastic,
      gv,
      gv + 0.036,
      yGrilleLow,
      yGrilleHigh,
      zCreL,
      0.014,
    );
    isoTractorCreateSeamStrip(
      grp,
      THREE,
      mats.darkPlastic,
      gv,
      gv + 0.036,
      yGrilleLow,
      yGrilleHigh,
      zCreR,
      0.014,
    );
  }

  var hlCy = ctx.headlightCY;
  if (hlCy != null) {
    isoTractorCreatePanelInset(
      grp,
      THREE,
      mats.darkPlastic,
      fx - 0.11,
      fx - 0.02,
      hlCy - 0.2,
      hlCy + 0.23,
      0.078,
      0.014,
    );
    isoTractorCreatePanelInset(
      grp,
      THREE,
      mats.darkPlastic,
      fx - 0.11,
      fx - 0.02,
      hlCy - 0.2,
      hlCy + 0.23,
      bodyWid - 0.078,
      0.014,
    );
    isoTractorCreateSeamStrip(
      grp,
      THREE,
      mats.darkPlastic,
      fx - 0.118,
      fx - 0.02,
      hlCy + 0.24,
      hlCy + 0.41,
      0.052,
      0.012,
    );
    isoTractorCreateSeamStrip(
      grp,
      THREE,
      mats.darkPlastic,
      fx - 0.118,
      fx - 0.02,
      hlCy + 0.24,
      hlCy + 0.41,
      bodyWid - 0.052,
      0.012,
    );
  }
}

// ── PUBLIC: assemble the horse ───────────────────────────────────────────────

/**
 * Tractor horse in front of the trailer (rear abuts ~x=0). Style-driven silhouette,
 * layered fascia, tractor-only tyre scale.
 *
 * opts:
 *   bedWidth: number — trailer/truck deck width in metres. Used to laterally
 *             centre the horse on the trailer (z-axis).
 */
export function addIsoTractorHorse(THREE, parent, layoutKey, opts) {
  opts = opts || {};
  /* Derive a realistic horse axle config from the truck's TOTAL wheel layout.
   * The old code used `TRACTOR_AXLE_TEMPLATES[layoutKey]` directly, which put
   * the FULL-RIG axle count under the cab — e.g. a 22-Wheels truck rendered
   * with 6 axles on the horse and effectively a flatbed-length chassis. The
   * trailer carries the remaining wheels via its own tridem-per-section. */
  var horseLayoutKey = deriveHorseAxleLayout(layoutKey);
  var template =
    HORSE_AXLE_TEMPLATES[horseLayoutKey] || HORSE_AXLE_TEMPLATES.horse6x4;
  var bodyLen = getHorseBodyLengthM(horseLayoutKey);
  var st = isoTractorResolveStyle(ISO_TRACTOR_CAB_THEME.styleId);
  var bodyWid = 2.52 + st.bodyWidAdd;
  var hitchGap = 0.035;
  var xOffset = -(bodyLen + hitchGap);

  var grp = new THREE.Group();
  grp.name = "isoTractorHorse";

  var layoutHue = 0;
  var i;
  for (i = 0; i < layoutKey.length; i++) layoutHue += layoutKey.charCodeAt(i);
  var paintHex = ISO_TRACTOR_CAB_THEME.paintHex;
  /* Keep white fleet paint neutral — tiny per-layout shift only so rigs don't
   * all read as identical flat white under different lighting. */
  var clamp =
    THREE.MathUtils?.clamp || ((v, a, b) => Math.min(Math.max(v, a), b));
  var r = (paintHex >> 16) & 255;
  var g = (paintHex >> 8) & 255;
  var b = paintHex & 255;
  var shift = ((layoutHue % 5) - 2) * 0.35;
  r = clamp(r + shift, 228, 248);
  g = clamp(g + shift * 0.9, 228, 248);
  b = clamp(b + shift * 0.85, 228, 248);
  paintHex = (r << 16) | (g << 8) | b;

  var sleeperStrength = ISO_TRACTOR_CAB_THEME.sleeperStrength;
  if (layoutKey === "4-Wheels" || layoutKey === "6-Wheels")
    sleeperStrength *= 0.55;

  var mats = isoTractorCreateMaterials(
    THREE,
    paintHex,
    ISO_TRACTOR_CAB_THEME.trimHex,
    ISO_TRACTOR_CAB_THEME.glassHex,
    {
      roughnessShift: st.roughnessShift || 0,
      chromeRoughAdd: st.chromeRoughAdd || 0,
      paintEnvMul: st.paintEnvMul || 1,
    },
  );

  var tractorTyreOpts = {
    radiusMul: st.tyreRadiusMul || 1.1,
    widthMul: st.tyreWidthMul || 1.14,
    dualTyreGapMul: st.dualTyreGapMul || 0.98,
  };

  var railH = 0.105;
  var deckH = 0.125;
  var chassisY = railH + 0.045;
  var cabFloorY = chassisY + deckH;

  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(bodyLen * 0.985, railH, 0.105),
    mats.chassis,
    xOffset + bodyLen / 2,
    railH / 2 + 0.018,
    0.26,
    0,
    0,
    0,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(bodyLen * 0.985, railH, 0.105),
    mats.chassis,
    xOffset + bodyLen / 2,
    railH / 2 + 0.018,
    bodyWid - 0.26,
    0,
    0,
    0,
  );
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(bodyLen * 0.97, deckH, bodyWid * 0.935),
    mats.chassis,
    xOffset + bodyLen / 2,
    cabFloorY - deckH / 2,
    bodyWid / 2,
    0,
    0,
    0,
  );

  var noseTipX = xOffset + 0.135;
  var hoodLen = 1.92 * st.hoodLenMul;
  var cabFrontX = noseTipX + hoodLen - 0.055;

  var mainCabL = Math.max(1.28, 2.02 * st.mainCabLMul - st.cabLenShift);
  var mainCabH = 2.48 * st.mainCabHMul;

  var cabBaseCenterX = cabFrontX + mainCabL * 0.475 - 0.05;
  var sleeperLRaw = Math.max(
    0.98,
    bodyLen - 0.52 - (cabBaseCenterX + mainCabL * 0.5 - xOffset),
  );
  var sleeperL = Math.max(0.68, sleeperLRaw * sleeperStrength * st.sleeperLMul);
  var sleeperCenterX = cabBaseCenterX + mainCabL * 0.5 + sleeperL * 0.5 + 0.055;
  /* Sleeper sits a few cm taller than the cab on high-roof rigs. This is
   * what activates the roof aero cap guard further down: with sleeperH
   * exactly == mainCabH, the cap was suppressed. A small +4 cm bump combined
   * with the lowered peak-floor in isoTractorCreateRoofCapGeometry yields a
   * gentle aero arc from cab roof to sleeper top — the classic Scania
   * Topline/Highline profile. Cab-only rigs (sleeperStrength scaled down by
   * 4-/6-Wheels guards above) keep a flat roof. */
  var sleeperH = mainCabH * (sleeperStrength >= 0.9 ? 1.04 : 1.0);

  var hoodGeo = isoTractorCreateHoodExtrudeGeometry(
    THREE,
    hoodLen,
    bodyWid,
    st,
  );
  var hoodMesh = new THREE.Mesh(hoodGeo, mats.paint);
  hoodMesh.position.set(noseTipX, cabFloorY, bodyWid / 2);
  hoodMesh.castShadow = hoodMesh.receiveShadow = true;
  grp.add(hoodMesh);

  isoTractorCreateHoodSeams(
    grp,
    THREE,
    mats.darkPlastic,
    noseTipX,
    hoodLen,
    cabFloorY,
    bodyWid,
  );

  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.06, 0.05, bodyWid * 0.9),
    mats.darkPlastic,
    cabFrontX - 0.05,
    cabFloorY + 0.08,
    bodyWid / 2,
    0,
    0,
    0,
    false,
  );

  var cabShellGeo = isoTractorCreateCabShellGeometry(
    THREE,
    mainCabL,
    mainCabH,
    bodyWid,
    st,
  );
  var cabShellMesh = new THREE.Mesh(cabShellGeo, mats.paint);
  cabShellMesh.position.set(cabBaseCenterX, cabFloorY, bodyWid / 2);
  cabShellMesh.castShadow = cabShellMesh.receiveShadow = true;
  grp.add(cabShellMesh);

  /* Scania-signature shoulder character line — a horizontal panel break
   * running cab front → cab rear at ~78 % cab height. This is the visible
   * seam between the upper greenhouse panel and the lower door panel on every
   * modern Euro cab. Two thin dark-plastic strips (one per side). */
  var shoulderY = cabFloorY + mainCabH * 0.78;
  var shoulderX0 = cabBaseCenterX - mainCabL * 0.46;
  var shoulderX1 = cabBaseCenterX + mainCabL * 0.46;
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    mats.darkPlastic,
    shoulderX0,
    shoulderX1,
    shoulderY - 0.012,
    shoulderY + 0.012,
    0.052,
    0.022,
  );
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    mats.darkPlastic,
    shoulderX0,
    shoulderX1,
    shoulderY - 0.012,
    shoulderY + 0.012,
    bodyWid - 0.052,
    0.022,
  );

  var sleeperShellGeo = isoTractorCreateSleeperShellGeometry(
    THREE,
    sleeperL,
    sleeperH,
    bodyWid,
    st,
  );
  var sleeperShellMesh = new THREE.Mesh(sleeperShellGeo, mats.paint);
  sleeperShellMesh.position.set(sleeperCenterX, cabFloorY, bodyWid / 2);
  sleeperShellMesh.castShadow = sleeperShellMesh.receiveShadow = true;
  grp.add(sleeperShellMesh);

  isoTractorCreateSeamStrip(
    grp,
    THREE,
    mats.darkPlastic,
    sleeperCenterX - sleeperL * 0.45,
    sleeperCenterX + sleeperL * 0.45,
    cabFloorY + sleeperH * 0.28,
    cabFloorY + sleeperH * 0.33,
    0.06,
    0.025,
  );
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    mats.darkPlastic,
    sleeperCenterX - sleeperL * 0.45,
    sleeperCenterX + sleeperL * 0.45,
    cabFloorY + sleeperH * 0.28,
    cabFloorY + sleeperH * 0.33,
    bodyWid - 0.06,
    0.025,
  );

  var gb = isoTractorResolveGlassBand(
    cabFloorY,
    mainCabH,
    cabFrontX,
    cabBaseCenterX,
    mainCabL,
    st,
  );
  isoTractorCreateGlassBandWrap(grp, THREE, mats, bodyWid, gb, cabFrontX);

  /* Door seams share the resolved glass-band door rectangle. */
  var doorFrontX = gb.doorFrontX;
  var doorRearX = gb.doorRearX;
  var doorBotY = gb.doorBotY;
  var doorTopY = gb.doorTopY;

  /* Scania-signature roof marker lights — 5 small amber boxes evenly spaced
     across the upper-front edge of the cab, just below the cab top. They
     anchor to the cab front face (upper-rake region) at X = cabFrontX +
     mainCabL*0.18 - 0.04 — the world-X of the upper-front cab corner minus a
     small inset so they sit ON the face, not floating ahead of it. */
  var rmCount = 5;
  var rmX = cabFrontX + mainCabL * 0.165 - 0.035;
  var rmY = cabFloorY + mainCabH - 0.065;
  var rmZSpan = bodyWid * 0.6;
  var rmZStart = (bodyWid - rmZSpan) * 0.5;
  var rmStep = rmCount > 1 ? rmZSpan / (rmCount - 1) : 0;
  for (var rmI = 0; rmI < rmCount; rmI++) {
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(0.05, 0.06, 0.07),
      mats.markerLight,
      rmX,
      rmY,
      rmZStart + rmI * rmStep,
      0,
      0,
      0,
      false,
    );
  }

  /* Roof cap only drawn when the sleeper actually sits TALLER than the cab
     (it bridges the two heights). With sleeperH = mainCabH there is nothing
     to bridge — the cab and sleeper bodies already form a continuous flat
     roof. The function also forces a 0.18 m peak floor which would render as
     a domed canopy in this case, hence the guard. */
  var sleeperTopRel = sleeperH - mainCabH;
  if (sleeperTopRel > 0.05) {
    var capStartX = cabFrontX - 0.04;
    var capEndX = sleeperCenterX + sleeperL * 0.5 + 0.02;
    var capLen = Math.max(0.6, capEndX - capStartX);
    var sleeperStartLocal = cabBaseCenterX + mainCabL * 0.5 + 0.04 - capStartX;
    var capGeo = isoTractorCreateRoofCapGeometry(
      THREE,
      capLen,
      sleeperStartLocal,
      sleeperTopRel,
      bodyWid,
      st,
    );
    var capMesh = new THREE.Mesh(capGeo, mats.paint);
    capMesh.position.set(capStartX, cabFloorY + mainCabH, bodyWid / 2);
    capMesh.castShadow = true;
    capMesh.receiveShadow = true;
    grp.add(capMesh);
  }

  /* (Body shoulder accent strip removed — the thin horizontal accent at ~66%
     cab height bisected the door window and doesn't match a real Scania cab
     side. The helper isoTractorCreateBodyShoulderStrip is left defined for
     possible future use.) */

  isoTractorCreateFrontBumperStack(
    grp,
    THREE,
    mats.rubber,
    mats.satinTrim,
    mats.chrome,
    noseTipX,
    cabFloorY,
    bodyWid,
    st.bumperMassMul,
  );

  /* Headlight + grille are now CO-LEVEL: grille is centered vertically on
   * the headlight Y so the V-shape headlights flank the grille horizontally
   * (the recognisable Scania fascia arrangement). */
  var hlY = cabFloorY + 0.782;
  var grilleAnchorH = 0.72;
  /* grilleY0 is the BOTTOM of the grille — pull it down so the grille
   * CENTER lines up with the headlight CENTER. */
  var grilleY0 = hlY - grilleAnchorH * 0.5;

  isoTractorCreateGrilleSection(
    grp,
    THREE,
    mats.grille,
    mats.chrome,
    mats.darkPlastic,
    cabFrontX - 0.26,
    grilleY0,
    bodyWid,
    st.grilleSlats,
  );

  var hlInset = st.headlightInset != null ? st.headlightInset : 0.04;
  isoTractorCreateHeadlightCluster(
    grp,
    THREE,
    mats,
    true,
    bodyWid,
    cabFrontX - 0.02,
    hlY,
    hlInset,
  );
  isoTractorCreateHeadlightCluster(
    grp,
    THREE,
    mats,
    false,
    bodyWid,
    cabFrontX - 0.02,
    hlY,
    hlInset,
  );

  isoTractorCreateFrontFasciaContours(grp, THREE, mats, {
    cabFrontX: cabFrontX,
    beltlineY: gb.beltlineY,
    mainCabL: mainCabL,
    bodyWid: bodyWid,
    headlightCY: hlY,
    grilleHalfWidth: bodyWid * 0.31,
    grilleFloorY: grilleY0,
    cabFloorY: cabFloorY,
  });

  /* (Side air intake louvres removed — modern Euro cab-overs draw cooling air
     through the bumper/grille, not from rotated panels on the cab flank.
     Those louvres were leftover styling from the conventional silhouette and
     clashed with the door outline.) */

  /* DOOR SHELL — Scania-style door with:
     • Outer dark seam outline (the panel gap between door and cab)
     • Recessed inner panel (paint colour, inset slightly from the seam)
     • Horizontal character/swage line across the lower door
     • Chrome handle pocket below the window beltline
     • Step well cutout below the door
     doorFrontX / doorRearX / doorBotY / doorTopY were resolved with the
     windshield so the window and outline share the same rectangle. */
  var doorMidY = (doorBotY + doorTopY) * 0.5;
  var doorSides = [0.045, bodyWid - 0.045];
  for (var ds = 0; ds < doorSides.length; ds++) {
    var dz = doorSides[ds];
    var inward = ds === 0 ? -0.006 : 0.006; /* push the recessed panel
                                                   slightly into the cab */
    /* 1. Outer seam outline (panel gap). */
    isoTractorCreateSeamStrip(
      grp,
      THREE,
      mats.darkPlastic,
      doorFrontX,
      doorRearX,
      doorTopY - 0.02,
      doorTopY + 0.02,
      dz,
      0.03,
    );
    isoTractorCreateSeamStrip(
      grp,
      THREE,
      mats.darkPlastic,
      doorFrontX,
      doorRearX,
      doorBotY - 0.02,
      doorBotY + 0.02,
      dz,
      0.03,
    );
    isoTractorCreateSeamStrip(
      grp,
      THREE,
      mats.darkPlastic,
      doorFrontX - 0.02,
      doorFrontX + 0.02,
      doorBotY,
      doorTopY,
      dz,
      0.03,
    );
    isoTractorCreateSeamStrip(
      grp,
      THREE,
      mats.darkPlastic,
      doorRearX - 0.02,
      doorRearX + 0.02,
      doorBotY,
      doorTopY,
      dz,
      0.03,
    );

    /* 2. Recessed inner panel — thin paint slab inset by ~2 cm from the
          seam, sitting just inside the cab skin. Reads as "sculpted door"
          rather than "billboard". */
    var panelX0 = doorFrontX + 0.05;
    var panelX1 = doorRearX - 0.05;
    var panelY0 = doorBotY + 0.05;
    var panelY1 = doorTopY - 0.05;
    isoTractorCreatePanelInset(
      grp,
      THREE,
      mats.paint,
      panelX0,
      panelX1,
      panelY0,
      panelY1,
      dz + inward,
      0.018,
    );

    /* 3. Character / swage line — single horizontal dark seam across the
          lower-mid door. Subtle but every modern Euro cab has one. */
    var swageY = doorBotY + (doorMidY - doorBotY) * 0.55;
    isoTractorCreateSeamStrip(
      grp,
      THREE,
      mats.darkPlastic,
      panelX0 + 0.04,
      panelX1 - 0.04,
      swageY - 0.008,
      swageY + 0.008,
      dz + inward * 0.5,
      0.016,
    );

    /* 4. Chrome door handle — short chrome bar sitting in a dark recess
          just below the window beltline, toward the rear of the door (where
          your right hand naturally falls). */
    var handleCx = panelX1 - 0.18;
    var handleY = doorMidY + (doorTopY - doorMidY) * 0.55;
    var handleLen = 0.22;
    /* Recess pocket */
    isoTractorAddMesh(
      grp,
      THREE,
      new THREE.BoxGeometry(handleLen + 0.04, 0.06, 0.012),
      mats.darkPlastic,
      handleCx,
      handleY,
      dz + inward * 0.4,
      0,
      0,
      0,
      false,
    );
    /* Chrome handle bar (cylinder lying along X) */
    var handleMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, handleLen, 10),
      mats.chrome,
    );
    handleMesh.rotation.z = Math.PI / 2;
    handleMesh.position.set(
      handleCx,
      handleY,
      ds === 0 ? dz + 0.018 : dz - 0.018,
    );
    handleMesh.castShadow = true;
    handleMesh.receiveShadow = true;
    grp.add(handleMesh);

    /* 5. Step well — rectangular dark recess directly below the door,
          where the driver steps up. Real Scanias have two stacked chrome
          steps; we approximate with a single inset rectangle plus a chrome
          step plate. */
    var stepTopY = doorBotY - 0.04;
    var stepBotY = Math.max(-0.05, cabFloorY - 0.92);
    var stepX0 = doorFrontX + 0.08;
    var stepX1 = doorRearX - 0.18;
    if (stepX1 > stepX0 + 0.15 && stepTopY > stepBotY + 0.15) {
      isoTractorCreatePanelInset(
        grp,
        THREE,
        mats.darkPlastic,
        stepX0,
        stepX1,
        stepBotY,
        stepTopY,
        dz + inward,
        0.02,
      );
      /* Chrome step plate near the bottom of the well. */
      var plateY = stepBotY + 0.12;
      isoTractorCreateSeamStrip(
        grp,
        THREE,
        mats.chrome,
        stepX0 + 0.04,
        stepX1 - 0.04,
        plateY - 0.018,
        plateY + 0.018,
        dz + inward * 0.4,
        0.024,
      );
    }
  }
  /* Front-of-door tag piece preserved — small dark strip wrapping the front
     of the door above where the mirror arm mounts. */
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    mats.darkPlastic,
    doorFrontX - 0.06,
    doorFrontX + 0.1,
    doorTopY - 0.01,
    doorTopY + 0.035,
    0.042,
    0.026,
  );
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    mats.darkPlastic,
    doorFrontX - 0.06,
    doorFrontX + 0.1,
    doorTopY - 0.01,
    doorTopY + 0.035,
    bodyWid - 0.042,
    0.026,
  );

  /* Milltrans cab-side livery — swoosh band, M-badge, fleet number from truck data. */
  var branding = opts.branding || {};
  addCabBrandingDecals(THREE, grp, {
    bodyWid: bodyWid,
    cabBaseCenterX: cabBaseCenterX,
    mainCabL: mainCabL,
    mainCabH: mainCabH,
    cabFloorY: cabFloorY,
    sleeperCenterX: sleeperCenterX,
    sleeperL: sleeperL,
    sleeperH: sleeperH,
    fleetNumber: branding.fleetNumber || "",
  });

  /* Small M-badge on grille emblem bar when badge texture is preloaded. */
  var grilleBadgeTex = getCachedBadgeTexture();
  if (grilleBadgeTex) {
    var gBadgeW = bodyWid * 0.11;
    var gBadgeH = gBadgeW * 0.72;
    var gBadge = makeDecalPlane(THREE, grilleBadgeTex, gBadgeW, gBadgeH, {
      renderOrder: 4,
    });
    gBadge.position.set(
      cabFrontX - 0.24,
      grilleY0 + grilleAnchorH - 0.085,
      bodyWid / 2,
    );
    grp.add(gBadge);
  }

  var axles = template.map(function (a) {
    return { x: xOffset + a.pos * bodyLen, type: a.type };
  });
  var xAx = axles
    .map(function (a) {
      return a.x;
    })
    .sort(function (a, b) {
      return a - b;
    });
  var xFirst = xAx[0];
  var xLast = xAx[xAx.length - 1];

  for (i = 0; i < axles.length; i++) {
    isoTractorCreateWheelArchSet(
      grp,
      THREE,
      axles[i].x,
      bodyWid,
      mats.trim,
      mats.rubber,
      mats.grille,
      true,
      tractorTyreOpts,
    );
    isoTractorCreateWheelArchSet(
      grp,
      THREE,
      axles[i].x,
      bodyWid,
      mats.trim,
      mats.rubber,
      mats.grille,
      false,
      tractorTyreOpts,
    );
  }
  isoTractorCreateSideSkirts(
    grp,
    THREE,
    mats.trim,
    mats.darkPlastic,
    xFirst + 0.15,
    xLast - 0.15,
    bodyWid,
    cabFloorY,
    tractorTyreOpts,
  );
  if (xAx.length >= 2) {
    isoTractorCreateFuelTanks(
      grp,
      THREE,
      mats.brushed,
      mats.chrome,
      mats.darkPlastic,
      xAx[0] + 0.2,
      xAx[1] - 0.2,
      bodyWid,
      cabFloorY,
      tractorTyreOpts,
    );
  }

  /* Lower-cab chrome strip — thin polished bar along the bottom edge of the
   * cab body, just above the side skirt top. Pairs visually with the
   * window beltline chrome added in Phase 3 — together they bracket the
   * door panel top and bottom with chrome lines. */
  var lowerChromeY = cabFloorY + 0.05;
  var lowerChromeX0 = cabBaseCenterX - mainCabL * 0.46;
  var lowerChromeX1 = cabBaseCenterX + mainCabL * 0.46;
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    mats.chrome,
    lowerChromeX0,
    lowerChromeX1,
    lowerChromeY - 0.011,
    lowerChromeY + 0.011,
    0.044,
    0.024,
  );
  isoTractorCreateSeamStrip(
    grp,
    THREE,
    mats.chrome,
    lowerChromeX0,
    lowerChromeX1,
    lowerChromeY - 0.011,
    lowerChromeY + 0.011,
    bodyWid - 0.044,
    0.024,
  );

  /* Chrome trim strip under the existing sun visor — kisses the windshield
   * top from outside. Sized to match the visor's Z width with a small inset
   * so the existing visor (mats.trim) appears to sit on top of this chrome
   * accent edge. */
  isoTractorAddMesh(
    grp,
    THREE,
    new THREE.BoxGeometry(0.06, 0.022, bodyWid * gb.widthZFrac * 0.96),
    mats.chrome,
    cabFrontX - 0.052,
    gb.topY + 0.031,
    bodyWid * 0.5,
    0,
    0,
    -0.055,
    false,
  );

  isoTractorCreateMirrorAssemblies(
    grp,
    THREE,
    mats.trim,
    mats.glass,
    doorFrontX - 0.048,
    cabFloorY + mainCabH * 0.578,
    bodyWid,
    mats.chrome,
  );
  isoTractorCreateExhaustStacks(
    grp,
    THREE,
    mats.trim,
    mats.chrome,
    sleeperCenterX + sleeperL * 0.35,
    cabFloorY + sleeperH - 0.2,
    bodyWid,
    cabFloorY + mainCabH + 0.55,
    st.exhaustStacks,
    st.stackHeightMul,
  );

  var plateX = xOffset + bodyLen - 0.72;
  isoTractorCreateFifthWheel(
    grp,
    THREE,
    mats.trim,
    mats.chrome,
    plateX,
    cabFloorY,
    bodyWid,
  );

  isoTractorAddCabMicroDetails(grp, THREE, mats, {
    bodyWid: bodyWid,
    cabFloorY: cabFloorY,
    mainCabH: mainCabH,
    wsX: gb.wsCenterX,
    windshieldTilt: gb.tiltRad,
    cabBaseCenterX: cabBaseCenterX,
    mainCabL: mainCabL,
    noseTipX: noseTipX,
    xRearAxle: xLast,
    sleeperCenterX: sleeperCenterX,
    sleeperL: sleeperL,
    sleeperH: sleeperH,
  });

  isoTractorAddIndustrialDetails(grp, THREE, mats, {
    bodyWid: bodyWid,
    cabFloorY: cabFloorY,
    xRearAxle: xLast,
    xFirstAxle: xFirst,
    xOffset: xOffset,
    bodyLen: bodyLen,
  });

  placeAxleWheels(
    THREE,
    grp,
    axles,
    bodyWid,
    mats.rubber,
    tractorTyreOpts,
    mats.rimSteel,
    -WHEEL_RADIUS_M * 2 * st.tyreRadiusMul - 0.02,
  );

  /* Laterally centre the horse on the trailer deck. Caller passes the trailer's
   * z-width via opts.bedWidth; fallback computes from the assembled group. */
  var targetWidth = opts.bedWidth;
  if (!(targetWidth > 0)) {
    var boxF = new THREE.Box3().setFromObject(grp);
    targetWidth = boxF.max.z - boxF.min.z;
  }
  if (targetWidth > 0) {
    var box = new THREE.Box3().setFromObject(grp);
    var midZ = (box.min.z + box.max.z) / 2;
    /* Safety net — the horse body spans 0…bodyWid in local Z, so a healthy
     * bounding box should be centred near bodyWid/2. If a future change adds
     * an asymmetric mesh (e.g. another CylinderGeometry arc with the wrong
     * theta range — see the windshield notes above), this warning fires
     * BEFORE the visible offset confuses the user. */
    var bodyCenter = bodyWid / 2;
    if (Math.abs(midZ - bodyCenter) > 0.5) {
      console.warn(
        "[isoTractor] horse bbox midZ deviates from bodyWid/2 by " +
          (midZ - bodyCenter).toFixed(3) +
          " m — asymmetric mesh likely",
        {
          truckLayoutKey: layoutKey,
          horseLayoutKey: horseLayoutKey,
          bboxMinZ: +box.min.z.toFixed(3),
          bboxMaxZ: +box.max.z.toFixed(3),
          bodyWid: bodyWid,
        },
      );
    }
    grp.position.z = targetWidth / 2 - midZ;
  }

  parent.add(grp);
}
