/* ===================== views & tabs ===================== */
const mainEl = document.getElementById('main');
function viewId(){ return ui.page === 'concepts' ? 'concepts' : (ui.sub || (ui.topic + '-all')); }
function defaultViewOf(tid){
  const tp = IDX.topics[tid];
  if(!tp) return {topic:null, sub:null};
  const vis = visibleSubs(tp);
  return {topic:tid, sub: vis.length ? vis[0].id : tp.subs[0].id};
}
function resolveView(id){
  if(id && IDX.subs[id]) return {topic: IDX.topicOf[id], sub: id};
  if(id && /-all$/.test(id)){ const t = id.slice(0, -4); if(IDX.topics[t]) return {topic:t, sub:null}; }
  if(id && IDX.topics[id]) return defaultViewOf(id);
  return defaultViewOf(lib.topics[0].id);
}
function fixView(){
  const v = ui.sub ? resolveView(ui.sub) : (ui.topic ? resolveView(ui.topic + '-all') : resolveView(''));
  ui.topic = v.topic; ui.sub = v.sub;
  if(ui.group && !(IDX.subs[ui.sub] && IDX.subs[ui.sub].groups.some(g => g.id === ui.group))) ui.group = null;
  if(ui.selected && !lib.entries[ui.selected]) ui.selected = null;
}
function openView(id, opts){
  if(id === '__concepts' || id === 'concepts'){
    ui.page = 'concepts'; ui.pending = opts || {scroll:true}; applyView();
    try{ if(location.hash.slice(1) !== 'concepts') location.hash = 'concepts'; }catch(e){}
    return;
  }
  ui.page = null;
  const v = resolveView(id);
  if(v.sub && IDX.subs[v.sub]) subAncestors(IDX.subs[v.sub]).forEach(a => tocClosedSet.delete(a.id));
  if(v.topic !== ui.topic || v.sub !== ui.sub) ui.group = null;
  ui.topic = v.topic; ui.sub = v.sub;
  ui.pending = opts || {scroll:true};
  applyView();
  try{ if(location.hash.slice(1) !== viewId()) location.hash = viewId(); }catch(e){}
}
function applyView(){
  const opts = ui.pending || {scroll:true};
  ui.pending = null;
  renderTabs(); renderMain(); renderMap(true);
  requestAnimationFrame(() => {
    if(opts.row) focusRow(opts.row);
    else if(opts.card) focusCard(opts.card);
    else if(opts.scroll !== false) scrollToEl(mainEl, 'start');
  });
}
const tocEl = document.getElementById('toc'), tocBody = document.getElementById('tocBody');
const tocOpenSet = new Set(), tocClosedSet = new Set();
const CARET = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1.5 7 5 3 8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function tocExpanded(tp){ if(tocClosedSet.has(tp.id)) return false; return tocOpenSet.has(tp.id) || tp.id === ui.topic; }
function tocLink(view, label, n, on, cls){
  on = on && ui.page !== 'concepts';
  return '<button type="button" class="toc-link' + (cls ? ' ' + cls : '') + (on ? ' on' : '') + (n ? '' : ' dim') + '" data-view="' + view + '"' + (on ? ' aria-current="page"' : '') + '><span>' + esc(label) + '</span><span class="n">' + n + '</span></button>';
}
const DRAG = '';
const tocPlus = (tid, parent, name) => '<button type="button" class="toc-plus" data-act="new-sub" data-topic="' + tid + '"' + (parent ? ' data-parent="' + parent + '"' : '') + ' title="Add a subtopic inside" aria-label="Add a subtopic inside “' + esc(name) + '”">+</button>';
function renderTabs(){
  const ae = document.activeElement;
  let focusSel = null;
  if(ae && ae.closest && ae.closest('#tocBody')){
    if(ae.dataset.view) focusSel = '[data-view="' + ae.dataset.view + '"]';
    else if(ae.dataset.tocToggle) focusSel = '[data-toc-toggle="' + ae.dataset.tocToggle + '"]';
  }
  let h = '<ul class="toc-tree">';
  lib.topics.forEach(tp => {
    const vis = visibleSubs(tp);
    const n = topicCount(tp);
    const exp = vis.length > 0 && tocExpanded(tp);
    const topicOn = tp.id === ui.topic && !vis.length;
    h += '<li class="toc-topic"><div class="toc-row" draggable="true" title="Drag to move · right-click for more"' + (' data-node="t:' + tp.id + '"') + '>' +
      (vis.length ? '<button type="button" class="toc-caret" data-toc-toggle="' + tp.id + '" aria-expanded="' + exp + '" aria-label="' + (exp ? 'Collapse “' : 'Expand “') + esc(tp.name) + '”">' + CARET + '</button>' : '<span class="toc-caret-sp" aria-hidden="true"></span>') +
      tocLink(tp.id, tp.name, n, topicOn, 'topic') + tocMore('t', tp.id) + DRAG + '</div>';
    const showSubs = exp || (ui.edit && tp.id === ui.topic);
    if(showSubs){
      h += '<ul class="toc-subs">';
      const folded = new Set();
      vis.forEach(s => {
        if(s.parent && (folded.has(s.parent) || tocClosedSet.has(s.parent))){ folded.add(s.id); return; }
        const kn = (IDX.kids[s.id] || []).length, open = kn && !tocClosedSet.has(s.id);
        h += '<li class="toc-sub" draggable="true" title="Drag to move · right-click for more" style="--d:' + (IDX.depth[s.id] || 0) + '"' + (' data-node="s:' + s.id + '"') + '>' +
          (kn ? '<button type="button" class="toc-caret sub" data-toc-toggle="' + s.id + '" aria-expanded="' + !!open + '" aria-label="' + (open ? 'Collapse “' : 'Expand “') + esc(s.name) + '”">' + CARET + '</button>' : '') +
          tocLink(s.id, s.name, subCountDeep(s), s.id === ui.sub) + tocMore('s', s.id) + DRAG + '</li>';
      });
      if(vis.length > 1) h += '<li>' + tocLink(tp.id + '-all', 'All (by year)', n, tp.id === ui.topic && !ui.sub, 'all') + '</li>';
      h += '</ul>';
    }
    h += '</li>';
  });
  h += '</ul>';
  h += '<div class="toc-add" data-node="e:end"><button type="button" class="toc-link add" data-act="new-topic">+ New topic</button></div>';
  tocBody.innerHTML = h;
  if(focusSel){ const f = tocBody.querySelector(focusSel); if(f) f.focus({preventScroll:true}); }
  const tp = IDX.topics[ui.topic], s = ui.sub ? IDX.subs[ui.sub] : null;
  const crumb = document.getElementById('crumb');
  if(ui.page === 'concepts'){ crumb.innerHTML = '<span class="crumb-top">Concepts</span>'; mainEl.setAttribute('aria-label', 'Concepts'); }
  else if(tp){
    const path = s ? (s.hidden ? [] : subPath(s)) : ['All'];
    const tail = path.length ? path[path.length - 1] : '';
    crumb.innerHTML = '<span class="crumb-top' + (tail ? ' has-tail' : '') + '">' + esc(tp.name) + '</span>' +
      path.slice(0, -1).map(m => '<span class="sep crumb-mid">/</span><span class="crumb-mid">' + esc(m) + '</span>').join('') +
      (tail ? '<span class="sep">/</span><span class="crumb-tail">' + esc(tail) + '</span>' : '');
    mainEl.setAttribute('aria-label', [tp.name].concat(path).join(' / '));
  }else crumb.textContent = '';
  const labels = document.getElementById('mapLabels');
  labels.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x.dataset.view === ui.sub));
  renderProgress();
}
function isWide(){ return window.innerWidth >= 1000; }
function tocIsOpen(){ return document.body.classList.contains('toc-open'); }
function setToc(open, persist){
  document.body.classList.toggle('toc-open', open);
  if('inert' in tocEl) tocEl.inert = !open;
  tocEl.setAttribute('aria-hidden', String(!open));
  document.getElementById('tocToggle').setAttribute('aria-expanded', String(open));
  document.getElementById('tocBackdrop').hidden = !(open && !isWide());
  if(persist && isWide()){ settings.toc = open ? 'open' : 'closed'; persistSettings({remote:false}); }
}
function renderProgress(){
  const tp = IDX.topics[ui.topic];
  if(!tp) return;
  const es = topicEntries(tp.id).filter(e => e.kind === 'paper');
  const keys = Array.from(new Set(es.map(keyOf)));
  const read = keys.filter(k => status[k] === 'read').length;
  const want = keys.filter(k => status[k] === 'want').length;
  document.getElementById('progress').textContent = 'This topic: ' + read + ' / ' + keys.length + ' read, ' + want + ' want to read';
}
