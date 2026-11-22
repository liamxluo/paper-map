/* ===================== moving your library to another repository =====================
   Everything in the repository your library is kept in comes along: the library itself, the PDFs and the books kept there,
   the pictures on your mind maps. The new repository must be private (Paper Map makes it, private, when your token may).
   Each file is copied and then checked: GitHub names a file by its content, so a copy is right when its name matches the
   original's. All of it lands in one commit, and only then does Paper Map switch over. The old repository is left exactly as
   it was; delete it on GitHub yourself when you are sure. Your PDF and handwriting repositories (paper-map-pdfs,
   paper-map-notes) are separate and stay where they are. */
async function ghMoveLibrary(to, step){ const c = ghCfg(); step = step || (() => {});
  if(!c || c.kind === 'folder' || c.kind === 'dropbox') throw new Error('Your library is not kept on GitHub.');
  to = String(to || '').trim(); if(!/^[A-Za-z0-9._-]{1,100}$/.test(to)) throw new Error('A repository name can contain only letters, numbers, dots, underscores and hyphens.'); if(to === c.repo) throw new Error('That is the repository your library is in now.');
  const nc = Object.assign({}, c, {repo: to}); let pv = await ghIsPrivate(nc, to);
  if(pv === null){ step('Making ' + to + ' (private)…'); if(!(await ghEnsureRepo(nc, to, 'Your Paper Map library'))) throw new Error('There is no repository named ' + to + ', and your token may not make one. Make it on GitHub (private), then try again.'); pv = true; }
  if(pv !== true) throw new Error('The repository ' + to + ' is not private. Paper Map moves your library only into a private repository.');
  const H = x => ghHeaders(c, x), api = r => 'https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(r), j = async (u, o) => { const r = await fetch(u, o); if(!r.ok) throw new Error('GitHub answered ' + r.status + ' for ' + u.split('/repos/')[1]); return r.json(); };
  step('Reading what is in ' + c.repo + '…');
  const oldInfo = await j(api(c.repo), {headers: H()}), ob = c.branch || oldInfo.default_branch || 'main';
  const tree = await j(api(c.repo) + '/git/trees/' + encodeURIComponent(ob) + '?recursive=1', {headers: H()}); if(tree.truncated) throw new Error('This repository holds too many files to move in one go.');
  const files = (tree.tree || []).filter(t => t.type === 'blob' && !/^README(\.md)?$/i.test(t.path));
  const newInfo = await j(api(to), {headers: H()}), nb = newInfo.default_branch || 'main';
  const ref = await j(api(to) + '/git/ref/heads/' + encodeURIComponent(nb), {headers: H()}), head = await j(api(to) + '/git/commits/' + ref.object.sha, {headers: H()});
  const entries = []; let bytes = 0;
  for(let i = 0; i < files.length; i++){ const f = files[i]; step('Copying ' + (i + 1) + ' of ' + files.length + ': ' + f.path);
    const blob = await j(api(c.repo) + '/git/blobs/' + f.sha, {headers: H()});
    const made = await j(api(to) + '/git/blobs', {method: 'POST', headers: H({'Content-Type': 'application/json'}), body: JSON.stringify({content: String(blob.content || '').replace(/\n/g, ''), encoding: blob.encoding || 'base64'})});
    if(made.sha !== f.sha) throw new Error('The copy of ' + f.path + ' did not match the original; nothing was switched.');
    entries.push({path: f.path, mode: f.mode || '100644', type: 'blob', sha: made.sha}); bytes += f.size || 0; }
  step('Writing it all in one commit…');
  const nt = await j(api(to) + '/git/trees', {method: 'POST', headers: H({'Content-Type': 'application/json'}), body: JSON.stringify({base_tree: head.tree.sha, tree: entries})});
  const cm = await j(api(to) + '/git/commits', {method: 'POST', headers: H({'Content-Type': 'application/json'}), body: JSON.stringify({message: 'Your library, moved from ' + c.repo + ' by Paper Map', tree: nt.sha, parents: [ref.object.sha]})});
  await j(api(to) + '/git/refs/heads/' + encodeURIComponent(nb), {method: 'PATCH', headers: H({'Content-Type': 'application/json'}), body: JSON.stringify({sha: cm.sha})});
  step('Checking the copy…'); const check = await j(api(to) + '/git/trees/' + encodeURIComponent(nb) + '?recursive=1', {headers: H()}); const got = new Map((check.tree || []).filter(t => t.type === 'blob').map(t => [t.path, t.sha]));
  const missing = entries.filter(e => got.get(e.path) !== e.sha); if(missing.length) throw new Error(missing.length + ' files are not in ' + to + ' as they should be; nothing was switched.');
  /* the library's own notes of where things are: a PDF said to be in the old repository is now in the new one */
  const walk = o => { if(!o || typeof o !== 'object') return; if(Array.isArray(o)){ o.forEach((v, i) => { if(v === c.repo && o.__repos) o[i] = to; walk(v); }); return; } Object.keys(o).forEach(k => { if(k === 'repo' && o[k] === c.repo) o[k] = to; else if(k === 'repos' && Array.isArray(o[k])) o[k] = o[k].map(v => v === c.repo ? to : v); else walk(o[k]); }); };
  walk(lib);
  step('Copying your book files (kept in Releases)…'); let books = {copied: 0, failed: 0}; try{ books = await ghCopyAssets(c, c.repo, to, step); }catch(e){}
  const dataSha = got.get(c.path || 'data/paper-map.json'); const old0 = lsGet(GH_KEY) || c; const cfg = Object.assign({}, old0, {repo: to, branch: nb, repoId: newInfo.id, prevRepos: [...new Set([c.repo].concat(old0.prevRepos || []))].slice(0, 6), bringFrom: null, broughtFrom: c.repo}); if(dataSha) cfg.sha = dataSha; lsSet(GH_KEY, cfg);
  try{ GH_PRIV[(c.owner + '/' + to).toLowerCase()] = {v: true, at: Date.now()}; }catch(e){}
  touchLib(); return {files: files.length, bytes, from: c.repo, to, books}; }
function ghMoveAsk(){ const c = ghCfg(); if(!c) return; const to = prompt('Move your library, with its PDFs, books and pictures, into which private repository? (Paper Map makes it if it is not there.)', c.repo + '-new'); if(to == null) return;
  openModal({title: 'Moving your library', body: '<p id="mvStep">Starting…</p>', actions: []});
  ghMoveLibrary(to, s => { const el = document.getElementById('mvStep'); if(el) el.textContent = s; }).then(r => { closeModal();
      openModal({title: 'Your library is in ' + esc(r.to), body: '<p>' + r.files + ' files (' + (r.bytes / 1048576).toFixed(1) + ' MB) were copied and each one checked' + (r.books && (r.books.copied || r.books.failed) ? ', and ' + r.books.copied + ' book files' + (r.books.failed ? ' (' + r.books.failed + ' could not be copied here: open Paper Map on your Mac to bring those)' : '') : '') + '. Paper Map now saves to ' + esc(r.to) + '.</p><p>' + esc(r.from) + ' is left as it was. Delete it on GitHub when you are sure you no longer need it. Your PDF and handwriting repositories stay where they are.</p>', actions: [{label: 'Done', primary: true, onClick: () => closeModal()}]}); })
    .catch(e => { closeModal(); openModal({title: 'Nothing was moved', body: '<p>' + esc(e.message || String(e)) + '</p><p>Your library is still kept in ' + esc(c.repo) + ', as before.</p>', actions: [{label: 'OK', primary: true, onClick: () => closeModal()}]}); }); }
/* ---- book files live in the library repository's Releases (outside its history): copied one by one into the new one ---- */
async function ghCopyAssets(c, from, to, step){ step = step || (() => {}); const fc = ghRepo(c, from), tc = ghRepo(c, to), api = 'https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/';
  const rels = await (await fetch(api + encodeURIComponent(from) + '/releases?per_page=100', {headers: ghHeaders(c)})).json().catch(() => []);
  const have = new Set(); try{ const tr = await (await fetch(api + encodeURIComponent(to) + '/releases?per_page=100', {headers: ghHeaders(c)})).json(); (Array.isArray(tr) ? tr : []).filter(r => /^paper-map-files/.test(r.tag_name)).forEach(r => (r.assets || []).forEach(a => have.add(a.name))); }catch(e){}
  const assets = (Array.isArray(rels) ? rels : []).filter(r => /^paper-map-files/.test(r.tag_name)).flatMap(r => r.assets || []); const map = {}; let copied = 0, failed = 0;
  for(let i = 0; i < assets.length; i++){ const a = assets[i]; step('Copying book file ' + (i + 1) + ' of ' + assets.length + ': ' + a.name);
    if(have.has(a.name)){ continue; } const blob = await ghAssetGet(fc, a.id); if(!blob){ failed++; continue; }
    try{ const up = await ghAssetPut(tc, a.name, blob); map[a.id] = Object.assign({}, up, {repo: to}); copied++; }catch(e){ failed++; } }
  (lib.readings || []).forEach(bk => (bk.files || []).forEach(x => { if(!x.asset) return; if(map[x.asset.id]) x.asset = map[x.asset.id]; else if(!x.asset.repo) x.asset.repo = from; }));
  if(copied) touchLib(); return {copied, failed, total: assets.length}; }
/* ---- bringing files from a repository your library was kept in before: PDFs, books and pictures that are not here yet ---- */
async function ghBringFiles(from, step){ const c = ghCfg(); step = step || (() => {}); if(!c || c.kind === 'folder' || c.kind === 'dropbox') throw new Error('Your library is not kept on GitHub.');
  if(!from || from === c.repo) throw new Error('Choose the repository your library was kept in before.');
  const pv = await ghIsPrivate(c, from); if(pv === null) throw new Error('There is no repository named ' + from + ' that your token can open.');
  const H = x => ghHeaders(c, x), api = r => 'https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(r), j = async (u, o) => { const r = await fetch(u, o); if(!r.ok) throw new Error('GitHub answered ' + r.status); return r.json(); };
  step('Reading what is in ' + from + '…'); const fi = await j(api(from), {headers: H()}), ti = await j(api(c.repo), {headers: H()}), tb = c.branch || ti.default_branch || 'main';
  const ft = await j(api(from) + '/git/trees/' + encodeURIComponent(fi.default_branch || 'main') + '?recursive=1', {headers: H()}), tt = await j(api(c.repo) + '/git/trees/' + encodeURIComponent(tb) + '?recursive=1', {headers: H()});
  const here = new Set((tt.tree || []).filter(x => x.type === 'blob').map(x => x.path)), want = (ft.tree || []).filter(x => x.type === 'blob' && /^(pdfs|books|clips)\//.test(x.path) && !here.has(x.path));
  let files = 0;
  if(want.length){ const ref = await j(api(c.repo) + '/git/ref/heads/' + encodeURIComponent(tb), {headers: H()}), head = await j(api(c.repo) + '/git/commits/' + ref.object.sha, {headers: H()}), entries = [];
    for(let i = 0; i < want.length; i++){ const f = want[i]; step('Copying ' + (i + 1) + ' of ' + want.length + ': ' + f.path); const blob = await j(api(from) + '/git/blobs/' + f.sha, {headers: H()});
      const made = await j(api(c.repo) + '/git/blobs', {method: 'POST', headers: H({'Content-Type': 'application/json'}), body: JSON.stringify({content: String(blob.content || '').replace(/\n/g, ''), encoding: blob.encoding || 'base64'})});
      if(made.sha !== f.sha) throw new Error('The copy of ' + f.path + ' did not match the original.'); entries.push({path: f.path, mode: f.mode || '100644', type: 'blob', sha: made.sha}); }
    const nt = await j(api(c.repo) + '/git/trees', {method: 'POST', headers: H({'Content-Type': 'application/json'}), body: JSON.stringify({base_tree: head.tree.sha, tree: entries})});
    const cm = await j(api(c.repo) + '/git/commits', {method: 'POST', headers: H({'Content-Type': 'application/json'}), body: JSON.stringify({message: 'Files brought from ' + from + ' by Paper Map', tree: nt.sha, parents: [ref.object.sha]})});
    await j(api(c.repo) + '/git/refs/heads/' + encodeURIComponent(tb), {method: 'PATCH', headers: H({'Content-Type': 'application/json'}), body: JSON.stringify({sha: cm.sha})}); files = entries.length; }
  const walk = o => { if(!o || typeof o !== 'object') return; if(Array.isArray(o)){ o.forEach(walk); return; } Object.keys(o).forEach(k => { if(k === 'repo' && o[k] === from && o !== lib.notesStore) o[k] = c.repo; else walk(o[k]); }); };
  (Object.values(lib.entries || {})).forEach(e => { if(e.pdf && e.pdf.repo === from) e.pdf.repo = c.repo; });
  step('Copying your book files…'); let books = {copied: 0, failed: 0, total: 0}; try{ books = await ghCopyAssets(c, from, c.repo, step); }catch(e){}
  const cfg = Object.assign({}, lsGet(GH_KEY) || c, {broughtFrom: from}); lsSet(GH_KEY, cfg); touchLib(); return {files, books, from, to: c.repo}; }
function ghBringAsk(from){ const c = ghCfg(); if(!c) return; const g = lsGet(GH_KEY) || {}; from = from || prompt('Bring your PDFs, books and pictures from which repository? (the one your library was kept in before)', (g.prevRepos || [])[0] || g.bringFrom || 'paper-map-data'); if(!from) return;
  openModal({title: 'Bringing your files', body: '<p id="mvStep">Starting…</p>', actions: []});
  ghBringFiles(from.trim(), s => { const el = document.getElementById('mvStep'); if(el) el.textContent = s; }).then(r => { closeModal(); openModal({title: 'Your files are here', body: '<p>' + r.files + ' files (PDFs, books kept in the library, pictures) and ' + r.books.copied + ' book files were brought from ' + esc(r.from) + ' into ' + esc(r.to) + ', each one checked.' + (r.books.failed ? ' ' + r.books.failed + ' book files could not be copied here; open Paper Map on your Mac to bring those (until then they still open from ' + esc(r.from) + ').' : '') + '</p><p>' + esc(r.from) + ' is left as it was.</p>', actions: [{label: 'Done', primary: true, onClick: () => closeModal()}]}); })
    .catch(e => { closeModal(); openModal({title: 'Nothing was brought', body: '<p>' + esc(e.message || String(e)) + '</p>', actions: [{label: 'OK', primary: true, onClick: () => closeModal()}]}); }); }
/* ---- after switching to another repository: offer once to bring the files along; and make sure the PDF and handwriting
   repositories exist (private) when your token may make them ---- */
setTimeout(async () => { try{ const c = ghCfg(); if(!c || c.kind === 'folder' || c.kind === 'dropbox' || PREVIEW) return; const g = lsGet(GH_KEY) || {};
    if(!g.storesMade){ const a = await ghEnsureRepo(c, PDF_REPO, 'PDFs kept by Paper Map'), b = await ghEnsureRepo(c, NOTES_REPO, 'Handwriting kept by Paper Map'); if(a && b){ const g2 = lsGet(GH_KEY) || {}; g2.storesMade = true; lsSet(GH_KEY, g2); } }
    if(g.bringFrom && g.broughtFrom !== g.bringFrom){ const pv = await ghIsPrivate(c, g.bringFrom); if(pv === null) return;
      openModal({title: 'Bring your files along?', body: '<p>Your library now lives in ' + esc(c.repo) + ', but its PDFs, books and pictures are still in ' + esc(g.bringFrom) + '. Paper Map can copy them here, checking each one; ' + esc(g.bringFrom) + ' is left as it was.</p>', actions: [{label: 'Not now', onClick: () => { const g2 = lsGet(GH_KEY) || {}; g2.broughtFrom = g2.bringFrom; lsSet(GH_KEY, g2); closeModal(); }}, {label: 'Bring them', primary: true, onClick: () => { closeModal(); ghBringAsk(g.bringFrom); }}]}); } }catch(e){} }, 6000);
Object.assign(window, {ghMoveLibrary, ghMoveAsk, ghBringFiles, ghBringAsk, ghCopyAssets});
/* New GitHub settings (another token, another repository) mean a fresh start: what Paper Map learned with the old ones
   (that a repository could not be made, which repositories are private, when it last tried) is forgotten at once, and the
   PDF and handwriting repositories are made straight away when the new token may. Before this, an answer learned with an
   earlier token was kept for up to an hour, and PDFs went into the library's repository meanwhile. */
function ghFresh(){ try{ Object.keys(GH_PRIV).forEach(k => delete GH_PRIV[k]); }catch(e){} try{ Object.keys(GH_MADE).forEach(k => delete GH_MADE[k]); }catch(e){}
  try{ PDF_PROBE_AT = 0; PDF_ROLL_AT = 0; }catch(e){} try{ NS.probedAt = 0; NS.repo = null; NS.hinted = false; }catch(e){}
  const g = lsGet(GH_KEY) || {}; if(g.storesMade){ delete g.storesMade; lsSet(GH_KEY, g); }
  clearTimeout(ghFresh.t); ghFresh.t = setTimeout(ghStoresNow, 1200); }
async function ghStoresNow(){ const c = ghCfg(); if(!c || c.kind === 'folder' || c.kind === 'dropbox' || PREVIEW) return {};
  let pdfs = null, notes = null; try{ pdfs = await pdfTarget(c); }catch(e){} try{ notes = await nsRepo(); }catch(e){}
  const ok = pdfs && pdfs !== c.repo && notes; if(ok){ const g = lsGet(GH_KEY) || {}; g.storesMade = true; lsSet(GH_KEY, g); } return {pdfs, notes}; }
{ const _gs = ghStore; ghStore = function(c){ const old = lsGet(GH_KEY) || {}; const r = _gs.apply(this, arguments);
    try{ if(c && (c.repo !== old.repo || c.owner !== old.owner || (c.token && c.token !== '__keychain__' && c.token !== old.token))) ghFresh(); }catch(e){} return r; }; }
if(/[?&]pmtest/.test(location.search)) Object.assign(window.__sec || (window.__sec = {}), {ghStore: c => ghStore(c), ghStoresNow});
