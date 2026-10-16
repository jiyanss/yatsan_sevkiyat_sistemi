/* ═══════════════ 🧱 TETRIS v2 — kişisel rekor ═══════════════ */
console.info("🧱 Tetris v2 yüklendi");
const TE_KEY = "sevkiyat_tetris_best";
let teBest = Number(localStorage.getItem(TE_KEY) || 0);
let teState = null;
let teTimer = null;

const TE_SHAPES = {
  I: [[1,1,1,1]],
  O: [[1,1],[1,1]],
  T: [[1,1,1],[0,1,0]],
  S: [[0,1,1],[1,1,0]],
  Z: [[1,1,0],[0,1,1]],
  J: [[1,0,0],[1,1,1]],
  L: [[0,0,1],[1,1,1]]
};
const TE_COLORS = { I:"#22d3ee", O:"#facc15", T:"#c084fc", S:"#34d399", Z:"#f87171", J:"#60a5fa", L:"#fb923c" };
const TE_W = 10, TE_H = 18;

function teRandomPiece() {
  const keys = Object.keys(TE_SHAPES);
  const k = keys[Math.floor(Math.random() * keys.length)];
  return { shape: TE_SHAPES[k].map(r => [...r]), k, color: TE_COLORS[k] };
}
function teRotate(shape) {
  return shape[0].map((_, i) => shape.map(r => r[i]).reverse());
}

function openTetris() {
  document.getElementById("tetrisModal").classList.remove("hidden");
  teRenderBody();
}
function closeTetris() {
  teStop();
  teState = null;
  document.getElementById("tetrisModal").classList.add("hidden");
}
function teStop() { if (teTimer) { clearInterval(teTimer); teTimer = null; } }

function teRenderBody() {
  const c = document.getElementById("tetrisBody");
  const skor = teState ? teState.score : 0;
  c.innerHTML = `
    <div class="su-bar" style="max-width:396px;margin:0 auto 10px">
      <button class="btn primary" id="teStartBtn">▶️ Başla</button>
      <div class="te-stat">🏆 Rekor: <b>${teBest}</b></div>
    </div>
    <div class="te-wrap">
      <div style="position:relative">
        <canvas id="teCanvas" class="te-canvas" width="220" height="396"></canvas>
        <div id="teOver" class="te-over hidden">
          <div style="font-size:26px;font-weight:800;color:#e2e8f0">💀 Oyun Bitti</div>
          <div style="color:#8aa0b8">Skor: <b id="teOverScore">${skor}</b> · Rekor: <b>${teBest}</b></div>
          <button class="btn primary" id="teAgainBtn">🔁 Tekrar</button>
        </div>
      </div>
      <div class="te-side">
        <div class="te-stat">Sonraki<br><canvas id="teNext" class="te-next" width="80" height="80"></canvas></div>
        <div class="te-stat">Skor<br><b id="teScore">${skor}</b></div>
        <div class="te-stat">Çizgi<br><b id="teLines">0</b></div>
        <div class="te-stat">Seviye<br><b id="teLevel">1</b></div>
      </div>
    </div>
    <div class="te-pad">
      <button class="te-btn" data-te="rot">⟳</button>
      <div class="te-pad-row">
        <button class="te-btn" data-te="left">◀</button>
        <button class="te-btn" data-te="down">▼</button>
        <button class="te-btn" data-te="right">▶</button>
      </div>
      <button class="te-btn" data-te="drop" style="width:172px">⇓ Bırak</button>
    </div>
    <p class="hint" style="margin-top:10px">Klavye: ← → hareket · ↑ döndür · ↓ hızlı in · Boşluk bırak</p>`;
  document.getElementById("teStartBtn").addEventListener("click", teStart);
  document.getElementById("teAgainBtn").addEventListener("click", teStart);
  c.querySelectorAll("[data-te]").forEach(b =>
    b.addEventListener("click", () => teMove(b.dataset.te)));
}

function teStart() {
  teStop();
  teState = {
    grid: Array.from({ length: TE_H }, () => Array(TE_W).fill(null)),
    piece: teRandomPiece(),
    next: teRandomPiece(),
    px: 3, py: 0,
    score: 0, lines: 0, level: 1
  };
  document.getElementById("teOver").classList.add("hidden");
  teSpawn();
  teDraw();
  teTickStart();
  console.info("🧱 oyun başladı · parça:", teState.piece.k);
}

function teTickStart() {
  teStop();
  const ms = Math.max(120, 600 - (teState.level - 1) * 60);
  teTimer = setInterval(teTick, ms);
}

function teCollide(shape, px, py) {
  for (let y = 0; y < shape.length; y++)
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const gx = px + x, gy = py + y;
      if (gx < 0 || gx >= TE_W || gy >= TE_H) return true;
      if (gy >= 0 && teState.grid[gy][gx]) return true;
    }
  return false;
}

function teSpawn() {
  teState.piece = teState.next;
  teState.next = teRandomPiece();
  teState.px = Math.floor((TE_W - teState.piece.shape[0].length) / 2);
  teState.py = 0;
  teDrawNext();
  if (teCollide(teState.piece.shape, teState.px, teState.py)) teGameOver();
}

function teMerge() {
  const { shape, px, py, color } = teState.piece;
  shape.forEach((row, y) => row.forEach((v, x) => {
    if (v && py + y >= 0) teState.grid[py + y][px + x] = color;
  }));
  let cleared = 0;
  teState.grid = teState.grid.filter(row => {
    if (row.every(c => c)) { cleared++; return false; }
    return true;
  });
  while (teState.grid.length < TE_H) teState.grid.unshift(Array(TE_W).fill(null));
  if (cleared) {
    teState.lines += cleared;
    teState.score += [0, 100, 300, 500, 800][cleared] * teState.level;
    teState.level = Math.floor(teState.lines / 5) + 1;
    teTickStart(); /* seviye hızlandı */
  }
}

function teMove(dir) {
  if (!teState || !teTimer) return;
  if (dir === "left") { if (!teCollide(teState.piece.shape, teState.px - 1, teState.py)) teState.px--; }
  else if (dir === "right") { if (!teCollide(teState.piece.shape, teState.px + 1, teState.py)) teState.px++; }
  else if (dir === "down") { if (!teCollide(teState.piece.shape, teState.px, teState.py + 1)) teState.py++; }
  else if (dir === "rot") {
    const rot = teRotate(teState.piece.shape);
    if (!teCollide(rot, teState.px, teState.py)) teState.piece.shape = rot;
  }
  else if (dir === "drop") {
    while (!teCollide(teState.piece.shape, teState.px, teState.py + 1)) teState.py++;
    teState.score += 2;
  }
  teScoreUpdate();
  teDraw();
}

function teTick() {
  if (!teState) return;
  if (!teCollide(teState.piece.shape, teState.px, teState.py + 1)) {
    teState.py++;
  } else {
    teMerge();
    if (teState) teSpawn();
    teScoreUpdate();
  }
  teDraw();
}

function teScoreUpdate() {
  if (!teState) return;
  const sc = document.getElementById("teScore");
  if (sc) sc.textContent = teState.score;
  const ln = document.getElementById("teLines");
  if (ln) ln.textContent = teState.lines;
  const lv = document.getElementById("teLevel");
  if (lv) lv.textContent = teState.level;
}

function teGameOver() {
  teStop();
  if (teState.score > teBest) {
    teBest = teState.score;
    localStorage.setItem(TE_KEY, teBest);
  }
  const ov = document.getElementById("teOver");
  ov.classList.remove("hidden");
  document.getElementById("teOverScore").textContent = teState.score;
}

function teDraw() {
  const cv = document.getElementById("teCanvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const cell = cv.width / TE_W;
  /* zemin */
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, cv.width, cv.height);
  /* grid çizgileri */
  ctx.strokeStyle = "#1c2942";
  for (let i = 1; i < TE_W; i++) { ctx.beginPath(); ctx.moveTo(i*cell,0); ctx.lineTo(i*cell,cv.height); ctx.stroke(); }
  for (let i = 1; i < TE_H; i++) { ctx.beginPath(); ctx.moveTo(0,i*cell); ctx.lineTo(cv.width,i*cell); ctx.stroke(); }
  /* yerleşmiş bloklar */
  for (let y = 0; y < teState.grid.length; y++)
    for (let x = 0; x < teState.grid[y].length; x++) {
      const c = teState.grid[y][x];
      if (!c) continue;
      teCell(ctx, x, y, cell, c);
    }
  /* aktif parça */
  if (teState.piece) {
    const { shape, px, py, color } = teState.piece;
    shape.forEach((row, y) => row.forEach((v, x) => {
      if (v && py + y >= 0) teCell(ctx, px + x, py + y, cell, color);
    }));
  }
}
function teCell(ctx, x, y, cell, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x*cell + 1, y*cell + 1, cell - 2, cell - 2);
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.strokeRect(x*cell + 1.5, y*cell + 1.5, cell - 3, cell - 3);
}

function teDrawNext() {
  const cv = document.getElementById("teNext");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (!teState || !teState.next) return;
  const { shape, color } = teState.next;
  const cell = 18;
  const offX = (cv.width - shape[0].length * cell) / 2;
  const offY = (cv.height - shape.length * cell) / 2;
  shape.forEach((row, y) => row.forEach((v, x) => {
    if (v) teCell(ctx, 0, 0, 0, "transparent"); /* no-op koruması gerekmiyor — aşağı gerçek çizim */
  }));
  shape.forEach((row, y) => row.forEach((v, x) => {
    if (v) {
      ctx.fillStyle = color;
      ctx.fillRect(offX + x*cell + 1, offY + y*cell + 1, cell - 2, cell - 2);
    }
  }));
}

/* Klavye — tetris modalı açıkken */
document.addEventListener("keydown", e => {
  const ov = document.getElementById("tetrisModal");
  if (!ov || ov.classList.contains("hidden")) return;
  const map = { ArrowLeft: "left", ArrowRight: "right", ArrowDown: "down", ArrowUp: "rot", " ": "drop" };
  if (!map[e.key]) return;
  e.preventDefault();
  teMove(map[e.key]);
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !document.getElementById("tetrisModal").classList.contains("hidden")) closeTetris();
});

/* Modal butonları — bir kez bağlanır */
document.getElementById("btnTetrisClose").addEventListener("click", closeTetris);
document.getElementById("tetrisModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeTetris();
});
