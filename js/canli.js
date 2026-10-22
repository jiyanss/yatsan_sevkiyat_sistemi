/* =========================================================
   YATSAN — canli.js v1.3
   ---------------------------------------------------------
   TEK DOSYA (index.html'e 1 menü düğmesi + 1 modal + 1
   script satırı dışında dokunulmaz). 5 GÖREV:

   1) 👥 CANLI KULLANICI PANELİ (yalnız admin — 🛠️ Araçlar ▼
      altındaki "👥 Canlı Kullanıcılar" düğmesi)
      - Her sekme 15 sn'de bir sevkiyat_canli/presence/{id}
        düğümüne "buradayım" yazar (girişli + misafir HERKES)
      - Panel 5 sn'de bir listeyi tazeler: kim bağlı, girişli/
        misafir, cihaz, oturum süresi, son sinyal
      - Satır başına 🎁 (konfeti) ve 💬 (özel mesaj)
      - Üstteki yazma kutusundan HERKESE aynı anda duyuru

   2) 🎁 KONFETİ MOTORU — kütüphanesiz canvas; admin
      gönderince hedef sekme(ler)de patlar. Kutlama.js'ten
      bağımsızdır (12 sn bekleme kuralı oradan geçmez).

   3) 📣 DUYURU KARTI — admin mesajı ekran ortasında büyük
      kart olarak çıkar. "Herkese" = mesaj/all, "özel" =
      mesaj/{oturumId}. SSE ile canlı iletilir; sayfa açıkken
      gelen mesajlar anında görünür.

   4) 📅 GÜNÜN ÖZETİ — panelde bugünün sayacı: PLANLANAN yükleme adedi
      (operasyonel günü bugün olan tüm kayıtlar), GERÇEKLEŞEN adedi (başlangıç
      +bitiş damgalı), toplam m³, aktif ekip, en çok yükleyen ekip + açılır
      GÜN LİSTESİ (yükleme bitiş saati · müşteri · ekip · m³ · durum).
      Ana ekranla BİREBİR
      aynı kayıt evresi + tarih anahtarı (diger.js ekipEvren: reel plan →
      planlanan; kronometre yalnız plansız kayıtlarda yedek).
      index.html'e dokunmaz: özet bloğu canli.js tarafından canliKpi'nin
      üstüne otomatik enjekte edilir.

   5) 📣 ÖZET BİLDİRİMİ — admin "📣 Bildir" düğmesiyle Günün
      Yüklemeleri özeti (planlanan/gerçekleşen + saatli liste)
      ÇEVRİMİÇİ HERKESE bildirim kartı yollanır: mesaj/all'a
      tip:"ozet" mesajı yazılır (liste en çok 40 satır), açık
      sekmeler ekran ortasında geniş kart olarak alır; kart
      sure sn sonra ya da dokunulunca kapanır.

   ---------------------------------------------------------
   ⚠️ FIREBASE KURALLARI — Realtime Database → Rules'a KÖK
   düzeyde (en dış süslü parantezin içine, "sevkiyat" bloğunun
   KARDEŞİ olarak) şu blok eklenmeli; yoksa liste boş kalır
   ve mesajlar 401 alır:

   "sevkiyat_canli": {
     "presence": {
       ".read": "auth != null",
       "$id": { ".write": true }
     },
     "mesaj": {
       ".read": true,
       "$hedef": {
         ".write": "auth != null && (auth.token.email.toLowerCase() === 'admin@yatsan.com' || root.child('sevkiyat_users').child(auth.token.email.replace('.', ',')).child('role').val() === 'admin')"
       }
     }
   }

   (admin@yatsan.com yerine ADMIN_EMAILS'teki adres; Admin
   Panel'den role=admin verilen kullanıcılar ikinci koşulla
   otomatik yetkili olur.)

   KONSOL TANILAMA:  Canli.durum()
   ========================================================= */
(function () {
  "use strict";
  if (window.Canli) return; // çift yükleme koruması

  /* ---------------- Sabitler ---------------- */
  const CANLI_PRESENCE = "sevkiyat_canli/presence";
  const CANLI_MESAJ = "sevkiyat_canli/mesaj";
  const SS_ID = "sevkiyat_canli_id";      // sekme başına benzersiz oturum kimliği
  const SS_GIRIS = "sevkiyat_canli_giris"; // sekmenin oturum başlangıcı
  const LS_SON = "sevkiyat_canli_son";     // en son gösterilen mesajın ts'i
  const BEAT_MS = 15000;   // kalp atışı aralığı
  const STALE_MS = 50000;  // bu kadar sessiz olan "çevrimdışı" sayılır
  const SIL_MS = 600000;   // 10 dk sessiz olan kayıt listeden silinir
  const RENKLER = ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#06b6d4", "#eab308", "#ec4899"];

  const $ = (id) => document.getElementById(id);
  const dbUrl = (yol) => `${FIREBASE_DB_URL}/${yol}.json`;
  const fbKey = (s) => encodeURIComponent(String(s));

  /* ---------------- Oturum kimliği ---------------- */
  let _id = null;
  function benimId() {
    if (_id) return _id;
    const uret = () => "c-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    try {
      _id = sessionStorage.getItem(SS_ID);
      if (!_id) { _id = uret(); sessionStorage.setItem(SS_ID, _id); }
    } catch (_) { _id = uret(); }
    return _id;
  }
  function sesGiris() {
    try {
      let g = Number(sessionStorage.getItem(SS_GIRIS));
      if (!g) { g = Date.now(); sessionStorage.setItem(SS_GIRIS, String(g)); }
      return g;
    } catch (_) { return Date.now(); }
  }
  function kimlik() {
    if (typeof currentUser !== "undefined" && currentUser && currentUser.email)
      return { tip: "girisli", email: currentUser.email };
    return { tip: "misafir", email: "" };
  }
  function cihaz() {
    try {
      if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean")
        return navigator.userAgentData.mobile ? "mobil" : "masaüstü";
    } catch (_) {}
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || "") ? "mobil" : "masaüstü";
  }

  /* ================= 1) PRESENCE (kalp atışı) ================= */
  let rulesUyarildi = false;
  async function heartbeat() {
    try {
      const k = kimlik();
      const rec = {
        id: benimId(),
        email: k.tip === "girisli" ? k.email : "",
        tip: k.tip,
        isim: k.tip === "girisli" ? (typeof shortUser === "function" ? shortUser(k.email) : k.email) : "",
        cihaz: cihaz(),
        girisTs: sesGiris(),
        ts: Date.now()
      };
      const res = await fetch(dbUrl(CANLI_PRESENCE + "/" + fbKey(rec.id)), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rec)
      });
      if (!res.ok && !rulesUyarildi) {
        rulesUyarildi = true;
        console.warn("👥 Canlı kullanıcılar: presence yazılamadı (HTTP " + res.status +
          ") — Firebase kurallarına 'sevkiyat_canli' bloğu eklendi mi?");
      }
    } catch (_) {}
  }
  function ayrilSil() {
    try {
      fetch(dbUrl(CANLI_PRESENCE + "/" + fbKey(benimId())), { method: "DELETE", keepalive: true });
    } catch (_) {}
  }

  /* ================= 2) KONFETİ MOTORU ================= */
  let cnv = null, ctx = null, par = [], konRaf = 0;
  function konBoyutla() {
    if (!cnv) return;
    const d = Math.min(2, window.devicePixelRatio || 1);
    cnv.width = Math.floor(innerWidth * d);
    cnv.height = Math.floor(innerHeight * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function konDalga() {
    if (par.length > 400) return; // doldur, taşırma
    const W = innerWidth, H = innerHeight;
    for (let s = 0; s < 2; s++) {
      const sol = s === 0;
      for (let i = 0; i < 55; i++) {
        const ang = (sol ? 65 : 115) + (Math.random() * 30 - 15);
        const rad = ang * Math.PI / 180;
        const hiz = 11 + Math.random() * 8;
        par.push({
          x: sol ? W * 0.03 : W * 0.97,
          y: H + 12,
          vx: Math.cos(rad) * hiz * (sol ? 1 : -1),
          vy: -Math.abs(Math.sin(rad)) * hiz,
          w: 6 + Math.random() * 5,
          h: 9 + Math.random() * 7,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          renk: RENKLER[(Math.random() * RENKLER.length) | 0],
          kare: Math.random() < 0.75
        });
      }
    }
  }
  function konDondur() {
    konRaf = requestAnimationFrame(konDondur);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = par.length - 1; i >= 0; i--) {
      const p = par[i];
      p.vy += 0.32; p.vx *= 0.992;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y > innerHeight + 40) { par.splice(i, 1); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.renk;
      if (p.kare) ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      else { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, 6.2832); ctx.fill(); }
      ctx.restore();
    }
    if (!par.length) {
      cancelAnimationFrame(konRaf); konRaf = 0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
  }
  function konfeti() {
    if (document.hidden) return;
    try {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    } catch (_) {}
    if (!cnv) {
      cnv = document.createElement("canvas");
      cnv.id = "canliKonfeti";
      cnv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:230;";
      document.body.appendChild(cnv);
      ctx = cnv.getContext("2d");
      konBoyutla();
      window.addEventListener("resize", konBoyutla);
    }
    konDalga();
    window.setTimeout(konDalga, 380);
    window.setTimeout(konDalga, 760);
    if (!konRaf) konDondur();
  }

  /* ================= 3) DUYURU KARTI ================= */
  let duyEl = null, duyTimer = null;
  function duyuruKapat() {
    clearTimeout(duyTimer);
    if (duyEl) duyEl.classList.remove("acik");
  }
  function duyuruGoster(m, ozel) {
    const ozetVar = m && m.tip === "ozet" && m.ozet;
    const metin = String(m.text || "");
    if (!metin && !m.konfeti && !ozetVar) return;
    try { if (typeof bildirimDing === "function") bildirimDing(); } catch (_) {}
    if (ozetVar) {
      ozetKartGoster(m);
    } else if (metin) {
      if (!duyEl) {
        duyEl = document.createElement("div");
        duyEl.id = "canliDuyuru";
        document.body.appendChild(duyEl);
        duyEl.addEventListener("click", duyuruKapat);
      }
      const kim = m.from ? (typeof shortUser === "function" ? shortUser(m.from) : m.from) : "Yönetici";
      duyEl.innerHTML =
        '<div class="cd-kart">' +
          '<div class="cd-bas">' + (ozel ? "💝 Sana özel mesaj" : "📣 Duyuru") +
            ' <span class="cd-kim">— ' + esc(kim) + "</span></div>" +
          '<div class="cd-metin">' + esc(metin).replace(/\n/g, "<br>") + "</div>" +
          '<div class="cd-not">kapatmak için dokun</div>' +
        "</div>";
      duyEl.classList.remove("acik");
      /* yeniden animasyon: reflow zorla */
      void duyEl.offsetWidth;
      duyEl.classList.add("acik");
      clearTimeout(duyTimer);
      duyTimer = setTimeout(duyuruKapat, (Number(m.sure) || 12) * 1000);
    } else if (m.konfeti) {
      showToast(ozel ? "🎁 Sana özel bir kutlama!" : "🎁 Bir kutlama var!");
    }
    if (m.konfeti) konfeti();
  }

  /* --- Özet bildirim kartı (tip:"ozet" mesajlar) --- */
  function ozetKartListeHtml(liste) {
    const satir = (x) => {
      x = x || {};
      const tamam = !!x.tamam;
      const saat = tamam ? String(x.saat || "") : "—";
      const m3c = tamam ? String(x.m3 == null ? "" : x.m3) : "—";
      const dur = tamam ? '<span class="co-tam">✓</span>' : esc(String(x.durum || "Planlı"));
      return '<div class="co-row' + (tamam ? "" : " co-bekleyen") + '">' +
        '<span class="co-saat' + (tamam ? " co-tam" : "") + '">' + esc(saat) + "</span>" +
        '<span class="co-mus">' + esc(String(x.mus || "—")) + "</span>" +
        '<span class="co-ekip">' + esc(String(x.ekip || "Atanmamış")) + "</span>" +
        '<span class="co-m3">' + esc(m3c) + "</span>" +
        '<span class="co-durum">' + dur + "</span></div>";
    };
    const baslik = '<div class="co-row co-head"><span>Saat</span><span>Müşteri</span><span>Ekip</span>' +
      '<span class="co-m3">m³</span><span>Durum</span></div>';
    const ks = Array.isArray(liste) ? liste.slice(0, 40) : [];
    return baslik + (ks.length ? ks.map(satir).join("") :
      '<div class="co-row" style="justify-content:center;padding:10px;color:var(--muted)">Liste boş</div>');
  }
  function ozetKartGoster(m) {
    if (!duyEl) {
      duyEl = document.createElement("div");
      duyEl.id = "canliDuyuru";
      document.body.appendChild(duyEl);
      duyEl.addEventListener("click", duyuruKapat);
    }
    const o = m.ozet || {};
    const kim = m.from ? (typeof shortUser === "function" ? shortUser(m.from) : m.from) : "Yönetici";
    const plan = Number(o.plan) || 0, yuk = Number(o.yuk) || 0;
    duyEl.innerHTML =
      '<div class="cd-kart cd-ozet">' +
        '<div class="cd-bas">📊 Günün Yüklemeleri <span class="cd-kim">— ' + esc(kim) + "</span></div>" +
        '<div class="cd-ozet-bas">📅 ' + esc(String(o.tarih || "")) +
          " · 📋 <b>" + plan + "</b> planlanan · ✅ <b>" + yuk + "</b> gerçekleşen" +
          (o.m3Txt != null && o.m3Txt !== "" ? " · <b>" + esc(String(o.m3Txt)) + "</b> m³" : "") +
        "</div>" +
        '<div class="cd-ozet-liste">' + ozetKartListeHtml(o.liste) + "</div>" +
        '<div class="cd-not">kapatmak için dokun</div>' +
      "</div>";
    duyEl.classList.remove("acik");
    void duyEl.offsetWidth;
    duyEl.classList.add("acik");
    clearTimeout(duyTimer);
    duyTimer = setTimeout(duyuruKapat, (Number(m.sure) || 25) * 1000);
  }

  /* ================= Mesaj akışları (SSE) ================= */
  const akislar = {};
  function sonG() { try { return Number(localStorage.getItem(LS_SON)) || 0; } catch (_) { return 0; } }
  function sonGYaz(ts) { try { localStorage.setItem(LS_SON, String(ts)); } catch (_) {} }
  function akisBaslat(hedef) {
    try {
      if (akislar[hedef]) { try { akislar[hedef].close(); } catch (_) {} }
      const es = new EventSource(dbUrl(CANLI_MESAJ + "/" + hedef));
      akislar[hedef] = es;
      const isle = (e) => {
        try {
          /* RTDB REST akışı: {"path":"/","data":{...}} biçiminde yollar */
          const p = JSON.parse(e.data);
          const m = p && p.data;
          if (!m || !m.ts) return;
          if (m.ts <= sonG()) return;                     // eski / zaten gösterildi
          sonGYaz(m.ts);
          if (Date.now() - m.ts > 120000) return;         // 2 dk'dan eski duyuru tekrar açılmaz
          duyuruGoster(m, hedef !== "all");
        } catch (_) {}
      };
      es.addEventListener("put", isle);
      es.addEventListener("patch", isle);
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED)
          setTimeout(() => { if (akislar[hedef] === es) akisBaslat(hedef); }, 5000);
      };
    } catch (_) {}
  }

  /* ================= 4) ADMİN PANELİ ================= */
  let canliIv = null, tazelemede = false, sonListe = [], ozelHedef = null;

  function sureYaz(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) return s + " sn";
    const m = Math.floor(s / 60);
    if (m < 60) return m + " dk " + (s % 60) + " sn";
    const h = Math.floor(m / 60);
    if (h < 24) return h + " sa " + (m % 60) + " dk";
    return Math.floor(h / 24) + " gün " + (h % 24) + " sa";
  }
  function sinyalYaz(ts) {
    const sn = Math.max(0, Math.round((Date.now() - ts) / 1000));
    return sn < 8 ? "şimdi" : sn + " sn önce";
  }
  function adminMi(u) {
    return !!(u.tip === "girisli" && u.email &&
      typeof userEntries === "object" && userEntries[u.email] && userEntries[u.email].role === "admin");
  }

  async function renderCanli() {
    const tb = $("canliTable");
    if (!tb || tazelemede) return;
    tazelemede = true;
    try {
      const res = await authFetch(dbUrl(CANLI_PRESENCE), {});
      const data = (await res.json()) || {};
      const simdi = Date.now();
      /* 10 dk'dır sinyal vermeyen kayıtları temizle */
      Object.keys(data).forEach(k => {
        if (!data[k] || simdi - (data[k].ts || 0) > SIL_MS)
          authFetch(dbUrl(CANLI_PRESENCE + "/" + k), { method: "DELETE" }).catch(() => {});
      });
      sonListe = Object.values(data)
        .filter(u => u && u.id && simdi - (u.ts || 0) < STALE_MS);
      sonListe.sort((a, b) => {
        const aa = adminMi(a) ? 0 : 1, bb = adminMi(b) ? 0 : 1;
        if (aa !== bb) return aa - bb;
        const ta = a.tip === "girisli" ? 0 : 1, tb2 = b.tip === "girisli" ? 0 : 1;
        if (ta !== tb2) return ta - tb2;
        return (a.girisTs || a.ts || 0) - (b.girisTs || b.ts || 0);
      });
      const g = sonListe.filter(u => u.tip === "girisli").length;
      const m = sonListe.length - g;
      $("canliKpi").innerHTML =
        '<span class="ck c-total">🟢 Çevrimiçi: ' + sonListe.length + "</span>" +
        '<span class="ck c-g">👤 Girişli: ' + g + "</span>" +
        '<span class="ck c-m">👁️ Misafir: ' + m + "</span>";
      renderOzet();
      tb.innerHTML = sonListe.map(u => {
        const sen = u.id === benimId();
        const girisli = u.tip === "girisli";
        const ad = girisli ? (u.isim || shortUser(u.email)) : ("Misafir · " + String(u.id).slice(-4).toUpperCase());
        const basTs = u.girisTs || u.ts || simdi;
        return '<tr class="' + (sen ? "canli-sen" : "") + '">' +
          "<td>" + (adminMi(u) ? "🛡️ " : girisli ? "👤 " : "👁️ ") + esc(ad) +
            (sen ? ' <span class="canli-sen-et">sen</span>' : "") +
            '<div class="canli-mail">' + (girisli ? esc(u.email || "") : "giriş yapmadan görüntülüyor") + "</div></td>" +
          '<td><span class="' + (girisli ? "user-chip" : "guest-chip") + '">' + (girisli ? "Girişli" : "Misafir") + "</span></td>" +
          '<td class="center">' + (u.cihaz === "mobil" ? "📱 Mobil" : "💻 Masaüstü") + "</td>" +
          '<td class="center" title="Oturum başlangıcı: ' + new Date(basTs).toLocaleTimeString("tr-TR") + '">' + sureYaz(simdi - basTs) + "</td>" +
          '<td class="center">' + sinyalYaz(u.ts || simdi) + "</td>" +
          '<td class="center">' +
            '<button class="icon-btn" data-gift="' + esc(u.id) + '" title="🎁 Konfeti patlat">🎁</button>' +
            '<button class="icon-btn" data-msg="' + esc(u.id) + '" title="💬 Özel mesaj yaz">💬</button>' +
          "</td></tr>";
      }).join("") ||
        '<tr><td colspan="6" class="hint" style="text-align:center;padding:18px">Şu anda bağlı kullanıcı yok — listeyi doldurmak için sekmelerin en az bir kalp atışı (≤15 sn) vermesini bekle.</td></tr>';
    } catch (e) {
      tb.innerHTML = '<tr><td colspan="6" class="hint" style="text-align:center;padding:14px">❌ Liste alınamadı: ' + esc(e.message) +
        '<br>Firebase kurallarına <b>"sevkiyat_canli"</b> bloğu eklendi mi? (canli.js başlığındaki hazır blok)</td></tr>';
    } finally {
      tazelemede = false;
    }
  }

  function renderHedef() {
    const el = $("canliHedef"), btn = $("btnCanliHerkese");
    if (!el || !btn) return;
    if (ozelHedef) {
      el.innerHTML = '💬 <b>' + esc(ozelHedef.ad) + "</b> (özel) <a id='canliHedefSil' title='Herkese dön'>✖</a>";
      btn.textContent = "📤 Gönder";
      const sil = $("canliHedefSil");
      if (sil) sil.addEventListener("click", hedefSifirla);
    } else {
      el.textContent = "📣 Herkese";
      btn.textContent = "📣 Herkese Gönder";
    }
  }
  function hedefSifirla() { ozelHedef = null; renderHedef(); }

  async function yolla(hedefId, text, konfetimi, sureSn, ekstra) {
    if (typeof isAdmin !== "function" || !isAdmin()) { alert("Sadece yöneticiler gönderebilir."); return false; }
    try {
      await authFetch(dbUrl(CANLI_MESAJ + "/" + hedefId), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({
          ts: Date.now(), text: text || "", from: currentUser.email,
          konfeti: !!konfetimi, sure: Number(sureSn) || 12
        }, ekstra || {}))
      });
      showToast("✅ Gönderildi — açık sekmeler birkaç saniye içinde alır.");
      return true;
    } catch (e) {
      alert("Gönderilemedi: " + e.message + "\n\nFirebase kurallarında 'sevkiyat_canli/mesaj' yazma izni admin hesabına açık olmalı.");
      return false;
    }
  }

  async function gonderHerkese() {
    const metin = $("canliMsg").value.trim();
    const konf = $("canliKonfeti").checked;
    const sure = Number($("canliSure").value) || 12;
    if (!metin && !konf) { showToast("Önce bir mesaj yaz ya da 🎁 konfeti kutusunu işaretle 🙂"); return; }
    if (await yolla(ozelHedef ? ozelHedef.id : "all", metin, konf, sure)) {
      $("canliMsg").value = "";
      hedefSifirla();
    }
  }

  /* --- Günün Özeti'ni çevrimiçi herkese bildirim olarak yolla --- */
  async function ozetDuyur() {
    if (typeof isAdmin !== "function" || !isAdmin()) { alert("Sadece yöneticiler gönderebilir."); return; }
    const o = gunOzeti();
    if (!o) { showToast("📊 Özet verisi hazır değil — ana veri henüz yüklenmemiş olabilir."); return; }
    if (!o.kitap.length) { showToast("Bugüne ait kayıt yok — gönderilecek özet yok."); return; }
    const m3Kisa = (typeof fmtN === "function") ? fmtN(o.m3) : Math.round(o.m3);
    if (!confirm("📊 Günün yüklemeleri özeti ÇEVRİMİÇİ HERKESE bildirim olarak gönderilsin mi?\n\n📋 Planlanan " + o.plan + " · ✅ Gerçekleşen " + o.yuk + " · " + m3Kisa + " m³")) return;
    const liste = o.kitap.slice(0, 40).map(x => {
      const r = x.r, tamam = !!x.rw;
      let durum = "";
      if (!tamam) {
        durum = ((r.toplamaBasTs || r.loadingStartedAt) ? "⏳ " : "") + (r.durum || "Planlı");
        if (r.durum === "Yükleme Tamamlandı") durum += " (saat damgası yok)";
      }
      return {
        tamam,
        saat: tamam ? new Date(Number(r.loadingEndedAt) || Number(r.toplamaBittiTs) || 0).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "",
        mus: String(r.musteri || r.ad || "—"),
        ekip: r.ekip ? ((typeof ekipAd2 === "function") ? ekipAd2(r.ekip) : r.ekip) : "Atanmamış",
        m3: tamam ? ((typeof fmtN === "function") ? fmtN(x.rw.m3) : Math.round(x.rw.m3)) : "",
        durum
      };
    });
    const tarih = ((typeof formatDate === "function") ? formatDate(o.bugun) : o.bugun) + " " + new Date().toLocaleDateString("tr-TR", { weekday: "long" });
    await yolla("all", "", false, 25, {
      tip: "ozet",
      ozet: {
        tarih: tarih,
        plan: o.plan, yuk: o.yuk,
        m3Txt: m3Kisa,
        liste: liste
      }
    });
  }

  function acPanel() {
    if (typeof isAdmin !== "function" || !isAdmin()) { alert("Bu panel sadece yöneticiler içindir."); return; }
    $("canliModal").classList.remove("hidden");
    renderHedef();
    renderCanli();
    if (!canliIv) canliIv = setInterval(renderCanli, 5000);
  }
  function kapatPanel() {
    $("canliModal").classList.add("hidden");
    if (canliIv) { clearInterval(canliIv); canliIv = null; }
  }

  /* ================= 4.5) GÜNÜN ÖZETİ (planlanan / gerçekleşen / saatli liste) =================
     Ana ekrandaki sayaçlarla BİREBİR: aynı kayıt evresi ve aynı operasyonel
     tarih anahtarı. • PLANLANAN = operasyonel günü (reel plan → planlanan,
     damgasızda kronometre bitişi) bugün olan TÜM kayıtlar • GERÇEKLEŞEN =
     başlangıç+bitiş damgalı olanlar (ekipEvren evresi — bekleyen/süren
     sayılmaz) • LİSTE = günün kayıtları YÜKLEME BİTİŞ saatine göre sıralı
     (loadingEndedAt; damgasızsa toplama bitişi yedek).
     Arşiv dahil seçiliyken arşiv havuzu da eklenir. index.html'e dokunmaz:
     blok, canliKpi'nin üstüne otomatik eklenir; liste durumunu korur. */
  let ozetAcik = false;
  function ozetHedefAlan() {
    let d = $("canliOzet");
    if (d) return d;
    const kpi = $("canliKpi");
    if (!kpi || !kpi.parentNode) return null;
    d = document.createElement("div");
    d.id = "canliOzet";
    d.className = "canli-kpi";
    d.addEventListener("click", (e) => {
      if (e.target.closest("[data-ozet-toggle]")) { ozetAcik = !ozetAcik; renderOzet(); }
      else if (e.target.closest("[data-ozet-duyur]")) { ozetDuyur(); }
    });
    kpi.parentNode.insertBefore(d, kpi);
    return d;
  }
  function gunOzeti() {
    try {
      if (typeof ekipEvren !== "function" || typeof rows === "undefined" || !Array.isArray(rows)) return null;
      if (typeof gecikmeTarihi !== "function") return null;
      let havuz = rows;
      if (typeof arsivDahil !== "undefined" && arsivDahil && Array.isArray(arsivCache) && arsivCache.length) {
        const ids = new Set(rows.map(r => r.id));
        havuz = rows.concat(arsivCache.filter(r => !ids.has(r.id)));
      }
      const bugun = (typeof todayISO === "function") ? todayISO() : isoFromDate(new Date());
      const evren = ekipEvren(havuz);
      const rowByRec = new Map();
      evren.forEach(x => rowByRec.set(x.r, x));
      const kitap = havuz.filter(r => {
        const rw = rowByRec.get(r);
        return (rw ? rw.gun : (gecikmeTarihi(r) || "")) === bugun;
      }).map(r => ({ r, rw: rowByRec.get(r) || null }));
      /* yükleme bitiş saatine göre sıralı (yoksa toplama bitişi); damgasızlar en sonda */
      kitap.sort((a, b) => {
        const ta = a.rw ? (Number(a.r.loadingEndedAt) || Number(a.r.toplamaBittiTs) || 0) : 0;
        const tb = b.rw ? (Number(b.r.loadingEndedAt) || Number(b.r.toplamaBittiTs) || 0) : 0;
        if (ta && tb) return ta - tb;
        if (ta) return -1;
        if (tb) return 1;
        return 0;
      });
      const damgalilar = kitap.filter(x => x.rw).map(x => x.rw);
      const m3 = damgalilar.reduce((t, x) => t + x.m3, 0);
      const ekipSet = new Set(damgalilar.map(x => x.ekip).filter(k => k && k !== "__atanmamis__"));
      const hm = new Map();
      damgalilar.forEach(x => {
        if (!x.ekip || x.ekip === "__atanmamis__") return;
        const g = hm.get(x.ekip) || { n: 0, m3: 0 };
        g.n++; g.m3 += x.m3; hm.set(x.ekip, g);
      });
      let enIyi = null;
      hm.forEach((v, k) => { if (!enIyi || v.m3 > enIyi.g.m3) enIyi = { k, g: v }; });
      return { bugun, plan: kitap.length, yuk: damgalilar.length, m3, ekipN: ekipSet.size, enIyi, kitap };
    } catch (_) { return null; }
  }
  function ozetListeHtml(o) {
    const satir = (x) => {
      const r = x.r;
      const tamam = !!x.rw;
      const saat = tamam
        ? new Date(Number(r.loadingEndedAt) || Number(r.toplamaBittiTs)).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
        : "—";
      const ad = esc(r.musteri || r.ad || "—");
      const ek = esc(r.ekip ? ((typeof ekipAd2 === "function") ? ekipAd2(r.ekip) : r.ekip) : "Atanmamış");
      const m3c = tamam ? ((typeof fmtN === "function") ? fmtN(x.rw.m3) : Math.round(x.rw.m3)) : "—";
      let dur;
      if (tamam) dur = '<span class="co-tam">✓</span>';
      else {
        dur = esc(((r.toplamaBasTs || r.loadingStartedAt) ? "⏳ " : "") + (r.durum || "Planlı"));
        if (r.durum === "Yükleme Tamamlandı") dur += ' <span class="co-not">(saat damgası yok)</span>';
      }
      return '<div class="co-row' + (tamam ? "" : " co-bekleyen") + '">' +
        '<span class="co-saat' + (tamam ? " co-tam" : "") + '">' + saat + "</span>" +
        '<span class="co-mus">' + ad + "</span>" +
        '<span class="co-ekip">' + ek + "</span>" +
        '<span class="co-m3">' + m3c + "</span>" +
        '<span class="co-durum">' + dur + "</span></div>";
    };
    const baslik = '<div class="co-row co-head"><span>Saat</span><span>Müşteri</span><span>Ekip</span>' +
      '<span class="co-m3">m³</span><span>Durum</span></div>';
    return baslik + (o.kitap.length ? o.kitap.map(satir).join("") : '<div class="co-row" style="justify-content:center;padding:10px;color:var(--muted)">Bugüne ait kayıt yok</div>');
  }
  function renderOzet() {
    const d = ozetHedefAlan();
    if (!d) return;
    const o = gunOzeti();
    if (!o) { d.innerHTML = ""; return; }
    const eski = d.querySelector(".co-list");
    const sc = eski ? eski.scrollTop : 0;
    const tarih = (typeof formatDate === "function") ? formatDate(o.bugun) : o.bugun;
    const gunAdi = new Date().toLocaleDateString("tr-TR", { weekday: "long" });
    const m3Txt = (typeof fmtN === "function") ? fmtN(o.m3) : Math.round(o.m3);
    d.innerHTML =
      '<span class="ck c-d" title="Operasyonel gün: reel plan → planlanan">📅 ' + esc(tarih) + " " + esc(gunAdi) + "</span>" +
      '<span class="ck c-p" title="Operasyonel günü bugün olan tüm kayıtlar">📋 Planlanan: <b>' + o.plan + "</b></span>" +
      '<span class="ck c-total" title="Başlangıç+bitiş damgalı (tamamlanmış) yüklemeler — ana ekran ölçüsü">✅ Gerçekleşen: <b>' + o.yuk + "</b> · " + m3Txt + " m³</span>" +
      '<button class="co-toggle" data-ozet-toggle title="Günün yükleme listesini aç/kapat">' + (ozetAcik ? "▴" : "▾") + " Günün yüklemeleri (" + o.plan + ")</button>" +
      '<button class="co-toggle co-duyur" data-ozet-duyur title="Bu özeti çevrimiçi herkese bildirim kartı olarak gönder">📣 Bildir</button>' +
      (ozetAcik ? '<div class="co-list">' + ozetListeHtml(o) + "</div>" : "");
    if (ozetAcik) { const nl = d.querySelector(".co-list"); if (nl) nl.scrollTop = sc; }
  }

  /* ================= 5) MENÜ GÖRÜNÜRLÜĞÜ (yalnız admin) ================= */
  function menuGizle() {
    const b = $("btnLiveUsers");
    if (b) b.classList.toggle("hidden", !(typeof isAdmin === "function" && isAdmin()));
  }
  function menuDene() {
    if (typeof window.updateUserUI !== "function") return false;
    if (window.updateUserUI.__canli) return true;
    const orij = window.updateUserUI;
    window.updateUserUI = function () {
      const r = orij.apply(this, arguments);
      try { menuGizle(); } catch (_) {}
      return r;
    };
    window.updateUserUI.__canli = true;
    menuGizle();
    return true;
  }

  /* ================= CSS (tema değişkenli — koyu tema uyumlu) ================= */
  function stilYukle() {
    if (document.getElementById("canli-stili")) return;
    const st = document.createElement("style");
    st.id = "canli-stili";
    st.textContent =
      ".canli-kpi{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 4px}" +
      ".ck{font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px;white-space:nowrap}" +
      ".ck.c-total{background:var(--green-soft);color:var(--green)}" +
      ".ck.c-g{background:var(--primary-soft);color:var(--primary)}" +
      ".ck.c-m{background:var(--amber-soft);color:var(--amber)}" +
      ".ck.c-d{background:var(--surface);color:var(--text);border:1px solid var(--border);font-weight:600}" +
      ".ck.c-p{background:var(--primary-soft);color:var(--primary)}" +
      ".co-toggle{background:none;border:none;color:var(--primary);cursor:pointer;font-size:12.5px;font-weight:800;padding:2px 0;text-align:left}" +
      ".co-toggle:hover{text-decoration:underline}" +
      ".co-list{border:1px solid var(--border);border-radius:10px;background:var(--surface);max-height:34vh;overflow-y:auto;margin-top:2px}" +
      ".co-row{display:flex;gap:8px;align-items:baseline;font-size:12px;padding:4px 8px;border-bottom:1px solid var(--border);min-width:0}" +
      ".co-row:last-child{border-bottom:none}" +
      ".co-head{font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);position:sticky;top:0;background:var(--surface);z-index:1}" +
      ".co-saat{flex:0 0 38px;font-weight:800}" +
      ".co-mus{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:var(--text)}" +
      ".co-ekip{flex:0 0 auto;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)}" +
      ".co-m3{flex:0 0 52px;text-align:right;color:var(--muted)}" +
      ".co-durum{flex:0 0 auto;max-width:118px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:11px}" +
      ".co-tam{color:var(--green)}" +
      ".co-bekleyen{opacity:.75}" +
      ".co-not{opacity:.7;font-size:10px}" +
      ".co-duyur{border:1px solid var(--primary);border-radius:999px;padding:2px 10px;background:var(--primary-soft)}" +
      ".co-duyur:hover{text-decoration:none;filter:brightness(1.06)}" +
      "@media (max-width:560px){.co-ekip{display:none}.co-durum{max-width:84px}}" +
      "body.dark .ck.c-total,body[data-theme='forest'] .ck.c-total,body[data-theme='grape'] .ck.c-total{background:#064e3b;color:#6ee7b7}" +
      "body.dark .ck.c-m,body[data-theme='forest'] .ck.c-m,body[data-theme='grape'] .ck.c-m{background:#78350f;color:#fcd34d}" +
      ".canli-compose{margin-top:8px;display:flex;flex-direction:column;gap:8px}" +
      ".canli-compose textarea{width:100%;resize:vertical}" +
      ".canli-compose-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}" +
      ".canli-chk{font-size:12.5px;display:flex;gap:5px;align-items:center;cursor:pointer;color:var(--text)}" +
      ".canli-chk input{accent-color:var(--primary);margin:0}" +
      ".canli-hedef{font-size:12.5px;color:var(--primary);background:var(--primary-soft);border:1px solid var(--primary);padding:5px 10px;border-radius:999px}" +
      ".canli-hedef b{color:var(--primary)}" +
      "#canliHedefSil{cursor:pointer;margin-left:4px;text-decoration:none}" +
      ".canli-mail{font-size:11px;color:var(--muted)}" +
      ".canli-sen td{background:var(--primary-soft)!important}" +
      ".canli-sen-et{font-size:10px;font-weight:800;color:var(--primary);border:1px solid var(--primary);border-radius:999px;padding:1px 6px;margin-left:4px;vertical-align:middle}" +
      "#canliDuyuru{position:fixed;inset:0;z-index:240;display:none;align-items:center;justify-content:center;pointer-events:none;padding:16px}" +
      "#canliDuyuru.acik{display:flex}" +
      ".cd-kart{pointer-events:auto;cursor:pointer;background:var(--surface);border:2px solid var(--primary);border-radius:18px;" +
        "box-shadow:0 24px 70px rgba(0,0,0,.42);max-width:min(520px,88vw);padding:24px 30px;text-align:center;" +
        "animation:canli-pop .45s cubic-bezier(.2,1.4,.4,1)}" +
      ".cd-bas{font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--primary);margin-bottom:10px}" +
      ".cd-kim{color:var(--muted);font-weight:600;text-transform:none;letter-spacing:0}" +
      ".cd-metin{font-size:19px;line-height:1.45;font-weight:700;color:var(--text)}" +
      ".cd-not{margin-top:12px;font-size:10.5px;color:var(--muted);opacity:.8}" +
      ".cd-kart.cd-ozet{max-width:min(660px,92vw);text-align:left;padding:18px 20px}" +
      ".cd-ozet-bas{font-size:13px;line-height:1.5;font-weight:600;color:var(--text);margin-bottom:10px;text-align:center}" +
      ".cd-ozet-liste{max-height:38vh;overflow-y:auto;border:1px solid var(--border);border-radius:8px}" +
      "@keyframes canli-pop{from{transform:scale(.75);opacity:0}to{transform:scale(1);opacity:1}}";
    document.head.appendChild(st);
  }

  /* ================= Başlat ================= */
  function bagla(id, fn) {
    const el = $(id);
    if (!el) { console.warn("👥 canli.js: #" + id + " bulunamadı — index.html güncel mi?"); return; }
    el.addEventListener("click", fn);
  }
  function kur() {
    stilYukle();
    bagla("btnLiveUsers", acPanel);
    bagla("btnCanliClose", kapatPanel);
    bagla("btnCanliHerkese", gonderHerkese);
    const tb = $("canliTable");
    if (tb) tb.addEventListener("click", (e) => {
      const g = e.target.closest("[data-gift]");
      const ms = e.target.closest("[data-msg]");
      if (g) { yolla(g.dataset.gift, "", true, 6); return; }
      if (ms) {
        const u = sonListe.find(x => x.id === ms.dataset.msg);
        if (!u) return;
        const ad = u.tip === "girisli" ? (u.isim || shortUser(u.email)) : ("Misafir · " + String(u.id).slice(-4).toUpperCase());
        ozelHedef = { id: u.id, ad: ad };
        renderHedef();
        const ta = $("canliMsg");
        ta.focus();
        showToast("💬 Mesaj kutusuna yaz — yalnızca <b>" + esc(ad) + "</b> görecektir.");
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const m = $("canliModal");
      if (m && !m.classList.contains("hidden")) kapatPanel();
    });
    heartbeat();
    setInterval(heartbeat, BEAT_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) heartbeat(); });
    window.addEventListener("pagehide", ayrilSil);
    window.addEventListener("pageshow", () => heartbeat());
    akisBaslat("all");
    akisBaslat(benimId());
    /* updateUserUI hazır olunca sarmala → menü düğmesi yalnız adminte görünür */
    let deneme = 0;
    const kurucu = setInterval(() => {
      try { if (menuDene() || ++deneme > 240) clearInterval(kurucu); } catch (_) { clearInterval(kurucu); }
    }, 250);
  }

  try { kur(); } catch (e) { console.warn("Canli başlatılamadı:", e.message); }

  /* ================= Dış API ================= */
  window.Canli = {
    /* Paneli aç (menü düğmesiyle aynı) */
    panel: function () { acPanel(); },
    /* Teşhis: konsolda Canli.durum() */
    durum: function () {
      return {
        oturumId: benimId(),
        girisTs: new Date(sesGiris()).toLocaleTimeString("tr-TR"),
        sonGosterilenMesaj: sonG() ? new Date(sonG()).toLocaleTimeString("tr-TR") : null,
        akislar: Object.keys(akislar).map(k => k === "all" ? "all:" + akislar[k].readyState : "özel:" + akislar[k].readyState),
        liste: sonListe.length,
        hedef: ozelHedef,
      };
    },
    /* Manuel test: Canli.konfeti() / Canli.duyuru("merhaba") / Canli.ozetBildir() */
    konfeti: function () { konfeti(); },
    duyuru: function (metin) { duyuruGoster({ ts: Date.now(), text: metin || "Test duyurusu 🎉", from: (typeof currentUser !== "undefined" && currentUser) ? currentUser.email : "yönetici", sure: 12 }, false); },
    /* Günün Özeti'ni herkese bildirim olarak yollar (paneldeki 📣 Bildir ile aynı) */
    ozetBildir: function () { ozetDuyur(); },
  };
})();
