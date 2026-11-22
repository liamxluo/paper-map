/* ===================== a copy of your PDFs and books in a folder of the Mac =====================
   Besides GitHub, Paper Map can keep a copy of every PDF and book file in a folder you choose (iCloud Drive, so your
   phone's Files app sees it; or Desktop or Documents), laid out as your library is: Papers by your folders, Zotero Papers by
   Zotero's collections, Readings by your categories. It only ever changes the files it wrote itself (it keeps a list of them in the
   folder): a file you put there is never overwritten or removed. A paper moved to another folder moves; one deleted goes. */
const COPY_KEY = 'pm:copyPlace';
let COPY_BUSY = false, COPY_T = 0;
/* the choice: where (off, iCloud Drive, Desktop, Documents, or a folder you chose), what (papers, books), and whether the
   PDFs carry your marks and your notes beside them */
function copyCfg(){ let c = null; try{ c = JSON.parse(localStorage.getItem('pm:copy') || 'null'); }catch(e){}
  if(!c){ let old = ''; try{ old = localStorage.getItem(COPY_KEY) || ''; }catch(e){} c = {place: old, path: '', papers: true, books: false, marks: true}; }
  return Object.assign({place: '', path: '', papers: true, books: false, marks: true}, c); }
function copySetCfg(p){ const c = Object.assign(copyCfg(), p || {}); try{ localStorage.setItem('pm:copy', JSON.stringify(c)); localStorage.removeItem(COPY_KEY); }catch(e){} if(c.place) copySoon(400, true); return c; }
function copyPlace(){ return copyCfg().place; }
async function copyRoot(){ const place = copyPlace(); if(!place || !(window.__TAURI__ && window.__TAURI__.core)) return null;
  const pl = await window.__TAURI__.core.invoke('storage_places'); if(!pl) return null;
  if(place === 'folder'){ const p = copyCfg().path; return p || null; }
  const base = place === 'icloud' ? pl.icloud : place === 'documents' ? pl.documents : place === 'desktop' && pl.home ? pl.home + '/Desktop' : null;
  return base ? base + '/Paper Map' : null; }
function copyHash(s){ let h = 2166136261; s = String(s); for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function copyName(s){ return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Untitled'; }
function copyFileName(e){ const au = String(e.au || '').split(/[;,&]| and /)[0].trim().split(/\s+/).pop() || ''; return copyName([au, e.y].filter(Boolean).join(' ') + (au || e.y ? ' - ' : '') + (e.t || 'Untitled')); }
/* where each file should be, as your library is laid out */
function copyWanted(){ const cfg = copyCfg(), out = {}, topics = lib.topics || [], put = (dir, name, ext, src) => { let rel = dir + '/' + name + ext, n = 2; while(out[rel] && out[rel].key !== src.key) rel = dir + '/' + name + ' (' + n++ + ')' + ext; out[rel] = src; };
  const subPath = (t, sid) => { const names = []; let s = (t.subs || []).find(x => x.id === sid); let guard = 0; while(s && !s.hidden && guard++ < 50){ names.unshift(copyName(s.name)); s = s.parent ? t.subs.find(x => x.id === s.parent) : null; } return names; };
  Object.values(lib.entries).forEach(e => { if(!cfg.papers || e.kind !== 'paper' || !e.pdf) return; const name = copyFileName(e);
    const marked = cfg.marks && ((e.marks || []).length || Object.keys((e.ink || {}).pdf || {}).length), notes = cfg.marks && String(e.n || '').trim();
    const src = {key: 'p:' + e.id, id: e.id, kind: 'paper', marks: !!marked, size: e.pdf.size || 0, ver: (e.pdf.sha || e.pdf.path || '') + (marked ? '#' + copyHash(JSON.stringify([e.marks || [], (e.ink || {}).pdf || {}])) : '')};
    const put2 = (dir) => { put(dir, name, '.pdf', src); if(notes) put(dir, name + ' - notes', '.md', {key: src.key + ':n', id: e.id, kind: 'notes', ver: copyHash(e.n)}); };
    const f = e.folder && topics.find(t => t.id === e.folder && t.shelf && t.id !== 'ztlib');
    if(f) put2(['Papers', copyName(f.name)].concat(subPath(f, e.fsub)).join('/'));
    (e.zcolls || []).forEach(k => { const path = []; let c = (lib.ztree || []).find(x => x.key === k), g = 0; while(c && g++ < 50){ path.unshift(copyName(c.name)); c = c.parent ? (lib.ztree || []).find(x => x.key === c.parent) : null; } if(path.length){ const dir = ['Zotero Papers'].concat(path).join('/'); put(dir, name, '.pdf', Object.assign({}, src, {key: src.key + '@' + k})); if(notes) put(dir, name + ' - notes', '.md', {key: src.key + '@' + k + ':n', id: e.id, kind: 'notes', ver: copyHash(e.n)}); } });
    if(!f && !(e.zcolls || []).length) put2('Papers/Not in a folder'); });
  (lib.readings || []).forEach(b => { if(!cfg.books || b.deleted) return; const fl = (b.files || [])[0]; if(!fl) return; const ext = (String(fl.name || '').match(/\.[a-z0-9]{2,5}$/i) || ['.pdf'])[0].toLowerCase();
    const cat = (b.categories || [])[0]; put(['Readings'].concat(cat ? cat.split('/').map(copyName) : ['Not in a category']).join('/'), copyName([(b.authors || [])[0] ? String(b.authors[0]).split(/\s+/).pop() + ' - ' : ''] + (b.title || 'Untitled')), ext, {key: 'r:' + b.id, id: b.id, kind: 'book', file: fl, size: fl.size || 0, ver: fl.path || fl.name || ''}); });
  return out; }
async function copyBytes(src){
  if(src.kind === 'notes'){ const e = lib.entries[src.id]; if(!e) return null; return new Blob(['# ' + (e.t || '') + '\n\n' + (e.au ? '*' + e.au + (e.y ? ', ' + e.y : '') + '*\n\n' : '') + String(e.n || '')], {type: 'text/markdown'}); }
  if(src.kind === 'paper'){ const e = lib.entries[src.id]; if(!e || !e.pdf) return null; const before = new Set(Object.keys(pdfUrls)); const u = await pdfUrl(e); const r = await fetch(u);
    Object.keys(pdfUrls).forEach(k => { if(!before.has(k)){ try{ URL.revokeObjectURL(pdfUrls[k]); }catch(x){} delete pdfUrls[k]; } }); if(!r.ok) return null; const plain = await r.blob();
    /* with your marks: written into the PDF by the desk's own writer, the same one as Save the PDF with my marks */
    if(src.marks){ try{ const w = DK.frame && DK.frame.contentWindow && DK.frame.contentWindow.__pdfMarked; if(w){ const b = await w(new Uint8Array(await plain.arrayBuffer()), e.marks || [], (e.ink || {}).pdf || {}); if(b && b.size) return b; } }catch(err){} }
    return plain; }
  return await DESK_API.bookFileBlob(src.file); }
/* one pass: write what is missing or changed, remove what Paper Map wrote that is no longer wanted; nothing else is touched */
const COPY_WHERE = {icloud: 'iCloud Drive › Paper Map', desktop: 'Desktop › Paper Map', documents: 'Documents › Paper Map'};
function copyWhere(){ const c = copyCfg(); return c.place === 'folder' ? (c.path || '').split('/').pop() || 'your folder' : COPY_WHERE[c.place] || 'your folder'; }
function copyReason(e){ return e && e.status === 'nogh' ? 'GitHub is not connected' : e && e.status === 'nozotero' ? 'Zotero is not connected' : e && e.status === 404 ? 'not found' : e && e.status ? 'error ' + e.status : String(e && (e.message || e) || ''); }
function copyTimeout(p, ms){ return Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]); }
async function copyPass(report){ if(COPY_BUSY){ if(report) copySoon(3000, true); return; } const root = await copyRoot(); if(!root){ if(report && copyPlace()) toast('That folder could not be found on this Mac'); return; } COPY_BUSY = true; pmState('copy', 'busy'); const inv = window.__TAURI__.core.invoke; let wrote = 0, failed = 0, why = '', denied = false;
  try{ let list = {}; try{ list = JSON.parse(decodeURIComponent(escape(atob(await inv('fs_read', {path: root + '/.paper-map-copy.json'}))))).files || {}; }catch(e){}
    if(!Object.keys(lib.entries || {}).length && !(lib.readings || []).length) return;   /* the library has not loaded: nothing is decided on it */
    const cfg = copyCfg(), want = copyWanted(); let changed = false;
    /* what may go: only files Paper Map wrote, only of a kind still being copied (unticking Papers or Books stops the copy, it
       deletes nothing), and never most of the folder at once (that would be a library not loaded, not your wish) */
    /* first, a test that the Mac lets Paper Map write there (Desktop and Documents need your permission once) */
    try{ await inv('fs_write', {path: root + '/.paper-map-copy.json', data: btoa(unescape(encodeURIComponent(JSON.stringify({about: 'Files Paper Map keeps here. Paper Map only changes the files listed below.', files: list}))))}); }
    catch(err){ denied = true; const m = String(err && (err.message || err) || ''); if(report) toast(/not permitted|permission|denied|EPERM|EACCES/i.test(m) ? 'The Mac did not let Paper Map write to ' + copyWhere().split(' ›')[0] + '. Allow it in System Settings › Privacy & Security › Files and Folders › Paper Map, then choose it again.' : 'Paper Map could not write to ' + copyWhere() + ': ' + m.slice(0, 120)); return; }
    const kindOf = (rel, x) => x.kind || (/:n$/.test(x.key || '') ? 'notes' : /^r:/.test(x.key || '') ? 'book' : 'paper');
    const live = k => k === 'paper' ? cfg.papers : k === 'book' ? cfg.books : cfg.papers && cfg.marks;
    const gone = Object.keys(list).filter(rel => (!want[rel] || want[rel].key !== list[rel].key) && live(kindOf(rel, list[rel])));
    const renamed = Object.keys(list).filter(rel => /^Zotero\//.test(rel));   /* the old “Zotero” folder of an earlier version: it goes */
    renamed.forEach(rel => { if(!gone.includes(rel)) gone.push(rel); });
    if(gone.length - renamed.length <= Math.max(10, Object.keys(list).length * .5)){ for(const rel of gone){ try{ await inv('fs_remove', {path: root + '/' + rel}); }catch(e){} delete list[rel]; changed = true; } }
    for(const [rel, src] of Object.entries(want)){ const had = list[rel]; if(had && had.ver === src.ver) continue;
      if(!had){ try{ if(await inv('fs_stat', {path: root + '/' + rel})) continue; }catch(e){} }   /* a file of yours with that name: left alone */
      try{ const b = await copyTimeout(copyBytes(src), 90000); if(!b || !b.size){ failed++; continue; } await inv('fs_write', {path: root + '/' + rel, data: await fileToBase64(b)}); list[rel] = {key: src.key, kind: src.kind, ver: src.ver, size: b.size}; changed = true; wrote++; await new Promise(r => setTimeout(r, 120)); }catch(e){ failed++; why = why || copyReason(e); } }
    if(changed) await inv('fs_write', {path: root + '/.paper-map-copy.json', data: btoa(unescape(encodeURIComponent(JSON.stringify({about: 'Files Paper Map keeps here. Paper Map only changes the files listed below.', files: list}))))});
    if(report){ const wantN = Object.keys(want).filter(r => !/\.md$/.test(r)).length;
      toast(!wantN ? 'Nothing to copy yet: no paper here has a PDF' + (copyCfg().books ? ' and no book has a file' : '')
        : wrote ? 'Copied ' + wrote + (wrote === 1 ? ' file' : ' files') + ' into ' + copyWhere() + (failed ? '; ' + failed + ' could not be read just now and will be tried again' : '')
        : failed ? failed + (failed === 1 ? ' PDF' : ' PDFs') + ' could not be read just now' + (why ? ' (' + why.slice(0, 60) + ')' : '') + '; Paper Map will try again'
        : 'Everything is already in ' + copyWhere()); }
  }catch(e){ denied = true; if(report) toast('The copy stopped: ' + String(e && (e.message || e) || '').slice(0, 120)); } finally{ COPY_BUSY = false; pmState('copy', denied || (failed && !wrote) ? 'err' : 'ok'); } }
function copySoon(ms, report){ clearTimeout(COPY_T); COPY_T = setTimeout(() => { copyPass(!!report); }, ms || 30000); }
if(!PREVIEW && window.__TAURI__){ setTimeout(() => copySoon(1000), 45000); setInterval(() => copySoon(1000), 20 * 60000); }
Object.assign(window, {copyPlace, copyPass, copySoon, copyCfg, copySetCfg});
