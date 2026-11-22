/* ===================== the papers' PDFs, in a repository of their own =====================
   Your library (notes, maps, the list of papers) stays in its repository with its whole history. Papers' PDFs go to a
   private repository of their own, paper-map-pdfs, which you make once on GitHub: an ordinary repository, so the iPad
   and the web open them too. Because it holds only PDFs, its history can be cleared without touching your notes, and
   Paper Map does so quietly when deleted PDFs have made it much bigger than what it holds. When it nears 1 GB, the next
   one (paper-map-pdfs-2, …) is used once you have made it; PDFs already kept stay where they are. */
const PDF_REPO = 'paper-map-pdfs', PDF_FULL_KB = 900 * 1024;
let PDF_PROBE_AT = 0, PDF_ROLL_AT = 0, PDF_ASKED = 0, PDF_PROBING = null;
function ghRepo(c, repo){ return repo && repo !== c.repo ? Object.assign({}, c, {repo}) : c; }
function pdfRepoOf(c, e){ return ghRepo(c, e && e.pdf && e.pdf.repo); }
async function ghRepoInfo(c, repo){ const pv = await ghIsPrivate(c, repo); if(pv === false){ ghSayPublic(repo); return null; } try{ const r = await fetch('https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(repo), {headers: ghHeaders(c)}); if(!r.ok) return null; const j = await r.json(); return j && j.permissions && j.permissions.push === false ? null : j; }catch(e){ return null; } }
/* Paper Map makes its own repositories (private) when your key allows it: a classic key with the repo scope, or a
   fine-grained key for all your repositories with Administration and Contents set to read and write. Otherwise it says
   once what to make by hand. It tries at most once an hour per repository. */
const GH_MADE = {};
async function ghEnsureRepo(c, name, about){ const have = await ghRepoInfo(c, name); if(have) return true; if(Date.now() - (GH_MADE[name] || 0) < 3600e3) return false; GH_MADE[name] = Date.now();
  try{ const me = await (await fetch('https://api.github.com/user', {headers: ghHeaders(c)})).json(); const mine = me && me.login && me.login.toLowerCase() === String(c.owner).toLowerCase();
    const url = mine ? 'https://api.github.com/user/repos' : 'https://api.github.com/orgs/' + encodeURIComponent(c.owner) + '/repos';
    const r = await fetch(url, {method: 'POST', headers: ghHeaders(c, {'Content-Type': 'application/json'}), body: JSON.stringify({name, private: true, auto_init: true, description: about})});
    if(r.ok || r.status === 201){ await new Promise(z => setTimeout(z, 1500)); delete GH_PRIV[(c.owner + '/' + name).toLowerCase()]; return (await ghIsPrivate(c, name)) === true && !!(await ghRepoInfo(c, name)); } }catch(e){}
  return false; }
/* the repository a new PDF goes to: the PDF repository once it is there, else the library's own (as before) */
async function pdfTarget(c){ if(!c || c.kind === 'folder' || c.kind === 'dropbox') return c && c.repo;
  const st = lib.pdfStore;
  if(st && st.current){ if(Date.now() - PDF_ROLL_AT > 3600e3){ PDF_ROLL_AT = Date.now(); try{ await pdfRoll(c); }catch(e){} } return lib.pdfStore.current; }
  if(PDF_PROBING) return PDF_PROBING;
  if(Date.now() - PDF_PROBE_AT < 600e3) return c.repo; PDF_PROBE_AT = Date.now();
  PDF_PROBING = (async () => { let info = await ghRepoInfo(c, PDF_REPO); if(!info && await ghEnsureRepo(c, PDF_REPO, 'PDFs kept by Paper Map')) info = await ghRepoInfo(c, PDF_REPO); if(!info){ pdfSayWhy(c); return c.repo; }
    lib.pdfStore = {repos: [PDF_REPO], current: PDF_REPO}; touchLib(); setTimeout(() => { pdfMove().catch(() => {}); }, 4000); return PDF_REPO; })();
  try{ return await PDF_PROBING; } finally { PDF_PROBING = null; } }
/* nearly full: the next one, if you have made it; if not, one short word a day */
async function pdfRoll(c){ const st = lib.pdfStore, info = await ghRepoInfo(c, st.current); if(!info || (info.size || 0) < PDF_FULL_KB) return;
  const n = st.repos.length + 1, next = PDF_REPO + '-' + n, ok = (await ghRepoInfo(c, next)) || (await ghEnsureRepo(c, next, 'PDFs kept by Paper Map (' + n + ')'));
  if(ok){ st.repos.push(next); st.current = next; touchLib(); return; }
  if(Date.now() - PDF_ASKED > 864e5){ PDF_ASKED = Date.now(); toast('Your PDFs on GitHub are nearly 1 GB. Make a private repository named ' + next + ' and give your key access to it; new PDFs will go there.'); } }
/* once the PDF repository is there, the PDFs kept with the library move into it, quietly, one by one */
let PDF_MOVING = false;
async function pdfMove(){ if(PDF_MOVING) return; const c = ghCfg(); if(!c || !lib.pdfStore) return; PDF_MOVING = true;
  try{ const todo = Object.values(lib.entries).filter(e => e.kind === 'paper' && e.pdf && /^pdfs\//.test(e.pdf.path || '') && !e.pdf.repo);
    for(const e of todo){ try{ const r = await fetch(ghPathUrl(c, e.pdf.path) + ghRef(c), {headers: ghHeaders(c, {'Accept': 'application/vnd.github.raw+json'})}); if(!r.ok) continue;
        const bytes = new Uint8Array(await r.arrayBuffer()); if(!bytes.length) continue;
        const to = lib.pdfStore.current, cT = ghRepo(c, to), content = await fileToBase64(new Blob([bytes], {type: 'application/pdf'}));
        const sha = await ghSerial(async () => { let w = await ghPutPath(cT, e.pdf.path, content, 'PDF: ' + (e.t || e.id), null); if(w.status === 409 || w.status === 422){ const known = await ghPathSha(cT, e.pdf.path); w = await ghPutPath(cT, e.pdf.path, content, 'PDF: ' + (e.t || e.id), known); } if(!w.ok) throw {status: w.status}; const j = await w.json(); return j && j.content && j.content.sha; });
        const oldSha = e.pdf.sha; e.pdf = Object.assign({}, e.pdf, {repo: to, sha: sha || null}); touchLib([e.topic]);
        try{ await ghSerial(async () => { const s = oldSha || await ghPathSha(c, e.pdf.path); if(s) await ghDeletePath(c, e.pdf.path, s, 'PDF moved to ' + to + ': ' + (e.t || e.id)); }); }catch(err){}
        await new Promise(r => setTimeout(r, 500)); }catch(err){} } }
  finally{ PDF_MOVING = false; } }
/* a PDF repository whose history has grown well past what it holds (deleted and replaced PDFs) has its history cleared:
   one commit with what is there now. Your notes are not in it, so nothing else is touched. At most once a week. */
async function pdfTidy(){ const c = ghCfg(), st = lib.pdfStore; if(!c || !st) return; const last = +(localStorage.getItem('pm:pdfTidy') || 0); if(Date.now() - last < 7 * 864e5) return; localStorage.setItem('pm:pdfTidy', String(Date.now()));
  for(const repo of st.repos){ try{ const info = await ghRepoInfo(c, repo); if(!info) continue; const held = Object.values(lib.entries).filter(e => e.pdf && e.pdf.repo === repo).reduce((n, e) => n + (e.pdf.size || 0), 0);
      if((info.size || 0) * 1024 < 1.4 * held + 30 * 1048576) continue;
      const base = 'https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(repo), br = info.default_branch || 'main';
      const ref = await (await fetch(base + '/git/ref/heads/' + encodeURIComponent(br), {headers: ghHeaders(c)})).json(), head = await (await fetch(base + '/git/commits/' + ref.object.sha, {headers: ghHeaders(c)})).json();
      const nc = await fetch(base + '/git/commits', {method: 'POST', headers: ghHeaders(c, {'Content-Type': 'application/json'}), body: JSON.stringify({message: 'PDFs as they are now (history cleared by Paper Map)', tree: head.tree.sha, parents: []})});
      if(!nc.ok) continue; const j = await nc.json();
      const now = await (await fetch(base + '/git/ref/heads/' + encodeURIComponent(br) + '?_=' + Date.now(), {headers: ghHeaders(c)})).json(); if(!now || !now.object || now.object.sha !== ref.object.sha) continue;
      await fetch(base + '/git/refs/heads/' + encodeURIComponent(br), {method: 'PATCH', headers: ghHeaders(c, {'Content-Type': 'application/json'}), body: JSON.stringify({sha: j.sha, force: true})}); }catch(e){} } }
if(!PREVIEW){ setTimeout(async () => { try{ const c = ghCfg(); if(c){ await pdfTarget(c); if(lib.pdfStore){ await pdfMove(); await pdfTidy(); } } }catch(e){} }, 25000); }
/* the PDF reader and the upload, written before the start-up, reach these by name */
Object.assign(window, {pdfTarget, ghRepo, pdfRepoOf, pdfMove, ghEnsureRepo, ghRepoInfo});

/* PDFs that cannot go to a repository of their own go into the library's; you are told why, and what to do, once a day */
function pdfSayWhy(c){ try{ const last = +(localStorage.getItem('pm:pdfWhy') || 0); if(Date.now() - last < 864e5) return; localStorage.setItem('pm:pdfWhy', String(Date.now()));
    openModal({title: 'Your PDFs need a repository of their own', body: '<p>Paper Map keeps PDFs apart from your library, in a private repository named <b>' + PDF_REPO + '</b>, so the library stays small. Your token may not make that repository, so for now PDFs go into <b>' + esc(c.repo) + '</b>.</p><p>Either <a href="https://github.com/new?name=' + PDF_REPO + '&visibility=private" target="_blank" rel="noopener">make ' + PDF_REPO + ' (private)</a> and give your token access to it, or use a token for all repositories with Administration and Contents set to read and write. Paper Map then moves the PDFs already in ' + esc(c.repo) + ' over by itself.</p>', actions: [{label: 'OK', primary: true}]}); }catch(e){} }
/* where each kind of thing is kept now, for the GitHub section of the cloud */
function ghWhereKept(){ const c = ghCfg(); if(!c || c.kind === 'folder' || c.kind === 'dropbox') return ''; const pdf = (lib.pdfStore && lib.pdfStore.current) || null, notes = (lib.notesStore && lib.notesStore.current) || null;
  return '<p class="hint gh-where">Library: <b>' + esc(c.repo) + '</b> · PDFs: <b>' + esc(pdf || c.repo) + '</b>' + (pdf ? '' : ' (no ' + PDF_REPO + ' yet)') + ' · Handwriting: <b>' + esc(notes || c.repo) + '</b>' + (notes ? '' : ' (no ' + NOTES_REPO + ' yet)') + '</p>'; }
window.ghWhereKept = ghWhereKept;
