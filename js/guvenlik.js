/* =========================================================
   YATSAN — guvenlik.js v1.2
   ---------------------------------------------------------
   TEK DOSYA (index.html'e 1 satır script etiketi dışında
   dokunulmaz, mevcut modüller değişmez). 4 KATMAN:

   1) 🗑️ ÇÖP KUTUSU — apiDelete sarmalayıcı: her silmeden
      önce kayıt sevkiyat_cop/{id} düğümüne KOPYALANIR,
      kopyalama başarısızsa SİLME DURDURULUR (veri kaybı
      imkânsız). Geri alma: Guvenlik.geriAl(id)

   2) 💾 YEREL ANLIK YEDEK — kritik işlemlerden HEMEN ÖNCE +
      5 dk'da bir + sekmeye dönüşte: rows localStorage'a
      yazılır (son 6 nokta). Veritabanı tamamen silinse bile
      bilgisayarda kalır. Geri yükleme: Guvenlik.geriYukle(n)

   3) 🛡️ KURAL DENETİMİ — açılışta anonim erişimle test yapar:
      kök/yedek/kullanıcı düğümleri herkese açıksa kırmızı
      uyarı çubuğu gösterir. Manuel yazma testi:
      Guvenlik.yazmaTesti()

   4) 📦 ACİL DURUM KİTİ — Guvenlik.tamYedekIndir(): tüm
      düğümleri tek JSON dosyasına indirir (bilgisayara).

   5) 🔎 YETKİ TEŞHİSİ (v1.2) — "normal kullanıcı toplama/
      yükleme başlat-bitir yapamıyor (401)" sorununun kök
      nedenini tek komutla bulur:
      Guvenlik.yetkiTesti()      → ETKİLENEN kullanıcının
        oturumuyla çalıştır: whitelist kaydı + gerçek yazma
        testi + Türkçe karar raporu
      Guvenlik.kullanicilar("e") → sevkiyat_users listesini
        anahtar formatıyla listeler (admin doğrulaması)

   ---------------------------------------------------------
   GARANTİLER:
   - fireworks/kutlama.js ile ÇAKIŞMAZ (sarmalayıcılar zincirlenir)
   - her şey try/catch'li; guvenlik.js yüklenemezse uygulama
     aynen çalışmaya devam eder
   - otomatik işlemler SESSİZDİR (sadece console.info)
   - localStorage doluysa yedek sayısı otomatik küçülür
   ---------------------------------------------------------
   KURULUM: js/guvenlik.js olarak koy + index.html'de
   kutlama.js satırından SONRA ekle:
   <script src="js/guvenlik.js"></script>
   → deploy + sert yenileme (Ctrl+Shift+R)
   ---------------------------------------------------------
   KONSOL KOMUTLARI (F12):
     Guvenlik.durum()        → genel sağlık raporu
     Guvenlik.yedekler()     → yerel yedek noktalarını listele
     Guvenlik.geriYukle(-1)  → son yedeği geri yükle (onay sorar)
     Guvenlik.copListesi()   → çöp kutusunu listele
     Guvenlik.geriAl("ID")   → silinen kaydı geri koy
     Guvenlik.copTemizle(30) → 30 günden eski çöpü temizle
     Guvenlik.kuralDenetle() → anonim erişim denetimi (yeniden)
     Guvenlik.yazmaTesti()   → anonim YAZMA testi (kritik test)
     Guvenlik.tamYedekIndir()→ tüm veriyi JSON indir
     Guvenlik.snapshotAl()   → şimdi yerel yedek al
     Guvenlik.yetkiTesti()   → v1.2: 401 yetki teşhisi (girişli kullanıcıyla)
     Guvenlik.kullanicilar("e") → v1.2: sevkiyat_users whitelist listesi
   ========================================================= */
(function () {
  "use strict";
  if (window.Guvenlik) return; // çift yükleme koruması

  /* ---------------- Ayar ---------------- */
  const COP_NODE = "sevkiyat_cop";
  const SNAP_KEY = "yatsanGuvenlikSnap";
  const AYAR = {
    snapAralikMs: 300000,    // periyodik yerel yedek aralığı (5 dk)
    snapMinAralikMs: 15000,  // iki otomatik yedek arası en kısa boşluk
    snapMax: 6,              // saklanacak yerel yedek sayısı
    copSaklamaGun: 30,       // copTemizle varsayılanı
  };

  /* ---------------- Durum ---------------- */
  let sonHash = "";
  let sonSnapDeneme = 0;
  const bilgi = {
    kurallar: null,           // kuralDenetle sonucu
    sonSnapshot: 0,
    sonSnapshotNeden: "-",
    snapSayisi: 0,
    copSayisi: null,
    kuralEksik: null,        // true = giris yapilmisken cop kutusuna erisilemiyor (kurallar eksik)
    sarmalayici: { apiDelete: false, apiUpdate: false, apiInsert: false, apiBulkInsert: false },
  };

  /* ---------------- Yardımcılar ---------------- */
  function dbUrl(node) {
    if (typeof FIREBASE_DB_URL === "undefined") return null;
    return FIREBASE_DB_URL + "/" + node + ".json";
  }
  function anaNode() { return (typeof NODE !== "undefined") ? NODE : "sevkiyat"; }

  function rowsAl() {
    try { if (typeof rows !== "undefined" && Array.isArray(rows)) return rows; } catch (_) {}
    try { if (Array.isArray(window.rows)) return window.rows; } catch (_) {}
    return null;
  }

  function kimlik() {
    try {
      if (typeof currentUser !== "undefined" && currentUser && currentUser.email) return currentUser.email;
    } catch (_) {}
    try { if (window.currentUser && window.currentUser.email) return window.currentUser.email; } catch (_) {}
    return "";
  }

  function authF(url, opts) {
    if (typeof window.authFetch !== "function") {
      return Promise.reject(new Error("authFetch hazır değil (giriş yapılmamış olabilir)"));
    }
    return window.authFetch(url, opts);
  }

  function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Satır dizisi için basit değişim parmak izi:
     updatedAt + durum + gerceklesenTarih → her apiUpdate'te değişir */
  function hashVeri(rs) {
    let h = rs.length + ":";
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      h += (r && r.id ? r.id : "?") + "|" +
           ((r && r.updatedAt) || 0).toString(36) + "|" +
           ((r && r.durum) || "").slice(0, 6) + "|" +
           ((r && r.gerceklesenTarih) || "") + ";";
    }
    return h;
  }

  /* ============ 2) YEREL ANLIK YEDEK ============ */
  function snapOku() {
    try { const d = JSON.parse(localStorage.getItem(SNAP_KEY) || "[]"); return Array.isArray(d) ? d : []; }
    catch (_) { return []; }
  }
  function snapYaz(liste) { localStorage.setItem(SNAP_KEY, JSON.stringify(liste)); }

  function snapshotAl(sebep, zorla) {
    try {
      const rs = rowsAl();
      if (!rs || !rs.length) return false;
      const simdi = Date.now();
      if (!zorla && simdi - sonSnapDeneme < AYAR.snapMinAralikMs) return false;
      sonSnapDeneme = simdi;
      const h = hashVeri(rs);
      if (h === sonHash) return false; // veri değişmedi → yeni nokta gereksiz
      const liste = snapOku();
      liste.push({ t: simdi, sebep: String(sebep || "otomatik"), sayi: rs.length, veri: rs });
      while (liste.length > AYAR.snapMax) liste.shift();
      try {
        snapYaz(liste);
      } catch (kota) {
        /* kota doldu → nokta sayısını küçültüp yeniden dene */
        try { liste.splice(0, Math.ceil(liste.length / 2)); snapYaz(liste); }
        catch (_) { try { snapYaz(liste.slice(-1)); } catch (_) { return false; } }
      }
      sonHash = h;
      bilgi.sonSnapshot = simdi;
      bilgi.sonSnapshotNeden = sebep || "otomatik";
      bilgi.snapSayisi = Math.min(liste.length, AYAR.snapMax);
      console.info("💾 Guvenlik: yerel yedek alındı (" + bilgi.sonSnapshotNeden + " · " + rs.length + " kayıt)");
      return true;
    } catch (_) { return false; }
  }

  function snapListesi() {
    return snapOku().map(function (s, i) {
      return { index: i, saat: new Date(s.t).toLocaleString("tr-TR"), sebep: s.sebep, kayit: s.sayi };
    });
  }

  /* idx negatifse sondan sayılır: geriYukle(-1) = en son yedek */
  async function geriYukle(idx) {
    const liste = snapOku();
    const s = liste[idx < 0 ? liste.length + idx : idx];
    if (!s) { console.warn("Guvenlik.geriYukle: yedek noktası bulunamadı"); return false; }
    const soru = "⚠️ " + new Date(s.t).toLocaleString("tr-TR") + " anındaki " + s.sayi +
      " kayıt geri yüklenecek.\nFirebase'deki mevcut kayıtlar bu içerikle DEĞİŞTİRİLİR," +
      " o anda olmayan kayıtlar yeniden OLUŞTURULUR.\n\nEmin misiniz?";
    if (!window.confirm(soru)) { console.info("Geri yükleme iptal edildi."); return false; }
    let n = 0, hata = 0;
    for (const r of (s.veri || [])) {
      if (!r || !r.id) continue;
      const kopya = Object.assign({}, r);
      delete kopya.id;
      try {
        await authF(dbUrl(anaNode() + "/" + r.id), {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kopya)
        });
        n++;
      } catch (e) { hata++; console.warn("Guvenlik: kayıt geri yüklenemedi", r.id, e.message); }
      await new Promise(function (res) { setTimeout(res, 40); }); // hesaplı tempo
    }
    try { if (typeof window.load === "function") await window.load(true); } catch (_) {}
    try {
      if (typeof window.apiLog === "function") {
        window.apiLog("guvenlik", "", "", "yerel yedekten geri yükleme · " + n + " kayıt · an: " + new Date(s.t).toISOString());
      }
    } catch (_) {}
    console.info("✅ Geri yükleme tamam: " + n + " kayıt" + (hata ? " (" + hata + " başarısız)" : "") + ".");
    return true;
  }

  /* ============ 1) ÇÖP KUTUSU ============ */
  function copTemizleKopya(rec) {
    const k = Object.assign({}, rec);
    delete k.__kutlama; delete k.__guvenlik;
    return k;
  }

  async function copYaz(rec, id, silen) {
    const kopya = copTemizleKopya(rec || { id: id });
    kopya.silinmeTs = Date.now();
    kopya.silen = silen || "";
    await authF(dbUrl(COP_NODE + "/" + id), {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kopya)
    });
  }

  async function copListesi() {
    try {
      const res = await authF(dbUrl(COP_NODE), {});
      const d = await res.json();
      if (!d) { console.info("🗑️ Çöp kutusu boş."); return []; }
      const liste = Object.keys(d).map(function (id) {
        const r = d[id] || {};
        return {
          id: id,
          musteri: r.musteri || "?",
          durum: r.durum || "?",
          planlanan: r.planlananTarih || "",
          silinme: r.silinmeTs ? new Date(r.silinmeTs).toLocaleString("tr-TR") : "?",
          silen: r.silen || "?",
        };
      }).sort(function (a, b) { return (b.silinmeTs || 0) - (a.silinmeTs || 0); });
      console.table(liste);
      bilgi.copSayisi = liste.length;
      return liste;
    } catch (e) { console.warn("Çöp kutusu okunamadı:", e.message); return []; }
  }

  async function geriAl(id) {
    if (!id) { console.warn("Guvenlik.geriAl: id gerekli"); return false; }
    try {
      const res = await authF(dbUrl(COP_NODE + "/" + id), {});
      const rec = await res.json();
      if (!rec) { console.warn("Guvenlik.geriAl: kayıt çöp kutusunda yok:", id); return false; }
      const temiz = copTemizleKopya(rec);
      delete temiz.silinmeTs; delete temiz.silen;
      await authF(dbUrl(anaNode() + "/" + id), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(temiz)
      });
      try { await authF(dbUrl(COP_NODE + "/" + id), { method: "DELETE" }); } catch (_) {}
      try { if (typeof window.load === "function") await window.load(true); } catch (_) {}
      try {
        if (typeof window.apiLog === "function") {
          window.apiLog("guvenlik", id, temiz.musteri || "", "çöp kutusundan geri alındı");
        }
      } catch (_) {}
      console.info("✅ Kayıt geri kondu:", id, temiz.musteri || "");
      return true;
    } catch (e) { console.warn("Geri alma başarısız:", e.message); return false; }
  }

  async function copTemizle(gun) {
    const sinir = Date.now() - (Number(gun) || AYAR.copSaklamaGun) * 86400000;
    try {
      const res = await authF(dbUrl(COP_NODE), {});
      const d = await res.json();
      if (!d) { console.info("Çöp kutusu zaten boş."); return 0; }
      let n = 0;
      for (const id of Object.keys(d)) {
        const r = d[id] || {};
        if ((r.silinmeTs || 0) < sinir) {
          try { await authF(dbUrl(COP_NODE + "/" + id), { method: "DELETE" }); n++; } catch (_) {}
        }
      }
      bilgi.copSayisi = Object.keys(d).length - n;
      console.info("🧹 " + n + " eski çöp kaydı silindi.");
      return n;
    } catch (e) { console.warn("Çöp temizleme başarısız:", e.message); return 0; }
  }

  /* ============ Sarmalayıcılar ============ */
  /* apiDelete: ÖNCE çöp kutusuna yaz → başarısızsa silme İPTAL */
  function apiDeleteDene() {
    if (typeof window.apiDelete !== "function") return false;
    if (window.apiDelete.__guvenlik) return true;
    const orijinal = window.apiDelete;
    const sarili = function (id) {
      const args = arguments;
      const kendisi = this;
      return (async function () {
        const rs = rowsAl() || [];
        const src = rs.find(function (x) { return x && x.id === id; }) || null;
        try { snapshotAl("silme-oncesi", true); } catch (_) {}
        try {
          await copYaz(src, id, kimlik());
        } catch (e) {
          throw new Error("SİLME DURDURULDU — kayıt önce çöp kutusuna alınamadı (" + e.message + "). Güvenceye alınmayan kayıt silinmez.");
        }
        bilgi.copSayisi = (bilgi.copSayisi == null) ? 1 : bilgi.copSayisi + 1;
        try {
          if (typeof window.showToast === "function") {
            window.showToast("🗑️ Kayıt çöp kutusuna alındı — gerekirse Guvenlik.geriAl(\"" + id + "\") ile geri alınır.");
          }
        } catch (_) {}
        return orijinal.apply(kendisi, args);
      })();
    };
    sarili.__guvenlik = true;
    window.apiDelete = sarili;
    bilgi.sarmalayici.apiDelete = true;
    return true;
  }

  function apiUpdateDene() {
    if (typeof window.apiUpdate !== "function") return false;
    if (window.apiUpdate.__guvenlik) { bilgi.sarmalayici.apiUpdate = true; return true; }
    const orijinal = window.apiUpdate;
    const sarili = function () {
      try { snapshotAl("guncelleme-oncesi"); } catch (_) {}
      return orijinal.apply(this, arguments);
    };
    sarili.__guvenlik = true;
    window.apiUpdate = sarili;
    bilgi.sarmalayici.apiUpdate = true;
    return true;
  }

  function apiInsertDene() {
    if (typeof window.apiInsert !== "function") return false;
    if (window.apiInsert.__guvenlik) { bilgi.sarmalayici.apiInsert = true; return true; }
    const orijinal = window.apiInsert;
    const sarili = function () {
      try { snapshotAl("ekleme-oncesi"); } catch (_) {}
      return orijinal.apply(this, arguments);
    };
    sarili.__guvenlik = true;
    window.apiInsert = sarili;
    bilgi.sarmalayici.apiInsert = true;
    return true;
  }

  function apiBulkDene() {
    if (typeof window.apiBulkInsert !== "function") return false;
    if (window.apiBulkInsert.__guvenlik) { bilgi.sarmalayici.apiBulkInsert = true; return true; }
    const orijinal = window.apiBulkInsert;
    const sarili = function () {
      try { snapshotAl("ice-aktarma-oncesi", true); } catch (_) {}
      return orijinal.apply(this, arguments);
    };
    sarili.__guvenlik = true;
    window.apiBulkInsert = sarili;
    bilgi.sarmalayici.apiBulkInsert = true;
    return true;
  }

  /* ============ 3) KURAL DENETİMİ ============ */
  async function dene(node) {
    try {
      const base = (typeof FIREBASE_DB_URL === "undefined") ? null : FIREBASE_DB_URL;
      if (!base) return "kurulum-yok";
      const url = node ? base + "/" + node + ".json?shallow=true" : base + "/.json?shallow=true";
      const res = await fetch(url, { cache: "no-store" }); // BİTLİSİZ fetch — anonim erişim testi
      if (res.status === 200) return "acik";
      if (res.status === 401 || res.status === 403) return "kapali";
      return "bilinmiyor-" + res.status;
    } catch (_) { return "ag-hatasi"; }
  }

  async function kuralDenetle() {
    const sonuc = { ts: Date.now() };
    sonuc.root = await dene("");
    sonuc.sevkiyat = await dene(anaNode());
    sonuc.yedek = await dene("sevkiyat_yedek");
    sonuc.users = await dene("sevkiyat_users");
    bilgi.kurallar = sonuc;
    const kritik = sonuc.root === "acik" || sonuc.yedek === "acik" || sonuc.users === "acik";
    if (kritik) {
      const neler = [];
      if (sonuc.root === "acik") neler.push("kök düğüm");
      if (sonuc.yedek === "acik") neler.push("YEDEKLER");
      if (sonuc.users === "acik") neler.push("KULLANICI LİSTESİ");
      uyariGoster("GÜVENLİK UYARISI: " + neler.join(", ") +
        " herkese açık görünüyor. guvenlik-rehberi.md → ADIM 1 (Firebase Rules) hemen uygulayın.");
    } else if (sonuc.root === "kapali" || sonuc.yedek === "kapali") {
      console.info("🛡️ Guvenlik: kural denetimi iyi — hassas düğümler anonim erişime kapalı.",
        { root: sonuc.root, yedek: sonuc.yedek, users: sonuc.users, sevkiyat: sonuc.sevkiyat });
    } else {
      console.info("🛡️ Guvenlik: kural denetimi sonuçları:", sonuc);
    }
    return sonuc;
  }

  /* Manuel test: anonim YAZMA da açık mı? (kritik kırılma noktası) */
  async function yazmaTesti() {
    const base = dbUrl("_guvenlik_probe");
    if (!base) return "kurulum-yok";
    try {
      const res = await fetch(base, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: Date.now() })
      });
      if (res.ok) {
        uyariGoster("KRİTİK: ANONİM YAZMA AÇIK — internete açık herkes tüm verileri değiştirebilir/silebilir! guvenlik-rehberi.md → ADIM 1'i ŞİMDİ uygulayın.");
        try { await authF(base, { method: "DELETE" }); } catch (_) {}
        return "acik-kritik";
      }
      console.info("🛡️ Anonim yazma testi: kapalı (HTTP " + res.status + ") — iyi.");
      return "kapali-" + res.status;
    } catch (e) { return "ag-hatasi"; }
  }

  function uyariGoster(metin) {
    try {
      let b = document.getElementById("guvenlikUyari");
      if (!b) {
        b = document.createElement("div");
        b.id = "guvenlikUyari";
        b.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:300;background:#b91c1c;color:#fff;" +
          "font:13px/1.45 system-ui,-apple-system,sans-serif;padding:10px 44px 10px 14px;" +
          "box-shadow:0 2px 10px rgba(0,0,0,.3)";
        const kapat = document.createElement("button");
        kapat.textContent = "✕";
        kapat.setAttribute("aria-label", "Uyarıyı kapat");
        kapat.style.cssText = "position:absolute;top:6px;right:8px;background:rgba(255,255,255,.25);" +
          "border:0;color:#fff;width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:14px";
        kapat.addEventListener("click", function () { if (b.parentNode) b.parentNode.removeChild(b); });
        b.appendChild(kapat);
        const span = document.createElement("span");
        span.id = "guvenlikUyariMetin";
        b.appendChild(span);
        (document.body || document.documentElement).appendChild(b);
      }
      const span = document.getElementById("guvenlikUyariMetin");
      if (span) span.textContent = metin; else b.textContent = metin;
    } catch (_) {}
  }

  /* ============ 4) ACİL DURUM: TAM YEDEK İNDİR ============ */
  async function tamYedekIndir() {
    const nodelar = [anaNode(), "sevkiyat_history", "sevkiyat_suresi", "sevkiyat_users",
      "sevkiyat_arsiv", "sevkiyat_yedek", "sevkiyat_ekipler", "sevkiyat_quiz",
      "sevkiyat_quiz_scores", "sevkiyat_quiz_oyunlar", COP_NODE];
    const cikti = {
      app: "sevkiyat-planlama", tur: "tam-yedek", ts: Date.now(), user: kimlik(), data: {}
    };
    for (const nd of nodelar) {
      try {
        cikti.data[nd] = await authF(dbUrl(nd), {}).then(function (r) { return r.json(); });
      } catch (e) { cikti.data[nd] = { __hata: e.message }; }
    }
    const blob = new Blob([JSON.stringify(cikti)], { type: "application/json" });
    const a = document.createElement("a");
    const d = new Date();
    const p = function (x) { return String(x).padStart(2, "0"); };
    a.href = URL.createObjectURL(blob);
    a.download = "yatsan-tam-yedek-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
      "-" + p(d.getHours()) + p(d.getMinutes()) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (_) {} }, 5000);
    console.info("💾 Tam yedek indirildi:", a.download);
    return a.download;
  }

  /* ============ 5) YETKİ TEŞHİSİ (v1.2) ============ */
  /* Giriş durumu: core.js sevkiyat_auth'a {idToken, refreshToken, email, exp} yazar.
     tokenEmail = idToken JWT içinden çözülür — RULES'un gördüğü e-posta budur. */
  function authDurum() {
    try {
      const s = JSON.parse(localStorage.getItem("sevkiyat_auth") || "null");
      if (!s || !s.idToken) return { giris: false };
      let tokEmail = "";
      try {
        const parca = s.idToken.split(".")[1] || "";
        const b64 = parca.replace(/-/g, "+").replace(/_/g, "/");
        const pad = b64 + "===".slice((b64.length + 3) % 4);
        tokEmail = (JSON.parse(atob(pad)) || {}).email || "";
      } catch (_) {}
      return { giris: true, email: s.email || "", tokenEmail: tokEmail, exp: s.exp || 0 };
    } catch (_) { return { giris: false }; }
  }

  /* sevkiyat_users whitelist listesi (okuma kuralı: auth != null → her girişli görebilir).
     arama verilirse o e-posta vurgulanır. Admin Panel'deki kaydın RTDB'deki
     GERÇEK anahtarını görmek için birebir doğru yol. */
  async function kullanicilar(arama) {
    const out = { ts: Date.now(), giris: null, liste: [], aranan: null, benVarim: null };
    const a = authDurum();
    out.giris = a.giris;
    if (!a.giris) {
      console.warn("Guvenlik.kullanicilar: önce giriş yap — liste auth != null gerektirir.");
      return out;
    }
    try {
      const res = await authF(dbUrl("sevkiyat_users"), {});
      if (!res || !res.ok) {
        console.warn("sevkiyat_users okunamadı (HTTP " + (res ? res.status : "?") + ") — rules'ta .read 'auth != null' olmalı.");
        return out;
      }
      const d = (await res.json()) || {};
      out.liste = Object.keys(d).map(function (k) {
        const v = d[k] || {};
        const email = v.email || k.replace(/,/g, ".");
        return {
          anahtar: k,
          email: email,
          rol: v.role || "user",
          formatOk: k === String(email).replace(/\./g, ","),   // anahtar = noktalar virgüle çevrilmiş mi
          kucukHarf: k === k.toLowerCase(),                     // rules araması büyük/küçük harfe duyarlı
        };
      });
      console.table(out.liste.map(function (u) {
        return { anahtar: u.anahtar, email: u.email, rol: u.rol,
                 format: u.formatOk ? "ok" : "ANAHTAR≠EMAIL!",
                 harf: u.kucukHarf ? "ok" : "BÜYÜK HARF VAR!" };
      }));
      if (arama) {
        const arK = String(arama).replace(/\./g, ",");
        const hit = out.liste.find(function (u) {
          return u.anahtar === arK || String(u.email).toLowerCase() === String(arama).toLowerCase();
        });
        if (hit) {
          out.aranan = hit;
          console.info("🔎 " + arama + " BULUNDU → rules şu anahtara bakar: 'sevkiyat_users/" + hit.anahtar + "'");
        } else {
          console.warn("🔎 " + arama + " LİSTEDE YOK! Admin Panel'e yazılan e-postanın yazımını/büyük-küçük harfini kontrol et.");
        }
      }
      const benim = ((a.tokenEmail || a.email || "")).replace(/\./g, ",");
      if (benim) {
        out.benVarim = out.liste.some(function (u) { return u.anahtar === benim; });
        console.info((out.benVarim ? "✅ Girişli kullanıcı (" + benim.replace(/,/g, ".") + ") whitelist'te."
                                   : "❌ Girişli kullanıcı (" + benim.replace(/,/g, ".") + ") whitelist'te YOK — kurallar yazmayı reddeder."));
      }
    } catch (e) { console.warn("kullanicilar hatası:", e.message); }
    return out;
  }

  /* 401 teşhisi — ETKİLENEN kullanıcının oturumuyla çalıştır.
     A) whitelist kaydı var mı  B) gerçek yazma testi (no-op PATCH, veri değişmez)
     → Türkçe karar: giris-yok / whitelist-yok / kurallar-eski / hersey-tamam */
  async function yetkiTesti() {
    const a = authDurum();
    const sonuc = { ts: Date.now(), giris: a.giris, email: a.tokenEmail || a.email || "", adimlar: {}, karar: "" };
    console.log("🔎 Guvenlik.yetkiTesti başlıyor…");
    if (!a.giris) {
      sonuc.karar = "giris-yok";
      console.warn("❌ GİRİŞ YAPILMAMIŞ. Bu testi etkilenen kullanıcıyla (ör. halil.ozcelik@yatsan.com) GİRİŞ YAPDIKTAN sonra çalıştır. Görüntüleme modunda (misafir) her yazma 401 alır — bu beklenen davranıştır.");
      return sonuc;
    }
    const benimAnahtar = sonuc.email.replace(/\./g, ",");
    console.info("1) Girişli e-posta: " + sonuc.email + " → rules arama anahtarı: 'sevkiyat_users/" + benimAnahtar + "'");
    /* ADIM A — whitelist kaydı */
    try {
      const res = await authF(dbUrl("sevkiyat_users"), {});
      if (!res || !res.ok) throw new Error("HTTP " + (res ? res.status : "?"));
      const d = (await res.json()) || {};
      const kayit = d[benimAnahtar] || null;
      sonuc.adimlar.whitelist = kayit ? "var" : "yok";
      if (kayit) {
        console.info("✅ A) whitelist kaydın var: rol=" + (kayit.role || "?") + " · email=" + (kayit.email || "?"));
      } else {
        const yakin = Object.keys(d).filter(function (x) { return x.toLowerCase() === benimAnahtar.toLowerCase(); });
        sonuc.adimlar.whitelistYakin = yakin;
        console.warn("❌ A) sevkiyat_users'ta '" + benimAnahtar + "' anahtarı YOK." +
          (yakin.length ? " Yakın eşleşme: " + yakin.join(", ") + " → BÜYÜK/KÜÇÜK HARF FARKI var; Admin Panel'den düzelt."
                        : " Admin Panel'den bu e-posta eklenmeli (yazım hatalarına bak)."));
      }
    } catch (e) {
      sonuc.adimlar.whitelist = "hata: " + e.message;
      console.warn("⚠️ A) sevkiyat_users okunamadı:", e.message, "→ rules'ta sevkiyat_users .read 'auth != null' olmalı (ADIM 1). Oturumun süresi bitmiş de olabilir — yeniden giriş yap.");
    }
    /* ADIM B — gerçek yazma testi: ilk kaydı kendi verisiyle PATCH (değişiklik yok) */
    try {
      const sh = await fetch(dbUrl(anaNode()) + "?shallow=true", { cache: "no-store" });
      const keys = sh.ok ? await sh.json() : null;
      const ilk = keys ? Object.keys(keys)[0] : null;
      if (!ilk) {
        sonuc.adimlar.yazma = "kayit-yok";
        console.warn("⚠️ B) yazma testi için kayıt bulunamadı.");
      } else {
        const row = await fetch(dbUrl(anaNode() + "/" + ilk), { cache: "no-store" }).then(function (r) { return r.json(); });
        const wRes = await authF(dbUrl(anaNode() + "/" + ilk), {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row) /* kendi verisi → içerik DEĞİŞMEZ */
        });
        sonuc.adimlar.yazma = wRes.ok ? "basarili" : "reddedildi-" + wRes.status;
        sonuc.adimlar.testKayit = ilk;
        if (wRes.ok) console.info("✅ B) YAZMA TESTİ BAŞARILI: sevkiyat/" + ilk + " no-op PATCH kabul edildi (veri değişmedi). Bu hesap yazabilir.");
        else console.warn("❌ B) YAZMA TESTİ REDDEDİLDİ (HTTP " + wRes.status + ").");
      }
    } catch (e) {
      sonuc.adimlar.yazma = "hata: " + e.message;
      console.warn("❌ B) yazma testi başarısız:", e.message);
    }
    /* KARAR */
    if (sonuc.adimlar.whitelist === "var" && sonuc.adimlar.yazma === "basarili") {
      sonuc.karar = "hersey-tamam";
      console.info("🎉 KARAR: HER ŞEY TAMAM — hesap whitelist'te ve yazabiliyor. 401 hâlâ görülüyorsa eski bir oturum/ekran olabilir; sayfayı yenileyip (Ctrl+Shift+R) tekrar dene.");
    } else if (sonuc.adimlar.whitelist === "var" && String(sonuc.adimlar.yazma).indexOf("reddedildi") === 0) {
      sonuc.karar = "kurallar-eski";
      console.warn("🛡️ KARAR: whitelist'tesin AMA kurallar yazmana izin vermiyor. Neredeyse her zaman sebebi: yayındaki Rules metninde replace('.', ',') yazması (regex tuzağı). Doğrusu replace('[.]', ',') — guvenlik-rehberi.md → ADIM 1'deki JSON'u açıp Publish et.");
    } else if (sonuc.adimlar.whitelist === "yok") {
      sonuc.karar = "whitelist-yok";
      console.warn("🛡️ KARAR: hesabın sevkiyat_users whitelist'inde yok → Admin Panel'den eklenmeli. Panel eklemesi rules'ta kod değişikliği gerektirmez (kurallar canlı olarak sevkiyat_users'a bakar).");
    } else {
      sonuc.karar = "belirsiz";
      console.warn("🛡️ KARAR: yukarıdaki A/B çıktılarına bak; çıktıyı ekran görüntüsüyle paylaş.");
    }
    return sonuc;
  }

  /* ============ Dış API ============ */
  window.Guvenlik = {
    durum: function () {
      return {
        sarmalayici: Object.assign({}, bilgi.sarmalayici),
        kurallar: bilgi.kurallar,
        sonSnapshot: bilgi.sonSnapshot ? new Date(bilgi.sonSnapshot).toLocaleString("tr-TR") : null,
        sonSnapshotNeden: bilgi.sonSnapshotNeden,
        snapshotlar: snapListesi(),
        cop: bilgi.copSayisi,
        kuralEksik: bilgi.kuralEksik,
        ayar: Object.assign({}, AYAR),
      };
    },
    snapshotAl: function () { return snapshotAl("manuel", true); },
    yedekler: snapListesi,
    geriYukle: geriYukle,
    copListesi: copListesi,
    geriAl: geriAl,
    copTemizle: copTemizle,
    kuralDenetle: kuralDenetle,
    yazmaTesti: yazmaTesti,
    tamYedekIndir: tamYedekIndir,
    yetkiTesti: yetkiTesti,
    kullanicilar: kullanicilar,
    ayarla: function (yeni) { Object.assign(AYAR, yeni || {}); },
  };

  /* ============ Kurulum: 250ms × 240 yeniden denemeli ============ */
  const GOREVLER = [
    ["apiDelete", apiDeleteDene],
    ["apiUpdate", apiUpdateDene],
    ["apiInsert", apiInsertDene],
    ["apiBulkInsert", apiBulkDene],
  ];
  let denemeSayisi = 0;
  function kurucuAdim() {
    for (let i = GOREVLER.length - 1; i >= 0; i--) {
      try { if (GOREVLER[i][1]()) GOREVLER.splice(i, 1); } catch (_) {}
    }
    return GOREVLER.length === 0;
  }
  kurucuAdim();
  const kurucu = window.setInterval(function () {
    if (kurucuAdim() || ++denemeSayisi > 240) window.clearInterval(kurucu);
  }, 250);

  /* ============ Başlat ============ */
  try {
    window.setInterval(function () {
      if (!document.hidden) snapshotAl("periyodik");
    }, AYAR.snapAralikMs);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && Date.now() - bilgi.sonSnapshot > 60000) snapshotAl("sekme-donusu");
    });
    window.setTimeout(kuralDenetle, 4000);
    window.setTimeout(copSayisiTazele, 8000);
    window.setInterval(function () { if (!document.hidden) copSayisiTazele(); }, 600000);
  } catch (_) {}

  async function copSayisiTazele() {
    try {
      const res = await authF(dbUrl(COP_NODE) + "?shallow=true", {});
      const d = await res.json();
      bilgi.copSayisi = d ? Object.keys(d).length : 0;
      if (bilgi.kuralEksik) bilgi.kuralEksik = false; // erisim geri geldi
    } catch (e) {
      /* Sessiz degil: giris yapilmisken 401/403 geliyorsa kurallarda "sevkiyat_cop" tanimli
         degildir ve silme korumasi (çöp yazimi) surekli bloklanir -> kullaniciyi uyar. */
      const m = (e && e.message) || "";
      if (/401|403|reddedildi|izin vermiyor|izin vermiyor/i.test(m)) {
        bilgi.kuralEksik = true;
        uyariGoster("🛡️ KURAL EKSİK: giriş yapılmışken çöp kutusuna erişilemiyor (" + m + ") — silme koruması bu yüzden engelleniyor. Firebase Console → Realtime Database → Rules'a guvenlik-rehberi.md → ADIM 1'deki tam JSON'u yapıştırıp Publish edin (sevkiyat_cop düğümü dahil).");
      }
    }
  }
})();
