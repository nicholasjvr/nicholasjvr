// Shared drag payload for HTML5 drag from load cards into placement.js drop zone.
// Split out so loadList.js does not import placement.js (avoids circular imports).

let _dragPayload = null;

export function setDragPayload(load) {
  _dragPayload = load;
}

export function getDragPayload() {
  return _dragPayload;
}

export function clearDragPayload() {
  _dragPayload = null;
}
