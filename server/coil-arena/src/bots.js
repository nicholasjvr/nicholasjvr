import { createSnake, nextBotName, randomPointInCircle, respawnSnake } from './snake.js';

export const DEFAULT_BOT_COUNT = 10;
export const MAX_TOTAL_SNAKES = 25;

/**
 * @param {number} worldR
 * @param {number} count
 */
export function spawnBots(worldR, count = DEFAULT_BOT_COUNT) {
  const bots = [];
  for (let i = 0; i < count; i++) {
    const pt = randomPointInCircle(worldR * 0.65);
    bots.push(
      createSnake({
        name: nextBotName(),
        x: pt.x,
        y: pt.y,
        isBot: true,
      })
    );
  }
  return bots;
}

/**
 * @param {ReturnType<import('./snake.js').createSnake>[]} bots
 * @param {number} humanCount
 */
export function targetBotCount(humanCount) {
  const desired = DEFAULT_BOT_COUNT;
  const room = MAX_TOTAL_SNAKES - humanCount;
  return Math.max(4, Math.min(desired, room));
}

/**
 * @param {ReturnType<import('./snake.js').createSnake>} bot
 * @param {ReturnType<import('./snake.js').createSnake>[]} snakes
 * @param {Array<{ x: number, y: number }>} food
 * @param {number} worldR
 */
export function steerBot(bot, snakes, food, worldR) {
  if (!bot.alive) return;

  let angle = bot.angle + (Math.random() - 0.5) * 0.4;

  const distFromCenter = Math.hypot(bot.x, bot.y);
  if (distFromCenter > worldR * 0.82) {
    angle = Math.atan2(-bot.y, -bot.x) + (Math.random() - 0.5) * 0.3;
    bot.targetAngle = angle;
    return;
  }

  let nearestFood = null;
  let nearestFoodDist = Infinity;
  for (const f of food) {
    const d = Math.hypot(f.x - bot.x, f.y - bot.y);
    if (d < nearestFoodDist && d < 420) {
      nearestFoodDist = d;
      nearestFood = f;
    }
  }

  if (nearestFood) {
    angle = Math.atan2(nearestFood.y - bot.y, nearestFood.x - bot.x);
  }

  for (const other of snakes) {
    if (!other.alive || other.id === bot.id) continue;
    if (other.score <= bot.score) continue;

    for (let i = 0; i < Math.min(other.segments.length, 24); i++) {
      const seg = other.segments[i];
      const d = Math.hypot(seg.x - bot.x, seg.y - bot.y);
      if (d < 90) {
        const away = Math.atan2(bot.y - seg.y, bot.x - seg.x);
        angle = away + (Math.random() - 0.5) * 0.5;
        break;
      }
    }
  }

  bot.targetAngle = angle;
}

/**
 * @param {ReturnType<import('./snake.js').createSnake>} bot
 * @param {number} worldR
 */
export function respawnBot(bot, worldR) {
  respawnSnake(bot, worldR);
}
