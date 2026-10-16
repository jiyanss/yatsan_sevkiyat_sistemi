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
