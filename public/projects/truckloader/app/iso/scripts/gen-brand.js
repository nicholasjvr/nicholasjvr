const fs = require("fs");
const path = require("path");

const b64Path = path.join(__dirname, "../assets/milltrans-logo.b64.txt");
const outPath = path.join(__dirname, "../brand.js");
const dataUri = fs.readFileSync(b64Path, "utf8").trim();

const brandJs = `// app/iso/brand.js
// Milltrans fleet branding — palette, embedded logo, canvas livery textures, decal planes.
// Single-client hardcoded livery; fleet number comes from truck data at runtime.

/** Milltrans fleet colour palette (hex numbers for Three.js materials). */
export const MILLTRANS = {
  paintHex: 0xeef0f2,
  accentRed: 0xc01818,
  accentGrey: 0x8a929a,
  pinstripe: 0xb9952f,
  name: "MILLTRANS",
};

/** Embedded PNG logo — no external hosting required inside Zoho iframe. */
export const MILLTRANS_BADGE_DATAURI = ${JSON.stringify(dataUri)};

var _badgeTextureCache = null;
var _textureCache = {};

function _hexToCss(hex) {
  var h = (hex >>> 0).toString(16).padStart(6, "0");
  return "#" + h;
}

/** Knock near-black background pixels to transparent for decal use. */
function _knockoutBlackBackground(ctx, w, h, threshold) {
  threshold = threshold != null ? threshold : 28;
  var img = ctx.getImageData(0, 0, w, h);
  var d = img.data;
  for (var i = 0; i < d.length; i += 4) {
    if (d[i] <= threshold && d[i + 1] <= threshold && d[i + 2] <= threshold) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Load the embedded M-badge PNG into a cached CanvasTexture with transparent bg.
 */
export function buildBadgeTexture(THREE) {
  if (_badgeTextureCache) return Promise.resolve(_badgeTextureCache);
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() {
      var maxW = 512;
      var scale = Math.min(1, maxW / Math.max(img.width, img.height));
      var w = Math.max(1, Math.round(img.width * scale));
      var h = Math.max(1, Math.round(img.height * scale));
      var c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      var ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      _knockoutBlackBackground(ctx, w, h, 32);
      var tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      _badgeTextureCache = tex;
      resolve(tex);
    };
    img.onerror = function(err) { reject(err || new Error("Milltrans badge failed to load")); };
    img.src = MILLTRANS_BADGE_DATAURI;
  });
}

/** Synchronous badge texture if image was preloaded; otherwise null. */
export function getCachedBadgeTexture() {
  return _badgeTextureCache;
}

function _drawCabSwoosh(ctx, w, h) {
  var red = _hexToCss(MILLTRANS.accentRed);
  var grey = _hexToCss(MILLTRANS.accentGrey);
  var gold = _hexToCss(MILLTRANS.pinstripe);

  ctx.fillStyle = _hexToCss(MILLTRANS.paintHex);
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  ctx.bezierCurveTo(w * 0.18, h * 0.58, w * 0.42, h * 0.48, w * 0.95, h * 0.38);
  ctx.lineTo(w, h * 0.52);
  ctx.bezierCurveTo(w * 0.40, h * 0.62, w * 0.15, h * 0.78, 0, h * 0.88);
  ctx.closePath();
  ctx.fillStyle = red;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, h * 0.78);
  ctx.bezierCurveTo(w * 0.20, h * 0.68, w * 0.45, h * 0.58, w * 0.92, h * 0.50);
  ctx.lineTo(w, h * 0.58);
  ctx.bezierCurveTo(w * 0.38, h * 0.68, w * 0.12, h * 0.86, 0, h * 0.94);
  ctx.closePath();
  ctx.fillStyle = grey;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, h * 0.84);
  ctx.lineTo(w * 0.88, h * 0.62);
  ctx.lineWidth = Math.max(2, h * 0.012);
  ctx.strokeStyle = gold;
  ctx.stroke();
  ctx.restore();
}

function _drawFleetNumber(ctx, w, h, fleetNumber) {
  var label = String(fleetNumber || "").trim();
  if (!label) return;
  ctx.save();
  ctx.fillStyle = "#1a1f24";
  ctx.font = "bold " + Math.round(h * 0.11) + "px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(label, w * 0.06, h * 0.34);
  ctx.restore();
}

/**
 * Canvas texture for cab-side livery band (swoosh + optional fleet number).
 */
export function buildCabSideLiveryTexture(THREE, opts) {
  opts = opts || {};
  var fleetNumber = opts.fleetNumber || "";
  var cacheKey = "cab|" + fleetNumber;
  if (_textureCache[cacheKey]) return _textureCache[cacheKey];

  var w = 512;
  var h = 256;
  var c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  var ctx = c.getContext("2d");
  _drawCabSwoosh(ctx, w, h);
  _drawFleetNumber(ctx, w, h, fleetNumber);

  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  _textureCache[cacheKey] = tex;
  return tex;
}

/** Trailer side band — MILLTRANS wordmark + red accent stripe. */
export function buildTrailerSideBandTexture(THREE) {
  var cacheKey = "trailer-band";
  if (_textureCache[cacheKey]) return _textureCache[cacheKey];

  var w = 1024;
  var h = 128;
  var c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  var ctx = c.getContext("2d");

  ctx.fillStyle = _hexToCss(MILLTRANS.accentRed);
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold " + Math.round(h * 0.52) + "px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(MILLTRANS.name, w * 0.52, h * 0.52);

  ctx.fillStyle = _hexToCss(MILLTRANS.accentGrey);
  ctx.fillRect(0, h * 0.82, w, h * 0.18);

  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  _textureCache[cacheKey] = tex;
  return tex;
}

/**
 * Thin transparent decal plane — sits slightly proud of cab/trailer surface.
 */
export function makeDecalPlane(THREE, texture, widthM, heightM, opts) {
  opts = opts || {};
  var mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  var mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, heightM), mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  if (opts.renderOrder != null) mesh.renderOrder = opts.renderOrder;
  return mesh;
}

/** Preload badge texture — call once during scene build. */
export function preloadBrandTextures(THREE) {
  return buildBadgeTexture(THREE);
}

/**
 * Attach cab-side branding decals to tractor group.
 */
export function addCabBrandingDecals(THREE, grp, ctx) {
  ctx = ctx || {};
  var bodyWid = ctx.bodyWid;
  var cabBaseCenterX = ctx.cabBaseCenterX;
  var mainCabL = ctx.mainCabL;
  var mainCabH = ctx.mainCabH;
  var cabFloorY = ctx.cabFloorY;
  var fleetNumber = ctx.fleetNumber || "";

  if (!(bodyWid > 0) || !(mainCabL > 0)) return;

  var liveryTex = buildCabSideLiveryTexture(THREE, { fleetNumber: fleetNumber });
  var liveryW = mainCabL * 0.92;
  var liveryH = mainCabH * 0.38;
  var liveryY = cabFloorY + mainCabH * 0.18;
  var liveryX = cabBaseCenterX + mainCabL * 0.02;
  var offset = 0.028;

  var sides = [
    { z: offset, ry: 0 },
    { z: bodyWid - offset, ry: Math.PI },
  ];
  sides.forEach(function(side) {
    var plane = makeDecalPlane(THREE, liveryTex, liveryW, liveryH, { renderOrder: 2 });
    plane.position.set(liveryX, liveryY, side.z);
    plane.rotation.y = side.ry;
    grp.add(plane);
  });

  var badgeTex = getCachedBadgeTexture();
  if (badgeTex) {
    var badgeW = mainCabL * 0.22;
    var badgeH = badgeW * 0.72;
    var badgeX = cabBaseCenterX - mainCabL * 0.08;
    var badgeY = cabFloorY + mainCabH * 0.62;
    sides.forEach(function(side) {
      var badge = makeDecalPlane(THREE, badgeTex, badgeW, badgeH, { renderOrder: 3 });
      badge.position.set(badgeX, badgeY, side.z);
      badge.rotation.y = side.ry;
      grp.add(badge);
    });
  }
}

/** Low trailer side branding band below deck level. */
export function addTrailerBrandingDecals(THREE, parent, seg, bed, badgeTex) {
  var bandTex = buildTrailerSideBandTexture(THREE);
  var segLen = Math.max(0.01, seg.x1 - seg.x0);
  var segCx = (seg.x0 + seg.x1) * 0.5;
  var bandH = 0.22;
  var bandY = -0.02;
  var offset = 0.045;

  var band = makeDecalPlane(THREE, bandTex, segLen * 0.94, bandH, { renderOrder: 1, doubleSide: true });
  band.position.set(segCx, bandY, bed.width + offset);
  band.rotation.y = 0;
  parent.add(band);

  var bandL = band.clone();
  bandL.position.set(segCx, bandY, -offset);
  bandL.rotation.y = Math.PI;
  parent.add(bandL);

  if (badgeTex) {
    var badgeW = Math.min(0.55, segLen * 0.14);
    var badgeH = badgeW * 0.72;
    var badge = makeDecalPlane(THREE, badgeTex, badgeW, badgeH, { renderOrder: 2 });
    badge.position.set(seg.x1 - badgeW * 0.65, bandY + bandH * 0.55, bed.width + offset + 0.01);
    parent.add(badge);
    var badgeL = badge.clone();
    badgeL.position.set(seg.x0 + badgeW * 0.65, bandY + bandH * 0.55, -offset - 0.01);
    badgeL.rotation.y = Math.PI;
    parent.add(badgeL);
  }
}
`;

fs.writeFileSync(outPath, brandJs);
console.log("Wrote", outPath, brandJs.length, "chars");
