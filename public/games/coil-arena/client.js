(() => {
  const params = new URLSearchParams(location.search);
  const WS_URL = params.get('ws') ?? 'ws://localhost:8765';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const disconnect = document.getElementById('disconnect');
  const playBtn = document.getElementById('play');
  const nameInput = document.getElementById('name');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMsg = document.getElementById('overlay-msg');
  const scoreEl = document.getElementById('score');
  const rankEl = document.getElementById('rank');
  const boardEl = document.getElementById('board');
  const statusDot = document.getElementById('status-dot');

  let ws = null;
  let myId = null;
  let worldR = 3000;
  let connected = false;
  let playing = false;
  let dead = false;

  /** @type {{ tick: number, at: number, snakes: any[], food: any[] } | null} */
  let prevState = null;
  /** @type {{ tick: number, at: number, snakes: any[], food: any[] } | null} */
  let currState = null;

  let targetAngle = 0;
  let lastInputSent = 0;
  const keys = { left: false, right: false };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', resize);
  resize();

  function setConnected(ok) {
    connected = ok;
    statusDot.classList.toggle('ok', ok);
    disconnect.classList.toggle('hidden', ok);
    if (ok) {
      overlay.classList.remove('hidden');
      playBtn.disabled = false;
    } else {
      overlay.classList.add('hidden');
      playBtn.disabled = true;
      playing = false;
      myId = null;
    }
  }

  function connect() {
    ws = new WebSocket(WS_URL);

    ws.addEventListener('open', () => setConnected(true));
    ws.addEventListener('close', () => setConnected(false));
    ws.addEventListener('error', () => setConnected(false));

    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (msg.t === 'welcome') {
        myId = msg.id;
        worldR = msg.worldR ?? 3000;
        playing = true;
        dead = false;
        overlay.classList.add('hidden');
        return;
      }

      if (msg.t === 'died') {
        dead = true;
        playing = false;
        overlayTitle.textContent = 'You died';
        overlayMsg.textContent = `Score: ${msg.score}. Respawn when ready.`;
        playBtn.textContent = 'Respawn';
        overlay.classList.remove('hidden');
        return;
      }

      if (msg.t === 'full') {
        overlayMsg.textContent = 'Arena is full. Try again in a moment.';
        overlay.classList.remove('hidden');
        return;
      }

      if (msg.t === 'state') {
        prevState = currState;
        currState = {
          tick: msg.tick,
          at: performance.now(),
          snakes: msg.snakes ?? [],
          food: msg.food ?? [],
          you: msg.you,
        };
        if (msg.you) myId = msg.you;

        if (msg.board) {
          boardEl.innerHTML = msg.board
            .slice(0, 8)
            .map(
              (row, i) =>
                `<li>${i + 1}. ${escapeHtml(row.name)}${row.isBot ? ' <span style="opacity:.5">bot</span>' : ''}<span class="score">${row.score}</span></li>`
            )
            .join('');
        }

        const me = msg.snakes?.find((s) => s.id === myId);
        if (me) {
          scoreEl.textContent = String(me.score ?? 0);
          const idx = msg.board?.findIndex((r) => r.id === myId);
          rankEl.textContent = idx >= 0 ? `#${idx + 1}` : '—';
        }
      }
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function joinGame() {
    const name = nameInput.value.trim() || 'player';
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ t: 'join', name }));
  }

  playBtn.addEventListener('click', joinGame);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinGame();
  });

  function pointerAngle(clientX, clientY) {
    const me = getInterpolatedSnakes().find((s) => s.id === myId);
    if (!me) return targetAngle;
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = getCamera(me);
    const wx = cam.x + (sx - rect.width / 2) / cam.zoom;
    const wy = cam.y + (sy - rect.height / 2) / cam.zoom;
    return Math.atan2(wy - me.head.y, wx - me.head.x);
  }

  canvas.addEventListener('mousemove', (e) => {
    targetAngle = pointerAngle(e.clientX, e.clientY);
  });
  canvas.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) targetAngle = pointerAngle(t.clientX, t.clientY);
    },
    { passive: false }
  );

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
  });

  function sendInput() {
    if (!playing || !ws || ws.readyState !== WebSocket.OPEN) return;
    const now = performance.now();
    if (now - lastInputSent < 45) return;
    lastInputSent = now;
    let angle = targetAngle;
    if (keys.left) angle -= 0.12;
    if (keys.right) angle += 0.12;
    ws.send(JSON.stringify({ t: 'input', angle }));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  function getInterpT() {
    if (!prevState || !currState) return 1;
    const dt = currState.at - prevState.at || 50;
    const elapsed = performance.now() - currState.at;
    return Math.min(1.2, elapsed / dt);
  }

  function getInterpolatedSnakes() {
    if (!currState) return [];
    const t = getInterpT();
    const prevMap = new Map((prevState?.snakes ?? []).map((s) => [s.id, s]));

    return currState.snakes.map((snake) => {
      const prev = prevMap.get(snake.id);
      if (!prev || t >= 1) return snake;
      return {
        ...snake,
        head: {
          x: lerp(prev.head.x, snake.head.x, t),
          y: lerp(prev.head.y, snake.head.y, t),
          angle: lerpAngle(prev.head.angle, snake.head.angle, t),
        },
        segments: snake.segments.map((seg, i) => {
          const pseg = prev.segments[i] ?? seg;
          return {
            x: lerp(pseg.x, seg.x, t),
            y: lerp(pseg.y, seg.y, t),
          };
        }),
      };
    });
  }

  function getCamera(me) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const zoom = Math.min(w, h) / 900;
    return { x: me.head.x, y: me.head.y, zoom: Math.max(0.35, zoom) };
  }

  function hashHue(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return Math.abs(h) % 360;
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    const snakes = getInterpolatedSnakes();
    const me = snakes.find((s) => s.id === myId) ?? snakes[0];
    const cam = me ? getCamera(me) : { x: 0, y: 0, zoom: 0.4 };

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    drawGrid(cam);
    drawBoundary();

    const food = currState?.food ?? [];
    for (const f of food) drawFood(f);

    for (const snake of snakes) {
      if (!snake.alive) continue;
      drawSnake(snake, snake.id === myId);
    }

    ctx.restore();
  }

  function drawGrid(cam) {
    const step = 80;
    const left = cam.x - canvas.clientWidth / cam.zoom;
    const right = cam.x + canvas.clientWidth / cam.zoom;
    const top = cam.y - canvas.clientHeight / cam.zoom;
    const bottom = cam.y + canvas.clientHeight / cam.zoom;
    ctx.strokeStyle = 'rgba(63, 185, 80, 0.06)';
    ctx.lineWidth = 1;
    for (let x = Math.floor(left / step) * step; x < right; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    for (let y = Math.floor(top / step) * step; y < bottom; y += step) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
  }

  function drawBoundary() {
    ctx.beginPath();
    ctx.arc(0, 0, worldR, 0, Math.PI * 2);
    ctx.strokeStyle = '#f85149';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = 'rgba(248, 81, 73, 0.04)';
    ctx.fill();
  }

  function drawFood(f) {
    const hue = hashHue(f.id);
    ctx.beginPath();
    ctx.arc(f.x, f.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.9)`;
    ctx.fill();
    ctx.strokeStyle = `hsla(${hue}, 80%, 75%, 0.5)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawSnake(snake, isMe) {
    const segs = snake.segments;
    if (!segs?.length) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = snake.color || `hsl(${hashHue(snake.id)} 65% 55%)`;
    ctx.lineWidth = isMe ? 14 : 11;
    if (isMe) {
      ctx.shadowColor = 'rgba(63, 185, 80, 0.45)';
      ctx.shadowBlur = 12;
    }

    ctx.beginPath();
    ctx.moveTo(segs[0].x, segs[0].y);
    for (let i = 1; i < segs.length; i++) {
      ctx.lineTo(segs[i].x, segs[i].y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    const head = snake.head;
    ctx.beginPath();
    ctx.arc(head.x, head.y, isMe ? 11 : 9, 0, Math.PI * 2);
    ctx.fillStyle = '#e6edf3';
    ctx.fill();
    ctx.strokeStyle = snake.color || '#3fb950';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#0d1117';
    const eyeOff = 4;
    const ex = Math.cos(head.angle);
    const ey = Math.sin(head.angle);
    ctx.beginPath();
    ctx.arc(head.x + ex * eyeOff - ey * 2, head.y + ey * eyeOff + ex * 2, 2, 0, Math.PI * 2);
    ctx.arc(head.x + ex * eyeOff + ey * 2, head.y + ey * eyeOff - ex * 2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '12px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(230, 237, 243, 0.85)';
    ctx.textAlign = 'center';
    ctx.fillText(snake.name, head.x, head.y - 16);
  }

  function loop() {
    sendInput();
    draw();
    requestAnimationFrame(loop);
  }

  nameInput.value = `player_${Math.floor(Math.random() * 900 + 100)}`;
  connect();
  loop();
})();
