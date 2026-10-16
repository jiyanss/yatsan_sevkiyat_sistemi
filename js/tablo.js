/* ============================================================
   ⏱️ SÜRE PERFORMANS SEKMESİ
   ============================================================ */
function buildSure(list) {
  const az = sureAnalizi(list);
  const c = document.getElementById("reportPaneSure");
  if (!az) {
    c.innerHTML = `<p class="hint">⏱️ Süre performansı için henüz kronometre verisi yok — bir kaydı "Yükleniyor" yapıp sonra "Tamamlandı" yapınca burada analiz başlar.</p>`;
    return;
  }
  const asimOran = az.asimli / az.n * 100;
  const kpiBlock = `<div class="kpi-grid">
    <div class="kpi c-primary"><div class="kpi-head">🧮 Analiz edilen yükleme</div><div class="kpi-val">${fmtN(az.n)}</div><div class="kpi-sub">kronometre verisi olan tamamlanmış kayıt</div></div>
    <div class="kpi c-green"><div class="kpi-head">⏱️ Ortalama yüklenme süresi</div><div class="kpi-val">${fmtN(az.ortGecen)} dk</div><div class="kpi-sub">tüm kombinasyonların ortalaması</div></div>
    <div class="kpi c-red"><div class="kpi-head">⚠️ Standart süreyi aşan</div><div class="kpi-val">%${asimOran.toFixed(0)}</div><div class="kpi-sub">${az.asimli} / ${az.n} yükleme</div></div>
    <div class="kpi c-amber"><div class="kpi-head">🔻 En kötü aşım</div><div class="kpi-val">${fmtN(Math.max(az.enKotu, 0))} dk</div><div class="kpi-sub">standart sürenin üzerine çıkan en yüksek fark</div></div>
  </div>`;
  const chartBlock = (typeof Chart === "undefined")
    ? ``
    : `<div class="chart-box wide" style="margin-bottom:16px"><h3>⏱️ Ortalama yüklenme süresi vs standart (en yavaş 15 kombinasyon)</h3><div class="chart-holder tall"><canvas id="chSure"></canvas></div></div>`;
  c.innerHTML = kpiBlock + chartBlock + sureTable(az);
  if (typeof Chart === "undefined") return;
  const { textColor, gridColor } = chartBase();
  const arr = [...az.musteri.entries()]
    .map(([k, g]) => ({ k, ort: g.toplam / g.n, std: g.stTop / g.n, n: g.n, asim: g.asim }))
    .sort((a, b) => b.ort - a.ort)
    .slice(0, 15);
  chartInstances.push(new Chart(document.getElementById("chSure").getContext("2d"), {
    type: "bar",
    data: {
      labels: arr.map(x => x.k),
      datasets: [
        {
          label: "Ortalama süre (dk)",
          data: arr.map(x => Math.round(x.ort)),
          backgroundColor: arr.map(x => x.ort > x.std ? "#dc2626cc" : "#059669cc"),
          borderRadius: 5, maxBarThickness: 22
        },
        {
          type: "line", label: "Standart süre",
          data: arr.map(x => Math.round(x.std)),
          borderColor: "#4f46e5", borderWidth: 2, borderDash: [6, 4],
          pointRadius: 3, pointBackgroundColor: "#4f46e5", fill: false
        }
      ]
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: textColor, usePointStyle: true, padding: 12, font: { size: 11 } } },
        datalabels: {
          anchor: "end", align: "end", clamp: true,
          color: textColor, font: { weight: "700", size: 10 },
          display: ctx => ctx.dataset.type !== "line",
          formatter: v => fmtN(v) + " dk"
        },
        tooltip: { callbacks: { label: ctx => {
          const d = arr[ctx.dataIndex];
          return ctx.dataset.type === "line"
            ? ` Standart: ${fmtN(d.std)} dk`
            : ` Ortalama: ${fmtN(d.ort)} dk · ${d.n} yükleme · aşım %${(d.asim / d.n * 100).toFixed(0)}`;
        } } }
      },
      scales: {
        x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, precision: 0, maxTicksLimit: 6 } },
        y: { grid: { display: false }, ticks: { color: textColor, font: { size: 10.5, weight: "600" } } }
      }
    }
  }));
}

function buildDetay(list) {
  document.getElementById("reportPaneDetay").innerHTML =
    statsTable(groupStats(list, r => r.musteri), "Müşteri bazlı", "Müşteri") +
    statsTable(groupStats(list, r => r.sevkiyatTipi), "Sevkiyat tipi bazlı", "Tip") +
    statsTable(groupStats(list, r => r.blm), "BLM bazlı", "BLM") +
    statsTable(groupStats(list, r => "Hafta " + r.hafta), "Hafta bazlı", "Hafta") +
    statsTable(groupStats(list, r => r.durum), "Durum bazlı", "Durum");
}

/* ═══════════════ 📊 Rapor içi bağımsız filtre havuzu ═══════════════ */
let rptArsivPool = null;   /* oturum başına bir kez çekilir */
async function raporHavuz() {
  let list = enriched(rows);
  /* 🗄️ Arşiv dahil — checkbox işaretliyse arşiv havuzunu birleştir */
  const arsivOn = document.getElementById("rptArsiv") ? document.getElementById("rptArsiv").checked : false;
  if (arsivOn) {
    if (!Array.isArray(rptArsivPool)) {
      try { rptArsivPool = (await fetchArsiv()).map(r => ({ ...r, _arsiv: true })); }
      catch (e) { rptArsivPool = []; showToast("⚠️ Arşiv yüklenemedi: " + e.message); }
    }
    const ids = new Set(list.map(r => r.id));
    list = list.concat(rptArsivPool.filter(r => !ids.has(r.id)));
  }
  /* 👤 Müşteri filtresi */
  const musEl = document.getElementById("rptMusteri");
  const mus = musEl ? musEl.value.trim().toLowerCase() : "";
  if (mus) list = list.filter(r => (r.musteri || "").toLowerCase().includes(mus));
  /* 📅 Tarih filtresi — planlanan üzerinden */
  const tEl = document.getElementById("rptTarih");
  const mod = tEl ? tEl.value : "all";
  if (mod !== "all") {
    let from = "";
    if (mod === "week") {
      const d = new Date();
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      from = isoFromDate(d);
    } else if (mod === "month") from = isoFromDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    else if (mod === "lastmonth") from = monthBounds(-1).from;
    else if (mod === "d30") { const d = new Date(); d.setDate(d.getDate() - 29); from = isoFromDate(d); }
    else if (mod === "d90") { const d = new Date(); d.setDate(d.getDate() - 89); from = isoFromDate(d); }
    else if (mod === "year") from = new Date().getFullYear() + "-01-01";
    const to = (mod === "lastmonth") ? monthBounds(-1).to : "9999-12-31";
    list = list.filter(r => (r.planlananTarih || "") >= from && (r.planlananTarih || "") <= to);
  }
  return list;
}
let _rptBusy = false;
async function buildReports() {
  if (_rptBusy) { console.info("📊 Rapor zaten çiziliyor — istek atlandı"); return; }
  _rptBusy = true;
  try {
    destroyCharts();
    const list = await raporHavuz();
    const sel = document.getElementById("rptMusteri");
    const onceki = sel.value;
    const musler = [...new Set(list.map(r => r.musteri).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
    sel.innerHTML = `<option value="">Tüm müşteriler</option>` +
      musler.map(m => `<option value="${esc(m)}" ${m === onceki ? "selected" : ""}>${esc(m)}</option>`).join("");
    const emptyMsg = `<p class="hint">Seçilen filtre/değer aralığında kayıt yok — filtreleri gevşetin.</p>`;
    ["reportPaneGenel","reportPaneAnaliz","reportPaneDetay"].forEach(id => {
      document.getElementById(id).innerHTML = list.length ? "" : emptyMsg;
    });
    ["reportPaneKapasite","reportPaneSure","reportPaneArsiv","reportPaneEkip"].forEach(id => {
      document.getElementById(id).innerHTML = "";
    });
    if (!list.length) return;
    buildGenel(list);
    buildAnaliz(list);
    buildDetay(list);
    switchReportTab(activeReportTab);
  } catch (e) {
    console.error("Rapor çizim hatası:", e);
    showToast("⚠️ Rapor hatası: " + e.message);
  } finally {
    _rptBusy = false;
  }
}
async function switchReportTab(tab) {
  activeReportTab = tab;
  document.querySelectorAll(".rtab").forEach(b => b.classList.toggle("active", b.dataset.rtab === tab));
  document.getElementById("reportPaneGenel").classList.toggle("hidden", tab !== "genel");
  document.getElementById("reportPaneAnaliz").classList.toggle("hidden", tab !== "analiz");
  document.getElementById("reportPaneKapasite").classList.toggle("hidden", tab !== "kapasite");
  document.getElementById("reportPaneSure").classList.toggle("hidden", tab !== "sure");
  document.getElementById("reportPaneDetay").classList.toggle("hidden", tab !== "detay");
  document.getElementById("reportPaneArsiv").classList.toggle("hidden", tab !== "arsiv");
  document.getElementById("reportPaneEkip").classList.toggle("hidden", tab !== "ekip");
  destroyCharts();
  if (tab === "kapasite") { buildKapasite(await raporHavuz()); return; }
  if (tab === "ekip") { buildEkip(await raporHavuz()); return; }
  if (tab === "sure") { buildSure(await raporHavuz()); return; }
  if (tab === "arsiv") { buildArsiv(); return; }
  const list = await raporHavuz();
  if (!list.length) {
    ["reportPaneGenel","reportPaneAnaliz","reportPaneDetay"].forEach(id =>
      document.getElementById(id).innerHTML = `<p class="hint">Seçilen filtrelerde kayıt yok.</p>`);
    return;
  }
  if (tab === "genel") buildGenel(list);
  else if (tab === "analiz") buildAnaliz(list);
  else if (tab === "detay") buildDetay(list);
}   /* ⬅ fonksiyon BURADA kapanıyor */
  document.querySelectorAll(".rtab").forEach(b => {
  b.addEventListener("click", () => switchReportTab(b.dataset.rtab));
});
document.getElementById("btnReports").addEventListener("click", () => {
  document.getElementById("reportModal").classList.remove("hidden");
  buildReports();
});
document.getElementById("btnCloseReport").addEventListener("click", () => {
  destroyCharts();
  document.getElementById("reportModal").classList.add("hidden");
});
document.getElementById("reportModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) { destroyCharts(); e.currentTarget.classList.add("hidden"); }
});

/* 📊 Rapor içi filtre değişimi → raporu yeniden çiz */
["rptTarih", "rptMusteri"].forEach(id =>
  document.getElementById(id).addEventListener("change", buildReports));
document.getElementById("rptArsiv").addEventListener("change", async e => {
  const cb = e.target;
  cb.disabled = true;
  try {
    if (cb.checked && !Array.isArray(rptArsivPool)) {
      rptArsivPool = (await fetchArsiv()).map(r => ({ ...r, _arsiv: true }));
    }
    await buildReports();
  } catch (err) {
    showToast("⚠️ Rapor yenilenemedi: " + err.message);
  }
  cb.disabled = false;
});

/* ================= GEÇMİŞ ================= */
async function showHistory() {
  const c = document.getElementById("historyContent");
  c.innerHTML = `<p class="hint">Yükleniyor…</p>`;
  document.getElementById("historyModal").classList.remove("hidden");
  try {
    const hist = await apiListHistory(150);
    if (!hist.length) {
      c.innerHTML = `<p class="hint">Henüz geçmiş kaydı yok.</p>`;
      return;
    }
    c.innerHTML = `<div class="timeline">` + hist.map(h => {
      const meta = ACTION_META[h.action] || { label: h.action, dot: "edit" };
      const musteriHtml = h.musteri ? `<span class="musteri-tag">${esc(h.musteri)}</span> — ` : "";
      return `<div class="tl-item">
        <div class="tl-dot ${meta.dot}"></div>
        <div class="tl-head"><b>${esc(shortUser(h.user))}</b> · ${fmtDateTime(h.ts)} · ${esc(meta.label)}</div>
        <div class="tl-text">${musteriHtml}${esc(h.detay || "")}</div>
      </div>`;
    }).join("") + `</div>`;
  } catch (e) {
    c.innerHTML = `<div class="error">Geçmiş yüklenemedi: ${esc(e.message)}<br>⚠️ Rules'ta <b>sevkiyat_history</b> için <b>.read: true</b> olmalı.</div>`;
  }
}
document.getElementById("btnCloseHistory").addEventListener("click", () => {
  document.getElementById("historyModal").classList.add("hidden");
});
document.getElementById("historyModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});

/* ================= EXCEL DIŞA AKTARMA ================= */
function exportExcel() {
  if (typeof XLSX === "undefined") { alert("Excel kütüphanesi (CDN) yüklenemedi."); return; }
  const list = filtered();
  if (!list.length) { alert("Aktarılacak kayıt yok."); return; }
  const today = todayISO();

  /* --- stil yardımcıları --- */
  const B = { style: "thin", color: { rgb: "CBD5E1" } };
  const BORDER = { top: B, left: B, bottom: B, right: B };
  const FONT = { name: "Calibri", sz: 10, color: { rgb: "0F172A" } };
  const base = () => ({ font: FONT, border: BORDER, alignment: { vertical: "center" } });
  const FILL = rgb => ({ pattern: "solid", fgColor: { rgb } });
  const HEAD_FILL = FILL("1E293B");
  const HEAD_FONT = { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } };
  const fills = {
    priority: FILL("FEF3C7"),  /* öncelikli sarı */
    overtime: FILL("FEE2E2"),  /* süre aşımı kırmızı */
    today:    FILL("D1FAE5"),  /* bugün yeşili */
    arsiv:    FILL("F1F5F9")   /* arşiv soluk */
  };
  const durumStil = {
    "Yükleme Tamamlandı": { fill: FILL("A7F3D0"), fontColor: "065F46" },
    "Yükleniyor":         { fill: FILL("FDE68A"), fontColor: "92400E" },
    "Yükleme Bekliyor":   { fill: FILL("FECACA"), fontColor: "991B1B" }
  };

  /* --- veri --- */
  const HEAD = ["Müşteri","BLM","Kategori","Sevkiyat Tipi","AD","Planlanan","Reel Plan","Hafta","Ay",
    "Gerçekleşen","Durum","Gecikme (gün)","Gecikme Nedeni","Yükleme Süresi","Süre Aşımı (dk)",
    "Ekip","Yorum (adet)","Açıklama","Aracı Geldi","PRS M3","M3","Ekleyen","Kayıt Türü"];
  const grid = [HEAD];
  const rowMeta = [];
  list.forEach(r => {
    const b = sureBilgi(r);
    const gb = gecikmeBilgi(r);
    const isToday = gecikmeTarihi(r) === today;
    const isOvertime = r.durum === "Yükleniyor" && b.asim;
    const kind = r._arsiv ? "arsiv" : isOvertime ? "overtime" : isToday ? "today" : null;
    rowMeta.push({ kind, durum: r.durum, gecikmeGun: gb.gun, arsiv: !!r._arsiv });
    grid.push([
      r.musteri, r.blm, r.kategori, r.sevkiyatTipi,
      Number(r.ad) || 0,
      r.planlananTarih ? formatDate(r.planlananTarih) : "",
      r.reelPlan ? formatDate(r.reelPlan) : "",
      r.hafta ?? "-", r.ay ?? "-",
      r.gerceklesenTarih ? formatDate(r.gerceklesenTarih) : "",
      r.durum,
      gb.gun > 0 ? gb.gun : "",
      gb.gun > 0 ? (gb.neden || "") : "",
      b.durum !== "none" ? fmtSure(b.gecenMs) : "",
      (b.durum !== "none" && b.asim) ? b.asimDk : "",
      r.ekip ? ekipAd(r.ekip) : "",
      Array.isArray(r.comments) ? r.comments.length : 0,
      r.aciklama || "",
      r.araciGeldi || "",
      r.prsM3 ?? "",
      r.m3 ?? "",
      r.createdBy || "",
      r._arsiv ? "Arşiv" : "Aktif"
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(grid);
  ws["!cols"] = [{wch:24},{wch:10},{wch:10},{wch:14},{wch:6},{wch:12},{wch:12},{wch:7},{wch:10},
    {wch:12},{wch:22},{wch:12},{wch:16},{wch:14},{wch:12},{wch:9},{wch:11},{wch:30},{wch:11},
    {wch:8},{wch:8},{wch:10},{wch:18},{wch:9}];
  const range = XLSX.utils.decode_range(ws["!ref"]);
  try {
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: range.e.c } }) };
  } catch (e) {}

  /* --- stilleri uygula --- */
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const st = ws[addr];
      if (!st) continue;
      st.s = base();
      if (R === 0) {
        st.s.fill = HEAD_FILL;
        st.s.font = HEAD_FONT;
        st.s.alignment = { vertical: "center", horizontal: "center" };
        continue;
      }
      const meta = rowMeta[R - 1];
      if (meta.kind) st.s.fill = fills[meta.kind];
      if (meta.arsiv) st.s.font = { ...FONT, color: { rgb: "94A3B8" } };
      if (C === 10 && durumStil[meta.durum]) {           /* Durum kolonu rozet renkli */
        st.s.fill = durumStil[meta.durum].fill;
        st.s.font = { ...FONT, bold: true, color: { rgb: durumStil[meta.durum].fontColor } };
        st.s.alignment = { vertical: "center", horizontal: "center" };
      }
      if (C === 11 && meta.gecikmeGun > 0) {             /* Gecikme kolonu kırmızı */
        st.s.font = { ...FONT, bold: true, color: { rgb: "DC2626" } };
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sevkiyat");
  XLSX.writeFile(wb, `sevkiyat_${today}.xlsx`);
}
/* ================= EXCEL İÇE AKTARMA ================= */
const APP_FIELDS = [
  { key: "musteri",         label: "Müşteri *",        kw: ["musteri", "firma", "customer"] },
  { key: "blm",             label: "BLM",              kw: ["blm"] },
  { key: "kategori",        label: "Kategori",         kw: ["kategori"] },
  { key: "sevkiyatTipi",    label: "Sevkiyat Tipi",    kw: ["sevkiyat tipi", "sevkiyattipi", "tip"] },
  { key: "ad",              label: "AD (Adet)",        kw: ["adet"] },
  { key: "planlananTarih",  label: "Planlanan Tarih",  kw: ["planlanan"] },
  { key: "reelPlan",        label: "Reel Plan",        kw: ["reel"] },
  { key: "gerceklesenTarih",label: "Gerçekleşen Tarih",kw: ["gerceklesen"] },
  { key: "durum",           label: "Durum",            kw: ["durum", "status"] },
  { key: "aciklama",        label: "Açıklama",         kw: ["aciklama", "not"] },
  { key: "araciGeldi",      label: "Aracı Geldi",      kw: ["araci"] },
  { key: "prsM3",           label: "PRS M3",           kw: ["prs"] },
  { key: "m3",              label: "M3",               kw: ["m3"] },
  { key: "oncelikli",       label: "Öncelikli",        kw: ["oncelik"] },
];
let importRows = [];
let importHeaders = [];
let fieldMap = {};

function normTxt(s) {
  return String(s ?? "").toLowerCase()
    .replace(/ı/g, "i").replace(/İ/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/³/g, "3")
    .replace(/\s+/g, " ").trim();
}
function autoMap() {
  fieldMap = {};
  const used = new Set();
  const heads = importHeaders.map(h => ({ raw: h, n: normTxt(h) }));
  APP_FIELDS.forEach(f => {
    let hit = heads.find(h => !used.has(h.raw) &&
      f.kw.some(k => h.n === k || (k.length > 2 && h.n.includes(k))));
    if (f.key === "ad") hit = hit || heads.find(h => !used.has(h.raw) && h.n === "ad");
    fieldMap[f.key] = hit ? hit.raw : "";
    if (hit) used.add(hit.raw);
  });
}
function parseExcelDate(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date && !isNaN(v)) return `${v.getUTCFullYear()}-${pad2(v.getUTCMonth()+1)}-${pad2(v.getUTCDate())}`;
  if (typeof v === "number" && isFinite(v)) {
    const dc = (window.XLSX && XLSX.SSF) ? XLSX.SSF.parse_date_code(v) : null;
    return dc ? `${dc.y}-${pad2(dc.m)}-${pad2(dc.d)}` : "";
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})$/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  return "";
}
function normalizeTip(v) {
  let t = String(v ?? "").trim().toUpperCase().replace(/İ/g, "I").replace(/\s+/g, " ");
  if (!t) return "";
  if (TIPLER.includes(t)) return t;
  const c = t.replace(/\s+/g, "");
  if (c === "KOMPLETIR") return "KOMPLE TIR";
  if (c === "PARSIYELTIR") return "PARSIYEL TIR";
  if (c === "40HC") return "40 HC";
  if (c === "20DC" || c === "20HC") return "20 DC";
  return t;
}
function mapRowToRec(row) {
  const rec = emptyRecord();
  const g = k => { const h = fieldMap[k]; return h ? row[h] : ""; };
  rec.musteri = String(g("musteri") ?? "").trim();
  rec.blm = normalizeBlm(g("blm")) || "EXPORT-1";
  rec.kategori = String(g("kategori") || "PLANLI").trim() || "PLANLI";
  const tip = normalizeTip(g("sevkiyatTipi"));
  if (tip) rec.sevkiyatTipi = tip;
  rec.ad = Number(g("ad")) || 1;
  rec.planlananTarih = parseExcelDate(g("planlananTarih"));
  rec.reelPlan = parseExcelDate(g("reelPlan")) || rec.planlananTarih;
  rec.gerceklesenTarih = parseExcelDate(g("gerceklesenTarih"));
  const dv = String(g("durum")).trim();
  if (dv) {
    const found = DURUMLAR.find(x => normTxt(x) === normTxt(dv));
    rec.durum = found || dv;
  }
  rec.aciklama = String(g("aciklama") || "");
  const ag = String(g("araciGeldi")).trim();
  const agN = normTxt(ag);
  if (agN.includes("gel")) rec.araciGeldi = "GELDİ";
  else if (agN.includes("hay") || agN.includes("yok")) rec.araciGeldi = "HAYIR";
  else rec.araciGeldi = ag.toUpperCase();
  rec.prsM3 = g("prsM3") === "" ? "" : (Number(g("prsM3")) || 0);
  const m3raw = g("m3");
  rec.m3 = (m3raw === "" || m3raw == null)
    ? (hesaplaM3(rec.sevkiyatTipi, rec.ad, rec.prsM3) ?? "")
    : (Number(m3raw) || 0);
  const on = g("oncelikli");
  rec.oncelikli = on === true || /^(1|true|evet|x|var|yes)/i.test(String(on).trim());
  return rec;
}
function buildMapping() {
  const grid = document.getElementById("mapGrid");
  grid.innerHTML = APP_FIELDS.map(f => `
    <label><span>${esc(f.label)}</span>
      <select data-map="${f.key}">
        <option value="">(boş)</option>
        ${importHeaders.map(h => `<option value="${esc(h)}" ${fieldMap[f.key] === h ? "selected" : ""}>${esc(h)}</option>`).join("")}
      </select>
    </label>`).join("");
  document.getElementById("importMapping").classList.remove("hidden");
  renderPreview();
}
function renderPreview() {
  const t = document.getElementById("previewTable");
  const recs = importRows.slice(0, 5).map(mapRowToRec);
  t.innerHTML = `<thead><tr class="prev-head"><th>Müşteri</th><th>Tip</th><th>AD</th><th>Planlanan</th><th>Durum</th><th>PRS M3</th><th>M3</th></tr></thead><tbody>` +
    (recs.length
      ? recs.map(r => `<tr><td>${esc(r.musteri)}</td><td>${esc(r.sevkiyatTipi)}</td><td class="center">${esc(r.ad)}</td><td class="center">${formatDate(r.planlananTarih)}</td><td>${esc(r.durum)}</td><td class="center">${esc(r.prsM3 === "" ? "-" : r.prsM3)}</td><td class="center">${esc(r.m3)}</td></tr>`).join("")
      : `<tr><td colspan="7" class="empty">Satır yok</td></tr>`) +
    `</tbody>`;
}
document.getElementById("mapGrid").addEventListener("change", e => {
  const sel = e.target.closest("select[data-map]");
  if (!sel) return;
  fieldMap[sel.dataset.map] = sel.value;
  renderPreview();
});
document.getElementById("importFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    importRows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
    importHeaders = Object.keys(importRows[0] || {});
    if (!importRows.length) { alert("Dosyada veri satırı bulunamadı."); return; }
    autoMap();
    buildMapping();
  } catch (err) {
    alert("Dosya okunamadı: " + err.message);
  }
});
async function doImport() {
  const recs = [];
  let skipped = 0;
  importRows.forEach(row => {
    const rec = mapRowToRec(row);
    if (rec.musteri) recs.push(rec); else skipped++;
  });
  if (!recs.length) { alert("Yüklenecek geçerli satır yok (Müşteri kolonu zorunlu)."); return; }
  if (!confirm(`${recs.length} kayıt veritabanına eklenecek. Onaylıyor musun?`)) return;
  const btn = document.getElementById("btnDoImport");
  btn.disabled = true; btn.textContent = "Yükleniyor…";
  try {
    await apiBulkInsert(recs);
    const res = document.getElementById("importResult");
    res.textContent = `✅ ${recs.length} kayıt yüklendi` + (skipped ? `, ${skipped} satır atlandı (Müşteri boş).` : ".");
    res.classList.remove("hidden");
    await load(false);
    await apiLog("excel", "", "", `${recs.length} kayıt toplu yüklendi${skipped ? ` · ${skipped} satır atlandı` : ""}`);
  } catch (e) {
    setSaveError(e.message);
    alert("Yükleme hatası: " + e.message);
  }
  btn.disabled = false; btn.textContent = "Seçili satırları yükle";
}
document.getElementById("btnDoImport").addEventListener("click", () => {
  if (!hasPerm("imp")) { alert("Excel yükleme için yetkiniz yok."); return; }
  doImport();
});
function openImport() {
  if (typeof XLSX === "undefined") { alert("Excel kütüphanesi (CDN) yüklenemedi — internet bağlantısını kontrol et."); return; }
  document.getElementById("importModal").classList.remove("hidden");
}
function closeImportModal() {
  document.getElementById("importModal").classList.add("hidden");
  document.getElementById("importMapping").classList.add("hidden");
  document.getElementById("importResult").classList.add("hidden");
  document.getElementById("importFile").value = "";
  importRows = []; importHeaders = []; fieldMap = {};
}
document.getElementById("btnCancelImport").addEventListener("click", closeImportModal);
document.getElementById("importModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeImportModal();
});

/* ================= LOGIN & OTURUM ================= */
function showLogin(hintMsg) {
  const err = document.getElementById("loginError");
  if (hintMsg) { err.textContent = hintMsg; err.classList.remove("hidden"); }
  else err.classList.add("hidden");
  document.getElementById("loginModal").classList.remove("hidden");
  document.getElementById("l-user").focus();
}
function hideLogin() {
  document.getElementById("loginModal").classList.add("hidden");
  document.getElementById("l-pass").value = "";
}
function updateUserUI() {
  const box = document.getElementById("userBox");
  document.body.classList.toggle("can-edit", !!currentUser);
  document.getElementById("btnAdminPanel").classList.toggle("hidden", !isAdmin());
  document.getElementById("btnSurePanel").classList.toggle("hidden", !isAdmin());
  document.getElementById("btnBackup").classList.toggle("hidden", !isAdmin());
  document.getElementById("btnArsiv").classList.toggle("hidden", !isAdmin());
  document.getElementById("btnEkip").classList.toggle("hidden", !isAdmin());
  document.getElementById("btnOrderHazir").classList.toggle("hidden", !isAdmin());
  if (currentUser) {
    const admin = isAdmin();
    box.innerHTML = `<span class="user-chip ${admin ? "is-admin" : ""}">${admin ? "🛡️" : "👤"} ${esc(shortUser(currentUser.email))}</span>
      <button class="btn" id="btnLogout">Çıkış</button>`;
    document.getElementById("btnLogout").addEventListener("click", () => doLogout(""));
    setGuestInfo("");
     } else {
    box.innerHTML = `<span class="guest-chip">👁️ Görüntüleme modu</span>
      <button class="btn primary" id="btnLoginOpen">🔐 Giriş yap</button>`;
    document.getElementById("btnLoginOpen").addEventListener("click", () => showLogin(""));
  }
}
async function tryLogin() {
  const err = document.getElementById("loginError");
  const email = document.getElementById("l-user").value.trim();
  const pass = document.getElementById("l-pass").value;
  if (!email || !pass) { err.textContent = "E-posta ve şifre girin."; err.classList.remove("hidden"); return; }
  const btn = document.getElementById("btnLogin");
  btn.disabled = true; btn.textContent = "Giriş yapılıyor…";
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass, returnSecureToken: true })
    });
    const j = await res.json();
    if (!res.ok) { err.textContent = fbErrText(j.error?.message || ""); err.classList.remove("hidden"); return; }
    saveAuthState(j.idToken, j.refreshToken, j.expiresIn, j.email);
    currentUser = { email: j.email };
    await loadUserEntries();
    updateUserUI();
    hideLogin();
    if (!userEntries[j.email] && !ADMIN_EMAILS.includes(j.email.toLowerCase())) {
      setGuestInfo("ℹ️ Hesabın için henüz özel yetki atanmamış — <b>varsayılan yetkiler</b> uygulandı (ekleme/düzenleme/çoğaltma açık · silme/Excel kapalı). Yöneticin Admin Panel'den yetki verebilir.");
    }
    if (pendingAction) { const pa = pendingAction; pendingAction = null; runAction(pa); }
    else render();
    if (islemId != null) renderIslem();
    if (document.getElementById("opOverlay")) renderOpCard();
    otomatikGunlukYedek(); /* günün ilk girişinde yedek alınmamışsa arka planda al */
  } catch (e) {
    err.textContent = "Bağlantı hatası: " + e.message;
    err.classList.remove("hidden");
  } finally {
    btn.disabled = false; btn.textContent = "Giriş yap";
  }
}
function doLogout(msg) {
  clearAuthState();
  addingInline = false; inlineData = null;
  editingCell = null;
  closeCellEditor();
  render();
  if (msg) setGuestInfo("ℹ️ " + esc(msg) + " — verileri görüntülemeye devam edebilirsin.");
}
document.getElementById("btnLogin").addEventListener("click", tryLogin);
document.getElementById("btnLoginCancel").addEventListener("click", () => {
  hideLogin();
  pendingAction = null;
});
document.getElementById("loginModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) { hideLogin(); pendingAction = null; }
});
["l-user", "l-pass"].forEach(id => {
  document.getElementById(id).addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });
});

let lastActivity = Date.now();
["click", "keydown", "touchstart", "mousemove"].forEach(ev =>
  document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true })
);
setInterval(() => {
  if (!currentUser) return;
  if (Date.now() - lastActivity > IDLE_MS) doLogout(`${IDLE_MS / 60000} dakika işlem olmadığı için oturum kapatıldı.`);
}, 10000);

setInterval(() => {
  if (document.hidden || addingInline || editingCell) return;
  if (!document.getElementById("importModal").classList.contains("hidden")) return;
  if (Date.now() - lastLocalOp < 5000) return;
  load(false, true);
}, 30000);

/* ⏱️ Kronometre tick */
setInterval(() => {
  if (document.hidden || addingInline || editingCell) return;
  if (rows.some(r => r.durum === "Yükleniyor" && r.loadingStartedAt)) updateSureCells();
}, 15000);

/* ================= PWA ================= */
(function setupManifest() {
  const iconSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#7c3aed"/>
      </linearGradient></defs>
      <rect width="512" height="512" rx="96" fill="url(#g)"/>
      <text x="256" y="340" font-size="260" text-anchor="middle">🚢</text>
    </svg>`);
  const manifest = {
    name: "Sevkiyat Planlama — İhracat",
    short_name: "Sevkiyat",
    start_url: window.location.href.split("#")[0],
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#4f46e5",
    icons: [{ src: "data:image/svg+xml," + iconSvg, sizes: "any", type: "image/svg+xml", purpose: "any maskable" }]
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = URL.createObjectURL(blob);
  document.head.appendChild(link);
})();
let deferredPwaPrompt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPwaPrompt = e;
  document.getElementById("btnPwaInstall").classList.remove("hidden");
});
document.getElementById("btnPwaInstall").addEventListener("click", async () => {
  if (!deferredPwaPrompt) return;
  deferredPwaPrompt.prompt();
  try {
    const res = await deferredPwaPrompt.userChoice;
    if (res && res.outcome === "accepted") {
      document.getElementById("btnPwaInstall").classList.add("hidden");
      showToast("📲 Uygulama ana ekranına yüklendi!");
    }
  } catch (e) {}
  deferredPwaPrompt = null;
});
window.addEventListener("appinstalled", () => {
  document.getElementById("btnPwaInstall").classList.add("hidden");
  showToast("📲 Uygulama yüklendi.");
});
function updateOfflineBadge() {
  document.getElementById("offlineBadge").classList.toggle("hidden", navigator.onLine);
}
window.addEventListener("offline", updateOfflineBadge);
window.addEventListener("online", () => { updateOfflineBadge(); load(false, false); });
updateOfflineBadge();


document.addEventListener("click", e => {
  if (!e.target.closest("#menuDrop") && !e.target.closest("#btnMenu"));
});
function applyMenuLayout() {
  const drop = document.getElementById("menuDrop");
  if (!drop) return;
  const editing = document.body.classList.contains("menu-editing");
  document.querySelectorAll("header .btn[data-menu]").forEach(b => {
    if (PERM_BTN_IDS.includes(b.id)) return;
    const inMenu = menuInDropdown.includes(b.dataset.menu);
    b.classList.toggle("hidden", inMenu && !editing);
  });
  /* İçerik: düz butonlar (outerHTML kopyası YOK — textContent + data-menu kullan) */
  drop.innerHTML = `<button class="btn" data-maction="edit">⚙️ Menüyü Düzenle</button><div class="menu-sep"></div>`;
  allMenuKeys().filter(k => menuInDropdown.includes(k)).forEach(k => {
    const b = document.querySelector(`header .btn[data-menu="${k}"]`);
    if (!b) return;
    if (PERM_BTN_IDS.includes(b.id) && b.classList.contains("hidden")) return;
    const c = b.cloneNode(true);
    c.id = b.id + "_m";
    c.classList.remove("hidden");
    c.classList.remove("primary");
    c.removeAttribute("onclick");   /* kalıntı inline handler varsa temizle */
    c.dataset.maction = "clone:" + k; /* tıklama delege edilir */
    drop.appendChild(c);
  });
}

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

/* ================= 🐍 YILAN OYUNU ================= */
let snakeTimer = null;
let snakeState = null;
let snakeBest = Number(localStorage.getItem("sevkiyat_yilan_best") || 0);
let snakePaused = false;

/* ═══════════════ 🐍 YILAN — ana sayfa modalı + depo mini dashboard ═══════════════ */
function openSnakeGame() {
  renderSnakeGameBody();
  document.getElementById("snakeModal").classList.remove("hidden");
}
function closeSnakeGame() {
  stopSnake();
  snakePaused = false;
  document.getElementById("snakeModal").classList.add("hidden");
}
function renderSnakeGameBody() {
  const c = document.getElementById("snakeBody");
  const devam = snakeState && snakePaused;
  c.innerHTML = `
    <div class="snake-top"><span>Skor: <b id="snakeScore">${devam ? snakeState.score : 0}</b></span><span>🏆 Rekor: <b id="snakeBest">${snakeBest}</b></span></div>
    <div class="snake-cv-wrap">
      <canvas id="snakeCanvas" width="400" height="400"></canvas>
      <div class="snake-over" id="snakeOver">
        <div class="so-title" id="snakeOverTitle">${devam ? "⏸ Duraklatıldı" : "🐍 Yılan Oyunu"}</div>
        <div class="so-score" id="snakeOverScore">Rekor: ${snakeBest}</div>
        <button class="depo-tab active" id="btnSnakeStart">${devam ? "▶️ Devam Et" : "▶️ Başla"}</button>
      </div>
    </div>
    <div class="snake-pad">
      <button class="snake-btn" data-sdir="up">▲</button>
      <div>
        <button class="snake-btn" data-sdir="left">◀</button>
        <button class="snake-btn" data-sdir="down">▼</button>
        <button class="snake-btn" data-sdir="right">▶</button>
      </div>
    </div>
    <p class="hint" style="margin-top:10px">Klavye: ok tuşları / WASD</p>`;
  document.getElementById("btnSnakeStart").addEventListener("click", snakeStart);
  c.querySelectorAll(".snake-btn").forEach(b => b.addEventListener("click", () => {
    const d = b.dataset.sdir;
    if (d === "up") snakeDir(0, -1);
    if (d === "down") snakeDir(0, 1);
    if (d === "left") snakeDir(-1, 0);
    if (d === "right") snakeDir(1, 0);
  }));
}
function renderDepoMini() {
  const el = document.getElementById("depoMini");
  if (!el) return;
  const hafta = getISOWeek(new Date());
  const bugun = todayISO();
  const haftaOf = r => { const d = parseLocalDate(depoTarih(r)); return d ? getISOWeek(d) : null; };
  const havuz = (rows || []).filter(r => {
    if (haftaOf(r) === hafta) return true;
    const t = gecikmeTarihi(r);
    return r.durum !== "Yükleme Tamamlandı" && t && t < bugun;
  });
  const plan = havuz.reduce((s, r) => s + adet(r), 0);
  const bitti = havuz.filter(r => r.durum === "Yükleme Tamamlandı").reduce((s, r) => s + adet(r), 0);
  const oran = plan ? Math.round(bitti / plan * 100) : 0;
  const KISA = { "KOMPLE TIR": "KOMPLE", "PARSIYEL TIR": "PARS", "40 HC": "40HC", "20 DC": "20DC" };
  const tips = TIPLER.map(tip => {
    const p = havuz.filter(r => r.sevkiyatTipi === tip).reduce((s, r) => s + adet(r), 0);
    if (!p) return "";
    const b = havuz.filter(r => r.sevkiyatTipi === tip && r.durum === "Yükleme Tamamlandı").reduce((s, r) => s + adet(r), 0);
    return `<span class="dm-tip">${KISA[tip] || esc(tip)} <b>${b}/${p}</b></span>`;
  }).filter(Boolean).join("");
  el.innerHTML = `
    <div class="dm-row">
      <span class="dm-week">📅 HAFTA ${hafta}</span>
      <span class="dm-nums2"><b class="dm-bitti">${bitti}</b>/<b>${plan}</b> yükleme</span>
      <span class="dm-pct">%${oran}</span>
    </div>
    <div class="dm-bar"><div class="dm-bar-fill" style="width:${oran}%"></div></div>
    <div class="dm-tips">${tips || `<span class="dm-empty">Bu hafta kayıt yok</span>`}</div>`;
}

function stopSnake() {
  if (snakeTimer) { clearInterval(snakeTimer); snakeTimer = null; }
}
function snakeReset() {
  snakePaused = false;
  stopSnake();
  snakeState = {
    body: [{x:10,y:10},{x:9,y:10},{x:8,y:10}],
    dir: {x:1,y:0}, nextDir: {x:1,y:0},
    food: null, score: 0, speed: 150
  };
  snakePlaceFood();
  drawSnake();
}
function snakePlaceFood() {
  const s = snakeState;
  let p;
  do { p = { x: Math.floor(Math.random()*20), y: Math.floor(Math.random()*20) }; }
  while (s.body.some(c => c.x === p.x && c.y === p.y));
  s.food = p;
}
function snakeDir(nx, ny) {
  if (!snakeState || snakeTimer === null) return;
  if (snakeState.dir.x === -nx && snakeState.dir.y === -ny) return; /* geri dönüş yasak */
  snakeState.nextDir = { x: nx, y: ny };
}
function snakeStart() {
  const ov = document.getElementById("snakeOver");
  if (ov) ov.classList.add("hidden");
  if (snakeState && snakePaused) {
    snakePaused = false;
    const sc = document.getElementById("snakeScore");
    if (sc) sc.textContent = snakeState.score;
    drawSnake();
  } else {
    snakeReset();
  }
  stopSnake();
  snakeTimer = setInterval(snakeTick, snakeState.speed);
}
function snakeGameOver() {
  snakePaused = false;
  stopSnake();
  if (navigator.vibrate) navigator.vibrate(200);
  const ov = document.getElementById("snakeOver");
  if (ov) {
    ov.classList.remove("hidden");
    document.getElementById("snakeOverTitle").textContent = "💀 Oyun Bitti";
    document.getElementById("snakeOverScore").textContent = `Skorun: ${snakeState.score} · Rekor: ${snakeBest}`;
    document.getElementById("btnSnakeStart").textContent = "▶️ Tekrar Oyna";
  }
}
function snakeTick() {
  const s = snakeState;
  if (!s) return;
  s.dir = s.nextDir;
  const head = { x: s.body[0].x + s.dir.x, y: s.body[0].y + s.dir.y };
  if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20) return snakeGameOver();
  if (s.body.some(c => c.x === head.x && c.y === head.y)) return snakeGameOver();
  s.body.unshift(head);
  if (s.food && head.x === s.food.x && head.y === s.food.y) {
    s.score++;
    const sc = document.getElementById("snakeScore");
    if (sc) sc.textContent = s.score;
    if (s.score > snakeBest) {
      snakeBest = s.score;
      localStorage.setItem("sevkiyat_yilan_best", snakeBest);
      const bEl = document.getElementById("snakeBest");
      if (bEl) bEl.textContent = snakeBest;
    }
    if (s.score % 3 === 0 && s.speed > 70) {
      s.speed -= 10;
      stopSnake();
      snakeTimer = setInterval(snakeTick, s.speed);
    }
    snakePlaceFood();
  } else {
    s.body.pop();
  }
  drawSnake();
}
function drawSnake() {
  const cv = document.getElementById("snakeCanvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const cell = cv.width / 20;
  /* Zemin + grid */
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = "#2b3f66";
  for (let i = 1; i < 20; i++) {
    ctx.beginPath(); ctx.moveTo(i*cell, 0); ctx.lineTo(i*cell, cv.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i*cell); ctx.lineTo(cv.width, i*cell); ctx.stroke();
  }
  /* Yem: kutu 📦 */
  const f = snakeState.food;
  if (f) {
    const fx = f.x*cell, fy = f.y*cell;
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(fx + 4, fy + 4, cell - 8, cell - 8);
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 2;
    ctx.strokeRect(fx + 4, fy + 4, cell - 8, cell - 8);
    /* kutu bandı */
    ctx.strokeStyle = "#92400e";
    ctx.beginPath();
    ctx.moveTo(fx + cell/2, fy + 4); ctx.lineTo(fx + cell/2, fy + cell - 4);
    ctx.moveTo(fx + 4, fy + cell/2); ctx.lineTo(fx + cell - 4, fy + cell/2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  const body = snakeState.body;
  /* HİZALAMA: zincir yönü — her parça, bir öncekine bakar */
  const dirOf = i => {
    const prev = i === 0 ? null : body[i - 1];
    if (!prev) return snakeState.dir;
    const dx = prev.x - body[i].x, dy = prev.y - body[i].y;
    if (Math.abs(dx) >= Math.abs(dy)) return { x: Math.sign(dx) || 1, y: 0 };
    return { x: 0, y: Math.sign(dy) || 1 };
  };
  const roundedRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  /* ZİNCİR: body[1..n] = konteynerler (yeşil dorse) */
  for (let i = body.length - 1; i >= 1; i--) {
    const d = dirOf(i);
    const px = body[i].x * cell, py = body[i].y * cell;
    const horiz = d.x !== 0;
    /* dorse gövdesi */
    ctx.fillStyle = i % 2 === 0 ? "#16a34a" : "#15803d";
    if (horiz) roundedRect(px + 2, py + cell*0.18, cell - 4, cell*0.64, 4);
    else roundedRect(px + cell*0.18, py + 2, cell*0.64, cell - 4, 4);
    ctx.fill();
    ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 1.5; ctx.stroke();
    /* kapı çizgisi (arka uçta) */
    ctx.strokeStyle = "#0b1220"; ctx.lineWidth = 2;
    const bx = horiz ? (d.x > 0 ? px + 5 : px + cell - 5) : px + cell/2;
    const by = horiz ? py + cell/2 : (d.y > 0 ? py + 5 : py + cell - 5);
    if (horiz) { ctx.beginPath(); ctx.moveTo(bx, py + cell*0.24); ctx.lineTo(bx, py + cell*0.76); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(px + cell*0.24, by); ctx.lineTo(px + cell*0.76, by); ctx.stroke(); }
       /* tekerlekler */
    ctx.fillStyle = "#334155";
    if (horiz) {
      ctx.fillRect(px + cell*0.3, py + cell*0.85, 6, 5);
      ctx.fillRect(px + cell*0.7, py + cell*0.85, 6, 5);
    } else {
      ctx.fillRect(px + cell*0.85, py + cell*0.3, 5, 6);
      ctx.fillRect(px + cell*0.85, py + cell*0.7, 5, 6);
    }
    ctx.lineWidth = 1;
  }
  /* BAŞ: çekici (kırmızı kabin) */
  const hd = dirOf(0);
  const hx = body[0].x * cell, hy = body[0].y * cell;
  const horizH = hd.x !== 0;
  /* dorse bağlantısı (kısa) */
  ctx.fillStyle = "#64748b";
  if (horizH) ctx.fillRect(hx + (hd.x > 0 ? 2 : cell*0.4), hy + cell*0.32, cell*0.25, cell*0.36);
  else ctx.fillRect(hx + cell*0.32, hy + (hd.y > 0 ? 2 : cell*0.4), cell*0.36, cell*0.25);
  /* kabin */
  ctx.fillStyle = "#dc2626";
  if (horizH) roundedRect(hx + (hd.x > 0 ? cell*0.28 : 2), hy + cell*0.15, cell*0.7, cell*0.7, 5);
  else roundedRect(hx + cell*0.15, hy + (hd.y > 0 ? cell*0.28 : 2), cell*0.7, cell*0.7, 5);
  ctx.fill();
  ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 1.5; ctx.stroke();
  /* kabin camı (yön tarafında) */
  ctx.fillStyle = "#93c5fd";
  if (horizH) ctx.fillRect(hx + (hd.x > 0 ? cell*0.72 : cell*0.08), hy + cell*0.24, cell*0.18, cell*0.28);
  else ctx.fillRect(hx + cell*0.24, hy + (hd.y > 0 ? cell*0.72 : cell*0.08), cell*0.28, cell*0.18);
  /* farlar (ön) */
  ctx.fillStyle = "#fde68a";
  if (horizH) { ctx.fillRect(hx + (hd.x > 0 ? cell*0.95 : 0), hy + cell*0.2, 3, 5); ctx.fillRect(hx + (hd.x > 0 ? cell*0.95 : 0), hy + cell*0.65, 3, 5); }
  else { ctx.fillRect(hx + cell*0.2, hy + (hd.y > 0 ? cell*0.95 : 0), 5, 3); ctx.fillRect(hx + cell*0.65, hy + (hd.y > 0 ? cell*0.95 : 0), 5, 3); }
  /* çekici tekerlekleri */
  ctx.fillStyle = "#1e293b";
  if (horizH) { ctx.fillRect(hx + cell*0.15, hy + cell*0.85, 6, 5); ctx.fillRect(hx + cell*0.55, hy + cell*0.85, 6, 5); }
  else { ctx.fillRect(hx + cell*0.85, hy + cell*0.15, 5, 6); ctx.fillRect(hx + cell*0.85, hy + cell*0.55, 5, 6); }
  ctx.lineWidth = 1;
}
/* Klavye — yılan sekmesi aktifken çalışır */
document.addEventListener("keydown", e => {
  const ov = document.getElementById("snakeModal");
  if (!ov || ov.classList.contains("hidden")) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const map = { ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0], w:[0,-1], s:[0,1], a:[-1,0], d:[1,0] };
  if (!map[k]) return;
  e.preventDefault();
  if (!snakeState) return;
  snakeDir(map[k][0], map[k][1]);
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !document.getElementById("snakeModal").classList.contains("hidden")) closeSnakeGame();
});

/* Rapor butonu güvence bağlantısı */
(function () {
  const b = document.getElementById("btnReports");
  if (!b) { console.warn("⚠️ btnReports HTML'de yok"); return; }
  b.addEventListener("click", () => {
    const m = document.getElementById("reportModal");
    if (!m) { alert("⚠️ Rapor penceresi HTML'de bulunamadı — index.html'de reportModal div'ini kontrol edin."); return; }
    m.classList.remove("hidden");
    buildReports();
  });
  console.info("✅ Rapor butonu bağlandı");
})();

