/* ═══════════════════════════════════════════════════════════════
   📦 ORDER HAZIR — Yükleme Hazırlık Modülü
   Ayrı sayfa (order-hazir.html) · ana uygulamayla aynı Firebase
   ═══════════════════════════════════════════════════════════════ */

/* ================= Firebase yapılandırması (ana uygulamayla aynı) ================= */
const FIREBASE_DB_URL = "https://sevkiyat-app-default-rtdb.europe-west1.firebasedatabase.app".replace(/\/+$/, "");
const FIREBASE_API_KEY = "AIzaSyAagmdq0N2TG4IQ7noDFL6xQh4-ps-QrgI";
const OH_NODE = "orderhazir";                 /* günün snapshot'ı: orderhazir/{YYYY-MM-DD} */
const OH_AYAR_NODE = "orderhazir_ayarlar";    /* müşteri bazlı kriter hafızası */
const OH_SAKLAMA_GUN = 90;

/* Auth state — ana uygulamayla SHARED (aynı localStorage key) */
const AUTH_KEY = "sevkiyat_auth";
let currentUser = null;

function getAuthState() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; }
}

/* ================= Yardımcılar ================= */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function pad2(n) { return String(n).padStart(2, "0"); }
function fmtN(n) { return (Math.round(n * 100) / 100).toLocaleString("tr-TR"); }
function numOr(v, def) { return (v !== null && v !== undefined && v !== "" && !isNaN(Number(v))) ? Number(v) : def; }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function shortUser(e) { return e ? String(e).split("@")[0] : "-"; }
function toastMsg(html) {
  const t = document.getElementById("toast");
  t.innerHTML = html;
  t.classList.remove("hidden");
  clearTimeout(toastMsg._t);
  toastMsg._t = setTimeout(() => t.classList.add("hidden"), 4000);
}
function setOhError(msg) {
  const el = document.getElementById("ohError");
  el.textContent = msg;
  el.classList.toggle("hidden", !msg);
}
/* Excel hücresini sayıya çevir: "1.234,56" / "1,234.56" / 1234.56 / Date değil */
function parseNum(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && isFinite(v)) return v;
  if (v instanceof Date) return null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/\s/g, "");
  /* Hem nokta hem virgül varsa: son ayırıcı ondalıktır */
  const lastDot = s.lastIndexOf("."), lastCom = s.lastIndexOf(",");
  if (lastDot >= 0 && lastCom >= 0) {
    if (lastCom > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastCom >= 0) {
    /* Sadece virgül: 1-3 haneli son grup ise binlik, değilse ondalık */
    s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = parseFloat(s.replace(/[^\d.\-]/g, ""));
  return isFinite(n) ? n : null;
}
/* Excel tarih hücresi: Date | serial | "2026/2/7" | "2024-2-7" → ISO */
function parseExcelDate(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad2(v.getMonth()+1)}-${pad2(v.getDate())}`;
  if (typeof v === "number" && isFinite(v) && v > 20000 && v < 80000) {
    const dc = (window.XLSX && XLSX.SSF) ? XLSX.SSF.parse_date_code(v) : null;
    return dc ? `${dc.y}-${pad2(dc.m)}-${pad2(dc.d)}` : "";
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (m) return `${m[3]}-${pad2(+m[2])}-${pad2(+m[1])}`;
  return "";
}

/* ================= Alan tanımları + otomatik eşleştirme ================= */
/* label: görünür ad · kw: Excel başlık anahtar kelimeleri (normalize) */
const FIELDS = [
  { key: "musteri",        label: "Teslimat Adı (müşteri)", req: true,  kw: ["teslimat adi", "teslimat"] },
  { key: "maddeAdi",       label: "Madde adı",                          kw: ["madde adi", "madde"] },
  { key: "maddeKodu",      label: "Madde kodu",                         kw: ["madde kodu"] },
  { key: "referansNo",     label: "Referans numarası",                  kw: ["referans"] },
  { key: "siparisNo",      label: "Orijinal satış siparişi",            kw: ["orijinal satis siparisi", "orijinal", "satis siparisi"] },
  { key: "musteriSipNo",   label: "Müşteri sipariş numarası",           kw: ["musteri siparis numarasi", "musteri siparis"] },
  { key: "siparisAdi",     label: "Sipariş adı",                        kw: ["siparis adi"] },
  { key: "partiNo",        label: "Parti numarası",                     kw: ["parti"] },
  { key: "konfigNo",       label: "Konfigürasyon",                      kw: ["konfig"] },
  { key: "havuz",          label: "Havuz",                              kw: ["havuz"] },
  { key: "durum",          label: "Durum",                              kw: ["satir durumu", "durum"] },
  { key: "miktar",         label: "Miktar",                             kw: ["miktar"] },
  { key: "kalan",          label: "Kalan",                              kw: ["kalan miktari", "kalan"] },
  { key: "sevkEdilen",     label: "Sevk edilen",                        kw: ["sevk edilen", "sevk"] },
  { key: "depoStok",       label: "Fabrika Depo Stok",                  kw: ["fabrika depo stok", "depo stok"] },
  { key: "kalanM3",        label: "Kalan m³",                           kw: ["kalan m3"] },
  { key: "birimM3",        label: "Birim m³",                           kw: ["birim m3"] },
  { key: "kalanTutar",     label: "Kalan Tutar (değer)",                kw: ["kalan tutar"] },
  { key: "paraBirimi",     label: "Para birimi",                        kw: ["para birimi"] },
  { key: "sevkTarihi",     label: "Talep edilen sevk tarihi",           kw: ["talep edilen sevk tarihi", "talep edilen"] },
  { key: "satisBolgesi",   label: "Satış bölgesi",                      kw: ["satis bolgesi"] },
  { key: "olusturma",      label: "Oluşturulma tarihi",                 kw: ["olusturulma tarihi"] }
];
const KRITERLER = [
  { key: "referansNo",   label: "Referans numarası" },
  { key: "siparisNo",    label: "Orijinal satış siparişi" },
  { key: "musteriSipNo", label: "Müşteri sipariş numarası" },
  { key: "siparisAdi",   label: "Sipariş adı" }
];
function normTxt(s) {
  return String(s ?? "").toLowerCase()
    .replace(/ı/g, "i").replace(/İ/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/\s+/g, " ").trim();
}
/* Başlıkları alanlara otomatik eşleştir → { alan: excelBaslik | "" } */
function autoMap(headers) {
  const map = {};
  const used = new Set();
  const H = headers.map(h => ({ raw: h, n: normTxt(h) }));
  FIELDS.forEach(f => {
    let hit = H.find(h => !used.has(h.raw) && f.kw.some(k => h.n === k));
    if (!hit) hit = H.find(h => !used.has(h.raw) && f.kw.some(k => k.length > 4 && h.n.includes(k)));
    map[f.key] = hit ? hit.raw : "";
    if (hit) used.add(hit.raw);
  });
  return map;
}

/* ================= State ================= */
let fieldMap = {};
let importRows = [];          /* ham Excel satırları */
let snapshot = null;          /* { tarih, satirlar[], ozet } */
let gecmisCache = null;       /* [{tarih, ozet}] */

/* ================= Auth (REST — ana uygulama ile aynı desen) ================= */
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
  const st = getAuthState();
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    idToken: j.id_token, refreshToken: j.refresh_token, email: st.email,
    exp: Date.now() + Number(j.expires_in) * 1000
  }));
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
  if (!t) { clearAuthState(); showLogin("Oturum geçersiz — tekrar giriş yapın."); throw new Error("Oturum yenilenemedi"); }
  return t;
}
async function authFetch(url, opts = {}, _canRetry = true) {
  const token = await ensureToken();
  if (!token) throw new Error("Oturum bulunamadı — giriş yapın.");
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(url + sep + "auth=" + encodeURIComponent(token), {
    ...opts, headers: { ...(opts.headers || {}), Authorization: "Bearer " + token }
  });
  if (res.status === 401 && _canRetry) {
    await ensureToken(true);
    return authFetch(url, opts, false);
  }
  if (res.status === 403) throw new Error("403 — Firebase Rules'ta bu düğüme yazma izni yok.");
  return res;
}
function clearAuthState() { localStorage.removeItem(AUTH_KEY); currentUser = null; updateUserUI(); }

/* ================= Snapshot API ================= */
/* Veri modeli (satır): alanlar FIELDS'tan + _hazir (bool) hesaplanır */
async function loadSnapshotByTarih(tarih) {
  const res = await fetch(`${FIREBASE_DB_URL}/${OH_NODE}/${tarih}.json`);
  if (!res.ok) throw new Error("Snapshot okunamadı (HTTP " + res.status + ")");
  const data = await res.json();
  if (!data || !Array.isArray(data.satirlar)) return null;
  return data;
}
async function loadSnapshotKeys() {
  const res = await fetch(`${FIREBASE_DB_URL}/${OH_NODE}.json?shallow=true`);
  const data = await res.json();
  return data ? Object.keys(data).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().reverse() : [];
}
async function saveSnapshot(tarih, satirlar, meta) {
  const ozet = hesaplaGenelOzet(satirlar);
  const body = { tarih, ts: Date.now(), uploadedBy: currentUser ? currentUser.email : "", meta: meta || {}, ozet, satirlar };
  await authFetch(`${FIREBASE_DB_URL}/${OH_NODE}/${tarih}.json`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  /* 🧹 Budama: OH_SAKLAMA_GUN gün eskisini sil */
  try {
    const keys = await loadSnapshotKeys();
    const sinir = new Date(); sinir.setDate(sinir.getDate() - OH_SAKLAMA_GUN);
    const sinirIso = `${sinir.getFullYear()}-${pad2(sinir.getMonth()+1)}-${pad2(sinir.getDate())}`;
    for (const k of keys) {
      if (k < sinirIso) {
        try { await authFetch(`${FIREBASE_DB_URL}/${OH_NODE}/${k}.json`, { method: "DELETE" }); } catch (e) {}
      }
    }
  } catch (e) { console.warn("Budama atlandı:", e.message); }
}
/* Günlük özet satırı: tarih×müşteri (geçmiş raporu için hafif) */
async function saveOzet(satirlar) {
  const musteriler = [...new Set(satirlar.map(r => r.musteri || "-"))];
  const body = {};
  musteriler.forEach(m => { body[normTxt(m).replace(/[.#$\[\]\/]/g, "_")] = mOzet(m, satirlar, todayISO()); });
  await authFetch(`${FIREBASE_DB_URL}/${OH_NODE}/_ozet/${todayISO()}.json`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
}

/* ================= Kriter hafızası (müşteri bazlı) ================= */
async function loadAyarlar() {
  try {
    const res = await fetch(`${FIREBASE_DB_URL}/${OH_AYAR_NODE}.json`);
    return await res.json() || {};
  } catch { return {}; }
}
async function saveAyar(musteri, kriter) {
  if (!currentUser || !musteri) return;
  try {
    await authFetch(`${FIREBASE_DB_URL}/${OH_AYAR_NODE}/${encodeURIComponent(musteri)}.json`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kriter, updatedBy: currentUser.email, ts: Date.now() })
    });
  } catch (e) { console.warn("Ayar kaydedilemedi:", e.message); }
}

/* ================= LOGIN UI ================= */
function showLogin(msg) {
  const err = document.getElementById("loginError");
  if (msg) { err.textContent = msg; err.classList.remove("hidden"); }
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
  const btn = document.getElementById("btnYukle");
  if (currentUser) {
    box.innerHTML = `<span class="user-chip">👤 ${esc(shortUser(currentUser.email))}</span>
      <button class="btn" id="btnLogout">Çıkış</button>`;
    document.getElementById("btnLogout").addEventListener("click", () => {
      clearAuthState(); toastMsg("👋 Çıkış yapıldı.");
    });
    btn.disabled = false;
  } else {
    box.innerHTML = `<span class="guest-chip">👁️ Görüntüleme</span>
      <button class="btn primary" id="btnLoginOpen">🔐 Giriş</button>`;
    document.getElementById("btnLoginOpen").addEventListener("click", () => showLogin(""));
    btn.disabled = true;
    btn.title = "Excel yükleme için giriş yapın";
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
    if (!res.ok) {
      const m = /EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS/.test(j.error?.message || "")
        ? "E-posta veya şifre hatalı." : "Giriş başarısız: " + (j.error?.message || "");
      err.textContent = m; err.classList.remove("hidden"); return;
    }
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      idToken: j.idToken, refreshToken: j.refreshToken, email: j.email,
      exp: Date.now() + Number(j.expiresIn) * 1000
    }));
    currentUser = { email: j.email };
    updateUserUI(); hideLogin();
    toastMsg("✅ Giriş yapıldı — Excel yükleyebilirsiniz.");
  } catch (e) {
    err.textContent = "Bağlantı hatası: " + e.message; err.classList.remove("hidden");
  } finally { btn.disabled = false; btn.textContent = "Giriş yap"; }
}
