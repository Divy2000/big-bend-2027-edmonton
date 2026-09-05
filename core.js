/* Big Bend 2027 — shared behaviour. No dependencies. */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Starfield (hero canvas) ---------- */
  const canvas = $('#stars');
  if (canvas) {
    const ctx = canvas.getContext('2d', { alpha: true });
    let w = 0, h = 0, dpr = 1, stars = [], t0 = performance.now(), raf = 0, running = true;
    const band = canvas.dataset.band !== 'off'; // subtle Milky Way band
    const seed = (n) => { let s = n; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
    const rnd = seed(2027);
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(520, Math.floor((w * h) / 2600));
      stars = [];
      for (let i = 0; i < count; i++) {
        const inBand = band && rnd() < 0.45;
        let x = rnd() * w, y = rnd() * h * 0.92;
        if (inBand) { // cluster along a diagonal band
          const u = rnd();
          x = u * w;
          y = (h * 0.62 - u * h * 0.55) + (rnd() - 0.5) * h * 0.22 * (0.6 + rnd());
        }
        stars.push({ x, y, r: (rnd() < 0.08 ? 1.5 : 0.7) + rnd() * 0.8, a: 0.35 + rnd() * 0.65, p: rnd() * Math.PI * 2, s: 0.3 + rnd() * 1.4, warm: rnd() < 0.15 });
      }
    }
    function draw(now) {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      if (band) {
        const g = ctx.createLinearGradient(0, h * 0.7, w, h * 0.05);
        g.addColorStop(0, 'rgba(120,140,190,0)'); g.addColorStop(0.5, 'rgba(150,165,205,0.10)'); g.addColorStop(1, 'rgba(120,140,190,0)');
        ctx.save(); ctx.translate(w / 2, h * 0.38); ctx.rotate(-0.5); ctx.fillStyle = g;
        ctx.fillRect(-w, -h * 0.16, w * 2, h * 0.32); ctx.restore();
      }
      const drift = reduce ? 0 : t * 1.2; // px/s slow sky rotation feel
      for (const st of stars) {
        const tw = reduce ? 1 : 0.75 + 0.25 * Math.sin(t * st.s + st.p);
        const x = (st.x + drift * 0.15 * st.r) % (w + 4);
        ctx.globalAlpha = st.a * tw;
        ctx.fillStyle = st.warm ? '#f3d9a6' : '#e6ecf5';
        ctx.beginPath(); ctx.arc(x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduce && running) raf = requestAnimationFrame(draw);
    }
    size(); draw(performance.now());
    const resize = () => { cancelAnimationFrame(raf); size(); draw(performance.now()); };
    addEventListener('resize', resize, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (Math.abs(canvas.clientHeight - h) > 2 || Math.abs(canvas.clientWidth - w) > 2) resize(); }).observe(canvas);
    addEventListener('load', resize, { once: true });
    // Pause when hero is off-screen (battery, 60fps elsewhere)
    new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running && !reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } }).observe(canvas);
  }

  /* ---------- Hero parallax layers (transform only) ---------- */
  const layers = $$('[data-depth]');
  if (layers.length && !reduce) {
    let ticking = false;
    let mx = 0, my = 0;
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        const y = Math.min(scrollY, innerHeight);
        for (const el of layers) { const d = parseFloat(el.dataset.depth); el.style.transform = `translate3d(${(mx * d * 60).toFixed(1)}px,${(y * d + my * d * 30).toFixed(1)}px,0)`; }
        ticking = false;
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    if (matchMedia('(hover:hover) and (pointer:fine)').matches) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; onScroll(); }, { passive: true });
  }

  /* ---------- Section reveals + meters ---------- */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
  $$('section, .reveal').forEach(el => io.observe(el));

  /* ---------- Story panels: mask wipe ---------- */
  const so = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => { if (e.isIntersecting) { setTimeout(() => e.target.classList.add('shown'), i * 90); so.unobserve(e.target); } });
  }, { threshold: 0.2 });
  $$('.story figure').forEach(f => so.observe(f));
  { // fallback: reveal any figure that is in the viewport, checked on scroll (rAF-throttled)
    let t = false;
    const chk = () => { for (const f of $$('.story figure:not(.shown)')) { const r = f.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) f.classList.add('shown'); } t = false; };
    addEventListener('scroll', () => { if (!t) { t = true; requestAnimationFrame(chk); } }, { passive: true }); setTimeout(chk, 800);
  }

  /* ---------- Counters ---------- */
  const fmt = (n, d) => n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
  const co = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue; co.unobserve(e.target);
      const el = e.target, to = parseFloat(el.dataset.count), d = parseInt(el.dataset.dec || '0', 10);
      const pre = el.dataset.pre || '', post = el.dataset.post || '';
      if (reduce) { el.textContent = pre + fmt(to, d) + post; continue; }
      const start = performance.now(), dur = 1400;
      const step = (now) => {
        const k = Math.min(1, (now - start) / dur), ease = 1 - Math.pow(1 - k, 3);
        el.textContent = pre + fmt(to * ease, d) + post;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }, { threshold: 0.6 });
  $$('[data-count]').forEach(el => co.observe(el));

  /* ---------- Moon renderer: sweeps from full to the real phase ---------- */
  const moonPath = (k, waxing) => {
    const R = 40, cx = 50, cy = 50, lit = k >= 0.5, rx = Math.abs(Math.cos(Math.PI * k)) * R, so = waxing ? 1 : 0;
    return `M ${cx} ${cy - R} A ${R} ${R} 0 0 ${so} ${cx} ${cy + R} A ${rx} ${R} 0 0 ${lit ? so : 1 - so} ${cx} ${cy - R} Z`;
  };
  $$('svg[data-moon]').forEach(svg => {
    const target = Math.max(0, Math.min(1, parseFloat(svg.dataset.moon) / 100)), waxing = svg.dataset.phase !== 'waning';
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.innerHTML = `<circle cx="50" cy="50" r="40" fill="#0c1220" stroke="rgba(255,255,255,.12)"/><path class="moon-lit on" fill="#d9dee6" d="${moonPath(reduce ? target : 1, waxing)}" style="opacity:${reduce ? 1 : 0}"/>`;
    if (reduce) return;
    const lit = svg.querySelector('.moon-lit');
    new IntersectionObserver((es, o) => {
      if (!es[0].isIntersecting) return; o.disconnect();
      const t0 = performance.now(), dur = 1600, delay = [...svg.parentNode.parentNode.children].indexOf(svg.parentNode) * 260;
      const step = now => {
        const q = Math.max(0, Math.min(1, (now - t0 - delay) / dur)), e = 1 - Math.pow(1 - q, 3);
        lit.style.opacity = Math.min(1, q * 4); lit.setAttribute('d', moonPath(1 - (1 - target) * e, waxing));
        if (q < 1) requestAnimationFrame(step);
      }; requestAnimationFrame(step);
    }, { threshold: .5 }).observe(svg);
  });

  /* ---------- Itinerary route progress (scroll-linked) ---------- */
  const route = $('.route');
  if (route) {
    const prog = $('.route .line .prog');
    const path = $('.route .line path');
    const setLen = () => {
      const H = route.getBoundingClientRect().height;
      [path, prog].forEach(p => p && p.setAttribute('d', `M1 0 V ${H}`));
      if (prog) { prog.style.strokeDasharray = H; prog.style.strokeDashoffset = H; route.dataset.h = H; }
    };
    setLen(); addEventListener('resize', setLen, { passive: true });
    const upd = () => {
      if (!prog) return;
      const r = route.getBoundingClientRect(), H = parseFloat(route.dataset.h || '0');
      const seen = Math.min(H, Math.max(0, innerHeight * 0.7 - r.top));
      prog.style.strokeDashoffset = reduce ? 0 : H - seen;
    };
    addEventListener('scroll', upd, { passive: true }); upd();
  }

  /* ---------- Sticky verdict bar ---------- */
  const stick = $('.stick'), hero = $('.hero'), finalSec = $('#join');
  if (stick && hero) {
    const heroObs = new IntersectionObserver(([e]) => { stick.classList.toggle('on', !e.isIntersecting && !stick.dataset.hide); }, { threshold: 0.05 });
    heroObs.observe(hero);
    if (finalSec) new IntersectionObserver(([e]) => { stick.dataset.hide = e.isIntersecting ? '1' : ''; if (e.isIntersecting) stick.classList.remove('on'); else if (!heroVisible()) stick.classList.add('on'); }, { threshold: 0.2 }).observe(finalSec);
    function heroVisible() { const r = hero.getBoundingClientRect(); return r.bottom > innerHeight * 0.05; }
  }

  /* ---------- FX converter (Edmonton) ---------- */
  const fxIn = $('#fx');
  if (fxIn) {
    const apply = () => {
      const rate = Math.max(1, Math.min(2, parseFloat(fxIn.value) || 1.38));
      $$('[data-usd]').forEach(el => {
        const lo = parseFloat(el.dataset.usd), hi = el.dataset.usdHi ? parseFloat(el.dataset.usdHi) : null;
        const r5 = (v) => (Math.round(v * rate / 5) * 5).toLocaleString('en-CA');
        el.textContent = hi ? `C$${r5(lo)}–${r5(hi)}` : `C$${r5(lo)}`;
      });
      $$('[data-rate]').forEach(el => el.textContent = rate.toFixed(2));
    };
    fxIn.addEventListener('input', apply); apply();
  }

  /* ---------- Hero enter class after fonts settle ---------- */
  requestAnimationFrame(() => document.body.classList.add('hero-enter'));
})();

/* ---------- Photo parallax: transform-only, rAF-throttled ---------- */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const items = [...document.querySelectorAll('[data-parallax]')];
  if (!items.length) return;
  const live = new Set();
  const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? live.add(e.target) : live.delete(e.target)), { rootMargin: '20% 0px' });
  items.forEach(el => io.observe(el));
  let tick = false;
  const draw = () => {
    const vh = innerHeight;
    for (const el of live) {
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2 - vh / 2;
      el.style.transform = `translate3d(0,${(-mid * parseFloat(el.dataset.parallax)).toFixed(2)}px,0)`;
    }
    tick = false;
  };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(draw); } }, { passive: true });
  addEventListener('resize', draw, { passive: true });
  draw();
})();

/* ---------- Motion pass ---------- */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* scroll progress */
  const bar = document.querySelector('.progress i');
  if (bar && !reduce) {
    let t = false;
    const upd = () => { const h = document.documentElement; const p = h.scrollTop / (h.scrollHeight - h.clientHeight || 1); bar.style.transform = `scaleX(${p})`; t = false; };
    addEventListener('scroll', () => { if (!t) { t = true; requestAnimationFrame(upd); } }, { passive: true }); upd();
  }
  /* itinerary: car marker follows the drawn route */
  const route = document.querySelector('.route');
  if (route && !reduce) {
    const car = document.createElement('div'); car.className = 'car'; car.setAttribute('aria-hidden', 'true'); route.appendChild(car);
    let t = false;
    const upd = () => { const r = route.getBoundingClientRect(); const seen = Math.min(r.height - 8, Math.max(0, innerHeight * 0.7 - r.top)); car.style.transform = `translateY(${seen}px)`; t = false; };
    addEventListener('scroll', () => { if (!t) { t = true; requestAnimationFrame(upd); } }, { passive: true }); upd();
  }
  /* map: a dot drives Dallas → Big Bend as the route draws */
  const rt = document.getElementById('rt');
  if (rt && !reduce && typeof rt.getTotalLength === 'function') {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '7'); dot.setAttribute('fill', 'var(--amber)'); dot.setAttribute('class', 'map-dot'); dot.style.opacity = '0';
    rt.parentNode.insertBefore(dot, rt.nextSibling);
    const L = rt.getTotalLength();
    new IntersectionObserver((es, o) => {
      if (!es[0].isIntersecting) return; o.disconnect();
      const start = performance.now(), dur = 2400, delay = 200;
      const step = now => {
        const k = Math.max(0, Math.min(1, (now - start - delay) / dur)), e = 1 - Math.pow(1 - k, 3);
        const p = rt.getPointAtLength(L * e); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.style.opacity = k > 0 ? '1' : '0';
        if (k < 1) requestAnimationFrame(step);
      }; requestAnimationFrame(step);
    }, { threshold: .4 }).observe(rt.closest('section'));
  }
  /* hero: occasional shooting star on the existing starfield */
  const cv = document.getElementById('stars');
  if (cv && !reduce) {
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const shoot = () => {
      const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      const x0 = Math.random() * w * 0.8 + w * 0.1, y0 = Math.random() * h * 0.35, len = 90 + Math.random() * 140, ang = Math.PI * (0.15 + Math.random() * 0.2);
      const t0 = performance.now(), dur = 650;
      const frame = now => {
        const k = (now - t0) / dur; if (k > 1) return;
        const x = x0 + Math.cos(ang) * len * k, y = y0 + Math.sin(ang) * len * k;
        ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const g = ctx.createLinearGradient(x - Math.cos(ang) * 40, y - Math.sin(ang) * 40, x, y);
        g.addColorStop(0, 'rgba(243,238,229,0)'); g.addColorStop(1, `rgba(243,238,229,${0.9 * (1 - k)})`);
        ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - Math.cos(ang) * 40, y - Math.sin(ang) * 40); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
        requestAnimationFrame(frame);
      }; requestAnimationFrame(frame);
    };
    let vis = true; new IntersectionObserver(([e]) => { vis = e.isIntersecting; }).observe(cv);
    const loop = () => { if (vis) shoot(); setTimeout(loop, 3500 + Math.random() * 6000); }; setTimeout(loop, 1800);
  }
})();
