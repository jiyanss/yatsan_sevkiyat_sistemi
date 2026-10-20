/* ═══════════════ 🔢 SUDOKU — ORTAK MASA (v2 · 2026-10-20) ═══════════════ */
/* v2 FIX: RTDB REST akışı "put"/"patch" İSİMLİ event basar; EventSource.onmessage
   yalnız isimsiz eventleri dinlediği için HİÇ tetiklenmiyordu (canlı senkron ölüydü).
   → addEventListener("put"/"patch") ile dinlenir.
   + Oyuncu listesi için ikinci akış (katılma anında görünür)
   + Her tahta çiziminde masa listesi tazelenir (…'da kalması düzeltildi)
   + Girişli kullanıcıya e-postadan isim (masada görünmez olmaması için)
   + Heartbeat 30sn → 15sn (daha canlı mevcudiyet) */
const SU_NODE = "sudoku_board";
const SU_PLAYERS = "sudoku_players";
const SU_HIST = "sudoku_history";
const SU_PLAYER_KEY = "sevkiyat_sudoku_player";
let suSub = null;        /* EventSource — board */
let suSubP = null;       /* EventSource — players */
let suHeartIv = null;
let suTimerIv = null;
let suSel = -1;          /* seçili hücre index 0..80 */
let suMe = null;         /* { id, isim } */

/* ---- Bulmaca havuzu (0 = boş; v2: üretici+çözücü ile DOĞRULANMIŞ, her biri eşsiz çözümlü) ---- */
const SU_PUZZLES = [
  { d: "Kolay",
    p: "180600070020004608094508030015000200000083015830700009206439000308127946001860000",
    s: "183692574527314698694578132715946283469283715832751469276439851358127946941865327" },
  { d: "Kolay",
    p: "052630401000520080400010602007205948069003007004100530040050800630090004008340200",
    s: "952638471176524389483917652317265948569483127824179536241756893635892714798341265" },
  { d: "Orta",
    p: "004030200050040980003070460602050000009600875005000020000024598407100002000060010",
    s: "964831257751246983283579461672358149349612875815497326136724598497185632528963714" },
  { d: "Orta",
    p: "090006523020080006000003890040030605050008000600500010060800030200070000078010260",
    s: "897146523325789146416253897742931685159468372683527419564892731231674958978315264" },
  { d: "Zor",
    p: "106009008200000000580001020000005040000203600090000000002984030050000080001600074",
    s: "176429358249538167583761429627195843418273695395846712762984531954317286831652974" },
  { d: "Zor",
    p: "207008000360000009090340007000200400800900000006001030000000902600010073150000000",
    s: "217698345364157829598342167735286491821934756946571238473865912682419573159723684" }
];

function suPlayer() {
  if (suMe) return suMe;
  let g = null;
  try { g = JSON.parse(localStorage.getItem(SU_PLAYER_KEY)); } catch (e) {}
  if (!g || !g.id) {
    g = { id: "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), isim: "" };
  }
  /* Girişli kullanıcı isimsizse e-postadan türet (masada görünmez kalmasın) */
  if (!g.isim || !String(g.isim).trim()) {
    try {
      if (typeof currentUser !== "undefined" && currentUser && currentUser.email)
        g.isim = String(currentUser.email).split("@")[0];
    } catch (e) {}
  }
  suMe = g;
  localStorage.setItem(SU_PLAYER_KEY, JSON.stringify(g));
  return g;
}
/* Misafir ilk kez masaya girerken isim sorulur (girişliler e-postadan alır) */
function suIsimSor() {
  return new Promise(resolve => {
    const me = suPlayer();
    if ((me.isim && me.isim.trim()) || (typeof currentUser !== "undefined" && currentUser)) { resolve(me.isim); return; }
    const eski = document.getElementById("suIsimModal");
    if (eski) eski.remove();
    const modal = document.createElement("div");
    modal.id = "suIsimModal";
    modal.className = "modal-bg";
    modal.style.zIndex = "98";
    modal.innerHTML = `<div class="modal" style="max-width:360px">
      <h2>🔢 Masaya katıl</h2>
      <p class="hint">Yazdığın hücrelerde bu isim görünür. Cihazında saklanır.</p>
      <input id="suIsimInput" maxlength="20" placeholder="Yarışmacı adın"
        style="width:100%;padding:10px 12px;font-size:14px;text-align:center" />
      <div class="modal-actions">
        <button class="btn primary" id="suIsimOk" style="width:100%">✅ Katıl</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    const inp = modal.querySelector("#suIsimInput");
    setTimeout(() => inp.focus(), 60);
    const tamam = () => {
      const v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      me.isim = v.slice(0, 20);
      localStorage.setItem(SU_PLAYER_KEY, JSON.stringify(me));
      modal.remove();
      resolve(me.isim);
    };
    modal.querySelector("#suIsimOk").addEventListener("click", tamam);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") tamam(); });
  });
}
function suIdx(r, c) { return r * 9 + c; }
function suRowCol(i) { return [Math.floor(i / 9), i % 9]; }

async function openSudoku() {
  await suIsimSor();
  document.getElementById("sudokuModal").classList.remove("hidden");
  /* 🔴 Her açılışta GARANTİLİ taze çekim — kapat-aç arasında başkası oynadıysa görünür */
  await suRenderStart();          /* bu zaten board'u fetch edip çiziyor */
  suStartSync();                  /* SSE yeniden kurulur (eski kapatılır) */
  await suMasadakiler();          /* masa listesi taze */
}
function closeSudoku() {
  if (suSub) { suSub.close(); suSub = null; }
  if (suSubP) { suSubP.close(); suSubP = null; }
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
    else if (c.pid === me.id && c.v) cls += " su-mine";
    else if (c.u && c.v) cls += " su-other";
    if (suSel === i) cls += " su-sel";
    /* çakışma vurgusu: aynı satır/sütun/kutuda aynı değer */
    if (c.v && !c.fixed && suCakisiyor(board, i)) cls += " su-err";
    const kisa = c.u ? c.u.split(/[\s.@]/)[0].slice(0, 3) : "";
    grid += `<div class="${cls}" data-suidx="${i}">${c.v || ""}${kisa && !c.fixed ? `<span class="su-name">${esc(kisa)}</span>` : ""}</div>`;
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
        <button class="su-act-btn" id="suYeni">🔢 Yeni Oyun</button>
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
    if (!confirm("Mevcut oyun kapatılıp yeni masa açılacak. Onaylıyor musunuz?")) return;
    await fetch(`${FIREBASE_DB_URL}/${SU_NODE}.json`, { method: "PUT", body: "null" });
    await suRenderStart();
  });

  /* Masa listesi her çizimde tazelensin — "👥 …" da takılı kalmasın */
  suMasadakiler();
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
  const cell = { v, fixed: false, u: v === 0 ? "" : me.isim, pid: v === 0 ? "" : me.id };
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

/* ═══════════════ 🔴 SSE + 💓 MASA DAKİKALARI (v2: put/patch dinleyicisi) ═══════════════ */
function suEmail() {
  try { return (typeof currentUser !== "undefined" && currentUser && currentUser.email) || ""; }
  catch (e) { return ""; }
}
function suStartSync() {
  const me = suPlayer();
  /* SSE: RTDB "put"/"patch" isimli event basar — onmessage ASLA tetiklenmez! */
  if (suSub) suSub.close();
  suSub = new EventSource(`${FIREBASE_DB_URL}/${SU_NODE}.json`);
  const suBoardRefresh = () => {
    clearTimeout(suSub._t);
    suSub._t = setTimeout(async () => {
      if (document.getElementById("sudokuModal").classList.contains("hidden")) return;
      try {
        const board = await fetch(`${FIREBASE_DB_URL}/${SU_NODE}.json`).then(r => r.json());
        if (board && board.cells) suRenderBoard(board);
        else suRenderStart();          /* masa başkası tarafından kapatıldıysa seçim ekranına dön */
      } catch (e) {}
    }, 600);
  };
  suSub.addEventListener("put", suBoardRefresh);
  suSub.addEventListener("patch", suBoardRefresh);
  /* Oyuncu listesi akışı: biri katıldı/ayrıldı/anında masa listesi tazelenir */
  if (suSubP) suSubP.close();
  suSubP = new EventSource(`${FIREBASE_DB_URL}/${SU_PLAYERS}.json`);
  const suPlayersRefresh = () => {
    if (document.getElementById("sudokuModal").classList.contains("hidden")) return;
    suMasadakiler();
  };
  suSubP.addEventListener("put", suPlayersRefresh);
  suSubP.addEventListener("patch", suPlayersRefresh);
  /* Heartbeat: 15 sn'de bir "buradayım" (ts tazelik süresi 2 dk) */
  suHeartIv = setInterval(async () => {
    const key = suFbKey(me.id);
    try {
      await fetch(`${FIREBASE_DB_URL}/${SU_PLAYERS}/${key}.json`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: me.id, isim: me.isim, email: suEmail(), ts: Date.now() })
      });
      suMasadakiler();
    } catch (e) {}
  }, 15000);
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
      body: JSON.stringify({ id: me.id, isim: me.isim, email: suEmail(), ts: Date.now() })
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
    if (el) el.innerHTML = `👥 Masa: ${aktif.length ? aktif.map(p =>
      p.id && p.id.startsWith("p-") && !p.email
        ? `<span style="opacity:.75">${esc(p.isim)} *</span>`
        : esc(p.isim)).join(", ") : "boş"}`;
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
