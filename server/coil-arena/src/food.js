import { randomUUID } from 'node:crypto';
import { randomPointInCircle } from './snake.js';

export const FOOD_TARGET = 220;
export const FOOD_RADIUS = 5;

/** @param {number} worldR */
export function createFoodPool(worldR) {
  /** @type {Map<string, { id: string, x: number, y: number }>} */
  const food = new Map();
  while (food.size < FOOD_TARGET) {
    const pt = randomPointInCircle(worldR * 0.92);
    const id = randomUUID();
    food.set(id, { id, x: pt.x, y: pt.y });
  }
  return food;
}

/**
 * @param {Map<string, { id: string, x: number, y: number }>} food
 * @param {number} worldR
 */
export function maintainFood(food, worldR) {
  while (food.size < FOOD_TARGET) {
    const pt = randomPointInCircle(worldR * 0.92);
    const id = randomUUID();
    food.set(id, { id, x: pt.x, y: pt.y });
  }
}

/**
 * @param {Map<string, { id: string, x: number, y: number }>} food
 * @param {Array<{ x: number, y: number }>} points
 */
export function scatterFoodFromPoints(food, points) {
  const step = Math.max(1, Math.floor(points.length / 20));
  for (let i = 0; i < points.length; i += step) {
    const p = points[i];
    const jitter = () => (Math.random() - 0.5) * 16;
    const id = randomUUID();
    food.set(id, { id, x: p.x + jitter(), y: p.y + jitter() });
  }
}

/** @param {Map<string, { id: string, x: number, y: number }>} food */
export function serializeFood(food) {
  return Array.from(food.values()).map((f) => ({ id: f.id, x: f.x, y: f.y }));
}
