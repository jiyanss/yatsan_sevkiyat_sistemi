/* =========================================================
   YATSAN — kutlama.js v2
   ---------------------------------------------------------
   TEK DOSYA, 4 GÖREV (index.html'e dokunulmaz, sadece bu
   dosyanın içeriği güncellenir):

   1) 🎆 KUTLAMA — "Yükleme Tamamlandı" olan her kayıtta
      ~5 sn havai fişek. TETİK: apiUpdate sarmalayıcı
      (tablo hücresi, depo tablosu, toplu düzenleme, QR işlem
      ekranı, operasyon kartı — HEPSİ apiUpdate'ten geçer).
      Ek yedek: "yükleme tamamlandı" metinli toast'lar.

   2) 🖥️ EKRAN KUTLAMASI — Depo ve Operasyon ekranı HER
      açılışta ~3.5 sn kutlama (aynı ekran için 30 sn soğuma;
      hızlı aç-kapa spam'i kutlamaz). Saniyelik tarama +
      MutationObserver ile çift katman tespit.

   3) 🛡️ GERÇEKLEŞEN TARİHİ DEĞİŞMEZİ — Durum "Yükleme
      Tamamlandı" DAN başka bir şeye alınırsa gerçekleşen
      tarihi ve gecikme günü otomatik TEMİZLENİR (artık
      eski tarih yapışık kalamaz). Yan etki sarmalayıcı +
      kayıt-sonrası güvenlik ağı (çift katman).

   4) 🔔 CANLI SENKRON BEKÇİSİ — Sayfa açık kaldıkça veri
      taze kalır: SSE bağlantısı koparsa/yarım kalırsa
      (zombi) otomatik yeniden kurulur; SSE aksayan
      dönemlerde 2 sn'de bir güvenli yükleme; sekme geri
      geldiğinde (visibilitychange) anında tazeleme;
      operasyon ekranının arama listesi de canlı yenilenir.

   ---------------------------------------------------------
   AĞIRLIK GARANTİLERİ:
   - fireworks-js KÜTÜPHANESİ ilk kutlamaya kadar yüklenmez
     (dinamik import → açılış hızı sıfır etkilenir)
   - Animasyon SÜRELİDİR (5/3.5 sn) → otomatik durur,
     requestAnimationFrame döngüsü kapanır
   - İki kutlama arasında min 12 sn (minAralikMs)
   - Arka plan sekmesinde / hareketi-azalt tercihinde /
     çevrimdışında çalışmaz; hata vermez, sessizce atlar
   ---------------------------------------------------------
   KURULUM: js/kutlama.js içeriğini bununla değiştir —
   index.html'de zaten var olan satır aynen kalır:
   <script src="js/kutlama.js"></script>
   ---------------------------------------------------------
   KONSOL TANILAMA:  Kutlama.durum()
   İNCE AYAR (konsoldan da olur):
     Kutlama.ayarla({ sureTamamlanmaMs: 6000, minAralikMs: 8000,
                      ekranAralikMs: 10000 })
   ========================================================= */
(function () {
  "use strict";
  if (window.Kutlama) return; // çift yükleme koruması

  /* ---------------- İnce ayar ---------------- */
  const AYAR = {
    sureTamamlanmaMs: 4800, // tamamlanma kutlaması süresi
    sureEkranMs: 3600,      // depo/operasyon açılış kutlaması
    minAralikMs: 12000,     // iki kutlama arası en kısa boşluk
    ekranAralikMs: 600000,   // aynı ekran için iki kutlama arası soğuma
  };

  /* ---------------- Durum ---------------- */
  let fw = null, katman = null;
  let aktif = false, baslaniyor = false;
  let sonBaslangic = 0, yuklemeHatasi = false;
  const sonEkran = { depo: 0, op: 0 };
  /* canlı senkron bekçisi durumları */
  let sonMesaj = 0, sseSorunZamani = 0, sonSseKurulum = 0, sonYuklemeOk = Date.now();
  /* son patlatma teşhisi (Kutlama.durum() raporlar) */
  let patlatSonuc = "-", patlatZaman = 0;

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

  /* ---------------- Kutlama motoru ---------------- */
  /* Saat geri sıçraması (NTP düzeltmesi vb.) sonrası zaman damgaları
     gelecekte kalır → kutlamalar süresiz kilitlenmesin: damgaları sıfırla */
  function saatDuzelt() {
    const simdi = Date.now();
    if (sonBaslangic > simdi + 1000) sonBaslangic = 0;
    if (sonEkran.depo > simdi + 1000) sonEkran.depo = 0;
    if (sonEkran.op > simdi + 1000) sonEkran.op = 0;
  }

  async function patlat(sureMs) {
    function kaydet(sonuc) { patlatSonuc = sonuc; patlatZaman = Date.now(); }
    saatDuzelt();
    if (aktif || baslaniyor) { kaydet("engel-surer"); return; }
    if (Date.now() - sonBaslangic < AYAR.minAralikMs) { kaydet("engel-aralik"); return; }
    if (document.hidden) { kaydet("engel-gizli"); return; }
    try {
      if (window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches) { kaydet("engel-hareket-azalt"); return; }
    } catch (_) {}
    /* ⚠️ İşaretler await'ten ÖNCE senkron set edilir → çift tetik yarışı yok */
    baslaniyor = true;
    sonBaslangic = Date.now();
    kaydet("basliyor");
    let Fireworks = null;
    try {
      const mod = await import("https://esm.run/fireworks-js");
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
    window.setTimeout(function () {
      try { fw.stop(); } catch (_) {}
      kapsayici.style.display = "none"; // son kare ekranda donmasın
      aktif = false;
      kaydet("bitti");
    }, sureMs);
  }

  /* ============ 1) TETİK A: apiUpdate sarmalayıcı ============
     Her tamamlama buradan geçer → önceki durum "rows"tan okunur;
     Tamamlandı'ya YENİ geçişte kutlama. Ayrıca değişmez güvenlik ağı. */
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

  function tamamlamaDene() {
    if (typeof window.apiUpdate !== "function") return false;
    if (window.apiUpdate.__kutlama) return true;
    const orijinal = window.apiUpdate;
    const sarili = function (id, rec) {
      let onceki = null;
      try {
        if (typeof rows !== "undefined" && Array.isArray(rows)) {
          onceki = rows.find(function (x) { return x && x.id === id; }) || null;
        }
      } catch (_) {}
      return orijinal.apply(this, arguments).then(function (saved) {
        try {
          if (rec && rec.durum === "Yükleme Tamamlandı" &&
              (!onceki || onceki.durum !== "Yükleme Tamamlandı")) {
            patlat(AYAR.sureTamamlanmaMs);
          }
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

  /* ============ TETİK B: toast sarmalayıcı (yedek) ============
     250ms'de bir yeniden denenir → script sırası ne olursa olsun kurulum
     garanti edilir (v1'in tek sessiz hata noktası burasıydı). */
  function toastDene() {
    if (typeof window.showToast !== "function") return false;
    if (window.showToast.__kutlama) return true;
    const orijinal = window.showToast;
    window.showToast = function (html) {
      try {
        if (typeof html === "string" && /yükleme tamamlandı/i.test(html)) {
          patlat(AYAR.sureTamamlanmaMs);
        }
      } catch (_) {}
      return orijinal.apply(this, arguments);
    };
    window.showToast.__kutlama = true;
    return true;
  }

  /* ============ 3) GERÇEKLEŞEN DEĞİŞMEZİ (kaynak) ============
     applyDurumSideEffects her durum değişiminde çağrılır (tüm modüller).
     Orijinal "yalnız boşsa doldurur" → v2 eki: Tamamlandı DIŞINA geçişte
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

  /* ============ 2) EKRAN TETİKLERİ (her açılışta) ============ */
  function gorunurMu(el) {
    return !el.classList.contains("hidden") && el.getBoundingClientRect().width > 0;
  }

  function ekranTara() {
    if (document.hidden) return;
    saatDuzelt();
    const simdi = Date.now();
    const depo = document.getElementById("depoOverlay");
    if (depo && gorunurMu(depo) && simdi - sonEkran.depo >= AYAR.ekranAralikMs) {
      sonEkran.depo = simdi;
      patlat(AYAR.sureEkranMs);
    }
    const op = document.getElementById("opOverlay");
    if (op && gorunurMu(op) && simdi - sonEkran.op >= AYAR.ekranAralikMs) {
      sonEkran.op = simdi;
      patlat(AYAR.sureEkranMs);
    }
  }

  function ekranIzleyiciKur() {
    try {
      new MutationObserver(ekranTara).observe(document.documentElement, {
        childList: true, subtree: true, attributes: true, attributeFilter: ["class"],
      });
    } catch (_) {}
    ekranTara();
    window.setInterval(ekranTara, 1000); // asıl garanti: saniyelik tarama
  }

  /* ============ Sarmalayıcı kurulumu: 60 sn yeniden denemeli ============ */
  const GOREVLER = [
    ["showToast", toastDene],
    ["apiUpdate", tamamlamaDene],
    ["applyDurumSideEffects", yanEtkiDene],
    ["load", loadDene],
  ];
  function gorevDurumu() {
    /* GOREVLER listesinden bağımsız rapor: kurulan sarmalayıcılar işaretli */
    return {
      toast: !!(window.showToast && window.showToast.__kutlama),
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

  /* ============ Başlat ============ */
  try { ekranIzleyiciKur(); } catch (_) {}
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
    /* Manuel tetikleme */
    tamamlandi: function () { patlat(AYAR.sureTamamlanmaMs); },
    ekran: function (ad) {
      if (ad === "depo" || ad === "op") { sonEkran[ad] = 0; patlat(AYAR.sureEkranMs); }
    },
    /* İnce ayar: Kutlama.ayarla({ minAralikMs: 8000, ekranAralikMs: 10000 }) */
    ayarla: function (yeni) { Object.assign(AYAR, yeni || {}); },
    /* Teşhis: konsolda Kutlama.durum() */
    durum: function () {
      return {
        aktif: aktif,
        baslaniyor: baslaniyor,
        sonBaslangic: sonBaslangic,
        sonPatlatma: patlatSonuc + (patlatZaman ? " @ " + new Date(patlatZaman).toLocaleTimeString("tr-TR") : ""),
        ayar: Object.assign({}, AYAR),
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
