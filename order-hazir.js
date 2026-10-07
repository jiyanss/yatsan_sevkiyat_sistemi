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
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/³/g, "3")
    .replace(/\s+/g, " ").trim();
}
/* Başlıkları alanlara otomatik eşleştir → { alan: excelBaslik | "" } */
function autoMap(headers) {
  const map = {};
  const used = new Set();
  const H = headers.map(h => ({ raw: h, n: normTxt(h).replace(/\s+/g, "") }));
  FIELDS.forEach(f => {
    let hit = H.find(h => !used.has(h.raw) && f.kw.some(k => h.n === k.replace(/\s+/g, "")));
    if (!hit) hit = H.find(h => !used.has(h.raw) && f.kw.some(k => k.length > 4 && h.n.includes(k.replace(/\s+/g, ""))));
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
    const sid = Date.now().toString(36);
  const body = { tarih, ts: Date.now(), uploadedBy: currentUser ? currentUser.email : "", meta: { ...(meta || {}), sid }, ozet, satirlar };
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
/* ═══════════════ 🧮 HAZIR MOTORU ═══════════════ */

/* Satır hazır: Kalan > 0 VE Fabrika Depo Stok ≥ Kalan */
function satirHazir(r) {
  const kalan = numOr(r.kalan, null);
  if (kalan == null || kalan <= 0) return false;
  const stok = numOr(r.depoStok, null);
  if (stok == null) return false;
  return stok >= kalan;
}
function satirKapali(r) { return numOr(r.kalan, 0) <= 0; }

function satirDurumHtml(r) {
  if (satirKapali(r)) return `<span class="oh-muted">✔ Kapandı (kalan 0)</span>`;
  if (r._hazir) return `<span class="oh-ok">✓ Hazır</span>`;
  return `<span class="oh-no">✖ Eksik (stok ${numOr(r.depoStok, "-")} &lt; kalan ${numOr(r.kalan, "-")})</span>`;
}

/* Kriter değeri bazlı gruplama; durum/kapalı satırlar detayda kalır */
/* Birim m³: Excel'deki Birim m³ yoksa Kalan m³ ÷ Kalan'dan türet */
function satirBirimM3(r) {
  let b = numOr(r.birimM3, null);
  if (b == null) {
    const k = numOr(r.kalan, 0), m3 = numOr(r.kalanM3, null);
    if (m3 != null && k > 0) b = m3 / k;
  }
  return (b != null && isFinite(b)) ? b : 0;
}
/* X adet sevk edilecekse m³ (adet boşsa tam kalan) */
function satirM3(r, adet) {
  return +(satirBirimM3(r) * (adet == null ? numOr(r.kalan, 0) : adet)).toFixed(2);
}
/* X adetlik satır tutarı (kalanTutar tam kalana aitse orantıla) */
function satirTutar(r, adet) {
  const k = numOr(r.kalan, 0), t = numOr(r.kalanTutar, null);
  if (t == null) return 0;
  const a = (adet == null) ? k : adet;
  return (k > 0 && a !== k) ? +(t / k * a).toFixed(2) : t;
}

function gruplandir(satirlar, kriter) {
  const m = new Map();
  satirlar.forEach(r => {
    const mus = (r.musteri || "").trim() || "(müşteri yok)";
    const ck = String(r[kriter] || "").trim() || "(boş)";
    const key = mus + " ∥ " + ck;   /* ⬅ Firma + Kriter: firmalar karışmaz */
    if (!m.has(key)) m.set(key, { key, ck, musteri: mus, satirlar: [] });
    m.get(key).satirlar.push(r);
  });
  return [...m.values()].map(g => {
    const aktif = g.satirlar.filter(r => !satirKapali(r));
    g.aktif = aktif;
    const hazirS = aktif.filter(r => r._hazir);
    g.toplamKalan = aktif.reduce((s, r) => s + numOr(r.kalan, 0), 0);
    g.hazirAdet = hazirS.reduce((s, r) => s + numOr(r.kalan, 0), 0);
    g.oran = g.toplamKalan > 0 ? Math.round(g.hazirAdet / g.toplamKalan * 100) : 0;
    g.hazirM3 = +(hazirS.reduce((s, r) => s + satirM3(r), 0)).toFixed(2);
    g.hazirDeger = {};
    hazirS.forEach(r => {
      const cur = (r.paraBirimi || "").trim().toUpperCase() || "DİĞER";
      g.hazirDeger[cur] = (g.hazirDeger[cur] || 0) + satirTutar(r);
    });
    g.cakismaMadde = [];
    return g;
  });
}

function grupDurumu(g, esik) {
  if (!g.aktif.length) return "kapandi";
  if (g.oran >= esik) return "hazir";
  if (g.oran > 0) return "kismi";
  return "bekliyor";
}

/* Stok çakışması: aynı madde birden fazla grupta "hazır" ise ve toplam talep > stok */
function stokCakismaTespit(gruplar) {
  const talep = new Map();
  gruplar.forEach(g => {
    g.aktif.forEach(r => {
      const mk = String(r.maddeKodu || r.maddeAdi || "").trim();
      if (!mk) return;
      if (!talep.has(mk)) talep.set(mk, { stok: null, talep: 0, gruplar: new Set() });
      const t = talep.get(mk);
      const st = numOr(r.depoStok, null);
      if (st != null) t.stok = (t.stok == null) ? st : Math.max(t.stok, st);
      if (r._hazir) { t.talep += numOr(r.kalan, 0); t.gruplar.add(g.key); }
    });
  });
  const cakisan = new Set();
  talep.forEach((t, mk) => {
    if (t.gruplar.size > 1 && t.stok != null && t.talep > t.stok)
      t.gruplar.forEach(gk => cakisan.add(gk + "::" + mk));
  });
  gruplar.forEach(g => {
    g.aktif.forEach(r => {
      const mk = String(r.maddeKodu || r.maddeAdi || "").trim();
      if (mk && r._hazir && cakisan.has(g.key + "::" + mk)) g.cakismaMadde.push(mk);
    });
  });
}

const DURUM_SIRA_OH = { hazir: 0, kismi: 1, bekliyor: 2, kapandi: 3 };
function durumLabel(d) {
  return { hazir: "🟢 HAZIR", kismi: "🟡 KISMİ", bekliyor: "🔴 BEKLİYOR", kapandi: "✔ Kapandı" }[d] || d;
}

/* Hesapla + filtrele + sırala (render ve export ortak kullanır) */
function hesaplaGruplar(list, kriter, esik) {
  const tumu = gruplandir(list, kriter);
  stokCakismaTespit(tumu);
  tumu.forEach(g => { g.durum = grupDurumu(g, esik); });
  const durumFiltre = document.getElementById("durumSec").value;
  let gruplar = tumu.filter(g => g.durum !== "kapandi");
  if (durumFiltre !== "all") gruplar = gruplar.filter(g => g.durum === durumFiltre);
  gruplar.sort((a, b) =>
    (DURUM_SIRA_OH[a.durum] - DURUM_SIRA_OH[b.durum]) ||
    (b.oran - a.oran) || (b.hazirM3 - a.hazirM3) ||
    String(a.key).localeCompare(String(b.key), "tr"));
  return { tumu, gruplar };
}

function firmaOzetiHesapla(gruplar, esik) {
  const m = new Map();
  gruplar.forEach(g => {
    if (!m.has(g.musteri)) m.set(g.musteri, { musteri: g.musteri, hazir: 0, kismi: 0, bekliyor: 0, adet: 0, m3: 0, deger: {} });
    const f = m.get(g.musteri);
    const d = grupDurumu(g, esik);
    if (d === "hazir") {
      f.hazir++; f.adet += g.hazirAdet; f.m3 += g.hazirM3;
      Object.entries(g.hazirDeger).forEach(([c, v]) => { f.deger[c] = (f.deger[c] || 0) + v; });
    }
    else if (d === "kismi") f.kismi++;
    else if (d === "bekliyor") f.bekliyor++;
  });
  return [...m.values()].sort((a, b) => (b.hazir - a.hazir) || (b.m3 - a.m3) ||
    String(a.musteri).localeCompare(String(b.musteri), "tr"));
}

/* Snapshot kaydına gömülen hafif genel özet (PART 1 saveSnapshot bunu çağırır) */
function hesaplaGenelOzet(satirlar) {
  const aktif = satirlar.filter(r => !satirKapali(r));
  const hazir = aktif.filter(r => r._hazir);
  return {
    satir: satirlar.length, aktifSatir: aktif.length, hazirSatir: hazir.length,
    hazirAdet: hazir.reduce((s, r) => s + numOr(r.kalan, 0), 0),
    hazirM3: +(hazir.reduce((s, r) => s + numOr(r.kalanM3, 0), 0)).toFixed(2)
  };
}

/* Günlük müşteri özeti (_ozet düğümü — geçmiş raporu bunda okur) */
function mOzet(musteri, satirlar, tarih, kriter = "referansNo") {
  const rs = satirlar.filter(r => (r.musteri || "").trim().toLowerCase() === String(musteri).trim().toLowerCase());
  const aktif = rs.filter(r => !satirKapali(r));
  const hazir = aktif.filter(r => r._hazir);
  const gMap = new Map();
  aktif.forEach(r => {
    const key = String(r[kriter] || "").trim() || "(boş)";
    if (!gMap.has(key)) gMap.set(key, { toplam: 0, hazir: 0 });
    const g = gMap.get(key);
    g.toplam += numOr(r.kalan, 0);
    if (r._hazir) g.hazir += numOr(r.kalan, 0);
  });
  let hazirGrup = 0;
  gMap.forEach(g => { if (g.toplam > 0 && g.hazir >= g.toplam) hazirGrup++; });
  const deger = {};
  hazir.forEach(r => {
    const cur = (r.paraBirimi || "").trim().toUpperCase() || "DİĞER";
    deger[cur] = (deger[cur] || 0) + numOr(r.kalanTutar, 0);
  });
  return {
    musteri, tarih, satir: rs.length, aktifSatir: aktif.length, hazirSatir: hazir.length,
    hazirAdet: hazir.reduce((s, r) => s + numOr(r.kalan, 0), 0),
    hazirM3: +(hazir.reduce((s, r) => s + numOr(r.kalanM3, 0), 0)).toFixed(2),
    hazirGrup, deger
  };
}

/* ═══════════════ 🧠 KRİTER (müşteri bazlı hafıza) ═══════════════ */
let ayarlar = {};
let snapshotKeys = [];
let sonKriter = localStorage.getItem("oh_son_kriter") || "referansNo";
const expandedGrup = new Set();
let currentView = "grup";

/* PART 1'deki saveAyar'ın anahtar kodlaması düzeltilmiş sürümü
   (Firebase anahtarları "." içermemeli — şirket adlarında S.R.O vb. var) */
function fbKey(s) { return encodeURIComponent(String(s || "")).replace(/\./g, "%2E"); }
async function saveAyar(musteri, kriter) {
  if (!currentUser || !musteri) return;
  try {
    await authFetch(`${FIREBASE_DB_URL}/${OH_AYAR_NODE}/${fbKey(musteri)}.json`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kriter, musteri, updatedBy: currentUser.email, ts: Date.now() })
    });
  } catch (e) { console.warn("Ayar kaydedilemedi:", e.message); }
}
function hatirlananKriter(musteri) {
  if (!musteri || !ayarlar) return null;
  const e = ayarlar[fbKey(musteri)];
  return (e && e.kriter) ? e.kriter : null;
}
function cozKriter() {
  const sel = document.getElementById("kriterSec").value;
  if (sel !== "auto") return sel;
  const mus = document.getElementById("musteriSec").value.trim();
  if (mus) { const k = hatirlananKriter(mus); if (k) return k; }
  return sonKriter;
}
function kriterLabel(k) { const f = KRITERLER.find(x => x.key === k); return f ? f.label : k; }

/* ═══════════════ 🖥️ RENDER ═══════════════ */
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function getEsik() {
  let v = Number(document.getElementById("esik").value);
  if (!isFinite(v)) v = 100;
  v = Math.max(50, Math.min(100, Math.round(v)));
  return v;
}
function fmtDeger(d) {
  if (!d || !Object.keys(d).length) return `<span class="oh-muted">-</span>`;
  return Object.entries(d).sort().map(([c, v]) =>
    `<span class="oh-cur">${esc(c)}</span>${fmtN(v)}`).join(" · ");
}
function searchHay(r) {
  return [r.maddeAdi, r.maddeKodu, r.referansNo, r.siparisNo, r.musteriSipNo,
          r.siparisAdi, r.partiNo, r.konfigNo, r.musteri, r.havuz]
    .map(x => String(x ?? "").toLowerCase()).join(" ");
}
function aktifSatirlar() {
  let list = (snapshot && Array.isArray(snapshot.satirlar)) ? snapshot.satirlar.slice() : [];
  const mus = document.getElementById("musteriSec").value.trim().toLowerCase();
  const havuz = document.getElementById("havuzSec").value;
  const q = document.getElementById("ara").value.trim().toLowerCase();
  if (mus) list = list.filter(r => (r.musteri || "").toLowerCase().includes(mus));
  if (havuz) list = list.filter(r => (r.havuz || "") === havuz);
  if (q) list = list.filter(r => searchHay(r).includes(q));
  return list;
}

let sonGruplar = [];
function render() {
  const list = aktifSatirlar();
  const kriter = cozKriter();
  const esik = getEsik();
  const { gruplar } = hesaplaGruplar(list, kriter, esik);
  siralaGruplar(gruplar, document.getElementById("siraSec").value);
  sonGruplar = gruplar;
  const hazirGruplar = gruplar.filter(g => g.durum === "hazir");
  const degerTop = {};
  hazirGruplar.forEach(g => Object.entries(g.hazirDeger).forEach(([c, v]) => { degerTop[c] = (degerTop[c] || 0) + v; }));
  document.getElementById("st-satir").textContent = fmtN(list.length);
  document.getElementById("st-aktif").textContent = fmtN(gruplar.length);
  document.getElementById("st-hazir").textContent = fmtN(hazirGruplar.length);
  document.getElementById("st-m3").textContent = fmtN(hazirGruplar.reduce((s, g) => s + g.hazirM3, 0));
  document.getElementById("st-deger").innerHTML = Object.keys(degerTop).length ? fmtDeger(degerTop) : "—";
  if (currentView === "firma") renderFirmaView(gruplar, esik);
  else renderGrupView(list, kriter, esik, gruplar);
}

function renderGrupView(list, kriter, esik, gruplar) {
  const th = document.getElementById("ohThead");
  th.innerHTML = `<th title="Grubun tüm aktif satırlarını yükleme listesine ekle/çıkar">📦</th>
    <th>Durum</th><th>${esc(kriterLabel(kriter))}${document.getElementById("kriterSec").value === "auto" ? " <span style='opacity:.6'>(otomatik)</span>" : ""}</th>
    <th>Müşteri</th><th class="center">Satır</th><th class="center">Aktif</th>
    <th class="center">Hazır / Kalan (adet)</th><th class="center">Hazırlık %</th>
    <th class="center">Hazır m³</th><th>Değer (hazır)</th><th class="center">⚠</th>`;
  const tb = document.getElementById("ohTbody");
  if (!snapshot) { tb.innerHTML = `<tr><td colspan="11" class="empty">Henüz snapshot yok — <b>📥 Excel Yükle</b> ile başlayın.</td></tr>`; return; }
  if (!list.length) { tb.innerHTML = `<tr><td colspan="11" class="empty">Filtrelere uyan kayıt yok.</td></tr>`; return; }
  let html = "";
  gruplar.forEach(g => {
    const gkey = fbKey(g.ck) + "~" + fbKey(g.musteri);
    const secN = g.aktif.filter(r => sepetVar(r._rid)).length;
    const tumu = g.aktif.length > 0 && secN === g.aktif.length;
    const warn = g.cakismaMadde.length
      ? `<span class="oh-warn" title="Stok çakışması: ${esc(g.cakismaMadde.slice(0, 5).join(", "))}${g.cakismaMadde.length > 5 ? "…" : ""}">⚠ ${g.cakismaMadde.length}</span>` : "";
    html += `<tr class="oh-grup ${g.durum}" data-gkey="${esc(gkey)}">
      <td class="center"><input type="checkbox" class="oh-selall" data-gkey="${esc(gkey)}"
        ${tumu ? "checked" : ""} ${secN > 0 && !tumu ? 'style="opacity:.5"' : ""} title="Tümünü seç (${secN}/${g.aktif.length} listede)" /></td>
      <td><span class="oh-badge ${g.durum}">${durumLabel(g.durum)}</span></td>
      <td class="oh-strong">${esc(g.ck)}</td>
      <td>${esc(g.musteri)}</td>
      <td class="center">${g.satirlar.length}</td>
      <td class="center">${g.aktif.length}</td>
      <td class="center">${fmtN(g.hazirAdet)} / ${fmtN(g.toplamKalan)}</td>
      <td class="center oh-strong">%${g.oran}</td>
      <td class="center">${fmtN(g.hazirM3)}</td>
      <td>${fmtDeger(g.hazirDeger)}</td>
      <td class="center">${warn || "-"}</td>
    </tr>`;
    if (expandedGrup.has(gkey)) html += renderDetay(g);
  });
  tb.innerHTML = html;
}

function renderDetay(g) {
  const sira = (a, b) =>
    String(a.olusturma || "9999-12-31").localeCompare(String(b.olusturma || "9999-12-31")) ||
    String(a.partiNo || "").localeCompare(String(b.partiNo || ""), "tr") ||
    (b.kalan || 0) - (a.kalan || 0);
  const rows = g.satirlar.slice().sort(sira).map(r => `<tr>
    <td class="center"><input type="checkbox" class="oh-sel" data-rid="${esc(String(r._rid))}" ${sepetVar(r._rid) ? "checked" : ""} title="Yükleme listesine ekle/çıkar" /></td>
    <td class="oh-strong">${esc(r.maddeKodu || "-")}</td>
    <td>${esc(r.maddeAdi || "-")}</td>
    <td>${esc(r.partiNo || "-")}</td>
    <td>${esc(r.konfigNo || "-")}</td>
    <td>${esc(r.siparisNo || "-")}</td>
    <td>${esc(r.referansNo || "-")}</td>
    <td>${esc(r.musteriSipNo || "-")}</td>
    <td class="center">${numOr(r.miktar, "-")}</td>
    <td class="center oh-strong">${numOr(r.kalan, "-")}</td>
    <td class="center">${numOr(r.depoStok, "-")}</td>
    <td class="center">${fmtN(satirBirimM3(r) || 0)}</td>
    <td class="center">${numOr(r.kalanM3, "-")}</td>
    <td class="center">${numOr(r.kalanTutar, "-")}</td>
    <td class="center">${esc((r.paraBirimi || "-").toUpperCase())}</td>
    <td>${esc(r.havuz || "-")}</td>
    <td>${esc(r.sevkTarihi || "-")}</td>
    <td>${satirDurumHtml(r)}</td>
  </tr>`).join("");
  return `<tr class="oh-detay"><td colspan="11"><div class="oh-detay-inner"><table>
    <thead><tr><th>📦</th><th>Madde kodu</th><th>Madde adı</th><th>Parti</th><th>Konfig</th><th>Satış siparişi</th><th>Referans</th><th>Müşteri sip. no</th><th>Miktar</th><th>Kalan</th><th>Depo Stok</th><th>Birim m³</th><th>Kalan m³</th><th>Kalan Tutar</th><th>PB</th><th>Havuz</th><th>Sevk tarihi</th><th>Sonuç</th></tr></thead>
    <tbody>${rows}</tbody></table></div></td></tr>`;
}
function renderFirmaView(gruplar, esik) {
  const th = document.getElementById("ohThead");
  th.innerHTML = `<th>Firma (Teslimat Adı)</th><th class="center">🟢 Hazır Grup</th><th class="center">🟡 Kısmi</th>
    <th class="center">🔴 Bekleyen</th><th class="center">Hazır Adet</th><th class="center">Hazır m³</th>
    <th>EUR</th><th>TRY</th><th>USD</th><th>Diğer PB</th>`;
  const tb = document.getElementById("ohTbody");
  if (!gruplar.length) {
    tb.innerHTML = `<tr><td colspan="10" class="empty">Filtrelere uyan grup yok.</td></tr>`;
    return;
  }
  const firmalar = firmaOzetiHesapla(gruplar, esik);
  tb.innerHTML = firmalar.map(f => {
    const d = { ...f.deger };
    const eur = d["EUR"]; delete d["EUR"];
    const tri = d["TRY"]; delete d["TRY"];
    const usd = d["USD"]; delete d["USD"];
    const diger = Object.keys(d).length ? fmtDeger(d) : `<span class="oh-muted">-</span>`;
    const cell = v => (v != null && v !== undefined) ? fmtN(v) : `<span class="oh-muted">-</span>`;
    return `<tr>
      <td class="oh-strong">${esc(f.musteri)}</td>
      <td class="center"><span class="oh-badge hazir">${f.hazir}</span></td>
      <td class="center"><span class="oh-badge kismi">${f.kismi}</span></td>
      <td class="center"><span class="oh-badge bekliyor">${f.bekliyor}</span></td>
      <td class="center">${fmtN(f.adet)}</td>
      <td class="center oh-strong">${fmtN(f.m3)}</td>
      <td class="center">${cell(eur)}</td><td class="center">${cell(tri)}</td><td class="center">${cell(usd)}</td>
      <td>${diger}</td>
    </tr>`;
  }).join("");
}

/* ═══════════════ Filtre seçenekleri + snapshot yükleme ═══════════════ */
function buildFiltreSecenekleri() {
  const musteriler = [...new Set((snapshot.satirlar || []).map(r => r.musteri).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  document.getElementById("musteri-list").innerHTML = musteriler.map(m => `<option value="${esc(m)}">`).join("");
  const havuzlar = [...new Set((snapshot.satirlar || []).map(r => (r.havuz || "").trim()).filter(Boolean))].sort();
  document.getElementById("havuzSec").innerHTML =
    `<option value="">Havuz: Tümü</option>` + havuzlar.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join("");
}
async function refreshTarihListesi() {
  try { snapshotKeys = await loadSnapshotKeys(); } catch (e) { snapshotKeys = []; }
  const sel = document.getElementById("tarihSec");
  if (!snapshotKeys.length) { sel.innerHTML = `<option value="">Snapshot yok</option>`; return; }
  sel.innerHTML = snapshotKeys.map(k => `<option value="${k}">${k}${k === todayISO() ? " (bugün)" : ""}</option>`).join("");
}
async function loadSnapshot(tarih) {
  setOhError("");
  if (!tarih) { snapshot = null; render(); return; }
  try {
    const data = await loadSnapshotByTarih(tarih);
    if (!data) { snapshot = null; render(); return; }
    snapshot = data;
     const sid = (snapshot.meta && snapshot.meta.sid) ? snapshot.meta.sid : snapshot.tarih;
    (snapshot.satirlar || []).forEach((r, i) => { r._hazir = satirHazir(r); r._rid = sid + "#" + i; });
    expandedGrup.clear();
    buildFiltreSecenekleri();
    render();
  } catch (e) { setOhError("Snapshot yüklenemedi: " + e.message); }
}

/* ═══════════════ 📥 EXCEL YÜKLEME ═══════════════ */
function mapRowToOh(row) {
  const g = k => fieldMap[k] ? row[fieldMap[k]] : "";
  const NUM = ["miktar", "kalan", "sevkEdilen", "depoStok", "kalanM3", "birimM3", "kalanTutar"];
  const TARIH = ["sevkTarihi", "olusturma"];
  const r = {};
  FIELDS.forEach(f => {
    const raw = g(f.key);
    if (NUM.includes(f.key)) r[f.key] = parseNum(raw);
    else if (TARIH.includes(f.key)) r[f.key] = parseExcelDate(raw);
    else r[f.key] = String(raw ?? "").trim();
  });
  /* m³ tutarlılığı: Birim m³ = Kalan m³ ÷ Kalan — biri eksikse diğerinden türet */
  const k = numOr(r.kalan, 0);
  if (r.kalanM3 == null && r.birimM3 != null && k > 0) r.kalanM3 = +(r.birimM3 * k).toFixed(4);
  if (r.birimM3 == null && r.kalanM3 != null && k > 0) r.birimM3 = +(r.kalanM3 / k).toFixed(4);
  r._hazir = satirHazir(r);
  return r;
}
function openYukle() {
  if (!currentUser) { showLogin("Excel yükleme için giriş yapın."); return; }
  if (typeof XLSX === "undefined") { alert("Excel kütüphanesi (CDN) yüklenemedi."); return; }
  document.getElementById("yukleModal").classList.remove("hidden");
}
function closeYukle() {
  document.getElementById("yukleModal").classList.add("hidden");
  document.getElementById("ohMapPreview").classList.add("hidden");
  document.getElementById("ohYukleSonuc").classList.add("hidden");
  document.getElementById("ohFile").value = "";
  importRows = []; fieldMap = {};
}
document.getElementById("ohFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    importRows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
    if (!importRows.length) { alert("Dosyada veri satırı bulunamadı."); return; }
    fieldMap = autoMap(Object.keys(importRows[0]));
    /* Önizleme */
    const mapRows = FIELDS.map(f => {
      const hit = fieldMap[f.key];
      const zor = f.req && !hit;
      return `<tr><td ${zor ? 'class="oh-no"' : ""}>${esc(f.label)}</td><td>${hit ? esc(hit) : (zor ? '<span class="oh-no">⚠ eşleşmedi (zorunlu)</span>' : '<span class="oh-muted">—</span>')}</td></tr>`;
    }).join("");
    const prevRows = importRows.slice(0, 5).map(mapRowToOh).map(r => `<tr>
      <td>${esc(r.musteri || "-")}</td><td>${esc(r.siparisNo || "-")}</td>
      <td class="center">${numOr(r.kalan, "-")}</td><td class="center">${numOr(r.depoStok, "-")}</td>
      <td class="center">${numOr(r.kalanM3, "-")}</td><td class="center">${numOr(r.kalanTutar, "-")}</td>
      <td class="center">${esc((r.paraBirimi || "-").toUpperCase())}</td><td>${satirDurumHtml(r)}</td>
    </tr>`).join("");
    document.getElementById("ohMapTable").innerHTML =
      `<thead><tr><th>Alan</th><th>Excel kolonu</th></tr></thead><tbody>${mapRows}</tbody>
       <thead><tr class="prev-head"><th colspan="8">İlk 5 satır önizleme</th></tr>
       <tr><th>Müşteri</th><th>Satış siparişi</th><th>Kalan</th><th>Depo Stok</th><th>Kalan m³</th><th>Kalan Tutar</th><th>PB</th><th>Sonuç</th></tr></thead>
       <tbody>${prevRows}</tbody>`;
    document.getElementById("ohMapPreview").classList.remove("hidden");
  } catch (err) { alert("Dosya okunamadı: " + err.message); }
});
document.getElementById("btnOhKaydet").addEventListener("click", async () => {
  if (!currentUser) { showLogin("Kaydetmek için giriş yapın."); return; }
  if (!importRows.length) { alert("Önce dosya seçin."); return; }
  const eksik = FIELDS.filter(f => f.req && !fieldMap[f.key]);
  if (eksik.length) { alert("Zorunlu kolon eşleşmedi: " + eksik.map(f => f.label).join(", ")); return; }
  const satirlar = importRows.map(mapRowToOh).filter(r => (r.musteri || "").trim());
  if (!satirlar.length) { alert("Geçerli satır yok (Teslimat Adı kolonu boş görünüyor)."); return; }
  if (!confirm(`${satirlar.length} satır bugünün (${todayISO()}) snapshot'ına yazılacak.\nAynı gün tekrar yüklerseniz üzerine yazar. Devam?`)) return;
  const btn = document.getElementById("btnOhKaydet");
  btn.disabled = true; btn.textContent = "Yazılıyor…";
  try {
    satirlar.forEach(r => { r._hazir = satirHazir(r); });
    await saveSnapshot(todayISO(), satirlar, { dosya: document.getElementById("ohFile").files[0]?.name || "", satirSayisi: satirlar.length });
    await saveOzet(satirlar);
    await refreshTarihListesi();
    document.getElementById("tarihSec").value = todayISO();
    await loadSnapshot(todayISO());
    const res = document.getElementById("ohYukleSonuc");
    res.textContent = `✅ ${satirlar.length} satır kaydedildi (${todayISO()}) — hazır satır: ${satirlar.filter(r => r._hazir).length}`;
    res.classList.remove("hidden");
    toastMsg("✅ Snapshot kaydedildi.");
  } catch (e) { alert("Kaydedilemedi: " + e.message); }
  btn.disabled = false; btn.textContent = "💾 Kaydet (bugünün snapshot'ı)";
});
document.getElementById("btnOhVazgec").addEventListener("click", closeYukle);
document.getElementById("yukleModal").addEventListener("click", e => { if (e.target === e.currentTarget) closeYukle(); });

/* ═══════════════ 🕘 GEÇMİŞ RAPORU ═══════════════ */
async function openGecmis() {
  document.getElementById("gecmisModal").classList.remove("hidden");
  document.getElementById("gecmisTbody").innerHTML = `<tr><td colspan="10" class="empty">Yükleniyor…</td></tr>`;
  try {
    const res = await fetch(`${FIREBASE_DB_URL}/${OH_NODE}/_ozet.json`);
    gecmisCache = (await res.json()) || {};
  } catch (e) { gecmisCache = {}; }
  renderGecmis();
}
function renderGecmis() {
  const q = normTxt(document.getElementById("gecmisMusteri").value);
  const rows = [];
  Object.entries(gecmisCache || {}).forEach(([tarih, musMap]) => {
    Object.values(musMap || {}).forEach(o => {
      if (q && !normTxt(o.musteri || "").includes(q)) return;
      rows.push({ tarih, ...(o || {}) });
    });
  });
  rows.sort((a, b) => String(b.tarih).localeCompare(String(a.tarih)));
  const tb = document.getElementById("gecmisTbody");
  if (!rows.length) { tb.innerHTML = `<tr><td colspan="10" class="empty">Kayıt yok — önce Excel yükleyin.</td></tr>`; return; }
  tb.innerHTML = rows.slice(0, 400).map(o => {
    const d = { ...(o.deger || {}) };
    const g = c => { const v = d[c]; delete d[c]; return (v != null) ? fmtN(v) : `<span class="oh-muted">-</span>`; };
    const diger = Object.keys(d).length ? Object.entries(d).map(([c, v]) => `${esc(c)} ${fmtN(v)}`).join(" · ") : `<span class="oh-muted">-</span>`;
    return `<tr>
      <td class="oh-strong">${esc(o.tarih)}</td><td>${esc(o.musteri || "-")}</td>
      <td class="center"><span class="oh-badge hazir">${o.hazirGrup ?? "-"}</span></td>
      <td class="center">${o.hazirSatir ?? "-"} / ${o.aktifSatir ?? "-"}</td>
      <td class="center">${o.hazirAdet ?? "-"}</td><td class="center oh-strong">${o.hazirM3 ?? "-"}</td>
      <td class="center">${g("EUR")}</td><td class="center">${g("TRY")}</td><td class="center">${g("USD")}</td>
      <td>${diger}</td></tr>`;
  }).join("");
}
document.getElementById("btnGecmis").addEventListener("click", openGecmis);
document.getElementById("btnGecmisKapat").addEventListener("click", () =>
  document.getElementById("gecmisModal").classList.add("hidden"));
document.getElementById("gecmisModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});
document.getElementById("gecmisMusteri").addEventListener("input", debounce(renderGecmis, 250));

/* ═══════════════ 📤 EXCEL RAPOR ═══════════════ */
const H_FILL = { pattern: "solid", fgColor: { rgb: "1E293B" } };
const H_FONT = { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } };
function styleHeader(ws) {
  try {
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let C = range.s.c; C <= range.e.c; C++) {
      const a = XLSX.utils.encode_cell({ r: 0, c: C });
      if (ws[a]) ws[a].s = { fill: H_FILL, font: H_FONT, alignment: { horizontal: "center" } };
    }
  } catch (e) {}
}
function exportExcelRapor() {
  if (typeof XLSX === "undefined") { alert("Excel kütüphanesi yüklenemedi."); return; }
  if (!snapshot) { alert("Önce bir snapshot yükleyin."); return; }
  const list = aktifSatirlar();
  const kriter = cozKriter(); const esik = getEsik();
  const { gruplar } = hesaplaGruplar(list, kriter, esik);
  const kLabel = kriterLabel(kriter);

  const gHead = ["Durum", kLabel, "Müşteri", "Satır", "Aktif", "Hazır Adet", "Kalan Adet", "Hazırlık %", "Hazır m³", "EUR", "TRY", "USD", "Diğer PB", "⚠ Çakışan Madde"];
  const gRows = gruplar.map(g => {
    const d = { ...g.hazirDeger };
    const eur = d["EUR"] ?? ""; delete d["EUR"];
    const tri = d["TRY"] ?? ""; delete d["TRY"];
    const usd = d["USD"] ?? ""; delete d["USD"];
    const diger = Object.entries(d).map(([c, v]) => `${c} ${fmtN(v)}`).join(" · ");
    return [durumLabel(g.durum), g.key, g.musteri, g.satirlar.length, g.aktif.length,
      g.hazirAdet, g.toplamKalan, g.oran, g.hazirM3, eur, tri, usd, diger, g.cakismaMadde.join(", ")];
  });

  const firmalar = firmaOzetiHesapla(gruplar, esik);
  const fHead = ["Firma", "🟢 Hazır Grup", "🟡 Kısmi", "🔴 Bekleyen", "Hazır Adet", "Hazır m³", "EUR", "TRY", "USD", "Diğer PB"];
  const fRows = firmalar.map(f => {
    const d = { ...f.deger };
    const eur = d["EUR"] ?? ""; delete d["EUR"];
    const tri = d["TRY"] ?? ""; delete d["TRY"];
    const usd = d["USD"] ?? ""; delete d["USD"];
    const diger = Object.entries(d).map(([c, v]) => `${c} ${fmtN(v)}`).join(" · ");
    return [f.musteri, f.hazir, f.kismi, f.bekliyor, f.adet, f.m3, eur, tri, usd, diger];
  });

  const rHead = ["Müşteri", kLabel, "Madde kodu", "Madde adı", "Satış siparişi", "Müşteri sip. no", "Parti", "Konfig",
    "Miktar", "Kalan", "Depo Stok", "Kalan m³", "Kalan Tutar", "PB", "Havuz", "Sevk tarihi"];
  const rRows = [];
  gruplar.filter(g => g.durum === "hazir").forEach(g => {
    g.aktif.filter(r => r._hazir).forEach(r => rRows.push([
      r.musteri, g.key, r.maddeKodu, r.maddeAdi, r.siparisNo, r.musteriSipNo, r.partiNo, r.konfigNo,
      r.miktar, r.kalan, r.depoStok, r.kalanM3, r.kalanTutar, (r.paraBirimi || "").toUpperCase(), r.havuz, r.sevkTarihi
    ]));
  });

  const mkSheet = (head, rows) => {
    const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
    ws["!cols"] = head.map((_, i) => ({ wch: i === 1 || i === 0 ? 26 : 12 }));
    styleHeader(ws);
    return ws;
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, mkSheet(gHead, gRows), "Gruplar");
  XLSX.utils.book_append_sheet(wb, mkSheet(fHead, fRows), "Firma Ozeti");
  XLSX.utils.book_append_sheet(wb, mkSheet(rHead, rRows), "Hazir Satirlar");
  XLSX.writeFile(wb, `order_hazir_${snapshot.tarih}.xlsx`);
  toastMsg("📤 Rapor indirildi.");
}
document.getElementById("btnExcelRapor").addEventListener("click", exportExcelRapor);

/* ═══════════════ 🔗 OLAY BAĞLANTILARI ═══════════════ */
document.getElementById("btnYukle").addEventListener("click", openYukle);
document.getElementById("tarihSec").addEventListener("change", e => loadSnapshot(e.target.value));
document.getElementById("kriterSec").addEventListener("change", e => {
  const v = e.target.value;
  if (v !== "auto") {
    sonKriter = v;
    localStorage.setItem("oh_son_kriter", v);
    const mus = document.getElementById("musteriSec").value.trim();
    if (mus) saveAyar(mus, v);
  }
  expandedGrup.clear(); render();
});
document.getElementById("durumSec").addEventListener("change", render);
document.getElementById("havuzSec").addEventListener("change", render);
document.getElementById("esik").addEventListener("change", e => {
  let v = Number(e.target.value); if (!isFinite(v)) v = 100;
  e.target.value = Math.max(50, Math.min(100, v));
  render();
});
document.getElementById("musteriSec").addEventListener("input", debounce(() => { expandedGrup.clear(); render(); }, 250));
document.getElementById("ara").addEventListener("input", debounce(render, 250));
function setView(v) {
  currentView = v;
  document.getElementById("btnGrupView").classList.toggle("primary", v === "grup");
  document.getElementById("btnFirmaView").classList.toggle("primary", v === "firma");
  render();
}
document.getElementById("btnGrupView").addEventListener("click", () => setView("grup"));
document.getElementById("btnFirmaView").addEventListener("click", () => setView("firma"));
document.getElementById("btnGrupView").classList.add("primary");

/* Grup satırına tıkla → detay aç/kapa (checkbox/buton tıklamaları hariç!) */
document.getElementById("ohTbody").addEventListener("click", e => {
  if (e.target.closest("input, button, select, label")) return;
  const tr = e.target.closest("tr.oh-grup");
  if (!tr) return;
  const key = tr.dataset.gkey;
  if (expandedGrup.has(key)) expandedGrup.delete(key); else expandedGrup.add(key);
  render();
});

document.getElementById("btnLogin").addEventListener("click", tryLogin);
document.getElementById("btnLoginCancel").addEventListener("click", hideLogin);
["l-user", "l-pass"].forEach(id =>
  document.getElementById(id).addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); }));
document.getElementById("loginModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) hideLogin();
});

/* ═══════════════ 🔀 SIRALAMA (firma → tarih → parti) ═══════════════ */
function siralaGruplar(gruplar, mod) {
  if (mod === "durum") {
    gruplar.sort((a, b) => (DURUM_SIRA_OH[a.durum] - DURUM_SIRA_OH[b.durum]) ||
      (b.oran - a.oran) || (b.hazirM3 - a.hazirM3) ||
      String(a.key).localeCompare(String(b.key), "tr"));
    return;
  }
  /* firma: Teslimat adı A-Z → en eski sipariş oluşturma tarihi → en küçük parti no */
  const minO = g => g.aktif.reduce((m, r) => (r.olusturma && r.olusturma < m ? r.olusturma : m), "9999-12-31");
  const minP = g => g.aktif.reduce((m, r) => {
    const p = String(r.partiNo || "").trim();
    return (p && p < m) ? p : m;
  }, "￿");
  gruplar.sort((a, b) =>
    String(a.musteri).localeCompare(String(b.musteri), "tr") ||
    String(minO(a)).localeCompare(String(minO(b))) ||
    String(minP(a)).localeCompare(String(minP(b)), "tr") ||
    String(a.key).localeCompare(String(b.key), "tr"));
}
document.getElementById("siraSec").addEventListener("change", e => {
  localStorage.setItem("oh_sira", e.target.value);
  render();
});
const _savedSira = localStorage.getItem("oh_sira");
if (_savedSira) document.getElementById("siraSec").value = _savedSira;

/* ═══════════════ 📦 YÜKLEME LİSTESİ (SEPET) v2 ═══════════════ */
const SEPET_KEY = "oh_sepet_v2";
let sepet = [];
try { sepet = (JSON.parse(localStorage.getItem(SEPET_KEY) || "[]") || []).filter(s => s && s.rid && s.row); } catch (e) { sepet = []; }
function sepetKaydet() {
  try { localStorage.setItem(SEPET_KEY, JSON.stringify(sepet)); } catch (e) {}
  updateBulkBar();
}
function sepetVar(rid) { return sepet.some(s => s.rid === rid); }
function sepetEkle(rid) {
  if (sepetVar(rid) || !snapshot) return;
  const row = (snapshot.satirlar || []).find(r => r._rid === rid);
  if (!row) return;
  sepet.push({ rid, tarih: snapshot.tarih, sevk: numOr(row.kalan, 0), row: { ...row } });
  sepetKaydet();
}
function sepetCikar(rid) { sepet = sepet.filter(s => s.rid !== rid); sepetKaydet(); }
function updateBulkBar() {
  const bar = document.getElementById("ohBulk");
  if (!sepet.length) { bar.classList.add("hidden"); return; }
  const m3 = sepet.reduce((s, x) => s + satirM3(x.row, x.sevk), 0);
  document.getElementById("ohBulkCount").textContent = `📦 ${sepet.length} satır · ${fmtN(m3)} m³`;
  bar.classList.remove("hidden");
}

/* Tablo olayları: grup tümünü seç + satır seçimi */
document.getElementById("ohTbody").addEventListener("change", e => {
  const all = e.target.closest("input.oh-selall");
  if (all) {
    const g = sonGruplar.find(x => fbKey(x.ck) + "~" + fbKey(x.musteri) === all.dataset.gkey);
    if (!g) return;
    const rids = g.aktif.map(r => r._rid).filter(Boolean);
    if (all.checked) rids.forEach(rid => sepetEkle(rid));
    else rids.forEach(rid => sepetCikar(rid));
    render();
    return;
  }
  const cb = e.target.closest("input.oh-sel");
  if (cb) { if (cb.checked) sepetEkle(cb.dataset.rid); else sepetCikar(cb.dataset.rid); }
});

function renderSepet() {
  document.getElementById("sepetHead").innerHTML =
    `<th>Firma</th><th>Madde kodu</th><th>Madde adı</th><th>Parti</th><th>Satış sip.</th><th>Referans</th><th>Müşteri sip. no</th>
     <th class="center">Kalan</th><th class="center" title="Sevk edeceğiniz miktar — düzenleyebilirsiniz">Sevk Miktarı</th>
     <th class="center">m³</th><th class="center">Tutar</th><th class="center">PB</th><th></th>`;
  const tb = document.getElementById("sepetTbody");
  if (!sepet.length) {
    tb.innerHTML = `<tr><td colspan="13" class="empty">Liste boş — grup başlığındaki 📦 kutusuyla tümünü veya detayda satırları ekleyin.</td></tr>`;
    document.getElementById("sepetFoot").innerHTML = "";
    return;
  }
  tb.innerHTML = sepet.map(s => { const r = s.row; return `<tr>
    <td class="oh-strong">${esc(r.musteri || "-")}</td>
    <td>${esc(r.maddeKodu || "-")}</td><td>${esc(r.maddeAdi || "-")}</td>
    <td>${esc(r.partiNo || "-")}</td><td>${esc(r.siparisNo || "-")}</td>
    <td>${esc(r.referansNo || "-")}</td><td>${esc(r.musteriSipNo || "-")}</td>
    <td class="center">${numOr(r.kalan, "-")}</td>
    <td class="center"><input type="number" class="cell-input w-num" style="width:70px" min="0" value="${numOr(s.sevk, 0)}" data-sevk="${esc(String(s.rid))}" /></td>
    <td class="center oh-strong">${fmtN(satirM3(r, s.sevk))}</td>
    <td class="center">${fmtN(satirTutar(r, s.sevk))}</td>
    <td class="center">${esc((r.paraBirimi || "-").toUpperCase())}</td>
    <td><button class="icon-btn del" data-sdel="${esc(String(s.rid))}" title="Listeden çıkar">🗑️</button></td>
  </tr>`; }).join("");
  const adet = sepet.reduce((s, x) => s + numOr(x.sevk, 0), 0);
  const m3 = sepet.reduce((s, x) => s + satirM3(x.row, x.sevk), 0);
  const deger = {};
  sepet.forEach(x => { const c = (x.row.paraBirimi || "DİĞER").toUpperCase(); deger[c] = (deger[c] || 0) + satirTutar(x.row, x.sevk); });
  document.getElementById("sepetFoot").innerHTML =
    `<tr><td colspan="7"><b>TOPLAM (${sepet.length} satır)</b></td>
     <td class="center oh-strong">${fmtN(adet)}</td><td></td>
     <td class="center oh-strong">${fmtN(m3)}</td>
     <td colspan="2">${fmtDeger(deger)}</td><td></td></tr>`;
}
document.getElementById("sepetTbody").addEventListener("click", e => {
  const b = e.target.closest("[data-sdel]");
  if (!b) return;
  sepetCikar(b.dataset.sdel);
  renderSepet(); render();
});
document.getElementById("sepetTbody").addEventListener("input", e => {
  const inp = e.target.closest("input[data-sevk]");
  if (!inp) return;
  const en = sepet.find(s => String(s.rid) === inp.dataset.sevk);
  if (!en) return;
  const v = Math.max(0, Number(inp.value) || 0);
  en.sevk = v;
  try { localStorage.setItem(SEPET_KEY, JSON.stringify(sepet)); } catch (e2) {}
  /* Satır ve toplamları canlı güncelle */
  const tr = inp.closest("tr");
  const tds = tr.querySelectorAll("td");
  tds[9].textContent = fmtN(satirM3(en.row, v));
  tds[10].textContent = fmtN(satirTutar(en.row, v));
  const adet = sepet.reduce((s, x) => s + numOr(x.sevk, 0), 0);
  const m3 = sepet.reduce((s, x) => s + satirM3(x.row, x.sevk), 0);
  const deger = {};
  sepet.forEach(x => { const c = (x.row.paraBirimi || "DİĞER").toUpperCase(); deger[c] = (deger[c] || 0) + satirTutar(x.row, x.sevk); });
  const foot = document.getElementById("sepetFoot");
  if (foot) {
    foot.innerHTML = `<tr><td colspan="7"><b>TOPLAM (${sepet.length} satır)</b></td>
      <td class="center oh-strong">${fmtN(adet)}</td><td></td>
      <td class="center oh-strong">${fmtN(m3)}</td>
      <td colspan="2">${fmtDeger(deger)}</td><td></td></tr>`;
  }
  updateBulkBar();
});
document.getElementById("btnSepetGoster").addEventListener("click", () => {
  renderSepet();
  document.getElementById("sepetModal").classList.remove("hidden");
});
document.getElementById("btnSepetKapat").addEventListener("click", () =>
  document.getElementById("sepetModal").classList.add("hidden"));
document.getElementById("sepetModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});
document.getElementById("btnSepetTemizle").addEventListener("click", () => {
  if (!sepet.length) return;
  if (confirm(`${sepet.length} satır listeden temizlenecek. Emin misiniz?`)) { sepet = []; sepetKaydet(); render(); }
});

function sepetExcel() {
  if (typeof XLSX === "undefined") { alert("Excel kütüphanesi yüklenemedi."); return; }
  if (!sepet.length) { alert("Liste boş."); return; }
  const ad = (document.getElementById("sepetAd").value || "").trim();
  const H = ["Sıra", "Snapshot", "Firma", "Referans", "Satış Siparişi", "Müşteri Sip. No",
    "Madde Kodu", "Madde Adı", "Parti", "Konfig", "Kalan", "Sevk Miktarı", "Birim m³", "Sevk m³",
    "Kalan Tutar", "Sevk Tutarı", "PB", "Havuz", "Sevk Tarihi"];
  const rows = sepet.map((s, i) => { const r = s.row; return [
    i + 1, s.tarih, r.musteri, r.referansNo, r.siparisNo, r.musteriSipNo, r.maddeKodu, r.maddeAdi,
    r.partiNo, r.konfigNo, numOr(r.kalan, 0), numOr(s.sevk, 0), +satirBirimM3(r).toFixed(3),
    satirM3(r, s.sevk), numOr(r.kalanTutar, 0), satirTutar(r, s.sevk),
    (r.paraBirimi || "").toUpperCase(), r.havuz, r.sevkTarihi
  ];});
  const fm = new Map();
  sepet.forEach(s => {
    const m = s.row.musteri || "-";
    if (!fm.has(m)) fm.set(m, { n: 0, sevk: 0, m3: 0, d: {} });
    const f = fm.get(m);
    f.n++; f.sevk += numOr(s.sevk, 0); f.m3 += satirM3(s.row, s.sevk);
    const c = (s.row.paraBirimi || "DİĞER").toUpperCase();
    f.d[c] = (f.d[c] || 0) + satirTutar(s.row, s.sevk);
  });
  const ozet = [...fm.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr")).map(([m, f]) => {
    const d = { ...f.d };
    const g = c => { const v = d[c]; delete d[c]; return (v != null) ? +v.toFixed(2) : ""; };
    const diger = Object.entries(d).map(([c, v]) => `${c} ${fmtN(v)}`).join(" · ");
    return [m, f.n, f.sevk, +f.m3.toFixed(2), g("EUR"), g("TRY"), g("USD"), diger];
  });
  const tD = {};
  sepet.forEach(s => { const c = (s.row.paraBirimi || "DİĞER").toUpperCase(); tD[c] = (tD[c] || 0) + satirTutar(s.row, s.sevk); });
  const digerT = Object.entries(tD).filter(([c]) => !["EUR", "TRY", "USD"].includes(c)).map(([c, v]) => `${c} ${fmtN(v)}`).join(" · ");
  ozet.push(["TOPLAM", sepet.length,
    sepet.reduce((s, x) => s + numOr(x.sevk, 0), 0),
    +sepet.reduce((s, x) => s + satirM3(x.row, x.sevk), 0).toFixed(2),
    tD["EUR"] != null ? +tD["EUR"].toFixed(2) : "", tD["TRY"] != null ? +tD["TRY"].toFixed(2) : "",
    tD["USD"] != null ? +tD["USD"].toFixed(2) : "", digerT]);
  const mk = (h, rr) => { const ws = XLSX.utils.aoa_to_sheet([h, ...rr]);
    ws["!cols"] = h.map((_, i) => ({ wch: i < 10 ? 20 : 13 })); styleHeader(ws); return ws; };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, mk(H, rows), "Yukleme Listesi");
  XLSX.utils.book_append_sheet(wb, mk(["Firma", "Satır", "Sevk Adet", "Sevk m³", "EUR", "TRY", "USD", "Diğer"], ozet), "Ozet");
  const guvenli = ad.replace(/[\\\/:*?"<>|]/g, "").replace(/\s+/g, "_") || todayISO();
  XLSX.writeFile(wb, `yukleme_listesi_${guvenli}.xlsx`);
  toastMsg("📤 Yükleme listesi indirildi.");
}
document.getElementById("btnSepetExcel").addEventListener("click", sepetExcel);
document.getElementById("btnSepetExcelModal").addEventListener("click", sepetExcel);
updateBulkBar();

/* ═══════════════ 🚀 BAŞLAT ═══════════════ */
(async () => {
  const s = getAuthState();
  if (s) {
    try { await ensureToken(); currentUser = { email: s.email }; }
    catch (e) { /* token yenilenemedi — görüntüleme modu */ }
  }
  updateUserUI();
  ayarlar = await loadAyarlar();
  await refreshTarihListesi();
  if (snapshotKeys.length) await loadSnapshot(snapshotKeys[0]);
  else render();
})();
