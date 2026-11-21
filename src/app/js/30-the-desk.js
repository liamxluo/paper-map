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
    const topics = (lib.topics || []).map(tp => ({id: tp.id, name: tp.name, shelf: !!tp.shelf, cover: tp.cover || null, rows: (tp.subs || []).map(s => ({id: s.id, name: s.hidden ? tp.name : s.name, parent: s.parent || null, own: !!s.hidden}))}));
    const papers = Object.values(lib.entries).filter(e => e.kind === 'paper').map(e => ({id: e.id, t: e.t || '', au: e.au || '', y: e.y, v: e.v || '', topic: e.topic, sub: e.sub, st: stOf(e), book: !!e.book, pdf: !!e.pdf}));
    const rec = deskRecent(), times = {}; rec.forEach(x => { times[x.id] = x.t; });
    return {title: (lib.title && String(lib.title).trim()) || 'Paper Map', topics, papers, links: (lib.links || []).filter(l => l[2] !== 'o').map(l => [l[0], l[1], l[2]]), branches: clone(lib.branches || []), lineBranch: clone(lib.lineBranch || {}),
      readings: clone(lib.readings || []), readingCats: clone(lib.readingCats || []), notebooks: clone(lib.notebooks || []), minds: (lib.minds || []).map(m => ({id: m.id, name: m.name, papers: m.nodes.filter(n => n.type === 'paper').length, books: m.nodes.filter(n => n.type === 'book').length, words: m.nodes.filter(n => n.type === 'text').length, pin: m.pin || null, updated: m.updated})), prefs: deskPrefs(), recent: rec.map(x => x.id), recentTimes: times, preview: !!PREVIEW};
  },
  ready(){ DK.ready = true; },
  openMap(tid){ if(!lib.topics.some(t => t.id === tid)) return; deskTouchRecent(tid); DK.fromTopic = tid; try{ setToc(false); }catch(e){} openView(tid + '-all'); try{ atlasLanes(); renderMap(true); }catch(e){}
    /* the map page is drawn under the desk first; two frames later the desk lets go, quickly, so the two are never seen half and half for long */
    requestAnimationFrame(() => requestAnimationFrame(() => { if(DK.frame) DK.frame.classList.add('quick'); deskHide(); setTimeout(() => { if(DK.frame) DK.frame.classList.remove('quick'); }, 400); })); },
  openPaper(id, from){ const e = lib.entries[id]; if(!e) return; deskTouchRecent(e.topic); DK.fromTopic = e.topic; DK.from = from === 'paper' ? 'paper:' + id : 'papers'; deskHide(); setTimeout(() => { goTo(id); try{ select(id, true); }catch(err){} }, 90); },
  newMap(){ setTimeout(() => openTopicForm(), 140); },
  pdfThumb(id){ return pdfFirstPage(id); },
  openMind(id){ DK.mindFrom = 'maps'; setTimeout(() => { try{ openMind(id); }catch(e){} }, 40); },
  mindFor(kind, id){ DK.mindFrom = 'desk'; setTimeout(() => { try{ mindFor(kind, id); }catch(e){} }, 40); },
  async bookFileSave(bookId, file){ const c = ghCfg(), name = String(file.name || 'book').replace(/[\\/:*?"<>|#%]+/g, ' ').trim().slice(-90), path = 'books/' + bookId + '/' + name;
    const meta = {name: file.name, path, size: file.size, type: file.type || '', added: new Date().toISOString()};
    if(c){ if(c.kind !== 'folder' && file.size > 95 * 1048576) throw new Error('That file is ' + fmtSize(file.size) + ': GitHub takes files up to 100 MB. Keep it in iCloud Drive or a folder instead.');
      const content = await fileToBase64(file);
      await ghSerial(async () => { let r = await ghPutPath(c, path, content, 'Book file: ' + name, null); if(r.status === 409 || r.status === 422){ const known = await ghPathSha(c, path); r = await ghPutPath(c, path, content, 'Book file: ' + name, known); } if(!r.ok) throw new Error('Could not keep the file (' + r.status + ')'); });
      meta.where = c.kind === 'folder' ? 'folder' : 'github'; return meta; }
    const ok = await PMDB.set('file:' + path, file); if(!ok) throw new Error('This browser could not keep the file'); meta.where = 'local'; return meta; },
  async bookFileBlob(f){ if(!f) return null; if(f.where === 'local') return await PMDB.get('file:' + f.path) || null;
    if(f.where === 'example'){ try{ const r = await fetch('example/' + f.path); return r.ok ? await r.blob() : null; }catch(e){ return null; } }
    if(f.where === 'zotero'){ const zc = ztCfg(); return zc ? await ztFileBlob(zc, f.zotero) : null; }
    const c = ghCfg(); if(!c) return null;
    if(c.kind === 'folder'){ const b = await remoteBytes(c, f.path); return b ? new Blob([b], {type: f.type || 'application/octet-stream'}) : null; }
    const r = await fetch(ghPathUrl(c, f.path) + ghRef(c), {headers: ghHeaders(c, {'Accept': 'application/vnd.github.raw+json'})}); return r.ok ? await r.blob() : null; },
  bookFileDelete(f){ try{ if(f && f.where === 'local') PMDB.set('file:' + f.path, null); }catch(e){} },
  saveBlob(blob, name){ if(window.__TAURI__ && typeof macSave === 'function'){ macSave(blob, name).then(() => toast('Saved to Downloads: ' + name)).catch(() => toast('Could not save the file')); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); },
  pdfPage(id, n){ return pdfPageAt(id, n || 0); },
  async paperPdfBlob(id){ const e = lib.entries[id]; if(!e || !e.pdf) return null; try{ const u = await pdfUrl(e); const r = await fetch(u); return r.ok ? await r.blob() : null; }catch(err){ return null; } },
  over(kind, r){ const fake = {getBoundingClientRect: () => ({left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.right - r.left, height: r.bottom - r.top, x: r.left, y: r.top}), classList: {add(){}, remove(){}, toggle(){}, contains(){ return false; }}, closest: () => null};
    document.documentElement.classList.add('pm-overdesk'); if(kind === 'note') atlasNote(fake); else if(kind === 'sync') atlasSync(fake); },
  closeOver(){ try{ atlasNoteClose(); }catch(e){} const s2 = document.getElementById('atlSync'); if(s2) s2.hidden = true; },
  /* folders and topics in the Papers list: make them, rename them, nest them by dragging, and move papers into them */
  newFolder(name, tid, parentSub){ name = String(name || '').trim().slice(0, 80); if(!name || PREVIEW) return null;
    if(!tid){ const tp = {id: rid('t'), name, shelf: true, subs: [{id: rid('s'), name, desc: '', groups: [], hidden: true}]}; lib.topics.push(tp); try{ reindex(); }catch(e){} touchLib(); return tp.id; }
    const tp = lib.topics.find(t => t.id === tid); if(!tp) return null; const root = tp.subs.find(x => x.hidden) || tp.subs[0];
    const sub = {id: rid('s'), name, desc: '', groups: []}; if(parentSub && root && parentSub !== root.id) sub.parent = parentSub; tp.subs.push(sub); try{ reindex(); }catch(e){} touchLib(); return sub.id; },
  renameFolder(tid, sid, name){ name = String(name || '').trim().slice(0, 80); const tp = lib.topics.find(t => t.id === tid); if(!name || !tp || PREVIEW) return;
    const root = tp.subs.find(x => x.hidden) || tp.subs[0]; if(!sid || (root && sid === root.id)){ tp.name = name; if(root && root.hidden) root.name = name; } else { const x = tp.subs.find(y => y.id === sid); if(x) x.name = name; } touchLib(); },
  deleteFolder(tid, sid){ const tp = lib.topics.find(t => t.id === tid); if(!tp || PREVIEW) return 'none'; const root = tp.subs.find(x => x.hidden) || tp.subs[0];
    if(!sid || (root && sid === root.id)){ if(Object.values(lib.entries).some(e => e.topic === tid)) return 'not-empty'; lib.topics = lib.topics.filter(t => t !== tp); lib.tlinks = (lib.tlinks || []).filter(l => l[0] !== tid && l[1] !== tid); try{ reindex(); }catch(e){} touchLib(); return 'ok'; }
    const S = tp.subs.find(x => x.id === sid); if(!S) return 'none'; const up = S.parent || (root && root.id);
    tp.subs.forEach(x => { if(x.parent === sid){ if(S.parent) x.parent = S.parent; else delete x.parent; } });
    Object.values(lib.entries).forEach(e => { if(e.topic === tid && e.sub === sid) e.sub = up; });
    tp.subs = tp.subs.filter(x => x !== S); try{ reindex(); }catch(e){} touchLib(); return 'ok'; },
  moveFolder(sT, sS, dT, dS){ if(PREVIEW) return false; const A = lib.topics.find(t => t.id === sT), B = lib.topics.find(t => t.id === dT); if(!A || !B) return false;
    const rootOf = t => t.subs.find(x => x.hidden) || t.subs[0], rA = rootOf(A), rB = rootOf(B); if(sS && rA && sS === rA.id) sS = null;
    const target = dS && rB && dS !== rB.id ? dS : null;
    if(!sS){ if(A === B) return false;
      /* a whole folder or map goes inside another: its own level becomes a topic there, with everything it held */
      const nr = {id: rid('s'), name: A.name, desc: '', groups: []}; if(target) nr.parent = target;
      const rest = A.subs.filter(x => x !== rA).map(x => Object.assign({}, x, x.parent ? {} : {parent: nr.id}));
      B.subs.push(nr, ...rest);
      Object.values(lib.entries).forEach(e => { if(e.topic === A.id){ e.topic = B.id; if(!e.sub || (rA && e.sub === rA.id)) e.sub = nr.id; } });
      lib.topics = lib.topics.filter(t => t !== A); lib.tlinks = (lib.tlinks || []).filter(l => l[0] !== A.id && l[1] !== A.id);
    } else { const S = A.subs.find(x => x.id === sS); if(!S) return false;
      const tree = new Set([S.id]); let grew = true; while(grew){ grew = false; A.subs.forEach(x => { if(x.parent && tree.has(x.parent) && !tree.has(x.id)){ tree.add(x.id); grew = true; } }); }
      if(A === B && target && tree.has(target)) return false;
      if(A === B){ if(target) S.parent = target; else delete S.parent; }
      else { const moving = A.subs.filter(x => tree.has(x.id)); A.subs = A.subs.filter(x => !tree.has(x.id)); if(target) S.parent = target; else delete S.parent; B.subs.push(...moving);
        Object.values(lib.entries).forEach(e => { if(e.topic === A.id && tree.has(e.sub)) e.topic = B.id; }); } }
    try{ reindex(); }catch(e){} touchLib(); return true; },
  movePaper(id, tid, sid){ const e = lib.entries[id], tp = lib.topics.find(t => t.id === tid); if(!e || !tp || PREVIEW) return; const root = tp.subs.find(x => x.hidden) || tp.subs[0]; e.topic = tid; e.sub = sid || (root && root.id); try{ reindex(); }catch(err){} touchLib(); },
  paperLinks(id){ const seen = new Set(); return (lib.links || []).filter(l => l[0] === id || l[1] === id).map(l => l[0] === id ? l[1] : l[0]).filter(x => lib.entries[x] && !seen.has(x) && seen.add(x)).map(x => lib.entries[x].t || ''); },
  paperRead(id){ const e = lib.entries[id]; if(!e) return null; return {n: e.n || '', marks: clone(e.marks || []), quotes: clone(e.quotes || []), stickies: clone(e.stickies || []), at: e.readAt || 0}; },
  setPaperStickies(id, arr){ const e = lib.entries[id]; if(!e || PREVIEW) return; e.stickies = arr; touchLib(); },
  setPaperNotes(id, md){ const e = lib.entries[id]; if(!e || PREVIEW) return; if((e.n || '') === md) return; e.n = md; touchLib(); },
  setPaperMarks(id, marks){ const e = lib.entries[id]; if(!e || PREVIEW) return; e.marks = marks; touchLib(); },
  addPaperQuote(id, q){ const e = lib.entries[id]; if(!e || PREVIEW) return; e.quotes = (e.quotes || []).concat([q]); touchLib(); },
  setPaperAt(id, page){ const e = lib.entries[id]; if(!e || PREVIEW || e.readAt === page) return; e.readAt = page; clearTimeout(DK.atT); DK.atT = setTimeout(touchLib, 1500); },
  async attachPaperPdf(id, file){ await attachPdf(id, file); return !!(lib.entries[id] && lib.entries[id].pdf); },
  setPdfPage(id, n){ const e = lib.entries[id]; if(!e || PREVIEW) return; if(n) e.pdfPage = n; else delete e.pdfPage; touchLib(); },
  paper(id){ const e = lib.entries[id]; if(!e || e.kind !== 'paper') return null;
    const brief = x => { const o = lib.entries[x]; return o ? {id: o.id, t: o.t || 'Untitled', au: o.au || '', y: o.y} : null; };
    const up = k => (lib.links || []).filter(l => l[1] === id && l[2] === k).map(l => brief(l[0])).filter(Boolean);
    const down = k => (lib.links || []).filter(l => l[0] === id && l[2] === k).map(l => brief(l[1])).filter(Boolean);
    const rel = (lib.links || []).filter(l => l[2] === 'r' && (l[0] === id || l[1] === id)).map(l => brief(l[0] === id ? l[1] : l[0])).filter(Boolean);
    const laneName = x => { for(const t of lib.topics){ if(t.id === x) return t.name; for(const s of (t.subs || [])) if(s.id === x) return s.hidden ? t.name : t.name + ' / ' + s.name; } return ''; };
    const doi = e.doi ? String(e.doi).trim().replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, '') : '';
    return {id, t: e.t || '', au: e.au || '', y: e.y, v: e.v || '', n: e.n || '', st: stOf(e) || '', pri: (PRIO_LABEL[e.p] || '').replace(/^\S+\s/, ''), book: !!e.book,
      tags: (e.tags || []).map(t => (lib.tags.find(x => x.id === t) || {}).name).filter(Boolean), where: laneName(e.sub) || laneName(e.topic),
      url: /^https?:\/\//.test(e.l || '') ? e.l : (doi ? 'https://doi.org/' + doi : ''),
      buildsOn: up('b'), builtOnBy: down('b'), respondsTo: up('c'), challengedBy: down('c'), related: rel, mentions: (e.mentions || []).map(laneName).filter(Boolean),
      p: e.p || 0, tagIds: (e.tags || []).slice(), allTags: (lib.tags || []).map(t => ({id: t.id, name: t.name, color: t.color})), pdf: !!e.pdf}; },
  setPriority(id, pr){ const e = lib.entries[id]; if(!e || PREVIEW || ![1, 2, 3].includes(pr)) return; e.p = pr; touchLib(); try{ renderAll(); }catch(err){} },
  toggleTag(id, tid){ const e = lib.entries[id]; if(!e || PREVIEW) return; e.tags = e.tags || []; const k = e.tags.indexOf(tid); if(k >= 0) e.tags.splice(k, 1); else e.tags.push(tid); touchLib(); try{ refreshAfterTags(); }catch(err){} },
  addTag(id, name){ const e = lib.entries[id]; if(!e || PREVIEW || !name) return; let x = lib.tags.find(z => z.name.toLowerCase() === name.toLowerCase()); if(!x) x = newTag(name); e.tags = e.tags || []; if(!e.tags.includes(x.id)) e.tags.push(x.id); touchLib(); try{ refreshAfterTags(); }catch(err){} },
  editPaper(id){ if(!lib.entries[id]) return; DK.fromTopic = lib.entries[id].topic; DK.from = null; setTimeout(() => { try{ openEntryForm(id); }catch(err){} }, 0); },
  setMapColor(tid, hex){ const tp = lib.topics.find(t => t.id === tid); if(!tp || !/^#[0-9a-f]{6}$/i.test(hex)) return; tp.cover = hex; if(!PREVIEW) touchLib(); },
  where(){ const c = ghCfg(); return !c ? 'only in this ' + (window.__TAURI__ ? 'Mac' : 'browser') : c.kind === 'folder' ? (window.__TAURI__ ? 'in your folder on this Mac' : 'in the folder you chose') : c.kind === 'dropbox' ? 'in Dropbox' : 'on GitHub' + (c.repo ? ' (' + c.repo + ')' : ''); },
  setStatus(id, st){ const e = lib.entries[id]; if(!e || PREVIEW) return; const cur = stOf(e) || ''; if(cur === (st || '')) return; toggleStatus(id, st || cur); },
  openNotes(id){ if(!lib.entries[id]) return; DK.fromTopic = lib.entries[id].topic; DK.from = null; deskOver(true); setTimeout(() => { try{ openReader(id); }catch(err){} }, 0); },
  openLink(url){ if(/^https?:\/\//.test(String(url || ''))) window.open(url, '_blank', 'noopener'); },
  newPaper(tid){ setTimeout(() => { if(tid && lib.topics.some(t => t.id === tid)){ DK.fromTopic = tid; openView(tid + '-all'); } openEntryForm(null); }, 140); },
  openSettings(back){ setTimeout(() => openSettings(back), 140); },
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
  /* if a map is still unfolding, let it finish before folding it back */
  for(let i = 0; i < 80 && page.busy && page.busy(); i++) await sleep(50);
  const from = DK.from; DK.from = null;
  if(from === 'papers'){ page.show('papers'); deskShowFrame(); DK.fromTopic = null; return; }
  if(from === 'mind'){ page.show('maps'); deskShowFrame(); DK.fromTopic = null; return; }
  if(from === 'desk'){ page.show(); deskShowFrame(); DK.fromTopic = null; return; }
  if(from === 'note'){ page.show(); deskShowFrame(); DK.fromTopic = null; setTimeout(() => { try{ page.openNote(); }catch(e){} }, 380); return; }
  if(from && from.indexOf('paper:') === 0){ try{ closeReader(); }catch(e){} page.show('paper', from.slice(6)); deskShowFrame(); DK.fromTopic = null; return; }
  const tid = ui.topic && lib.topics.some(t => t.id === ui.topic) ? ui.topic : null;
  if(tid){ deskTouchRecent(tid); deskShowFrame(true); page.returnFromMap(tid); }
  else { page.show(); deskShowFrame(); }
  DK.fromTopic = null;
}
document.getElementById('btnDesk').addEventListener('click', deskOpen);

/* ===================== the map page, as confirmed: the map on its sheet, two small bars and the card =====================
   It works through the app's own buttons and panels, which stay out of sight; the old page is gone. */
const ATL_IC = {"metro": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3.5 17.5h5l3.5-6h8.5\"/><path d=\"M12 11.5 9 6.5H3.5\"/><circle cx=\"8.5\" cy=\"17.5\" r=\"1.6\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"11.5\" r=\"1.6\" fill=\"currentColor\"/><circle cx=\"20.5\" cy=\"11.5\" r=\"1.6\" fill=\"currentColor\"/></svg>", "notebook": "<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M6.5 3.5h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z\"/><path d=\"M8.5 3.5v17\"/><path d=\"M11 8h5M11 11h5M11 14h3\"/></svg>", "back": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M15 18l-6-6 6-6\"/></svg>", "layers": "<svg class=\"ic \" width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3 3 7.5l9 4.5 9-4.5L12 3z\"/><path d=\"M3 16.5l9 4.5 9-4.5M3 12l9 4.5 9-4.5\"/></svg>", "chev": "<svg class=\"ic \" width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M6 9l6 6 6-6\"/></svg>", "search": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"M20 20l-3.6-3.6\"/></svg>", "add": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"/></svg>", "filter": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 6h16M7 12h10M10 18h4\"/></svg>", "years": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15.5\" rx=\"2.5\"/><path d=\"M8 3v4M16 3v4M3.5 10h17\"/></svg>", "export": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3v12M8 7l4-4 4 4\"/><path d=\"M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13\"/></svg>", "sync": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M17.5 19H8a6 6 0 1 1 5.6-8.2A4.5 4.5 0 1 1 17.5 19z\"/><path d=\"M9.5 14l2 2 3.5-3.5\"/></svg>", "look": "<svg class=\"ic \" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>", "target": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"6.5\"/><circle cx=\"12\" cy=\"12\" r=\"1.6\" fill=\"currentColor\"/><path d=\"M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3\"/></svg>", "doc": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5z\"/><path d=\"M13.5 3.5V8h4.5M9.5 12h5M9.5 15.5h5\"/></svg>", "link": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.2 1.2\"/><path d=\"M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.2-1.2\"/></svg>", "more": "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"6\" cy=\"12\" r=\"1.3\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"12\" r=\"1.3\" fill=\"currentColor\"/><circle cx=\"18\" cy=\"12\" r=\"1.3\" fill=\"currentColor\"/></svg>"};
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
  const right = mk('div', 'atlRight', 'atl-pill', B('search', 'Search', ATL_IC.search) + B('add', 'New paper', ATL_IC.add) + B('filter', 'Filters', ATL_IC.filter) + B('years', 'Years', ATL_IC.years) + B('export', 'Export', ATL_IC.export) + B('notebook', 'Research log', ATL_IC.notebook) + '<span class="atl-sep"></span>' + B('sync', 'Sync', ATL_IC.sync) + B('settings', 'Settings', ATL_IC.look));
  const title = mk('div', 'atlTitle', 'atl-title', '');
  const foot = mk('div', 'atlFoot', 'atl-foot', '');
  const hint = mk('div', 'atlRel', 'atl-rel', '');
  const relMenu = mk('div', 'atlRelMenu', 'atl-menu atl-relmenu', ''); relMenu.hidden = true;
  const pop = mk('div', 'atlPop', 'atl-pop', '');
  document.body.prepend(sheet); document.body.append(left, maps, right, title, foot, hint, relMenu, pop);
  hint.addEventListener('click', atlasRelClick); relMenu.addEventListener('click', atlasRelClick);
  document.addEventListener('click', ev => { if(!relMenu.hidden && !ev.target.closest('#atlRelMenu,#atlRel')) relMenu.hidden = true; });
  ['addMenu', 'exportMenu', 'zoomTools'].forEach(id => { const el = document.getElementById(id); if(el) pop.appendChild(el); });
  const up = document.getElementById('undoPill'); if(up) document.body.appendChild(up);
  const fl = document.getElementById('filters'); if(fl) document.body.appendChild(fl);   /* the filters lived inside the old bar */
  const click = id => { const el = document.getElementById(id); if(el) el.click(); };
  document.addEventListener('click', ev => {
    const more = ev.target.closest('[data-atl-more]');
    if(more){ ev.stopPropagation(); ev.preventDefault(); try{ openBigCard(more.dataset.atlMore, document.getElementById('info')); }catch(e){} return; }
    const lk = ev.target.closest('[data-atl-link]');
    if(lk){ ev.stopPropagation(); ev.preventDefault(); const id = lk.dataset.atlLink, r = lk.getBoundingClientRect();
      try{ openFloatMenu(r.left - 60, r.top - 176, [
        {label: '← Builds on…', fn: () => startLinkMode(id, 'in')},
        {label: 'Leads to →…', fn: () => startLinkMode(id, 'out')},
        {label: 'Related to…', fn: () => startLinkMode(id, 'rel')},
        {sep: 1}, {label: '↧ Mentions another field…', fn: () => startLinkMode(id, 'field')}], lk); }catch(e){} return; }
    const b = ev.target.closest('[data-atl]');
    const mi = ev.target.closest('[data-atl-mind]'); if(mi){ ev.stopPropagation(); maps.hidden = true; try{ openMind(mi.dataset.atlMind); }catch(e){} return; }
    if(!b){ if(!ev.target.closest('#atlMaps')) { maps.hidden = true; } return; }
    ev.stopPropagation(); ev.preventDefault();
    const a = b.dataset.atl; if(a !== 'maps') maps.hidden = true;
    if(a === 'back') deskOpen();
    else if(a === 'maps'){ atlasMaps(); maps.hidden = !maps.hidden; b.setAttribute('aria-expanded', String(!maps.hidden)); }
    else if(a === 'search'){ const fr = document.getElementById('filters'); if(fr && fr.classList.contains('open')){ atlasCloseFilters(true); return; } click('filterToggle'); const q = document.getElementById('q'); [60, 220].forEach(ms => setTimeout(() => { if(q){ q.focus(); q.select(); } }, ms)); }
    else if(a === 'add') click('btnAddMore');
    else if(a === 'filter'){ const fr = document.getElementById('filters'); if(fr && fr.classList.contains('open')) atlasCloseFilters(false); else click('filterToggle'); }
    else if(a === 'years') click('btnZoom');
    else if(a === 'export') click('btnExport');
    else if(a === 'notebook') atlasNote(b);
    else if(a === 'sync') atlasSync(b);
    else if(a === 'settings') atlasLook(b);
  }, true);
  maps.addEventListener('click', ev => { const t = ev.target.closest('[data-atl-map]'), c = ev.target.closest('[data-atl-contents]'), n = ev.target.closest('[data-atl-new]');
    const mg = ev.target.closest('[data-atl-merge]');
    if(mg){ maps.hidden = true; openMergeMaps(); return; }
    if(!t && !c && !n) return; maps.hidden = true;
    if(t){ deskTouchRecent(t.dataset.atlMap); try{ if(ui.selected) select(null); }catch(e){} openView(t.dataset.atlMap + '-all'); }
    else if(c) setToc(true); else if(n) openTopicForm(); });
  /* the cloud says how saving is going */
  const ss = document.querySelector('.bar [data-save-state]');
  const syncNote = () => { const t = ss ? ss.textContent.trim() : '', btn = right.querySelector('[data-atl="sync"]');
    btn.title = t || 'Sync: Settings'; btn.classList.toggle('warn', /saving|wait|unsaved|not saved|changes/i.test(t)); btn.classList.toggle('bad', /fail|couldn|error|offline|expired/i.test(t)); btn.classList.toggle('local', /browser only|this app only/i.test(t)); };
  if(ss && 'MutationObserver' in window) new MutationObserver(syncNote).observe(ss, {childList: true, characterData: true, subtree: true});
  syncNote(); atlasWood(); atlasTitle();
  /* a click on empty paper puts the card away (a drag to pan the map does not) */
  { let down = null;
    document.addEventListener('pointerdown', ev => { down = [ev.clientX, ev.clientY]; }, true);
    document.addEventListener('click', ev => {
      if(!document.documentElement.classList.contains('atlas') || !ui.selected || linkMode) return;
      if(down && Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 5) return;
      if(ev.target.closest('#info,.node,.edge,.lbl,.lbl-au,.e-hit,#atlLeft,#atlRight,[id^="atl"],#floatMenu,#bigCard,.lens-root,#modalRoot,#tour,#toc,#readerRoot,.reader,#toast,button,a,input,textarea,select,[role="button"]')) return;
      try{ select(null); }catch(e){}
    }); }
  /* linking from the card: the line follows the mouse; the paper you click decides which way it goes, by year */
  try{ LINK_HINT.auto = 'Click the paper to link it to'; }catch(e){}
  document.addEventListener('click', ev => {
    if(!linkMode || linkMode.kind !== 'auto') return;
    const tn = ev.target.closest && ev.target.closest('#net .node'); if(!tn) return;
    const a = lib.entries[linkMode.from], b = lib.entries[tn.dataset.id]; if(!a || !b) return;
    linkMode.kind = (typeof b.y === 'number' && typeof a.y === 'number' && b.y > a.y) ? 'out' : 'in';
  }, true);
  /* search and filters: a close button, Esc, and a dot on the filter icon while something is filtered */
  const fr = document.getElementById('filters');
  if(fr && !fr.querySelector('.atl-fx')){ const x = document.createElement('button'); x.type = 'button'; x.className = 'atl-fx'; x.setAttribute('aria-label', 'Close search and filters'); x.title = 'Close (Esc)'; x.innerHTML = '&times;'; x.addEventListener('click', ev => { ev.stopPropagation(); atlasCloseFilters(true); }); fr.appendChild(x); }
  document.addEventListener('keydown', ev => { if(ev.key !== 'Escape' || !fr || !fr.classList.contains('open') || !modal.root.hidden) return; ev.preventDefault(); atlasCloseFilters(true); });
  const mark = () => { const on = !!(fr && ([...fr.querySelectorAll('select')].some(sel => sel.selectedIndex > 0) || ((document.getElementById('q') || {}).value || '').trim())); right.querySelector('[data-atl="filter"]').classList.toggle('on', on); right.querySelector('[data-atl="search"]').classList.toggle('on', !!(((document.getElementById('q') || {}).value || '').trim())); };
  if(fr){ fr.addEventListener('input', mark); fr.addEventListener('change', mark); } setInterval(mark, 1500); mark();
}
function atlasCloseFilters(clearSearch){
  const fr = document.getElementById('filters'), q = document.getElementById('q');
  if(clearSearch && q && q.value){ q.value = ''; q.dispatchEvent(new Event('input', {bubbles: true})); }
  if(fr && fr.classList.contains('open')){ const t = document.getElementById('filterToggle'); if(t) t.click(); }
  setTimeout(() => { const r = document.getElementById('atlRight'); if(r){ r.querySelector('[data-atl="search"]').classList.remove('on'); } }, 0);
}
/* PDFs and the library's size, in the cloud */
function atlasPdfLine(){
  const ps = Object.values(lib.entries).filter(e => e.pdf), mb = ps.reduce((n, e) => n + (e.pdf.size || 0), 0) / 1048576, size = JSON.stringify(lib).length / 1048576;
  const big = ps.filter(e => (e.pdf.size || 0) > 50 * 1048576).length;
  return '<div class="atl-sy atl-pdfline"><span>Library ' + (size < .1 ? size.toFixed(2) : size.toFixed(1)) + ' MB' + (size > 3.5 && !window.__TAURI__ ? ' · near what a browser keeps (about 5 MB): the Mac app has no such limit' : '') + '</span>' +
    '<span>' + ps.length + (ps.length === 1 ? ' PDF' : ' PDFs') + (ps.length ? ' · ' + mb.toFixed(1) + ' MB' : '') + (big ? ' · ' + big + ' over 50 MB' : '') + '</span></div>' +
    (ps.length && ghCfg() ? '<button type="button" class="atl-pbtn" data-sync-a="pdfs">Check the PDFs</button><div class="atl-pdfres" id="atlPdfRes"></div>' : '');
}
async function atlasPdfList(c){
  if(c.kind === 'folder'){ let d; try{ [d] = await fsParent('pdfs/x', false); }catch(e){ return []; }
    const out = []; for await (const [n, h] of d.entries()){ if(h.kind !== 'file') continue; let size = 0; try{ size = (await h.getFile()).size; }catch(e){} out.push({name: n, path: 'pdfs/' + n, size}); } return out; }
  const r = await fetch(ghPathUrl(c, 'pdfs') + ghRef(c), {headers: ghHeaders(c, {'Accept': 'application/vnd.github+json'})});
  if(r.status === 404) return []; if(!r.ok) throw {status: r.status};
  return (await r.json()).filter(x => x.type === 'file').map(x => ({name: x.name, path: x.path, size: x.size, sha: x.sha}));
}
async function atlasPdfCheck(box){
  const res = box.querySelector('#atlPdfRes'), c = ghCfg(); if(!res || !c) return; res.textContent = 'Checking…';
  let files; try{ files = await atlasPdfList(c); }catch(e){ res.textContent = 'Could not look just now. Try again in a moment.'; return; }
  const have = new Map(files.map(f => [f.path, f])), refd = new Set();
  const missing = Object.values(lib.entries).filter(e => e.pdf && e.pdf.path && (refd.add(e.pdf.path), !have.has(e.pdf.path)));
  const loose = files.filter(f => !refd.has(f.path));
  /* Paper Map names a paper's PDF after the paper; such a file with no paper was left by a deleted paper. Any other file is yours: it stays. */
  const orphan = loose.filter(f => /^[A-Za-z0-9_-]+\.pdf$/.test(f.name) && !lib.entries[f.name.replace(/\.pdf$/, '')]), unlinked = loose.filter(f => !orphan.includes(f));
  const mb = list => (list.reduce((n, f) => n + (f.size || 0), 0) / 1048576).toFixed(1) + ' MB';
  res.innerHTML = '<p><b>Storage used</b> · ' + mb(files) + ' in ' + files.length + (files.length === 1 ? ' file' : ' files') + '</p>' +
    '<p' + (missing.length ? ' class="bad"' : '') + '><b>Missing PDFs</b> · ' + missing.length + (missing.length ? ': the paper is there, its file is not. Click one to add it again.' : '') + '</p>' + missing.slice(0, 12).map(e => '<button type="button" data-pdf-open="' + esc(e.id) + '">' + esc(e.t || 'Untitled') + '</button>').join('') +
    '<p><b>Unlinked PDFs</b> · ' + unlinked.length + (unlinked.length ? ' (' + mb(unlinked) + '): files of your own with no paper yet. Paper Map leaves them as they are.' : '') + '</p>' + unlinked.slice(0, 8).map(f => '<span class="atl-pdfname">' + esc(f.name) + '</span>').join('') +
    '<p><b>Orphaned files</b> · ' + orphan.length + (orphan.length ? ' (' + mb(orphan) + '): left by papers you deleted.' : '') + '</p>' + (orphan.length && c.kind !== 'folder' ? '<button type="button" data-pdf-rm="1">Remove the orphaned files…</button>' : '');
  res._extra = orphan;
}
async function atlasPdfRemove(btn, box){
  const res = box.querySelector('#atlPdfRes'), c = ghCfg(), extra = (res && res._extra) || []; if(!c || !extra.length) return;
  if(!confirm('Remove ' + extra.length + (extra.length === 1 ? ' file' : ' files') + ' left by deleted papers? GitHub keeps them in the history.')) return;
  btn.disabled = true; btn.textContent = 'Removing…';
  let n = 0; for(const f of extra){ try{ const r = await fetch(ghPathUrl(c, f.path), {method: 'DELETE', headers: ghHeaders(c, {'Content-Type': 'application/json'}), body: JSON.stringify({message: 'Paper Map: remove a PDF no paper uses', sha: f.sha, branch: c.branch || 'main'})}); if(r.ok) n++; }catch(e){} }
  toast('Removed ' + n + (n === 1 ? ' file' : ' files')); atlasPdfCheck(box);
}
function atlasPanel(id){ let box = document.getElementById(id);
  if(!box){ box = document.createElement('div'); box.id = id; box.className = 'atl-menu atl-side'; box.hidden = true; document.body.appendChild(box);
    document.addEventListener('mousedown', ev => { if(!box.hidden && !ev.target.closest('#' + id + ',[data-atl]') && modal.root.hidden) box.hidden = true; }); }
  ['atlSync', 'atlLook'].forEach(x => { if(x !== id){ const o = document.getElementById(x); if(o) o.hidden = true; } }); return box; }
/* the cloud: where the library is kept, and everything about keeping it there */
function atlasSync(btn){
  const box = atlasPanel('atlSync'); if(!box.hidden){ box.hidden = true; return; }
  const c = ghCfg(), st = ((document.querySelector('.bar [data-save-state]') || {}).textContent || '').trim();
  const where = !c ? 'Only on this ' + (window.__TAURI__ ? 'Mac' : 'browser') : c.kind === 'folder' ? (window.__TAURI__ ? 'Your folder on this Mac' : 'The folder you chose') : c.kind === 'dropbox' ? 'Dropbox' : 'GitHub' + (c.repo ? ' · ' + c.repo : '');
  box.innerHTML = '<p class="atl-mk">YOUR LIBRARY</p><div class="atl-sy"><b>' + esc(where) + '</b><span>' + esc(st || (c ? 'Up to date' : 'Not copied anywhere else')) + '</span></div>' +
    (c ? '<button type="button" class="atl-pbtn" data-sync-a="now">Sync now</button>' : '') + (window.__TAURI__ ? '<button type="button" class="atl-pbtn" data-sync-a="mac">Change where it is kept…</button>' : '') +
    atlasPdfLine() + '<button type="button" class="atl-pbtn atl-zt" data-sync-a="zotero">' + (ztCfg() ? 'Zotero · connected' : 'Connect Zotero') + '</button>' + (ztCfg() ? '<button type="button" class="atl-pbtn" data-sync-a="zsync">Bring in from Zotero now</button>' : '') + '<div class="atl-syncform">' + syncSectionHTML() + '</div>';
  try{ wireGhSection(box); }catch(e){}
  box.onclick = ev => { const op = ev.target.closest('[data-pdf-open]'); if(op){ box.hidden = true; try{ openReader(op.dataset.pdfOpen); }catch(e){} return; }
    const rm = ev.target.closest('[data-pdf-rm]'); if(rm){ atlasPdfRemove(rm, box); return; }
    const a = ev.target.closest('[data-sync-a]'); if(!a) return;
    if(a.dataset.syncA === 'now'){ const k = ghCfg(); if(k){ (k.dirty ? ghSaveNow() : ghLoad()); toast('Syncing…'); } box.hidden = true; }
    if(a.dataset.syncA === 'mac'){ box.hidden = true; try{ macChooseStorage(); }catch(e){} }
    if(a.dataset.syncA === 'pdfs') atlasPdfCheck(box);
    if(a.dataset.syncA === 'zotero'){ box.hidden = true; openZotero(); }
    if(a.dataset.syncA === 'zsync'){ box.hidden = true; ztSync(true); } };
  box.hidden = false;
}
/* Settings, tidied the moment it opens: choices become rows of buttons, switches become pills, the two colours become buttons
   filled with their colour, and the explanations go; every control still works through its own handler */
const PM_PAL = ['#231E1A', '#4F453B', '#2F6B4F', '#2E7D6B', '#2F5E8C', '#B4432E', '#C0682C', '#B48A2E', '#7A3E6B', '#8A7F72'];
function settingsTidy(){
  const root = document.getElementById('modalRoot'), body = document.getElementById('modalBody'); if(!root || !body || !body.querySelector('#setTitle')) return;
  root.classList.add('pm-settings');
  body.querySelectorAll('select').forEach(sel => { if(sel.options.length > 4 || sel.previousElementSibling && sel.previousElementSibling.classList.contains('pm-seg')) return;
    const seg = document.createElement('span'); seg.className = 'pm-seg'; seg.setAttribute('role', 'radiogroup');
    const short = t => { const x = t.replace(/:.*$/, '').replace(/^Point to the /, '').replace(/^Don’t show arrows$/, 'No arrows').replace(/^until my next change$/, 'Until the next change'); return x.charAt(0).toUpperCase() + x.slice(1); };
    [...sel.options].forEach(o => { const b = document.createElement('button'); b.type = 'button'; b.textContent = short(o.textContent); b.className = o.value === sel.value ? 'on' : '';
      b.addEventListener('click', () => { sel.value = o.value; sel.dispatchEvent(new Event('change', {bubbles: true})); seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }); seg.appendChild(b); });
    sel.parentNode.insertBefore(seg, sel); });
  body.querySelectorAll('.color-row label').forEach(lab => { const inp = lab.querySelector('input[type="color"]'); if(!inp) return;
    const paint = () => { lab.style.setProperty('--sw', inp.value); const v = parseInt(inp.value.slice(1), 16), lum = ((v >> 16) * .299 + (v >> 8 & 255) * .587 + (v & 255) * .114); lab.classList.toggle('light-ink', lum < 110); };
    paint(); inp.addEventListener('input', paint);
    lab.addEventListener('click', ev => { ev.preventDefault(); document.querySelectorAll('.pm-pal').forEach(x => x.remove());
      const pal = document.createElement('div'); pal.className = 'pm-pal';
      pal.innerHTML = PM_PAL.map(h => '<button type="button" data-hex="' + h + '" style="background:' + h + '"' + (h.toLowerCase() === inp.value.toLowerCase() ? ' class="on"' : '') + ' aria-label="' + h + '"></button>').join('') + '<label>Another colour <input type="color" value="' + inp.value + '"></label>';
      document.body.appendChild(pal); const r = lab.getBoundingClientRect(); pal.style.left = Math.min(innerWidth - 220, r.left) + 'px'; pal.style.top = (r.bottom + 8) + 'px';
      const set = hex => { inp.value = hex; inp.dispatchEvent(new Event('input', {bubbles: true})); inp.dispatchEvent(new Event('change', {bubbles: true})); paint(); };
      pal.addEventListener('click', e2 => { const b = e2.target.closest('[data-hex]'); if(b){ set(b.dataset.hex); pal.remove(); } });
      pal.querySelector('input').addEventListener('input', e2 => set(e2.target.value));
      setTimeout(() => document.addEventListener('pointerdown', function off(e3){ if(!pal.contains(e3.target)){ pal.remove(); document.removeEventListener('pointerdown', off, true); } }, true), 0); }); });
  const rs = body.querySelector('#cReset'); if(rs){ rs.textContent = 'Reset'; rs.addEventListener('click', () => setTimeout(() => body.querySelectorAll('.color-row label').forEach(l => { const i = l.querySelector('input'); if(i) i.dispatchEvent(new Event('input')); }), 0)); }
  const bm = body.querySelector('#setBookmarklet'); if(bm){ const hp = bm.closest('.hint'); if(hp){ const row = document.createElement('div'); row.className = 'pm-bm'; bm.textContent = '+ Paper Map'; row.appendChild(bm); row.appendChild(document.createTextNode('Drag it to your bookmarks bar')); hp.replaceWith(row); } }
  const h = [...body.querySelectorAll('.set-section h3')].find(x => /Read and Want-to-read colours/i.test(x.textContent)); if(h) h.textContent = 'Read and want to read';
}
{ const _os = openSettings; openSettings = function(){ const r = _os.apply(this, arguments); try{ settingsTidy(); }catch(e){} return r; }; }
{ const _cm2 = closeModal; closeModal = function(){ const r = _cm2.apply(this, arguments); try{ document.getElementById('modalRoot').classList.remove('pm-settings'); document.querySelectorAll('.pm-pal').forEach(x => x.remove()); }catch(e){} return r; }; }
/* colours an older version stored as its own defaults are cleared once: the map's ink and red then apply, and colours you chose stay yours */
try{ const cc = settings && settings.colors; if(cc){ let ch = false; if(/^#009473$/i.test(cc.green || '')){ delete cc.green; ch = true; } if(/^#e34234$/i.test(cc.red || '')){ delete cc.red; ch = true; }
  if(ch){ if(!cc.green && !cc.red) settings.colors = null; persistSettings({remote: false}); applyColors(); } } }catch(e){}
/* New to Paper Map? A short tour on the real page: the page dims, a spotlight shows one thing at a time with a note beside it,
   and the middle of it is done for real: choose a paper, and draw your first line. */
function atlasGuide(){ atlasTour(); }
function tourNode(){ const ns = [...document.querySelectorAll('#net .node')].filter(n => { const e = lib.entries[n.dataset.id]; return e && e.kind === 'paper'; });
  const pick = ns.find(n => n.dataset.id === (lib.entries.glow1988 ? 'glow1988' : '')) || ns[Math.floor(ns.length / 2)]; return pick ? pick.querySelector('.dot') : null; }
function atlasTour(){
  if(document.getElementById('tour')) return;
  try{ document.querySelectorAll('#atlLook,#atlSync,#atlMaps,#atlRelMenu').forEach(x => x.hidden = true); if(ui.selected) select(null); }catch(e){}
  const links0 = (lib.links || []).length;
  const steps = [
    {at: () => document.querySelector('#atlLeft .atl-name'), title: 'Your maps', text: 'Switch to another map here, open Contents, or start a new map.'},
    {at: () => document.querySelector('[data-atl="add"]'), title: 'Add a paper', text: 'Paste a DOI or the paper’s web address; Fill in does the rest.'},
    {at: tourNode, title: 'Choose a paper', text: 'Click this paper.', pad: 16, done: () => !!ui.selected, act: true},
    {at: () => document.querySelector('.acard [data-atl-link]'), title: 'Now link it', text: 'Click the target, choose Builds on, then click any other paper on the map.', done: () => (lib.links || []).length > links0, act: true, free: () => !!linkMode},
    {at: () => document.querySelector('#net'), title: 'Your first line', text: 'That is Paper Map: papers, and the lines between them. Double-clicking a dot links papers too.', pad: 6},
    {at: () => document.querySelector('[data-atl="notebook"]'), title: 'Your research log', text: 'A page of your notebook comes up right here.'},
    {at: () => document.querySelector('[data-atl="sync"]'), title: 'Where it is kept', text: 'iCloud Drive, a folder or GitHub. Nothing goes anywhere else.'},
    {at: () => document.querySelector('[data-atl="back"]'), title: 'The desk', text: 'Papers, Readings and your notebook are waiting there.'}];
  const root = document.createElement('div'); root.id = 'tour';
  root.innerHTML = '<div class="tr-sh" data-s="t"></div><div class="tr-sh" data-s="l"></div><div class="tr-sh" data-s="r"></div><div class="tr-sh" data-s="b"></div><div class="tr-ring"></div>' +
    '<div class="tr-note" role="dialog" aria-live="polite"><p class="tr-k"></p><b class="tr-t"></b><p class="tr-x"></p><div class="tr-btns"><button type="button" class="tr-skip">Skip the tour</button><button type="button" class="tr-next">Next</button></div></div>';
  document.body.appendChild(root);
  let i = 0, timer = null;
  const sh = k => root.querySelector('.tr-sh[data-s="' + k + '"]'), ring = root.querySelector('.tr-ring'), note = root.querySelector('.tr-note');
  const place = () => { const st = steps[i], el = st.at(); if(!el){ return; } const r = el.getBoundingClientRect(), pd = st.pad || 8;
    const x0 = Math.max(0, r.left - pd), y0 = Math.max(0, r.top - pd), x1 = Math.min(innerWidth, r.right + pd), y1 = Math.min(innerHeight, r.bottom + pd), free = st.free && st.free();
    root.classList.toggle('free', !!free);
    Object.assign(sh('t').style, {left: 0, top: 0, width: '100%', height: y0 + 'px'}); Object.assign(sh('b').style, {left: 0, top: y1 + 'px', width: '100%', height: Math.max(0, innerHeight - y1) + 'px'});
    Object.assign(sh('l').style, {left: 0, top: y0 + 'px', width: x0 + 'px', height: (y1 - y0) + 'px'}); Object.assign(sh('r').style, {left: x1 + 'px', top: y0 + 'px', width: Math.max(0, innerWidth - x1) + 'px', height: (y1 - y0) + 'px'});
    Object.assign(ring.style, {left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px'});
    const nw = note.offsetWidth || 300, nh = note.offsetHeight || 140; let nx = x1 + 18, ny = y0;
    if(nx + nw > innerWidth - 16){ nx = x0 - nw - 18; } if(nx < 16){ nx = Math.min(Math.max(16, x0), innerWidth - nw - 16); ny = y1 + 16; } if(ny + nh > innerHeight - 16) ny = Math.max(16, y0 - nh - 16);
    note.style.left = nx + 'px'; note.style.top = ny + 'px'; };
  const show = () => { const st = steps[i]; root.querySelector('.tr-k').textContent = (i + 1) + ' of ' + steps.length; root.querySelector('.tr-t').textContent = st.title; root.querySelector('.tr-x').textContent = st.text;
    const nx = root.querySelector('.tr-next'); nx.hidden = !!st.act; nx.textContent = i === steps.length - 1 ? 'Done' : 'Next'; place(); };
  const end = () => { clearInterval(timer); root.remove(); settings.tourDone = true; persistSettings({remote: false}); };
  const next = () => { i++; if(i >= steps.length){ end(); toast('You know Paper Map now. Enjoy your reading.'); return; } show(); };
  root.querySelector('.tr-next').addEventListener('click', next);
  root.querySelector('.tr-skip').addEventListener('click', end);
  timer = setInterval(() => { if(!document.getElementById('tour')){ clearInterval(timer); return; } const st = steps[i]; if(st.done && st.done()){ next(); return; } place(); }, 220);
  addEventListener('resize', () => { if(document.getElementById('tour')) place(); });
  show();
}
/* the gear: the same Look as the desk, and a few things for the map */
const WOODS = [['mahogany', 'Mahogany'], ['oak', 'Oak'], ['walnut', 'Walnut'], ['linen', 'Linen']];
function atlasLook(btn){
  const box = atlasPanel('atlLook'); if(!box.hidden){ box.hidden = true; return; }
  const pr = deskPrefs(), seg = (k, opts) => '<div class="lk-seg">' + opts.map(o => '<button type="button" data-lk="' + k + '" data-v="' + o[0] + '"' + (pr[k] === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  box.innerHTML = '<p class="atl-mk">DESK</p><div class="lk-woods">' + WOODS.map(w => '<button type="button" data-lk="wood" data-v="' + w[0] + '"' + (pr.wood === w[0] ? ' class="on"' : '') + ' title="' + w[1] + '" style="background-image:url(assets/desk/bg-' + w[0] + '.webp)"><span>' + w[1] + '</span></button>').join('') + '</div>' +
    '<p class="atl-mk">PAPER</p>' + seg('paper', [['creased', 'Creased'], ['smooth', 'Smooth']]) +
    '<p class="atl-mk">OPEN ON</p>' + seg('start', [['desk', 'The desk'], ['map', 'The last map']]) +
    '<p class="atl-mk">MAP</p><label class="lk-ck"><input type="checkbox" data-lk-set="showRelated"' + (settings.showRelated === false ? '' : ' checked') + '> Related-to lines</label><label class="lk-ck"><input type="checkbox" data-lk-set="readHints"' + (settings.readHints === false ? '' : ' checked') + '> What a paper cites, when I mark it read</label>' +
    '<div class="lk-btns">' + (window.__TAURI__ ? '<button type="button" data-lk-act="update">Check for updates</button>' : '') + '<button type="button" data-lk-act="guide">New to Paper Map?</button><button type="button" data-lk-act="tags">Tags</button><button type="button" data-lk-act="export">Back up</button><button type="button" data-lk-act="import">Restore</button><a data-lk-act="bm" href="#" title="Drag to your bookmarks bar">+ Paper Map</a></div>' +
    '<p class="lk-ver">Paper Map ' + esc(APP_VERSION) + '</p>';
  const bm = box.querySelector('[data-lk-act="bm"]'); try{ bm.setAttribute('href', bookmarkletHref()); }catch(e){}
  box.onclick = ev => { const b = ev.target.closest('[data-lk]'), act = ev.target.closest('[data-lk-act]');
    if(b){ settings.desk = Object.assign({}, deskPrefs(), {[b.dataset.lk]: b.dataset.v}); persistSettings(); atlasWood(); box.querySelectorAll('[data-lk="' + b.dataset.lk + '"]').forEach(x => x.classList.toggle('on', x === b)); try{ const pg = deskPage(); if(pg && pg.refresh) pg.refresh(); }catch(e){} return; }
    if(act){ const k = act.dataset.lkAct; if(k === 'bm'){ ev.preventDefault(); toast('Drag it to your bookmarks bar'); return; } box.hidden = true;
      if(k === 'update'){ try{ updCheck(true); }catch(e){} } else if(k === 'guide') setTimeout(atlasGuide, 0); else if(k === 'tags') setTimeout(openTagManager, 0); else if(k === 'export') exportBackup(); else if(k === 'import') importBackup(); } };
  box.onchange = ev => { const ck = ev.target.closest('[data-lk-set]'); if(!ck) return;
    if(ck.dataset.lkSet === 'showRelated'){ try{ setShowRelated(ck.checked); }catch(e){ settings.showRelated = ck.checked; persistSettings(); renderMap(true); } }
    else { settings.readHints = ck.checked; persistSettings(); } };
  box.hidden = false;
}
/* the notebook icon on the map page: a page of your notebook comes up out of it; click elsewhere and it goes back */
const NB_FONTS = {ink: "'PMap Ink',cursive", times: "'Times New Roman',Times,serif", georgia: 'Georgia,serif', helvetica: "'Helvetica Neue',Helvetica,Arial,sans-serif", courier: "'Courier New',Courier,monospace"};
let anT = null;
function atlasNoteBook(){ if(!Array.isArray(lib.notebooks) || !lib.notebooks.length) lib.notebooks = [{id: 'nb-' + Date.now().toString(36), font: 'ink', cur: 0, pages: [{text: '', date: null, edited: null}]}]; return lib.notebooks[lib.notebooks.length - 1]; }
function atlasNoteShow(){ const nb = atlasNoteBook(), i = lib.notebooks.length; nb.cur = Math.max(0, Math.min(59, nb.cur || 0)); while(nb.pages.length <= nb.cur) nb.pages.push({text: '', date: null, edited: null});
  const pg = nb.pages[nb.cur], t = document.getElementById('anText');
  t.style.fontFamily = NB_FONTS[nb.font] || NB_FONTS.ink; t.classList.toggle('hand', (nb.font || 'ink') === 'ink'); t.innerText = pg.text || '';
  document.getElementById('anName').textContent = 'Notebook ' + i;
  document.getElementById('anDate').textContent = new Date((pg.date || new Date().toISOString().slice(0, 10)) + 'T12:00:00').toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'short'});
  document.getElementById('anPg').textContent = (nb.cur + 1) + ' / 60'; }
function atlasNote(btn){
  let box = document.getElementById('atlNote');
  if(!box){ box = document.createElement('div'); box.id = 'atlNote'; box.className = 'atl-note'; box.hidden = true;
    box.innerHTML = '<div class="an-head"><b id="anName"></b><span id="anDate"></span><span class="an-nav"><button type="button" data-an="-1" aria-label="Page before">‹</button><span id="anPg"></span><button type="button" data-an="1" aria-label="Next page">›</button></span></div><div class="an-text" id="anText" contenteditable="true" spellcheck="false"></div>';
    document.body.appendChild(box);
    const t = box.querySelector('#anText');
    t.addEventListener('input', () => { const nb = atlasNoteBook(), pg = nb.pages[nb.cur]; pg.text = t.innerText.replace(/\n$/, ''); if(!pg.date) pg.date = new Date().toISOString().slice(0, 10); pg.edited = new Date().toISOString(); clearTimeout(anT); anT = setTimeout(() => { touchLib(); }, 500); });
    box.addEventListener('click', ev => { const nv = ev.target.closest('[data-an]'); if(!nv) return; const nb = atlasNoteBook(), n = nb.cur + +nv.dataset.an; if(n < 0 || n > 59) return; nb.cur = n; atlasNoteShow(); t.focus(); });
    document.addEventListener('mousedown', ev => { if(!box.hidden && !ev.target.closest('#atlNote,[data-atl="notebook"]')) atlasNoteClose(); });
    document.addEventListener('keydown', ev => { if(ev.key === 'Escape' && !box.hidden) atlasNoteClose(); }); }
  if(!box.hidden){ atlasNoteClose(); return; }
  atlasNoteShow(); box.hidden = false;
  const r = btn.getBoundingClientRect(), b = box.getBoundingClientRect();
  box.style.transformOrigin = (r.left + r.width / 2 - b.left) + 'px ' + (r.top + r.height / 2 - b.top) + 'px';
  box.animate([{transform: 'scale(.04)', opacity: 0}, {transform: 'scale(1)', opacity: 1}], {duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)'});
  setTimeout(() => { const t = document.getElementById('anText'); t.focus(); const rg = document.createRange(); rg.selectNodeContents(t); rg.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rg); }, 120);
}
function atlasNoteClose(){ const box = document.getElementById('atlNote'); if(!box || box.hidden) return; clearTimeout(anT); touchLib();
  const a = box.animate([{transform: 'scale(1)', opacity: 1}, {transform: 'scale(.04)', opacity: 0}], {duration: 300, easing: 'cubic-bezier(.4,0,.6,1)'});
  a.onfinish = () => { box.hidden = true; }; }
/* maps related to this one, without merging them: a pair in the related topics, kept and synced like every other line */
function atlasRelOf(tid){ const top = new Set(lib.topics.map(t => t.id)); return (lib.tlinks || []).filter(l => (l[0] === tid || l[1] === tid) && top.has(l[0]) && top.has(l[1])).map(l => l[0] === tid ? l[1] : l[0]); }
function atlasRel(){
  const box = document.getElementById('atlRel'); if(!box) return;
  const tp = lib.topics.find(t => t.id === ui.topic); if(!tp){ box.innerHTML = ''; return; }
  const rel = atlasRelOf(tp.id).map(id => lib.topics.find(t => t.id === id)).filter(Boolean);
  box.innerHTML = '<span class="atl-rk">Related to</span>' + rel.map(t => '<span class="atl-rc"><button type="button" data-rel-open="' + esc(t.id) + '" title="Open ' + esc(t.name) + '">' + esc(t.name) + '</button><button type="button" class="atl-rx" data-rel-off="' + esc(t.id) + '" aria-label="Not related to ' + esc(t.name) + '" title="Not related">×</button></span>').join('') +
    (lib.topics.length > 1 ? '<button type="button" class="atl-radd" data-rel-add="1" aria-label="Relate this map to another" title="Relate this map to another">' + (rel.length ? '+' : '+ a map') + '</button>' : '<span class="atl-rnone">no other maps yet</span>');
}
function atlasRelSet(a, b, on){
  if(!a || !b || a === b) return;
  const has = l => (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a);
  if(!Array.isArray(lib.tlinks)) lib.tlinks = [];
  if(on && !lib.tlinks.some(has)) lib.tlinks.push([a, b]);
  if(!on) lib.tlinks = lib.tlinks.filter(l => !has(l));
  touchLib(); atlasRel();
}
function atlasRelClick(ev){
  const o = ev.target.closest('[data-rel-open]'), off = ev.target.closest('[data-rel-off]'), add = ev.target.closest('[data-rel-add]'), pick = ev.target.closest('[data-rel-pick]');
  const menu = document.getElementById('atlRelMenu');
  if(o){ ev.stopPropagation(); menu.hidden = true; try{ if(ui.selected) select(null); }catch(e){} deskTouchRecent(o.dataset.relOpen); openView(o.dataset.relOpen + '-all'); return; }
  if(off){ ev.stopPropagation(); atlasRelSet(ui.topic, off.dataset.relOff, false); return; }
  if(add){ ev.stopPropagation(); const rel = new Set(atlasRelOf(ui.topic));
    menu.innerHTML = '<p class="atl-mk">RELATED TO OTHER MAPS</p>' + lib.topics.filter(t => t.id !== ui.topic && !t.shelf).map(t => '<button type="button" data-rel-pick="' + esc(t.id) + '"' + (rel.has(t.id) ? ' class="on"' : '') + '><b>' + (rel.has(t.id) ? '✓ ' : '') + esc(t.name) + '</b><span>' + (rel.has(t.id) ? 'related · click to undo' : 'mark as related') + '</span></button>').join('') + '<p class="atl-rnote">The maps stay apart; this only notes that they belong together.</p>';
    menu.hidden = !menu.hidden; return; }
  if(pick){ ev.stopPropagation(); const id = pick.dataset.relPick, on = !atlasRelOf(ui.topic).includes(id); atlasRelSet(ui.topic, id, on); menu.hidden = true; toast(on ? 'Related to “' + ((lib.topics.find(t => t.id === id) || {}).name || '') + '”' : 'No longer related'); }
}
function atlasMaps(){
  const box = document.getElementById('atlMaps');
  const n = tid => Object.values(lib.entries).filter(e => e.kind === 'paper' && e.topic === tid).length;
  box.innerHTML = '<p class="atl-mk">YOUR MAPS</p>' + lib.topics.filter(t => !t.shelf).map(t => '<button type="button" data-atl-map="' + esc(t.id) + '"' + (t.id === ui.topic ? ' class="on"' : '') + '><b>' + esc(t.name) + '</b><span>' + n(t.id) + (n(t.id) === 1 ? ' paper' : ' papers') + '</span></button>').join('') +
    (lib.minds || []).map(m => '<button type="button" data-atl-mind="' + esc(m.id) + '"><b>' + esc(m.name) + '</b><span>Mind map</span></button>').join('') +
    '<div class="atl-ms"></div><button type="button" data-atl-contents="1"><b>Contents</b><span>topics inside this map, and their order</span></button><button type="button" data-atl-merge="1"><b>Merge into another map…</b><span>this map becomes a topic inside another</span></button><button type="button" data-atl-new="1"><b>+ New map</b><span>for another field</span></button>';
}
function atlasTitle(){
  const T = document.getElementById('atlTitle'); if(!T) return;
  const tp = lib.topics.find(t => t.id === ui.topic);
  const ps = Object.values(lib.entries).filter(e => e.kind === 'paper' && (!tp || e.topic === tp.id) && typeof e.y === 'number');
  const ys = ps.map(e => e.y), n = lib.topics.length;
  atlasRel();
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
  const doi = e.doi ? String(e.doi).trim().replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, '') : '', url = /^https?:\/\//.test(e.l || '') ? e.l : (doi ? 'https://doi.org/' + doi : '');
  const D = [[1, '1'], [2, '2'], [3, '3'], ['all', 'All']];
  return '<div class="acard ' + stClass(e) + '">' +
    '<p class="ac-k">' + esc([e.y, e.v].filter(Boolean).join(' · ')) + '</p>' +
    '<h3 class="ac-t" data-open-card="' + e.id + '" tabindex="0" role="button">' + esc(e.t) + '</h3>' +
    (e.au ? '<p class="ac-a">' + esc(e.au) + '</p>' : '') +
    '<div class="ac-row"><span class="ac-st"><button type="button" class="stbtn want" data-st="want" data-id="' + e.id + '" aria-pressed="' + (st === 'want') + '">Want to read</button><button type="button" class="stbtn read" data-st="read" data-id="' + e.id + '" aria-pressed="' + (st === 'read') + '">Read</button></span>' +
    '<span class="ac-ic"><button type="button" class="ac-b" data-atl-link="' + e.id + '" title="Link it to another paper" aria-label="Link it to another paper">' + ATL_IC.target + '</button><button type="button" class="ac-b" data-reader="' + e.id + '" title="Notes and PDF" aria-label="Notes and PDF">' + ATL_IC.doc + '</button><button type="button" class="ac-b" data-open-lens="' + e.id + '" title="Lens: its line of thought (L)" aria-label="Lens">' + ATL_IC.metro + '</button>' +
    (url ? '<a class="ac-b" href="' + esc(url) + '" target="_blank" rel="noopener" title="Open the paper" aria-label="Open the paper">' + ATL_IC.link + '</a>' : '') +
    '<button type="button" class="ac-b" data-atl-more="' + e.id + '" title="The whole card" aria-label="More">' + ATL_IC.more + '</button></span></div>' +
    '<div class="ac-hf"><span class="ac-hk">How far</span>' + D.map(o => '<button type="button" class="ac-d' + (String(ui.depth) === String(o[0]) ? ' on' : '') + '" data-depth="' + o[0] + '">' + o[1] + '</button>').join('') +
    '<span class="ac-n">' + up + ' before · ' + down + ' after</span></div></div>' + citesHintHTML(e);
}

window.__pmAtlasCard = atlasCardHTML;
/* for the automated tests only: ?pmtest in the address opens a door to the library */
if(/[?&]pmtest\b/.test(location.search)) window.__pm = {lib: () => lib, touchLib, ghLoad, ghSaveNow, ui: () => ui, open: {entry: id => openEntryForm(id || null), topic: () => openTopicForm(), settings: () => openSettings(), tags: () => openTagManager(), reader: id => openReader(id), select: id => select(id), big: id => openBigCard(id, document.getElementById('info')), exportD: () => openExport(), importD: () => openImport(), lens: id => openLens(id), branch: () => openBranchForm(null)}};
const PDF_JS = 'assets/vendor/pdfjs/';
let pdfJsLoading = null, thumbQueue = Promise.resolve();
function loadPdfJs(){
  if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return pdfJsLoading || (pdfJsLoading = new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = PDF_JS + 'pdf.min.js';
    sc.onload = () => { try{ window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS + 'pdf.worker.min.js'; res(window.pdfjsLib); }catch(e){ rej(e); } }; sc.onerror = () => { pdfJsLoading = null; rej(new Error('pdf.js')); }; document.head.appendChild(sc); }));
}
function thumbStore(){ try{ return JSON.parse(localStorage.getItem('pm:thumbs') || '{}'); }catch(e){ return {}; } }
/* a page of a paper's PDF as a small picture: the page you chose, or else the first one, unless the first is a cover
   sheet a library or archive adds (JSTOR, SSRN, "This content downloaded from…"), in which case the second */
const COVER_RE = /JSTOR is a not-for-profit|This content downloaded from|Your use of the JSTOR archive|Terms (and|&) Conditions of Use|Electronic copy available at|For personal use only|All use subject to|Preprint not peer reviewed|Cover page/i;
function pdfPageAt(id, want){
  const e = lib.entries[id]; if(!e || !e.pdf) return Promise.resolve(null);
  const n0 = want || e.pdfPage || 0, key = e.pdf.path + '@' + (e.pdf.sha || '') + '#' + (n0 || 'auto'), have = thumbStore()[key];
  if(have) return Promise.resolve({u: have.u, n: have.n || n0 || 1, count: have.c || 0});
  /* one at a time, so a long list of papers does not fetch every PDF at once */
  const job = thumbQueue.then(async () => {
    const lib2 = await loadPdfJs(), url = await pdfUrl(e);
    const doc = await lib2.getDocument(url).promise, count = doc.numPages;
    let n = Math.max(1, Math.min(count, n0 || 1));
    if(!n0 && count > 1){ try{ const tc = await (await doc.getPage(1)).getTextContent(); if(COVER_RE.test(tc.items.map(x => x.str).join(' '))) n = 2; }catch(err){} }
    const page = await doc.getPage(n), v0 = page.getViewport({scale: 1}), sc = 300 / v0.width, vp = page.getViewport({scale: sc});
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    await page.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise; try{ doc.destroy(); }catch(err){}
    const u = cv.toDataURL('image/jpeg', 0.78), st = thumbStore(); st[key] = {u, t: Date.now(), n, c: count};
    const keys = Object.keys(st).sort((a2, b2) => st[b2].t - st[a2].t); keys.slice(80).forEach(k => delete st[k]);
    try{ localStorage.setItem('pm:thumbs', JSON.stringify(st)); }catch(err){}
    return {u, n, count};
  });
  thumbQueue = job.catch(() => null);
  return job;
}
function pdfFirstPage(id){ return pdfPageAt(id, 0).then(r => r && r.u).catch(() => null); }
/* merging maps: one map goes into another as a topic of its own; its papers and lines come with it */
function mergeMapInto(srcId, dstId){
  const A = lib.topics.find(t => t.id === srcId), B = lib.topics.find(t => t.id === dstId); if(!A || !B || A === B) return;
  const before = clone(lib);
  const own = A.subs.find(x => x.hidden);
  A.subs.forEach(x => { if(x.hidden){ x.hidden = false; x.name = A.name; } });
  if(own) A.subs.forEach(x => { if(x !== own && !x.parent) x.parent = own.id; });   /* its rows sit under its name */
  B.subs = B.subs.concat(A.subs);
  Object.values(lib.entries).forEach(e => { if(e.topic === srcId) e.topic = dstId; if(Array.isArray(e.mentions)) e.mentions = e.mentions.map(m => m === srcId ? (own ? own.id : dstId) : m); });
  if(Array.isArray(lib.tlinks)) lib.tlinks = lib.tlinks.map(l => l.map(x => x === srcId ? dstId : x)).filter(l => l[0] !== l[1]);
  lib.topics = lib.topics.filter(t => t !== A);
  if(Array.isArray(settings.lanes)) settings.lanes = [...new Set(settings.lanes.concat(B.subs.map(x => x.id)))];
  touchLib(); persistSettings();
  setUndo('merging ' + A.name, () => { Object.keys(lib).forEach(k => delete lib[k]); Object.assign(lib, before); touchLib(); renderAll(); });
  try{ deskTouchRecent(dstId); }catch(e){}
  openView(dstId + '-all'); renderAll();
  toast('“' + A.name + '” is now a topic inside “' + B.name + '”. Undo is at the top.');
}
function openMergeMaps(){
  const cur = lib.topics.find(t => t.id === ui.topic); if(!cur){ toast('Open the map you want to merge first'); return; }
  const others = lib.topics.filter(t => t !== cur);
  if(!others.length){ toast('There is no other map to merge it into'); return; }
  const n = Object.values(lib.entries).filter(e => e.kind === 'paper' && e.topic === cur.id).length;
  openModal({title: 'Merge “' + cur.name + '” into another map', body: '<p class="hint">“' + esc(cur.name) + '” and its ' + n + (n === 1 ? ' paper' : ' papers') + ' become a topic inside the map you choose, with its rows, lines and notes. You can undo it straight after.</p>' +
    '<div class="atl-merge">' + others.map((t, i) => '<label><input type="radio" name="mergeTo" value="' + esc(t.id) + '"' + (i ? '' : ' checked') + '><b>' + esc(t.name) + '</b><span>' + Object.values(lib.entries).filter(e => e.kind === 'paper' && e.topic === t.id).length + ' papers</span></label>').join('') + '</div>',
    actions: [{label: 'Cancel'}, {label: 'Merge', primary: true, onClick: body => { const r = body.querySelector('input[name="mergeTo"]:checked'); if(r) setTimeout(() => mergeMapInto(cur.id, r.value), 0); }}]});
}
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
  openModal = function(){ if(DK.shown) deskOver(true); return _om.apply(this, arguments); };
  closeModal = function(){ const r = _cm.apply(this, arguments); setTimeout(deskOverDone, 0); deskComeBack(); return r; }; }
/* dialogs and Notes & PDF come up over the desk, on a blurred veil, and the desk stays where it was */
function deskOver(on){ document.documentElement.classList.toggle('over-desk', !!on && DK.shown); }
function deskOverDone(){ const mr = document.getElementById('modalRoot'), rd = document.getElementById('reader'); if((!mr || mr.hidden) && (!rd || rd.hidden)) deskOver(false); }
/* when what the desk handed you over to closes, you are back where you were on the desk, never left on a map */
function deskComeBack(){ if(!DK.handoff) return;
  setTimeout(() => { const mr = document.getElementById('modalRoot'), rd = document.getElementById('reader');
    if((mr && !mr.hidden) || (rd && !rd.hidden)) return; DK.handoff = false; deskOpen(); }, 80); }
{ const _cr = closeReader; closeReader = function(){ const r = _cr.apply(this, arguments); setTimeout(deskOverDone, 0); deskComeBack(); return r; }; }
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
