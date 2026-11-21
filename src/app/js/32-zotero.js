/* ===================== Zotero =====================
   Your Zotero library, read into Paper Map through Zotero's own web interface (free; you make an API key on zotero.org).
   What goes where, and nothing else: an item becomes a paper (a book becomes a book in Readings), a collection a map and
   its sub-collections its topics, tags stay tags (read and to-read mark a paper read or wanted), a child note joins the
   paper's notes, PDF and EPUB annotations become its highlights and sticky notes, and its PDF or EPUB opens from Zotero's
   storage. Paper Map keeps a record of which Zotero item is which paper, so nothing is ever added twice.
   It only reads: nothing is ever written to Zotero. */
const ZT = {busy: false, timer: null};
const ZAPI = 'https://api.zotero.org';
const ZPAPER = new Set(['journalArticle', 'conferencePaper', 'preprint', 'report', 'thesis', 'bookSection', 'magazineArticle', 'newspaperArticle', 'manuscript', 'workingPaper', 'webpage', 'blogPost', 'presentation', 'document', 'encyclopediaArticle', 'dictionaryEntry', 'case', 'statute', 'patent', 'dataset']);
function ztCfg(){ try{ return JSON.parse(localStorage.getItem('pm:zotero') || 'null'); }catch(e){ return null; } }
function ztSave(c){ try{ localStorage.setItem('pm:zotero', JSON.stringify(c)); }catch(e){} }
async function ztGet(c, path){ const r = await fetch(ZAPI + path, {headers: {'Zotero-API-Key': c.key, 'Zotero-API-Version': '3'}}); if(!r.ok) throw new Error('Zotero ' + r.status); return r; }
async function ztAll(c, path){ let out = [], start = 0, ver = 0;
  for(;;){ const r = await ztGet(c, path + (path.includes('?') ? '&' : '?') + 'limit=100&start=' + start); ver = Math.max(ver, +(r.headers.get('Last-Modified-Version') || 0)); const j = await r.json(); out = out.concat(j);
    const total = +(r.headers.get('Total-Results') || j.length); start += j.length; if(!j.length || start >= total) break; }
  return {items: out, version: ver}; }
const ztYear = d => { const m = String(d || '').match(/\b(1[5-9]\d\d|20\d\d)\b/); return m ? +m[1] : null; };
const ztAuthors = cr => (cr || []).filter(x => !x.creatorType || /author|editor|contributor/.test(x.creatorType)).map(x => x.lastName ? x.lastName + (x.firstName ? ', ' + x.firstName.split(/[\s.]+/).filter(Boolean).map(w => w[0].toUpperCase() + '.').join(' ') : '') : (x.name || '')).filter(Boolean);
function ztMd(html){ const d = document.createElement('div'); d.innerHTML = String(html || ''); const out = [];
  d.querySelectorAll('h1,h2,h3,p,li,blockquote,pre').forEach(n => { if(n.closest('li') && n.tagName !== 'LI') return; const t = n.textContent.replace(/\s+/g, ' ').trim(); if(!t) return;
    out.push(n.tagName === 'LI' ? '- ' + t : n.tagName === 'BLOCKQUOTE' ? '> ' + t : /^H\d$/.test(n.tagName) ? '### ' + t : t); });
  return out.length ? out.join('\n') : d.textContent.trim(); }
/* Zotero's tree, copied into Papers: a top-level collection is a folder, every collection inside it a folder inside that,
   to any depth; a folder that is already there under the same name and in the same place is used, not doubled */
function ztTopicFor(c, colls, key){
  c.map = c.map || {}; const byKey = {}; colls.forEach(x => byKey[x.key] = x.data);
  if(!byKey[key]) return null;
  let top = key; while(byKey[top].parentCollection && byKey[byKey[top].parentCollection]) top = byKey[top].parentCollection;
  let tp = lib.topics.find(t => t.id === c.map[top]);
  const same = (x, y) => ztName(x) === ztName(y);
  if(!tp){ tp = lib.topics.find(t => t.shelf && same(t.name, byKey[top].name)) || null;
    if(!tp){ tp = {id: rid('t'), name: byKey[top].name, shelf: true, subs: [{id: rid('s'), name: byKey[top].name, desc: '', groups: [], hidden: true}]}; lib.topics.push(tp); }
    c.map[top] = tp.id; }
  const root = tp.subs.find(s => s.hidden) || tp.subs[0];
  if(key === top) return {topic: tp.id, sub: root.id};
  const pk = byKey[key].parentCollection, up = pk && pk !== top ? ztTopicFor(c, colls, pk) : null, parentId = up ? up.sub : null;
  let sub = tp.subs.find(s => s.id === c.map[key]);
  if(!sub){ sub = tp.subs.find(s => !s.hidden && same(s.name, byKey[key].name) && (s.parent || null) === parentId) || null;
    if(!sub){ const anywhere = tp.subs.filter(s => !s.hidden && same(s.name, byKey[key].name)); if(anywhere.length === 1) sub = anywhere[0]; }
    if(!sub){ sub = {id: rid('s'), name: byKey[key].name, desc: '', groups: []}; if(parentId) sub.parent = parentId; tp.subs.push(sub); }
    c.map[key] = sub.id; }
  return {topic: tp.id, sub: sub.id};
}
/* every chosen collection gets its folder, even one with nothing in it yet */
function ztMirror(c, colls, chosen){ colls.forEach(x => { if(chosen.has(x.key)) ztTopicFor(c, colls, x.key); }); }
function ztInbox(c){ c.map = c.map || {}; let tp = lib.topics.find(t => t.id === c.map['@inbox']);
  if(!tp){ tp = {id: rid('t'), name: 'From Zotero', shelf: true, subs: [{id: rid('s'), name: 'From Zotero', desc: '', groups: [], hidden: true}]}; lib.topics.push(tp); c.map['@inbox'] = tp.id; }
  return {topic: tp.id, sub: (tp.subs.find(x => x.hidden) || tp.subs[0]).id}; }
function ztTagIds(tags){ return (tags || []).map(t => t.tag).filter(t => !/^(read|to-?read|want to read)$/i.test(t)).map(name => { let x = lib.tags.find(z => z.name.toLowerCase() === name.toLowerCase()); if(!x) x = newTag(name); return x.id; }); }
function ztStatusOf(tags){ const n = (tags || []).map(t => t.tag.toLowerCase()); return n.includes('read') ? 'read' : n.some(t => /^to-?read$|^want to read$/.test(t)) ? 'want' : null; }
async function ztSync(manual){
  const c = ztCfg(); if(!c || !c.key || ZT.busy) return; ZT.busy = true; c.items = c.items || {}; c.children = c.children || {};
  try{
    const colls = (await ztAll(c, '/users/' + c.user + '/collections')).items;
    const chosen = new Set(c.include === 'all' || !c.include ? colls.map(x => x.key) : c.include);
    const {items, version} = await ztAll(c, '/users/' + c.user + '/items' + (c.version ? '?since=' + c.version : ''));
    let made = 0, updated = 0, notes = 0, marks = 0;
    const tops = items.filter(i => !i.data.parentItem && i.data.itemType !== 'attachment' && i.data.itemType !== 'note' && i.data.itemType !== 'annotation');
    const unfiled = it => !(it.data.collections || []).length && c.unfiled !== false;
    const ZL = ztLib(); lib.ztree = colls.filter(x => chosen.has(x.key)).map(x => ({key: x.key, name: x.data.name, parent: x.data.parentCollection && chosen.has(x.data.parentCollection) ? x.data.parentCollection : null}));
    try{ ztUnfold(c); }catch(err){}
    tops.forEach(it => { const d = it.data, inSel = (d.collections || []).filter(k => chosen.has(k)); if(!inSel.length && !(c.items[it.key]) && !unfiled(it)) return;
      const st = ztStatusOf(d.tags), title = (d.title || '').trim(); if(!title) return;
      if(typeof c.items[it.key] === 'string' && c.items[it.key].startsWith('r:')){ R_ztBook(c, it, st) === 'new' ? made++ : updated++; return; }
      const doiOf = s => String(s || '').toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').trim(), tnorm = s => ztName(s).replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').trim();
      const zdoi = doiOf(d.DOI), zt = tnorm(d.title), zy = (String(d.date || '').match(/\d{4}/) || [])[0];
      let e = (c.items[it.key] && lib.entries[c.items[it.key]]) || Object.values(lib.entries).find(x => x.zkey === it.key)
        || Object.values(lib.entries).find(x => x.kind === 'paper' && !x.zkey && ((zdoi && doiOf(x.doi) === zdoi) || (zt && tnorm(x.t) === zt && (!zy || !x.y || String(x.y) === zy)))) || null;
      if(e) c.items[it.key] = e.id;
      const depth = k => { let n = 0, x = colls.find(cc => cc.key === k); while(x && x.data.parentCollection){ n++; x = colls.find(cc => cc.key === x.data.parentCollection); } return n; };
      inSel.sort((a, b) => depth(b) - depth(a));
      const place = e ? {topic: e.topic, sub: e.sub} : {topic: ZL.id, sub: ZL.subs[0].id};
      if(!e){ const id = rid('z'); e = {id, kind: 'paper', t: title, au: '', y: null, topic: place.topic, sub: place.sub, tags: [], d: [], p: 1, group: '', n: ''}; lib.entries[id] = e; c.items[it.key] = id; made++; } else updated++;
      e.ztype = d.itemType; e.zkey = it.key; e.zcolls = (d.collections || []).filter(k => chosen.has(k)); if(d.itemType && !ZPAPER.has(d.itemType) && !e.l) e.l = ({book: 'Book', bookSection: 'Book chapter', encyclopediaArticle: 'Encyclopedia', dictionaryEntry: 'Dictionary', presentation: 'Talk', document: 'Document'})[d.itemType] || '';
      Object.assign(e, {t: title, au: ztAuthors(d.creators).join(' & '), y: ztYear(d.date) || e.y, v: d.publicationTitle || d.proceedingsTitle || d.bookTitle || d.institution || d.university || d.repository || e.v || '', doi: d.DOI || e.doi || '', l: d.url || e.l || '', zkey: it.key});
      const tg = ztTagIds(d.tags); e.tags = [...new Set((e.tags || []).concat(tg))];
      if(st){ const k = keyOf(e); if(status[k] !== st){ status[k] = st; statusTime = Date.now(); } } });
    /* what hangs under an item: notes, files, annotations */
    const parentOf = {}; items.forEach(i => { if(i.data.parentItem) parentOf[i.key] = i.data.parentItem; });
    const known = k => c.items[k] || (c.children[k] && c.children[k].owner);
    items.filter(i => i.data.itemType === 'note' && i.data.parentItem && c.items[i.data.parentItem]).forEach(i => { const tid = c.items[i.data.parentItem], md = ztMd(i.data.note);
      if(tid.startsWith('r:')){ const b = (lib.readings || []).find(x => x.id === tid.slice(2)); if(b && !(b.zNotes || []).includes(i.key)){ b.notes = [b.notes, md].filter(Boolean).join('\n\n'); b.zNotes = (b.zNotes || []).concat([i.key]); notes++; } }
      else { const e = lib.entries[tid]; if(e && !(e.zNotes || []).includes(i.key)){ e.n = [e.n, md].filter(Boolean).join('\n\n'); e.zNotes = (e.zNotes || []).concat([i.key]); notes++; } } });
    items.filter(i => i.data.itemType === 'attachment' && i.data.parentItem && c.items[i.data.parentItem] && /pdf|epub/i.test(i.data.contentType || '') && /imported/.test(i.data.linkMode || '')).forEach(i => { const tid = c.items[i.data.parentItem], f = {name: i.data.filename || i.data.title || 'file', zotero: i.key, size: 0, type: i.data.contentType, where: 'zotero'};
      c.children[i.key] = {owner: tid};
      if(tid.startsWith('r:')){ const b = (lib.readings || []).find(x => x.id === tid.slice(2)); if(b && !(b.files || []).some(x => x.zotero === i.key)) b.files = (b.files || []).concat([f]); }
      else { const e = lib.entries[tid]; if(e && !e.pdf && /pdf/i.test(i.data.contentType)) e.pdf = {path: 'zotero:' + i.key, name: f.name, zotero: i.key}; } });
    items.filter(i => i.data.itemType === 'annotation').forEach(i => { const att = i.data.parentItem, owner = c.children[att] && c.children[att].owner; if(!owner) return; const d = i.data;
      let pos = null; try{ pos = typeof d.annotationPosition === 'string' ? JSON.parse(d.annotationPosition) : d.annotationPosition; }catch(e){}
      const m = {id: 'za-' + i.key, src: 'zotero', zkey: i.key, text: d.annotationText || '', color: d.annotationColor ? d.annotationColor + '66' : 'rgba(226,182,72,.42)', date: (d.dateModified || '').slice(0, 10), loc: d.annotationPageLabel ? 'p. ' + d.annotationPageLabel : ''};
      if(pos && pos.type === 'FragmentSelector' && pos.value) m.cfi = pos.value; else if(pos && typeof pos.pageIndex === 'number'){ m.page = pos.pageIndex + 1; m.zr = pos.rects || []; }
      if(d.annotationType === 'note'){ m.kind = 'note'; m.text = d.annotationComment || ''; } else if(d.annotationComment) m.note = d.annotationComment;
      const list = owner.startsWith('r:') ? (((lib.readings || []).find(x => x.id === owner.slice(2)) || {}).marks || null) : (lib.entries[owner] ? (lib.entries[owner].marks = lib.entries[owner].marks || []) : null);
      const host = owner.startsWith('r:') ? (lib.readings || []).find(x => x.id === owner.slice(2)) : null; const arr = host ? (host.marks = host.marks || []) : list; if(!arr) return;
      const k = arr.findIndex(x => x.zkey === i.key); if(k >= 0) arr[k] = Object.assign(arr[k], m); else { arr.push(m); marks++; } });
    c.version = Math.max(c.version || 0, version); c.last = Date.now(); ztSave(c); reindex(); touchLib(); persistStatus(); try{ renderAll(); }catch(e){}
    if(manual || made || notes || marks) toast('Zotero: ' + made + ' new, ' + updated + ' brought up to date' + (notes ? ', ' + notes + ' notes' : '') + (marks ? ', ' + marks + ' highlights and sticky notes' : ''));
  }catch(err){ if(manual) toast('Zotero could not be reached just now (' + String((err && err.message) || err).slice(0, 60) + ')'); }
  ZT.busy = false;
}
function R_ztBook(c, it, st){ const d = it.data; lib.readings = lib.readings || []; let b = c.items[it.key] && lib.readings.find(x => 'r:' + x.id === c.items[it.key]), isNew = false;
  if(!b){ b = {id: rid('r'), title: d.title, authors: [], status: st === 'read' ? 'read' : st === 'want' ? 'want' : 'reading', categories: [], notes: '', onMaps: [], added: new Date().toISOString()}; lib.readings.push(b); c.items[it.key] = 'r:' + b.id; isNew = true; }
  Object.assign(b, {title: d.title, authors: (d.creators || []).map(x => x.lastName ? [x.firstName, x.lastName].filter(Boolean).join(' ') : (x.name || '')).filter(Boolean), year: ztYear(d.date) || b.year || null, isbn: (d.ISBN || '').split(/\s+/)[0] || b.isbn || null, pages: +(d.numPages || 0) || b.pages || null, zkey: it.key});
  if(st && st !== b.status && st !== 'want') b.status = st; return isNew ? 'new' : 'old'; }
/* a PDF from Zotero's storage: the page asks first; Zotero's storage does not let a page read across sites, so in the Mac app
   the system fetches it instead. Whatever comes back is checked to be the file, not an error page. */
let ZT_WHY = '';
async function ztFileBlob(c, key, name){ const url = ZAPI + '/users/' + c.user + '/items/' + key + '/file'; ZT_WHY = '';
  if(window.__TAURI__ && window.__TAURI__.core){ try{ const b = await ztLocalFile(key, name); if(b) return b; ZT_WHY = 'not in ' + ((await ztDataDir()) || '~/Zotero') + '/storage/' + key; }catch(e){ ZT_WHY = 'reading Zotero’s folder: ' + String(e && e.message || e).slice(0, 80); } }
  const real = b => b && b.size > 800 && !/json|html|xml/i.test(b.type || '');
  try{ const r = await fetch(url, {headers: {'Zotero-API-Key': c.key, 'Zotero-API-Version': '3'}}); if(r.ok){ const b = await r.blob(); if(real(b)) return b; ZT_WHY += (ZT_WHY ? '; ' : '') + 'zotero.org sent no PDF'; } else ZT_WHY += (ZT_WHY ? '; ' : '') + 'zotero.org: ' + r.status + (r.status === 404 ? ' (the file is not in Zotero’s online storage)' : ''); }catch(e){ ZT_WHY += (ZT_WHY ? '; ' : '') + 'zotero.org could not be reached from here'; }
  if(window.__TAURI__ && window.__TAURI__.core){ try{ const buf = await window.__TAURI__.core.invoke('fetch_bytes', {url, headers: [['Zotero-API-Key', c.key], ['Zotero-API-Version', '3']]});
      const b = new Blob([buf], {type: 'application/pdf'}); if(real(b)) return b; }catch(e){} }
  return null; }
/* connecting: the key, then which collections */
function openZotero(){
  const c = ztCfg();
  if(!c){ openModal({title: 'Zotero', body: '<p class="zt-p">Make a key on zotero.org that can read your library (reading is all it needs), then paste it here.</p><p><a href="https://www.zotero.org/settings/keys/new" target="_blank" rel="noopener">Make a key</a></p><label class="zt-l">Key<input type="password" id="ztKey" autocomplete="off" spellcheck="false"></label><p class="zt-err" id="ztErr"></p>',
    actions: [{label: 'Cancel'}, {label: 'Connect', primary: true, onClick: () => { (async () => { const key = (document.getElementById('ztKey').value || '').trim(); if(!key) return;
      try{ const r = await fetch(ZAPI + '/keys/' + encodeURIComponent(key), {headers: {'Zotero-API-Version': '3'}}); if(!r.ok) throw 0; const j = await r.json(); ztSave({key, user: j.userID, name: j.username, include: 'all', items: {}, children: {}, map: {}}); closeModal(); setTimeout(ztChoose, 0); }
      catch(e){ document.getElementById('ztErr').textContent = 'That key did not work. Check it, and that it can read your library.'; } })(); return false; }}]}); return; }
  ztChoose();
}
async function ztChoose(){ const c = ztCfg(); if(!c) return; let colls = [];
  try{ colls = (await ztAll(c, '/users/' + c.user + '/collections')).items; }catch(e){ toast('Zotero could not be reached just now'); return; }
  const tops = colls.filter(x => !x.data.parentCollection), on = k => c.include === 'all' || (c.include || []).includes(k);
  openModal({title: 'Zotero' + (c.name ? ' · ' + c.name : ''), body: '<p class="zt-p">Choose the collections to bring in. They come into Papers as folders.</p><div class="zt-list">' + tops.map(t => '<label><input type="checkbox" data-zc="' + esc(t.key) + '"' + (on(t.key) ? ' checked' : '') + '> ' + esc(t.data.name) + '<em>' + (t.meta && t.meta.numItems != null ? t.meta.numItems + ' items' : '') + '</em></label>').join('') + '<label><input type="checkbox" data-zunf="1"' + (c.unfiled !== false ? ' checked' : '') + '> Not in any collection<em>to the folder From Zotero</em></label></div>' + (c.last ? '<p class="zt-p">Last brought in ' + new Date(c.last).toLocaleString('en-GB') + '</p>' : ''),
    actions: [{label: 'Disconnect', onClick: () => { localStorage.removeItem('pm:zotero'); toast('Zotero disconnected; what came from it stays'); }}, {label: 'Bring them in', primary: true, onClick: () => {
      const keys = [...document.querySelectorAll('#modalBody [data-zc]')].filter(x => x.checked).map(x => x.dataset.zc), cc = ztCfg(); const subs = colls.filter(x => { let p = x.data.parentCollection; while(p){ if(keys.includes(p)) return true; const q = colls.find(y => y.key === p); p = q && q.data.parentCollection; } return false; }).map(x => x.key);
      cc.include = keys.length === tops.length ? 'all' : keys.concat(subs); const u = document.querySelector('#modalBody [data-zunf]'); cc.unfiled = !!(u && u.checked); ztSave(cc); setTimeout(() => ztSync(true), 0); }}]});
  setTimeout(() => { try{ settingsTidy && document.getElementById('modalRoot').classList.add('pm-settings'); }catch(e){} }, 0);
}
if(!PREVIEW){ setTimeout(() => { if(ztCfg()) ztSync(false); }, 5000); setInterval(() => { if(ztCfg() && document.visibilityState === 'visible') ztSync(false); }, 5 * 60e3); }
/* ===================== back one step, never all the way =====================
   A dialog opened from Settings closes back into Settings, where you were in it; Settings closes back to whatever
   opened it (the desk's settings panel, say), not past it. */
let SET_OPEN = false, SET_CHILD = false, SET_SCROLL = 0, SET_BACK = null, SET_OPENING = false, SET_T = null, SET_PENDING = null;
/* a dialog may open a moment after the one before it closes, so the step back waits a little before deciding */
{ const _os2 = openSettings; openSettings = function(back){ if(typeof back === 'function') SET_BACK = back; clearTimeout(SET_T); SET_PENDING = null; SET_OPENING = true; let r; try{ r = _os2.apply(this, []); } finally { SET_OPENING = false; } SET_OPEN = true; SET_CHILD = false; return r; }; }
{ const _om = openModal; openModal = function(o){ if(!SET_OPENING){ if(SET_OPEN){ const mb = document.querySelector('#modalRoot .modal'); SET_SCROLL = mb ? mb.scrollTop : 0; SET_OPEN = false; SET_CHILD = true; }
    else if(SET_PENDING){ clearTimeout(SET_T); SET_PENDING = null; SET_CHILD = true; } }
  return _om.apply(this, arguments); }; }
{ const _cm = closeModal; closeModal = function(){ const wasSettings = SET_OPEN, wasChild = SET_CHILD;
  if(wasSettings){ const mb = document.querySelector('#modalRoot .modal'); SET_SCROLL = mb ? mb.scrollTop : 0; }
  const r = _cm.apply(this, arguments);
  if(wasSettings || wasChild){ SET_OPEN = false; SET_CHILD = false; SET_PENDING = wasSettings ? 'settings' : 'child'; clearTimeout(SET_T);
    SET_T = setTimeout(() => { const k = SET_PENDING; SET_PENDING = null; if(!k || !modal.root.hidden) return;
      if(k === 'settings'){ const b = SET_BACK; SET_BACK = null; if(b){ try{ b(); }catch(e){} } }
      else { const back = SET_SCROLL; openSettings(); [30, 160, 360].forEach(t => setTimeout(() => { const mb = document.querySelector('#modalRoot .modal'); if(mb && !modal.root.hidden) mb.scrollTop = back; }, t)); } }, 420); }
  return r; }; }

/* folders that came in twice (an earlier connection) are put back together, and a paper that came in twice is kept once */
function ztName(s){ return String(s || '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
function ztMergeTwins(){ const key = t => ztName(t.name); const shelf = lib.topics.filter(t => t.shelf); const seen = {}; let merged = 0;
  shelf.forEach(t => { const k = key(t); if(!seen[k]){ seen[k] = t; return; } const K = seen[k], rootK = K.subs.find(s => s.hidden) || K.subs[0], rootD = t.subs.find(s => s.hidden) || t.subs[0], subMap = {};
    if(rootD) subMap[rootD.id] = rootK.id;
    const order = t.subs.filter(s => !s.hidden); let left = order.slice(), guard = 0;
    while(left.length && guard++ < 999){ const s = left.shift(); const par = s.parent ? subMap[s.parent] : null; if(s.parent && !par){ left.push(s); continue; }
      const twin = K.subs.find(x => !x.hidden && key(x) === key(s) && (x.parent || null) === (par || null));
      if(twin) subMap[s.id] = twin.id; else { const n = Object.assign({}, s); if(par) n.parent = par; else delete n.parent; K.subs.push(n); subMap[s.id] = n.id; } }
    Object.values(lib.entries).forEach(e => { if(e.topic === t.id){ e.topic = K.id; e.sub = subMap[e.sub] || rootK.id; } if(e.folder === t.id){ e.folder = K.id; e.fsub = subMap[e.fsub] || rootK.id; } });
    lib.topics = lib.topics.filter(x => x !== t); merged++; });
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').trim(); const byT = {}; let gone = 0;
  Object.values(lib.entries).filter(e => e.kind === 'paper').forEach(e => { const k = (e.doi ? 'doi:' + String(e.doi).toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '') : norm(e.t) + '|' + (e.y || ''));
    const o = byT[k]; if(!o){ byT[k] = e; return; } const onMap = x => { const t = lib.topics.find(tt => tt.id === x.topic); return t && !t.shelf; };
    const keep = (onMap(e) && !onMap(o)) || ((e.pdf && !o.pdf) && !(onMap(o) && !onMap(e))) || ((e.n || '').length > (o.n || '').length && onMap(e) === onMap(o)) ? e : o, drop = keep === e ? o : e;
    if(!keep.folder && drop.folder){ keep.folder = drop.folder; keep.fsub = drop.fsub; } if(!keep.n && drop.n) keep.n = drop.n; if((drop.marks || []).length && !(keep.marks || []).length) keep.marks = drop.marks;
    if(!keep.zkey && drop.zkey) keep.zkey = drop.zkey; if(!keep.pdf && drop.pdf) keep.pdf = drop.pdf; lib.links = (lib.links || []).map(l => l.map(x => x === drop.id ? keep.id : x));
    delete lib.entries[drop.id]; byT[k] = keep; gone++; });
  if(merged || gone){ try{ reindex(); }catch(e){} touchLib(); } return [merged, gone]; }

/* Zotero's own folder on this Mac: where Zotero says it is (its settings name the data folder when it is not the usual one),
   else ~/Zotero. A file is found by its attachment's folder in storage, or, if that fails, by its name anywhere in storage. */
let ZT_DIR = null;
async function ztDataDir(){ if(ZT_DIR) return ZT_DIR; const inv = window.__TAURI__.core.invoke, pl = await inv('storage_places'); if(!pl || !pl.home) return null;
  let dir = pl.home + '/Zotero';
  try{ const prof = pl.home + '/Library/Application Support/Zotero/Profiles'; const list = await inv('fs_list', {path: prof}) || [];
    for(const p of list){ const nm = p.name || p; try{ const txt = atob(await inv('fs_read', {path: prof + '/' + nm + '/prefs.js'}));
        const use = /user_pref\("extensions\.zotero\.useDataDir",\s*true\)/.test(txt), m = txt.match(/user_pref\("extensions\.zotero\.dataDir",\s*"([^"]+)"\)/);
        if(use && m){ dir = m[1].replace(/\\\\/g, '\\'); break; } }catch(e){} } }catch(e){}
  return (ZT_DIR = dir); }
function b64ToBlob(b64, type){ const bin = atob(b64), u = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], {type}); }
async function ztLocalFile(key, name){ const inv = window.__TAURI__.core.invoke, dir = await ztDataDir(); if(!dir) return null; const store = dir + '/storage';
  const type = /\.epub$/i.test(name || '') ? 'application/epub+zip' : 'application/pdf';
  try{ const inside = await inv('fs_list', {path: store + '/' + key}) || []; const files = inside.map(x => x.name || x).filter(n => /\.(pdf|epub)$/i.test(n));
    const pick = files.find(n => n === name) || files[0]; if(pick) return b64ToBlob(await inv('fs_read', {path: store + '/' + key + '/' + pick}), type); }catch(e){}
  if(name){ try{ const dirs = await inv('fs_list', {path: store}) || []; for(const d of dirs){ const dn = d.name || d; try{ const st = await inv('fs_stat', {path: store + '/' + dn + '/' + name}); if(st) return b64ToBlob(await inv('fs_read', {path: store + '/' + dn + '/' + name}), type); }catch(e){} } }catch(e){} }
  return null; }

/* the Zotero library inside Papers: a hidden holder for its papers (they are shown by their Zotero collections, not by a folder) */
function ztLib(){ let t = lib.topics.find(x => x.id === 'ztlib'); if(!t){ t = {id: 'ztlib', name: 'Zotero', shelf: true, ztlib: true, subs: [{id: 'ztlib-r', name: 'Zotero', desc: '', groups: [], hidden: true}]}; lib.topics.push(t); } return t; }
/* once: the folders earlier versions made from Zotero go back into the Zotero library; your own folders, and papers you put in them, stay */
function ztUnfold(c){ if(lib.ztUnfolded) return; const made = new Set(Object.values(c.map || {})); const ZL = ztLib();
  lib.topics.filter(t => t.shelf && !t.ztlib && made.has(t.id)).forEach(t => {
    Object.values(lib.entries).forEach(e => { if(e.zkey && (e.folder === t.id || e.topic === t.id)){ if(e.topic === t.id){ e.topic = ZL.id; e.sub = ZL.subs[0].id; } if(e.folder === t.id){ delete e.folder; delete e.fsub; } } });
    const left = Object.values(lib.entries).some(e => e.topic === t.id || e.folder === t.id); if(!left) lib.topics = lib.topics.filter(x => x !== t); });
  lib.ztUnfolded = true; try{ reindex(); }catch(e){} touchLib(); }
