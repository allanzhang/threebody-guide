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
    if (focusNode) positionCardAtNode(focusNode); // 平移/缩放后卡片跟随节点
  };
  const visible = (id) => {
    const n = data.nodeById[id];
    const anchor = n.type === 'book' || n.type === 'era';
    return anchor || (state.types.has(n.type) && (state.layer === 'full' || data.skeleton.includes(id)));
  };
  const render = () => {
    for (const [id, g] of nodeEls) g.classList.toggle('kg-hidden', !visible(id));
    for (const p of edgeEls) {
      p.classList.toggle('kg-hidden', !visible(p.dataset.a) || !visible(p.dataset.b));
    }
    if (focusNode && !visible(focusNode)) unfocus(); // 锁定节点被筛选隐藏时同步清除
  };

  // 悬停悬浮卡 + 锁定高亮：悬停节点即锁定状态（高亮 + 卡常驻，可从容移向卡片点击），
  // 直到悬停另一节点（切换）或点击空白处（清除）才改变
  const card = document.getElementById('kg-hovercard');
  let focusNode = null;
  // 卡片位置锚定节点（世界坐标 → 屏幕），不跟随鼠标——锁定后鼠标可移开去点击
  const positionCardAtNode = (id) => {
    const n = data.nodeById[id];
    const f = fit();
    const r = root.getBoundingClientRect();
    const sr = svg.getBoundingClientRect();
    const x = (n.x * state.k + state.x) * f.s + f.ox + (sr.left - r.left);
    const y = (n.y * state.k + state.y) * f.s + f.oy + (sr.top - r.top);
    const left = clamp(x + 20, 8, r.width - card.offsetWidth - 8);
    const top = clamp(y - card.offsetHeight / 2, 8, r.height - card.offsetHeight - 8);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  };
  const showCard = (id) => {
    const tpl = document.getElementById(`kg-card-${id}`);
    if (!tpl) return;
    card.innerHTML = '';
    card.appendChild(tpl.content.cloneNode(true));
    card.hidden = false;
    positionCardAtNode(id);
  };
  const focus = (id) => {
    if (focusNode === id) return; // 已锁定该节点，状态保持
    focusNode = id;
    clearHot();
    const nb = neighbors(id);
    nodeEls.get(id).classList.add('kg-hot');
    nodeEls.forEach((ng, nid) => { if (nid !== id && !nb.has(nid)) ng.classList.add('kg-dim'); });
    edgeEls.forEach((p) => { if (p.dataset.a === id || p.dataset.b === id) p.classList.add('kg-hot'); });
    showCard(id);
  };
  const unfocus = () => {
    if (focusNode === null) return;
    focusNode = null;
    clearHot();
    card.hidden = true;
  };

  // 平移 / 缩放（Pointer Events 统一鼠标触屏）
  const pointers = new Map();
  let dragId = null, moved = false, pinchDist = 0;
  svg.addEventListener('pointerdown', (e) => {
    // 先记录是否首指针再写入 map——写后判断 has(pointerId) 恒真，会吞掉 dragId 赋值（拖拽失灵的真凶）
    const firstPointer = pointers.size === 0;
    if (!e.target.closest('.kg-node')) unfocus(); // 点击空白处清除锁定状态
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (e.button === 0 && firstPointer) dragId = e.pointerId;
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
    const f = fit();
    // 滚动 = 缩放（双指滚动即缩放）；Shift+滚动 = 平移（显式通道）——
    // macOS 双指滚动与三指拖移在浏览器层同属 wheel 事件、无法互相区分，故三指平移以 Shift+滚动或左键拖拽实现
    if (e.shiftKey) {
      state.x += e.deltaX / f.s;
      state.y += e.deltaY / f.s;
      applyView();
      return;
    }
    const rect = svg.getBoundingClientRect();
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
    focus(g.dataset.id);
  });
  // 移出节点不解除状态（锁定高亮），切到另一节点或点击空白处时才变化

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
  backdrop.addEventListener('click', () => { closePanel(); unfocus(); });
  document.getElementById('kg-close').addEventListener('click', closePanel);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

  applyView();
  render();
  return { setLayer: (l) => { state.layer = l; render(); }, setType: (t, on) => { on ? state.types.add(t) : state.types.delete(t); render(); } };
}