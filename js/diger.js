/* ============================================================
   🖥️ DEPO EKRAN MODU — 3 sekme
   ============================================================ */
function openDepo() {
  depoTab = "anlik";
  document.querySelectorAll(".depo-tab").forEach(x => x.classList.toggle("active", x.dataset.dtab === "anlik"));
  document.getElementById("depoOverlay").classList.remove("hidden");
  document.body.classList.add("depo-open");
  renderDepoContent();
}
function closeDepo() {
  stopSnake();
  document.getElementById("depoOverlay").classList.add("hidden");
}
document.getElementById("btnDepoClose").addEventListener("click", closeDepo);
document.getElementById("btnScanOpen").addEventListener("click", openScanner);
document.getElementById("btnScanMain").addEventListener("click", openScanner);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !document.getElementById("depoOverlay").classList.contains("hidden")) closeDepo();
});
document.querySelectorAll(".depo-tab").forEach(b => {
  b.addEventListener("click", () => {
    depoTab = b.dataset.dtab;
    document.querySelectorAll(".depo-tab").forEach(x => x.classList.toggle("active", x.dataset.dtab === depoTab));
    renderDepoContent();
  });
});
function depoCmtLine(r) {
  const l = Array.isArray(r.comments) ? r.comments : [];
  if (!l.length) return "";
  const son5 = l.slice(-5);
  return `<div class="d-cmt">💬 ${son5.map(c => esc(c.text)).join(", ")}</div>`;
}
function depoItem(r, cls, extra) {
  const b = sureBilgi(r);
  const c = [];
  if (r.ekip && ekipler[r.ekip]) c.push(ekipChipHtml(r.ekip));
  if (r.toplamaBasTs && r.toplamaBittiTs)
    c.push(`<span class="di-chip di-ok">📦 ${fmtTime(r.toplamaBasTs)}→${fmtTime(r.toplamaBittiTs)} · ${fmtSure(r.toplamaBittiTs - r.toplamaBasTs)}</span>`);
  else if (r.toplamaBasTs)
    c.push(`<span class="di-chip di-warn">📦 sürüyor · ${fmtTime(r.toplamaBasTs)}'dan</span>`);
  c.push(r.araciGeldi === "GELDİ" ? `<span class="di-chip di-ok">🚛 Geldi</span>` : `<span class="di-chip di-warn">🚛 Gelmedi</span>`);
  if (b.durum === "live")
    c.push(`<span class="di-chip ${b.asim ? "di-bad" : "di-warn"}">⏱ ${fmtSure(b.gecenMs)}${b.asim ? ` · ${b.asimDk}dk AŞIM` : ` / ${b.sureDk}dk · %${b.yuzde}`}</span>`);
  else if (b.durum === "done")
    c.push(`<span class="di-chip ${b.asim ? "di-bad" : "di-ok"}">⏱ ${fmtSure(b.gecenMs)} / ${b.sureDk}dk${b.asim ? ` · +${b.asimDk}dk` : ""}</span>`);
  const cmt = (Array.isArray(r.comments) && r.comments.length) ? r.comments.slice(-2).map(x => x.text).join(" · ") : "";
  return `<div class="depo-item ${cls}">
    <div class="di-main">
      <div class="di-top">
        <span class="d-musteri">${esc(r.musteri)}</span>
        <span class="di-sub">${esc(r.blm)}${r.kategori && r.kategori !== "PLANLI" ? " · " + esc(r.kategori) : ""}</span>
      </div>
      <div class="di-chips">${c.join("")}</div>
      ${r.aciklama ? `<div class="di-note" title="${esc(r.aciklama)}">📝 ${esc(r.aciklama)}</div>` : ""}
      ${cmt ? `<div class="di-note d-cmt" title="${esc(cmt)}">💬 ${esc(cmt)}</div>` : ""}
    </div>
    <div class="d-right">
      <div class="di-tip">${esc(r.sevkiyatTipi)} · <b style="font-size:20px;color:#e2e8f0">${esc(r.ad)}</b> yükleme</div>
      <div class="di-extra">${extra || ""}</div>
      ${(b.durum === "live" && r.loadingStartedAt) ? `<div class="di-saat">⏱ ${fmtTime(r.loadingStartedAt)}'da başladı</div>` : ""}
    </div>
  </div>`;
}
function gunEtiketi(iso) {
  const dt = parseLocalDate(iso);
  if (!dt) return iso;
  const idx = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }[dt.getDay()];
  return `${GUNLER[idx] || ""} ${dt.getDate()} ${AYLAR[dt.getMonth()]}`;
}

function renderDepoContent() {
  renderDepoMini();
  const today = todayISO();
  const d = new Date();
  const dT = r => r.reelPlan || r.planlananTarih || "";
  document.getElementById("depoClock").textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  document.getElementById("depoDate").textContent =
    `${GUNLER[{ 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }[d.getDay()]]} · ${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
  const list = enriched(rows);
  const c = document.getElementById("depoContent");

  /* ---- KALAN YÜKLEMELER ---- */
  if (depoTab === "kalan") {
    const kalan = list.filter(r => {
      const t = dT(r);
      return t && t >= today && r.durum !== "Yükleme Tamamlandı";
    });
    const byDate = new Map();
    kalan.forEach(r => {
      const key = dT(r);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(r);
    });
    const gunler = [...byDate.keys()].sort();
    let html = `<div class="depo-sec-title" style="color:#34d399">📅 KALAN YÜKLEMELER (${kalan.reduce((s, r) => s + adet(r), 0)} yükleme · ${gunler.length} gün)</div>`;
    if (!gunler.length) {
      html += `<div class="depo-empty">Kalan yükleme yok 🎉</div>`;
    } else {
      gunler.forEach(iso => {
        const gList = byDate.get(iso).sort((a, b) => String(a.musteri).localeCompare(String(b.musteri), "tr"));
        const toplamAd = gList.reduce((s, r) => s + adet(r), 0);
        const satirlar = gList.map(r => {
          const tpOn = r.toplamaBasTs && !r.toplamaBittiTs;
          const tpOk = !!r.toplamaBittiTs;
          const tpTxt = tpOk
            ? `<span class="di-chip di-ok">📦 ${fmtTime(r.toplamaBasTs)}→${fmtTime(r.toplamaBittiTs)} · ${fmtSure(r.toplamaBittiTs - r.toplamaBasTs)}</span>`
            : tpOn ? `<span class="di-chip di-warn">📦 sürüyor · ${fmtTime(r.toplamaBasTs)}'dan</span>` : "";
          const b = sureBilgi(r);
          const sureTxt = b.durum === "live"
            ? `<span class="di-chip ${b.asim ? "di-bad" : "di-warn"}">⏱ ${fmtSure(b.gecenMs)} / ${b.sureDk}dk · %${b.yuzde}${b.asim ? ` · ${b.asimDk}dk AŞIM` : ""}</span>`
            : "";
          const chips = [
            ekipler[r.ekip] ? ekipChipHtml(r.ekip) : "",
            tpTxt, sureTxt,
            r.araciGeldi === "GELDİ" ? `<span class="di-chip di-ok">🚛 Geldi</span>` : (r.araciGeldi ? `<span class="di-chip di-warn">🚛 Gelmedi</span>` : "")
          ].filter(Boolean).join(" ");
          return `<div class="depo-week-row" style="flex-wrap:wrap">
            <div class="w-m" style="min-width:260px"><b style="font-size:16px">${esc(r.musteri)}</b>
              <div style="margin-top:4px">${chips}</div>
              ${r.aciklama ? `<div class="di-note" title="${esc(r.aciklama)}">📝 ${esc(r.aciklama)}</div>` : ""}
                            ${(Array.isArray(r.comments) && r.comments.length) ? `<div class="di-note d-cmt" title="${esc(r.comments.slice(-2).map(x => x.text).join(" · "))}">💬 ${esc(r.comments.slice(-2).map(x => x.text).join(" · "))}</div>` : ""}
            </div>
            <div class="w-r">${esc(r.sevkiyatTipi)} · <b style="font-size:16px;color:#e2e8f0">${esc(r.ad)}</b> yükleme · ${formatDate(iso)}</div>
          </div>`;
        }).join("");
        html += `<div class="depo-week-day">
          <h4>${gunEtiketi(iso)} <span>· ${formatDate(iso)}</span> — ${gList.length} kayıt / ${toplamAd} yükleme</h4>
          ${satirlar}
        </div>`;
      });
    }
    c.innerHTML = html;
    return;
  }

  /* ---- BİTMİŞ YÜKLEMELER ---- */
  if (depoTab === "bitmis") {
    const thisWeek = getISOWeek(new Date());
    const bitmis = list.filter(r => {
      if (r.durum !== "Yükleme Tamamlandı") return false;
      const key = r.gerceklesenTarih || r.planlananTarih;
      if (!key) return false;
      const dt = parseLocalDate(key);
      return dt && getISOWeek(dt) === thisWeek;
    });
    const byDate = new Map();
    bitmis.forEach(r => {
      const key = r.gerceklesenTarih || r.planlananTarih;
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(r);
    });
    const gunler = [...byDate.keys()].sort((a, b) => a < b ? 1 : -1);
    let html = `<div class="depo-sec-title" style="color:#34d399">✅ BİTMİŞ YÜKLEMELER — BU HAFTA (${bitmis.reduce((s, r) => s + adet(r), 0)} yükleme · Hafta ${thisWeek})</div>`;
    if (!gunler.length) {
      html += `<div class="depo-empty">Bu haftada tamamlanmış yükleme yok.</div>`;
    } else {
      gunler.forEach(iso => {
        const gList = byDate.get(iso).sort((a, b) => String(a.musteri).localeCompare(String(b.musteri), "tr"));
        const toplamAd = gList.reduce((s, r) => s + adet(r), 0);
        const satirlar = gList.map(r => {
          const b = sureBilgi(r);
          const sureTxt = b.durum === "done"
            ? `<span class="di-chip ${b.asim ? "di-bad" : "di-ok"}">⏱ ${fmtSure(b.gecenMs)} / ${b.sureDk}dk${b.asim ? ` · +${b.asimDk}dk` : ""}</span>`
            : "";
          const chips = [
            ekipler[r.ekip] ? ekipChipHtml(r.ekip) : "",
            r.toplamaBasTs && r.toplamaBittiTs
              ? `<span class="di-chip di-ok">📦 ${fmtTime(r.toplamaBasTs)}→${fmtTime(r.toplamaBittiTs)} · ${fmtSure(r.toplamaBittiTs - r.toplamaBasTs)}</span>` : "",
            sureTxt,
            r.araciGeldi === "GELDİ" ? `<span class="di-chip di-ok">🚛 Geldi</span>`
              : (r.araciGeldi ? `<span class="di-chip di-warn">🚛 Gelmedi</span>` : "")
          ].filter(Boolean).join(" ");
          return `<div class="depo-week-row" style="flex-wrap:wrap">
            <div class="w-m" style="min-width:260px"><b style="font-size:16px">${esc(r.musteri)}</b>
              <div style="margin-top:4px">${chips}</div>
              ${r.aciklama ? `<div class="di-note" title="${esc(r.aciklama)}">📝 ${esc(r.aciklama)}</div>` : ""}
              ${(Array.isArray(r.comments) && r.comments.length) ? `<div class="di-note d-cmt" title="${esc(r.comments.slice(-2).map(x => x.text).join(" · "))}">💬 ${esc(r.comments.slice(-2).map(x => x.text).join(" · "))}</div>` : ""}
            </div>
            <div class="w-r">${esc(r.sevkiyatTipi)} · <b style="font-size:16px;color:#e2e8f0">${esc(r.ad)}</b> yükleme · ${formatDate(iso)}</div>
          </div>`;
        }).join("");
        html += `<div class="depo-week-day">
          <h4>${gunEtiketi(iso)} <span>· ${formatDate(iso)}</span> — ${gList.length} kayıt / ${toplamAd} yükleme</h4>
          ${satirlar}
        </div>`;
      });
    }
    c.innerHTML = html;
    return;
  }

  /* ---- ANLIK DURUM (varsayılan) ---- */
  const opGecikme = r => {
    const t = dT(r);
    if (!t || r.durum === "Yükleme Tamamlandı") return 0;
    if (t >= today) return 0;
    return Math.round((parseLocalDate(today) - parseLocalDate(t)) / 86400000);
  };
  const geciken = list.filter(r => opGecikme(r) > 0).sort((a, b) => dT(a) < dT(b) ? -1 : 1);
  const yukleniyor = list.filter(r => r.durum === "Yükleniyor").sort((a, b) => (a.loadingStartedAt || 0) - (b.loadingStartedAt || 0));
  const bugun = list.filter(r => dT(r) === today && r.durum === "Yükleme Bekliyor")
    .sort((a, b) => String(a.musteri).localeCompare(String(b.musteri), "tr"));
  let html = "";
  html += `<div class="depo-sec-title" style="color:#fbbf24">🟠 ŞİMDİ YÜKLENİYOR (${yukleniyor.length})</div>`;
  html += yukleniyor.length ? yukleniyor.map(r => depoItem(r, "d-amber", formatDate(dT(r)))).join("") : `<div class="depo-empty">Şu an yükleme yok.</div>`;
  html += `<div class="depo-sec-title" style="color:#818cf8">🔵 BUGÜN BEKLİYOR (${bugun.reduce((s, r) => s + adet(r), 0)})</div>`;
  html += bugun.length ? bugun.map(r => {
    const rr = { ...r, _gecikenNotu: "" };
    return depoItem(rr, "d-blue", "bugün");
  }).join("") : `<div class="depo-empty">Bugün için bekleyen yükleme yok.</div>`;
  html += `<div class="depo-sec-title" style="color:#f87171">🔴 GECİKEN (${geciken.reduce((s, r) => s + adet(r), 0)})</div>`;
  html += geciken.length ? geciken.map(r => {
    const gb = gecikmeBilgi(r);
    const rr = { ...r, _gecikenNotu: `${opGecikme(r)} gün gecikti${gb.neden ? " · " + gb.neden : ""}` };
    return depoItem(rr, "d-red", formatDate(dT(r)));
  }).join("") : `<div class="depo-empty">Geciken yükleme yok 🎉</div>`;
  c.innerHTML = html;
}
setInterval(() => {
  if (document.getElementById("depoOverlay").classList.contains("hidden")) return;
  const d = new Date();
  document.getElementById("depoClock").textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}, 1000);
setInterval(() => {
  if (document.getElementById("depoOverlay").classList.contains("hidden") || document.hidden) return;
  if (depoTab === "yilan") return;   /* oyun açıkken yenileme yok */
  renderDepoContent();
}, 30000);

/* ================= 💾 Yedekle / Geri Yükle ================= */
function openBackup() {
  if (!isAdmin()) { alert("Yedekleme sadece yöneticiler içindir."); return; }
  document.getElementById("backupResult").classList.add("hidden");
  document.getElementById("backupModal").classList.remove("hidden");
}
document.getElementById("btnCloseBackup").addEventListener("click", () => {
  document.getElementById("backupModal").classList.add("hidden");
});
document.getElementById("backupModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});
document.getElementById("btnBackupDownload").addEventListener("click", async () => {
  const btn = document.getElementById("btnBackupDownload");
  btn.disabled = true; btn.textContent = "Hazırlanıyor…";
  try {
    const [svk, hist, usr, sur, ars] = await Promise.all([
      fetch(`${FIREBASE_DB_URL}/${NODE}.json`).then(r => r.json()),
      fetch(`${FIREBASE_DB_URL}/${HIST_NODE}.json`).then(r => r.json()),
      authFetch(`${FIREBASE_DB_URL}/${USERS_NODE}.json`).then(r => r.json()),
      fetch(`${FIREBASE_DB_URL}/${SURE_NODE}.json`).then(r => r.json()),
      authFetch(`${FIREBASE_DB_URL}/${ARSIV_NODE}.json`).then(r => r.json())
    ]);
    const payload = {
      app: "sevkiyat-planlama", version: 1, ts: Date.now(),
      user: currentUser.email,
      data: { sevkiyat: svk || {}, history: hist || {}, users: usr || {}, suresi: sur || {}, arsiv: ars || {} }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sevkiyat_yedek_${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    const res = document.getElementById("backupResult");
    res.textContent = `✅ Yedek indirildi: ${Object.keys(svk || {}).length} kayıt, ${Object.keys(hist || {}).length} geçmiş kaydı.`;
    res.classList.remove("hidden");
  } catch (e) {
    alert("Yedek alınamadı: " + e.message);
  }
  btn.disabled = false; btn.textContent = "📥 Yedeği İndir (JSON)";
});
document.getElementById("backupFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const d = parsed.data;
    if (!parsed.app || !d || !d.sevkiyat) { alert("Geçersiz yedek dosyası."); return; }
    const nRec = Object.keys(d.sevkiyat).length;
    if (!confirm(`Geri yükleme onayı:\n• ${nRec} kayıt\n• ${Object.keys(d.history || {}).length} geçmiş kaydı\n• ${Object.keys(d.users || {}).length} kullanıcı\n• Süre ayarları\n\n⚠️ MEVCUT TÜM VERİ SİLİNİP BU YEDEKLE DEĞİŞTİRİLECEK. Emin misin?`)) {
      e.target.value = ""; return;
    }
    await authFetch(`${FIREBASE_DB_URL}/${NODE}.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d.sevkiyat) });
    await authFetch(`${FIREBASE_DB_URL}/${HIST_NODE}.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d.history || {}) });
    await authFetch(`${FIREBASE_DB_URL}/${USERS_NODE}.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d.users || {}) });
    await authFetch(`${FIREBASE_DB_URL}/${SURE_NODE}.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d.suresi || {}) });
    await authFetch(`${FIREBASE_DB_URL}/${ARSIV_NODE}.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d.arsiv || {}) });
    await Promise.all([loadUserEntries(), loadSureAyarlari()]);
    await load(false);
    const res = document.getElementById("backupResult");
    res.textContent = `✅ Geri yükleme tamam: ${nRec} kayıt yüklendi.`;
    res.classList.remove("hidden");
    await apiLog("excel", "", "", `yedekten geri yükleme · ${nRec} kayıt (dosya: ${file.name})`);
    showToast("✅ Yedek geri yüklendi.");
  } catch (err) {
    alert("Geri yükleme hatası: " + err.message);
  }
  e.target.value = "";
});

/* ================= 🤖 Otomatik günlük yedek ================= */
/* Günün ilk girişli açılışında tüm veri Firebase'te YEDEK_NODE'a yazılır;
   son YEDEK_SAKLAMA_GUN gün saklanır, eskiler silinir. Rules'ta sevkiyat_yedek
   düğümüne yetkili kullanıcı için okuma/yazma izni verilmelidir. */
async function otomatikGunlukYedek() {
  if (!currentUser) return;
  try {
    const bugun = todayISO();
    const mevcut = await check(await authFetch(`${FIREBASE_DB_URL}/${YEDEK_NODE}/${bugun}.json`), "Yedek durumu okunamadı");
    if (mevcut) return; /* bugünün yedeği zaten alınmış */
    const [svk, hist, usr, sur, ars] = await Promise.all([
      fetch(`${FIREBASE_DB_URL}/${NODE}.json`).then(r => r.json()),
      fetch(`${FIREBASE_DB_URL}/${HIST_NODE}.json`).then(r => r.json()),
      authFetch(`${FIREBASE_DB_URL}/${USERS_NODE}.json`).then(r => r.json()),
      fetch(`${FIREBASE_DB_URL}/${SURE_NODE}.json`).then(r => r.json()),
      authFetch(`${FIREBASE_DB_URL}/${ARSIV_NODE}.json`).then(r => r.json())
    ]);
    const payload = {
      app: "sevkiyat-planlama", version: 1, ts: Date.now(), user: currentUser.email,
      data: { sevkiyat: svk || {}, history: hist || {}, users: usr || {}, suresi: sur || {}, arsiv: ars || {} }
    };
    await authFetch(`${FIREBASE_DB_URL}/${YEDEK_NODE}/${bugun}.json`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    /* Saklama sınırından eski günlerin yedeklerini sil */
    const sinirD = new Date();
    sinirD.setDate(sinirD.getDate() - YEDEK_SAKLAMA_GUN);
    const sinir = isoFromDate(sinirD);
    const keys = await authFetch(`${FIREBASE_DB_URL}/${YEDEK_NODE}.json?shallow=true`).then(r => r.json());
    if (keys) {
      for (const k of Object.keys(keys)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(k) && k < sinir) {
          try { await authFetch(`${FIREBASE_DB_URL}/${YEDEK_NODE}/${k}.json`, { method: "DELETE" }); } catch (e) {}
        }
      }
    }
    const nRec = Object.keys(payload.data.sevkiyat).length;
    await apiLog("yedek", "", "", `otomatik günlük yedek oluşturuldu · ${nRec} kayıt · ${bugun}`);
    console.info(`🤖 Otomatik günlük yedek alındı (${bugun}): ${nRec} kayıt.`);
  } catch (e) {
    console.warn("Otomatik günlük yedek atlandı:", e.message);
  }
}
/* ================= 🗄️ ARŞİV ================= */
let arsivCache = null;
function arsivTarihi(r) {
  return r.gerceklesenTarih || r.reelPlan || r.planlananTarih || "";
}
async function fetchArsiv() {
  const data = await check(await authFetch(`${FIREBASE_DB_URL}/${ARSIV_NODE}.json`), "Arşiv yüklenemedi");
  return data ? Object.entries(data).map(([id, v]) => ({ id, ...(v || {}) })) : [];
}
async function openArsiv() {
  if (!isAdmin()) { alert("Arşiv sadece yöneticiler içindir."); return; }
  document.getElementById("arsivModal").classList.remove("hidden");
  const inp = document.getElementById("arsivTarih");
  if (!inp.value) {
    const d = new Date(); d.setDate(d.getDate() - 60);
    inp.value = isoFromDate(d);
  }
  await renderArsiv();
}
async function renderArsiv() {
  const tb = document.getElementById("arsivTable");
  const info = document.getElementById("arsivInfo");
  tb.innerHTML = `<tr><td colspan="6" class="empty">Yükleniyor…</td></tr>`;
  try {
    const liste = await fetchArsiv();
    const kesin = document.getElementById("arsivTarih").value || "9999-12-31";
    const adaylar = rows.filter(r => {
      const t = arsivTarihi(r);
      return t && t < kesin && r.durum !== "Yükleniyor";
    });
    info.innerHTML = `Arşivde <b>${liste.length}</b> kayıt var · Seçilen tarihten (${formatDate(kesin)}) eski <b>${adaylar.length}</b> kayıt arşivlenebilir.`;
    liste.sort((a, b) => tarihCmp(arsivTarihi(b), arsivTarihi(a)));
      tb.innerHTML = liste.length ? liste.map(r => `<tr>
      <td class="strong">${esc(r.musteri)}</td>
      <td class="center">${formatDate(r.planlananTarih)}</td>
      <td class="center">${formatDate(r.reelPlan)}</td>
      <td class="center">${formatDate(r.gerceklesenTarih)}</td>
      <td>${esc(r.durum)}</td>
      <td class="center">${esc(r.ad)}</td>
      </tr>`).join("") : `<tr><td colspan="6" class="empty">Arşiv henüz boş.</td></tr>`;
  } catch (e) {
    tb.innerHTML = `<tr><td colspan="6" class="empty">Arşiv okunamadı: ${esc(e.message)}</td></tr>`;
  }
}

document.getElementById("arsivDahil").addEventListener("change", async e => {
  arsivDahil = e.target.checked;
  savePrefs();
  if (arsivDahil && !Array.isArray(arsivCache)) {
    e.target.disabled = true;
    try { arsivCache = await fetchArsiv(); }
    catch (err) { showToast("⚠️ Arşiv yüklenemedi: " + esc(err.message)); arsivDahil = false; e.target.checked = false; }
    e.target.disabled = false;
  }
  render();
});
async function arsivle() {
  const kesin = document.getElementById("arsivTarih").value;
  if (!kesin) { alert("Bir tarih seç."); return; }
  const adaylar = rows.filter(r => {
    const t = arsivTarihi(r);
    return t && t < kesin && r.durum !== "Yükleniyor";
  });
  if (!adaylar.length) { alert("Bu tarihtan eski arşivlenecek kayıt yok."); return; }
  if (!confirm(`${adaylar.length} kayıt arşive taşınacak.\nAna tablodan, depodan ve sayaçlardan kaybolurlar; arşiv raporlarından ve Excel'den görüntülenebilirler.\n\nOnaylıyor musun?`)) return;
  const btn = document.getElementById("btnArsivCalistir");
  btn.disabled = true; btn.textContent = "Arşivleniyor…";
  try {
    const paket = {};
    adaylar.forEach(r => { paket[r.id] = toDb(r); });
    await authFetch(`${FIREBASE_DB_URL}/${ARSIV_NODE}.json`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(paket)
    });
    const silinecek = {};
    adaylar.forEach(r => { silinecek[r.id] = null; });
    await authFetch(`${FIREBASE_DB_URL}/${NODE}.json`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(silinecek)
    });
    try { arsivCache = await fetchArsiv(); } catch (e2) { arsivCache = null; }
    await apiLog("guncelleme", "", adaylar.slice(0, 20).map(r => r.musteri).join(", ") + (adaylar.length > 20 ? "…" : ""),
      `🗄️ ${adaylar.length} kayıt arşive taşındı (sınır: ${formatDate(kesin)})`);
    showToast(`✅ ${adaylar.length} kayıt arşive taşındı.`);
    await load(false);
    await renderArsiv();
  } catch (e) {
    alert("Arşivleme hatası: " + e.message + "\n\n⚠️ Rules'ta sevkiyat_arsiv izni var mı kontrol et.");
  }
  btn.disabled = false; btn.textContent = "📦 Arşivle";
}
async function arsivExcel() {
  if (typeof XLSX === "undefined") { alert("Excel kütüphanesi yüklenemedi."); return; }
  try {
    const liste = await fetchArsiv();
    if (!liste.length) { alert("Arşiv boş."); return; }
    const data = liste.map(r => ({
      "Müşteri": r.musteri, "BLM": r.blm, "Kategori": r.kategori,
      "Sevkiyat Tipi": r.sevkiyatTipi, "AD": Number(r.ad) || 0,
      "Planlanan": formatDate(r.planlananTarih), "Reel Plan": formatDate(r.reelPlan),
      "Gerçekleşen": formatDate(r.gerceklesenTarih), "Durum": r.durum,
      "M3": r.m3 ?? "", "Ekleyen": r.createdBy || ""
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Arsiv");
    XLSX.writeFile(wb, `sevkiyat_arsiv_${todayISO()}.xlsx`);
  } catch (e) { alert("Excel hatası: " + e.message); }
}
document.getElementById("btnArsiv").addEventListener("click", openArsiv);
document.getElementById("btnCloseArsiv").addEventListener("click", () =>
  document.getElementById("arsivModal").classList.add("hidden"));
document.getElementById("arsivModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});
document.getElementById("btnArsivCalistir").addEventListener("click", arsivle);
document.getElementById("arsivTarih").addEventListener("change", renderArsiv);
document.getElementById("btnArsivExcel").addEventListener("click", arsivExcel);

/* 🗄️ Arşiv raporu — gecikme bilgisini snapshot'tan (gecikmeSon) okur */
function arsivStatsTable(list, keyFn, title, colLabel) {
  const m = new Map();
  list.forEach(r => {
    const k = keyFn(r) || "-";
    if (!m.has(k)) m.set(k, { ad: 0, m3: 0, geciken: 0, maxG: 0 });
    const g = m.get(k);
    const a = adet(r);
    g.ad += a; g.m3 += Number(r.m3) || 0;
    const gs = Number(r.gecikmeSon) || 0;
    if (gs > 0) { g.geciken += a; g.maxG = Math.max(g.maxG, gs); }
  });
  let tA = 0, tG = 0, tM = 0;
  const rowsHtml = [...m.entries()].sort((a, b) => b[1].ad - a[1].ad).map(([k, g]) => {
    tA += g.ad; tG += g.geciken; tM += g.m3;
    return `<tr><td class="strong">${esc(k)}</td><td class="center">${fmtN(g.ad)}</td><td class="center" style="${g.geciken ? "color:var(--red);font-weight:600" : ""}">${g.geciken ? fmtN(g.geciken) : "-"}</td><td class="center">${g.maxG ? g.maxG + " gün" : "-"}</td><td class="center">${fmtN(g.m3)}</td></tr>`;
  }).join("");
  return `<div class="rpt"><h3>${esc(title)}</h3><div class="table-wrap"><table>
    <thead><tr><th>${esc(colLabel)}</th><th>Yükleme</th><th>Gecikmeli</th><th>En kötü gecikme</th><th>M3</th></tr></thead>
    <tbody>${rowsHtml || `<tr><td colspan="5" class="empty">Veri yok</td></tr>`}</tbody>
    <tfoot><tr><td>TOPLAM</td><td class="center">${fmtN(tA)}</td><td class="center">${fmtN(tG)}</td><td class="center">—</td><td class="center">${fmtN(tM)}</td></tr></tfoot>
  </table></div></div>`;
}
async function buildArsiv() {
  const c = document.getElementById("reportPaneArsiv");
  c.innerHTML = `<p class="hint">🗄️ Arşiv yükleniyor…</p>`;
  try {
    if (!arsivCache) arsivCache = await fetchArsiv();
  } catch (e) {
    c.innerHTML = `<p class="hint">Arşiv okunamadı: ${esc(e.message)} (Rules kontrol et)</p>`;
    return;
  }
  const list = arsivCache;
  if (!list.length) {
    c.innerHTML = `<p class="hint">🗄️ Arşiv henüz boş — kayıtlar arşivlendiğinde burada dönemsel raporlar oluşur.</p>`;
    return;
  }
  const zengin = enriched(list);
  const toplamAd = zengin.reduce((s, r) => s + adet(r), 0);
  const toplamM3 = zengin.reduce((s, r) => s + (Number(r.m3) || 0), 0);
  const gecikenAd = zengin.reduce((s, r) => s + ((Number(r.gecikmeSon) || 0) > 0 ? adet(r) : 0), 0);
  let minT = "", maxT = "";
  zengin.forEach(r => {
    const t = arsivTarihi(r);
    if (t && (!minT || t < minT)) minT = t;
    if (t && (!maxT || t > maxT)) maxT = t;
  });
  const kpiBlock = `<div class="kpi-grid">
    <div class="kpi c-primary"><div class="kpi-head">📦 Arşivdeki toplam</div><div class="kpi-val">${fmtN(toplamAd)}</div><div class="kpi-sub">${zengin.length} kayıt · ${fmtN(toplamM3)} m³</div></div>
    <div class="kpi c-red"><div class="kpi-head">⚠️ Gecikmeli (kayıt anı)</div><div class="kpi-val">${fmtN(gecikenAd)}</div><div class="kpi-sub">tamamlanma anındaki gecikme snapshot'ı</div></div>
    <div class="kpi c-amber"><div class="kpi-head">🗓️ Tarih aralığı</div><div class="kpi-val" style="font-size:16px;align-self:center">${minT ? formatDate(minT) + " → " + formatDate(maxT) : "—"}</div><div class="kpi-sub">arşiv tarihi bazlı</div></div>
  </div>`;
  const tablolar =
    arsivStatsTable(zengin, r => r.musteri, "👥 Müşteri bazlı (arşiv)", "Müşteri") +
    arsivStatsTable(zengin, r => r.ay || "-", "📆 Ay bazlı (reel plan ayı)", "Ay") +
    arsivStatsTable(zengin, r => r.blm, "🏢 BLM bazlı (arşiv)", "BLM") +
    arsivStatsTable(zengin, r => r.sevkiyatTipi, "🚛 Sevkiyat tipi bazlı (arşiv)", "Tip");
  c.innerHTML = kpiBlock + tablolar;
}

/* ═══════════════════════════════════════════════════════════
   👷 EKİP PERFORMANS MODÜLÜ — PART 1 (veri + atama + depo)
   ═══════════════════════════════════════════════════════════ */
const EKIP_NODE = "sevkiyat_ekipler";
const EKIP_RENKLERI = ["#6366f1","#059669","#d97706","#0ea5e9","#8b5cf6","#dc2626","#0f766e","#be185d"];
let ekipler = {};              /* { "ekip-1": { ad, aktif, ts } } */
let ekipSira = [];             /* ["ekip-1","ekip-2",...] — sıralı liste */

/* ---------- Ekip adı/renk yardımcıları ---------- */
function ekipAd(kod) { return (ekipler[kod] && ekipler[kod].ad) || kod; }
function ekipRenk(kod) {
  const n = parseInt(String(kod).replace(/\D/g, ""), 10) || 1;
  return EKIP_RENKLERI[(n - 1) % EKIP_RENKLERI.length];
}
function ekipChipHtml(kod) {
  if (!kod || !ekipler[kod]) return "";
  return `<span class="ekip-chip" style="background:${ekipRenk(kod)}" title="Ekip: ${esc(ekipAd(kod))}">👷 ${esc(ekipAd(kod))}</span>`;
}
/* Etkin süre (ms): toplama bitti varsa o an, yoksa kronometre bitişi */
function etkinSureMs(r) {
  if (!r.loadingStartedAt) return 0;
  const bitis = r.toplamaBittiTs || r.loadingEndedAt;
  if (!bitis) return 0;
  return Math.max(0, bitis - r.loadingStartedAt);
}

/* ═══════════════ 👷 EKİP SEÇİM KUTUSU (toplama öncesi zorunlu) ═══════════════ */
function ekipSecModal(basarili) {
  /* basarili(ekipKod) — seçim yapılırsa çağrılır; iptal edilirse hiç çağrılmaz */
  const aktifler = aktifEkipler();
  if (!aktifler.length) {
    alert("⚠️ Hiç aktif ekip yok — önce Admin'den 👷 Ekipler panelinden ekip oluşturun.");
    return;
  }
  const eski = document.getElementById("ekipSecModal");
  if (eski) eski.remove();
  const modal = document.createElement("div");
  modal.id = "ekipSecModal";
  modal.className = "modal-bg";
  modal.style.zIndex = "96";
  modal.innerHTML = `<div class="modal" style="max-width:400px">
    <h2>👷 Ekip Seçimi</h2>
    <p class="hint">Toplamayı başlatmak için <b>ekip seçimi zorunludur</b>. Yalnızca atama yapmak istiyorsanız "Sadece ata"yı seçin.</p>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${aktifler.map(k => `<button class="btn" data-eksec="${esc(k)}"
        style="text-align:left;padding:12px 14px;font-size:14px;font-weight:700">
        <span class="ekip-chip" style="background:${ekipRenk(k)}">👷 ${esc(ekipAd(k))}</span>
      </button>`).join("")}
      <button class="btn" data-eksec="__sadece__" style="text-align:left;padding:10px 14px;color:var(--muted)">
        📌 Sadece ekip ata (toplamayı başlatma)
      </button>
    </div>
    <div class="modal-actions"><button class="btn" data-eksec="__iptal__">Vazgeç</button></div>
  </div>`;
  modal.addEventListener("click", e => {
    const b = e.target.closest("[data-eksec]");
    if (!b) return;
    modal.remove();
    const v = b.dataset.eksec;
    if (v === "__iptal__") return;
    basarili(v);   /* "__sadece__" dahil — işleyen taraf kararlaştırır */
  });
  document.body.appendChild(modal);
}
async function ekipAtaVeTopla(row, kod) {
  try {
    const updated = { ...row, ekip: kod };
    if (kod !== "__sadece__") {
      updated.toplamaBasTs = Date.now();
      updated.toplamaBittiTs = null;
    }
    const saved = await apiUpdate(row.id, updated);
    rows = rows.map(r => r.id === row.id ? saved : r);
    setSaveError("");
    render();
    const isOv = document.getElementById("islemOverlay");
    if (isOv && !isOv.classList.contains("hidden")) renderIslem();
    if (document.getElementById("opOverlay")) renderOpCard();
    await apiLog("guncelleme", row.id, row.musteri,
      kod === "__sadece__"
        ? `👷 ekip atandı: ${ekipAd(kod) || kod} (toplama başlatılmadı)`
        : `👷 ekip atandı: ${ekipAd(kod)} + 📦 toplama başlatıldı (${fmtTime(saved.toplamaBasTs)})`);
    showToast(kod === "__sadece__"
      ? `👷 ${esc(ekipAd(kod))} atandı.`
      : `👷 ${esc(ekipAd(kod))} — 📦 toplama başladı!`);
  } catch (e) { alert("Kaydedilemedi: " + e.message); }
}

/* ---------- 📦 TOPLAMA SÜRECİ (statüden bağımsız) ---------- */
async function toplamaAction(action, idOverride = null) {
  const targetId = idOverride || currentOpId || islemId;
  if (!currentUser) { showLogin("İşlem için giriş yapın."); return; }
  if (!hasPerm("edit")) { alert("Bu işlem için düzenleme yetkiniz yok."); return; }
  const row = await freshRow(targetId);
  if (!row) { alert("Kayıt bulunamadı."); return; }
  const updated = { ...row };
  let etiket = "";
   if (action === "basla") {
    if (row.toplamaBasTs) { showToast("ℹ️ Toplama zaten başlatılmış (" + fmtTime(row.toplamaBasTs) + ")."); return; }
    /* 👷 Ekipsiz toplama başlamaz — önce zorunlu ekip seçimi */
    if (!row.ekip || !ekipler[row.ekip]) {
      ekipSecModal(kod => ekipAtaVeTopla(row, kod));
      return;
    }
    updated.toplamaBasTs = Date.now();
    updated.toplamaBittiTs = null;
    etiket = "📦 toplama başlatıldı";
  } else if (action === "bitti") {
    if (!row.toplamaBasTs) { alert("Önce toplamayı başlatın."); return; }
    if (row.toplamaBittiTs) { showToast("ℹ️ Toplama zaten bitmiş (" + fmtTime(row.toplamaBittiTs) + ")."); return; }
    updated.toplamaBittiTs = Date.now();
    etiket = "📦 toplama bitti";
  } else return;
  try {
    const saved = await apiUpdate(row.id, updated);
    rows = rows.map(r => r.id === row.id ? saved : r);
    setSaveError("");
    render();
    const isOv = document.getElementById("islemOverlay");
    if (isOv && !isOv.classList.contains("hidden")) renderIslem();
    if (document.getElementById("opOverlay")) renderOpCard();
    const sure = (action === "bitti") ? fmtSure(saved.toplamaBittiTs - saved.toplamaBasTs) : "";
    await apiLog("guncelleme", row.id, row.musteri, `${etiket}${sure ? " · süre: " + sure : ""}${row.ekip ? " · " + ekipAd(row.ekip) : ""}`);
    showToast(`✅ ${esc(row.musteri)}: ${etiket}${sure ? " — " + sure : ""}`);
  } catch (e) { alert("Kaydedilemedi: " + e.message); }
}
/* Depo kartı için toplama durum satırı */
function depoToplamaSatiri(r) {
  if (!r.toplamaBasTs) return "";
  if (r.toplamaBittiTs) {
    return `<div class="d-sub"><span class="ekip-toplam-bitti">📦 Toplama bitti ${fmtTime(r.toplamaBittiTs)} · ${fmtSure(r.toplamaBittiTs - r.toplamaBasTs)}</span></div>`;
  }
  return `<div class="d-sub" style="color:#fbbf24;font-weight:700">📦 Toplama sürüyor — ${fmtTime(r.toplamaBasTs)}'da başladı</div>`;
}

/* ═══════════════ 👷 EKİP PERFORMANS RAPORU (PART 2) ═══════════════
   Task 21 — kapsamlı rapor: 8 KPI kartı, 🥧 SVG pasta (m³ paylaşımı),
   ⏱ ort dk/yükleme bar karşılaştırması (hedef işaretli), TOPLAM satırı,
   Excel'e "Paylasim" sayfası. Grafikler kütüphanesiz — ek bağımlılık yok. */
function ekipEvren(list) {
  /* Performans evreni: toplama süreci BİTMİŞ satırlar (statü fark etmez) */
  return list.filter(r => r.toplamaBasTs && r.toplamaBittiTs)
    .map(r => {
      const fd = new Date(r.toplamaBittiTs);
      return {
        r,
        ekip: r.ekip || "__atanmamis__",
        etkinDk: Math.max(1, Math.round((r.toplamaBittiTs - r.toplamaBasTs) / 60000)),
        stDk: getSureDk(r) * (adet(r) || 1),
        m3: Number(r.m3) || 0,
        gun: isoFromDate(fd),
        hafta: getISOWeek(fd)
      };
    });
}
function ekipOzetMap(evren) {
  const m = new Map();
  evren.forEach(x => {
    if (!m.has(x.ekip)) m.set(x.ekip, { ekip: x.ekip, n: 0, m3: 0, etkin: 0, st: 0 });
    const g = m.get(x.ekip);
    g.n++; g.m3 += x.m3; g.etkin += x.etkinDk; g.st += x.stDk;
  });
  return m;
}
function ekipAd2(kod) { return kod === "__atanmamis__" ? "⚠ Atanmamış" : ekipAd(kod); }
function ekipRenk2(kod) { return kod === "__atanmamis__" ? "#64748b" : ekipRenk(kod); }

/* ---------- 🥧 Pasta grafiği (saf SVG — kütüphane yok) ----------
   items: [{ ad, deger, renk }] — deger toplamı > 0 olmalı. Donut ortasında
   toplam m³, ≥%8 dilimlerde yüzde etiketi gösterilir. */
function ekipPastaSVG(items) {
  const toplam = items.reduce((s, x) => s + x.deger, 0);
  const cx = 95, cy = 95, r = 78, ir = 46;
  let a0 = -Math.PI / 2, parcalar = "";
  items.forEach(x => {
    const frac = toplam > 0 ? x.deger / toplam : 0;
    if (frac <= 0) return;
    if (frac >= 0.9999) {
      parcalar += `<circle cx="${cx}" cy="${cy}" r="${(r + ir) / 2}" fill="none" stroke="${x.renk}" stroke-width="${r - ir}"/>`;
    } else {
      const buyuk = frac > 0.5 ? 1 : 0;
      const a1 = a0 + frac * 2 * Math.PI;
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const x2 = cx + ir * Math.cos(a1), y2 = cy + ir * Math.sin(a1);
      const x3 = cx + ir * Math.cos(a0), y3 = cy + ir * Math.sin(a0);
      parcalar += `<path d="M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${buyuk} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} A ${ir} ${ir} 0 ${buyuk} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z" fill="${x.renk}" stroke="var(--surface)" stroke-width="2"/>`;
      if (frac >= 0.08) {
        const mid = a0 + frac * Math.PI, rm = (r + ir) / 2;
        parcalar += `<text x="${(cx + rm * Math.cos(mid)).toFixed(1)}" y="${(cy + rm * Math.sin(mid) + 3.5).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="800" fill="#fff" style="pointer-events:none">%${Math.round(frac * 100)}</text>`;
      }
    }
    a0 += frac * 2 * Math.PI;
  });
  return `<svg viewBox="0 0 190 190" style="width:190px;height:190px;flex:0 0 auto" role="img">${parcalar}` +
    `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="15" font-weight="800" fill="var(--text)">${fmtN(toplam)}</text>` +
    `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="9" fill="var(--muted)">m³ toplam</text></svg>`;
}
/* ---------- ⏱ Ort dk/yükleme bar listesi (genel hedef işaretli) ---------- */
function ekipBarListe(dizi, hedefOrt) {
  const maxOrt = Math.max(...dizi.map(g => g.etkin / g.n));
  const hedefPct = hedefOrt > 0 && maxOrt > 0 ? Math.min(100, Math.max(0, hedefOrt / maxOrt * 100)) : null;
  return [...dizi].sort((a, b) => (b.etkin / b.n) - (a.etkin / a.n)).map(g => {
    const ort = g.etkin / g.n;
    const pct = Math.max(3, Math.round(ort / maxOrt * 100));
    const sapma = g.st > 0 ? Math.round((g.etkin - g.st) / g.st * 100) : null;
    return `<div class="ekip-bar-row">
      <span class="ekip-bar-ad" title="${esc(ekipAd2(g.ekip))}">${esc(ekipAd2(g.ekip))}</span>
      <div class="ekip-bar-track">
        <div class="ekip-bar-fill" style="width:${pct}%;background:${ekipRenk2(g.ekip)}"></div>
        ${hedefPct != null ? `<div class="ekip-bar-hedef" style="left:${hedefPct.toFixed(1)}%" title="Genel hedef ort: ${fmtN(hedefOrt)} dk"></div>` : ""}
      </div>
      <span class="ekip-bar-val"><b>${fmtN(ort)}</b> dk${sapma != null ? ` · <span style="font-weight:700;color:${sapma > 10 ? "var(--red)" : sapma < -5 ? "var(--green)" : "var(--amber)"}">${fmtSapma(sapma)}%</span>` : ""}</span>
    </div>`;
  }).join("");
}

function buildEkip(list = null) {
  const c = document.getElementById("reportPaneEkip");
  if (!ekipSira.length) {
    c.innerHTML = `<p class="hint">Süre = 📦 <b>Toplama başlangıç → bitiş</b> (Operasyon/QR ekranındaki toplama butonlarıyla). Statü kronometresinden bağımsızdır — üretim beklemesi etkilemez. Sapma: standart hedefe (⏱️ Süreler × AD) göre fark.</p>`;
    return;
  }
  const kaynak = list || filtered();
  const evren = ekipEvren(kaynak);
  if (!evren.length) {
    c.innerHTML = `<p class="hint">⏱️ Performans verisi yok — kronometresi başlamış ve (📦 toplama bitti işaretli veya ✔ tamamlanmış) kayıt bulunamadı.</p>`;
    return;
  }
  const ozet = ekipOzetMap(evren);
  const dizi = [...ozet.values()].sort((a, b) => b.n - a.n);
  const enCok = dizi[0];
  const hizlis = dizi.filter(g => g.n >= 3 && g.etkin > 0);
  const enHizli = hizlis.length ? [...hizlis].sort((a, b) => (a.etkin / a.n) - (b.etkin / b.n))[0] : null;
  const atanmamisN = kaynak.filter(r => !r.ekip && !r._arsiv).length;
  const toplamDk = evren.reduce((s, x) => s + x.etkinDk, 0);
  const toplamM3 = evren.reduce((s, x) => s + x.m3, 0);
  const toplamSt = dizi.reduce((s, g) => s + g.st, 0);
  const genelSapma = toplamSt > 0 ? Math.round((toplamDk - toplamSt) / toplamSt * 100) : null;
  const genelHedefOrt = toplamSt > 0 ? toplamSt / evren.length : 0;
  /* 📈 Haftalık trend: verideki en yeni iki haftanın yükleme sayıları */
  const haftaN = new Map();
  evren.forEach(x => haftaN.set(x.hafta, (haftaN.get(x.hafta) || 0) + 1));
  const wArr = [...haftaN.keys()].sort((a, b) => b - a);
  let trendVal = "—", trendSub = "tek hafta verisi", trendCls = "c-primary";
  if (wArr.length >= 2) {
    const n1 = haftaN.get(wArr[0]), n0 = haftaN.get(wArr[1]);
    const degis = n0 > 0 ? Math.round((n1 - n0) / n0 * 100) : null;
    trendVal = degis == null ? "—" : (degis > 0 ? "+" : "") + degis + "%";
    trendSub = `H${wArr[0]}: ${n1} · H${wArr[1]}: ${n0} yükleme`;
    trendCls = degis == null ? "c-primary" : (degis >= 0 ? "c-green" : "c-red");
  }
  const kpi = `<div class="kpi-grid">
    <div class="kpi c-primary"><div class="kpi-head">🥇 En çok yükleyen</div><div class="kpi-val" style="font-size:18px">${esc(ekipAd2(enCok.ekip))}</div><div class="kpi-sub">${enCok.n} yükleme · ${fmtN(enCok.m3)} m³</div></div>
    <div class="kpi c-green"><div class="kpi-head">⚡ En hızlı (≥3 yükleme)</div><div class="kpi-val" style="font-size:18px">${enHizli ? esc(ekipAd2(enHizli.ekip)) : "—"}</div><div class="kpi-sub">${enHizli ? fmtN(enHizli.etkin / enHizli.n) + " dk/yükleme" : "yeterli veri yok"}</div></div>
    <div class="kpi c-amber"><div class="kpi-head">🧮 Toplam etkin iş</div><div class="kpi-val">${fmtN(toplamDk)}</div><div class="kpi-sub">dk · ${evren.length} yükleme</div></div>
    <div class="kpi ${atanmamisN ? "c-red" : "c-green"}"><div class="kpi-head">⚠️ Atanmamış kayıt</div><div class="kpi-val">${atanmamisN}</div><div class="kpi-sub">aktif kayıtlarda ekip boş</div></div>
    <div class="kpi c-primary"><div class="kpi-head">📦 Toplam hacim</div><div class="kpi-val">${fmtN(toplamM3)}</div><div class="kpi-sub">m³ · ${dizi.length} ekip çalıştı</div></div>
    <div class="kpi c-amber"><div class="kpi-head">📊 Ort hacim</div><div class="kpi-val">${fmtN(evren.length ? toplamM3 / evren.length : 0)}</div><div class="kpi-sub">m³/yükleme</div></div>
    <div class="kpi ${genelSapma == null ? "c-primary" : genelSapma > 10 ? "c-red" : genelSapma < -5 ? "c-green" : "c-amber"}"><div class="kpi-head">🎯 Genel hedef sapması</div><div class="kpi-val">${genelSapma == null ? "—" : fmtSapma(genelSapma) + "%"}</div><div class="kpi-sub">tüm ekipler: etkin iş vs hedef</div></div>
    <div class="kpi ${trendCls}"><div class="kpi-head">📈 Haftalık trend</div><div class="kpi-val" style="font-size:22px">${trendVal}</div><div class="kpi-sub">${trendSub}</div></div>
  </div>`;
  /* 🥧 Pasta + ⏱ bar grafikleri bölümü (kütüphanesiz) */
  const pastaLeg = dizi.map(g => {
    const pct = toplamM3 > 0 ? Math.round(g.m3 / toplamM3 * 100) : 0;
    return `<div class="pl-row"><span class="pl-dot" style="background:${ekipRenk2(g.ekip)}"></span><span class="pl-ad">${esc(ekipAd2(g.ekip))}</span><span class="pl-val">${fmtN(g.m3)} m³ · %${pct}</span></div>`;
  }).join("");
  const pasta = toplamM3 > 0 ? `<div class="chart-grid">
    <div class="chart-box"><h3>🥧 Hacim (m³) paylaşımı — ekip bazlı</h3><div class="ekip-pasta-wrap">${ekipPastaSVG(dizi.map(g => ({ ad: ekipAd2(g.ekip), deger: g.m3, renk: ekipRenk2(g.ekip) })))}<div class="ekip-pasta-legend">${pastaLeg}</div></div></div>
    <div class="chart-box"><h3>⏱ Ort dk/yükleme karşılaştırması <span class="muted" style="font-weight:400">(kesikli çizgi = genel hedef ort: ${genelHedefOrt > 0 ? fmtN(genelHedefOrt) + " dk" : "—"})</span></h3>${ekipBarListe(dizi, genelHedefOrt)}</div>
  </div>` : "";
  const aRows = dizi.map(g => {
    const sapma = g.st > 0 ? Math.round((g.etkin - g.st) / g.st * 100) : null;
    const sapmaHtml = sapma == null ? `<span class="muted">-</span>`
      : `<span style="font-weight:700;color:${sapma > 10 ? "var(--red)" : sapma < -5 ? "var(--green)" : "var(--amber)"}">${fmtSapma(sapma)}%</span>`;
    return `<tr>
      <td><span class="ekip-chip" style="background:${ekipRenk2(g.ekip)}">👷 ${esc(ekipAd2(g.ekip))}</span></td>
      <td class="center oh-strong">${g.n}</td>
      <td class="center">${fmtN(g.m3)}</td>
      <td class="center">${fmtN(g.etkin)}</td>
      <td class="center oh-strong">${fmtN(g.etkin / g.n)} dk</td>
      <td class="center">${sapmaHtml}</td>
    </tr>`;
  }).join("");
  const aToplam = `<tfoot><tr>
    <td>TOPLAM · ${dizi.length} ekip</td>
    <td class="center oh-strong">${evren.length}</td>
    <td class="center">${fmtN(toplamM3)}</td>
    <td class="center">${fmtN(toplamDk)}</td>
    <td class="center oh-strong">${fmtN(evren.length ? toplamDk / evren.length : 0)} dk</td>
    <td class="center">${genelSapma == null ? `<span class="muted">-</span>` : `<span style="font-weight:700;color:${genelSapma > 10 ? "var(--red)" : genelSapma < -5 ? "var(--green)" : "var(--amber)"}">${fmtSapma(genelSapma)}%</span>`}</td>
  </tr></tfoot>`;
  const tabA = `<div class="rpt"><h3>👷 Ekip performansı — etkin süre (📦 toplama bitti, yoksa kronometre bitişi)</h3>
    <p class="hint">Sapma: etkin toplam dk'nın standart hedefe (⏱️ Süreler paneli × AD) göre farkı. <b>+</b> hedefi aştı (kırmızı), <b>−</b> hedefin altında (yeşil). "Toplama bitti" işaretli ama statüsü bekleyenler rapora DAHİL — üretim eksiği performansı bozmaz.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Ekip</th><th class="center">Yükleme</th><th class="center">m³</th><th class="center">Etkin dk</th><th class="center">Ort dk/yükleme</th><th class="center">Hedef sapması</th></tr></thead>
      <tbody>${aRows}</tbody>${aToplam}</table></div></div>`;
  function pivot(keyName, keyOf, sortNum, limit) {
    const cols = [...new Set(evren.map(x => x.ekip))].sort((a, b) => {
      if (a === "__atanmamis__") return 1;
      if (b === "__atanmamis__") return -1;
      return (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0);
    });
    const byKey = new Map();
    evren.forEach(x => {
      const k = keyOf(x);
      if (!byKey.has(k)) byKey.set(k, {});
      const row = byKey.get(k);
      if (!row[x.ekip]) row[x.ekip] = { n: 0, m3: 0, dk: 0 };
      const cell = row[x.ekip];
      cell.n++; cell.m3 += x.m3; cell.dk += x.etkinDk;
    });
    let keys = [...byKey.keys()];
    keys.sort((a, b) => sortNum ? b - a : String(b).localeCompare(String(a)));
    keys = keys.slice(0, limit);
    const head = `<tr><th>${keyName}</th>${cols.map(k => `<th class="center">${esc(ekipAd2(k))}</th>`).join("")}</tr>`;
    const rows = keys.map(k => {
      const row = byKey.get(k);
      return `<tr><td class="strong">${esc(k)}</td>${cols.map(kk => {
        const cell = row[kk];
        return `<td class="center">${cell ? `${cell.n} yük<br><span class="muted" style="font-size:9.5px">${fmtN(cell.m3)} m³ · ${fmtN(cell.dk)} dk</span>` : '<span class="muted">-</span>'}</td>`;
      }).join("")}</tr>`;
    }).join("");
    return `<div class="table-wrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
  }
  const tabB = `<div class="rpt"><h3>📅 Gün × Ekip (son 14 gün — hangi gün hangi ekip kaç yükleme/kaç m³/kaç dk)</h3>${pivot("Gün", x => x.gun, false, 14)}</div>`;
  const tabC = `<div class="rpt"><h3>📆 Hafta × Ekip (son 8 hafta trendi)</h3>${pivot("Hafta", x => x.hafta, true, 8)}</div>`;
  c.innerHTML = kpi + pasta + tabA + tabB + tabC +
    `<div class="modal-actions" style="justify-content:flex-start"><button class="btn primary" id="btnEkipExcel">📤 Excel</button></div>`;
  c.querySelector("#btnEkipExcel").addEventListener("click", ekipExcelRapor);
}
function ekipExcelRapor() {
  if (typeof XLSX === "undefined") { alert("Excel kütüphanesi yüklenemedi."); return; }
  const evren = ekipEvren(filtered());
  if (!evren.length) { alert("Performans verisi yok."); return; }
  const ozet = ekipOzetMap(evren);
  const diziX = [...ozet.values()].sort((a, b) => b.n - a.n);
  const toplamM3X = diziX.reduce((s, g) => s + g.m3, 0);
  const toplamNX = diziX.reduce((s, g) => s + g.n, 0);
  const ozetRows = diziX.map(g => [
    ekipAd2(g.ekip), g.n, +g.m3.toFixed(2), g.etkin, +(g.etkin / g.n).toFixed(1),
    g.st > 0 ? Math.round((g.etkin - g.st) / g.st * 100) + "%" : ""
  ]);
  /* 🆕 Task 21: Paylaşım sayfası — pasta grafiğinin Excel karşılığı */
  const payRows = diziX.map(g => [
    ekipAd2(g.ekip), +g.m3.toFixed(2), toplamM3X > 0 ? +(g.m3 / toplamM3X * 100).toFixed(1) + "%" : "",
    g.n, toplamNX > 0 ? +(g.n / toplamNX * 100).toFixed(1) + "%" : "", +(g.etkin / g.n).toFixed(1)
  ]);
  const gunRows = evren.slice().sort((a, b) => String(b.gun).localeCompare(String(a.gun)))
    .map(x => [x.gun, ekipAd2(x.ekip), x.r.musteri, x.r.maddeKodu || "", adet(x.r), x.m3, x.etkinDk,
      x.r.durum === "Yükleme Tamamlandı" ? "Tamamlandı" : "Toplama bitti"]);
  const hf = new Map();
  evren.forEach(x => {
    const k = x.hafta + "|" + x.ekip;
    if (!hf.has(k)) hf.set(k, { hafta: x.hafta, ekip: x.ekip, n: 0, m3: 0, dk: 0 });
    const g = hf.get(k); g.n++; g.m3 += x.m3; g.dk += x.etkinDk;
  });
  const haftaRows = [...hf.values()].sort((a, b) => b.hafta - a.hafta)
    .map(g => ["Hafta " + g.hafta, ekipAd2(g.ekip), g.n, +g.m3.toFixed(2), g.dk]);
  const mk = (head, rows) => {
    const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
    ws["!cols"] = head.map(() => ({ wch: 18 }));
    try {
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (let C = range.s.c; C <= range.e.c; C++) {
        const a = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[a]) ws[a].s = { fill: { pattern: "solid", fgColor: { rgb: "1E293B" } },
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 } };
      }
    } catch (e) {}
    return ws;
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, mk(["Ekip", "Yükleme", "m³", "Etkin dk", "Ort dk/yükleme", "Hedef sapması"], ozetRows), "Ekip Ozeti");
  XLSX.utils.book_append_sheet(wb, mk(["Gün", "Ekip", "Müşteri", "Madde", "AD", "m³", "Etkin dk", "Durum"], gunRows), "Gun Dökum");
  XLSX.utils.book_append_sheet(wb, mk(["Hafta", "Ekip", "Yükleme", "m³", "Etkin dk"], haftaRows), "Haftalik");
  XLSX.utils.book_append_sheet(wb, mk(["Ekip", "m³", "m³ Payı", "Yükleme", "Yükleme Payı", "Ort dk/yükleme"], payRows), "Paylasim");
  XLSX.writeFile(wb, `ekip_performans_${todayISO()}.xlsx`);
  showToast("📤 Ekip raporu indirildi.");
}

async function ekipEkle(ad) {
  const maxN = ekipSira.reduce((m, k) => Math.max(m, parseInt(k.replace(/\D/g, ""), 10) || 0), 0);
  const kod = "ekip-" + (maxN + 1);
  const body = { ad: (ad || "").trim() || kod, aktif: true, ts: Date.now() };
  const res = await authFetch(`${FIREBASE_DB_URL}/${EKIP_NODE}/${kod}.json`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  await check(res, "Ekip eklenemedi");
  ekipler[kod] = body;
  ekipSira.push(kod); ekipSira.sort((a, b) => (parseInt(a.replace(/\D/g,""),10)||0) - (parseInt(b.replace(/\D/g,""),10)||0));
  await apiLog("yetki", "", body.ad, `👷 ekip oluşturuldu: ${kod}`);
  return kod;
}
async function ekipAdKaydet(kod, ad) {
  const v = (ad || "").trim() || kod;
  const res = await authFetch(`${FIREBASE_DB_URL}/${EKIP_NODE}/${kod}.json`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ad: v })
  });
  await check(res, "Ekip adı kaydedilemedi");
  if (ekipler[kod]) ekipler[kod].ad = v;
  await apiLog("yetki", "", v, `👷 ekip adı güncellendi: ${kod} → ${v}`);
}
async function ekipToggle(kod) {
  const cur = ekipler[kod] || {};
  const yeni = !cur.aktif;
  const res = await authFetch(`${FIREBASE_DB_URL}/${EKIP_NODE}/${kod}.json`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aktif: yeni })
  });
  await check(res, "Ekip durumu değiştirilemedi");
  if (ekipler[kod]) ekipler[kod].aktif = yeni;
  await apiLog("yetki", "", ekipAd(kod), `👷 ekip ${yeni ? "aktif" : "pasif"} yapıldı: ${kod}`);
}
function aktifEkipler() { return ekipSira.filter(k => ekipler[k] && ekipler[k].aktif); }

/* ---------- Ekip yönetim modalı ---------- */
async function openEkipPanel() {
  if (!isAdmin()) { alert("Bu panel sadece yöneticiler içindir."); return; }
  await loadEkipler();          /* ✅ taze veri garantisi */
  renderEkipTable();
  document.getElementById("ekipModal").classList.remove("hidden");
}
async function ekipSil(kod) {
  if (!confirm(`"${ekipAd(kod)}" (${kod}) kalıcı olarak silinecek. Onaylıyor musunuz?`)) return;
  try {
    const res = await authFetch(`${FIREBASE_DB_URL}/${EKIP_NODE}/${kod}.json`, { method: "DELETE" });
    await check(res, "Ekip silinemedi");
    delete ekipler[kod];
    ekipSira = ekipSira.filter(k => k !== kod);
    await apiLog("yetki", "", ekipAd(kod), `👷 ekip silindi: ${kod}`);
    renderEkipTable();
    showToast("🗑️ Ekip silindi.");
  } catch (e) { alert("Silinemedi: " + e.message); }
}

function renderEkipTable() {
  const tb = document.getElementById("ekipTable");
  if (!ekipSira.length) {
    tb.innerHTML = `<tr><td colspan="5" class="empty">Henüz ekip yok — yukarıdan ekleyin.</td></tr>`;
    return;
  }
  const kullanim = {};
  rows.forEach(r => { if (r.ekip) kullanim[r.ekip] = (kullanim[r.ekip] || 0) + 1; });
  tb.innerHTML = ekipSira.map(k => {
    const e = ekipler[k];
    const n = kullanim[k] || 0;
    const pasif = e.aktif === false;
    return `<tr data-ekod="${esc(k)}" ${pasif ? 'style="opacity:.55"' : ""}>
      <td class="muted">${esc(k)}</td>
      <td><input class="cell-input" style="width:100%" value="${esc(e.ad || k)}" data-ekipad="${esc(k)}" ${pasif ? "disabled" : ""} /></td>
      <td class="center">${pasif ? '<span class="badge waiting">Pasif</span>' : '<span class="badge done">Aktif</span>'}</td>
      <td class="center">${n ? `<b>${n}</b> kayıt` : '<span class="muted">-</span>'}</td>
      <td class="nowrap">
        ${n === 0 ? `<button class="btn del" data-ekipsil="${esc(k)}" title="Kalıcı olarak sil">🗑️ Sil</button>` : `<span class="muted" style="font-size:10px" title="Ekip kayıtlarda kullanıldığı için silinemez; önce kayıtların ekiplerini boşaltın">kullanımda</span>`}
        <button class="btn primary" data-ekipsave="${esc(k)}">Kaydet</button>
        <button class="btn" data-ekiptoggle="${esc(k)}">${pasif ? "Aktifleştir" : "Pasifleştir"}</button>
      </td>
    </tr>`;
  }).join("");
}
document.getElementById("btnEkipAdd").addEventListener("click", async () => {
  const inp = document.getElementById("ekipNewAd");
  try {
    const kod = await ekipEkle(inp.value);
    inp.value = "";
    renderEkipTable();
    showToast(`✅ ${ekipAd(kod)} eklendi.`);
  } catch (e) { alert("Eklenemedi: " + e.message); }
});
document.getElementById("ekipNewAd").addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("btnEkipAdd").click(); });
document.getElementById("ekipTable").addEventListener("click", async e => {
  const sb = e.target.closest("[data-ekipsave]");
  if (sb) {
    const kod = sb.dataset.ekipsave;
    const inp = document.querySelector(`input[data-ekipad="${kod}"]`);
    if (!inp) return;
    try { await ekipAdKaydet(kod, inp.value); showToast("✅ Ekip adı güncellendi."); renderEkipTable(); }
    catch (err) { alert("Kaydedilemedi: " + err.message); }
    return;
  }
  const sl = e.target.closest("[data-ekipsil]");
  if (sl) { await ekipSil(sl.dataset.ekipsil); return; }
  const tg = e.target.closest("[data-ekiptoggle]");
  if (tg) {
    try { await ekipToggle(tg.dataset.ekiptoggle); renderEkipTable(); }
    catch (err) { alert("İşlem başarısız: " + err.message); }
  }
});
document.getElementById("btnCloseEkip").addEventListener("click", () =>
  document.getElementById("ekipModal").classList.add("hidden"));
document.getElementById("ekipModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});
document.getElementById("btnEkip").addEventListener("click", openEkipPanel);
/* updateUserUI görünürlüğü — ekleyeceğiz (PART 2) */

async function loadEkipler() {
  try {
    /* .read herkese açık — misafirler de ekip rozetlerini görür */
    const res = await fetch(`${FIREBASE_DB_URL}/${EKIP_NODE}.json`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    ekipler = data || {};
    ekipSira = Object.keys(ekipler).sort((a, b) =>
      (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0));
  } catch (e) { console.warn("Ekipler yüklenemedi:", e.message); ekipler = {}; ekipSira = []; }
}
/* ---------- 📦 Toplama Bitti (QR + Operasyon) ---------- */
/* Fiziksel toplama bitti ama statü bekliyor olabilir (üretim eksiği) —
   etkin süre bu anla durur, kronometre/statü bozulmaz. */
async function toplamaBittiAction(idOverride = null) {
  const targetId = idOverride || islemId;
  if (!currentUser) { showLogin("İşlem için giriş yapın."); return; }
  if (!hasPerm("edit")) { alert("Bu işlem için düzenleme yetkiniz yok."); return; }
  const row = await freshRow(targetId);
  if (!row) { alert("Kayıt bulunamadı."); return; }
  if (!row.loadingStartedAt) { alert("Kronometre henüz başlamamış — önce yüklemeyi başlatın."); return; }
  if (row.toplamaBittiTs) { showToast("ℹ️ Toplama bitti zaten işaretli (" + fmtTime(row.toplamaBittiTs) + ")."); return; }
  const ekipNotu = row.ekip ? "" : "\n\n⚠️ Bu kayda henüz ekip atanmamış — performans raporunda 'Atanmamış' görünür.";
  if (!confirm(`"${row.musteri}" için fiziksel toplama bitti olarak işaretlenecek.${ekipNotu}\n\nDevam?`)) return;
  try {
    const saved = await apiUpdate(row.id, { ...row, toplamaBittiTs: Date.now() });
    rows = rows.map(r => r.id === row.id ? saved : r);
    setSaveError("");
    render();
    const isOv = document.getElementById("islemOverlay");
    if (isOv && !isOv.classList.contains("hidden")) renderIslem();
    if (document.getElementById("opOverlay")) renderOpCard();
    await apiLog("guncelleme", row.id, row.musteri,
      `📦 toplama bitti: ${fmtTime(saved.toplamaBittiTs)} · etkin süre: ${fmtSure(etkinSureMs(saved))}` +
      (row.ekip ? ` · ${ekipAd(row.ekip)}` : ""));
    showToast(`✅ Toplama bitti — etkin süre ${fmtSure(etkinSureMs(saved))}`);
  } catch (e) { alert("Kaydedilemedi: " + e.message); }
}

/* ---------- Depo / işlem ekranlarına entegrasyon ---------- */
/* depoItem kartına ekip rozeti + toplama bitti rozeti ekler (PART 2'de html'e ekleyeceğiz) */
function depoEkipSatiri(r) {
  const chip = ekipChipHtml(r.ekip);
  return ekipChipHtml(r.ekip) ? `<div class="d-sub">${ekipChipHtml(r.ekip)}</div>` : "";
  return (chip || bitti) ? `<div class="d-sub">${chip}${bitti}</div>` : "";
}

/* ═══════════════ TODB GÜNCELLEME (alan taşınması) ═══════════════ */
/* mevcut toDb fonksiyonu içindeki "comments:" satırının ÜSTÜNE şu iki satırı ekleyin:
    ekip: (r.ekip || "").trim() || "",
    toplamaBittiTs: (r.toplamaBittiTs == null) ? null : Number(r.toplamaBittiTs),
*/

/* ═══════════════ 🎮 GAME MENÜSÜ ═══════════════ */
const gameMenuEl = document.getElementById("gameMenu");
document.getElementById("btnGameMenu").addEventListener("click", e => {
  e.stopPropagation();
  gameMenuEl.classList.toggle("hidden");
});
document.addEventListener("click", e => {
  if (!e.target.closest(".game-wrap")) gameMenuEl.classList.add("hidden");
});
gameMenuEl.addEventListener("click", e => {
  const b = e.target.closest("[data-game]");
  if (!b) return;
  gameMenuEl.classList.add("hidden");
  const g = b.dataset.game;
  if (g === "quiz") openQuiz();
  else if (g === "snake") openSnakeGame();
  else if (g === "sudoku") openSudoku();
  else if (g === "tetris") openTetris();
});

// Araçlar menüsü aç/kapat
const btnToolsMenu = document.getElementById("btnToolsMenu");
const toolsMenu = document.getElementById("toolsMenu");

if (btnToolsMenu && toolsMenu) {
  btnToolsMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    toolsMenu.classList.toggle("hidden");
    if (document.getElementById("gameMenu")) {
      document.getElementById("gameMenu").classList.add("hidden");
    }
  });

  document.addEventListener("click", () => {
    toolsMenu.classList.add("hidden");
  });
}

