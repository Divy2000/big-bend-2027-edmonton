/* Big Bend 2027 — the sky. A fixed canvas behind the whole page.
   Pre-renders one large sky (Milky Way + ~2000 stars) to an offscreen canvas,
   then each frame draws it once, rotated by scroll position and drifting with
   time, plus a thin live layer of twinkling stars and the odd meteor. */
(() => {
  'use strict';
  const cv = document.getElementById('skycanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d', { alpha: false });
  if (!ctx) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, DPR = 1, D = 0, sky = null, twinklers = [], seed = 20271224, raf = 0, hidden = false;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Build the sky once ---------- */
  function build() {
    seed = 20271224;
    DPR = Math.min(devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
    const diag = Math.hypot(W, H);
    D = Math.ceil(diag * 1.35);                 // square big enough to rotate + drift without showing edges
    const off = document.createElement('canvas');
    const scale = D > 2400 ? 2400 / D : 1;     // cap memory on big desktops
    off.width = off.height = Math.floor(D * scale);
    const o = off.getContext('2d');
    o.scale(scale, scale);

    // 1. Deep sky gradient: black at zenith, faint navy toward one edge (horizon glow)
    const g = o.createLinearGradient(0, 0, D * 0.3, D);
    g.addColorStop(0, '#04060b'); g.addColorStop(0.55, '#070b16'); g.addColorStop(1, '#0c1526');
    o.fillStyle = g; o.fillRect(0, 0, D, D);

    // 2. Milky Way: a diagonal band built from soft blobs, then dust lanes cut through it
    const cx = D / 2, cy = D / 2, ang = -0.62;   // band angle
    const along = (t, w) => ({ x: cx + Math.cos(ang) * t + Math.cos(ang + Math.PI / 2) * w, y: cy + Math.sin(ang) * t + Math.sin(ang + Math.PI / 2) * w });
    o.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 260; i++) {
      const t = (rnd() - 0.5) * D * 1.3;
      const spread = D * 0.075 * (1 + 0.8 * Math.abs(Math.sin(t / D * 5)));
      const w = (rnd() + rnd() + rnd() - 1.5) * spread;
      const p = along(t, w);
      const r = D * (0.02 + rnd() * 0.07);
      const core = Math.abs(w) < spread * 0.35;
      const rg = o.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      const warm = rnd() < 0.35;
      const a = core ? 0.045 + rnd() * 0.05 : 0.02 + rnd() * 0.03;
      rg.addColorStop(0, warm ? `rgba(228,214,190,${a})` : `rgba(170,190,235,${a})`);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      o.fillStyle = rg; o.beginPath(); o.arc(p.x, p.y, r, 0, Math.PI * 2); o.fill();
    }
    // dust lanes: dark blobs down the middle of the band
    o.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 70; i++) {
      const t = (rnd() - 0.5) * D * 1.2;
      const w = (rnd() - 0.5) * D * 0.035 + Math.sin(t / D * 9) * D * 0.012;
      const p = along(t, w);
      const r = D * (0.012 + rnd() * 0.035);
      const rg = o.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      rg.addColorStop(0, `rgba(4,6,11,${0.35 + rnd() * 0.35})`); rg.addColorStop(1, 'rgba(4,6,11,0)');
      o.fillStyle = rg; o.beginPath(); o.arc(p.x, p.y, r, 0, Math.PI * 2); o.fill();
    }

    // 3. Stars: magnitude distribution (lots faint, few bright), denser in the band, subtle colour
    const N = Math.min(3400, Math.floor((D * D) / 1200));
    twinklers = [];
    for (let i = 0; i < N; i++) {
      let x, y;
      if (rnd() < 0.42) { const t = (rnd() - 0.5) * D * 1.3, w = (rnd() + rnd() + rnd() - 1.5) * D * 0.11; const p = along(t, w); x = p.x; y = p.y; }
      else { x = rnd() * D; y = rnd() * D; }
      const m = Math.pow(rnd(), 3.2);                      // 0..1, most near 0 (faint)
      const r = 0.35 + m * 2.1;
      const c = rnd();
      const col = c < 0.12 ? [255, 214, 170] : c < 0.24 ? [255, 240, 220] : c < 0.7 ? [235, 240, 250] : [200, 215, 255];
      const a = 0.35 + m * 0.65;
      if (m > 0.62 && twinklers.length < 160) { twinklers.push({ x, y, r, col, a, p: rnd() * 6.28, s: 0.6 + rnd() * 1.6 }); continue; }
      o.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
      o.beginPath(); o.arc(x, y, r, 0, Math.PI * 2); o.fill();
      if (m > 0.8) { // bright star glow
        const rg = o.createRadialGradient(x, y, 0, x, y, r * 6);
        rg.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.18)`); rg.addColorStop(1, 'rgba(0,0,0,0)');
        o.fillStyle = rg; o.beginPath(); o.arc(x, y, r * 6, 0, Math.PI * 2); o.fill();
      }
    }
    sky = off;
  }

  /* ---------- Per-frame draw ---------- */
  let last = 0, meteors = [];
  function draw(now) {
    if (!sky) return;
    const t = now / 1000;
    const doc = document.documentElement;
    const maxScroll = Math.max(1, doc.scrollHeight - innerHeight);
    const k = Math.min(1, Math.max(0, scrollY / maxScroll));
    // Sky rotation: 22° across the page, plus a slow real-time drift; slight parallax lift
    // 40° of turn across the page, plus a drift of ~0.35°/s so the sky visibly wheels even when you stop
    const rot = reduce ? 0 : k * 0.70 + t * 0.006;
    const lift = reduce ? 0 : k * H * 0.10;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#04060b'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2 - lift);
    ctx.rotate(rot);
    ctx.drawImage(sky, -D / 2, -D / 2, D, D);
    // live twinklers in the same frame of reference
    for (const s of twinklers) {
      const tw = reduce ? 1 : 0.55 + 0.45 * Math.sin(t * s.s + s.p);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = `rgb(${s.col[0]},${s.col[1]},${s.col[2]})`;
      ctx.beginPath(); ctx.arc(s.x - D / 2, s.y - D / 2, s.r, 0, Math.PI * 2); ctx.fill();
      if (s.r > 1.9) { // cross glint on the brightest
        ctx.globalAlpha = s.a * tw * 0.35; ctx.lineWidth = 0.8; ctx.strokeStyle = ctx.fillStyle;
        const gx = s.x - D / 2, gy = s.y - D / 2, L = s.r * 5;
        ctx.beginPath(); ctx.moveTo(gx - L, gy); ctx.lineTo(gx + L, gy); ctx.moveTo(gx, gy - L); ctx.lineTo(gx, gy + L); ctx.stroke();
      }
    }
    ctx.restore(); ctx.globalAlpha = 1;
    // Milky Way brightens toward the middle of the night (mid-page)
    const bell = Math.exp(-Math.pow((k - 0.5) / 0.28, 2));
    if (bell > 0.02) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.28 * bell; ctx.translate(W / 2, H / 2 - lift); ctx.rotate(rot); ctx.drawImage(sky, -D / 2, -D / 2, D, D); ctx.restore(); ctx.globalAlpha = 1; }
    // Dusk at the top of the page, pre-dawn at the bottom
    const dusk = Math.max(0, 1 - k * 4), dawn = Math.max(0, (k - 0.78) / 0.22);
    if (dusk > 0) { const g = ctx.createLinearGradient(0, H * 0.45, 0, H); g.addColorStop(0, 'rgba(120,70,30,0)'); g.addColorStop(1, `rgba(150,85,35,${0.42 * dusk})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (dawn > 0) { const g = ctx.createLinearGradient(0, H * 0.35, 0, H); g.addColorStop(0, 'rgba(70,110,170,0)'); g.addColorStop(1, `rgba(90,130,190,${0.38 * dawn})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // Persistent horizon: two ridges fade in once the hero scrolls away, parallax against each other
    const ridge = Math.min(1, Math.max(0, (k - 0.045) * 14));
    if (ridge > 0) {
      const base = H * 0.86 + (1 - ridge) * 40;
      ctx.globalAlpha = ridge;
      ctx.fillStyle = '#0a1120'; ctx.beginPath(); ctx.moveTo(0, base + 30 - k * 10);
      for (let i = 0; i <= 14; i++) { const x = (W / 14) * i; ctx.lineTo(x, base + 30 - k * 10 - Math.abs(Math.sin(i * 1.9 + 0.7)) * H * 0.07 - Math.sin(i * 0.8) * H * 0.02); }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#04070e'; ctx.beginPath(); ctx.moveTo(0, base + 58 - k * 26);
      for (let i = 0; i <= 10; i++) { const x = (W / 10) * i; ctx.lineTo(x, base + 58 - k * 26 - Math.abs(Math.sin(i * 2.3 + 2.1)) * H * 0.05); }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // meteors, screen space
    if (!reduce) {
      if (now - last > 4000 + Math.random() * 7000 && meteors.length < 2) {
        last = now;
        const a = Math.PI * (0.12 + Math.random() * 0.26);
        meteors.push({ x: W * (0.1 + Math.random() * 0.8), y: H * Math.random() * 0.45, a, len: 110 + Math.random() * 160, t0: now, dur: 550 + Math.random() * 350 });
      }
      meteors = meteors.filter(m => now - m.t0 < m.dur);
      for (const m of meteors) {
        const q = (now - m.t0) / m.dur, x = m.x + Math.cos(m.a) * m.len * q, y = m.y + Math.sin(m.a) * m.len * q;
        const tail = 60, gx = x - Math.cos(m.a) * tail, gy = y - Math.sin(m.a) * tail;
        const g = ctx.createLinearGradient(gx, gy, x, y);
        g.addColorStop(0, 'rgba(240,236,228,0)'); g.addColorStop(1, `rgba(240,236,228,${0.95 * (1 - q)})`);
        ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(x, y); ctx.stroke();
      }
    }
    if (!reduce && !hidden) raf = requestAnimationFrame(draw);
  }

  /* ---------- Lifecycle ---------- */
  let rt = 0;
  const resize = () => {
    // iOS fires resize on toolbar show/hide; only rebuild for real changes
    if (Math.abs(innerWidth - W) < 2 && Math.abs(innerHeight - H) < 120) { cv.width = Math.floor(innerWidth * DPR); cv.height = Math.floor(innerHeight * DPR); W = innerWidth; H = innerHeight; return; }
    clearTimeout(rt); rt = setTimeout(() => { cancelAnimationFrame(raf); build(); draw(performance.now()); }, 120);
  };
  addEventListener('resize', resize, { passive: true });
  addEventListener('orientationchange', resize, { passive: true });
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; if (!hidden && !reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } });
  if (reduce) addEventListener('scroll', () => draw(performance.now()), { passive: true });
  build(); draw(performance.now());
})();
