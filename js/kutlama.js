/* =========================================================
   YATSAN — kutlama.js v3  (HAVAI FİŞEK KAPALI sürüm)
   ---------------------------------------------------------
   v2 → v3 DEĞİŞİKLİK — kullanıcının isteği:
   "Depo ekranındaki ve ana sayfadaki havai fişek kutlamaları
    iptal olsun; kutlama yalnız canlı modülde, ben gönderdiğimde
    patlasın."

   ✂️ KALDIRILDI (otomatik kutlamaların tamamı):
      1) 🎆 "Yükleme Tamamlandı" otomatik kutlaması (ana sayfa
         tablosu, depo tablosu, toplu düzenleme, QR ekranı,
         operasyon kartı — apiUpdate/toast tetikleri)
      2) 🖥️ Depo ve Operasyon ekranı AÇILIŞ kutlaması
         (MutationObserver + saniyelik tarama dahil)
      → fireworks-js artık SAYFA AÇILIŞINDA hiçbir zaman
        yüklenmez; arka planda sessizlik var.

   🎆 HAVAI FİŞEK MOTORU YAŞIYOR — ama artık TEK giriş:
      Kutlama.patlat()  → ~5 sn'lik gösteri (süreyi kendin seç:
      Kutlama.patlat(8000)). Bunu YALNIZ canli.js'in 🎁 gönderim
      akışı çağırır: Canlı Kullanıcılar panelinden kişiye 🎁 ya
      da "Herkese Gönder"de 🎁 konfeti işaretli → hedef
      sekme(ler)de konfeti + havai fişek birlikte patlar.
      Otomatik çağıran hiçbir kod yoktur.

   ✅ DEĞİŞMEDİ (havai fişekle ilgisi olmayan görevler):
      3) 🛡️ GERÇEKLEŞEN TARİHİ DEĞİŞMEZİ — Durum "Yükleme
         Tamamlandı" DAN başka bir şeye alınırsa gerçekleşen
         tarih ve gecikme günü otomatik TEMİZLENİR (yan etki
         sarmalayıcı + kayıt-sonrası güvenlik ağı, çift katman).
      4) 🔔 CANLI SENKRON BEKÇİSİ — SSE koparsa/yarım kalırsa
         otomatik yeniden kurulur; aksayan dönemlerde 2 sn'de
         bir güvenli yükleme; sekmeye dönüşte anında tazeleme;
         operasyon ekranının arama listesi canlı yenilenir.

   ---------------------------------------------------------
   AĞIRLIK GARANTİLERİ:
   - fireworks-js yalnız İLK MANUEL kutlamada yüklenir (dinamik
     import → açılış hızı sıfır etkilenir)
   - Gösteri SÜRELİDİR (varsayılan ~5 sn) → otomatik durur
   - Sürerken ikinci istek gelirse: süre BAŞTAN başlar (üstüne
     ekleme/çakışma yok), kütüphane tekrar indirilmez
   - Arka plan sekmesinde / hareketi-azalt tercihinde çalışmaz;
     hata vermez, sessizce atlar
   ---------------------------------------------------------
   KURULUM: js/kutlama.js içeriğini bununla değiştir —
   index.html'de zaten var olan satır aynen kalır:
   <script src="js/kutlama.js"></script>

   KONSOL TANILAMA:  Kutlama.durum()
   İNCE AYAR (konsoldan da olur):
     Kutlama.ayarla({ sureMs: 6000 })   // gösteri süresi
   ========================================================= */
(function () {
  "use strict";
  if (window.Kutlama) return; // çift yükleme koruması

  /* ---------------- İnce ayar ---------------- */
  const AYAR = {
    sureMs: 4800, // manuel kutlama gösterisi süresi
    /* Test sayfaları için değiştirilebilir kaynak; canlı sitede
       daima varsayılan CDN kullanılır */
    kaynak: (typeof window.KUTLAMA_FW_KAYNAK === "string" && window.KUTLAMA_FW_KAYNAK) ||
            "https://esm.run/fireworks-js",
  };

  /* ---------------- Durum ---------------- */
  let fw = null, katman = null;
  let aktif = false, baslaniyor = false, yuklemeHatasi = false;
  let durdurTimer = null;
  /* son patlatma teşhisi (Kutlama.durum() raporlar) */
  let patlatSonuc = "-", patlatZaman = 0;
  /* canlı senkron bekçisi durumları */
  let sonMesaj = 0, sseSorunZamani = 0, sonSseKurulum = 0, sonYuklemeOk = Date.now();

  const FW_OPTIONS = { gravity: 1.4, opacity: 0.4, autoresize: true, acceleration: 1.0 };

  function katmanAl() {
    if (katman) return katman;
    katman = document.createElement("div");
    katman.id = "kutlamaKatmani";
    /* pointer-events:none → tıklamayı engellemez; z:200 → tüm overlay'lerin üstünde */
    katman.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:200;display:none;";
    document.body.appendChild(katman);
    return katman;
  }

  /* ---------------- Kutlama motoru (YALNIZ MANUEL) ---------------- */
  /* Tek çağıran: canli.js'in 🎁 gönderim akışı (window.Kutlama.patlat).
     v2'deki apiUpdate/toast/ekran açılış tetiklerinin HEPSİ silindi. */
  function durdur() {
    if (durdurTimer) { window.clearTimeout(durdurTimer); durdurTimer = null; }
    try { if (fw) fw.stop(); } catch (_) {}
    if (katman) katman.style.display = "none"; // son kare ekranda donmasın
    aktif = false;
  }

  async function patlat(sureMs) {
    const sure = Math.max(1000, Number(sureMs) || AYAR.sureMs);
    function kaydet(sonuc) { patlatSonuc = sonuc; patlatZaman = Date.now(); }
    if (aktif) {                    // gösteri sürerken yeni istek → süreyi baştan başlat
      kaydet("yenilendi");
      if (durdurTimer) window.clearTimeout(durdurTimer);
      durdurTimer = window.setTimeout(durdur, sure);
      return;
    }
    if (baslaniyor) { kaydet("engel-baslaniyor"); return; }
    if (document.hidden) { kaydet("engel-gizli"); return; }
    try {
      if (window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches) { kaydet("engel-hareket-azalt"); return; }
    } catch (_) {}
    /* ⚠️ İşaretler await'ten ÖNCE senkron set edilir → çift tetik yarışı yok */
    baslaniyor = true;
    kaydet("basliyor");
    let Fireworks = null;
    try {
      const mod = await import(AYAR.kaynak);
      Fireworks = mod.Fireworks;
    } catch (e) {
      baslaniyor = false;
      kaydet("hata-kutuphane: " + (e && e.message || e));
      if (!yuklemeHatasi) {
        yuklemeHatasi = true;
        console.info("Kutlama: fireworks-js yüklenemedi (çevrimdışı olabilir) — sessizce atlandı.");
      }
      return;
    }
    baslaniyor = false;
    const kapsayici = katmanAl();
    kapsayici.style.display = "";
    if (!fw) fw = new Fireworks(kapsayici, FW_OPTIONS);
    aktif = true;
    fw.start();
    kaydet("oynuyor");
    durdurTimer = window.setTimeout(durdur, sure);
  }

  /* ============ 3) GERÇEKLEŞEN DEĞİŞMEZİ ============ */
  function gerceklesenDuzelt(id) {
    try {
      if (typeof FIREBASE_DB_URL === "undefined" || typeof NODE === "undefined") return;
      if (typeof window.authFetch !== "function") return;
      window.authFetch(FIREBASE_DB_URL + "/" + NODE + "/" + id + ".json", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gerceklesenTarih: null, gecikmeSon: null })
      }).catch(function () {});
    } catch (_) {}
  }

  /* apiUpdate sarmalayıcı — v2'deki kutlama tetiği ÇIKARILDI;
     yalnız "gerçekleşen tarihi temizle" güvenlik ağı kaldı. */
  function tamamlamaAgDene() {
    if (typeof window.apiUpdate !== "function") return false;
    if (window.apiUpdate.__kutlama) return true;
    const orijinal = window.apiUpdate;
    const sarili = function (id, rec) {
      return orijinal.apply(this, arguments).then(function (saved) {
        try {
          /* 🛡️ Güvenlik ağı: yan etki sarmalayıcı bir nedenden çalışmadıysa
             bile Tamamlandı-dışı kayıtta eski gerçekleşen tarihi temizle */
          if (saved && saved.durum !== "Yükleme Tamamlandı" && saved.gerceklesenTarih) {
            saved.gerceklesenTarih = "";
            if ("gecikmeSon" in saved) saved.gecikmeSon = null;
            gerceklesenDuzelt(saved.id);
          }
        } catch (_) {}
        return saved;
      });
    };
    sarili.__kutlama = true;
    window.apiUpdate = sarili;
    return true;
  }

  /* ============ 3) GERÇEKLEŞEN DEĞİŞMEZİ (kaynak) ============
     applyDurumSideEffects her durum değişiminde çağrılır (tüm modüller).
     Orijinal "yalnız boşsa doldurur" → Tamamlandı DIŞINA geçişte
     gerçekleşen + gecikme günü temizlenir. */
  function yanEtkiDene() {
    if (typeof window.applyDurumSideEffects !== "function") return false;
    if (window.applyDurumSideEffects.__kutlama) return true;
    const orijinal = window.applyDurumSideEffects;
    const sarili = function (rec) {
      const sonuc = orijinal.apply(this, arguments);
      try {
        if (rec && rec.durum !== "Yükleme Tamamlandı") {
          if (rec.gerceklesenTarih) rec.gerceklesenTarih = "";
          if (rec.gecikmeSon != null) rec.gecikmeSon = null;
        }
      } catch (_) {}
      return sonuc;
    };
    sarili.__kutlama = true;
    window.applyDurumSideEffects = sarili;
    return true;
  }

  /* ============ 4) CANLI SENKRON BEKÇİSİ ============ */
  function sseSarla(es) {
    if (!es || es.__kutlamaCanli) return;
    es.__kutlamaCanli = true;
    sonMesaj = Date.now(); // yeni örnek → gözlem penceresi taze
    try {
      const eski = es.onmessage;
      es.onmessage = function (e) {
        sonMesaj = Date.now();
        if (typeof eski === "function") eski.call(es, e);
      };
    } catch (_) {}
    try { es.addEventListener("keep-alive", function () { sonMesaj = Date.now(); }); } catch (_) {}
  }

  function sseYenidenKur() {
    if (Date.now() - sonSseKurulum < 30000) return; // yeniden kurma fırtınası koruması
    sonSseKurulum = Date.now();
    try { if (window._sse) window._sse.close(); } catch (_) {}
    try { if (typeof window.startLiveSync === "function") window.startLiveSync(); } catch (_) {}
    try { sseSarla(window._sse); } catch (_) {}
  }

  /* dönüş true = SSE sağlıklı */
  function sseDenetle() {
    const es = window._sse;
    if (!es) { sseYenidenKur(); return false; }
    sseSarla(es);
    const rs = es.readyState;
    if (rs === 2) { sseYenidenKur(); return false; }            // kalıcı kapalı
    if (rs === 0) {                                              // bağlanıyor
      if (!sseSorunZamani) sseSorunZamani = Date.now();
      if (Date.now() - sseSorunZamani > 60000) { sseYenidenKur(); return false; }
      return false;
    }
    sseSorunZamani = 0;
    if (sonMesaj && Date.now() - sonMesaj > 210000) { sseYenidenKur(); return false; } // zombi
    return true;
  }

  /* liveReload ile aynı emniyetler + güvenli yükleme */
  function veriYukle() {
    if (document.hidden) return;
    try {
      if (typeof editingCell !== "undefined" && editingCell) return;
      if (typeof addingInline !== "undefined" && addingInline) return;
      if (typeof lastLocalOp !== "undefined" && Date.now() - lastLocalOp < 3000) return;
      const im = document.getElementById("importModal");
      if (im && !im.classList.contains("hidden")) return;
    } catch (_) {}
    try {
      const p = window.load(false, true);
      if (p && typeof p.then === "function") {
        p.then(function () { sonYuklemeOk = Date.now(); }).catch(function () {});
      }
    } catch (_) {}
  }

  function denetimTiki() {
    if (document.hidden) return;
    const saglikli = sseDenetle();
    if (!saglikli) veriYukle(); // SSE aksıyorken bile veri taze kalsın
  }

  /* load sarmalayıcı: operasyon ekranının arama listesini de canlı tazele */
  function loadDene() {
    if (typeof window.load !== "function") return false; /* henüz tanımlanmadı → yeniden dene */
    if (window.load.__kutlama) return true; /* zaten sarılı */
    const orijinal = window.load;
    const sarili = function () {
      const p = orijinal.apply(this, arguments);
      try {
        if (p && typeof p.then === "function") {
          p.then(function () {
            const ov = document.getElementById("opOverlay");
            if (ov && typeof window.renderOpResults === "function") {
              const inp = document.getElementById("opSearch");
              window.renderOpResults(inp ? (inp.value || "") : "");
            }
          }).catch(function () {});
        }
      } catch (_) {}
      return p;
    };
    sarili.__kutlama = true;
    window.load = sarili;
    return true;
  }

  /* ============ Sarmalayıcı kurulumu: 60 sn yeniden denemeli ============
     NOT: v2'deki toast sarmalayıcı KALDIRILDI (tek görevi kutlama
     tetiklemekti). Geriye kalan sarmalayıcılar: apiUpdate (güvenlik ağı),
     applyDurumSideEffects (değişmez kaynağı), load (op listesi tazeleme). */
  const GOREVLER = [
    ["apiUpdate", tamamlamaAgDene],
    ["applyDurumSideEffects", yanEtkiDene],
    ["load", loadDene],
  ];
  function gorevDurumu() {
    return {
      apiUpdate: !!(window.apiUpdate && window.apiUpdate.__kutlama),
      yanEtki: !!(window.applyDurumSideEffects && window.applyDurumSideEffects.__kutlama),
      load: !!(window.load && window.load.__kutlama),
    };
  }
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

  /* ============ Başlat (yalnız canlı senkron nöbeti) ============
     v2'deki ekran izleyici (MutationObserver + saniyelik tarama)
     KALDIRILDI — otomatik kutlama arayan gözler artık yok. */
  try {
    window.setInterval(denetimTiki, 2000);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      sseDenetle();
      if (Date.now() - sonYuklemeOk > 20000) veriYukle(); // sekmeye dönüş = taze veri
    });
  } catch (_) {}

  /* ============ Dış API ============ */
  window.Kutlama = {
    /* 🎆 Manuel havai fişek — canli.js'in 🎁 gönderim akışı çağırır.
       Konsoldan da denenebilir:  Kutlama.patlat()  /  Kutlama.patlat(8000) */
    patlat: function (sureMs) { patlat(sureMs); },
    /* İnce ayar: Kutlama.ayarla({ sureMs: 6000 }) */
    ayarla: function (yeni) { Object.assign(AYAR, yeni || {}); },
    /* Teşhis: konsolda Kutlama.durum() */
    durum: function () {
      return {
        surum: "v3 — otomatik kutlama YOK; havai fişek yalnız canlı modül 🎁 gönderiminde",
        fw: {
          aktif: aktif,
          sonPatlatma: patlatSonuc + (patlatZaman ? " @ " + new Date(patlatZaman).toLocaleTimeString("tr-TR") : ""),
          ayar: Object.assign({}, AYAR),
        },
        sarmalayicilar: gorevDurumu(),
        canli: {
          sseDurum: window._sse ? window._sse.readyState : -1,
          sonMesaj: sonMesaj ? new Date(sonMesaj).toLocaleTimeString("tr-TR") : null,
          sonYuklemeOk: new Date(sonYuklemeOk).toLocaleTimeString("tr-TR"),
        },
      };
    },
  };
})();
