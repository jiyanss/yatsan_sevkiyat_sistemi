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
let suDurum = null;      /* son bilinen masa status'ü — "active → done" geçişi kutlamayı tetikler */
let suKutlamaZam = null; /* kutlama açıkken dolu + 15 sn kapanış zamanlayıcısı */
let suKutlamaSayIv = null; /* kutlama geri sayım aralığı */

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
  suKutlamaKapat();               /* 🎉 kutlama da ekranla birlikte kapanır */
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
    suDurum = null;             /* masa yok → status tabanı sıfırlanır */
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
        if (body) { suSel = -1; await suTahtaGeldi(body); }
      }));
    return;
  }
  await suTahtaGeldi(board);   /* açılışta status tabanı kurulur — eski "done" kutlama patlatmaz */
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

/* ═══════════════ 🎉 KUTLAMA (15 sn) ═══════════════ */
/* Tahta her geldiğinde status tabanını günceller; "active → done" geçişini
   yakalayıp kutlamayı ateşler (yalnız taze bitişse — 60 sn penceresi). */
async function suTahtaGeldi(board) {
  const onceki = suDurum;
  suDurum = (board && board.status) || "";
  await suRenderBoard(board);
  if (board && board.status === "done" && onceki === "active" &&
      board.finishedTs && Date.now() - board.finishedTs < 60000) {
    suKutlama(board);
  }
}
function suKutlamaStil() {
  if (document.getElementById("suKutlamaStil")) return;
  const st = document.createElement("style");
  st.id = "suKutlamaStil";
  st.textContent = `
#suKutlama{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;pointer-events:none}
.su-konfeti{position:absolute;top:-24px;border-radius:2px;opacity:.92;animation:suDus linear infinite}
@keyframes suDus{0%{transform:translateY(-6vh) rotate(0)}100%{transform:translateY(112vh) rotate(760deg)}}
.su-emoji{position:absolute;font-size:34px;animation:suUcus 2.4s ease-in-out infinite alternate}
@keyframes suUcus{from{transform:translateY(0) rotate(-8deg)}to{transform:translateY(-26px) rotate(9deg)}}
.su-kart{pointer-events:auto;position:relative;background:#fff;border-radius:20px;padding:26px 36px 20px;text-align:center;box-shadow:0 20px 60px rgba(15,23,42,.42);max-width:min(92vw,420px);animation:suZipla .7s cubic-bezier(.18,1.4,.4,1) both}
@keyframes suZipla{0%{transform:scale(.3) rotate(-4deg);opacity:0}55%{transform:scale(1.07) rotate(1deg);opacity:1}100%{transform:scale(1) rotate(0)}}
.su-kart .su-kapat{position:absolute;top:6px;right:10px;border:none;background:none;font-size:16px;cursor:pointer;color:#94a3b8;padding:4px}
.su-kart .su-kapat:hover{color:#334155}
.su-buyuk{font-size:28px;font-weight:800;letter-spacing:.5px;margin-top:2px;background:linear-gradient(90deg,#f43f5e,#f59e0b,#8b5cf6);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
@keyframes suFadeOutK{to{opacity:0}}`;
  document.head.appendChild(st);
}
/* Minik zafer fanfarı (WebAudio — dış dosya yok, sessizce başarısız olabilir) */
function suFanfar() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    suFanfar.ctx = suFanfar.ctx || new AC();
    const ctx = suFanfar.ctx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const notalar = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notalar.forEach((f, i) => {
      const t0 = ctx.currentTime + i * 0.16;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = "triangle"; osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i === notalar.length - 1 ? 0.7 : 0.22));
      osc.connect(g).connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.8);
    });
  } catch (e) {}
}
function suKutlama(board) {
  if (suKutlamaZam) return;                       /* zaten kutlanıyor */
  if (!board || typeof board !== "object") board = suBoard || {};
  suKutlamaStil();
  const eski = document.getElementById("suKutlama");
  if (eski) eski.remove();
  clearInterval(suKutlamaSayIv);
  const renkler = ["#f43f5e","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899","#facc15"];
  let konf = "";
  for (let i = 0; i < 130; i++) {
    const sure = 2.6 + Math.random() * 2.4;
    konf += `<span class="su-konfeti" style="left:${(Math.random() * 100).toFixed(1)}%;` +
      `background:${renkler[i % renkler.length]};` +
      `width:${6 + Math.round(Math.random() * 7)}px;height:${9 + Math.round(Math.random() * 8)}px;` +
      `animation-duration:${sure.toFixed(2)}s;animation-delay:-${(Math.random() * sure).toFixed(2)}s"></span>`;
  }
  const emojiler = ["🎉","🏆","🎈","✨","🎊","🥳"];
  let emj = "";
  emojiler.forEach((e, i) => {
    emj += `<span class="su-emoji" style="left:${8 + i * 16}%;top:${12 + (i % 3) * 22}%;animation-delay:-${(i * 0.37).toFixed(2)}s">${e}</span>`;
  });
  const me = suPlayer();
  const benim = board.winner && me.isim && board.winner === me.isim;
  const kim = benim ? "Son hücreyi <b>sen</b> koydun!" : `🏆 <b>${esc(board.winner || "?")}</b> son hücreyi koydu!`;
  const dz = board.puzzle != null && SU_PUZZLES[board.puzzle] ? SU_PUZZLES[board.puzzle].d : "";
  const sureTxt = board.finishedTs && board.startedTs
    ? fmtSure(Math.max(0, board.finishedTs - board.startedTs)) : "";
  const katTxt = (board.katkilar || []).join(", ");
  const ov = document.createElement("div");
  ov.id = "suKutlama";
  ov.innerHTML = `<div style="position:absolute;inset:0;overflow:hidden">${konf}${emj}</div>
    <div class="su-kart">
      <button class="su-kapat" title="Kapat">✕</button>
      <div style="font-size:46px;line-height:1.1">🎉</div>
      <div class="su-buyuk">${benim ? "TEBRİKLER!" : "ÇÖZÜLDÜ!"}</div>
      <div style="font-size:16px;margin-top:8px">${kim}</div>
      <div style="font-size:14px;color:#475569;margin-top:8px">⏱ ${sureTxt || "—"}${dz ? ` · 🧩 ${esc(dz)}` : ""}</div>
      ${katTxt ? `<div style="font-size:13px;color:#64748b;margin-top:6px">Katkılar: ${esc(katTxt)}</div>` : ""}
      <div style="font-size:12px;color:#94a3b8;margin-top:12px" id="suKutlamaSayac">⏳ 15 sn</div>
    </div>`;
  document.body.appendChild(ov);
  try { navigator.vibrate && navigator.vibrate([90, 60, 90, 60, 180]); } catch (e) {}
  suFanfar();
  let kalan = 15;
  suKutlamaSayIv = setInterval(() => {
    kalan--;
    const s = document.getElementById("suKutlamaSayac");
    if (s && kalan > 0) s.textContent = `⏳ ${kalan} sn`;
  }, 1000);
  suKutlamaZam = setTimeout(suKutlamaKapat, 15000);   /* tam 15 sn */
}
function suKutlamaKapat() {
  if (!suKutlamaZam) return;
  clearTimeout(suKutlamaZam);
  suKutlamaZam = null;
  clearInterval(suKutlamaSayIv);
  const ov = document.getElementById("suKutlama");
  if (ov) { ov.style.animation = "suFadeOutK .45s ease forwards"; setTimeout(() => ov.remove(), 500); }
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
/* 🛡 Tazelik kalkanı: yazım öncesi masanın hâlâ bildiğimiz oyun olup olmadığı
   kontrol edilir (ufak/ucuz bir GET). Masa yenilendiyse yazım iptal + tazele. */
async function suTazelikKontrol() {
  try {
    const ts = await fetch(`${FIREBASE_DB_URL}/${SU_NODE}/startedTs.json`).then(r => r.json());
    if (!ts || Number(ts) !== Number(suBoard.startedTs)) {
      showToast("♻️ Masa bu arada yenilendi — tahta tazeleniyor…");
      suSel = -1;
      const fresh = await fetch(`${FIREBASE_DB_URL}/${SU_NODE}.json`).then(r => r.json());
      if (fresh && fresh.cells && fresh.schema === SU_SCHEMA) await suTahtaGeldi(fresh);
      else await suRenderStart();
      return false;
    }
  } catch (e) { /* ağ hatasında akış kesilmesin */ }
  return true;
}
async function suYaz(v) {
  if (suSel < 0 || !suBoard || suBoard.status === "done") return;
  if (suBoard.cells[suSel] && suBoard.cells[suSel].fixed) return;
  if (!(await suTazelikKontrol())) return;   /* 🛡 masa değişmişse yazma */
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
  suDurum = "done";
  board.status = "done"; board.finishedTs = finishedTs;   /* bitti bandı anında görünsün */
  board.winner = suPlayer().isim; board.katkilar = katkilar;
  await suRenderBoard(board);
  suKutlama(board);                /* 🎉 kazanan için anında 15 sn kutlama */
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
          await suTahtaGeldi(board);   /* active→done geçişi burada yakalanır → 🎉 */
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
