// app/iso/loadMeshes.js
// Three.js builders for distinct cargo silhouettes per load type. Each builder
// returns a Group with bottom-origin (y = 0 at deck level), so callers position
// with `.position.set(x, block.z, y)` — no half-height offset needed.
//
// All textures are canvas-generated and cached by colour key, so N blocks of
// the same type share the same texture instances. No external assets.
//
// Public API:
//   buildLoadMesh(THREE, block, sc)   → THREE.Group (root for one placed load)
//   disposeLoadMeshTextureCache()     → free cached canvas textures on teardown
//
// Material profiles match the original scene.js intent (containers = painted
// steel, pallets = wood/cardboard, bags = matte cloth, equipment = industrial).

// ── PALETTE ──────────────────────────────────────────────────────────────────

/** Per-load-type colours. Each entry exposes the tones consumed by the
 *  builders below. Extend here when adding a new load type. */
export const ISO_LOAD_COLORS = {
  pallets: {
    base: "#00acc1", // wrapped cargo top
    baseDark: "#00838f", // wrapped cargo sides
    strap: "#37474f", // cross-strap bands
    pallet: "#a1652b", // wood pallet body
    palletDark: "#6e4317", // pallet shadow / opening rails
  },
  containers: {
    base: "#f57c00", // body
    baseDark: "#bf360c", // side shadow band in corrugation
    frame: "#5d4037", // top/bottom frame + corner posts
    door: "#e65100", // door panel (slightly different hue)
    doorDark: "#8d2c00", // door divider/hinges
  },
  bags: {
    base: "#78c988", // bag body (cleaner soft green)
    baseDark: "#4c9960", // stitched panel shadow
    strap: "#263238", // webbing / loops
    spout: "#eceff1", // fill spout
  },
  equipment: {
    tracks: "#212121", // tracks / wheel band
    body: "#fbc02d", // main machinery body (construction yellow)
    bodyDark: "#a37800", // shadow / edge tone
    cab: "#37474f", // cab body
    glass: "#90a4ae", // cab windows
  },
};

// ── TEXTURE CACHE ────────────────────────────────────────────────────────────

var _texCache = new Map();

export function disposeLoadMeshTextureCache() {
  _texCache.forEach(function (tex) {
    if (tex && tex.dispose) tex.dispose();
  });
  _texCache.clear();
}

function _cachedTex(key, THREE, draw) {
  if (_texCache.has(key)) return _texCache.get(key);
  var c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  var g = c.getContext("2d");
  draw(g, c.width, c.height);
  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  _texCache.set(key, tex);
  return tex;
}

// ── DISPATCHER ───────────────────────────────────────────────────────────────

/**
 * Build a load mesh for a placed block.
 * Returns a Group with bottom-origin; caller positions it with
 *   group.position.set(x0 + L/2, block.z, y0 + Wd/2)
 *
 * @param {object} THREE Three.js module
 * @param {object} block Placed block: { w, h, height, loadType, ... }
 * @param {number} sc    Pixel→metre scale (block.w / sc = length in metres)
 * @returns {object}     THREE.Group
 */
export function buildLoadMesh(THREE, block, sc) {
  var L = block.w / sc;
  var Wd = block.h / sc;
  var H = block.height || 0.3;
  var type = block.loadType;

  var group;
  switch (type) {
    case "containers":
      group = buildContainerMesh(THREE, L, H, Wd);
      break;
    case "bags":
      group = buildBagMesh(THREE, L, H, Wd);
      break;
    case "equipment":
      group = buildEquipmentMesh(THREE, L, H, Wd);
      break;
    case "pallets":
    default:
      group = buildPalletMesh(THREE, L, H, Wd);
      break;
  }

  // Shadows on every mesh inside the group.
  group.traverse(function (obj) {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}

// ── CONTAINER ────────────────────────────────────────────────────────────────

/** Shipping-container silhouette: corrugated body, top/bottom frame band,
 *  4 corner posts, darker door panel on the -X end. */
function buildContainerMesh(THREE, L, H, Wd) {
  var c = ISO_LOAD_COLORS.containers;
  var g = new THREE.Group();

  var frameT = Math.min(0.06, H * 0.06); // frame thickness
  var postT = Math.min(0.06, Math.min(L, Wd) * 0.04);

  // Body (slightly inset to leave room for frame/posts visually).
  var bodyL = L - postT * 1.2;
  var bodyW = Wd - postT * 1.2;
  var bodyH = H - frameT * 2;

  var sideTex = _cachedTex(
    "container-side-" + c.base,
    THREE,
    function (ctx, w, h) {
      ctx.fillStyle = c.base;
      ctx.fillRect(0, 0, w, h);
      // Vertical corrugation lines.
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = 2;
      for (var x = 8; x < w; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    },
  );
  // Repeat along the side length so corrugation density stays constant.
  var sideTexL = sideTex.clone();
  sideTexL.needsUpdate = true;
  sideTexL.repeat.set(Math.max(1, Math.round(L / 1.2)), 1);

  var sideTexW = sideTex.clone();
  sideTexW.needsUpdate = true;
  sideTexW.repeat.set(Math.max(1, Math.round(Wd / 1.2)), 1);

  var doorTex = _cachedTex(
    "container-door-" + c.door,
    THREE,
    function (ctx, w, h) {
      ctx.fillStyle = c.door;
      ctx.fillRect(0, 0, w, h);
      // Vertical centre divider (two doors).
      ctx.fillStyle = c.doorDark;
      ctx.fillRect(w / 2 - 2, 0, 4, h);
      // 4 hinge marks.
      [0.18, 0.42, 0.58, 0.82].forEach(function (yf) {
        ctx.fillRect(w / 2 - 8, h * yf - 3, 16, 6);
      });
      // Door panel inner border.
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, w - 16, h - 16);
    },
  );

  // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z.
  // We treat -X as the door end. Sides (+Z/-Z) get the long-axis corrugation;
  // ends (+X/-X door) use door texture; top/bottom plain.
  var bodyGeom = new THREE.BoxGeometry(bodyL, bodyH, bodyW);
  var mkMat = function (mapTex, color) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      map: mapTex || null,
      metalness: 0.35,
      roughness: 0.55,
    });
  };
  var body = new THREE.Mesh(bodyGeom, [
    mkMat(null, c.base), // +X far end (cap, plain panel)
    mkMat(doorTex, c.door), // -X door end
    mkMat(null, c.base), // +Y top
    mkMat(null, c.baseDark), // -Y bottom (rarely seen, darker)
    mkMat(sideTexL, c.base), // +Z side
    mkMat(sideTexL, c.base), // -Z side
  ]);
  body.position.set(0, frameT + bodyH / 2, 0);
  g.add(body);

  // Top and bottom frame bands (thin boxes wrapping the perimeter would need
  // 4 each; for MVP we use 2 stacked flat plates that read as a frame).
  var frameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(c.frame),
    metalness: 0.5,
    roughness: 0.5,
  });
  var topFrame = new THREE.Mesh(new THREE.BoxGeometry(L, frameT, Wd), frameMat);
  topFrame.position.set(0, H - frameT / 2, 0);
  g.add(topFrame);

  var botFrame = new THREE.Mesh(new THREE.BoxGeometry(L, frameT, Wd), frameMat);
  botFrame.position.set(0, frameT / 2, 0);
  g.add(botFrame);

  // 4 corner posts.
  var postGeom = new THREE.BoxGeometry(postT, H, postT);
  [
    [-(L / 2 - postT / 2), -(Wd / 2 - postT / 2)],
    [+(L / 2 - postT / 2), -(Wd / 2 - postT / 2)],
    [-(L / 2 - postT / 2), +(Wd / 2 - postT / 2)],
    [+(L / 2 - postT / 2), +(Wd / 2 - postT / 2)],
  ].forEach(function (xy) {
    var post = new THREE.Mesh(postGeom, frameMat);
    post.position.set(xy[0], H / 2, xy[1]);
    g.add(post);
  });

  // ISO corner castings — chunky dark blocks at all 8 corners (the cast steel
  // fittings real containers are lifted/twist-locked by).
  var castMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#2b2b2b"),
    metalness: 0.6,
    roughness: 0.45,
  });
  var castS = Math.min(0.14, Math.min(L, Wd) * 0.09);
  var castGeom = new THREE.BoxGeometry(castS, castS, castS);
  [-1, 1].forEach(function (sx) {
    [-1, 1].forEach(function (sz) {
      [castS / 2, H - castS / 2].forEach(function (yy) {
        var cc = new THREE.Mesh(castGeom, castMat);
        cc.position.set(
          sx * (L / 2 - castS / 2),
          yy,
          sz * (Wd / 2 - castS / 2),
        );
        g.add(cc);
      });
    });
  });

  // Door hardware — 2 vertical locking bars + handle nubs on the -X door end.
  var barMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#d9d9d9"),
    metalness: 0.7,
    roughness: 0.35,
  });
  var barR = Math.min(0.03, Wd * 0.022);
  [-1, 1].forEach(function (sz) {
    var bar = new THREE.Mesh(
      new THREE.CylinderGeometry(barR, barR, H * 0.82, 8),
      barMat,
    );
    bar.position.set(-L / 2 + barR * 1.6, H * 0.5, sz * Wd * 0.22);
    g.add(bar);
    // Handle lever halfway up each bar.
    var lever = new THREE.Mesh(
      new THREE.BoxGeometry(barR * 4.5, barR * 1.4, barR * 1.4),
      barMat,
    );
    lever.position.set(-L / 2 + barR * 3.2, H * 0.5, sz * Wd * 0.22);
    g.add(lever);
  });

  return g;
}

// ── PALLET ───────────────────────────────────────────────────────────────────

/** Wooden pallet base with shrink-wrapped cargo above. */
function buildPalletMesh(THREE, L, H, Wd) {
  var c = ISO_LOAD_COLORS.pallets;
  var g = new THREE.Group();

  // Pallet sits at bottom 12% of height (with a floor of 0.10m so it doesn't
  // vanish on very short loads).
  var palletH = Math.min(0.18, Math.max(0.1, H * 0.12));
  var cargoH = H - palletH;

  var woodTex = _cachedTex(
    "pallet-wood-" + c.pallet,
    THREE,
    function (ctx, w, h) {
      ctx.fillStyle = c.pallet;
      ctx.fillRect(0, 0, w, h);
      // Horizontal plank lines.
      ctx.strokeStyle = "rgba(0,0,0,0.32)";
      ctx.lineWidth = 2;
      for (var y = 10; y < h; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // Wood-grain hint.
      ctx.strokeStyle = "rgba(0,0,0,0.10)";
      ctx.lineWidth = 1;
      for (var i = 0; i < 12; i++) {
        var yy = Math.random() * h;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(w, yy + (Math.random() - 0.5) * 4);
        ctx.stroke();
      }
    },
  );

  var palletMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(c.pallet),
    map: woodTex,
    metalness: 0.0,
    roughness: 0.85,
  });
  var pallet = new THREE.Mesh(new THREE.BoxGeometry(L, palletH, Wd), palletMat);
  pallet.position.set(0, palletH / 2, 0);
  g.add(pallet);

  // Forklift opening hint: 2 thin dark notches on the long sides.
  var notchMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(c.palletDark),
    metalness: 0.0,
    roughness: 0.9,
  });
  var notchH = palletH * 0.45;
  var notchT = 0.02;
  [-1, 1].forEach(function (side) {
    var notch = new THREE.Mesh(
      new THREE.BoxGeometry(L * 0.92, notchH, notchT),
      notchMat,
    );
    notch.position.set(0, palletH * 0.5, (Wd / 2) * side);
    g.add(notch);
  });

  // Cargo block (slightly inset so the pallet edge is visible from above).
  var cargoL = L * 0.96;
  var cargoW = Wd * 0.96;
  var cargoMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(c.base),
    metalness: 0.05,
    roughness: 0.78,
    transparent: true,
    opacity: 0.92, // hint of shrink-wrap translucency
  });
  var cargo = new THREE.Mesh(
    new THREE.BoxGeometry(cargoL, cargoH, cargoW),
    cargoMat,
  );
  cargo.position.set(0, palletH + cargoH / 2, 0);
  g.add(cargo);

  // Cargo edges (so the box reads sharply against backdrop).
  var edges = new THREE.EdgesGeometry(cargo.geometry);
  var edgeMat = new THREE.LineBasicMaterial({
    color: 0x263238,
    transparent: true,
    opacity: 0.4,
  });
  var edgeLines = new THREE.LineSegments(edges, edgeMat);
  cargo.add(edgeLines);

  // 3 horizontal cross-strap bands (thin dark rings around the cargo).
  var strapMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(c.strap),
    metalness: 0.0,
    roughness: 0.7,
  });
  var strapT = 0.028;
  [0.25, 0.5, 0.78].forEach(function (yf) {
    var sx = new THREE.Mesh(
      new THREE.BoxGeometry(cargoL + 0.012, strapT, cargoW + 0.012),
      strapMat,
    );
    sx.position.set(0, palletH + cargoH * yf, 0);
    g.add(sx);
  });

  // Cardboard edge protectors on the 4 vertical cargo corners — keeps the
  // wrapped stack reading as a real palletised load, not a plain box.
  var protMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#cfa14a"),
    metalness: 0.0,
    roughness: 0.85,
  });
  var protT = Math.min(0.05, Math.min(cargoL, cargoW) * 0.06);
  var protGeom = new THREE.BoxGeometry(protT, cargoH * 0.94, protT);
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].forEach(function (cn) {
    var p = new THREE.Mesh(protGeom, protMat);
    p.position.set(
      cn[0] * (cargoL / 2 - protT / 2),
      palletH + cargoH * 0.5,
      cn[1] * (cargoW / 2 - protT / 2),
    );
    g.add(p);
  });

  return g;
}

// ── 1 TON BAG (FIBC) ─────────────────────────────────────────────────────────

/** Slumped bulk-bag silhouette via LatheGeometry — bulges at the middle,
 *  cinches at the neck, with 4 corner lift loops and a fill spout. */
function buildBagMesh(THREE, L, H, Wd) {
  var c = ISO_LOAD_COLORS.bags;
  var g = new THREE.Group();

  var fabricTex = _cachedTex(
    "bag-fabric-" + c.base + "-" + c.baseDark,
    THREE,
    function (ctx, w, h) {
      ctx.fillStyle = c.base;
      ctx.fillRect(0, 0, w, h);
      // Woven-fabric feel: soft vertical weave + subtle horizontal stitching.
      ctx.strokeStyle = "rgba(0,0,0,0.11)";
      ctx.lineWidth = 1;
      for (var x = 3; x < w; x += 7) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      for (var y = 5; y < h; y += 9) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(0,0,0,0.09)";
      ctx.fillRect(0, h * 0.78, w, h * 0.22);
    },
  );

  // Squat super-sack profile: wider body and flatter sides so it reads as a
  // filled FIBC, not a spherical blob.
  var profile = [
    [0.46, 0.0],
    [0.51, 0.05],
    [0.54, 0.2],
    [0.53, 0.52],
    [0.5, 0.8],
    [0.45, 0.93],
    [0.39, 0.98],
    [0.39, 1.0],
  ];
  var pts = profile.map(function (p) {
    return new THREE.Vector2(p[0], p[1]);
  });
  var bagGeom = new THREE.LatheGeometry(pts, 30);

  var bagMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(c.base),
    map: fabricTex,
    metalness: 0.0,
    roughness: 0.96,
  });
  var bag = new THREE.Mesh(bagGeom, bagMat);
  var bagRX = L * 0.5;
  var bagRZ = Wd * 0.5;
  bag.scale.set(bagRX, H, bagRZ);
  bag.position.set(0, 0, 0);
  g.add(bag);

  // Vertical webbing strips — key silhouette cue for real FIBC bags.
  var seamMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(c.strap),
    metalness: 0.0,
    roughness: 0.84,
  });
  var seamW = Math.min(L, Wd) * 0.1;
  var seamT = Math.min(L, Wd) * 0.02;
  var seamGeom = new THREE.BoxGeometry(seamW, H * 0.9, seamT);
  var seamInsetX = L * 0.32;
  var seamInsetZ = Wd * 0.32;
  [
    { x: -seamInsetX, z: -seamInsetZ },
    { x: seamInsetX, z: -seamInsetZ },
    { x: -seamInsetX, z: seamInsetZ },
    { x: seamInsetX, z: seamInsetZ },
  ].forEach(function (p) {
    var seam = new THREE.Mesh(seamGeom, seamMat);
    seam.position.set(p.x, H * 0.5, p.z);
    seam.lookAt(0, H * 0.5, 0);
    g.add(seam);
  });

  // Top fill neck/spout.
  var spoutR = Math.min(L, Wd) * 0.11;
  var spoutH = H * 0.14;
  var spoutGeom = new THREE.CylinderGeometry(spoutR, spoutR * 1.15, spoutH, 14);
  var spoutMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(c.spout),
    metalness: 0.0,
    roughness: 0.6,
  });
  var spout = new THREE.Mesh(spoutGeom, spoutMat);
  spout.position.set(0, H - spoutH / 2, 0);
  g.add(spout);
  var neckBand = new THREE.Mesh(
    new THREE.TorusGeometry(spoutR * 1.04, spoutR * 0.12, 8, 16),
    seamMat,
  );
  neckBand.rotation.x = Math.PI / 2;
  neckBand.position.set(0, H - spoutH, 0);
  g.add(neckBand);

  // Corner lift loops.
  var loopMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(c.strap),
    metalness: 0.0,
    roughness: 0.72,
  });
  var loopR = Math.min(L, Wd) * 0.085;
  var loopT = loopR * 0.17;
  var loopGeom = new THREE.TorusGeometry(loopR, loopT, 10, 18, Math.PI * 1.1);
  var inset = Math.min(L, Wd) * 0.16;
  var corners = [
    { x: -(L / 2 - inset), z: -(Wd / 2 - inset) },
    { x: +(L / 2 - inset), z: -(Wd / 2 - inset) },
    { x: -(L / 2 - inset), z: +(Wd / 2 - inset) },
    { x: +(L / 2 - inset), z: +(Wd / 2 - inset) },
  ];
  corners.forEach(function (p) {
    var loop = new THREE.Mesh(loopGeom, loopMat);
    loop.position.set(p.x, H - loopR * 0.18, p.z);
    loop.rotation.x = Math.PI / 2;
    var angle = Math.atan2(p.z, p.x);
    loop.rotation.y = -angle + Math.PI / 2;
    g.add(loop);
  });

  return g;
}

// ── EQUIPMENT ────────────────────────────────────────────────────────────────

/** Generic industrial-machinery silhouette: dark tracks band, main body,
 *  offset cab. Reads as "machine" without committing to a specific shape. */
function buildEquipmentMesh(THREE, L, H, Wd) {
  var c = ISO_LOAD_COLORS.equipment;
  var g = new THREE.Group();

  var trackH = Math.min(0.45, H * 0.25);
  var bodyH = H * 0.55;
  var cabH = H - trackH - bodyH;

  // Tracks band — sits on the deck, two parallel rails with thin gap.
  var trackMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(c.tracks),
    metalness: 0.2,
    roughness: 0.85,
  });
  var trackW = Wd * 0.42;
  var trackGap = Wd - trackW * 2;
  [-1, 1].forEach(function (side) {
    var t = new THREE.Mesh(
      new THREE.BoxGeometry(L * 0.96, trackH, trackW),
      trackMat,
    );
    t.position.set(0, trackH / 2, side * (trackW / 2 + trackGap / 2));
    g.add(t);

    // Wheel/sprocket hint — 3 thin dark cylinders peeking out the side.
    var wheelR = trackH * 0.32;
    var wheelGeom = new THREE.CylinderGeometry(
      wheelR,
      wheelR,
      trackW * 1.04,
      10,
    );
    var wheelMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.3,
      roughness: 0.6,
    });
    [-1, 0, 1].forEach(function (xf) {
      var w = new THREE.Mesh(wheelGeom, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(
        L * 0.32 * xf,
        trackH * 0.45,
        side * (trackW / 2 + trackGap / 2),
      );
      g.add(w);
    });
  });

  // Main body — inset slightly so the tracks proud.
  var bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(c.body),
    metalness: 0.25,
    roughness: 0.6,
  });
  var bodyL = L * 0.86;
  var bodyW = Wd * 0.88;
  var body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyL, bodyH, bodyW),
    bodyMat,
  );
  body.position.set(0, trackH + bodyH / 2, 0);
  g.add(body);

  // Body edge lines for definition.
  var bEdges = new THREE.EdgesGeometry(body.geometry);
  var bEdgeMat = new THREE.LineBasicMaterial({
    color: 0x1c1c1c,
    transparent: true,
    opacity: 0.4,
  });
  body.add(new THREE.LineSegments(bEdges, bEdgeMat));

  // Cab — smaller, offset to one end (the "operator station" silhouette).
  if (cabH > 0.08) {
    var cabMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(c.cab),
      metalness: 0.25,
      roughness: 0.55,
    });
    var cabL = L * 0.32;
    var cabW = Wd * 0.55;
    var cab = new THREE.Mesh(new THREE.BoxGeometry(cabL, cabH, cabW), cabMat);
    // Push cab toward +X end.
    var cabX = (bodyL - cabL) / 2 - L * 0.04;
    cab.position.set(cabX, trackH + bodyH + cabH / 2, 0);
    g.add(cab);

    // Window strip — slightly lighter plane embedded in the front face.
    var winMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(c.glass),
      metalness: 0.4,
      roughness: 0.2,
      transparent: true,
      opacity: 0.7,
    });
    var win = new THREE.Mesh(
      new THREE.PlaneGeometry(cabL * 0.85, cabH * 0.55),
      winMat,
    );
    win.position.set(cabX, trackH + bodyH + cabH * 0.55, cabW / 2 + 0.001);
    g.add(win);
  }

  return g;
}
