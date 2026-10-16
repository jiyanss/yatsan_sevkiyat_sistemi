/* ============================================================
   📊 PROFESYONEL RAPORLAR (sekmeli)
   ============================================================ */
let chartInstances = [];
let nedenChartTimer = null;
function destroyCharts() {
  clearTimeout(nedenChartTimer);
  chartInstances.forEach(c => { try { c.destroy(); } catch (e) {} });
  chartInstances = [];
}
if (typeof ChartDataLabels !== "undefined") {
  Chart.register(ChartDataLabels);
}
const centerTextPlugin = {
  id: "centerText",
  afterDraw(chart, args, opts) {
    if (!opts || opts.display === false) return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    ctx.save();
    const x = (chartArea.left + chartArea.right) / 2;
    const y = (chartArea.top + chartArea.bottom) / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 30px Inter, sans-serif";
    ctx.fillStyle = opts.color || "#0f172a";
    ctx.fillText(opts.text || "", x, y - 6);
    ctx.font = "600 11px Inter, sans-serif";
    ctx.fillStyle = opts.subColor || "#64748b";
    ctx.fillText(opts.subText || "", x, y + 18);
    ctx.restore();
  }
};
Chart.register(centerTextPlugin);

function groupStats(list, keyFn) {
  const m = new Map();
  list.forEach(r => {
    const k = keyFn(r) || "-";
    if (!m.has(k)) m.set(k, { ad: 0, tamam: 0, yuk: 0, bek: 0, geciken: 0, m3: 0 });
    const g = m.get(k);
    const a = adet(r);
    g.ad += a; g.m3 += Number(r.m3) || 0;
    if (r.durum === "Yükleme Tamamlandı") g.tamam += a;
    else if (r.durum === "Yükleniyor") g.yuk += a;
    else g.bek += a;
    if (gecikmeGunu(r) > 0) g.geciken += a;
  });
  return m;
}
function statsTable(map, title, colLabel) {
  let rowsHtml = "";
  let tA = 0, tT = 0, tG = 0, tM = 0;
  [...map.entries()].sort((a, b) => b[1].ad - a[1].ad).forEach(([k, g]) => {
    tA += g.ad; tT += g.tamam; tG += g.geciken; tM += g.m3;
    const oran = g.ad ? (g.tamam / g.ad * 100).toFixed(1) : "0.0";
    rowsHtml += `<tr><td class="strong">${esc(k)}</td><td class="center">${fmtN(g.ad)}</td><td class="center">${fmtN(g.tamam)}</td><td class="center">${fmtN(g.ad - g.tamam)}</td><td class="center" style="${g.geciken ? "color:var(--red);font-weight:600" : ""}">${g.geciken ? fmtN(g.geciken) : "-"}</td><td class="center">${fmtN(g.m3)}</td><td class="center">%${oran}</td></tr>`;
  });
  const oran = tA ? (tT / tA * 100).toFixed(1) : "0.0";
  return `<div class="rpt"><h3>${esc(title)}</h3><div class="table-wrap"><table>
    <thead><tr><th>${esc(colLabel)}</th><th>Yükleme (adet)</th><th>Tamamlanan</th><th>Kalan</th><th>Geciken</th><th>Toplam M3</th><th>Tamamlanma</th></tr></thead>
    <tbody>${rowsHtml || `<tr><td colspan="7" class="empty">Veri yok</td></tr>`}</tbody>
    <tfoot><tr><td>TOPLAM</td><td class="center">${fmtN(tA)}</td><td class="center">${fmtN(tT)}</td><td class="center">${fmtN(tA - tT)}</td><td class="center">${tG ? fmtN(tG) : "-"}</td><td class="center">${fmtN(tM)}</td><td class="center">%${oran}</td></tr></tfoot>
  </table></div></div>`;
}
function sapmaAnalizi(list) {
  const kayitlar = list.filter(r => r.gerceklesenTarih && r.planlananTarih && r.durum === "Yükleme Tamamlandı");
  if (!kayitlar.length) return null;
  const satirlar = kayitlar.map(r => ({
    musteri: r.musteri,
    sapma: Math.round((parseLocalDate(r.gerceklesenTarih) - parseLocalDate(r.planlananTarih)) / 86400000)
  }));
  const n = satirlar.length;
  const ort = satirlar.reduce((a, s) => a + s.sapma, 0) / n;
  const zamaninda = satirlar.filter(s => s.sapma <= 0).length;
  const enKotu = Math.max(...satirlar.map(s => s.sapma));
  const m = new Map();
  satirlar.forEach(s => {
    if (!m.has(s.musteri)) m.set(s.musteri, { n: 0, toplam: 0, kotu: -Infinity, zamaninda: 0 });
    const g = m.get(s.musteri);
    g.n++; g.toplam += s.sapma;
    if (s.sapma > g.kotu) g.kotu = s.sapma;
    if (s.sapma <= 0) g.zamaninda++;
  });
  return { n, ort, zamaninda, enKotu, musteri: m };
}
function sapmaTable(az) {
  const rowsHtml = [...az.musteri.entries()]
     .filter(([k, g]) => (g.toplam / g.n) !== 0)   /* 0 sapmalıları tablodan çıkar */
    .sort((a, b) => b[1].toplam / b[1].n - a[1].toplam / a[1].n)
    .map(([k, g]) => {
      const ort = g.toplam / g.n;
      const zOran = (g.zamaninda / g.n * 100).toFixed(0);
      const renk = ort > 0 ? "color:var(--red);font-weight:600" : ort < 0 ? "color:var(--primary);font-weight:600" : "color:var(--green);font-weight:600";
      return `<tr><td class="strong">${esc(k)}</td><td class="center">${g.n}</td>
        <td class="center" style="${renk}">${fmtSapma(ort)} gün</td>
        <td class="center" style="${g.kotu > 0 ? "color:var(--red)" : ""}">${fmtSapma(g.kotu)} gün</td>
        <td class="center">%${zOran}</td></tr>`;
    }).join("");
  return `<div class="rpt"><h3>🗓️ Plan vs Gerçekleşen — müşteri sapma tablosu</h3>
    <p class="hint">Sadece tamamlanmış kayıtlar: sapma = gerçekleşen − planlanan. <b>+gün</b> = geç (kırmızı), <b>−gün</b> = erken (mavi). Müşteriler ortalama sapmaya göre azalan sıralı.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Müşteri</th><th>Tamamlanan yükleme</th><th>Ortalama sapma</th><th>En kötü sapma</th><th>Zamanında</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr><td>GENEL</td><td class="center">${az.n}</td>
        <td class="center" style="font-weight:700;${az.ort > 0 ? "color:var(--red)" : "color:var(--green)"}">${fmtSapma(az.ort)} gün</td>
        <td class="center" style="${az.enKotu > 0 ? "color:var(--red)" : ""}">${fmtSapma(az.enKotu)} gün</td>
        <td class="center">%${(az.zamaninda / az.n * 100).toFixed(0)}</td></tr></tfoot>
    </table></div></div>`;
}
/* ⏱️ Yüklenme süresi performans analizi */
function sureAnalizi(list) {
  const kayitlar = list.filter(r => r.durum === "Yükleme Tamamlandı" && r.loadingStartedAt && r.loadingEndedAt)
    .map(r => {
      const gecenDk = Math.round((r.loadingEndedAt - r.loadingStartedAt) / 60000);
      const standart = getSureDk(r);
      const farkDk = gecenDk - standart;
      return { musteri: r.musteri, tip: r.sevkiyatTipi, gecenDk, standart, farkDk };
    });
  if (!kayitlar.length) return null;
  const n = kayitlar.length;
  const ortGecen = kayitlar.reduce((a, s) => a + s.gecenDk, 0) / n;
  const asimli = kayitlar.filter(s => s.farkDk > 0).length;
  const enKotu = kayitlar.reduce((m, s) => Math.max(m, s.farkDk), -Infinity);
  const m = new Map();
  kayitlar.forEach(s => {
    const k = s.musteri + " · " + s.tip;
    if (!m.has(k)) m.set(k, { n: 0, toplam: 0, kotu: -Infinity, asim: 0, stTop: 0 });
    const g = m.get(k);
    g.n++; g.toplam += s.gecenDk; g.stTop += s.standart;
    if (s.farkDk > g.kotu) g.kotu = s.farkDk;
    if (s.farkDk > 0) g.asim++;
  });
  return { n, ortGecen, asimli, enKotu, musteri: m };
}
function sureTable(az) {
  const rowsHtml = [...az.musteri.entries()]
    .sort((a, b) => (b[1].toplam / b[1].n) - (a[1].toplam / a[1].n))
    .map(([k, g]) => {
      const ort = g.toplam / g.n;
      const asimOran = (g.asim / g.n * 100).toFixed(0);
      return `<tr><td class="strong">${esc(k)}</td><td class="center">${g.n}</td>
        <td class="center">${fmtN(ort)} dk</td>
        <td class="center" style="${g.kotu > 0 ? "color:var(--red)" : "color:var(--green)"}">${fmtN(g.kotu)} dk</td>
        <td class="center" style="${g.asim ? "color:var(--red)" : "color:var(--green)"}">%${asimOran}</td></tr>`;
    }).join("");
  return `<div class="rpt"><h3>⏱️ Yüklenme süresi performansı — müşteri + tip bazlı</h3>
    <p class="hint">Kronometre verisi olan tamamlanmış yüklemeler. Ortalama süreye göre sıralanır — en tepedekiler en yavaş yüklenen kombinasyonlar. Aşım %: standart süreyi aşan yüklemelerin oranı.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Müşteri · Tip</th><th>Yükleme</th><th>Ortalama süre</th><th>En kötü aşım</th><th>Aşım oranı</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr><td>GENEL</td><td class="center">${az.n}</td>
        <td class="center" style="font-weight:700">${fmtN(az.ortGecen)} dk</td>
        <td class="center" style="${az.enKotu > 0 ? "color:var(--red)" : ""}">${fmtN(az.enKotu)} dk</td>
        <td class="center">%${(az.asimli / az.n * 100).toFixed(0)}</td></tr></tfoot>
    </table></div></div>`;
}
function haftaData(list = null) {
  const haftaMap = new Map();
  enriched(list || rows).forEach(r => {
    if (r.hafta === "-") return;
    if (!haftaMap.has(r.hafta)) haftaMap.set(r.hafta, { ad: 0, tamam: 0 });
    const g = haftaMap.get(r.hafta);
    g.ad += adet(r);
    if (r.durum === "Yükleme Tamamlandı") g.tamam += adet(r);
  });
  const haftalar = [...haftaMap.keys()].sort((a, b) => a - b).slice(-8);
  return { haftaMap, haftalar };
}
function chartBase() {
  const isDark = document.body.classList.contains("dark");
  return {
    isDark,
    textColor: isDark ? "#94a3b8" : "#334155",
    gridColor: isDark ? "#2b3a52" : "#e2e8f0",
    labelColor: isDark ? "#cbd5e1" : "#0f172a"
  };
}
function grad(ctx, area, hexFrom, hexTo) {
  if (!area) return hexFrom;
  const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, hexFrom);
  g.addColorStop(1, hexTo);
  return g;
}

function buildGenel(list) {
  const s = computeSummary(list);
  const { textColor, gridColor, labelColor } = chartBase();
  const kpiBlock = `<div class="kpi-grid">
    <div class="kpi c-primary"><div class="kpi-head">📦 Toplam Yükleme</div><div class="kpi-val">${fmtN(s.toplamAd)}</div><div class="kpi-sub">${fmtN(s.toplamM3)} m³ · ${list.length} kayıt</div></div>
    <div class="kpi c-green"><div class="kpi-head">✅ Tamamlanan</div><div class="kpi-val">${fmtN(s.tamamAd)}</div><div class="kpi-sub">tamamlanma %${s.oran.toFixed(1)} · ${fmtN(s.toplamM3Tamam)} m³</div></div>
    <div class="kpi c-amber"><div class="kpi-head">⏳ Kalan</div><div class="kpi-val">${fmtN(s.kalanAd)}</div><div class="kpi-sub">${fmtN(s.bekleyenAd)} bekliyor · ${fmtN(s.yukleniyorAd)} yükleniyor</div></div>
    <div class="kpi c-red"><div class="kpi-head">⚠️ Geciken</div><div class="kpi-val">${fmtN(s.gecikenAd)}</div><div class="kpi-sub">${s.maxGecikme > 0 ? `en eski ${s.maxGecikme} gün` : "gecikme yok 🎉"} · bugün: ${fmtN(s.bugunAd)}</div></div>
  </div>`;

  const chartBlock = (typeof Chart === "undefined")
    ? `<p class="hint">⚠️ Grafik kütüphanesi (CDN) yüklenemedi.</p>`
    : `<div class="chart-grid">
        <div class="chart-box"><h3>Tamamlanma durumu</h3><div class="chart-holder"><canvas id="chDonut"></canvas></div></div>
        <div class="chart-box"><h3>Gün bazlı yükleme (reel plan)</h3><div class="chart-holder"><canvas id="chGun"></canvas></div></div>
        <div class="chart-box"><h3>Sevkiyat tipi dağılımı</h3><div class="chart-holder"><canvas id="chTip"></canvas></div></div>
        <div class="chart-box"><h3>BLM performansı</h3><div class="chart-holder"><canvas id="chBlm"></canvas></div></div>
      </div>`;

  document.getElementById("reportPaneGenel").innerHTML = kpiBlock + chartBlock;
  if (typeof Chart === "undefined") return;

  /* Donut — merkez: % + mutlak sayı */
  chartInstances.push(new Chart(document.getElementById("chDonut"), {
    type: "doughnut",
    data: {
      labels: ["Tamamlanan", "Yükleniyor", "Bekliyor"],
      datasets: [{
        data: [s.tamamAd, s.yukleniyorAd, s.kalanAd - s.yukleniyorAd],
        backgroundColor: ["#059669", "#d97706", "#dc2626"],
        borderWidth: 0, hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "72%",
      plugins: {
        legend: { position: "bottom", labels: { color: textColor, usePointStyle: true, pointStyle: "circle", padding: 14, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtN(c.parsed)} yükleme` } },
        datalabels: { display: false },
        centerText: {
          display: true,
          text: "%" + s.oran.toFixed(0),
          subText: `tamamlanma · ${fmtN(s.tamamAd)}/${fmtN(s.toplamAd)}`,
          color: labelColor,
          subColor: textColor
        }
      }
    }
  }));

  /* Gün bazlı — tamamlanan/kalan yığılmış */
  const gunCtx = document.getElementById("chGun").getContext("2d");
  const gunDone = GUNLER.map(() => 0), gunLeft = GUNLER.map(() => 0);
  list.forEach(r => {
    const dt = parseLocalDate(gecikmeTarihi(r));
    if (!dt) return;
    const idx = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }[dt.getDay()];
    if (idx === undefined) return;
    if (r.durum === "Yükleme Tamamlandı") gunDone[idx] += adet(r);
    else gunLeft[idx] += adet(r);
  });
  chartInstances.push(new Chart(gunCtx, {
    type: "bar",
    data: {
      labels: GUNLER,
      datasets: [
        { label: "Tamamlanan", data: gunDone,
          backgroundColor: "#059669", borderRadius: { topRight: 5 }, maxBarThickness: 40 },
        { label: "Kalan", data: gunLeft,
          backgroundColor: "#f59e0b", borderRadius: { topRight: 5 }, maxBarThickness: 40 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: textColor, usePointStyle: true, pointStyle: "circle", padding: 12, font: { size: 11 } } },
        datalabels: { color: "#fff", font: { weight: "700", size: 10.5 },
          display: c => c.dataset.data[c.dataIndex] > 0, formatter: v => fmtN(v) },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmtN(c.parsed.y)} yükleme` } }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: textColor, font: { size: 11, weight: "600" } } },
        y: { stacked: true, beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, precision: 0, maxTicksLimit: 6 } }
      }
    }
  }));

  /* Tip dağılımı — adet + m³ */
  const tipMap = groupStats(list, r => r.sevkiyatTipi);
  const tipTotal = [...tipMap.values()].reduce((a, g) => a + g.ad, 0) || 1;
  const tipM3 = [...tipMap.values()].map(g => g.m3);
  const tipCtx = document.getElementById("chTip").getContext("2d");
  chartInstances.push(new Chart(tipCtx, {
    type: "bar",
    data: { labels: [...tipMap.keys()], datasets: [{
      label: "Yükleme adedi",
      data: [...tipMap.values()].map(g => g.ad),
      backgroundColor: ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981"],
      borderRadius: 6, maxBarThickness: 30
    }]},
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end", align: "end", clamp: true,
          color: textColor, font: { weight: "700", size: 10.5 },
          formatter: (v, c) => `${fmtN(v)} · %${(v / tipTotal * 100).toFixed(0)} · ${fmtN(tipM3[c.dataIndex])} m³`
        },
        tooltip: { callbacks: { label: c => {
          const g = [...tipMap.values()][c.dataIndex];
          return ` ${fmtN(g.ad)} yükleme · %${(g.ad / tipTotal * 100).toFixed(1)} · ${fmtN(g.m3)} m³ · tamamlanma %${g.ad ? (g.tamam / g.ad * 100).toFixed(0) : 0}`;
        } } }
      },
      scales: {
        x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, precision: 0, maxTicksLimit: 6 }, suggestedMax: Math.max(...[...tipMap.values()].map(g => g.ad), 1) * 1.45 },
        y: { grid: { display: false }, ticks: { color: textColor, font: { size: 11, weight: "600" } } }
      }
    }
  }));

  /* BLM — yığılmış + tooltip tamamlanma % */
  const blmMap = groupStats(list, r => r.blm);
  const blmCtx = document.getElementById("chBlm").getContext("2d");
  chartInstances.push(new Chart(blmCtx, {
    type: "bar",
    data: {
      labels: [...blmMap.keys()],
      datasets: [
        { label: "Tamamlanan", data: [...blmMap.values()].map(g => g.tamam), backgroundColor: "#059669", borderRadius: { topRight: 6 }, maxBarThickness: 52 },
        { label: "Kalan",      data: [...blmMap.values()].map(g => g.ad - g.tamam), backgroundColor: "#f59e0b", borderRadius: { topRight: 6 }, maxBarThickness: 52 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: textColor, usePointStyle: true, pointStyle: "circle", padding: 12, font: { size: 11 } } },
        datalabels: {
          color: "#fff", font: { weight: "700", size: 10.5 },
          display: c => c.dataset.data[c.dataIndex] > 0,
          formatter: v => fmtN(v)
        },
        tooltip: { callbacks: {
          label: c => ` ${c.dataset.label}: ${fmtN(c.parsed.y)}`,
          afterBody: items => {
            const g = [...blmMap.values()][items[0].dataIndex];
            return g && g.ad ? ` Tamamlanma: %${(g.tamam / g.ad * 100).toFixed(0)}` : "";
          }
        } }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: textColor, font: { size: 11, weight: "600" } } },
        y: { stacked: true, beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, precision: 0, maxTicksLimit: 6 } }
      }
    }
  }));
}


/* ⚠️ Gecikme nedeni dağılımı — grafik + tablo */
function gecikmeNedenData() {
  const m = new Map();
  let isimsiz = 0;
  rows.forEach(r => {
    const b = gecikmeBilgi(r);
    if (b.gun <= 0) return;
    if (b.neden) {
      if (!m.has(b.neden)) m.set(b.neden, { adet: 0 });
      m.get(b.neden).adet += 1;
    } else {
      isimsiz++;
    }
  });
  return { m, isimsiz };
}
function gecikmeNedenTable() {
  const { m, isimsiz } = gecikmeNedenData();
  const toplam = [...m.values()].reduce((s, g) => s + g.adet, 0);
  if (!toplam) return `<p class="hint">⚠️ Gecikme nedeni henüz girilmemiş — geciken kayıtlarda 📌 butonuna tıklayarak neden seç.</p>`;
  const noCauseBlock = isimsiz
    ? `<p class="hint">⚠️ ${isimsiz} geciken kaydın nedeni henüz girilmemiş.</p>`
    : "";
  const chartBlock = (typeof Chart === "undefined")
    ? ``
    : `<div class="chart-box" style="margin-bottom:16px"><h3>⚠️ Gecikmeler neden kaynaklanıyor?</h3><div class="chart-holder"><canvas id="chNeden"></canvas></div></div>`;
  const rowsHtml = [...m.entries()]
    .sort((a, b) => b[1].adet - a[1].adet)
    .map(([k, g]) => `<tr><td class="strong">${esc(k)}</td><td class="center">${g.adet}</td><td class="center">%${(g.adet / toplam * 100).toFixed(0)}</td></tr>`).join("");
  const html = `<div class="rpt"><h3>⚠️ Gecikme nedeni dağılımı</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Neden</th><th>Geciken kayıt</th><th>Pay</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr><td>TOPLAM</td><td class="center">${toplam}</td><td class="center">—</td></tr></tfoot>
    </table></div></div>`;
   /* HTML'i koy, grafik sonradan kurulsun (bekleyen kurulumu iptal + eskiyi sök) */
  clearTimeout(nedenChartTimer);
  nedenChartTimer = setTimeout(() => {
    if (typeof Chart === "undefined") return;
    const cnv = document.getElementById("chNeden");
    if (!cnv) return;
    const eski = Chart.getChart(cnv);
    if (eski) eski.destroy();
    const { textColor } = chartBase();
    chartInstances.push(new Chart(cnv.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: [...m.keys()],
        datasets: [{ data: [...m.values()].map(g => g.adet),
          backgroundColor: ["#dc2626", "#d97706", "#8b5cf6", "#0ea5e9", "#f59e0b", "#059669", "#64748b"],
          borderWidth: 0, hoverOffset: 8 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "60%",
        plugins: {
          legend: { position: "bottom", labels: { color: textColor, usePointStyle: true, pointStyle: "circle", padding: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtN(c.parsed)} kayıt` } },
          datalabels: { display: false }
        }
      }
    }));
  }, 50);
  return chartBlock + html + noCauseBlock;
}
function buildAnaliz(list) {
  const { textColor, gridColor } = chartBase();
  const az = sapmaAnalizi(list);
  const buHafta = getISOWeek(new Date());

  /* 📋 Son 4 hafta özet bantı (rapor filtre havuzundan) */
  const { haftaMap: hm4, haftalar: hl4 } = haftaData(list);
  const son4 = hl4.filter(h => h >= buHafta - 3 && h < buHafta);
  const t4Ad = son4.reduce((s, h) => s + (hm4.get(h)?.ad || 0), 0);
  const t4Tam = son4.reduce((s, h) => s + (hm4.get(h)?.tamam || 0), 0);
  const ozetBant = `<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">
    <div class="kpi c-primary"><div class="kpi-head">📊 Son 4 hafta ortalaması</div>
      <div class="kpi-val" style="font-size:20px">${son4.length ? fmtN(t4Ad / son4.length) : "—"} yükleme/hafta</div>
      <div class="kpi-sub">${fmtN(t4Ad)} yükleme · ${son4.length} hafta</div></div>
    <div class="kpi c-green"><div class="kpi-head">✅ Son 4 hafta tamamlanma</div>
      <div class="kpi-val" style="font-size:20px">%${t4Ad ? (t4Tam / t4Ad * 100).toFixed(1) : "—"}</div>
      <div class="kpi-sub">${fmtN(t4Tam)} / ${fmtN(t4Ad)} yükleme</div></div>
    <div class="kpi c-amber"><div class="kpi-head">🗓️ Genel plan sapması</div>
      <div class="kpi-val" style="font-size:20px">${az ? fmtSapma(az.ort) + " gün" : "—"}</div>
      <div class="kpi-sub">${az ? az.n + " tamamlanmış yükleme · zamanında %" + (az.zamaninda / az.n * 100).toFixed(0) : "veri yok"}</div></div>
  </div>`;

  const chartBlock = (typeof Chart === "undefined")
    ? `<p class="hint">⚠️ Grafik kütüphanesi (CDN) yüklenemedi.</p>`
    : `<div class="chart-grid">
         <div class="chart-box wide"><h3>📈 Haftalık yükleme hacmi & tamamlanma oranı (son 8 hafta · çizgi yalnız kapanmış haftalarda · hedef %80)</h3><div class="chart-holder"><canvas id="chKarma"></canvas></div></div>
         ${az ? `<div class="chart-box wide"><h3>🗓️ Müşteri bazlı ortalama plan sapması (gün · sıfır sapmalılar hariç)</h3><div class="chart-holder tall"><canvas id="chSapma"></canvas></div></div>` : ""}
      </div>` +
        gecikmeNedenTable() +
    (az ? sapmaTable(az) : `<p class="hint">🗓️ Sapma analizi için henüz tamamlanmış (gerçekleşen tarihi dolu) kayıt yok.</p>`);
  document.getElementById("reportPaneAnaliz").innerHTML = ozetBant + chartBlock;
  if (typeof Chart === "undefined") return;

  const { haftaMap, haftalar } = haftaData(list);
  /* Çizgi yalnız KAPANMIŞ haftalarda — aktif hafta boş bırakılır (grafik yıkmaz) */
  const oranlar = haftalar.map(h => {
    if (h >= buHafta) return null;
    const g = haftaMap.get(h);
    return g.ad ? +(g.tamam / g.ad * 100).toFixed(1) : null;
  });
  const kCtx = document.getElementById("chKarma").getContext("2d");
  chartInstances.push(new Chart(kCtx, {
    data: {
      labels: haftalar.map(h => h + ". hafta"),
      datasets: [
        {
          type: "bar", label: "Toplam yükleme", yAxisID: "y",
          data: haftalar.map(h => haftaMap.get(h).ad),
          backgroundColor: c => grad(c.chart.ctx, c.chart.chartArea, "#6366f1", "#c7d2fe"),
          borderRadius: 6, maxBarThickness: 46
        },
        {
          type: "bar", label: "Tamamlanan", yAxisID: "y",
          data: haftalar.map(h => haftaMap.get(h).tamam),
          backgroundColor: "#059669cc", borderRadius: 6, maxBarThickness: 46
        },
        {
          type: "line", label: "Tamamlanma oranı %", yAxisID: "y1",
          data: oranlar,
          spanGaps: false,
          borderColor: "#dc2626", backgroundColor: "#dc2626",
          borderWidth: 2.5, tension: .3, pointRadius: 4, pointHoverRadius: 6,
          pointBackgroundColor: c => c.raw == null ? "transparent" : "#fff",
          pointBorderColor: "#dc2626", pointBorderWidth: 2
        },
        {
          type: "line", label: "Hedef %80", yAxisID: "y1",
          data: haftalar.map(() => 80),
          borderColor: "#94a3b8", borderWidth: 1.5, borderDash: [6, 5],
          pointRadius: 0, datalabels: { display: false }
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { color: textColor, usePointStyle: true, padding: 14, font: { size: 11 } },
          filter: item => item.text !== "Hedef %80" },
        datalabels: { display: c => c.dataset.type === "line" && c.dataset.label !== "Hedef %80" && c.dataset.data[c.dataIndex] !== null,
          align: "top", color: "#dc2626", font: { weight: "700", size: 10.5 },
          formatter: v => v == null ? "" : "%" + v },
        tooltip: { callbacks: {
          label: c => {
            if (c.dataset.label === "Hedef %80") return ` Hedef: %80`;
            if (c.dataset.yAxisID === "y1") return c.parsed.y == null ? null : ` Tamamlanma: %${c.parsed.y}`;
            return ` ${c.dataset.label}: ${fmtN(c.parsed.y)} yükleme`;
          }
        } }
      },
      scales: {
        y: { beginAtZero: true, position: "left", grid: { color: gridColor },
             ticks: { color: textColor, precision: 0, maxTicksLimit: 6 },
             title: { display: true, text: "Yükleme adedi", color: textColor, font: { size: 10, weight: "600" } } },
        y1: { beginAtZero: true, max: 100, position: "right", grid: { display: false },
             ticks: { color: "#dc2626", callback: v => "%" + v, maxTicksLimit: 6 },
             title: { display: true, text: "Tamamlanma", color: "#dc2626", font: { size: 10, weight: "600" } } },
        x: { grid: { display: false }, ticks: { color: textColor } }
      }
    }
  }));

  if (az) {
    const musArr = [...az.musteri.entries()]
      .filter(([k, g]) => (g.toplam / g.n) !== 0)   /* 0 sapmalıları grafikten çıkar */
      .map(([k, g]) => ({ k, ort: +(g.toplam / g.n).toFixed(1),
        zamaninda: Math.round(g.zamaninda / g.n * 100) }))
      .sort((a, b) => b.ort - a.ort);
    if (musArr.length) {
      const sCtx = document.getElementById("chSapma").getContext("2d");
      chartInstances.push(new Chart(sCtx, {
        type: "bar",
        data: { labels: musArr.map(x => x.k), datasets: [{
          label: "Ortalama sapma (gün)",
          data: musArr.map(x => x.ort),
          backgroundColor: musArr.map(x => x.ort > 0 ? "#dc2626" : x.ort < 0 ? "#4f46e5" : "#059669"),
          borderRadius: 5, maxBarThickness: 26
        }]},
        options: {
          indexAxis: "y", responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            datalabels: {
              anchor: c => c.dataset.data[c.dataIndex] >= 0 ? "end" : "start",
              align: c => c.dataset.data[c.dataIndex] >= 0 ? "end" : "start",
              clamp: true, color: textColor, font: { weight: "700", size: 10.5 },
              formatter: v => fmtSapma(v)
            },
            tooltip: { callbacks: {
              label: c => ` Ortalama: ${fmtSapma(c.parsed.x)} gün ${c.parsed.x > 0 ? "(geç)" : "(erken)"}`,
              afterLabel: c => ` Zamanında: %${musArr[c.dataIndex].zamaninda}`
            } }
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => fmtSapma(v) } },
            y: { grid: { display: false }, ticks: { color: textColor, font: { size: 11, weight: "600" } } }
          }
        }
      }));
    }
  }
}
/* ============================================================
   👷 KAPASİTE ANALİZİ (dakika bazlı gösterim)
   ============================================================ */
function kapasiteData(list = null) {
  const today = todayISO();
  const kaynak = list || enriched(rows);
  const filtreli = kaynak.filter(r => {
    const d = gecikmeTarihi(r);
    return d && d >= today && r.durum !== "Yükleme Tamamlandı";
  });
  const m = new Map();
  filtreli.forEach(r => {      
    const d = gecikmeTarihi(r);
    const g = m.get(d) || { yukleme: 0, saatDk: 0, tanimsiz: 0 };
    g.yukleme += adet(r);
    g.saatDk += (getSureDk(r) * adet(r));
    if (!sureAyarlari[comboKey(r.musteri, r.sevkiyatTipi)]) g.tanimsiz += adet(r);
    m.set(d, g);
  });
  return [...m.entries()]
    .sort((a, b) => a[0] < b[0] ? -1 : 1)
    .map(([tarih, g]) => {
      const gerekliEkip = Math.max(1, Math.ceil(g.saatDk / (kapasiteSaat * 60)));
      const kapasite = kapasiteEkip * kapasiteSaat * 60;
      return { tarih, ...g, gerekliEkip, kapasite, fark: kapasite - g.saatDk };
    });
}
 function buildKapasite(list = null) {
  const c = document.getElementById("reportPaneKapasite");
  const gunler = kapasiteData(list || null);
  if (!gunler.length) {
    c.innerHTML = `<p class="hint">Bugün ve sonrasında planlanmış (tamamlanmamış) yükleme yok — kapasite analizi için gelecek tarihe kayıt ekle.</p>`;
    return;
  }
  const toplamDk = gunler.reduce((s, g) => s + g.saatDk, 0);
  const enKritik = [...gunler].sort((a, b) => b.gerekliEkip - a.gerekliEkip)[0];
  const yetmeyen = gunler.filter(g => g.fark < 0).length;
  const toplamEkipGun = toplamDk / (kapasiteSaat * 60);
  const tanimsizToplam = gunler.reduce((s, g) => s + g.tanimsiz, 0);

  const ayarHtml = `<div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:12px">
    <div class="kpi c-primary"><div class="kpi-head">⏰ Ekip günlük çalışma saati</div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
        <input type="number" id="kapSaat" min="1" max="24" value="${kapasiteSaat}" class="cell-input w-num" />
        <span class="kpi-sub" style="margin:0">saat/gün (= ${fmtN(kapasiteSaat * 60)} dk)</span>
      </div></div>
    <div class="kpi c-amber"><div class="kpi-head">👷 Mevcut ekip sayısı</div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
        <input type="number" id="kapEkip" min="1" max="50" value="${kapasiteEkip}" class="cell-input w-num" />
        <span class="kpi-sub" style="margin:0">ekip (günlük kapasite: ${fmtN(kapasiteEkip * kapasiteSaat * 60)} dk)</span>
      </div></div>
  </div>`;

  const kpiBlock = `<div class="kpi-grid">
    <div class="kpi c-red"><div class="kpi-head">🔥 En kritik gün</div><div class="kpi-val" style="font-size:18px">${esc(gunEtiketi(enKritik.tarih))}</div><div class="kpi-sub">${enKritik.gerekliEkip} ekip gerekli · ${fmtN(enKritik.saatDk)} dk iş</div></div>
    <div class="kpi c-primary"><div class="kpi-head">🧮 Toplam iş süresi</div><div class="kpi-val">${fmtN(toplamDk)} dk</div><div class="kpi-sub">${gunler.length} gün · ${fmtN(toplamEkipGun)} ekip-gün ihtiyaç</div></div>
    <div class="kpi c-amber"><div class="kpi-head">⚠️ Yetersiz gün</div><div class="kpi-val">${yetmeyen}</div><div class="kpi-sub">${gunler.length} günün ${yetmeyen ? yetmeyen : "hiçbirinde"} mevcut ekip yetmiyor</div></div>
    <div class="kpi ${tanimsizToplam ? "c-amber" : "c-green"}"><div class="kpi-head">❔ Süresiz kombinasyon</div><div class="kpi-val">${tanimsizToplam || 0}</div><div class="kpi-sub">${tanimsizToplam ? "yükleme varsayılan süreyle hesaplandı — ⏱️ Süreler panelinden tanımla" : "tüm kombinasyonlar tanımlı 🎉"}</div></div>
  </div>`;

  const chartBlock = (typeof Chart === "undefined")
    ? ``
    : `<div class="chart-box wide" style="margin-bottom:16px"><h3>📊 Gün bazlı gerekli ekip vs mevcut ekip (günlük ${fmtN(kapasiteSaat * 60)} dk/ekip)</h3><div class="chart-holder"><canvas id="chKapasite"></canvas></div></div>`;

  let rowsHtml = "";
  gunler.forEach(g => {
    const yeterli = g.fark >= 0;
    const durum = yeterli
      ? `<span class="badge done">✅ Yetiyor · ${fmtN(g.fark)} dk yedek</span>`
      : `<span class="badge waiting">🔴 ${fmtN(-g.fark)} dk eksik · +${g.gerekliEkip - kapasiteEkip} ekip lazım</span>`;
    const renk = yeterli ? "color:var(--green);font-weight:700" : "color:var(--red);font-weight:700";
    rowsHtml += `<tr>
      <td class="strong">${esc(gunEtiketi(g.tarih))}</td>
      <td class="center">${fmtN(g.yukleme)}</td>
      <td class="center">${fmtN(g.saatDk)} dk</td>
      <td class="center" style="${renk}">${g.gerekliEkip}</td>
      <td class="center">${durum}</td>
    </tr>`;
  });

  c.innerHTML = ayarHtml + kpiBlock + chartBlock + `<div class="rpt"><h3>📅 Gün bazlı kapasite planı (bugün + gelecek · tamamlanmışlar hariç · filtrelerden bağımsız)</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Gün</th><th>Yükleme (adet)</th><th>Gereken iş süresi (dk)</th><th>Gerekli ekip</th><th>Mevcut ${kapasiteEkip} ekiple</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table></div></div>`;

  const saatInp = document.getElementById("kapSaat");
  const ekipInp = document.getElementById("kapEkip");
  const rebuild = () => {
    const s = Number(saatInp.value) || kapasiteSaat;
    const e = Number(ekipInp.value) || kapasiteEkip;
    if (s === kapasiteSaat && e === kapasiteEkip) return;
    kapasiteSaat = s; kapasiteEkip = e;
    saveKapasitePrefs();
    buildKapasite();
  };
  saatInp.addEventListener("change", rebuild);
  ekipInp.addEventListener("change", rebuild);

  if (typeof Chart !== "undefined") {
    const { textColor, gridColor } = chartBase();
    chartInstances.push(new Chart(document.getElementById("chKapasite").getContext("2d"), {
      data: {
        labels: gunler.map(g => gunEtiketi(g.tarih)),
        datasets: [
          { type: "bar", label: "Gerekli ekip", yAxisID: "y",
            data: gunler.map(g => g.gerekliEkip),
            backgroundColor: gunler.map(g => g.fark < 0 ? "#dc2626cc" : "#059669cc"),
            borderRadius: 6, maxBarThickness: 44 },
          { type: "line", label: `Mevcut ekip (${kapasiteEkip})`, yAxisID: "y",
            data: gunler.map(() => kapasiteEkip),
            borderColor: "#4f46e5", borderWidth: 2.5, borderDash: [6, 4],
            pointRadius: 0, fill: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { color: textColor, usePointStyle: true, padding: 14, font: { size: 11 } } },
          datalabels: { display: c => c.dataset.type === "bar", anchor: "end", align: "end",
            color: textColor, font: { weight: "700", size: 10.5 }, formatter: v => v },
          tooltip: { callbacks: { label: c => c.dataset.type === "bar"
            ? ` Gerekli: ${c.parsed.y} ekip (${fmtN(gunler[c.dataIndex].saatDk)} dk iş)`
            : ` Mevcut: ${kapasiteEkip} ekip (${fmtN(kapasiteEkip * kapasiteSaat * 60)} dk kapasite)` } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, precision: 0, stepSize: 1 },
               title: { display: true, text: "Ekip sayısı", color: textColor, font: { size: 10, weight: "600" } } },
          x: { grid: { display: false }, ticks: { color: textColor } }
        }
      }
    }));
  }
}

