/* ═══════════════ 🔢 SUDOKU — ORTAK MASA (v2.0) ═══════════════
   v2.0 düzeltmeleri (Task 20):
   1) CANLI SENKRON: RTDB REST akışı "put"/"patch" adlı event yollar;
      eski kod onmessage dinliyordu → ASLA tetiklenmiyordu. Bu yüzden
      diğer oyuncuların hamleleri ve masa değişimleri canlı görünmüyordu.
   2) BULMACA HAVUZU: eski havuzun 6 bulmacasından 5'i hatalıydı
      (3'ü çözülemez-çelişkili, 1'inin kayıtlı çözümü yanlış, 1'inin
      2 çözümü var) → oyun asla bitmezdi, tahta çakışmalarla dolardı.
      Yeni havuz programatik üretildi + tek çözümlülüğü doğrulandı.
   3) MASA LİSTESİ: her yeniden çizimde "👥 …" sıfırlanıyordu;
      artık önbellekten anında çizilir + her çizimden sonra tazelenir.
   4) ŞEMA KORUMASI: eski sürümün bozuk havuzundan kalan tahtalar
      otomatik temizlenip yeni oyun ekranı gösterilir (schema: 2).
   5) İSİM: girişli kullanıcıların adı hesaptan otomatik alınır
      (eski sürümde düşmüştü, hücre etiketleri boş kalıyordu).
   6) BİTİŞ: tahta doluysa her istemci bitiş kontrolünü tetikleyebilir
      (yazan tarafın isteği başarısız olsa bile oyun kapanır).       */
const SU_NODE = "sudoku_board";
const SU_PLAYERS = "sudoku_players";
const SU_HIST = "sudoku_history";
const SU_PLAYER_KEY = "sevkiyat_sudoku_player";
const SU_SCHEMA = 2;              /* tahta şema sürümü — eskisi otomatik temizlenir */
let suSub = null;        /* EventSource */
let suHeartIv = null;
let suTimerIv = null;
let suSel = -1;          /* seçili hücre index 0..80 */
let suMe = null;         /* { id, isim } */
let suMasaCache = [];    /* son bilinen masa listesi (yeniden çizimde kaybolmaz) */

/* ---- Doğrulanmış bulmaca havuzu (0 = boş; her p tek çözümlü, s = p'nin çözümü) ---- */
const SU_PUZZLES = [
  { d: "Kolay",
    p: "602091005300820000700400829000640100204010396816970542100060058098207000500109070",
    s: "682791435349825761751436829935642187274518396816973542127364958498257613563189274" },
  { d: "Kolay",
    p: "003006079700019830908753400576000082820090743300270000047500090100904067209007050",
    s: "413826579752419836968753421576341982821695743394278615647532198135984267289167354" },
  { d: "Orta",
    p: "861034000402050803503002490000205060000470389740003500080000932005000008000000007",
    s: "861934275492657813573182496318295764256471389749863521187546932635729148924318657" },
  { d: "Orta",
    p: "094102630603005800015369020200031050008006001007024000071000902000903000006007000",
    s: "794182635623475819815369724269731458438596271157824396371658942582943167946217583" },
  { d: "Zor",
    p: "600010005089000300005400708000059000010030060054100007070000603002000000403620001",
    s: "647813295189572346325496718736259184918734562254168937871945623562381479493627851" },
  { d: "Zor",
    p: "013000080000591000527000600000060020080103090000009000000705031700906004201800000",
    s: "913672485864591372527348619395467128482153796176289543649725831738916254251834967" }
];

function suPlayer() {
  if (suMe) return suMe;
  let g = null;
  try { g = JSON.parse(localStorage.getItem(SU_PLAYER_KEY)); } catch (e) {}
  if (!g || !g.id) {
    g = { id: "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), isim: "" };
  }
  suMe = g;
  localStorage.setItem(SU_PLAYER_KEY, JSON.stringify(g));
  return g;
}
/* Girişlilerde isim hesaptan gelir; misafir ilk kez masaya girerken isim sorulur */
function suIsimSor() {
  return new Promise(resolve => {
    const me = suPlayer();
    if (typeof currentUser !== "undefined" && currentUser && currentUser.email) {
      const oto = String(currentUser.email).split("@")[0];
      if (oto && (!me.isim || !me.isim.trim())) {
        me.isim = oto.slice(0, 20);
        localStorage.setItem(SU_PLAYER_KEY, JSON.stringify(me));
      }
    }
    if ((me.isim && me.isim.trim()) || currentUser) { resolve(me.isim); return; }
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
  suStartSync();                  /* önce akış kur — açılış sırasında gelen değişim kaçmasın */
  await suRenderStart();          /* tahtayı çekip çizer */
  await suMasadakiler();          /* masa listesi taze */
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

/* Açılış ekranı: geçerli tahta varsa direkt masaya, yoksa Yeni Oyun */
async function suRenderStart() {
  const b = document.getElementById("sudokuBody");
  b.innerHTML = `<p class="hint">Tahta kontrol ediliyor…</p>`;
  let board;
  try { board = await fetch(`${FIREBASE_DB_URL}/${SU_NODE}.json`).then(r => r.json()); }
  catch (e) { b.innerHTML = `<p class="hint">Yüklenemedi: ${esc(e.message)}</p>`; return; }
  const eskiTahta = board && board.cells && board.schema !== SU_SCHEMA;
  if (!board || !board.cells || eskiTahta) {
    const uyari = eskiTahta
      ? `<p class="hint" style="color:var(--red)">🧹 Masada eski sürümden kalma bir oyun vardı (o havuzdaki bulmacalar hatalıydı, tamamlanamıyordu). Aşağıdan yeni bulmaca seçin.</p>`
      : ``;
    b.innerHTML = `
      <div style="text-align:center;padding:14px 0">
        <div style="font-size:44px">🔢</div>
        <p style="font-weight:700">${eskiTahta ? "Masa tazelenecek — yeni ortak oyun açın." : "Açık oyun yok — yeni bir ortak masa açın."}</p>
        <p class="hint">Açan kişi bulmacayı seçer, katılan herkes birlikte çözer. Bittiğinde süre ve katkılar duyurulur.</p>
        ${uyari}
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          ${SU_PUZZLES.map((p, i) => `<button class="btn ${i === 0 ? "primary" : ""}" data-sunew="${i}">${esc(p.d)}</button>`).join("")}
        </div>
      </div>`;
    b.querySelectorAll("[data-sunew]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const body = await suYeniOyun(Number(btn.dataset.sunew));
        if (body) { suSel = -1; await suRenderBoard(body); }
      }));
    return;
  }
  await suRenderBoard(board);
}
async function suYeniOyun(pIdx) {
  const p = SU_PUZZLES[pIdx];
  if (!p) return null;
  const cells = {};
  for (let i = 0; i < 81; i++) {
    cells[i] = { v: Number(p.p[i]) || 0, fixed: (Number(p.p[i]) || 0) > 0, u: "" };
  }
  const body = {
    schema: SU_SCHEMA, puzzle: pIdx, cells,
    solution: p.s, startedTs: Date.now(), status: "active",
    createdBy: suPlayer().isim
  };
  await fetch(`${FIREBASE_DB_URL}/${SU_NODE}.json`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  showToast("🔢 Yeni ortak masa açıldı — herkes katılabilir!");
  return body;
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
      <span class="su-players" id="suPlayers">👥 Masa: …</span>
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

  /* masa listesi: önbellekten anında çiz + arka planda tazele (artık silinmiyor) */
  suMasaCiz();
  suMasadakiler();

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

/* 🏁 Tamamlanma kontrolü — tahta çözümle birebir eşleşince oyunu kapatır.
   Yazan taraf tetikler; ayrıca canlı akışta tahta dolu görünürse herkes
   kontrol edebilir (yazanın isteği başarısız olsa bile oyun kutlanır).  */
async function suBitisKontrol() {
  const board = await fetch(`${FIREBASE_DB_URL}/${SU_NODE}.json`).then(r => r.json());
  if (!board || board.status === "done" || board.schema !== SU_SCHEMA) return;
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
function suTasiDolu(board) {
  for (let i = 0; i < 81; i++) if (!board.cells[i] || !board.cells[i].v) return false;
  return true;
}

/* ═══════════════ 🔴 SSE + 💓 MASA DAKİKALARI ═══════════════ */
function suStartSync() {
  const me = suPlayer();
  /* SSE: 🔴 KRİTİK — Firebase RTDB REST akışı "put"/"patch" ADLI event yollar.
     onmessage bu akışta ASLA tetiklenmez; eski sürüm bundan dolayı canlı
     senkron yapamıyordu. put + patch ayrıca dinlenir. */
  if (suSub) suSub.close();
  suSub = new EventSource(`${FIREBASE_DB_URL}/${SU_NODE}.json`);
  const suAkis = () => {
    clearTimeout(suSub._t);
    suSub._t = setTimeout(async () => {
      if (document.getElementById("sudokuModal").classList.contains("hidden")) return;
      try {
        const board = await fetch(`${FIREBASE_DB_URL}/${SU_NODE}.json`).then(r => r.json());
        if (board && board.cells && board.schema === SU_SCHEMA) {
          await suRenderBoard(board);
          /* emniyet ağı: tahta doluysa bitiş kontrolü herkes tarafından koşabilir */
          if (board.status !== "done" && suTasiDolu(board)) suBitisKontrol();
        } else if (!board) {
          await suRenderStart();   /* masa sıfırlandı → seçim ekranı herkeste canlı açılır */
        }
        /* eski şema tahtalar akışta yok sayılır (açılışta temizlenir) */
      } catch (e) {}
    }, 500);
  };
  suSub.addEventListener("put", suAkis);
  suSub.addEventListener("patch", suAkis);
  /* Heartbeat: 20 sn'de bir "buradayım" + masadakileri tazele */
  suHeartIv = setInterval(async () => {
    try {
      await fetch(`${FIREBASE_DB_URL}/${SU_PLAYERS}/${suFbKey(me.id)}.json`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: me.id, isim: me.isim, ts: Date.now() })
      });
    } catch (e) {}
    suMasadakiler();
  }, 20000);
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
    const aktif = Object.values(players)
      .filter(p => p && p.isim && simdi - (p.ts || 0) < 90000)
      .sort((a, b) => (a.ts || 0) - (b.ts || 0));
    suMasaCache = aktif;
    suMasaCiz();
    /* 90 sn sessiz olanları temizle */
    Object.keys(players).forEach(k => {
      if (!players[k] || simdi - (players[k].ts || 0) >= 90000)
        fetch(`${FIREBASE_DB_URL}/${SU_PLAYERS}/${k}.json`, { method: "DELETE" });
    });
  } catch (e) {}
}
/* Masa listesini önbellekten çizer — her yeniden çizimde kaybolmaz */
function suMasaCiz() {
  const el = document.getElementById("suPlayers");
  if (!el) return;
  el.innerHTML = `👥 Masa: ${suMasaCache.length ? suMasaCache.map(p => esc(p.isim)).join(", ") : "boş"}`;
}

/* Klavye: sudoku açıkken 1-9 yaz, 0/Backspace temizle */
document.addEventListener("keydown", e => {
  const ov = document.getElementById("sudokuModal");
  if (!ov || ov.classList.contains("hidden")) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (/^[1-9]$/.test(e.key)) { e.preventDefault(); suYaz(Number(e.key)); }
  else if (e.key === "0" || e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); suYaz(0); }
});
