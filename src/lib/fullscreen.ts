// Shared fullscreen behavior for embedded iframes (project demos, games, and
// any future embed). Fullscreen expands the frame IN PLACE via a class toggle —
// the iframe is never reparented, so it never reloads (a Three.js scene or a
// game session must survive the toggle). Native Fullscreen API + landscape
// lock are attempted where supported (Android Chrome); the fixed-overlay CSS
// keyed on `.is-fs` in global.css is the universal fallback (iPhone Safari has
// neither element fullscreen nor orientation lock).
//
// CONVENTION — any component becomes fullscreen-capable with markup only:
//   1. `data-fs-root`   on the container that expands (e.g. the .term-window)
//   2. `data-fs-toggle` button inside it, containing two label spans:
//        <span data-fs-open>⛶ fullscreen</span>
//        <span data-fs-close hidden>✕ exit</span>
//   3. `data-fs-frames` on the wrapper around the iframe(s)
//   4. optional hint under the titlebar (auto-shows fullscreen + portrait):
//        <p class="fs-rotate-hint">Tip: rotate your phone sideways…</p>
//   5. in the component script:
//        import { initFullscreen } from '../lib/fullscreen';
//        initFullscreen();
//        document.addEventListener('astro:page-load', () => initFullscreen());
//
// Toggled state: `.is-fs` on the root, `.fs-open` on <body>.

function setUi(root: HTMLElement, open: boolean) {
  root.classList.toggle('is-fs', open);
  document.body.classList.toggle('fs-open', open);
  const btn = root.querySelector<HTMLElement>('[data-fs-toggle]');
  btn?.setAttribute('aria-expanded', String(open));
  const openLabel = btn?.querySelector<HTMLElement>('[data-fs-open]');
  const closeLabel = btn?.querySelector<HTMLElement>('[data-fs-close]');
  if (openLabel) openLabel.hidden = open;
  if (closeLabel) closeLabel.hidden = !open;
}

function teardown(root: HTMLElement) {
  try {
    (screen.orientation as any)?.unlock?.();
  } catch {}
  setUi(root, false);
}

async function open(root: HTMLElement) {
  setUi(root, true);
  try {
    await root.requestFullscreen?.();
  } catch {}
  try {
    await (screen.orientation as any)?.lock?.('landscape');
  } catch {}
}

function close(root: HTMLElement) {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  teardown(root);
}

const activeRoot = () =>
  document.querySelector<HTMLElement>('[data-fs-root].is-fs');

// Document-level listeners are registered once at module scope (not per init)
// so `astro:page-load` re-inits never accumulate handlers on stale roots.
let documentListenersInstalled = false;
function installDocumentListeners() {
  if (documentListenersInstalled) return;
  documentListenersInstalled = true;

  // Back gesture / system UI can exit native fullscreen without our button —
  // keep the overlay class in sync.
  document.addEventListener('fullscreenchange', () => {
    const root = activeRoot();
    if (!document.fullscreenElement && root) teardown(root);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const root = activeRoot();
    if (root) close(root);
  });
}

export function initFullscreen(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLElement>('[data-fs-root]').forEach((root) => {
    if (root.dataset.fsReady === 'true') return;
    root.dataset.fsReady = 'true';

    const btn = root.querySelector<HTMLElement>('[data-fs-toggle]');
    if (!btn) return;

    btn.addEventListener('click', () => {
      root.classList.contains('is-fs') ? close(root) : open(root);
    });
  });
  installDocumentListeners();
}
