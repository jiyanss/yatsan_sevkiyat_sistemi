/* ================= 🧠 BİLGİ YARIŞMASI ================= */
let quizQuestions = [];
let quizRun = null;
let quizTimerIv = null;

function loadQuizQuestions() {
  return fetch(`${FIREBASE_DB_URL}/${QUIZ_NODE}.json`).then(r => r.json())
    .then(data => data ? Object.entries(data).map(([id, v]) => ({ id, ...(v || {}) })) : []);
}
/* 🔔 Bildirim ding sesi — quiz sndOk'tan bağımsız, kısa ve yumuşak */
/* 🔔 Bildirim ding sesi — tek AudioContext, mobil uyumlu */
let _audioCtx = null;
function bildirimDing() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    const o = _audioCtx.createOscillator(), g = _audioCtx.createGain();
    o.connect(g); g.connect(_audioCtx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(880, _audioCtx.currentTime);
    o.frequency.setValueAtTime(1320, _audioCtx.currentTime + 0.08);
    g.gain.setValueAtTime(0.001, _audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, _audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.35);
    o.start(); o.stop(_audioCtx.currentTime + 0.4);
  } catch (e) {}
}
/* İlk kullanıcı etkileşiminde ses motorunu aç (mobil/iOS unlock) */
["click", "touchstart", "keydown"].forEach(ev =>
  document.addEventListener(ev, () => {
    try {
      if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (_audioCtx.state === "suspended") _audioCtx.resume();
    } catch (e) {}
  }, { passive: true }));

function sndOk() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(); const g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = .08; o.start(); o.stop(a.currentTime + .12); } catch (e) {} }
function sndErr() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(); const g = a.createGain(); o.connect(g); g.connect(a.destination); o.type = "square"; o.frequency.value = 160; g.gain.value = .06; o.start(); o.stop(a.currentTime + .2); } catch (e) {} }

/* ═══════════════ 🧠 Quiz — kimlik, oyun kaydı, dönem liderlikleri ═══════════════ */
function quizKimlik() {
  if (currentUser) return { tip: "email", id: currentUser.email, isim: shortUser(currentUser.email) };
  let g = null;
  try { g = JSON.parse(localStorage.getItem(QUIZ_GUEST_KEY)); } catch (e) {}
  if (!g || !g.id) g = { id: "g-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), isim: "" };
  return { tip: "guest", id: g.id, isim: (g.isim || "").trim() };
}
function quizIsimKaydet(isim) {
  const k = quizKimlik();
  if (k.tip !== "guest") return;
  try {
    const g = JSON.parse(localStorage.getItem(QUIZ_GUEST_KEY)) || { id: k.id };
    g.isim = String(isim).trim().slice(0, 30);
    localStorage.setItem(QUIZ_GUEST_KEY, JSON.stringify(g));
  } catch (e) {}
}
function haftaBaslangicTs(d = new Date()) {
  const gun = (d.getDay() + 6) % 7; /* Pazartesi = 0 */
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - gun).getTime();
}
function ayBaslangicTs(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
let quizGamesCache = null;
async function quizGamesYukle(force = false) {
  if (!force && quizGamesCache) return quizGamesCache;
  const res = await fetch(`${FIREBASE_DB_URL}/${QUIZ_GAMES_NODE}.json`);
  const data = await res.json();
  quizGamesCache = data ? Object.values(data) : [];
  return quizGamesCache;
}
function periyotFiltre(games, per) {
  if (per === "tum") return games;
  const bas = per === "hafta" ? haftaBaslangicTs() : ayBaslangicTs();
  return games.filter(g => (g.ts || 0) >= bas);
}
function liderlikHesapla(games) {
  const m = new Map();
  games.forEach(g => {
    if (!g.oyuncu || !g.oyuncu.id) return;
    if (!m.has(g.oyuncu.id)) m.set(g.oyuncu.id,
      { id: g.oyuncu.id, isim: g.oyuncu.isim || shortUser(g.oyuncu.email || g.oyuncu.id), best: null, games: 0 });
    const p = m.get(g.oyuncu.id);
    if (g.oyuncu.isim) p.isim = g.oyuncu.isim;
    p.games++;
    if (!p.best || (g.correct || 0) > p.best.correct ||
        ((g.correct || 0) === p.best.correct && (g.timeMs || 9e15) < (p.best.timeMs || 9e15))) {
      p.best = { correct: g.correct || 0, total: g.total || 10, timeMs: g.timeMs || 0 };
    }
  });
  return [...m.values()].sort((a, b) =>
    (b.best.correct - a.best.correct) ||
    ((a.best.timeMs || 9e15) - (b.best.timeMs || 9e15)) ||
    (b.games - a.games));
}
let quizLbTab = "hafta";
function lbTabHtml() {
  const t = (k, lbl) => `<button class="btn ${quizLbTab === k ? "primary" : ""}" data-lbt="${k}" style="flex:1">${lbl}</button>`;
  return `<div style="display:flex;gap:6px;margin:10px 0">
    ${t("hafta", "🗓️ Hafta")}${t("ay", "📆 Ay")}${t("tum", "♾️ Tüm Zamanlar")}</div>`;
}
function lbTabloHtml(list, benimId) {
  if (!list.length) return `<p class="hint">Bu dönemde henüz skor yok — ilk sen ol!</p>`;
  return `<div class="rpt"><div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Oyuncu</th><th class="center">Doğru</th><th class="center">Süre</th><th class="center">Oyun</th></tr></thead>
    <tbody>${list.map((s, i) => `<tr class="${s.id === benimId ? "priority" : ""}">
      <td>${["🥇","🥈","🥉"][i] || (i + 1)}</td>
      <td class="strong">${esc(s.isim)}${s.id?.startsWith("g-") ? ' <span class="muted" style="font-size:9px">misafir</span>' : ""}</td>
      <td class="center">${s.best.correct}/${s.best.total}</td>
      <td class="center">${fmtSure(s.best.timeMs || 0)}</td>
      <td class="center">${s.games}</td></tr>`).join("")}</tbody>
  </table></div></div>`;
}


function openQuiz() {
  document.getElementById("quizModal").classList.remove("hidden");
  quizLoadAndRenderStart();
}
async function quizLoadAndRenderStart() {
  const body = document.getElementById("quizBody");
  body.innerHTML = `<p class="hint">Sorular yükleniyor…</p>`;
  try { quizQuestions = await loadQuizQuestions(); }
  catch (e) { body.innerHTML = `<p class="hint">Sorular yüklenemedi: ${esc(e.message)}</p>`; return; }
  if (!quizQuestions.length) {
    body.innerHTML = `<p class="hint">Henüz soru yok — admin panelde 🧠 Quiz Soru Yönetimi bölümünden ekle.</p>`;
    return;
  }
  const k = quizKimlik();
  const isimKutusu = k.tip === "guest"
    ? `<input id="qzGuestName" placeholder="✍️ Yarışmacı adın (skor tablosunda görünür)" maxlength="30"
        value="${esc(k.isim)}" style="width:100%;padding:10px 12px;font-size:14px;text-align:center" />
       <p class="hint" style="margin:6px 0 0">Giriş yapmadan oynuyorsun — adını yaz, skorun bu isimle kaydedilir ve cihazında saklanır.</p>`
    : `<p class="hint" style="margin:6px 0">👤 <b>${esc(k.isim)}</b> olarak oynuyorsun.</p>`;
  body.innerHTML = `
    <div style="text-align:center;padding:8px 0">
      <div style="font-size:44px">🧠</div>
      <p style="font-weight:700;font-size:15px;margin:8px 0 4px">Havuzda ${quizQuestions.length} soru · her turda rastgele 10 soru</p>
      <p class="hint">Her soru için 20 saniye · süre biterse yanlış sayılır</p>
      ${isimKutusu}
      <button class="btn primary" id="btnQuizStart" style="width:100%;padding:12px;margin-top:10px">▶️ Başla</button>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn" id="btnQuizLb" style="flex:1">🏆 Liderlik</button>
        <button class="btn" id="btnQuizStats" style="flex:1">📊 İstatistiklerim</button>
      </div>
    </div>`;
  body.querySelector("#btnQuizStart").addEventListener("click", () => {
    if (quizKimlik().tip === "guest") {
      const v = body.querySelector("#qzGuestName").value.trim();
      if (!v) { alert("Yarışmacı adını yaz — skorun bu isimle kaydedilir."); return; }
      quizIsimKaydet(v);
    }
    startQuizRun();
  });
  body.querySelector("#btnQuizLb").addEventListener("click", () => renderLeaderboard(body));
  body.querySelector("#btnQuizStats").addEventListener("click", () => renderQuizStats(body));
}
function startQuizRun() {
  const shuffled = [...quizQuestions].sort(() => Math.random() - .5).slice(0, Math.min(10, quizQuestions.length));
  quizRun = { qs: shuffled, idx: 0, correct: 0, timeMs: 0, answered: false };
  renderQuizQuestion();
}
function renderQuizQuestion() {
  const body = document.getElementById("quizBody");
  const r = quizRun, q = r.qs[r.idx];
  r.answered = false;
  r.qStartTs = Date.now();
  r.remain = 20;
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <b>Soru ${r.idx + 1} / ${r.qs.length}</b>
      <span style="color:var(--green);font-weight:700">✔ ${r.correct}</span>
    </div>
    <div class="qz-timerbar"><div id="qzTimerFill"></div></div>
    <div style="text-align:center;font-size:11px;color:var(--muted);margin-bottom:8px"><b id="qzTimerTxt">20</b> sn</div>
    <div class="qz-question">${esc(q.q)}</div>
    <div class="qz-opts">
      ${q.opts.map((o, i) => `<button class="qz-opt" data-qopt="${i}"><b>${"ABCD"[i]}</b> · ${esc(o)}</button>`).join("")}
    </div>
    <div id="qzFeedback"></div>`;
  body.querySelectorAll("[data-qopt]").forEach(b =>
    b.addEventListener("click", () => quizAnswer(Number(b.dataset.qopt))));
  clearInterval(quizTimerIv);
  quizTimerIv = setInterval(() => {
    r.remain -= 0.1;
    const fill = document.getElementById("qzTimerFill");
    if (!fill) { clearInterval(quizTimerIv); return; }
    fill.style.width = Math.max(0, r.remain / 20 * 100) + "%";
    fill.classList.toggle("low", r.remain <= 5);
    const txt = document.getElementById("qzTimerTxt");
    if (txt) txt.textContent = Math.max(0, Math.ceil(r.remain));
    if (r.remain <= 0) { clearInterval(quizTimerIv); quizAnswer(-1); }
  }, 100);
}
function quizAnswer(i) {
  const r = quizRun;
  if (!r || r.answered) return;
  r.answered = true;
  clearInterval(quizTimerIv);
  const q = r.qs[r.idx];
  const ok = i === q.c;
  if (ok) { r.correct++; sndOk(); } else sndErr();
  r.timeMs += Date.now() - r.qStartTs;
  document.querySelectorAll("#quizBody [data-qopt]").forEach(b => {
    b.disabled = true;
    const bi = Number(b.dataset.qopt);
    if (bi === q.c) b.classList.add("correct");
    else if (bi === i) b.classList.add("wrong");
  });
  const fb = document.getElementById("qzFeedback");
  fb.innerHTML = `
    <div class="islem-done" style="background:${ok ? "var(--green-soft)" : "var(--red-soft)"};border-color:${ok ? "var(--green)" : "var(--red)"};color:${ok ? "var(--green)" : "var(--red)"}">
      ${i === -1 ? "⏰ Süre bitti!" : ok ? "✅ Doğru!" : "❌ Yanlış"}
    </div>
    ${q.info ? `<p class="hint">💡 ${esc(q.info)}</p>` : ""}
    <button class="btn primary" id="btnQzNext" style="width:100%;padding:10px">${r.idx + 1 < r.qs.length ? "Sonraki Soru →" : "Sonucu Gör 🏁"}</button>`;
  fb.querySelector("#btnQzNext").addEventListener("click", () => {
    r.idx++;
    if (r.idx < r.qs.length) renderQuizQuestion();
    else finishQuiz();
  });
}
async function finishQuiz() {
  const r = quizRun;
  clearInterval(quizTimerIv);
  const body = document.getElementById("quizBody");
  const pct = Math.round(r.correct / r.qs.length * 100);
  body.innerHTML = `<p class="hint">Skor işleniyor…</p>`;
  const k = quizKimlik();
  let savedMsg = "";
  if (k.tip === "guest" && !k.isim) {
    savedMsg = "İsimsiz oynadın — skor kaydedilmedi. Başla ekranında adını yaz.";
  } else {
    try {
      const res = await fetch(`${FIREBASE_DB_URL}/${QUIZ_GAMES_NODE}.json`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ts: Date.now(),
          oyuncu: { tip: k.tip, id: k.id, isim: k.isim, email: k.tip === "email" ? k.id : "" },
          correct: r.correct, total: r.qs.length, timeMs: r.timeMs
        })
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      quizGamesCache = null;
      savedMsg = "✅ Skor kaydedildi — haftalık/aylık liderliğe işlendi.";
    } catch (e) { savedMsg = "Skor kaydedilemedi: " + e.message; }
  }
  const madalya = pct === 100 ? "🏆" : pct >= 70 ? "🥇" : pct >= 40 ? "🥈" : "🥉";
  body.innerHTML = `
    <div style="text-align:center;padding:6px 0">
      <div style="font-size:52px">${madalya}</div>
      <div style="font-size:30px;font-weight:800">${r.correct} / ${r.qs.length}</div>
      <div class="hint">%${pct} doğruluk · toplam süre ${fmtSure(r.timeMs)}</div>
      <p class="hint">${savedMsg}</p>
      <div id="qzMiniLb"></div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn primary" id="btnQzAgain" style="flex:1;padding:12px">🔁 Tekrar Oyna</button>
        <button class="btn" id="btnQzLb2" style="flex:1">🏆 Liderlik</button>
        <button class="btn" id="btnQzSt2" style="flex:1">📊 İstatistik</button>
      </div>
    </div>`;
  body.querySelector("#btnQzAgain").addEventListener("click", startQuizRun);
  body.querySelector("#btnQzLb2").addEventListener("click", () => renderLeaderboard(body));
  body.querySelector("#btnQzSt2").addEventListener("click", () => renderQuizStats(body));
  /* Bu haftanın ilk 5'i — küçük önizleme */
  try {
    const games = periyotFiltre(await quizGamesYukle(), "hafta");
    const top5 = liderlikHesapla(games).slice(0, 5);
    document.getElementById("qzMiniLb").innerHTML =
      `<p class="hint" style="margin:10px 0 4px">🗓️ Bu hafta ilk 5</p>` + lbTabloHtml(top5, k.id);
  } catch (e) {}
}
async function renderLeaderboard(container) {
  container.innerHTML = `<p class="hint">🏆 Liderlik yükleniyor…</p>`;
  let games;
  try { games = await quizGamesYukle(); }
  catch (e) { container.innerHTML = `<p class="hint">Liderlik yüklenemedi: ${esc(e.message)}</p>`; return; }
  const k = quizKimlik();
  const ciz = () => {
    const list = liderlikHesapla(periyotFiltre(games, quizLbTab)).slice(0, 10);
    container.innerHTML = `<div class="rpt"><h3>🏆 En İyi 10 — ${
      { hafta: "bu hafta", ay: "bu ay", tum: "tüm zamanlar" }[quizLbTab]}</h3>
      ${lbTabHtml()}${lbTabloHtml(list, k.id)}
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn" id="btnLbGeri" style="flex:1">↩ Başla ekranı</button>
        <button class="btn" id="btnLbStats" style="flex:1">📊 İstatistiklerim</button>
      </div></div>`;
    container.querySelectorAll("[data-lbt]").forEach(b =>
      b.addEventListener("click", () => { quizLbTab = b.dataset.lbt; ciz(); }));
    container.querySelector("#btnLbGeri").addEventListener("click", quizLoadAndRenderStart);
    container.querySelector("#btnLbStats").addEventListener("click", () => renderQuizStats(container));
  };
  ciz();
}
async function renderQuizStats(container) {
  container.innerHTML = `<p class="hint">📊 İstatistikler yükleniyor…</p>`;
  const k = quizKimlik();
  let games;
  try { games = (await quizGamesYukle()).filter(g => g.oyuncu && g.oyuncu.id === k.id); }
  catch (e) { container.innerHTML = `<p class="hint">Yüklenemedi: ${esc(e.message)}</p>`; return; }
  if (!games.length) {
    container.innerHTML = `<div class="rpt"><p class="hint">Henüz oyunun yok — ▶️ Başla ile ilk turunu oyna.</p>
      <button class="btn" id="btnStGeri" style="width:100%">↩ Başla ekranı</button></div>`;
    container.querySelector("#btnStGeri").addEventListener("click", quizLoadAndRenderStart);
    return;
  }
  games.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const best = games.reduce((m, g) =>
    !m || (g.correct > m.correct) || (g.correct === m.correct && (g.timeMs || 9e15) < (m.timeMs || 9e15)) ? g : m, null);
  const ortAcc = Math.round(games.reduce((s, g) => s + (g.total ? g.correct / g.total * 100 : 0), 0) / games.length);
  const toplamSure = games.reduce((s, g) => s + (g.timeMs || 0), 0);
  const haftaBest = liderlikHesapla(periyotFiltre(games, "hafta"))[0];
  const kpi = `<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">
    <div class="kpi c-primary"><div class="kpi-head">🎮 Oyun</div><div class="kpi-val">${games.length}</div><div class="kpi-sub">toplam ${fmtSure(toplamSure)}</div></div>
    <div class="kpi c-green"><div class="kpi-head">🏅 En iyi</div><div class="kpi-val">${best.correct}/${best.total}</div><div class="kpi-sub">${fmtSure(best.timeMs || 0)} · ${fmtDateTime(best.ts)}</div></div>
    <div class="kpi c-amber"><div class="kpi-head">🎯 Ort. doğruluk</div><div class="kpi-val">%${ortAcc}</div><div class="kpi-sub">${games.length} tur ortalaması</div></div>
    <div class="kpi ${haftaBest ? "c-red" : ""}"><div class="kpi-head">🗓️ Hafta lideri sensin mi?</div>
      <div class="kpi-val" style="font-size:16px;align-self:center">${haftaBest ? (haftaBest.id === k.id ? "🥇 Evet!" : "—") : "—"}</div>
      <div class="kpi-sub">${haftaBest ? "bu hafta 1#: " + esc(haftaBest.isim) : "bu hafta oyun yok"}</div></div>
  </div>`;
  const son10 = games.slice(0, 10).map(g => `<tr>
    <td>${fmtDateTime(g.ts)}</td>
    <td class="center oh-strong" style="color:${g.correct >= g.total * .7 ? "var(--green)" : g.correct >= g.total * .4 ? "var(--amber)" : "var(--red)"}">${g.correct}/${g.total}</td>
    <td class="center">%${g.total ? Math.round(g.correct / g.total * 100) : 0}</td>
    <td class="center">${fmtSure(g.timeMs || 0)}</td>
  </tr>`).join("");
  container.innerHTML = `<div class="rpt">
    <p class="hint">👤 <b>${esc(k.isim)}</b> · ${k.tip === "guest" ? "misafir oyuncu (bu cihaza bağlı)" : "girişli oyuncu"}</p>
    ${kpi}
    <div class="table-wrap"><table>
      <thead><tr><th>Tarih</th><th class="center">Skor</th><th class="center">Doğruluk</th><th class="center">Süre</th></tr></thead>
      <tbody>${son10}</tbody></table></div>
    <button class="btn" id="btnStGeri" style="width:100%;margin-top:10px">↩ Başla ekranı</button></div>`;
  container.querySelector("#btnStGeri").addEventListener("click", quizLoadAndRenderStart);
}
/* --- Admin: soru yönetimi --- */
async function openQuizAdmin() {
  if (!isAdmin()) { alert("Sadece yöneticiler."); return; }
  document.getElementById("quizAdminModal").classList.remove("hidden");
  await renderQuizAdminTable();
}
async function renderQuizAdminTable() {
  const tb = document.getElementById("quizAdminTable");
  tb.innerHTML = `<tr><td colspan="3" class="empty">Yükleniyor…</td></tr>`;
  try {
    quizQuestions = await loadQuizQuestions();
    document.getElementById("quizAdminInfo").innerHTML =
      `Havuzda <b>${quizQuestions.length}</b> soru · yarışmada rastgele 10 soru sorulur.`;
    tb.innerHTML = quizQuestions.length ? quizQuestions.map(q => `<tr>
      <td>${esc(q.q)}<div class="muted" style="font-size:10px">${q.opts.map((o, i) => i === q.c ? "✅ " + esc(o) : esc(o)).join(" · ")}</div></td>
      <td class="center">${"ABCD"[q.c]}</td>
      <td class="nowrap"><button class="btn" data-qdel="${q.id}">🗑️</button></td>
    </tr>`).join("") : `<tr><td colspan="3" class="empty">Havuz boş — aşağıdan soru ekle.</td></tr>`;
    tb.querySelectorAll("[data-qdel]").forEach(b =>
      b.addEventListener("click", () => quizDeleteQuestion(b.dataset.qdel)));
  } catch (e) {
    tb.innerHTML = `<tr><td colspan="3" class="empty">Yüklenemedi: ${esc(e.message)}</td></tr>`;
  }
}
async function quizAddQuestion() {
  const q = document.getElementById("qzNewQ").value.trim();
  const opts = [0, 1, 2, 3].map(i => document.getElementById("qzNewO" + i).value.trim());
  const c = Number(document.getElementById("qzNewC").value);
  const info = document.getElementById("qzNewInfo").value.trim();
  if (!q || opts.some(o => !o)) { alert("Soru ve 4 şık doldurulmalı."); return; }
  try {
    await authFetch(`${FIREBASE_DB_URL}/${QUIZ_NODE}.json`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, opts, c, info: info || "" })
    });
    ["qzNewQ","qzNewO0","qzNewO1","qzNewO2","qzNewO3","qzNewInfo"].forEach(id => document.getElementById(id).value = "");
    showToast("✅ Soru eklendi.");
    await renderQuizAdminTable();
  } catch (e) { alert("Eklenemedi: " + e.message); }
}
async function quizDeleteQuestion(key) {
  if (!confirm("Bu soru silinsin mi?")) return;
  try {
    await authFetch(`${FIREBASE_DB_URL}/${QUIZ_NODE}/${key}.json`, { method: "DELETE" });
    showToast("🗑️ Soru silindi.");
    await renderQuizAdminTable();
  } catch (e) { alert("Silinemedi: " + e.message); }
}
/* --- Bağlantılar --- */
document.getElementById("btnQuiz").addEventListener("click", openQuiz);
document.getElementById("btnSnake").addEventListener("click", openSnakeGame);
document.getElementById("btnSnakeClose").addEventListener("click", closeSnakeGame);
document.getElementById("btnQuizClose").addEventListener("click", () => {
  clearInterval(quizTimerIv);
  document.getElementById("quizModal").classList.add("hidden");
});
document.getElementById("quizModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) { clearInterval(quizTimerIv); e.currentTarget.classList.add("hidden"); }
});
document.getElementById("btnQuizAdminOpen").addEventListener("click", openQuizAdmin);
document.getElementById("btnQuizAdminClose").addEventListener("click", () =>
  document.getElementById("quizAdminModal").classList.add("hidden"));
document.getElementById("quizAdminModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});
document.getElementById("btnQuizAdd").addEventListener("click", quizAddQuestion);

document.getElementById("btnQuizSeed").addEventListener("click", async () => {
  if (!confirm("50 hazır soru havuza eklenecek. Onaylıyor musun?")) return;
  const btn = document.getElementById("btnQuizSeed");
  btn.disabled = true; btn.textContent = "Yükleniyor…";
  const sorular = [
    { q: "40 HC konteyner hangi ölçü standartına sahiptir?", opts: ["20 feet uzunluk","40 feet uzunluk ve high cube yükseklik","45 feet uzunluk","30 feet uzunluk"], c: 1, info: "HC = High Cube; 40 feet, tavanı normalden ~30 cm yüksek." },
    { q: "Yük numarası 3 adet KOMPLE TIR ise toplam M3 kaçtır?", opts: ["180","240","270","300"], c: 2, info: "3 × 90 = 270 m³." },
    { q: "2 adet 40 HC yüklemesinin M3'ü kaçtır?", opts: ["120","140","150","160"], c: 1, info: "2 × 70 = 140 m³." },
    { q: "Parsiyel yüklemeyi belirleyen alan hangisidir?", opts: ["AD","Kategori","PRS M3","BLM"], c: 2, info: "PARSIYEL TIR'da M3 = PRS M3." },
    { q: "Bir yükleme 'Yükleniyor' durumuna geçince ne başlar?", opts: ["Fatura","Kronometre","Sigorta","Gümrük süresi"], c: 1, info: "loadingStartedAt anı kaydedilir." },
    { q: "Yükleme 'Tamamlandı' olduğunda hangi tarih otomatik yazılır?", opts: ["Reel Plan","Planlanan","Gerçekleşen","Fatura"], c: 2, info: "gerceklesenTarih, yalnızca boşsa bugüne eşitlenir." },
    { q: "EXW'de en az masrafı hangi taraf üstlenir?", opts: ["Alıcı","Satıcı","Taşıyıcı","Gümrük"], c: 1, info: "Ex Works: satıcı sadece malı fabrikada hazır eder." },
    { q: "DDP'de gümrük vergileri kime aittir?", opts: ["Alıcı","Satıcı","Taşıyıcı","Aracı"], c: 1, info: "Delivered Duty Paid: vergiler dahil teslim." },
    { q: "FCL ne demektir?", opts: ["Kısmi yükleme","Tam konteyner yükleme","Soğutmalı yük","Toplu dökme"], c: 1, info: "Full Container Load — tüm konteyner tek yükleyiciye." },
    { q: "LCL neye karşılık gelir?", opts: ["Kısmi/yığın konteyner","Tam konteyner","Hava kargo","Kara taşıması"], c: 0, info: "Less than Container Load — parsiyel mantığı." },
    { q: "Bill of Lading (B/L) hangi belgedir?", opts: ["Fatura","Eşya kabu","Gümrük beyanı","Sigorta poliçesi"], c: 1, info: "Deniz taşımacılığında eşya kabu + mülkiyet belgesi." },
    { q: "CMR hangi taşıma türüne aittir?", opts: ["Deniz","Hava","Karayolu","Demiryolu"], c: 2, info: "Uluslararası karayolu eşya taşıma senedi." },
    { q: "AWB hangi taşıma türünün senedidir?", opts: ["Deniz","Hava","Karayolu","Demiryolu"], c: 1, info: "Air Waybill." },
    { q: "ETA ne anlama gelir?", opts: ["Tahmini varış saati","Tahmini kalkış","Gümrük çıkışı","Yükleme başlangıcı"], c: 0, info: "Estimated Time of Arrival." },
    { q: "ETD ne demektir?", opts: ["Tahmini varış","Tahmini kalkış saati","Beklenen teslim","Erken çıkış"], c: 1, info: "Estimated Time of Departure." },
    { q: "Yükleme süresi aşımı neyi gösterir?", opts: ["Planlı süre aşıldı","İş kaybedildi","Trafik var","Ekstra ücret"], c: 0, info: "Süre barı kırmızıya döner." },
    { q: "Kapasite raporu hangi veriye bakar?", opts: ["Reel plan + standart süre","Fatura tarihi","Müşteri adı","Hafta numarası"], c: 0, info: "Gün bazlı gerekli ekip hesabı." },
    { q: "Standart yükleme süreleri nerede ayarlanır?", opts: ["Depo ekranı","⏱️ Süreler paneli","Takvim","Excel"], c: 1, info: "Müşteri + tip kombinasyonu bazında." },
    { q: "'Araç yok' notu ne anlama gelir?", opts: ["Yükleme bitti","Gecikme nedeni: araç temin edilemedi","Müşteri iptali","Gümrük bekliyor"], c: 1, info: "📌 butonuyla seçilir." },
    { q: "Hangi kolon 'Reel Plan'ın haftasını gösterir?", opts: ["Hafta","Ay","YIL","AD"], c: 0, info: "Hafta numarası reel plandan hesaplanır." },
    { q: "40 HC yüklemesinde 5 adet kaç m³ olur?", opts: ["300","350","400","450"], c: 1, info: "5 × 70 = 350 m³." },
    { q: "20 DC'de 3 adet kaç m³'tür?", opts: ["70","95","105","125"], c: 2, info: "3 × 35 = 105 m³." },
    { q: "KOMPLE TIR'da 4 adet kaç m³'tür?", opts: ["320","340","360","380"], c: 2, info: "4 × 90 = 360 m³." },
    { q: "Parsiyel yüklemeye AD girilse bile M3 neye göre belirlenir?", opts: ["AD × 90","PRS M3","AD × 70","Sabit 100"], c: 1, info: "Parsiyelde AD hesaba katılmaz." },
    { q: "Hafta numarası ISO standardına göre hangi gün haftanın ilk günüdür?", opts: ["Pazar","Pazartesi","Cumartesi","Salı"], c: 1, info: "ISO-8601: hafta Pazartesi başlar." },
    { q: "Eşzamanlılık koruması (freshRow) neyi önler?", opts: ["Süre aşımını","Kayıp güncellemeyi","Renk kaymasını","Excel hatasını"], c: 1, info: "Yazmadan önce taze okuma yapılır." },
    { q: "Depo ekranı varsayılan olarak hangi tarihe göre gruplar?", opts: ["Fatura","Planlanan","Reel Plan","Gerçekleşen"], c: 2, info: "Kalan Yüklemeler reel plandan gruplanır." },
    { q: "Gecikme nedeni seçimi hangi butonla yapılır?", opts: ["📌","📝","🗓️","🗑️"], c: 0, info: "Gecikmiş satırdaki pin butonu." },
    { q: "QR etiket ne işe yarar?", opts: ["Fatura yazdırma","Depoda hızlı işlem açma","Reklam","Gümrük beyanı"], c: 1, info: "Okutulunca işlem ekranı açılır." },
    { q: "Yükleme başlangıç saati nerede görünür?", opts: ["Gerçekleşen sütununda","Kategori","M3","Hafta"], c: 0, info: "Yükleniyor durumunda '08:20'de başladı' yazar." },
    { q: "Yükleme bitişi hangi veriyle kaydedilir?", opts: ["loadingEndedAt","loadingStartedAt","planlananTarih","reelPlan"], c: 0, info: "Kronometre bitiş alanı." },
    { q: "Standart süre 150dk, geçen 75dk ise yüzde kaç?", opts: ["%25","%40","%50","%60"], c: 2, info: "75/150 = %50." },
    { q: "Standart süre 120dk, geçen 180dk ise aşım kaç dakikadır?", opts: ["30","40","60","90"], c: 2, info: "180 − 120 = 60 dk." },
    { q: "Ekip günlük 9 saat çalışırsa kapasite kaç dakikadır?", opts: ["420","480","540","600"], c: 2, info: "9 × 60 = 540 dk." },
    { q: "2 ekip × 9 saat = toplam günlük dk?", opts: ["900","1000","1080","1200"], c: 2, info: "2 × 540 = 1080 dk." },
    { q: "INCOTERM'leri hangi kuruluş yayınlar?", opts: ["WTO","ICC","IATA","IMO"], c: 1, info: "Uluslararası Ticaret Odası, 2020 sürümü güncel." },
    { q: "Hangisi deniz INCOTERM'lerinden DEĞİLDİR?", opts: ["FOB","CIF","EXW","CFR"], c: 2, info: "EXW her taşıma türünde kullanılır." },
    { q: "Menşe şahadetnamesi neyi belgeler?", opts: ["Sigorta","Malın üretildiği ülke","Fiyat","Navlun"], c: 1, info: "Origin: tercihli tarife şartlarından." },
    { q: "Konteyner numarası kaç karakterden oluşur?", opts: ["6","8","11","15"], c: 2, info: "4 harf + 7 rakam = 11 karakter." },
    { q: "Reefer ne demektir?", opts: ["Açık platform","Soğutmalı konteyner","Tanker","Open top"], c: 1, info: "Soğuk zincir taşımalarında kullanılır." },
    { q: "Hangi konteyner üstten vinçle yükleme içindir?", opts: ["Open Top","Reefer","Flat Rack","Tank"], c: 0, info: "Open Top: üstü açılabilir." },
    { q: "Uygulamada 'Kalan' sayacı neyi gösterir?", opts: ["Tamamlananları","Tamamlanmamışları","Bugünkü","Gecikenler"], c: 1, info: "Toplam − tamamlanan." },
    { q: "Tamamlanma yüzdesi nasıl hesaplanır?", opts: ["Kalan / Toplam","Tamamlanan / Toplam","M3 / Adet","Geciken / Toplam"], c: 1, info: "Özet çubuğundaki 'Tamamlanma'." },
    { q: "Bir kayıt geciktiğinde hangi ikon belirir?", opts: ["⚠","📌","🔒","🏆"], c: 0, info: "Kaç gün geciktiği ile birlikte." },
    { q: "Hafta numarası hangi standarda göre hesaplanır?", opts: ["ISO-8601","RFC-1123","UTF-8","ASCII"], c: 0, info: "Uluslararası hafta hesabı." },
    { q: "Depo modu ekranı hangi amaca hizmet eder?", opts: ["Fatura kesme","Operasyon duvar ekranı","Rapor tasarımı","Yetki yönetimi"], c: 1, info: "Büyük yazı, canlı saat, 3 sekme." },
    { q: "Arşivlenen kayıt ana listede görünür mü?", opts: ["Evet","Hayır, arşiv raporundadır","Sadece pazar","Otomatik"], c: 1, info: "Arşiv paneli/rapor sekmesi üzerinden erişilir." },
    { q: "Yeniden planlamada hangi tarih güncellenir?", opts: ["Gerçekleşen","Reel Plan","Fatura","Teslim"], c: 1, info: "Planlanan esastır, Reel Plan güncellenir." },
    { q: "QR işlem ekranında hangi eylemler vardır?", opts: ["Ekle/Sil/Düzenle","Geldi/Başlat/Bitir","Yazdır/Kopyala","Arşivle/Sil"], c: 1, info: "Sadece operasyonel üçlü — silme yok." },
    { q: "Kronometre başlangıcı elle düzeltilebilir mi?", opts: ["Hayır","Evet — Süre hücresinden","Sadece admin","Sadece Excel"], c: 1, info: "⏱️ Süre hücresine tıkla → düzelt." },
    { q: "40 HC 2 adet + KOMPLE TIR 1 adet toplam M3?", opts: ["160","230","250","300"], c: 1, info: "2×70 + 90 = 230 m³." }
  ];
  try {
    let ok = 0;
    for (const s of sorular) {
      const res = await authFetch(`${FIREBASE_DB_URL}/${QUIZ_NODE}.json`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s)
      });
      if (res.ok) ok++;
    }
    showToast(`✅ ${ok}/${sorular.length} soru eklendi.`);
    await renderQuizAdminTable();
  } catch (e) { alert("Hata: " + e.message); }
  btn.disabled = false; btn.textContent = "📦 50 hazır soru yükle";
});

/* ================= 📱 QR YAZDIRMA + İŞLEM EKRANI ================= */
let islemId = null;

function qrUrl(id) {
  return location.origin + location.pathname + "#islem=" + encodeURIComponent(id);
}
function openQrPrint() {
  document.getElementById("qrModal").classList.remove("hidden");
  const inp = document.getElementById("qrTarih");
  if (!inp.value) inp.value = todayISO();
  renderQrPreview();
}
function renderQrPreview() {
  const box = document.getElementById("qrPreview");
  const printArea = document.getElementById("qrPrintArea");
  printArea.innerHTML = "";
  const tarih = document.getElementById("qrTarih").value;
  if (!tarih) { box.innerHTML = `<p class="hint">Bir gün seç.</p>`; return; }
  if (typeof QRCode === "undefined") {
    box.innerHTML = `<p class="hint">⚠️ QR kütüphanesi (CDN) yüklenemedi — interneti kontrol et.</p>`;
    return;
  }
  const liste = rows.filter(r => gecikmeTarihi(r) === tarih && r.durum !== "Yükleme Tamamlandı");
  if (!liste.length) { box.innerHTML = `<p class="hint">Bu gün için etiketlenecek kayıt yok.</p>`; return; }
  box.innerHTML = "";
  liste.forEach(r => {
    const label = document.createElement("div");
    label.className = "qr-label";
    label.innerHTML = `
      <div class="q-box"></div>
      <div class="q-txt">
        <b>${esc(r.musteri)}</b>
        ${esc(r.sevkiyatTipi)} · ${esc(r.ad)} yükleme${r.oncelikNo ? " · ⭐" + esc(r.oncelikNo) : ""}<br>
        ${r.aciklama ? "📝 " + esc(r.aciklama) + "<br>" : ""}${formatDate(tarih)}<br>
        <span class="q-id">#${esc(r.id.slice(-6))}</span>
      </div>`;
    box.appendChild(label);
    const holder = label.querySelector(".q-box");
    new QRCode(holder, { text: qrUrl(r.id), width: 96, height: 96, correctLevel: QRCode.CorrectLevel.M });
    /* Canvas → IMG: canvas pikselleri innerHTML kopyasında taşınmaz, yazdırmada boşalır.
       Data URL'e çevirince önizleme-kopya-yazıcı üçlüsü güvenli. */
        /* qrcodejs canvas'ın yanına gizli bir <img> daha koyar — onu at, canvas'ı
       data-URL img'e çevir (innerHTML kopyası + yazıcı için şart) */
    holder.querySelectorAll("img").forEach(x => x.remove());
    const cnv = holder.querySelector("canvas");
    if (cnv) {
      const img = document.createElement("img");
      img.src = cnv.toDataURL("image/png");
      img.alt = "QR";
      img.style.width = "96px";
      img.style.height = "96px";
      cnv.replaceWith(img);
    }
  });
  /* Yazdırma alanı: birebir kopya (artık img'lerle — güvenli) */
  printArea.innerHTML = `<div class="qr-grid">${box.innerHTML}</div>`;
}
function qrYazdir() {
  if (!document.getElementById("qrPrintArea").innerHTML) { alert("Önce gün seç, etiketleri oluştur."); return; }
  document.body.classList.add("qr-printing");
  const temizle = () => { document.body.classList.remove("qr-printing"); window.removeEventListener("afterprint", temizle); };
  window.addEventListener("afterprint", temizle);
  window.print();
}
document.getElementById("btnQrPrint").addEventListener("click", () => gate("qr-print"));
document.getElementById("btnQrClose").addEventListener("click", () => document.getElementById("qrModal").classList.add("hidden"));
document.getElementById("qrModal").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden"); });
document.getElementById("qrTarih").addEventListener("change", renderQrPreview);
document.getElementById("btnQrPrintGo").addEventListener("click", qrYazdir);

/* --- İşlem ekranı (#islem=<id>) --- */
function openIslem(id) {
  const ov = document.getElementById("islemOverlay");
  if (!ov) {
    console.error("⚠️ islemOverlay HTML'de yok — index.html ile app.js senkron değil!");
    showToast("⚠️ İşlem ekranı için sayfa güncel değil — yenile.");
    return;
  }
  islemId = id;
  ov.classList.remove("hidden");
  document.body.classList.add("islem-open");
  renderIslem();
  if (!currentUser) {
    showLogin("İşlem için giriş yap — giriş sonrası bu ekran otomatik devam eder.");
  }
}
function closeIslem() {
  document.getElementById("islemOverlay").classList.add("hidden");
  document.body.classList.remove("islem-open");
  islemId = null;
  if (location.hash.startsWith("#islem=")) history.replaceState(null, "", location.pathname + location.search);
}
function parseIslemHash() {
  const m = location.hash.match(/^#islem=(.+)$/);
  if (!m) return;
  const id = decodeURIComponent(m[1]);
  const gizli = document.getElementById("islemOverlay").classList.contains("hidden");
  if (gizli || id !== islemId) openIslem(id);
  else renderIslem(); /* aynı kayıt — yine de tazele */
}
function islemBtns(d) {
  const tpOn = d.toplamaBasTs && !d.toplamaBittiTs;
  const tpOk = !!d.toplamaBittiTs;
  const tpBitmis = d.durum === "Yükleme Tamamlandı" && tpOk;
  const tpBtns = tpBitmis ? "" : `
    <div style="display:flex;gap:10px">
      <button class="islem-btn b-geldi" data-iact="tp-basla" style="flex:1;background:#0f766e" ${tpOn ? "disabled" : ""}>📦 T.Başlat${tpOn ? " ✔" : ""}</button>
      <button class="islem-btn b-bitir" data-iact="tp-bitti" style="flex:1;background:#4f46e5" ${!tpOn || tpOk ? "disabled" : ""}>📦 T.Bitir</button>
    </div>`;
  if (d.durum === "Yükleme Bekliyor") {
    return `
      <button class="islem-btn b-geldi" data-iact="geldi">🚛 Araç Geldi${d.araciGeldi === "GELDİ" ? " ✔" : ""}</button>
      <button class="islem-btn b-basla" data-iact="baslat">▶️ Yüklemeyi Başlat</button>
      ${tpBtns}`;
  }
  if (d.durum === "Yükleniyor") {
    return `<button class="islem-btn b-bitir" data-iact="bitir">✅ Yüklemeyi Bitir</button>${tpBtns}`;
  }
  return tpBtns;
}
function renderIslem() {
  const c = document.getElementById("islemContent");
  const d = new Date();
  document.getElementById("islemClock").textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const r = rows.find(x => x.id === islemId);
  if (!r) {
    c.innerHTML = `<div class="islem-card">
      <div class="islem-musteri">Kayıt bulunamadı</div>
      <div class="islem-sub">Bu QR'ın kaydı silinmiş veya arşive taşınmış olabilir. Planlama ekranından güncel etiket bas.</div>
    </div>`;
    return;
  }
  const b = sureBilgi(r);
  const canEdit = currentUser && hasPerm("edit");
  const btns = canEdit ? islemBtns(r)
    : `<div class="islem-done" style="background:#2d2410;border-color:#fbbf24;color:#fbbf24">🔐 İşlem için giriş yapmalısın — giriş yapınca bu ekran devam eder.</div>`;
  const elapsed = (b.durum === "live" && r.loadingStartedAt) ? fmtSure(Date.now() - r.loadingStartedAt) : "";
  c.innerHTML = `<div class="islem-card">
    <div class="islem-musteri">${esc(r.musteri)}</div>
    <div class="islem-sub">${esc(r.blm)} · ${esc(r.sevkiyatTipi)} · ${esc(r.ad)} yükleme${r.oncelikNo ? " · ⭐ Öncelik " + esc(r.oncelikNo) : ""}</div>
    <div class="islem-sub" style="font-size:11px;opacity:.55">Kayıt kimliği: #${esc(r.id.slice(-6))}</div>
    <div class="islem-info">
      <div><span>Reel Plan:</span> <b>${formatDate(gecikmeTarihi(r))}</b></div>
      <div><span>Durum:</span> <span class="badge ${durumClass(r.durum)}">${esc(r.durum)}</span></div>
      <div><span>Araç:</span> <b style="color:${r.araciGeldi === "GELDİ" ? "#34d399" : "#fbbf24"}">${r.araciGeldi === "GELDİ" ? "Geldi" : "Gelmedi"}</b></div>
      <div><span>Açıklama:</span> ${r.aciklama ? esc(r.aciklama) : "-"}</div>
    </div>
    ${r.ekip && ekipler[r.ekip] ? `<div style="margin:6px 0">${ekipChipHtml(r.ekip)}</div>` : ""}
    ${r.toplamaBasTs && !r.toplamaBittiTs ? `<div class="islem-done" style="background:#2d2410;border-color:#fbbf24;color:#fbbf24">📦 Toplama sürüyor — ${fmtTime(r.toplamaBasTs)}'dan beri</div>` : ""}
    ${r.toplamaBasTs && r.toplamaBittiTs ? `<div class="islem-done">📦 Toplama bitti ${fmtTime(r.toplamaBasTs)}→${fmtTime(r.toplamaBittiTs)} · ${fmtSure(r.toplamaBittiTs - r.toplamaBasTs)}</div>` : ""}
    ${b.durum === "live" ? `<div class="islem-done" style="background:#2d2410;border-color:#fbbf24;color:#fbbf24">⏱ Kronometre çalışıyor · <span id="islemElapsed">${elapsed}</span> geçti (${fmtTime(r.loadingStartedAt)}'da başladı)</div>` : ""}
    ${b.durum === "done" ? `<div class="islem-done">✅ Bu yükleme tamamlandı${r.loadingStartedAt && r.loadingEndedAt ? ` · Baş:${fmtTime(r.loadingStartedAt)} - Bitiş:${fmtTime(r.loadingEndedAt)}` : ""}</div>` : ""}
    <div class="islem-btns">${btns}</div>
  </div>
  <div style="text-align:center;margin-bottom:24px">
    <button class="btn" id="btnIslemYenile">↻ Yenile</button>
  </div>`;
  c.querySelectorAll("[data-iact]").forEach(btn => btn.addEventListener("click", () => islemAction(btn.dataset.iact)));
  c.querySelector("#btnIslemYenile").addEventListener("click", async () => { await load(false); renderIslem(); });
}
async function islemAction(action, idOverride = null) {
  const targetId = idOverride || islemId;
  if (!currentUser) {
    if (document.getElementById("opOverlay")) { showLogin("İşlem için giriş yapın — giriş sonrası tekrar dokunun."); return; }
    pendingAction = { type: "islem-action", param: action };
    showLogin("İşlem için giriş yapın — giriş sonrası otomatik devam eder.");
    return;
  }
  if (!hasPerm("edit")) { alert("Bu işlem için düzenleme yetkiniz yok."); return; }
  const row = await freshRow(targetId);
  if (!row) { alert("Kayıt bulunamadı (arşive taşınmış veya silinmiş olabilir)."); return; }
  const updated = { ...row };
  let etiket = "";
  if (action === "geldi") {
    if (row.araciGeldi === "GELDİ") { showToast("ℹ️ Araç zaten 'Geldi' işaretli."); return; }
    updated.araciGeldi = "GELDİ";
    etiket = "araç geldi";
  } else if (action === "baslat") {
    if (row.durum === "Yükleniyor") { showToast("ℹ️ Kronometre zaten çalışıyor."); return; }
    updated.durum = "Yükleniyor";
    applyDurumSideEffects(updated);
    etiket = "yükleme başlatıldı";
    } else if (action === "tp-basla" || action === "tp-bitti") {
    return toplamaAction(action === "tp-basla" ? "basla" : "bitti", targetId);
  } else if (action === "bitir") {
    updated.durum = "Yükleme Tamamlandı";
    applyDurumSideEffects(updated);
    etiket = "yükleme tamamlandı";
  } else return;
  try {
    const saved = await apiUpdate(row.id, updated);
    rows = rows.map(r => r.id === row.id ? saved : r);
    setSaveError("");
    render();
    const isOv = document.getElementById("islemOverlay");
    if (isOv && !isOv.classList.contains("hidden")) renderIslem();
    if (document.getElementById("opOverlay")) renderOpCard();
    await apiLog("guncelleme", row.id, saved.musteri,
      `📱 ${document.getElementById("opOverlay") ? "Operasyon ekranı" : "QR işlem ekranı"}: ${etiket}` +
      (saved.loadingStartedAt && saved.loadingEndedAt ? ` · süre: ${fmtSure(saved.loadingEndedAt - saved.loadingStartedAt)}` : ""));
    showToast(`✅ ${esc(saved.musteri)}: ${etiket}`);
  } catch (e) { alert("Kaydedilemedi: " + e.message); }
}
/* --- İşlem ekranı bağlantıları (üst bar + klavye) --- */
document.getElementById("btnIslemClose").addEventListener("click", closeIslem);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !document.getElementById("islemOverlay").classList.contains("hidden")) closeIslem();
});
/* ================= 📱 OPERASYON EKRANI (depo mobil) — v3 ================= */
let currentOpId = null;

function openOperasyon() {
  if (document.getElementById("opOverlay")) {
    renderOpResults(document.getElementById("opSearch")?.value || "");
    return;
  }
  const ov = document.createElement("div");
  ov.id = "opOverlay";
  ov.className = "depo-overlay op-overlay";
  ov.innerHTML = `
    <div class="op-head">
      <div>
        <div class="depo-clock" id="opClock" style="font-size:32px">--:--</div>
        <div class="depo-date">Operasyon Ekranı</div>
      </div>
      <button class="btn" id="btnOpClose" style="font-size:15px;padding:10px 18px">✖ Kapat</button>
    </div>
    <div class="op-search-wrap">
      <input id="opSearch" placeholder="🔍 Müşteri / #kimlik / konteyner ara…" autocomplete="off" />
    </div>
    <div id="opResults" class="op-results"></div>
    <div id="opCard"></div>`;
  document.body.appendChild(ov);
  document.body.classList.add("op-open");
  ov.querySelector("#btnOpClose").addEventListener("click", closeOperasyon);
  const inp = ov.querySelector("#opSearch");
  inp.addEventListener("input", () => renderOpResults(inp.value));
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const hits = opMatches(inp.value);
      if (hits.length) openOpCard(hits[0].id);
    }
  });
  renderOpResults("");
  if (!currentUser) showLogin("Operasyon ekranı için giriş yapın.");
}
function closeOperasyon() {
  const ov = document.getElementById("opOverlay");
  if (ov) ov.remove();
  document.body.classList.remove("op-open");
  currentOpId = null;
  if (location.hash === "#operasyon") history.replaceState(null, "", location.pathname + location.search);
}
/* Sıra: Yükleniyor en üstte → öncelik no → Reel Plan */
/* Operasyon sırası: Durum → Öncelik no → Reel Plan → Müşteri A-Z */
function opSort(list) {
  return list.slice().sort((a, b) => {
    const da = DURUM_SIRA[a.durum] ?? 9, db = DURUM_SIRA[b.durum] ?? 9;
    if (da !== db) return da - db;
    const t = tarihCmp(gecikmeTarihi(a), gecikmeTarihi(b));
    if (t) return t;
    return String(a.musteri || "").localeCompare(String(b.musteri || ""), "tr");
  });
}
function opMatches(q) {
  q = (q || "").trim().toLowerCase().replace(/^#/, "");
  if (!q) return [];
  return opSort(rows.filter(r => r.durum !== "Yükleme Tamamlandı" &&
    ((r.musteri || "").toLowerCase().includes(q) ||
     r.id.toLowerCase().endsWith(q) ||
     (r.aciklama || "").toLowerCase().includes(q)))).slice(0, 8);
}
function opHitHtml(r) {
  return `<div class="op-hit" data-opid="${r.id}">
    <div><b>${esc(r.musteri)}</b>
      <div class="op-hit-sub">${esc(r.sevkiyatTipi)} · ${esc(r.ad)} yükleme${r.oncelikNo ? " · ⭐" + esc(r.oncelikNo) : ""}${r.aciklama ? " · 📝 " + esc(r.aciklama) : ""}</div>
    </div>
    <span class="badge ${durumClass(r.durum)}">${esc(r.durum)}</span>
  </div>`;
}
/* Haftanın kalanının sonu: Pazar (cumartesi/pazar planları da kapsanır) */
function haftaSonuISO(todayISOStr) {
  const d = parseLocalDate(todayISOStr);
  const pazar = new Date(d);
  pazar.setDate(pazar.getDate() + (6 - ((d.getDay() + 6) % 7)));
  return isoFromDate(pazar);
}

/* Bugünden itibaren gelecek 7 gün (yarın → +7) ISO listesi */
function sonraki7GunListesi(todayIso) {
  const bas = new Date(parseLocalDate(todayIso));
  bas.setDate(bas.getDate() + 1); /* yarından başla */
  return [...Array(7)].map((_, i) => {
    const d = new Date(bas);
    d.setDate(d.getDate() + i);
    return isoFromDate(d);
  });
}

function opHaftaGunHtml(gunEtiketi, liste) {
  const toplamAd = liste.reduce((s, r) => s + adet(r), 0);
  const satirlar = liste.map(r => {
    const notlar = (r.comments || []).slice(-2);
    const notTxt = notlar.length ? `<div class="op-hit-sub" style="color:#fbbf24">💬 ${notlar.map(c => esc(c.text)).join(" · ")}</div>` : "";
    return `<div class="op-hit" data-opid="${r.id}">
      <div><b>${esc(r.musteri)}</b>
        <div class="op-hit-sub">${esc(r.sevkiyatTipi)} · ${esc(r.ad)} yükleme${r.oncelikNo ? " · ⭐" + esc(r.oncelikNo) : ""}${r.aciklama ? " · 📝 " + esc(r.aciklama) : ""}</div>
        ${notTxt}
      </div>
      <span class="badge ${durumClass(r.durum)}">${esc(r.durum)}</span>
    </div>`;
  }).join("");
  return `<div class="depo-week-day" style="margin-bottom:10px">
    <h4 style="color:#8aa0b8;font-size:14px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.04em">${gunEtiketi} <span style="color:#e2e8f0">· ${liste.length} kayıt / ${toplamAd} yükleme</span></h4>
    ${satirlar}
  </div>`;
}
function renderOpHafta(res, today) {
  const mod = res.dataset.opmod || "kalan";
  const kalanISO = haftaSonuISO(today);
  let kalanlar;
  if (mod === "yedi") {
    const izin = new Set(sonraki7GunListesi(today));
    kalanlar = rows.filter(r => r.durum !== "Yükleme Tamamlandı" && izin.has(gecikmeTarihi(r)));
  } else {
    kalanlar = rows.filter(r => r.durum !== "Yükleme Tamamlandı" &&
      gecikmeTarihi(r) > today && gecikmeTarihi(r) <= kalanISO);
  }
  const byDate = new Map();
  kalanlar.forEach(r => {
    const d = gecikmeTarihi(r);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(r);
  });
  const gunIdx = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };
  const kalanAd = kalanlar.reduce((s, r) => s + adet(r), 0);
  const baslik = mod === "yedi"
    ? `➡️ SONRAKİ 7 GÜN — ${kalanlar.length} kayıt / ${kalanAd} yükleme`
    : `📅 BU HAFTANIN KALANI (Pazar ${formatDate(kalanISO)}'a kadar) — ${kalanlar.length} kayıt / ${kalanAd} yükleme`;
  let html = `
    <div style="text-align:center;margin-bottom:10px;font-weight:700;color:#e2e8f0">${baslik}</div>
    <div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px">
      <button class="btn ${mod === "kalan" ? "primary" : ""}" data-opmod="kalan">📅 Bu haftanın kalanı</button>
      <button class="btn ${mod === "yedi" ? "primary" : ""}" data-opmod="yedi">➡️ Sonraki 7 gün</button>
      <button class="btn" data-opmod="geri">↩ Bugüne dön</button>
    </div>`;
  if (!kalanlar.length) {
    html += `<div class="islem-done">${mod === "yedi" ? "Sonraki 7 günde planlı yükleme yok." : "📅 Bu haftanın kalanında planlı yükleme yok."}</div>`;
  } else {
    [...byDate.keys()].sort().forEach(d => {
      const dt = parseLocalDate(d);
      const etiket = dt ? `${GUNLER[gunIdx[dt.getDay()]] || ""} ${dt.getDate()} ${AYLAR[dt.getMonth()]}` : d;
      html += opHaftaGunHtml(etiket, opSort(byDate.get(d)));
    });
  }
  res.innerHTML = html;
  res.querySelectorAll("[data-opid]").forEach(el =>
    el.addEventListener("click", () => openOpCard(el.dataset.opid)));
  res.querySelectorAll("[data-opmod]").forEach(b =>
    b.addEventListener("click", () => {
      if (b.dataset.opmod === "geri") { currentOpId = null; renderOpResults(""); return; }
      res.dataset.opmod = b.dataset.opmod;
      renderOpHafta(res, today);
    }));
}
function renderOpResults(q) {
  const res = document.getElementById("opResults");
  if (!res) return;
  const s = (q || "").trim().toLowerCase().replace(/^#/, "");
  let hits;
  if (!s) {
    const today = todayISO();
    hits = opSort(rows.filter(r => r.durum !== "Yükleme Tamamlandı" && gecikmeTarihi(r) === today));
    if (!hits.length) {
      const kalanISO = haftaSonuISO(today);
      const kalanlar = opSort(rows.filter(r => r.durum !== "Yükleme Tamamlandı" &&
        gecikmeTarihi(r) > today && gecikmeTarihi(r) <= kalanISO));
      const kalanAd = kalanlar.reduce((s2, r) => s2 + adet(r), 0);
      const yediSet = new Set(sonraki7GunListesi(today));
      const yediList = rows.filter(r => r.durum !== "Yükleme Tamamlandı" && yediSet.has(gecikmeTarihi(r)));
      const yediAd = yediList.reduce((s, r) => s + adet(r), 0);
      res.innerHTML = `
        <div class="islem-done" style="margin-bottom:10px">🎉 Bugün (${formatDate(today)}) için bekleyen yükleme yok — gün tamam!</div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:10px">
          <button class="btn" id="btnOpHafta">📅 Haftanın kalanı (${kalanlar.length} kayıt / ${kalanAd} yükleme)</button>
          <button class="btn" id="btnOpYedi">➡️ Sonraki 7 gün (${yediList.length} kayıt / ${yediAd} yükleme)</button>
        </div>`;
      res.querySelector("#btnOpHafta").addEventListener("click", () => { res.dataset.opmod = "kalan"; renderOpHafta(res, today); });
      res.querySelector("#btnOpYedi").addEventListener("click", () => { res.dataset.opmod = "yedi"; renderOpHafta(res, today); });
      return;
    }
  } else hits = opMatches(s);
  res.innerHTML = hits.map(r => opHitHtml(r)).join("") || `<p class="hint" style="color:#8aa0b8">Eşleşme yok.</p>`;
  res.querySelectorAll("[data-opid]").forEach(el =>
    el.addEventListener("click", () => openOpCard(el.dataset.opid)));
}
function openOpCard(id) {
  currentOpId = id;
  renderOpCard(true);
}
async function renderOpCard(scrollToIt = false) {
  const holder = document.getElementById("opCard");
  if (!holder || !currentOpId) return;
  let r = null;
  try { r = await freshRow(currentOpId); } catch (e) {}
  if (!r) r = rows.find(x => x.id === currentOpId);
  if (!r) { holder.innerHTML = `<div class="op-card"><div class="m">Kayıt bulunamadı</div></div>`; return; }
  const b = sureBilgi(r);
  const notlar = (r.comments || []).slice(-3).reverse();
  const btns = r.durum === "Yükleme Tamamlandı" ? `
    <div class="islem-done">✅ Bu yükleme tamamlandı${r.loadingStartedAt && r.loadingEndedAt ? ` · Baş:${fmtTime(r.loadingStartedAt)} - Bitiş:${fmtTime(r.loadingEndedAt)}` : ""}</div>` : `
    <button class="islem-btn b-geldi" data-opact="geldi">🚛 Araç Geldi${r.araciGeldi === "GELDİ" ? " ✔" : ""}</button>
    <button class="islem-btn b-basla" data-opact="baslat">▶️ Yüklemeyi Başlat${r.durum === "Yükleniyor" ? " (çalışıyor)" : ""}</button>
      <div style="display:flex;gap:10px;margin-top:2px">
      <button class="islem-btn b-geldi" data-opact="toplama-basla" style="flex:1">📦 T.Başlat${r.toplamaBasTs && !r.toplamaBittiTs ? " ✔ sürüyor" : r.toplamaBasTs ? " (bitti)" : ""}</button>
      <button class="islem-btn b-bitir" data-opact="toplama-bitti" style="flex:1">📦 T.Bitir</button>
    </div>
    <button class="islem-btn b-bitir" data-opact="bitir">✅ Yüklemeyi Bitir</button>`;
  holder.innerHTML = `
    <div class="op-card">
      <div class="m">${esc(r.musteri)}</div>
      <div class="sub">${esc(r.blm)} · ${esc(r.sevkiyatTipi)} · ${esc(r.ad)} yükleme${r.oncelikNo ? " · ⭐ " + esc(r.oncelikNo) : ""} · #${esc(r.id.slice(-6))}</div>
      <div class="op-info">
        <div><span>Reel Plan:</span> <b>${formatDate(gecikmeTarihi(r))}</b></div>
        <div><span>Durum:</span> <span class="badge ${durumClass(r.durum)}">${esc(r.durum)}</span></div>
        <div><span>Araç:</span> <b style="color:${r.araciGeldi === "GELDİ" ? "#34d399" : "#fbbf24"}">${r.araciGeldi === "GELDİ" ? "Geldi" : "Gelmedi"}</b></div>
        <div><span>Açıklama:</span> ${r.aciklama ? esc(r.aciklama) : "-"}</div>
      </div>
      ${b.durum === "live" ? `<div class="islem-done" style="background:#2d2410;border-color:#fbbf24;color:#fbbf24">⏱ <span id="opElapsed">${fmtSure(Date.now() - r.loadingStartedAt)}</span> geçti · ${fmtTime(r.loadingStartedAt)}'da başladı</div>` : ""}
      ${notlar.length ? `<div class="op-notes">${notlar.map(cm => `<div class="op-note-item">💬 ${esc(cm.text)}<span>${esc(shortUser(cm.user))} · ${fmtDateTime(cm.ts)}</span></div>`).join("")}</div>` : ""}
      <div class="islem-btns">${btns}</div>
      <div class="op-note">
        <textarea id="opNotText" placeholder="📝 Özel not yaz… (örn. araç 2 sa gecikmeli, evrak eksik)"></textarea>
        <button class="op-btn-not" id="btnOpNot">+ Not Ekle</button>
      </div>
      <div style="text-align:center;margin-top:12px">
        <button class="btn" id="btnOpBack">↩ Listeye dön</button>
      </div>
    </div>`;
  if (scrollToIt) {
    requestAnimationFrame(() => holder.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  holder.querySelectorAll("[data-opact]").forEach(btn =>
    btn.addEventListener("click", () => {
      console.log("🖱️ operasyon butonu:", btn.dataset.opact, "→ id:", currentOpId);
      if (!currentOpId) { alert("Kayıt seçilemedi — sayfayı yenileyip tekrar dene."); return; }
      const act = btn.dataset.opact;
      if (act === "toplama-basla" || act === "toplama-bitti") toplamaAction(act === "toplama-basla" ? "basla" : "bitti", currentOpId);
      else islemAction(act, currentOpId);
    }));
  holder.querySelector("#btnOpNot").addEventListener("click", opNotEkle);
  holder.querySelector("#btnOpBack").addEventListener("click", () => {
    currentOpId = null;
    holder.innerHTML = "";
    renderOpResults(document.getElementById("opSearch").value);
    const ov = document.getElementById("opOverlay");
    if (ov) ov.scrollTo({ top: 0, behavior: "smooth" });
  });
}
async function opNotEkle() {
  const ta = document.getElementById("opNotText");
  if (!ta) return;
  const text = ta.value.trim();
  if (!text) { alert("Not metni yaz."); return; }
  if (!currentOpId) { alert("Önce bir kayıt seç."); return; }
  if (!currentUser) { showLogin("Not eklemek için giriş yapın."); return; }
  if (!hasPerm("edit")) { alert("Bu işlem için düzenleme yetkiniz yok."); return; }
  try {
    const row = await freshRow(currentOpId);
    if (!row) { alert("Kayıt bulunamadı."); return; }
    const comments = (row.comments || []).slice();
    comments.push({ ts: Date.now(), user: currentUser.email, text });
    const saved = await apiUpdate(row.id, { ...row, comments });
    rows = rows.map(r => r.id === row.id ? saved : r);
    setSaveError("");
    await apiLog("yorum", row.id, saved.musteri, `📱 operasyon notu: ${text.length > 70 ? text.slice(0, 70) + "…" : text}`);
    showToast("✅ Not eklendi.");
    renderOpCard();
  } catch (e) { alert("Not kaydedilemedi: " + e.message); }
}
document.getElementById("btnOpOpen").addEventListener("click", openOperasyon);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && document.getElementById("opOverlay")) closeOperasyon();
});
setInterval(() => {
  const ov = document.getElementById("opOverlay");
  if (!ov) return;
  const d = new Date();
  const clk = document.getElementById("opClock");
  if (clk) clk.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const el = document.getElementById("opElapsed");
  if (el) {
    const r = rows.find(x => x.id === currentOpId);
    if (r && r.durum === "Yükleniyor" && r.loadingStartedAt) el.textContent = fmtSure(Date.now() - r.loadingStartedAt);
  }
}, 1000);
  } else hits = opMatches(s);
  res.innerHTML = hits.map(r => opHitHtml(r)).join("") || `<p class="hint" style="color:#8aa0b8">Eşleşme yok.</p>`;
  res.querySelectorAll("[data-opid]").forEach(el =>
    el.addEventListener("click", () => openOpCard(el.dataset.opid)));
}
function openOpCard(id) {
  currentOpId = id;
  renderOpCard(true);
}
async function renderOpCard(scrollToIt = false) {
  const holder = document.getElementById("opCard");
  if (!holder || !currentOpId) return;
  let r = null;
  try { r = await freshRow(currentOpId); } catch (e) {}
  if (!r) r = rows.find(x => x.id === currentOpId);
  if (!r) { holder.innerHTML = `<div class="op-card"><div class="m">Kayıt bulunamadı</div></div>`; return; }
  const b = sureBilgi(r);
  const notlar = (r.comments || []).slice(-3).reverse();
  const btns = r.durum === "Yükleme Tamamlandı" ? `
    <div class="islem-done">✅ Bu yükleme tamamlandı${r.loadingStartedAt && r.loadingEndedAt ? ` · Baş:${fmtTime(r.loadingStartedAt)} - Bitiş:${fmtTime(r.loadingEndedAt)}` : ""}</div>` : `
    <button class="islem-btn b-geldi" data-opact="geldi">🚛 Araç Geldi${r.araciGeldi === "GELDİ" ? " ✔" : ""}</button>
    <button class="islem-btn b-basla" data-opact="baslat">▶️ Yüklemeyi Başlat${r.durum === "Yükleniyor" ? " (çalışıyor)" : ""}</button>
    <div style="display:flex;gap:10px;margin-top:2px">
      <button class="islem-btn b-geldi" data-opact="toplama-basla" style="flex:1">📦 Toplamayı Başlat${r.toplamaBasTs && !r.toplamaBittiTs ? " ✔ sürüyor" : r.toplamaBasTs ? " (bitti)" : ""}</button>
      <button class="islem-btn b-bitir" data-opact="toplama-bitti" style="flex:1">📦 Toplamayı Bitir</button>
    </div>`;
  holder.innerHTML = `
    <div class="op-card">
      <div class="m">${esc(r.musteri)}</div>
      <div class="sub">${esc(r.blm)} · ${esc(r.sevkiyatTipi)} · ${esc(r.ad)} yükleme · #${esc(r.id.slice(-6))}</div>
      <div class="op-info">
        <div><span>Reel Plan:</span> <b>${formatDate(gecikmeTarihi(r))}</b></div>
        <div><span>Durum:</span> <span class="badge ${durumClass(r.durum)}">${esc(r.durum)}</span></div>
        <div><span>Araç:</span> <b style="color:${r.araciGeldi === "GELDİ" ? "#34d399" : "#fbbf24"}">${r.araciGeldi === "GELDİ" ? "Geldi" : "Gelmedi"}</b></div>
        <div><span>Açıklama:</span> ${r.aciklama ? esc(r.aciklama) : "-"}</div>
      </div>
      ${r.ekip && ekipler[r.ekip] ? `<div style="margin:6px 0">${ekipChipHtml(r.ekip)}</div>` : ""}
      ${r.toplamaBasTs && !r.toplamaBittiTs ? `<div class="islem-done" style="background:#2d2410;border-color:#fbbf24;color:#fbbf24">📦 Toplama sürüyor — ${fmtTime(r.toplamaBasTs)}'dan beri</div>` : ""}
      ${r.toplamaBasTs && r.toplamaBittiTs ? `<div class="islem-done">📦 Toplama bitti ${fmtTime(r.toplamaBasTs)}→${fmtTime(r.toplamaBittiTs)} · ${fmtSure(r.toplamaBittiTs - r.toplamaBasTs)}</div>` : ""}
      ${b.durum === "live" ? `<div class="islem-done" style="background:#2d2410;border-color:#fbbf24;color:#fbbf24">⏱ <span id="opElapsed">${fmtSure(Date.now() - r.loadingStartedAt)}</span> geçti · ${fmtTime(r.loadingStartedAt)}'da başladı</div>` : ""}
      ${notlar.length ? `<div class="op-notes">${notlar.map(cm => `<div class="op-note-item">💬 ${esc(cm.text)}<span>${esc(shortUser(cm.user))} · ${fmtDateTime(cm.ts)}</span></div>`).join("")}</div>` : ""}
      <div class="islem-btns">${btns}</div>
      <div class="op-note">
        <textarea id="opNotText" placeholder="📝 Özel not yaz… (örn. araç 2 sa gecikmeli, evrak eksik)"></textarea>
        <button class="op-btn-not" id="btnOpNot">+ Not Ekle</button>
      </div>
      <div style="text-align:center;margin-top:12px">
        <button class="btn" id="btnOpBack">↩ Listeye dön</button>
      </div>
    </div>`;
  if (scrollToIt) {
    requestAnimationFrame(() => holder.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  holder.querySelectorAll("[data-opact]").forEach(btn =>
    btn.addEventListener("click", () => {
      const act = btn.dataset.opact;
      if (act === "toplama-basla" || act === "toplama-bitti") toplamaAction(act === "toplama-basla" ? "basla" : "bitti", currentOpId);
      else islemAction(act, currentOpId);
    }));
  holder.querySelector("#btnOpNot").addEventListener("click", opNotEkle);
  holder.querySelector("#btnOpBack").addEventListener("click", () => {
    currentOpId = null;
    holder.innerHTML = "";
    renderOpResults(document.getElementById("opSearch").value);
    const ov = document.getElementById("opOverlay");
    if (ov) ov.scrollTo({ top: 0, behavior: "smooth" });
  });
}
async function opNotEkle() {
  const ta = document.getElementById("opNotText");
  if (!ta) return;
  const text = ta.value.trim();
  if (!text) { alert("Not metni yaz."); return; }
  if (!currentOpId) { alert("Önce bir kayıt seç."); return; }
  if (!currentUser) { showLogin("Not eklemek için giriş yapın."); return; }
  if (!hasPerm("edit")) { alert("Bu işlem için düzenleme yetkiniz yok."); return; }
  try {
    const row = await freshRow(currentOpId);
    if (!row) { alert("Kayıt bulunamadı."); return; }
    const comments = (row.comments || []).slice();
    comments.push({ ts: Date.now(), user: currentUser.email, text });
    const saved = await apiUpdate(row.id, { ...row, comments });
    rows = rows.map(r => r.id === row.id ? saved : r);
    setSaveError("");
    await apiLog("yorum", row.id, saved.musteri, `📱 operasyon notu: ${text.length > 70 ? text.slice(0, 70) + "…" : text}`);
    showToast("✅ Not eklendi.");
    renderOpCard();
  } catch (e) { alert("Not kaydedilemedi: " + e.message); }
}
document.getElementById("btnOpOpen").addEventListener("click", openOperasyon);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && document.getElementById("opOverlay")) closeOperasyon();
});
setInterval(() => {
  const ov = document.getElementById("opOverlay");
  if (!ov) return;
  const d = new Date();
  const clk = document.getElementById("opClock");
  if (clk) clk.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const el = document.getElementById("opElapsed");
  if (el) {
    const r = rows.find(x => x.id === currentOpId);
    if (r && r.durum === "Yükleniyor" && r.loadingStartedAt) el.textContent = fmtSure(Date.now() - r.loadingStartedAt);
  }
}, 1000);
/* ================= Başlat ================= */
updateUserUI();
(async () => {
  renderThead();
  loadPrefs();
  loadKapasitePrefs();
  updateSortHeaders();
  await loadSureAyarlari();
  await loadEkipler();
  const s = getAuthState();
  if (s) {
    try {
      await ensureToken();
      currentUser = { email: s.email };
      await loadUserEntries();
      updateUserUI();
    } catch (e) { /* ensureToken gerekli temizliği yaptı */ }
  }
 render();
  await load(true);
  if (arsivDahil && !Array.isArray(arsivCache)) {
    try { arsivCache = await fetchArsiv(); render(); } catch (e) { arsivCache = []; }
  }
    parseIslemHash();
  if (location.hash === "#operasyon") openOperasyon();
  startLiveSync();
  otomatikGunlukYedek();
})();
