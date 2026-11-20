/* ===================== Lens: one paper's line of thought, laid out clearly; tick more papers to see the path between them ===================== */
let lens = null;
function lensWalk(focus, depth){
  const lim = depth === 'all' ? Infinity : depth, cols = new Map([[focus, 0]]);
  [[-1, 'up'], [1, 'down']].forEach(([dir, key]) => {
    let frontier = [focus], d = 0; const seen = new Set([focus]);
    while(frontier.length && d < lim){ d++; const next = [];
      frontier.forEach(x => (IDX[key][x] || []).forEach(([o, ty]) => { if(ty === 'r' || seen.has(o) || !lib.entries[o]) return; seen.add(o); if(!cols.has(o)) cols.set(o, dir * d); next.push(o); }));
      frontier = next; }
  });
  const rel = [...new Set((IDX.up[focus] || []).concat(IDX.down[focus] || []).filter(x => x[1] === 'r').map(x => x[0]))].filter(o => !cols.has(o) && lib.entries[o]);
  return {cols, rel};
}
function lensPath(ids){
  /* the shortest chains of lines (any kind) joining the ticked papers, one after another */
  const adj = {}; lib.links.forEach(([a, b]) => { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); });
  const out = new Set(ids);
  for(let i = 1; i < ids.length; i++){
    const s = ids[i - 1], g = ids[i], prev = {[s]: null}, q = [s];
    while(q.length && !(g in prev)){ const x = q.shift(); (adj[x] || []).forEach(y => { if(!(y in prev)){ prev[y] = x; q.push(y); } }); }
    if(g in prev){ let x = g; while(x){ out.add(x); x = prev[x]; } }
  }
  return out;
}
function lensSVG(){
  const L = lens, f = L.focus, metro = L.metro;
  const CW = metro ? 150 : 214, CH = 46, GX = metro ? 70 : 52, GY = metro ? 44 : 22, PAD = metro ? 90 : 30;
  let pos = {}, nodes = [];
  if(L.picks.length){
    const ids = [...lensPath([f].concat(L.picks))].filter(id => lib.entries[id] && typeof lib.entries[id].y === 'number');
    const years = [...new Set(ids.map(id => lib.entries[id].y))].sort((a, b) => a - b);
    const stack = {};
    ids.sort((a, b) => lib.entries[a].y - lib.entries[b].y).forEach(id => { const c = years.indexOf(lib.entries[id].y), r = stack[c] = (stack[c] || 0) + 1; pos[id] = {c, r: r - 1}; });
    nodes = ids;
  }else{
    const W = lensWalk(f, L.depth);
    const byCol = {}; W.cols.forEach((c, id) => { (byCol[c] = byCol[c] || []).push(id); });
    const minC = Math.min(...Object.keys(byCol).map(Number));
    Object.entries(byCol).forEach(([c, ids]) => ids.sort((a, b) => (lib.entries[a].y || 0) - (lib.entries[b].y || 0) || String(lib.entries[a].t).localeCompare(lib.entries[b].t)).forEach((id, i) => { pos[id] = {c: +c - minC, r: i}; }));
    const fc = pos[f].c; W.rel.forEach((id, i) => { pos[id] = {c: fc, r: 0, rel: i + 1}; });
    nodes = [...W.cols.keys()].concat(W.rel);
  }
  const maxR = {}; Object.values(pos).forEach(p => { if(!p.rel) maxR[p.c] = Math.max(maxR[p.c] || 0, p.r + 1); });
  const tallest = Math.max(1, ...Object.values(maxR));
  const relCount = Object.values(pos).filter(p => p.rel).length;
  const XY = id => { const p = pos[id], colH = (maxR[p.c] || 1) * (CH + GY); const top = PAD + ((tallest * (CH + GY)) - colH) / 2;
    if(p.rel) return {x: PAD + p.c * (CW + GX) + (p.rel - 1) * 0, y: PAD + tallest * (CH + GY) + 28 + (p.rel - 1) * (CH + GY)};
    return {x: PAD + p.c * (CW + GX), y: top + p.r * (CH + GY)}; };
  const cols = Math.max(1, ...Object.values(pos).map(p => p.c + 1));
  const Wd = PAD * 2 + cols * CW + (cols - 1) * GX, Hd = PAD * 2 + tallest * (CH + GY) + (relCount ? 28 + relCount * (CH + GY) : 0);
  const set = new Set(nodes);
  let s = '<svg id="lensSvg" class="lens-svg' + (metro ? ' metro' : '') + '" viewBox="0 0 ' + Wd + ' ' + Hd + '" width="' + Wd + '" height="' + Hd + '">';
  lib.links.forEach(([a, b, ty]) => {
    if(!set.has(a) || !set.has(b)) return;
    const A = XY(a), B = XY(b), br = (lib.branches || []).find(x => x.id === (lib.lineBranch || {})[a + '|' + b + '|' + ty]);
    const lr = A.x <= B.x, p = {x: lr ? A.x + (metro ? 0 : CW) : A.x, y: A.y + CH / 2}, q = {x: lr ? B.x : B.x + (metro ? 0 : CW), y: B.y + CH / 2};
    if(metro){ p.x = A.x + 9; q.x = B.x + 9; }
    let d;
    if(metro){ const dx = q.x - p.x, dy = q.y - p.y, k = Math.min(Math.abs(dy), Math.abs(dx) / 2) * Math.sign(dx || 1), m1 = p.x + (dx - k) / 2; d = 'M' + p.x + ' ' + p.y + ' H' + m1.toFixed(1) + ' L' + (m1 + k).toFixed(1) + ' ' + q.y + ' H' + q.x; }
    else { const mx = (p.x + q.x) / 2; d = 'M' + p.x.toFixed(1) + ' ' + p.y + ' C' + mx.toFixed(1) + ' ' + p.y + ' ' + mx.toFixed(1) + ' ' + q.y + ' ' + q.x.toFixed(1) + ' ' + q.y; }
    s += '<path class="lens-line ' + ty + '"' + (br ? ' style="stroke:' + br.color + '"' : '') + ' d="' + d + '"></path>';
    if(ty !== 'r' && !metro){ const ar = edgeArrow(p, q, true, true); if(ar) s += '<path class="lens-arr"' + (br ? ' style="stroke:' + br.color + '"' : '') + ' d="' + ar + '"></path>'; }
  });
  nodes.forEach(id => {
    const e = lib.entries[id], P = XY(id), st = stOf(e), me = id === f, picked = L.picks.includes(id);
    const title = (e.t || '').length > (metro ? 24 : 30) ? e.t.slice(0, metro ? 22 : 28).replace(/[\s,.:;–-]+$/, '') + '…' : e.t;
    if(metro){
      s += '<g class="lens-node' + (me ? ' me' : '') + (picked ? ' picked' : '') + '" data-lens="' + id + '"><circle class="ln-station st-' + (st || 'none') + '" cx="' + (P.x + 9) + '" cy="' + (P.y + CH / 2) + '" r="' + (me ? 9 : 7) + '"></circle><text class="ln-t" text-anchor="middle" x="' + (P.x + 9) + '" y="' + (P.y + CH / 2 + 26) + '">' + esc(title) + '</text><text class="ln-a" text-anchor="middle" x="' + (P.x + 9) + '" y="' + (P.y + CH / 2 + 40) + '">' + esc([e.y, shortAu(e.au)].filter(Boolean).join(' · ')) + '</text></g>';
    }else{
      s += '<g class="lens-node' + (me ? ' me' : '') + (picked ? ' picked' : '') + (pos[id].rel ? ' rel' : '') + '" data-lens="' + id + '"><rect class="ln-card" x="' + P.x + '" y="' + P.y + '" width="' + CW + '" height="' + CH + '" rx="11"></rect><rect class="ln-bar st-' + (st || 'none') + '" x="' + P.x + '" y="' + P.y + '" width="4" height="' + CH + '" rx="2"></rect><text class="ln-t" x="' + (P.x + 14) + '" y="' + (P.y + 19) + '">' + esc(title) + '</text><text class="ln-a" x="' + (P.x + 14) + '" y="' + (P.y + 35) + '">' + esc([e.y, shortAu(e.au)].filter(Boolean).join(' · ')) + '</text></g>';
    }
  });
  if(relCount && !metro) s += '<text class="ln-k" x="' + PAD + '" y="' + (PAD + tallest * (CH + GY) + 16) + '">Related to</text>';
  return s + '</svg>';
}
function renderLens(){
  if(!lens) return;
  const e = lib.entries[lens.focus]; if(!e){ closeLens(); return; }
  const r = lens.root, chip = (k, lab, on) => '<button type="button" class="dchip small' + (on ? ' on' : '') + '" data-lens-depth="' + k + '">' + lab + '</button>';
  r.querySelector('.lens-title').textContent = e.t;
  r.querySelector('.lens-ctl').innerHTML = '<span class="rel-k">How far</span>' + [[1, '1 step'], [2, '2 steps'], [3, '3 steps'], ['all', 'Whole line']].map(o => chip(o[0], o[1], String(lens.depth) === String(o[0]) && !lens.picks.length)).join('') +
    '<span class="dsep"></span><button type="button" class="dchip small' + (lens.pathMode ? ' on' : '') + '" data-lens-path="1" title="Click papers to see how they connect">Path…</button>' +
    '<button type="button" class="dchip small' + (lens.metro ? ' on' : '') + '" data-lens-metro="1" title="Draw it like a metro map">Metro</button>' +
    (lens.picks.length ? '<span class="lens-picks">' + lens.picks.map(id => '<button type="button" class="relchip" data-lens-unpick="' + id + '">' + esc(mapTitle(lib.entries[id])) + ' ×</button>').join('') + '</span>' : '') +
    '<span class="hint lens-hint">' + (lens.pathMode ? 'Click papers to add them to the path' : 'Click a paper to centre on it · Shift-click to add it to a path') + '</span>';
  r.querySelector('.lens-body').innerHTML = lensSVG();
}
function openLens(id){
  const e = lib.entries[id]; if(!e || e.kind !== 'paper') return;
  closeFloatMenu(); closeBigCard(true);
  if(!lens){
    const root = document.createElement('div'); root.className = 'lens-root'; root.id = 'lensView'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.innerHTML = '<div class="lens-bar"><button type="button" class="bc-x" data-lens-close="1" aria-label="Close Lens">✕</button><div class="lens-head"><span class="rel-k">Lens</span><span class="lens-title"></span></div><button type="button" class="linkbtn" data-lens-card="1">Open card</button></div><div class="lens-ctl"></div><div class="lens-body"></div>';
    document.body.appendChild(root);
    lens = {root, focus: id, depth: ui.depth || 'all', picks: [], pathMode: false, metro: false};
    root.addEventListener('click', ev => {
      if(ev.target.closest('[data-lens-close]')) return closeLens();
      if(ev.target.closest('[data-lens-card]')){ const f = lens.focus; closeLens(); select(f, true); setTimeout(() => { const c = document.querySelector('#info .pc-small'); if(c) openBigCard(f, c); }, 80); return; }
      const d = ev.target.closest('[data-lens-depth]'); if(d){ lens.depth = d.dataset.lensDepth === 'all' ? 'all' : +d.dataset.lensDepth; lens.picks = []; lens.pathMode = false; return renderLens(); }
      if(ev.target.closest('[data-lens-path]')){ lens.pathMode = !lens.pathMode; return renderLens(); }
      if(ev.target.closest('[data-lens-metro]')){ lens.metro = !lens.metro; return renderLens(); }
      const up = ev.target.closest('[data-lens-unpick]'); if(up){ lens.picks = lens.picks.filter(x => x !== up.dataset.lensUnpick); return renderLens(); }
      const n = ev.target.closest('[data-lens]'); if(n){ const nid = n.dataset.lens;
        if(lens.pathMode || ev.shiftKey){ if(nid !== lens.focus){ lens.picks = lens.picks.includes(nid) ? lens.picks.filter(x => x !== nid) : lens.picks.concat(nid); } return renderLens(); }
        if(nid !== lens.focus){ lens.focus = nid; lens.picks = []; renderLens(); } }
    });
  }else{ lens.focus = id; lens.picks = []; }
  renderLens();
  requestAnimationFrame(() => lens && lens.root.classList.add('on'));
}
function closeLens(){ if(!lens) return; const r = lens.root; lens = null; r.classList.remove('on'); setTimeout(() => r.remove(), 160); }
document.addEventListener('keydown', ev => {
  if(ev.key === 'Escape' && lens && !document.getElementById('floatMenu') && modal.root.hidden){ closeLens(); ev.stopPropagation(); return; }
  if((ev.key === 'l' || ev.key === 'L') && !ev.metaKey && !ev.ctrlKey && !ev.altKey && ui.selected && !lens && !bigCard && modal.root.hidden && !(ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable="true"]'))){ openLens(ui.selected); ev.preventDefault(); }
}, true);
