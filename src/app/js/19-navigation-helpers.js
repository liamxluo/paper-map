/* ===================== navigation helpers ===================== */
function scrollToEl(el, block){ if(el && el.scrollIntoView) el.scrollIntoView({behavior: reduceMotion() ? 'auto' : 'smooth', block: block || 'start'}); }
function flash(el){ el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1900); }
function focusRow(id){ const row = document.getElementById('r-' + id); if(!row) return; scrollToEl(row, 'center'); flash(row); }
function focusCard(cid){ const el = document.getElementById('card-' + cid); if(!el) return; scrollToEl(el, 'start'); flash(el); }
function resetFilters(){ ui.q = ''; ui.prio = 'all'; ui.tag = ''; ui.dom = ''; ui.st = 'all'; ui.group = null; syncControls(); }
function goTo(id){
  const e = lib.entries[id];
  if(!e) return;
  if(e.kind === 'concept'){ openView('__concepts', {card: e.id}); return; }
  if(!matches(e)) resetFilters();
  if(e.parent){ openView(e.sub, {row: e.id}); return; }
  const inView = ui.sub === e.sub || (!ui.sub && ui.topic === e.topic);
  if(inView){ renderMain(); requestAnimationFrame(() => focusRow(id)); }
  else openView(e.sub, {row: e.id});
}
function syncControls(){
  document.querySelectorAll('[data-prio]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.prio === ui.prio)));
  document.getElementById('q').value = ui.q;
  const tsel = document.getElementById('src');
  if(ui.tag && ui.tag !== '__none' && !IDX.tags[ui.tag]) ui.tag = '';
  tsel.innerHTML = '<option value="">All tags</option>' + lib.tags.map(x => '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>').join('') + '<option value="__none">No tags</option>';
  tsel.value = ui.tag;
  document.getElementById('stSel').value = ui.st;
  const dom = document.getElementById('dom');
  dom.innerHTML = '<option value="">All interests</option>' + IDX.domains.map(d => '<option value="' + esc(d) + '">' + esc(d) + '</option>').join('');
  dom.value = ui.dom;
  updateFilterToggle();
}
function updateFilterToggle(){
  const btn = document.getElementById('filterToggle'), row = document.getElementById('filters');
  const n = (ui.q ? 1 : 0) + (ui.prio !== 'all' ? 1 : 0) + (ui.tag ? 1 : 0) + (ui.dom ? 1 : 0) + (ui.st !== 'all' ? 1 : 0);
  btn.textContent = row.classList.contains('open') ? 'Hide filters' : (n ? 'Filters (' + n + ')' : 'Filters');
}
function rerenderAfterFilter(){ updateFilterToggle(); renderTabs(); renderMain(); renderMap(true); }
function appTitle(){ return String(lib.title || '').trim() || 'Paper Map'; }
function applyTitle(){ const n = appTitle(); document.title = n; const h = document.getElementById('appTitle'); if(h) h.textContent = n; }
function renderAll(){ applyTitle(); reindex(); syncControls(); renderTabs(); renderMain(); renderMap(true); refreshInfo(); setEditUI(); }
function setBarH(){ document.documentElement.style.setProperty('--bar-h', document.getElementById('bar').offsetHeight + 'px'); }
