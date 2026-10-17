/* ================= ⏱️ Süre hücresi ================= */
function sureBilgi(r) {
  const sureDk = getSureDk(r);
  const hedefMs = sureDk * 60000;
  if (r.durum === "Yükleniyor" && r.loadingStartedAt) {
    const gecen = Math.max(0, Date.now() - r.loadingStartedAt);
    const yuzde = Math.min(100, Math.round(gecen / hedefMs * 100));
    const asim = gecen - hedefMs;
    return { durum: "live", yuzde, gecenMs: gecen, sureDk, asimDk: Math.max(0, Math.round(asim / 60000)), asim: asim > 0 };
  }
  if (r.durum === "Yükleme Tamamlandı" && r.loadingStartedAt && r.loadingEndedAt) {
    const gecen = Math.max(0, r.loadingEndedAt - r.loadingStartedAt);
    const yuzde = Math.min(100, Math.round(gecen / hedefMs * 100));
    return { durum: "done", yuzde, gecenMs: gecen, sureDk, asimDk: Math.max(0, Math.round((gecen - hedefMs) / 60000)), asim: gecen > hedefMs };
  }
  return { durum: "none" };
}
function sureCellHtml(r) {
  /* 📦 T. satırı — toplama süreci (statüden bağımsız) */
  let tpHtml = "";
  if (r.toplamaBasTs) {
    if (r.toplamaBittiTs) {
      const dk = Math.max(0, Math.round((r.toplamaBittiTs - r.toplamaBasTs) / 60000));
      tpHtml = `<div class="sure-tp">📦 T: ${fmtTime(r.toplamaBasTs)}→${fmtTime(r.toplamaBittiTs)} · <b>${dk}dk</b></div>`;
    } else {
      tpHtml = `<div class="sure-tp sure-tp-live">📦 T: sürüyor (${fmtTime(r.toplamaBasTs)}'dan beri)</div>`;
    }
  }
  /* ⏱️ Y. satırı — statü kronometresi (mevcut davranış) */
  const b = sureBilgi(r);
  let yHtml = "";
    if (b.durum === "none") {
    if (r.loadingStartedAt) {
      yHtml = `<span class="sure-txt muted" style="font-size:9px">⏱️ Y: ${fmtTime(r.loadingStartedAt)}'dan beri (statü: ${esc(r.durum)})</span>`;
    } else {
      if (!tpHtml) return `<span class="sure-txt">-</span>`;
      yHtml = `<span class="sure-txt muted" style="font-size:9px">⏱️ Y: yok</span>`;
    }
  } else if (b.durum === "live") {
    const cls = b.yuzde >= 100 ? "over" : b.yuzde >= 70 ? "warn" : "";
    const txt = b.asim
      ? `⚠ ${fmtSure(b.gecenMs)} · ${b.asimDk}dk aşıldı`
      : `${fmtSure(b.gecenMs)} / ${b.sureDk}dk · %${b.yuzde}`;
    yHtml = `<div class="sure-wrap">
      <div class="surebar"><div class="surebar-fill ${cls}" style="width:${b.yuzde}%"></div></div>
      <span class="sure-txt ${b.asim ? "over" : ""}">⏱️ Y: ${txt}</span>
    </div>`;
  } else {
    const cls = b.asim ? "warn" : "";
    const txt = b.asim
      ? `✔ ${fmtSure(b.gecenMs)} · ${b.asimDk}dk aşım`
      : `✔ ${fmtSure(b.gecenMs)} / ${b.sureDk}dk`;
    yHtml = `<div class="sure-wrap">
      <div class="surebar"><div class="surebar-fill ${cls}" style="width:${b.yuzde}%"></div></div>
      <span class="sure-txt ${b.asim ? "done-over" : "done-ok"}">⏱️ Y: ${txt}</span>
    </div>`;
  }
  return tpHtml + yHtml;
}
function updateSureCells() {
  rows.forEach(r => {
    if (r.durum !== "Yükleniyor" || !r.loadingStartedAt) return;
    const tr = document.querySelector(`#tbody tr[data-rowid="${r.id}"]`);
    if (!tr) return;
    const td = tr.querySelector('td[data-col="sure"]');
    if (td) td.innerHTML = sureCellHtml(r);
    const b = sureBilgi(r);
    const isOver = b.asim;
    const hasCls = tr.classList.contains("overtime");
    if (isOver && !hasCls) tr.classList.add("overtime");
    else if (!isOver && hasCls) tr.classList.remove("overtime");
  });
}

  /* ============================================================
   🆕 TABLO BAŞLIĞI — ALL_COLS'tan üretilir (hizalama garantisi)
   ============================================================ */
function renderThead() {
  const tr = document.getElementById("theadRow");
  let html = `<th class="selbox-th" title="Toplu düzenleme için seç"><input type="checkbox" id="selAll" class="selbox" /></th>`;
  ALL_COLS.forEach(([k, label]) => {
    const sortable = SORTABLE[k] ? ` data-sort="${k}"` : "";
    let title = "";
    if (k === "gerceklesenTarih") title = ` title="Durum 'Yükleme Tamamlandı' olunca otomatik yazılır"`;
    if (k === "oncelikNo") title = ` title="Öncelik no: 1-2-3… bu kayıtları varsayılan sıralamada en üste taşır"`;
    html += `<th data-col="${k}"${sortable}${title}>${esc(label)}<span class="arw"></span></th>`;
  });
  html += `<th></th>`;
  tr.innerHTML = html;
}
function updateSortHeaders() {
  document.querySelectorAll("th[data-sort]").forEach(th => {
    const col = th.dataset.sort;
    const arw = th.querySelector(".arw");
    if (arw) arw.textContent = (sortCol === col) ? (sortDir === "desc" ? " ▾" : " ▴") : "";
  });
}

/* ================= Render ================= */
function render() {
  renderDatalist();
  renderDateFilter();
  const list = filtered();
  renderSummary(list);
  renderTable(list);
  applyFit();
}
function renderDatalist() {
  const cust = [...new Set(rows.map(r => r.musteri).filter(Boolean))];
  document.getElementById("musteri-list").innerHTML = cust.map(c => `<option value="${esc(c)}">`).join("");
}
function renderDateFilter() {
  /* Arşiv dahil açıkken hafta seçenekleri arşiv kayıtlarını da kapsar */
  let havuz = rows;
  if (arsivDahil && Array.isArray(arsivCache) && arsivCache.length) {
    havuz = rows.concat(arsivCache);
  }
  const weeks = [...new Set(enriched(havuz).map(r => r.hafta).filter(w => w !== "-"))].sort((a, b) => a - b);
  const opt = (val, label) => `<option value="${val}" ${dateFilter === val ? "selected" : ""}>${label}</option>`;
  document.getElementById("dateFilter").innerHTML =
    `<optgroup label="Hazır aralıklar">` +
    opt("week-current", `Bu hafta (${getISOWeek(new Date())}) + gecikenler`) +
    opt("all", "Tüm zamanlar") +
    opt("d7", "Son 7 gün") +
    opt("d30", "Son 30 gün") +
    opt("month", "Bu ay") +
    opt("lastmonth", "Geçen ay") +
    opt("custom", "Özel aralık…") +
    `</optgroup>` +
    (weeks.length
      ? `<optgroup label="Haftalar">` + weeks.map(w => opt("week-" + w, "Hafta " + w)).join("") + `</optgroup>`
      : "");
  document.getElementById("customRange").classList.toggle("hidden", dateFilter !== "custom");
}
function renderSummary(list) {
  const s = computeSummary(list);
  document.getElementById("sum-toplam").textContent = fmtN(s.toplamAd);
  document.getElementById("sum-tamamlanan").textContent = fmtN(s.tamamAd);
  document.getElementById("sum-kalan").textContent = fmtN(s.kalanAd);
  document.getElementById("sum-bugun").textContent = fmtN(s.bugunAd);
  document.getElementById("sum-geciken").textContent = fmtN(s.gecikenAd);
  document.getElementById("sum-m3").textContent = fmtN(s.toplamM3);
  document.getElementById("sum-verimlilik").textContent = s.oran.toFixed(1) + "%";
 // Progress Bar & Geciken Uyarısı Güncellemesi
const verimlilikEl = document.getElementById("sum-verimlilik");
const progressFill = document.getElementById("sum-progress-fill");

if (verimlilikEl && progressFill) {
  // Ekranda yazan "%91.9" metninden sayısal değeri güvenle alıyoruz
  const pctVal = parseFloat(verimlilikEl.textContent.replace("%", "").trim()) || 0;
  progressFill.style.width = Math.min(100, Math.max(0, pctVal)) + "%";
}

// Geciken Kartı Uyarısı
const gecikenEl = document.getElementById("sum-geciken");
if (gecikenEl) {
  const gecikenCount = parseInt(gecikenEl.textContent.trim()) || 0;
  const gecikenStatCard = gecikenEl.parentElement;
  if (gecikenStatCard) {
    if (gecikenCount > 0) {
      gecikenStatCard.classList.add("stat-alert-active");
    } else {
      gecikenStatCard.classList.remove("stat-alert-active");
    }
  }
}
  const todayDow = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }[new Date().getDay()];
  document.getElementById("dist").innerHTML =
    GUN_KISA.map((g, i) =>
      `<div class="day ${i === todayDow ? "today" : ""}"><span>${g}</span><b>${s.gunAd[i]}</b></div>`
    ).join("") +
    `<div class="day total"><span>Toplam</span><b>${fmtN(s.toplamAd)}</b></div>`;
}
function fInput(data, scope, field, type, cls, datalist, extra) {
  return `<input type="${type}" class="cell-input ${cls || ""}" data-scope="${scope}" data-field="${field}"
    value="${esc(String(data[field] ?? ""))}" ${datalist ? 'list="musteri-list"' : ""} ${extra || ""} />`;
}
function fSelect(data, scope, field, options) {
  return `<select class="cell-input" data-scope="${scope}" data-field="${field}">
    ${options.map(o => `<option value="${esc(o)}" ${String(data[field]) === o ? "selected" : ""}>${o === "" ? "-" : esc(o)}</option>`).join("")}
  </select>`;
}
function cellInputHtml(r, field) {
  const def = CELL_DEFS[field];
  if (field === "ekip") {
    const secenekler = [["", "—"], ...ekipSira.map(k => [k, (ekipler[k] && ekipler[k].aktif === false ? "⏸ " : "") + ekipAd(k)])];
    return `<select data-cid="${r.id}" data-cfield="ekip">
      ${secenekler.map(([v, l]) => `<option value="${esc(v)}" ${String(r.ekip || "") === v ? "selected" : ""}>${esc(l)}</option>`).join("")}
    </select>`;
  }
  if (def.kind === "select") {
    return `<select data-cid="${r.id}" data-cfield="${field}">
      ${def.options.map(o => `<option value="${esc(o)}" ${String(r[field]) === o ? "selected" : ""}>${o === "" ? "-" : esc(o)}</option>`).join("")}
    </select>`;
  }
  const t = def.kind === "date" ? "date" : def.kind === "number" ? "number" : "text";
  return `<input type="${t}" class="${def.w || ""}" data-cid="${r.id}" data-cfield="${field}"
    value="${esc(String(r[field] ?? ""))}" ${def.list ? 'list="musteri-list"' : ""} />`;
}
function tdHtml(r, field, extraCls, viewFn) {
  const def = CELL_DEFS[field];
  const content = viewFn(r);
  const editable = def && !r._arsiv;
  return `<td data-col="${field}" class="${extraCls || ""}${editable ? " editable" : ""}"${editable ? ` data-field="${field}"` : ""}>${content}</td>`;
}
function planlananView(x) {
  let html = formatDate(x.planlananTarih);
  const b = gecikmeBilgi(x);
  if (b.gun > 0) {
    html += `<div class="late-badge">⚠ ${b.gun} gün gecikti`;
    if (b.neden) html += ` <span class="late-cause">· ${esc(b.neden)}</span>`;
    html += ` <button class="cause-btn" data-cause="${x.id}" title="Gecikme nedeni seç/değiştir">📌</button></div>`;
  } else if (x.gecikmeNedeni) {
    /* Gecikme geçmişte kalmış olsa bile (reel plan ileri çekilmiş) girilen not görünür */
    html += `<div class="late-cause">📌 ${esc(x.gecikmeNedeni)}`;
    html += ` <button class="cause-btn" data-cause="${x.id}" title="Gecikme nedeni seç/değiştir">✏️</button></div>`;
  }
  return html;
}
  /* Gerçekleşen tarih: otomatik yazılır, elle düzenlenmez */
/* Gerçekleşen: tarih + kronometre saat bilgisi */
function gerceklesenView(x) {
  let html = formatDate(x.gerceklesenTarih);
  if (x.durum === "Yükleniyor" && x.loadingStartedAt) {
    /* Yükleniyor: tarih çizgisi yerine başlangıç saati */
    html = `<span style="color:var(--amber);font-weight:600;font-size:10.5px">⏱ ${fmtTime(x.loadingStartedAt)}'da başladı</span>`;
  } else if (x.durum === "Yükleme Tamamlandı" && x.loadingStartedAt && x.loadingEndedAt) {
    html += `<div class="muted" style="font-size:9.5px">Baş:${fmtTime(x.loadingStartedAt)} - Bitiş:${fmtTime(x.loadingEndedAt)}</div>`;
  } else if (x.durum === "Yükleme Tamamlandı") {
    /* Kronometre verisi yoksa eski davranış */
    html += `<div class="muted" style="font-size:9.5px">otomatik</div>`;
  }
  return html;
}
function formRowHtml(d, scope, rowClass, saveAction, cancelAction) {
  return `<tr class="${rowClass}">
    <td class="center"><input type="checkbox" class="selbox" data-sel disabled /></td>
    <td data-col="musteri">${fInput(d, scope, "musteri", "text", "w-musteri", true)}</td>
    <td data-col="blm">${fSelect(d, scope, "blm", BLMS)}</td>
    <td data-col="kategori">${fInput(d, scope, "kategori", "text", "w-kategori")}</td>
    <td data-col="sevkiyatTipi">${fSelect(d, scope, "sevkiyatTipi", TIPLER)}</td>
    <td data-col="ad">${fInput(d, scope, "ad", "number", "w-num")}</td>
    <td data-col="planlananTarih">${fInput(d, scope, "planlananTarih", "date", "w-date")}</td>
    <td data-col="hafta" class="muted center">auto</td>
    <td data-col="ay" class="muted">auto</td>
    <td data-col="reelPlan">${fInput(d, scope, "reelPlan", "date", "w-date")}</td>
    <td data-col="gerceklesenTarih" class="muted">otomatik</td>
    <td data-col="durum">${fSelect(d, scope, "durum", DURUMLAR)}</td>
    <td data-col="sure" class="center"><span class="sure-txt">-</span></td>
    <td data-col="ekip" class="muted">-</td>
    <td data-col="aciklama">${fInput(d, scope, "aciklama", "text", "w-aciklama")}</td>
    <td data-col="araciGeldi">${fSelect(d, scope, "araciGeldi", GELDI)}</td>
    <td data-col="status" class="center st-cell">${durumIcon(d.durum)}</td>
    <td data-col="prsM3">${fInput(d, scope, "prsM3", "number", "w-num")}</td>
    <td data-col="m3">${fInput(d, scope, "m3", "number", "w-num", false, 'readonly tabindex="-1"')}</td>
    <td data-col="createdBy" class="muted">${esc(shortUser(d.createdBy))}</td>
    <td class="nowrap">
      <button class="icon-btn" data-action="${saveAction}" title="Kaydet">✔</button>
      <button class="icon-btn" data-action="${cancelAction}" title="İptal">✖</button>
    </td>
  </tr>`;
}
function rowHtml(r) {
  const dt = parseLocalDate(r.reelPlan || r.planlananTarih); /* hafta/ay reel plandan */
  const isToday = gecikmeTarihi(r) === todayISO();
  const isOvertime = r.durum === "Yükleniyor" && sureBilgi(r).asim;
    let rowCls = isOvertime ? "overtime" : (r.araciGeldi === "GELDİ" ? "arac-geldi" : (isToday ? "today-row" : ""));
  if (r._arsiv) rowCls += " arsiv-row";
  const cmtN = Array.isArray(r.comments) ? r.comments.length : 0;
  const isSel = selectedIds.has(r.id);
  return `<tr class="row ${rowCls}" data-rowid="${r.id}">
    <td class="center"><input type="checkbox" class="selbox" ${r._arsiv ? "disabled" : `data-sel="${r.id}"`} ${!r._arsiv && isSel ? "checked" : ""} /></td>
    ${tdHtml(r, "musteri", "strong", x => `<span class="musteri-chip" data-mchip="${r.id}" title="Müşteri kartını aç">${esc(x.musteri)}</span>`)}
    ${tdHtml(r, "blm", "", x => esc(x.blm))}
    ${tdHtml(r, "kategori", "", x => esc(x.kategori))}
    ${tdHtml(r, "sevkiyatTipi", "", x => esc(x.sevkiyatTipi))}
    ${tdHtml(r, "ad", "center", x => esc(x.ad))}
    ${tdHtml(r, "planlananTarih", "", planlananView)}
    <td data-col="hafta" class="center muted">${dt ? getISOWeek(dt) : "-"}</td>
    <td data-col="ay" class="muted">${dt ? AYLAR[dt.getMonth()] : "-"}</td>
    ${tdHtml(r, "reelPlan", "", x => formatDate(x.reelPlan))}
    <td data-col="gerceklesenTarih" class="muted" title="Durum Tamamlandı olunca otomatik yazılır">${gerceklesenView(r)}</td>
    ${tdHtml(r, "durum", "", x => `<span class="badge ${durumClass(x.durum)}">${esc(x.durum)}</span>`)}
    <td data-col="sure" class="center">${sureCellHtml(r)}</td>
          ${tdHtml(r, "ekip", "", x => {
      const chip = ekipChipHtml(x.ekip) || '<span class="muted">-</span>';
      const tpOn = x.toplamaBasTs && !x.toplamaBittiTs;
      const tpOk = !!x.toplamaBittiTs;
      const durumIco = tpOn ? ' <span title="Toplama sürüyor" style="color:var(--amber);font-weight:700">📦</span>'
        : tpOk ? ' <span title="Toplama bitti" style="color:var(--green)">✅</span>' : "";
      return `<div class="ekip-tp">${chip}${durumIco}
        <span class="tp-btns">
          <button class="icon-btn tp${tpOn ? " on" : ""}" data-tpact="basla" data-tpid="${x.id}"
            ${tpOn || tpOk ? "disabled" : ""} title="T.Başla — toplamayı başlat">▶</button>
          <button class="icon-btn tp${tpOk ? " on" : ""}" data-tpact="bitti" data-tpid="${x.id}"
            ${!tpOn || tpOk ? "disabled" : ""} title="T.Bitir — toplamayı bitir">⏹</button>
        </span></div>`;
    })}
    ${tdHtml(r, "aciklama", "truncate", x => `<span title="${esc(x.aciklama)}">${esc(x.aciklama) || "-"}</span>`)}
    ${tdHtml(r, "araciGeldi", r.araciGeldi === "GELDİ" ? "arac-gel-yes" : (r.araciGeldi === "HAYIR" ? "arac-gel-no" : ""), x => esc(x.araciGeldi) || "-")}
    <td data-col="status" class="center">${durumIcon(r.durum)}</td>
    ${tdHtml(r, "prsM3", "center", x => numOrDash(x.prsM3))}
    <td data-col="m3" class="center">${numOrDash(r.m3)}</td>
    <td data-col="createdBy" class="muted" title="${esc(r.createdBy || "")}">${esc(shortUser(r.createdBy))}${r.updatedAt ? `<div class="fresh-badge ${Date.now() - r.updatedAt < 3600000 ? "f-new" : Date.now() - r.updatedAt < 86400000 ? "f-day" : "f-old"}" title="Son güncelleme: ${fmtDateTime(r.updatedAt)}${r.updatedBy ? " · " + esc(shortUser(r.updatedBy)) : ""}">🔄 ${relTime(r.updatedAt)}</div>` : ""}</td>
       <td class="nowrap">${r._arsiv
      ? `<span title="Arşiv kaydı — salt okunur" style="font-size:14px">🗄️</span>`
      : `<button class="icon-btn cmt" data-action="comments" data-id="${r.id}" title="Yorumlar">💬${cmtN ? `<span class="cmt-n">${cmtN}</span>` : ""}</button>
      <button class="icon-btn dup" data-action="duplicate" data-id="${r.id}" title="Kopyala (bugüne planlar, durum sıfırlanır)">⧉</button>
      <button class="icon-btn del" data-action="delete" data-id="${r.id}" title="Sil">🗑️</button>`}</td>
  </tr>`;
}
function renderTable(list) {
  closeCellEditor();
  const tbody = document.getElementById("tbody");
  const cc = 20 - hiddenCols.size;
  let html = "";
  if (loading) html += `<tr><td colspan="${cc}" class="empty">Yükleniyor…</td></tr>`;
  if (addingInline) html += formRowHtml(inlineData, "inline", "inline-row", "save-inline", "cancel-inline");
  if (!loading && list.length === 0 && !addingInline) {
    html += `<tr><td colspan="${cc}" class="empty">Filtrelere uyan kayıt yok. 🎉</td></tr>`;
  }
  list.forEach(r => { html += rowHtml(r); });
  tbody.innerHTML = html;
  const all = document.getElementById("selAll");
  if (all) all.checked = list.length > 0 && list.every(r => r._arsiv || selectedIds.has(r.id));
  updateBulkBar();
}

 /* ============================================================
   🆕 YÜZEN HÜCRE DÜZENLEME KATMANI
   ============================================================ */
function openCellEditor(td, id, field) {
  closeCellEditor();
  const row = rows.find(r => r.id === id);
  if (!row) return;
  const def = CELL_DEFS[field];
  if (!def) return;
  editingCell = { id, field };
  const ed = document.getElementById("cellEditor");
  ed.innerHTML = cellInputHtml(row, field);
  ed.classList.remove("hidden");
  const wrap = td.closest(".table-wrap");
  const wrapRect = wrap.getBoundingClientRect();
  const tdRect = td.getBoundingClientRect();
  const top = tdRect.top + window.scrollY;
  let left = tdRect.left + window.scrollX - 2;
  ed.style.top = top + "px";
  ed.style.left = "0px";
  ed.style.visibility = "hidden";
  ed.style.display = "block";
  requestAnimationFrame(() => {
    const edW = ed.offsetWidth;
    const maxX = wrapRect.right + window.scrollX - edW - 4;
    ed.style.left = Math.min(left, Math.max(wrapRect.left + window.scrollX + 2, maxX)) + "px";
    ed.style.visibility = "visible";
    const inp = ed.querySelector("input, select");
    if (inp) {
      inp.focus();
      if (inp.type === "text") { try { inp.select(); } catch (e) {} }
    }
  });
}
function closeCellEditor() {
  const ed = document.getElementById("cellEditor");
  if (!ed.classList.contains("hidden")) {
    ed.classList.add("hidden");
    ed.innerHTML = "";
  }
}
async function commitCell() {
  const cur = editingCell;
  if (!cur || committing) return;
  committing = true;
  editingCell = null;
  const { id, field } = cur;
  const inp = document.querySelector("#cellEditor [data-cid]");
  const row = await freshRow(id);
  if (!inp || !row) { committing = false; closeCellEditor(); return; }
  let val = inp.value;
  if (field === "musteri") val = val.trim();
  if (field === "ekip" && val && !ekipler[val]) { committing = false; closeCellEditor(); render(); return; }
  if (field === "ad") val = Number(val) || 1;
  if (field === "prsM3") val = val === "" ? null : Number(val);
  if (field === "oncelikNo") val = val === "" ? null : Number(val);
  const changed = String(row[field] ?? "") !== String(val ?? "");
  if (!changed) { committing = false; closeCellEditor(); render(); return; }
  if (field === "musteri" || field === "planlananTarih" || field === "sevkiyatTipi") {
    const probe = { ...row, [field]: val };
    if (isDuplicate(probe, id) && !confirm(dupMsg(probe) + "\n(Güncelleme yine de yapılabilir)")) {
      committing = false; closeCellEditor(); render(); return;
    }
  }
  const updated = { ...row, [field]: val };
  /* Planlanan tarih girilince Reel Plan otomatik eşitlenir */
  if (field === "planlananTarih" && val) updated.reelPlan = val;
  if (["sevkiyatTipi", "ad", "prsM3"].includes(field)) {
    const m3 = hesaplaM3(updated.sevkiyatTipi, updated.ad, updated.prsM3);
    if (m3 !== null) updated.m3 = m3;
  }
  if (field === "durum") applyDurumSideEffects(updated);
  closeCellEditor();
  try {
    const saved = await apiUpdate(id, updated);
    rows = rows.map(r => r.id === id ? saved : r);
    setSaveError("");
    const parts = [`${FIELD_LABELS[field] || field}: "${dispVal(field, row[field])}" → "${dispVal(field, val)}"`];
    if (String(updated.m3 ?? "") !== String(row.m3 ?? "")) {
      parts.push(`${FIELD_LABELS.m3}: "${dispVal("m3", row.m3)}" → "${dispVal("m3", updated.m3)}"`);
    }
    if (field === "planlananTarih" && String(updated.reelPlan ?? "") !== String(row.reelPlan ?? "")) {
      parts.push(`${FIELD_LABELS.reelPlan}: "${dispVal("reelPlan", row.reelPlan)}" → "${dispVal("reelPlan", updated.reelPlan)}" (otomatik)`);
    }
    if (field === "durum" && val === "Yükleme Tamamlandı" && updated.loadingStartedAt && updated.loadingEndedAt) {
      parts.push(`yüklenme süresi: ${fmtSure(updated.loadingEndedAt - updated.loadingStartedAt)}`);
    }
    if (field === "durum" && val === "Yükleme Tamamlandı" && updated.gerceklesenTarih !== row.gerceklesenTarih) {
      parts.push(`gerçekleşen: ${formatDate(row.gerceklesenTarih)} → ${formatDate(updated.gerceklesenTarih)} (otomatik)`);
    }
    await apiLog("guncelleme", id, updated.musteri, parts.join(" · "));
  } catch (e) { setSaveError(e.message); }
  committing = false;
  render();
}
function cancelCell() {
  editingCell = null;
  closeCellEditor();
}

/* ================= Kolon gizle/göster ================= */
function applyHiddenCols() {
  ALL_COLS.forEach(([k]) => document.body.classList.toggle("hide-" + k, hiddenCols.has(k)));
}
function renderColMenu() {
  const menu = document.getElementById("colMenu");
  menu.innerHTML = ALL_COLS.map(([k, label]) =>
    `<label><input type="checkbox" data-colchk="${k}" ${hiddenCols.has(k) ? "" : "checked"} /><span>${esc(label)}</span></label>`
  ).join("") +
  `<div class="colmenu-actions"><button class="btn" id="btnColsReset" style="width:100%">Tümünü göster</button></div>`;
}
document.getElementById("btnCols").addEventListener("click", e => {
  e.stopPropagation();
  const menu = document.getElementById("colMenu");
  const btn = document.getElementById("btnCols");
  renderColMenu();
  menu.classList.toggle("hidden");
  if (!menu.classList.contains("hidden")) {
    menu.style.visibility = "hidden";
    menu.style.display = "block";
    requestAnimationFrame(() => {
      const r = btn.getBoundingClientRect();
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      let left = Math.min(r.right, window.innerWidth - mw - 8);
      left = Math.max(8, left);
      let top = r.bottom + 6;
      if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
      menu.style.left = left + "px";
      menu.style.top = top + "px";
      menu.style.visibility = "visible";
    });
  }
});
document.getElementById("colMenu").addEventListener("click", e => {
  e.stopPropagation();
  if (e.target.closest("#btnColsReset")) {
    hiddenCols.clear();
    savePrefs();
    applyHiddenCols();
    renderColMenu();
    render();
  }
});
document.getElementById("colMenu").addEventListener("change", e => {
  const cb = e.target.closest("input[data-colchk]");
  if (!cb) return;
  if (cb.checked) hiddenCols.delete(cb.dataset.colchk);
  else hiddenCols.add(cb.dataset.colchk);
  savePrefs();
  applyHiddenCols();
  render();
});

document.addEventListener("click", e => {
  if (!e.target.closest(".colmenu-wrap")) {
    document.getElementById("colMenu").classList.add("hidden");
  }
});

/* ================= Yetki kapısı ================= */
function gate(type, param) {
  if (!currentUser) {
    pendingAction = { type, param };
    showLogin("Bu işlem için giriş yapman gerekiyor — giriş sonrası otomatik devam edecek.");
    return;
  }
  const need = PERM_MAP[type];
  if (need && !hasPerm(need)) {
    alert(`Bu işlem için yetkiniz yok (${PERM_LABELS[need]}). Yöneticiniz Admin Panel'den yetki verebilir.`);
    return;
  }
  runAction({ type, param });
}
function runAction({ type, param }) {
  switch (type) {
    case "inline-add":  doInlineAdd(); break;
    case "form-add":    openModal(); break;
    case "import":      openImport(); break;
    case "save-inline": saveInline(); break;
    case "do-import":   doImport(); break;
    case "cell-edit":   openCellEditor(param.td, param.id, param.field); break;
    case "duplicate":   duplicateRow(param); break;
    case "comments":    openComments(param); break;    case "cause":       openCauseModal(param); break;
    case "sure-edit":   openSureEdit(param); break;
    case "edit-date":   changeDate(param.id, param.tarih); break;
    case "musteri-kart": openMusteriKart(param); break;
    case "qr-print":    openQrPrint(); break;
    case "islem-action": islemAction(param); break;
    case "delete":
      if (confirm("Bu kayıt veritabanından silinsin mi?")) deleteRow(param);
      break;
  }
}

/* ================= İşlemler ================= */
function doInlineAdd() {
  if (hiddenCols.has("musteri")) {
    hiddenCols.delete("musteri");
    savePrefs();
    applyHiddenCols();
  }
  inlineData = emptyRecord();
  addingInline = true;
  render();
}
async function saveInline() {
  if (!(inlineData.musteri || "").trim()) { alert("Müşteri adı zorunlu."); return; }
  if (isDuplicate(inlineData) && !confirm(dupMsg(inlineData))) return;
  try {
    applyDurumSideEffects(inlineData);
    const rec = await apiInsert(inlineData);
    addingInline = false; inlineData = null;
    rows = [rec, ...rows];
    setSaveError("");
    render();
    await apiLog("ekleme", rec.id, rec.musteri, `satır içi ekleme · ${rec.sevkiyatTipi} · AD: ${rec.ad}`);
  } catch (e) { setSaveError(e.message); }
}
async function duplicateRow(id) {
  const src = rows.find(r => r.id === id);
  if (!src) return;
  const rec = emptyRecord();
  rec.musteri = src.musteri;
  rec.blm = src.blm;
  rec.kategori = src.kategori;
  rec.sevkiyatTipi = src.sevkiyatTipi;
  rec.ad = src.ad;
  rec.planlananTarih = todayISO();
  rec.reelPlan = todayISO();
  rec.gerceklesenTarih = "";
  rec.durum = "Yükleme Bekliyor";
  rec.aciklama = src.aciklama || "";
  rec.araciGeldi = "";
  rec.prsM3 = src.prsM3 ?? "";
  const m3 = hesaplaM3(rec.sevkiyatTipi, rec.ad, rec.prsM3);
  rec.m3 = m3 !== null ? m3 : (src.m3 ?? "");
  rec.ekip = src.ekip || "";
  if (isDuplicate(rec) && !confirm(dupMsg(rec))) return;
  try {
    const saved = await apiInsert(rec);
    rows = [saved, ...rows];
    setSaveError("");
    setGuestInfo("ℹ️ Kayıt çoğaltıldı ve <b>bugüne</b> planlandı, durum sıfırlandı — tarihleri gerekirse hücreden güncelle.");
    render();
    await apiLog("cogaltma", saved.id, rec.musteri, `kaynak planlanan: ${formatDate(src.planlananTarih)} → bugün`);
  } catch (e) { setSaveError(e.message); }
}
async function deleteRow(id) {
  const src = rows.find(r => r.id === id);
  try {
    await apiDelete(id);
    rows = rows.filter(r => r.id !== id);
    setSaveError("");
    render();
    await apiLog("silme", id, src ? src.musteri : "",
      src ? `${src.sevkiyatTipi} · AD: ${src.ad} · planlanan: ${formatDate(src.planlananTarih)}` : "");
  } catch (e) { setSaveError(e.message); }
}

/* ================= 💬 Satır yorumları ================= */
function openComments(id) {
  currentCommentId = id;
  const row = rows.find(r => r.id === id);
  if (!row) return;
  document.getElementById("cmtWho").innerHTML =
    `<b>${esc(row.musteri)}</b> · ${esc(row.sevkiyatTipi)} · ${formatDate(row.planlananTarih)}`;
  renderCommentList();
  document.getElementById("cmtText").value = "";
  document.getElementById("commentModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("cmtText").focus(), 50);
}
function renderCommentList() {
  const row = rows.find(r => r.id === currentCommentId);
  const c = document.getElementById("cmtList");
  const list = (row && Array.isArray(row.comments)) ? [...row.comments].sort((a, b) => b.ts - a.ts) : [];
  if (!list.length) {
    c.innerHTML = `<p class="hint">Henüz yorum yok — ilkini ekle.</p>`;
    return;
  }
  c.innerHTML = list.map(cm => {
    const benim = currentUser && cm.user === currentUser.email;
    const yetki = currentUser && hasPerm("edit") && (isAdmin() || benim);
    return `
    <div class="cmt-item" data-cts="${cm.ts}">
      <div class="cmt-meta"><b>${esc(shortUser(cm.user))}</b> · ${fmtDateTime(cm.ts)}${cm.duzenlendi ? ` <span title="${cm.duzenleyen ? esc(shortUser(cm.duzenleyen)) + " · " : ""}${fmtDateTime(cm.duzenlendi)}">(düzenlendi)</span>` : ""}
        ${yetki ? `<span style="float:right">
          <button class="icon-btn" data-cedit="${cm.ts}" title="Düzenle">✏️</button>
          <button class="icon-btn del" data-cdel="${cm.ts}" title="Sil">🗑️</button>
        </span>` : ""}
      </div>
      <div class="cmt-text">${esc(cm.text)}</div>
    </div>`;
  }).join("");
}
async function commentAdd() {
  const ta = document.getElementById("cmtText");
  const text = ta.value.trim();
  if (!text || !currentCommentId) return;
  const row = await freshRow(currentCommentId);
  if (!row) return;
  const comments = (Array.isArray(row.comments) ? row.comments.slice() : []);
  comments.push({ ts: Date.now(), user: currentUser.email, text });
  try {
    const saved = await apiUpdate(row.id, { ...row, comments });
    rows = rows.map(r => r.id === row.id ? saved : r);
    ta.value = "";
    ta.focus();
    renderCommentList();
    const btn = document.querySelector(`#tbody button[data-action="comments"][data-id="${row.id}"]`);
    if (btn) btn.innerHTML = `💬<span class="cmt-n">${comments.length}</span>`;
    await apiLog("yorum", row.id, row.musteri, text.length > 80 ? text.slice(0, 80) + "…" : text);
  } catch (e) { setSaveError(e.message); }
}
document.getElementById("btnCmtAdd").addEventListener("click", commentAdd);
document.getElementById("cmtText").addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commentAdd();
});
document.getElementById("btnCmtClose").addEventListener("click", () => {
  document.getElementById("commentModal").classList.add("hidden");
});
document.getElementById("commentModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});

document.getElementById("cmtList").addEventListener("click", e => {
  const edBtn = e.target.closest("[data-cedit]");
  const delBtn = e.target.closest("[data-cdel]");
  if (edBtn) startCommentEdit(Number(edBtn.dataset.cedit));
  if (delBtn) commentDelete(Number(delBtn.dataset.cdel));
});

function startCommentEdit(ts) {
  const row = rows.find(r => r.id === currentCommentId);
  const cm = row && (row.comments || []).find(x => x.ts === ts);
  const item = document.querySelector(`#cmtList .cmt-item[data-cts="${ts}"]`);
  if (!row || !cm || !item) return;
  if (!isAdmin() && cm.user !== currentUser.email) {
    alert("Sadece kendi yorumlarını düzenleyebilirsin.");
    return;
  }
  item.innerHTML = `
    <textarea class="cmt-textarea" style="width:100%;min-height:60px;font-family:inherit;font-size:12.5px;padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)">${esc(cm.text)}</textarea>
    <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:6px">
      <button class="btn" data-ccancel>Vazgeç</button>
      <button class="btn primary" data-csave="${ts}">Kaydet</button>
    </div>`;
  const ta = item.querySelector("textarea");
  ta.focus();
  item.querySelector("[data-ccancel]").addEventListener("click", renderCommentList);
  item.querySelector("[data-csave]").addEventListener("click", () => commentEditSave(ts, ta.value.trim()));
}

async function commentEditSave(ts, yeniMetin) {
  if (!yeniMetin) { alert("Yorum boş olamaz."); return; }
  const row = await freshRow(currentCommentId);
  if (!row) return;
  const eski = (row.comments || []).find(cm => cm.ts === ts);
  if (!eski) return;
  const eskiTxt = eski.text;
  const comments = (row.comments || []).map(cm =>
    cm.ts === ts ? { ...cm, text: yeniMetin, duzenlendi: Date.now(), duzenleyen: currentUser.email } : cm
  );
  try {
    const saved = await apiUpdate(row.id, { ...row, comments });
    rows = rows.map(r => r.id === row.id ? saved : r);
    setSaveError("");
    renderCommentList();
    const kısalt = s => s.length > 60 ? s.slice(0, 60) + "…" : s;
    await apiLog("yorum-duzenleme", row.id, row.musteri,
      `"${kısalt(eskiTxt)}" → "${kısalt(yeniMetin)}"`);
    showToast("✅ Yorum güncellendi.");
  } catch (e) { setSaveError(e.message); }
}

async function commentDelete(ts) {
  const row = await freshRow(currentCommentId);
  if (!row) return;
  const cm = (row.comments || []).find(x => x.ts === ts);
  if (!cm) return;
  if (!isAdmin() && cm.user !== currentUser.email) {
    alert("Sadece kendi yorumlarını silebilirsin.");
    return;
  }
  if (!confirm(`Bu yorum silinsin mi?\n\n"${cm.text.slice(0, 80)}"`)) return;
  const comments = (row.comments || []).filter(x => x.ts !== ts);
  try {
    const saved = await apiUpdate(row.id, { ...row, comments });
    rows = rows.map(r => r.id === row.id ? saved : r);
    setSaveError("");
    renderCommentList();
    const btn = document.querySelector(`#tbody button[data-action="comments"][data-id="${row.id}"]`);
    if (btn) btn.innerHTML = `💬${comments.length ? `<span class="cmt-n">${comments.length}</span>` : ""}`;
    await apiLog("yorum-silme", row.id, row.musteri,
      `"${cm.text.length > 80 ? cm.text.slice(0, 80) + "…" : cm.text}" silindi`);
    showToast("🗑️ Yorum silindi.");
  } catch (e) { setSaveError(e.message); }
}

/* ================= ⏱️ Süre elle düzenleme ================= */
function openSureEdit(id) {
  const row = rows.find(r => r.id === id);
  if (!row) return;
  currentSureId = id;
  const standart = getSureDk(row);
  document.getElementById("sureEditWho").innerHTML =
    `<b>${esc(row.musteri)}</b> · ${esc(row.sevkiyatTipi)} · standart: ${standart} dk · durum: ${esc(row.durum)}${row.ekip ? ` · 👷 ${esc(ekipAd(row.ekip))}` : ""}`;
  const etkin = etkinSureMs(row);
  document.getElementById("sureEditBody").innerHTML = `
    <p class="hint">İki bağımsız süreç: <b>📦 T.</b> = toplama (statüden bağımsız — performans raporu bunu kullanır) · <b>⏱️ Y.</b> = statü kronometresi ("Yükleniyor"da çalışır, "Tamamlandı"da durur). İstenmeyen alanları <b>boş bırakıp</b> kaydedin — kayıt silinir. "Yükleniyor" iken Y.Bitiş girerseniz statü otomatik "Tamamlandı" olur.</p>
    <div class="form-grid">
      <label class="col-2"><span>📦 T. Başlangıç (boş = toplama kaydı yok)</span>
        <input type="datetime-local" id="sureTopBas" class="w-dt" value="${toLocalDT(row.toplamaBasTs)}" /></label>
      <label class="col-2"><span>📦 T. Bitiş (boş = hâlâ toplanıyor)</span>
        <input type="datetime-local" id="sureTopBitti" class="w-dt" value="${toLocalDT(row.toplamaBittiTs)}" /></label>
      <label class="col-2"><span>⏱️ Y. Başlangıç (boş = kronometre kaydı yok)</span>
        <input type="datetime-local" id="sureStart" class="w-dt" value="${toLocalDT(row.loadingStartedAt)}" /></label>
      <label class="col-2"><span>⏱️ Y. Bitiş (boş = hâlâ yüklemede / sürüyor)</span>
        <input type="datetime-local" id="sureEnd" class="w-dt" value="${toLocalDT(row.loadingEndedAt)}" /></label>
    </div>
    ${etkin > 0 ? `<p class="hint" style="margin-top:8px">🧮 Mevcut etkin süre: <b>${fmtSure(etkin)}</b>${row.toplamaBittiTs ? " (📦 toplamadan)" : " (⏱️ kronometreden)"}</p>` : ""}`;
  document.getElementById("sureEditModal").classList.remove("hidden");
}
document.getElementById("btnSureEditCancel").addEventListener("click", () => {
  document.getElementById("sureEditModal").classList.add("hidden");
});
document.getElementById("sureEditModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});
document.getElementById("btnSureEditSave").addEventListener("click", async () => {
  const row = rows.find(r => r.id === currentSureId);
  if (!row) return;
  const gv = id => { const el = document.getElementById(id); return el ? el.value : ""; };
  const sVal = gv("sureStart"), eVal = gv("sureEnd");
  const tbVal = gv("sureTopBas"), tVal = gv("sureTopBitti");
  const updated = { ...row };

  /* ⏱️ Y. alanları — statüden bağımsız düzenleme */
  if (sVal && eVal) {
    const start = new Date(sVal).getTime();
    const end = new Date(eVal).getTime();
    if (end < start) { alert("Y. bitiş, başlangıçtan önce olamaz."); return; }
    updated.loadingStartedAt = start;
    updated.loadingEndedAt = end;
    if (row.durum === "Yükleniyor") {
      updated.durum = "Yükleme Tamamlandı";
      updated.gerceklesenTarih = isoFromDate(new Date(end));
    }
  } else if (sVal && !eVal) {
    updated.loadingStartedAt = new Date(sVal).getTime();
    updated.loadingEndedAt = null;
  } else if (!sVal && eVal) {
    alert("Y. bitişi girdiniz ama Y. başlangıç boş — ikisini birlikte girin ya da ikisini boşaltın.");
    return;
  } else {
    updated.loadingStartedAt = null;
    updated.loadingEndedAt = null;
  }

  /* 📦 T. alanları — statüden bağımsız */
  if (tbVal && tVal) {
    const tbTs = new Date(tbVal).getTime();
    const tTs = new Date(tVal).getTime();
    if (tbTs > tTs) { alert("T. bitişi, T. başlangıcından önce olamaz."); return; }
    updated.toplamaBasTs = tbTs;
    updated.toplamaBittiTs = tTs;
  } else if (tbVal && !tVal) {
    updated.toplamaBasTs = new Date(tbVal).getTime();
    updated.toplamaBittiTs = null;
  } else if (!tbVal && tVal) {
    alert("T. bitişi girdiniz ama T. başlangıç boş — ikisini birlikte girin ya da ikisini boşaltın.");
    return;
  } else {
    updated.toplamaBasTs = null;
    updated.toplamaBittiTs = null;
  }

  try {
    const saved = await apiUpdate(row.id, updated);
    rows = rows.map(r => r.id === row.id ? saved : r);
    document.getElementById("sureEditModal").classList.add("hidden");
    setSaveError("");
    render();
    await apiLog("guncelleme", row.id, row.musteri,
      "süre elle düzeltildi" +
      (updated.toplamaBasTs ? ` · 📦 T: ${fmtDateTime(updated.toplamaBasTs)} → ${updated.toplamaBittiTs ? fmtDateTime(updated.toplamaBittiTs) : "sürüyor"}` : " · 📦 T: yok") +
      (updated.loadingStartedAt ? ` · ⏱️ Y: ${fmtDateTime(updated.loadingStartedAt)} → ${updated.loadingEndedAt ? fmtDateTime(updated.loadingEndedAt) : "sürüyor"}` : " · ⏱️ Y: yok") +
      ` · etkin: ${fmtSure(etkinSureMs(saved))}` +
      (row.durum === "Yükleniyor" && updated.durum === "Yükleme Tamamlandı" ? " · durum → Tamamlandı" : ""));
    showToast("✅ Süre güncellendi.");
  } catch (e) { setSaveError(e.message); }
});
/* ============================================================
   ⚠️ GECİKME NEDENİ SEÇİMİ
   ============================================================ */
function openCauseModal(id) {
  const row = rows.find(r => r.id === id);
  if (!row) return;
  const g = gecikmeBilgi(row).gun;
  if (g <= 0) { alert("Bu kayıt gecikmiş durumda değil — neden girebilmek için reel plan tarihi geçmişte olmalı."); return; }
  const neden = row.gecikmeNedeni || "";
  const items = GECIKME_NEDENLERI.map(n =>
    `<label class="check" style="margin-bottom:8px"><input type="radio" name="causeSel" value="${esc(n)}" ${neden === n ? "checked" : ""} /><span>${esc(n)}</span></label>`
  ).join("") +
  `<label class="check"><input type="radio" name="causeSel" value="__diger__" ${neden && !GECIKME_NEDENLERI.includes(neden) ? "checked" : ""} /><span>Diğer (özel metin)</span></label>
   <input type="text" id="causeCustom" class="hidden" placeholder="Neden yaz…" value="${neden && !GECIKME_NEDENLERI.includes(neden) ? esc(neden) : ""}" style="margin-top:8px;width:100%" />`;
  const modal = document.createElement("div");
  modal.className = "modal-bg";
  modal.style.zIndex = "75";
  modal.innerHTML = `<div class="modal">
    <h2>⚠️ Gecikme Nedeni</h2>
    <p class="hint"><b>${esc(row.musteri)}</b> · ${formatDate(gecikmeTarihi(row))} · ${g} gün gecikti</p>
    ${items}
    <div class="modal-actions">
      ${neden ? `<button class="btn" id="btnCauseDel">Nedeni Kaldır</button>` : ""}
      <button class="btn primary" id="btnCauseSave">Kaydet</button>
    </div>
  </div>`;
  modal.addEventListener("change", e => {
    if (e.target.name === "causeSel") {
      const custom = modal.querySelector("#causeCustom");
      custom.classList.toggle("hidden", e.target.value !== "__diger__");
    }
  });
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  modal.querySelector("#btnCauseSave").addEventListener("click", async () => {
    const sel = modal.querySelector("input[name='causeSel']:checked");
    if (!sel) { alert("Bir neden seç."); return; }
    let val = sel.value;
    if (val === "__diger__") {
      val = modal.querySelector("#causeCustom").value.trim();
      if (!val) { alert("Özel neden yaz."); return; }
    }
    try {
      const saved = await apiUpdate(row.id, { ...row, gecikmeNedeni: val });
      rows = rows.map(r => r.id === row.id ? saved : r);
      setSaveError("");
      render();
      modal.remove();
      await apiLog("guncelleme", row.id, row.musteri, `gecikme nedeni: ${val}`);
      showToast(`✅ Gecikme nedeni kaydedildi: ${esc(val)}`);
    } catch (e) { setSaveError(e.message); }
  });
  const delBtn = modal.querySelector("#btnCauseDel");
  if (delBtn) delBtn.addEventListener("click", async () => {
    try {
      const updated = { ...row };
      delete updated.gecikmeNedeni;
      const saved = await apiUpdate(row.id, updated);
      rows = rows.map(r => r.id === row.id ? saved : r);
      render();
      modal.remove();
      await apiLog("guncelleme", row.id, row.musteri, "gecikme nedeni kaldırıldı");
      showToast("🗑️ Neden kaldırıldı.");
    } catch (e) { setSaveError(e.message); }
  });
}
/* ================= 📅 Takvim görünümü ================= */
function openTakvim() {
  const d = new Date();
  kalY = d.getFullYear(); kalM = d.getMonth();
  document.getElementById("takvimModal").classList.remove("hidden");
  renderTakvim();
}
function renderTakvim() {
  document.getElementById("takvimLabel").textContent = `${AYLAR[kalM]} ${kalY}`;
  document.getElementById("takvimDow").innerHTML =
    GUN_KISA.map(g => `<div class="kal-dow">${g}</div>`).join("");
  const first = new Date(kalY, kalM, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(kalY, kalM + 1, 0).getDate();
  const today = todayISO();
  const byDate = new Map();
  rows.forEach(r => {
    const d = r.reelPlan || r.planlananTarih;
    if (!d) return;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(r);
  });
  let cells = "";
  for (let i = 0; i < offset; i++) cells += `<div class="kal-cell kal-blank"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${kalY}-${pad2(kalM + 1)}-${pad2(day)}`;
    const list = (byDate.get(iso) || []).sort((a, b) =>
      (DURUM_SIRA[a.durum] ?? 9) - (DURUM_SIRA[b.durum] ?? 9));
    const toplamAd = list.reduce((s, r) => s + adet(r), 0);
    const items = list.map(r => {
      const cls = r.durum === "Yükleme Tamamlandı" ? "kal-done" : r.durum === "Yükleniyor" ? "kal-load" : "kal-wait";
      return `<div class="kal-item ${cls}" draggable="true" data-kid="${r.id}"
        title="${esc(r.musteri)} · ${esc(r.sevkiyatTipi)} · AD ${esc(r.ad)} · ${esc(r.durum)}${r.oncelikNo ? " · ⭐" + esc(r.oncelikNo) : ""}">
        <span style="overflow:hidden;text-overflow:ellipsis">${esc(r.musteri)}</span>
        <span class="k-ad">×${esc(r.ad)}</span>
      </div>`;
    }).join("");
    cells += `<div class="kal-cell ${iso === today ? "kal-today" : ""}" data-kdate="${iso}">
      <div class="kal-date"><span>${day}</span>${toplamAd ? `<b>${toplamAd} yükleme</b>` : ""}</div>
      <div class="kal-items">${items}</div>
    </div>`;
  }
  const totalCells = offset + daysInMonth;
  const trail = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < trail; i++) cells += `<div class="kal-cell kal-blank"></div>`;
  document.getElementById("takvimGrid").innerHTML = cells;
}
document.getElementById("kalPrev").addEventListener("click", () => { kalM--; if (kalM < 0) { kalM = 11; kalY--; } renderTakvim(); });
document.getElementById("kalNext").addEventListener("click", () => { kalM++; if (kalM > 11) { kalM = 0; kalY++; } renderTakvim(); });
document.getElementById("kalToday").addEventListener("click", () => { const d = new Date(); kalY = d.getFullYear(); kalM = d.getMonth(); renderTakvim(); });
document.getElementById("btnCloseTakvim").addEventListener("click", () => {
  document.getElementById("takvimModal").classList.add("hidden");
});
document.getElementById("takvimModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});
const takvimGrid = document.getElementById("takvimGrid");
takvimGrid.addEventListener("dragstart", e => {
  const chip = e.target.closest(".kal-item[data-kid]");
  if (chip) e.dataTransfer.setData("text/plain", chip.dataset.kid);
});
takvimGrid.addEventListener("dragover", e => {
  const cell = e.target.closest(".kal-cell[data-kdate]");
  if (cell) { e.preventDefault(); cell.classList.add("kal-over"); }
});
takvimGrid.addEventListener("dragleave", e => {
  const cell = e.target.closest(".kal-cell[data-kdate]");
  if (cell) cell.classList.remove("kal-over");
});
takvimGrid.addEventListener("drop", e => {
  const cell = e.target.closest(".kal-cell[data-kdate]");
  if (!cell) return;
  e.preventDefault();
  cell.classList.remove("kal-over");
  const id = e.dataTransfer.getData("text/plain");
  const row = rows.find(r => r.id === id);
  if (!row || row.planlananTarih === cell.dataset.kdate) return;
  gate("edit-date", { id, tarih: cell.dataset.kdate });
});
async function changeDate(id, tarih) {
  const row = rows.find(r => r.id === id);
  if (!row) return;
  /* Takvim sürüklemesinde planlanan + reel plan birlikte güncellenir */
  const updated = { ...row, planlananTarih: tarih, reelPlan: tarih };
  try {
    const saved = await apiUpdate(id, updated);
    rows = rows.map(r => r.id === id ? saved : r);
    setSaveError("");
    render();
    renderTakvim();
    await apiLog("guncelleme", id, row.musteri, `planlanan+reel: ${formatDate(row.planlananTarih)} → ${formatDate(tarih)} (takvim sürükle-bırak)`);
    showToast(`📅 ${esc(row.musteri)} → ${formatDate(tarih)}`);
  } catch (e) { setSaveError(e.message); }
}

/* ============================================================
   👤 MÜŞTERİ KARTI
   ============================================================ */
async function openMusteriKart(id) {
  const row = rows.find(r => r.id === id);
  if (!row || !row.musteri) return;
  const name = row.musteri;
  /* Kart TÜM geçmişi kapsar: aktif + arşiv (arşiv bellekte yoksa arka planda çekilir) */
  if (!Array.isArray(arsivCache)) {
    try { arsivCache = await fetchArsiv(); } catch (e) { arsivCache = []; }
  }
  const ids = new Set(rows.map(r => r.id));
  const havuz = rows.concat(arsivCache.filter(r => !ids.has(r.id)).map(r => ({ ...r, _arsiv: true })));
  const all = enriched(havuz).filter(r => (r.musteri || "").trim().toLowerCase() === name.trim().toLowerCase());
  const arsivN = all.filter(r => r._arsiv).length;
  const toplamAd = all.reduce((s, r) => s + adet(r), 0);
  const toplamM3 = all.reduce((s, r) => s + (Number(r.m3) || 0), 0);
  const tamam = all.filter(r => r.durum === "Yükleme Tamamlandı");
  const tamamAd = tamam.reduce((s, r) => s + adet(r), 0);
  /* Geciken sayımı: tamamlananlarda kayıtlı snapshot (gecikmeSon) da dahil */
  const geciken = all.filter(r => gecikmeBilgi(r).gun > 0);
  const az = sapmaAnalizi(all);
  const musSapma = az ? az.musteri.get(name) : null;
  const son5 = [...all].sort((a, b) => tarihCmp(b.planlananTarih, a.planlananTarih)).slice(0, 5);
  const sapmaHtml = musSapma
    ? `<div class="kpi ${musSapma.toplam / musSapma.n > 0 ? "c-red" : "c-green"}"><div class="kpi-head">🗓️ Ortalama sapma</div><div class="kpi-val" style="font-size:20px">${fmtSapma(musSapma.toplam / musSapma.n)} gün</div><div class="kpi-sub">${musSapma.n} tamamlanan · zamanında %${(musSapma.zamaninda / musSapma.n * 100).toFixed(0)}</div></div>`
    : `<div class="kpi c-amber"><div class="kpi-head">🗓️ Ortalama sapma</div><div class="kpi-val" style="font-size:20px">—</div><div class="kpi-sub">tamamlanan kayıt yok</div></div>`;
  const kpiHtml = `<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="kpi c-primary"><div class="kpi-head">📦 Toplam</div><div class="kpi-val">${fmtN(toplamAd)}</div><div class="kpi-sub">yükleme · ${fmtN(toplamM3)} m³ · ${all.length} kayıt${arsivN ? ` · 🗄️ ${arsivN} arşiv` : ""}</div></div>
    <div class="kpi c-green"><div class="kpi-head">✅ Tamamlanan</div><div class="kpi-val">${fmtN(tamamAd)}</div><div class="kpi-sub">%${toplamAd ? (tamamAd / toplamAd * 100).toFixed(1) : "0.0"} · ${geciken.length} geciken kayıt</div></div>
    ${sapmaHtml}
  </div>`;
  const sonHtml = son5.length ? `<div class="rpt"><h3>🕘 Son 5 sevkiyat</h3><div class="table-wrap"><table>
    <thead><tr><th>Planlanan</th><th>Tip</th><th>AD</th><th>Durum</th><th>Gerçekleşen</th></tr></thead>
    <tbody>${son5.map(r => `<tr>
      <td>${formatDate(r.planlananTarih)}</td>
      <td>${r._arsiv ? "🗄️ " : ""}${esc(r.sevkiyatTipi)}</td>
      <td class="center">${esc(r.ad)}</td>
      <td><span class="badge ${durumClass(r.durum)}">${esc(r.durum)}</span></td>
      <td>${formatDate(r.gerceklesenTarih)}</td>
    </tr>`).join("")}</tbody>
  </table></div></div>` : "";
  const modal = document.createElement("div");
  modal.className = "modal-bg";
  modal.style.zIndex = "75";
  modal.innerHTML = `<div class="modal wide">
    <h2>👤 ${esc(name)} <span style="font-size:11px;font-weight:500;color:var(--muted)">· tüm geçmiş (aktif + arşiv)</span></h2>
    ${kpiHtml}${sonHtml}
    <div class="modal-actions"><button class="btn primary" id="btnMKClose">Kapat</button></div>
  </div>`;
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  modal.querySelector("#btnMKClose").addEventListener("click", () => modal.remove());
}
  /* ============================================================
   ⚙️ TOPLU DÜZENLEME
   ============================================================ */
function updateBulkBar() {
  const bar = document.getElementById("bulkBar");
  if (!selectedIds.size) { bar.classList.add("hidden"); return; }
  document.getElementById("bulkCount").textContent = `${selectedIds.size} kayıt seçili`;
  bar.classList.remove("hidden");
}
document.getElementById("btnBulkCancel").addEventListener("click", () => {
  selectedIds.clear();
  render();
});
document.getElementById("btnBulkApply").addEventListener("click", async () => {
  if (!selectedIds.size) return;
  const yeniTarih = document.getElementById("bulkDate").value;
  const yeniDurum = document.getElementById("bulkDurum").value;
  if (!yeniTarih && !yeniDurum) { alert("Tarih veya durum seç."); return; }
  const secili = rows.filter(r => selectedIds.has(r.id));
  const detay = secili.map(r => `${r.musteri}`).join(", ");
  const notlar = [];
  if (yeniTarih) notlar.push(`planlanan + reel plan → ${formatDate(yeniTarih)}`);
  if (yeniDurum) notlar.push(`durum → ${yeniDurum}`);
  if (!confirm(`${secili.length} kayıt güncellenecek:\n${detay}\n\n${notlar.join(" · ")}\n\nOnaylıyor musun?`)) return;
  const btn = document.getElementById("btnBulkApply");
  btn.disabled = true; btn.textContent = "Uygulanıyor…";
  try {
    let done = 0;
    for (const r of secili) {
      const updated = { ...r };
      if (yeniTarih) { updated.planlananTarih = yeniTarih; updated.reelPlan = yeniTarih; }
      const eskiDurum = updated.durum;
      if (yeniDurum) updated.durum = yeniDurum;
      if (yeniDurum && yeniDurum !== eskiDurum) applyDurumSideEffects(updated);
      const saved = await apiUpdate(r.id, updated);
      rows = rows.map(x => x.id === r.id ? saved : x);
      done++;
    }
    await apiLog("guncelleme", "", secili.map(r => r.musteri).join(", "),
      `⚙️ toplu düzenleme (${done} kayıt): ${notlar.join(" · ")}`);
    selectedIds.clear();
    setSaveError("");
    render();
    showToast(`✅ ${done} kayıt güncellendi.`);
  } catch (e) {
    setSaveError(e.message);
    alert("Toplu güncelleme hatası: " + e.message);
  }
  btn.disabled = false; btn.textContent = "Uygula";
});
/* ================= ⚙️ TOPLU DÜZENLEME ================= */
function updateBulkBar() {
  const bar = document.getElementById("bulkBar");
  if (!selectedIds.size) { bar.classList.add("hidden"); return; }
  document.getElementById("bulkCount").textContent = `${selectedIds.size} kayıt seçili`;
  bar.classList.remove("hidden");
}
document.getElementById("btnBulkCancel").addEventListener("click", () => {
  selectedIds.clear();
  render();
});
document.getElementById("btnBulkApply").addEventListener("click", async () => {
  if (!selectedIds.size) return;
  const yeniTarih = document.getElementById("bulkDate").value;
  const yeniDurum = document.getElementById("bulkDurum").value;
  if (!yeniTarih && !yeniDurum) { alert("Tarih veya durum seç."); return; }
  const secili = rows.filter(r => selectedIds.has(r.id));
  const detay = secili.map(r => `${r.musteri}`).join(", ");
  const notlar = [];
  if (yeniTarih) notlar.push(`planlanan + reel plan → ${formatDate(yeniTarih)}`);
  if (yeniDurum) notlar.push(`durum → ${yeniDurum}`);
  if (!confirm(`${secili.length} kayıt güncellenecek:\n${detay}\n\n${notlar.join(" · ")}\n\nOnaylıyor musun?`)) return;
  const btn = document.getElementById("btnBulkApply");
  btn.disabled = true; btn.textContent = "Uygulanıyor…";
  try {
    let done = 0;
    for (const r of secili) {
      const updated = { ...r };
      if (yeniTarih) { updated.planlananTarih = yeniTarih; updated.reelPlan = yeniTarih; }
      const eskiDurum = updated.durum;
      if (yeniDurum) updated.durum = yeniDurum;
      if (yeniDurum && yeniDurum !== eskiDurum) applyDurumSideEffects(updated);
      const saved = await apiUpdate(r.id, updated);
      rows = rows.map(x => x.id === r.id ? saved : x);
      done++;
    }
    await apiLog("guncelleme", "", secili.map(r => r.musteri).join(", "),
      `⚙️ toplu düzenleme (${done} kayıt): ${notlar.join(" · ")}`);
    selectedIds.clear();
    setSaveError("");
    render();
    showToast(`✅ ${done} kayıt güncellendi.`);
  } catch (e) {
    setSaveError(e.message);
    alert("Toplu güncelleme hatası: " + e.message);
  }
  btn.disabled = false; btn.textContent = "Uygula";
});
