import http from 'node:http';
import { WebSocketServer } from 'ws';
import { ArenaRoom } from './arena.js';

const PORT = Number(process.env.PORT) || 8765;

const room = new ArenaRoom();

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        humans: room.humanCount,
        snakes: room.allSnakes.length,
        tick: room.tick,
      })
    );
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('coil-arena websocket server\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  room.handleConnection(ws);
});

server.listen(PORT, () => {
  console.log(`coil-arena listening on http://localhost:${PORT} (ws://localhost:${PORT})`);
});

process.on('SIGINT', () => {
  room.destroy();
  server.close();
  process.exit(0);
});
