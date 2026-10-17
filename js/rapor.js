/* ================= 📡 DEPO QR OKUTUCU ================= */
const barcodeSupported = "BarcodeDetector" in window;
let scanStream = null;

function openScanner() {
  const overlay = document.createElement("div");
  overlay.id = "scanOverlay";
  overlay.className = "depo-overlay";
  overlay.style.zIndex = "92";
  overlay.innerHTML = `
    <div class="depo-head">
      <div>
        <div class="depo-clock" style="font-size:28px">📡 QR Okut</div>
        <div class="depo-date" id="scanStatus">Kamera hazırlanıyor…</div>
      </div>
      <button class="btn" id="btnScanClose" style="font-size:15px;padding:10px 18px">✖ Kapat</button>
    </div>
    <div id="scanBody" style="max-width:640px;margin:0 auto">
      <div style="position:relative;background:#000;border-radius:14px;overflow:hidden;aspect-ratio:4/3">
        <video id="scanVideo" style="width:100%;height:100%;object-fit:cover" playsinline muted></video>
        <div style="position:absolute;inset:15%;border:3px solid #818cf8;border-radius:12px;pointer-events:none"></div>
      </div>
      <p class="hint" style="margin-top:12px">QR'ı çerçeveye tuttur — otomatik algılanır ve işlem ekranı açılır.</p>
    </div>
    <div style="max-width:640px;margin:12px auto 40px" id="scanFallback"></div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("#btnScanClose").addEventListener("click", closeScanner);

  if (!barcodeSupported) {
    document.getElementById("scanBody").style.display = "none";
    document.getElementById("scanStatus").textContent = "Bu cihaz kamera algılamayı desteklemiyor — manuel arama:";
    renderScanFallback();
    return;
  }
  startCamera();
}
async function startCamera() {
  const video = document.getElementById("scanVideo");
  const status = document.getElementById("scanStatus");
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = scanStream;
    await video.play();
    status.textContent = "Kamera hazır — QR'ı çerçeveye tuttur.";
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    const loop = async () => {
      if (!document.getElementById("scanOverlay")) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length) {
          const url = codes[0].rawValue;
          const m = url.match(/#islem=([^&\s]+)/);
          if (m) {
            closeScanner();
            location.hash = "#islem=" + m[1]; /* hashchange → parseIslemHash → openIslem */
            return;
          }
        }
      } catch (e) {}
      requestAnimationFrame(() => setTimeout(loop, 250));
    };
    loop();
  } catch (e) {
    status.textContent = "Kamera açılamadı (" + (e.message || e.name) + ") — manuel arama:";
    document.getElementById("scanBody").style.display = "none";
    renderScanFallback();
  }
}
function closeScanner() {
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  const ov = document.getElementById("scanOverlay");
  if (ov) ov.remove();
}
/* Hash değişimleri: QR tarayıcı set'i + #operasyon + aynı sekmede gelen linkler */
window.addEventListener("hashchange", () => {
  if (location.hash === "#operasyon") openOperasyon();
  parseIslemHash();
});
/* Manuel arama: etiketteki #XXXXXX kimliği ya da müşteri adıyla */
function renderScanFallback() {
  const fb = document.getElementById("scanFallback");
  if (!fb) return;
  fb.innerHTML = `
    <label style="font-size:12px;color:#8aa0b8">Etiketteki #kimlik veya müşteri adı:</label>
    <input id="scanManual" placeholder="örn. #t-1027 ya da GOOSSENS"
      style="width:100%;padding:12px;font-size:16px;margin-top:6px" />
    <div id="scanResults" style="margin-top:10px"></div>`;
  const inp = fb.querySelector("#scanManual");
  inp.addEventListener("input", () => {
    const res = fb.querySelector("#scanResults");
    const q = inp.value.trim().toLowerCase().replace("#", "");
    if (q.length < 2) { res.innerHTML = ""; return; }
    const hits = rows.filter(r =>
      (r.id.toLowerCase().endsWith(q) || (r.musteri || "").toLowerCase().includes(q)) && r.durum !== "Yükleme Tamamlandı"
    ).slice(0, 5);
    res.innerHTML = hits.map(r => `
      <div class="depo-week-row" style="cursor:pointer" data-scanid="${r.id}">
        <div class="w-m">${esc(r.musteri)} <span style="color:#8aa0b8">#${esc(r.id.slice(-6))}</span></div>
        <div class="w-r">${esc(r.sevkiyatTipi)} · ${esc(r.durum)}</div>
      </div>`).join("") || `<p class="hint">Eşleşme yok.</p>`;
    res.querySelectorAll("[data-scanid]").forEach(el =>
      el.addEventListener("click", () => { closeScanner(); openIslem(el.dataset.scanid); }));
  });
  setTimeout(() => inp.focus(), 50);
}
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && document.getElementById("scanOverlay")) closeScanner();
});

/* ================= Olaylar ================= */
document.getElementById("tbody").addEventListener("click", e => {
  const btn = e.target.closest("button[data-action]");
  if (btn) {
    const { action, id } = btn.dataset;
    switch (action) {
      case "save-inline":   gate("save-inline"); break;
      case "cancel-inline": addingInline = false; inlineData = null; render(); break;
      case "duplicate":     gate("duplicate", id); break;
      case "delete":        gate("delete", id); break;
      case "comments":      gate("comments", id); break;
    }
    return;
  }
  /* 📦 Toplama Başlat/Bitir — hücre editöründen ÖNCE yakalanmalı */
  const tpBtn = e.target.closest("button[data-tpact]");
  if (tpBtn) { toplamaAction(tpBtn.dataset.tpact, tpBtn.dataset.tpid); return; }

  const chip = e.target.closest("[data-mchip]");
  if (chip) { gate("musteri-kart", chip.dataset.mchip); return; }
  const causeBtn = e.target.closest("[data-cause]");
  if (causeBtn) { gate("cause", causeBtn.dataset.cause); return; }
  if (e.target.closest("input, select, option")) return;
  const tr = e.target.closest("tr[data-rowid]");
  const sureTd = e.target.closest('td[data-col="sure"]');
  if (sureTd && tr) { gate("sure-edit", tr.dataset.rowid); return; }
  const td = e.target.closest("td[data-field]");
  if (!td) return;
  const trow = td.closest("tr[data-rowid]");
  if (!trow) return;
  gate("cell-edit", { td, id: trow.dataset.rowid, field: td.dataset.field });
});
document.getElementById("tbody").addEventListener("change", e => {
  const cb = e.target.closest("input.selbox[data-sel]");
  if (cb) {
    if (cb.checked) selectedIds.add(cb.dataset.sel);
    else selectedIds.delete(cb.dataset.sel);
    updateBulkBar();
  }
});
function onFieldInput(e) {
  const el = e.target;
  const field = el.dataset.field;
  if (!field) return;
  if (inlineData) inlineData[field] = el.value;
  /* Satır içi formda planlanan girilince reel plana da otomatik yaz */
  if (field === "planlananTarih" && el.value && inlineData) {
    inlineData.reelPlan = el.value;
    const rpIn = el.closest("tr")?.querySelector('input[data-field="reelPlan"]');
    if (rpIn) rpIn.value = el.value;
  }
  if (field === "durum") {
    const cell = el.closest("tr")?.querySelector(".st-cell");
    if (cell) cell.innerHTML = durumIcon(el.value);
  }
  if (field === "sevkiyatTipi" || field === "ad" || field === "prsM3") {
    const tr = el.closest("tr");
    const m3In = tr?.querySelector('input[data-field="m3"]');
    if (!tr || !m3In || !inlineData) return;
    const tip = field === "sevkiyatTipi" ? el.value : inlineData.sevkiyatTipi;
    if (!tip) return;
    if (field === "ad" && tip === "PARSIYEL TIR") return;
    const adVal  = tr.querySelector('input[data-field="ad"]')?.value;
    const prsVal = tr.querySelector('input[data-field="prsM3"]')?.value;
    const yeni = hesaplaM3(tip, adVal, prsVal);
    if (yeni !== null) { m3In.value = yeni; inlineData.m3 = yeni; }
  }
}
document.getElementById("tbody").addEventListener("input", onFieldInput);
document.getElementById("tbody").addEventListener("change", onFieldInput);

/* Tarih hücrelerinde debounce (satır içi ekleme formu için) */
let cellCommitTimer = null;
function scheduleCellCommit(delay) {
  clearTimeout(cellCommitTimer);
  cellCommitTimer = setTimeout(() => { cellCommitTimer = null; commitCell(); }, delay);
}

document.getElementById("tbody").addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const scope = e.target.dataset.scope;
  if (scope === "inline") gate("save-inline");
});

/* Yüzen düzenleyici: klavye + odak yönetimi */
document.getElementById("cellEditor").addEventListener("keydown", e => {
  const inp = e.target.closest("[data-cid]");
  if (!inp) return;
  if (e.key === "Enter") { e.preventDefault(); clearTimeout(cellCommitTimer); commitCell(); }
  else if (e.key === "Escape") { e.preventDefault(); clearTimeout(cellCommitTimer); cancelCell(); }
});
document.getElementById("cellEditor").addEventListener("change", e => {
  if (e.target.matches("[data-cid]")) {
    if (e.target.tagName === "SELECT") commitCell();
    else if (e.target.type === "date") scheduleCellCommit(500);
  }
});
document.getElementById("cellEditor").addEventListener("focusout", e => {
  if (!e.target.matches || !e.target.matches("[data-cid]")) return;
  if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest("#cellEditor")) return;
  const cur = editingCell;
  if (cur && !e.relatedTarget && e.target.type === "date") {
    const inp = document.querySelector("#cellEditor [data-cid]");
    const row = inp ? rows.find(r => r.id === cur.id) : null;
    if (inp && row && String(row[cur.field] ?? "") === String(inp.value ?? "")) return;
  }
  if (e.target.type === "date") { scheduleCellCommit(0); return; }
  commitCell();
});

/* Kolon sıralama */
document.querySelector("thead").addEventListener("click", e => {
  if (e.target.closest("#selAll")) return;
  const th = e.target.closest("th[data-sort]");
  if (!th) return;
  const col = th.dataset.sort;
  if (sortCol !== col) { sortCol = col; sortDir = "desc"; }
  else if (sortDir === "desc") { sortDir = "asc"; }
  else { sortCol = null; }
  savePrefs();
  updateSortHeaders();
  render();
});
/* Tümünü seç (delegasyon — thead yeniden üretilse de çalışır) */
document.querySelector("thead").addEventListener("change", e => {
  if (e.target.id !== "selAll") return;
  const on = e.target.checked;
  const list = filtered();
  if (on) list.forEach(r => { if (!r._arsiv) selectedIds.add(r.id); });
  else { list.forEach(r => selectedIds.delete(r.id)); }
  render();
});

function updateSearchPlaceholder() {
  const wide = document.getElementById("searchScope").value === "wide";
  document.getElementById("search").placeholder = wide
    ? "🔍 Her yerde ara (boşlukla ayır)"
    : "🔍 Müşteri ara";
}
document.getElementById("search").addEventListener("input", () => { savePrefs(); render(); });
document.getElementById("searchScope").addEventListener("change", () => { updateSearchPlaceholder(); savePrefs(); render(); });
document.getElementById("dateFilter").addEventListener("change", e => { dateFilter = e.target.value; savePrefs(); render(); });
document.getElementById("dateFrom").addEventListener("change", e => { dateFrom = e.target.value; savePrefs(); render(); });
document.getElementById("dateTo").addEventListener("change", e => { dateTo = e.target.value; savePrefs(); render(); });
document.getElementById("statusFilter").addEventListener("change", e => { statusFilter = e.target.value; savePrefs(); render(); });
document.getElementById("btnReload").addEventListener("click", async () => {
  if (editingCell) await commitCell();
  load(true);
});
document.getElementById("btnToggleSummary").addEventListener("click", () => {
  const s = document.getElementById("summary");
  s.classList.toggle("hidden");
  document.getElementById("btnToggleSummary").textContent = s.classList.contains("hidden") ? "Özet" : "Özeti gizle";
  savePrefs();
});

document.getElementById("btnFit").addEventListener("click", () => {
  // ✅ Güvenli kullanım:
document.getElementById("btnArayuzElemani")?.addEventListener("click", () => {
  // işlem kodları
});
  fitMode = !fitMode;
  document.getElementById("btnFit").classList.toggle("primary", fitMode);
  savePrefs();
  applyFit();
});
document.getElementById("btnInlineAdd").addEventListener("click", () => gate("inline-add"));
document.getElementById("btnShowForm").addEventListener("click", () => gate("form-add"));
document.getElementById("btnImportOpen").addEventListener("click", () => gate("import"));
document.getElementById("btnExport").addEventListener("click", () => exportExcel());
document.getElementById("btnHistory").addEventListener("click", () => showHistory());
document.getElementById("btnCalendar").addEventListener("click", () => openTakvim());
document.getElementById("btnDepo").addEventListener("click", () => openDepo());
document.getElementById("btnBackup").addEventListener("click", () => openBackup());
document.getElementById("btnAdminPanel").addEventListener("click", openAdminPanel);
document.getElementById("btnSurePanel").addEventListener("click", openSurePanel);
document.getElementById("btnPrint").addEventListener("click", () => {
  if (editingCell) commitCell();
  setTimeout(() => window.print(), 100);
});

/* ================= 🎨 TEMA MOTORU ================= */
const THEME_KEY = "sevkiyat_theme_v2";

function applyTheme(name) {
  document.body.classList.toggle("dark", name === "dark");   /* eski CSS uyumu */
  if (name === "light" || name === "dark") {
    document.body.removeAttribute("data-theme");             /* klasik temalar attribute'sız */
  } else {
    document.body.dataset.theme = name;
  }
  localStorage.setItem(THEME_KEY, name);
  const sel = document.getElementById("themeSelect");
  if (sel) sel.value = name;
}
function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
}
document.getElementById("themeSelect").addEventListener("change", e => {
  applyTheme(e.target.value);
  if (!document.getElementById("reportModal").classList.contains("hidden")) buildReports();
});
initTheme();
/* ================= Modal form ================= */
function fillSelect(id, options) {
  document.getElementById(id).innerHTML =
    options.map(o => `<option value="${esc(o)}">${o === "" ? "-" : esc(o)}</option>`).join("");
}
fillSelect("f-blm", BLMS);
fillSelect("f-sevkiyatTipi", TIPLER);
fillSelect("f-durum", DURUMLAR);
fillSelect("f-araciGeldi", GELDI);
fillSelect("sureNewTip", TIPLER);

function openModal() {
  const rec = emptyRecord();
  document.getElementById("f-musteri").value = "";
  document.getElementById("f-blm").value = rec.blm;
  document.getElementById("f-kategori").value = rec.kategori;
  document.getElementById("f-sevkiyatTipi").value = rec.sevkiyatTipi;
  document.getElementById("f-ad").value = rec.ad;
  document.getElementById("f-planlananTarih").value = rec.planlananTarih;
  document.getElementById("f-reelPlan").value = rec.reelPlan;
  document.getElementById("f-durum").value = rec.durum;
  document.getElementById("f-araciGeldi").value = "";
  document.getElementById("f-prsM3").value = "";
  document.getElementById("f-m3").value = rec.m3;
  document.getElementById("f-aciklama").value = "";
  document.getElementById("modal").classList.remove("hidden");
  document.getElementById("f-musteri").focus();
}
function closeModal() { document.getElementById("modal").classList.add("hidden"); }
function getVal(id) { return document.getElementById(id).value; }

/* Planlanan tarih seçilince Reel Plan otomatik eşitlenir */
document.getElementById("f-planlananTarih").addEventListener("change", e => {
  if (e.target.value) document.getElementById("f-reelPlan").value = e.target.value;
});
document.getElementById("f-sevkiyatTipi").addEventListener("change", e => {
  const yeni = hesaplaM3(e.target.value, getVal("f-ad"), getVal("f-prsM3"));
  if (yeni !== null) document.getElementById("f-m3").value = yeni;
});
document.getElementById("f-ad").addEventListener("input", e => {
  const tip = getVal("f-sevkiyatTipi");
  if (tip === "PARSIYEL TIR") return;
  const yeni = hesaplaM3(tip, e.target.value, getVal("f-prsM3"));
  if (yeni !== null) document.getElementById("f-m3").value = yeni;
});
document.getElementById("f-prsM3").addEventListener("input", e => {
  if (getVal("f-sevkiyatTipi") !== "PARSIYEL TIR") return;
  const yeni = hesaplaM3("PARSIYEL TIR", null, e.target.value);
  if (yeni !== null) document.getElementById("f-m3").value = yeni;
});
document.getElementById("btnCancelForm").addEventListener("click", closeModal);
document.getElementById("btnSaveForm").addEventListener("click", async () => {
  if (!currentUser) { pendingAction = { type: "form-add" }; closeModal(); showLogin("Kaydetmek için giriş yapın."); return; }
  const musteri = getVal("f-musteri").trim();
  if (!musteri) { alert("Müşteri adı zorunlu."); return; }
  const rec = emptyRecord();
  rec.musteri = musteri;
  rec.blm = getVal("f-blm");
  rec.kategori = getVal("f-kategori");
  rec.sevkiyatTipi = getVal("f-sevkiyatTipi");
  rec.ad = getVal("f-ad");
  rec.planlananTarih = getVal("f-planlananTarih");
  rec.reelPlan = getVal("f-reelPlan");
  rec.durum = getVal("f-durum");
  rec.araciGeldi = getVal("f-araciGeldi");
  rec.prsM3 = getVal("f-prsM3");
  rec.m3 = getVal("f-m3");
  rec.aciklama = getVal("f-aciklama");
  if (isDuplicate(rec) && !confirm(dupMsg(rec))) return;
  applyDurumSideEffects(rec);
  try {
    const saved = await apiInsert(rec);
    rows = [saved, ...rows];
    setSaveError("");
    render();
    closeModal();
    await apiLog("ekleme", saved.id, rec.musteri, `form ile ekleme · ${rec.sevkiyatTipi} · AD: ${rec.ad} · planlanan: ${formatDate(rec.planlananTarih)}`);
  } catch (e) { setSaveError(e.message); }
});
document.getElementById("modal").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeModal();
});

/* ============================================================
   ⏱️ SÜRE AYARLARI PANELİ
   ============================================================ */
function openSurePanel() {
  if (!isAdmin()) { alert("Bu panel sadece yöneticiler içindir."); return; }
  document.getElementById("sureModal").classList.remove("hidden");
  renderSureTable();
}
function renderSureTable() {
  const tb = document.getElementById("sureTable");
  const entries = Object.entries(sureAyarlari)
    .sort((a, b) => String(a[1].musteri).localeCompare(String(b[1].musteri), "tr"));
  if (!entries.length) {
    tb.innerHTML = `<tr><td colspan="4" class="empty">Henüz kombinasyon eklenmemiş — tümü varsayılan (${sureVarsayilan} dk) kullanıyor.</td></tr>`;
  } else {
    tb.innerHTML = entries.map(([k, v]) => `
      <tr data-skey="${esc(k)}">
        <td class="strong">${esc(v.musteri)}</td>
        <td>${esc(v.sevkiyatTipi)}</td>
        <td><input type="number" min="1" class="cell-input w-num" data-suredk value="${v.sureDk}" /></td>
        <td class="nowrap">
          <button class="btn primary" data-ssave="${esc(k)}">Kaydet</button>
          <button class="btn" data-sdel="${esc(k)}" title="Sil (varsayılana döner)">Sil</button>
        </td>
      </tr>`).join("");
  }
  document.getElementById("sureDefault").value = sureVarsayilan;
}
async function sureSaveDefault() {
  const dk = Number(document.getElementById("sureDefault").value);
  if (!dk || dk < 1) { alert("Geçerli bir dakika gir."); return; }
  try {
    await authFetch(`${FIREBASE_DB_URL}/${SURE_NODE}/__varsayilan__.json`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sureDk: dk })
    });
    sureVarsayilan = dk;
    showToast(`✅ Varsayılan süre ${dk} dk olarak kaydedildi.`);
    await apiLog("yetki", "", "", `varsayılan yükleme süresi ${dk} dk olarak ayarlandı`);
  } catch (e) {
    alert("Kaydedilemedi: " + e.message + "\n\n⚠️ Rules'ta sevkiyat_suresi .write izni admin e-postanıza açık olmalı.");
  }
}
async function sureSaveCombo(key) {
  const tr = document.querySelector(`tr[data-skey="${key}"]`);
  if (!tr) return;
  const dk = Number(tr.querySelector("input[data-suredk]").value);
  if (!dk || dk < 1) { alert("Geçerli bir dakika gir."); return; }
  const v = sureAyarlari[key];
  const entry = { musteri: v.musteri, sevkiyatTipi: v.sevkiyatTipi, sureDk: dk };
  try {
    await authFetch(`${FIREBASE_DB_URL}/${SURE_NODE}/${key}.json`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry)
    });
    sureAyarlari[key] = entry;
    showToast(`✅ ${esc(v.musteri)} · ${esc(v.sevkiyatTipi)} → ${dk} dk kaydedildi.`);
    await apiLog("yetki", "", v.musteri, `${v.sevkiyatTipi} standart yükleme süresi ${dk} dk olarak ayarlandı`);
    renderSureTable();
    render();
  } catch (e) {
    alert("Kaydedilemedi: " + e.message);
  }
}
async function sureDeleteCombo(key) {
  const v = sureAyarlari[key];
  if (!confirm(`${v.musteri} · ${v.sevkiyatTipi} süresi silinsin mi? (varsayılan süreyi kullanır)`)) return;
  try {
    await authFetch(`${FIREBASE_DB_URL}/${SURE_NODE}/${key}.json`, { method: "DELETE" });
    delete sureAyarlari[key];
    renderSureTable();
    render();
    showToast("🗑️ Silindi — artık varsayılan süre kullanılacak.");
  } catch (e) {
    alert("Silinemedi: " + e.message);
  }
}
async function sureAddCombo() {
  const m = document.getElementById("sureNewMusteri").value.trim();
  const t = document.getElementById("sureNewTip").value;
  const dk = Number(document.getElementById("sureNewDk").value);
  if (!m) { alert("Müşteri adı gir."); return; }
  if (!dk || dk < 1) { alert("Geçerli bir dakika gir."); return; }
  const key = comboKey(m, t);
  const entry = { musteri: m, sevkiyatTipi: t, sureDk: dk };
  try {
    await authFetch(`${FIREBASE_DB_URL}/${SURE_NODE}/${key}.json`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry)
    });
    sureAyarlari[key] = entry;
    document.getElementById("sureNewMusteri").value = "";
    document.getElementById("sureNewDk").value = "";
    renderSureTable();
    render();
    showToast(`✅ ${esc(m)} · ${esc(t)} → ${dk} dk eklendi.`);
    await apiLog("yetki", "", m, `${t} standart yükleme süresi ${dk} dk olarak eklendi`);
  } catch (e) {
    alert("Eklenemedi: " + e.message);
  }
}
document.getElementById("btnSureDefaultSave").addEventListener("click", sureSaveDefault);
document.getElementById("btnSureAdd").addEventListener("click", sureAddCombo);
document.getElementById("sureNewMusteri").addEventListener("keydown", e => { if (e.key === "Enter") sureAddCombo(); });
document.getElementById("sureNewDk").addEventListener("keydown", e => { if (e.key === "Enter") sureAddCombo(); });
document.getElementById("sureTable").addEventListener("click", e => {
  const sb = e.target.closest("button[data-ssave]");
  if (sb) { sureSaveCombo(sb.dataset.ssave); return; }
  const sd = e.target.closest("button[data-sdel]");
  if (sd) { sureDeleteCombo(sd.dataset.sdel); return; }
});
document.getElementById("btnCloseSure").addEventListener("click", () => {
  document.getElementById("sureModal").classList.add("hidden");
});
document.getElementById("sureModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});

/* ============================================================
   🛡️ ADMİN PANELİ
   ============================================================ */
async function openAdminPanel() {
  if (!isAdmin()) { alert("Bu panel sadece yöneticiler içindir."); return; }
  document.getElementById("adminModal").classList.remove("hidden");
  await reloadAdminTable();
}
async function reloadAdminTable() {
  const tb = document.getElementById("adminUserTable");
  tb.innerHTML = `<tr><td colspan="4" class="empty">Yükleniyor…</td></tr>`;
  await loadUserEntries();
  renderAdminTable();
}
function renderKnownEmails() {
  const known = new Set(Object.keys(userEntries));
  rows.forEach(r => { if (r.createdBy) known.add(r.createdBy); if (r.updatedBy) known.add(r.updatedBy); });
  document.getElementById("adminKnownEmails").innerHTML =
    [...known].sort().map(e => `<option value="${esc(e)}">`).join("");
}
function renderAdminTable() {
  const tb = document.getElementById("adminUserTable");
  const emails = Object.keys(userEntries).sort((a, b) => a.localeCompare(b, "tr"));
  if (!emails.length) {
    tb.innerHTML = `<tr><td colspan="4" class="empty">Kayıtlı kullanıcı yok — yukarıdan e-posta ekleyerek başla.</td></tr>`;
    renderKnownEmails();
    return;
  }
  tb.innerHTML = emails.map(em => {
    const e = userEntries[em];
    const p = e.perms || DEFAULT_PERMS;
    const isMe = currentUser && em === currentUser.email;
    const checks = Object.keys(PERM_LABELS).map(k =>
      `<label class="adm-check"><input type="checkbox" data-perm="${k}" ${p[k] ? "checked" : ""}/><span>${PERM_LABELS[k]}</span></label>`
    ).join("");
    return `<tr data-uemail="${esc(em)}">
      <td class="strong">${esc(em)}${isMe ? ' <span class="you-tag">(sen)</span>' : ""}</td>
      <td><select class="cell-input" data-role>
        <option value="user" ${e.role !== "admin" ? "selected" : ""}>Kullanıcı</option>
        <option value="admin" ${e.role === "admin" ? "selected" : ""}>Admin</option>
      </select></td>
      <td><div class="adm-perms">${checks}</div></td>
      <td class="nowrap">
        <button class="btn primary" data-asave="${esc(em)}">Kaydet</button>
        <button class="btn" data-adel="${esc(em)}" title="Listeden kaldır (varsayılan yetkilere döner)">Kaldır</button>
      </td>
    </tr>`;
  }).join("");
  renderKnownEmails();
}
async function adminSaveUser(email) {
  const tr = document.querySelector(`tr[data-uemail="${email}"]`);
  if (!tr) return;
  const role = tr.querySelector("select[data-role]").value;
  const perms = {};
  tr.querySelectorAll("input[data-perm]").forEach(cb => { perms[cb.dataset.perm] = cb.checked; });
  const entry = { email, role, perms };
  try {
    await authFetch(`${FIREBASE_DB_URL}/${USERS_NODE}/${userKey(email)}.json`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry)
    });
    userEntries[email] = entry;
    showToast(`✅ ${esc(email)} yetkileri kaydedildi.`);
    await apiLog("yetki", "", email,
      `rol: ${role === "admin" ? "Admin" : "Kullanıcı"} · ` +
      Object.keys(PERM_LABELS).map(k => `${PERM_LABELS[k]}: ${perms[k] ? "var" : "yok"}`).join(" · "));
    renderAdminTable();
  } catch (e) {
    alert("Kaydedilemedi: " + e.message + "\n\n⚠️ Rules'ta sevkiyat_users için .write izni admin e-postanıza açık olmalı.");
  }
}
async function adminAddUser() {
  const inp = document.getElementById("adminNewEmail");
  const email = inp.value.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) { alert("Geçerli bir e-posta gir."); return; }
  if (userEntries[email]) { alert("Bu kullanıcı zaten listede."); return; }
  const entry = { email, role: "user", perms: { ...DEFAULT_PERMS } };
  try {
    await authFetch(`${FIREBASE_DB_URL}/${USERS_NODE}/${userKey(email)}.json`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry)
    });
    userEntries[email] = entry;
    inp.value = "";
    renderAdminTable();
    showToast(`✅ ${esc(email)} eklendi (varsayılan yetkiler).`);
    await apiLog("yetki", "", email, "yetki listesine eklendi (varsayılan yetkiler)");
  } catch (e) {
    alert("Eklenemedi: " + e.message);
  }
}
async function adminRemoveUser(email) {
  if (!confirm(`${email} için özel yetkiler kaldırılsın mi?\n(Kullanıcı giriş yapmaya devam eder, varsayılan yetkiler uygulanır.)`)) return;
  try {
    await authFetch(`${FIREBASE_DB_URL}/${USERS_NODE}/${userKey(email)}.json`, { method: "DELETE" });
    delete userEntries[email];
    renderAdminTable();
    showToast("🗑️ Kaldırıldı — artık varsayılan yetkileri alır.");
    await apiLog("yetki", "", email, "yetki listesinden kaldırıldı (varsayılan yetkilere döner)");
  } catch (e) {
    alert("Kaldırılamadı: " + e.message);
  }
}
document.getElementById("adminUserTable").addEventListener("click", e => {
  const saveBtn = e.target.closest("button[data-asave]");
  if (saveBtn) { adminSaveUser(saveBtn.dataset.asave); return; }
  const delBtn = e.target.closest("button[data-adel]");
  if (delBtn) { adminRemoveUser(delBtn.dataset.adel); return; }
});
document.getElementById("btnAdminAddUser").addEventListener("click", adminAddUser);
document.getElementById("adminNewEmail").addEventListener("keydown", e => {
  if (e.key === "Enter") adminAddUser();
});
document.getElementById("btnCloseAdmin").addEventListener("click", () => {
  document.getElementById("adminModal").classList.add("hidden");
});
document.getElementById("adminModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});

