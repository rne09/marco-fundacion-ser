(() => {
  const FORMATS = {
    cuadrado:   { w: 1080, h: 1080, src: 'assets/marco.png' },
    horizontal: { w: 1920, h: 1080, src: 'assets/marco-horizontal.png' },
    vertical:   { w: 1080, h: 1920, src: 'assets/marco-vertical.png' },
  };
  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const stage = $('stage'), video = $('video');
  const frames = {};
  for (const k in FORMATS) { const i = new Image(); i.src = FORMATS[k].src; i.onload = () => draw(); frames[k] = i; }

  let fmt = 'cuadrado', W = 1080, H = 1080;
  let photo = null, scale = 1, rot = 0, ox = 0, oy = 0, stream = null;

  // Escala mínima para que la foto (girada) cubra todo el lienzo: nunca quedan franjas
  function geom() {
    const t = rot * Math.PI / 180, c = Math.abs(Math.cos(t)), si = Math.abs(Math.sin(t));
    const needW = W * c + H * si, needH = W * si + H * c; // lienzo visto en ejes de la foto
    const cover = Math.max(needW / photo.width, needH / photo.height);
    return { t, needW, needH, s: cover * scale };
  }
  function clamp() {
    if (!photo) return;
    const g = geom();
    const mx = Math.max(0, (photo.width * g.s - g.needW) / 2);
    const my = Math.max(0, (photo.height * g.s - g.needH) / 2);
    // desplazamiento en ejes de la foto
    const cs = Math.cos(-g.t), sn = Math.sin(-g.t);
    let u = ox * cs - oy * sn, v = ox * sn + oy * cs;
    u = Math.max(-mx, Math.min(mx, u)); v = Math.max(-my, Math.min(my, v));
    const c2 = Math.cos(g.t), s2 = Math.sin(g.t);
    ox = u * c2 - v * s2; oy = u * s2 + v * c2;
  }

  // ---------- render ----------
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#e8f6fd';
    ctx.fillRect(0, 0, W, H);
    if (photo) {
      clamp();
      const g = geom();
      ctx.save();
      ctx.translate(W / 2 + ox, H / 2 + oy);
      ctx.rotate(g.t);
      ctx.drawImage(photo, -photo.width * g.s / 2, -photo.height * g.s / 2, photo.width * g.s, photo.height * g.s);
      ctx.restore();
    }
    const f = frames[fmt];
    if (f.complete && f.naturalWidth) ctx.drawImage(f, 0, 0, W, H);
  }

  function setFormat(k) {
    fmt = k; W = FORMATS[k].w; H = FORMATS[k].h;
    canvas.width = W; canvas.height = H;
    stage.dataset.fmt = k;
    document.querySelectorAll('#formats button').forEach(b => b.setAttribute('aria-pressed', b.dataset.fmt === k));
    draw();
  }
  document.querySelectorAll('#formats button').forEach(b => b.addEventListener('click', () => setFormat(b.dataset.fmt)));

  // ---------- steps ----------
  function step(n) {
    [1, 2, 3].forEach(i => { $('card' + i).hidden = i !== n; });
    document.querySelectorAll('#steps li').forEach(li => {
      const i = +li.dataset.step;
      li.classList.toggle('active', i === n);
      li.classList.toggle('done', i < n);
    });
    $('tip').hidden = n !== 2;
  }

  function setPhoto(img) {
    photo = img; counted = false;
    // sugerir formato según la foto
    const r = img.width / img.height;
    setFormat(r > 1.25 ? 'horizontal' : r < 0.8 ? 'vertical' : 'cuadrado');
    reset();
    $('dropHint').hidden = true;
    stage.classList.add('has-photo');
    step(2);
  }
  function reset() {
    scale = 1; rot = 0; ox = 0; oy = 0;
    $('zoom').value = 1; $('rotate').value = 0;
    draw();
  }

  function loadFile(f) {
    if (!f || !f.type.startsWith('image/')) return toast('Elige un archivo de imagen');
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { setPhoto(img); };
    img.onerror = () => toast('No se pudo abrir esa imagen');
    img.src = url;
  }

  $('file').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });

  // click en la zona vacía abre el selector
  stage.addEventListener('click', () => { if (!photo && !stream) $('file').click(); });

  // drag & drop file
  ['dragenter', 'dragover'].forEach(t => stage.addEventListener(t, e => { e.preventDefault(); stage.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => stage.addEventListener(t, e => { e.preventDefault(); stage.classList.remove('over'); }));
  stage.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));

  // ---------- camera ----------
  $('camBtn').addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 1280 } });
      video.srcObject = stream; video.hidden = false; await video.play();
      $('dropHint').hidden = true; $('shotBtn').hidden = false;
    } catch { toast('No se pudo acceder a la cámara'); }
  });
  $('shotBtn').addEventListener('click', () => {
    const c = document.createElement('canvas');
    c.width = video.videoWidth; c.height = video.videoHeight;
    const x = c.getContext('2d');
    x.translate(c.width, 0); x.scale(-1, 1);
    x.drawImage(video, 0, 0);
    stopCam();
    const img = new Image();
    img.onload = () => setPhoto(img);
    img.src = c.toDataURL('image/jpeg', .95);
  });
  function stopCam() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; video.hidden = true; $('shotBtn').hidden = true;
  }

  // ---------- adjust ----------
  $('zoom').addEventListener('input', e => { scale = +e.target.value; draw(); });
  $('rotate').addEventListener('input', e => { rot = +e.target.value; draw(); });
  $('resetBtn').addEventListener('click', reset);
  $('changeBtn').addEventListener('click', () => $('file').click());
  $('doneBtn').addEventListener('click', () => step(3));
  $('backBtn').addEventListener('click', () => step(2));

  const pointers = new Map();
  let lastDist = 0;
  const k = () => W / stage.clientWidth;
  stage.addEventListener('pointerdown', e => {
    if (!photo) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      ox += (e.clientX - prev.x) * k(); oy += (e.clientY - prev.y) * k();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist) { scale = Math.min(4, Math.max(1, scale * d / lastDist)); $('zoom').value = scale; }
      lastDist = d;
    }
    draw();
  });
  const up = e => { pointers.delete(e.pointerId); lastDist = 0; if (!pointers.size) stage.classList.remove('dragging'); };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', e => {
    if (!photo) return;
    e.preventDefault();
    scale = Math.min(4, Math.max(1, scale * (e.deltaY < 0 ? 1.06 : 0.94)));
    $('zoom').value = scale; draw();
  }, { passive: false });

  // ---------- export ----------
  const blob = () => new Promise(r => canvas.toBlob(r, 'image/jpeg', .95));
  const fname = () => `marco-24-years-fundacion-ser-${fmt}.jpg`;
  $('downloadBtn').addEventListener('click', async () => {
    const b = await blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = fname(); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Imagen descargada ✓'); countOnce();
  });
  if (navigator.canShare && navigator.canShare({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] })) {
    $('shareImgBtn').hidden = false;
    $('shareImgBtn').addEventListener('click', async () => {
      const f = new File([await blob()], fname(), { type: 'image/jpeg' });
      countOnce(); try { await navigator.share({ files: [f], text: $('caption').value }); } catch {}
    });
  }

  // ---------- share page ----------
  const url = location.href.split('#')[0];
  $('pageUrl').value = url;
  const msg = 'Celebra los 24 años de Fundación Ser y crea tu marco con tu foto: ' + url;
  $('waBtn').href = 'https://wa.me/?text=' + encodeURIComponent(msg);
  $('copyBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); } catch { $('pageUrl').select(); document.execCommand('copy'); }
    toast('Enlace copiado ✓');
  });
  $('shareLinkBtn').addEventListener('click', async () => {
    if (navigator.share) { try { await navigator.share({ title: document.title, text: msg, url }); } catch {} }
    else $('copyBtn').click();
  });
  if (window.qrcode) {
    const q = qrcode(0, 'M'); q.addData(url); q.make();
    $('qr').innerHTML = q.createImgTag(5, 0);
  }

  $('copyCapBtn').addEventListener('click', async () => {
    const t = $('caption').value;
    try { await navigator.clipboard.writeText(t); } catch { $('caption').select(); document.execCommand('copy'); }
    toast('Descripción copiada ✓');
  });

  // ---------- contador en vivo ----------
  let shown = null, counted = false;
  function render(n) {
    if (n == null) return;
    $('counter').hidden = false;
    $('countTxt').textContent = n === 1 ? 'persona ya creó su marco' : 'personas ya crearon su marco';
    if (shown !== null && n > shown) {
      const from = shown, t0 = performance.now();
      const tick = (t) => { const p = Math.min(1, (t - t0) / 600); $('countNum').textContent = Math.round(from + (n - from) * p).toLocaleString('es-CO'); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      $('counter').classList.remove('bump'); void $('counter').offsetWidth; $('counter').classList.add('bump');
    } else $('countNum').textContent = n.toLocaleString('es-CO');
    shown = n;
  }
  async function poll() {
    try { const r = await fetch('/api/contador', { cache: 'no-store' }); if (r.ok) render((await r.json()).total); } catch {}
  }
  async function countOnce() {
    if (counted) return; counted = true;
    try { const r = await fetch('/api/contador', { method: 'POST' }); if (r.ok) render((await r.json()).total); } catch {}
  }
  poll(); setInterval(() => { if (!document.hidden) poll(); }, 8000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

  let tt;
  function toast(t) {
    const el = $('toast'); el.textContent = t; el.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2200);
  }

  draw();
})();
