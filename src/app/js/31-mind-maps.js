/* ===================== mind maps =====================
   A second kind of map. It starts in the middle and spreads outward, as far as you like: papers from your library,
   books from Readings, and your own words, placed anywhere, joined by lines you can write on. No years, no rows.
   A mind map can be for one paper or one book: that one is pinned to its corner, and it opens from the paper too. */
const MM = {el: null, id: null, view: {x: 0, y: 0, k: 1}, sel: null, drag: null, pinT: null, editing: null, dock: null};
function mmBox(){ return MM.dock || {l: 0, t: 0, w: innerWidth, h: innerHeight}; }
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
function mmSave(){ const m = mindOf(MM.id); if(!m) return; const b = mmBox(); m.updated = new Date().toISOString(); m.view = {x: MM.view.x - (b.l + b.w / 2), y: MM.view.y - (b.t + b.h / 2), k: MM.view.k}; touchLib(); }
/* ---- the page ---- */
function mmEnsure(){
  if(MM.el) return MM.el;
  const d = document.createElement('div'); d.id = 'mind'; d.hidden = true;
  d.innerHTML = '<div class="mm-sheet"></div>' +
    '<div class="mm-stage" id="mmStage"><div class="mm-world" id="mmWorld"><svg class="mm-svg" id="mmSvg" width="1" height="1"><g id="mmEdges"></g><path id="mmRubber" class="mm-rubber" d=""></path></svg><div id="mmNodes"></div><svg class="mm-ink" id="mmInk" width="1" height="1"><g id="mmInkG"></g><path id="mmInkCur" d=""></path><circle id="mmEraser" r="0" cx="0" cy="0"></circle></svg></div></div>' +
    '<div class="mm-head"><h1 id="mmTitle" spellcheck="false"></h1><p id="mmSub"></p><i class="mm-rule"></i></div>' +
    '<div class="mm-bar mm-l"><button type="button" data-mm="back" aria-label="Back to the desk" title="Back to the desk"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button><button type="button" data-mm="maps" class="mm-name"><span id="mmName"></span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button></div>' +
    '<div class="mm-bar mm-r"><button type="button" data-mm="undo" aria-label="Undo" title="Undo (⌘Z)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/></svg></button><button type="button" data-mm="redo" aria-label="Redo" title="Redo (⇧⌘Z)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7l4.5 4.5L15 16"/><path d="M19 11.5h-9a5 5 0 0 0 0 10h2"/></svg></button><button type="button" data-mm="versions" aria-label="Earlier versions" title="Earlier versions of this map"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg></button><i class="mm-sep"></i><button type="button" data-mm="axis" aria-label="Time axis" title="Time axis"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 7h18M6 4v6M12 4v6M18 4v6"/><path d="M7 16h4M10 19h6" opacity=".6"/></svg></button><button type="button" data-mm="addmap" aria-label="Put a map in this map" title="Put a map in this map"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="10" r="1.6"/><circle cx="15.5" cy="8" r="1.4"/><circle cx="15" cy="15.5" r="1.4"/><path d="M10.4 9.6l3.7-1.2M10.2 11l3.6 3.4"/></svg></button><button type="button" data-mm="select" aria-label="Choose several" title="Choose several (or shift and drag)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-dasharray="3 2.6"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/></svg></button><button type="button" data-mm="outline" aria-label="Outline and search" title="Outline and search (⌘F)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 6h3M10 6h10M7 12h3M13 12h7M10 18h3M16 18h4"/></svg></button><button type="button" data-mm="ink" aria-label="Write by hand" title="Write by hand"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20z"/><path d="M14 7l3 3"/></svg></button><button type="button" class="mm-dock-only" data-mm="marks" aria-label="Your highlights, quotes and notes" title="Your highlights, quotes and notes"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h7M7 11h10M7 15h6"/><path d="M4 4h16v16H4z" opacity=".55"/></svg></button><button type="button" data-mm="paper" aria-label="Add a paper" title="Add a paper"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M13.5 3v5.5H19"/><path d="M12 11.5v6M9 14.5h6"/></svg></button><button type="button" data-mm="book" aria-label="Add a book" title="Add a book"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.2C5 4.8 8.4 4.9 12 6.8c3.6-1.9 7-2 9.5-.6v12.6c-2.5-1.4-5.9-1.3-9.5.6-3.6-1.9-7-2-9.5-.6z"/><path d="M12 6.8v12.6"/><path d="M19 1.2v4M17 3.2h4"/></svg></button><button type="button" data-mm="text" aria-label="Add words" title="Add words"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5V4.5h11v2M9.5 4.5v13.5M7.5 18h4"/><path d="M18.5 12v7M15 15.5h7"/></svg></button><i class="mm-sep"></i><button type="button" data-mm="fit" aria-label="See all of it" title="See all of it"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button><button type="button" data-mm="export" aria-label="Export as vector PDF or SVG" title="Export as vector PDF or SVG"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/></svg></button><i class="mm-sep"></i><button type="button" data-mm="note" aria-label="Your research log" title="Your research log"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12.5 8h3.5M12.5 12h3.5"/></svg></button><button type="button" data-mm="sync" aria-label="Where your library is kept" title="Where your library is kept"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 18.5h9.8a4.2 4.2 0 0 0 .6-8.36A6 6 0 0 0 6.3 9.2a4.7 4.7 0 0 0 1.2 9.3z"/></svg></button><button type="button" data-mm="look" aria-label="Settings" title="Settings"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg></button></div>' +
    '<p class="mm-hint" id="mmHint">Click anywhere to begin</p>' +
    '<div class="mm-pin" id="mmPin" hidden><i class="mm-tack"></i><div class="mm-pin-in" id="mmPinIn"></div></div>' +
    '<div class="mm-pick" id="mmPick" hidden><input id="mmPickQ" type="search" placeholder="Find" autocomplete="off"><div id="mmPickList"></div></div>' +
    '<div class="mm-menu" id="mmMenu" hidden></div><div class="mm-inktools" id="mmInkTools" hidden></div><button type="button" class="mm-dockswitch mm-dock-only" data-mm="dockswitch"><span id="mmDockName"></span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button><button type="button" class="mm-trail" data-mm="trail" hidden></button>';
  document.body.appendChild(d); MM.el = d; mmWire(); return d;
}
const mm$ = id => document.getElementById(id);
function mmApply(){ const bx = mmBox(); mm$('mmWorld').style.transform = 'translate(' + (MM.view.x - bx.l) + 'px,' + (MM.view.y - bx.t) + 'px) scale(' + MM.view.k + ')';
  const sh = MM.el && MM.el.querySelector('.mm-sheet'); if(sh){ sh.style.setProperty('--bgx', MM.view.x + 'px'); sh.style.setProperty('--bgy', MM.view.y + 'px'); sh.style.setProperty('--bgs', Math.max(40, 300 * MM.view.k) + 'px'); } }
function mmToWorld(cx, cy){ return [(cx - MM.view.x) / MM.view.k, (cy - MM.view.y) / MM.view.k]; }
function mmNodeHTML(n, m){
  let inner = '';
  if(n.type === 'paper'){ const e = lib.entries[n.ref]; if(!e) return '';
    const st = stOf(e); inner = '<p class="k">' + esc([e.y, e.v].filter(Boolean).join(' · ')) + '</p><b>' + esc(e.t || 'Untitled') + '</b><em>' + esc(shortAu ? shortAu(e.au) : (e.au || '')) + '</em>' + (st ? '<i class="st ' + st + '" title="' + (st === 'read' ? 'Read' : 'Want to read') + '"></i>' : ''); }
  else if(n.type === 'book'){ const b = mmBook(n.ref); if(!b) return '';
    inner = '<span class="cv"' + (b.cover ? ' style="background-image:url(&quot;' + esc(b.cover) + '&quot;)"' : '') + '></span><span class="bt"><b>' + esc(b.title) + '</b><em>' + esc((b.authors || []).join(', ')) + '</em></span>'; }
  else if(n.type === 'map'){ const sub = mindOf(n.ref); inner = '<span class="mm-mini">' + (sub ? mmMiniSvg(sub, 240, 132) : '') + '</span><span class="mm-mapt"><b>' + esc(sub ? sub.name : 'A map in the bin') + '</b><em>' + (sub ? sub.nodes.length + (sub.nodes.length === 1 ? ' idea' : ' ideas') : '') + '</em></span><button type="button" class="mm-linkchip" data-gomap="' + esc(n.ref || '') + '">Open ↗</button>'; }
  else if(n.type === 'image'){ inner = '<span class="mm-pic" style="aspect-ratio:' + (n.pw || 4) + '/' + (n.ph || 3) + '"><img data-clip="' + esc(n.clip || '') + '" alt="" draggable="false"></span>' + (n.cite ? '<em class="mm-cite">' + esc(n.cite) + '</em>' : ''); }
  else inner = '<div class="mm-txt"' + (MM.editing === n.id ? ' contenteditable="true"' : '') + '>' + esc(n.text || '') + '</div>';
  if(n.link){ const lm = mindOf(n.link); inner += '<button type="button" class="mm-linkchip" data-golink="' + esc(n.link) + '" title="Open this map">↗ ' + esc(lm ? lm.name : 'A map in the bin') + '</button>'; }
  inner += mmXlChips(n, m);
  const pin = m.pin && n.type === m.pin.kind && n.ref === m.pin.id;
  return '<div class="mm-node t-' + n.type + (n.shape ? ' sh-' + n.shape : '') + (n.ts ? ' ts-' + n.ts : '') + (n.fill ? ' filled' : '') + (n.bold ? ' bold' : '') + (n.link ? ' linked' : '') + (MM.multi && MM.multi.has(n.id) ? ' multi' : '') + (MM.sel === n.id ? ' sel' : '') + (pin ? ' root' : '') + (n.w || n.type === 'image' ? ' sized' : '') + '" data-n="' + esc(n.id) + '" style="left:' + n.x + 'px;top:' + n.y + 'px' + (n.w || n.type === 'image' ? ';width:' + (n.w || 300) + 'px' : '') + (n.fill ? ';--fill:' + n.fill : '') + (n.ink ? ';--tink:' + n.ink : '') + '">' + inner + '<i class="mm-dot" data-dot="' + esc(n.id) + '" title="Drag to another to join them"></i>' + (n.type === 'text' ? '<i class="mm-rs" data-rs="' + esc(n.id) + '" title="Drag to size it"></i>' : '') + '</div>';
}
function mmCurve(a, b){ const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, bend = Math.min(60, d * .12), cx = (a.x + b.x) / 2 - dy / d * bend, cy = (a.y + b.y) / 2 + dx / d * bend;
  return {d: 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1), mx: (a.x + 2 * cx + b.x) / 4, my: (a.y + 2 * cy + b.y) / 4}; }
function mmRender(){
  const m = mindOf(MM.id); if(!m) return;
  const by = {}; m.nodes.forEach(n => by[n.id] = n);
  m.edges = m.edges.filter(e => by[e.a] && by[e.b]);
  mm$('mmEdges').innerHTML = m.edges.map(e => mmEdgeHTML(e, by)).join('');
  mm$('mmNodes').innerHTML = m.nodes.map(n => mmNodeHTML(n, m)).join(''); try{ mmInkRender(m); }catch(e){} try{ mmPicsFill(m); }catch(e){}
  if(mmMeasure(m)) mm$('mmEdges').innerHTML = m.edges.map(e => mmEdgeHTML(e, by)).join('');
  mm$('mmTitle').textContent = m.name; mm$('mmName').textContent = m.name;
  const np = m.nodes.filter(n => n.type === 'paper').length, nb = m.nodes.filter(n => n.type === 'book').length;
  mm$('mmSub').textContent = (m.axis && m.axis.on ? 'Timeline mind map' : 'Mind map') + (np ? ' · ' + np + (np === 1 ? ' paper' : ' papers') : '') + (nb ? ' · ' + nb + (nb === 1 ? ' book' : ' books') : '');
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
  if(MM.editing) mmCommitText(); const m = mindOf(MM.id); if(!m) return null;
  const from = MM.sel ? m.nodes.find(n => n.id === MM.sel) : null, [x, y] = at || mmFreeSpot(m, from);
  const n = {id: mmId('n'), type, x, y}; if(ref) n.ref = ref; if(type === 'text') n.text = '';
  m.nodes.push(n); if(from) m.edges.push({id: mmId('e'), a: from.id, b: n.id, label: ''});
  MM.sel = n.id; if(type === 'text') MM.editing = n.id; mmRender(); mmSave(); mmShow(n); if(type === 'text') mmFocusText(n.id); return n;
}
function mmShow(n){ const b = mmBox(), sz = MM.sz[n.id] || (n.type === 'image' ? [n.w || 300, (n.w || 300) * (n.ph || 3) / (n.pw || 4) + 30] : [150, 46]), hw = sz[0] / 2 * MM.view.k, hh = sz[1] / 2 * MM.view.k, sx = n.x * MM.view.k + MM.view.x, sy = n.y * MM.view.k + MM.view.y, mx = (MM.dock ? 30 : 60) + hw, my = (MM.dock ? 120 : 150) + hh; if(sx < b.l + mx || sx > b.l + b.w - mx || sy < b.t + my || sy > b.t + b.h - (MM.dock ? 110 : 120) - hh){ MM.view.x += b.l + b.w / 2 - sx; MM.view.y += b.t + b.h / 2 - sy; mmApply(); } }
function mmFit(){ const m = mindOf(MM.id); if(!m) return;
  const B = mmBox(); if(!m.nodes.length){ MM.view = {x: B.l + B.w / 2, y: B.t + B.h / 2 + 20, k: 1}; mmApply(); return; }
  const xs = m.nodes.map(n => n.x), ys = m.nodes.map(n => n.y), x0 = Math.min(...xs) - 160, x1 = Math.max(...xs) + 160, y0 = Math.min(...ys) - 110, y1 = Math.max(...ys) + 110;
  const k = Math.max(.04, Math.min(1.6, Math.min((B.w - (MM.dock ? 60 : 120)) / (x1 - x0), (B.h - (MM.dock ? 120 : 260)) / (y1 - y0))));
  MM.view = {x: B.l + B.w / 2 - (x0 + x1) / 2 * k, y: B.t + (B.h + (MM.dock ? 40 : 90)) / 2 - (y0 + y1) / 2 * k, k}; mmApply(); mmSave(); }
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
  box.innerHTML = '<p class="mk">YOUR MAPS</p>' + mi + tl + '<i class="ms"></i><button type="button" data-mm-act="rename"><b>Rename</b></button><button type="button" data-mm-act="embed"><b>Put this map in another map…</b></button><button type="button" data-mm-act="bin"><b>Recently deleted</b></button><button type="button" data-mm-act="new"><b>+ New map</b></button><button type="button" data-mm-act="delete" class="danger"><b>Delete this mind map</b></button>';
  box.hidden = !box.hidden;
}
/* ---- opening and closing ---- */
function openMind(id){
  const m = mindOf(id); if(!m) return; mmEnsure(); MM.id = id; MM.sel = null; MM.editing = null;
  { const empty = new Set(m.nodes.filter(n => n.type === 'text' && !String(n.text || '').trim()).map(n => n.id)); if(empty.size){ m.nodes = m.nodes.filter(n => !empty.has(n.id)); m.edges = m.edges.filter(e => !empty.has(e.a) && !empty.has(e.b)); } }
  if(!DK.mindFrom) DK.mindFrom = 'maps';
  try{ deskTouchRecent('mind:' + id); }catch(e){}
  { const b = mmBox(); MM.view = m.view ? {x: m.view.x + b.l + b.w / 2, y: m.view.y + b.t + b.h / 2, k: m.view.k || 1} : {x: b.l + b.w / 2, y: b.t + b.h / 2 + 20, k: 1}; }
  mmApply(); mmRender(); try{ deskHide(); }catch(e){}
  document.documentElement.classList.add('mind-on'); MM.el.hidden = false; requestAnimationFrame(() => MM.el.classList.add('on'));
  try{ document.title = m.name + ' · Paper Map'; }catch(e){}
}
function closeMind(toDesk){ if(MM.dock){ mindUndock(); try{ const pg = deskPage(); pg && pg.mindClosed && pg.mindClosed(); }catch(e){} return; } if(!MM.el || MM.el.hidden) return; mmCommitText(); mmSave(); MM.el.classList.remove('on');
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
    if(edge){ mmSelect(edge.dataset.e); return; }
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
    if(d.kind === 'pan'){ if(d.moved){ mmSave(); return; }
      if(!m.nodes.length){ MM.sel = null; const [wx, wy] = mmToWorld(ev.clientX, ev.clientY); mmAdd('text', null, [Math.round(wx), Math.round(wy)]); return; } if(MM.editing){ mmCommitText(); } mmSelect(null); return; }
    if(d.kind === 'size'){ mmSave(); mmEdgesOnly(); return; }
    if(d.kind === 'node'){ if(d.moved){ mmSave(); return; } mmSelect(d.n.id); return; }
    if(d.kind === 'link'){ mm$('mmRubber').setAttribute('d', ''); const t = document.elementFromPoint(ev.clientX, ev.clientY), tn = t && t.closest && t.closest('.mm-node');
      document.querySelectorAll('#mmNodes .mm-node.target').forEach(x => x.classList.remove('target'));
      if(tn && tn.dataset.n !== d.from){ const b = tn.dataset.n; if(!m.edges.some(e => (e.a === d.from && e.b === b) || (e.a === b && e.b === d.from))){ const e = Object.assign({id: mmId('e'), a: d.from, b, label: ''}, mmEdgeDefaults()); m.edges.push(e); MM.sel = e.id; mmRender(); mmSave(); setTimeout(() => mmEditLabel(e.id), 60); } }
      else if(Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) > 40){ const [wx, wy] = mmToWorld(ev.clientX, ev.clientY); MM.sel = d.from; mmAdd('text', null, [Math.round(wx), Math.round(wy)]); } }
  };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
  st.addEventListener('dblclick', ev => { let node = ev.target.closest('.mm-node'), edge = ev.target.closest('.mm-edge'); const m = mindOf(MM.id); if(!m) return;
    if(!node && !edge){ const hit = document.elementsFromPoint(ev.clientX, ev.clientY); node = (hit.find(x => x.closest && x.closest('#mmNodes .mm-node')) || {closest: () => null}).closest('.mm-node'); edge = node ? null : (hit.find(x => x.closest && x.closest('#mmEdges .mm-edge')) || {closest: () => null}).closest('.mm-edge'); }
    if(edge){ mmEditLabel(edge.dataset.e); return; }
    if(node){ const n = m.nodes.find(x => x.id === node.dataset.n); if(!n) return;
      if(n.type === 'text'){ if(MM.editing && MM.editing !== n.id) mmCommitText(); MM.editing = n.id; MM.sel = n.id; mmRender(); mmFocusText(n.id); }
      else if(n.type === 'paper'){ try{ openReader(n.ref); }catch(e){} }
      return; }
    const [wx, wy] = mmToWorld(ev.clientX, ev.clientY); MM.sel = null; mmAdd('text', null, [Math.round(wx), Math.round(wy)]); });
  st.addEventListener('wheel', ev => { ev.preventDefault();
    if(ev.ctrlKey || ev.metaKey){ const k0 = MM.view.k, k = Math.max(.04, Math.min(12, k0 * Math.exp(-ev.deltaY * .01))), [wx, wy] = mmToWorld(ev.clientX, ev.clientY); MM.view.k = k; MM.view.x = ev.clientX - wx * k; MM.view.y = ev.clientY - wy * k; }
    else { MM.view.x -= ev.deltaX; MM.view.y -= ev.deltaY; mmWind(-ev.deltaX, -ev.deltaY); }
    mmApply(); clearTimeout(MM.wt); MM.wt = setTimeout(mmSave, 400); }, {passive: false});
  st.addEventListener('contextmenu', ev => { const node = ev.target.closest('.mm-node'), edge = ev.target.closest('.mm-edge'); if(!node && !edge) return; ev.preventDefault();
    MM.sel = (node && node.dataset.n) || edge.dataset.e; mmRender(); const m = mindOf(MM.id), n = node && m.nodes.find(x => x.id === node.dataset.n);
    const items = []; if(n && n.type === 'paper') items.push({label: 'Notes & PDF', fn: () => openReader(n.ref)}); if(n && n.type === 'text') items.push({label: 'Edit', fn: () => { MM.editing = n.id; mmRender(); }});
    if(edge){ const eid = edge.dataset.e, px = ev.clientX, py = ev.clientY; items.push({label: 'Write on this line', fn: () => mmEditLabel(eid)}, {label: 'Colour of the line…', fn: () => mmLineColour(eid, px, py)}); } items.push({sep: 1}, {label: 'Delete', danger: 1, fn: mmDelete});
    openFloatMenu(ev.clientX + 2, ev.clientY + 2, items); });
  MM.el.addEventListener('click', ev => {
    const mk = ev.target.closest('[data-mm="marks"]'); if(mk){ mindMarks(mk); return; }
    const ik = ev.target.closest('[data-mm="ink"]'); if(ik){ mmInkToggle(); return; }
    const sm = ev.target.closest('[data-mm="select"]'); if(sm){ window.mmSelMode(); return; }
    const am = ev.target.closest('[data-mm="addmap"]'); if(am){ mmAddMapMenu(am); return; }
    const ax = ev.target.closest('[data-mm="axis"]'); if(ax){ mmAxisToggle(); return; }
    const dsw = ev.target.closest('[data-mm="dockswitch"]'); if(dsw){ mmDockMenu(dsw); return; }
    const bk = ev.target.closest('[data-mm="trail"]'); if(bk){ mmTrailBack(); return; }
    const ol = ev.target.closest('[data-mm="outline"]'); if(ol){ mmOutline(); return; }
    const hu = ev.target.closest('[data-mm="undo"],[data-mm="redo"],[data-mm="versions"]'); if(hu){ const k = hu.dataset.mm; if(k === 'undo') mmUndo(); else if(k === 'redo') mmRedo(); else mmVersions(hu); return; }
    const it = ev.target.closest('#mmInkTools [data-mi]'); if(it){ mmInkTool(it); return; }
    const bx = ev.target.closest('[data-mm="export"],[data-mm="note"],[data-mm="sync"],[data-mm="look"]');
    if(bx){ const k = bx.dataset.mm; if(k === 'export') mmExportMenu(bx); else if(k === 'note') nbkPicker(bx); else if(k === 'sync') atlasSync(bx); else atlasLook(bx); return; }
    const b = ev.target.closest('[data-mm]'), pick = ev.target.closest('[data-pick]'), menu = ev.target.closest('#mmMenu button');
    if(pick){ const kind = mm$('mmPick').dataset.kind; mm$('mmPick').hidden = true; mmAdd(kind, pick.dataset.pick); return; }
    if(menu){ mm$('mmMenu').hidden = true;
      if(menu.dataset.mmOpen) openMind(menu.dataset.mmOpen);
      else if(menu.dataset.mmTl){ closeMind(false); openView(menu.dataset.mmTl + '-all'); }
      else if(menu.dataset.mmAct === 'rename'){ const t = mm$('mmTitle'); t.contentEditable = 'true'; t.focus(); const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      else if(menu.dataset.mmAct === 'new') mapKindChooser();
      else if(menu.dataset.mmAct === 'embed'){ const r = menu.getBoundingClientRect(); mmEmbedMenu(r.left, r.bottom + 6); }
      else if(menu.dataset.mmAct === 'bin'){ const r = menu.getBoundingClientRect(); mmBinMenu(r.left, r.bottom + 6); }
      else if(menu.dataset.mmAct === 'delete'){ const m = mindOf(MM.id); if(m && confirm('Move the mind map “' + m.name + '” to the bin? You can bring it back for 60 days.')){ mmBin(m); closeMind(); } }
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
    if(ev.key === 'Backspace' || ev.key === 'Delete'){ if(MM.multi && MM.multi.size > 1){ ev.preventDefault(); mmDeleteMany(); } else if(MM.sel){ ev.preventDefault(); mmDelete(); } }
    else if(ev.key === 'Escape'){ if(!mm$('mmPick').hidden) mm$('mmPick').hidden = true; else if(MM.sel){ MM.sel = null; mmRender(); } } });
  mm$('mmPickQ').addEventListener('keydown', ev => { if(ev.key === 'Escape') mm$('mmPick').hidden = true; if(ev.key === 'Enter'){ const f = mm$('mmPickList').querySelector('[data-pick]'); if(f) f.click(); } });
  addEventListener('resize', () => { if(MM.el && !MM.el.hidden) mmApply(); });
}
function mmEdgesOnly(){ const m = mindOf(MM.id); if(!m) return; const by = {}; m.nodes.forEach(n => by[n.id] = n);
  m.edges.forEach(e => { const g = document.querySelector('#mmEdges [data-e="' + e.id + '"]'); if(!g || !by[e.a] || !by[e.b]) return; g.outerHTML = mmEdgeHTML(e, by); }); }
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
function mmSvg(){ const m = mindOf(MM.id); if(!m) return null; try{ mmMeasure(m); }catch(e){} const by = {}; m.nodes.forEach(n => by[n.id] = n);
  const xe = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const boxes = [], parts = []; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  m.nodes.forEach(n => { const el = document.querySelector('#mmNodes .mm-node[data-n="' + n.id + '"]'); if(!el || el.classList.contains('mm-hidden')) return; const w = el.offsetWidth, h = el.offsetHeight, bx = n.x - w / 2, by2 = n.y - h / 2;
    boxes.push({n, el, w, h, x: bx, y: by2}); x0 = Math.min(x0, bx); y0 = Math.min(y0, by2); x1 = Math.max(x1, bx + w); y1 = Math.max(y1, by2 + h); });
  (m.ink || []).forEach(s => { for(let i = 0; i < s.p.length; i += 3){ x0 = Math.min(x0, s.p[i] - 10); y0 = Math.min(y0, s.p[i + 1] - 10); x1 = Math.max(x1, s.p[i] + 10); y1 = Math.max(y1, s.p[i + 1] + 10); } });
  if(!boxes.length && !(m.ink || []).length) return null;
  const pad = 48; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad; const W = Math.ceil(x1 - x0), H = Math.ceil(y1 - y0);
  parts.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + W + '" height="' + H + '" fill="#FBF8F2"/>');
  m.edges.forEach(e => { if(!by[e.a] || !by[e.b]) return; const c = mmEdgeGeom(e, by), col = e.color || '#231E1A';
    parts.push('<path d="' + c.d + '" fill="none" stroke="' + col + '" stroke-width="' + c.w + '" stroke-linecap="round" stroke-linejoin="round"' + (c.dash ? ' stroke-dasharray="' + c.dash + '"' : '') + '/>'); c.heads.forEach(hd => parts.push('<path d="' + hd + '" fill="' + col + '"/>'));
    if(e.label){ const lw = mmWrap(e.label, 'italic 12px "Times New Roman", serif', 9999).reduce((n2, t2) => Math.max(n2, t2.length), 0) * 6.2 + 10; parts.push('<rect x="' + (c.mx - lw / 2).toFixed(1) + '" y="' + (c.my - 19).toFixed(1) + '" width="' + lw.toFixed(1) + '" height="17" rx="4" fill="#FBF8F2"/>'); }
    if(e.label) parts.push('<text x="' + c.mx.toFixed(1) + '" y="' + (c.my - 6).toFixed(1) + '" text-anchor="middle" font-family="Times New Roman, serif" font-style="italic" font-size="12" fill="#5E544A">' + xe(e.label) + '</text>'); });
  (m.ink || []).forEach(s => { const d2 = mmInkD(s); if(d2) parts.push('<path d="' + d2 + '" fill="' + s.c + '"' + (s.h ? ' fill-opacity=".34"' : '') + '/>'); });
  boxes.forEach(B => { const {n, el, w, h, x, y} = B, card = n.type !== 'text';
    if(n.type === 'map'){ const sub = mindOf(n.ref); parts.push(mmRoundRect(x, y, w, h, 8, n.fill || '#FFFDF8', ' stroke="#D9D0C1" stroke-width="1"')); const mini = el.querySelector('.mm-mini'), mh = mini ? mini.offsetHeight : 120; if(sub) parts.push('<g transform="translate(' + (x + 8).toFixed(1) + ',' + (y + 8).toFixed(1) + ')">' + mmMiniSvg(sub, w - 16, mh, true) + '</g>'); parts.push('<text x="' + (x + 14).toFixed(1) + '" y="' + (y + mh + 30).toFixed(1) + '" font-family="Times New Roman, serif" font-weight="700" font-size="14" fill="#231E1A">' + xe(sub ? sub.name : '') + '</text>'); return; }
    if(n.type === 'image'){ const src = MM_PIC[n.clip], pic = el.querySelector('.mm-pic'), ph = pic ? pic.offsetHeight : h; if(src && /^data:image\/jpeg/.test(src)) parts.push('<image href="' + src + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w + '" height="' + ph + '" data-pw="' + (n.pw || 0) + '" data-ph="' + (n.ph || 0) + '" preserveAspectRatio="none"/>'); else parts.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w + '" height="' + ph + '" fill="#EFE8DB"/>');
      if(n.cite) parts.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + ph + 15).toFixed(1) + '" text-anchor="middle" font-family="Times New Roman, serif" font-style="italic" font-size="11.5" fill="#5E544A">' + xe(n.cite) + '</text>'); return; }
    if(card) parts.push(mmShapeSvg(n, x, y, w, h, true));
    let ty = y + 18; const lx = x + 12, maxW = w - 24, line = (t, size, weight, style, fam, colour) => { parts.push('<text x="' + lx.toFixed(1) + '" y="' + ty.toFixed(1) + '" font-family="' + fam + '" font-size="' + size + '"' + (weight ? ' font-weight="' + weight + '"' : '') + (style ? ' font-style="' + style + '"' : '') + ' fill="' + colour + '">' + xe(t) + '</text>'); ty += size * 1.3; };
    if(card){ const k = el.querySelector('.k'), b = el.querySelector('b'), em = el.querySelector('em');
      if(k && k.textContent.trim()) line(k.textContent.trim().toUpperCase(), 8.5, 700, '', 'Helvetica, Arial, sans-serif', '#8A7F72');
      if(b) mmWrap(b.textContent.trim(), '700 14px "Times New Roman", serif', maxW).forEach(t => line(t, 14, 700, '', 'Times New Roman, serif', '#231E1A'));
      if(em && em.textContent.trim()) line(em.textContent.trim(), 11.5, '', 'italic', 'Times New Roman, serif', '#5E544A'); }
    else { parts.push(mmShapeSvg(n, x, y, w, h)); const t = (el.querySelector('.mm-txt') || el).innerText.trim(), fs = n.ts === 's' ? 12.5 : n.ts === 'l' ? 20 : 15; ty = y + (h - mmWrap(t, '400 ' + fs + 'px "Times New Roman", serif', w - 16).length * fs * 1.3) / 2 + fs; mmWrap(t, '400 ' + fs + 'px "Times New Roman", serif', w - 16).forEach(s2 => { parts.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + ty.toFixed(1) + '" text-anchor="middle" font-family="Times New Roman, serif" font-size="' + fs + '"' + (n.bold ? ' font-weight="700"' : '') + ' fill="' + (n.ink || '#231E1A') + '">' + xe(s2) + '</text>'); ty += fs * 1.3; }); } });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' ' + W + ' ' + H + '"><g>' + parts.join('') + '</g></svg>';
  return {svg, w: W, h: H, x0, y0, name: m.name}; }
async function mmExport(kind){ const x = mmSvg(); if(!x){ toast('Nothing on this mind map yet'); return; } const name = slugName(x.name || 'mind-map');
  if(kind === 'svg'){ await saveBlobAs(new Blob([x.svg], {type: 'image/svg+xml'}), name + '.svg'); return; }
  const shifted = x.svg.replace(/viewBox="[^"]*"/, 'viewBox="0 0 ' + x.w + ' ' + x.h + '"').replace('<g>', '<g transform="translate(' + (-x.x0).toFixed(1) + ',' + (-x.y0).toFixed(1) + ')">');
  const page = mmPdfPage({w: x.w, h: x.h, svg: shifted}); await saveBlobAs(vectorPdf([page], x.name || 'Mind map'), name + '.pdf'); }

function mmSelect(id){ MM.sel = id; document.querySelectorAll('#mmNodes .mm-node').forEach(el => el.classList.toggle('sel', el.dataset.n === id)); document.querySelectorAll('#mmEdges .mm-edge').forEach(el => el.classList.toggle('sel', el.dataset.e === id)); }
function mmFocusText(id){ requestAnimationFrame(() => { const t = document.querySelector('#mmNodes [data-n="' + id + '"] .mm-txt'); if(!t) return; t.focus(); const r = document.createRange(); r.selectNodeContents(t); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }); }
/* the title is the name: click it to rename the map */
document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('#mmTitle'); if(!t || t.isContentEditable) return; t.contentEditable = 'true'; t.focus(); const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });

/* ===================== the mind map beside a paper or a book =====================
   While reading, the notes' place can turn into the paper's (or book's) own mind map: edited right there, with what you mark
   in the paper going straight onto it, a quote from the words you chose, or any of your highlights, quotes and sticky notes. */
function mindDock(kind, id, r){ let m = mindOf(localStorage.getItem('pm:dockMap:' + kind + ':' + id) || '') || mindsAll().find(x => x.pin && x.pin.kind === kind && x.pin.id === id); if(!m) m = mindNew('', {kind, id});
  mmEnsure(); MM.dock = {l: r.l, t: r.t, w: r.w, h: r.h, kind, id}; MM.id = m.id; MM.sel = null; MM.editing = null;
  Object.assign(MM.el.style, {left: r.l + 'px', top: r.t + 'px', width: r.w + 'px', height: r.h + 'px'}); MM.el.classList.add('docked');
  { const b = mmBox(); MM.view = m.view ? {x: m.view.x + b.l + b.w / 2, y: m.view.y + b.t + b.h / 2, k: m.view.k || 1} : {x: b.l + b.w / 2, y: b.t + b.h / 2, k: 1}; }
  mmApply(); mmRender(); if(!m.view) mmFit(); document.documentElement.classList.add('mind-docked'); MM.el.hidden = false; requestAnimationFrame(() => MM.el.classList.add('on')); return m.id; }
function mindDockMove(r){ if(!MM.dock) return; const dx = r.l - MM.dock.l, dy = r.t - MM.dock.t, dw = (r.w - MM.dock.w) / 2, dh = (r.h - MM.dock.h) / 2; Object.assign(MM.dock, {l: r.l, t: r.t, w: r.w, h: r.h});
  Object.assign(MM.el.style, {left: r.l + 'px', top: r.t + 'px', width: r.w + 'px', height: r.h + 'px'}); MM.view.x += dx + dw; MM.view.y += dy + dh; mmApply(); }
function mindUndock(){ if(!MM.dock || !MM.el) return; mmCommitText(); mmSave(); document.documentElement.classList.remove('mind-docked'); MM.el.classList.remove('on', 'docked'); MM.el.hidden = true; MM.el.removeAttribute('style'); MM.dock = null; MM.id = null; }
/* a quote (or a highlight, a sticky note) onto the docked map: it hangs from the node you chose, else from the paper itself */
function mindQuote(text, cite){ if(!MM.dock) return false; const m = mindOf(MM.id); if(!m) return false; if(MM.editing) mmCommitText();
  if(!MM.sel || !m.nodes.some(n => n.id === MM.sel)){ const pin = mmPaperNode(m); if(pin) MM.sel = pin.id; }
  const t = String(text || '').trim(); if(!t) return false; const n = mmAdd('text', null); if(!n) return false; MM.editing = null;
  n.text = '“' + (t.length > 400 ? t.slice(0, 400) + '…' : t) + '”' + (cite ? ' — ' + cite : ''); n.quote = 1; mmRender(); mmSave(); mmShow(n); return true; }
/* the paper's own marks, to choose from */
function mindMarks(btn){ if(!MM.dock) return; const k = MM.dock.kind, id = MM.dock.id, src = k === 'paper' ? lib.entries[id] : (lib.readings || []).find(b => b.id === id); if(!src) return;
  const marks = (src.marks || []).filter(x => (x.text || x.note || '').trim()), stk = (src.stickies || []).filter(x => (x.text || '').trim());
  const quotes = String((k === 'paper' ? src.n : src.notes) || '').split('\n').filter(l => /^>\s?/.test(l)).map(l => l.replace(/^>\s?/, ''));
  const items = [].concat(marks.map(x => ({label: '▍ ' + String(x.text || x.note).slice(0, 70), fn: () => mindQuote(x.text || x.note, x.page ? 'p. ' + x.page : '')})),
    quotes.map(q => { const mm2 = q.match(/^(.*?)\s+—\s+(.+)$/); return {label: '❝ ' + (mm2 ? mm2[1] : q).slice(0, 70), fn: () => mindQuote(mm2 ? mm2[1] : q, mm2 ? mm2[2] : '')}; }),
    stk.map(x => ({label: '▢ ' + String(x.text).slice(0, 70), fn: () => mindQuote(x.text, '')})));
  if(!items.length){ toast('Nothing marked in it yet: choose words, then “To the mind map”'); return; }
  const r = btn.getBoundingClientRect(); openFloatMenu(r.left, r.bottom + 6, items.slice(0, 60)); }

/* ===================== handwriting on a mind map =====================
   ✎ among the map's tools: the Pencil (or, on a Mac, the mouse) writes on the map, in the map's own measure, so what you write
   moves and zooms with it and stays beside the nodes you wrote it by; fingers still move the map. The pens, highlighter and
   sizes are the ones chosen for the reading page; an eraser takes away a stroke it touches; undo steps back. */
const MI = {on: false, tool: 'pen', color: null, cur: null, undo: [], penAt: 0};
function mmInkPrefs(){ let p = {}; try{ p = JSON.parse(localStorage.getItem('pm:ink') || '{}'); }catch(e){} return {pens: (p.pens && p.pens.length ? p.pens : ['#1F1B18', '#2346A8', '#C23A2B']).slice(0, 3), size: p.size || 2.1, hl: p.hl || '#F2CF57', hlSize: p.hlSize || 14, brush: p.brush || 'fountain'}; }
function mmInkPrefsSet(o){ let p = {}; try{ p = JSON.parse(localStorage.getItem('pm:ink') || '{}'); }catch(e){} Object.assign(p, o); try{ localStorage.setItem('pm:ink', JSON.stringify(p)); }catch(e){} }
function mmPF(){ try{ const w = DK.frame && DK.frame.contentWindow; return w && w.__pmPF; }catch(e){ return null; } }
function mmInkD(s){ const pts = []; for(let i = 0; i < s.p.length; i += 3) pts.push([s.p[i], s.p[i + 1], s.p[i + 2]]); if(!pts.length) return '';
  const pf = mmPF(), real = pts.some(q => Math.abs(q[2] - .5) > .02);
  if(pf && pf.getStroke){ const o = pf.getStroke(pts, PM_BRUSH(s, real));
    if(o && o.length > 2){ let d2 = 'M' + o[0][0].toFixed(1) + ' ' + o[0][1].toFixed(1); for(let i = 1; i <= o.length; i++){ const a = o[i % o.length], b = o[(i + 1) % o.length]; d2 += ' Q' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' ' + ((a[0] + b[0]) / 2).toFixed(1) + ' ' + ((a[1] + b[1]) / 2).toFixed(1); } return d2 + 'Z'; } }
  /* without the shaper (the desk not loaded): a plain round line, outlined as a thin band */
  const w = (s.h ? (s.w || 14) : (s.w || 2.1) * 1.4) / 2; let up = '', dn = ''; for(let i = 0; i < pts.length; i++){ const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w; up += (i ? ' L' : 'M') + (pts[i][0] + nx).toFixed(1) + ' ' + (pts[i][1] + ny).toFixed(1); dn = ' L' + (pts[i][0] - nx).toFixed(1) + ' ' + (pts[i][1] - ny).toFixed(1) + dn; }
  return up + dn + 'Z'; }
function mmInkRender(m){ m = m || mindOf(MM.id); const g = mm$('mmInkG'); if(!g || !m) return; g.innerHTML = (m.ink || []).map((s, i) => { const d2 = mmInkD(s); return d2 ? '<path data-i="' + i + '" d="' + d2 + '" fill="' + s.c + '"' + (s.h ? ' fill-opacity=".34"' : '') + '></path>' : ''; }).join(''); }
function mmInkToolsHTML(){ const p = mmInkPrefs(); if(!MI.color) MI.color = p.pens[0];
  const pen = c => '<button type="button" data-mi="pen" data-c="' + c + '" class="' + (MI.tool === 'pen' && MI.color === c ? 'on' : '') + '"><i style="background:' + c + '"></i></button>';
  return p.pens.map(pen).join('') + '<button type="button" data-mi="hl" class="' + (MI.tool === 'hl' ? 'on' : '') + '" title="Highlighter"><i class="hl" style="background:' + p.hl + '"></i></button>' +
    '<button type="button" data-mi="eraser" class="' + (MI.tool === 'eraser' ? 'on' : '') + '" title="Eraser"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4.5 15.5l9-9a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L13 19H8l-3.5-3.5z"/><path d="M9.5 10.5l5.5 5.5M8 19h11" stroke-linecap="round"/></svg></button>' +
    '<button type="button" data-mi="undo" title="Undo"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/></svg></button>'; }
function mmInkToggle(){ MI.on = !MI.on; const tb = mm$('mmInkTools'); tb.hidden = !MI.on; if(MI.on) tb.innerHTML = mmInkToolsHTML(); MM.el.classList.toggle('inking', MI.on);
  const b = MM.el.querySelector('[data-mm="ink"]'); if(b) b.classList.toggle('on', MI.on); }
function mmInkTool(btn){ const k = btn.dataset.mi, m = mindOf(MM.id);
  if(k === 'undo'){ const prev = MI.undo.pop(); if(prev && m){ m.ink = prev; mmInkRender(m); mmSave(); } return; }
  MI.tool = k; if(btn.dataset.c) MI.color = btn.dataset.c; mm$('mmInkTools').innerHTML = mmInkToolsHTML(); }
(() => { const at = ev => mmToWorld(ev.clientX, ev.clientY), pen = ev => ev.pointerType === 'pen' || (ev.pointerType === 'mouse' && !('ontouchstart' in window));
  let raf = 0; const live = () => { if(raf) return; raf = requestAnimationFrame(() => { raf = 0; const c = mm$('mmInkCur'); if(!c) return; if(!MI.cur){ c.setAttribute('d', ''); return; } c.setAttribute('d', mmInkD(MI.cur)); c.setAttribute('fill', MI.cur.c); c.setAttribute('fill-opacity', MI.cur.h ? '.34' : '1'); }); };
  const eraseAt = ev => { const m = mindOf(MM.id); if(!m || !(m.ink || []).length) return; const [x, y] = at(ev), r = 10 / MM.view.k, keep = m.ink.filter(s => { for(let i = 0; i < s.p.length; i += 3) if(Math.hypot(s.p[i] - x, s.p[i + 1] - y) < r + (s.w || 2) / 2) return false; return true; });
    const e = mm$('mmEraser'); if(e){ e.setAttribute('cx', x); e.setAttribute('cy', y); e.setAttribute('r', r); }
    if(keep.length !== m.ink.length){ if(!MI.erasing){ MI.undo.push(m.ink.slice()); MI.erasing = true; } m.ink = keep; mmInkRender(m); } };
  document.addEventListener('pointerdown', ev => { if(!MI.on || MI.tool === 'lasso' || !MM.el || MM.el.hidden || !ev.target.closest || !ev.target.closest('#mmStage')) return;
    if(!pen(ev)){ if(Date.now() - MI.penAt < 1200 || MI.cur) ev.stopPropagation(); return; }   /* a resting palm does not move the map while writing */
    ev.preventDefault(); ev.stopPropagation(); try{ mm$('mmStage').setPointerCapture(ev.pointerId); }catch(e){} MI.penAt = Date.now();
    if(MI.tool === 'eraser'){ MI.erasing = false; MI.erase = true; eraseAt(ev); return; }
    const p = mmInkPrefs(), [x, y] = at(ev), pr = ev.pointerType === 'pen' ? (ev.pressure || .5) : .5;
    MI.cur = {c: MI.tool === 'hl' ? p.hl : (MI.color || p.pens[0]), w: (MI.tool === 'hl' ? p.hlSize : p.size) / MM.view.k, h: MI.tool === 'hl' ? 1 : 0, b: MI.tool === 'hl' ? 'hl' : p.brush, p: [+(+x).toFixed(2), +(+y).toFixed(2), +pr.toFixed(3)]}; live(); }, true);
  document.addEventListener('pointermove', ev => { if(!MI.on) return; if(MI.erase){ ev.stopPropagation(); eraseAt(ev); return; } if(!MI.cur) return; ev.preventDefault(); ev.stopPropagation(); MI.penAt = Date.now();
    const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev]; (evs.length ? evs : [ev]).forEach(e2 => { const [x, y] = at(e2), n = MI.cur.p.length; if(Math.abs(x - MI.cur.p[n - 3]) + Math.abs(y - MI.cur.p[n - 2]) > .4) MI.cur.p.push(+x.toFixed(1), +y.toFixed(1), +(e2.pointerType === 'pen' ? (e2.pressure || .5) : .5).toFixed(3)); }); live(); }, true);
  const end = ev => { if(MI.erase){ MI.erase = false; MI.erasing = false; const e = mm$('mmEraser'); if(e) e.setAttribute('r', 0); mmSave(); return; } if(!MI.cur) return; ev.stopPropagation(); MI.penAt = Date.now();
    const m = mindOf(MM.id), s = MI.cur; MI.cur = null; live(); if(!m) return; if(s.p.length < 6) s.p.push(s.p[0] + .5, s.p[1] + .5, s.p[2]);
    if(!s.h && s.p.length >= 18){ const e = mmHandFrom(s, m); if(e){ m.edges.push(e); mmRender(); mmSave(); return; } }
    MI.undo.push((m.ink || []).slice()); if(MI.undo.length > 100) MI.undo.shift(); m.ink = (m.ink || []).concat([s]); mmInkRender(m); mmSave(); };
  document.addEventListener('pointerup', end, true); document.addEventListener('pointercancel', end, true);
})();

/* ===================== brushes =====================
   Three pens and a highlighter, each its own shape of stroke (perfect-freehand settings): the fountain pen swells and thins with
   pressure and tapers; the ballpoint keeps an even line; the felt-tip is soft and round. Sizes go down to a hair's breadth. */
function PM_BRUSH(s, real){ const w = s.w || 2.1, b = s.h ? 'hl' : (s.b || 'fountain');
  if(b === 'hl') return {size: w * 1.2, thinning: 0, smoothing: .55, streamline: .6, simulatePressure: false, start: {cap: false, taper: 0}, end: {cap: false, taper: 0}, last: true};
  if(b === 'ballpoint') return {size: w * 1.25, thinning: .12, smoothing: .5, streamline: .5, simulatePressure: false, start: {cap: true, taper: 0}, end: {cap: true, taper: 0}, last: true};
  if(b === 'felt') return {size: w * 1.7, thinning: .28, smoothing: .72, streamline: .55, simulatePressure: !real, start: {cap: true, taper: 0}, end: {cap: true, taper: 0}, last: true};
  return {size: w * 1.55, thinning: .68, smoothing: .62, streamline: .42, simulatePressure: !real, start: {cap: true, taper: real ? 0 : 3}, end: {cap: true, taper: real ? 0 : 7}, last: true}; }
const PM_HLS = [['Yellow', '#F7D93D'], ['Pink', '#FF6FB5'], ['Blue', '#4FC3F7'], ['Green', '#7CE07C'], ['Orange', '#FFA94D'], ['Lilac', '#B794F6']];
function mmInkToolsHTML(){ const p = mmInkPrefs(); if(!MI.color) MI.color = p.pens[0]; const hl = MI.tool === 'hl', er = MI.tool === 'eraser';
  const brush = (k, label, path) => '<button type="button" data-mi="brush" data-b="' + k + '" class="' + (!hl && !er && p.brush === k ? 'on' : '') + '" title="' + label + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg></button>';
  const pens = p.pens.map(c => '<button type="button" data-mi="pen" data-c="' + c + '" class="' + (!hl && !er && MI.color === c ? 'on' : '') + '"><i style="background:' + c + '"></i></button>').join('');
  const hls = PM_HLS.map(([n, c]) => '<button type="button" data-mi="hlc" data-c="' + c + '" class="' + (hl && p.hl === c ? 'on' : '') + '" title="Highlighter: ' + n + '"><i class="hl" style="background:' + c + '"></i></button>').join('');
  const sz = hl ? p.hlSize : p.size, mn = hl ? 4 : .3, mx = hl ? 40 : 12;
  return '<div class="mi-row">' + brush('fountain', 'Fountain pen', '<path d="M12 3l4 7-4 11-4-11 4-7z"/><path d="M12 10v5"/>') + brush('ballpoint', 'Ballpoint', '<path d="M6 18l9.5-9.5 2 2L8 20H6v-2z"/><path d="M15.5 8.5l2-2"/>') + brush('felt', 'Felt-tip', '<path d="M5 19l3-1 9-9-2-2-9 9-1 3z"/><path d="M13 7l4 4" stroke-width="3"/>') +
    '<i class="mi-sep"></i>' + pens + '<i class="mi-sep"></i><button type="button" data-mi="eraser" class="' + (er ? 'on' : '') + '" title="Eraser"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4.5 15.5l9-9a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L13 19H8l-3.5-3.5z"/><path d="M9.5 10.5l5.5 5.5M8 19h11" stroke-linecap="round"/></svg></button>' +
    '<button type="button" data-mi="undo" title="Undo"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/></svg></button></div>' +
    '<div class="mi-row">' + hls + '<i class="mi-sep"></i><label class="mi-size" title="Size"><input type="range" data-mi="size" min="' + mn + '" max="' + mx + '" step="' + (hl ? 1 : .1) + '" value="' + sz + '"><b>' + (hl ? Math.round(sz) : (+sz).toFixed(1)) + '</b></label></div>'; }
function mmInkTool(btn){ const k = btn.dataset.mi, m = mindOf(MM.id);
  if(k === 'undo'){ mmUndo(); return; }
  if(k === 'brush'){ mmInkPrefsSet({brush: btn.dataset.b}); MI.tool = 'pen'; }
  else if(k === 'hlc'){ mmInkPrefsSet({hl: btn.dataset.c}); MI.tool = 'hl'; }
  else if(k === 'pen'){ MI.tool = 'pen'; MI.color = btn.dataset.c; }
  else if(k === 'eraser') MI.tool = 'eraser';
  else return; mm$('mmInkTools').innerHTML = mmInkToolsHTML(); }
document.addEventListener('input', ev => { const r = ev.target.closest && ev.target.closest('#mmInkTools [data-mi="size"]'); if(!r) return; const v = +r.value; if(MI.tool === 'hl') mmInkPrefsSet({hlSize: v}); else mmInkPrefsSet({size: v}); const b = r.parentNode.querySelector('b'); if(b) b.textContent = MI.tool === 'hl' ? Math.round(v) : v.toFixed(1); });

/* ===================== lines: shape, dash, arrows, width =====================
   Every line keeps its own look: a curve, a straight line or a right-angled one; solid, dashed or dotted; no arrow, an arrow at
   either end or both; four widths; any colour. The ends stop at the edge of each node, so arrows show. */
MM.sz = MM.sz || {};
function mmMeasure(m){ let changed = false; m.nodes.forEach(n => { const el = document.querySelector('#mmNodes .mm-node[data-n="' + n.id + '"]'); if(!el) return; const w = el.offsetWidth, h = el.offsetHeight, o = MM.sz[n.id]; if(!w || !h) return; if(!o || o[0] !== w || o[1] !== h){ MM.sz[n.id] = [w, h]; changed = true; } }); return changed; }
function mmClip(n, tx, ty){ const s = MM.sz[n.id] || [150, 46], hw = s[0] / 2 + 5, hh = s[1] / 2 + 5, dx = tx - n.x, dy = ty - n.y; if(!dx && !dy) return [n.x, n.y];
  const t = Math.min(Math.abs(dx) > .001 ? hw / Math.abs(dx) : Infinity, Math.abs(dy) > .001 ? hh / Math.abs(dy) : Infinity); return t >= 1 ? [n.x, n.y] : [n.x + dx * t, n.y + dy * t]; }
function mmHead(x, y, ux, uy, w){ const L = 7 + w * 2.6, W = 4 + w * 1.6, bx = x - ux * L, by = y - uy * L; return 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + ' L' + (bx - uy * W).toFixed(1) + ' ' + (by + ux * W).toFixed(1) + ' L' + (bx + uy * W).toFixed(1) + ' ' + (by - ux * W).toFixed(1) + 'Z'; }
const MM_WIDTHS = {1: 1, 2: 1.6, 3: 2.6, 4: 4};
function mmEdgeGeom(e, by){ const a = by[e.a], b = by[e.b], w = MM_WIDTHS[e.w || 2] || 1.6, shape = e.shape || 'curve', arrow = e.arrow || 'none';
  let d, mx, my, ta, tb, A, B;
  if(shape === 'elbow'){ const hz = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y); const midA = hz ? [(a.x + b.x) / 2, a.y] : [a.x, (a.y + b.y) / 2]; A = mmClip(a, midA[0], midA[1]); const midB = hz ? [(a.x + b.x) / 2, b.y] : [b.x, (a.y + b.y) / 2]; B = mmClip(b, midB[0], midB[1]);
    const p1 = hz ? [(A[0] + B[0]) / 2, A[1]] : [A[0], (A[1] + B[1]) / 2], p2 = hz ? [(A[0] + B[0]) / 2, B[1]] : [B[0], (A[1] + B[1]) / 2];
    d = 'M' + A[0].toFixed(1) + ' ' + A[1].toFixed(1) + ' L' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' L' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1) + ' L' + B[0].toFixed(1) + ' ' + B[1].toFixed(1); mx = (p1[0] + p2[0]) / 2; my = (p1[1] + p2[1]) / 2; ta = [p1[0] - A[0], p1[1] - A[1]]; tb = [B[0] - p2[0], B[1] - p2[1]]; }
  else if(shape === 'straight'){ A = mmClip(a, b.x, b.y); B = mmClip(b, a.x, a.y); d = 'M' + A[0].toFixed(1) + ' ' + A[1].toFixed(1) + ' L' + B[0].toFixed(1) + ' ' + B[1].toFixed(1); mx = (A[0] + B[0]) / 2; my = (A[1] + B[1]) / 2; ta = [B[0] - A[0], B[1] - A[1]]; tb = ta; }
  else { const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy) || 1, bend = Math.min(60, dd * .12), cx = (a.x + b.x) / 2 - dy / dd * bend, cy = (a.y + b.y) / 2 + dx / dd * bend; A = mmClip(a, cx, cy); B = mmClip(b, cx, cy);
    d = 'M' + A[0].toFixed(1) + ' ' + A[1].toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + B[0].toFixed(1) + ' ' + B[1].toFixed(1); mx = (A[0] + 2 * cx + B[0]) / 4; my = (A[1] + 2 * cy + B[1]) / 4; ta = [cx - A[0], cy - A[1]]; tb = [B[0] - cx, B[1] - cy]; }
  const unit = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }, heads = [];
  if(arrow === 'end' || arrow === 'both'){ const u = unit(tb); heads.push(mmHead(B[0], B[1], u[0], u[1], w)); }
  if(arrow === 'start' || arrow === 'both'){ const u = unit(ta); heads.push(mmHead(A[0], A[1], -u[0], -u[1], w)); }
  const dash = e.dash === 'dash' ? (5 + w * 2.5) + ' ' + (4 + w * 2) : e.dash === 'dot' ? '0.1 ' + (3 + w * 2.2) : ''; return {d, mx, my, heads, w, dash}; }
function mmEdgeHTML(e, by){ if(!by[e.a] || !by[e.b]) return ''; const c = mmEdgeGeom(e, by), col = e.color || '';
  return '<g class="mm-edge' + (MM.sel === e.id ? ' sel' : '') + '" data-e="' + esc(e.id) + '"><path class="hit" d="' + c.d + '"></path><path class="ln" d="' + c.d + '" style="stroke-width:' + c.w + 'px;' + (col ? 'stroke:' + col + ';' : '') + (c.dash ? 'stroke-dasharray:' + c.dash + ';' : '') + '"></path>' + c.heads.map(h => '<path class="hd" d="' + h + '"' + (col ? ' style="fill:' + col + '"' : '') + '></path>').join('') + (e.label ? '<text x="' + c.mx.toFixed(1) + '" y="' + (c.my - 6).toFixed(1) + '" text-anchor="middle">' + esc(e.label) + '</text>' : '') + '</g>'; }
/* the look of a line: chosen in a small bar when the line is picked; new lines take the last look you chose */
function mmEdgeDefaults(){ try{ return JSON.parse(localStorage.getItem('pm:mmEdge') || '{}'); }catch(e){ return {}; } }
function mmEdgeBar(){ let bar = document.getElementById('mmEdgeBar'); const m = mindOf(MM.id), e = m && MM.sel && m.edges.find(x => x.id === MM.sel);
  if(!e){ if(bar) bar.hidden = true; return; }
  if(!bar){ bar = document.createElement('div'); bar.id = 'mmEdgeBar'; bar.className = 'mm-edgebar'; MM.el.appendChild(bar);
    bar.addEventListener('click', ev => { const b2 = ev.target.closest('[data-es]'); if(!b2) return; ev.stopPropagation(); const mm = mindOf(MM.id), ed = mm && mm.edges.find(x => x.id === MM.sel); if(!ed) return; const k = b2.dataset.es, v = b2.dataset.v;
      if(k === 'label'){ mmEditLabel(ed.id); return; } if(k === 'colour'){ const r = b2.getBoundingClientRect(); mmLineColour(ed.id, r.left, r.bottom + 6); return; } if(k === 'del'){ mmDelete(); bar.hidden = true; return; }
      ed[k] = k === 'w' ? +v : v; const d0 = mmEdgeDefaults(); d0[k] = ed[k]; try{ localStorage.setItem('pm:mmEdge', JSON.stringify(d0)); }catch(x){} mmRender(); mmSave(); mmEdgeBar(); }); }
  const on = (k, v, def) => ((e[k] == null ? def : e[k]) + '') === (v + '') ? ' on' : '';
  const ic = p => '<svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  bar.innerHTML = '<button type="button" data-es="shape" data-v="curve" class="' + on('shape', 'curve', 'curve') + '" title="Curve">' + ic('<path d="M2 13Q11 -2 20 13"/>') + '</button><button type="button" data-es="shape" data-v="straight" class="' + on('shape', 'straight', 'curve') + '" title="Straight">' + ic('<path d="M2 13L20 3"/>') + '</button><button type="button" data-es="shape" data-v="elbow" class="' + on('shape', 'elbow', 'curve') + '" title="Right-angled">' + ic('<path d="M2 13H11V3H20"/>') + '</button><i></i>' +
    '<button type="button" data-es="dash" data-v="solid" class="' + on('dash', 'solid', 'solid') + '" title="Solid">' + ic('<path d="M2 8H20"/>') + '</button><button type="button" data-es="dash" data-v="dash" class="' + on('dash', 'dash', 'solid') + '" title="Dashed">' + ic('<path d="M2 8H20" stroke-dasharray="4 3"/>') + '</button><button type="button" data-es="dash" data-v="dot" class="' + on('dash', 'dot', 'solid') + '" title="Dotted">' + ic('<path d="M2 8H20" stroke-dasharray="0.1 3.4" stroke-width="2.2"/>') + '</button><i></i>' +
    '<button type="button" data-es="arrow" data-v="none" class="' + on('arrow', 'none', 'none') + '" title="No arrow">' + ic('<path d="M2 8H20"/>') + '</button><button type="button" data-es="arrow" data-v="end" class="' + on('arrow', 'end', 'none') + '" title="Arrow at the end">' + ic('<path d="M2 8H18M14 4l5 4-5 4"/>') + '</button><button type="button" data-es="arrow" data-v="start" class="' + on('arrow', 'start', 'none') + '" title="Arrow at the start">' + ic('<path d="M4 8H20M8 4L3 8l5 4"/>') + '</button><button type="button" data-es="arrow" data-v="both" class="' + on('arrow', 'both', 'none') + '" title="Arrows at both ends">' + ic('<path d="M4 8H18M8 4L3 8l5 4M14 4l5 4-5 4"/>') + '</button><i></i>' +
    [1, 2, 3, 4].map(w => '<button type="button" data-es="w" data-v="' + w + '" class="' + on('w', w, 2) + '" title="Width">' + ic('<path d="M3 8H19" stroke-width="' + MM_WIDTHS[w] + '"/>') + '</button>').join('') + '<i></i>' +
    '<button type="button" data-es="colour" title="Colour"><i class="es-c" style="background:' + (e.color || '#3B332C') + '"></i></button><button type="button" data-es="label" title="Write on the line">' + ic('<path d="M5 12l7-8 5 5-7 7H5v-4z"/>') + '</button><button type="button" data-es="del" title="Delete the line">' + ic('<path d="M5 4h12M9 4V2h4v2M6 4l1 11h8l1-11"/>') + '</button>';
  const by = {}; m.nodes.forEach(n => by[n.id] = n); const g = mmEdgeGeom(e, by), bx = mmBox(), sx = g.mx * MM.view.k + MM.view.x, sy = g.my * MM.view.k + MM.view.y;
  bar.hidden = false; const w = bar.offsetWidth || 560; bar.style.left = Math.round((bx.w - w) / 2) + 'px'; bar.style.top = 'auto'; bar.style.bottom = (MM.dock ? 14 : 34) + 'px'; }
/* a new line takes the last look chosen */
{ const _add = mmAdd; mmAdd = function(...a){ const m = mindOf(MM.id), before = m ? m.edges.length : 0, r = _add.apply(this, a); try{ const d0 = mmEdgeDefaults(); if(m && m.edges.length > before) Object.assign(m.edges[m.edges.length - 1], d0); }catch(e){} return r; }; }

/* ===================== undo, redo, and versions that are kept =====================
   Every change to a map can be undone and redone (⌘Z, ⇧⌘Z, or the buttons). Every few minutes of work, and whenever a map is
   closed, a version of it is kept on this device (the last 40); any of them can be brought back. Your library on GitHub keeps
   every save as well. A map moved to the bin can be brought back for 60 days. */
MM.hist = {id: null, undo: [], redo: [], last: null, quiet: false};
function mmContent(m){ return JSON.stringify({nodes: m.nodes, edges: m.edges, ink: m.ink || [], name: m.name}); }
function mmHistReset(){ const m = mindOf(MM.id); MM.hist = {id: MM.id, undo: [], redo: [], last: m ? mmContent(m) : null, quiet: false}; }
{ const _save = mmSave; mmSave = function(){ const m = mindOf(MM.id); let viewOnly = false;
    if(m && !MM.hist.quiet){ if(MM.hist.id !== MM.id) mmHistReset(); const now = mmContent(m); if(MM.hist.last && now !== MM.hist.last){ MM.hist.undo.push(MM.hist.last); if(MM.hist.undo.length > 300) MM.hist.undo.shift(); MM.hist.redo = []; mmKeepSoon(); } else if(MM.hist.last && now === MM.hist.last) viewOnly = true; MM.hist.last = now; }
    /* only the view moved (a pan, a zoom): kept on this device, not a change to the library, so nothing is uploaded */
    if(viewOnly && m){ const b = mmBox(); m.view = {x: MM.view.x - (b.l + b.w / 2), y: MM.view.y - (b.t + b.h / 2), k: MM.view.k}; try{ localStorage.setItem('pm:mmview:' + m.id, JSON.stringify(m.view)); }catch(e){} return; }
    if(m && m.ink){ try{ const p = 'ink/mind/' + m.id + '.json', sig = nsSig(m.ink.slice(), 'mind'); if(NS.cur[p] !== sig) nsPut('mind', m.id, m.ink); }catch(e){} }
    return _save.apply(this, arguments); }; }
{ const _ov = openMind; openMind = function(id){ try{ const m = mindOf(id), v = JSON.parse(localStorage.getItem('pm:mmview:' + id) || 'null'); if(m && v) m.view = v; }catch(e){} return _ov.apply(this, arguments); }; }
function mmRestore(json){ const m = mindOf(MM.id); if(!m || !json) return; const d = JSON.parse(json); MM.hist.quiet = true; m.nodes = d.nodes; m.edges = d.edges; m.ink = d.ink; if(d.name) m.name = d.name; MM.sel = null; MM.editing = null; mmRender(); mmSave(); MM.hist.quiet = false; MM.hist.last = mmContent(m); try{ mmEdgeBar(); }catch(e){} }
function mmUndo(){ if(MM.editing) mmCommitText(); const m = mindOf(MM.id); if(!m || !MM.hist.undo.length) return; MM.hist.redo.push(mmContent(m)); mmRestore(MM.hist.undo.pop()); }
function mmRedo(){ const m = mindOf(MM.id); if(!m || !MM.hist.redo.length) return; MM.hist.undo.push(mmContent(m)); mmRestore(MM.hist.redo.pop()); }
addEventListener('keydown', ev => { if(!MM.el || MM.el.hidden || !(ev.metaKey || ev.ctrlKey) || ev.key.toLowerCase() !== 'z') return; if(document.activeElement && document.activeElement.isContentEditable) return; ev.preventDefault(); ev.shiftKey ? mmRedo() : mmUndo(); });
/* versions on this device: kept in the browser's own database (no size limit worth worrying about), one list per map */
let MM_KEEP_T = 0;
function mmKeepSoon(){ clearTimeout(MM_KEEP_T); MM_KEEP_T = setTimeout(mmKeepNow, 3 * 60e3); }
async function mmKeepNow(){ const m = mindOf(MM.id); if(!m || !window.__pmdb) return; try{ const key = 'mindv:' + m.id, list = (await window.__pmdb.get(key)) || []; const json = mmContent(m); if(list.length && list[list.length - 1].json === json) return;
    list.push({t: Date.now(), json, n: m.nodes.length}); while(list.length > 40) list.shift(); await window.__pmdb.set(key, list); }catch(e){} }
async function mmVersions(btn){ const m = mindOf(MM.id); if(!m) return; await mmKeepNow(); let list = []; try{ list = (await window.__pmdb.get('mindv:' + m.id)) || []; }catch(e){}
  if(!list.length){ toast('No earlier versions of this map on this device yet; your library on GitHub keeps every save (the cloud › Earlier versions)'); return; }
  const r = btn.getBoundingClientRect(); openFloatMenu(r.left, r.bottom + 6, list.slice().reverse().slice(0, 30).map(v => ({label: new Date(v.t).toLocaleString('en-GB', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) + ' · ' + v.n + (v.n === 1 ? ' node' : ' nodes'), fn: () => { MM.hist.undo.push(mmContent(m)); mmRestore(v.json); toast('This version is back (undo returns to where you were)'); }}))); }
/* the bin */
function mmBin(m){ lib.mindsTrash = (lib.mindsTrash || []).filter(x => Date.now() - (x.deletedAt || 0) < 60 * 864e5); lib.mindsTrash.push(Object.assign(JSON.parse(JSON.stringify(m)), {deletedAt: Date.now()})); lib.minds = mindsAll().filter(x => x.id !== m.id); touchLib(); toast('“' + m.name + '” is in the bin; bring it back from Your maps › Recently deleted'); }
function mmBinMenu(x, y){ const t = (lib.mindsTrash || []).filter(z => Date.now() - (z.deletedAt || 0) < 60 * 864e5); if(!t.length){ toast('The bin is empty'); return; }
  openFloatMenu(x, y, t.slice().reverse().map(z => ({label: '↺ ' + z.name + ' · ' + new Date(z.deletedAt).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}), fn: () => { lib.mindsTrash = lib.mindsTrash.filter(q => q !== z); const back = Object.assign({}, z); delete back.deletedAt; mindsAll().push(back); touchLib(); toast('“' + back.name + '” is back'); try{ openMind(back.id); }catch(e){} }}))); }
/* closing or leaving keeps a version; opening starts a fresh undo history */
{ const _open = openMind; openMind = function(id){ const r = _open.apply(this, arguments); mmHistReset(); requestAnimationFrame(() => requestAnimationFrame(() => { try{ mmRender(); }catch(e){} })); return r; }; }
{ const _dock = mindDock; mindDock = function(){ const r = _dock.apply(this, arguments); mmHistReset(); requestAnimationFrame(() => requestAnimationFrame(() => { try{ mmRender(); }catch(e){} })); return r; }; }
{ const _close = closeMind; closeMind = function(){ try{ mmKeepNow(); }catch(e){} return _close.apply(this, arguments); }; }
addEventListener('pagehide', () => { try{ if(MM.id) mmKeepNow(); }catch(e){} });

/* ===================== the unlimited canvas: a navigator =====================
   The map has no edges: zoom from 4% to 1200% (pinch, or ⌘ and scroll), move anywhere. In a corner a small navigator shows the
   whole map and where you are; tap it to go there; the percentage beside it brings you back to everything at once. */
function mmNavEnsure(){ let nav = document.getElementById('mmNav'); if(nav) return nav; nav = document.createElement('div'); nav.id = 'mmNav'; nav.className = 'mm-nav';
  nav.innerHTML = '<svg id="mmNavSvg" width="168" height="112"></svg><div class="mm-nav-row"><button type="button" data-nav="out" aria-label="Smaller">−</button><button type="button" data-nav="fit" id="mmNavPct" title="See everything">100%</button><button type="button" data-nav="in" aria-label="Larger">+</button></div>';
  MM.el.appendChild(nav);
  const go = ev => { const r = mm$('mmNavSvg').getBoundingClientRect(), g = nav._g; if(!g) return; const wx = g.x0 + (ev.clientX - r.left) / g.s, wy = g.y0 + (ev.clientY - r.top) / g.s, bx = mmBox(); MM.view.x = bx.l + bx.w / 2 - wx * MM.view.k; MM.view.y = bx.t + bx.h / 2 - wy * MM.view.k; mmApply(); clearTimeout(MM.wt); MM.wt = setTimeout(mmSave, 400); };
  mm$('mmNavSvg').addEventListener('pointerdown', ev => { ev.stopPropagation(); go(ev); const mv = e2 => go(e2), up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); });
  nav.addEventListener('click', ev => { const b = ev.target.closest('[data-nav]'); if(!b) return; ev.stopPropagation(); const k = b.dataset.nav; if(k === 'fit'){ mmFit(); return; } const bx = mmBox(), cx = bx.l + bx.w / 2, cy = bx.t + bx.h / 2, k0 = MM.view.k, k1 = Math.max(.04, Math.min(12, k0 * (k === 'in' ? 1.25 : .8))), wx = (cx - MM.view.x) / k0, wy = (cy - MM.view.y) / k0; MM.view.k = k1; MM.view.x = cx - wx * k1; MM.view.y = cy - wy * k1; mmApply(); clearTimeout(MM.wt); MM.wt = setTimeout(mmSave, 400); });
  return nav; }
function mmNavDraw(){ const m = mindOf(MM.id); if(!m || !MM.el || MM.el.hidden) return; const nav = mmNavEnsure(), svg = mm$('mmNavSvg'), bx = mmBox(), W = 168, H = 112;
  const vx0 = (bx.l - MM.view.x) / MM.view.k, vy0 = (bx.t - MM.view.y) / MM.view.k, vx1 = vx0 + bx.w / MM.view.k, vy1 = vy0 + bx.h / MM.view.k;
  let x0 = vx0, y0 = vy0, x1 = vx1, y1 = vy1; m.nodes.forEach(n => { const s = MM.sz[n.id] || [150, 46]; x0 = Math.min(x0, n.x - s[0] / 2); y0 = Math.min(y0, n.y - s[1] / 2); x1 = Math.max(x1, n.x + s[0] / 2); y1 = Math.max(y1, n.y + s[1] / 2); });
  (m.ink || []).forEach(s => { for(let i = 0; i < s.p.length; i += 6){ x0 = Math.min(x0, s.p[i]); y0 = Math.min(y0, s.p[i + 1]); x1 = Math.max(x1, s.p[i]); y1 = Math.max(y1, s.p[i + 1]); } });
  const pad = 40; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad; const s = Math.min(W / (x1 - x0), H / (y1 - y0)), ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2; nav._g = {x0: x0 - ox / s, y0: y0 - oy / s, s};
  const X = v => ((v - x0) * s + ox).toFixed(1), Y = v => ((v - y0) * s + oy).toFixed(1);
  svg.innerHTML = m.nodes.map(n => { const z = MM.sz[n.id] || [150, 46]; return '<rect x="' + X(n.x - z[0] / 2) + '" y="' + Y(n.y - z[1] / 2) + '" width="' + Math.max(2, z[0] * s).toFixed(1) + '" height="' + Math.max(1.5, z[1] * s).toFixed(1) + '" rx="1.5" class="n"/>'; }).join('') +
    '<rect x="' + X(vx0) + '" y="' + Y(vy0) + '" width="' + ((vx1 - vx0) * s).toFixed(1) + '" height="' + ((vy1 - vy0) * s).toFixed(1) + '" class="v"/>';
  mm$('mmNavPct').textContent = Math.round(MM.view.k * 100) + '%'; }
{ const _apply = mmApply; mmApply = function(){ const r = _apply.apply(this, arguments); clearTimeout(MM.navT); MM.navT = setTimeout(() => { try{ mmNavDraw(); }catch(e){} try{ mmEdgeBar(); }catch(e){} }, 30); return r; }; }
{ const _render = mmRender; mmRender = function(){ const r = _render.apply(this, arguments); try{ mmNavDraw(); }catch(e){} try{ mmEdgeBar(); }catch(e){} return r; }; }
/* pinch with two fingers to zoom, on an iPad */
(() => { let d0 = 0, k0 = 1, c0 = null; const pts = new Map();
  document.addEventListener('pointerdown', ev => { if(ev.pointerType !== 'touch' || !MM.el || MM.el.hidden || !ev.target.closest || !ev.target.closest('#mmStage')) return; pts.set(ev.pointerId, [ev.clientX, ev.clientY]); if(pts.size === 2){ const [a, b] = [...pts.values()]; d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); k0 = MM.view.k; c0 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; MM.drag = null; } }, true);
  document.addEventListener('pointermove', ev => { if(!pts.has(ev.pointerId)) return; pts.set(ev.pointerId, [ev.clientX, ev.clientY]); if(pts.size === 2 && d0){ ev.stopPropagation(); const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), k1 = Math.max(.04, Math.min(12, k0 * d / d0)), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], wx = (c0[0] - MM.view.x) / MM.view.k, wy = (c0[1] - MM.view.y) / MM.view.k; MM.view.k = k1; MM.view.x = c[0] - wx * k1; MM.view.y = c[1] - wy * k1; c0 = c; mmApply(); } }, true);
  const up = ev => { if(!pts.has(ev.pointerId)) return; pts.delete(ev.pointerId); if(pts.size < 2 && d0){ d0 = 0; clearTimeout(MM.wt); MM.wt = setTimeout(mmSave, 300); } };
  document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true); })();
if(/[?&]pmtest\b/.test(location.search)) window.__mm = {MM, mindOf, mindNew, openMind, mmAdd, mmUndo, mmRedo, mmSvg, mmBin, mmKeepNow, mmRender, mmSave, mmExport, mmSelect: id => { MM.sel = id; mmRender(); }};

/* ===================== pictures on a mind map =====================
   A clip from a PDF page, or any picture you paste (⌘V) or drop onto a map. The picture is kept on this device at once and
   copied to GitHub beside your PDFs (clips/), so every device shows it; the map itself holds only a reference, so your library
   file stays small. Drag a picture's corner to size it; it exports, sharp, into PDF and SVG. */
const MM_PIC = {};
function mmPicId(){ return 'clip-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
async function mmPicKeep(id, data){ MM_PIC[id] = data; try{ if(window.__pmdb) await window.__pmdb.set('clip:' + id, data); }catch(e){} }
async function mmPicUpload(id, data, n){ const c = ghCfg(); if(!c || PREVIEW) return; try{
    const repo = (c.kind === 'folder' || c.kind === 'dropbox') ? null : await pdfTarget(c), cc = repo ? ghRepo(c, repo) : c;
    const r = await ghPutPath(cc, 'clips/' + id + '.jpg', String(data).split(',')[1], 'Picture for a mind map');
    if(r && (r.ok || r.status === 422)){ if(repo && repo !== c.repo){ n.repo = repo; touchLib(); } } }catch(e){} }
async function mmPicGet(id, n){ if(MM_PIC[id]) return MM_PIC[id];
  try{ const v = window.__pmdb && await window.__pmdb.get('clip:' + id); if(v){ MM_PIC[id] = v; return v; } }catch(e){}
  const c = ghCfg(); if(!c) return null;
  try{ const cc = n && n.repo ? ghRepo(c, n.repo) : c; let bytes = null;
    if(c.kind === 'folder' || c.kind === 'dropbox'){ bytes = await remoteBytes(cc, 'clips/' + id + '.jpg'); }
    else { const repos = [cc.repo, c.repo].concat((lib.pdfStore && lib.pdfStore.repos) || []).filter((x, i, a2) => x && a2.indexOf(x) === i);
      for(const repo of repos){ const cA = ghRepo(c, repo), r = await fetch(ghPathUrl(cA, 'clips/' + id + '.jpg') + '?_=' + Date.now(), {headers: ghHeaders(cA, {'Accept': 'application/vnd.github.raw+json'})}); if(r.ok){ bytes = new Uint8Array(await r.arrayBuffer()); break; } } }
    if(!bytes || !bytes.length) return null;
    const data = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(new Blob([bytes], {type: 'image/jpeg'})); });
    mmPicKeep(id, data); return data; }catch(e){ return null; } }
function mmPicsFill(m){ (m || mindOf(MM.id) || {nodes: []}).nodes.filter(n => n.type === 'image').forEach(async n => { const img = document.querySelector('#mmNodes .mm-node[data-n="' + n.id + '"] img[data-clip]'); if(!img || img.src) return; const src = await mmPicGet(n.clip, n); if(src && img.isConnected) img.src = src; }); }
/* turn any picture into a JPEG of sensible size (paste, drop) */
function mmPicFrom(blob){ return new Promise((res, rej) => { const u = URL.createObjectURL(blob), im = new Image(); im.onload = () => { const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight)), W = Math.max(1, Math.round(im.naturalWidth * k)), H = Math.max(1, Math.round(im.naturalHeight * k)), cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(im, 0, 0, W, H); URL.revokeObjectURL(u); res({data: cv.toDataURL('image/jpeg', .9), w: W, h: H}); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('picture')); }; im.src = u; }); }
function mmPicAdd(data, w, h, cite, at){ const m = mindOf(MM.id); if(!m || !data) return null; if(MM.editing) mmCommitText();
  const n = at ? mmAdd('text', null, at) : mmAdd('text', null); if(!n) return null; MM.editing = null;
  const id = mmPicId(); Object.assign(n, {type: 'image', text: '', clip: id, pw: w, ph: h, w: Math.round(Math.min(340, Math.max(160, w / 3))), cite: cite || ''});
  mmPicKeep(id, data); mmRender(); mmSave(); try{ mmShow(n); }catch(e){} mmPicUpload(id, data, n); return n; }
/* from the reading page: the map beside the paper takes the clip, under the paper's own node */
function mindClip(data, w, h, cite){ if(!MM.dock) return false; const m = mindOf(MM.id); if(!m) return false;
  if(!MM.sel || !m.nodes.some(n => n.id === MM.sel)){ const pin = mmPaperNode(m); if(pin) MM.sel = pin.id; }
  return !!mmPicAdd(data, w, h, cite); }
/* paste a picture (⌘V) onto an open map, or drop picture files onto it */
document.addEventListener('paste', async ev => { if(!MM.el || MM.el.hidden || (document.activeElement && document.activeElement.isContentEditable)) return;
  const it = [...(ev.clipboardData && ev.clipboardData.items || [])].find(x => /^image\//.test(x.type)); if(!it) return; ev.preventDefault();
  try{ const p = await mmPicFrom(it.getAsFile()), bx = mmBox(), [wx, wy] = mmToWorld(bx.l + bx.w / 2, bx.t + bx.h / 2); MM.sel = null; mmPicAdd(p.data, p.w, p.h, '', [Math.round(wx), Math.round(wy)]); }catch(e){ toast('That picture could not be added'); } });
document.addEventListener('dragover', ev => { if(!MM.el || MM.el.hidden || !ev.target.closest || !ev.target.closest('#mmStage')) return; if([...(ev.dataTransfer && ev.dataTransfer.items || [])].some(x => /^image\//.test(x.type))){ ev.preventDefault(); ev.stopPropagation(); } }, true);
document.addEventListener('drop', async ev => { if(!MM.el || MM.el.hidden || !ev.target.closest || !ev.target.closest('#mmStage')) return; const fs = [...(ev.dataTransfer && ev.dataTransfer.files || [])].filter(f => /^image\//.test(f.type)); if(!fs.length) return; ev.preventDefault(); ev.stopPropagation();
  let [wx, wy] = mmToWorld(ev.clientX, ev.clientY); for(const f of fs){ try{ const p = await mmPicFrom(f); MM.sel = null; mmPicAdd(p.data, p.w, p.h, '', [Math.round(wx), Math.round(wy)]); wy += 240; }catch(e){} } }, true);

/* ===================== many nodes at once: choose, move, align, tidy =====================
   Shift and drag on the empty map draws a box that chooses every node it touches (on an iPad: the ⬚ tool, then drag); shift
   and click adds or removes one. Drag any chosen node and they all move. With several chosen, the bar at the foot lines them
   up (left, centre, right, top, middle, bottom) or spaces them evenly; Tidy lays the whole map out as a tree from its centre. */
MM.multi = new Set();
function mmMultiSet(ids){ MM.multi = new Set(ids); document.querySelectorAll('#mmNodes .mm-node').forEach(el => el.classList.toggle('multi', MM.multi.has(el.dataset.n))); try{ mmNodeBar(); }catch(e){} }
function mmDeleteMany(){ const m = mindOf(MM.id); if(!m) return; const pin = m.pin, keep = n => pin && n.type === pin.kind && n.ref === pin.id;
  const gone = new Set([...MM.multi].filter(id => { const n = m.nodes.find(x => x.id === id); return n && !keep(n); }));
  m.nodes = m.nodes.filter(n => !gone.has(n.id)); m.edges = m.edges.filter(e => !gone.has(e.a) && !gone.has(e.b)); MM.multi = new Set(); MM.sel = null; mmRender(); mmSave(); }
function mmNodeSize(n){ return MM.sz[n.id] || [n.w || 150, 46]; }
(() => { let box = null, grp = null, selMode = false;
  const stageOf = ev => ev.target.closest && ev.target.closest('#mmStage');
  document.addEventListener('pointerdown', ev => { if(!MM.el || MM.el.hidden || ev.button !== 0 || !stageOf(ev) || MI.on) return; const m = mindOf(MM.id); if(!m) return;
    const node = ev.target.closest('.mm-node'), dot = ev.target.closest('[data-dot]'), rs = ev.target.closest('[data-rs]');
    if(dot || rs || (node && node.querySelector('[contenteditable="true"]'))) return;
    if(node && ev.shiftKey){ ev.stopPropagation(); ev.preventDefault(); const id = node.dataset.n, s = new Set(MM.multi); if(MM.sel && !s.size && MM.sel !== id && m.nodes.some(x => x.id === MM.sel)) s.add(MM.sel); s.has(id) ? s.delete(id) : s.add(id); MM.sel = null; mmSelect(null); mmMultiSet(s); return; }
    if(node && MM.multi.size > 1 && MM.multi.has(node.dataset.n)){ ev.stopPropagation(); ev.preventDefault(); grp = {sx: ev.clientX, sy: ev.clientY, o: [...MM.multi].map(id => { const n = m.nodes.find(x => x.id === id); return n && [n, n.x, n.y]; }).filter(Boolean), moved: false}; try{ mm$('mmStage').setPointerCapture(ev.pointerId); }catch(e){} return; }
    if(!node && !ev.target.closest('.mm-edge') && (ev.shiftKey || selMode) && ev.pointerType !== 'touch' || (!node && selMode && ev.pointerType === 'touch')){ ev.stopPropagation(); ev.preventDefault();
      box = {sx: ev.clientX, sy: ev.clientY, el: document.createElement('div')}; box.el.className = 'mm-marquee'; MM.el.appendChild(box.el); try{ mm$('mmStage').setPointerCapture(ev.pointerId); }catch(e){} return; }
    if(!node && MM.multi.size){ mmMultiSet([]); } else if(node && MM.multi.size && !MM.multi.has(node.dataset.n)) mmMultiSet([]); }, true);
  document.addEventListener('pointermove', ev => {
    if(box){ ev.stopPropagation(); const bx = MM.el.getBoundingClientRect(), l = Math.min(box.sx, ev.clientX), t = Math.min(box.sy, ev.clientY); Object.assign(box.el.style, {left: l - bx.left + 'px', top: t - bx.top + 'px', width: Math.abs(ev.clientX - box.sx) + 'px', height: Math.abs(ev.clientY - box.sy) + 'px'}); box.ex = ev.clientX; box.ey = ev.clientY; return; }
    if(grp){ ev.stopPropagation(); const dx = (ev.clientX - grp.sx) / MM.view.k, dy = (ev.clientY - grp.sy) / MM.view.k; if(Math.hypot(dx, dy) > 3) grp.moved = true; if(!grp.moved) return;
      grp.o.forEach(([n, x, y]) => { n.x = Math.round(x + dx); n.y = Math.round(y + dy); const el = document.querySelector('#mmNodes [data-n="' + n.id + '"]'); if(el){ el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; } }); mmEdgesOnly(); } }, true);
  const up = ev => {
    if(box){ ev.stopPropagation(); const m = mindOf(MM.id), b = box; box = null; b.el.remove(); if(!m || b.ex == null) return;
      const [x0, y0] = mmToWorld(Math.min(b.sx, b.ex), Math.min(b.sy, b.ey)), [x1, y1] = mmToWorld(Math.max(b.sx, b.ex), Math.max(b.sy, b.ey));
      const hit = m.nodes.filter(n => { const [w, h] = mmNodeSize(n); return n.x + w / 2 >= x0 && n.x - w / 2 <= x1 && n.y + h / 2 >= y0 && n.y - h / 2 <= y1; }).map(n => n.id);
      const s = ev.shiftKey ? new Set([...MM.multi, ...hit]) : new Set(hit); MM.sel = null; mmSelect(null); mmMultiSet(s); return; }
    if(grp){ ev.stopPropagation(); const g = grp; grp = null; if(g.moved) mmSave(); } };
  document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true);
  /* the ⬚ tool for a touch screen: one finger draws the box instead of moving the map */
  window.mmSelMode = on => { selMode = on == null ? !selMode : on; MM.el && MM.el.classList.toggle('selmode', selMode); const b = MM.el && MM.el.querySelector('[data-mm="select"]'); if(b) b.classList.toggle('on', selMode); };
})();
/* after every drawing the chosen nodes stay marked */
{ const _r = mmRender; mmRender = function(){ const m = mindOf(MM.id); if(m && MM.multi.size){ const ids = new Set(m.nodes.map(n => n.id)); MM.multi = new Set([...MM.multi].filter(id => ids.has(id))); } const r = _r.apply(this, arguments); try{ mmNodeBar(); }catch(e){} return r; }; }
{ const _s = mmSelect; mmSelect = function(id){ const r = _s.apply(this, arguments); try{ mmNodeBar(); mmEdgeBar(); }catch(e){} return r; }; }
addEventListener('keydown', ev => { if(!MM.el || MM.el.hidden || (document.activeElement && document.activeElement.isContentEditable) || /input|textarea/i.test((document.activeElement || {}).tagName || '')) return;
  if((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'a'){ const m = mindOf(MM.id); if(!m) return; ev.preventDefault(); MM.sel = null; mmSelect(null); mmMultiSet(m.nodes.map(n => n.id)); }
  if(ev.key === 'Escape' && MM.multi.size) mmMultiSet([]); });
/* line up, space evenly */
function mmAlign(how){ const m = mindOf(MM.id); if(!m) return; const ns = m.nodes.filter(n => MM.multi.has(n.id)); if(ns.length < 2) return; const sz = n => mmNodeSize(n);
  const L = n => n.x - sz(n)[0] / 2, R = n => n.x + sz(n)[0] / 2, T = n => n.y - sz(n)[1] / 2, B = n => n.y + sz(n)[1] / 2;
  if(how === 'left'){ const v = Math.min(...ns.map(L)); ns.forEach(n => n.x = Math.round(v + sz(n)[0] / 2)); }
  else if(how === 'right'){ const v = Math.max(...ns.map(R)); ns.forEach(n => n.x = Math.round(v - sz(n)[0] / 2)); }
  else if(how === 'centre'){ const v = ns.reduce((a, n) => a + n.x, 0) / ns.length; ns.forEach(n => n.x = Math.round(v)); }
  else if(how === 'top'){ const v = Math.min(...ns.map(T)); ns.forEach(n => n.y = Math.round(v + sz(n)[1] / 2)); }
  else if(how === 'bottom'){ const v = Math.max(...ns.map(B)); ns.forEach(n => n.y = Math.round(v - sz(n)[1] / 2)); }
  else if(how === 'middle'){ const v = ns.reduce((a, n) => a + n.y, 0) / ns.length; ns.forEach(n => n.y = Math.round(v)); }
  else if(how === 'spreadx' && ns.length > 2){ ns.sort((a, b) => a.x - b.x); const a = ns[0].x, z = ns[ns.length - 1].x; ns.forEach((n, i) => n.x = Math.round(a + (z - a) * i / (ns.length - 1))); }
  else if(how === 'spready' && ns.length > 2){ ns.sort((a, b) => a.y - b.y); const a = ns[0].y, z = ns[ns.length - 1].y; ns.forEach((n, i) => n.y = Math.round(a + (z - a) * i / (ns.length - 1))); }
  mmRender(); mmSave(); }
/* Tidy: a tree from the centre (the paper or book a map is pinned to, else the most connected node): its branches go out to
   the right and the left, evenly, each child below the one before; nodes not joined to it go in a row underneath */
function mmTidy(){ const m = mindOf(MM.id); if(!m || !m.nodes.length) return; const adj = {}; m.nodes.forEach(n => adj[n.id] = []); m.edges.forEach(e => { if(adj[e.a] && adj[e.b]){ adj[e.a].push(e.b); adj[e.b].push(e.a); } });
  const pin = m.pin && m.nodes.find(n => n.type === m.pin.kind && n.ref === m.pin.id), root = pin || m.nodes.slice().sort((a, b) => adj[b.id].length - adj[a.id].length)[0];
  const kids = {}, seen = new Set([root.id]), q = [root.id]; while(q.length){ const id = q.shift(); kids[id] = []; adj[id].forEach(k => { if(!seen.has(k)){ seen.add(k); kids[id].push(k); q.push(k); } }); }
  const by = {}; m.nodes.forEach(n => by[n.id] = n); const sz = id => mmNodeSize(by[id]), GAPY = 26, GAPX = 90;
  Object.keys(kids).forEach(id => kids[id].sort((a, b) => by[a].y - by[b].y));
  const hOf = {}; const H = id => hOf[id] != null ? hOf[id] : (hOf[id] = Math.max(sz(id)[1], kids[id].reduce((s, k) => s + H(k), 0) + GAPY * Math.max(0, kids[id].length - 1)));
  const place = (id, x, yTop, dir) => { const h = H(id); by[id].x = Math.round(x); by[id].y = Math.round(yTop + h / 2); let y = yTop + (h - (kids[id].reduce((s, k) => s + H(k), 0) + GAPY * Math.max(0, kids[id].length - 1))) / 2;
    kids[id].forEach(k => { const nx = x + dir * (sz(id)[0] / 2 + GAPX + sz(k)[0] / 2); place(k, nx, y, dir); y += H(k) + GAPY; }); };
  const rk = kids[root.id], right = rk.filter(k => by[k].x >= root.x), left = rk.filter(k => by[k].x < root.x), sum = arr => arr.reduce((s, k) => s + H(k) + GAPY, 0);
  while(right.length > 1 && sum(right) - sum(left) > 1.6 * Math.max(...right.map(H))){ right.sort((p, q) => by[q].y - by[p].y); left.push(right.shift()); }
  while(left.length > 1 && sum(left) - sum(right) > 1.6 * Math.max(...left.map(H))){ left.sort((p, q) => by[q].y - by[p].y); right.push(left.shift()); }
  const hr = sum(right), hl = sum(left);
  const keepOrder = arr => arr.sort((a, b) => by[a].y - by[b].y), cx = root.x, cy = root.y;
  [[keepOrder(right), 1, hr], [keepOrder(left), -1, hl]].forEach(([arr, dir, tot]) => { let y = cy - (tot - GAPY) / 2; arr.forEach(k => { place(k, cx + dir * (sz(root.id)[0] / 2 + GAPX + sz(k)[0] / 2), y, dir); y += H(k) + GAPY; }); });
  const rest = m.nodes.filter(n => !seen.has(n.id)); if(rest.length){ const ys = m.nodes.filter(n => seen.has(n.id)).map(n => n.y + mmNodeSize(n)[1] / 2); let x = cx - (rest.length - 1) * 110, y = Math.max(...ys) + 120; rest.forEach(n => { n.x = Math.round(x); n.y = Math.round(y); x += 220; }); }
  mmRender(); mmSave(); mmFit(); toast('Tidied (undo returns it as it was)'); }
/* the bar at the foot for nodes: shape, fill, text size and weight for one or many; line up and space for many; link to a map */
const MM_FILLS = [['', 'Paper'], ['#FFF3C4', 'Butter'], ['#FFD9CF', 'Rose'], ['#D7ECFF', 'Sky'], ['#D9F2DA', 'Mint'], ['#EADCFB', 'Lilac'], ['#F2E6D8', 'Sand'], ['#231E1A', 'Ink']];
function mmNodeBar(){ let bar = document.getElementById('mmNodeBar'); const m = mindOf(MM.id); if(!m || !MM.el){ if(bar) bar.hidden = true; return; }
  const one = MM.sel && m.nodes.find(n => n.id === MM.sel), many = m.nodes.filter(n => MM.multi.has(n.id)), ns = many.length > 1 ? many : one ? [one] : [];
  if(!ns.length || MM.editing || MI.on){ if(bar) bar.hidden = true; return; }
  if(!bar){ bar = document.createElement('div'); bar.id = 'mmNodeBar'; bar.className = 'mm-edgebar mm-nodebar'; MM.el.appendChild(bar);
    bar.addEventListener('click', ev => { const b2 = ev.target.closest('[data-ns]'); if(!b2) return; ev.stopPropagation(); const mm = mindOf(MM.id); if(!mm) return; const k = b2.dataset.ns, v = b2.dataset.v;
      const tgt = mm.nodes.filter(n => MM.multi.size > 1 ? MM.multi.has(n.id) : n.id === MM.sel);
      if(k === 'align'){ mmAlign(v); return; } if(k === 'tidy'){ mmTidy(); return; } if(k === 'link'){ mmLinkMenu(b2, tgt[0]); return; } if(k === 'del'){ MM.multi.size > 1 ? mmDeleteMany() : mmDelete(); return; }
      tgt.forEach(n => { if(k === 'shape') n.shape = v === 'round' ? undefined : v; else if(k === 'fill'){ n.fill = v || undefined; n.ink = v === '#231E1A' ? '#FBF8F2' : undefined; } else if(k === 'ts') n.ts = v === 'm' ? undefined : v; else if(k === 'bold') n.bold = !tgt[0].bold || undefined; });
      mmRender(); mmSave(); }); }
  const f = ns[0], on = (k, v, def) => (((f[k] == null ? def : f[k]) + '') === (v + '')) ? ' on' : '', ic = p => '<svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  let h = '<button type="button" data-ns="shape" data-v="round" class="' + on('shape', 'round', 'round') + '" title="Rounded">' + ic('<rect x="3" y="3" width="16" height="10" rx="3.5"/>') + '</button><button type="button" data-ns="shape" data-v="rect" class="' + on('shape', 'rect', 'round') + '" title="Square corners">' + ic('<rect x="3" y="3" width="16" height="10" rx=".5"/>') + '</button><button type="button" data-ns="shape" data-v="pill" class="' + on('shape', 'pill', 'round') + '" title="Pill">' + ic('<rect x="2" y="3" width="18" height="10" rx="5"/>') + '</button><button type="button" data-ns="shape" data-v="ellipse" class="' + on('shape', 'ellipse', 'round') + '" title="Oval">' + ic('<ellipse cx="11" cy="8" rx="9" ry="5.5"/>') + '</button><button type="button" data-ns="shape" data-v="none" class="' + on('shape', 'none', 'round') + '" title="Words only">' + ic('<path d="M6 12V4M3 4h6M13 12V7M11 7h4"/>') + '</button><i></i>' +
    MM_FILLS.map(([c, n2]) => '<button type="button" data-ns="fill" data-v="' + c + '" class="' + ((f.fill || '') === c ? 'on' : '') + '" title="' + n2 + '"><i class="es-c" style="background:' + (c || '#FFFDF8') + '"></i></button>').join('') + '<i></i>' +
    '<button type="button" data-ns="ts" data-v="s" class="' + on('ts', 's', 'm') + '" title="Small">' + ic('<text x="7" y="12" font-size="9" fill="currentColor" stroke="none" font-family="serif">A</text>') + '</button><button type="button" data-ns="ts" data-v="m" class="' + on('ts', 'm', 'm') + '" title="Medium">' + ic('<text x="6" y="12.5" font-size="12" fill="currentColor" stroke="none" font-family="serif">A</text>') + '</button><button type="button" data-ns="ts" data-v="l" class="' + on('ts', 'l', 'm') + '" title="Large">' + ic('<text x="5" y="14" font-size="16" fill="currentColor" stroke="none" font-family="serif">A</text>') + '</button><button type="button" data-ns="bold" class="' + (f.bold ? 'on' : '') + '" title="Bold">' + ic('<text x="6" y="13" font-size="13" font-weight="700" fill="currentColor" stroke="none" font-family="serif">B</text>') + '</button>';
  if(ns.length > 1) h += '<i></i>' + [['left', 'Line up left', '<path d="M3 2v12M6 4h12M6 9h8"/>'], ['centre', 'Line up centres', '<path d="M11 2v12M5 4h12M7 9h8"/>'], ['right', 'Line up right', '<path d="M19 2v12M4 4h12M8 9h8"/>'], ['top', 'Line up tops', '<path d="M2 2h18M5 5v9M11 5v6M17 5v8"/>'], ['middle', 'Line up middles', '<path d="M2 8h18M5 3v10M11 5v6M17 4v8"/>'], ['bottom', 'Line up bottoms', '<path d="M2 14h18M5 2v9M11 5v6M17 3v8"/>'], ['spreadx', 'Space evenly across', '<path d="M2 2v12M20 2v12M8 5v6M14 5v6"/>'], ['spready', 'Space evenly down', '<path d="M2 2h18M2 14h18M6 6h10M6 10h10"/>']].map(([v, t, p]) => '<button type="button" data-ns="align" data-v="' + v + '" title="' + t + '">' + ic(p) + '</button>').join('');
  else h += '<i></i><button type="button" data-ns="link" title="Link to another map">' + ic('<path d="M9 11l-2 2a3 3 0 0 1-4-4l2-2M13 5l2-2a3 3 0 0 1 4 4l-2 2M8 8l6 0"/>') + '</button>';
  h += '<button type="button" data-ns="tidy" title="Tidy the whole map">' + ic('<path d="M3 8h4M7 8l4-4h8M7 8l4 4h8M11 8h8"/>') + '</button><button type="button" data-ns="del" title="Delete">' + ic('<path d="M5 4h12M9 4V2h4v2M6 4l1 11h8l1-11"/>') + '</button>';
  bar.innerHTML = h; bar.hidden = false; const bx = mmBox(), w = bar.offsetWidth || 600; bar.style.left = Math.max(8, Math.round((bx.w - w) / 2)) + 'px'; bar.style.top = 'auto'; bar.style.bottom = (MM.dock ? 14 : 34) + 'px'; }
/* shapes in the export */
function mmShapeSvg(n, x, y, w, h, card){ const fill = n.fill || (card ? '#FFFDF8' : '#FFFDF8'), st = n.fill ? '' : ' stroke="' + (card ? '#D9D0C1' : '#E2D8C8') + '" stroke-width="' + (card ? 1 : .8) + '"', sh = n.shape || 'round';
  if(sh === 'none') return ''; if(sh === 'ellipse') return '<ellipse cx="' + (x + w / 2).toFixed(1) + '" cy="' + (y + h / 2).toFixed(1) + '" rx="' + (w / 2).toFixed(1) + '" ry="' + (h / 2).toFixed(1) + '" fill="' + fill + '"' + st + '/>';
  const rx = sh === 'rect' ? 1.5 : sh === 'pill' ? h / 2 : (card ? 6 : 8); return mmRoundRect(x, y, w, h, rx, fill, st); }
function mmRoundRect(x, y, w, h, r, fill, st){ r = Math.min(r, w / 2, h / 2); const k = .5523 * r, X = v => v.toFixed(1);
  return '<path d="M' + X(x + r) + ' ' + X(y) + 'H' + X(x + w - r) + 'C' + X(x + w - r + k) + ' ' + X(y) + ' ' + X(x + w) + ' ' + X(y + r - k) + ' ' + X(x + w) + ' ' + X(y + r) + 'V' + X(y + h - r) + 'C' + X(x + w) + ' ' + X(y + h - r + k) + ' ' + X(x + w - r + k) + ' ' + X(y + h) + ' ' + X(x + w - r) + ' ' + X(y + h) + 'H' + X(x + r) + 'C' + X(x + r - k) + ' ' + X(y + h) + ' ' + X(x) + ' ' + X(y + h - r + k) + ' ' + X(x) + ' ' + X(y + h - r) + 'V' + X(y + r) + 'C' + X(x) + ' ' + X(y + r - k) + ' ' + X(x + r - k) + ' ' + X(y) + ' ' + X(x + r) + ' ' + X(y) + 'Z" fill="' + fill + '"' + st + '/>'; }
/* the PDF of a mind map at its real size: one page as large as the map (1 px = 1 pt), never shrunk to a sheet of paper; past
   the 200-inch limit of a PDF page the page counts in larger units (UserUnit), so it keeps its size */
function mmPdfPage(x){ const big = Math.max(x.w, x.h), u = big > 14000 ? Math.ceil(big / 14000) : 1, page = new PdfPage(x.w / u, x.h / u); if(u > 1){ page.pre = pdfNum(1 / u) + ' 0 0 ' + pdfNum(1 / u) + ' 0 0 cm\n'; page.userUnit = u; }
  pdfDrawSvg(page, new DOMParser().parseFromString(x.svg, 'image/svg+xml').documentElement); return page; }

/* ===================== links between maps =====================
   Any node can lead to another map (the node's bar › link): a small ↗ under it names that map and opens it. The outline lists
   the maps that lead here. */
function mmLinkMenu(btn, n){ if(!n) return; const r = btn.getBoundingClientRect(), others = mindsAll().filter(x => x.id !== MM.id);
  const items = others.map(x => ({label: (n.link === x.id ? '✓ ' : '') + x.name, fn: () => { n.link = x.id; mmRender(); mmSave(); }}));
  if(n.link) items.push({sep: 1}, {label: 'No link', fn: () => { delete n.link; mmRender(); mmSave(); }});
  if(!items.length){ toast('Make another mind map first, then link to it'); return; } openFloatMenu(r.left, r.top - 8 - Math.min(others.length + 2, 12) * 34, items); }
function mmGoLink(id){ const t = mindOf(id); if(!t){ toast('That map is in the bin (Your maps › Recently deleted)'); return; } try{ if(MM.dock) mindUndock(); }catch(e){} setTimeout(() => openMind(id), MM.dock ? 300 : 0); }
document.addEventListener('click', ev => { const c = ev.target.closest && ev.target.closest('#mind [data-golink]'); if(!c) return; ev.stopPropagation(); mmGoLink(c.dataset.golink); }, true);
function mmBacklinks(id){ return mindsAll().filter(x => x.id !== id && (x.nodes || []).some(n => n.link === id)); }

/* ===================== the outline, and finding on the map =====================
   ≡ among the map's tools (or ⌘F): the whole map as an indented list, from its centre outwards, with a search at the top;
   matches are marked on the map, Enter goes from one to the next, and a line of the list takes you to its node. */
function mmLabel(n){ if(n.type === 'paper'){ const e = lib.entries[n.ref]; return e ? (e.t || 'Untitled') : 'A paper'; } if(n.type === 'book'){ const b = mmBook(n.ref); return b ? b.title : 'A book'; }
  if(n.type === 'image') return 'Picture' + (n.cite ? ' · ' + n.cite : ''); return String(n.text || '').replace(/\s+/g, ' ').trim() || '(empty)'; }
function mmTree(m){ const adj = {}; m.nodes.forEach(n => adj[n.id] = []); m.edges.forEach(e => { if(adj[e.a] && adj[e.b]){ adj[e.a].push(e.b); adj[e.b].push(e.a); } });
  const by = {}; m.nodes.forEach(n => by[n.id] = n); const pin = m.pin && m.nodes.find(n => n.type === m.pin.kind && n.ref === m.pin.id);
  const out = [], seen = new Set(); const walk = (id, d) => { seen.add(id); out.push([by[id], d]); adj[id].filter(k => !seen.has(k)).sort((a, b) => (by[a].y - by[b].y) || (by[a].x - by[b].x)).forEach(k => { if(!seen.has(k)) walk(k, d + 1); }); };
  const roots = (pin ? [pin] : []).concat(m.nodes.slice().sort((a, b) => adj[b.id].length - adj[a.id].length));
  roots.forEach(r => { if(!seen.has(r.id)) walk(r.id, 0); }); return out; }
const MMO = {q: '', hits: [], at: -1};
function mmOutline(force){ let p = document.getElementById('mmOutline'); const open = force != null ? force : !(p && !p.hidden);
  const b = MM.el.querySelector('[data-mm="outline"]'); if(b) b.classList.toggle('on', open);
  if(!open){ if(p) p.hidden = true; MMO.q = ''; mmFound(); return; }
  if(!p){ p = document.createElement('div'); p.id = 'mmOutline'; p.className = 'mm-outline'; MM.el.appendChild(p);
    p.addEventListener('input', ev => { if(ev.target.matches('[data-olq]')){ MMO.q = ev.target.value; MMO.at = -1; mmOutlineList(); mmFound(); } });
    p.addEventListener('keydown', ev => { ev.stopPropagation(); if(ev.key === 'Enter' && MMO.hits.length){ ev.preventDefault(); MMO.at = (MMO.at + (ev.shiftKey ? -1 : 1) + MMO.hits.length) % MMO.hits.length; mmGoNode(MMO.hits[MMO.at]); mmFound(); } if(ev.key === 'Escape') mmOutline(false); });
    p.addEventListener('click', ev => { const r = ev.target.closest('[data-oln]'); if(r){ mmGoNode(r.dataset.oln); return; } const g = ev.target.closest('[data-olmap]'); if(g){ mmGoLink(g.dataset.olmap); return; } if(ev.target.closest('[data-oltidy]')) mmTidy(); if(ev.target.closest('[data-olx]')) mmOutline(false); }); }
  p.hidden = false; p.innerHTML = '<div class="ol-head"><input data-olq type="search" placeholder="Find on this map" value="' + esc(MMO.q) + '" aria-label="Find on this map"><button type="button" data-oltidy title="Tidy the whole map">Tidy</button><button type="button" data-olx aria-label="Close">×</button></div><div class="ol-back"></div><div class="ol-list"></div>';
  mmOutlineList(); setTimeout(() => { const i = p.querySelector('[data-olq]'); if(i) i.focus(); }, 30); }
function mmOutlineList(){ const p = document.getElementById('mmOutline'), m = mindOf(MM.id); if(!p || p.hidden || !m) return; const q = MMO.q.trim().toLowerCase();
  const back = mmBacklinks(MM.id); p.querySelector('.ol-back').innerHTML = back.length ? '<p>Linked from</p>' + back.map(x => '<button type="button" data-olmap="' + esc(x.id) + '">↖ ' + esc(x.name) + '</button>').join('') : '';
  const rows = mmTree(m); MMO.hits = q ? rows.filter(([n]) => mmLabel(n).toLowerCase().includes(q) || String(n.cite || '').toLowerCase().includes(q)).map(([n]) => n.id) : [];
  p.querySelector('.ol-list').innerHTML = rows.map(([n, d]) => { const hit = q && MMO.hits.includes(n.id), lab = mmLabel(n); return '<button type="button" data-oln="' + esc(n.id) + '" class="' + (hit ? 'hit' : '') + (q && !hit ? ' dim' : '') + (n.type !== 'text' ? ' t-' + n.type : '') + '" style="padding-left:' + (10 + Math.min(d, 8) * 16) + 'px">' + (d ? '<i></i>' : '') + esc(lab.length > 90 ? lab.slice(0, 88) + '…' : lab) + (n.link ? ' <em>↗</em>' : '') + '</button>'; }).join('') + (q ? '<p class="ol-n">' + (MMO.hits.length ? MMO.hits.length + (MMO.hits.length === 1 ? ' match' : ' matches') + ' · Enter for the next' : 'Nothing on this map matches') + '</p>' : ''); }
function mmFound(){ const cur = MMO.hits[MMO.at]; document.querySelectorAll('#mmNodes .mm-node').forEach(el => { el.classList.toggle('found', !!MMO.q.trim() && MMO.hits.includes(el.dataset.n)); el.classList.toggle('found-cur', el.dataset.n === cur); }); }
function mmGoNode(id){ const m = mindOf(MM.id), n = m && m.nodes.find(x => x.id === id); if(!n) return; const b = mmBox(), k = Math.max(MM.view.k, .8); MM.view.k = k; MM.view.x = b.l + b.w / 2 + 120 - n.x * k; MM.view.y = b.t + b.h / 2 - n.y * k; mmApply(); MM.sel = n.id; mmSelect(n.id); mmFound(); }
{ const _r2 = mmRender; mmRender = function(){ const r = _r2.apply(this, arguments); try{ mmOutlineList(); mmFound(); }catch(e){} return r; }; }
addEventListener('keydown', ev => { if(!MM.el || MM.el.hidden || !(ev.metaKey || ev.ctrlKey) || ev.key.toLowerCase() !== 'f') return; ev.preventDefault(); mmOutline(true); });

/* ===================== the lasso, for handwriting on a map =====================
   In the ink row: draw round strokes to choose them; drag inside the dashed box to move them; a pen colour recolours them;
   the bin removes them. Every change can be undone. */
MI.sel = null;
function mmInkSelDraw(){ const g = mm$('mmInkG'); if(!g) return; let box = document.getElementById('mmInkSelBox'); const svg = mm$('mmInk');
  if(!MI.sel || !MI.sel.size){ if(box) box.remove(); g.querySelectorAll('path.sel').forEach(p => p.classList.remove('sel')); return; }
  const m = mindOf(MM.id); if(!m) return; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  (m.ink || []).forEach((s, i) => { const on = MI.sel.has(s); const p = g.querySelector('path[data-i="' + i + '"]'); if(p) p.classList.toggle('sel', on); if(!on) return; for(let j = 0; j < s.p.length; j += 3){ x0 = Math.min(x0, s.p[j]); y0 = Math.min(y0, s.p[j + 1]); x1 = Math.max(x1, s.p[j]); y1 = Math.max(y1, s.p[j + 1]); } });
  if(!isFinite(x0)) return; const pad = 8 / MM.view.k; if(!box){ box = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); box.id = 'mmInkSelBox'; svg.appendChild(box); }
  box.setAttribute('x', x0 - pad); box.setAttribute('y', y0 - pad); box.setAttribute('width', x1 - x0 + 2 * pad); box.setAttribute('height', y1 - y0 + 2 * pad); box.style.strokeWidth = (1.3 / MM.view.k) + 'px'; box.style.strokeDasharray = (5 / MM.view.k) + ' ' + (4 / MM.view.k);
  MI.selBox = [x0 - pad, y0 - pad, x1 + pad, y1 + pad]; }
{ const _ir = mmInkRender; mmInkRender = function(m){ const r = _ir.apply(this, arguments); try{ mmInkSelDraw(); }catch(e){} return r; }; }
function mmInside(poly, x, y){ let c = false; for(let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2){ const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1]; if(((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) c = !c; } return c; }
(() => { const pen = ev => ev.pointerType === 'pen' || (ev.pointerType === 'mouse' && !('ontouchstart' in window));
  let lasso = null, mv = null;
  document.addEventListener('pointerdown', ev => { if(!MI.on || MI.tool !== 'lasso' || !MM.el || MM.el.hidden || !ev.target.closest || !ev.target.closest('#mmStage') || !pen(ev)) return; ev.preventDefault(); ev.stopImmediatePropagation(); try{ mm$('mmStage').setPointerCapture(ev.pointerId); }catch(e){}
    const [x, y] = mmToWorld(ev.clientX, ev.clientY), m = mindOf(MM.id); if(!m) return;
    if(MI.sel && MI.sel.size && MI.selBox && x >= MI.selBox[0] && x <= MI.selBox[2] && y >= MI.selBox[1] && y <= MI.selBox[3]){ mv = {x, y, orig: [...MI.sel].map(s => [s, s.p.slice()])}; return; }
    MI.sel = null; mmInkSelDraw(); lasso = [x, y]; const p = mm$('mmInkCur'); p.setAttribute('d', ''); }, true);
  document.addEventListener('pointermove', ev => { if(!lasso && !mv) return; ev.stopImmediatePropagation(); const [x, y] = mmToWorld(ev.clientX, ev.clientY);
    if(mv){ const dx = x - mv.x, dy = y - mv.y; mv.orig.forEach(([s, p0]) => { for(let j = 0; j < p0.length; j += 3){ s.p[j] = +(p0[j] + dx).toFixed(2); s.p[j + 1] = +(p0[j + 1] + dy).toFixed(2); } }); mv.moved = true; mmInkRender(); return; }
    lasso.push(x, y); const lp = mm$('mmInkCur'); lp.setAttribute('d', 'M' + lasso.map((v, i) => (i % 2 ? '' : (i ? ' L' : '')) + v.toFixed(1)).join(' ').replace(/^M /, 'M')); lp.setAttribute('fill', 'rgba(180,67,46,.06)'); lp.setAttribute('fill-opacity', '1'); lp.setAttribute('stroke', '#B4432E'); lp.style.strokeWidth = (1.2 / MM.view.k) + 'px'; lp.style.strokeDasharray = (4 / MM.view.k) + ' ' + (3 / MM.view.k); }, true);
  const up = ev => { if(mv){ ev.stopImmediatePropagation(); const moved = mv.moved; mv = null; if(moved) mmSave(); return; }
    if(!lasso) return; ev.stopImmediatePropagation(); const poly = lasso; lasso = null; const lp = mm$('mmInkCur'); lp.setAttribute('d', ''); lp.removeAttribute('stroke'); lp.style.strokeDasharray = '';
    const m = mindOf(MM.id); if(!m || poly.length < 8) return; const sel = new Set(); (m.ink || []).forEach(s => { let inn = 0, all = 0; for(let j = 0; j < s.p.length; j += 3){ all++; if(mmInside(poly, s.p[j], s.p[j + 1])) inn++; } if(all && inn / all >= .6) sel.add(s); });
    MI.sel = sel.size ? sel : null; mmInkSelDraw(); const tb = mm$('mmInkTools'); if(tb) tb.innerHTML = mmInkToolsHTML(); };
  document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true);
})();
/* the lasso in the ink row; with strokes chosen, a pen colour recolours them and the bin removes them */
{ const _html = mmInkToolsHTML; mmInkToolsHTML = function(){ let h = _html.apply(this, arguments); const on = MI.tool === 'lasso';
    h = h.replace('<button type="button" data-mi="eraser"', '<button type="button" data-mi="lasso" class="' + (on ? 'on' : '') + '" title="Lasso: choose strokes"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="3 2.4"><ellipse cx="12" cy="10" rx="8" ry="5.5"/><path d="M7 14.5c-1 2 0 4.5 2.5 4.5" stroke-dasharray="none"/></svg></button><button type="button" data-mi="eraser"');
    if(MI.sel && MI.sel.size) h = h.replace('<button type="button" data-mi="undo"', '<button type="button" data-mi="seldel" title="Remove the chosen strokes"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B4432E" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6h14M10 6V4h4v2M7 6l1 14h8l1-14"/></svg></button><button type="button" data-mi="undo"');
    return h; }; }
{ const _tool = mmInkTool; mmInkTool = function(btn){ const k = btn.dataset.mi, m = mindOf(MM.id);
    if(k === 'lasso'){ MI.tool = 'lasso'; mm$('mmInkTools').innerHTML = mmInkToolsHTML(); return; }
    if(k === 'seldel' && m && MI.sel){ m.ink = (m.ink || []).filter(s => !MI.sel.has(s)); MI.sel = null; mmInkRender(m); mmSave(); mm$('mmInkTools').innerHTML = mmInkToolsHTML(); return; }
    if(k === 'pen' && MI.sel && MI.sel.size && m){ MI.sel.forEach(s => { if(!s.h) s.c = btn.dataset.c; }); mmInkRender(m); mmSave(); return; }
    if(k !== 'undo'){ MI.sel = null; mmInkSelDraw(); }
    return _tool.apply(this, arguments); }; }
{ const _restore = mmRestore; mmRestore = function(){ MI.sel = null; return _restore.apply(this, arguments); }; }

/* ===================== maps that work together =====================
   How the maps fit: a paper (or book) has its own map, made beside it while reading. A field has its maps too. A paper's map can
   sit inside a field's map as a node that shows a small live picture of it (it is the same map, not a copy, so it stays up to
   date), and opening it goes inside. Single ideas link across maps, both ways: the idea in the paper's map shows where it leads
   (↗), and the idea it leads to shows where it is linked from (↖). Following any link can be undone with ‹ Back. Beside a
   paper, the switcher at the top left chooses which map is open there: the paper's own, or a field's map (a quote or a clip
   then lands under the paper in that map, the paper being added if it is not there yet). */
MM.trail = [];
function mmShort(s){ s = String(s || ''); return s.length > 34 ? s.slice(0, 32) + '…' : s; }
function mmPaperNode(m){ if(!MM.dock) return null; let n = m.nodes.find(x => x.type === MM.dock.kind && x.ref === MM.dock.id); if(n) return n;
  const sel = MM.sel; MM.sel = null; const at = mmFreeSpot(m, null); MM.sel = sel; n = {id: mmId('n'), type: MM.dock.kind, ref: MM.dock.id, x: at[0], y: at[1]}; m.nodes.push(n); mmRender(); mmSave(); return n; }
/* a map in miniature: its nodes as small cards and its lines, fitted to the box */
function mmGuessSize(n){ if(n.type === 'image') return [n.w || 300, (n.w || 300) * (n.ph || 3) / (n.pw || 4) + 24]; if(n.type === 'map') return [n.w || 256, 196]; if(n.type === 'paper' || n.type === 'book') return [n.w || 230, 64];
  const t = String(n.text || ''), w = n.w || Math.min(280, Math.max(70, 26 + t.length * 7.2)); return [w, Math.max(38, Math.ceil(t.length * 7.2 / Math.max(40, w - 26)) * 20 + 18)]; }
function mmMiniSvg(sub, W, H, plain){ const ns = sub.nodes || []; let body = '';
  if(ns.length){ const sz = ns.map(n => (sub.id === MM.id && MM.sz[n.id]) || mmGuessSize(n)); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; ns.forEach((n, i) => { x0 = Math.min(x0, n.x - sz[i][0] / 2); y0 = Math.min(y0, n.y - sz[i][1] / 2); x1 = Math.max(x1, n.x + sz[i][0] / 2); y1 = Math.max(y1, n.y + sz[i][1] / 2); });
    const pad = 8, k = Math.min((W - 2 * pad) / Math.max(1, x1 - x0), (H - 2 * pad) / Math.max(1, y1 - y0)), ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2, X = v => ((v - x0) * k + ox).toFixed(1), Y = v => ((v - y0) * k + oy).toFixed(1), by = {};
    ns.forEach((n, i) => by[n.id] = [n, sz[i]]);
    body += (sub.edges || []).filter(e => by[e.a] && by[e.b]).map(e => '<path d="M' + X(by[e.a][0].x) + ' ' + Y(by[e.a][0].y) + ' L' + X(by[e.b][0].x) + ' ' + Y(by[e.b][0].y) + '" stroke="' + (e.color || '#8A7F72') + '" stroke-width="' + Math.max(.6, 1.1 * Math.min(1, k * 3)).toFixed(2) + '" fill="none"' + (e.dash === 'dash' ? ' stroke-dasharray="3 2"' : '') + '/>').join('');
    body += ns.map((n, i) => { const w = Math.max(2.5, sz[i][0] * k), h = Math.max(2, sz[i][1] * k), pin = sub.pin && n.type === sub.pin.kind && n.ref === sub.pin.id; return '<rect x="' + (+X(n.x) - w / 2).toFixed(1) + '" y="' + (+Y(n.y) - h / 2).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + Math.min(3, h / 2).toFixed(1) + '" fill="' + (pin ? '#231E1A' : (n.fill || '#FFFDF8')) + '" stroke="#CFC5B5" stroke-width=".6"/>'; }).join('');
    (sub.ink || []).slice(0, 80).forEach(s => { let d = ''; for(let j = 0; j < s.p.length; j += 9) d += (j ? ' L' : 'M') + X(s.p[j]) + ' ' + Y(s.p[j + 1]); if(d) body += '<path d="' + d + '" stroke="' + s.c + '" stroke-width=".8" fill="none"' + (s.h ? ' stroke-opacity=".35"' : '') + '/>'; }); }
  else body = '<text x="' + (W / 2) + '" y="' + (H / 2 + 4) + '" text-anchor="middle" font-family="Times New Roman, serif" font-style="italic" font-size="12" fill="#8A7F72">Empty so far</text>';
  return plain ? '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="5" fill="#F3EDE1"/>' + body : '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + body + '</svg>'; }
/* put a map in this one */
function mmAddMapMenu(btn){ const r = btn.getBoundingClientRect(), others = mindsAll().filter(x => x.id !== MM.id).sort((a, b) => ((DK.recent || {})['mind:' + b.id] || 0) - ((DK.recent || {})['mind:' + a.id] || 0));
  if(!others.length){ toast('Make another mind map first'); return; }
  openFloatMenu(Math.max(10, r.left - 120), r.bottom + 6, others.map(x => ({label: x.name + (x.pin ? '  ·  a paper’s map' : ''), fn: () => { const n = mmAdd('map', x.id); if(n){ mmRender(); mmSave(); } }}))); }
/* place this map in another (from the title menu or the switcher beside a paper) */
function mmEmbedMenu(x, y){ const cur = mindOf(MM.id); if(!cur) return; const others = mindsAll().filter(z => z.id !== cur.id); if(!others.length){ toast('Make another mind map first'); return; }
  openFloatMenu(x, y, others.map(t => ({label: (t.nodes.some(n => n.type === 'map' && n.ref === cur.id) ? '✓ ' : '') + t.name, fn: () => { if(t.nodes.some(n => n.type === 'map' && n.ref === cur.id)){ toast('“' + cur.name + '” is already in “' + t.name + '”'); return; }
    const xs = t.nodes.map(n => n.x + mmGuessSize(n)[0] / 2), ys = t.nodes.map(n => n.y); t.nodes.push({id: mmId('n'), type: 'map', ref: cur.id, x: Math.round((xs.length ? Math.max(...xs) : 0) + 200), y: Math.round(ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0)});
    touchLib(); toast('“' + cur.name + '” is now in “' + t.name + '”'); }}))); }
/* moving between maps */
function mmSwitchTo(id, view){ MM.following = true; try{ if(MM.dock) mmDockSwitch(id, view); else { openMind(id); if(view){ MM.view = Object.assign({}, view); mmApply(); } } } finally { MM.following = false; } mmTrailShow(); }
function mmFollow(mapId, nodeId){ const t = mindOf(mapId); if(!t){ toast('That map is in the bin (Your maps › Recently deleted)'); return; } if(MM.editing) mmCommitText();
  MM.trail.push({id: MM.id, view: Object.assign({}, MM.view), sel: MM.sel}); if(MM.trail.length > 40) MM.trail.shift();
  mmSwitchTo(mapId); if(nodeId) setTimeout(() => { const mm = mindOf(mapId); if(mm && mm.nodes.some(n => n.id === nodeId)){ mmGoNode(nodeId); const el = document.querySelector('#mmNodes [data-n="' + nodeId + '"]'); if(el){ el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1400); } } else toast('That idea is no longer on the map'); }, 90); }
function mmTrailBack(){ const t = MM.trail.pop(); if(!t){ mmTrailShow(); return; } mmSwitchTo(t.id, t.view); if(t.sel){ MM.sel = t.sel; mmSelect(t.sel); } }
function mmTrailShow(){ const b = MM.el && MM.el.querySelector('[data-mm="trail"]'); if(!b) return; const t = MM.trail[MM.trail.length - 1], m = t && mindOf(t.id); b.hidden = !m; if(m){ b.textContent = MM.dock ? '‹ Back' : '‹ Back to ' + (m.name || 'the map'); b.title = 'Back to ' + (m.name || 'the map'); } }
function mmDockSwitch(id, view, remember){ const m = mindOf(id); if(!m || !MM.dock) return; if(MM.editing) mmCommitText(); mmSave(); MM.id = id; MM.sel = null; MM.editing = null; MM.multi = new Set(); mmHistReset();
  const b = mmBox(); MM.view = view ? Object.assign({}, view) : (m.view ? {x: m.view.x + b.l + b.w / 2, y: m.view.y + b.t + b.h / 2, k: m.view.k || 1} : {x: b.l + b.w / 2, y: b.t + b.h / 2, k: 1});
  mmApply(); mmRender(); if(!view && !m.view) mmFit(); if(remember){ try{ localStorage.setItem('pm:dockMap:' + MM.dock.kind + ':' + MM.dock.id, id); }catch(e){} } try{ deskTouchRecent('mind:' + id); }catch(e){} }
mmGoLink = function(id){ mmFollow(id); };
{ const _o2 = openMind; openMind = function(){ if(!MM.following) MM.trail = []; const r = _o2.apply(this, arguments); mmTrailShow(); return r; }; }
{ const _d2 = mindDock; mindDock = function(){ MM.trail = []; const r = _d2.apply(this, arguments); try{ const bar = MM.el.querySelector('.mm-bar.mm-r'); ['.mm-trail', '.mm-dockswitch'].forEach(s => { const el = MM.el.querySelector(s); if(el && bar && el.parentNode !== bar) bar.insertBefore(el, bar.firstChild); }); }catch(e){} mmTrailShow(); return r; }; }
/* the switcher beside a paper */
function mmDockMenu(btn){ if(!MM.dock) return; const r = btn.getBoundingClientRect(), k = MM.dock.kind, id = MM.dock.id, own = mindsAll().filter(x => x.pin && x.pin.kind === k && x.pin.id === id), rest = mindsAll().filter(x => !own.includes(x)).sort((a, b) => ((DK.recent || {})['mind:' + b.id] || 0) - ((DK.recent || {})['mind:' + a.id] || 0));
  const title = k === 'paper' ? ((lib.entries[id] || {}).t || 'this paper') : ((mmBook(id) || {}).title || 'this book');
  const items = own.map(x => ({label: (x.id === MM.id ? '✓ ' : '') + (x.name || title) + '  ·  this ' + k + '’s map', fn: () => { MM.trail = []; mmDockSwitch(x.id, null, true); mmTrailShow(); }}));
  items.push({label: '+ Another map for this ' + k, fn: () => { const nm = mindNew(title + ' · ' + (own.length + 1), {kind: k, id}); MM.trail = []; mmDockSwitch(nm.id, null, true); mmTrailShow(); }});
  if(rest.length) items.push({sep: 1}, ...rest.map(x => ({label: (x.id === MM.id ? '✓ ' : '') + x.name, fn: () => { MM.trail = []; mmDockSwitch(x.id, null, true); mmTrailShow(); }})));
  items.push({sep: 1}, {label: 'Put this map in another map…', fn: () => mmEmbedMenu(r.left, r.bottom + 6)});
  openFloatMenu(r.left, r.bottom + 6, items); }
{ const _r4 = mmRender; mmRender = function(){ MM.xlIdx = mmXlIndex(); const r = _r4.apply(this, arguments); try{ const m = mindOf(MM.id), nm = document.getElementById('mmDockName'); if(nm && m) nm.textContent = m.name || 'Mind map'; }catch(e){} return r; }; }
/* ideas linked across maps */
function mmXlIndex(){ const idx = {}; mindsAll().forEach(x => { if(x.id === MM.id) return; (x.nodes || []).forEach(n => (n.xl || []).forEach(l => { if(l.m === MM.id) (idx[l.n] = idx[l.n] || []).push({m: x.id, n: n.id, name: x.name, text: mmLabel(n)}); })); }); return idx; }
function mmXlChips(n){ let h = ''; (n.xl || []).forEach(l => { const tm = mindOf(l.m), tn = tm && tm.nodes.find(z => z.id === l.n); h += '<button type="button" class="mm-linkchip xl" data-goxl="' + esc(l.m + '|' + l.n) + '" title="Go to this idea">↗ ' + esc(tm ? tm.name : 'A map in the bin') + (tn ? ' · ' + esc(mmShort(mmLabel(tn))) : tm ? ' · (no longer there)' : '') + '</button>'; });
  ((MM.xlIdx || {})[n.id] || []).forEach(b => { h += '<button type="button" class="mm-linkchip back" data-goxl="' + esc(b.m + '|' + b.n) + '" title="Linked from here">↖ ' + esc(b.name) + ' · ' + esc(mmShort(b.text)) + '</button>'; }); return h; }
document.addEventListener('click', ev => { const g = ev.target.closest && ev.target.closest('#mind [data-goxl], #mind [data-gomap]'); if(!g) return; ev.stopPropagation(); if(g.dataset.gomap) mmFollow(g.dataset.gomap); else { const [mid, nid] = g.dataset.goxl.split('|'); mmFollow(mid, nid); } }, true);
document.addEventListener('dblclick', ev => { const nd = ev.target.closest && ev.target.closest('#mmNodes .mm-node.t-map'); if(!nd) return; ev.stopPropagation(); const m = mindOf(MM.id), n = m && m.nodes.find(x => x.id === nd.dataset.n); if(n) mmFollow(n.ref); }, true);
/* the link chooser: a map, then the whole map, a new idea there (linked both ways), or one of its ideas (search) */
function mmPicker(o){ let p = document.getElementById('mmPicker'); if(!p){ p = document.createElement('div'); p.id = 'mmPicker'; p.className = 'mm-picker'; MM.el.appendChild(p);
    p.addEventListener('input', () => mmPickerList()); p.addEventListener('keydown', ev => { ev.stopPropagation(); if(ev.key === 'Escape') p.hidden = true; if(ev.key === 'Enter'){ const f = p.querySelector('.pk-list button'); if(f) f.click(); } });
    p.addEventListener('click', ev => { if(ev.target.closest('[data-pkx]')){ p.hidden = true; return; } if(ev.target.closest('[data-pkback]') && p._o.back){ p._o.back(); return; } const b = ev.target.closest('[data-pk]'); if(b){ const it = p._items[+b.dataset.pk]; if(it){ p.hidden = true; it.fn(); } } }); }
  p._o = o; p.hidden = false; p.innerHTML = '<div class="pk-head">' + (o.back ? '<button type="button" data-pkback aria-label="Back">‹</button>' : '') + '<b>' + esc(o.title) + '</b><button type="button" data-pkx aria-label="Close">×</button></div><input type="search" placeholder="' + esc(o.hint || 'Search') + '"><div class="pk-list"></div>'; mmPickerList(); setTimeout(() => { const i = p.querySelector('input'); if(i) i.focus(); }, 30); }
function mmPickerList(){ const p = document.getElementById('mmPicker'); if(!p || p.hidden) return; const q = (p.querySelector('input').value || '').trim().toLowerCase(), all = p._o.items();
  p._items = all.filter(it => it.keep || !q || String(it.label).toLowerCase().includes(q) || String(it.sub || '').toLowerCase().includes(q));
  p.querySelector('.pk-list').innerHTML = p._items.map((it, i) => '<button type="button" data-pk="' + i + '" class="' + (it.cls || '') + '"><span>' + esc(it.label) + '</span>' + (it.sub ? '<em>' + esc(it.sub) + '</em>' : '') + '</button>').join('') || '<p>Nothing matches</p>'; }
mmLinkMenu = function(btn, n){ if(!n) return; const done = () => { mmRender(); mmSave(); };
  mmPicker({title: 'Link “' + mmShort(mmLabel(n)) + '” to…', hint: 'Find a map', items: () => {
    const cur = (n.xl || []).map((l, i) => { const tm = mindOf(l.m), tn = tm && tm.nodes.find(z => z.id === l.n); return {label: '× ' + (tm ? tm.name : 'A map') + (tn ? ' · ' + mmShort(mmLabel(tn)) : ''), sub: 'Remove this link', cls: 'rm', keep: true, fn: () => { n.xl.splice(i, 1); if(!n.xl.length) delete n.xl; done(); }}; });
    if(n.link){ const lm = mindOf(n.link); cur.push({label: '× ' + (lm ? lm.name : 'A map') + ' (the whole map)', sub: 'Remove this link', cls: 'rm', keep: true, fn: () => { delete n.link; done(); }}); }
    return cur.concat(mindsAll().filter(x => x.id !== MM.id).map(x => ({label: x.name, sub: x.nodes.length + (x.nodes.length === 1 ? ' idea' : ' ideas') + (x.pin ? ' · a paper’s map' : ''), fn: () => mmPickIdea(n, x, done)}))); }}); };
function mmPickIdea(n, x, done){ const from = mindOf(MM.id);
  mmPicker({title: x.name, hint: 'Find an idea on this map', back: () => mmLinkMenu(null, n), items: () => [
    {label: '+ A new idea in “' + x.name + '”', sub: 'This idea, placed there and linked both ways', cls: 'add', keep: true, fn: () => { const t = mmTwin(n, from, x); if(t){ n.xl = (n.xl || []).concat([{m: x.id, n: t.id}]); done(); toast('Placed in “' + x.name + '” and linked'); } }},
    {label: 'The whole map', sub: 'Opens “' + x.name + '”', cls: 'add', keep: true, fn: () => { n.link = x.id; done(); }}].concat(
    x.nodes.map(t => ({label: mmLabel(t), sub: t.type === 'text' ? '' : t.type, fn: () => { n.xl = (n.xl || []).filter(l => !(l.m === x.id && l.n === t.id)).concat([{m: x.id, n: t.id}]); done(); }}))) }); }
/* a twin of an idea in another map: the same words (or the same paper, book, picture or map), placed under the same paper if
   that map has it, else beside its centre */
function mmTwin(n, from, x){ const t = {id: mmId('n'), type: n.type}; ['text', 'ref', 'clip', 'pw', 'ph', 'w', 'cite', 'repo', 'shape', 'fill', 'ink', 'ts', 'bold'].forEach(k => { if(n[k] != null) t[k] = n[k]; });
  const pin = from && from.pin, host = pin && x.nodes.find(z => z.type === pin.kind && z.ref === pin.id), at = host || (x.nodes.length ? x.nodes.reduce((a, z) => ({x: a.x + z.x / x.nodes.length, y: a.y + z.y / x.nodes.length}), {x: 0, y: 0}) : {x: 0, y: 0});
  const ys = x.nodes.filter(z => Math.abs(z.x - (at.x + 300)) < 200).map(z => z.y + mmGuessSize(z)[1] / 2 + 40); t.x = Math.round(at.x + 300); t.y = Math.round(ys.length ? Math.max(at.y, Math.max(...ys)) : at.y);
  x.nodes.push(t); if(host) x.edges.push({id: mmId('e'), a: host.id, b: t.id, label: ''}); touchLib(); return t; }

/* ===================== lines drawn by hand =====================
   With the pen, draw a line from one idea to another: it becomes a connection with exactly the shape you drew, and it keeps
   that shape (stretched and turned) when either idea moves. Its bar can still give it arrows, a dash, a width, words, or turn
   it into a curve, a straight or a right-angled line, and back. A stroke that does not join two ideas stays handwriting. */
function mmHandFrom(s, m){ const pts = s.p, hit = (x, y) => { let best = null, bd = Infinity; m.nodes.forEach(nd => { const [w, h] = mmNodeSize(nd); if(Math.abs(x - nd.x) <= w / 2 + 6 && Math.abs(y - nd.y) <= h / 2 + 6){ const d = Math.hypot((x - nd.x) / (w / 2 + 6), (y - nd.y) / (h / 2 + 6)); if(d <= bd){ bd = d; best = nd; } } }); return best; };
  const A = hit(pts[0], pts[1]), B = hit(pts[pts.length - 3], pts[pts.length - 2]); if(!A || !B || A === B) return null;
  const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy || 1, n = pts.length / 3, step = Math.max(1, Math.floor(n / 140)), hp = [];
  for(let i = 0; i < n; i += step){ const px = pts[i * 3] - A.x, py = pts[i * 3 + 1] - A.y; hp.push(+((px * dx + py * dy) / L2).toFixed(4), +((py * dx - px * dy) / L2).toFixed(4)); }
  { const i = n - 1, px = pts[i * 3] - A.x, py = pts[i * 3 + 1] - A.y; hp.push(+((px * dx + py * dy) / L2).toFixed(4), +((py * dx - px * dy) / L2).toFixed(4)); }
  const sz = (s.w || 2) * MM.view.k, w = sz <= 1.2 ? 1 : sz <= 2.4 ? 2 : sz <= 3.6 ? 3 : 4, dark = /^#1f1b18$/i.test(s.c);
  const e = Object.assign({id: mmId('e'), a: A.id, b: B.id, label: ''}, mmEdgeDefaults(), {shape: 'hand', hp, w}); if(!dark) e.color = s.c; else delete e.color; return e; }
{ const _g = mmEdgeGeom; mmEdgeGeom = function(e, by){ if(e.shape !== 'hand' || !e.hp || e.hp.length < 4) return _g.apply(this, arguments);
    const a = by[e.a], b = by[e.b], dx = b.x - a.x, dy = b.y - a.y, w = MM_WIDTHS[e.w || 2] || 1.6; let pts = []; for(let i = 0; i < e.hp.length; i += 2){ const u = e.hp[i], v = e.hp[i + 1]; pts.push([a.x + u * dx - v * dy, a.y + u * dy + v * dx]); }
    const inBox = (n, p) => { const s = MM.sz[n.id] || [150, 46]; return Math.abs(p[0] - n.x) <= s[0] / 2 + 5 && Math.abs(p[1] - n.y) <= s[1] / 2 + 5; };
    let i0 = 0; while(i0 < pts.length - 2 && inBox(a, pts[i0])) i0++; let i1 = pts.length - 1; while(i1 > i0 + 1 && inBox(b, pts[i1])) i1--; pts = pts.slice(i0, i1 + 1); if(pts.length < 2) pts = [[a.x, a.y], [b.x, b.y]];
    const F = v => v.toFixed(1); let d = 'M' + F(pts[0][0]) + ' ' + F(pts[0][1]); for(let i = 1; i < pts.length - 1; i++){ const p = pts[i], q = pts[i + 1]; d += ' Q' + F(p[0]) + ' ' + F(p[1]) + ' ' + F((p[0] + q[0]) / 2) + ' ' + F((p[1] + q[1]) / 2); } const z = pts[pts.length - 1]; d += ' L' + F(z[0]) + ' ' + F(z[1]);
    const mid = pts[Math.floor(pts.length / 2)], back = pts[Math.max(0, pts.length - 4)], fwd = pts[Math.min(pts.length - 1, 3)], unit = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }, heads = [], arrow = e.arrow || 'none';
    if(arrow === 'end' || arrow === 'both'){ const u = unit([z[0] - back[0], z[1] - back[1]]); heads.push(mmHead(z[0], z[1], u[0], u[1], w)); }
    if(arrow === 'start' || arrow === 'both'){ const u = unit([pts[0][0] - fwd[0], pts[0][1] - fwd[1]]); heads.push(mmHead(pts[0][0], pts[0][1], u[0], u[1], w)); }
    const dash = e.dash === 'dash' ? (5 + w * 2.5) + ' ' + (4 + w * 2) : e.dash === 'dot' ? '0.1 ' + (3 + w * 2.2) : ''; return {d, mx: mid[0], my: mid[1], heads, w, dash}; }; }
/* the line's bar offers the hand-drawn shape again for a line that was drawn by hand */
{ const _eb = mmEdgeBar; mmEdgeBar = function(){ const r = _eb.apply(this, arguments); const bar = document.getElementById('mmEdgeBar'), m = mindOf(MM.id), e = m && MM.sel && m.edges.find(x => x.id === MM.sel);
    if(bar && !bar.hidden && e && e.hp && !bar.querySelector('[data-v="hand"]')){ const first = bar.querySelector('[data-es="shape"]'); if(first) first.insertAdjacentHTML('beforebegin', '<button type="button" data-es="shape" data-v="hand" class="' + (e.shape === 'hand' ? 'on' : '') + '" title="As you drew it"><svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 12c3-6 5 2 8-3s5 1 6-3 3-2 4-2"/></svg></button>'); if(e.shape === 'hand') bar.querySelectorAll('[data-es="shape"]:not([data-v="hand"])').forEach(x => x.classList.remove('on')); }
    return r; }; }

/* ===================== the timeline mind map =====================
   Any mind map can take a time axis. A node with a date (a paper or a book by its year, a picture or a note given one) sits
   at its date: it can be moved up and down, never sideways, and moves when its date changes; lines follow. A span (1503–1519)
   shows as a line under the node. A stretch of time can be folded away: the axis closes over it with a break, the nodes in
   it hide, and the break says how many; tap it to open the stretch again. Undated nodes stay free. */
const AX_FOLDW = 46;
function mmAxis(m){ return m && m.axis && m.axis.on ? m.axis : null; }
function mmAxisToggle(){ const m = mindOf(MM.id); if(!m) return; m.axis = m.axis || {ppy: 6, folds: []}; m.axis.on = !m.axis.on; if(m.axis.on && !m.axis.ppy) m.axis.ppy = 6;
  if(m.axis.on){ MM._axv = (MM._axv || 0) + 1; axF(m.axis); if(m.axis.y0 == null) m.axis.y0 = AXF.y0; MM._axv++; }
  mmRender(); mmSave(); if(m.axis.on) mmFit(); const b = MM.el.querySelector('[data-mm="axis"]'); if(b) b.classList.toggle('on', m.axis.on); }
function mmDate(n){ if(!n) return null; if(n.date && n.date.y != null) return n.date;
  if(n.type === 'paper'){ const e = lib.entries[n.ref]; const y = e && +e.y; return y ? {y, auto: 1} : null; }
  if(n.type === 'book'){ const b = mmBook(n.ref); const y = b && +(b.year || b.y); return y ? {y, auto: 1} : null; } return null; }
/* stretches of time with nothing in them are folded by default: wherever the gap between two dated things is far wider
   than the gaps between the rest (four times the usual gap, and at least fifteen years), the axis closes over it, leaving a
   little room either side. Tap a fold to open it (it stays open); folds you make yourself are kept as they are. The scale
   then fits what is left, so a few far-off dates no longer squeeze everything else into a line. */
const AXF = {ax: null, v: -1, f: [], ppy: 0};
function axF(ax){ if(AXF.ax === ax && AXF.v === (MM._axv || 0)) return AXF.f; AXF.ax = ax; AXF.v = MM._axv || 0; AXF.f = axCompute(ax); return AXF.f; }
function axCompute(ax){ const m = (lib.minds || []).find(x => x.axis === ax); const manualAll = (ax.folds || []).map((f, i) => ({a: f.a, b: f.b, mi: i, open: !!f.open})), manual = manualAll.filter(f => !f.open);
  AXF.marks = manualAll.filter(f => f.open).map(f => Object.assign({}, f)); let out = manual.slice(); if(m && ax.auto !== false){ const ds = [...new Set(m.nodes.map(mmDate).filter(Boolean).flatMap(d => d.y2 != null ? [d.y, d.y2] : [d.y]))].sort((p, q) => p - q);
    if(ds.length >= 3){ const gaps = ds.slice(1).map((v, i) => v - ds[i]), sorted = gaps.slice().sort((p, q) => p - q), med = sorted[Math.floor(sorted.length / 2)] || 1, T = Math.max(15, 4 * med);
      gaps.forEach((g, i) => { if(g <= T) return; const pad = Math.max(1, Math.min(g * 0.06, 25)), a = Math.round(ds[i] + pad), b = Math.round(ds[i + 1] - pad); if(b - a < 8) return;
        if(manualAll.some(f => f.a < b && f.b > a)) return; if((ax.open || []).some(o => o.a < b && o.b > a)){ AXF.marks.push({a, b, auto: true, open: true}); return; } out.push({a, b, auto: true}); }); }
    if(ax.fit !== false && ds.length >= 2){ const span = ds[ds.length - 1] - ds[0], folded = out.concat(AXF.marks || []).reduce((s, f) => s + Math.max(0, Math.min(f.b, ds[ds.length - 1]) - Math.max(f.a, ds[0])), 0); ax.ppy = Math.max(0.6, Math.min(40, 1400 / Math.max(span - folded, 10))); } }
  if(m){ const ys = m.nodes.map(mmDate).filter(Boolean).map(d => d.y).sort((p, q) => p - q); AXF.y0 = ys.length ? ys[Math.floor(ys.length / 2)] : 0; }
  const an = MM.foldAnim; if(an && an.ax === ax){ const t = Math.min(1, (performance.now() - an.t0) / an.dur), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, pOpen = an.from + (an.to - an.from) * e;
    AXF.marks = (AXF.marks || []).filter(f => !(f.a === an.a && f.b === an.b)); out = out.filter(f => !(f.a === an.a && f.b === an.b)); out.push({a: an.a, b: an.b, auto: an.auto, mi: an.mi, p: pOpen}); }
  return out.sort((p, q) => p.a - q.a); }
function axFoldW(ax, f){ const full = (f.b - f.a) * ax.ppy; return AX_FOLDW + (full - AX_FOLDW) * (f.p || 0); }
function axRaw(ax, y){ let x = y * ax.ppy; axF(ax).forEach(f => { const w = axFoldW(ax, f); if(y >= f.b){ x += -(f.b - f.a) * ax.ppy + w; } else if(y > f.a){ x += -(y - f.a) * ax.ppy + (y - f.a) / (f.b - f.a) * w; } }); return x; }
/* the dates sit around the map's middle: the year nearest the middle of your dates is at the centre, so dated and undated
   things share one neighbourhood */
function axX(ax, y){ const f = axF(ax); const y0 = ax.y0 != null ? ax.y0 : AXF.y0; return axRaw(ax, y) - axRaw(ax, y0 || 0); }
function axYear(ax, x){ let lo = -10000, hi = 10000; for(let i = 0; i < 50; i++){ const mid = (lo + hi) / 2; if(axX(ax, mid) < x) lo = mid; else hi = mid; } return (lo + hi) / 2; }
function axFolded(ax, y){ return axF(ax).find(f => y > f.a && y < f.b && !(f.p > 0)); }
function mmDateText(d){ if(!d) return ''; const Y = y => y < 0 ? (-y) + ' BC' : String(Math.round(y)); return (d.approx ? 'c. ' : '') + Y(d.y) + (d.y2 != null ? '–' + Y(d.y2) : ''); }
function mmParseDate(s){ s = String(s || '').trim().replace(/[公元前]/g, m0 => m0 === '前' ? ' BC' : '').replace(/\s+/g, ' '); if(!s) return null;
  const approx = /^(c\.?|ca\.?|circa|~|约)\s*/i.test(s); s = s.replace(/^(c\.?|ca\.?|circa|~|约)\s*/i, '');
  const cent = s.match(/^(\d+)(st|nd|rd|th)?\s*(century|c\.?|世纪)\s*(BC|BCE)?$/i);
  if(cent){ const c = +cent[1], bc = !!cent[4]; return bc ? {y: -c * 100, y2: -(c - 1) * 100 - 1, approx: true} : {y: (c - 1) * 100 + 1, y2: c * 100, approx: true}; }
  const one = t => { const mm = String(t).trim().match(/^(-?\d+)\s*(BC|BCE|B\.C\.)?$/i); return mm ? (mm[2] ? -Math.abs(+mm[1]) : +mm[1]) : null; };
  const parts = s.split(/\s*(?:–|—|-(?=\s*\d)|to|至|~)\s*/); const a = one(parts[0]), b = parts[1] != null ? one(parts[1]) : null;
  if(a == null) return undefined; const d = {y: a}; if(b != null && b !== a){ d.y = Math.min(a, b); d.y2 = Math.max(a, b); } if(approx) d.approx = true; return d; }
/* where the dated nodes sit, and which nodes are hidden (by a folded branch or a folded stretch of time) */
function mmHiddenSet(m){ const hid = new Set(); const ax = mmAxis(m);
  if(ax && axF(ax).length) m.nodes.forEach(n => { const d = mmDate(n); if(d && axFolded(ax, d.y) && (d.y2 == null || axFolded(ax, d.y2))) hid.add(n.id); });
  if(m.nodes.some(n => n.fold)){ const kids = mmKids(m); const hide = id => (kids[id] || []).forEach(k => { if(!hid.has(k)){ hid.add(k); hide(k); } }); m.nodes.filter(n => n.fold).forEach(n => hide(n.id)); }
  return hid; }
function mmKids(m){ const adj = {}; m.nodes.forEach(n => adj[n.id] = []); m.edges.forEach(e => { if(adj[e.a] && adj[e.b]){ adj[e.a].push(e.b); adj[e.b].push(e.a); } });
  const pin = m.pin && m.nodes.find(n => n.type === m.pin.kind && n.ref === m.pin.id); const order = (pin ? [pin] : []).concat(m.nodes.slice().sort((a, b) => adj[b.id].length - adj[a.id].length));
  const seen = new Set(), kids = {}; order.forEach(r => { if(seen.has(r.id)) return; seen.add(r.id); const q = [r.id]; while(q.length){ const id = q.shift(); kids[id] = []; adj[id].forEach(k => { if(!seen.has(k)){ seen.add(k); kids[id].push(k); q.push(k); } }); } }); return kids; }
function mmAxisSnap(m){ const ax = mmAxis(m); if(!ax) return; m.nodes.forEach(n => { const d = mmDate(n); if(!d) return; const x = Math.round(d.y2 != null ? (axX(ax, d.y) + axX(ax, d.y2)) / 2 : axX(ax, d.y)); if(n.x !== x){ n.x = x; const el = document.querySelector('#mmNodes [data-n="' + n.id + '"]'); if(el) el.style.left = x + 'px'; } }); }
{ const _e = mmEdgesOnly; mmEdgesOnly = function(){ try{ mmAxisSnap(mindOf(MM.id)); }catch(e){} return _e.apply(this, arguments); }; }
{ const _r5 = mmRender; mmRender = function(){ const m = mindOf(MM.id); MM._axv = (MM._axv || 0) + 1; try{ mmAxisSnap(m); }catch(e){} const r = _r5.apply(this, arguments); try{ mmAfterRender(m); }catch(e){} return r; }; }
/* after drawing: hide what is folded, put the fold buttons and the date chips on, draw the span lines and the fold bands */
function mmAfterRender(m){ if(!m) return; const hid = mmHiddenSet(m), ax = mmAxis(m), kids = mmKids(m);
  document.querySelectorAll('#mmNodes .mm-node').forEach(el => { const id = el.dataset.n, n = m.nodes.find(x => x.id === id); el.classList.toggle('mm-hidden', hid.has(id)); el.querySelectorAll('.mm-foldbtn,.mm-datechip').forEach(x => x.remove());
    if(!n) return; const desc = (function count(i){ return (kids[i] || []).reduce((s, k) => s + 1 + count(k), 0); })(id);
    if(desc && !(m.pin && n.type === m.pin.kind && n.ref === m.pin.id && !n.fold && false)){ const b = document.createElement('button'); b.type = 'button'; b.className = 'mm-foldbtn' + (n.fold ? ' folded' : ''); b.dataset.fold = id; b.title = n.fold ? 'Open this branch' : 'Fold this branch'; b.textContent = n.fold ? '+' + desc : '−'; el.appendChild(b); }
    if(ax){ const d = mmDate(n); if(d){ const c = document.createElement('span'); c.className = 'mm-datechip' + (d.auto ? ' auto' : ''); c.textContent = mmDateText(d); el.appendChild(c); } } });
  document.querySelectorAll('#mmEdges .mm-edge').forEach(g => { const e = m.edges.find(x => x.id === g.dataset.e); g.style.display = e && (hid.has(e.a) || hid.has(e.b)) ? 'none' : ''; });
  const G = mm$('mmEdges'); G.querySelectorAll('.mm-span').forEach(x => x.remove());
  if(ax) m.nodes.forEach(n => { const d = mmDate(n); if(!d || d.y2 == null || hid.has(n.id)) return; const x1 = axX(ax, d.y), x2 = axX(ax, d.y2), sz = MM.sz[n.id] || [150, 46], y = n.y + sz[1] / 2 + 10;
    G.insertAdjacentHTML('beforeend', '<path class="mm-span" d="M' + x1.toFixed(1) + ' ' + (y - 4) + ' V' + (y + 4) + ' M' + x1.toFixed(1) + ' ' + y + ' H' + x2.toFixed(1) + ' M' + x2.toFixed(1) + ' ' + (y - 4) + ' V' + (y + 4) + '"></path>'); });
  let bands = document.getElementById('mmBands'); if(!bands){ bands = document.createElement('div'); bands.id = 'mmBands'; mm$('mmWorld').insertBefore(bands, mm$('mmWorld').firstChild); }
  bands.innerHTML = ax ? axF(ax).map(f => '<i class="pleat" style="left:' + axX(ax, f.a).toFixed(1) + 'px;width:' + axFoldW(ax, f).toFixed(1) + 'px;--o:' + (f.p || 0).toFixed(3) + '"></i>').join('') + (AXF.marks || []).map(f => '<b style="left:' + axX(ax, f.a).toFixed(1) + 'px"></b><b style="left:' + axX(ax, f.b).toFixed(1) + 'px"></b>').join('') : '';
  MM.el.classList.toggle('has-axis', !!ax); const ab = MM.el.querySelector('[data-mm="axis"]'); if(ab) ab.classList.toggle('on', !!ax); mmRuler(); }
document.addEventListener('click', ev => { const f = ev.target.closest && ev.target.closest('#mmNodes [data-fold]'); if(!f) return; ev.stopPropagation(); const m = mindOf(MM.id), n = m && m.nodes.find(x => x.id === f.dataset.fold); if(!n) return; n.fold = !n.fold || undefined; mmRender(); mmSave(); }, true);
/* a dated node moves only up and down */
document.addEventListener('pointermove', () => { const d = MM.drag; if(!d || d.kind !== 'node') return; const m = mindOf(MM.id); if(!mmAxis(m) || !mmDate(d.n)) return; mmAxisSnap(m); try{ mmEdgesOnly(); }catch(e){} });
/* the ruler: years along the top of the map, following its moves and zoom; drag along it to fold a stretch of time */
function mmRuler(){ const m = mindOf(MM.id), ax = mmAxis(m); let r = document.getElementById('mmRuler');
  if(!ax){ if(r) r.hidden = true; return; }
  if(!r){ r = document.createElement('div'); r.id = 'mmRuler'; r.className = 'mm-ruler'; r.innerHTML = '<svg></svg><div class="mr-sel" hidden></div>'; mm$('mmStage').parentNode.appendChild(r); mmRulerWire(r); }
  r.hidden = false; const svg = r.querySelector('svg'), b = mmBox(), W = b.w, k = MM.view.k, vx = MM.view.x - b.l;
  const yA = axYear(ax, (0 - vx) / k), yB = axYear(ax, (W - vx) / k), need = 80 / (ax.ppy * k); const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]; const st = steps.find(s => s >= need) || 5000;
  let h = ''; for(let y = Math.ceil(yA / st) * st; y <= yB; y += st){ if(axFolded(ax, y)) continue; const sx = axX(ax, y) * k + vx; h += '<path d="M' + sx.toFixed(1) + ' 20 V28"/><text x="' + sx.toFixed(1) + '" y="15" text-anchor="middle">' + (y < 0 ? (-y) + ' BC' : y === 0 ? '1' : y) + '</text>'; }
  for(let y = Math.ceil(yA / (st / 5)) * (st / 5); y <= yB && st >= 5; y += st / 5){ if(axFolded(ax, y) || y % st === 0) continue; const sx = axX(ax, y) * k + vx; h += '<path class="minor" d="M' + sx.toFixed(1) + ' 24 V28"/>'; }
  const hid = mmHiddenSet(m); axF(ax).forEach((f, i) => { const sx = axX(ax, f.a) * k + vx, w = axFoldW(ax, f) * k, n = m.nodes.filter(z => hid.has(z.id) && mmDate(z) && axFolded(ax, mmDate(z).y) === f).length;
    h += '<g class="fold" data-fi="' + i + '" data-auto="' + (f.auto ? 1 : 0) + '"><rect x="' + sx.toFixed(1) + '" y="2" width="' + Math.max(16, w).toFixed(1) + '" height="26" rx="6"/><path d="M' + (sx + 3).toFixed(1) + ' 22 l4 -6 l4 6 l4 -6 l4 6"/><text x="' + (sx + Math.max(16, w) / 2).toFixed(1) + '" y="12" text-anchor="middle">' + (f.a < 0 ? (-f.a) + ' BC' : f.a) + '–' + (f.b < 0 ? (-f.b) + ' BC' : f.b) + (n ? ' · ' + n : '') + '</text></g>'; });
  (AXF.marks || []).forEach((f, i) => { const x1 = axX(ax, f.a) * k + vx, x2 = axX(ax, f.b) * k + vx, lab = (f.a < 0 ? (-f.a) + ' BC' : f.a) + '–' + (f.b < 0 ? (-f.b) + ' BC' : f.b);
    h += '<g class="fold-open" data-oi="' + i + '"><path class="rib" d="M' + x1.toFixed(1) + ' 27.5 H' + x2.toFixed(1) + '"/><path class="rib-end" d="M' + x1.toFixed(1) + ' 24 V30 M' + x2.toFixed(1) + ' 24 V30"/>' +
      '<g class="tab"><path d="M' + (x1 + 2).toFixed(1) + ' 2 h' + (lab.length * 5.6 + 22).toFixed(1) + ' v15 h-' + (lab.length * 5.6 + 22).toFixed(1) + ' z"/><path class="mark" d="M' + (x1 + 7).toFixed(1) + ' 4 v10 l3 -3 l3 3 v-10 z"/><text x="' + (x1 + 18).toFixed(1) + '" y="13">' + lab + '</text></g>' +
      (f.auto ? '' : '<g class="fold-x" data-mi="' + f.mi + '"><circle cx="' + (x1 + lab.length * 5.6 + 30).toFixed(1) + '" cy="9.5" r="6"/><path d="M' + (x1 + lab.length * 5.6 + 27.5).toFixed(1) + ' 7 l5 5 M' + (x1 + lab.length * 5.6 + 32.5).toFixed(1) + ' 7 l-5 5"/></g>') + '</g>'; });
  svg.setAttribute('width', W); svg.setAttribute('height', 30); svg.innerHTML = h; }
{ const _ap = mmApply; mmApply = function(){ const r = _ap.apply(this, arguments); try{ mmRuler(); }catch(e){} return r; }; }
function mmRulerWire(r){ let s = null;
  r.addEventListener('pointerdown', ev => { const g = ev.target.closest('.fold, .fold-open, .fold-x'); if(g){ ev.stopPropagation(); const m = mindOf(MM.id), ax = m.axis;
      if(g.classList.contains('fold-x')){ ax.folds = (ax.folds || []).filter((x, i) => i !== +g.dataset.mi); }
      else if(g.classList.contains('fold')){ const f = axF(ax)[+g.dataset.fi]; if(!f || MM.foldAnim) return; axFoldMove(ax, f, 0, 1, () => { if(f.auto) ax.open = (ax.open || []).concat([{a: f.a, b: f.b}]); else ax.folds[f.mi].open = true; }); return; }
      else { const f = (AXF.marks || [])[+g.dataset.oi]; if(!f || MM.foldAnim) return; axFoldMove(ax, f, 1, 0, () => { if(f.auto) ax.open = (ax.open || []).filter(o => !(o.a < f.b && o.b > f.a)); else ax.folds[f.mi].open = false; }); return; }
      MM._axv = (MM._axv || 0) + 1; mmRender(); mmSave(); return; }
    ev.stopPropagation(); s = {x0: ev.clientX}; r.setPointerCapture(ev.pointerId); const sel = r.querySelector('.mr-sel'); sel.hidden = false; sel.style.left = (ev.clientX - r.getBoundingClientRect().left) + 'px'; sel.style.width = '0px'; });
  r.addEventListener('pointermove', ev => { if(!s) return; const R = r.getBoundingClientRect(), sel = r.querySelector('.mr-sel'), a = Math.min(s.x0, ev.clientX), b = Math.max(s.x0, ev.clientX); sel.style.left = (a - R.left) + 'px'; sel.style.width = (b - a) + 'px'; s.x1 = ev.clientX; });
  r.addEventListener('pointerup', ev => { if(!s) return; const R = r.getBoundingClientRect(), sel = r.querySelector('.mr-sel'), a = Math.min(s.x0, s.x1 || s.x0), b2 = Math.max(s.x0, s.x1 || s.x0); s = null; sel.hidden = true;
    if(b2 - a < 12) return; const m = mindOf(MM.id), ax = mmAxis(m), bx = mmBox(), k = MM.view.k, vx = MM.view.x - bx.l; const ya = Math.round(axYear(ax, (a - R.left - vx) / k)), yb = Math.round(axYear(ax, (b2 - R.left - vx) / k));
    openFloatMenu(b2, R.bottom + 6, [{label: 'Fold ' + (ya < 0 ? (-ya) + ' BC' : ya) + ' – ' + (yb < 0 ? (-yb) + ' BC' : yb), fn: () => { ax.folds = (ax.folds || []).filter(f => f.b <= ya || f.a >= yb).concat([{a: ya, b: yb}]).sort((p, q) => p.a - q.a); MM._axv = (MM._axv || 0) + 1; mmRender(); mmSave(); }}]); }); }
/* the date of a node, set from its bar: 1889, c. 1503, 1503–1519, 200 BC, 15th century */
{ const _nb = mmNodeBar; mmNodeBar = function(){ const r = _nb.apply(this, arguments); const bar = document.getElementById('mmNodeBar'), m = mindOf(MM.id); if(!bar || bar.hidden || !m || !mmAxis(m)) return r;
    const n = MM.sel && m.nodes.find(x => x.id === MM.sel); if(!n || bar.querySelector('[data-ns="date"]')) return r; const d = mmDate(n);
    bar.insertAdjacentHTML('afterbegin', '<button type="button" data-ns="date" title="Date"><span class="nb-date">' + (d ? esc(mmDateText(d)) : 'Date') + '</span></button><i></i>'); return r; }; }
document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('#mmNodeBar [data-ns="date"]'); if(!b) return; ev.stopPropagation(); const m = mindOf(MM.id), n = m && m.nodes.find(x => x.id === MM.sel); if(!n) return;
  const cur = n.date ? mmDateText(n.date) : ''; const v = prompt('Date: 1889, c. 1503, 1503–1519, 200 BC or 15th century (empty: none, or the paper’s own year)', cur); if(v == null) return;
  const d = mmParseDate(v); if(d === undefined){ toast('That date could not be read'); return; } if(d) n.date = d; else delete n.date; mmRender(); mmSave(); }, true);

/* the movement of a fold: frame by frame the stretch widens or narrows, the dated things in it sliding out or tucking in */
function axFoldMove(ax, f, from, to, done){ const bx = mmBox(), Xc = bx.l + bx.w / 2, anchor = axYear(ax, (Xc - MM.view.x) / MM.view.k), keep = () => { MM.view.x = Xc - axX(ax, anchor) * MM.view.k; try{ mmApply(); }catch(e){} };
  MM.foldAnim = {ax, a: f.a, b: f.b, auto: !!f.auto, mi: f.mi, from, to, t0: performance.now(), dur: 520}; const m = mindOf(MM.id); mmRender(); keep();
  const step = () => { const an = MM.foldAnim; if(!an) return; MM._axv = (MM._axv || 0) + 1; try{ mmAxisSnap(m); keep(); mmEdgesOnly(); mmAfterRender(m); }catch(e){}
    if(performance.now() - an.t0 < an.dur) requestAnimationFrame(step); else { MM.foldAnim = null; done(); MM._axv = (MM._axv || 0) + 1; mmRender(); keep(); mmSave(); } };
  requestAnimationFrame(step); }
