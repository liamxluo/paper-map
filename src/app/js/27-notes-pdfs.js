/* ===================== notes & PDFs ===================== */
/* Notes live in each entry's n field (Markdown), so backups and browser-only use keep them.
   With GitHub sync, every note is also written to notes/<id>.md, and attached PDFs to pdfs/<id>.pdf. */
const PDF_MAX = 50 * 1024 * 1024;
function mdInline(s){
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>').replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => '<code>' + codes[+i] + '</code>');
}
function mdToHtml(src){
  const lines = esc(String(src || '').replace(/^\s*<!-- page -->\s*$/gm, '')).replace(/\r\n?/g, '\n').split('\n');
  let out = '', para = [], list = null, quote = [], code = null;
  const flushPara = () => { if(para.length){ out += '<p>' + mdInline(para.join(' ')) + '</p>'; para = []; } };
  const flushList = () => { if(list){ out += '<' + list.tag + '>' + list.items.map(x => '<li>' + mdInline(x) + '</li>').join('') + '</' + list.tag + '>'; list = null; } };
  const flushQuote = () => { if(quote.length){ out += '<blockquote><p>' + mdInline(quote.join(' ')) + '</p></blockquote>'; quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };
  for(const raw of lines){
    if(code !== null){ if(/^\s*```/.test(raw)){ out += '<pre><code>' + code.join('\n') + '</code></pre>'; code = null; } else code.push(raw); continue; }
    if(/^\s*```/.test(raw)){ flushAll(); code = []; continue; }
    const line = raw.replace(/\s+$/, '');
    if(!line.trim()){ flushAll(); continue; }
    let m;
    if((m = /^(#{1,3})\s+(.*)$/.exec(line))){ flushAll(); const n = m[1].length; out += '<h' + n + '>' + mdInline(m[2]) + '</h' + n + '>'; continue; }
    if(/^\s*(-{3,}|\*{3,})\s*$/.test(line)){ flushAll(); out += '<hr>'; continue; }
    if((m = /^\s*&gt;\s?(.*)$/.exec(line))){ flushPara(); flushList(); quote.push(m[1]); continue; }
    if((m = /^\s*[-*+]\s+(.*)$/.exec(line))){ flushPara(); flushQuote(); if(!list || list.tag !== 'ul'){ flushList(); list = {tag:'ul', items:[]}; } list.items.push(m[1]); continue; }
    if((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))){ flushPara(); flushQuote(); if(!list || list.tag !== 'ol'){ flushList(); list = {tag:'ol', items:[]}; } list.items.push(m[1]); continue; }
    if(list && /^\s{2,}\S/.test(raw)){ list.items[list.items.length - 1] += ' ' + line.trim(); continue; }
    flushList(); flushQuote(); para.push(line.trim());
  }
  if(code !== null) out += '<pre><code>' + code.join('\n') + '</code></pre>';
  flushAll();
  return out;
}
function mdPlain(src){
  return String(src || '').replace(/^\s*<!-- page -->\s*$/gm, '').replace(/```[\s\S]*?```/g, ' ').replace(/`([^`]*)`/g, '$1').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '').replace(/(\*\*|__|\*|_)(\S[^*_]*?)\1/g, '$2').replace(/\s+/g, ' ').trim();
}
function notePreview(n){ const s = mdPlain(n); return s.length > 160 ? s.slice(0, 157).replace(/\s+\S*$/, '') + '…' : s; }
function noteCite(e){
  if(e.kind === 'concept') return 'Concept · ' + e.y + ' onwards';
  const a = [e.au, e.y ? '(' + e.y + ')' : ''].filter(Boolean).join(' ');
  return [a, e.v].filter(Boolean).join('. ');
}
function noteFileMd(e){ const ci = noteCite(e); return '# ' + (e.t || 'Untitled') + '\n\n' + (ci ? '*' + ci + '*\n\n' : '') + String(e.n || '').trim() + '\n'; }
function notedEntries(){
  const out = [];
  lib.topics.forEach(tp => tp.subs.forEach(s => entriesOfSub(s.id).slice().sort(byYear).forEach(e => { if(String(e.n || '').trim()) out.push(e); })));
  return out;
}
function notesMarkdown(list){
  let md = '# ' + appTitle() + ': notes\n', last = null;
  list.forEach(e => {
    const tp = IDX.topics[e.topic], ci = noteCite(e);
    if(tp && tp.id !== last){ md += '\n## ' + tp.name + '\n'; last = tp.id; }
    md += '\n### ' + (e.t || 'Untitled') + '\n\n' + (ci ? '*' + ci + '*\n\n' : '') + String(e.n || '').trim() + '\n';
  });
  return md;
}
function downloadFile(name, text, mime){
  if(TAURI){ macSave(new Blob([text], {type: mime || 'text/plain'}), name).catch(() => toast('Couldn’t save the file')); return true; }
  try{
    const url = URL.createObjectURL(new Blob([text], {type: mime || 'text/plain'}));
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  }catch(e){ return false; }
}
function fileSlug(s){ return String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'notes'; }
function printNotes(list, heading){
  let area = document.getElementById('printArea');
  if(!area){ area = document.createElement('div'); area.id = 'printArea'; document.body.appendChild(area); }
  let html = '<h1>' + esc(heading) + '</h1>', last = null;
  list.forEach(e => {
    const tp = IDX.topics[e.topic], ci = noteCite(e);
    if(list.length > 1 && tp && tp.id !== last){ html += '<h2 class="ptopic">' + esc(tp.name) + '</h2>'; last = tp.id; }
    html += '<article>' + (list.length > 1 ? '<h2>' + esc(e.t || 'Untitled') + '</h2>' : '') + (ci ? '<p class="pmeta">' + esc(ci) + '</p>' : '') +
      '<div class="md">' + (mdToHtml(e.n) || '<p class="empty-note">No notes yet.</p>') + '</div></article>';
  });
  area.innerHTML = html;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { try{ window.print(); }catch(e){} }, 30);
}
function openNotesExport(list, single){
  if(!list.length){ toast('No notes to export yet'); return; }
  const name = single ? fileSlug(list[0].t) : fileSlug(appTitle() + ' notes ' + new Date().toISOString().slice(0, 10));
  openModal({
    title: single ? 'Export these notes' : 'Export notes',
    body:'<p>' + (single ? 'Save your notes on “' + esc(list[0].t) + '”' : 'Save your notes on ' + list.length + (list.length === 1 ? ' paper' : ' papers')) +
      ' as a Markdown file, or as a PDF: in the print window, choose “Save as PDF”.</p>',
    actions:[{label:'Cancel'},
      {label:'Markdown (.md)', onClick: () => { if(downloadFile(name + '.md', single ? noteFileMd(list[0]) : notesMarkdown(list), 'text/markdown')) toast('Notes downloaded'); else toast('Downloading isn’t available here'); }},
      {label:'PDF', primary:true, onClick: () => { setTimeout(() => printNotes(list, single ? (list[0].t || 'Notes') : appTitle() + ': notes'), 60); }}]
  });
}

/* ---------- GitHub: files besides the data file; every commit goes through one queue ---------- */
let ghChain = Promise.resolve();
function ghSerial(fn){ const run = ghChain.then(fn, fn); ghChain = run.catch(() => {}); return run; }
function ghPathUrl(c, path){ return 'https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + '/contents/' + String(path).split('/').filter(Boolean).map(encodeURIComponent).join('/'); }
function ghRef(c){ return '?ref=' + encodeURIComponent(c.branch) + '&_=' + Date.now(); }
async function ghPutPath(c, path, content, message, sha){
  if(c && c.kind !== 'folder' && c.kind !== 'dropbox' && typeof ghIsPrivate === 'function'){ const pv = await ghIsPrivate(c, c.repo); if(pv === false){ ghSayPublic(c.repo); return {ok: false, status: 451, json: async () => ({})}; } }
  return ghPutPath0(c, path, content, message, sha); }
function ghPutPath0(c, path, content, message, sha){
  if(c.kind === 'dropbox' || c.kind === 'folder') return remotePut(c, path, b64ToBytes(content), null, false);
  const body = {message, content, branch: c.branch};
  if(sha) body.sha = sha;
  return fetch(ghPathUrl(c, path), {method:'PUT', headers: ghHeaders(c, {'Content-Type':'application/json'}), body: JSON.stringify(body)});
}
function ghDeletePath(c, path, sha, message){
  if(c.kind === 'dropbox' || c.kind === 'folder') return remoteDelete(c, path);
  return fetch(ghPathUrl(c, path), {method:'DELETE', headers: ghHeaders(c, {'Content-Type':'application/json'}), body: JSON.stringify({message, sha, branch: c.branch})});
}
async function ghPathSha(c, path){
  if(c.kind === 'dropbox' || c.kind === 'folder') return remoteMeta(c, path);
  const r = await fetch(ghPathUrl(c, path) + ghRef(c), {headers: ghHeaders(c, {'Accept':'application/vnd.github.object+json'})});
  if(r.status === 404) return null;
  if(!r.ok) throw {status: r.status};
  const j = await r.json();
  return (j && j.sha) || null;
}
async function ghListDir(c, dir){
  if(c.kind === 'dropbox' || c.kind === 'folder') return remoteList(c, dir);
  const r = await fetch(ghPathUrl(c, dir) + ghRef(c), {headers: ghHeaders(c)});
  if(r.status === 404) return [];
  if(!r.ok) throw {status: r.status};
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}
async function gitBlobSha(text){
  if(!(window.crypto && crypto.subtle)) return null;
  const body = new TextEncoder().encode(text), head = new TextEncoder().encode('blob ' + body.length + '\0');
  const all = new Uint8Array(head.length + body.length); all.set(head); all.set(body, head.length);
  const h = await crypto.subtle.digest('SHA-1', all);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function strHash(s){ let h = 0x811c9dc5; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
function notesSig(){ return strHash(Object.values(lib.entries).filter(e => String(e.n || '').trim()).sort((a, b) => a.id < b.id ? -1 : 1).map(e => e.id + '\u0001' + noteFileMd(e)).join('\u0002')); }
async function ghMirrorNotes(){
  const c = ghCfg(); if(!c) return;
  if(localEmpty()) return;
  const sig = notesSig();
  if(c.notesSig === sig) return;
  const want = {}, have = {};
  Object.values(lib.entries).forEach(e => { if(String(e.n || '').trim() && ID_RE.test(e.id)) want['notes/' + e.id + '.md'] = noteFileMd(e); });
  (await ghListDir(c, 'notes')).forEach(f => { if(f.type === 'file' && /\.md$/i.test(f.name)) have[f.path] = f.sha; });
  for(const path of Object.keys(want)){
    if(have[path] && have[path] === await remoteHash(c, want[path])) continue;
    const r = await ghPutPath(c, path, b64encode(want[path]), 'Notes: ' + ((lib.entries[path.slice(6, -3)] || {}).t || path), have[path] || null);
    if(!r.ok) throw {status: r.status};
  }
  for(const path of Object.keys(have)){
    if(want[path]) continue;
    const r = await ghDeletePath(c, path, have[path], 'Remove notes ' + path);
    if(!r.ok && r.status !== 404) throw {status: r.status};
  }
  const c2 = ghCfg(); if(c2){ c2.notesSig = sig; ghStore(c2); }
}
function ghNotesSoon(){ const c = ghCfg(); if(!c || c.notesSig === notesSig()) return; ghSerial(ghMirrorNotes).catch(() => {}); }

/* ---------- PDFs ---------- */
const pdfUrls = {};
function fmtSize(n){ return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
function fileToBase64(file){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('read')); r.readAsDataURL(file); }); }
async function pdfUrl(e){
  const key = e.pdf.path + '@' + (e.pdf.sha || '');
  if(pdfUrls[key]) return pdfUrls[key];
  const zkey = e.pdf.zotero || (/^zotero:/.test(e.pdf.path || '') ? e.pdf.path.slice(7) : null);
  if(zkey && !(e.pdf.path || '').startsWith('pdfs/')){ const zc = typeof ztCfg === 'function' ? ztCfg() : null; if(!zc) throw {status: 'nozotero'}; const blob = await ztFileBlob(zc, zkey, e.pdf.name, e.pdf.zpath); if(!blob) throw {status: 404}; return (pdfUrls[key] = URL.createObjectURL(blob)); }
  const c = ghCfg(); if(!c) throw {status:'nogh'};
  let bytes;
  if(c.kind === 'dropbox' || c.kind === 'folder'){ bytes = await remoteBytes(c, e.pdf.path); if(!bytes) throw {status: 404}; }
  else{
    const cR = pdfRepoOf(c, e); let r = await fetch(ghPathUrl(cR, e.pdf.path) + (cR === c ? ghRef(c) : '?_=' + Date.now()), {headers: ghHeaders(cR, {'Accept':'application/vnd.github.raw+json'})});
    if(r.status === 404){ const g = lsGet(GH_KEY) || {}; const alts = [c.repo].concat((lib.pdfStore && lib.pdfStore.repos) || [], g.prevRepos || []).filter((x, i, a) => x && x !== cR.repo && a.indexOf(x) === i);
      let found = null;
      for(const repo of alts){ const cA = ghRepo(c, repo), r2 = await fetch(ghPathUrl(cA, e.pdf.path) + '?_=' + Date.now(), {headers: ghHeaders(cA, {'Accept':'application/vnd.github.raw+json'})}); if(r2.ok){ r = r2; found = repo; break; } }
      /* not where it should be, nor in any repository Paper Map knows: look through your private repositories once for it
         (a library moved before Paper Map remembered where it came from) */
      if(!found){ const more = await pdfLookAround(c, e.pdf.path, alts.concat([cR.repo])); if(more){ r = more.r; found = more.repo; } }
      if(found){ e.pdf.repo = found === c.repo ? undefined : found; if(e.pdf.repo === undefined) delete e.pdf.repo; touchLib();
        if(found !== c.repo && !(lib.pdfStore && (lib.pdfStore.repos || []).includes(found))){ const g2 = lsGet(GH_KEY) || {}; g2.prevRepos = [...new Set([found].concat(g2.prevRepos || []))].slice(0, 6); if(!g2.broughtFrom || g2.broughtFrom !== found) g2.bringFrom = found; lsSet(GH_KEY, g2); } } }
    if(!r.ok) throw {status: r.status};
    bytes = await r.arrayBuffer();
  }
  const blob = new Blob([bytes], {type:'application/pdf'});
  return (pdfUrls[key] = URL.createObjectURL(blob));
}
async function attachPdf(id, file){
  const e = lib.entries[id], c = ghCfg();
  if(!e || !c) return;
  if(c.kind !== 'folder' && file.size > 95 * 1048576){ toast('That PDF is ' + fmtSize(file.size) + ': GitHub takes files up to 100 MB. Keep big PDFs in iCloud Drive or a folder instead.'); return; }
  if(c.kind !== 'folder' && file.size > 50 * 1048576) toast('A big PDF (' + fmtSize(file.size) + '): it may take a while to upload.');
  if(!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf'){ toast('Choose a PDF file'); return; }
  if(file.size > PDF_MAX){ toast('This PDF is larger than 50 MB, too big to keep this way'); return; }
  const path = 'pdfs/' + id + '.pdf';
  const pane = document.getElementById('readerPdf');
  if(reader.id === id) pane.innerHTML = '<p class="pdf-msg">Uploading the PDF to your repository…</p>';
  try{
    const content = await fileToBase64(file), to = await pdfTarget(c), cT = ghRepo(c, to);
    const sha = await ghSerial(async () => {
      let known = e.pdf && e.pdf.path === path && (e.pdf.repo || c.repo) === to ? e.pdf.sha : null;
      let r = await ghPutPath(cT, path, content, 'PDF: ' + (e.t || id), known);
      if(r.status === 409 || r.status === 422){ known = await ghPathSha(cT, path); r = await ghPutPath(cT, path, content, 'PDF: ' + (e.t || id), known); }
      if(!r.ok) throw {status: r.status};
      const j = await r.json();
      return j && j.content && j.content.sha;
    });
    e.pdf = {path, name: file.name, size: file.size, sha: sha || null}; if(to !== c.repo) e.pdf.repo = to;
    touchLib([e.topic]);
    toast('PDF attached');
  }catch(err){ toast(err && err.status === 413 ? 'This PDF is too large for GitHub' : ghErr(err)); }
  if(reader.id === id) renderReaderPdf();
}
function removePdf(id){
  const e = lib.entries[id];
  if(!e || !e.pdf) return;
  confirmDanger('Remove PDF', 'Remove the PDF from “' + e.t + '”? It is deleted from your GitHub repository; earlier versions stay in its history.', 'Remove', async () => {
    const c0 = ghCfg(), pdf = e.pdf, c = c0 ? pdfRepoOf(c0, e) : null;
    if(c){
      try{
        await ghSerial(async () => {
          let sha = pdf.sha || await ghPathSha(c, pdf.path);
          if(!sha) return;
          let r = await ghDeletePath(c, pdf.path, sha, 'Remove PDF: ' + (e.t || id));
          if(r.status === 409 || r.status === 422){ sha = await ghPathSha(c, pdf.path); if(!sha) return; r = await ghDeletePath(c, pdf.path, sha, 'Remove PDF: ' + (e.t || id)); }
          if(!r.ok && r.status !== 404) throw {status: r.status};
        });
      }catch(err){ toast(ghErr(err)); return; }
    }
    delete e.pdf; touchLib([e.topic]); toast('PDF removed');
    if(reader.id === id) renderReaderPdf();
  });
}

/* ---------- reading view: PDF on the left, notes on the right ---------- */
const reader = {id:null, timer:null};
const readerEl = document.getElementById('reader');
async function renderReaderPdf(){
  const e = lib.entries[reader.id]; if(!e) return;
  const pane = document.getElementById('readerPdf'), body = document.getElementById('readerBody');
  const isPaper = e.kind === 'paper';
  body.classList.toggle('no-pdf', !isPaper);
  pane.hidden = !isPaper;
  if(!isPaper) return;
  const c = ghCfg();
  if(!e.pdf){
    if(!c){
      pane.innerHTML = '<div class="pdf-empty"><p>' + (PREVIEW ? 'PDFs are kept with your own synced list, so they aren’t available in this preview.' : 'Keep this paper’s PDF with your library: connect GitHub or a folder, and drop the PDF here.') + '</p>' +
        (PREVIEW ? '' : '<button type="button" class="btn" data-reader-settings="1">Set it up</button>') + '</div>';
      return;
    }
    pane.innerHTML = '<div class="pdf-empty" id="pdfDrop"><p>Attach the paper’s PDF to read it here. It is stored with your synced list.</p><button type="button" class="btn primary" data-pdf-pick="1">Attach PDF</button><p style="margin:10px 0 0;font-size:.82rem">or drop a PDF here</p></div>';
    return;
  }
  const head = '<div class="pdf-head"><span class="pdf-name">' + esc(e.pdf.name || 'PDF') + (e.pdf.size ? ' · ' + fmtSize(e.pdf.size) : '') + '</span>' +
    '<a class="linkbtn" id="pdfOpen" target="_blank" rel="noopener" hidden>Open in new tab</a><button type="button" class="linkbtn" data-pdf-pick="1">Replace</button><button type="button" class="linkbtn" data-pdf-remove="1">Remove</button></div>';
  if(!c && !(e.pdf.zotero || /^zotero:/.test(e.pdf.path || ''))){ pane.innerHTML = head + '<p class="pdf-msg">This PDF is stored with your synced list. Connect sync in Settings to open it here.</p>'; return; }
  pane.innerHTML = head + '<div class="pdf-frame"><p class="pdf-msg">Loading the PDF…</p></div>';
  const id = e.id;
  try{
    const url = await pdfUrl(e);
    if(reader.id !== id) return;
    const a = document.getElementById('pdfOpen'); if(a){ a.href = url; a.hidden = false; }
    const fr = pane.querySelector('.pdf-frame'); if(fr) fr.innerHTML = '<iframe title="' + esc('PDF: ' + (e.t || '')) + '" src="' + url + '#view=FitH&amp;navpanes=0&amp;pagemode=none&amp;zoom=page-width"></iframe>';
  }catch(err){
    if(reader.id !== id) return;
    const fr = pane.querySelector('.pdf-frame');
    if(fr) fr.innerHTML = '<p class="pdf-msg">' + esc(err && err.status === 404 ? 'This PDF isn’t in the connected repository. Attach it again with Replace.' : ghErr(err)) + '</p>';
  }
}
function saveNotesNow(){
  const e = lib.entries[reader.id]; if(!e) return;
  const v = document.getElementById('notesText').value;
  if((e.n || '') === v || (!e.n && !v.trim())) return;
  if(v.trim()) e.n = v; else delete e.n;
  touchLib([e.topic]);
}
function flushNotes(){ if(reader.timer){ clearTimeout(reader.timer); reader.timer = null; saveNotesNow(); } }
function setNotesMode(m){
  const ta = document.getElementById('notesText'), pv = document.getElementById('notesPreview');
  readerEl.querySelectorAll('[data-notes-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.notesMode === m)));
  if(m === 'preview'){ flushNotes(); pv.innerHTML = mdToHtml(ta.value) || '<p class="empty-note">No notes yet.</p>'; }
  ta.hidden = m === 'preview'; pv.hidden = m !== 'preview';
}
function openReader(id){
  const e = lib.entries[id]; if(!e) return;
  flushNotes();
  reader.id = id;
  document.getElementById('readerMeta').textContent = noteCite(e);
  document.getElementById('readerTitle').textContent = e.t || 'Untitled';
  const ta = document.getElementById('notesText');
  ta.value = e.n || '';
  setNotesMode(String(e.n || '').trim() ? 'preview' : 'write');
  readerEl.hidden = false;
  document.body.classList.add('reader-open');
  updateSaveState();
  renderReaderPdf();
  if(!String(e.n || '').trim()) setTimeout(() => ta.focus({preventScroll:true}), 0);
}
function closeReader(){
  if(readerEl.hidden) return;
  flushNotes();
  readerEl.hidden = true;
  document.body.classList.remove('reader-open');
  reader.id = null;
  renderMain(); refreshInfo(); applyFocus(ui.selected);
}
document.getElementById('readerClose').addEventListener('click', closeReader);
document.getElementById('readerExport').addEventListener('click', () => { flushNotes(); const e = lib.entries[reader.id]; if(e) openNotesExport([e], true); });
document.getElementById('notesText').addEventListener('input', () => { clearTimeout(reader.timer); reader.timer = setTimeout(() => { reader.timer = null; saveNotesNow(); }, 600); });
readerEl.addEventListener('click', ev => {
  const md = ev.target.closest('[data-notes-mode]'); if(md){ setNotesMode(md.dataset.notesMode); if(md.dataset.notesMode === 'write') document.getElementById('notesText').focus(); return; }
  if(ev.target.closest('[data-pdf-pick]')){ document.getElementById('pdfInput').click(); return; }
  if(ev.target.closest('[data-pdf-remove]')){ removePdf(reader.id); return; }
  if(ev.target.closest('[data-reader-settings]')){ closeReader(); openSettings(); }
});
document.getElementById('pdfInput').addEventListener('change', ev => { const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if(f && reader.id) attachPdf(reader.id, f); });
readerEl.addEventListener('dragover', ev => { ev.preventDefault(); const d = document.getElementById('pdfDrop'); if(d && d.contains(ev.target)) d.classList.add('drag'); });
readerEl.addEventListener('dragleave', ev => { const d = document.getElementById('pdfDrop'); if(d && !d.contains(ev.relatedTarget)) d.classList.remove('drag'); });
readerEl.addEventListener('drop', ev => {
  ev.preventDefault();
  const d = document.getElementById('pdfDrop'); if(!d) return;
  d.classList.remove('drag');
  const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
  if(f && reader.id && d.contains(ev.target)) attachPdf(reader.id, f);
});
document.addEventListener('keydown', ev => { if(ev.key === 'Escape' && !ev.defaultPrevented && modal.root.hidden && !readerEl.hidden){ ev.preventDefault(); closeReader(); } });


/* ---------- moving topics and subtopics: drag in Contents, or Inside in the subtopic form ----------
   Nodes are {k:'t', id} for a topic or {k:'s', id} for a subtopic. Dropping in the middle of a row puts the node
   inside it; near the top or bottom edge puts it before or after. A topic dropped into another becomes a subtopic;
   a subtopic dropped between topics becomes a topic of its own. */
function freshId(prefix){ let x; do{ x = rid(prefix); }while(lib.topics.some(t => t.id === x || t.subs.some(s => s.id === x))); return x; }
function topicHolding(sid){ return lib.topics.find(t => t.subs.some(s => s.id === sid)); }
function liveBelow(T, sid){ const out = []; const walk = id => T.subs.forEach(s => { if(s.parent === id){ out.push(s.id); walk(s.id); } }); walk(sid); return out; }
function hasEntries(sid){ return Object.values(lib.entries).some(e => e.sub === sid); }
function absorbHidden(T){ /* the topic keeps its own row */ }
function detachNode(node){
  if(node.k === 's'){
    const A = topicHolding(node.id); if(!A) return null;
    const ids = new Set([node.id].concat(liveBelow(A, node.id)));
    const D = A.subs.filter(s => ids.has(s.id));
    A.subs = A.subs.filter(s => !ids.has(s.id));
    if(!A.subs.length) A.subs.push({id: freshId('s'), name: A.name, desc:'', groups:[], hidden:true});
    return D;
  }
  const T = lib.topics.find(x => x.id === node.id); if(!T) return null;
  const N = {id: freshId('s'), name: T.name, desc: T.desc || '', groups: []};
  const D = [N];
  T.subs.forEach(s => {
    if(s.hidden){ Object.values(lib.entries).forEach(e => { if(e.sub === s.id) e.sub = N.id; }); N.groups = N.groups.concat(s.groups || []); return; }
    if(!s.parent) s.parent = N.id;
    D.push(s);
  });
  if(Array.isArray(settings.lanes) && T.subs.some(s => settings.lanes.includes(s.id))) settings.lanes.push(N.id);
  rekeyTl(T.id, N.id);
  (lib.tlinks || []).forEach(l => { if(l[0] === T.id) l[0] = N.id; if(l[1] === T.id) l[1] = N.id; });
  lib.topics = lib.topics.filter(x => x !== T);
  return D;
}
function attachSubtree(D, target, zone){
  const R = D[0];
  if(target.k === 't' && zone === 'inside'){
    const X = lib.topics.find(x => x.id === target.id);
    delete R.parent; absorbHidden(X); X.subs = X.subs.concat(D);
    return;
  }
  if(target.k === 't'){
    const kids = D.slice(1), T2 = {id: freshId('t'), name: R.name, desc: R.desc || '', subs: []};
    kids.forEach(s => { if(s.parent === R.id) delete s.parent; });
    delete R.parent;
    if(!kids.length){ R.hidden = true; T2.subs = [R]; }
    else{ R.hidden = true; R.name = T2.name; T2.subs = [R].concat(kids); }
    rekeyTl(R.id, T2.id);
    (lib.tlinks || []).forEach(l => { if(l[0] === R.id) l[0] = T2.id; if(l[1] === R.id) l[1] = T2.id; });
    const i = lib.topics.findIndex(x => x.id === target.id);
    lib.topics.splice(zone === 'before' ? i : i + 1, 0, T2);
    return;
  }
  const X = topicHolding(target.id), S2 = X.subs.find(s => s.id === target.id);
  if(zone === 'inside') R.parent = S2.id; else if(S2.parent) R.parent = S2.parent; else delete R.parent;
  const block = new Set([S2.id].concat(liveBelow(X, S2.id)));
  let at = X.subs.indexOf(S2);
  if(zone !== 'before') X.subs.forEach((s, i) => { if(block.has(s.id)) at = i + 1; });
  X.subs.splice(at, 0, ...D);
}
function canDrop(node, target, zone){
  if(!node || !target || (node.k === target.k && node.id === target.id)) return false;
  if(target.k === 'e') return node.k === 's' ? !!topicHolding(node.id) : lib.topics.length > 1 && lib.topics[lib.topics.length - 1].id !== node.id;
  if(target.k === 't' ? !lib.topics.some(x => x.id === target.id) : !topicHolding(target.id)) return false;
  if(node.k === 't' ? !lib.topics.some(x => x.id === node.id) : !topicHolding(node.id)) return false;
  if(node.k === 's'){
    if(target.k === 's'){ const A = topicHolding(node.id); if(!A || liveBelow(A, node.id).includes(target.id)) return false; }
    return true;
  }
  if(target.k === 's'){ const T = lib.topics.find(x => x.id === node.id); if(!T || T.subs.some(s => s.id === target.id)) return false; }
  return lib.topics.length > 1;
}
function moveNode(node, target, zone){
  if(target.k === 'e'){
    if(node.k === 't'){ const T = lib.topics.find(x => x.id === node.id); lib.topics = lib.topics.filter(x => x !== T).concat([T]); return; }
    const D = detachNode(node);
    if(D) attachSubtree(D, {k:'t', id: lib.topics[lib.topics.length - 1].id}, 'after');
    return;
  }
  if(node.k === 't' && target.k === 't' && zone !== 'inside'){
    const T = lib.topics.find(x => x.id === node.id);
    lib.topics = lib.topics.filter(x => x !== T);
    const i = lib.topics.findIndex(x => x.id === target.id);
    lib.topics.splice(zone === 'before' ? i : i + 1, 0, T);
    return;
  }
  const D = detachNode(node);
  if(D) attachSubtree(D, target, zone);
}
function nodeName(node){ const x = node.k === 't' ? IDX.topics[node.id] : IDX.subs[node.id]; return x ? x.name : ''; }
function performMove(node, target, zone){
  if(!canDrop(node, target, zone)) return;
  const before = clone(lib), lanesBefore = clone(settings.lanes), name = nodeName(node);
  moveNode(node, target, zone);
  reindex(); touchAllTopics();
  if(JSON.stringify(lanesBefore) !== JSON.stringify(settings.lanes)) persistSettings();
  fixView();
  if(node.k === 's' && IDX.subs[node.id]) openView(node.id, {scroll:false}); else renderAll();
  toast('Moved “' + name + '”', () => { lib = before; settings.lanes = lanesBefore; persistSettings(); reindex(); touchAllTopics(); fixView(); renderAll(); toast('Undone'); });
}
const parseNode = v => ({k: v.slice(0, 1), id: v.slice(2)});
let dnd = null, dndOver = null;
function clearDrop(){ dndOver = null; tocBody.querySelectorAll('.drop-before,.drop-after,.drop-inside,.drop-end').forEach(x => x.classList.remove('drop-before', 'drop-after', 'drop-inside', 'drop-end')); }
tocBody.addEventListener('dragstart', ev => {
  const row = ev.target.closest && ev.target.closest('[data-node]');
  if(!row){ ev.preventDefault(); return; }
  dnd = parseNode(row.dataset.node);
  row.classList.add('dragging');
  try{ ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', row.dataset.node); ev.dataTransfer.setDragImage(row, 16, 14); }catch(e){}
});
tocBody.addEventListener('dragover', ev => {
  if(!dnd) return;
  const row = ev.target.closest('[data-node]');
  clearDrop();
  if(!row) return;
  const r = row.getBoundingClientRect(), f = (ev.clientY - r.top) / r.height, target = parseNode(row.dataset.node);
  /* an open topic shows its subtopics right below it, so its lower edge means “inside”, not “after” */
  const openTopic = target.k === 't' && IDX.topics[target.id] && tocExpanded(IDX.topics[target.id]) && visibleSubs(IDX.topics[target.id]).length;
  const zone = target.k === 'e' ? 'end' : f < .28 ? 'before' : (f > .72 && !openTopic) ? 'after' : 'inside';
  if(!canDrop(dnd, target, zone)) return;
  ev.preventDefault();
  try{ ev.dataTransfer.dropEffect = 'move'; }catch(e){}
  row.classList.add('drop-' + zone);
  dndOver = {target, zone};
});
tocBody.addEventListener('dragleave', ev => { if(!ev.relatedTarget || !tocBody.contains(ev.relatedTarget)) clearDrop(); });
tocBody.addEventListener('drop', ev => {
  if(!dnd || !dndOver) return;
  ev.preventDefault();
  const node = dnd, m = dndOver;
  clearDrop(); dnd = null;
  performMove(node, m.target, m.zone);
});
tocBody.addEventListener('dragend', () => { clearDrop(); dnd = null; tocBody.querySelectorAll('.dragging').forEach(x => x.classList.remove('dragging')); });


/* ---------- related topics ---------- */
function topicNodeName(id){ if(IDX.topics[id]) return IDX.topics[id].name; const s = IDX.subs[id]; return s ? [IDX.topics[IDX.topicOf[id]].name].concat(subPath(s)).join(' › ') : ''; }
function topicNodeView(id){ return IDX.topics[id] ? id + '-all' : id; }
function relatedTopicsHTML(id){
  const L = IDX.tlinksOf[id] || [];
  if(!L.length) return '';
  const chips = L.map(([o, note, l]) => '<span class="tl-item"><button type="button" class="relchip" data-view="' + esc(topicNodeView(o)) + '">' + (tlBranch(l) ? '<i class="tl-dot" style="--tlc:' + tlBranch(l).color + '" aria-hidden="true"></i>' : '') + esc(topicNodeName(o)) + '</button>' + (tlBranch(l) ? '<span class="tl-path" style="--tlc:' + tlBranch(l).color + '">' + esc(tlBranch(l).name) + '</span>' : '') + (note ? '<span class="rel-note">' + esc(note) + '</span>' : '') +
    ('<button type="button" class="tl-x" data-tlink-note="' + esc(l[0] + '|' + l[1]) + '" title="Note and colour" aria-label="Note and colour of this link">✎</button><button type="button" class="tl-x" data-tlink-del="' + esc(l[0] + '|' + l[1]) + '" aria-label="Remove this link">×</button>') + '</span>').join('');
  return '<p class="rel tl-row"><span class="rel-k">Related topics</span>' + chips + '<button type="button" class="linkbtn tl-add" data-tlink-add="' + esc(id) + '">+ Related topic…</button></p>';
}
function findTlink(key){ const [a, b] = key.split('|'); return lib.tlinks.find(l => l[0] === a && l[1] === b); }
function openTopicLinkPicker(id){
  openModal({
    title: 'What is “' + topicNodeName(id) + '” related to?',
    body:'<div class="lk-done" id="tlDone" aria-live="polite"></div><div class="form-grid"><label class="full">Search topics and subtopics<input type="search" id="tlq" autocomplete="off"></label></div><div class="picker-list" id="tlList"></div><p class="hint">Click a topic to link it: it moves up to “Linked”. × unlinks one. Give a link a colour later from its ✎.</p>',
    actions:[{label:'Done', primary:true}],
    onOpen: b => {
      const inp = b.querySelector('#tlq'), list = b.querySelector('#tlList'), done = b.querySelector('#tlDone');
      const drawDone = fresh => {
        const L = IDX.tlinksOf[id] || [];
        done.innerHTML = '<span class="rel-k">Linked</span>' + (L.length ? L.map(([o, note, l]) => '<span class="pick' + (o === fresh ? ' fresh' : '') + '">' + esc(topicNodeName(o)) + '<button type="button" aria-label="Unlink" data-untl="' + esc(l[0] + '|' + l[1]) + '">×</button></span>').join('') : '<span class="hint">nothing yet</span>');
      };
      done.addEventListener('click', ev => {
        const u = ev.target.closest('[data-untl]'); if(!u) return;
        const l = findTlink(u.dataset.untl); if(!l) return;
        const before = clone(lib);
        lib.tlinks = lib.tlinks.filter(x => x !== l);
        reindex(); touchLib([]); renderMain(); renderMap(true); drawDone(); draw();
        toast('Unlinked', () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
      });
      const draw = () => {
        const q = inp.value.trim().toLowerCase();
        const have = new Set((IDX.tlinksOf[id] || []).map(x => x[0]));
        const all = [];
        lib.topics.forEach(tp => { all.push(tp.id); visibleSubs(tp).forEach(s => all.push(s.id)); });
        const c = all.filter(x => x !== id && !have.has(x) && (!q || topicNodeName(x).toLowerCase().includes(q)));
        list.innerHTML = c.map(x => '<button type="button" data-pick-tl="' + esc(x) + '">' + esc(topicNodeName(x)) + '</button>').join('') || '<p class="hint" style="padding:.4em .6em">Nothing found.</p>';
      };
      inp.addEventListener('input', draw);
      drawDone();
      list.addEventListener('click', ev => {
        const pb = ev.target.closest('[data-pick-tl]'); if(!pb) return;
        const before = clone(lib);
        lib.tlinks.push([id, pb.dataset.pickTl]);
        reindex(); touchLib([]); renderMain(); renderMap(true);
        inp.value = ''; draw(); drawDone(pb.dataset.pickTl); inp.focus();
        toast('Linked: ' + topicNodeName(id) + ' is related to ' + topicNodeName(pb.dataset.pickTl), () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
      });
      draw();
    }
  });
}
function openTopicLinkNote(key){
  const l = findTlink(key); if(!l) return;
  const cur = (lib.tlinkColor || {})[key] || '';
  openModal({
    title:'This link',
    body:'<div class="form-grid"><label class="full">Note, shown next to the link<input type="text" id="tlNote" maxlength="60" value="' + esc(l[2] || '') + '"></label>' +
      '<label class="full">Path (a colour line)<select id="tlBranch"><option value="">None: the default blue</option>' + (lib.branches || []).map(x => '<option value="' + x.id + '"' + (x.id === cur ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '<option value="__new">New colour line…</option></select><span class="hint">Name the path this link belongs to, such as Historical Development. The name shows in lists and tooltips, never on the map.</span></label>' +
      '<div class="full ln-new" hidden><label class="ln-name">Name of this colour line<input type="text" id="tlBrName" maxlength="40" placeholder="Main line"></label><div class="ln-col"><span class="field-k">Colour</span>' + swatchesHTML(nextBranchColor(), 'tl') + '</div></div></div>',
    actions:[{label:'Cancel'}, {label:'Save', primary:true, onClick: bd => {
      const before = clone(lib);
      const v = bd.querySelector('#tlNote').value.trim(); if(v) l[2] = v; else l.length = 2;
      let bid = bd.querySelector('#tlBranch').value;
      const nm = bd.querySelector('#tlBrName').value.trim(), col = bd.querySelector('[data-swatches="tl"] .sw-input').value;
      if(bid === '__new'){
        let id; do{ id = rid('b'); }while(lib.branches.some(x => x.id === id));
        lib.branches.push({id, name: nm || 'Colour line ' + (lib.branches.length + 1), color: HEX_RE.test(col) ? col : nextBranchColor()});
        bid = id;
      }else if(bid){
        const br = lib.branches.find(x => x.id === bid);
        if(br){ if(nm) br.name = nm.slice(0, 40); if(HEX_RE.test(col)) br.color = col; }
      }
      if(bid) lib.tlinkColor[key] = bid; else delete lib.tlinkColor[key];
      reindex(); touchLib([]); renderMain(); renderMap(true);
      toast('Link saved', () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
    }}],
    onOpen: b2 => {
      const sel = b2.querySelector('#tlBranch'), nw = b2.querySelector('.ln-new'), nmI = b2.querySelector('#tlBrName'), sw = b2.querySelector('[data-swatches="tl"]');
      bindSwatches(b2);
      const setCol = c => { sw.querySelector('.sw-input').value = c; sw.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x.dataset.sw.toLowerCase() === c.toLowerCase())); };
      const sync = () => {
        const v = sel.value, br = lib.branches.find(x => x.id === v);
        nw.hidden = !v;
        if(v === '__new'){ nmI.value = ''; nmI.placeholder = 'Main line'; setCol(nextBranchColor()); }
        else if(br){ nmI.value = br.name; setCol(br.color); }
      };
      sel.addEventListener('change', sync); sync();
    }
  });
}

/* once a session at most: which of your private repositories holds this file? (the newest first, a dozen at most) */
let PDF_LOOKED = null;
async function pdfLookAround(c, path, skip){ try{ if(PDF_LOOKED === false) return null;
    if(!PDF_LOOKED){ const r = await fetch('https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner', {headers: ghHeaders(c)}); if(!r.ok){ PDF_LOOKED = false; return null; }
      PDF_LOOKED = (await r.json()).filter(x => x && x.private && x.owner && String(x.owner.login).toLowerCase() === String(c.owner).toLowerCase()).map(x => x.name); }
    for(const repo of PDF_LOOKED.filter(n => !skip.includes(n)).slice(0, 12)){ const cA = ghRepo(c, repo), r2 = await fetch(ghPathUrl(cA, path) + '?_=' + Date.now(), {headers: ghHeaders(cA, {'Accept':'application/vnd.github.raw+json'})}); if(r2.ok) return {r: r2, repo}; }
  }catch(e){} return null; }
