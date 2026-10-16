/* ═══════════════ 🔢 SUDOKU — ORTAK MASA ═══════════════ */
const SU_NODE = "sudoku_board";
const SU_PLAYERS = "sudoku_players";
const SU_HIST = "sudoku_history";
const SU_PLAYER_KEY = "sevkiyat_sudoku_player";
let suSub = null;        /* EventSource */
let suHeartIv = null;
let suTimerIv = null;
let suSel = -1;          /* seçili hücre index 0..80 */
let suMe = null;         /* { id, isim } */

/* ---- Hazır bulmaca havuzu (0 = boş; tek çözümlü, doğrulanmış) ---- */
const SU_PUZZLES = [
  { d: "Kolay",
    p: "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
    s: "534678912672195348198342567859761423426853791713924856961537284287419635345286179" },
  { d: "Kolay",
    p: "000000907000420180000705026100904000050000040000507009920108000034059000507000000",
    s: "162857493538426187947135826173964528256781349489513769925148673864592317571673952" },
  { d: "Orta",
    p: "100489006730000040000001295007000600800020009006000700431000000250000086900738004",
    s: "152489736736521848948736295275943618893126574416857932584362917257914386961273854" },
  { d: "Orta",
    p: "000000012000000003002300400001800005060070800000009000008500000900040500470000000",
    s: "945867312768429153532316498891743625463978521257691834318562749926435187472138965" },
  { d: "Zor",
    p: "000008050300040000000700000000200006085000340090703000400000020000600000050100000",
    s: "647928153315746982982713564573284916185967343296473825468135297729651438354872691" },
  { d: "Zor",
    p: "030050000000600000500000108006000020700903004050001300000004006020000050000010380",
    s: "836451972419726835572938164943615728768293514251847396395584216427869351685312487" }
];

function suPlayer() {
  if (suMe) return suMe;
  let g = null;
  try { g = JSON.parse(localStorage.getItem(SU_PLAYER_KEY)); } catch (e) {}
  if (!g || !g.id) {
    g = { id: "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), isim: "" };
  }
  if (!g.isim) g.isim = currentUser ? shortUser(currentUser.email) : "Misafir-" + g.id.slice(-4);
  suMe = g;
  localStorage.setItem(SU_PLAYER_KEY, JSON.stringify(g));
  return g;
}
function suIdx(r, c) { return r * 9 + c; }
function suRowCol(i) { return [Math.floor(i / 9), i % 9]; }

function openSudoku() {
  document.getElementById("sudokuModal").classList.remove("hidden");
  suRenderStart();       /* tahta yüklenene kadar açılış ekranı */
  suStartSync();         /* SSE + heartbeat hemen başlar */
}
function closeSudoku() {
  if (suSub) { suSub.close(); suSub = null; }
  if (suHeartIv) { clearInterval(suHeartIv); suHeartIv = null; }
  if (suTimerIv) { clearInterval(suTimerIv); suTimerIv = null; }
  document.getElementById("sudokuModal").classList.add("hidden");
}
document.getElementById("btnSudokuClose").addEventListener("click", closeSudoku);
document.getElementById("sudokuModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeSudoku();
});

/* Açılış ekranı: tahta varsa direkt masaya, yoksa Yeni Oyun */
async function suRenderStart() {
  const b = document.getElementById("sudokuBody");
  b.innerHTML = `<p class="hint">Tahta kontrol ediliyor…</p>`;
  let board;
  try { board = await fetch(`${FIREBASE_DB_URL}/${SU_NODE}.json`).then(r => r.json()); }
  catch (e) { b.innerHTML = `<p class="hint">Yüklenemedi: ${esc(e.message)}</p>`; return; }
  if (!board || !board.cells) {
    b.innerHTML = `
      <div style="text-align:center;padding:14px 0">
        <div style="font-size:44px">🔢</div>
        <p style="font-weight:700">Açık oyun yok — yeni bir ortak masa açın.</p>
        <p class="hint">Açan kişi bulmacayı seçer, katılan herkes birlikte çözer. Bittiğinde süre ve katkılar duyurulur.</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          ${SU_PUZZLES.map((p, i) => `<button class="btn ${i === 0 ? "primary" : ""}" data-sunew="${i}">${esc(p.d)}</button>`).join("")}
        </div>
      </div>`;
    b.querySelectorAll("[data-sunew]").forEach(btn =>
      btn.addEventListener("click", async () => {
        /* transaction benzeri koruma: board yoksa yaz */
        const res = await fetch(`${FIREBASE_DB_URL}/${SU_NODE}.json`, { method: "PUT", body: "null" });
        await suYeniOyun(Number(btn.dataset.sunew));
        suRenderBoard();
      }));
    return;
  }
  suRenderBoard(board);
}
async function suYeniOyun(pIdx) {
  const p = SU_PUZZLES[pIdx];
  const cells = {};
  for (let i = 0; i < 81; i++) {
    cells[i] = { v: Number(p.p[i]) || 0, fixed: (Number(p.p[i]) || 0) > 0, u: "" };
  }
  const body = {
    puzzle: pIdx, cells,
    solution: p.s, startedTs: Date.now(), status: "active",
    createdBy: suPlayer().isim
  };
  await fetch(`${FIREBASE_DB_URL}/${SU_NODE}.json`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  showToast("🔢 Yeni ortak masa açıldı — herkes katılabilir!");
}
/* ═══════════════ 🎨 TAHTA RENDER + CANLI SENKRON ═══════════════ */
let suBoard = null;   /* son bilinen tahta (render + local yazım için) */

async function suRenderBoard(board) {
  if (!board) {
    board = await fetch(`${FIREBASE_DB_URL}/${SU_NODE}.json`).then(r => r.json());
  }
  suBoard = board;
  const b = document.getElementById("sudokuBody");
  if (!board || !board.cells) { await suRenderStart(); return; }

  const me = suPlayer();
  const bitmis = board.status === "done";
  const sure = Math.floor((Date.now() - board.startedTs) / 1000);
  const sureTxt = bitmis && board.finishedTs
    ? fmtSure(board.finishedTs - board.startedTs)
    : `${Math.floor(sure / 60)}:${pad2(sure % 60)}`;

  let grid = "";
  for (let i = 0; i < 81; i++) {
    const c = board.cells[i] || { v: 0, fixed: false, u: "" };
    let cls = "su-cell";
    if (c.fixed) cls += " su-fixed";
    else if (c.u === me.isim && c.v) cls += " su-mine";
    else if (c.u && c.v) cls += " su-other";
    if (suSel === i) cls += " su-sel";
    /* çakışma vurgusu: aynı satır/sütun/kutuda aynı değer */
    if (c.v && !c.fixed && suCakisiyor(board, i)) cls += " su-err";
    grid += `<div class="${cls}" data-suidx="${i}">${c.v || ""}${c.u && !c.fixed ? `<span class="su-name">${esc(c.u.split(" ")[0])}</span>` : ""}</div>`;
  }

  b.innerHTML = `
    <div class="su-bar" style="max-width:432px;margin:0 auto 10px">
      <span class="su-stat">${esc(board.puzzle != null && SU_PUZZLES[board.puzzle] ? SU_PUZZLES[board.puzzle].d : "")} · ⏱ ${sureTxt}</span>
      <span class="su-players" id="suPlayers">👥 …</span>
    </div>
    ${bitmis ? `<div class="islem-done" style="max-width:432px;margin:0 auto 10px">🎉 ${esc(board.winner || "Çözüldü")} çözdü · ${sureTxt} · katkılar: ${esc((board.katkilar || []).join(", "))}</div>` : ""}
    <div class="su-grid" id="suGrid">${grid}</div>
    <div class="su-pad">
      <div class="su-pad-row">${[1,2,3,4,5].map(n => `<button class="su-num-btn" data-sun="${n}">${n}</button>`).join("")}</div>
      <div class="su-pad-row">${[6,7,8,9].map(n => `<button class="su-num-btn" data-sun="${n}">${n}</button>`).join("")}</div>
      <div class="su-pad-row">
        <button class="su-act-btn" data-sun="0">🧽 Temizle</button>
        ${bitmis ? `<button class="su-act-btn" id="suYeni">🔢 Yeni Oyun</button>` : ""}
      </div>
    </div>`;

  /* hücre seçimi */
  b.querySelector("#suGrid").addEventListener("click", e => {
    const cell = e.target.closest("[data-suidx]");
    if (!cell) return;
    const i = Number(cell.dataset.suidx);
    if (board.cells[i] && board.cells[i].fixed) return;
    if (bitmis) return;
    suSel = i;
    suRenderBoard(board);
  });
  /* sayı pedi */
  b.querySelectorAll("[data-sun]").forEach(btn =>
    btn.addEventListener("click", () => suYaz(Number(btn.dataset.sun))));
  const yeniBtn = b.querySelector("#suYeni");
  if (yeniBtn) yeniBtn.addEventListener("click", async () => {
    await fetch(`${FIREBASE_DB_URL}/${SU_NODE}.json`, { method: "PUT", body: "null" });
    await suRenderStart();
  });
}

/* Çakışma: aynı satır/sütun/3x3 kutuda aynı değerden başka var mı */
function suCakisiyor(board, i) {
  const [r, c] = suRowCol(i);
  const v = board.cells[i].v;
  for (let k = 0; k < 81; k++) {
    if (k === i) continue;
    const [kr, kc] = suRowCol(k);
    if (board.cells[k].v !== v) continue;
    if (kr === r || kc === c) return true;
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    if (kr >= br && kr < br + 3 && kc >= bc && kc < bc + 3) return true;
  }
  return false;
}

/* ═══════════════ ✍️ HÜCRE YAZMA ═══════════════ */
async function suYaz(v) {
  if (suSel < 0 || !suBoard || suBoard.status === "done") return;
  if (suBoard.cells[suSel] && suBoard.cells[suSel].fixed) return;
  const me = suPlayer();
  const cell = { v, fixed: false, u: v === 0 ? "" : me.isim };
  suBoard.cells[suSel] = cell;                 /* optimistik yerel */
  await fetch(`${FIREBASE_DB_URL}/${SU_NODE}/cells/${suSel}.json`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cell)
  });
  const sonraki = suSonrakiBos(suBoard, suSel);
  suSel = sonraki;
  await suRenderBoard(suBoard);
  await suBitisKontrol();
}
function suSonrakiBos(board, from) {
  for (let k = 1; k <= 81; k++) {
    const i = (from + k) % 81;
    if (!board.cells[i].fixed && board.cells[i].v === 0) return i;
  }
  return from;
}

/* 🏁 Tamamlanma kontrolü — yalnız yazan taraf tetikler (çift duyuru olmaz) */
async function suBitisKontrol() {
  const board = await fetch(`${FIREBASE_DB_URL}/${SU_NODE}.json`).then(r => r.json());
  if (!board || board.status === "done") return;
  const sol = board.solution;
  for (let i = 0; i < 81; i++) {
    if (Number(sol[i]) !== (board.cells[i]?.v || 0)) return;   /* yanlış/eksik var */
  }
  const finishedTs = Date.now();
  const katkilar = [...new Set(Object.values(board.cells).filter(c => c.u).map(c => c.u))];
  const sure = finishedTs - board.startedTs;
  await fetch(`${FIREBASE_DB_URL}/${SU_NODE}/status.json`, { method: "PUT", body: '"done"' });
  await fetch(`${FIREBASE_DB_URL}/${SU_NODE}/finishedTs.json`, { method: "PUT", body: String(finishedTs) });
  await fetch(`${FIREBASE_DB_URL}/${SU_NODE}/winner.json`, { method: "PUT", body: JSON.stringify(suPlayer().isim) });
  await fetch(`${FIREBASE_DB_URL}/${SU_NODE}/katkilar.json`, { method: "PUT", body: JSON.stringify(katkilar) });
  await fetch(`${FIREBASE_DB_URL}/${SU_HIST}.json`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ts: finishedTs, sure, katkilar,
      zorluk: SU_PUZZLES[board.puzzle]?.d || "", puzzle: board.puzzle })
  });
  centerNotify(`🎉 SUDOKU ÇÖZÜLDÜ! ${suPlayer().isim} son hücreyi koydu · ${fmtSure(sure)} · katkılar: ${katkilar.join(", ")}`, 12000);
  bildirimDing();
  await suRenderBoard(board);
}

/* ═══════════════ 🔴 SSE + 💓 MASA DAKİKALARI ═══════════════ */
function suStartSync() {
  const me = suPlayer();
  /* SSE: tahta her değişince yeniden çiz */
  if (suSub) suSub.close();
  suSub = new EventSource(`${FIREBASE_DB_URL}/${SU_NODE}.json`);
  suSub.onmessage = () => {
    clearTimeout(suSub._t);
    suSub._t = setTimeout(async () => {
      if (document.getElementById("sudokuModal").classList.contains("hidden")) return;
      const board = await fetch(`${FIREBASE_DB_URL}/${SU_NODE}.json`).then(r => r.json());
      if (board && board.cells) suRenderBoard(board);
    }, 600);
  };
  /* Heartbeat: 30 sn'de bir "buradayım" + masadakileri tazele */
  suHeartIv = setInterval(async () => {
    const key = suFbKey(me.id);
    await fetch(`${FIREBASE_DB_URL}/${SU_PLAYERS}/${key}.json`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: me.id, isim: me.isim, ts: Date.now() })
    });
    suMasadakiler();
  }, 30000);
  suHeartbeatOnce();
  suTimerIv = setInterval(() => {
    if (document.getElementById("sudokuModal").classList.contains("hidden") || !suBoard) return;
    const sureEl = document.querySelector("#sudokuBody .su-stat");
    if (sureEl && suBoard.startedTs && suBoard.status !== "done") {
      const s = Math.floor((Date.now() - suBoard.startedTs) / 1000);
      sureEl.innerHTML = `${suBoard.puzzle != null && SU_PUZZLES[suBoard.puzzle] ? esc(SU_PUZZLES[suBoard.puzzle].d) : ""} · ⏱ ${Math.floor(s / 60)}:${pad2(s % 60)}`;
    }
  }, 1000);
}
function suFbKey(s) { return encodeURIComponent(String(s)).replace(/\./g, "%2E"); }
async function suHeartbeatOnce() {
  const me = suPlayer();
  try {
    await fetch(`${FIREBASE_DB_URL}/${SU_PLAYERS}/${suFbKey(me.id)}.json`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: me.id, isim: me.isim, ts: Date.now() })
    });
    await suMasadakiler();
  } catch (e) {}
}
async function suMasadakiler() {
  try {
    const players = await fetch(`${FIREBASE_DB_URL}/${SU_PLAYERS}.json`).then(r => r.json()) || {};
    const simdi = Date.now();
    const aktif = Object.values(players).filter(p => p && simdi - (p.ts || 0) < 120000);
    const el = document.getElementById("suPlayers");
    if (el) el.innerHTML = `👥 Masa: ${aktif.length ? aktif.map(p => esc(p.isim)).join(", ") : "boş"}`;
    /* 2 dk sessiz olanları temizle */
    Object.keys(players).forEach(k => {
      if (!players[k] || simdi - (players[k].ts || 0) >= 120000)
        fetch(`${FIREBASE_DB_URL}/${SU_PLAYERS}/${k}.json`, { method: "DELETE" });
    });
  } catch (e) {}
}

/* Klavye: sudoku açıkken 1-9 yaz, 0/Backspace temizle */
document.addEventListener("keydown", e => {
  const ov = document.getElementById("sudokuModal");
  if (!ov || ov.classList.contains("hidden")) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (/^[1-9]$/.test(e.key)) { e.preventDefault(); suYaz(Number(e.key)); }
  else if (e.key === "0" || e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); suYaz(0); }
});
