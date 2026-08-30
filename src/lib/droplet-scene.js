// 水滴场面：星空层（复用 starfield）+ 中央镜面球离屏层 + 呼吸辉光
import { createStarfield } from './starfield.js';

export function createDropletScene(starCanvas, dropletCanvas, opts = {}) {
  const stars = createStarfield(starCanvas, {
    density: opts.density ?? 160,
    speed: opts.speed ?? 0.7,
    parallax: opts.parallax ?? 0.05,
  });
  const ctx = dropletCanvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const off = document.createElement('canvas');
  const octx = off.getContext('2d');
  let W = 0, H = 0, raf = 0, running = false;

  function drawOffscreen() {
    const cx = W * 0.5, cy = H * 0.46;
    const r = Math.min(W, H) * 0.19;
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

    // 中央镜面球
    const g = octx.createRadialGradient(cx - r * 0.34, cy - r * 0.3, r * 0.06, cx, cy, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.18, '#dfe9f2');
    g.addColorStop(0.42, '#5b7c9c');
    g.addColorStop(0.62, '#1a2c44');
    g.addColorStop(0.82, '#0a1424');
    g.addColorStop(1, '#02040a');
    octx.beginPath();
    octx.arc(cx, cy, r, 0, Math.PI * 2);
    octx.fillStyle = g;
    octx.fill();

    // 球面左缘倒映的舰队光点（水滴内部）
    for (let i = 0; i < 70; i++) {
      const a = Math.PI * (0.03 + (i * 0.036) % 0.45);
      const rr = r * (0.28 + (i * 0.017) % 0.6);
      const px = cx - rr * Math.cos(a);
      const py = cy - rr * Math.sin(a) * 0.94;
      octx.fillStyle = `rgba(170,205,245,${0.3 + (i % 3) * 0.2})`;
      octx.fillRect(px, py, 1.6, 0.7);
    }

    // 主高光
    const hx = cx - r * 0.38, hy = cy - r * 0.36;
    octx.fillStyle = 'rgba(255,255,255,0.9)';
    octx.beginPath(); octx.arc(hx, hy, r * 0.11, 0, Math.PI * 2); octx.fill();
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    const t = Date.now() * 0.001;
    // 球体背景辉光（呼吸）
    const cx = W * 0.5, cy = H * 0.46;
    const r = Math.min(W, H) * 0.19;
    const pulse = 0.16 + 0.05 * Math.sin(t * 1.1);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(120,175,230,${pulse.toFixed(3)})`;
    ctx.fill();
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
