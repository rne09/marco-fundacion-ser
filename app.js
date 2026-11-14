(() => {
  const S = 1080;
  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const stage = $('stage'), video = $('video');
  const frame = new Image();
  frame.src = 'assets/marco.png';

  let photo = null, scale = 1, rot = 0, ox = 0, oy = 0, base = 1, stream = null;

  // ---------- render ----------
  function draw() {
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#e8f6fd';
    ctx.fillRect(0, 0, S, S);
    if (photo) {
      ctx.save();
      ctx.translate(S / 2 + ox, S / 2 + oy);
      ctx.rotate(rot * Math.PI / 180);
      const s = base * scale;
      ctx.drawImage(photo, -photo.width * s / 2, -photo.height * s / 2, photo.width * s, photo.height * s);
      ctx.restore();
    }
    if (frame.complete) ctx.drawImage(frame, 0, 0, S, S);
  }
  frame.onload = draw;

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
    photo = img;
    base = Math.max(S / img.width, S / img.height);
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
  const k = () => S / stage.clientWidth;
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
  const fname = 'marco-24-anos-fundacion-ser.jpg';
  $('downloadBtn').addEventListener('click', async () => {
    const b = await blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = fname; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Imagen descargada ✓');
  });
  if (navigator.canShare && navigator.canShare({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] })) {
    $('shareImgBtn').hidden = false;
    $('shareImgBtn').addEventListener('click', async () => {
      const f = new File([await blob()], fname, { type: 'image/jpeg' });
      try { await navigator.share({ files: [f], text: '¡Celebro los 24 años de Fundación Ser! ' + location.href }); } catch {}
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

  let tt;
  function toast(t) {
    const el = $('toast'); el.textContent = t; el.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2200);
  }

  draw();
})();
