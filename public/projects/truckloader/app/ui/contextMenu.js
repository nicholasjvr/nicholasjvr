// 3D right-click context menu for placed loads.
// Owns #iso-context-menu and its #iso-ctx-header. Triggered by iso/scene.js
// when the user right-clicks a placed-load mesh; the action handlers are
// injected at init time so this folder stays decoupled from placement logic.

// ID of the placed-block whose menu is currently shown (null = closed).
let _armedBlockId = null;

// Injected action handlers (see initContextMenu).
const _handlers = {
  move: function () {},
  rotate: function () {},
  remove: function () {},
};

export function initContextMenu(ctx) {
  if (ctx) {
    if (typeof ctx.onMove === "function") _handlers.move = ctx.onMove;
    if (typeof ctx.onRotate === "function") _handlers.rotate = ctx.onRotate;
    if (typeof ctx.onRemove === "function") _handlers.remove = ctx.onRemove;
  }

  const menu = document.getElementById("iso-context-menu");
  if (!menu) return;

  menu.querySelectorAll(".iso-ctx-item").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = _armedBlockId;
      hideIsoContextMenu();
      if (!id) return;
      const fn = _handlers[action];
      if (fn) fn(id);
    });
  });

  // Click outside the menu OR press Esc → close without action.
  document.addEventListener("mousedown", function (e) {
    if (menu.hidden) return;
    if (menu.contains(e.target)) return;
    hideIsoContextMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !menu.hidden) hideIsoContextMenu();
  });
}

export function hideIsoContextMenu() {
  const menu = document.getElementById("iso-context-menu");
  if (menu) menu.hidden = true;
  _armedBlockId = null;
}

// Position and reveal the menu at (clientX, clientY), clamped to the viewport
// so it never overflows. `block` is the placed-block record (id + load info).
export function showIsoContextMenu(block, clientX, clientY) {
  const menu = document.getElementById("iso-context-menu");
  if (!menu || !block) return;
  _armedBlockId = block.id;

  // Friendly header — load id + customer or description if available.
  const header = document.getElementById("iso-ctx-header");
  if (header) {
    const ref = block.loadId || "Load " + block.id;
    const sub = block.description || block.loadId || "";
    header.textContent = sub ? ref + " · " + sub : ref;
  }

  menu.hidden = false;
  // Measure now (after un-hiding) so we can clamp accurately.
  const rect = menu.getBoundingClientRect();
  const pad = 8;
  const x = Math.min(clientX, window.innerWidth - rect.width - pad);
  const y = Math.min(clientY, window.innerHeight - rect.height - pad);
  menu.style.left = Math.max(pad, x) + "px";
  menu.style.top = Math.max(pad, y) + "px";
}
