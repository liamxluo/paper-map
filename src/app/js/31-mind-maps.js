/* ===================== mind maps =====================
   A second kind of map. It starts in the middle and spreads outward, as far as you like: papers from your library,
   books from Readings, and your own words, placed anywhere, joined by lines you can write on. No years, no rows.
   A mind map can be for one paper or one book: that one is pinned to its corner, and it opens from the paper too. */
const MM = {el: null, id: null, view: {x: 0, y: 0, k: 1}, sel: null, drag: null, pinT: null, editing: null};
function mindsAll(){ if(!Array.isArray(lib.minds)) lib.minds = []; return lib.minds; }
function mindOf(id){ return mindsAll().find(m => m.id === id) || null; }
const mmId = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function mmBook(id){ return (lib.readings || []).find(b => b.id === id) || null; }
function mmPinTitle(pin){ if(!pin) return ''; if(pin.kind === 'paper'){ const e = lib.entries[pin.id]; return e ? e.t : ''; } const b = mmBook(pin.id); return b ? b.title : ''; }
function mindNew(name, pin){
  const m = {id: mmId('mm'), name: (name || '').trim() || (pin ? mmPinTitle(pin) : 'Mind map'), created: new Date().toISOString(), updated: new Date().toISOString(), pin: pin || null, nodes: [], edges: [], view: null};
  if(pin) m.nodes.push({id: mmId('n'), type: pin.kind, ref: pin.id, x: 0, y: 0});
  mindsAll().push(m); touchLib(); return m;
}
function mmSave(){ const m = mindOf(MM.id); if(!m) return; m.updated = new Date().toISOString(); m.view = {x: MM.view.x - innerWidth / 2, y: MM.view.y - innerHeight / 2, k: MM.view.k}; touchLib(); }
/* ---- the page ---- */
function mmEnsure(){
  if(MM.el) return MM.el;
  const d = document.createElement('div'); d.id = 'mind'; d.hidden = true;
  d.innerHTML = '<div class="mm-sheet"></div>' +
    '<div class="mm-stage" id="mmStage"><div class="mm-world" id="mmWorld"><svg class="mm-svg" id="mmSvg" width="1" height="1"><g id="mmEdges"></g><path id="mmRubber" class="mm-rubber" d=""></path></svg><div id="mmNodes"></div></div></div>' +
    '<div class="mm-head"><h1 id="mmTitle" spellcheck="false"></h1><p id="mmSub"></p><i class="mm-rule"></i></div>' +
    '<div class="mm-bar mm-l"><button type="button" data-mm="back" aria-label="Back to the desk" title="Back to the desk"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button><button type="button" data-mm="maps" class="mm-name"><span id="mmName"></span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button></div>' +
    '<div class="mm-bar mm-r"><button type="button" data-mm="paper" aria-label="Add a paper" title="Add a paper"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M13.5 3v5.5H19"/><path d="M12 11.5v6M9 14.5h6"/></svg></button><button type="button" data-mm="book" aria-label="Add a book" title="Add a book"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.2C5 4.8 8.4 4.9 12 6.8c3.6-1.9 7-2 9.5-.6v12.6c-2.5-1.4-5.9-1.3-9.5.6-3.6-1.9-7-2-9.5-.6z"/><path d="M12 6.8v12.6"/><path d="M19 1.2v4M17 3.2h4"/></svg></button><button type="button" data-mm="text" aria-label="Add words" title="Add words"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5V4.5h11v2M9.5 4.5v13.5M7.5 18h4"/><path d="M18.5 12v7M15 15.5h7"/></svg></button><i class="mm-sep"></i><button type="button" data-mm="fit" aria-label="See all of it" title="See all of it"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button><button type="button" data-mm="export" aria-label="Export as vector PDF or SVG" title="Export as vector PDF or SVG"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/></svg></button><i class="mm-sep"></i><button type="button" data-mm="note" aria-label="Your research log" title="Your research log"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12.5 8h3.5M12.5 12h3.5"/></svg></button><button type="button" data-mm="sync" aria-label="Where your library is kept" title="Where your library is kept"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 18.5h9.8a4.2 4.2 0 0 0 .6-8.36A6 6 0 0 0 6.3 9.2a4.7 4.7 0 0 0 1.2 9.3z"/></svg></button><button type="button" data-mm="look" aria-label="Settings" title="Settings"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg></button></div>' +
    '<p class="mm-hint" id="mmHint">Click anywhere to begin</p>' +
    '<div class="mm-pin" id="mmPin" hidden><i class="mm-tack"></i><div class="mm-pin-in" id="mmPinIn"></div></div>' +
    '<div class="mm-pick" id="mmPick" hidden><input id="mmPickQ" type="search" placeholder="Find" autocomplete="off"><div id="mmPickList"></div></div>' +
    '<div class="mm-menu" id="mmMenu" hidden></div>';
  document.body.appendChild(d); MM.el = d; mmWire(); return d;
}
const mm$ = id => document.getElementById(id);
function mmApply(){ mm$('mmWorld').style.transform = 'translate(' + MM.view.x + 'px,' + MM.view.y + 'px) scale(' + MM.view.k + ')';
  const sh = MM.el && MM.el.querySelector('.mm-sheet'); if(sh){ sh.style.setProperty('--bgx', MM.view.x + 'px'); sh.style.setProperty('--bgy', MM.view.y + 'px'); sh.style.setProperty('--bgs', Math.max(40, 300 * MM.view.k) + 'px'); } }
function mmToWorld(cx, cy){ return [(cx - MM.view.x) / MM.view.k, (cy - MM.view.y) / MM.view.k]; }
function mmNodeHTML(n, m){
  let inner = '';
  if(n.type === 'paper'){ const e = lib.entries[n.ref]; if(!e) return '';
    const st = stOf(e); inner = '<p class="k">' + esc([e.y, e.v].filter(Boolean).join(' · ')) + '</p><b>' + esc(e.t || 'Untitled') + '</b><em>' + esc(shortAu ? shortAu(e.au) : (e.au || '')) + '</em>' + (st ? '<i class="st ' + st + '" title="' + (st === 'read' ? 'Read' : 'Want to read') + '"></i>' : ''); }
  else if(n.type === 'book'){ const b = mmBook(n.ref); if(!b) return '';
    inner = '<span class="cv"' + (b.cover ? ' style="background-image:url(&quot;' + esc(b.cover) + '&quot;)"' : '') + '></span><span class="bt"><b>' + esc(b.title) + '</b><em>' + esc((b.authors || []).join(', ')) + '</em></span>'; }
  else inner = '<div class="mm-txt"' + (MM.editing === n.id ? ' contenteditable="true"' : '') + '>' + esc(n.text || '') + '</div>';
  const pin = m.pin && n.type === m.pin.kind && n.ref === m.pin.id;
  return '<div class="mm-node t-' + n.type + (MM.sel === n.id ? ' sel' : '') + (pin ? ' root' : '') + (n.w ? ' sized' : '') + '" data-n="' + esc(n.id) + '" style="left:' + n.x + 'px;top:' + n.y + 'px' + (n.w ? ';width:' + n.w + 'px' : '') + '">' + inner + '<i class="mm-dot" data-dot="' + esc(n.id) + '" title="Drag to another to join them"></i>' + (n.type === 'text' ? '<i class="mm-rs" data-rs="' + esc(n.id) + '" title="Drag to size it"></i>' : '') + '</div>';
}
function mmCurve(a, b){ const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, bend = Math.min(60, d * .12), cx = (a.x + b.x) / 2 - dy / d * bend, cy = (a.y + b.y) / 2 + dx / d * bend;
  return {d: 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1), mx: (a.x + 2 * cx + b.x) / 4, my: (a.y + 2 * cy + b.y) / 4}; }
function mmRender(){
  const m = mindOf(MM.id); if(!m) return;
  const by = {}; m.nodes.forEach(n => by[n.id] = n);
  m.edges = m.edges.filter(e => by[e.a] && by[e.b]);
  mm$('mmEdges').innerHTML = m.edges.map(e => { const c = mmCurve(by[e.a], by[e.b]);
    return '<g class="mm-edge' + (MM.sel === e.id ? ' sel' : '') + '" data-e="' + esc(e.id) + '"><path class="hit" d="' + c.d + '"></path><path class="ln" d="' + c.d + '"' + (e.color ? ' style="stroke:' + e.color + '"' : '') + '></path>' + (e.label ? '<text x="' + c.mx.toFixed(1) + '" y="' + (c.my - 6).toFixed(1) + '" text-anchor="middle">' + esc(e.label) + '</text>' : '') + '</g>'; }).join('');
  mm$('mmNodes').innerHTML = m.nodes.map(n => mmNodeHTML(n, m)).join('');
  mm$('mmTitle').textContent = m.name; mm$('mmName').textContent = m.name;
  const np = m.nodes.filter(n => n.type === 'paper').length, nb = m.nodes.filter(n => n.type === 'book').length;
  mm$('mmSub').textContent = 'Mind map' + (np ? ' · ' + np + (np === 1 ? ' paper' : ' papers') : '') + (nb ? ' · ' + nb + (nb === 1 ? ' book' : ' books') : '');
  mm$('mmHint').hidden = m.nodes.length > 0;
  mmPinShow(m);
  if(MM.editing){ const t = document.querySelector('#mmNodes [data-n="' + MM.editing + '"] .mm-txt'); if(t){ t.focus(); const r = document.createRange(); r.selectNodeContents(t); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } }
}
/* the pinned paper or book: a sheet held by a pin in the corner; it lifts a little as the map moves under it */
function mmPinShow(m){
  const box = mm$('mmPin'), inn = mm$('mmPinIn'); if(!m.pin){ box.hidden = true; return; }
  let h = '';
  if(m.pin.kind === 'paper'){ const e = lib.entries[m.pin.id]; if(!e){ box.hidden = true; return; } h = '<p class="k">' + esc([e.y, e.v].filter(Boolean).join(' · ')) + '</p><b>' + esc(e.t || '') + '</b><em>' + esc(e.au || '') + '</em>'; }
  else { const b = mmBook(m.pin.id); if(!b){ box.hidden = true; return; } h = (b.cover ? '<span class="cv" style="background-image:url(&quot;' + esc(b.cover) + '&quot;)"></span>' : '') + '<p class="k">A book</p><b>' + esc(b.title) + '</b><em>' + esc((b.authors || []).join(', ')) + '</em>'; }
  inn.innerHTML = h; box.hidden = false; box.classList.toggle('book', m.pin.kind === 'book');
}
function mmWind(dx, dy){ const p = mm$('mmPin'); if(!p || p.hidden) return;
  const v = Math.max(-1, Math.min(1, (dx || 0) / 18)), u = Math.max(0, Math.min(1, (Math.abs(dx || 0) + Math.abs(dy || 0)) / 26));
  p.style.setProperty('--ry', (v * 9).toFixed(2) + 'deg'); p.style.setProperty('--rx', (u * 14).toFixed(2) + 'deg'); p.classList.add('blown');
  clearTimeout(MM.pinT); MM.pinT = setTimeout(() => { p.classList.remove('blown'); p.style.setProperty('--ry', '0deg'); p.style.setProperty('--rx', '0deg'); }, 160); }
/* ---- placing things: outward from where you are ---- */
function mmFreeSpot(m, from){
  const o = from || {x: 0, y: 0}, base = from && (from.x || from.y) ? Math.atan2(from.y, from.x) : -Math.PI / 2;
  for(let r = from ? 250 : 0; r < 2400; r += 90){ const steps = r ? [0, .5, -.5, 1, -1, 1.5, -1.5, 2.1, -2.1, Math.PI] : [0];
    for(const s of steps){ const a = base + s, x = Math.round(o.x + Math.cos(a) * r), y = Math.round(o.y + Math.sin(a) * r * .8);
      if(m.nodes.every(n => Math.hypot(n.x - x, (n.y - y) * 1.6) > 170)) return [x, y]; } }
  return [o.x + 60, o.y + 60];
}
function mmAdd(type, ref, at){
  const m = mindOf(MM.id); if(!m) return null;
  const from = MM.sel ? m.nodes.find(n => n.id === MM.sel) : null, [x, y] = at || mmFreeSpot(m, from);
  const n = {id: mmId('n'), type, x, y}; if(ref) n.ref = ref; if(type === 'text') n.text = '';
  m.nodes.push(n); if(from) m.edges.push({id: mmId('e'), a: from.id, b: n.id, label: ''});
  MM.sel = n.id; if(type === 'text') MM.editing = n.id; mmRender(); mmSave(); mmShow(n); return n;
}
function mmShow(n){ const sx = n.x * MM.view.k + MM.view.x, sy = n.y * MM.view.k + MM.view.y; if(sx < 120 || sx > innerWidth - 120 || sy < 140 || sy > innerHeight - 120){ MM.view.x += innerWidth / 2 - sx; MM.view.y += innerHeight / 2 - sy; mmApply(); } }
function mmFit(){ const m = mindOf(MM.id); if(!m) return;
  if(!m.nodes.length){ MM.view = {x: innerWidth / 2, y: innerHeight / 2 + 20, k: 1}; mmApply(); return; }
  const xs = m.nodes.map(n => n.x), ys = m.nodes.map(n => n.y), x0 = Math.min(...xs) - 160, x1 = Math.max(...xs) + 160, y0 = Math.min(...ys) - 110, y1 = Math.max(...ys) + 110;
  const k = Math.max(.35, Math.min(1.25, Math.min((innerWidth - 120) / (x1 - x0), (innerHeight - 260) / (y1 - y0))));
  MM.view = {x: innerWidth / 2 - (x0 + x1) / 2 * k, y: (innerHeight + 90) / 2 - (y0 + y1) / 2 * k, k}; mmApply(); mmSave(); }
/* ---- choosing a paper or a book from your library ---- */
function mmPick(kind){
  const pk = mm$('mmPick'), q = mm$('mmPickQ'), list = mm$('mmPickList'), m = mindOf(MM.id); if(!m) return;
  const on = new Set(m.nodes.filter(n => n.type === kind).map(n => n.ref));
  const all = kind === 'paper' ? Object.values(lib.entries).filter(e => e.kind === 'paper').map(e => ({id: e.id, t: e.t || 'Untitled', s: [shortAu ? shortAu(e.au) : e.au, e.y].filter(Boolean).join(' · ')})) : (lib.readings || []).map(b => ({id: b.id, t: b.title, s: [(b.authors || [])[0], b.year].filter(Boolean).join(' · ')}));
  const draw = () => { const s = q.value.trim().toLowerCase(); const items = all.filter(x => !on.has(x.id) && (!s || (x.t + ' ' + x.s).toLowerCase().includes(s))).slice(0, 60);
    list.innerHTML = items.length ? items.map(x => '<button type="button" data-pick="' + esc(x.id) + '"><b>' + esc(x.t) + '</b><span>' + esc(x.s) + '</span></button>').join('') : '<p>' + (all.length ? 'Nothing else to add' : kind === 'paper' ? 'Save a paper first: + on a map, or Papers' : 'Add a book to Readings first') + '</p>'; };
  pk.dataset.kind = kind; q.value = ''; draw(); q.oninput = draw; pk.hidden = false; setTimeout(() => q.focus(), 30);
}
/* ---- the menu under the map's name: every map, and this one's own ---- */
function mmMenu(){
  const box = mm$('mmMenu'), m = mindOf(MM.id); if(!m) return;
  const tl = lib.topics.map(t => '<button type="button" data-mm-tl="' + esc(t.id) + '"><b>' + esc(t.name) + '</b><span>Timeline</span></button>').join('');
  const mi = mindsAll().map(x => '<button type="button" data-mm-open="' + esc(x.id) + '"' + (x.id === m.id ? ' class="on"' : '') + '><b>' + esc(x.name) + '</b><span>Mind map' + (x.pin ? ' · pinned' : '') + '</span></button>').join('');
  box.innerHTML = '<p class="mk">YOUR MAPS</p>' + mi + tl + '<i class="ms"></i><button type="button" data-mm-act="rename"><b>Rename</b></button><button type="button" data-mm-act="new"><b>+ New map</b></button><button type="button" data-mm-act="delete" class="danger"><b>Delete this mind map</b></button>';
  box.hidden = !box.hidden;
}
/* ---- opening and closing ---- */
function openMind(id){
  const m = mindOf(id); if(!m) return; mmEnsure(); MM.id = id; MM.sel = null; MM.editing = null;
  if(!DK.mindFrom) DK.mindFrom = 'maps';
  MM.view = m.view ? {x: m.view.x + innerWidth / 2, y: m.view.y + innerHeight / 2, k: m.view.k || 1} : {x: innerWidth / 2, y: innerHeight / 2 + 20, k: 1};
  mmApply(); mmRender(); try{ deskHide(); }catch(e){}
  document.documentElement.classList.add('mind-on'); MM.el.hidden = false; requestAnimationFrame(() => MM.el.classList.add('on'));
  try{ document.title = m.name + ' · Paper Map'; }catch(e){}
}
function closeMind(toDesk){ if(!MM.el || MM.el.hidden) return; mmCommitText(); mmSave(); MM.el.classList.remove('on');
  setTimeout(() => { MM.el.hidden = true; document.documentElement.classList.remove('mind-on'); }, 260); MM.id = null; if(toDesk !== false) try{ DK.from = DK.mindFrom === 'desk' ? 'desk' : 'mind'; DK.mindFrom = null; deskOpen(); }catch(e){} }
function mmCommitText(){ if(!MM.editing) return; const m = mindOf(MM.id), id = MM.editing; MM.editing = null; if(!m) return;
  const el = document.querySelector('#mmNodes [data-n="' + id + '"] .mm-txt'), n = m.nodes.find(x => x.id === id); if(!n) return;
  const t = el ? el.innerText.trim() : (n.text || ''); if(!t){ m.nodes = m.nodes.filter(x => x.id !== id); m.edges = m.edges.filter(e => e.a !== id && e.b !== id); if(MM.sel === id) MM.sel = null; } else n.text = t;
  mmRender(); mmSave(); }
function mmDelete(){ const m = mindOf(MM.id); if(!m || !MM.sel) return; const id = MM.sel;
  if(m.edges.some(e => e.id === id)) m.edges = m.edges.filter(e => e.id !== id);
  else { const n = m.nodes.find(x => x.id === id); if(n && m.pin && n.type === m.pin.kind && n.ref === m.pin.id){ toast('The pinned one stays in the middle'); return; }
    m.nodes = m.nodes.filter(x => x.id !== id); m.edges = m.edges.filter(e => e.a !== id && e.b !== id); }
  MM.sel = null; mmRender(); mmSave(); }
function mmEditLabel(eid){ const m = mindOf(MM.id); if(!m) return; const e = m.edges.find(x => x.id === eid); if(!e) return;
  const g = document.querySelector('#mmEdges [data-e="' + eid + '"] .ln'); if(!g) return; const bb = g.getBoundingClientRect();
  const inp = document.createElement('input'); inp.className = 'mm-label-in'; inp.value = e.label || ''; inp.placeholder = 'on this line…';
  inp.style.left = (bb.left + bb.width / 2) + 'px'; inp.style.top = (bb.top + bb.height / 2) + 'px'; MM.el.appendChild(inp); inp.focus(); inp.select();
  let over = false; const done = keep => { if(over) return; over = true; if(keep){ e.label = inp.value.trim().slice(0, 80); mmSave(); } inp.remove(); mmRender(); };
  inp.addEventListener('keydown', ev => { ev.stopPropagation(); if(ev.key === 'Enter') done(true); else if(ev.key === 'Escape') done(false); }); inp.addEventListener('blur', () => done(true)); }
/* ---- what the hand does ---- */
function mmWire(){
  const st = mm$('mmStage');
  st.addEventListener('pointerdown', ev => {
    if(ev.button !== 0) return; mm$('mmMenu').hidden = true;
    const dot = ev.target.closest('[data-dot]'), node = ev.target.closest('.mm-node'), edge = ev.target.closest('.mm-edge');
    if(MM.editing && !(node && node.dataset.n === MM.editing)) mmCommitText();
    if(node && node.querySelector('[contenteditable="true"]') && ev.target.closest('.mm-txt')) return;
    const m = mindOf(MM.id); if(!m) return;
    const rs = ev.target.closest('[data-rs]');
    if(rs){ ev.preventDefault(); const n = m.nodes.find(x => x.id === rs.dataset.rs), el = rs.closest('.mm-node'); MM.drag = {kind: 'size', n, el, sx: ev.clientX, ow: el.getBoundingClientRect().width / MM.view.k}; st.setPointerCapture(ev.pointerId); return; }
    if(dot){ ev.preventDefault(); MM.drag = {kind: 'link', from: dot.dataset.dot, sx: ev.clientX, sy: ev.clientY}; st.setPointerCapture(ev.pointerId); return; }
    if(node){ const n = m.nodes.find(x => x.id === node.dataset.n); MM.drag = {kind: 'node', n, sx: ev.clientX, sy: ev.clientY, ox: n.x, oy: n.y, moved: false}; st.setPointerCapture(ev.pointerId); return; }
    if(edge){ MM.sel = edge.dataset.e; mmRender(); return; }
    MM.drag = {kind: 'pan', sx: ev.clientX, sy: ev.clientY, lx: ev.clientX, ly: ev.clientY, vx: MM.view.x, vy: MM.view.y, moved: false}; st.setPointerCapture(ev.pointerId); st.classList.add('panning');
  });
  st.addEventListener('pointermove', ev => { const d = MM.drag; if(!d) return;
    if(d.kind === 'pan'){ const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy; if(Math.hypot(dx, dy) > 3) d.moved = true; MM.view.x = d.vx + dx; MM.view.y = d.vy + dy; mmApply(); mmWind(ev.clientX - d.lx, ev.clientY - d.ly); d.lx = ev.clientX; d.ly = ev.clientY; }
    else if(d.kind === 'node'){ const dx = (ev.clientX - d.sx) / MM.view.k, dy = (ev.clientY - d.sy) / MM.view.k; if(Math.hypot(dx, dy) > 3) d.moved = true; if(!d.moved) return; d.n.x = Math.round(d.ox + dx); d.n.y = Math.round(d.oy + dy); const el = document.querySelector('#mmNodes [data-n="' + d.n.id + '"]'); if(el){ el.style.left = d.n.x + 'px'; el.style.top = d.n.y + 'px'; } mmEdgesOnly(); }
    else if(d.kind === 'size'){ const w = Math.round(Math.max(90, Math.min(900, d.ow + 2 * (ev.clientX - d.sx) / MM.view.k))); d.n.w = w; d.el.style.width = w + 'px'; d.el.classList.add('sized'); }
    else if(d.kind === 'link'){ const m = mindOf(MM.id), a = m.nodes.find(x => x.id === d.from), [wx, wy] = mmToWorld(ev.clientX, ev.clientY); mm$('mmRubber').setAttribute('d', mmCurve(a, {x: wx, y: wy}).d);
      document.querySelectorAll('#mmNodes .mm-node.target').forEach(x => x.classList.remove('target')); const t = document.elementFromPoint(ev.clientX, ev.clientY), tn = t && t.closest && t.closest('.mm-node'); if(tn && tn.dataset.n !== d.from) tn.classList.add('target'); }
  });
  const end = ev => { const d = MM.drag; MM.drag = null; st.classList.remove('panning'); if(!d) return; const m = mindOf(MM.id); if(!m) return;
    if(d.kind === 'pan'){ if(d.moved){ mmSave(); return; } MM.sel = null;
      if(!m.nodes.length){ const [wx, wy] = mmToWorld(ev.clientX, ev.clientY); mmAdd('text', null, [Math.round(wx), Math.round(wy)]); return; } mmRender(); return; }
    if(d.kind === 'size'){ mmSave(); mmEdgesOnly(); return; }
    if(d.kind === 'node'){ if(d.moved){ mmSave(); return; } MM.sel = d.n.id; mmRender(); return; }
    if(d.kind === 'link'){ mm$('mmRubber').setAttribute('d', ''); const t = document.elementFromPoint(ev.clientX, ev.clientY), tn = t && t.closest && t.closest('.mm-node');
      document.querySelectorAll('#mmNodes .mm-node.target').forEach(x => x.classList.remove('target'));
      if(tn && tn.dataset.n !== d.from){ const b = tn.dataset.n; if(!m.edges.some(e => (e.a === d.from && e.b === b) || (e.a === b && e.b === d.from))){ const e = {id: mmId('e'), a: d.from, b, label: ''}; m.edges.push(e); MM.sel = e.id; mmRender(); mmSave(); setTimeout(() => mmEditLabel(e.id), 60); } }
      else if(Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) > 40){ const [wx, wy] = mmToWorld(ev.clientX, ev.clientY); MM.sel = d.from; mmAdd('text', null, [Math.round(wx), Math.round(wy)]); } }
  };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
  st.addEventListener('dblclick', ev => { const node = ev.target.closest('.mm-node'), edge = ev.target.closest('.mm-edge'); const m = mindOf(MM.id); if(!m) return;
    if(edge){ mmEditLabel(edge.dataset.e); return; }
    if(node){ const n = m.nodes.find(x => x.id === node.dataset.n); if(!n) return;
      if(n.type === 'text'){ MM.editing = n.id; MM.sel = n.id; mmRender(); }
      else if(n.type === 'paper'){ try{ openReader(n.ref); }catch(e){} }
      return; }
    const [wx, wy] = mmToWorld(ev.clientX, ev.clientY); MM.sel = null; mmAdd('text', null, [Math.round(wx), Math.round(wy)]); });
  st.addEventListener('wheel', ev => { ev.preventDefault();
    if(ev.ctrlKey || ev.metaKey){ const k0 = MM.view.k, k = Math.max(.3, Math.min(2.2, k0 * Math.exp(-ev.deltaY * .01))), [wx, wy] = mmToWorld(ev.clientX, ev.clientY); MM.view.k = k; MM.view.x = ev.clientX - wx * k; MM.view.y = ev.clientY - wy * k; }
    else { MM.view.x -= ev.deltaX; MM.view.y -= ev.deltaY; mmWind(-ev.deltaX, -ev.deltaY); }
    mmApply(); clearTimeout(MM.wt); MM.wt = setTimeout(mmSave, 400); }, {passive: false});
  st.addEventListener('contextmenu', ev => { const node = ev.target.closest('.mm-node'), edge = ev.target.closest('.mm-edge'); if(!node && !edge) return; ev.preventDefault();
    MM.sel = (node && node.dataset.n) || edge.dataset.e; mmRender(); const m = mindOf(MM.id), n = node && m.nodes.find(x => x.id === node.dataset.n);
    const items = []; if(n && n.type === 'paper') items.push({label: 'Notes & PDF', fn: () => openReader(n.ref)}); if(n && n.type === 'text') items.push({label: 'Edit', fn: () => { MM.editing = n.id; mmRender(); }});
    if(edge){ const eid = edge.dataset.e, px = ev.clientX, py = ev.clientY; items.push({label: 'Write on this line', fn: () => mmEditLabel(eid)}, {label: 'Colour of the line…', fn: () => mmLineColour(eid, px, py)}); } items.push({sep: 1}, {label: 'Delete', danger: 1, fn: mmDelete});
    openFloatMenu(ev.clientX + 2, ev.clientY + 2, items); });
  MM.el.addEventListener('click', ev => {
    const bx = ev.target.closest('[data-mm="export"],[data-mm="note"],[data-mm="sync"],[data-mm="look"]');
    if(bx){ const k = bx.dataset.mm; if(k === 'export') mmExportMenu(bx); else if(k === 'note') atlasNote(bx); else if(k === 'sync') atlasSync(bx); else atlasLook(bx); return; }
    const b = ev.target.closest('[data-mm]'), pick = ev.target.closest('[data-pick]'), menu = ev.target.closest('#mmMenu button');
    if(pick){ const kind = mm$('mmPick').dataset.kind; mm$('mmPick').hidden = true; mmAdd(kind, pick.dataset.pick); return; }
    if(menu){ mm$('mmMenu').hidden = true;
      if(menu.dataset.mmOpen) openMind(menu.dataset.mmOpen);
      else if(menu.dataset.mmTl){ closeMind(false); openView(menu.dataset.mmTl + '-all'); }
      else if(menu.dataset.mmAct === 'rename'){ const t = mm$('mmTitle'); t.contentEditable = 'true'; t.focus(); const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      else if(menu.dataset.mmAct === 'new') mapKindChooser();
      else if(menu.dataset.mmAct === 'delete'){ const m = mindOf(MM.id); if(m && confirm('Delete the mind map “' + m.name + '”? The papers and books stay in your library.')){ lib.minds = mindsAll().filter(x => x.id !== m.id); touchLib(); closeMind(); } }
      return; }
    if(!b) { if(!ev.target.closest('#mmPick')) mm$('mmPick').hidden = true; return; }
    const a = b.dataset.mm; if(a !== 'maps') mm$('mmMenu').hidden = true;
    if(a === 'back') closeMind(); else if(a === 'maps') mmMenu(); else if(a === 'fit') mmFit();
    else if(a === 'text') mmAdd('text'); else if(a === 'paper' || a === 'book') mmPick(a);
  });
  mm$('mmTitle').addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); ev.target.blur(); } });
  mm$('mmTitle').addEventListener('blur', ev => { if(ev.target.contentEditable !== 'true') return; ev.target.contentEditable = 'false'; const m = mindOf(MM.id), v = ev.target.textContent.trim(); if(m && v){ m.name = v.slice(0, 80); mmSave(); } mmRender(); });
  mm$('mmPin').addEventListener('click', () => { const m = mindOf(MM.id); if(m && m.pin && m.pin.kind === 'paper') try{ openReader(m.pin.id); }catch(e){} });
  document.addEventListener('keydown', ev => { if(!MM.el || MM.el.hidden || MM.editing || /INPUT|TEXTAREA/.test((ev.target || {}).tagName || '') || (ev.target && ev.target.isContentEditable)) return;
    if(ev.key === 'Backspace' || ev.key === 'Delete'){ if(MM.sel){ ev.preventDefault(); mmDelete(); } }
    else if(ev.key === 'Escape'){ if(!mm$('mmPick').hidden) mm$('mmPick').hidden = true; else if(MM.sel){ MM.sel = null; mmRender(); } } });
  mm$('mmPickQ').addEventListener('keydown', ev => { if(ev.key === 'Escape') mm$('mmPick').hidden = true; if(ev.key === 'Enter'){ const f = mm$('mmPickList').querySelector('[data-pick]'); if(f) f.click(); } });
  addEventListener('resize', () => { if(MM.el && !MM.el.hidden) mmApply(); });
}
function mmEdgesOnly(){ const m = mindOf(MM.id); if(!m) return; const by = {}; m.nodes.forEach(n => by[n.id] = n);
  m.edges.forEach(e => { const g = document.querySelector('#mmEdges [data-e="' + e.id + '"]'); if(!g || !by[e.a] || !by[e.b]) return; const c = mmCurve(by[e.a], by[e.b]);
    g.querySelectorAll('path').forEach(p => p.setAttribute('d', c.d)); const t = g.querySelector('text'); if(t){ t.setAttribute('x', c.mx.toFixed(1)); t.setAttribute('y', (c.my - 6).toFixed(1)); } }); }
/* ---- a new map: which kind ---- */
function mapKindChooser(pin){
  openModal({title: 'A new map', body: '<div class="mk-choose"><button type="button" data-kind="timeline"><svg viewBox="0 0 120 64" aria-hidden="true"><path d="M8 50H112" stroke="currentColor" stroke-width="1.2" opacity=".35"/><path d="M14 40C34 38 40 22 60 24S92 34 108 18" fill="none" stroke="#B4432E" stroke-width="2"/><g fill="currentColor"><circle cx="22" cy="39" r="3"/><circle cx="60" cy="24" r="3.4"/><circle cx="96" cy="26" r="3"/></g></svg><b>Timeline</b><span>Papers on their years</span></button>' +
    '<button type="button" data-kind="mind"><svg viewBox="0 0 120 64" aria-hidden="true"><g stroke="currentColor" stroke-width="1.3" fill="none" opacity=".7"><path d="M60 32Q40 18 22 14"/><path d="M60 32Q84 20 100 12"/><path d="M60 32Q44 46 26 52"/><path d="M60 32Q82 46 98 52"/></g><rect x="48" y="25" width="24" height="14" rx="4" fill="currentColor"/><g fill="currentColor"><circle cx="20" cy="13" r="3"/><circle cx="102" cy="11" r="3"/><circle cx="24" cy="53" r="3"/><circle cx="100" cy="53" r="3"/></g></svg><b>Mind map</b><span>From the middle, outward</span></button></div>' +
    '<label class="mk-name">Name<input type="text" id="mkName" placeholder="' + esc(pin ? mmPinTitle(pin) : 'Untitled') + '" autocomplete="off"></label>',
    actions: [{label: 'Cancel'}]});
  const body = document.getElementById('modalBody');
  body.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => { const name = (document.getElementById('mkName') || {}).value || '';
    closeModal(); if(b.dataset.kind === 'timeline'){ setTimeout(() => { try{ _otfOriginal(); const t = document.querySelector('#modalBody input'); if(t && name) t.value = name; }catch(e){} }, 0); return; }
    const m = mindNew(name, pin || null); setTimeout(() => openMind(m.id), 0); }));
}
let _otfOriginal = null;
{ _otfOriginal = openTopicForm; openTopicForm = function(tid){ if(tid) return _otfOriginal.apply(this, arguments); mapKindChooser(); }; }
/* a mind map for one paper or one book: the one pinned to it, or a new one with it in the middle */
function mindFor(kind, id){ let m = mindsAll().find(x => x.pin && x.pin.kind === kind && x.pin.id === id); if(!m) m = mindNew('', {kind, id}); openMind(m.id); return m.id; }

/* ===================== a mind map's lines in colour, and the map as a vector PDF or an SVG ===================== */
const MM_LINE_COLOURS = [['#231E1A', 'Ink'], ['#B4432E', 'Red'], ['#2F5E8E', 'Blue'], ['#2F6B4A', 'Green'], ['#B8862E', 'Ochre'], ['#6B3F6B', 'Plum']];
function mmLineColour(eid, x, y){ let pal = document.getElementById('mmPal'); if(!pal){ pal = document.createElement('div'); pal.id = 'mmPal'; pal.className = 'mm-pal'; document.body.appendChild(pal);
    document.addEventListener('pointerdown', ev => { if(!pal.hidden && !ev.target.closest('#mmPal')) pal.hidden = true; }, true); }
  const m = mindOf(MM.id), e = m && m.edges.find(z => z.id === eid); if(!e) return;
  pal.innerHTML = MM_LINE_COLOURS.map(c => '<button type="button" data-c="' + c[0] + '" title="' + c[1] + '" aria-label="' + c[1] + '" style="background:' + c[0] + '"' + ((e.color || '#231E1A') === c[0] ? ' class="on"' : '') + '></button>').join('');
  pal.style.left = Math.min(innerWidth - 230, x) + 'px'; pal.style.top = Math.min(innerHeight - 60, y) + 'px'; pal.hidden = false;
  pal.onclick = ev => { const b = ev.target.closest('[data-c]'); if(!b) return; e.color = b.dataset.c === '#231E1A' ? '' : b.dataset.c; pal.hidden = true; mmSave(); mmRender(); }; }
function mmExportMenu(btn){ const r = btn.getBoundingClientRect(); openFloatMenu(r.left, r.bottom + 6, [{label: 'Vector PDF', fn: () => mmExport('pdf')}, {label: 'SVG', fn: () => mmExport('svg')}]); }
function mmWrap(text, font, maxW){ const g = pdfMeasureCtx(); g.font = font; const out = []; String(text || '').split(/\n/).forEach(par => { let line = '';
    par.split(/\s+/).filter(Boolean).forEach(w => { const t = line ? line + ' ' + w : w; if(g.measureText(t).width > maxW && line){ out.push(line); line = w; } else line = t; }); out.push(line); }); return out; }
function mmSvg(){ const m = mindOf(MM.id); if(!m) return null; const by = {}; m.nodes.forEach(n => by[n.id] = n);
  const xe = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const boxes = [], parts = []; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  m.nodes.forEach(n => { const el = document.querySelector('#mmNodes .mm-node[data-n="' + n.id + '"]'); if(!el) return; const w = el.offsetWidth, h = el.offsetHeight, bx = n.x - w / 2, by2 = n.y - h / 2;
    boxes.push({n, el, w, h, x: bx, y: by2}); x0 = Math.min(x0, bx); y0 = Math.min(y0, by2); x1 = Math.max(x1, bx + w); y1 = Math.max(y1, by2 + h); });
  if(!boxes.length) return null;
  const pad = 48; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad; const W = Math.ceil(x1 - x0), H = Math.ceil(y1 - y0);
  parts.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + W + '" height="' + H + '" fill="#FBF8F2"/>');
  m.edges.forEach(e => { if(!by[e.a] || !by[e.b]) return; const c = mmCurve(by[e.a], by[e.b]);
    parts.push('<path d="' + c.d + '" fill="none" stroke="' + (e.color || '#231E1A') + '" stroke-width="1.6" stroke-linecap="round"/>');
    if(e.label) parts.push('<text x="' + c.mx.toFixed(1) + '" y="' + (c.my - 6).toFixed(1) + '" text-anchor="middle" font-family="Times New Roman, serif" font-style="italic" font-size="12" fill="#5E544A">' + xe(e.label) + '</text>'); });
  boxes.forEach(B => { const {n, el, w, h, x, y} = B, card = n.type !== 'text';
    if(card) parts.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w + '" height="' + h + '" rx="6" fill="#FFFDF8" stroke="#D9D0C1" stroke-width="1"/>');
    let ty = y + 18; const lx = x + 12, maxW = w - 24, line = (t, size, weight, style, fam, colour) => { parts.push('<text x="' + lx.toFixed(1) + '" y="' + ty.toFixed(1) + '" font-family="' + fam + '" font-size="' + size + '"' + (weight ? ' font-weight="' + weight + '"' : '') + (style ? ' font-style="' + style + '"' : '') + ' fill="' + colour + '">' + xe(t) + '</text>'); ty += size * 1.3; };
    if(card){ const k = el.querySelector('.k'), b = el.querySelector('b'), em = el.querySelector('em');
      if(k && k.textContent.trim()) line(k.textContent.trim().toUpperCase(), 8.5, 700, '', 'Helvetica, Arial, sans-serif', '#8A7F72');
      if(b) mmWrap(b.textContent.trim(), '700 14px "Times New Roman", serif', maxW).forEach(t => line(t, 14, 700, '', 'Times New Roman, serif', '#231E1A'));
      if(em && em.textContent.trim()) line(em.textContent.trim(), 11.5, '', 'italic', 'Times New Roman, serif', '#5E544A'); }
    else { const t = (el.querySelector('.mm-txt') || el).innerText.trim(); ty = y + 20; mmWrap(t, '400 15px "Times New Roman", serif', w - 16).forEach(s2 => { parts.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + ty.toFixed(1) + '" text-anchor="middle" font-family="Times New Roman, serif" font-size="15" fill="#231E1A">' + xe(s2) + '</text>'); ty += 19.5; }); } });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' ' + W + ' ' + H + '"><g>' + parts.join('') + '</g></svg>';
  return {svg, w: W, h: H, x0, y0, name: m.name}; }
async function mmExport(kind){ const x = mmSvg(); if(!x){ toast('Nothing on this mind map yet'); return; } const name = slugName(x.name || 'mind-map');
  if(kind === 'svg'){ await saveBlobAs(new Blob([x.svg], {type: 'image/svg+xml'}), name + '.svg'); return; }
  const shifted = x.svg.replace(/viewBox="[^"]*"/, 'viewBox="0 0 ' + x.w + ' ' + x.h + '"').replace('<g>', '<g transform="translate(' + (-x.x0).toFixed(1) + ',' + (-x.y0).toFixed(1) + ')">');
  const page = mapPdfPage({w: x.w, h: x.h, svg: shifted}); await saveBlobAs(vectorPdf([page], x.name || 'Mind map'), name + '.pdf'); }
