import {
  WORLD_RADIUS,
  advanceSnake,
  createSnake,
  growSnake,
  randomPointInCircle,
  respawnSnake,
  serializeSnake,
  nextBotName,
} from './snake.js';
import { createFoodPool, maintainFood, scatterFoodFromPoints, serializeFood } from './food.js';
import {
  checkSnakeCollisions,
  collectFood,
  hitsBoundary,
  pickHeadWinner,
} from './collision.js';
import { respawnBot, spawnBots, steerBot, targetBotCount } from './bots.js';
import {
  diedMessage,
  errorMessage,
  fullMessage,
  parseClientMessage,
  welcomeMessage,
} from './protocol.js';

const TICK_MS = 50;
const MAX_HUMANS = 20;
const JOIN_TIMEOUT_MS = 30_000;

export class ArenaRoom {
  constructor() {
    this.worldR = WORLD_RADIUS;
    /** @type {Map<string, ReturnType<typeof createSnake>>} */
    this.snakes = new Map();
    /** @type {Set<import('ws').WebSocket>} */
    this.clients = new Set();
    this.food = createFoodPool(this.worldR);
    this.tick = 0;
    this.leaderboard = [];

    for (const bot of spawnBots(this.worldR)) {
      this.snakes.set(bot.id, bot);
    }

    this._interval = setInterval(() => this.step(), TICK_MS);
  }

  get humanCount() {
    return [...this.snakes.values()].filter((s) => !s.isBot && s.ws).length;
  }

  get allSnakes() {
    return [...this.snakes.values()];
  }

  /** @param {import('ws').WebSocket} ws */
  handleConnection(ws) {
    /** @type {ReturnType<typeof createSnake> | null} */
    let snake = null;
    let joined = false;

    this.clients.add(ws);

    const joinTimer = setTimeout(() => {
      if (!joined) {
        ws.send(errorMessage('join_timeout'));
        ws.close();
      }
    }, JOIN_TIMEOUT_MS);

    ws.on('message', (raw) => {
      const msg = parseClientMessage(raw);
      if (!msg) return;

      if (msg.t === 'join') {
        if (this.humanCount >= MAX_HUMANS && (!snake || !this.snakes.has(snake.id))) {
          ws.send(fullMessage());
          ws.close();
          return;
        }

        if (snake && this.snakes.has(snake.id)) {
          respawnSnake(snake, this.worldR);
          joined = true;
          clearTimeout(joinTimer);
          ws.send(welcomeMessage(snake.id, this.worldR));
          return;
        }

        const pt = randomPointInCircle(this.worldR * 0.55);
        snake = createSnake({ name: msg.name, x: pt.x, y: pt.y, isBot: false, ws });
        this.snakes.set(snake.id, snake);
        joined = true;
        clearTimeout(joinTimer);
        ws.send(welcomeMessage(snake.id, this.worldR));
        this.syncBotCount();
        return;
      }

      if (msg.t === 'input' && joined && snake?.alive) {
        snake.targetAngle = msg.angle;
      }
    });

    ws.on('close', () => {
      clearTimeout(joinTimer);
      this.clients.delete(ws);
      if (snake) {
        this.snakes.delete(snake.id);
        this.syncBotCount();
      }
    });
  }

  syncBotCount() {
    const humans = this.humanCount;
    const bots = this.allSnakes.filter((s) => s.isBot);
    const want = targetBotCount(humans);

    if (bots.length < want) {
      for (let i = bots.length; i < want; i++) {
        const pt = randomPointInCircle(this.worldR * 0.65);
        const bot = createSnake({
          name: nextBotName(),
          x: pt.x,
          y: pt.y,
          isBot: true,
        });
        this.snakes.set(bot.id, bot);
      }
    } else if (bots.length > want) {
      const excess = bots.slice(want);
      for (const bot of excess) this.snakes.delete(bot.id);
    }
  }

  step() {
    this.tick++;
    const snakes = this.allSnakes.filter((s) => s.alive);
    const foodList = serializeFood(this.food);

    for (const snake of snakes) {
      if (snake.isBot) steerBot(snake, snakes, foodList, this.worldR);
    }

    for (const snake of snakes) {
      advanceSnake(snake);

      const eaten = collectFood(snake, this.food);
      for (const id of eaten) {
        this.food.delete(id);
        growSnake(snake, 1);
      }

      if (hitsBoundary(snake, this.worldR)) {
        this.killSnake(snake);
        continue;
      }

      const hit = checkSnakeCollisions(snake, this.allSnakes);
      if (!hit) continue;

      if (hit.type === 'body') {
        const victim = this.snakes.get(hit.victimId);
        if (victim) this.killSnake(victim);
      } else if (hit.type === 'head') {
        const winnerId = pickHeadWinner(this.allSnakes, hit.aId, hit.bId);
        const a = this.snakes.get(hit.aId);
        const b = this.snakes.get(hit.bId);
        if (!winnerId) {
          if (a) this.killSnake(a);
          if (b) this.killSnake(b);
        } else {
          const loserId = winnerId === hit.aId ? hit.bId : hit.aId;
          const loser = this.snakes.get(loserId);
          if (loser) this.killSnake(loser);
        }
      }
    }

    maintainFood(this.food, this.worldR);
    this.leaderboard = this.allSnakes
      .filter((s) => s.alive)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((s) => ({ id: s.id, name: s.name, score: s.score, isBot: s.isBot }));

    this.broadcast();
  }

  /** @param {ReturnType<typeof createSnake>} snake */
  killSnake(snake) {
    if (!snake.alive) return;
    snake.alive = false;
    scatterFoodFromPoints(this.food, snake.segments);

    if (!snake.isBot && snake.ws?.readyState === 1) {
      snake.ws.send(diedMessage(snake.score));
    }

    if (snake.isBot) {
      setTimeout(() => {
        if (this.snakes.has(snake.id)) respawnBot(snake, this.worldR);
      }, 2000);
    }
  }

  broadcast() {
    const snakes = this.allSnakes.map(serializeSnake);
    const food = serializeFood(this.food);
    const board = this.leaderboard;

    for (const client of this.clients) {
      if (client.readyState !== 1) continue;

      let you = null;
      for (const snake of this.allSnakes) {
        if (!snake.isBot && snake.ws === client) {
          you = snake.id;
          break;
        }
      }

      client.send(
        JSON.stringify({
          t: 'state',
          tick: this.tick,
          you,
          snakes,
          food,
          board,
        })
      );
    }
  }

  destroy() {
    clearInterval(this._interval);
  }
}
