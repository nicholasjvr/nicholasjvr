// Tiny pub/sub bus used to decouple sibling feature folders.
// Example:
//   import { on, emit } from "../core/events.js";
//   on("placedBlocks:changed", () => repaintGrid());
//   emit("placedBlocks:changed", { reason: "drop" });

const listeners = new Map();

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}

export function off(event, handler) {
  const set = listeners.get(event);
  if (set) set.delete(handler);
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const handler of set) {
    try { handler(payload); }
    catch (err) { console.error("[events] handler for", event, "threw:", err); }
  }
}

export function clear(event) {
  if (event) listeners.delete(event);
  else listeners.clear();
}
