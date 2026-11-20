/* ===================== menus that appear where you point (no Modify mode) ===================== */
function moreBtn(key){ return '<button type="button" class="more-btn" data-more-of="' + esc(key) + '" aria-label="Add a subtopic inside, rename or delete" title="Add a subtopic inside, rename or delete">⋯</button>'; }
function tocMore(kind, id){ return ''; }
function moreItems(key){
  const [k, id] = [key.slice(0, 1), key.slice(2)];
  if(k === 'p'){ const e = lib.entries[id]; if(!e) return [];
    return [{label: 'Lens', a: {lens: id}}, {label: 'Modify…', a: {edit: id}}, {label: 'Tags…', a: {tagassign: id}}, {sep: 1},
      {label: 'It builds on…', a: {linkAdd: 'b', id}}, {label: 'It responds to…', a: {linkAdd: 'c', id}}, {label: 'Related to…', a: {linkAdd: 'r', id}}, {label: 'Mentions another field…', a: {mention: id}}, {sep: 1},
      {label: 'Delete', a: {del: id}, danger: 1}]; }
  if(k === 's'){ const s = IDX.subs[id]; if(!s) return []; const tid = IDX.topicOf[id];
    return [{label: 'Add a paper here', a: {act: 'new-entry', view: id}}, {label: 'Add a subtopic inside', a: {act: 'new-sub', topic: tid, parent: id}}, {label: 'Rename or describe…', a: {act: 'edit-sub', sub: id}}, {label: 'Related topic…', a: {tlinkAdd: id}}, {sep: 1}, {label: 'Delete subtopic', a: {act: 'del-sub', sub: id}, danger: 1}]; }
  if(k === 't'){ const tp = IDX.topics[id]; if(!tp) return [];
    return [{label: 'Add a paper here', a: {act: 'new-entry', view: id}}, {label: 'Add a subtopic', a: {act: 'new-sub', topic: id}}, {label: 'Rename or describe…', a: {act: 'edit-topic', topic: id}}, {label: 'Related topic…', a: {tlinkAdd: id}}, {sep: 1}, {label: 'Delete topic', a: {act: 'del-topic', topic: id}, danger: 1}]; }
  return [];
}
function closeFloatMenu(){ const m = document.getElementById('floatMenu'); if(m){ m.remove(); if(m.classList.contains('plus-menu') && typeof hidePlus === 'function') hidePlus(); } document.querySelectorAll('.more-btn.open').forEach(b => b.classList.remove('open')); }
function openFloatMenu(x, y, items, from){
  closeFloatMenu(); if(!items.length) return;
  const m = document.createElement('div'); m.className = 'float-menu'; m.id = 'floatMenu'; m.setAttribute('role', 'menu');
  m.innerHTML = items.map((it, i) => it.sep ? '<div class="fm-sep"></div>' : '<button type="button" role="menuitem" class="fm-item' + (it.danger ? ' danger' : '') + '" data-fm="' + i + '">' + esc(it.label) + '</button>').join('');
  m.style.left = '0px'; m.style.top = '0px'; m.style.animation = 'none';
  document.body.appendChild(m);
  const r = m.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  m.style.animation = '';
  m.style.left = Math.max(8, Math.min(x, W - r.width - 8)) + 'px'; m.style.top = Math.max(8, Math.min(y, H - r.height - 8)) + 'px';
  if(from) from.classList.add('open');
  m.addEventListener('click', ev => { const b = ev.target.closest('[data-fm]'); if(!b) return; const it = items[+b.dataset.fm]; closeFloatMenu(); setTimeout(() => it.fn ? it.fn() : runMenuItem(it.a), 0); });
  const f = m.querySelector('.fm-item'); if(f) f.focus({preventScroll: true});
}
function runMenuItem(a){
  if(a.select) return select(a.select, false);
  if(a.edit){ const e = lib.entries[a.edit]; if(e) return e.kind === 'concept' ? openConceptForm(e.id) : openEntryForm(e.id); return; }
  if(a.tagassign) return openTagAssign(a.tagassign);
  if(a.linkAdd) return openLinkPicker(a.id, a.linkAdd);
  if(a.del) return deleteEntry(a.del);
  if(a.tlinkAdd) return openTopicLinkPicker(a.tlinkAdd);
  if(a.mention) return openMentionPicker(a.mention);
  if(a.lens) return openLens(a.lens);
  if(a.act){
    if(a.view && a.act === 'new-entry'){ if(IDX.subs[a.view]){ ui.topic = IDX.topicOf[a.view]; ui.sub = a.view; } else if(IDX.topics[a.view]){ ui.topic = a.view; } }
    if(a.act === 'edit-topic' && a.topic){ ui.topic = a.topic; }
    if(a.act === 'del-topic' && a.topic){ ui.topic = a.topic; }
    const el = document.createElement('span'); Object.entries(a).forEach(([k, v]) => { if(k !== 'act') el.dataset[k] = v; });
    return handleAct(a.act, el);
  }
}
document.addEventListener('click', ev => { const lb = ev.target.closest('[data-open-lens]'); if(lb){ openLens(lb.dataset.openLens); } });
document.addEventListener('click', ev => {
  const b = ev.target.closest('.more-btn[data-more-of]'); if(!b) return;
  ev.preventDefault(); ev.stopPropagation();
  if(b.classList.contains('open')){ closeFloatMenu(); return; }
  const r = b.getBoundingClientRect(); openFloatMenu(r.left, r.bottom + 4, moreItems(b.dataset.moreOf), b);
}, true);
document.addEventListener('pointerdown', ev => { if(!ev.target.closest('#floatMenu') && !ev.target.closest('.more-btn')) closeFloatMenu(); }, true);
document.addEventListener('keydown', ev => { if(ev.key === 'Escape' && document.getElementById('floatMenu')){ closeFloatMenu(); ev.stopPropagation(); } }, true);
window.addEventListener('scroll', closeFloatMenu, {passive: true});
/* right-click (or long-press) a dot on the map */
mapSvg.addEventListener('contextmenu', ev => {
  const n = ev.target.closest('.node'); if(!n) return;
  ev.preventDefault();
  const id = n.dataset.id, e = lib.entries[id]; if(!e) return;
  const items = [{label: 'Open card', a: {select: id}}, {sep: 1}].concat(moreItems('p:' + id));
  openFloatMenu(ev.clientX + 2, ev.clientY + 2, items);
});


/* Contents: right-click a topic for its menu (add a paper, a subtopic, rename, related, delete); on a touch screen, press and hold */
tocBody.addEventListener('contextmenu', ev => {
  const row = ev.target.closest('[data-node]'); if(!row) return;
  const key = row.dataset.node; if(!/^[ts]:/.test(key)) return;
  ev.preventDefault(); openFloatMenu(ev.clientX + 2, ev.clientY + 2, moreItems(key));
});
{ let hold = null;
  tocBody.addEventListener('pointerdown', ev => { if(ev.pointerType !== 'touch') return; const row = ev.target.closest('[data-node]'); if(!row || !/^[ts]:/.test(row.dataset.node)) return;
    const x = ev.clientX, y = ev.clientY, key = row.dataset.node; clearTimeout(hold);
    hold = setTimeout(() => { hold = null; openFloatMenu(x + 2, y + 2, moreItems(key)); }, 560);
    const cancel = e2 => { if(e2.type === 'pointermove' && Math.hypot(e2.clientX - x, e2.clientY - y) < 8) return; clearTimeout(hold); hold = null; tocBody.removeEventListener('pointermove', cancel); tocBody.removeEventListener('pointerup', cancel); tocBody.removeEventListener('pointercancel', cancel); };
    tocBody.addEventListener('pointermove', cancel); tocBody.addEventListener('pointerup', cancel); tocBody.addEventListener('pointercancel', cancel); });
}
