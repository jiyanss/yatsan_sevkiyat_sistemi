/* ================= Firebase yapılandırması ================= */
const FIREBASE_DB_URL = "https://sevkiyat-app-default-rtdb.europe-west1.firebasedatabase.app".replace(/\/+$/, "");
const FIREBASE_API_KEY = "AIzaSyAagmdq0N2TG4IQ7noDFL6xQh4-ps-QrgI";
const NODE = "sevkiyat";
const HIST_NODE = "sevkiyat_history";
const USERS_NODE = "sevkiyat_users";
const SURE_NODE = "sevkiyat_suresi";
const YEDEK_NODE = "sevkiyat_yedek";
const ARSIV_NODE = "sevkiyat_arsiv";
const YEDEK_SAKLAMA_GUN = 14;
const QUIZ_NODE = "sevkiyat_quiz";
const QUIZ_SCORES_NODE = "sevkiyat_quiz_scores";
const QUIZ_GAMES_NODE = "sevkiyat_quiz_oyunlar";
const QUIZ_GUEST_KEY = "sevkiyat_quiz_guest";

/* ============================================================
   ROLLER — ADMİN PANELİNDEN YÖNETİLİR
   ============================================================ */
const ADMIN_EMAILS = [
  "admin@yatsan.com"
  /* Bootstrap admin eklemek için: , "baska@yatsan.com" */
];
const PERM_LABELS = { add: "Ekleme", edit: "Düzenleme", duplicate: "Çoğaltma", del: "Silme", imp: "Excel Yükleme" };
const PERM_MAP = {
  "inline-add": "add", "form-add": "add", "save-inline": "add",
  "cell-edit": "edit", "sure-edit": "edit", "edit-date": "edit", "comment": "edit", "cause": "edit",
  "duplicate": "duplicate",
  "delete": "del",
  "import": "imp", "do-import": "imp"
};
const DEFAULT_PERMS = { add: true, edit: true, duplicate: true, del: false, imp: false };
const IDLE_MS = 60 * 60 * 1000;

window.addEventListener("error", e => {
  const el = document.getElementById("saveError");
  if (el) { el.textContent = "⚠️ Kod hatası: " + e.message; el.classList.remove("hidden"); }
});

/* ================= Sabitler ================= */
const AYLAR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const GUNLER = ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"];
const GUN_KISA = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
const DURUMLAR = ["Yükleme Bekliyor", "Yükleniyor", "Yükleme Tamamlandı"];
const BLMS = ["EXPORT-1","EXPORT-2","EXPORT-3"];
const TIPLER = ["KOMPLE TIR","PARSIYEL TIR","40 HC","20 DC"];
const GELDI = ["", "GELDİ", "HAYIR"];
const GECIKME_NEDENLERI = ["Araç yok", "Evrak/Gümrük", "Üretim gecikmesi", "Müşteri iptali", "Diğer"];
const M3_CARPAN = { "KOMPLE TIR": 90, "40 HC": 70, "20 DC": 35 };
const DURUM_SIRA = { "Yükleniyor": 0, "Yükleme Bekliyor": 1, "Yükleme Tamamlandı": 2 };
const SORTABLE = { musteri:1, blm:1, kategori:1, sevkiyatTipi:1, ad:1, planlananTarih:1,
  hafta:1, ay:1, reelPlan:1, gerceklesenTarih:1, durum:1, ekip:1, prsM3:1, m3:1, createdBy:1 };

/* Tablo kolonları — BAŞLIK ve SATIRLAR bu tek kaynaktan üretilir (hizalama garantisi) */
const ALL_COLS = [
  ["musteri","Müşteri"],["blm","BLM"],["kategori","Kategori"],["sevkiyatTipi","Sevkiyat Tipi"],
  ["ad","AD"],["planlananTarih","Planlanan Tarih"],["hafta","Hafta"],["ay","Ay"],
  ["reelPlan","Reel Plan"],["gerceklesenTarih","Gerçekleşen"],["durum","Durum"],
  ["sure","Süre"],["ekip","Ekip"],
  ["aciklama","Açıklama"],["araciGeldi","Aracı Geldi"],["status","Status"],
  ["prsM3","PRS M3"],["m3","M3"],["createdBy","Ekleyen"]
];

const CELL_DEFS = {
  musteri:          { kind: "text",   w: "w-musteri", list: true },
  blm:              { kind: "select", options: BLMS },
  kategori:         { kind: "text",   w: "w-kategori" },
  sevkiyatTipi:     { kind: "select", options: TIPLER },
  ad:               { kind: "number", w: "w-num" },
  planlananTarih:   { kind: "date",   w: "w-date" },
  reelPlan:         { kind: "date",   w: "w-date" },
  /* gerceklesenTarih elle düzenlenmez — durum değişince otomatik yazılır */
  durum:            { kind: "select", options: DURUMLAR },
  ekip:             { kind: "ekip" },
  aciklama:         { kind: "text",   w: "w-aciklama" },
  araciGeldi:       { kind: "select", options: GELDI },
  prsM3:            { kind: "number", w: "w-num" },
};
const FIELD_LABELS = {
  musteri: "Müşteri", blm: "BLM", kategori: "Kategori", sevkiyatTipi: "Tip",
  ad: "AD", planlananTarih: "Planlanan", reelPlan: "Reel Plan",
  gerceklesenTarih: "Gerçekleşen", durum: "Durum", aciklama: "Açıklama",
  araciGeldi: "Aracı", prsM3: "PRS M3", m3: "M3", ekip: "Ekip",
};
const ACTION_META = {
  "ekleme":     { label: "Kayıt eklendi",   dot: "add" },
  "guncelleme": { label: "Güncellendi",     dot: "edit" },
  "silme":      { label: "Silindi",         dot: "del" },
  "cogaltma":   { label: "Çoğaltıldı",      dot: "dup" },
  "excel":      { label: "Excel yükleme",   dot: "excel" },
  "yetki":      { label: "Yetki değişti",   dot: "excel" },
  "yorum":      { label: "Yorum eklendi",   dot: "edit" },
  "yedek":      { label: "Otomatik yedek",  dot: "dup" },
  "yorum-duzenleme": { label: "Yorum düzenlendi", dot: "edit" },
  "yorum-silme":     { label: "Yorum silindi",     dot: "del" }
};

/* ================= Yardımcılar ================= */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function numOrDash(v) { return (v !== null && v !== undefined && v !== "") ? v : "-"; }
function pad2(n) { return String(n).padStart(2, "0"); }
function fmtN(n) { return (Math.round(n * 100) / 100).toLocaleString("tr-TR"); }
function adet(r) { return Number(r.ad) || 0; }
function shortUser(e) { return e ? String(e).split("@")[0] : "-"; }
function fmtDateTime(ts) {
  const d = new Date(ts);
  return `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function relTime(ts) {
  const ms = Date.now() - ts;
  if (ms < 60000) return "şimdi";
  const dk = Math.floor(ms / 60000);
  if (dk < 60) return `${dk} dk önce`;
  const h = Math.floor(dk / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.floor(h / 24)} gün önce`;
}
function fmtSapma(n) { return (n > 0 ? "+" : "") + (Math.round(n * 10) / 10).toLocaleString("tr-TR"); }
function fmtSure(ms) {
  const dk = Math.floor(ms / 60000);
  const h = Math.floor(dk / 60), m = dk % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}
function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
/* Araç durumu: GELDİ işaretliyse Geldi, boş/HAYIR ise Gelmedi */
function aracDurumHtml(r) {
  return r.araciGeldi === "GELDİ"
    ? `<span style="color:#34d399;font-weight:700">Araç Durumu: Geldi</span>`
    : `<span style="color:#fbbf24;font-weight:700">Araç Durumu: Gelmedi</span>`;
}
function toLocalDT(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function getISOWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}
function parseLocalDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function formatDate(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
  /* Depo ekranı tarihi: reel plan varsa o, yoksa planlanan tarih */
function depoTarih(r) {
  return r.reelPlan || r.planlananTarih || "";
}
function isoFromDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
/* Operasyonel tarih: reel plan (yoksa planlanan) — filtre, bugün kontrolü, takvim ve gruplama için */
function gecikmeTarihi(r) {
  return r.reelPlan || r.planlananTarih || "";
}

/* Gecikme görüntüsü PLANLANAN tarafa göre: reel plan ileri çekilse bile
   "X gün gecikti + neden" bilgisi kaybolmasın diye bilinçli olarak böyle. */
function gecikmeGunu(r) {
  const t = r.planlananTarih || "";
  if (!t || r.durum === "Yükleme Tamamlandı") return 0;
  const today = todayISO();
  if (t >= today) return 0;
  return Math.round((parseLocalDate(today) - parseLocalDate(t)) / 86400000);
}

/* Durumdan bağımsız ham gecikme (snapshot için) */
function gecikmeGunRaw(r) {
  const t = r.planlananTarih || "";
  if (!t) return 0;
  const today = todayISO();
  if (t >= today) return 0;
  return Math.round((parseLocalDate(today) - parseLocalDate(t)) / 86400000);
}

/* Görüntüleme: aktifken canlı hesap, tamamlandıysa kayıtlı snapshot */
function gecikmeBilgi(r) {
  if (r.durum === "Yükleme Tamamlandı") {
    return { gun: Number(r.gecikmeSon) || 0, neden: r.gecikmeNedeni || "" };
  }
  return { gun: gecikmeGunu(r), neden: r.gecikmeNedeni || "" };
}
function durumClass(d) {
  if (d === "Yükleme Tamamlandı") return "done";
  if (d === "Yükleniyor") return "loading";
  return "waiting";
}
function durumIcon(d) {
  if (d === "Yükleme Tamamlandı") return '<span class="st-ok">✔</span>';
  if (d === "Yükleniyor") return '<span class="st-load">⟳</span>';
  return '<span class="st-wait">?</span>';
}
function emptyRecord() {
  return {
    musteri: "", blm: "EXPORT-1", kategori: "PLANLI", sevkiyatTipi: "KOMPLE TIR",
    ad: 1, planlananTarih: todayISO(), reelPlan: todayISO(), gerceklesenTarih: "",
    durum: "Yükleme Bekliyor", aciklama: "", araciGeldi: "", prsM3: "", m3: 90,
    comments: []
  };
}
function hesaplaM3(tip, ad, prsM3) {
  if (tip === "PARSIYEL TIR") return Number(prsM3) || 0;
  const carpan = M3_CARPAN[tip];
  if (carpan === undefined) return null;
  return (Number(ad) || 0) * carpan;
}
/* BLM değerini standart forma çevir: "export1", "EXPORT 2", "Export-3" → EXPORT-1/2/3 */
function normalizeBlm(v) {
  const s = String(v || "").toUpperCase().replace(/[\s\-_]/g, "");
  const m = s.match(/^EXPORT(\d+)$/);
  if (m && +m[1] >= 1 && +m[1] <= 3) return `EXPORT-${m[1]}`;
  const t = String(v || "").trim();
  return BLMS.includes(t) ? t : null;
}
function tarihCmp(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}
/* Hücre değerini log/metin gösterimine uygun formatla */
function dispVal(field, val) {
  const def = CELL_DEFS[field];
  if (def && def.kind === "date") return formatDate(val);
  return String(val ?? "") || "-";
}

/* ⚠️ Yinelenen kayıt kontrolü */
function isDuplicate(rec, excludeId) {
  const m = (rec.musteri || "").trim().toLowerCase();
  if (!m) return false;
  return rows.some(r =>
    r.id !== excludeId &&
    (r.musteri || "").trim().toLowerCase() === m &&
    r.planlananTarih === rec.planlananTarih &&
    r.sevkiyatTipi === rec.sevkiyatTipi
  );
}
function dupMsg(rec) {
  return `"${rec.musteri}" · ${formatDate(rec.planlananTarih)} · ${rec.sevkiyatTipi} kombinasyonu zaten mevcut.\nYine de ekleyelim mi?`;
}

/* ================= Kolon sıralama (kullanıcı) ================= */
let sortCol = null;
let sortDir = "desc";
function cmpVals(x, y, col) {
  const vx = x[col], vy = y[col];
  switch (col) {
    case "ad": case "prsM3": case "m3": case "hafta":
      return (Number(vx) || 0) - (Number(vy) || 0);
    case "ay":
      return AYLAR.indexOf(vx) - AYLAR.indexOf(vy);
    case "durum":
      return (DURUM_SIRA[vx] ?? 9) - (DURUM_SIRA[vy] ?? 9);
    case "planlananTarih": case "reelPlan": case "gerceklesenTarih":
      return tarihCmp(vx, vy);
    default:
      return String(vx || "").localeCompare(String(vy || ""), "tr");
  }
}
function colEmpty(r, col) {
  const v = r[col];
  return v === undefined || v === null || v === "" || v === "-";
}
/* Kolon sıralaması: eşitlik durumunda varsayılan kriterlerle tie-break —
   böylece bir kolona göre sıralarken bile gruplar içi düzen karışık görünmez */
/* Reel plan yoksa planlanan tarihe düş (sıralama anahtarı) */
function reelKey(r) { return r.reelPlan || r.planlananTarih; }

function sortList(list) {
  return list.slice().sort((x, y) => {
    /* 1) Durum her şeyden önce: Yükleniyor → Bekliyor → Tamamlandı */
    const dx = DURUM_SIRA[x.durum] ?? 9;
    const dy = DURUM_SIRA[y.durum] ?? 9;
    if (dx !== dy) return dx - dy;
    /* 2) Reel Plan (yoksa planlanan) eski → yeni */
    let c = tarihCmp(reelKey(x), reelKey(y));
    if (c) return c;
    c = tarihCmp(x.planlananTarih, y.planlananTarih);
    if (c) return c;
    /* 3) Müşteri A-Z */
    return String(x.musteri || "").localeCompare(String(y.musteri || ""), "tr");
  });
}
function getSortedList(list) {
  if (!sortCol || !SORTABLE[sortCol]) return sortList(list);
  return list.slice().sort((x, y) => {
    const xe = colEmpty(x, sortCol), ye = colEmpty(y, sortCol);
    if (xe && ye) return 0;
    if (xe) return 1;
    if (ye) return -1;
    const c = cmpVals(x, y, sortCol);
    if (c) return sortDir === "desc" ? -c : c;
    /* Tie-break: durum → öncelik → reel plan → planlanan → müşteri */
    const dx = DURUM_SIRA[x.durum] ?? 9;
    const dy = DURUM_SIRA[y.durum] ?? 9;
    if (dx !== dy) return dx - dy;
    let t = tarihCmp(reelKey(x), reelKey(y));
    if (t) return t;
    t = tarihCmp(x.planlananTarih, y.planlananTarih);
    if (t) return t;
    t = String(x.musteri || "").localeCompare(String(y.musteri || ""), "tr");
    if (t) return t;
    return tarihCmp(x.gerceklesenTarih, y.gerceklesenTarih);
  });
}


/* ================= Kimlik doğrulama (Firebase Auth REST) ================= */
const AUTH_KEY = "sevkiyat_auth";
let currentUser = null;
let userEntries = {};

function getAuthState() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; }
}
function saveAuthState(idToken, refreshToken, expiresIn, email) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    idToken, refreshToken, email, exp: Date.now() + Number(expiresIn) * 1000
  }));
}
function clearAuthState() {
  localStorage.removeItem(AUTH_KEY);
  currentUser = null;
  updateUserUI();
}

let refreshPromise = null;
async function doTokenRefresh() {
  const s = getAuthState();
  if (!s) return null;
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", refresh_token: s.refreshToken })
  });
  const j = await res.json();
  if (!res.ok || !j.id_token) return null;
  saveAuthState(j.id_token, j.refresh_token, j.expires_in, s.email);
  return j.id_token;
}
async function ensureToken(force = false) {
  const s = getAuthState();
  if (!s) return null;
  if (!force && s.exp - Date.now() > 60000) return s.idToken;
  if (!refreshPromise) {
    refreshPromise = doTokenRefresh();
    refreshPromise.finally(() => { refreshPromise = null; });
  }
  const t = await refreshPromise;
  if (!t) {
    clearAuthState();
    showLogin("Oturum geçersiz — tekrar giriş yapın.");
    throw new Error("Oturum yenilenemedi");
  }
  return t;
}
async function authFetch(url, opts = {}, _canRetry = true) {
  const token = await ensureToken();
  if (!token) throw new Error("Oturum bulunamadı");
  const sep = url.includes("?") ? "&" : "?";
  const authedUrl = url + sep + "auth=" + encodeURIComponent(token);
  const headers = { ...(opts.headers || {}), Authorization: "Bearer " + token };
  const res = await fetch(authedUrl, { ...opts, headers });
  if (res.status === 403) {
    throw new Error("Veritabanı kuralları bu işlemi engelledi (403). Rules bölümünü kontrol et.");
  }
  if (res.status === 401) {
    if (_canRetry) {
      await ensureToken(true);
      return authFetch(url, opts, false);
    }
    throw new Error("Veritabanı erişimi reddedildi (401). Kurallar yazmaya izin vermiyor.");
  }
  return res;
}
function fbErrText(msg) {
  if (/EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS/.test(msg)) return "E-posta veya şifre hatalı.";
  if (/TOO_MANY_ATTEMPTS/.test(msg)) return "Çok fazla başarısız deneme — birkaç dakika bekleyip tekrar dene.";
  if (/OPERATION_NOT_ALLOWED/.test(msg)) return "Firebase Console → Authentication'da Email/Password girişi etkinleştirilmemiş.";
  if (/API_KEY_NOT_VALID/.test(msg)) return "API Key geçersiz — koddaki FIREBASE_API_KEY değerini kontrol et.";
  if (/PASSWORD_LOGIN_DISABLED/.test(msg)) return "Firebase Console → Authentication → Sign-in method → Email/Password etkinleştirilmemiş.";
  return "Giriş başarısız: " + msg;
}
function isAdmin() {
  if (!currentUser) return false;
  if (ADMIN_EMAILS.includes(String(currentUser.email).toLowerCase())) return true;
  const e = userEntries[currentUser.email];
  return !!(e && e.role === "admin");
}
function hasPerm(p) {
  if (!currentUser) return false;
  if (isAdmin()) return true;
  const e = userEntries[currentUser.email];
  const perms = (e && e.perms) ? e.perms : DEFAULT_PERMS;
  return !!perms[p];
}

/* ================= Firebase REST (veritabanı) ================= */
async function check(res, label) {
  if (res.ok) return res.json();
  let msg = label + " (HTTP " + res.status + ")";
  try { const j = await res.json(); if (j.error) msg += ": " + j.error; } catch (e) {}
  throw new Error(msg);
}
function toDb(r) {
  return {
    musteri: (r.musteri || "").trim(),
    blm: r.blm || "EXPORT-1",
    kategori: r.kategori || "PLANLI",
    sevkiyatTipi: r.sevkiyatTipi || "KOMPLE TIR",
    ad: Number(r.ad) || 1,
    planlananTarih: r.planlananTarih || "",
    reelPlan: r.reelPlan || "",
    gerceklesenTarih: r.gerceklesenTarih || "",
    durum: r.durum || "Yükleme Bekliyor",
    aciklama: r.aciklama || "",
    araciGeldi: r.araciGeldi || "",
    prsM3: (r.prsM3 === "" || r.prsM3 == null) ? null : Number(r.prsM3),
    m3: (r.m3 === "" || r.m3 == null) ? null : Number(r.m3),
    gecikmeNedeni: r.gecikmeNedeni || "",
    gecikmeSon: (r.gecikmeSon == null) ? null : Number(r.gecikmeSon),
    ekip: (r.ekip || "").trim() || "",
    toplamaBasTs: (r.toplamaBasTs == null) ? null : Number(r.toplamaBasTs),
    toplamaBittiTs: (r.toplamaBittiTs == null) ? null : Number(r.toplamaBittiTs),
    comments: Array.isArray(r.comments) ? r.comments : [],
    loadingStartedAt: (r.loadingStartedAt == null) ? null : Number(r.loadingStartedAt),
    loadingEndedAt: (r.loadingEndedAt == null) ? null : Number(r.loadingEndedAt),
    createdBy: r.createdBy || (currentUser ? currentUser.email : ""),
    updatedBy: currentUser ? currentUser.email : "",
    updatedAt: r.updatedAt ?? null
  };
}
async function apiLog(action, recId, musteri, detay) {
  if (!currentUser) return;
  try {
    await authFetch(`${FIREBASE_DB_URL}/${HIST_NODE}.json`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ts: Date.now(), user: currentUser.email, action,
        recId: recId || "", musteri: musteri || "", detay: detay || ""
      })
    });
  } catch (e) { console.warn("Geçmiş kaydı yazılamadı:", e.message); }
}
async function apiListHistory(limit = 150) {
  const res = await fetch(`${FIREBASE_DB_URL}/${HIST_NODE}.json`);
  const data = await check(res, "Geçmiş yüklenemedi");
  if (!data) return [];
  return Object.entries(data)
    .map(([key, val]) => ({ id: key, ...(val || {}) }))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .slice(0, limit);
}
/* 🆕 Listeleme sırasında eksik alanlar varsayılanla doldurulur —
   eski/elle girilen kayıtlarda tip/kategori boş görünmez, hesaplar doğru olur */
async function apiList() {
  const res = await fetch(`${FIREBASE_DB_URL}/${NODE}.json`);
  const data = await check(res, "Veriler yüklenemedi");
  if (!data) return [];
  return Object.entries(data).map(([key, val]) => {
    const r = { id: key, ...(val || {}) };
    r.musteri = r.musteri || "";
    r.blm = r.blm || "EXPORT-1";
    r.kategori = r.kategori || "PLANLI";
    r.sevkiyatTipi = r.sevkiyatTipi || "KOMPLE TIR";
    r.ad = (r.ad == null || r.ad === "") ? 1 : (Number(r.ad) || 1);
    r.durum = r.durum || "Yükleme Bekliyor";
    r.comments = Array.isArray(r.comments) ? r.comments : [];
    return r;
  });
}
function markLocalOp() { lastLocalOp = Date.now(); }
async function apiInsert(rec) {
  markLocalOp();
  const body = toDb(rec);
  body.updatedAt = Date.now();
  const res = await authFetch(`${FIREBASE_DB_URL}/${NODE}.json`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await check(res, "Kayıt eklenemedi");
  return { id: data.name, ...body };
}
async function apiUpdate(id, rec) {
  markLocalOp();
  const body = toDb(rec);
  body.updatedAt = Date.now();
  const res = await authFetch(`${FIREBASE_DB_URL}/${NODE}/${id}.json`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  await check(res, "Kayıt güncellenemedi");
  return { id, ...body };
}
async function apiGetOne(id) {
  const res = await fetch(`${FIREBASE_DB_URL}/${NODE}/${id}.json`);
  return await check(res, "Kayıt okunamadı");
}
async function freshRow(id) {
  const server = await apiGetOne(id);
  if (!server) return null;
  const r = { id, ...server };
  r.musteri = r.musteri || "";
  r.blm = r.blm || "EXPORT-1";
  r.kategori = r.kategori || "PLANLI";
  r.sevkiyatTipi = r.sevkiyatTipi || "KOMPLE TIR";
  r.ad = (r.ad == null || r.ad === "") ? 1 : (Number(r.ad) || 1);
  r.durum = r.durum || "Yükleme Bekliyor";
  r.comments = Array.isArray(r.comments) ? r.comments : [];
  rows = rows.map(x => x.id === id ? r : x);
  return r;
}

async function apiDelete(id) {
  markLocalOp();
  const res = await authFetch(`${FIREBASE_DB_URL}/${NODE}/${id}.json`, { method: "DELETE" });
  await check(res, "Kayıt silinemedi");
}
async function apiBulkInsert(recs) {
  markLocalOp();
  const body = {};
  const stamp = Date.now().toString(36);
  recs.forEach((rec, i) => {
    const d = toDb(rec);
    d.updatedAt = Date.now();
    body["imp-" + stamp + "-" + String(i).padStart(4, "0")] = d;
  });
  const res = await authFetch(`${FIREBASE_DB_URL}/${NODE}.json`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  await check(res, "Toplu yükleme başarısız");
}

function userKey(email) { return email.replace(/\./g, ","); }
async function loadUserEntries() {
  try {
    const res = await authFetch(`${FIREBASE_DB_URL}/${USERS_NODE}.json`);
    const data = await check(res, "Kullanıcı yetkileri yüklenemedi");
    userEntries = {};
    if (data) {
      Object.entries(data).forEach(([k, v]) => {
        if (!v) return;
        const email = v.email || k.replace(/,/g, ".");
        userEntries[email] = { email, role: v.role || "user", perms: v.perms || DEFAULT_PERMS };
      });
    }
  } catch (e) {
    console.warn("Yetkiler yüklenemedi:", e.message);
    userEntries = {};
  }
}

/* ================= ⏱️ Süre ayarları ================= */
let sureAyarlari = {};
let sureVarsayilan = 120;
function comboKey(m, t) {
  return String(m || "").replace(/[.#$\[\]\/]/g, "_") + "~~" + String(t || "").replace(/\s+/g, "_");
}
async function loadSureAyarlari() {
  try {
    const res = await fetch(`${FIREBASE_DB_URL}/${SURE_NODE}.json`);
    const data = await check(res, "Süre ayarları yüklenemedi");
    sureAyarlari = {};
    if (data) {
      Object.entries(data).forEach(([k, v]) => {
        if (!v) return;
        if (k === "__varsayilan__") { sureVarsayilan = Number(v.sureDk) || 120; return; }
        sureAyarlari[k] = { musteri: v.musteri || k, sevkiyatTipi: v.sevkiyatTipi || "", sureDk: Number(v.sureDk) || 120 };
      });
    }
  } catch (e) {
    console.warn("Süre ayarları yüklenemedi:", e.message);
  }
}
function getSureDk(r) {
  const hit = sureAyarlari[comboKey(r.musteri, r.sevkiyatTipi)];
  return hit ? hit.sureDk : sureVarsayilan;
}
/* ⚠️ Durum yan etkileri — kronometreyi (loadingStartedAt/loadingEndedAt) KORUR.
   Gerçekleşen tarih: Tamamlandı'ya geçişte yalnızca BOŞSA bugün yazılır;
   doluysa DOKUNULMAZ. */
function applyDurumSideEffects(rec) {
  const d = rec.durum;
  if (d === "Yükleniyor") {
    if (!rec.loadingStartedAt) rec.loadingStartedAt = Date.now();
    rec.loadingEndedAt = null;
  } else if (d === "Yükleme Bekliyor") {
    rec.loadingStartedAt = null;
    rec.loadingEndedAt = null;
  } else if (d === "Yükleme Tamamlandı") {
    if (rec.loadingStartedAt && !rec.loadingEndedAt) rec.loadingEndedAt = Date.now();
    if (!rec.gerceklesenTarih) rec.gerceklesenTarih = todayISO();
    /* Gecikme snapshot: o an gecikmeliyse gün sayısı kayda yazılır (kronometreye dokunmaz) */
    const raw = gecikmeGunRaw(rec);
    if (raw > 0) rec.gecikmeSon = raw; else rec.gecikmeSon = null;
  }
  return rec;
}

/* ================= 👷 Kapasite ayarları ================= */
const KAPASITE_KEY = "sevkiyat_kapasite";
let kapasiteSaat = 9;
let kapasiteEkip = 2;
function loadKapasitePrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(KAPASITE_KEY));
    if (p) {
      if (Number(p.saat) > 0) kapasiteSaat = Number(p.saat);
      if (Number(p.ekip) > 0) kapasiteEkip = Number(p.ekip);
    }
  } catch (e) {}
}
function saveKapasitePrefs() {
  try { localStorage.setItem(KAPASITE_KEY, JSON.stringify({ saat: kapasiteSaat, ekip: kapasiteEkip })); } catch (e) {}
}

/* ================= State ================= */
let rows = [];
let loading = false;
let addingInline = false;
let inlineData = null;
let dateFilter = "week-current";
let arsivDahil = false;
let fitMode = false;
let dateFrom = "";
let dateTo = "";
let statusFilter = "kalan";
let pendingAction = null;
let editingCell = null;
let committing = false;
let activeReportTab = "genel";
let currentCommentId = null;
let currentSureId = null;
let kalY = 0, kalM = 0;
let depoTab = "anlik";
const selectedIds = new Set();
const hiddenCols = new Set();

function applyFit() {
  const wrap = document.querySelector(".table-wrap");
  const tbl = wrap ? wrap.querySelector("table") : null;
  if (!tbl) return;
// Sayfa yüklendiğinde otomatik sığdır
document.body.classList.add("fit-table");  wrap.style.zoom = "";
  if (!fitMode) return;
  /* kompakt sınıf uygulandıktan SONRA ölç → zoom değeri küçük kalır */
  const need = tbl.scrollWidth;
  const have = wrap.clientWidth - 2;
  const z = Math.max(0.55, Math.min(1, have / need));
  if (z < 0.99) wrap.style.zoom = z.toFixed(3);
}
window.addEventListener("resize", () => { if (fitMode) applyFit(); });
window.addEventListener("load", () => { if (fitMode) applyFit(); });

/* ================= Son filtre hatırlama ================= */
const PREF_KEY = "sevkiyat_prefs";
const PREF_VERSION = 2; /* kolon yapısı değişince artırılır → gizli kolonlar sıfırlanır */
function savePrefs() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({
      pv: PREF_VERSION,
      search: document.getElementById("search").value,
      searchScope: document.getElementById("searchScope").value,
      dateFilter, dateFrom, dateTo, statusFilter, arsivDahil,
      sortCol, sortDir,
      hiddenCols: [...hiddenCols],
      showSummary: !document.getElementById("summary").classList.contains("hidden")
    }));
  } catch (e) {}
}
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY));
    if (!p) { applyHiddenCols(); updateSearchPlaceholder(); return; }
    /* Tercih eski sürümse: kolon yapısı değişmiştir → gizli kolonları sıfırla,
       filtreleri koru. Güncelleme sonrası "kolonlar kayboldu" sürprizi olmaz. */
    if (p.pv !== PREF_VERSION) {
      p.hiddenCols = [];
      p.sortCol = null;
    }
    dateFilter = p.dateFilter || "week-current";
    dateFrom = p.dateFrom || "";
    dateTo = p.dateTo || "";
    statusFilter = p.statusFilter || "kalan";
    fitMode = !!p.fitMode;
    const bf = document.getElementById("btnFit");
    if (bf) bf.classList.toggle("primary", fitMode);
    arsivDahil = !!p.arsivDahil;
    document.getElementById("arsivDahil").checked = arsivDahil;
    sortCol = SORTABLE[p.sortCol] ? p.sortCol : null;
    sortDir = p.sortDir === "asc" ? "asc" : "desc";
    hiddenCols.clear();
    if (Array.isArray(p.hiddenCols)) {
      p.hiddenCols.forEach(k => { if (ALL_COLS.some(c => c[0] === k)) hiddenCols.add(k); });
    }
    if (typeof p.search === "string") document.getElementById("search").value = p.search;
    if (p.searchScope) document.getElementById("searchScope").value = p.searchScope;
    if (p.showSummary === false) {
      document.getElementById("summary").classList.add("hidden");
      document.getElementById("btnToggleSummary").textContent = "Özet";
    }
  } catch (e) {}
  applyHiddenCols();
  updateSearchPlaceholder();
}

/* ================= Yükle / hata / canlı bildirim ================= */
let lastLocalOp = 0;
/* 🔔 Toast kuyruğu — üst üste gelen bildirimler sırayla gösterilir */
let toastTimer = null;
const toastQueue = [];
let toastGosteriliyor = false;

function showToast(html, sure = 4500) {
  toastQueue.push({ html, sure });
  if (!toastGosteriliyor) toastSiraIsle();
}
function toastSiraIsle() {
  const siradaki = toastQueue.shift();
  if (!siradaki) { toastGosteriliyor = false; return; }
  toastGosteriliyor = true;
  const t = document.getElementById("toast");
  t.innerHTML = siradaki.html;
  t.classList.remove("hidden");
  toastTimer = setTimeout(() => {
    t.classList.add("hidden");
    /* Küçük boşluk bırak — üst üste binme hissi olmasın */
    setTimeout(toastSiraIsle, 300);
  }, siradaki.sure);
}
/* 🔔 Ekran ortası bildirim — kuyruktan bağımsız, dokununca hemen kapanır */
let centerTimer = null;
function centerNotify(html, sure = 10000) {
  let el = document.getElementById("centerToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "centerToast";
    el.className = "toast center-toast";
    document.body.appendChild(el);
    el.addEventListener("click", () => {
      clearTimeout(centerTimer);
      el.classList.add("hidden");
    });
  }
  el.innerHTML = html + `<div style="font-size:10px;opacity:.55;margin-top:8px">kapatmak için dokunun</div>`;
  el.classList.remove("hidden");
  clearTimeout(centerTimer);
  centerTimer = setTimeout(() => el.classList.add("hidden"), sure);
}

/* 📊 Alan bazlı diff — başka kullanıcıların anlamlı işlemlerini yakalar */
function diffRows(prev, next) {
  const pm = new Map(prev.map(r => [r.id, r]));
  let added = 0, updated = 0, deleted = 0;
  const events = [];
  const KIMLIK = r => r.updatedBy || "";
  next.forEach(r => {
    const eski = pm.get(r.id);
    if (!eski) { added++; return; }
    const eskiS = JSON.stringify(toDb(eski));
    const yeniS = JSON.stringify(toDb(r));
    if (eskiS !== sifirToNull(eskiS, yeniS)) { /* placeholder asla true olmaz */ }
    if (eskiS !== yeniS) updated++;
    const yapan = KIMLIK(r);
    if (!yapan) return;
    /* Yorum eklendi mi? (son yorum ts'i değişti ve yorum sayısı arttı) */
    const eskiC = Array.isArray(eski.comments) ? eski.comments : [];
    const yeniC = Array.isArray(r.comments) ? r.comments : [];
    if (yeniC.length > eskiC.length) {
      const son = yeniC[yeniC.length - 1];
      if (son && son.user && son.user !== (currentUser && currentUser.email)) {
        events.push({ ts: Date.now(), musteri: r.musteri, olay: "yorum",
          kim: shortUser(son.user), detay: son.text.length > 60 ? son.text.slice(0, 60) + "…" : son.text });
      }
    }
    /* Her olay türü: değer değiştiyse VE yapan ben değilsem bildir */
    const benYapmadi = yapan !== (currentUser && currentUser.email);
    if (!benYapmadi) return;
    if (!eski.toplamaBasTs && r.toplamaBasTs)
      events.push({ ts: Date.now(), musteri: r.musteri, olay: "tp-basla", kim: shortUser(yapan),
        detay: fmtTime(r.toplamaBasTs) + "'dan beri" + (r.ekip && ekipler[r.ekip] ? " · " + ekipAd(r.ekip) : "") });
    else if (!eski.toplamaBittiTs && r.toplamaBittiTs)
      events.push({ ts: Date.now(), musteri: r.musteri, olay: "tp-bitti", kim: shortUser(yapan),
        detay: fmtTime(r.toplamaBittiTs) + " · " + fmtSure(r.toplamaBittiTs - (r.toplamaBasTs || eski.toplamaBasTs || r.toplamaBittiTs)) });
    if (eski.durum !== r.durum) {
      if (r.durum === "Yükleniyor")
        events.push({ ts: Date.now(), musteri: r.musteri, olay: "basladi", kim: shortUser(yapan),
          detay: fmtTime(r.loadingStartedAt) + "'da başladı" });
      else if (r.durum === "Yükleme Tamamlandı")
        events.push({ ts: Date.now(), musteri: r.musteri, olay: "bitti", kim: shortUser(yapan),
          detay: (r.loadingStartedAt && r.loadingEndedAt) ? fmtSure(r.loadingEndedAt - r.loadingStartedAt) : "tamamlandı" });
    }
  });
  deleted = [...pm.keys()].filter(id => !next.find(r => r.id === id)).length;
  return { added, updated, deleted, events };
}
/* yardımcı gereksizse silinebilir — kod berraklığı için boş bırakıldı */

function sifirToNull(a, b) { return a; }
async function load(withSpinner = true, live = false) {
  const prev = rows;
  loading = withSpinner;
  if (withSpinner) render();
  try {
    rows = await apiList();
    if (live) console.log("🔔 canlı load:", prev.length, "→", rows.length, "| diff hazırlanıyor");
    setSaveError("");
        if (live && prev.length >= 0) {
      const d = diffRows(prev, rows);
      console.log("🔔 diff:", d.added, d.updated, d.deleted, "| events:", (d.events || []).length);
      /* 🔔 Diğer kullanıcıların işlemleri — toast + ding */
      (d.events || []).forEach(ev => {
        const ikon = { "tp-basla": "📦 başlattı", "tp-bitti": "📦 bitirdi",
                       "basladi": "▶️ yüklemeye başladı", "bitti": "✅ tamamladı", "yorum": "💬 yorum ekledi" }[ev.olay] || "";
                /* 🔔 Bildirim — ekran ortası, 5 sn */
        centerNotify(`🔔 <b>${esc(ev.kim)}</b> · ${esc(ev.musteri)}:<br>${ikon}${ev.detay ? " — " + esc(ev.detay) : ""}`, 10000);
        bildirimDing();
      });
      /* Sayısal özet — yalnız bildirim YOKSA göster (gürültüyü azalt) */
      if (!(d.events || []).length) {
        const parts = [];
        if (d.added) parts.push(`➕ ${d.added} yeni kayıt`);
        if (d.updated) parts.push(`✏️ ${d.updated} güncellendi`);
        if (d.deleted) parts.push(`🗑️ ${d.deleted} silindi`);
        if (parts.length) showToast("🔄 Ekip değişikliği algılandı:<br><b>" + parts.join(" · ") + "</b>");
      }
    }
    const ids = new Set(rows.map(r => r.id));
    [...selectedIds].forEach(id => { if (!ids.has(id)) selectedIds.delete(id); });
    updateBulkBar();
  } catch (e) {
    setSaveError(e.message);
  }
   loading = false;
  render();
  if (!document.getElementById("depoOverlay").classList.contains("hidden")) renderDepoContent();
  if (document.getElementById("opOverlay")) renderOpCard();
}
function setSaveError(msg) {
  const el = document.getElementById("saveError");
  el.textContent = msg;
  el.classList.toggle("hidden", !msg);
}
function setGuestInfo(msg) {
  const el = document.getElementById("guestInfo");
  if (msg) { el.innerHTML = msg; el.classList.remove("hidden"); }
  else el.classList.add("hidden");
}

/* ---------- Canlı senkron (Firebase SSE) ---------- */
let liveTimer = null;
function liveReload() {
  if (document.hidden || addingInline || editingCell) return;
  if (Date.now() - lastLocalOp < 3000) return;
  if (!document.getElementById("importModal").classList.contains("hidden")) return;
  load(false, true);
}
function startLiveSync() {
  try {
    const es = new EventSource(`${FIREBASE_DB_URL}/${NODE}.json`);
    window._sse = es;
    es.onopen = () => console.info("🔔 SSE bağlı");
    es.onmessage = () => {
      clearTimeout(liveTimer);
      liveTimer = setTimeout(liveReload, 800);
    };
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) console.warn("🔔 SSE kapandı");
    };
  } catch (e) { console.warn("SSE başlatılamadı:", e.message); }
}

/* ================= Tarih aralığı & filtre ================= */
function monthBounds(offset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + (offset || 0));
  const y = d.getFullYear(), m = d.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  return { from: `${y}-${pad2(m + 1)}-01`, to: `${y}-${pad2(m + 1)}-${pad2(last)}` };
}
function lastNDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  return { from: isoFromDate(d), to: todayISO() };
}
function dateBounds() {
  switch (dateFilter) {
    case "d7": return lastNDays(7);
    case "d30": return lastNDays(30);
    case "month": return monthBounds(0);
    case "lastmonth": return monthBounds(-1);
    case "custom": return { from: dateFrom || "0000-01-01", to: dateTo || "9999-12-31" };
    default: return null;
  }
}
function enriched(list) {
  return list.map(r => {
    /* Hafta/Ay artık REEL PLAN tarihinden hesaplanır (eski kayıtlarda reel plan yoksa planlanandan) */
    const dt = parseLocalDate(r.reelPlan || r.planlananTarih);
    return { ...r, hafta: dt ? getISOWeek(dt) : "-", ay: dt ? AYLAR[dt.getMonth()] : "-" };
  });
}
function searchHay(r) {
  const cmt = (Array.isArray(r.comments) ? r.comments : []).map(c => c.text).join(" ");
  /* 👷 Ekip adı da aranır ("Her yerde" kapsamı) — ekipAd diger.js'te global, çalışma anında hazır */
  const ek = r.ekip ? (ekipAd(r.ekip) + " " + r.ekip) : "";
  return [r.musteri, r.blm, r.kategori, r.sevkiyatTipi, r.aciklama, r.araciGeldi,
          r.durum, r.createdBy, r.ad, r.prsM3, r.m3, cmt, ek,
          formatDate(r.planlananTarih), formatDate(r.reelPlan), formatDate(r.gerceklesenTarih)]
    .map(x => String(x ?? "").toLowerCase()).join(" ");
}
function filtered() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  const scope = document.getElementById("searchScope").value;
  const words = q ? q.split(/\s+/).filter(Boolean) : null;
  const thisWeek = getISOWeek(new Date());
  const today = todayISO();
  const isWeekMode = dateFilter === "week-current" || dateFilter.startsWith("week-");
  const weekNum = dateFilter.startsWith("week-") ? dateFilter.slice(5) : null;
  const bounds = (!isWeekMode && dateFilter !== "all") ? dateBounds() : null;
  /* Arşiv dahil: ana + arşiv kayıtları birleşik havuz (arşivliler _arsiv etiketli, salt okunur) */
  let kaynak = rows;
  if (arsivDahil && Array.isArray(arsivCache) && arsivCache.length) {
    const ids = new Set(rows.map(r => r.id));
    kaynak = rows.concat(arsivCache.filter(r => !ids.has(r.id)).map(r => ({ ...r, _arsiv: true })));
  }
  const result = enriched(kaynak).filter(r => {
    if (dateFilter === "week-current") {
      const rp = r.reelPlan || r.planlananTarih;
      const isDelayed = rp && rp < today && r.durum !== "Yükleme Tamamlandı";
      if (!(String(r.hafta) === String(thisWeek) || isDelayed)) return false;
    } else if (weekNum !== null) {
      if (String(r.hafta) !== weekNum) return false;
    } else if (bounds) {
      const d = gecikmeTarihi(r);
      if (!d) return false;
      if (d < bounds.from || d > bounds.to) return false;
    }
    if (statusFilter === "kalan" && r.durum === "Yükleme Tamamlandı") return false;
    else if (statusFilter === "bekliyor" && r.durum !== "Yükleme Bekliyor") return false;
    else if (statusFilter === "yukleniyor" && r.durum !== "Yükleniyor") return false;
    else if (statusFilter === "tamamlandi" && r.durum !== "Yükleme Tamamlandı") return false;
    if (words) {
      if (scope === "wide") {
        const hay = searchHay(r);
        if (!words.every(w => hay.includes(w))) return false;
      } else if (scope === "reelplan" || scope === "planlanan" || scope === "gerceklesen") {
        /* 📅 Tarih kapsamları: ISO (2026-10-27) ve TR (27.10.2026) biçimlerinde ara —
           ayraç (nokta/tire/boşluk) fark etmez, kısmi giriş de yakalanır (örn. "27.10") */
        const alan = scope === "reelplan" ? r.reelPlan
                   : scope === "planlanan" ? r.planlananTarih
                   : r.gerceklesenTarih;
        const iq = q.replace(/[\s.\-/]/g, "");
        const hay = (String(alan || "") + (alan ? formatDate(alan) : "")).replace(/[\s.\-/]/g, "");
        if (!hay.includes(iq)) return false;
      } else if (!(r.musteri || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });
  return getSortedList(result);
}
function computeSummary(list) {
  const today = todayISO();
  const toplamAd = list.reduce((s, r) => s + adet(r), 0);
  const tamamAd  = list.filter(r => r.durum === "Yükleme Tamamlandı").reduce((s, r) => s + adet(r), 0);
  const yukleniyorAd = list.filter(r => r.durum === "Yükleniyor").reduce((s, r) => s + adet(r), 0);
  /* BUGÜN sayacı: reel plan bugüne eşit olanlar (yoksa planlanan) */
  const bugunAd   = list.filter(r => gecikmeTarihi(r) === today).reduce((s, r) => s + adet(r), 0);
  const gecikenAd = list.reduce((s, r) => s + (gecikmeGunu(r) > 0 ? adet(r) : 0), 0);
  const maxGecikme = list.reduce((m, r) => Math.max(m, gecikmeGunu(r)), 0);
  const toplamM3 = list.reduce((s, r) => s + (Number(r.m3) || 0), 0);
  const toplamM3Tamam = list.filter(r => r.durum === "Yükleme Tamamlandı").reduce((s, r) => s + (Number(r.m3) || 0), 0);
  const oran = toplamAd ? (tamamAd / toplamAd) * 100 : 0;
  const gunIdx = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };
  const gunAd = GUNLER.map(() => 0);
  list.forEach(r => {
    /* Gün dağılımı da reel plan bazlı */
    const dt = parseLocalDate(gecikmeTarihi(r));
    if (!dt) return;
    const idx = gunIdx[dt.getDay()];
    if (idx !== undefined) gunAd[idx] += adet(r);
  });
  return { toplamAd, tamamAd, kalanAd: toplamAd - tamamAd, yukleniyorAd,
           bekleyenAd: toplamAd - tamamAd - yukleniyorAd,
           bugunAd, gecikenAd, maxGecikme, toplamM3, toplamM3Tamam, oran, gunAd };
}
