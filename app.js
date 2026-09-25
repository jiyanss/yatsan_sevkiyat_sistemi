/* ================= Firebase yapılandırması ================= */
const FIREBASE_DB_URL = "https://sevkiyat-app-default-rtdb.europe-west1.firebasedatabase.app".replace(/\/+$/, "");
const FIREBASE_API_KEY = "AIzaSyAagmdq0N2TG4IQ7noDFL6xQh4-ps-QrgI";
const NODE = "sevkiyat";
const HIST_NODE = "sevkiyat_history";
const USERS_NODE = "sevkiyat_users";
const SURE_NODE = "sevkiyat_suresi";
const YEDEK_NODE = "sevkiyat_yedek";
const YEDEK_SAKLAMA_GUN = 14;

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
  hafta:1, ay:1, reelPlan:1, gerceklesenTarih:1, durum:1, oncelikNo:1, prsM3:1, m3:1, createdBy:1 };

/* Tablo kolonları — BAŞLIK ve SATIRLAR bu tek kaynaktan üretilir (hizalama garantisi) */
const ALL_COLS = [
  ["musteri","Müşteri"],["blm","BLM"],["kategori","Kategori"],["sevkiyatTipi","Sevkiyat Tipi"],
  ["ad","AD"],["planlananTarih","Planlanan Tarih"],["hafta","Hafta"],["ay","Ay"],
  ["reelPlan","Reel Plan"],["gerceklesenTarih","Gerçekleşen"],["durum","Durum"],
  ["sure","Süre"],["oncelikNo","⭐ Önc."],
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
  oncelikNo:        { kind: "number", w: "w-num" },
  aciklama:         { kind: "text",   w: "w-aciklama" },
  araciGeldi:       { kind: "select", options: GELDI },
  prsM3:            { kind: "number", w: "w-num" },
};
const FIELD_LABELS = {
  musteri: "Müşteri", blm: "BLM", kategori: "Kategori", sevkiyatTipi: "Tip",
  ad: "AD", planlananTarih: "Planlanan", reelPlan: "Reel Plan",
  gerceklesenTarih: "Gerçekleşen", durum: "Durum", aciklama: "Açıklama",
  araciGeldi: "Aracı", prsM3: "PRS M3", m3: "M3", oncelikli: "Öncelikli", oncelikNo: "Öncelik No"
};
const ACTION_META = {
  "ekleme":     { label: "Kayıt eklendi",   dot: "add" },
  "guncelleme": { label: "Güncellendi",     dot: "edit" },
  "silme":      { label: "Silindi",         dot: "del" },
  "cogaltma":   { label: "Çoğaltıldı",      dot: "dup" },
  "excel":      { label: "Excel yükleme",   dot: "excel" },
  "yetki":      { label: "Yetki değişti",   dot: "excel" },
  "yorum":      { label: "Yorum eklendi",   dot: "edit" },
  "yedek":      { label: "Otomatik yedek",  dot: "dup" }
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
    oncelikli: false, oncelikNo: "", comments: []
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
function oncelikVal(r) {
  return (r.oncelikNo === "" || r.oncelikNo == null) ? Infinity : Number(r.oncelikNo);
}
/* ============================================================
   VARSAYILAN SIRALAMA (kullanıcının tarifi):
   1) ⭐ Öncelikli işaretli kayıtlar + öncelik numarası (1,2,3…) en üste
   2) Durum: Yükleniyor (en üst) → Yükleme Bekliyor (orta) → Yükleme Tamamlandı (en alt)
   3) Her durum grubunun İÇİNDE Reel Plan: eski → yeni (boşlar sona;
      eski kayıtlarda reel plan yoksa planlanan tarihe düşülür)
   4) Aynı tarih + durumda: Müşteri adı alfabetik
   5) Tie-breaker: Gerçekleşen
   ============================================================ */
function oncelikBas(r) { return r.oncelikli ? 0 : 1; }
function reelKey(r) { return r.reelPlan || r.planlananTarih; }
function sortList(list) {
  return list.slice().sort((x, y) => {
    /* 1) Durum her şeyden önce: Yükleniyor (en üst, tarih farketmeksizin)
          → Bekliyor (orta) → Tamamlandı (en alt) */
    const dx = DURUM_SIRA[x.durum] ?? 9;
    const dy = DURUM_SIRA[y.durum] ?? 9;
    if (dx !== dy) return dx - dy;
    /* 2) Grup içinde: öncelikli kayıtlar öne */
    const bx = oncelikBas(x), by = oncelikBas(y);
    if (bx !== by) return bx - by;
    const px = oncelikVal(x), py = oncelikVal(y);
    if (px !== py) return px - py;
    /* 3) Önce Reel Plan, eşitse Planlanan Tarih (küçükten büyüğe) */
    let c = tarihCmp(reelKey(x), reelKey(y));
    if (c) return c;
    c = tarihCmp(x.planlananTarih, y.planlananTarih);
    if (c) return c;
    c = String(x.musteri || "").localeCompare(String(y.musteri || ""), "tr");
    if (c) return c;
    return tarihCmp(x.gerceklesenTarih, y.gerceklesenTarih);
  });
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
    case "ad": case "prsM3": case "m3": case "hafta": case "oncelikNo":
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
    const bx = oncelikBas(x), by = oncelikBas(y);
    if (bx !== by) return bx - by;
    const px = oncelikVal(x), py = oncelikVal(y);
    if (px !== py) return px - py;
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
  try { return JSON.parse(sessionStorage.getItem(AUTH_KEY)); } catch { return null; }
}
function saveAuthState(idToken, refreshToken, expiresIn, email) {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify({
    idToken, refreshToken, email, exp: Date.now() + Number(expiresIn) * 1000
  }));
}
function clearAuthState() {
  sessionStorage.removeItem(AUTH_KEY);
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
    oncelikli: !!r.oncelikli,
    oncelikNo: (r.oncelikNo === "" || r.oncelikNo == null) ? null : Number(r.oncelikNo),
    gecikmeNedeni: r.gecikmeNedeni || "",
    gecikmeSon: (r.gecikmeSon == null) ? null : Number(r.gecikmeSon),
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

/* ================= Son filtre hatırlama ================= */
const PREF_KEY = "sevkiyat_prefs";
const PREF_VERSION = 2; /* kolon yapısı değişince artırılır → gizli kolonlar sıfırlanır */
function savePrefs() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({
      pv: PREF_VERSION,
      search: document.getElementById("search").value,
      searchScope: document.getElementById("searchScope").value,
      dateFilter, dateFrom, dateTo, statusFilter,
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
let toastTimer = null;
function showToast(html) {
  const t = document.getElementById("toast");
  t.innerHTML = html;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 4500);
}
function diffRows(prev, next) {
  const pm = new Map(prev.map(r => [r.id, JSON.stringify(toDb(r))]));
  let added = 0, updated = 0, deleted = 0;
  next.forEach(r => {
    const s = JSON.stringify(toDb(r));
    if (!pm.has(r.id)) added++;
    else if (pm.get(r.id) !== s) updated++;
    pm.delete(r.id);
  });
  return { added, updated, deleted: pm.size };
}
async function load(withSpinner = true, live = false) {
  const prev = rows;
  loading = withSpinner;
  if (withSpinner) render();
  try {
    rows = await apiList();
    setSaveError("");
    if (live && prev.length >= 0) {
      const d = diffRows(prev, rows);
      const parts = [];
      if (d.added) parts.push(`➕ ${d.added} yeni kayıt`);
      if (d.updated) parts.push(`✏️ ${d.updated} güncellendi`);
      if (d.deleted) parts.push(`🗑️ ${d.deleted} silindi`);
      if (parts.length) showToast("🔄 Ekip değişikliği algılandı:<br><b>" + parts.join(" · ") + "</b>");
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
    es.onmessage = () => {
      clearTimeout(liveTimer);
      liveTimer = setTimeout(liveReload, 800);
    };
    es.onerror = () => {};
  } catch (e) {}
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
  return [r.musteri, r.blm, r.kategori, r.sevkiyatTipi, r.aciklama, r.araciGeldi,
          r.durum, r.createdBy, r.ad, r.prsM3, r.m3, cmt,
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
  const result = enriched(rows).filter(r => {
    if (dateFilter === "week-current") {
      /* "+ gecikenler" OPERASYONEL: reel planı hâlâ bugünün gerisinde kalan tamamlanmamışlar.
         Reel planı ileri çekilen kayıt geciken sayılmaz — yeni haftasında görünür. */
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
  const b = sureBilgi(r);
  if (b.durum === "none") return `<span class="sure-txt">-</span>`;
  if (b.durum === "live") {
    const cls = b.yuzde >= 100 ? "over" : b.yuzde >= 70 ? "warn" : "";
    const txt = b.asim
      ? `⚠ ${fmtSure(b.gecenMs)} · ${b.asimDk}dk aşıldı`
      : `${fmtSure(b.gecenMs)} / ${b.sureDk}dk · %${b.yuzde}`;
    return `<div class="sure-wrap">
      <div class="surebar"><div class="surebar-fill ${cls}" style="width:${b.yuzde}%"></div></div>
      <span class="sure-txt ${b.asim ? "over" : ""}">${txt}</span>
    </div>`;
  }
  const cls = b.asim ? "warn" : "";
  const txt = b.asim
    ? `✔ ${fmtSure(b.gecenMs)} · ${b.asimDk}dk aşım`
    : `✔ ${fmtSure(b.gecenMs)} / ${b.sureDk}dk`;
  return `<div class="sure-wrap">
    <div class="surebar"><div class="surebar-fill ${cls}" style="width:${b.yuzde}%"></div></div>
    <span class="sure-txt ${b.asim ? "done-over" : "done-ok"}">${txt}</span>
  </div>`;
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
    if (isOver && !hasCls && !r.oncelikli) tr.classList.add("overtime");
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
}
function renderDatalist() {
  const cust = [...new Set(rows.map(r => r.musteri).filter(Boolean))];
  document.getElementById("musteri-list").innerHTML = cust.map(c => `<option value="${esc(c)}">`).join("");
}
function renderDateFilter() {
  const weeks = [...new Set(enriched(rows).map(r => r.hafta).filter(w => w !== "-"))].sort((a, b) => a - b);
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
  return `<td data-col="${field}" class="${extraCls || ""}${def ? " editable" : ""}"${def ? ` data-field="${field}"` : ""}>${content}</td>`;
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
function gerceklesenView(x) {
  let html = formatDate(x.gerceklesenTarih);
  if (x.durum === "Yükleme Tamamlandı") {
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
    <td data-col="oncelikNo">${fInput(d, scope, "oncelikNo", "number", "w-num")}</td>
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
  const rowCls = r.oncelikli ? "priority" : (isOvertime ? "overtime" : (isToday ? "today-row" : ""));
  const cmtN = Array.isArray(r.comments) ? r.comments.length : 0;
  const isSel = selectedIds.has(r.id);
  return `<tr class="row ${rowCls}" data-rowid="${r.id}">
    <td class="center"><input type="checkbox" class="selbox" data-sel="${r.id}" ${isSel ? "checked" : ""} /></td>
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
    ${tdHtml(r, "oncelikNo", "center", x => numOrDash(x.oncelikNo))}
    ${tdHtml(r, "aciklama", "truncate", x => `<span title="${esc(x.aciklama)}">${esc(x.aciklama) || "-"}</span>`)}
    ${tdHtml(r, "araciGeldi", "", x => esc(x.araciGeldi) || "-")}
    <td data-col="status" class="center">${durumIcon(r.durum)}</td>
    ${tdHtml(r, "prsM3", "center", x => numOrDash(x.prsM3))}
    <td data-col="m3" class="center">${numOrDash(r.m3)}</td>
    <td data-col="createdBy" class="muted" title="${esc(r.createdBy || "")}">${esc(shortUser(r.createdBy))}${r.updatedAt ? `<div class="fresh-badge ${Date.now() - r.updatedAt < 3600000 ? "f-new" : Date.now() - r.updatedAt < 86400000 ? "f-day" : "f-old"}" title="Son güncelleme: ${fmtDateTime(r.updatedAt)}${r.updatedBy ? " · " + esc(shortUser(r.updatedBy)) : ""}">🔄 ${relTime(r.updatedAt)}</div>` : ""}</td>
    <td class="nowrap">
      <button class="icon-btn cmt" data-action="comments" data-id="${r.id}" title="Yorumlar">💬${cmtN ? `<span class="cmt-n">${cmtN}</span>` : ""}</button>
      <button class="icon-btn dup" data-action="duplicate" data-id="${r.id}" title="Kopyala (bugüne planlar, durum sıfırlanır)">⧉</button>
      <button class="icon-btn del" data-action="delete" data-id="${r.id}" title="Sil">🗑️</button>
    </td>
  </tr>`;
}
function renderTable(list) {
  closeCellEditor();
  const tbody = document.getElementById("tbody");
  const cc = 21 - hiddenCols.size;
  let html = "";
  if (loading) html += `<tr><td colspan="${cc}" class="empty">Yükleniyor…</td></tr>`;
  if (addingInline) html += formRowHtml(inlineData, "inline", "inline-row", "save-inline", "cancel-inline");
  if (!loading && list.length === 0 && !addingInline) {
    html += `<tr><td colspan="${cc}" class="empty">Filtrelere uyan kayıt yok. 🎉</td></tr>`;
  }
  list.forEach(r => { html += rowHtml(r); });
  tbody.innerHTML = html;
  const all = document.getElementById("selAll");
  if (all) all.checked = list.length > 0 && list.every(r => selectedIds.has(r.id));
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
  const row = rows.find(r => r.id === id);
  if (!inp || !row) { committing = false; closeCellEditor(); return; }
  let val = inp.value;
  if (field === "musteri") val = val.trim();
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
  renderColMenu();
  const menu = document.getElementById("colMenu");
  const btn = document.getElementById("btnCols");
  menu.classList.toggle("hidden");
  if (!menu.classList.contains("hidden")) {
    menu.style.visibility = "hidden";
    menu.style.display = "block";
    requestAnimationFrame(() => {
      const r = btn.getBoundingClientRect();
      const mw = menu.offsetWidth;
      const mh = menu.offsetHeight;
      let left = Math.min(r.right, window.innerWidth - mw - 8);
      left = Math.max(8, left);
      let top = r.bottom + 6;
      if (top + mh > window.innerHeight - 8) {
        top = Math.max(8, r.top - mh - 6);
      }
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
  rec.oncelikli = src.oncelikli;
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
  c.innerHTML = list.map(cm => `
    <div class="cmt-item">
      <div class="cmt-meta"><b>${esc(shortUser(cm.user))}</b> · ${fmtDateTime(cm.ts)}</div>
      <div class="cmt-text">${esc(cm.text)}</div>
    </div>`).join("");
}
async function commentAdd() {
  const ta = document.getElementById("cmtText");
  const text = ta.value.trim();
  if (!text || !currentCommentId) return;
  const row = rows.find(r => r.id === currentCommentId);
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

/* ================= ⏱️ Süre elle düzenleme ================= */
function openSureEdit(id) {
  const row = rows.find(r => r.id === id);
  if (!row) return;
  if (row.durum === "Yükleme Bekliyor") {
    alert("Bu kayıt henüz yüklenmiyor — kronometre 'Yükleniyor' durumunda başlar.");
    return;
  }
  currentSureId = id;
  const standart = getSureDk(row);
  document.getElementById("sureEditWho").innerHTML =
    `<b>${esc(row.musteri)}</b> · ${esc(row.sevkiyatTipi)} · standart: ${standart} dk · durum: ${esc(row.durum)}`;
  const body = document.getElementById("sureEditBody");
  if (row.durum === "Yükleniyor") {
    body.innerHTML = `
      <p class="hint">Kronometre şu an çalışıyor. Başlangıcı düzeltebilirsin; <b>bitiş girersen kayıt otomatik "Yükleme Tamamlandı" olur</b> (durumu değiştirmeyi unuttuğun durumlar için).</p>
      <div class="form-grid">
        <label class="col-2"><span>Başlangıç (gün-saat)</span>
          <input type="datetime-local" id="sureStart" class="w-dt" value="${toLocalDT(row.loadingStartedAt)}" />
        </label>
        <label class="col-2"><span>Bitiş — boş bırak = hâlâ yüklemede</span>
          <input type="datetime-local" id="sureEnd" class="w-dt" value="" />
        </label>
      </div>
      <div class="modal-actions" style="justify-content:flex-start;margin-top:8px">
        <button class="btn" id="btnSureReset" type="button">↺ Şimdi sıfırla (başlangıç = şu an)</button>
      </div>`;
    document.getElementById("btnSureReset").addEventListener("click", () => {
      document.getElementById("sureStart").value = toLocalDT(Date.now());
      document.getElementById("sureEnd").value = "";
    });
  } else {
    body.innerHTML = `
      <p class="hint">Yükleme tamamlandı — başlangıç ve bitiş saatlerini elle düzeltebilirsin.</p>
      <div class="form-grid">
        <label><span>Başlangıç</span><input type="datetime-local" id="sureStart" class="w-dt" value="${toLocalDT(row.loadingStartedAt)}" /></label>
        <label><span>Bitiş</span><input type="datetime-local" id="sureEnd" class="w-dt" value="${toLocalDT(row.loadingEndedAt)}" /></label>
      </div>`;
  }
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
  const sVal = document.getElementById("sureStart").value;
  const eVal = document.getElementById("sureEnd").value;
  if (!sVal) { alert("Başlangıç saati gerekli."); return; }
  const start = new Date(sVal).getTime();
  const updated = { ...row, loadingStartedAt: start };
  if (row.durum === "Yükleniyor") {
    if (eVal) {
      const end = new Date(eVal).getTime();
      if (end < start) { alert("Bitiş, başlangıçtan önce olamaz."); return; }
      updated.loadingEndedAt = end;
      updated.durum = "Yükleme Tamamlandı";
      /* Bitiş günü = gerçekleşen tarih (kronometre korunur, tarih güncellenir) */
      updated.gerceklesenTarih = isoFromDate(new Date(end));
    } else {
      updated.loadingEndedAt = null;
    }
  } else {
    if (!eVal) { alert("Bitiş saati gerekli (kayıt tamamlandı)."); return; }
    const end = new Date(eVal).getTime();
    if (end < start) { alert("Bitiş, başlangıçtan önce olamaz."); return; }
    updated.loadingEndedAt = end;
    updated.gerceklesenTarih = isoFromDate(new Date(end));
  }
  try {
    const saved = await apiUpdate(row.id, updated);
    rows = rows.map(r => r.id === row.id ? saved : r);
    document.getElementById("sureEditModal").classList.add("hidden");
    setSaveError("");
    render();
    const sureTxt = updated.loadingEndedAt ? fmtSure(updated.loadingEndedAt - updated.loadingStartedAt) : "sürüyor";
    await apiLog("guncelleme", row.id, row.musteri,
      `süre elle düzeltildi · başlangıç: ${fmtDateTime(updated.loadingStartedAt)}` +
      (updated.loadingEndedAt ? ` · bitiş: ${fmtDateTime(updated.loadingEndedAt)} · süre: ${sureTxt}` : "") +
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
function openMusteriKart(id) {
  const row = rows.find(r => r.id === id);
  if (!row || !row.musteri) return;
  const name = row.musteri;
  const all = enriched(rows).filter(r => (r.musteri || "").trim().toLowerCase() === name.trim().toLowerCase());
  const toplamAd = all.reduce((s, r) => s + adet(r), 0);
  const toplamM3 = all.reduce((s, r) => s + (Number(r.m3) || 0), 0);
  const tamam = all.filter(r => r.durum === "Yükleme Tamamlandı");
  const tamamAd = tamam.reduce((s, r) => s + adet(r), 0);
  const geciken = all.filter(r => gecikmeGunu(r) > 0);
  const az = sapmaAnalizi(all);
  const musSapma = az ? az.musteri.get(name) : null;
  const son5 = [...all].sort((a, b) => tarihCmp(b.planlananTarih, a.planlananTarih)).slice(0, 5);
  const sapmaHtml = musSapma
    ? `<div class="kpi ${musSapma.toplam / musSapma.n > 0 ? "c-red" : "c-green"}"><div class="kpi-head">🗓️ Ortalama sapma</div><div class="kpi-val" style="font-size:20px">${fmtSapma(musSapma.toplam / musSapma.n)} gün</div><div class="kpi-sub">${musSapma.n} tamamlanan · zamanında %${(musSapma.zamaninda / musSapma.n * 100).toFixed(0)}</div></div>`
    : `<div class="kpi c-amber"><div class="kpi-head">🗓️ Ortalama sapma</div><div class="kpi-val" style="font-size:20px">—</div><div class="kpi-sub">tamamlanan kayıt yok</div></div>`;
  const kpiHtml = `<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="kpi c-primary"><div class="kpi-head">📦 Toplam</div><div class="kpi-val">${fmtN(toplamAd)}</div><div class="kpi-sub">yükleme · ${fmtN(toplamM3)} m³ · ${all.length} kayıt</div></div>
    <div class="kpi c-green"><div class="kpi-head">✅ Tamamlanan</div><div class="kpi-val">${fmtN(tamamAd)}</div><div class="kpi-sub">%${toplamAd ? (tamamAd / toplamAd * 100).toFixed(1) : "0.0"} · ${geciken.length} geciken kayıt</div></div>
    ${sapmaHtml}
  </div>`;
  const sonHtml = son5.length ? `<div class="rpt"><h3>🕘 Son 5 sevkiyat</h3><div class="table-wrap"><table>
    <thead><tr><th>Planlanan</th><th>Tip</th><th>AD</th><th>Durum</th><th>Gerçekleşen</th></tr></thead>
    <tbody>${son5.map(r => `<tr>
      <td>${formatDate(r.planlananTarih)}</td>
      <td>${esc(r.sevkiyatTipi)}</td>
      <td class="center">${esc(r.ad)}</td>
      <td><span class="badge ${durumClass(r.durum)}">${esc(r.durum)}</span></td>
      <td>${formatDate(r.gerceklesenTarih)}</td>
    </tr>`).join("")}</tbody>
  </table></div></div>` : "";
  const modal = document.createElement("div");
  modal.className = "modal-bg";
  modal.style.zIndex = "75";
  modal.innerHTML = `<div class="modal wide">
    <h2>👤 ${esc(name)}</h2>
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

/* ============================================================
   🖥️ DEPO EKRAN MODU — 3 sekme
   ============================================================ */
function openDepo() {
  depoTab = "anlik";
  document.querySelectorAll(".depo-tab").forEach(x => x.classList.toggle("active", x.dataset.dtab === "anlik"));
  document.getElementById("depoOverlay").classList.remove("hidden");
  renderDepoContent();
}
function closeDepo() {
  document.getElementById("depoOverlay").classList.add("hidden");
}
document.getElementById("btnDepoClose").addEventListener("click", closeDepo);
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
  const sureTxt = b.durum !== "none"
    ? (b.asim ? `<span style="color:#f87171">⚠ ${fmtSure(b.gecenMs)} · ${b.asimDk}dk aşıldı</span>` : `⏱️ ${fmtSure(b.gecenMs)} / ${b.sureDk}dk · %${b.yuzde}`)
    : "";
  const gb = gecikmeBilgi(r);
  const nedenTxt = (gb.gun > 0 && gb.neden) ? `<div class="d-cmt">⚠️ Gecikme nedeni: ${esc(gb.neden)}</div>` : "";
  return `<div class="depo-item ${cls}">
    <div>
      <div class="d-musteri">${esc(r.musteri)}</div>
      <div class="d-sub">${esc(r.blm)} · ${esc(r.kategori || "")}${r.oncelikNo ? " · ⭐ Öncelik " + esc(r.oncelikNo) : ""}</div>
      ${depoCmtLine(r)}
      ${nedenTxt}
    </div>
    <div class="d-right">${esc(r.sevkiyatTipi)} · <span style="font-size:24px;color:#e2e8f0">${esc(r.ad)} yükleme</span><br>${extra}${sureTxt ? " · " + sureTxt : ""}</div>
  </div>`;
}
function gunEtiketi(iso) {
  const dt = parseLocalDate(iso);
  if (!dt) return iso;
  const idx = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }[dt.getDay()];
  return `${GUNLER[idx] || ""} ${dt.getDate()} ${AYLAR[dt.getMonth()]}`;
}
function renderDepoContent() {
  const today = todayISO();
  const d = new Date();
  /* Depo ekranı tarihi: reel plan varsa o, yoksa planlanan tarih */
  const dT = r => r.reelPlan || r.planlananTarih || "";
  document.getElementById("depoClock").textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  document.getElementById("depoDate").textContent =
    `${GUNLER[{ 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }[d.getDay()]]} · ${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
  const list = enriched(rows);
  const c = document.getElementById("depoContent");

  if (depoTab === "kalan") {
    const kalan = list.filter(r => dT(r) && dT(r) >= today && r.durum !== "Yükleme Tamamlandı");
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
        const gList = byDate.get(iso).sort((a, b) => (oncelikBas(a) - oncelikBas(b)) || (oncelikVal(a) - oncelikVal(b)) || (String(a.musteri).localeCompare(String(b.musteri), "tr")));
        const toplamAd = gList.reduce((s, r) => s + adet(r), 0);
        const satirlar = gList.map(r => {
          const cmtN = Array.isArray(r.comments) ? r.comments.length : 0;
          const cmtTxt = cmtN ? `<span class="w-cmt">💬 ${r.comments.slice(-5).map(x => esc(x.text)).join(", ")}</span>` : "";
          return `<div class="depo-week-row">
            <div class="w-m">${esc(r.musteri)}${r.oncelikNo ? ` <span style="color:#fbbf24">⭐${esc(r.oncelikNo)}</span>` : ""}${cmtTxt}${(() => { const gb = gecikmeBilgi(r); return (gb.gun > 0 && gb.neden) ? ` <span class="w-cmt" style="color:#f87171">⚠️ ${gb.gun} gün gecikti · ${esc(gb.neden)}</span>` : ""; })()}</div>
            <div class="w-r">${esc(r.sevkiyatTipi)} · ${esc(r.ad)} yükleme${r.durum === "Yükleniyor" ? " · 🟠 yükleniyor" : ""}</div>
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
            ? (b.asim ? `<span style="color:#fbbf24">⏱️ ${fmtSure(b.gecenMs)} · ${b.asimDk}dk aşım</span>` : `<span style="color:#34d399">⏱️ ${fmtSure(b.gecenMs)} / ${b.sureDk}dk</span>`)
            : "";
          const cmtN = Array.isArray(r.comments) ? r.comments.length : 0;
          const cmtTxt = cmtN ? `<span class="w-cmt">💬 ${r.comments.slice(-5).map(x => esc(x.text)).join(", ")}</span>` : "";
          return `<div class="depo-week-row">
            <div class="w-m">${esc(r.musteri)}${r.oncelikNo ? ` <span style="color:#fbbf24">⭐${esc(r.oncelikNo)}</span>` : ""}${cmtTxt}${(() => { const gb = gecikmeBilgi(r); return (gb.gun > 0 && gb.neden) ? ` <span class="w-cmt" style="color:#f87171">⚠️ ${gb.gun} gün gecikti · ${esc(gb.neden)}</span>` : ""; })()}</div>
            <div class="w-r">${esc(r.sevkiyatTipi)} · ${esc(r.ad)} yükleme${sureTxt ? " · " + sureTxt : ""}</div>
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
  /* Operasyonel gecikme: REEL PLAN bugünün gerisinde kalan tamamlanmamışlar.
     Reel planı ileri çekilen kayıt burada GECİKEN görünmez —
     gecikme notları zaten "Kalan Yüklemeler" sekmesinde gösteriliyor. */
  const opGecikme = r => {
    const t = dT(r);
    if (!t || r.durum === "Yükleme Tamamlandı") return 0;
    if (t >= today) return 0;
    return Math.round((parseLocalDate(today) - parseLocalDate(t)) / 86400000);
  };
  const geciken = list.filter(r => opGecikme(r) > 0).sort((a, b) => dT(a) < dT(b) ? -1 : 1);
  const yukleniyor = list.filter(r => r.durum === "Yükleniyor").sort((a, b) => (a.loadingStartedAt || 0) - (b.loadingStartedAt || 0));
  const bugun = list.filter(r => dT(r) === today && r.durum === "Yükleme Bekliyor")
    .sort((a, b) => (oncelikVal(a) - oncelikVal(b)));
  let html = "";
  html += `<div class="depo-sec-title" style="color:#fbbf24">🟠 ŞİMDİ YÜKLENİYOR (${yukleniyor.length})</div>`;
  html += yukleniyor.length ? yukleniyor.map(r => depoItem(r, "d-amber", formatDate(dT(r)))).join("") : `<div class="depo-empty">Şu an yükleme yok.</div>`;
  html += `<div class="depo-sec-title" style="color:#f87171">🔴 GECİKEN (${geciken.reduce((s, r) => s + adet(r), 0)})</div>`;
  html += geciken.length ? geciken.map(r => depoItem(r, "d-red", `${formatDate(dT(r))} · ⚠ ${opGecikme(r)} gün gecikti`)).join("") : `<div class="depo-empty">Geciken yükleme yok 🎉</div>`;
  html += `<div class="depo-sec-title" style="color:#818cf8">🔵 BUGÜN BEKLİYOR (${bugun.reduce((s, r) => s + adet(r), 0)})</div>`;
  html += bugun.length ? bugun.map(r => depoItem(r, "d-blue", "bugün")).join("") : `<div class="depo-empty">Bugün için bekleyen yükleme yok.</div>`;
  c.innerHTML = html;
}
setInterval(() => {
  if (document.getElementById("depoOverlay").classList.contains("hidden")) return;
  const d = new Date();
  document.getElementById("depoClock").textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}, 1000);
setInterval(() => {
  if (document.getElementById("depoOverlay").classList.contains("hidden") || document.hidden) return;
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
    const [svk, hist, usr, sur] = await Promise.all([
      fetch(`${FIREBASE_DB_URL}/${NODE}.json`).then(r => r.json()),
      fetch(`${FIREBASE_DB_URL}/${HIST_NODE}.json`).then(r => r.json()),
      authFetch(`${FIREBASE_DB_URL}/${USERS_NODE}.json`).then(r => r.json()),
      fetch(`${FIREBASE_DB_URL}/${SURE_NODE}.json`).then(r => r.json())
    ]);
    const payload = {
      app: "sevkiyat-planlama", version: 1, ts: Date.now(),
      user: currentUser.email,
      data: { sevkiyat: svk || {}, history: hist || {}, users: usr || {}, suresi: sur || {} }
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
    const [svk, hist, usr, sur] = await Promise.all([
      fetch(`${FIREBASE_DB_URL}/${NODE}.json`).then(r => r.json()),
      fetch(`${FIREBASE_DB_URL}/${HIST_NODE}.json`).then(r => r.json()),
      authFetch(`${FIREBASE_DB_URL}/${USERS_NODE}.json`).then(r => r.json()),
      fetch(`${FIREBASE_DB_URL}/${SURE_NODE}.json`).then(r => r.json())
    ]);
    const payload = {
      app: "sevkiyat-planlama", version: 1, ts: Date.now(), user: currentUser.email,
      data: { sevkiyat: svk || {}, history: hist || {}, users: usr || {}, suresi: sur || {} }
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
  if (on) list.forEach(r => selectedIds.add(r.id));
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
document.getElementById("btnInlineAdd").addEventListener("click", () => gate("inline-add"));
document.getElementById("btnShowForm").addEventListener("click", () => gate("form-add"));
document.getElementById("btnImportOpen").addEventListener("click", () => gate("import"));
document.getElementById("btnExport").addEventListener("click", exportExcel);
document.getElementById("btnHistory").addEventListener("click", showHistory);
document.getElementById("btnCalendar").addEventListener("click", openTakvim);
document.getElementById("btnDepo").addEventListener("click", openDepo);
document.getElementById("btnBackup").addEventListener("click", openBackup);
document.getElementById("btnAdminPanel").addEventListener("click", openAdminPanel);
document.getElementById("btnSurePanel").addEventListener("click", openSurePanel);
document.getElementById("btnPrint").addEventListener("click", () => {
  if (editingCell) commitCell();
  setTimeout(() => window.print(), 100);
});
document.getElementById("btnTheme").addEventListener("click", toggleTheme);

/* ================= Karanlık mod ================= */
const THEME_KEY = "sevkiyat_theme";
function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  document.getElementById("btnTheme").textContent = dark ? "☀️" : "🌙";
}
function toggleTheme() {
  applyTheme(!document.body.classList.contains("dark"));
  if (!document.getElementById("reportModal").classList.contains("hidden")) {
    buildReports();
  }
}
applyTheme(localStorage.getItem(THEME_KEY) === "dark");

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
  document.getElementById("f-oncelikli").checked = false;
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
  rec.oncelikli = document.getElementById("f-oncelikli").checked;
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

/* ============================================================
   📊 PROFESYONEL RAPORLAR (sekmeli)
   ============================================================ */
let chartInstances = [];
function destroyCharts() {
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
function haftaData() {
  const haftaMap = new Map();
  enriched(rows).forEach(r => {
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
          subText: "tamamlanma",
          color: labelColor,
          subColor: textColor
        }
      }
    }
  }));

  const gunCtx = document.getElementById("chGun").getContext("2d");
  chartInstances.push(new Chart(gunCtx, {
    type: "bar",
    data: { labels: GUNLER, datasets: [{
      label: "Yükleme adedi",
      data: s.gunAd,
      backgroundColor: c => grad(c.chart.ctx, c.chart.chartArea, "#6366f1", "#c7d2fe"),
      borderRadius: 6, maxBarThickness: 42
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end", align: "end", offset: -2,
          color: textColor, font: { weight: "700", size: 11 },
          formatter: v => v > 0 ? fmtN(v) : ""
        },
        tooltip: { callbacks: { label: c => ` ${fmtN(c.parsed.y)} yükleme` } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, precision: 0, maxTicksLimit: 6 } },
        x: { grid: { display: false }, ticks: { color: textColor } }
      }
    }
  }));

  const tipMap = groupStats(list, r => r.sevkiyatTipi);
  const tipTotal = [...tipMap.values()].reduce((a, g) => a + g.ad, 0) || 1;
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
          formatter: v => `${fmtN(v)} · %${(v / tipTotal * 100).toFixed(0)}`
        },
        tooltip: { callbacks: { label: c => ` ${fmtN(c.parsed.x)} yükleme (%${(c.parsed.x / tipTotal * 100).toFixed(1)})` } }
      },
      scales: {
        x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, precision: 0, maxTicksLimit: 6 }, suggestedMax: Math.max(...[...tipMap.values()].map(g => g.ad), 1) * 1.25 },
        y: { grid: { display: false }, ticks: { color: textColor, font: { size: 11, weight: "600" } } }
      }
    }
  }));

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
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmtN(c.parsed.y)}` } }
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
  /* HTML'i koy, grafik sonradan kurulsun */
  setTimeout(() => {
    if (typeof Chart === "undefined") return;
    const cnv = document.getElementById("chNeden");
    if (!cnv) return;
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
  const chartBlock = (typeof Chart === "undefined")
    ? `<p class="hint">⚠️ Grafik kütüphanesi (CDN) yüklenemedi.</p>`
    : `<div class="chart-grid">
         <div class="chart-box wide"><h3>📈 Haftalık yükleme hacmi & tamamlanma oranı (son 8 hafta · reel plana göre)</h3><div class="chart-holder"><canvas id="chKarma"></canvas></div></div>
         ${az ? `<div class="chart-box wide"><h3>🗓️ Müşteri bazlı ortalama plan sapması (gün)</h3><div class="chart-holder tall"><canvas id="chSapma"></canvas></div></div>` : ""}
      </div>` +
        gecikmeNedenTable() +
    (az ? sapmaTable(az) : `<p class="hint">🗓️ Sapma analizi için henüz tamamlanmış (gerçekleşen tarihi dolu) kayıt yok.</p>`);
  document.getElementById("reportPaneAnaliz").innerHTML = chartBlock;
  if (typeof Chart === "undefined") return;

  const { haftaMap, haftalar } = haftaData();
  const oranlar = haftalar.map(h => {
    const g = haftaMap.get(h);
    return g.ad ? +(g.tamam / g.ad * 100).toFixed(1) : 0;
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
          borderColor: "#dc2626", backgroundColor: "#dc2626",
          borderWidth: 2.5, tension: .35, pointRadius: 4, pointHoverRadius: 6,
          pointBackgroundColor: "#fff", pointBorderColor: "#dc2626", pointBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { color: textColor, usePointStyle: true, padding: 14, font: { size: 11 } } },
        datalabels: { display: c => c.dataset.type === "line" && c.dataset.data[c.dataIndex] !== null,
          align: "top", color: "#dc2626", font: { weight: "700", size: 10.5 },
          formatter: v => "%" + v },
        tooltip: { callbacks: {
          label: c => c.dataset.yAxisID === "y1"
            ? ` Tamamlanma: %${c.parsed.y}`
            : ` ${c.dataset.label}: ${fmtN(c.parsed.y)} yükleme`
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
      .map(([k, g]) => ({ k, ort: +(g.toplam / g.n).toFixed(1) }))
      .sort((a, b) => b.ort - a.ort);
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
          tooltip: { callbacks: { label: c => ` Ortalama: ${fmtSapma(c.parsed.x)} gün ${c.parsed.x > 0 ? "(geç)" : c.parsed.x < 0 ? "(erken)" : "(zamanında)"}` } }
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => fmtSapma(v) } },
          y: { grid: { display: false }, ticks: { color: textColor, font: { size: 11, weight: "600" } } }
        }
      }
    }));
  }
}

/* ============================================================
   👷 KAPASİTE ANALİZİ (dakika bazlı gösterim)
   ============================================================ */
function kapasiteData() {
  const today = todayISO();
  const list = enriched(rows).filter(r => {
    const d = gecikmeTarihi(r);
    return d && d >= today && r.durum !== "Yükleme Tamamlandı";
  });
  const m = new Map();
  list.forEach(r => {
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
function buildKapasite() {
  const c = document.getElementById("reportPaneKapasite");
  const gunler = kapasiteData();
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

function buildReports() {
  destroyCharts();
  const list = filtered();
  const emptyMsg = `<p class="hint">Filtrelere uyan kayıt yok — filtreleri gevşetip tekrar dene.</p>`;
  document.getElementById("reportPaneGenel").innerHTML = list.length ? "" : emptyMsg;
  document.getElementById("reportPaneAnaliz").innerHTML = list.length ? "" : emptyMsg;
  document.getElementById("reportPaneDetay").innerHTML = list.length ? "" : emptyMsg;
  document.getElementById("reportPaneKapasite").innerHTML = "";
  document.getElementById("reportPaneSure").innerHTML = "";
  if (!list.length) return;
  buildGenel(list);
  buildAnaliz(list);
  buildDetay(list);
  switchReportTab(activeReportTab);
}
function switchReportTab(tab) {
  activeReportTab = tab;
  document.querySelectorAll(".rtab").forEach(b => b.classList.toggle("active", b.dataset.rtab === tab));
  document.getElementById("reportPaneGenel").classList.toggle("hidden", tab !== "genel");
  document.getElementById("reportPaneAnaliz").classList.toggle("hidden", tab !== "analiz");
  document.getElementById("reportPaneKapasite").classList.toggle("hidden", tab !== "kapasite");
  document.getElementById("reportPaneSure").classList.toggle("hidden", tab !== "sure");
  document.getElementById("reportPaneDetay").classList.toggle("hidden", tab !== "detay");
  destroyCharts();
  if (tab === "kapasite") { buildKapasite(); return; }
  if (tab === "sure") { buildSure(filtered()); return; }
  const list = filtered();
  if (!list.length) return;
  if (tab === "genel") buildGenel(list);
  else if (tab === "analiz") buildAnaliz(list);
}
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
  const data = list.map(r => {
    const b = sureBilgi(r);
    return {
      "Müşteri": r.musteri,
      "BLM": r.blm,
      "Kategori": r.kategori,
      "Sevkiyat Tipi": r.sevkiyatTipi,
      "AD": Number(r.ad) || 0,
      "Planlanan Tarih": r.planlananTarih ? formatDate(r.planlananTarih) : "",
      "Reel Plan": r.reelPlan ? formatDate(r.reelPlan) : "",
      "Gerçekleşen Tarih": r.gerceklesenTarih ? formatDate(r.gerceklesenTarih) : "",
      "Durum": r.durum,
      "Gecikme (gün)": (() => { const b = gecikmeBilgi(r); return b.gun > 0 ? b.gun : ""; })(),
      "Gecikme Nedeni": (() => { const b = gecikmeBilgi(r); return b.gun > 0 ? b.neden : ""; })(),
      "Yükleme Süresi": b.durum !== "none" ? fmtSure(b.gecenMs) : "",
      "Süre Aşımı (dk)": (b.durum !== "none" && b.asim) ? b.asimDk : "",
      "Öncelik No": r.oncelikNo ?? "",
      "Yorum (adet)": Array.isArray(r.comments) ? r.comments.length : 0,
      "Açıklama": r.aciklama || "",
      "Aracı Geldi": r.araciGeldi || "",
      "PRS M3": r.prsM3 ?? "",
      "M3": r.m3 ?? "",
      "Öncelikli": r.oncelikli ? "Evet" : "",
      "Ekleyen": r.createdBy || ""
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{wch:24},{wch:10},{wch:10},{wch:14},{wch:6},{wch:15},{wch:15},{wch:16},{wch:26},{wch:12},{wch:14},{wch:14},{wch:10},{wch:12},{wch:11},{wch:8},{wch:8},{wch:10},{wch:10},{wch:22}];
  try {
    const range = XLSX.utils.decode_range(ws["!ref"]);
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: range.e.c } }) };
  } catch (e) {}
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sevkiyat");
  XLSX.writeFile(wb, `sevkiyat_${todayISO()}.xlsx`);
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
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad2(v.getMonth()+1)}-${pad2(v.getDate())}`;
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
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
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
  load(false);
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

/* ================= Başlat ================= */
updateUserUI();
(async () => {
  renderThead();      /* 🆕 başlık satırı JS'ten üretilir — gövdeyle birebir hizalı */
  loadPrefs();
  loadKapasitePrefs();
  updateSortHeaders();
  await loadSureAyarlari();
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
  startLiveSync();
  otomatikGunlukYedek(); /* günün ilk girişli açılışında arka planda yedek */
})();
