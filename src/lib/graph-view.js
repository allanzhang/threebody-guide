// 图谱客户端渲染与交互：SVG + Pointer Events（平移/缩放/分层/筛选/邻接高亮/详情浮层）
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function el(tag, cls, attrs = {}) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (cls) e.setAttribute('class', cls);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

function edgePath(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = Math.min(46, len * 0.18);
  const mx = (a.x + b.x) / 2 + (-dy / len) * off;
  const my = (a.y + b.y) / 2 + (dx / len) * off;
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
}

export function createGraph(root, data) {
  const svg = el('svg', 'kg-svg');
  svg.setAttribute('viewBox', `0 0 ${data.W} ${data.H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  root.appendChild(svg);

  const world = el('g', 'kg-world');
  world.setAttribute('transform-origin', '0 0');
  svg.appendChild(world);

  // meet 等比缩放下 css↔user 单位换算：s 均匀（xMidYMid meet），ox/oy 为居中留白偏移
  const fit = () => {
    const r = svg.getBoundingClientRect();
    const s = (r.width > 0 && r.height > 0) ? Math.min(r.width / data.W, r.height / data.H) : 1;
    return { s, ox: (r.width - data.W * s) / 2, oy: (r.height - data.H * s) / 2 };
  };

  // 卷轨道（背景色带 + 卷名）
  const railsG = el('g', 'kg-rails');
  world.appendChild(railsG);
  const railInfo = [];
  for (const n of Object.values(data.nodeById)) {
    if (n.type !== 'book') continue;
    const band = el('rect', 'kg-rail', { x: n.x - 42, y: 40, width: 84, height: Math.max(120, data.H - 110), rx: 8 });
    band.setAttribute('fill', n.color);
    band.setAttribute('fill-opacity', '0.055');
    railsG.appendChild(band);
    railInfo.push({ id: n.id, x: n.x, y: 22 });
  }
  for (const r of railInfo) {
    const t = el('text', 'kg-rail-label', { x: r.x, y: r.y, 'text-anchor': 'middle' });
    t.textContent = data.nodeById[r.id].label;
    t.setAttribute('fill', data.nodeById[r.id].color);
    world.appendChild(t);
  }

  // 边：曲线，data-a/data-b 记录端点
  const edgesG = el('g', 'kg-edges');
  world.appendChild(edgesG);
  const edgeEls = [];
  for (const e of data.edges) {
    const a = data.nodeById[e.source], b = data.nodeById[e.target];
    if (!a || !b) continue;
    const p = el('path', 'kg-edge', { d: edgePath(a, b), 'data-a': e.source, 'data-b': e.target });
    edgesG.appendChild(p);
    edgeEls.push(p);
  }

  // 节点：锚点（book/era）空心大圆带标签，其余实心圆 + 右侧标签
  const nodesG = el('g', 'kg-nodes');
  world.appendChild(nodesG);
  const nodeEls = new Map();
  for (const n of Object.values(data.nodeById)) {
    const g = el('g', `kg-node kg-node-${n.type}`);
    g.setAttribute('data-id', n.id);
    const anchor = n.type === 'book' || n.type === 'era';
    const c = el('circle', anchor ? 'kg-anchor' : 'kg-circle',
      { r: anchor ? 16 : 9, cx: n.x, cy: n.y, fill: anchor ? 'none' : n.color });
    if (anchor) c.setAttribute('stroke', n.color);
    c.setAttribute('stroke-width', anchor ? 1.5 : 0);
    g.appendChild(c);
    if (!anchor) {
      const t = el('text', 'kg-node-label', { x: n.x + 16, y: n.y + 4 });
      t.textContent = n.label;
      g.appendChild(t);
    } else {
      const t = el('text', 'kg-anchor-label', { x: n.x, y: n.y + 34, 'text-anchor': 'middle' });
      t.textContent = n.label;
      g.appendChild(t);
    }
    nodesG.appendChild(g);
    nodeEls.set(n.id, g);
  }

  const state = { layer: 'skeleton', types: new Set(['character', 'concept', 'event', 'scene']), x: 24, y: 40, k: 0.82 };
  const applyView = () => {
    world.setAttribute('style', `transform: translate(${state.x}px, ${state.y}px) scale(${state.k});`);
  };
  const visible = (id) => {
    const n = data.nodeById[id];
    return state.types.has(n.type) && (state.layer === 'full' || data.skeleton.includes(id));
  };
  const render = () => {
    for (const [id, g] of nodeEls) g.classList.toggle('kg-hidden', !visible(id));
    for (const p of edgeEls) {
      p.classList.toggle('kg-hidden', !visible(p.dataset.a) || !visible(p.dataset.b));
    }
  };

  // 平移 / 缩放（Pointer Events 统一鼠标触屏）
  const pointers = new Map();
  let dragId = null, moved = false, pinchDist = 0;
  svg.addEventListener('pointerdown', (e) => {
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (e.button === 0 && !pointers.has(2) && !pointers.has(1)) dragId = e.pointerId;
    moved = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
  });
  svg.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinchDist > 0) {
        state.k = clamp(state.k * (dist / pinchDist), 0.15, 6);
        applyView();
      }
      pinchDist = dist;
      return;
    }
    if (e.pointerId === dragId) {
      const f = fit();
      state.x += dx / f.s;
      state.y += dy / f.s;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      applyView();
    }
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    if (e.pointerId === dragId) dragId = null;
    pinchDist = 0;
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const f = fit();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const wx = (mx - f.ox) / f.s / state.k - state.x / state.k;
    const wy = (my - f.oy) / f.s / state.k - state.y / state.k;
    state.k = clamp(state.k * Math.exp(-e.deltaY * 0.0015), 0.15, 6);
    state.x = (mx - f.ox) / f.s - wx * state.k;
    state.y = (my - f.oy) / f.s - wy * state.k;
    applyView();
  }, { passive: false });

  // 邻接高亮
  const neighbors = (id) => new Set(
    data.edges.filter((e) => e.source === id || e.target === id)
      .map((e) => (e.source === id ? e.target : e.source))
  );
  const clearHot = () => { nodeEls.forEach((g) => g.classList.remove('kg-dim', 'kg-hot')); edgeEls.forEach((p) => p.classList.remove('kg-hot')); };
  nodesG.addEventListener('pointerover', (e) => {
    const g = e.target.closest('.kg-node');
    if (!g || g.classList.contains('kg-hidden')) return;
    clearHot();
    const id = g.dataset.id;
    const nb = neighbors(id);
    g.classList.add('kg-hot');
    nodeEls.forEach((ng, nid) => { if (ng !== g && !nb.has(nid)) ng.classList.add('kg-dim'); });
    edgeEls.forEach((p) => { if (p.dataset.a === id || p.dataset.b === id) p.classList.add('kg-hot'); });
  });
  nodesG.addEventListener('pointerout', () => clearHot());

  // 点击 → 详情浮层（模板由 Astro 服务端预渲染）
  const panel = document.getElementById('kg-panel');
  const panelBody = document.getElementById('kg-panel-body');
  const backdrop = document.getElementById('kg-backdrop');
  const openPanel = (id) => {
    const tpl = document.getElementById(`kg-panel-${id}`);
    if (!tpl) return;
    panelBody.innerHTML = '';
    panelBody.appendChild(tpl.content.cloneNode(true));
    panel.classList.add('kg-open');
    backdrop.classList.add('kg-show');
  };
  const closePanel = () => { panel.classList.remove('kg-open'); backdrop.classList.remove('kg-show'); };
  nodesG.addEventListener('click', (e) => {
    const g = e.target.closest('.kg-node');
    if (g && !g.classList.contains('kg-hidden') && !moved) openPanel(g.dataset.id);
  });
  backdrop.addEventListener('click', closePanel);
  document.getElementById('kg-close').addEventListener('click', closePanel);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

  applyView();
  render();
  return { setLayer: (l) => { state.layer = l; render(); }, setType: (t, on) => { on ? state.types.add(t) : state.types.delete(t); render(); } };
}