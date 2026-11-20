/* ===================== the desk =====================
   The front of Paper Map: your maps folded on a desk, your papers, your Readings and a research log.
   It is a page of its own (an iframe from srcdoc, same origin) that reads and saves through window.pmDesk. */
const DESK_SRC = __DESK_SRC__;
const DK = {frame: null, ready: false, shown: false, wantShow: false, fromTopic: null};
function deskPrefs(){ return Object.assign({wood: 'mahogany', paper: 'creased', cup: 'espresso', start: 'desk'}, (settings && settings.desk) || {}); }
function deskRecent(){ try{ const r = JSON.parse(localStorage.getItem('pm:recent') || '[]'); return Array.isArray(r) ? r.filter(x => x && typeof x.id === 'string') : []; }catch(e){ return []; } }
function deskTouchRecent(tid){ if(!tid || PREVIEW) return; const r = deskRecent().filter(x => x.id !== tid); r.unshift({id: tid, t: Date.now()}); try{ localStorage.setItem('pm:recent', JSON.stringify(r.slice(0, 40))); }catch(e){} }
function deskAuthors(list){ const fam = (list || []).map(a => { a = String(a).trim(); if(a.includes(',')) return a; const p = a.split(/\s+/); return p.length > 1 ? p[p.length - 1] + ', ' + p.slice(0, -1).join(' ') : a; }); return fam.length > 1 ? fam.slice(0, -1).join(', ') + ' & ' + fam[fam.length - 1] : (fam[0] || ''); }
window.pmDesk = {
  data(){
    const topics = (lib.topics || []).map(tp => ({id: tp.id, name: tp.name, rows: (tp.subs || []).map(s => ({id: s.id, name: s.hidden ? tp.name : s.name}))}));
    const papers = Object.values(lib.entries).filter(e => e.kind === 'paper').map(e => ({id: e.id, t: e.t || '', au: e.au || '', y: e.y, v: e.v || '', topic: e.topic, sub: e.sub, st: stOf(e), book: !!e.book}));
    const rec = deskRecent(), times = {}; rec.forEach(x => { times[x.id] = x.t; });
    return {title: (lib.title && String(lib.title).trim()) || 'Paper Map', topics, papers, links: (lib.links || []).filter(l => l[2] !== 'o').map(l => [l[0], l[1], l[2]]), branches: clone(lib.branches || []), lineBranch: clone(lib.lineBranch || {}),
      readings: clone(lib.readings || []), readingCats: clone(lib.readingCats || []), notebooks: clone(lib.notebooks || []), prefs: deskPrefs(), recent: rec.map(x => x.id), recentTimes: times, preview: !!PREVIEW};
  },
  ready(){ DK.ready = true; },
  openMap(tid){ if(!lib.topics.some(t => t.id === tid)) return; deskTouchRecent(tid); DK.fromTopic = tid; try{ setToc(false); }catch(e){} openView(tid + '-all'); setTimeout(deskHide, 40); },
  openPaper(id, from){ const e = lib.entries[id]; if(!e) return; deskTouchRecent(e.topic); DK.fromTopic = e.topic; DK.from = from === 'paper' ? 'paper:' + id : 'papers'; deskHide(); setTimeout(() => { goTo(id); try{ select(id, true); }catch(err){} }, 90); },
  newMap(){ deskHide(); setTimeout(() => openTopicForm(), 140); },
  paper(id){ const e = lib.entries[id]; if(!e || e.kind !== 'paper') return null;
    const brief = x => { const o = lib.entries[x]; return o ? {id: o.id, t: o.t || 'Untitled', au: o.au || '', y: o.y} : null; };
    const up = k => (lib.links || []).filter(l => l[1] === id && l[2] === k).map(l => brief(l[0])).filter(Boolean);
    const down = k => (lib.links || []).filter(l => l[0] === id && l[2] === k).map(l => brief(l[1])).filter(Boolean);
    const rel = (lib.links || []).filter(l => l[2] === 'r' && (l[0] === id || l[1] === id)).map(l => brief(l[0] === id ? l[1] : l[0])).filter(Boolean);
    const laneName = x => { for(const t of lib.topics){ if(t.id === x) return t.name; for(const s of (t.subs || [])) if(s.id === x) return s.hidden ? t.name : t.name + ' / ' + s.name; } return ''; };
    const doi = e.d ? String(e.d).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : '';
    return {id, t: e.t || '', au: e.au || '', y: e.y, v: e.v || '', n: e.n || '', st: stOf(e) || '', pri: (PRIO_LABEL[e.p] || '').replace(/^\S+\s/, ''), book: !!e.book,
      tags: (e.tags || []).map(t => (lib.tags.find(x => x.id === t) || {}).name).filter(Boolean), where: laneName(e.sub) || laneName(e.topic),
      url: /^https?:\/\//.test(e.l || '') ? e.l : (doi ? 'https://doi.org/' + doi : ''),
      buildsOn: up('b'), builtOnBy: down('b'), respondsTo: up('c'), challengedBy: down('c'), related: rel, mentions: (e.mentions || []).map(laneName).filter(Boolean)}; },
  setStatus(id, st){ const e = lib.entries[id]; if(!e || PREVIEW) return; const cur = stOf(e) || ''; if(cur === (st || '')) return; toggleStatus(id, st || cur); },
  openNotes(id){ if(!lib.entries[id]) return; DK.fromTopic = lib.entries[id].topic; DK.from = 'paper:' + id; deskHide(); setTimeout(() => { try{ openReader(id); }catch(err){} }, 140); },
  openLink(url){ if(/^https?:\/\//.test(String(url || ''))) window.open(url, '_blank', 'noopener'); },
  newPaper(tid){ deskHide(); setTimeout(() => { if(tid && lib.topics.some(t => t.id === tid)){ DK.fromTopic = tid; openView(tid + '-all'); } openEntryForm(null); }, 140); },
  openSettings(){ deskHide(); setTimeout(() => openSettings(), 140); },
  savePrefs(p){ settings.desk = Object.assign({}, deskPrefs(), p || {}); persistSettings(); },
  saveReadings(r, cats){ if(PREVIEW) return; lib.readings = clone(r || []); lib.readingCats = clone(cats || []); normalizeLib(lib);
    /* a book put on a map follows its Readings entry: title, authors and year */
    const byId = {}; lib.readings.forEach(b => { byId[b.id] = b; }); let moved = false;
    Object.values(lib.entries).forEach(e => { const b = e.book && e.reading && byId[e.reading]; if(!b) return;
      const au = deskAuthors(b.authors), y = parseInt(b.year, 10), t = String(b.title || e.t);
      if(e.t !== t || e.au !== au || (isFinite(y) && y > 0 && e.y !== y)){ e.t = t; e.au = au; if(isFinite(y) && y > 0) e.y = y; moved = true; } });
    touchLib(); if(moved) renderAll(); },
  saveNotebooks(nbs){ if(PREVIEW) return; lib.notebooks = clone(nbs || []); normalizeLib(lib); touchLib(); },
  addBookToMap(b, tid){
    if(PREVIEW){ toast('This is the example: open your own list to put books on a map'); return null; }
    const tp = lib.topics.find(t => t.id === tid); if(!tp || !b) return null;
    const own = (tp.subs || []).find(s => s.hidden) || (tp.subs || [])[0]; if(!own) return null;
    let id; do{ id = rid('e'); }while(lib.entries[id]);
    const y = parseInt(b.year, 10);
    lib.entries[id] = {id, kind: 'paper', topic: tp.id, sub: own.id, group: '', y: isFinite(y) && y > 0 ? y : new Date().getFullYear(), au: deskAuthors(b.authors), t: String(b.title || 'Untitled'), v: 'Book', l: '', p: 2, tags: [], mentions: [], book: true, reading: String(b.id || '')};
    const k = keyOf(lib.entries[id]);
    if(b.status === 'read' || b.status === 'want'){ status[k] = b.status; statusTime = Date.now(); persistStatus(); }
    touchLib(); renderAll();
    return id;
  }
};
function deskEnsure(){
  if(DK.frame) return DK.frame;
  const f = document.createElement('iframe'); f.id = 'pmDesk'; f.title = 'Paper Map desk'; f.srcdoc = DESK_SRC;
  document.body.appendChild(f); DK.frame = f; return f;
}
function deskPage(){ try{ return DK.frame && DK.frame.contentWindow && DK.frame.contentWindow.pmDeskPage; }catch(e){ return null; } }
function deskShowFrame(instant){ const f = deskEnsure(); requestAnimationFrame(() => document.documentElement.classList.remove('desk-boot')); if(instant){ f.classList.add('instant'); void f.offsetWidth; }
  f.classList.add('on'); DK.shown = true; document.documentElement.classList.add('desk-on');
  if(instant) requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('instant')));
  setTimeout(() => { try{ f.focus(); f.contentWindow.focus(); }catch(e){} }, 60); }
function deskHide(){ if(!DK.frame) return; DK.frame.classList.remove('on'); DK.shown = false; document.documentElement.classList.remove('desk-on', 'desk-boot'); try{ DK.frame.blur(); window.focus(); }catch(e){} }
/* the Desk button: back from a map, the map folds up again; from anywhere else, the desk */
async function deskOpen(){
  deskEnsure();
  for(let i = 0; i < 60 && !(DK.ready && deskPage()); i++) await sleep(50);
  const page = deskPage(); if(!page){ deskShowFrame(); return; }
  const from = DK.from; DK.from = null;
  if(from === 'papers'){ page.show('papers'); deskShowFrame(); DK.fromTopic = null; return; }
  if(from && from.indexOf('paper:') === 0){ try{ closeReader(); }catch(e){} page.show('paper', from.slice(6)); deskShowFrame(); DK.fromTopic = null; return; }
  const tid = ui.topic && lib.topics.some(t => t.id === ui.topic) ? ui.topic : null;
  if(tid){ deskTouchRecent(tid); deskShowFrame(true); page.returnFromMap(tid); }
  else { page.show(); deskShowFrame(); }
  DK.fromTopic = null;
}
document.getElementById('btnDesk').addEventListener('click', deskOpen);
/* the map page: full window wherever there is room for it (not on a phone held upright) */
function atlasFollow(){ const on = window.innerWidth > 760, was = document.documentElement.classList.contains('atlas'); document.documentElement.classList.toggle('atlas', on); if(on && !was) setToc(false); if(on !== was){ try{ renderMap(true); }catch(e){} } }
/* on the map page a map is a field: opening one shows that field's rows (Topics on the map can add others) */
function atlasLanes(){ if(!document.documentElement.classList.contains('atlas') || !ui.topic) return; const tp = lib.topics.find(t => t.id === ui.topic); if(!tp) return;
  const want = tp.subs.map(s => s.id), cur = Array.isArray(settings.lanes) ? settings.lanes : null;
  if(cur && cur.length === want.length && want.every(x => cur.includes(x))) return;
  settings.lanes = want; persistSettings(); try{ renderMap(true); }catch(e){} }
{ const _ov = openView; openView = function(){ const r = _ov.apply(this, arguments); try{ atlasLanes(); }catch(e){} return r; }; }
window.addEventListener('hashchange', () => setTimeout(() => { try{ atlasLanes(); }catch(e){} }, 0));
window.addEventListener('resize', atlasFollow); atlasFollow(); if(document.documentElement.classList.contains('atlas')){ setToc(false); setTimeout(atlasLanes, 0); }
{ const _om = openModal, _cm = closeModal;
  openModal = function(){ if(DK.shown){ DK.modalHid = true; deskHide(); } return _om.apply(this, arguments); };
  closeModal = function(){ const r = _cm.apply(this, arguments); if(DK.modalHid){ DK.modalHid = false; const page = deskPage(); if(page){ page.show(); deskShowFrame(); } } return r; }; }
{ const _renderAll = renderAll; renderAll = function(){ _renderAll(); const page = DK.shown && deskPage(); if(page) try{ page.refresh(); }catch(e){} }; }
/* when Paper Map opens: the desk first, unless a link asked for something else or you chose the last map */
{ const asked = location.hash.length > 1 || /[?&](add|title|app)=?/.test(location.search) && /[?&](add|title)=/.test(location.search);
  if(!asked && (PREVIEW || deskPrefs().start !== 'map')){ deskEnsure(); deskShowFrame(true); }
  else { document.documentElement.classList.remove('desk-boot'); if(!asked && !PREVIEW){ const last = deskRecent().map(x => x.id).find(id => lib.topics.some(t => t.id === id)); if(last) openView(last + '-all'); } } }

const reTheme = () => { renderMain(); renderMap(true); refreshInfo(); applyFocus(ui.selected); };
if(window.matchMedia){ const mq = window.matchMedia('(prefers-color-scheme: dark)'); if(mq.addEventListener) mq.addEventListener('change', reTheme); }
if('MutationObserver' in window) new MutationObserver(reTheme).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
document.addEventListener('visibilitychange', () => {
  const c = ghCfg(); if(!c) return;
  if(document.visibilityState === 'hidden'){ if(c.dirty && !gh.busy) ghSave(); }
  else if(!c.dirty && !gh.busy && modal.root.hidden) ghLoad();
});
window.addEventListener('beforeunload', ev => {
  const c = ghCfg();
  if(c && (c.dirty || gh.busy)){ ev.preventDefault(); ev.returnValue = ''; }
});
})();
})();