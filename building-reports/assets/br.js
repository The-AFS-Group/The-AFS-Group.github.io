/* AFS Building Reports: shared helpers, photo capture and mark-up, lightbox, voice typing. */
(function () {
  'use strict';
  var BR = window.BR = {};

  BR.STATUSES = ['New', 'Acknowledged', 'Quoting', 'Awaiting approval', 'Scheduled', 'In progress', 'On hold', 'Completed', 'Cancelled'];
  BR.CLOSED = ['Completed', 'Cancelled'];
  BR.RESPONSIBILITY = ['TBC', 'AFS', 'Landlord', 'Shared', 'Insurance', 'Warranty'];
  BR.RESP_LABEL = { TBC: 'Not decided yet', AFS: 'AFS pays', Landlord: 'Landlord pays', Shared: 'Split with landlord', Insurance: 'Insurance claim', Warranty: 'Under warranty' };
  BR.LANDLORD_PAYS = ['Landlord', 'Shared'];
  var STATUS_TONE = { New: 's-new', Acknowledged: 's-active', Quoting: 's-active', 'Awaiting approval': 's-wait', Scheduled: 's-active', 'In progress': 's-active', 'On hold': 's-wait', Completed: 's-done', Cancelled: 's-off' };

  BR.$ = function (id) { return document.getElementById(id); };
  BR.isOpen = function (j) { return BR.CLOSED.indexOf(j.status) < 0; };
  BR.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  BR.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  };
  BR.load = function (k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } };
  BR.save = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  BR.drop = function (k) { try { localStorage.removeItem(k); } catch (e) {} };
  BR.session = function (k, v) {
    try {
      if (v === undefined) return sessionStorage.getItem(k);
      if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v);
    } catch (e) { return null; }
  };

  function parse(iso) {
    if (!iso) return null;
    var d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T00:00:00') : new Date(String(iso).length <= 19 ? String(iso).replace(' ', 'T') : iso);
    return isNaN(d) ? null : d;
  }
  BR.parse = parse;
  BR.fmtDate = function (iso) {
    var d = parse(iso);
    if (!d) return iso || '';
    var sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' }) + ', ' +
      d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  };
  BR.fmtDay = function (iso) {
    var d = parse(iso);
    if (!d) return iso || '';
    var sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' });
  };
  BR.ago = function (iso) {
    var d = parse(iso);
    if (!d) return '';
    var m = Math.max(0, (Date.now() - d.getTime()) / 60000);
    if (m < 60) return Math.round(m) + 'm ago';
    if (m < 1440) return Math.round(m / 60) + 'h ago';
    var days = Math.round(m / 1440);
    return days < 60 ? days + 'd ago' : Math.round(days / 30) + 'mo ago';
  };
  BR.todayISO = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  BR.money = function (n, blank) {
    if (n == null || n === '' || isNaN(Number(n))) return blank == null ? '' : blank;
    return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  BR.moneyShort = function (n) {
    n = Number(n) || 0;
    if (n >= 100000) return '$' + Math.round(n / 1000).toLocaleString('en-AU') + 'k';
    return '$' + Math.round(n).toLocaleString('en-AU');
  };

  BR.statusBadge = function (s) { return '<span class="badge ' + (STATUS_TONE[s] || 's-active') + '">' + BR.esc(s) + '</span>'; };
  BR.priorityBadge = function (p) {
    var cls = { Urgent: 'p-urgent', High: 'p-high', Low: 'p-low' }[p] || '';
    return p ? '<span class="badge plain ' + cls + '">' + BR.esc(p) + '</span>' : '';
  };
  BR.plainBadge = function (t) { return t ? '<span class="badge plain">' + BR.esc(t) + '</span>' : ''; };

  BR.toast = function (msg) {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(BR.toast.t);
    BR.toast.t = setTimeout(function () { t.style.display = 'none'; }, 2800);
  };

  BR.copyText = function (text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  };

  /** GET and POST to the Apps Script web app. Demo mode swaps in a local stand-in. */
  BR.api = function (cfg, demo) {
    return {
      get: function (params) {
        if (demo) return demo.get(params);
        if (!cfg.ENDPOINT) return Promise.reject(new Error('no_endpoint'));
        var q = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
        return fetch(cfg.ENDPOINT + '?' + q).then(function (r) { return r.json(); });
      },
      post: function (body) {
        if (demo) return demo.post(body);
        if (!cfg.ENDPOINT) return Promise.reject(new Error('no_endpoint'));
        return fetch(cfg.ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
          .then(function (r) { return r.json(); });
      }
    };
  };

  /* ---------- small key-value store on IndexedDB (photos are too big for localStorage) ---------- */
  BR.kv = (function () {
    var mem = {}, dbp = null, ok = true;
    function db() {
      if (!dbp) dbp = new Promise(function (resolve, reject) {
        try {
          var r = indexedDB.open('afs-building-reports', 1);
          r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
          r.onsuccess = function () { resolve(r.result); };
          r.onerror = function () { reject(r.error); };
        } catch (e) { reject(e); }
      }).catch(function (e) { ok = false; throw e; });
      return dbp;
    }
    function tx(mode, fn) {
      return db().then(function (d) {
        return new Promise(function (resolve, reject) {
          var t = d.transaction('kv', mode), req = fn(t.objectStore('kv'));
          t.oncomplete = function () { resolve(req && req.result); };
          t.onerror = t.onabort = function () { reject(t.error); };
        });
      });
    }
    return {
      persistent: function () { return db().then(function () { return true; }, function () { return false; }); },
      get: function (k) { return tx('readonly', function (s) { return s.get(k); }).catch(function () { return mem[k]; }); },
      set: function (k, v) { mem[k] = v; return tx('readwrite', function (s) { return s.put(v, k); }).catch(function () {}); },
      del: function (k) { delete mem[k]; return tx('readwrite', function (s) { return s.delete(k); }).catch(function () {}); },
      ok: function () { return ok; }
    };
  })();

  /* ---------- photos ---------- */
  var MAX_EDGE = 1600, THUMB_EDGE = 240, THUMB_MAX_CHARS = 40000;

  function scaled(src, w, h, edge) {
    var s = Math.min(1, edge / Math.max(w, h));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    var x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  BR.thumbOf = function (canvas) {
    var c = scaled(canvas, canvas.width, canvas.height, THUMB_EDGE), q = [0.72, 0.6, 0.48, 0.36], out = '';
    for (var i = 0; i < q.length; i++) { out = c.toDataURL('image/jpeg', q[i]); if (out.length < THUMB_MAX_CHARS) break; }
    return out;
  };
  /** Reads a picked file into a resized JPEG (longest edge 1600px) plus a small preview. */
  BR.readPhoto = function (file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        try {
          var c = scaled(img, img.naturalWidth, img.naturalHeight, MAX_EDGE);
          var orig = c.toDataURL('image/jpeg', 0.82), thumb = BR.thumbOf(c);
          URL.revokeObjectURL(url);
          resolve({ id: BR.uuid(), orig: orig, data: orig, thumb: thumb, origThumb: thumb, shapes: [], caption: '', annotated: false, w: c.width, h: c.height });
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      img.src = url;
    });
  };
  BR.b64 = function (dataUrl) { return String(dataUrl || '').replace(/^data:[^,]*,/, ''); };
  BR.dataUrl = function (b64, mime) { return b64 ? (/^data:/.test(b64) ? b64 : 'data:' + (mime || 'image/jpeg') + ';base64,' + b64) : ''; };

  var ICON = {
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19L19 5M10 5h9v9"/></svg>',
    circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="7"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 6V4h14v2M12 4v16M9 20h6"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16z"/></svg>',
    bin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/></svg>'
  };
  BR.ICON = ICON;

  /* ---------- mark-up editor ---------- */
  var INKS = [
    { c: '#F26422', name: 'Orange' },
    { c: '#E5262A', name: 'Red' },
    { c: '#FFD60A', name: 'Yellow' },
    { c: '#FFFFFF', name: 'White' }
  ];
  function inkOn(c) { return c === '#FFFFFF' || c === '#FFD60A' ? '#0E2A44' : '#FFFFFF'; }

  function drawShape(ctx, s, lw) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    function both(path) {
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = lw * 1.7; path(); ctx.stroke();
      ctx.strokeStyle = s.c; ctx.lineWidth = lw; path(); ctx.stroke();
    }
    if (s.t === 'pen') {
      both(function () {
        ctx.beginPath(); ctx.moveTo(s.pts[0].x, s.pts[0].y);
        if (s.pts.length === 1) ctx.lineTo(s.pts[0].x + 0.1, s.pts[0].y + 0.1);
        for (var i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y);
      });
    } else if (s.t === 'arrow') {
      var a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1), hl = lw * 4.5;
      both(function () {
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2);
        ctx.moveTo(s.x2, s.y2); ctx.lineTo(s.x2 - hl * Math.cos(a - 0.5), s.y2 - hl * Math.sin(a - 0.5));
        ctx.moveTo(s.x2, s.y2); ctx.lineTo(s.x2 - hl * Math.cos(a + 0.5), s.y2 - hl * Math.sin(a + 0.5));
      });
    } else if (s.t === 'circle') {
      both(function () {
        ctx.beginPath();
        ctx.ellipse((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, Math.max(1, Math.abs(s.x2 - s.x1) / 2), Math.max(1, Math.abs(s.y2 - s.y1) / 2), 0, 0, Math.PI * 2);
      });
    } else if (s.t === 'text') {
      var fs = Math.round(lw * 5.2), pad = fs * 0.35;
      ctx.font = '700 ' + fs + 'px Archivo, Tahoma, sans-serif';
      ctx.textBaseline = 'middle';
      var w = ctx.measureText(s.text).width + pad * 2, h = fs * 1.45;
      var x = Math.min(Math.max(0, s.x), ctx.canvas.width - w), y = Math.min(Math.max(0, s.y - h / 2), ctx.canvas.height - h);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      roundRect(ctx, x + lw * 0.4, y + lw * 0.4, w, h, fs * 0.25); ctx.fill();
      ctx.fillStyle = s.c; roundRect(ctx, x, y, w, h, fs * 0.25); ctx.fill();
      ctx.fillStyle = inkOn(s.c); ctx.fillText(s.text, x + pad, y + h / 2 + fs * 0.04);
    }
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /** Opens the mark-up editor. Resolves with the updated photo, or null if cancelled. */
  BR.annotate = function (photo) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { open(img); };
      img.onerror = function () { BR.toast('Couldn’t open that photo'); resolve(null); };
      img.src = photo.orig || photo.data;

      function open(img) {
        var W = img.naturalWidth, H = img.naturalHeight, L = Math.max(W, H);
        var lw = Math.max(4, Math.round(L * 0.008));
        var shapes = (photo.shapes || []).slice(), tool = 'pen', color = INKS[0].c, cur = null, raf = 0, pendingText = null;
        var lastFocus = document.activeElement;
        var el = document.createElement('div');
        el.className = 'ann'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Mark up photo');
        el.innerHTML =
          '<div class="ann-top"><button type="button" class="ann-cancel">Cancel</button><b>Mark up photo</b><button type="button" class="ann-done">Done</button></div>' +
          '<div class="ann-stage"><canvas></canvas></div>' +
          '<div class="ann-tools">' +
            '<div class="ann-group" role="group" aria-label="Tool">' +
              tb('pen', 'Draw') + tb('arrow', 'Arrow') + tb('circle', 'Circle') + tb('text', 'Label') +
            '</div>' +
            '<div class="ann-group" role="group" aria-label="Colour">' +
              INKS.map(function (k) { return '<button type="button" class="ann-swatch" data-c="' + k.c + '" style="background:' + k.c + '" aria-label="' + k.name + '"></button>'; }).join('') +
            '</div>' +
            '<div class="ann-group">' +
              '<button type="button" class="ann-tool ann-undo">' + ICON.undo + 'Undo</button>' +
              '<button type="button" class="ann-tool ann-clear">' + ICON.clear + 'Clear</button>' +
            '</div>' +
            '<div class="ann-hint" aria-live="polite"></div>' +
          '</div>' +
          '<form class="ann-text" hidden><input type="text" maxlength="40" placeholder="Label, e.g. Crack here" aria-label="Label text" autocomplete="off"><button type="submit" class="btn small">Add</button><button type="button" class="btn ghost small ann-text-x">Cancel</button></form>';
        function tb(t, label) { return '<button type="button" class="ann-tool" data-tool="' + t + '" aria-pressed="false">' + ICON[t] + label + '</button>'; }
        document.body.appendChild(el);
        document.body.classList.add('noscroll');
        var cv = el.querySelector('canvas'), ctx = cv.getContext('2d'), stage = el.querySelector('.ann-stage');
        var hint = el.querySelector('.ann-hint'), textForm = el.querySelector('.ann-text'), textIn = textForm.querySelector('input');
        cv.width = W; cv.height = H;

        var HINTS = { pen: 'Draw with your finger to circle or underline.', arrow: 'Drag to point an arrow at the problem.', circle: 'Drag to draw a circle around it.', text: 'Tap where the label should go.' };
        function sync() {
          el.querySelectorAll('[data-tool]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.tool === tool ? 'true' : 'false'); });
          el.querySelectorAll('.ann-swatch').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.c === color ? 'true' : 'false'); });
          el.querySelector('.ann-undo').disabled = !shapes.length;
          el.querySelector('.ann-clear').disabled = !shapes.length;
          hint.textContent = HINTS[tool];
        }
        function fit() {
          var r = stage.getBoundingClientRect(), s = Math.min((r.width - 20) / W, (r.height - 20) / H);
          cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(H * s) + 'px';
        }
        function draw() {
          raf = 0;
          ctx.drawImage(img, 0, 0, W, H);
          shapes.forEach(function (s) { drawShape(ctx, s, lw); });
          if (cur) drawShape(ctx, cur, lw);
        }
        function later() { if (!raf) raf = requestAnimationFrame(draw); }
        function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }

        cv.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          var p = pt(e);
          if (tool === 'text') { pendingText = p; textForm.hidden = false; textIn.value = ''; textIn.focus(); return; }
          try { cv.setPointerCapture(e.pointerId); } catch (x) {}
          cur = { t: tool, c: color, pts: [p], x1: p.x, y1: p.y, x2: p.x, y2: p.y };
          later();
        });
        cv.addEventListener('pointermove', function (e) {
          if (!cur) return;
          var p = pt(e);
          if (cur.t === 'pen') cur.pts.push(p); else { cur.x2 = p.x; cur.y2 = p.y; }
          later();
        });
        function end() {
          if (!cur) return;
          var tiny = Math.hypot(cur.x2 - cur.x1, cur.y2 - cur.y1) < L * 0.015;
          if (cur.t === 'pen') delete cur.x1;
          if (cur.t === 'pen' || !tiny) shapes.push(cur);
          cur = null; draw(); sync();
        }
        cv.addEventListener('pointerup', end);
        cv.addEventListener('pointercancel', end);
        cv.addEventListener('lostpointercapture', end);

        textForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var t = textIn.value.trim();
          if (t && pendingText) shapes.push({ t: 'text', c: color, x: pendingText.x, y: pendingText.y, text: t });
          textForm.hidden = true; pendingText = null; draw(); sync();
        });
        textForm.querySelector('.ann-text-x').addEventListener('click', function () { textForm.hidden = true; pendingText = null; });

        el.querySelectorAll('[data-tool]').forEach(function (b) { b.addEventListener('click', function () { tool = b.dataset.tool; textForm.hidden = true; sync(); }); });
        el.querySelectorAll('.ann-swatch').forEach(function (b) { b.addEventListener('click', function () { color = b.dataset.c; sync(); }); });
        el.querySelector('.ann-undo').addEventListener('click', function () { shapes.pop(); draw(); sync(); });
        el.querySelector('.ann-clear').addEventListener('click', function () { shapes = []; draw(); sync(); });

        function close(result) {
          window.removeEventListener('resize', fit);
          document.removeEventListener('keydown', onKey);
          el.remove();
          document.body.classList.remove('noscroll');
          if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (x) {}
          resolve(result);
        }
        function onKey(e) { if (e.key === 'Escape') { if (!textForm.hidden) { textForm.hidden = true; pendingText = null; } else close(null); } }
        el.querySelector('.ann-cancel').addEventListener('click', function () { close(null); });
        el.querySelector('.ann-done').addEventListener('click', function () {
          var out = Object.assign({}, photo, { shapes: shapes });
          if (!photo.orig) out.orig = photo.data;
          if (shapes.length) {
            draw();
            out.data = cv.toDataURL('image/jpeg', 0.85);
            out.thumb = BR.thumbOf(cv);
            out.annotated = true;
          } else {
            out.data = out.orig; out.thumb = photo.origThumb || photo.thumb; out.annotated = false;
          }
          close(out);
        });
        window.addEventListener('resize', fit);
        document.addEventListener('keydown', onKey);
        fit(); draw(); sync();
        el.querySelector('[data-tool="pen"]').focus();
      }
    });
  };

  /* ---------- photo tray: take or choose, mark up, caption, remove ---------- */
  BR.Tray = function (el, opts) {
    opts = opts || {};
    var max = opts.max || 8, items = [], busy = 0;
    el.classList.add('tray');
    el.innerHTML =
      '<div class="tray-grid"></div>' +
      '<div class="tray-btns">' +
        '<button type="button" class="btn ghost tray-cam">' + ICON.cam + 'Take a photo</button>' +
        '<button type="button" class="btn ghost tray-lib">' + ICON.img + 'Choose photos</button>' +
      '</div>' +
      '<p class="tray-note" role="status"></p>' +
      '<input type="file" accept="image/*" capture="environment" class="in-cam" hidden>' +
      '<input type="file" accept="image/*" multiple class="in-lib" hidden>';
    var grid = el.querySelector('.tray-grid'), noteEl = el.querySelector('.tray-note');
    var inCam = el.querySelector('.in-cam'), inLib = el.querySelector('.in-lib');
    el.querySelector('.tray-cam').addEventListener('click', function () { inCam.click(); });
    el.querySelector('.tray-lib').addEventListener('click', function () { inLib.click(); });
    [inCam, inLib].forEach(function (inp) {
      inp.addEventListener('change', function () { add(inp.files); inp.value = ''; });
    });

    function note(msg, bad) { noteEl.textContent = msg || ''; noteEl.classList.toggle('bad', !!bad); }
    function changed() { if (opts.onChange) opts.onChange(items); syncButtons(); }
    function syncButtons() {
      var full = items.length >= max;
      el.querySelector('.tray-btns').hidden = full;
      if (full && !busy) note('That’s the most photos for one report (' + max + ').');
    }

    function add(files) {
      files = Array.prototype.slice.call(files || []);
      if (!files.length) return;
      var room = max - items.length;
      if (room <= 0) { note('That’s the most photos for one report (' + max + ').', true); return; }
      var skipped = files.length - room;
      files = files.slice(0, room);
      busy++;
      note('Adding ' + (files.length === 1 ? 'photo' : files.length + ' photos') + '…');
      var failed = 0;
      files.reduce(function (p, f) {
        return p.then(function () {
          return BR.readPhoto(f).then(function (ph) { items.push(ph); render(); changed(); }, function () { failed++; });
        });
      }, Promise.resolve()).then(function () {
        busy--;
        var msg = [];
        if (failed) msg.push(failed === 1 ? 'One photo couldn’t be read. Try a JPEG or PNG, or take it with the camera.' : failed + ' photos couldn’t be read. Try JPEG or PNG.');
        if (skipped > 0) msg.push('Only the first ' + room + ' were added: the limit is ' + max + '.');
        note(msg.join(' '), !!msg.length);
        if (!msg.length) note(items.length && opts.tip ? opts.tip : '');
        syncButtons();
      });
    }

    function render() {
      grid.innerHTML = items.map(function (p, i) {
        return '<figure class="ph" data-id="' + p.id + '">' +
          '<button type="button" class="ph-img" aria-label="Mark up photo ' + (i + 1) + '"><img alt="" src="' + p.data + '">' + (p.annotated ? '<span class="ph-flag">Marked up</span>' : '') + '</button>' +
          '<div class="ph-bar"><button type="button" class="ph-mark">' + ICON.mark + 'Mark up</button><button type="button" class="ph-del" aria-label="Remove photo ' + (i + 1) + '">' + ICON.bin + '</button></div>' +
          '<input type="text" class="ph-cap" maxlength="200" placeholder="What does it show?" aria-label="Caption for photo ' + (i + 1) + '" value="' + BR.esc(p.caption) + '">' +
          '</figure>';
      }).join('');
    }
    function find(node) {
      var fig = node.closest('.ph');
      if (!fig) return -1;
      for (var i = 0; i < items.length; i++) if (items[i].id === fig.dataset.id) return i;
      return -1;
    }
    grid.addEventListener('click', function (e) {
      var i = find(e.target);
      if (i < 0) return;
      if (e.target.closest('.ph-del')) {
        items.splice(i, 1); render(); changed(); note('');
        return;
      }
      if (e.target.closest('.ph-img') || e.target.closest('.ph-mark')) {
        var id = items[i].id;
        BR.annotate(items[i]).then(function (res) {
          if (!res) return;
          for (var k = 0; k < items.length; k++) if (items[k].id === id) items[k] = res;
          render(); changed();
        });
      }
    });
    grid.addEventListener('input', function (e) {
      if (!e.target.classList.contains('ph-cap')) return;
      var i = find(e.target);
      if (i >= 0) { items[i].caption = e.target.value; if (opts.onChange) opts.onChange(items); }
    });

    return {
      items: function () { return items.slice(); },
      busy: function () { return busy > 0; },
      set: function (list) { items = (list || []).slice(0, max); render(); syncButtons(); },
      clear: function () { items = []; render(); note(''); syncButtons(); },
      note: note
    };
  };

  /* ---------- lightbox ---------- */
  /** items: [{ id, thumb, caption, label }]. load(item) resolves { src, url } for the full-size photo. */
  BR.lightbox = function (items, start, load) {
    var i = start || 0, cache = {}, lastFocus = document.activeElement;
    var el = document.createElement('div');
    el.className = 'lb'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Photo');
    el.innerHTML = '<div class="lb-top"><span class="lb-n"></span><div class="lb-actions"><a class="lb-open" target="_blank" rel="noopener" hidden>Open in Drive</a><button type="button" class="lb-x">Close</button></div></div>' +
      '<div class="lb-stage"><img alt=""><span class="spinner" hidden></span>' +
      (items.length > 1 ? '<button type="button" class="lb-nav prev" aria-label="Previous photo">&#8249;</button><button type="button" class="lb-nav next" aria-label="Next photo">&#8250;</button>' : '') +
      '</div><div class="lb-cap"></div>';
    document.body.appendChild(el);
    document.body.classList.add('noscroll');
    var imgEl = el.querySelector('img'), spin = el.querySelector('.spinner'), open = el.querySelector('.lb-open');
    function show() {
      var it = items[i], want = i;
      el.querySelector('.lb-n').textContent = (i + 1) + ' of ' + items.length;
      el.querySelector('.lb-cap').innerHTML = BR.esc(it.caption || '') + (it.label ? '<small>' + BR.esc(it.label) + '</small>' : '');
      imgEl.alt = it.caption || 'Photo ' + (i + 1);
      var c = cache[it.id];
      imgEl.src = c ? c.src : (it.thumb || '');
      open.hidden = !(c && c.url);
      if (c && c.url) open.href = c.url;
      if (c || !load) { spin.hidden = true; return; }
      spin.hidden = false;
      load(it).then(function (res) {
        cache[it.id] = res;
        if (want !== i) return;
        spin.hidden = true;
        if (res && res.src) imgEl.src = res.src;
        if (res && res.url) { open.href = res.url; open.hidden = false; }
      }, function () { if (want === i) { spin.hidden = true; BR.toast('Couldn’t load the full-size photo'); } });
    }
    function go(d) { i = (i + d + items.length) % items.length; show(); }
    function close() { document.removeEventListener('keydown', onKey); el.remove(); document.body.classList.remove('noscroll'); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }
    function onKey(e) { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft' && items.length > 1) go(-1); else if (e.key === 'ArrowRight' && items.length > 1) go(1); }
    el.querySelector('.lb-x').addEventListener('click', close);
    el.addEventListener('click', function (e) {
      if (e.target.closest('.prev')) go(-1); else if (e.target.closest('.next')) go(1);
      else if (e.target === el.querySelector('.lb-stage')) close();
    });
    document.addEventListener('keydown', onKey);
    show();
    el.querySelector('.lb-x').focus();
  };

  /* ---------- voice typing (Web Speech API), one box at a time ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  // Android Chrome repeats words in continuous mode, so there we listen one phrase at a time and restart.
  var CONTINUOUS = !/Android/i.test(navigator.userAgent);
  var MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8"/></svg>';
  var active = null;

  function startsSentence(text) { var t = text.replace(/\s+$/, ''); return !t || /[.!?]$/.test(t); }
  function joinText(base, add) {
    add = String(add || '').replace(/^\s+/, '');
    if (!add) return base;
    if (startsSentence(base)) add = add.charAt(0).toUpperCase() + add.slice(1);
    if (!base || /\s$/.test(base)) return base + add;
    return base + ' ' + add;
  }

  /** Wires a Speak button to a textarea. opts.note: element for messages; opts.onText(voiceUsed) after changes. */
  BR.mic = function (btn, ta, opts) {
    opts = opts || {};
    var wrap = opts.wrap || ta.parentNode;
    function set(on) {
      btn.classList.toggle('on', on);
      wrap.classList.toggle('listening', on);
      btn.innerHTML = on ? '<span class="dot"></span>Listening… tap to stop' : MIC_SVG + 'Speak';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Stop voice typing' : 'Speak instead of typing');
    }
    function note(msg) { if (opts.note) opts.note.textContent = msg || ''; }
    set(false);
    btn.addEventListener('click', function () {
      if (active && active.ta === ta) { stop(); return; }
      start();
    });
    ta.addEventListener('input', function () { if (active && active.ta === ta) stop(true); });

    function start() {
      if (!SR) { note('Voice typing isn’t available in this browser. Tap the box and use the microphone key on your keyboard, or open this page in Chrome, Edge or Safari.'); return; }
      if (active) active.stop();
      note('');
      var d = { ta: ta, committed: ta.value, segment: '', keepGoing: true, idleEnds: 0, rec: null, stop: stop };
      active = d; set(true); listen(d);
    }
    function listen(d) {
      var rec = new SR();
      rec.lang = 'en-AU'; rec.interimResults = true; rec.continuous = CONTINUOUS;
      d.rec = rec; d.segment = '';
      rec.onresult = function (e) {
        var fin = '', interim = '';
        for (var i = 0; i < e.results.length; i++) { if (e.results[i].isFinal) fin += e.results[i][0].transcript; else interim += e.results[i][0].transcript; }
        d.segment = fin; d.idleEnds = 0;
        if (active === d) { ta.value = joinText(d.committed, fin + interim); if (opts.onGrow) opts.onGrow(); }
      };
      rec.onerror = function (e) {
        var msg = {
          'not-allowed': 'Microphone access is blocked. Allow the microphone for this site in your browser settings, or type instead.',
          'service-not-allowed': 'Voice typing is turned off in this browser. Type instead, or use the microphone key on your keyboard.',
          'audio-capture': 'No microphone found. Type instead.',
          'network': 'Voice typing needs an internet connection. Type instead for now.'
        }[e.error];
        if (msg) { d.keepGoing = false; note(msg); }
      };
      rec.onend = function () {
        if (d.segment.trim()) { d.committed = joinText(d.committed, d.segment); if (opts.onText) opts.onText(true); } else d.idleEnds++;
        d.segment = '';
        if (!d.typed) { ta.value = d.committed; if (opts.onGrow) opts.onGrow(); }
        if (opts.onText) opts.onText(false);
        // Browsers end recognition after a pause; keep listening until the person taps stop.
        if (active === d && d.keepGoing && d.idleEnds < 4) { try { listen(d); return; } catch (x) {} }
        if (active === d) { active = null; set(false); }
      };
      try { rec.start(); }
      catch (x) { d.keepGoing = false; active = null; set(false); note('Couldn’t start voice typing. Try again, or type instead.'); }
    }
    function stop(typed) {
      var d = active;
      if (!d || d.ta !== ta) return;
      active = null; d.keepGoing = false;
      if (typed) { d.typed = true; if (opts.onText && ta.value !== d.committed) opts.onText(true); }
      set(false);
      try { d.rec.stop(); } catch (x) {}
    }
    return { stop: stop };
  };
  BR.stopMic = function () { if (active) active.stop(); };

  BR.autoGrow = function (ta, min) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(Math.max(ta.scrollHeight + 4, min || 104), 520) + 'px';
  };
})();
