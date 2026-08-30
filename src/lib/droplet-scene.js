// 水滴场面：星空层（复用 starfield）+ 水滴形（球头收尖）离屏层 + 高速飞行特效
import { createStarfield } from './starfield.js';

export function createDropletScene(starCanvas, dropletCanvas, opts = {}) {
  const stars = createStarfield(starCanvas, {
    density: opts.density ?? 160,
    speed: opts.speed ?? 1.1,        // 高速星移 → 飞驰感
    parallax: opts.parallax ?? 0.08,
  });
  const ctx = dropletCanvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const off = document.createElement('canvas');
  const octx = off.getContext('2d');
  let W = 0, H = 0, raf = 0, running = false;
  // 水滴几何（居中）——由 drawOffscreen 计算并缓存到外层，供 frame 复用
  let cx = 0, cy = 0, R = 0, tipX = 0;

  function drawOffscreen() {
    // 竖屏时相对缩水（避免尖端出界）
    R = Math.min(W, H) * (W < H ? 0.16 : 0.19);
    cx = W * 0.40;
    cy = H * 0.46;
    tipX = cx + R * 2.1;
    const tipY = cy;

    off.width = W * dpr; off.height = H * dpr;
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, W, H);

    // 底部舰队剪影（两千舰的微光）
    octx.fillStyle = 'rgba(120,150,190,0.5)';
    for (let i = 0; i < 220; i++) {
      const gx = ((i * 7919) % (W + 120)) - 60;
      const gy = H - 20 - ((i * 5171) % 60);
      const gw = 1.4 + (i % 3);
      octx.fillRect(gx, gy, gw, 1.2);
    }

    // 水滴轮廓：左半圆球头 + 上下二次曲线收向右尖端
    octx.beginPath();
    octx.arc(cx, cy, R, Math.PI * 0.5, Math.PI * 1.5, false); // 上→左→下 半圆
    octx.quadraticCurveTo(cx + R * 1.1, cy - R * 0.5, tipX, tipY); // 上侧收尖
    octx.quadraticCurveTo(cx + R * 1.1, cy + R * 0.5, cx, cy + R); // 下侧收尖
    octx.closePath();

    // 镜面渐变（高光偏球头左上方）
    const g = octx.createRadialGradient(cx - R * 0.34, cy - R * 0.30, R * 0.05, cx - R * 0.2, cy, R * 1.75);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.18, '#dfe9f2');
    g.addColorStop(0.42, '#5b7c9c');
    g.addColorStop(0.62, '#1a2c44');
    g.addColorStop(0.82, '#0a1424');
    g.addColorStop(1, '#02040a');
    octx.fillStyle = g;
    octx.fill();

    // 球头表面倒映的舰队光点
    for (let i = 0; i < 70; i++) {
      const px = cx - R + ((i * 37) % 100) / 100 * (R * 1.6);
      const py = cy - R * 0.85 + ((i * 53) % 100) / 100 * (R * 1.7);
      if (px > tipX) continue;
      octx.fillStyle = `rgba(170,205,245,${0.3 + (i % 3) * 0.2})`;
      octx.fillRect(px, py, 1.6, 0.7);
    }

    // 主高光（球头左上）
    const hx = cx - R * 0.38, hy = cy - R * 0.36;
    octx.fillStyle = 'rgba(255,255,255,0.9)';
    octx.beginPath(); octx.arc(hx, hy, R * 0.11, 0, Math.PI * 2); octx.fill();
    octx.fillStyle = 'rgba(255,255,255,0.35)';
    octx.beginPath(); octx.arc(hx, hy, R * 0.2, 0, Math.PI * 2); octx.fill();
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    const t = Date.now() * 0.001;
    const tipY = cy;

    // 水滴轮廓辉光（呼吸）
    const pulse = 0.14 + 0.05 * Math.sin(t * 1.2);
    ctx.beginPath();
    ctx.ellipse(cx - R * 0.15, cy, R * 1.55, R * 1.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(120,175,230,${pulse.toFixed(3)})`;
    ctx.fill();

    // 前方激波（尖端右前，两道弧）
    const bowPulse = 0.20 + 0.08 * Math.sin(t * 1.7);
    ctx.beginPath();
    ctx.ellipse(tipX + R * 1.0, cy, R * 0.72, R * 0.42, 0, Math.PI * 0.18, Math.PI * 0.82, false);
    ctx.strokeStyle = `rgba(150,202,255,${bowPulse.toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(tipX + R * 1.38, cy, R * 0.95, R * 0.58, 0, Math.PI * 0.24, Math.PI * 0.76, false);
    ctx.strokeStyle = `rgba(150,202,255,${(bowPulse * 0.5).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 星流线（高速穿行：星星相对向左流过）
    ctx.lineWidth = 1;
    for (let i = 0; i < 46; i++) {
      const sp = (((i * 977 + t * 42) % (H + 30)) + (H + 30)) % (H + 30) - 15;
      const raw = (i * 1301 - t * (95 + (i % 4) * 28)) % (W + 160);
      const sx = ((raw + (W + 160)) % (W + 160)) - 80;
      const len = 26 + (i % 6) * 18;
      const alpha = 0.05 + (i % 5) * 0.022;
      ctx.strokeStyle = `rgba(205,228,255,${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(sx + len, sp);
      ctx.lineTo(sx, sp);
      ctx.stroke();
    }

    // 水滴本体（离屏层）
    ctx.drawImage(off, 0, 0, W, H);

    // 顶/底压暗（电影感）
    const vg = ctx.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, 'rgba(5,8,14,0.55)');
    vg.addColorStop(0.35, 'rgba(5,8,14,0)');
    vg.addColorStop(0.7, 'rgba(5,8,14,0)');
    vg.addColorStop(1, 'rgba(5,8,14,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    const rect = dropletCanvas.parentElement.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    dropletCanvas.width = W * dpr;
    dropletCanvas.height = H * dpr;
    dropletCanvas.style.width = `${W}px`;
    dropletCanvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawOffscreen();
    // 星空 canvas 与水滴 canvas 同尺寸（父容器相同）
    starCanvas.width = W * dpr; starCanvas.height = H * dpr;
    starCanvas.style.width = `${W}px`; starCanvas.style.height = `${H}px`;
  }

  function start() { if (!running) { running = true; frame(); } }
  function stop() { if (running) { running = false; cancelAnimationFrame(raf); } }

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((en) => (en.isIntersecting ? start() : stop())), { rootMargin: '120px' })
    : null;
  function mount() {
    resize();
    window.addEventListener('resize', resize);
    if (io) io.observe(dropletCanvas);
    else start();
  }
  function destroy() {
    stop();
    window.removeEventListener('resize', resize);
    if (io) io.disconnect();
    stars.destroy();
  }

  mount();
  return { start, stop, destroy };
}
