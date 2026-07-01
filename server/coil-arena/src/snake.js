import { randomUUID } from 'node:crypto';

export const WORLD_RADIUS = 3000;
export const SPEED = 3.2;
export const TURN_RATE = 0.09;
export const SEGMENT_SPACING = 11;
export const START_LENGTH = 12;
export const HEAD_RADIUS = 10;
export const BODY_RADIUS = 9;

const BOT_NAMES = [
  'coil_bot',
  'serpent_x',
  'neon_wyrm',
  'byte_snake',
  'grid_slither',
  'fork_tail',
  'loop_daemon',
  'ascii_coil',
  'vim_snake',
  'grep_viper',
  'null_worm',
  'stack_overflow',
];

/** @param {string} id */
export function colorFromId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 65% 55%)`;
}

/**
 * @param {{ name: string, x: number, y: number, isBot?: boolean, ws?: import('ws').WebSocket | null }} opts
 */
export function createSnake({ name, x, y, isBot = false, ws = null }) {
  const id = randomUUID();
  const angle = Math.random() * Math.PI * 2;
  const snake = {
    id,
    name,
    isBot,
    ws,
    color: colorFromId(id),
    alive: true,
    angle,
    targetAngle: angle,
    x,
    y,
    trail: [{ x, y }],
    length: START_LENGTH,
    score: 0,
  };
  rebuildSegments(snake);
  return snake;
}

/** @param {ReturnType<typeof createSnake>} snake */
export function rebuildSegments(snake) {
  const segments = [];
  const needed = Math.max(START_LENGTH, Math.floor(snake.length));
  let dist = 0;
  let trailIdx = snake.trail.length - 1;

  while (segments.length < needed && trailIdx >= 0) {
    const pt = snake.trail[trailIdx];
    if (segments.length === 0) {
      segments.push({ x: snake.x, y: snake.y });
      trailIdx--;
      continue;
    }
    const prev = segments[segments.length - 1];
    const dx = prev.x - pt.x;
    const dy = prev.y - pt.y;
    const step = Math.hypot(dx, dy);
    if (step + dist >= SEGMENT_SPACING) {
      const t = (SEGMENT_SPACING - dist) / (step || 1);
      segments.push({
        x: prev.x - dx * t,
        y: prev.y - dy * t,
      });
      dist = 0;
    } else {
      dist += step;
      trailIdx--;
    }
  }

  while (segments.length < needed) {
    const tail = segments[segments.length - 1] ?? { x: snake.x, y: snake.y };
    segments.push({
      x: tail.x - Math.cos(snake.angle) * SEGMENT_SPACING,
      y: tail.y - Math.sin(snake.angle) * SEGMENT_SPACING,
    });
  }

  snake.segments = segments;
}

/** @param {ReturnType<typeof createSnake>} snake */
export function advanceSnake(snake) {
  if (!snake.alive) return;

  let diff = snake.targetAngle - snake.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-TURN_RATE, Math.min(TURN_RATE, diff));
  snake.angle += turn;

  snake.x += Math.cos(snake.angle) * SPEED;
  snake.y += Math.sin(snake.angle) * SPEED;
  snake.trail.push({ x: snake.x, y: snake.y });

  const maxTrail = Math.ceil(snake.length * SEGMENT_SPACING * 2);
  if (snake.trail.length > maxTrail) {
    snake.trail.splice(0, snake.trail.length - maxTrail);
  }

  rebuildSegments(snake);
  snake.score = snake.segments.length;
}

/** @param {ReturnType<typeof createSnake>} snake */
export function growSnake(snake, amount = 1) {
  snake.length += amount;
}

/**
 * @param {ReturnType<typeof createSnake>} snake
 * @param {number} worldR
 */
export function respawnSnake(snake, worldR) {
  const spawn = randomPointInCircle(worldR * 0.7);
  snake.alive = true;
  snake.x = spawn.x;
  snake.y = spawn.y;
  snake.angle = Math.random() * Math.PI * 2;
  snake.targetAngle = snake.angle;
  snake.trail = [{ x: spawn.x, y: spawn.y }];
  snake.length = START_LENGTH;
  snake.score = START_LENGTH;
  rebuildSegments(snake);
}

/** @param {number} radius */
export function randomPointInCircle(radius) {
  const t = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;
  return { x: Math.cos(t) * r, y: Math.sin(t) * r };
}

let botNameIdx = 0;
export function nextBotName() {
  const name = BOT_NAMES[botNameIdx % BOT_NAMES.length];
  botNameIdx++;
  return name;
}

/** @param {ReturnType<typeof createSnake>} snake */
export function serializeSnake(snake) {
  return {
    id: snake.id,
    name: snake.name,
    isBot: snake.isBot,
    color: snake.color,
    alive: snake.alive,
    head: { x: snake.x, y: snake.y, angle: snake.angle },
    segments: snake.segments.map((s) => ({ x: s.x, y: s.y })),
    score: snake.score,
  };
}
