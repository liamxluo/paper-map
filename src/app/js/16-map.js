/* ===================== map ===================== */
const mapSvg = document.getElementById('net');
const mapScroll = document.getElementById('mapScroll');
const mapLabels = document.getElementById('mapLabels');
const infoEl = document.getElementById('info');
const axisSvg = document.getElementById('netAxis'), mapBox = document.getElementById('mapBox');
let lastMapW = 0;
const MAP = {P:{}, x:null, W:0, H:0, left:0, inner:0, axisY:0, full:[1700, 2030]};

function lanesShown(){
  const all = [];
  lib.topics.forEach(tp => treeSubs(tp).forEach(s => all.push({sub:s, topic:tp})));
  if(!Array.isArray(settings.lanes)) return all;
  const set = new Set(settings.lanes);
  return all.filter(x => set.has(x.sub.id));
}
/* A dot is split into one slice per colouring tag (up to three), clockwise from the top */
function pieSlices(cx, cy, r, colors){
  const n = colors.length;
  let s = '';
  for(let i = 0; i < n; i++){
    const a0 = -Math.PI / 2 + i * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n;
    s += '<path class="half" d="M' + cx.toFixed(1) + ' ' + (+cy).toFixed(1) + ' L' + (cx + r * Math.cos(a0)).toFixed(2) + ' ' + (cy + r * Math.sin(a0)).toFixed(2) +
      ' A' + r.toFixed(2) + ' ' + r.toFixed(2) + ' 0 0 1 ' + (cx + r * Math.cos(a1)).toFixed(2) + ' ' + (cy + r * Math.sin(a1)).toFixed(2) + ' Z" style="fill:' + colors[i] + '"></path>';
  }
  return s;
}
function renderTagLegend(show){
  const el = document.getElementById('srcLegend');
  el.hidden = !show;
  if(!show) return;
  const mt = lib.tags.filter(x => x.map !== false);
  const cs = mt.slice(0, 3).map(tagColor);
  el.innerHTML = mt.map(x => '<span><i class="sw" style="background:' + tagColor(x) + '"></i>' + esc(x.name) + '</span>').join('') +
    (cs.length > 1 ? '<span><i class="sw" style="background:conic-gradient(' + cs.map((c, i) => c + ' ' + (i * 100 / cs.length).toFixed(1) + '% ' + ((i + 1) * 100 / cs.length).toFixed(1) + '%').join(',') + ')"></i>Several tags: split dot</span>' : '') +
    '<span><i class="sw none"></i>No tags</span>' +
    '<button type="button" class="linkbtn" data-act="tags">Modify tags &amp; colours</button>';
}
/* a dot's size says how many papers build on it: none is small, and each one makes it bigger, by less as they add up */
function builtOnBy(id){ return (IDX.down[id] || []).filter(x => x[1] === 'b').length; }
/* the names that always show: in each row the two papers most built on (if at least two papers build on them),
   and anywhere a paper that seven or more build on; every other name shows when you point at or select a paper */
function labelKeepSet(items, laneIndex){
  /* three names in every row: the papers most built on first, then those with the most lines */
  const keep = new Set(), byLane = {};
  const lines = id => ((IDX.up[id] || []).length + (IDX.down[id] || []).length);
  items.forEach(e => { if(e.kind !== 'paper') return; (byLane[laneOf(e)] = byLane[laneOf(e)] || []).push(e); });
  /* at most two names a row, and only for papers that matter on the map: built on by others, or with two lines or more */
  Object.values(byLane).forEach(arr => arr.filter(e => builtOnBy(e.id) >= 1 || lines(e.id) >= 2).sort((x, y) => builtOnBy(y.id) - builtOnBy(x.id) || lines(y.id) - lines(x.id) || x.y - y.y).slice(0, 2).forEach(e => keep.add(e.id)));
  return keep;
}
/* on the map a paper is known by its title; its authors sit underneath, smaller and grey */
function mapTitle(e){ const t = String(e.short || e.t || '').trim(); return t.length > 38 ? t.slice(0, 36).replace(/[\s,.:;–-]+$/, '') + '…' : t; }
function mapAuthors(e){ return [shortAu(e.au), e.y].filter(Boolean).join(' · '); }
function dotTier(e){ const n = builtOnBy(e.id); return n >= 3 ? 3 : n >= 1 ? 2 : 1; }
/* a book on the map: a small closed book in place of the round dot, styled like one (read, want to read) */
function bookMark(x, y, r, fill){ const w = r * 1.5, h = r * 2.05, x0 = x - w / 2, y0 = y - h / 2, f = v => v.toFixed(1);
  return '<path class="dot book" d="M' + f(x0) + ' ' + f(y0) + 'H' + f(x0 + w) + 'V' + f(y0 + h) + 'H' + f(x0) + 'Z"' + fill + '></path><path class="spine" d="M' + f(x0 + w * 0.26) + ' ' + f(y0 + 0.7) + 'V' + f(y0 + h - 0.7) + '"></path>'; }
function dotR(e, narrow){ const base = Math.min(8.6, 3.4 + 1.7 * Math.log2(1 + builtOnBy(e.id))); return Math.max(base, stOf(e) ? 4.4 : 0) * (narrow ? 0.9 : 1); }
function niceStep(span, maxTicks){
  const raw = span / Math.max(1, maxTicks);
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
  for(const s of steps){ if(s >= raw) return s; }
  return 1000;
}
function linearScale(left, inner, a, b){
  const f = y => left + (y - a) / (b - a) * inner;
  f.inv = x => a + (x - left) / inner * (b - a);
  f.domain = [a, b];
  const step = niceStep(b - a, inner / 70);
  f.ticks = [];
  for(let t = Math.ceil(a / step) * step; t <= b; t += step) f.ticks.push(t);
  return f;
}
function buildScale(left, inner, years){
  const yMin = years.length ? Math.min.apply(null, years) : 1950;
  const yMax = years.length ? Math.max.apply(null, years) : 2020;
  const r = settings.range;
  /* Short span: even axis */
  if(yMax - yMin <= 120){
    const a = Math.floor(yMin - 3), b = Math.ceil(yMax + 3);
    MAP.full = [a, b];
    if(r && r[1] - r[0] >= 1) return linearScale(left, inner, r[0], r[1]);
    return linearScale(left, inner, a, b);
  }
  /* Long span: width follows smoothed paper density blended with even time, so busy decades get more room */
  const a = Math.floor(yMin - 6), b = Math.ceil(yMax + 4);
  MAP.full = [a, b];
  if(r && r[1] - r[0] >= 1) return linearScale(left, inner, r[0], r[1]);
  const n = b - a + 1, bw = 6, lam = 0.72;
  const dens = new Float64Array(n);
  years.forEach(y => {
    const i0 = Math.max(0, Math.floor(y - a - 4 * bw)), i1 = Math.min(n - 1, Math.ceil(y - a + 4 * bw));
    for(let i = i0; i <= i1; i++){ const d = (a + i - y) / bw; dens[i] += Math.exp(-0.5 * d * d); }
  });
  let sum = 0; for(let i = 0; i < n; i++) sum += dens[i];
  const cum = new Float64Array(n);
  let acc = 0;
  for(let i = 0; i < n; i++){ cum[i] = acc; acc += (1 - lam) / n + lam * (sum ? dens[i] / sum : 1 / n); }
  const tot = cum[n - 1] || 1;
  const f = y => { const u = Math.max(0, Math.min(n - 1, y - a)); const i = Math.floor(u), fr = u - i; const v = i + 1 < n ? cum[i] + (cum[i + 1] - cum[i]) * fr : cum[n - 1]; return left + inner * v / tot; };
  f.inv = x => {
    const v = Math.max(0, Math.min(tot, (x - left) / inner * tot));
    let lo = 0, hi = n - 1;
    while(hi - lo > 1){ const mid = (lo + hi) >> 1; if(cum[mid] <= v) lo = mid; else hi = mid; }
    const seg = cum[hi] - cum[lo];
    return a + lo + (seg > 0 ? Math.min(1, (v - cum[lo]) / seg) : 0);
  };
  f.domain = [a, b];
  f.compressed = true;
  const cands = [];
  [100, 50, 20, 10].forEach(step => { for(let y = Math.ceil(a / step) * step; y <= b; y += step) cands.push(y); });
  const kept = [];
  cands.forEach(y => { const px = f(y); if(px >= left - 1 && px <= left + inner + 1 && !kept.some(k => Math.abs(f(k) - px) < 64)) kept.push(y); });
  f.ticks = kept.sort((p, q) => p - q);
  return f;
}
/* an arrowhead ON the line, a little past its middle (clear of any note, which sits at the middle),
   so lines meeting at one dot don't pile their arrows up there.
   'flow': it points along the line towards the later paper; 'cite': back towards the paper being built on. */
function edgeArrow(p, q, flow, plain){
  const same = !plain && Math.abs(p.y - q.y) < 1, mx = (p.x + q.x) / 2;
  if(Math.hypot(q.x - p.x, q.y - p.y) < 30) return '';
  const tt = flow ? 0.62 : 0.38, s = 1 - tt;
  let x, y, dx, dy;
  if(same){
    const h = Math.min(20, 6 + Math.abs(q.x - p.x) * 0.08), c = {x: mx, y: p.y - h};
    x = s * s * p.x + 2 * s * tt * c.x + tt * tt * q.x; y = s * s * p.y + 2 * s * tt * c.y + tt * tt * q.y;
    dx = 2 * s * (c.x - p.x) + 2 * tt * (q.x - c.x); dy = 2 * s * (c.y - p.y) + 2 * tt * (q.y - c.y);
  }else{
    const c1 = {x: mx, y: p.y}, c2 = {x: mx, y: q.y};
    x = s * s * s * p.x + 3 * s * s * tt * c1.x + 3 * s * tt * tt * c2.x + tt * tt * tt * q.x;
    y = s * s * s * p.y + 3 * s * s * tt * c1.y + 3 * s * tt * tt * c2.y + tt * tt * tt * q.y;
    dx = 3 * s * s * (c1.x - p.x) + 6 * s * tt * (c2.x - c1.x) + 3 * tt * tt * (q.x - c2.x);
    dy = 3 * s * s * (c1.y - p.y) + 6 * s * tt * (c2.y - c1.y) + 3 * tt * tt * (q.y - c2.y);
  }
  let L = Math.hypot(dx, dy) || 1; let ux = dx / L, uy = dy / L;
  if(!flow){ ux = -ux; uy = -uy; }
  const tipx = x + ux * 3.2, tipy = y + uy * 3.2, bx = x - ux * 3.2, by = y - uy * 3.2, wide = 3.6;
  return 'M' + (bx - uy * wide).toFixed(1) + ' ' + (by + ux * wide).toFixed(1) + ' L' + tipx.toFixed(1) + ' ' + tipy.toFixed(1) + ' L' + (bx + uy * wide).toFixed(1) + ' ' + (by - ux * wide).toFixed(1);
}
function edgePath(p, q){
  if(Math.abs(p.y - q.y) < 1){
    const h = Math.min(20, 6 + Math.abs(q.x - p.x) * 0.08);
    const mx = (p.x + q.x) / 2;
    return 'M' + p.x.toFixed(1) + ' ' + p.y + ' Q' + mx.toFixed(1) + ' ' + (p.y - h).toFixed(1) + ' ' + q.x.toFixed(1) + ' ' + q.y;
  }
  const mx = (p.x + q.x) / 2;
  return 'M' + p.x.toFixed(1) + ' ' + p.y + ' C' + mx.toFixed(1) + ' ' + p.y + ' ' + mx.toFixed(1) + ' ' + q.y + ' ' + q.x.toFixed(1) + ' ' + q.y;
}
/* Related topics: a small ⇄ after the row's name; the rows related to the one you are in, or hovering, light up */
function tlIdOf(ln){ return ln.sub.hidden ? ln.topic.id : ln.sub.id; }
function tlBranch(l){ const bid = (lib.tlinkColor || {})[l[0] + '|' + l[1]]; return (bid && (lib.branches || []).find(b => b.id === bid)) || null; }
function tlColours(rels){ return [...new Set(rels.map(r => r.color || 'var(--focus)'))]; }
function tlStyle(cols, v){
  if(cols.length === 1) return v + ':' + cols[0];
  const n = cols.length;
  return v + 'g:linear-gradient(to bottom,' + cols.map((c, i) => c + ' ' + (i * 100 / n).toFixed(2) + '% ' + ((i + 1) * 100 / n).toFixed(2) + '%').join(',') + ')';
}
function tlRelsOf(id){ return (lib.tlinks || []).filter(l => (l[0] === id || l[1] === id) && !brHidden((lib.tlinkColor || {})[l[0] + '|' + l[1]])).map(l => { const br = tlBranch(l); return {o: l[0] === id ? l[1] : l[0], bid: br ? br.id : '', color: br ? br.color : '', name: br ? br.name : ''}; }); }
function rekeyTl(oldId, newId){
  const m = lib.tlinkColor || {};
  Object.keys(m).forEach(k => { const [a, b] = k.split('|'); if(a === oldId || b === oldId){ const nk = (a === oldId ? newId : a) + '|' + (b === oldId ? newId : b); m[nk] = m[k]; delete m[k]; } });
}
function tlOf(ln){ const id = tlIdOf(ln); return (lib.tlinks || []).filter(l => l[0] === id || l[1] === id).map(l => l[0] === id ? l[1] : l[0]); }
function topicLinkArcs(){ return ''; }
document.addEventListener('toggle', ev => { const d = ev.target; if(!d || !d.matches) return; if(d.matches('[data-rel-fold]')){ settings.relOpen = d.open; persistSettings({remote:false}); } else if(d.matches('[data-hf-fold]')){ settings.hfFoldOpen = d.open; persistSettings({remote:false}); } }, true);
function clearTlHover(){ mapLabels.querySelectorAll('.tl-hover').forEach(x => { x.classList.remove('tl-hover', 'tl-hover-multi'); x.style.removeProperty('--tlh'); x.style.removeProperty('--tlhg'); }); }
mapLabels.addEventListener('mouseover', ev => {
  clearTlHover();
  const b = ev.target.closest('button[data-tl-id]'); if(!b || !b.dataset.tlRel) return;
  const badge = ev.target.closest('.tl-badge'), only = badge ? badge.dataset.tlGroup : null;
  const rels = b.dataset.tlRel.split(' ').map(s => s.split('~')).filter(p => only === null || p[1] === only);
  if(!rels.length) return;
  const col = {}; rels.forEach(p => { col[p[0]] = p[2] || 'var(--focus)'; });
  const selfCols = [...new Set(rels.map(p => p[2] || 'var(--focus)'))];
  const paint = (x, cols) => {
    x.classList.add('tl-hover');
    if(cols.length > 1){ x.classList.add('tl-hover-multi'); const m = tlStyle(cols, '--tlh').split(':'); x.style.setProperty(m[0], m.slice(1).join(':')); }
    else x.style.setProperty('--tlh', cols[0]);
  };
  mapLabels.querySelectorAll('button[data-tl-id]').forEach(x => {
    if(x === b) paint(x, selfCols);
    else if(col[x.dataset.tlId]) paint(x, [col[x.dataset.tlId]]);
  });
});
mapLabels.addEventListener('mouseleave', clearTlHover);
/* the year axis follows the plot when it is swiped sideways */
mapScroll.addEventListener('scroll', () => { const ax = document.getElementById('netAxis'); if(ax) ax.style.transform = mapScroll.scrollLeft ? 'translateX(' + (-mapScroll.scrollLeft) + 'px)' : ''; }, {passive: true});
function renderMapLabels(lanes, laneH){
  const onMap = new Set(lanes.map(l => l.sub.id));
  let maxD = 0;
  lanes.forEach(ln => { const n = subAncestors(ln.sub).filter(a => onMap.has(a.id)).length; if(n > maxD) maxD = n; });
  const arcsSvg = topicLinkArcs(lanes, laneH);
  document.documentElement.style.setProperty('--lab-extra', ((maxD ? Math.min(90, 14 + maxD * 14) : 0) + (arcsSvg ? 12 : 0)) + 'px');
  /* the row you are in, and every row related to it, light up together (in the link's colour) */
  const litTl = {};
  const here = ui.page !== 'concepts' && !ui.branch ? (ui.sub || ui.topic) : null;
  if(ui.branch && !brHidden(ui.branch)){ const br = lib.branches.find(x => x.id === ui.branch); if(br) branchTlinks(br.id).forEach(l => { litTl[l[0]] = [br.color]; litTl[l[1]] = [br.color]; }); }
  if(here){ const hr = tlRelsOf(here); if(hr.length){ litTl[here] = tlColours(hr); hr.forEach(r => { litTl[r.o] = [r.color || 'var(--focus)']; }); } }
  mapLabels.innerHTML = lanes.map((ln, i) => {
    if(ln.concepts) return '<button type="button" class="' + (i % 2 === 0 ? 'band' : '') + ' lane-concepts' + (ui.page === 'concepts' ? ' on' : '') + '" data-view="__concepts" style="--d:0" title="Open the Concepts page"><span class="lab-in"><span class="full"><span class="nm"><i class="sq" aria-hidden="true"></i>Concepts</span></span><span class="short">Ideas</span></span></button>';
    const anc = subAncestors(ln.sub);
    let last = -1; anc.forEach((a, k) => { if(onMap.has(a.id)) last = k; });
    const headed = !ln.sub.hidden && lanes.some(l => l.topic.id === ln.topic.id && l.sub.hidden);
    const dd = anc.filter(a => onMap.has(a.id)).length + (headed ? 1 : 0);
    const own = ln.sub.hidden && lanes.some(l => l.topic.id === ln.topic.id && !l.sub.hidden);
    const pre = anc.slice(last + 1).map(a => a.name);
    const name = ln.sub.hidden ? ln.topic.name : ln.sub.name;
    const full = ln.sub.hidden ? ln.topic.name : [ln.topic.name].concat(anc.map(a => a.name), [ln.sub.name]).join(' › ');
    const showTopic = !ln.sub.hidden && (i === 0 || lanes[i - 1].topic.id !== ln.topic.id || lanes[i - 1].concepts);
    const ctx = (showTopic ? [ln.topic.name] : []).concat(pre).join(' › ') + (pre.length ? ' ›' : '');
    const tid = tlIdOf(ln), rels = tlRelsOf(tid);
    const groups = []; rels.forEach(r => { let g = groups.find(x => x.bid === r.bid); if(!g){ g = {bid: r.bid, color: r.color, name: r.name, os: []}; groups.push(g); } g.os.push(r.o); });
    const lit = litTl[tid];
    const badges = groups.length ? '<span class="tl-badges">' + groups.map(g => '<span class="tl-badge" data-tl-group="' + g.bid + '"' + (g.color ? ' style="--tlc:' + g.color + '"' : '') + ' title="' + esc((g.name ? g.name + ': ' : 'Related to ') + g.os.map(topicNodeName).join(', ')) + '">⇄</span>').join('') + '</span>' : '';
    return '<button type="button" class="' + (i % 2 === 0 ? 'band' : '') + (own ? ' own' : '') + (dd ? ' nest' : '') + (ln.sub.id === ui.sub && ui.page !== 'concepts' ? ' on' : '') + (lit ? ' tl-rel' + (lit.length > 1 ? ' tl-multi' : '') : '') + '" data-view="' + ln.sub.id + '" data-tl-id="' + tid + '" data-tl-rel="' + esc(rels.map(r => r.o + '~' + r.bid + '~' + r.color).join(' ')) + '" style="--d:' + dd + ';--nb:' + groups.length + (lit ? ';' + tlStyle(lit, '--tlc') : '') + '" title="Open “' + esc(full) + '”' + (rels.length ? ' · related to ' + esc(rels.map(r => topicNodeName(r.o)).join(', ')) : '') + '"><span class="lab-in"><span class="full">' + (ctx ? '<span class="lt">' + esc(ctx) + '</span>' : '') + '<span class="nm">' + '' + esc(name) + '</span></span>' + badges + '<span class="short">' + esc(name.slice(0, 4)) + '</span></span></button>';
  }).join('');
  mapLabels.classList.toggle('has-tl', !!arcsSvg);
  if(arcsSvg) mapLabels.insertAdjacentHTML('beforeend', arcsSvg);
  /* widen the label column until no single word is cut */
  const root = document.documentElement;
  let extra = parseFloat(getComputedStyle(root).getPropertyValue('--lab-extra')) || 0;
  for(let pass = 0; pass < 3; pass++){
    let need = 0;
    mapLabels.querySelectorAll('.nm').forEach(nm => { const o = nm.scrollWidth - nm.clientWidth; if(o > need) need = o; });
    const cap = window.matchMedia && matchMedia('(max-width: 640px)').matches ? 36 : 170;
    if(need <= 1 || extra >= cap) break;
    extra = Math.min(cap, extra + Math.ceil(need) + 4);
    root.style.setProperty('--lab-extra', extra + 'px');
  }
}
function renderMap(force){
  const avail = Math.floor(mapScroll.clientWidth);
  if(!force && avail === lastMapW) return;
  lastMapW = avail;
  const narrow = window.innerWidth <= 760;
  const filled = {};
  Object.values(lib.entries).forEach(e => { if((e.kind === 'concept' || (e.kind === 'paper' && !e.parent)) && typeof e.y === 'number') filled[laneOf(e)] = true; });
  const shownT = new Set(lanesShown().filter(ln => filled[ln.sub.id] && !ln.sub.hidden).map(ln => ln.topic.id));
  /* a topic's own row heads its subtopics, so it stays on the map (even with nothing in it yet) while any of them is shown */
  const lanes = lanesShown().filter(ln => filled[ln.sub.id] || (ln.sub.hidden && shownT.has(ln.topic.id)));
  if(settings.showConcepts !== false && filled.__concepts) lanes.unshift(CONCEPT_LANE);
  const laneH = narrow ? 38 : 46;
  const root = document.documentElement;
  root.style.setProperty('--lane-h', laneH + 'px');
  root.style.setProperty('--map-top', '8px');
  renderMapLabels(lanes, laneH);
  document.getElementById('btnLanes').textContent = 'Topics on the map (' + lanes.length + ')';
  if(!lanes.length){
    mapSvg.setAttribute('width', 0); mapSvg.setAttribute('height', 0); mapSvg.innerHTML = '';
    axisSvg.setAttribute('width', 0); axisSvg.setAttribute('height', 0); axisSvg.innerHTML = '';
    if(!document.getElementById('mapEmpty')) mapScroll.insertAdjacentHTML('beforeend', '<p class="map-empty" id="mapEmpty">Nothing to show yet: the selected topics have no papers. Use “Topics on the map” to choose others.</p>');
    updateRangeUI();
    return;
  }
  const me = document.getElementById('mapEmpty'); if(me) me.remove();
  const PHONE = window.matchMedia && matchMedia('(max-width: 640px)').matches;
  const W = Math.max(PHONE ? 760 : 280, Math.floor(mapScroll.clientWidth)); lastMapW = Math.floor(mapScroll.clientWidth);
  const top = 8, left = 12, right = 14;
  const laneIndex = {};
  lanes.forEach((ln, i) => { laneIndex[ln.sub.id] = i; });
  const items = Object.values(lib.entries).filter(e => laneIndex[laneOf(e)] != null && (e.kind === 'concept' || (e.kind === 'paper' && !e.parent)) && typeof e.y === 'number');
  const inner = W - left - right;
  const x = buildScale(left, inner, items.map(e => e.y));
  const H = top + lanes.length * laneH + 4;
  const axisY = H + 1000;
  Object.assign(MAP, {x, W, H, left, inner, axisY, laneH, top, lanes});
  const P = {};
  const seen = {};
  items.slice().sort(byYear).forEach(e => {
    const key = laneOf(e) + '-' + e.y;
    const n = seen[key] = (seen[key] || 0) + 1;
    const off = n === 1 ? 0 : (n % 2 === 0 ? (n / 2) * 7 : -((n - 1) / 2) * 7);
    P[e.id] = {x: x(e.y) + off, y: top + laneIndex[laneOf(e)] * laneH + laneH / 2};
  });
  MAP.P = P;
  const ok = {};
  items.forEach(e => { ok[e.id] = matches(e); });

  let s = '<defs><clipPath id="plotClip"><rect x="' + left + '" y="0" width="' + inner + '" height="' + H + '"></rect></clipPath></defs>';
  s += '<rect class="bg" x="0" y="0" width="' + W + '" height="' + H + '" fill="transparent"></rect>';
  lanes.forEach((ln, i) => {
    if(i % 2 === 0) s += '<rect class="band" x="0" y="' + (top + i * laneH) + '" width="' + W + '" height="' + laneH + '"></rect>';
    const newTopic = i > 0 && lanes[i - 1].topic.id !== ln.topic.id;
    if(i > 0) s += '<line class="' + (newTopic ? 'topic-rule' : 'row-rule') + '" x1="0" x2="' + W + '" y1="' + (top + i * laneH) + '" y2="' + (top + i * laneH) + '"></line>';
  });
  { const gy0 = top, gy1 = top + lanes.length * laneH;
    x.ticks.forEach(tk => { const gx = x(tk); if(gx < left - 1 || gx > W - right + 1) return;
      s += '<line class="grid' + (tk % 10 === 0 ? ' major' : '') + '" x1="' + gx.toFixed(1) + '" x2="' + gx.toFixed(1) + '" y1="' + gy0 + '" y2="' + gy1 + '"></line>'; }); }
  /* the year axis is its own strip under the rows, so it stays in view while the rows scroll */
  let ax = '<line class="axis" x1="' + left + '" x2="' + (W - right) + '" y1="4" y2="4"></line>';
  x.ticks.forEach(t => {
    const tx = x(t);
    if(tx < left - 1 || tx > W - right + 1) return;
    ax += '<line class="axis" x1="' + tx.toFixed(1) + '" x2="' + tx.toFixed(1) + '" y1="4" y2="8"></line>';
    ax += '<text class="tick" x="' + tx.toFixed(1) + '" y="21" text-anchor="middle">' + t + '</text>';
  });
  ax += '<rect class="axis-zone" x="' + left + '" y="0" width="' + inner + '" height="30"></rect>';
  axisSvg.setAttribute('viewBox', '0 0 ' + W + ' 30'); axisSvg.setAttribute('width', W); axisSvg.setAttribute('height', 30); axisSvg.innerHTML = ax;
  s += '<rect class="brush" id="brush" x="0" y="' + top + '" width="0" height="' + (H - top) + '"></rect>';
  s += '<g clip-path="url(#plotClip)">';
  let notes = '';
  lib.links.forEach(([a, b, t, note]) => {
    const p = P[a], q = P[b];
    if(!p || !q) return;
    if(t === 'r' && settings.showRelated === false) return;
    if(lineHidden(a, b, t)) return;
    const muted = (!ok[a] || !ok[b]) && t !== 'o' ? ' muted' : '';
    const brId = lib.lineBranch[a + '|' + b + '|' + t], br = brId && lib.branches.find(x => x.id === brId);
    s += '<path class="edge ' + t + muted + (br ? ' br' : '') + '"' + (br ? ' style="--br:' + br.color + '" data-br="' + br.id + '"' : '') + ' data-a="' + a + '" data-b="' + b + '" d="' + edgePath(p, q) + '"></path>';
    if(t === 'b' || t === 'c' || t === 'r') s += '<path class="edge-hit" data-a="' + a + '" data-b="' + b + '" data-t="' + t + '" d="' + edgePath(p, q) + '"><title>Click to change this line</title></path>';
    if(settings.arrows !== 'off' && (t === 'b' || t === 'c')){
      const ad = edgeArrow(p, q, settings.arrows !== 'cite');
      if(ad) s += '<path class="edge arr ' + t + muted + (br ? ' br' : '') + '"' + (br ? ' style="--br:' + br.color + '" data-br="' + br.id + '"' : '') + ' data-a="' + a + '" data-b="' + b + '" d="' + ad + '"></path>';
    }
    if(note){
      const same = Math.abs(p.y - q.y) < 1;
      const nx = (p.x + q.x) / 2, ny = same ? p.y - Math.min(20, 6 + Math.abs(q.x - p.x) * 0.08) / 2 - 4 : (p.y + q.y) / 2 - 3;
      notes += '<text class="edge-note' + muted + '" data-a="' + a + '" data-b="' + b + '" x="' + nx.toFixed(1) + '" y="' + ny.toFixed(1) + '" text-anchor="middle">' + esc(note) + '</text>';
    }
  });
  s += notes;
  items.forEach(e => {
    (e.needs || []).forEach(c => { if(P[c] && P[e.id]) s += '<path class="edge p" data-a="' + c + '" data-b="' + e.id + '" d="' + edgePath(P[c], P[e.id]) + '"></path>'; });
  });
  const useSrc = settings.mapColor !== 'plain';
  items.forEach(e => {
    if(e.kind !== 'paper' || !(e.mentions || []).length) return;
    const p = P[e.id], own = laneIndex[laneOf(e)];
    e.mentions.forEach(m => {
      const li = mentionLane(m, laneIndex); if(li == null || li === own) return;
      const gy = top + li * laneH + laneH / 2;
      s += '<g class="ghost' + (ok[e.id] ? '' : ' muted') + '" data-id="' + e.id + '" data-ghost-of="' + e.id + '"><line class="ghost-line" x1="' + p.x.toFixed(1) + '" y1="' + p.y.toFixed(1) + '" x2="' + p.x.toFixed(1) + '" y2="' + gy.toFixed(1) + '"></line><circle class="ghost-hit" cx="' + p.x.toFixed(1) + '" cy="' + gy.toFixed(1) + '" r="9"></circle><circle class="ghost-ring" cx="' + p.x.toFixed(1) + '" cy="' + gy.toFixed(1) + '" r="6.4"></circle><circle class="ghost-dot" cx="' + p.x.toFixed(1) + '" cy="' + gy.toFixed(1) + '" r="3.8"></circle><title>' + esc(mapLabel(e) + ' mentions ' + mentionName(m)) + '</title></g>';
      s += '<text class="lbl hov ghost-lbl" data-lk="hov" data-id="' + e.id + '" x="' + p.x.toFixed(1) + '" y="' + (gy - 9).toFixed(1) + '" text-anchor="middle">' + esc(mapTitle(e)) + '</text>';
    });
  });
  items.slice().sort((a, b) => (a.kind === 'concept' ? 0 : builtOnBy(a.id)) - (b.kind === 'concept' ? 0 : builtOnBy(b.id))).forEach(e => {
    const p = P[e.id];
    const label = e.kind === 'concept' ? ('Concept: ' + e.t) : ([e.y, shortAu(e.au)].filter(Boolean).join(' ') + ': ' + e.t);
    if(e.kind === 'concept'){
      const d = conceptDone(e);
      const cls = 'node cnode' + (d[1] && d[0] === d[1] ? ' cdone' : '') + (ui.selected === e.id ? ' sel' : '');
      s += '<g class="' + cls + '" data-id="' + e.id + '" tabindex="0" role="button" aria-label="' + esc(label) + '">' +
        '<circle class="hit" cx="' + p.x.toFixed(1) + '" cy="' + p.y + '" r="12"></circle>' +
        '<rect class="cdot" x="' + (p.x - 6).toFixed(1) + '" y="' + (p.y - 6) + '" width="12" height="12" rx="2"></rect>' +
        '<title>' + esc(e.y + ' ' + e.t) + '</title></g>';
      return;
    }
    const st = stOf(e);
    const r = dotR(e, narrow);
    const quiet = !st && items.length > 220 && x.domain && x.domain[1] - x.domain[0] > 60 && builtOnBy(e.id) === 0 && !(IDX.up[e.id] || []).length;
    const cls = 'node' + (st ? ' st-' + st : '') + (ok[e.id] ? '' : ' muted') + (ui.selected === e.id ? ' sel' : '') + (quiet ? ' quiet' : '');
    const mt = !st && useSrc ? mapTagsOf(e) : [];
    const fill = mt.length ? ' style="fill:' + (mt.length === 1 ? tagColor(mt[0]) : 'none') + ';stroke:var(--bg)"' : '';
    const halves = mt.length > 1 ? pieSlices(p.x, p.y, r, mt.map(tagColor)) : '';
    let extra = '';
    if(st === 'read' && r >= 4.5) extra = '<path class="mark" d="M' + (p.x - r * 0.45).toFixed(1) + ' ' + (p.y + 0.2).toFixed(1) + ' l' + (r * 0.3).toFixed(1) + ' ' + (r * 0.32).toFixed(1) + ' l' + (r * 0.55).toFixed(1) + ' ' + (-r * 0.62).toFixed(1) + '"></path>';
    if(st === 'want') extra = '<circle class="hole" cx="' + p.x.toFixed(1) + '" cy="' + p.y + '" r="' + Math.max(1.2, r * 0.36).toFixed(1) + '"></circle>';
    s += '<g class="' + cls + '" data-id="' + e.id + '" tabindex="0" role="button" aria-label="' + esc(label + (st === 'read' ? ' (read)' : st === 'want' ? ' (want to read)' : '')) + '">' +
      '<circle class="hit" cx="' + p.x.toFixed(1) + '" cy="' + p.y + '" r="12"></circle>' +
      (dotTier(e) === 3 ? '<circle class="ring" cx="' + p.x.toFixed(1) + '" cy="' + p.y + '" r="' + (r + 3.4).toFixed(1) + '"></circle>' : '') +
      halves + (e.book ? bookMark(p.x, p.y, r, fill) : '<circle class="dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y + '" r="' + r.toFixed(1) + '"' + fill + '></circle>') + extra +
      '<title>' + esc(label) + '</title></g>';
  });
  const slots = {};
  const keepLbl = labelKeepSet(items, laneIndex);
  const zoomedIn = !!(x.domain && x.domain[1] - x.domain[0] <= 22);
  items.slice().sort((a, b) => (keepLbl.has(b.id) - keepLbl.has(a.id)) || (b.kind === 'concept') - (a.kind === 'concept') || builtOnBy(b.id) - builtOnBy(a.id) || a.y - b.y).forEach(e => {
    const p = P[e.id];
    if(p.x < left - 4 || p.x > W - right + 4) return;
    const lane = laneIndex[e.sub];
    const txt = mapTitle(e), au = mapAuthors(e);
    const w = Math.max(textW(txt, 11), textW(au, 9.5));
    const x0 = Math.min(Math.max(p.x - w / 2, left + 2), W - right - w - 2);
    const a = x0, z = x0 + w;
    const sl = slots[lane] || (slots[lane] = {up:[], dn:[]});
    const free = arr => arr.every(([s0, e0]) => z < s0 - 4 || a > e0 + 4);
    const order = e.kind === 'concept' ? ['dn', 'up'] : ['up', 'dn'];
    const keep = MAP.allNames || zoomedIn || keepLbl.has(e.id);
    let lv = order.find(k => free(sl[k]));
    if(!lv){ if(keep) return; lv = order[0]; }
    if(keep) sl[lv].push([a, z]);
    const r = e.kind === 'concept' ? 6 : dotR(e, narrow);
    const ty = lv === 'up' ? p.y - r - 5 : p.y + r + 12;
    /* the title; when the paper is pointed at or lit, its authors appear underneath and an upper title steps up to make room */
    const band = lane % 2 === 0 ? ' on-band' : '';
    s += '<text class="lbl ' + lv + ' p' + dotTier(e) + (keep ? ' keep' : ' hov') + (ok[e.id] ? '' : ' muted') + band + '" data-lk="' + (keep ? 'keep' : 'hov') + '" data-id="' + e.id + '" x="' + x0.toFixed(1) + '" y="' + ty.toFixed(1) + '" text-anchor="start">' + esc(txt) + '</text>';
    if(au) s += '<text class="lbl-au' + band + '" data-id="' + e.id + '" x="' + x0.toFixed(1) + '" y="' + (lv === 'up' ? ty : ty + 11).toFixed(1) + '" text-anchor="start">' + esc(au) + '</text>';
  });
  s += '</g>';
  mapSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  mapSvg.setAttribute('width', W);
  mapSvg.setAttribute('height', H);
  mapSvg.innerHTML = s;
  mapSvg.classList.toggle('show-pre', !!settings.showPre);
  mapSvg.classList.toggle('many-lines', mapSvg.querySelectorAll('.edge:not(.p)').length > 120);
  /* notes on lines show only for the lines that are lit up, so an untouched map stays clean */
  mapSvg.classList.add('quiet-notes');
  renderTagLegend(useSrc);
  renderBranchRow();
  applyFocus(ui.selected);
  applyHintGlow();
  updateRangeUI();
}
const EK = (a, b) => a + '|' + b;
function oneStep(id, dir){
  dir = dir || 'all';
  const F = {nodes: new Set([id]), edges: new Set(), far: new Set(), soft: new Set(), softNodes: new Set(), self: id, lv: new Map([[id, 0]]), elv: new Map()};
  const add = (a, b, o) => { const k = EK(a, b); F.edges.add(k); F.nodes.add(o); F.elv.set(k, 1); if(!F.lv.has(o)) F.lv.set(o, 1); };
  lib.links.forEach(l => {
    if(l[2] === 'r' && (settings.showRelated === false || dir !== 'all')) return;
    if(lineHidden(l[0], l[1], l[2])) return;
    if(l[1] === id && dir !== 'down') add(l[0], l[1], l[0]);
    if(l[0] === id && dir !== 'up') add(l[0], l[1], l[1]);
  });
  const e = lib.entries[id];
  if(e && e.kind === 'concept'){ if(dir !== 'up') (IDX.users[id] || []).forEach(p => add(id, p, p)); }
  else if(e && dir !== 'down') (e.needs || []).forEach(c => { if(lib.entries[c]) add(c, id, c); });
  return F;
}
function branchSets(bid, F, soft){
  if(brHidden(bid)) return;
  (IDX.branchLines[bid] || []).forEach(k => {
    const [a, b] = k.split('|'), ek = EK(a, b);
    if(soft){ if(!F.edges.has(ek)){ F.soft.add(ek); [a, b].forEach(n => { if(!F.nodes.has(n)) F.softNodes.add(n); }); } }
    else{ F.edges.add(ek); if(a !== F.self && b !== F.self) F.far.add(ek); F.nodes.add(a); F.nodes.add(b); F.softNodes.delete(a); F.softNodes.delete(b); F.soft.delete(ek); }
  });
}
function branchesNear(id){
  const own = IDX.nodeBranches[id];
  if(own && own.size) return {own: [...own], reach: []};
  const reach = new Set();
  lib.links.forEach(l => { if(l[0] !== id && l[1] !== id) return; if(l[2] === 'r' && settings.showRelated === false) return; const o = l[0] === id ? l[1] : l[0]; (IDX.nodeBranches[o] || new Set()).forEach(b => reach.add(b)); });
  return {own: [], reach: [...reach]};
}
/* walk the lines out from a paper, remembering how many steps away each one is.
   dir: 'all' follows every line either way (the whole pipeline); 'up' only what it builds on, and so on back;
   'down' only what builds on it, and so on forward; 'lineage' does 'up' and 'down' but never turns sideways. */
function depthWalk(id, depth, F, dir){
  dir = dir || 'all';
  if(dir === 'lineage'){ depthWalk(id, depth, F, 'up'); depthWalk(id, depth, F, 'down'); return; }
  const lim = depth === 'all' ? Infinity : depth, showR = settings.showRelated !== false;
  let frontier = [id]; const seen = new Set([id]);
  for(let lv = 1; lv <= lim && frontier.length; lv++){
    const next = [];
    const step = (o, ek, t) => {
      if(t === 'r' && (!showR || dir !== 'all')) return;
      F.edges.add(ek); F.nodes.add(o); if(lv > 1) F.far.add(ek);
      if(!F.elv.has(ek) || F.elv.get(ek) > lv) F.elv.set(ek, lv);
      if(!F.lv.has(o) || F.lv.get(o) > lv) F.lv.set(o, lv);
      if(!seen.has(o)){ seen.add(o); next.push(o); }
    };
    frontier.forEach(x => {
      if(dir !== 'down') (IDX.up[x] || []).forEach(([o, t]) => { if(!lineHidden(o, x, t)) step(o, EK(o, x), t); });
      if(dir !== 'up') (IDX.down[x] || []).forEach(([o, t]) => { if(!lineHidden(x, o, t)) step(o, EK(x, o), t); });
    });
    frontier = next;
  }
}
/* A selected paper lights up one step around it (or more, with “How far”).
   With All ways, a colour line it sits on shows faintly (end to end at Whole line), and colour lines it leads to show faintly. */
function focusSets(id){
  const dir = settings.focusDir || 'all';
  const F = oneStep(id, dir);
  if(ui.depth && ui.depth !== 1) depthWalk(id, ui.depth, F, dir);
  /* How far and Direction decide what lights up, colour lines included: a colour line the paper is on lights
     end to end only with Whole line and All ways; with fewer steps it shows faintly for context, and with a
     direction chosen only the part in that direction lights (through the walk above), never the rest. */
  if(dir === 'all'){
    const R = branchesNear(id);
    R.own.forEach(b => branchSets(b, F, ui.depth !== 'all'));
    R.reach.forEach(b => branchSets(b, F, true));
  }
  return F;
}
/* how far away something is shows as how strong it is: one step is full strength, then each step fades a little */
function lvClass(lv){ return lv == null || lv <= 1 ? '' : 'lv' + Math.min(lv, 5); }
function paintFocus(F){
  mapSvg.classList.add('focus');
  const LV = ['lv2', 'lv3', 'lv4', 'lv5'];
  mapSvg.querySelectorAll('.edge,.edge-note').forEach(e => {
    const k = EK(e.dataset.a, e.dataset.b), hot = F.edges.has(k);
    e.classList.toggle('hot', hot); e.classList.toggle('far', hot && F.far.has(k)); e.classList.toggle('soft', !hot && F.soft.has(k));
    e.classList.remove(...LV); const c = hot && F.elv ? lvClass(F.elv.get(k)) : ''; if(c && !e.classList.contains('br')) e.classList.add(c);
  });
  mapSvg.querySelectorAll('.ghost').forEach(g => g.classList.toggle('hot', F.nodes.has(g.dataset.ghostOf)));
  mapSvg.querySelectorAll('.lbl-au').forEach(n => n.classList.toggle('hot', F.nodes.has(n.dataset.id)));
  mapSvg.querySelectorAll('.node,.lbl').forEach(n => {
    const i = n.dataset.id, hot = F.nodes.has(i); n.classList.toggle('hot', hot); n.classList.toggle('soft', !hot && F.softNodes.has(i));
    n.classList.remove(...LV); const c = hot && F.lv ? lvClass(F.lv.get(i)) : ''; if(c) n.classList.add(c);
  });
}

/* when a paper is selected (or pointed at), its name and the names it lights are laid out so none overlap */
function restoreLabels(){
  mapSvg.querySelectorAll('[data-ox]').forEach(n => { n.setAttribute('x', n.dataset.ox); n.setAttribute('y', n.dataset.oy); delete n.dataset.ox; delete n.dataset.oy; });
  mapSvg.querySelectorAll('.culled').forEach(n => n.classList.remove('culled'));
  mapSvg.querySelectorAll('.lbl-lead').forEach(l => l.remove());
}
/* lit names stay where they belong (above or below their own dot, the authors under the title);
   where two would overlap, only one is shown: the paper you point at, then the one you picked, then the most built on */
function layoutHotLabels(prio){
  restoreLabels();
  if(!mapSvg.classList.contains('focus')) return;
  let titles = [...mapSvg.querySelectorAll('text.lbl.hot:not(.ghost-lbl)')];
  if(mapSvg.classList.contains('hovering')) titles = titles.filter(x => x.classList.contains('me'));
  if(!titles.length || typeof titles[0].getComputedTextLength !== 'function') return;
  const narrow = window.innerWidth <= 760, kept = [];
  const ids = [...new Set(titles.map(x => x.dataset.id))].sort((a, b) => (a === prio ? -1 : b === prio ? 1 : a === ui.selected ? -1 : b === ui.selected ? 1 : builtOnBy(b) - builtOnBy(a)));
  ids.forEach(id => {
    const tl = mapSvg.querySelector('text.lbl[data-id="' + id + '"]:not(.ghost-lbl)'), au = mapSvg.querySelector('text.lbl-au[data-id="' + id + '"]'), p = MAP.P[id], e = lib.entries[id];
    if(!tl || !p || !e) return;
    const r = dotR(e, narrow), up = tl.classList.contains('up'), w = Math.max(tl.getComputedTextLength(), au ? au.getComputedTextLength() : 0) + 2, h = au ? 24 : 13;
    const x0 = +tl.getAttribute('x'), top = up ? p.y - r - 4 - h : p.y + r + 3;
    const box = {x0: x0 - 2, x1: x0 + w + 2, y0: top, y1: top + h};
    if(kept.some(o => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0)){ tl.classList.add('culled'); if(au) au.classList.add('culled'); return; }
    kept.push(box);
    [tl, au].forEach((n, j) => { if(!n) return; n.dataset.ox = n.getAttribute('x'); n.dataset.oy = n.getAttribute('y'); n.setAttribute('y', (top + 11 + j * 11).toFixed(1)); });
  });
}
/* exporting: every shown paper gets its title and its authors; a name that can't sit clear of the others
   (above or below its dot, or nudged to one side) becomes a small number, explained in Notes under the map */
function layoutExportNames(all){
  const narrow = false, kept = [], notes = [];
  const titles = [...mapSvg.querySelectorAll('text.lbl:not(.ghost-lbl)')].filter(x => parseFloat(getComputedStyle(x).opacity) > 0.05);
  if(typeof SVGTextContentElement === 'undefined' || !mapSvg.getBBox) return notes;
  const W = MAP.W || 0, L = (MAP.left || 0) + 2, R = W - 4;
  mapSvg.querySelectorAll('g.node circle.dot').forEach(c => { const cx = +c.getAttribute('cx'), cy = +c.getAttribute('cy'), r = +c.getAttribute('r') + 2.5; kept.push({x0: cx - r, x1: cx + r, y0: cy - r, y1: cy + r, dot: 1}); });
  /* every paper on the map when all names are wanted (a crowded one may have had no name drawn at all), else the named ones */
  const named = new Set(titles.map(x => x.dataset.id));
  const pool = all ? [...mapSvg.querySelectorAll('g.node[data-id]')].map(g => g.dataset.id) : [...named];
  const ids = [...new Set(pool)].filter(id => MAP.P[id] && lib.entries[id] && lib.entries[id].kind === 'paper').sort((a, b) => (named.has(b) - named.has(a)) || builtOnBy(b) - builtOnBy(a) || (lib.entries[a].y || 0) - (lib.entries[b].y || 0));
  ids.forEach(id => {
    const tl0 = mapSvg.querySelector('text.lbl[data-id="' + id + '"]:not(.ghost-lbl)'), tl = tl0 && named.has(id) ? tl0 : null, au = mapSvg.querySelector('text.lbl-au[data-id="' + id + '"]'), p = MAP.P[id], e = lib.entries[id];
    if(!tl){ const r0 = dotR(e, narrow), right0 = p.x + r0 + 12 < (MAP.W || 0) - 4, n0 = notes.length + 1;
      mapSvg.insertAdjacentHTML('beforeend', '<text class="fn-num" data-id="' + id + '" x="' + (right0 ? p.x + r0 + 1.5 : p.x - r0 - 1.5).toFixed(1) + '" y="' + (p.y - r0 + 1).toFixed(1) + '" text-anchor="' + (right0 ? 'start' : 'end') + '">' + n0 + '</text>');
      notes.push({n: n0, id}); return; }
    if(au) au.classList.add('xau');
    const r = dotR(e, narrow), w = Math.max(tl.getComputedTextLength(), au ? au.getComputedTextLength() : 0) + 2, h = au ? 24 : 13;
    const hit = b => kept.some(o => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
    const up0 = tl.classList.contains('up'), xs = [p.x - w / 2, p.x - w + 10, p.x - 10, p.x - w * 0.25, p.x - w * 0.75].map(v => Math.max(L, Math.min(v, R - w)));
    const tops = (up0 ? [p.y - r - 4 - h, p.y + r + 3] : [p.y + r + 3, p.y - r - 4 - h]);
    let pick = null;
    for(const top of tops){ for(const x0 of xs){ const b = {x0: x0 - 2, x1: x0 + w + 2, y0: top, y1: top + h}; if(!hit(b)){ pick = {x0, top, b}; break; } } if(pick) break; }
    if(pick){
      kept.push(pick.b);
      [tl, au].forEach((n, j) => { if(!n) return; n.setAttribute('x', pick.x0.toFixed(1)); n.setAttribute('y', (pick.top + 11 + j * 11).toFixed(1)); });
      return;
    }
    /* no clear place: a number by the dot, and the name in Notes */
    tl.classList.add('culled'); if(au) au.classList.add('culled');
    const n = notes.length + 1, right = p.x + r + 12 < R, nx = right ? p.x + r + 1.5 : p.x - r - 1.5;
    tl.insertAdjacentHTML('afterend', '<text class="fn-num" data-id="' + id + '" x="' + nx.toFixed(1) + '" y="' + (p.y - r + 1).toFixed(1) + '" text-anchor="' + (right ? 'start' : 'end') + '">' + n + '</text>');
    notes.push({n, id});
  });
  return notes;
}
function applyFocus(id){
  if(!id || !MAP.P[id]){
    if(ui.branch && (IDX.branchLines[ui.branch] || []).length){ const F = {nodes: new Set(), edges: new Set(), far: new Set(), soft: new Set(), softNodes: new Set(), self: null}; branchSets(ui.branch, F, false); F.far.clear(); paintFocus(F); return; }
    mapSvg.classList.remove('focus');
    mapSvg.querySelectorAll('.hot,.far,.soft').forEach(n => n.classList.remove('hot', 'far', 'soft'));
    restoreLabels();
    return;
  }
  paintFocus(focusSets(id));
  layoutHotLabels(id);
}
function updateRangeUI(){
  const r = settings.range;
  document.getElementById('btnZoom').textContent = 'Years: ' + (r ? Math.round(r[0]) + '–' + Math.round(r[1]) : 'all');
}
function setRange(a, b){
  const full = MAP.full;
  if(a == null || b == null){ settings.range = null; }
  else{
    if(a > b){ const t = a; a = b; b = t; }
    if(b - a < 4){ const c = (a + b) / 2; a = c - 2; b = c + 2; }
    const span = b - a, fspan = full[1] - full[0];
    if(span >= fspan - 0.5) settings.range = null;
    else{
      if(a < full[0]){ b += full[0] - a; a = full[0]; }
      if(b > full[1]){ a -= b - full[1]; b = full[1]; }
      settings.range = [Math.max(full[0], a), Math.min(full[1], b)];
    }
  }
  persistSettings({remote:false});
  renderMap(true);
}
function zoomBy(factor, center){
  /* First zoom on a compressed overview: jump straight to the densest stretch (10th–90th percentile) */
  if(!settings.range && factor > 1 && center == null && MAP.x && MAP.x.compressed){
    const ys = Object.values(lib.entries).filter(e => MAP.P[e.id] && typeof e.y === 'number').map(e => e.y).sort((a, b) => a - b);
    if(ys.length >= 5){
      const lo = ys[Math.floor(ys.length * 0.1)], hi = ys[Math.min(ys.length - 1, Math.ceil(ys.length * 0.9))];
      if(hi - lo >= 8){ setRange(lo - 3, hi + 3); return; }
    }
  }
  const cur = settings.range || MAP.full;
  const c = center != null ? center : (settings.range ? (cur[0] + cur[1]) / 2 : MAP.x.inv(MAP.left + MAP.inner / 2));
  const a = c - (c - cur[0]) / factor, b = c + (cur[1] - c) / factor;
  setRange(a, b);
}
function panBy(years){
  const r = settings.range;
  if(!r) return;
  setRange(r[0] + years, r[1] + years);
}
function svgPoint(ev){
  const rect = mapSvg.getBoundingClientRect();
  const sx = rect.width ? MAP.W / rect.width : 1, sy = rect.height ? MAP.H / rect.height : 1;
  return {x: (ev.clientX - rect.left) * sx, y: (ev.clientY - rect.top) * sy};
}
