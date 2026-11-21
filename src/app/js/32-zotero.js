/* ===================== Zotero =====================
   Your Zotero library, read into Paper Map through Zotero's own web interface (free; you make an API key on zotero.org).
   What goes where, and nothing else: an item becomes a paper (a book becomes a book in Readings), a collection a map and
   its sub-collections its topics, tags stay tags (read and to-read mark a paper read or wanted), a child note joins the
   paper's notes, PDF and EPUB annotations become its highlights and sticky notes, and its PDF or EPUB opens from Zotero's
   storage. Paper Map keeps a record of which Zotero item is which paper, so nothing is ever added twice. */
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
/* collections → maps and their topics: a top-level collection is a map, the ones inside it its topics */
function ztTopicFor(c, colls, key){
  c.map = c.map || {}; const byKey = {}; colls.forEach(x => byKey[x.key] = x.data);
  let top = key; while(byKey[top] && byKey[top].parentCollection) top = byKey[top].parentCollection;
  if(!byKey[top]) return null;
  let tp = lib.topics.find(t => t.id === c.map[top]);
  if(!tp){ tp = {id: rid('t'), name: byKey[top].name, shelf: true, subs: [{id: rid('s'), name: byKey[top].name, desc: '', groups: [], hidden: true}]}; lib.topics.push(tp); c.map[top] = tp.id; }
  if(key === top) return {topic: tp.id, sub: (tp.subs.find(s => s.hidden) || tp.subs[0]).id};
  let sub = tp.subs.find(s => s.id === c.map[key]);
  if(!sub){ const parentKey = byKey[key].parentCollection, parentSub = parentKey && parentKey !== top ? tp.subs.find(s => s.id === c.map[parentKey]) : null;
    sub = {id: rid('s'), name: byKey[key].name, desc: '', groups: []}; if(parentSub) sub.parent = parentSub.id; tp.subs.push(sub); c.map[key] = sub.id; }
  return {topic: tp.id, sub: sub.id};
}
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
    tops.forEach(it => { const d = it.data, inSel = (d.collections || []).filter(k => chosen.has(k)); if(!inSel.length && !(c.items[it.key]) && !unfiled(it)) return;
      const st = ztStatusOf(d.tags), title = (d.title || '').trim(); if(!title) return;
      if(d.itemType === 'book'){ R_ztBook(c, it, st) === 'new' ? made++ : updated++; return; }
      if(!ZPAPER.has(d.itemType)) return;
      let e = c.items[it.key] && lib.entries[c.items[it.key]];
      const place = (e ? {topic: e.topic, sub: e.sub} : null) || (inSel[0] ? ztTopicFor(c, colls, inSel[0]) : null) || (unfiled(it) ? ztInbox(c) : null); if(!place) return;
      if(!e){ const id = rid('z'); e = {id, kind: 'paper', t: title, au: '', y: null, topic: place.topic, sub: place.sub, folder: place.topic, fsub: place.sub, tags: [], d: [], p: 1, group: '', n: ''}; lib.entries[id] = e; c.items[it.key] = id; made++; } else updated++;
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
async function ztFileBlob(c, key){ const r = await ztGet(c, '/users/' + c.user + '/items/' + key + '/file'); return await r.blob(); }
/* connecting: the key, then which collections */
function openZotero(){
  const c = ztCfg();
  if(!c){ openModal({title: 'Zotero', body: '<p class="zt-p">Make a key on zotero.org with read and write access to your library, then paste it here.</p><p><a href="https://www.zotero.org/settings/keys/new" target="_blank" rel="noopener">Make a key</a></p><label class="zt-l">Key<input type="password" id="ztKey" autocomplete="off" spellcheck="false"></label><p class="zt-err" id="ztErr"></p>',
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
