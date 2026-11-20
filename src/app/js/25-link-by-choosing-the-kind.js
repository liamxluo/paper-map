/* ===================== link by choosing the kind first, then the paper ===================== */
let linkMode = null;
const linkHint = document.createElement('div'); linkHint.className = 'drag-hint link-hint'; linkHint.hidden = true; document.body.appendChild(linkHint);
function showPlus(id){
  const old = document.getElementById('plusBadge'); if(old) old.remove();
  const p = id && MAP.P[id], e = id && lib.entries[id]; if(!p || !e || e.kind !== 'paper' || linkMode) return;
  const r = Math.max(7.5, dotR(e, window.innerWidth <= 760) + 1.5);
  mapSvg.insertAdjacentHTML('beforeend', '<g id="plusBadge" class="plus-badge"><circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + r.toFixed(1) + '"></circle><path d="M' + (p.x - r * .45).toFixed(1) + ' ' + p.y.toFixed(1) + ' H' + (p.x + r * .45).toFixed(1) + ' M' + p.x.toFixed(1) + ' ' + (p.y - r * .45).toFixed(1) + ' V' + (p.y + r * .45).toFixed(1) + '"></path></g>');
}
function hidePlus(){ const b = document.getElementById('plusBadge'); if(b) b.remove(); }
function openPlusMenu(id){
  const n = mapSvg.querySelector('.node[data-id="' + id + '"] circle.dot'); if(!n) return;
  const r = n.getBoundingClientRect();
  openFloatMenu(r.left + r.width / 2 - 100, r.top - 172, [
    {label: '← Builds on…', fn: () => startLinkMode(id, 'in')},
    {label: 'Leads to →…', fn: () => startLinkMode(id, 'out')},
    {label: 'Related to…', fn: () => startLinkMode(id, 'rel')},
    {sep: 1},
    {label: '↧ Mentions another field…', fn: () => startLinkMode(id, 'field')}
  ]);
  const m = document.getElementById('floatMenu'); if(m){ m.classList.add('plus-menu'); keepMenuOnMap(m); }
}
/* menus opened from the map stay over the map: shifted in from its right edge, and above the point when there is no room below it */
function keepMenuOnMap(m, y){
  const box = document.getElementById('mapBox'); if(!box || !m) return;
  const mb = box.getBoundingClientRect(), r = m.getBoundingClientRect();
  if(r.right > mb.right - 4) m.style.left = Math.max(8, mb.right - 4 - r.width) + 'px';
  if(y != null && r.bottom > mb.bottom - 4){
    /* no room below on the map: open above if it fits there, otherwise sit within the map beside the point */
    if(y - r.height - 8 >= mb.top + 4) m.style.top = (y - r.height - 8) + 'px';
    else m.style.top = Math.max(mb.top + 4, Math.min(y - r.height / 2, mb.bottom - r.height - 4)) + 'px';
  }
}
const LINK_HINT = {in: 'Click the paper it builds on', out: 'Click the paper it leads to', rel: 'Click the paper it is related to', field: 'Click the row of the field it mentions'};
function startLinkMode(from, kind){
  cancelLinkMode(); hidePlus();
  linkMode = {from, kind};
  mapSvg.classList.add('linking'); if(kind === 'field') mapSvg.classList.add('linking-field');
  mapSvg.insertAdjacentHTML('beforeend', '<path class="link-drag' + (kind === 'rel' ? ' rel' : kind === 'field' ? ' field' : '') + '" id="linkModePath" d=""></path><path class="link-drag-arr" id="linkModeArr" d=""></path>');
  linkHint.hidden = false; linkHint.textContent = LINK_HINT[kind] + ' · Esc to cancel';
}
function cancelLinkMode(){
  if(!linkMode) return; linkMode = null;
  ['linkModePath', 'linkModeArr'].forEach(x => { const el = document.getElementById(x); if(el) el.remove(); });
  mapSvg.classList.remove('linking', 'linking-field'); mapSvg.querySelectorAll('.node.link-target').forEach(x => x.classList.remove('link-target'));
  mapLabels.querySelectorAll('.drop-target').forEach(b => b.classList.remove('drop-target'));
  linkHint.hidden = true;
}
function linkTargetAt(ev){
  const el = document.elementFromPoint(ev.clientX, ev.clientY), tn = el && el.closest ? el.closest('#net .node') : null;
  return tn && linkMode && tn.dataset.id !== linkMode.from && lib.entries[tn.dataset.id] && lib.entries[tn.dataset.id].kind === 'paper' ? tn : null;
}
window.addEventListener('pointermove', ev => {
  if(!linkMode) return;
  { const hw = linkHint.offsetWidth || 240; linkHint.style.left = (ev.clientX + 14 + hw > innerWidth - 8 ? ev.clientX - 14 - hw : ev.clientX + 14) + 'px'; linkHint.style.top = (ev.clientY + 12) + 'px'; }
  const p = MAP.P[linkMode.from]; if(!p) return;
  const pt = svgPoint(ev), path = document.getElementById('linkModePath'), arr = document.getElementById('linkModeArr');
  mapSvg.querySelectorAll('.node.link-target').forEach(x => x.classList.remove('link-target'));
  if(linkMode.kind === 'field'){
    const L = laneAt(ev.clientY), ln = MAP.lanes[L.i];
    const y = ln ? MAP.top + L.i * MAP.laneH + MAP.laneH / 2 : pt.y;
    if(path) path.setAttribute('d', 'M' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' V' + y.toFixed(1));
    if(arr) arr.setAttribute('d', 'M' + (p.x - 4).toFixed(1) + ' ' + y.toFixed(1) + ' a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0');
    mapLabels.querySelectorAll('button').forEach((b, k) => b.classList.toggle('drop-target', k === L.i));
    return;
  }
  const tn = linkTargetAt(ev); if(tn) tn.classList.add('link-target');
  const q = tn ? MAP.P[tn.dataset.id] : pt;
  /* the line is drawn the way it will point: into this paper for “builds on”, out of it for “leads to” */
  const a = linkMode.kind === 'in' ? q : p, b = linkMode.kind === 'in' ? p : q, mx = (a.x + b.x) / 2;
  if(path) path.setAttribute('d', 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' C' + mx.toFixed(1) + ' ' + a.y.toFixed(1) + ' ' + mx.toFixed(1) + ' ' + b.y.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1));
  if(arr) arr.setAttribute('d', linkMode.kind === 'rel' ? '' : (edgeArrow(a, b, true, true) || ''));
});
function finishLinkMode(ev){
  const m = linkMode; if(!m) return false;
  if(m.kind === 'field'){
    const L = laneAt(ev.clientY), ln = MAP.lanes[L.i], e = lib.entries[m.from];
    cancelLinkMode();
    if(!ln || !e || ln.concepts) return true;
    const key = ln.sub.hidden ? ln.topic.id : ln.sub.id;
    if(ln.sub.id === e.sub){ toast('That is its own row: choose another field'); return true; }
    if((e.mentions || []).includes(key)){ toast('It already mentions that field'); return true; }
    const before = clone(lib);
    e.mentions = (e.mentions || []).concat(key);
    reindex(); touchLib([]); renderMap(true); refreshInfo();
    toast('“' + mapTitle(e) + '” mentions ' + mentionName(key), () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
    return true;
  }
  const tn = linkTargetAt(ev); const to = tn ? tn.dataset.id : null;
  cancelLinkMode();
  if(!to) return true;
  if(m.kind === 'in') makeLink(to, m.from, 'b');
  else if(m.kind === 'out') makeLink(m.from, to, 'b');
  else makeLink(m.from, to, 'r');
  return true;
}
document.addEventListener('keydown', ev => { if(ev.key === 'Escape' && linkMode){ cancelLinkMode(); ev.stopPropagation(); } }, true);
mapLabels.addEventListener('click', ev => { if(linkMode && linkMode.kind === 'field'){ ev.preventDefault(); ev.stopPropagation(); finishLinkMode(ev); } }, true);
/* click a line to change it: its kind, its direction, its note and colour, or remove it */
function rekeyLine(a, b, t, a2, b2, t2){ const k = a + '|' + b + '|' + t, k2 = a2 + '|' + b2 + '|' + t2; if(lib.lineBranch && lib.lineBranch[k]){ lib.lineBranch[k2] = lib.lineBranch[k]; delete lib.lineBranch[k]; } }
function changeLine(a, b, t, a2, b2, t2, say){
  const l = lib.links.find(x => x[0] === a && x[1] === b && x[2] === t); if(!l) return;
  if(lib.links.some(x => x !== l && x[2] === t2 && ((x[0] === a2 && x[1] === b2) || (t2 === 'r' && x[0] === b2 && x[1] === a2)))){ toast('There is already a line like that'); return; }
  const before = clone(lib);
  rekeyLine(a, b, t, a2, b2, t2); l[0] = a2; l[1] = b2; l[2] = t2;
  reindex(); touchLib([]); renderMap(true); refreshInfo();
  toast(say, () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
}
function removeLine(a, b, t){
  const before = clone(lib);
  lib.links = lib.links.filter(x => !(x[0] === a && x[1] === b && x[2] === t)); if(lib.lineBranch) delete lib.lineBranch[a + '|' + b + '|' + t];
  reindex(); touchLib([]); renderMap(true); refreshInfo();
  toast('Line removed', () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
}
function openLineMenu(a, b, t, x, y){
  const ea = lib.entries[a], eb = lib.entries[b]; if(!ea || !eb) return;
  const nm = e => mapTitle(e);
  const says = t === 'b' ? nm(eb) + ' builds on ' + nm(ea) : t === 'c' ? nm(eb) + ' responds to ' + nm(ea) : nm(ea) + ' and ' + nm(eb) + ' are related';
  const mark = k => (t === k ? '✓ ' : '');
  openFloatMenu(x + 6, y + 6, [
    {label: says, fn: () => {}},
    {sep: 1},
    {label: mark('b') + 'Builds on', fn: () => t !== 'b' && changeLine(a, b, t, a, b, 'b', 'Now: ' + nm(eb) + ' builds on ' + nm(ea))},
    {label: mark('c') + 'Responds to', fn: () => t !== 'c' && changeLine(a, b, t, a, b, 'c', 'Now: ' + nm(eb) + ' responds to ' + nm(ea))},
    {label: mark('r') + 'Related to', fn: () => t !== 'r' && changeLine(a, b, t, a, b, 'r', 'Now: related')}
  ].concat(t !== 'r' ? [{label: '⇄ The other way round', fn: () => changeLine(a, b, t, b, a, t, 'Now: ' + nm(ea) + (t === 'b' ? ' builds on ' : ' responds to ') + nm(eb))}] : []).concat([
    {sep: 1},
    {label: 'Note and colour…', fn: () => openLinkNote(a, b, t)},
    {label: 'Remove this line', danger: 1, fn: () => removeLine(a, b, t)}
  ]));
  const m = document.getElementById('floatMenu'); if(m){ const f = m.querySelector('.fm-item'); if(f){ f.classList.add('fm-title'); f.disabled = true; } keepMenuOnMap(m, y); }
}

/* say how they are linked: the later paper builds on (or responds to) the earlier one, unless you turn it round */
function openLinkChooser(a, b, x, y, swapped){
  const ea = lib.entries[a], eb = lib.entries[b]; if(!ea || !eb) return;
  let src = ea, dst = eb;
  if((eb.y || 0) < (ea.y || 0)){ src = eb; dst = ea; }
  if(swapped){ const s = src; src = dst; dst = s; }
  const nm = e => (e.au ? shortAu(e.au) : mapLabel(e)) + (e.y ? ' ' + e.y : '');
  openFloatMenu(x + 6, y + 6, [
    {label: nm(dst) + ' builds on ' + nm(src), fn: () => makeLink(src.id, dst.id, 'b')},
    {label: nm(dst) + ' responds to ' + nm(src), fn: () => makeLink(src.id, dst.id, 'c')},
    {label: 'They are related', fn: () => makeLink(src.id, dst.id, 'r')},
    {sep: 1},
    {label: '⇄ The other way round', fn: () => openLinkChooser(a, b, x, y, !swapped)}
  ]);
}
function makeLink(from, to, type){
  const dup = lib.links.find(l => l[2] === type && ((l[0] === from && l[1] === to) || (l[0] === to && l[1] === from)));
  if(dup){ toast('They are already linked that way'); return; }
  const before = clone(lib);
  lib.links.push([from, to, type]);
  reindex(); touchLib([]); renderMap(true); refreshInfo();
  const ef = lib.entries[from], et = lib.entries[to], nm = e => (e.au ? shortAu(e.au) : mapLabel(e));
  toast('Linked: ' + nm(et) + ({b: ' builds on ', c: ' responds to ', r: ' and '})[type] + nm(ef) + (type === 'r' ? ' are related' : ''), () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
}
