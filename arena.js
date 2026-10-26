/* Arena mini di beranda: demo kecil ular bergaya Slink. Ularmu mengikuti kursor/jari, memakan titik, dan ngebut saat ditahan.
   Hanya mainan di halaman ini (tanpa tabrakan, tanpa skor tersimpan). Berhenti sendiri saat tidak terlihat. */
(() => {
  "use strict";
  const box = document.getElementById("arena");
  if (!box) return;
  const cv = box.querySelector("canvas");
  const ctx = cv && cv.getContext("2d");
  if (!ctx) return;
  const lenEl = box.querySelector("[data-len]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2, H = 360;
  let W = 640, K = 1;                      // dunia H unit tinggi; K = piksel per unit
  let bg = null;

  const PAL = { 2: [128, 208, 208], 3: [128, 255, 128], 5: [255, 160, 96], 7: [255, 64, 64], 8: [224, 48, 224], 9: [255, 255, 255],
    11: [80, 80, 80], 14: [100, 117, 255], 17: [160, 80, 255], 18: [255, 224, 64], 22: [255, 86, 9], 23: [101, 200, 232] };
  const SKIN = {
    pelangi: { c: [7, 5, 18, 3, 14, 17].map(i => PAL[i]), run: 6, fade: 0.55 },
    zebra: { c: [PAL[9], PAL[11]], run: 5, fade: 0.2 },
    api: { c: [22, 18, 7].map(i => PAL[i]), run: 5, fade: 0.55 },
    samudra: { c: [14, 23, 2].map(i => PAL[i]), run: 6, fade: 0.55 },
    neon: { c: [17, 8].map(i => PAL[i]), run: 5, fade: 0.5 },
  };
  const ORB = [7, 5, 18, 3, 14, 17, 8, 2, 22, 23].map(i => PAL[i]);
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgb = (c, a) => a === undefined ? "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")" : "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a + ")";
  const smooth = t => t * t * (3 - 2 * t);
  function skinColor(sk, k) {
    const n = sk.c.length, pos = k / sk.run, run = Math.floor(pos), f = pos - run;
    return mix(sk.c[run % n], sk.c[(run + 1) % n], smooth(Math.max(0, (f - (1 - sk.fade)) / sk.fade)));
  }

  const snakes = [];
  const orbs = [];
  function newSnake(skin, x, y, len, player) {
    return { skin: SKIN[skin], x, y, a: Math.random() * TAU, len, trail: [{ x, y }], player: !!player, boost: false, wander: null, wt: 0, grow: 0 };
  }
  function spawnOrb(o) {
    o = o || {};
    o.x = 14 + Math.random() * (W - 28); o.y = 14 + Math.random() * (H - 28);
    o.r = 1.9 + Math.random() * 2.2; o.c = ORB[(Math.random() * ORB.length) | 0]; o.ph = Math.random() * TAU;
    return o;
  }
  function reset() {
    snakes.length = 0; orbs.length = 0;
    const player = newSnake("pelangi", W * 0.3, H * 0.55, 14, true);
    snakes.push(player);
    snakes.push(newSnake("zebra", W * 0.75, H * 0.3, 22), newSnake("api", W * 0.6, H * 0.8, 18), newSnake("samudra", W * 0.12, H * 0.2, 16));
    for (let i = 0; i < 70; i++) orbs.push(spawnOrb());
    for (let i = 0; i < 90; i++) step(1 / 60);   // pemanasan supaya ular tidak mulai sebagai titik
  }

  /* ---------------------------------------------------------------- masukan */
  const ptr = { x: 0, y: 0, on: false, t: -99, down: false };
  function toWorld(e) {
    const r = cv.getBoundingClientRect();
    ptr.x = (e.clientX - r.left) * (W / r.width);
    ptr.y = (e.clientY - r.top) * (H / r.height);
    ptr.t = performance.now() / 1000; ptr.on = true;
  }
  box.addEventListener("pointermove", toWorld);
  box.addEventListener("pointerdown", e => { toWorld(e); ptr.down = true; });
  const up = () => { ptr.down = false; };
  box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
  box.addEventListener("pointerleave", () => { ptr.down = false; ptr.on = false; });

  /* ---------------------------------------------------------------- simulasi */
  const R = s => 5.2 + Math.min(7, s.len * 0.07);
  function nearestOrb(s, maxd) {
    let best = null, bd = maxd * maxd;
    for (const o of orbs) { const d = (o.x - s.x) ** 2 + (o.y - s.y) ** 2; if (d < bd) { bd = d; best = o; } }
    return best;
  }
  function target(s, now) {
    if (s.player) {
      if (ptr.on && now - ptr.t < 2.5) return ptr;
      const o = nearestOrb(s, 260);
      return o || { x: W / 2, y: H / 2 };
    }
    const m = 26;
    if (s.x < m || s.x > W - m || s.y < m || s.y > H - m) return { x: W / 2, y: H / 2 };
    const o = nearestOrb(s, 120);
    if (o) return o;
    if (!s.wander || now > s.wt) { s.wander = { x: 40 + Math.random() * (W - 80), y: 40 + Math.random() * (H - 80) }; s.wt = now + 2 + Math.random() * 3; }
    return s.wander;
  }
  function step(dt) {
    const now = performance.now() / 1000;
    for (const s of snakes) {
      const tg = target(s, now);
      const want = Math.atan2(tg.y - s.y, tg.x - s.x);
      let d = want - s.a; d = Math.atan2(Math.sin(d), Math.cos(d));
      const turn = (s.boost ? 3.4 : 4.4) * dt;
      s.a += Math.max(-turn, Math.min(turn, d));
      s.boost = s.player && ptr.down && s.len > 10.5;
      const sp = (s.boost ? 200 : 104) * dt;
      s.x += Math.cos(s.a) * sp; s.y += Math.sin(s.a) * sp;
      s.x = Math.max(4, Math.min(W - 4, s.x)); s.y = Math.max(4, Math.min(H - 4, s.y));
      const hd = s.trail[0];
      if (Math.hypot(s.x - hd.x, s.y - hd.y) >= 2) s.trail.unshift({ x: s.x, y: s.y });
      const keep = Math.ceil((s.len * R(s) * 0.62) / 2) + 12;
      if (s.trail.length > keep) s.trail.length = keep;
      if (s.boost) { s.grow -= dt * 2; if (s.grow <= -1) { s.len = Math.max(10, s.len - 1); s.grow = 0; } }
      for (const o of orbs) {
        const rr = R(s) + o.r + 3;
        if ((o.x - s.x) ** 2 + (o.y - s.y) ** 2 < rr * rr) { s.len += 1; spawnOrb(o); }
      }
    }
  }

  /* ---------------------------------------------------------------- gambar */
  function drawBg() {
    bg = document.createElement("canvas");
    bg.width = cv.width; bg.height = cv.height;
    const g = bg.getContext("2d");
    g.fillStyle = "#070a1c"; g.fillRect(0, 0, bg.width, bg.height);
    const r = 30 * K, w = Math.sqrt(3) * r, dy = 1.5 * r;
    for (let row = -1; row * dy < bg.height + r; row++) {
      for (let col = -1; col * w < bg.width + w; col++) {
        const cx = col * w + (row & 1 ? w / 2 : 0), cy = row * dy;
        g.beginPath();
        for (let i = 0; i < 6; i++) { const a = TAU / 6 * i + Math.PI / 6, rr = r * 0.88; i ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        g.closePath();
        const f = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        f.addColorStop(0, "#26336e"); f.addColorStop(1, "#1a2352");
        g.fillStyle = f; g.fill();
      }
    }
    const v = g.createRadialGradient(bg.width / 2, bg.height / 2, bg.height * 0.3, bg.width / 2, bg.height / 2, bg.width * 0.62);
    v.addColorStop(0, "rgba(5,7,15,0)"); v.addColorStop(1, "rgba(5,7,15,.62)");
    g.fillStyle = v; g.fillRect(0, 0, bg.width, bg.height);
  }

  function ball(x, y, r, c) {
    const f = ctx.createRadialGradient(x - r * 0.18, y - r * 0.22, r * 0.05, x, y, r);
    f.addColorStop(0, rgb(mix(c, [255, 255, 255], 0.38)));
    f.addColorStop(0.6, rgb(c));
    f.addColorStop(1, rgb(mix(c, [0, 0, 0], 0.32)));
    ctx.fillStyle = f; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  function bodyPoints(s) {
    const gap = R(s) * 0.62, n = Math.max(2, Math.round(s.len)), tr = s.trail;
    const pts = [{ x: tr[0].x, y: tr[0].y }];
    let want = gap, run = 0;                       // jarak yang dicari dari kepala; panjang lintasan sampai titik ke-i
    for (let i = 1; i < tr.length && pts.length < n; i++) {
      const a = tr[i - 1], b = tr[i], seg = Math.hypot(b.x - a.x, b.y - a.y);
      while (run + seg >= want && pts.length < n) {
        const f = seg ? (want - run) / seg : 0;
        pts.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
        want += gap;
      }
      run += seg;
    }
    while (pts.length < 2) pts.push({ x: tr[0].x, y: tr[0].y });
    return pts;
  }

  function drawSnake(s, t) {
    const pts = bodyPoints(s), r0 = R(s), n = pts.length;
    if (s.boost || s.player) {
      for (let k = n - 1; k >= 0; k -= 2) {
        const c = skinColor(s.skin, k);
        ctx.fillStyle = rgb(c, s.boost ? 0.16 : 0.08);
        ctx.beginPath(); ctx.arc(pts[k].x, pts[k].y, r0 * 2.1, 0, TAU); ctx.fill();
      }
    }
    for (let k = n - 1; k >= 0; k--) {
      const tail = Math.min(1, (n - 1 - k) / 7);
      ball(pts[k].x, pts[k].y, r0 * (k === 0 ? 1.05 : 0.5 + 0.5 * Math.sqrt(tail)), skinColor(s.skin, k));
    }
    const h = pts[0], b = pts[Math.min(3, n - 1)];
    let dx = h.x - b.x, dy = h.y - b.y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const nx = -dy, ny = dx, er = r0 * 0.4, pr = r0 * 0.22;
    for (const sg of [-1, 1]) {
      const ex = h.x + dx * r0 * 0.5 + nx * r0 * 0.52 * sg, ey = h.y + dy * r0 * 0.5 + ny * r0 * 0.52 * sg;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
      ctx.fillStyle = "#0b0f14"; ctx.beginPath(); ctx.arc(ex + dx * er * 0.34, ey + dy * er * 0.34, pr, 0, TAU); ctx.fill();
    }
  }

  function draw(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(K, 0, 0, K, 0, 0);
    for (const o of orbs) {
      const tw = 1 + 0.18 * Math.sin(t * 3 + o.ph), r = o.r * tw;
      const h = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r * 3.2);
      h.addColorStop(0, rgb(o.c, 0.55)); h.addColorStop(1, rgb(o.c, 0));
      ctx.fillStyle = h; ctx.beginPath(); ctx.arc(o.x, o.y, r * 3.2, 0, TAU); ctx.fill();
      ball(o.x, o.y, r, o.c);
    }
    for (let i = snakes.length - 1; i >= 0; i--) drawSnake(snakes[i], t);
    if (lenEl && snakes[0]) lenEl.textContent = String(Math.round(snakes[0].len));
  }

  /* ---------------------------------------------------------------- ukuran dan putaran */
  function resize() {
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    K = cv.height / H; W = Math.round(H * r.width / r.height);
    drawBg();
    for (const s of snakes) { s.x = Math.min(s.x, W - 4); }
    for (const o of orbs) if (o.x > W - 8) spawnOrb(o);
    if (!running) draw(performance.now() / 1000);
  }

  let running = false, raf = 0, last = 0, visible = true;
  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    step(dt); draw(ts / 1000);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || reduce || document.hidden || !visible) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  resize();
  reset();
  draw(0);
  if (!reduce) {
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; visible ? start() : stop(); }).observe(box);
    else start();
    document.addEventListener("visibilitychange", () => { document.hidden ? stop() : start(); });
  }
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(box); else window.addEventListener("resize", resize);
  start();
})();
