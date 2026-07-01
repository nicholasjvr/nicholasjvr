// Plan banner — the inline notification strip at the top of the planner.
// Auto-clears after 4.2s. Owns #plan-banner; nothing else should write to it.

const AUTO_HIDE_MS = 4200;
let _timer = null;

export function planBanner(msg) {
  const el = document.getElementById("plan-banner");
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(_timer);
  _timer = setTimeout(function() { el.hidden = true; }, AUTO_HIDE_MS);
}
