/* =========================================================
   YATSAN — giris-ekrani.js v1.0 (30.10.2026)
   ---------------------------------------------------------
   🚪 TAM EKRAN GİRİŞ KAPISI

   • Açılışta kayıtlı oturum YOKSA (#sevkiyat_auth boşsa)
     tüm sistemi kapatır ve giriş kartını gösterir.
   • Kayıtlı oturum VARSA kapı hiç açılmaz — init.js'in
     mevcut oturum-restorasyonu aynen çalışır.
   • #operasyon / #islem hash'iyle (QR doğrudan açılış)
     gelindiğinde kapı engel olmaz — misafir akışı bozulmaz.
   • Giriş: Firebase REST (tryLogin ile aynı uç) → başarılıysa
     currentUser + yetkiler yüklenir, kapı kapanır, tablo çizilir.
   • Misafir: kapıyı kapatır, görüntüleme modunda devam eder.
   • Üst menüdeki "🔐 Giriş yap" modalı DEĞİŞMEDİ — oturum
     açıldıktan sonra yeniden giriş için aynen duruyor.

   v1.1: Kapı açıkken body.ge-arka-gizli eklenir — arka yüz (header,
   tablo, toast…) tamamen gizlenir. Neden: Chromium'da native <select>
   kutuları composited overlay'in ÜSTÜNE çizilebiliyor (dashboard
   kalıntıları sızıyordu); visibility+display ile kökten çözülür.

   v1.2: Alanlar gerçek <form id="ge-form"> içine alındı (#ge-user →
   autocomplete="username") — Chrome şifre yöneticisi kayıtlı kullanıcı
   adını da otomatik dolduruyor (önceden yalnızca şifre geliyordu).
   Giriş artık submit olayıyla tetiklenir (Enter + buton tek yol),
   çift gönderim koruması eklendi.

   v1.3: ESNEK BAĞLAMA — "tuşlar çalışmıyor" düzeltmesi. v3'te JS yeni
   ama index.html eski kaldıysa (ya da önbellekten eski JS geldi ise)
   #ge-form bulunamayınca kod çöküyor, hiçbir dinleyici bağlanmıyordu.
   Artık: ge-form VARSA submit yolu, YOKSA buton+Enter yolu (v2).
   Element aramaları da korumalı — eksik eleman kodu durdurmaz.

   Yükleme sırası: TÜM scriptlerden SONRA (canli.js'ten sonra)
   — core.js globallerine (getAuthState, currentUser, render…)
   ihtiyaç duyar.
   ========================================================= */
(function () {
  const EKRAN = document.getElementById("girisEkrani");
  if (!EKRAN) { console.warn("giris-ekrani: #girisEkrani bulunamadı"); return; }

  /* QR / operasyon doğrudan açılışında kapı yol vermeyi atanır */
  function qrDogrudan() {
    return /#(operasyon|islem)/.test(location.hash || "");
  }

  function goster() {
    /* Arka yüzü tamamen gizle — select kalıntısı + veri sızıntısı olmasın */
    document.body.classList.add("ge-arka-gizli");
    EKRAN.classList.remove("hidden");
    setTimeout(() => {
      const u = document.getElementById("ge-user");
      if (u) u.focus();
    }, 400);
  }

  function gizle() {
    document.body.classList.remove("ge-arka-gizli");
    EKRAN.classList.add("hidden");
    const p = document.getElementById("ge-pass");
    if (p) { p.value = ""; p.type = "password"; }
    const goz = document.getElementById("ge-eye");
    if (goz) goz.textContent = "👁️";
    const hata = document.getElementById("ge-error");
    if (hata) hata.classList.add("hidden");
  }

  /* Oturum yoksa kapı açılır (sayfa arkada normal yüklenmeye devam eder) */
  if (!getAuthState() && !qrDogrudan()) goster();

  /* 👁️ Şifre göster/gizle (korumalı — eleman yoksa kod durmaz) */
  const geGoz = document.getElementById("ge-eye");
  if (geGoz) geGoz.addEventListener("click", () => {
    const p = document.getElementById("ge-pass");
    if (!p) return;
    const acikMi = p.type === "password";
    p.type = acikMi ? "text" : "password";
    geGoz.textContent = acikMi ? "🙈" : "👁️";
    p.focus();
  });

  function hataGoster(msg) {
    const h = document.getElementById("ge-error");
    h.textContent = msg;
    h.classList.remove("hidden");
  }

  async function girisYap() {
    const hata = document.getElementById("ge-error");
    const email = document.getElementById("ge-user").value.trim();
    const pass = document.getElementById("ge-pass").value;
    const btn = document.getElementById("ge-btn");
    if (!btn || btn.disabled) return;                 /* çift gönderim + koruma */
    if (!email || !pass) { hataGoster("E-posta ve şifre girin."); return; }
    hata.classList.add("hidden");
    btn.disabled = true;
    btn.classList.add("ge-yukleniyor");
    btn.querySelector("span").textContent = "Giriş yapılıyor…";
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass, returnSecureToken: true })
      });
      const j = await res.json();
      if (!res.ok) { hataGoster(fbErrText(j.error?.message || "")); return; }
      saveAuthState(j.idToken, j.refreshToken, j.expiresIn, j.email);
      currentUser = { email: j.email };
      await loadUserEntries();
      updateUserUI();
      gizle();
      if (!userEntries[j.email] && !ADMIN_EMAILS.includes(j.email.toLowerCase())) {
        setGuestInfo("ℹ️ Hesabın için henüz özel yetki atanmamış — <b>varsayılan yetkiler</b> uygulandı (ekleme/düzenleme/çoğaltma açık · silme/Excel kapalı). Yöneticin Admin Panel'den yetki verebilir.");
      }
      showToast("👋 Hoş geldin, <b>" + esc(shortUser(j.email)) + "</b>!", 3500);
      render();
      if (islemId != null) renderIslem();
      if (document.getElementById("opOverlay")) renderOpCard();
      otomatikGunlukYedek(); /* günün ilk girişinde yedek alınmamışsa arka planda al */
    } catch (e) {
      hataGoster("Bağlantı hatası: " + e.message);
    } finally {
      btn.disabled = false;
      btn.classList.remove("ge-yukleniyor");
      btn.querySelector("span").textContent = "Giriş yap";
    }
  }

  function misafirGir() {
    gizle();
    showToast("👁️ <b>Görüntüleme modu</b> — değişiklik yapmak için sağ üstten 🔐 Giriş yap.", 4500);
  }

  /* v1.3: ESNEK BAĞLAMA — hangi index.html ile çalışırsa çalışsın.
     • Yeni HTML (ge-form var) → tüm gönderimler submit üzerinden
       (buton tıkı, Enter, mobil "Git") → tek çağrı noktası.
     • Eski HTML (ge-form yok) → buton click + Enter yolu (v2 davranışı).
     Böylece dosyalardan biri eksik/eski kalırsa bile tuşlar çalışır. */
  const geForm = document.getElementById("ge-form");
  if (geForm) {
    geForm.addEventListener("submit", e => {
      e.preventDefault();
      girisYap();
    });
  } else {
    const btnEski = document.getElementById("ge-btn");
    if (btnEski) btnEski.addEventListener("click", girisYap);
    ["ge-user", "ge-pass"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("keydown", e => { if (e.key === "Enter") girisYap(); });
    });
  }
  const geMisafir = document.getElementById("ge-misafir");
  if (geMisafir) geMisafir.addEventListener("click", misafirGir);
})();
