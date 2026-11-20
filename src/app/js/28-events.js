/* ===================== events ===================== */
function handleAct(act, el){
  if(act === 'new-topic') return openTopicForm(null);
  if(act === 'edit-topic') return openTopicForm(ui.topic);
  if(act === 'del-topic') return deleteTopic(ui.topic);
  if(act === 'new-sub') return openSubForm(null, (el && el.dataset && el.dataset.topic) || ui.topic, el && el.dataset && el.dataset.parent);
  if(act === 'edit-sub') return openSubForm(el.dataset.sub || ui.sub);
  if(act === 'del-sub') return deleteSub(el.dataset.sub || ui.sub);
  if(act === 'new-entry') return openEntryForm(null);
  if(act === 'new-concept') return openConceptForm(null);
  if(act === 'export') return exportBackup();
  if(act === 'tags') return openTagManager();
  if(act === 'exit-edit'){ ui.edit = false; setEditUI(); renderTabs(); renderMain(); refreshInfo(); toast('Modify mode off'); }
}
document.getElementById('editBanner').addEventListener('click', ev => { const b = ev.target.closest('[data-act]'); if(b) handleAct(b.dataset.act, b); });
document.getElementById('btnSettings').addEventListener('click', openSettings);
document.getElementById('srcLegend').addEventListener('click', ev => { if(ev.target.closest('[data-act="tags"]')) openTagManager(); });
tocBody.addEventListener('click', ev => {
  const a = ev.target.closest('[data-act]'); if(a){ if(!isWide()) setToc(false); handleAct(a.dataset.act, a); return; }
  const tg = ev.target.closest('[data-toc-toggle]');
  if(tg){
    const id = tg.dataset.tocToggle, tp = IDX.topics[id];
    if(IDX.subs[id]){ if(tocClosedSet.has(id)) tocClosedSet.delete(id); else tocClosedSet.add(id); renderTabs(); return; }
    if(tp && tocExpanded(tp)){ tocOpenSet.delete(id); tocClosedSet.add(id); } else { tocClosedSet.delete(id); tocOpenSet.add(id); }
    renderTabs(); return;
  }
  const v = ev.target.closest('[data-view]');
  if(v){
    const vv = resolveView(v.dataset.view);
    if(vv.topic) tocClosedSet.delete(vv.topic);
    openView(v.dataset.view, {scroll:true});
    if(!isWide()) setToc(false);
  }
});
document.getElementById('tocToggle').addEventListener('click', () => {
  const open = !tocIsOpen();
  setToc(open, true);
  if(open && !isWide()){ const f = tocBody.querySelector('.toc-link.on') || tocBody.querySelector('.toc-link'); if(f) f.focus({preventScroll:true}); }
});
document.getElementById('tocClose').addEventListener('click', () => { setToc(false, true); document.getElementById('tocToggle').focus({preventScroll:true}); });
document.getElementById('tocBackdrop').addEventListener('click', () => setToc(false, true));
document.addEventListener('keydown', ev => {
  if(ev.key === 'Escape' && modal.root.hidden && tocIsOpen() && !isWide()){ ev.preventDefault(); setToc(false); document.getElementById('tocToggle').focus({preventScroll:true}); }
});
mapLabels.addEventListener('click', ev => { const b = ev.target.closest('[data-view]'); if(b) openView(b.dataset.view, {scroll:true}); });
function commonClick(ev){
  const rd = ev.target.closest('[data-reader]'); if(rd){ openReader(rd.dataset.reader); return true; }
  const st = ev.target.closest('[data-st]'); if(st){ toggleStatus(st.dataset.id, st.dataset.st); return true; }
  const sel = ev.target.closest('[data-select]'); if(sel){ select(sel.dataset.select, true); return true; }
  const gt = ev.target.closest('[data-goto]'); if(gt){ goTo(gt.dataset.goto); return true; }
  const cd = ev.target.closest('[data-card]'); if(cd){ const c = lib.entries[cd.dataset.card]; if(c) openView(c.kind === 'concept' ? '__concepts' : c.sub, {card: c.id}); return true; }
  const ed = ev.target.closest('[data-edit]'); if(ed){ const e = lib.entries[ed.dataset.edit]; if(e){ if(e.kind === 'concept') openConceptForm(e.id); else openEntryForm(e.id); } return true; }
  const dl = ev.target.closest('[data-del]'); if(dl){ deleteEntry(dl.dataset.del); return true; }
  return false;
}
infoEl.addEventListener('click', ev => { if(cardOpenFrom(ev)) ev.stopImmediatePropagation(); }, true);
mainEl.addEventListener('click', ev => { if(cardOpenFrom(ev)) ev.stopImmediatePropagation(); }, true);
[infoEl, mainEl].forEach(el => el.addEventListener('keydown', ev => { if((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('[data-open-card]')){ ev.preventDefault(); openBigCard(ev.target.dataset.openCard, ev.target); } }));
infoEl.addEventListener('click', ev => {
  const tg = ev.target.closest('[data-tagtoggle]'); if(tg && ui.selected){ toggleTag(ui.selected, tg.dataset.tagtoggle); return; }
  if(ev.target.closest('[data-act="tags"]')){ openTagManager(); return; }
  const la = ev.target.closest('[data-link-add]'); if(la){ openLinkPicker(la.dataset.id, la.dataset.linkAdd); return; }
  const ln = ev.target.closest('[data-link-note]'); if(ln){ const [a, b, ty] = ln.dataset.linkNote.split('|'); openLinkNote(a, b, ty); return; }
  const ld = ev.target.closest('[data-link-del]');
  if(ld){
    const [a, b, ty] = ld.dataset.linkDel.split('|');
    const before = clone(lib);
    lib.links = lib.links.filter(l => !(l[0] === a && l[1] === b && l[2] === ty));
    reindex(); touchLib([]); renderMap(true); refreshInfo(); applyFocus(ui.selected);
    toast('Line deleted', () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
    return;
  }
  if(commonClick(ev)) return;
  if(ev.target.closest('[data-clear-sel]')) select(null);
});
mainEl.addEventListener('click', ev => {
  const nv = ev.target.closest('.nest-link[data-view], .tl-row [data-view]'); if(nv){ openView(nv.dataset.view, {scroll:true}); return; }
  const ta2 = ev.target.closest('[data-tlink-add]'); if(ta2){ openTopicLinkPicker(ta2.dataset.tlinkAdd); return; }
  const tn = ev.target.closest('[data-tlink-note]'); if(tn){ openTopicLinkNote(tn.dataset.tlinkNote); return; }
  const td = ev.target.closest('[data-tlink-del]');
  if(td){ const l = findTlink(td.dataset.tlinkDel); if(l){ const before = clone(lib); lib.tlinks = lib.tlinks.filter(x => x !== l); reindex(); touchLib([]); renderMain(); renderMap(true); toast('Link removed', () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); }); } return; }
  const ta = ev.target.closest('[data-tagassign]'); if(ta){ openTagAssign(ta.dataset.tagassign); return; }
  if(commonClick(ev)) return;
  const ar = ev.target.closest('[data-add-reading]');
  if(ar){ const c = lib.entries[ar.dataset.addReading]; if(c) openEntryForm(null, {topic: c.topic, sub: c.sub, parent: c.id, l:'Paper', tags: defaultNewTags()}); return; }
  const a = ev.target.closest('[data-act]'); if(a){ handleAct(a.dataset.act, a); return; }
  const g = ev.target.closest('.subchip[data-group]');
  if(g){ ui.group = g.dataset.group || null; renderTabs(); renderMain(); renderMap(true); return; }
  const dom = ev.target.closest('.dom[data-dom]');
  if(dom){
    const v = dom.dataset.dom;
    ui.dom = ui.dom === v ? '' : v;
    syncControls();
    if(ui.dom){ ui.group = null; openView(ui.topic + '-all', {scroll:true}); } else rerenderAfterFilter();
  }
});

/* map pointer interactions */
let drag = null, panRaf = 0;
mapSvg.addEventListener('pointerover', ev => {
  const n = ev.target.closest('.node'), g = ev.target.closest('.ghost'), id = n ? n.dataset.id : g ? g.dataset.ghostOf : null;
  applyFocus(id || ui.selected);
  mapSvg.classList.toggle('hovering', !!id && id !== ui.selected);
  mapSvg.querySelectorAll('.me').forEach(x => x.classList.remove('me'));
  if(id) mapSvg.querySelectorAll('[data-id="' + id + '"].lbl, [data-id="' + id + '"].lbl-au').forEach(x => x.classList.add('me'));
  layoutHotLabels(id);
});
mapSvg.addEventListener('pointerleave', () => { mapSvg.classList.remove('hovering'); mapSvg.querySelectorAll('.me').forEach(x => x.classList.remove('me')); if(!drag) applyFocus(ui.selected); });
mapSvg.addEventListener('pointerdown', ev => {
  if(ev.button !== 0) return;
  if(ev.target.closest('.node, .ghost, .edge-hit') || linkMode) return;
  const pt = svgPoint(ev);
  if(pt.y >= MAP.axisY - 4) drag = {mode:'brush', x0:pt.x, x1:pt.x};
  else if(settings.range) drag = {mode:'pan', x0:pt.x, r: settings.range.slice(), moved:false};
  else drag = {mode:'click', x0:pt.x, moved:false};
  try{ mapSvg.setPointerCapture(ev.pointerId); }catch(e){}
});
mapSvg.addEventListener('pointermove', ev => {
  if(!drag) return;
  const pt = svgPoint(ev);
  if(drag.mode === 'brush'){
    drag.x1 = pt.x;
    const b = document.getElementById('brush');
    if(b){ b.setAttribute('x', Math.min(drag.x0, drag.x1)); b.setAttribute('width', Math.abs(drag.x1 - drag.x0)); }
  }else if(drag.mode === 'pan'){
    const dx = pt.x - drag.x0;
    if(Math.abs(dx) > 3) drag.moved = true;
    if(!drag.moved) return;
    const span = drag.r[1] - drag.r[0];
    const dy = -dx / MAP.inner * span;
    cancelAnimationFrame(panRaf);
    panRaf = requestAnimationFrame(() => {
      const full = MAP.full;
      let a = drag ? drag.r[0] + dy : settings.range[0], b2 = a + span;
      if(a < full[0]){ a = full[0]; b2 = a + span; }
      if(b2 > full[1]){ b2 = full[1]; a = b2 - span; }
      settings.range = [a, b2];
      renderMap(true);
    });
  }else if(Math.abs(pt.x - drag.x0) > 4) drag.moved = true;
});
mapSvg.addEventListener('pointerup', ev => {
  if(!drag) return;
  const d = drag; drag = null;
  if(d.mode === 'brush'){
    if(Math.abs(d.x1 - d.x0) > 8){ setRange(MAP.x.inv(Math.min(d.x0, d.x1)), MAP.x.inv(Math.max(d.x0, d.x1))); }
    else { const b = document.getElementById('brush'); if(b) b.setAttribute('width', 0); }
  }else if(d.mode === 'pan'){
    if(d.moved) persistSettings({remote:false}); else select(null);
  }else if(!d.moved) select(null);
});
mapSvg.addEventListener('pointercancel', () => { drag = null; });
function axisX(ev){ const r = axisSvg.getBoundingClientRect(); return (ev.clientX - r.left) * (r.width ? MAP.W / r.width : 1); }
axisSvg.addEventListener('pointerdown', ev => {
  if(ev.button !== 0) return;
  const x0 = axisX(ev); drag = {mode:'brush', x0, x1:x0};
  try{ axisSvg.setPointerCapture(ev.pointerId); }catch(e){}
});
axisSvg.addEventListener('pointermove', ev => {
  if(!drag || drag.mode !== 'brush') return;
  drag.x1 = axisX(ev);
  const b = document.getElementById('brush');
  if(b){ b.setAttribute('x', Math.min(drag.x0, drag.x1)); b.setAttribute('width', Math.abs(drag.x1 - drag.x0)); }
});
axisSvg.addEventListener('pointerup', () => {
  if(!drag || drag.mode !== 'brush') return;
  const d = drag; drag = null;
  if(Math.abs(d.x1 - d.x0) > 8) setRange(MAP.x.inv(Math.min(d.x0, d.x1)), MAP.x.inv(Math.max(d.x0, d.x1)));
  else { const b = document.getElementById('brush'); if(b) b.setAttribute('width', 0); }
});
axisSvg.addEventListener('pointercancel', () => { drag = null; });
axisSvg.addEventListener('dblclick', ev => { zoomBy(2, MAP.x.inv(axisX(ev))); });
let nodeDrag = null, suppressMapClick = false;
const dragHint = document.createElement('div'); dragHint.className = 'drag-hint'; dragHint.hidden = true; document.body.appendChild(dragHint);
function laneAt(clientY){
  const r = mapSvg.getBoundingClientRect(), sy = r.height ? MAP.H / r.height : 1, y = (clientY - r.top) * sy;
  return {i: Math.max(0, Math.min((MAP.lanes || []).length - 1, Math.floor((y - MAP.top) / MAP.laneH))), y};
}
function laneName(ln){ return ln.sub.hidden ? ln.topic.name : [ln.topic.name].concat(subPath(ln.sub)).join(' › '); }
function moveEntryTo(id, s, where){
  const e = lib.entries[id]; if(!e || !s || e.sub === s.id) return;
  const before = clone(lib);
  e.sub = s.id; e.topic = IDX.topicOf[s.id]; e.group = '';
  reindex(); touchLib(); renderAll(); if(ui.selected === id) select(id);
  toast('Moved “' + mapLabel(e) + '” to “' + where + '”', () => { lib = before; reindex(); touchAllTopics(); renderAll(); toast('Undone'); });
}
mapSvg.addEventListener('pointerdown', ev => {
  const n = ev.target.closest('.node'); if(!n || ev.button !== 0) return;
  nodeDrag = {id: n.dataset.id, x0: ev.clientX, y0: ev.clientY, started: false};
}, true);
function cleanupNodeDrag(){
  mapSvg.classList.remove('node-dragging');
  ['laneDrop', 'dragGhost', 'linkDragPath'].forEach(x => { const el = document.getElementById(x); if(el) el.remove(); });
  mapSvg.querySelectorAll('.node.link-target').forEach(x => x.classList.remove('link-target'));
  mapLabels.querySelectorAll('.drop-target').forEach(b => b.classList.remove('drop-target'));
  dragHint.hidden = true;
}
window.addEventListener('pointermove', ev => {
  const d = nodeDrag; if(!d) return;
  if(!d.started){
    if(Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < 7) return;
    const p = MAP.P[d.id], e = lib.entries[d.id]; if(!p || !e || e.kind === 'concept'){ nodeDrag = null; return; }
    d.started = true; d.from = (MAP.lanes || []).findIndex(ln => ln.sub.id === e.sub);
    mapSvg.classList.add('node-dragging');
    mapSvg.insertAdjacentHTML('afterbegin', '<rect class="lane-drop" id="laneDrop" x="0" width="' + MAP.W + '" height="' + MAP.laneH + '" y="' + MAP.top + '"></rect>');
    mapSvg.insertAdjacentHTML('beforeend', '<circle class="drag-ghost" id="dragGhost" cx="' + p.x + '" cy="' + p.y + '" r="7"></circle>');
    closeFloatMenu();
  }
  const L = laneAt(ev.clientY), ln = MAP.lanes[L.i]; if(!ln) return;
  d.to = ln.concepts ? d.from : L.i;
  const g = document.getElementById('dragGhost'); if(g) g.setAttribute('cy', Math.max(MAP.top + 4, Math.min(MAP.H - 4, L.y)));
  const r = document.getElementById('laneDrop'); if(r) r.setAttribute('y', MAP.top + L.i * MAP.laneH);
  mapLabels.querySelectorAll('button').forEach((b, k) => b.classList.toggle('drop-target', k === L.i));
  dragHint.hidden = false; dragHint.textContent = ln.concepts ? 'Papers can’t go in the Concepts row' : L.i === d.from ? 'Drop it on another row to move it' : 'Move to “' + laneName(ln) + '”';
  dragHint.style.left = (ev.clientX + 14) + 'px'; dragHint.style.top = (ev.clientY + 12) + 'px';
  const bx = mapBox.getBoundingClientRect();
  if(ev.clientY < bx.top + 28) mapBox.scrollTop -= 14; else if(ev.clientY > bx.bottom - 44) mapBox.scrollTop += 14;
});
window.addEventListener('pointerup', ev => {
  const d = nodeDrag; nodeDrag = null; if(!d || !d.started) return;
  suppressMapClick = true; setTimeout(() => { suppressMapClick = false; }, 0);
  cleanupNodeDrag(); mapSvg.classList.remove('linking'); applyFocus(ui.selected);
  const ln = MAP.lanes[d.to]; if(ln && d.to !== d.from) moveEntryTo(d.id, ln.sub, laneName(ln));
});
window.addEventListener('pointercancel', () => { if(nodeDrag && nodeDrag.started) cleanupNodeDrag(); nodeDrag = null; });
window.addEventListener('keydown', ev => { if(ev.key === 'Escape' && nodeDrag && nodeDrag.started){ cleanupNodeDrag(); nodeDrag = null; } });
/* a list row: drag its year onto a topic or subtopic in Contents */
let paperDrag = null;
function dropSubFor(view){ if(IDX.subs[view]) return IDX.subs[view]; const tp = IDX.topics[String(view).replace(/-all$/, '')]; return tp ? (tp.subs.find(s => s.hidden) || null) : null; }
function clearPaperOver(){ tocBody.querySelectorAll('.paper-over').forEach(x => x.classList.remove('paper-over')); }
mainEl.addEventListener('dragstart', ev => {
  const h = ev.target.closest && ev.target.closest('[data-drag-paper]'); if(!h) return;
  paperDrag = h.dataset.dragPaper;
  try{ ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', 'paper:' + paperDrag); }catch(e){}
  document.body.classList.add('paper-dragging');
});
mainEl.addEventListener('dragend', () => { paperDrag = null; document.body.classList.remove('paper-dragging'); clearPaperOver(); });
tocBody.addEventListener('dragover', ev => {
  if(!paperDrag) return;
  clearPaperOver();
  const link = ev.target.closest('.toc-link[data-view]'), s = link && dropSubFor(link.dataset.view); if(!s) return;
  ev.preventDefault(); try{ ev.dataTransfer.dropEffect = 'move'; }catch(e){}
  link.classList.add('paper-over');
}, true);
tocBody.addEventListener('drop', ev => {
  if(!paperDrag) return;
  const link = ev.target.closest('.toc-link[data-view]'), s = link && dropSubFor(link.dataset.view), id = paperDrag;
  paperDrag = null; clearPaperOver(); document.body.classList.remove('paper-dragging');
  if(!s) return; ev.preventDefault(); ev.stopPropagation();
  moveEntryTo(id, s, s.hidden ? IDX.topics[IDX.topicOf[s.id]].name : [IDX.topics[IDX.topicOf[s.id]].name].concat(subPath(s)).join(' › '));
}, true);
document.addEventListener('touchstart', () => {}, {passive: true});
let lastPtr = 'mouse', peekId = null;
window.addEventListener('pointerdown', ev => { lastPtr = ev.pointerType || 'mouse'; }, true);
mapSvg.addEventListener('click', ev => {
  if(linkMode){ finishLinkMode(ev); return; }
  { const pn = ev.target.closest('.node');
    if(pn && lastPtr === 'touch' && pn.dataset.id !== ui.selected && peekId !== pn.dataset.id){
      peekId = pn.dataset.id; applyFocus(peekId); mapSvg.classList.add('hovering');
      mapSvg.querySelectorAll('.me').forEach(x => x.classList.remove('me'));
      mapSvg.querySelectorAll('[data-id="' + peekId + '"].lbl, [data-id="' + peekId + '"].lbl-au').forEach(x => x.classList.add('me'));
      return;
    }
    if(!pn) peekId = null; else peekId = null; }
  if(suppressMapClick) return;
  const eh = ev.target.closest('.edge-hit'); if(eh){ openLineMenu(eh.dataset.a, eh.dataset.b, eh.dataset.t, ev.clientX, ev.clientY); return; }
  const gh = ev.target.closest('.ghost'); if(gh){ select(gh.dataset.ghostOf, false); return; }
  const n = ev.target.closest('.node');
  if(n){ select(n.dataset.id, false); if(isPhone()) setTimeout(() => infoEl.scrollIntoView({behavior: 'smooth', block: 'nearest'}), 80); }
});
/* phones: the plot is wider than the screen, so keep the interesting part in view */
function isPhone(){ return !!(window.matchMedia && matchMedia('(max-width: 640px)').matches); }
let phonePanned = false;
function phonePan(){
  if(!isPhone() || !MAP || !MAP.P) return;
  const vw = mapScroll.clientWidth, x0 = mapScroll.scrollLeft;
  if(!vw || mapScroll.scrollWidth <= vw) return;
  const sel = ui.selected && MAP.P[ui.selected];
  if(sel){ if(sel.x < x0 + 24 || sel.x > x0 + vw - 24) mapScroll.scrollLeft = Math.max(0, sel.x - vw / 2); return; }
  if(phonePanned) return;
  const xs = Object.values(MAP.P).map(q => q.x).filter(Number.isFinite).sort((a, b) => a - b);
  if(!xs.length) return;
  mapScroll.scrollLeft = Math.max(0, xs[Math.floor(xs.length * 0.6)] - vw / 2);
  if(mapScroll.scrollLeft > 0 || xs[Math.floor(xs.length * 0.6)] < vw / 2) phonePanned = true;
}
{ const base = renderMap; renderMap = function(force){ const r = base.apply(this, arguments); requestAnimationFrame(() => { try{ phonePan(); }catch(e){} }); return r; }; }
mapSvg.addEventListener('dblclick', ev => {
  const dn = ev.target.closest('.node');
  if(dn){ const id = dn.dataset.id; if(lib.entries[id] && lib.entries[id].kind === 'paper' && !linkMode){ ev.preventDefault(); if(ui.selected !== id) select(id, false); openPlusMenu(id); showPlus(id); } return; }
  const pt = svgPoint(ev);
  zoomBy(2, MAP.x.inv(pt.x));
});
mapSvg.addEventListener('keydown', ev => {
  if(ev.key !== 'Enter' && ev.key !== ' ') return;
  const n = ev.target.closest('.node');
  if(n){ ev.preventDefault(); select(n.dataset.id, false); }
});
mapScroll.addEventListener('wheel', ev => {
  if(ev.ctrlKey){ ev.preventDefault(); const pt = svgPoint(ev); zoomBy(ev.deltaY < 0 ? 1.25 : 0.8, MAP.x.inv(pt.x)); }
  else if(settings.range && Math.abs(ev.deltaX) > Math.abs(ev.deltaY) * 1.2){ ev.preventDefault(); const span = settings.range[1] - settings.range[0]; panBy(ev.deltaX / MAP.inner * span); }
}, {passive:false});
document.querySelector('.zoom').addEventListener('click', ev => {
  const b = ev.target.closest('[data-zoom]'); if(!b) return;
  const z = b.dataset.zoom;
  if(z === 'in') zoomBy(2);
  else if(z === 'out') zoomBy(0.5);
  else if(z === 'reset') setRange(null, null);
  else{
    const cur = settings.range || MAP.full;
    const step = (cur[1] - cur[0]) * 0.35;
    if(!settings.range){ if(z === 'left') setRange(cur[0], cur[1] - step); else setRange(cur[0] + step, cur[1]); }
    else panBy(z === 'left' ? -step : step);
  }
});
document.getElementById('btnRange').addEventListener('click', () => {
  const a = parseInt(document.getElementById('y0').value, 10), b = parseInt(document.getElementById('y1').value, 10);
  if(!isFinite(a) || !isFinite(b)){ toast('Enter both a start and an end year'); return; }
  setRange(a, b);
});

/* filters */
document.getElementById('q').addEventListener('input', debounce(ev => { ui.q = ev.target.value.trim(); rerenderAfterFilter(); }, 150));
document.querySelectorAll('[data-prio]').forEach(b => b.addEventListener('click', () => { ui.prio = b.dataset.prio; syncControls(); rerenderAfterFilter(); }));
document.getElementById('stSel').addEventListener('change', ev => { ui.st = ev.target.value; rerenderAfterFilter(); });
document.getElementById('src').addEventListener('change', ev => { ui.tag = ev.target.value; rerenderAfterFilter(); });
document.getElementById('dom').addEventListener('change', ev => { ui.dom = ev.target.value; rerenderAfterFilter(); });
function setFiltersOpen(open){
  document.getElementById('filters').classList.toggle('open', open);
  document.getElementById('filterToggle').setAttribute('aria-expanded', String(open));
  updateFilterToggle(); setBarH();
}
document.getElementById('filterToggle').addEventListener('click', () => {
  const open = !document.getElementById('filters').classList.contains('open');
  setFiltersOpen(open);
  settings.filtersOpen = open ? 'open' : null; persistSettings({remote:false});
  if(open) setTimeout(() => document.getElementById('q').focus(), 0);
});
window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if(h === 'concepts'){ if(ui.page !== 'concepts'){ ui.page = 'concepts'; applyView(); } return; }
  const v = resolveView(h);
  if(ui.page === 'concepts' || v.topic !== ui.topic || v.sub !== ui.sub){ ui.page = null; ui.group = null; ui.topic = v.topic; ui.sub = v.sub; applyView(); }
});
