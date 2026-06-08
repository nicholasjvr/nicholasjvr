// Procedural "evil smiley" neon orb rendered with Three.js.
// Uses OrbitControls (three/addons) for a slow auto-orbit plus optional drag.
// NOTE: This is the Three.js OrbitControls addon, not the unrelated `orbital.js`
// webpack plugin. The scene is intentionally lightweight: one emissive sphere
// plus a few dark "cut-out" face features so it reads as a menacing grin.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface EvilOrbHandle {
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

const NEON_PINK = 0xff0087;
const NEON_PINK_DEEP = 0xff00aa;
const NEON_CYAN = 0x00f7ff;

export function initEvilOrb(container: HTMLElement): EvilOrbHandle {
  const width = container.clientWidth || 320;
  const height = container.clientHeight || 280;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, 0, 5.4);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  // --- The orb -------------------------------------------------------------
  const orb = new THREE.Group();
  scene.add(orb);

  const sphereGeo = new THREE.SphereGeometry(1.6, 64, 64);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: NEON_PINK,
    emissive: NEON_PINK_DEEP,
    emissiveIntensity: 0.85,
    roughness: 0.25,
    metalness: 0.1,
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  orb.add(sphere);

  // Faint inner glow shell (additive) for the neon bloom feel.
  const glowGeo = new THREE.SphereGeometry(1.78, 48, 48);
  const glowMat = new THREE.MeshBasicMaterial({
    color: NEON_PINK,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  });
  orb.add(new THREE.Mesh(glowGeo, glowMat));

  // --- Face features (dark cut-out look) -----------------------------------
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0x14060f,
    emissive: 0x2a0014,
    emissiveIntensity: 0.4,
    roughness: 0.5,
    metalness: 0,
  });

  const face = new THREE.Group();
  // Push features slightly forward so they sit on the sphere's front.
  face.position.z = 0.05;
  orb.add(face);

  // Evil slanted eyes: flattened, angled inward like an angry brow.
  const eyeGeo = new THREE.CapsuleGeometry(0.12, 0.42, 6, 12);
  const makeEye = (x: number, slant: number) => {
    const eye = new THREE.Mesh(eyeGeo, faceMat);
    eye.position.set(x, 0.5, 1.45);
    eye.rotation.z = slant;
    eye.scale.set(1, 0.62, 0.6);
    return eye;
  };
  face.add(makeEye(-0.55, -0.85));
  face.add(makeEye(0.55, 0.85));

  // Wide menacing grin from a partial torus arc (open upward = smile).
  const mouthGeo = new THREE.TorusGeometry(0.72, 0.13, 16, 48, Math.PI);
  const mouth = new THREE.Mesh(mouthGeo, faceMat);
  mouth.position.set(0, -0.18, 1.4);
  mouth.rotation.z = Math.PI; // flip so the arc curves like a smile
  mouth.scale.set(1, 0.85, 0.6);
  face.add(mouth);

  // --- Lighting ------------------------------------------------------------
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  const pinkFill = new THREE.PointLight(NEON_PINK, 18, 30);
  pinkFill.position.set(-3, -1, 4);
  scene.add(pinkFill);

  const cyanRim = new THREE.PointLight(NEON_CYAN, 14, 30);
  cyanRim.position.set(3.5, 2.5, -2);
  scene.add(cyanRim);

  const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
  topLight.position.set(0, 5, 3);
  scene.add(topLight);

  // --- Controls (Three.js OrbitControls addon) -----------------------------
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;
  controls.minPolarAngle = Math.PI / 2.6;
  controls.maxPolarAngle = Math.PI / 1.7;
  // Drag to spin on desktop only; touch devices keep auto-rotate only.
  controls.enableRotate = !isTouch;

  // --- Animation loop ------------------------------------------------------
  const clock = new THREE.Clock();
  let frameId = 0;
  let running = false;

  const render = () => {
    const t = clock.getElapsedTime();
    // Gentle idle float.
    orb.position.y = Math.sin(t * 1.1) * 0.08;
    // Subtle emissive pulse so the neon feels alive.
    sphereMat.emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.12;
    controls.update();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(render);
  };

  const start = () => {
    if (running) return;
    running = true;
    clock.start();
    frameId = requestAnimationFrame(render);
  };

  const stop = () => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(frameId);
    clock.stop();
  };

  // --- Resize --------------------------------------------------------------
  const onResize = () => {
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  // If reduced motion: render a single static frame, no loop.
  if (prefersReducedMotion) {
    controls.autoRotate = false;
    controls.update();
    renderer.render(scene, camera);
  }

  const dispose = () => {
    stop();
    resizeObserver.disconnect();
    controls.dispose();
    sphereGeo.dispose();
    sphereMat.dispose();
    glowGeo.dispose();
    glowMat.dispose();
    eyeGeo.dispose();
    mouthGeo.dispose();
    faceMat.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };

  return { start, stop, dispose };
}
