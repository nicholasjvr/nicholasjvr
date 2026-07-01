import { HEAD_RADIUS, BODY_RADIUS } from './snake.js';
import { FOOD_RADIUS } from './food.js';

const OWN_BODY_SKIP = 6;
const HEAD_COLLIDE_DIST = HEAD_RADIUS + HEAD_RADIUS - 2;
const BODY_COLLIDE_DIST = HEAD_RADIUS + BODY_RADIUS - 2;
const FOOD_COLLIDE_DIST = HEAD_RADIUS + FOOD_RADIUS;

/**
 * @param {ReturnType<import('./snake.js').createSnake>} snake
 * @param {number} worldR
 */
export function hitsBoundary(snake, worldR) {
  const dist = Math.hypot(snake.x, snake.y);
  return dist > worldR - HEAD_RADIUS;
}

/**
 * @param {ReturnType<import('./snake.js').createSnake>} headSnake
 * @param {ReturnType<import('./snake.js').createSnake>[]} snakes
 * @returns {{ type: 'body', victimId: string, killerId: string } | { type: 'head', aId: string, bId: string } | null}
 */
export function checkSnakeCollisions(headSnake, snakes) {
  if (!headSnake.alive) return null;

  for (const other of snakes) {
    if (!other.alive || other.id === headSnake.id) continue;

    const headDist = Math.hypot(headSnake.x - other.x, headSnake.y - other.y);
    if (headDist < HEAD_COLLIDE_DIST) {
      return { type: 'head', aId: headSnake.id, bId: other.id };
    }

    const segs = other.segments;
    for (let i = OWN_BODY_SKIP; i < segs.length; i++) {
      const seg = segs[i];
      const d = Math.hypot(headSnake.x - seg.x, headSnake.y - seg.y);
      if (d < BODY_COLLIDE_DIST) {
        return { type: 'body', victimId: headSnake.id, killerId: other.id };
      }
    }
  }

  return null;
}

/**
 * @param {ReturnType<import('./snake.js').createSnake>} snake
 * @param {Map<string, { id: string, x: number, y: number }>} food
 * @returns {string[]}
 */
export function collectFood(snake, food) {
  const eaten = [];
  for (const [id, pellet] of food) {
    const d = Math.hypot(snake.x - pellet.x, snake.y - pellet.y);
    if (d < FOOD_COLLIDE_DIST) {
      eaten.push(id);
    }
  }
  return eaten;
}

/**
 * @param {ReturnType<import('./snake.js').createSnake>[]} snakes
 * @param {string} aId
 * @param {string} bId
 */
export function pickHeadWinner(snakes, aId, bId) {
  const a = snakes.find((s) => s.id === aId);
  const b = snakes.find((s) => s.id === bId);
  if (!a || !b) return null;
  if (a.score === b.score) return null;
  return a.score > b.score ? aId : bId;
}
