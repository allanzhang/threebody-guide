// 通用星空粒子引擎：可测纯函数 + Canvas 运行时（原生 2D，无依赖）
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clampInt = (v, lo, hi) => Math.round(clamp(v, lo, hi));

export function normalizeOpts(opts = {}) {
  return {
    density: clampInt(opts.density ?? 140, 0, 600),
    speed: clamp(opts.speed ?? 0.5, 0, 3),
    parallax: clamp(opts.parallax ?? 0.04, 0, 0.2),
    brightness: clamp(opts.brightness ?? 1, 0.2, 2),
  };
}

/** 移动端（<=768px）粒子密度减半 */
export function pickDensity(density, isMobile) {
  return isMobile ? Math.round(density * 0.5) : density;
}

/** 生成星星数组；rng 可注入以便测试确定性 */
export function makeStars(width, height, count, rng = Math.random) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rng() * width,
      y: rng() * height,
      r: 0.3 + rng() * 2.7,          // 半径 0.3~3
      a: 0.25 + rng() * 0.75,        // 基础亮度
      tw: rng() * Math.PI * 2,       // 闪烁相位
      v: 0.2 + rng() * 1.0,          // 速度系数（近星快、远星慢 → 景深）
    });
  }
  return stars;
}

/**
 * 启动星空 Canvas。
 * 返回控制句柄；页面卸载 / 组件销毁时调用 destroy()。
 */
export function createStarfield(canvas, opts = {}) {
  const o = normalizeOpts(opts);
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const ctx = canvas.getContext('2d');
  let stars = [];
  let raf = 0;
  let running = false;
  let W = 0;
  let H = 0;
  let scrollY = 0;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = pickDensity(o.density, isMobile());
    stars = makeStars(W, H, count);
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    const dy = -scrollY * o.parallax; // 视差：滚动时整体上移
    for (const s of stars) {
      s.y += o.speed * s.v * 0.06;
      s.x += o.speed * 0.02;
      if (s.y > H + 2) s.y = -2;
      if (s.x > W + 2) s.x = -2;
      const twinkle = 0.55 + 0.45 * Math.sin(Date.now() * 0.0018 + s.tw);
      ctx.beginPath();
      ctx.arc(s.x, s.y + dy, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(215,228,245,${(s.a * twinkle * o.brightness).toFixed(3)})`;
      ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    frame();
  }
  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  }

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((en) => (en.isIntersecting ? start() : stop()));
      }, { rootMargin: '120px' })
    : null;

  const onScroll = () => { scrollY = window.scrollY; };
  function mount() {
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', onScroll, { passive: true });
    if (io) io.observe(canvas);
    else start();
  }
  function destroy() {
    stop();
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', onScroll);
    if (io) io.disconnect();
  }

  mount();
  return { start, stop, destroy };
}
