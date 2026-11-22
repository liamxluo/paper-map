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
  const dataSha = got.get(c.path || 'data/paper-map.json'); const cfg = Object.assign({}, lsGet(GH_KEY) || c, {repo: to, branch: nb, repoId: newInfo.id}); if(dataSha) cfg.sha = dataSha; lsSet(GH_KEY, cfg);
  try{ GH_PRIV[(c.owner + '/' + to).toLowerCase()] = {v: true, at: Date.now()}; }catch(e){}
  touchLib(); return {files: files.length, bytes, from: c.repo, to}; }
function ghMoveAsk(){ const c = ghCfg(); if(!c) return; const to = prompt('Move your library, with its PDFs, books and pictures, into which private repository? (Paper Map makes it if it is not there.)', c.repo + '-new'); if(to == null) return;
  openModal({title: 'Moving your library', body: '<p id="mvStep">Starting…</p>', actions: []});
  ghMoveLibrary(to, s => { const el = document.getElementById('mvStep'); if(el) el.textContent = s; }).then(r => { closeModal();
      openModal({title: 'Your library is in ' + esc(r.to), body: '<p>' + r.files + ' files (' + (r.bytes / 1048576).toFixed(1) + ' MB) were copied and each one checked. Paper Map now saves to ' + esc(r.to) + '.</p><p>' + esc(r.from) + ' is left as it was. Delete it on GitHub when you are sure you no longer need it. Your PDF and handwriting repositories stay where they are.</p>', actions: [{label: 'Done', primary: true, onClick: () => closeModal()}]}); })
    .catch(e => { closeModal(); openModal({title: 'Nothing was moved', body: '<p>' + esc(e.message || String(e)) + '</p><p>Your library is still kept in ' + esc(c.repo) + ', as before.</p>', actions: [{label: 'OK', primary: true, onClick: () => closeModal()}]}); }); }
Object.assign(window, {ghMoveLibrary, ghMoveAsk});
