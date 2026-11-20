/* ===================== status ===================== */
function toggleStatus(id, st){
  const e = lib.entries[id];
  if(!e) return;
  const k = keyOf(e);
  if(status[k] === st) delete status[k]; else status[k] = st;
  statusTime = Date.now();
  if(status[k] === 'read') setTimeout(() => readReminder(id), 0);
  persistStatus();
  renderTabs();
  renderMain();
  renderMap(true);
  refreshInfo();
}


/* reading reminder: when you mark a paper Read, Paper Map asks Crossref what it cites and makes the cited papers
   on your map glow (those not linked to it yet). Nothing is linked for you. It always says what it found. */
function refTitleKey(s){ return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').trim(); }
async function crossrefWork(e){
  if(e.doi){
    const r = await fetch('https://api.crossref.org/works/' + encodeURIComponent(String(e.doi).trim()));
    if(r.ok) return ((await r.json()) || {}).message || null;
    if(r.status !== 404) throw new Error('crossref ' + r.status);
  }
  /* no DOI (or an unknown one): look the paper up by title and first author, and trust only the same title */
  if(!e.t) return null;
  const q = [e.t, String(e.au || '').split(/[,;&]| and /)[0]].join(' ');
  const r = await fetch('https://api.crossref.org/works?rows=5&select=DOI,title,issued,reference&query.bibliographic=' + encodeURIComponent(q));
  if(!r.ok) throw new Error('crossref ' + r.status);
  const items = (((await r.json()) || {}).message || {}).items || [], want = refTitleKey(e.t);
  return items.find(it => { const y = ((it.issued || {})['date-parts'] || [[0]])[0][0]; return refTitleKey((it.title || [])[0]) === want && (!e.y || !y || Math.abs(y - e.y) <= 1); }) || null;
}
async function citesOnMap(e){
  const w = await crossrefWork(e);
  if(!w) return {state: 'unknown'};
  const refs = w.reference || [];
  if(!refs.length) return {state: 'norefs'};
  const byDoi = {}, byTitle = [];
  Object.values(lib.entries).forEach(x => { if(x.kind !== 'paper' || x.id === e.id) return; if(x.doi) byDoi[String(x.doi).trim().toLowerCase()] = x.id; const nt = refTitleKey(x.t); if(nt.length >= 10) byTitle.push([nt, x.id, x.y]); });
  const found = new Set();
  refs.forEach(rf => {
    const d = rf.DOI && byDoi[String(rf.DOI).trim().toLowerCase()]; if(d){ found.add(d); return; }
    const hay = refTitleKey([rf['article-title'], rf['volume-title'], rf['series-title'], rf.unstructured].filter(Boolean).join(' '));
    if(!hay) return;
    byTitle.forEach(([nt, id, y]) => { const ry = parseInt(rf.year, 10); if(hay.includes(nt) && (!ry || !y || Math.abs(ry - y) <= 1)) found.add(id); });
  });
  const ids = [...found].filter(id => !lib.links.some(l => (l[0] === id && l[1] === e.id) || (l[0] === e.id && l[1] === id)));
  return {state: 'ok', ids, all: found.size, doi: w.DOI || ''};
}
function applyHintGlow(){
  const g = ui.hintGlow;
  mapSvg.querySelectorAll('.node.hint-glow').forEach(n => n.classList.remove('hint-glow')); mapSvg.querySelectorAll('.hint-ring').forEach(n => n.remove());
  if(!g || Date.now() > g.until) return;
  g.ids.forEach(id => { const n = mapSvg.querySelector('.node[data-id="' + id + '"]'), c = n && n.querySelector('circle.dot'); if(!n || !c) return; n.classList.add('hint-glow');
    n.insertAdjacentHTML('afterbegin', '<circle class="hint-ring" cx="' + c.getAttribute('cx') + '" cy="' + c.getAttribute('cy') + '" r="' + (+c.getAttribute('r') + 5).toFixed(1) + '"></circle>'); });
}
async function readReminder(id){
  const e = lib.entries[id]; if(!e || e.kind !== 'paper' || settings.readHints === false) return;
  const name = '“' + mapTitle(e) + '”';
  let res;
  try{ res = await citesOnMap(e); }catch(err){ toast('Couldn’t check what ' + name + ' cites: Crossref can’t be reached right now.'); return; }
  if(stOf(e) !== 'read') return;
  if(res.state === 'unknown'){ toast('Couldn’t find ' + name + ' in Crossref' + (e.doi ? '' : '. Add its DOI to see what it cites') + '.'); return; }
  if(res.state === 'norefs'){ toast('Crossref has no list of what ' + name + ' cites.'); return; }
  if(!res.ids.length){ toast(res.all ? 'Everything ' + name + ' cites on your map is already linked to it.' : name + ' cites none of the papers on your map yet.'); return; }
  ui.hintGlow = {ids: res.ids, until: Date.now() + 60000, from: id}; applyHintGlow(); refreshInfo(); setTimeout(() => { applyHintGlow(); refreshInfo(); }, 60100);
  toast(name + ' cites ' + res.ids.length + (res.ids.length === 1 ? ' paper' : ' papers') + ' on your map, not linked yet: ' + (res.ids.length === 1 ? 'it is' : 'they are') + ' glowing. Double-click a dot to link it.');
}
/* under the paper's card while the reminder lasts: the papers it cites, to open with a click */
function citesHintHTML(e){
  const g = ui.hintGlow; if(!g || g.from !== e.id || Date.now() > g.until) return '';
  const xs = g.ids.map(id => lib.entries[id]).filter(Boolean); if(!xs.length) return '';
  return '<p class="cites-hint"><span class="hint">It cites, on your map:</span> ' + xs.map(x => '<button type="button" class="relchip" data-select="' + x.id + '">' + esc(mapTitle(x)) + ' <span class="hint">' + esc(x.y) + '</span></button>').join('') + '</p>';
}

/* the “+ Paper Map” bookmarklet opens New paper here with the page's DOI and title filled in; you still choose where it goes and press Save */
function bookmarkletHref(){
  const app = location.href.split('#')[0].split('?')[0];
  const code = "(function(){var m=document.querySelectorAll('meta'),g=function(n){for(var i=0;i<m.length;i++){var a=(m[i].getAttribute('name')||m[i].getAttribute('property')||'').toLowerCase();if(a===n)return m[i].getAttribute('content')||''}return''};" +
    "var d=g('citation_doi')||g('dc.identifier')||g('prism.doi')||'';if(!/10\\.\\d{4,9}\\//.test(d)){var x=(document.body.innerText.match(/10\\.\\d{4,9}\\/[^\\s\"<>]+/)||[''])[0];d=x||d}" +
    "var t=g('citation_title')||document.title;window.open('" + app + "?app&add='+encodeURIComponent(d)+'&title='+encodeURIComponent(t)+'&from='+encodeURIComponent(location.href),'_blank')})();";
  return 'javascript:' + code;
}
function bookmarkletSaved(){ if(!ui.fromBookmarklet) return; ui.fromBookmarklet = false; setTimeout(() => toast('Saved to your Paper Map. You can close this tab; the app has it too.'), 300); }
function handleAddParam(){
  let q; try{ q = new URLSearchParams(location.search); }catch(e){ return; }
  if(!q.has('add') && !q.has('title')) return;
  const doi = q.get('add') || '', title = q.get('title') || '';
  try{ const u = location.pathname + '?app' + location.hash; history.replaceState(null, '', u); }catch(e){}
  ui.fromBookmarklet = true;
  openEntryForm(null);
  setTimeout(() => {
    const b = document.getElementById('modalBody'); if(!b) return;
    const f = b.querySelector('#fDoi'), tt = b.querySelector('[name=t]');
    if(tt && title) tt.value = title.slice(0, 300);
    if(f && doi){ f.value = doi; const go = b.querySelector('#doiFill'); if(go) go.click(); }
  }, 60);
}

setTimeout(() => { try{ handleAddParam(); }catch(e){} }, 900);
/* another window of Paper Map (the app, or a tab opened by the bookmarklet) changed the list: take its version */
window.addEventListener('storage', ev => {
  if(PREVIEW || !ev.key || ev.newValue == null) return;
  try{
    if(ev.key === LS.lib){ const L = JSON.parse(ev.newValue); if(!validLib(L)) return; lib = normalizeLib(L); reindex(); renderAll(); if(ui.selected && !lib.entries[ui.selected]) select(null); toast('Updated from another Paper Map window'); }
    else if(ev.key === LS.status){ const S = JSON.parse(ev.newValue); if(S && S.map){ status = S.map; statusTime = S.updatedAt || 0; renderAll(); } }
  }catch(e){}
});
/* when Chrome opens a bookmarklet link in the installed app, it arrives here */
if('launchQueue' in window && window.launchQueue && typeof window.launchQueue.setConsumer === 'function'){
  window.launchQueue.setConsumer(p => { try{ if(p && p.targetURL){ const u = new URL(p.targetURL); if(u.searchParams.has('add') || u.searchParams.has('title')){ history.replaceState(null, '', u.pathname + u.search + u.hash); handleAddParam(); } } }catch(e){} });
}