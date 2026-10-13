(function () {
  "use strict";

  var cfg = window.APP_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Static text from config ----------
  $("title").textContent = cfg.TITLE || "Our Little Memories";
  $("subtitle").textContent = cfg.SUBTITLE || "";
  $("closing").textContent = cfg.CLOSING_MESSAGE || "";
  document.title = cfg.TITLE || document.title;

  // ---------- Optional passcode gate (a surprise, not real security) ----------
  function safeSession(key, val) {
    try {
      if (val === undefined) return sessionStorage.getItem(key);
      sessionStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  function startGate() {
    var gate = $("gate");
    if (!cfg.PASSCODE || safeSession("unlocked") === "1") return;
    gate.classList.remove("hidden");
    if (cfg.PASSCODE_HINT) $("gate-hint").textContent = cfg.PASSCODE_HINT;
    $("gate-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = $("gate-input").value.trim().toLowerCase();
      if (v === String(cfg.PASSCODE).trim().toLowerCase()) {
        safeSession("unlocked", "1");
        gate.classList.add("hidden");
      } else {
        $("gate-err").textContent = "Not quite, try again";
        $("gate-input").select();
      }
    });
  }
  startGate();

  // ---------- Supabase ----------
  var galleryEl = $("gallery");
  var photos = [];

  function showState(text) {
    galleryEl.innerHTML = "";
    var d = document.createElement("div");
    d.className = "state";
    d.textContent = text;
    galleryEl.appendChild(d);
  }

  var configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_URL.indexOf("YOUR-") === -1 && cfg.SUPABASE_ANON_KEY.indexOf("YOUR-") === -1;

  if (!configured) {
    showState("Almost there! Add your Supabase URL and key in config.js.");
    return;
  }
  if (!window.supabase) {
    showState("Could not load the gallery library. Check your connection and refresh.");
    return;
  }

  var client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  var bucket = cfg.BUCKET || "photos";

  function publicUrl(path) {
    return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  // Stable "random" tilt from the id, used when no tilt is saved.
  function tiltFor(p) {
    if (typeof p.tilt === "number") return p.tilt;
    var s = String(p.id), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return ((Math.abs(h) % 61) - 30) / 10; // -3.0 .. +3.0 degrees
  }

  function whenLabel(p) {
    if (p.month_label) return p.month_label;
    if (p.taken_on) {
      var d = new Date(p.taken_on + "T00:00:00");
      if (!isNaN(d)) return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
    }
    return "";
  }

  var observer = "IntersectionObserver" in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("visible");
            observer.unobserve(en.target);
          }
        });
      }, { threshold: 0.12 })
    : null;

  function render() {
    galleryEl.innerHTML = "";
    if (!photos.length) {
      showState("No photos yet. Check back soon!");
      return;
    }
    photos.forEach(function (p, i) {
      var fig = document.createElement("figure");
      fig.className = "polaroid";
      fig.tabIndex = 0;
      fig.setAttribute("role", "button");
      fig.style.setProperty("--tilt", tiltFor(p) + "deg");

      var frame = document.createElement("div");
      frame.className = "frame";
      var img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.src = publicUrl(p.image_path);
      img.alt = p.caption ? "Photo: " + p.caption : "Our photo";
      frame.appendChild(img);

      var cap = document.createElement("figcaption");
      cap.appendChild(document.createTextNode(p.caption || ""));
      var w = whenLabel(p);
      if (w) {
        var span = document.createElement("span");
        span.className = "when";
        span.textContent = w;
        cap.appendChild(span);
      }

      fig.appendChild(frame);
      fig.appendChild(cap);
      fig.addEventListener("click", function () { openLightbox(i); });
      fig.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLightbox(i); }
      });
      galleryEl.appendChild(fig);

      if (observer) observer.observe(fig); else fig.classList.add("visible");
    });
  }

  function load() {
    client.from("photos")
      .select("*")
      .order("taken_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .then(function (res) {
        if (res.error) {
          console.error(res.error);
          showState("Couldn't load the photos right now. Please refresh in a moment.");
          return;
        }
        photos = res.data || [];
        render();
      });
  }
  load();

  // ---------- Lightbox ----------
  var lb = $("lightbox"), lbImg = $("lb-img"), lbCap = $("lb-cap"), lbWhen = $("lb-when");
  var cur = 0;

  function show(i) {
    if (!photos.length) return;
    cur = (i + photos.length) % photos.length;
    var p = photos[cur];
    lbImg.src = publicUrl(p.image_path);
    lbImg.alt = p.caption || "Our photo";
    lbCap.textContent = p.caption || "";
    lbWhen.textContent = whenLabel(p);
  }
  function openLightbox(i) {
    show(i);
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
    $("lb-close").focus();
  }
  function closeLightbox() {
    lb.classList.remove("open");
    document.body.style.overflow = "";
    lbImg.removeAttribute("src");
  }

  $("lb-close").addEventListener("click", closeLightbox);
  $("lb-prev").addEventListener("click", function () { show(cur - 1); });
  $("lb-next").addEventListener("click", function () { show(cur + 1); });
  lb.addEventListener("click", function (e) { if (e.target === lb) closeLightbox(); });

  document.addEventListener("keydown", function (e) {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") show(cur - 1);
    else if (e.key === "ArrowRight") show(cur + 1);
  });

  // swipe on phones
  var startX = null;
  lb.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) show(dx < 0 ? cur + 1 : cur - 1);
  }, { passive: true });
})();
