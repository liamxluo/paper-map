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

/* ===================== the map page, as confirmed: the map on its sheet, two small bars and the card =====================
   It works through the app's own buttons and panels, which stay out of sight; the old page is gone. */
const ATL_IC = {"back": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M15 18l-6-6 6-6\"/></svg>", "layers": "<svg class=\"ic \" width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3 3 7.5l9 4.5 9-4.5L12 3z\"/><path d=\"M3 16.5l9 4.5 9-4.5M3 12l9 4.5 9-4.5\"/></svg>", "chev": "<svg class=\"ic \" width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M6 9l6 6 6-6\"/></svg>", "search": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"M20 20l-3.6-3.6\"/></svg>", "add": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"/></svg>", "filter": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 6h16M7 12h10M10 18h4\"/></svg>", "years": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15.5\" rx=\"2.5\"/><path d=\"M8 3v4M16 3v4M3.5 10h17\"/></svg>", "export": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3v12M8 7l4-4 4 4\"/><path d=\"M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13\"/></svg>", "sync": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M17.5 19H8a6 6 0 1 1 5.6-8.2A4.5 4.5 0 1 1 17.5 19z\"/><path d=\"M9.5 14l2 2 3.5-3.5\"/></svg>", "look": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>", "target": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"6.5\"/><circle cx=\"12\" cy=\"12\" r=\"1.6\" fill=\"currentColor\"/><path d=\"M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3\"/></svg>", "doc": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5z\"/><path d=\"M13.5 3.5V8h4.5M9.5 12h5M9.5 15.5h5\"/></svg>", "link": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.2 1.2\"/><path d=\"M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.2-1.2\"/></svg>", "more": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"6\" cy=\"12\" r=\"1.3\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"12\" r=\"1.3\" fill=\"currentColor\"/><circle cx=\"18\" cy=\"12\" r=\"1.3\" fill=\"currentColor\"/></svg>"};
function atlasWood(){ const w = ((settings && settings.desk) || {}).wood || 'mahogany', p = ((settings && settings.desk) || {}).paper === 'smooth' ? 'smooth' : 'creased';
  document.documentElement.style.setProperty('--atl-wood', 'url(assets/desk/bg-' + w + '.webp)');
  document.documentElement.style.setProperty('--atl-hl', 'url(assets/desk/light-' + p + '-hl.webp)');
  document.documentElement.style.setProperty('--atl-mul', 'url(assets/desk/light-' + p + '-mul.webp)'); }
function atlasUI(){
  if(document.getElementById('atlLeft')) return;
  const mk = (tag, id, cls, html) => { const el = document.createElement(tag); if(id) el.id = id; if(cls) el.className = cls; if(html != null) el.innerHTML = html; return el; };
  const B = (a, label, ic) => '<button type="button" class="atl-i" data-atl="' + a + '" aria-label="' + label + '" title="' + label + '">' + ic + '</button>';
  const sheet = mk('div', 'atlSheet', 'atl-sheet', '');
  const left = mk('div', 'atlLeft', 'atl-pill', '<button type="button" class="atl-i" data-atl="back" aria-label="Back to your maps" title="Back to your maps">' + ATL_IC.back + '</button><span class="atl-sep"></span><span class="atl-lay" aria-hidden="true">' + ATL_IC.layers + '</span><button type="button" class="atl-name" data-atl="maps" aria-haspopup="true" aria-expanded="false"><span id="atlNameT"></span>' + ATL_IC.chev + '</button>');
  const maps = mk('div', 'atlMaps', 'atl-menu', ''); maps.hidden = true;
  const right = mk('div', 'atlRight', 'atl-pill', B('search', 'Search', ATL_IC.search) + B('add', 'New paper', ATL_IC.add) + B('filter', 'Filters', ATL_IC.filter) + B('years', 'Years', ATL_IC.years) + B('export', 'Export', ATL_IC.export) + '<span class="atl-sep"></span>' + B('sync', 'Sync', ATL_IC.sync) + B('settings', 'Settings', ATL_IC.look));
  const title = mk('div', 'atlTitle', 'atl-title', '');
  const foot = mk('div', 'atlFoot', 'atl-foot', '');
  const hint = mk('div', 'atlHint', 'atl-hint', 'Double-click a dot to link it · L for Lens');
  const pop = mk('div', 'atlPop', 'atl-pop', '');
  document.body.prepend(sheet); document.body.append(left, maps, right, title, foot, hint, pop);
  ['addMenu', 'exportMenu', 'zoomTools'].forEach(id => { const el = document.getElementById(id); if(el) pop.appendChild(el); });
  const up = document.getElementById('undoPill'); if(up) document.body.appendChild(up);
  const fl = document.getElementById('filters'); if(fl) document.body.appendChild(fl);   /* the filters lived inside the old bar */
  const click = id => { const el = document.getElementById(id); if(el) el.click(); };
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-atl]');
    if(!b){ if(!ev.target.closest('#atlMaps')) { maps.hidden = true; } return; }
    ev.stopPropagation(); ev.preventDefault();
    const a = b.dataset.atl; if(a !== 'maps') maps.hidden = true;
    if(a === 'back') deskOpen();
    else if(a === 'maps'){ atlasMaps(); maps.hidden = !maps.hidden; b.setAttribute('aria-expanded', String(!maps.hidden)); }
    else if(a === 'search'){ const fr = document.getElementById('filters'); if(fr && !fr.classList.contains('open')) click('filterToggle'); const q = document.getElementById('q'); [60, 220].forEach(ms => setTimeout(() => { if(q){ q.focus(); q.select(); } }, ms)); }
    else if(a === 'add') click('btnAddMore');
    else if(a === 'filter') click('filterToggle');
    else if(a === 'years') click('btnZoom');
    else if(a === 'export') click('btnExport');
    else if(a === 'sync' || a === 'settings') click('btnSettings');
  }, true);
  maps.addEventListener('click', ev => { const t = ev.target.closest('[data-atl-map]'), c = ev.target.closest('[data-atl-contents]'), n = ev.target.closest('[data-atl-new]');
    if(!t && !c && !n) return; maps.hidden = true;
    if(t){ deskTouchRecent(t.dataset.atlMap); try{ if(ui.selected) select(null); }catch(e){} openView(t.dataset.atlMap + '-all'); }
    else if(c) setToc(true); else if(n) openTopicForm(); });
  /* the cloud says how saving is going */
  const ss = document.querySelector('.bar [data-save-state]');
  const syncNote = () => { const t = ss ? ss.textContent.trim() : '', btn = right.querySelector('[data-atl="sync"]');
    btn.title = t || 'Sync: Settings'; btn.classList.toggle('warn', /saving|wait|unsaved|not saved|changes/i.test(t)); btn.classList.toggle('bad', /fail|couldn|error|offline|expired/i.test(t)); btn.classList.toggle('local', /browser only|this app only/i.test(t)); };
  if(ss && 'MutationObserver' in window) new MutationObserver(syncNote).observe(ss, {childList: true, characterData: true, subtree: true});
  syncNote(); atlasWood(); atlasTitle();
}
function atlasMaps(){
  const box = document.getElementById('atlMaps');
  const n = tid => Object.values(lib.entries).filter(e => e.kind === 'paper' && e.topic === tid).length;
  box.innerHTML = '<p class="atl-mk">YOUR MAPS</p>' + lib.topics.map(t => '<button type="button" data-atl-map="' + esc(t.id) + '"' + (t.id === ui.topic ? ' class="on"' : '') + '><b>' + esc(t.name) + '</b><span>' + n(t.id) + (n(t.id) === 1 ? ' paper' : ' papers') + '</span></button>').join('') +
    '<div class="atl-ms"></div><button type="button" data-atl-contents="1"><b>Contents</b><span>topics inside this map, and their order</span></button><button type="button" data-atl-new="1"><b>+ New map</b><span>for another field</span></button>';
}
function atlasTitle(){
  const T = document.getElementById('atlTitle'); if(!T) return;
  const tp = lib.topics.find(t => t.id === ui.topic);
  const ps = Object.values(lib.entries).filter(e => e.kind === 'paper' && (!tp || e.topic === tp.id) && typeof e.y === 'number');
  const ys = ps.map(e => e.y), n = lib.topics.length;
  T.innerHTML = '<h2>' + esc((tp ? tp.name : (lib.title || 'Paper Map')).toUpperCase()) + '</h2><p>' + ps.length + (ps.length === 1 ? ' paper' : ' papers') + (ys.length ? ' · ' + Math.min(...ys) + ' – ' + Math.max(...ys) : '') + ' · one of ' + n + (n === 1 ? ' map' : ' maps') + '</p><i></i>';
  const nm = document.getElementById('atlNameT'); if(nm) nm.textContent = tp ? tp.name : 'All maps';
  const F = document.getElementById('atlFoot');
  if(F){ const br = (lib.branches || []).filter(b => !b.hidden);
    F.innerHTML = '<span><i class="lg-l"></i>builds on</span><span><i class="lg-l dash"></i>responds to</span><span><i class="lg-l dot"></i>related to</span>' +
      (br.length ? br.map(b => '<span class="lg-br" data-branch-manage="1" title="Colour lines"><i class="lg-l" style="border-color:' + esc(b.color || '#B4432E') + '"></i>' + esc(b.name || 'main line') + '</span>').join('') : '<span><i class="lg-l main"></i>main line</span>') +
      '<span><i class="lg-d read"></i>read</span><span><i class="lg-d want"></i>want to read</span>'; }
}
/* the card, as confirmed: where and when, the title, who; read or not; Lens, notes, the paper, more; how far */
function atlasCardHTML(e){
  const st = stOf(e), up = (IDX.up[e.id] || []).length, down = (IDX.down[e.id] || []).length;
  const doi = e.d ? String(e.d).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : '', url = /^https?:\/\//.test(e.l || '') ? e.l : (doi ? 'https://doi.org/' + doi : '');
  const D = [[1, '1'], [2, '2'], [3, '3'], ['all', 'All']];
  return '<div class="acard ' + stClass(e) + '">' +
    '<p class="ac-k">' + esc([e.y, e.v].filter(Boolean).join(' · ')) + '</p>' +
    '<h3 class="ac-t" data-open-card="' + e.id + '" tabindex="0" role="button">' + esc(e.t) + '</h3>' +
    (e.au ? '<p class="ac-a">' + esc(e.au) + '</p>' : '') +
    '<div class="ac-row"><span class="ac-st"><button type="button" class="stbtn want" data-st="want" data-id="' + e.id + '" aria-pressed="' + (st === 'want') + '">Want to read</button><button type="button" class="stbtn read" data-st="read" data-id="' + e.id + '" aria-pressed="' + (st === 'read') + '">Read</button></span>' +
    '<span class="ac-ic"><button type="button" class="ac-b" data-open-lens="' + e.id + '" title="Lens: its line of thought (L)" aria-label="Lens">' + ATL_IC.target + '</button><button type="button" class="ac-b" data-reader="' + e.id + '" title="Notes and PDF" aria-label="Notes and PDF">' + ATL_IC.doc + '</button>' +
    (url ? '<a class="ac-b" href="' + esc(url) + '" target="_blank" rel="noopener" title="Open the paper" aria-label="Open the paper">' + ATL_IC.link + '</a>' : '') +
    '<button type="button" class="ac-b" data-open-card="' + e.id + '" title="The whole card" aria-label="More">' + ATL_IC.more + '</button></span></div>' +
    '<div class="ac-hf"><span class="ac-hk">How far</span>' + D.map(o => '<button type="button" class="ac-d' + (String(ui.depth) === String(o[0]) ? ' on' : '') + '" data-depth="' + o[0] + '">' + o[1] + '</button>').join('') +
    '<span class="ac-n">' + up + ' before · ' + down + ' after</span></div></div>' + citesHintHTML(e);
}

window.__pmAtlasCard = atlasCardHTML;
/* the map page: full window wherever there is room for it (not on a phone held upright) */
function atlasFollow(){ const on = true, was = document.documentElement.classList.contains('atlas'); document.documentElement.classList.toggle('atlas', on); if(on && !was) setToc(false); if(on !== was){ try{ renderMap(true); }catch(e){} } }
/* on the map page a map is a field: opening one shows that field's rows (Topics on the map can add others) */
function atlasLanes(){ if(!document.documentElement.classList.contains('atlas') || !ui.topic) return; const tp = lib.topics.find(t => t.id === ui.topic); if(!tp) return;
  const want = tp.subs.map(s => s.id), cur = Array.isArray(settings.lanes) ? settings.lanes : null;
  if(cur && cur.length === want.length && want.every(x => cur.includes(x))) return;
  settings.lanes = want; persistSettings(); try{ const se = ui.selected && lib.entries[ui.selected]; if(se && se.topic !== tp.id) select(null); renderMap(true); }catch(e){} }
{ const _ov = openView; openView = function(){ const r = _ov.apply(this, arguments); try{ atlasLanes(); atlasTitle(); }catch(e){} return r; }; }
window.addEventListener('hashchange', () => setTimeout(() => { try{ atlasLanes(); }catch(e){} }, 0));
window.addEventListener('resize', atlasFollow); atlasFollow(); setToc(false); atlasUI(); setTimeout(atlasLanes, 0);
{ const _ra2 = renderAll; renderAll = function(){ _ra2(); try{ atlasTitle(); atlasWood(); }catch(e){} }; }
window.addEventListener('hashchange', () => setTimeout(() => { try{ atlasTitle(); }catch(e){} }, 0));
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