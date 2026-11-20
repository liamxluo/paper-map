/* ===================== export: a picture of the topics you choose ===================== */
const EXPORT_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'display', 'visibility', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'paint-order', 'text-transform'];
function cloneWithStyles(src){
  const out = src.cloneNode(true);
  const a = [src, ...src.querySelectorAll('*')], b = [out, ...out.querySelectorAll('*')];
  a.forEach((el, i) => { const cs = getComputedStyle(el); b[i].setAttribute('style', EXPORT_PROPS.map(p => p + ':' + cs.getPropertyValue(p)).join(';')); b[i].removeAttribute('class'); b[i].removeAttribute('tabindex'); b[i].removeAttribute('role'); });
  return out;
}
function allLaneRows(){
  const rows = [];
  lib.topics.forEach(tp => treeSubs(tp).forEach(s => rows.push({sub: s, topic: tp, depth: subAncestors(s).filter(x => !x.hidden).length, name: s.hidden ? tp.name : s.name})));
  return rows;
}
function laneOfEntry(e){ return e.kind === 'concept' ? '__concepts' : e.sub; }
function tlLanes(id){ if(IDX.subs[id]) return [id]; const tp = IDX.topics[id]; return tp ? treeSubs(tp).map(s => s.id) : []; }
/* which topics outside the choice are joined to it, and how many lines would be left out */
function exportLinks(sel){
  const out = {}, left = {n: 0};
  lib.links.forEach(([a, b, t]) => {
    if(t === 'o' || t === 'p') return;
    const A = lib.entries[a], B = lib.entries[b]; if(!A || !B || A.kind === 'concept' || B.kind === 'concept') return;
    const la = laneOfEntry(A), lb = laneOfEntry(B), ia = sel.has(la), ib = sel.has(lb);
    if(ia === ib) return;
    left.n++;
    const o = ia ? lb : la; (out[o] = out[o] || {lines: 0, related: false}).lines++;
  });
  (lib.tlinks || []).forEach(l => {
    const A = tlLanes(l[0]), B = tlLanes(l[1]);
    const ia = A.some(x => sel.has(x)), ib = B.some(x => sel.has(x));
    if(ia === ib) return;
    (ia ? B : A).forEach(o => { if(!sel.has(o)) (out[o] = out[o] || {lines: 0, related: false}).related = true; });
  });
  return {suggest: Object.keys(out).map(id => Object.assign({id}, out[id])).sort((x, y) => y.lines - x.lines), left: left.n};
}
function measureText(txt, font){ const c = measureText.c || (measureText.c = document.createElement('canvas').getContext('2d')); c.font = font; return c.measureText(txt).width; }
function xmlEsc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
/* draw the map for the chosen rows, copy it with every colour written out, then put the page back exactly as it was */
function buildExportSVG(o){
  const root = document.documentElement, prevTheme = root.getAttribute('data-theme');
  const keep = {lanes: settings.lanes, showConcepts: settings.showConcepts, sel: ui.selected, br: ui.branch, range: settings.range};
  const mapEl = document.getElementById('map'), prevW = mapEl.style.width;
  /* no concepts row unless the chosen papers actually use a concept */
  if(!o.keep && o.concepts && !Object.values(lib.entries).some(e => e.kind === 'paper' && o.subs.includes(e.sub) && (e.needs || []).some(c => lib.entries[c]))) o = Object.assign({}, o, {concepts: false});
  let cap = null;
  try{
    root.setAttribute('data-theme', 'light');
    { const subsPlus = o.subs.slice(); lib.topics.forEach(tp => { const own = tp.subs.find(s => s.hidden); if(own && !subsPlus.includes(own.id) && tp.subs.some(s => subsPlus.includes(s.id))) subsPlus.push(own.id); }); settings.lanes = subsPlus; }
    settings.showConcepts = !!o.concepts; ui.selected = null; ui.branch = null; MAP.allNames = o.names !== 'main';
    if(o.allYears) settings.range = null;
    mapEl.style.width = o.width + 'px';
    renderMap(true);
    mapSvg.classList.remove('focus');
    mapSvg.querySelectorAll('.hot,.far,.soft,.sel').forEach(n => n.classList.remove('hot', 'far', 'soft', 'sel'));
    if(o.notes) mapSvg.classList.remove('quiet-notes');
    mapSvg.classList.toggle('show-pre', !!o.concepts);
    mapSvg.classList.add('no-anim');
    const fnotes = layoutExportNames(o.names !== 'main');
    const cs = getComputedStyle(root);
    cap = {plot: cloneWithStyles(mapSvg), axis: cloneWithStyles(axisSvg), lanes: (MAP.lanes || []).slice(), W: MAP.W, H: MAP.H, laneH: MAP.laneH, top: MAP.top || 8,
      ink: cs.getPropertyValue('--ink').trim() || '#1C2330', muted: cs.getPropertyValue('--muted').trim() || '#6B7280', band: getComputedStyle(mapSvg.querySelector('.band') || mapSvg).fill,
      labFont: getComputedStyle(document.querySelector('#mapLabels .nm') || document.body).fontFamily, sans: cs.getPropertyValue('--sans').trim(), serif: cs.getPropertyValue('--serif').trim(), notes: fnotes};
  }finally{
    if(prevTheme == null) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', prevTheme);
    MAP.allNames = false; mapSvg.classList.remove('no-anim');
    settings.lanes = keep.lanes; settings.showConcepts = keep.showConcepts; ui.selected = keep.sel; ui.branch = keep.br; settings.range = keep.range;
    mapEl.style.width = prevW;
    renderMap(true);
  }
  if(!cap || !cap.lanes.length) return null;
  /* only the papers and lines you picked; the rest left out, or drawn faintly for context */
  if(o.keep){
    const K = o.keep, faint = K.rest === 'faint';
    cap.plot.querySelectorAll('[data-id]').forEach(n => { if(K.nodes.has(n.getAttribute('data-id'))) return; if(faint){ n.style.opacity = '0.14'; } else n.remove(); });
    cap.plot.querySelectorAll('[data-a]').forEach(n => {
      if(K.edges.has(n.getAttribute('data-a') + '|' + n.getAttribute('data-b'))) return;
      if(faint && n.tagName.toLowerCase() !== 'text'){ n.style.opacity = '0.1'; n.removeAttribute('data-br'); } else n.remove();
    });
  }
  /* concepts: only the ones the chosen papers use */
  if(o.concepts && !o.keep){
    const used = new Set();
    Object.values(lib.entries).forEach(e => { if(e.kind === 'paper' && o.subs.includes(e.sub)) (e.needs || []).forEach(c => used.add(c)); });
    const drop = new Set(Object.values(lib.entries).filter(e => e.kind === 'concept' && !used.has(e.id)).map(e => e.id));
    cap.plot.querySelectorAll('[data-id]').forEach(n => { if(drop.has(n.getAttribute('data-id'))) n.remove(); });
    cap.plot.querySelectorAll('[data-a]').forEach(n => { if(drop.has(n.getAttribute('data-a')) || drop.has(n.getAttribute('data-b'))) n.remove(); });
  }
  ['#brush', 'rect.bg'].forEach(s => cap.plot.querySelectorAll(s).forEach(n => n.remove()));
  /* fewer lines: only the colour lines, or none at all */
  if(o.lines === 'colour' || o.lines === 'none'){
    const keepIds = new Set([...cap.plot.querySelectorAll('[data-br]')].map(n => n.getAttribute('data-a') + '|' + n.getAttribute('data-b')));
    cap.plot.querySelectorAll('[data-a]').forEach(n => { if(o.lines === 'none' || !keepIds.has(n.getAttribute('data-a') + '|' + n.getAttribute('data-b'))) n.remove(); });
  }
  cap.plot.querySelectorAll('[id="brush"]').forEach(n => n.remove());
  const usedBranches = [...new Set([...cap.plot.querySelectorAll('[data-br]')].map(n => n.getAttribute('data-br')))].map(id => lib.branches.find(b => b.id === id)).filter(Boolean);
  /* the label column */
  const labFont = '600 14px ' + (cap.labFont || '').replace(/,?\s*serif\s*$/, '') + ", Georgia, 'Times New Roman', serif", ctxFont = '400 11px ' + cap.sans;
  const rows = cap.lanes.map((ln, i) => {
    const s = ln.sub, headed = !ln.concepts && !s.hidden && cap.lanes.some(l => l.topic && l.topic.id === ln.topic.id && l.sub.hidden);
    const depth = ln.concepts ? 0 : subAncestors(s).filter(x => !x.hidden).length + (headed ? 1 : 0);
    const first = !ln.concepts && (i === 0 || cap.lanes[i - 1].topic.id !== ln.topic.id) && !s.hidden;
    return {name: ln.concepts ? 'Concepts' : (s.hidden ? ln.topic.name : s.name), depth, ctx: first ? ln.topic.name : '', concepts: !!ln.concepts, own: !!s.hidden && cap.lanes.some(l => l.topic && l.topic.id === ln.topic.id && !l.sub.hidden)};
  });
  const labW = Math.min(300, Math.max(130, ...rows.map(r => measureText(r.name, labFont) + 18 + r.depth * 14 + (r.depth ? 12 : 0)), ...rows.map(r => r.ctx ? measureText(r.ctx, ctxFont) + 18 : 0)));
  const M = 36, titleH = o.title ? 70 : 8, axisH = 30;
  const legendH = o.legend ? 44 : 0, footH = 30;
  const notesOn = (cap.notes || []).filter(nt => cap.plot.querySelector('[data-id="' + nt.id + '"]'));
  const Wt = M + labW + cap.W + M, noteCols = Math.max(1, Math.min(3, Math.floor((Wt - 2 * M) / 380))), notesH = notesOn.length ? 30 + Math.ceil(notesOn.length / noteCols) * 17 + 8 : 0;
  const Ht = M + titleH + cap.H + axisH + legendH + notesH + footH + M - 10;
  const serif = (cap.serif || '').replace(/,?\s*serif\s*$/, '') + ", Georgia, 'Times New Roman', serif", sans = (cap.sans || '').replace(/,?\s*sans-serif\s*$/, '') + ', Helvetica, Arial, sans-serif';
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + Wt + '" height="' + Ht + '" viewBox="0 0 ' + Wt + ' ' + Ht + '">';
  s += '<rect width="' + Wt + '" height="' + Ht + '" fill="#FFFFFF"/>';
  if(o.title){
    s += '<text x="' + M + '" y="' + (M + 28) + '" style="font:900 30px ' + xmlEsc(serif) + ';fill:' + cap.ink + '">' + xmlEsc(o.title) + '</text>';
    const np = o.keep ? keptPapers(o.keep).length : Object.values(lib.entries).filter(e => e.kind === 'paper' && o.subs.includes(e.sub) && !e.parent).length;
    s += '<text x="' + M + '" y="' + (M + 52) + '" style="font:400 13px ' + xmlEsc(sans) + ';fill:' + cap.muted + '">' + xmlEsc(np + (np === 1 ? ' paper' : ' papers') + ' · ' + rows.filter(r => !r.concepts).length + ' rows · ' + new Date().toLocaleDateString([], {day: 'numeric', month: 'long', year: 'numeric'})) + '</text>';
  }
  const ox = M, oy = M + titleH;
  rows.forEach((r, i) => {
    const y = oy + cap.top + i * cap.laneH;
    /* as on the map: ruled rows, a topic opening with its name in small capitals, nested rows on a fine guide */
    if(i > 0) s += '<line x1="' + ox + '" x2="' + (ox + labW) + '" y1="' + y + '" y2="' + y + '" style="stroke:' + (r.ctx ? cap.ink : cap.rule || '#E3E6EB') + ';stroke-width:' + (r.ctx ? 1.3 : 1) + ';opacity:' + (r.ctx ? .7 : .7) + '"/>';
    const tx = ox + 10 + r.depth * 14;
    if(r.ctx) s += '<text x="' + tx + '" y="' + (y + cap.laneH / 2 - 8) + '" style="font:700 8.5px ' + xmlEsc(sans) + ';letter-spacing:1.3px;fill:' + cap.ink + ';opacity:.5">' + xmlEsc(String(r.ctx).toUpperCase()) + '</text>';
    const ny = y + cap.laneH / 2 + (r.ctx ? 9 : 5);
    if(r.depth >= 1) s += '<line x1="' + (tx - 8) + '" x2="' + (tx - 8) + '" y1="' + (y + cap.laneH * .27) + '" y2="' + (y + cap.laneH * .73) + '" style="stroke:' + (cap.ruleStrong || '#C9CED6') + ';stroke-width:1"/>';
    s += '<text x="' + tx + '" y="' + ny + '" style="font:' + (r.concepts ? '600 13px ' + xmlEsc(sans) : (r.own ? labFont.replace(/^600 14px/, '700 15px') : labFont).replace(/"/g, "'")) + ';fill:' + (r.concepts ? cap.muted : cap.ink) + '">' + xmlEsc(r.name) + '</text>';
  });
  const plot = cap.plot; plot.setAttribute('x', ox + labW); plot.setAttribute('y', oy); plot.setAttribute('width', cap.W); plot.setAttribute('height', cap.H);
  plot.removeAttribute('style');
  s += new XMLSerializer().serializeToString(plot).replace(/^<svg[^>]*?>/, m => m.replace(/\sid="[^"]*"/, ''));
  const axis = cap.axis; axis.setAttribute('x', ox + labW); axis.setAttribute('y', oy + cap.H); axis.setAttribute('width', cap.W); axis.setAttribute('height', axisH); axis.removeAttribute('style');
  s += new XMLSerializer().serializeToString(axis).replace(/^<svg[^>]*?>/, m => m.replace(/\sid="[^"]*"/, ''));
  let ly = oy + cap.H + axisH + 26;
  if(o.legend){
    let lx = ox;
    const item = (svg, label) => { s += '<g transform="translate(' + lx + ',' + (ly - 4) + ')">' + svg + '</g><text x="' + (lx + 30) + '" y="' + ly + '" style="font:400 12px ' + xmlEsc(sans) + ';fill:' + cap.muted + '">' + xmlEsc(label) + '</text>'; lx += 40 + measureText(label, '400 12px ' + sans) + 18; };
    const ln = dash => '<line x1="0" y1="0" x2="24" y2="0" style="stroke:' + cap.ink + ';stroke-width:1.6' + (dash ? ';stroke-dasharray:' + dash : '') + '"/>';
    item(ln(''), 'builds on'); item(ln('5 3'), 'responds to'); item(ln('1.5 3'), 'related to');
    item('<circle cx="12" cy="0" r="5" style="fill:' + readColor() + '"/>', 'read'); item('<circle cx="12" cy="0" r="5" style="fill:' + wantColor() + '"/>', 'want to read');
    item('<circle cx="5" cy="0" r="3" style="fill:none;stroke:' + cap.muted + ';stroke-width:1.2"/><circle cx="17" cy="0" r="6" style="fill:none;stroke:' + cap.muted + ';stroke-width:1.2"/>', 'bigger: more papers build on it');
    usedBranches.forEach(b => item('<line x1="0" y1="0" x2="24" y2="0" style="stroke:' + b.color + ';stroke-width:2.6"/>', b.name));
    ly += legendH - 18;
  }
  if(notesOn.length){
    /* names that had no clear place on the map */
    s += '<text x="' + ox + '" y="' + (ly + 14) + '" style="font:700 10px ' + xmlEsc(sans) + ';letter-spacing:1.2px;fill:' + cap.ink + ';opacity:.55">NOTES</text>';
    const colW = (Wt - 2 * M) / noteCols, perCol = Math.ceil(notesOn.length / noteCols);
    notesOn.forEach((nt, k) => { const e = lib.entries[nt.id]; if(!e) return; const c = Math.floor(k / perCol), rr = k % perCol, nx = ox + c * colW, ny = ly + 34 + rr * 17;
      const t1 = e.t.length > 58 ? e.t.slice(0, 56).replace(/[\s,.:;–-]+$/, '') + '…' : e.t;
      s += '<text x="' + nx + '" y="' + ny + '" style="font:700 10.5px ' + xmlEsc(sans) + ';fill:' + cap.ink + '">' + nt.n + '</text>' +
        '<text x="' + (nx + 16) + '" y="' + ny + '" style="font:600 12px ' + xmlEsc(serif) + ';fill:' + cap.ink + '">' + xmlEsc(t1) + '<tspan style="font:400 10.5px ' + xmlEsc(sans) + ';fill:' + cap.muted + '">  ' + xmlEsc([shortAu(e.au), e.y].filter(Boolean).join(' · ')) + '</tspan></text>'; });
    ly += notesH;
  }
  s += '<text x="' + ox + '" y="' + (ly + 8) + '" style="font:400 11px ' + xmlEsc(sans) + ';fill:' + cap.muted + ';opacity:.85">' + xmlEsc((o.disclaimer ? 'Lines show how the author reads these papers as connected, not a citation network. ' : '') + 'Made with Paper Map') + '</text>';
  s += '</svg>';
  return {svg: s, w: Wt, h: Ht};
}
function readColor(){ return getComputedStyle(document.documentElement).getPropertyValue('--read').trim() || '#009473'; }
function wantColor(){ return getComputedStyle(document.documentElement).getPropertyValue('--want').trim() || '#E34234'; }
async function svgToCanvas(x, scale){
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(x.svg);
  await (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; }));
  const max = 15e6, sc = Math.min(scale, Math.sqrt(max / (x.w * x.h)));
  const c = document.createElement('canvas'); c.width = Math.round(x.w * sc); c.height = Math.round(x.h * sc);
  const g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
function canvasBlob(c, type, q){ return new Promise(res => c.toBlob(res, type, q)); }