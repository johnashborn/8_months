(function () {
  "use strict";

  var cfg = window.APP_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };

  var MAX_SIDE = 1200;      // longest side after compression, in px
  var JPEG_QUALITY = 0.85;

  function setMsg(el, text, kind) {
    el.textContent = text || "";
    el.className = "msg" + (kind ? " " + kind : "");
  }

  var configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_URL.indexOf("YOUR-") === -1 && cfg.SUPABASE_ANON_KEY.indexOf("YOUR-") === -1;

  if (!configured || !window.supabase) {
    setMsg($("login-msg"), configured
      ? "Could not load the Supabase library. Check your connection."
      : "Add your Supabase URL and key in config.js first (see README).", "bad");
    $("login-form").querySelector("button").disabled = true;
    return;
  }

  var client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  var bucket = cfg.BUCKET || "photos";
  var photos = [];
  var editing = null;   // the photo row being edited, or null
  var previewUrl = null;

  // ---------- Auth ----------
  function showApp(signedIn) {
    $("login-panel").classList.toggle("hidden", signedIn);
    $("app").classList.toggle("hidden", !signedIn);
    $("logout").classList.toggle("hidden", !signedIn);
    if (signedIn) loadPhotos();
  }

  client.auth.getSession().then(function (r) {
    showApp(!!(r.data && r.data.session));
  });

  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = e.target.querySelector("button");
    btn.disabled = true;
    setMsg($("login-msg"), "Logging in...");
    client.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    }).then(function (r) {
      btn.disabled = false;
      if (r.error) { setMsg($("login-msg"), r.error.message, "bad"); return; }
      setMsg($("login-msg"), "");
      $("password").value = "";
      showApp(true);
    });
  });

  $("logout").addEventListener("click", function () {
    client.auth.signOut().then(function () { showApp(false); });
  });

  // ---------- Preview ----------
  function updatePreview() {
    $("prev-cap").textContent = $("caption").value.trim() || "Your caption here";
    var m = $("month").value.trim();
    var t = $("taken").value;
    $("prev-when").textContent = m || (t ? t : "");
    var deg = $("tilt").value;
    $("tilt-val").textContent = deg;
    $("preview").style.setProperty("--tilt", deg + "deg");
  }
  ["caption", "month", "taken", "tilt"].forEach(function (id) {
    $(id).addEventListener("input", updatePreview);
  });

  $("shuffle").addEventListener("click", function () {
    var v = (Math.floor(Math.random() * 17) - 8) / 2; // -4 .. 4 in 0.5 steps
    $("tilt").value = v;
    updatePreview();
  });

  $("file").addEventListener("change", function () {
    var f = this.files && this.files[0];
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    if (f) {
      previewUrl = URL.createObjectURL(f);
      $("prev-img").src = previewUrl;
    }
  });

  // ---------- Image compression ----------
  function compress(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var canvas = document.createElement("canvas");
        canvas.width = cw; canvas.height = ch;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob); else reject(new Error("Could not compress the image."));
        }, "image/jpeg", JPEG_QUALITY);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("That file could not be read as an image. (HEIC photos may need converting to JPG first.)"));
      };
      img.src = url;
    });
  }

  function newPath() {
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    return id + ".jpg";
  }

  function publicUrl(path) {
    return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  function uploadBlob(blob) {
    var path = newPath();
    return client.storage.from(bucket)
      .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false })
      .then(function (r) {
        if (r.error) throw r.error;
        return path;
      });
  }

  function removeFile(path) {
    if (!path) return Promise.resolve();
    return client.storage.from(bucket).remove([path]);
  }

  // ---------- Form: add / edit ----------
  function resetForm() {
    editing = null;
    $("photo-form").reset();
    $("tilt").value = 0;
    $("form-title").textContent = "Add a photo";
    $("save").textContent = "Add photo";
    $("cancel-edit").classList.add("hidden");
    $("file-note").textContent = "";
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    $("prev-img").src = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Crect width='10' height='10' fill='%23eee'/%3E%3C/svg%3E";
    updatePreview();
  }

  function startEdit(p) {
    editing = p;
    $("form-title").textContent = "Edit photo";
    $("save").textContent = "Save changes";
    $("cancel-edit").classList.remove("hidden");
    $("file-note").textContent = "(leave empty to keep the current photo)";
    $("file").value = "";
    $("caption").value = p.caption || "";
    $("month").value = p.month_label || "";
    $("taken").value = p.taken_on || "";
    $("tilt").value = typeof p.tilt === "number" ? p.tilt : 0;
    $("prev-img").src = publicUrl(p.image_path);
    updatePreview();
    setMsg($("form-msg"), "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $("cancel-edit").addEventListener("click", function () { resetForm(); setMsg($("form-msg"), ""); });

  $("photo-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var file = $("file").files && $("file").files[0];
    if (!editing && !file) { setMsg($("form-msg"), "Please choose a photo first.", "bad"); return; }

    var saveBtn = $("save");
    saveBtn.disabled = true;
    setMsg($("form-msg"), file ? "Compressing and uploading..." : "Saving...");

    var fields = {
      caption: $("caption").value.trim(),
      month_label: $("month").value.trim() || null,
      taken_on: $("taken").value || null,
      tilt: parseFloat($("tilt").value) || 0
    };

    var oldPath = editing ? editing.image_path : null;
    var newUploaded = null;
    var committed = false;   // true once the database row points at the new image

    var step = file
      ? compress(file).then(uploadBlob).then(function (path) { newUploaded = path; return path; })
      : Promise.resolve(oldPath);

    step.then(function (path) {
      fields.image_path = path;
      return editing
        ? client.from("photos").update(fields).eq("id", editing.id)
        : client.from("photos").insert(fields);
    }).then(function (r) {
      if (r.error) throw r.error;
      committed = true;
      // remove the replaced image only after the row points at the new one
      if (editing && newUploaded && oldPath) return removeFile(oldPath);
    }).then(function () {
      setMsg($("form-msg"), editing ? "Saved!" : "Added! She'll see it right away.", "ok");
      resetForm();
      loadPhotos();
    }).catch(function (err) {
      // don't leave an orphaned upload behind if the row failed
      if (newUploaded && !committed) removeFile(newUploaded);
      setMsg($("form-msg"), (err && err.message) || "Something went wrong.", "bad");
    }).then(function () {
      saveBtn.disabled = false;
    });
  });

  // ---------- List ----------
  function loadPhotos() {
    client.from("photos")
      .select("*")
      .order("taken_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .then(function (r) {
        if (r.error) { setMsg($("list-msg"), r.error.message, "bad"); return; }
        setMsg($("list-msg"), "");
        photos = r.data || [];
        renderList();
      });
  }

  function renderList() {
    var box = $("items");
    box.innerHTML = "";
    $("count").textContent = photos.length;
    if (!photos.length) {
      setMsg($("list-msg"), "Nothing here yet. Add your first photo above.");
      return;
    }
    photos.forEach(function (p) {
      var item = document.createElement("div");
      item.className = "item";

      var img = document.createElement("img");
      img.loading = "lazy";
      img.src = publicUrl(p.image_path);
      img.alt = p.caption || "photo";

      var meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = [p.month_label, p.taken_on].filter(Boolean).join(" · ") || "no date";

      var cap = document.createElement("div");
      cap.className = "cap-text";
      cap.textContent = p.caption || "(no caption)";

      var actions = document.createElement("div");
      actions.className = "actions";

      var edit = document.createElement("button");
      edit.className = "btn ghost small";
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", function () { startEdit(p); });

      var del = document.createElement("button");
      del.className = "btn danger small";
      del.type = "button";
      del.textContent = "Delete";
      del.addEventListener("click", function () {
        if (!confirm("Delete this photo for good?")) return;
        del.disabled = true;
        client.from("photos").delete().eq("id", p.id).then(function (r) {
          if (r.error) { del.disabled = false; setMsg($("list-msg"), r.error.message, "bad"); return; }
          removeFile(p.image_path).then(function () {
            if (editing && editing.id === p.id) resetForm();
            loadPhotos();
          });
        });
      });

      actions.appendChild(edit);
      actions.appendChild(del);
      item.appendChild(img);
      item.appendChild(meta);
      item.appendChild(cap);
      item.appendChild(actions);
      box.appendChild(item);
    });
  }

  updatePreview();
})();
