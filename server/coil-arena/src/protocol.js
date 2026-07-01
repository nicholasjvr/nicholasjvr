/** @typedef {{ t: 'join', name: string }} JoinMsg */
/** @typedef {{ t: 'input', angle: number }} InputMsg */

/**
 * @param {unknown} raw
 * @returns {JoinMsg | InputMsg | null}
 */
export function parseClientMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return null;

  if (msg.t === 'join') {
    const name = typeof msg.name === 'string' ? msg.name.trim().slice(0, 16) : '';
    if (!name) return null;
    return { t: 'join', name };
  }

  if (msg.t === 'input') {
    const angle = Number(msg.angle);
    if (!Number.isFinite(angle)) return null;
    return { t: 'input', angle };
  }

  return null;
}

export function welcomeMessage(id, worldR) {
  return JSON.stringify({ t: 'welcome', id, worldR });
}

export function stateMessage(payload) {
  return JSON.stringify({ t: 'state', ...payload });
}

export function diedMessage(score) {
  return JSON.stringify({ t: 'died', score });
}

export function errorMessage(reason) {
  return JSON.stringify({ t: 'error', reason });
}

export function fullMessage() {
  return JSON.stringify({ t: 'full' });
}
