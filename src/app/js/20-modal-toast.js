/* ===================== modal & toast ===================== */
const modal = {root: document.getElementById('modalRoot'), title: document.getElementById('modalTitle'), body: document.getElementById('modalBody'), actions: document.getElementById('modalActions'), onClose:null, ret:null, buttons:[]};
function openModal(o){
  { const mw = document.querySelector('#modalRoot .modal'); if(mw) mw.classList.remove('modal-wide'); }
  modal.ret = document.activeElement;
  modal.title.textContent = o.title;
  modal.body.innerHTML = o.body;
  modal.buttons = o.actions || [{label:'Close'}];
  modal.actions.innerHTML = modal.buttons.map((a, i) => '<button type="button" class="btn' + (a.primary ? ' primary' : '') + '" data-mi="' + i + '"' + (a.disabled ? ' disabled' : '') + '>' + esc(a.label) + '</button>').join('');
  modal.onClose = o.onClose || null;
  modal.root.hidden = false;
  if(o.onOpen) o.onOpen(modal.body, modal.actions);
  const f = modal.body.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select') || modal.actions.querySelector('button:not([disabled])');
  if(f) f.focus();
}
function closeModal(){
  modal.root.hidden = true;
  modal.body.innerHTML = ''; modal.actions.innerHTML = '';
  const cb = modal.onClose; modal.onClose = null;
  if(cb) cb();
  if(modal.ret && modal.ret.focus) try{ modal.ret.focus({preventScroll:true}); }catch(e){}
}
modal.actions.addEventListener('click', ev => {
  const b = ev.target.closest('[data-mi]');
  if(!b || b.disabled) return;
  const a = modal.buttons[+b.dataset.mi];
  if(!a) return;
  if(a.onClick){ const keep = a.onClick(modal.body); if(keep === false) return; }
  closeModal();
});
modal.root.addEventListener('click', ev => { if(ev.target.closest('[data-close]')) closeModal(); });
document.addEventListener('keydown', ev => { if(ev.key === 'Escape' && !modal.root.hidden){ ev.preventDefault(); closeModal(); } });
let toastTimer = null, undoFn = null;
function toast(msg, undo){
  const t = document.getElementById('toast');
  if(undo && !undoing) setUndo(msg, undo);
  t.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button type="button" data-undo="1">Undo</button>' : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, undo ? 9000 : 3200);
}
document.getElementById('undoPill').addEventListener('click', () => runUndo());
document.getElementById('btnAddPaper').addEventListener('click', () => openEntryForm(null));
(() => {
  const btn = document.getElementById('btnMore'), menu = document.getElementById('moreMenu');
  const show = open => { menu.hidden = !open; btn.setAttribute('aria-expanded', String(open));  };
  btn.addEventListener('click', ev => { ev.stopPropagation(); show(menu.hidden); });
  menu.addEventListener('click', ev => {
    const b = ev.target.closest('[data-more]'); if(!b) return; show(false);
    const go = {concept: () => { const a = document.querySelector('#addMenu [data-add="concept"]'); if(a) a.click(); }, filters: () => document.getElementById('filterToggle').click(), settings: () => document.getElementById('btnSettings').click(), export: () => openExport(), exportList: () => openListExport(), exportBoth: () => openExport({list: true, format: 'pdf'}), import: () => openImport()}[b.dataset.more];
    if(go) go();
  });
  document.addEventListener('click', ev => { if(!menu.hidden && !ev.target.closest('.more-wrap')) show(false); });
})();
(() => {
  const more = document.getElementById('btnAddMore'), menu = document.getElementById('addMenu');
  const show = open => { menu.hidden = !open; more.setAttribute('aria-expanded', String(open)); };
  more.addEventListener('click', ev => { ev.stopPropagation(); show(menu.hidden); });
  menu.addEventListener('click', ev => { const b = ev.target.closest('[data-add]'); if(!b) return; show(false); if(b.dataset.add === 'concept') openConceptForm(null); else if(b.dataset.add === 'import') openImport(); else openEntryForm(null); });
  document.addEventListener('click', ev => { if(!menu.hidden && !ev.target.closest('.add-split')) show(false); });
  document.addEventListener('keydown', ev => { if(ev.key === 'Escape' && !menu.hidden) show(false); });
})();
document.getElementById('toast').addEventListener('click', ev => {
  if(ev.target.closest('[data-undo]')){ document.getElementById('toast').hidden = true; runUndo(); }
});
/* The last change can be undone for as long as Settings says (10 minutes by default), until you make another change.
   It doesn't vanish when the message fades or the mouse moves. */
function undoMinutes(){ return settings.undoWindow === 0 ? 0 : (settings.undoWindow || 10); }
function setUndo(label, fn){
  undoSlot = {label, fn, at: Date.now(), stAt: clone(status), fresh: true};
  setTimeout(() => { if(undoSlot) undoSlot.fresh = false; }, 0);
  renderUndo();
}
function clearUndo(){ if(undoSlot){ undoSlot = null; renderUndo(); } }
function runUndo(){
  if(undoSlot && undoMinutes() && Date.now() - undoSlot.at > undoMinutes() * 60000){ undoSlot = null; renderUndo(); toast('Undo has expired'); return; }
  if(!undoSlot) return;
  const s = undoSlot; undoSlot = null;
  const stNow = clone(status);
  undoing = true;
  try{ s.fn(); } finally { undoing = false; }
  /* keep any Read / Want-to-read marks made since the change */
  let changed = false;
  new Set(Object.keys(s.stAt).concat(Object.keys(stNow))).forEach(k => {
    if(JSON.stringify(s.stAt[k]) === JSON.stringify(stNow[k])) return;
    if(stNow[k] === undefined) delete status[k]; else status[k] = stNow[k];
    changed = true;
  });
  if(changed){ statusTime = Date.now(); persistStatus(); renderAll(); }
  renderUndo();
}
function renderUndo(){
  const b = document.getElementById('undoPill'); if(!b) return;
  if(undoSlot && undoMinutes() && Date.now() - undoSlot.at > undoMinutes() * 60000) undoSlot = null;
  b.hidden = !undoSlot;
  if(undoSlot){
    b.querySelector('.undo-what').textContent = undoSlot.label;
    b.title = 'Undo: ' + undoSlot.label + ' (works ' + (undoMinutes() ? 'for ' + undoMinutes() + ' minutes, ' : '') + 'until your next change; Ctrl or Cmd + Z)';
  }
  if(typeof setBarH === 'function') setBarH();
}
/* no background timer: the time limit is checked whenever you move or type, and again when you press Undo */
let undoCheckAt = 0;
['pointermove', 'keydown', 'focus', 'visibilitychange'].forEach(ty => window.addEventListener(ty, () => {
  if(!undoSlot) return;
  const now = Date.now(); if(now - undoCheckAt < 5000) return;
  undoCheckAt = now; renderUndo();
}, {passive:true}));
document.addEventListener('keydown', ev => {
  if(!(ev.metaKey || ev.ctrlKey) || ev.shiftKey || ev.altKey || (ev.key !== 'z' && ev.key !== 'Z')) return;
  const a = document.activeElement;
  if(a && a.matches && a.matches('input, textarea, select, [contenteditable="true"]')) return;
  if(!modal.root.hidden || !undoSlot) return;
  ev.preventDefault(); runUndo();
});



/* a paper can mention a topic without linking to any paper in it; the map shows it as a shadow dot in that row */
function mentionLane(m, laneIndex){
  if(IDX.subs[m] && laneIndex[m] != null) return laneIndex[m];
  const tp = IDX.topics[m]; if(!tp) return null;
  const s = treeSubs(tp).find(x => laneIndex[x.id] != null); return s ? laneIndex[s.id] : null;
}
function mentionName(m){ const s = IDX.subs[m]; if(s) return (IDX.topics[IDX.topicOf[m]] || {}).name + (s.hidden ? '' : ' › ' + subPath(s).join(' › ')); return (IDX.topics[m] || {}).name || ''; }
function mentionsHTML(e){
  const ms = (e.mentions || []).filter(m => IDX.subs[m] || IDX.topics[m]); if(!ms.length) return '';
  return '<p class="rel"><span class="rel-k">Mentions</span>' + ms.map(m => '<button type="button" class="relchip" data-view="' + esc(IDX.topics[m] ? m : m) + '">' + esc(mentionName(m)) + '</button>').join('') + '</p>';
}
function openMentionPicker(id){
  const e = lib.entries[id]; if(!e) return;
  const cur = new Set(e.mentions || []);
  const rows = allLaneRows().filter(r => r.sub.id !== e.sub);
  openModal({title: 'Which other fields does “' + e.t + '” mention?',
    body: '<p class="hint">Fields this paper reaches into, without linking it to any paper there. Each shows as a faint shadow of its dot in that row.</p><div class="ment-list">' +
      rows.map(r => { const key = r.sub.hidden ? r.topic.id : r.sub.id; return '<label style="--d:' + (r.sub.hidden ? 0 : r.depth + 1) + '"><input type="checkbox" data-ment="' + esc(key) + '"' + (cur.has(key) ? ' checked' : '') + '> ' + esc(r.sub.hidden ? r.topic.name : r.name) + '</label>'; }).join('') + '</div>',
    actions: [{label: 'Cancel'}, {label: 'Save', primary: true, onClick: bd => {
      const before = clone(lib);
      e.mentions = [...bd.querySelectorAll('[data-ment]:checked')].map(x => x.dataset.ment);
      reindex(); touchLib([]); renderMap(true); refreshInfo();
      toast(e.mentions.length ? 'Mentions ' + e.mentions.map(mentionName).join(', ') : 'Mentions nothing now', () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
    }}]});
}
