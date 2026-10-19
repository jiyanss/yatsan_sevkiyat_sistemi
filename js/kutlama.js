/* =========================================================
   YATSAN — kutlama.js (havai fişek kutlaması)
   ---------------------------------------------------------
   NE YAPAR:
   1) "yükleme tamamlandı" bildirimi çıktığında ~5 sn havai fişek
      (QR işlem ekranı + Operasyon ekranı + Depo'dan biten her
      yükleme bu toast'ı zaten üretiyor → tek tetik hepsini kapsar)
   2) Depo ekranı (#depoOverlay) ve Operasyon ekranı (#opOverlay)
      her oturumda İLK açılışta ~3.5 sn kutlama
   ---------------------------------------------------------
   İNCE AYAR (konsoldan da yapılabilir):
   Kutlama.ayarla({ sureTamamlanmaMs: 6000, minAralikMs: 8000 })
   ========================================================= */
(function () {
  "use strict";
  if (window.Kutlama) return; // çift yükleme koruması

  /* ---- İnce ayar varsayılanları ---- */
  const AYAR = {
    sureTamamlanmaMs: 4800, // "yükleme tamamlandı" kutlaması süresi
    sureEkranMs: 3600,      // depo/operasyon ilk açılış kutlaması
    minAralikMs: 12000,     // iki kutlama arası en kısa boşluk
  };

  /* ---- Durum ---- */
  let fw = null;            // Fireworks örneği (tek sefer kurulur)
  let katman = null;        // sabitlenecek şeffaf canvas katmanı
  let aktif = false;        // şu an kutlama oynuyor mu
  let sonBaslangic = 0;     // tekilleştirme saati
  let yuklemeHatasi = false;// import hatası bir kez loglanır
  const bayraklar = { depo: false, op: false }; // oturum başına 1 kez

  /* ---- Kullanıcının ayarları + paylaşılan katman ---- */
  const FW_OPTIONS = {
    gravity: 1.4,
    opacity: 0.4,
    autoresize: true,
    acceleration: 1.0,
  };

  function katmanAl() {
    if (katman) return katman;
    katman = document.createElement("div");
    katman.id = "kutlamaKatmani";
    // pointer-events:none → hiçbir tıklamayı engellemez;
    // z-index:200 → overlay'lerin (90) ÜSTÜNDE, taşınabilir katman
    katman.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:200;display:none;";
    document.body.appendChild(katman);
    return katman;
  }

  /* ---- Kapılar: çalışmayacaksa neden çalışmasın? ---- */
  function izinVarMi() {
    if (aktif) return false;
    if (Date.now() - sonBaslangic < AYAR.minAralikMs) return false;
    if (document.hidden) return false; // arka plan sekmesinde pil harcama
    try {
      if (window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    } catch (_) {}
    return true;
  }

  /* ---- Asıl kutlama: lazy import + süreli oynatma ---- */
  async function patlat(sureMs) {
    if (!izinVarMi()) return;
    let Fireworks;
    try {
      const mod = await import("https://esm.run/fireworks-js");
      Fireworks = mod.Fireworks;
    } catch (e) {
      if (!yuklemeHatasi) {
        yuklemeHatasi = true;
        console.info("Kutlama: fireworks-js yüklenemedi (çevrimdışı olabilir) — sessizce atlandı.");
      }
      return;
    }
    const kapsayici = katmanAl();
    kapsayici.style.display = "";
    if (!fw) fw = new Fireworks(kapsayici, FW_OPTIONS);
    aktif = true;
    sonBaslangic = Date.now();
    fw.start();
    window.setTimeout(function () {
      try { fw.stop(); } catch (_) {}
      kapsayici.style.display = "none"; // son kare ekranda donmasın
      aktif = false;
    }, sureMs);
  }

  /* ---- TETİK 1: "yükleme tamamlandı" toast'ı ----
     showToast'ı sarıyoruz: metin yükleme tamamlanma bildirimi ise
     kutlama; asıl bildirim davranışı AYNEN sürer. init.js'teki
     etiket küçük harf ("yükleme tamamlandı") olduğu için
     eşleştirme büyük/küçük harf duyarsız. */
  function toastSarla() {
    if (typeof window.showToast !== "function") return;
    const orijinal = window.showToast;
    window.showToast = function (html) {
      try {
        if (typeof html === "string" && /yükleme tamamlandı/i.test(html)) {
          patlat(AYAR.sureTamamlanmaMs);
        }
      } catch (_) {}
      return orijinal.apply(this, arguments);
    };
  }

  /* ---- TETİK 2: Depo + Operasyon ekranının oturum içi ilk açılışı ----
     #opOverlay JS ile üretilir → MutationObserver hem eklenmeyi hem
     .hidden kaldırılmayı yakalar. Tarama çok ucuz (2 ID sorgusu). */
  function gorunurMu(el) {
    return !el.classList.contains("hidden") &&
           el.getBoundingClientRect().width > 0;
  }

  function ekranTara() {
    const depo = document.getElementById("depoOverlay");
    if (depo && gorunurMu(depo) && !bayraklar.depo) {
      bayraklar.depo = true;
      patlat(AYAR.sureEkranMs);
    }
    const op = document.getElementById("opOverlay");
    if (op && gorunurMu(op) && !bayraklar.op) {
      bayraklar.op = true;
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
    window.setTimeout(ekranTara, 400);  // geç açılan overlay'ler için emniyet
    window.setTimeout(ekranTara, 1500);
  }

  /* ---- Dış API ---- */
  window.Kutlama = {
    /* Manuel tetikleme (istenirse butona bağlanabilir) */
    tamamlandi: function () { patlat(AYAR.sureTamamlanmaMs); },
    ekran: function (ad) {
      if (ad === "depo" || ad === "op") { bayraklar[ad] = true; patlat(AYAR.sureEkranMs); }
    },
    /* İnce ayar: Kutlama.ayarla({ minAralikMs: 8000 }) */
    ayarla: function (yeni) { Object.assign(AYAR, yeni || {}); },
    /* Teşhis: konsolda Kutlama.durum() */
    durum: function () {
      return {
        aktif: aktif,
        bayraklar: Object.assign({}, bayraklar),
        sonBaslangic: sonBaslangic,
        ayar: Object.assign({}, AYAR),
      };
    },
  };

  /* ---- Başlat ---- */
  toastSarla();
  ekranIzleyiciKur();
})();

