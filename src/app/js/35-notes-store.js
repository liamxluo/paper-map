/* ===================== handwriting, in a repository of its own =====================
   Handwriting is far larger than everything else you keep (a full page is tens of thousands of points), and your library
   is one file saved whole, with every save kept in its history. So handwriting lives apart: on this device first (the
   browser's database), and on GitHub in a private repository of its own, paper-map-notes (made once by you, like
   paper-map-pdfs), one file per paper, book or mind map, written compactly. The library keeps only a note of it.
   Safety first: an item's handwriting leaves the library only after GitHub has confirmed the copy; until then the library
   keeps it as before. Without the repository (or on iCloud/Dropbox) nothing changes. A copy that was not loaded yet is never
   written over: what is there is read and joined first, stroke by stroke. Uploads wait until you pause (20 seconds), and the
   repository's history is cleared at most once a week when it has grown well past what it holds. */
const NOTES_REPO = 'paper-map-notes';
const NS = {mem: {}, conf: {}, cur: {}, timers: {}, repo: null, probedAt: 0, loading: {}, sigs: new WeakMap()};
const nsPath = (kind, id) => 'ink/' + kind + '/' + id + '.json';
const nsQ = kind => kind === 'mind' ? 20 : 20000;
/* the same numbers whether freshly drawn or read back: points rounded to the store's precision */
function nsCanon(x, q){ if(Array.isArray(x)) return x.map(v => nsCanon(v, q)); if(x && typeof x === 'object'){ const o = {}; Object.keys(x).sort().forEach(k => { o[k] = k === 'p' && Array.isArray(x.p) ? x.p.map((v, i) => i % 3 === 2 ? Math.round((v || 0) * 255) / 255 : Math.round(v * q) / q) : nsCanon(x[k], q); }); return o; } return x; }
function nsSig(data, kind){ if(data && typeof data === 'object' && NS.sigs.has(data)) return NS.sigs.get(data); const s = JSON.stringify(nsCanon(data, nsQ(kind))); let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } const sig = (h >>> 0).toString(36) + '.' + s.length; if(data && typeof data === 'object') NS.sigs.set(data, sig); return sig; }
/* a stroke written compactly: its points as differences, zig-zag variable-length bytes, base64 */
function nsPack(data, q){ if(Array.isArray(data)) return data.map(v => nsPack(v, q)); if(data && typeof data === 'object'){ if(Array.isArray(data.p) && data.p.length % 3 === 0 && typeof data.p[0] === 'number'){ const o = Object.assign({}, data); delete o.p; const bytes = []; let px = 0, py = 0, pp = 0;
      const put = v => { v = v < 0 ? (-v * 2 - 1) : v * 2; while(v > 127){ bytes.push((v & 127) | 128); v = Math.floor(v / 128); } bytes.push(v); };
      for(let i = 0; i < data.p.length; i += 3){ const x = Math.round(data.p[i] * q), y = Math.round(data.p[i + 1] * q), pr = Math.round((data.p[i + 2] || 0) * 255); put(x - px); put(y - py); put(pr - pp); px = x; py = y; pp = pr; }
      let s = ''; for(let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); o.__z = btoa(s); o.__q = q; return o; }
    const o = {}; Object.keys(data).forEach(k => o[k] = nsPack(data[k], q)); return o; } return data; }
function nsUnpack(data){ if(Array.isArray(data)) return data.map(nsUnpack); if(data && typeof data === 'object'){ if(typeof data.__z === 'string'){ const o = Object.assign({}, data), q = data.__q || 1, s = atob(data.__z), p = []; delete o.__z; delete o.__q; let i = 0, px = 0, py = 0, pp = 0, k = 0;
      const get = () => { let v = 0, m = 1, b; do { b = s.charCodeAt(i++); v += (b & 127) * m; m *= 128; } while(b & 128); return v % 2 ? -(v + 1) / 2 : v / 2; };
      while(i < s.length){ const d = get(); if(k % 3 === 0){ px += d; p.push(px / q); } else if(k % 3 === 1){ py += d; p.push(py / q); } else { pp += d; p.push(pp / 255); } k++; } o.p = p; return o; }
    const o = {}; Object.keys(data).forEach(k => o[k] = nsUnpack(data[k])); return o; } return data; }
/* joining two copies, stroke by stroke (a stroke is kept once however many copies hold it) */
function nsUnion(a, b, q){ if(Array.isArray(a) && Array.isArray(b)){ const seen = new Set(), out = []; a.concat(b).forEach(s => { const k = JSON.stringify(nsCanon(s, q)); if(!seen.has(k)){ seen.add(k); out.push(s); } }); return out; }
  if(a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)){ const o = Object.assign({}, a); Object.keys(b).forEach(k => { o[k] = k in a ? nsUnion(a[k], b[k], q) : b[k]; }); return o; } return a != null ? a : b; }
/* the handwriting of each item, as the library holds it in memory */
function nsItems(L){ const out = []; Object.values(L.entries || {}).forEach(e => { if(e.ink || e.inkRef) out.push(['paper', e.id, e]); }); (L.readings || []).forEach(b => { if(b.ink || b.inkRef) out.push(['book', b.id, b]); }); (L.minds || []).forEach(m => { if(m.ink || m.inkRef) out.push(['mind', m.id, m]); }); Object.values(L.jpages || {}).forEach(p => { if(p.ink || p.inkRef) out.push(['page', p.id, p]); }); return out; }
/* what is saved (on this device and to GitHub): handwriting the notes repository has confirmed stays out of it */
function libSlim(L){ if(!L || !Object.keys(NS.conf).length) return L; let changed = false; const out = Object.assign({}, L);
  const slim = (kind, x) => { if(!x.ink) return x; const p = nsPath(kind, x.id), sig = nsSig(x.ink, kind); if(NS.conf[p] !== sig) return x; changed = true; const y = Object.assign({}, x); delete y.ink; y.inkRef = {sig, at: Date.now(), repo: (NS.repoOf && NS.repoOf[p]) || (x.inkRef && x.inkRef.repo) || NS.repo || NOTES_REPO}; return y; };
  out.entries = {}; Object.keys(L.entries || {}).forEach(k => out.entries[k] = slim('paper', L.entries[k]));
  out.readings = (L.readings || []).map(b => slim('book', b)); out.minds = (L.minds || []).map(m => slim('mind', m)); if(L.jpages){ out.jpages = {}; Object.keys(L.jpages).forEach(k => out.jpages[k] = slim('page', L.jpages[k])); } return changed ? out : L; }
const NOTES_FULL_KB = 900 * 1024;
async function nsRepo(){ const c = ghCfg(); if(!c || c.kind === 'folder' || c.kind === 'dropbox' || PREVIEW) return null; if(Date.now() - NS.probedAt < 600e3) return NS.repo; NS.probedAt = Date.now();
  const st = lib.notesStore || null;
  if(st && st.current){ const info = await ghRepoInfo(c, st.current); if(info && (info.size || 0) >= NOTES_FULL_KB){ const k = st.repos.length + 1, next = NOTES_REPO + '-' + k; if(await ghEnsureRepo(c, next, 'Handwriting kept by Paper Map (' + k + ')')){ st.repos.push(next); st.current = next; touchLib(); } } NS.repo = info ? st.current : null; return NS.repo; }
  let ok = !!(await ghRepoInfo(c, NOTES_REPO)); if(!ok) ok = await ghEnsureRepo(c, NOTES_REPO, 'Handwriting kept by Paper Map');
  if(ok){ lib.notesStore = {repos: [NOTES_REPO], current: NOTES_REPO}; touchLib(); NS.repo = NOTES_REPO; }
  else { NS.repo = null; if(!NS.hinted && nsItems(lib).some(([k, id, x]) => x.ink)){ NS.hinted = true; try{ toast('To keep your handwriting apart from your library, make a private repository named ' + NOTES_REPO + ' and give your key access to it (or a key that may make repositories).'); }catch(e){} } }
  return NS.repo; }
async function nsRemoteGet(p, from){ const c = ghCfg(), repo = from || await nsRepo(); if(!repo) return null; const cc = ghRepo(c, repo);
  const r = await fetch(ghPathUrl(cc, p) + ghRef(cc), {headers: ghHeaders(cc, {'Accept': 'application/vnd.github.raw+json'})}); if(r.status === 404) return {missing: true}; if(!r.ok) throw new Error('notes ' + r.status);
  const j = await r.json(); return {data: nsUnpack(j.data)}; }
/* a change to an item's handwriting: kept on this device at once, sent to GitHub after a pause */
function nsPut(kind, id, data){ if(PREVIEW) return; const p = nsPath(kind, id); NS.mem[p] = data; NS.cur[p] = nsSig(data, kind);
  try{ window.__pmdb && window.__pmdb.set('ink:' + p, {data, sig: NS.cur[p], at: Date.now()}); }catch(e){}
  clearTimeout(NS.timers[p]); NS.timers[p] = setTimeout(() => nsUpload(kind, id).catch(() => {}), 20000); }
async function nsUpload(kind, id){ const p = nsPath(kind, id), repo = await nsRepo(); if(!repo) return false; const c = ghCfg(), cc = ghRepo(c, repo); let data = NS.mem[p]; if(data == null) return false;
  const q = nsQ(kind);
  return ghSerial(async () => { let sha = await ghPathSha(cc, p);
    if(sha && NS.conf[p] !== nsSig(data, kind)){ try{ const there = await nsRemoteGet(p); if(there && there.data && !NS.confAt) data = nsUnion(data, there.data, q); }catch(e){} }
    const body = JSON.stringify({v: 1, kind, id, at: Date.now(), data: nsPack(nsCanon(data, q), q)}), content = btoa(unescape(encodeURIComponent(body)));
    let w = await ghPutPath(cc, p, content, 'Handwriting: ' + kind + ' ' + id, sha); if(w.status === 409 || w.status === 422){ sha = await ghPathSha(cc, p); w = await ghPutPath(cc, p, content, 'Handwriting: ' + kind + ' ' + id, sha); }
    if(!w.ok) return false; const sig = nsSig(data, kind); NS.conf[p] = sig; NS.repoOf = NS.repoOf || {}; NS.repoOf[p] = repo;
    if(data !== NS.mem[p]){ NS.mem[p] = data; nsApply(kind, id, data); }
    try{ const cf = (await window.__pmdb.get('ink:conf')) || {}; cf[p] = sig; await window.__pmdb.set('ink:conf', cf); }catch(e){}
    touchLib(); return true; }); }
/* put handwriting back into the library in memory, where the reader and the maps look for it */
function nsApply(kind, id, data){ if(kind === 'page'){ const p = (lib.jpages || {})[id]; if(p) p.ink = data; return; } if(kind === 'paper'){ const e = lib.entries[id]; if(e) e.ink = data; } else if(kind === 'book'){ const b = (lib.readings || []).find(x => x.id === id); if(b) b.ink = data; } else { const m = (lib.minds || []).find(x => x.id === id); if(m) m.ink = data; } }
async function nsHydrate(){ if(PREVIEW) return; const todo = nsItems(lib).filter(([k, id, x]) => !x.ink && x.inkRef); for(const [kind, id, x] of todo){ const p = nsPath(kind, id); if(NS.loading[p]) continue; NS.loading[p] = true;
    try{ let got = NS.mem[p];
      if(got == null){ const v = window.__pmdb && await window.__pmdb.get('ink:' + p); if(v && v.data && (!x.inkRef.sig || v.sig === x.inkRef.sig)) got = v.data; }
      if(got == null){ const r = await nsRemoteGet(p, x.inkRef.repo); if(r && r.data){ got = r.data; try{ window.__pmdb.set('ink:' + p, {data: got, sig: nsSig(got, kind), at: Date.now()}); }catch(e){} } }
      if(got != null){ NS.mem[p] = got; NS.cur[p] = nsSig(got, kind); NS.conf[p] = NS.conf[p] || x.inkRef.sig || NS.cur[p]; nsApply(kind, id, got); nsShown(kind, id); } }
    catch(e){} finally{ NS.loading[p] = false; } } }
function nsShown(kind, id){ try{ if(kind === 'page'){ if(typeof NBK !== 'undefined' && NBK.id) nbkDraw(); return; } if(kind === 'mind' && typeof MM !== 'undefined' && MM.id === id) mmRender(); else { const w = DK.frame && DK.frame.contentWindow; if(w && w.__pmInkReady) w.__pmInkReady(kind, id); } }catch(e){} }
/* the reader asks for a paper's handwriting; a book's comes with the book */
function nsReady(kind, id){ const p = nsPath(kind, id); return NS.mem[p] != null; }
/* start: what GitHub has confirmed before, and the handwriting kept on this device */
(async () => { if(PREVIEW) return; try{ const cf = window.__pmdb && await window.__pmdb.get('ink:conf'); if(cf) Object.assign(NS.conf, cf); }catch(e){} setTimeout(() => { nsHydrate(); nsTidy().catch(() => {}); }, 1500); })();
addEventListener('pagehide', () => { Object.keys(NS.timers).forEach(p => clearTimeout(NS.timers[p])); });
/* once a week at most: a notes repository whose history has grown well past what it holds starts afresh with what it holds */
async function nsTidy(){ const c = ghCfg(), repo = await nsRepo(); if(!repo) return; const last = +(localStorage.getItem('pm:nsTidy') || 0); if(Date.now() - last < 7 * 864e5) return; localStorage.setItem('pm:nsTidy', String(Date.now()));
  const info = await ghRepoInfo(c, repo); if(!info) return; const held = Object.values(NS.mem).reduce((n, d) => n + JSON.stringify(d).length / 4, 0); if((info.size || 0) * 1024 < 1.5 * held + 20 * 1048576) return;
  const base = 'https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(repo), br = info.default_branch || 'main';
  const ref = await (await fetch(base + '/git/ref/heads/' + encodeURIComponent(br), {headers: ghHeaders(c)})).json(), head = await (await fetch(base + '/git/commits/' + ref.object.sha, {headers: ghHeaders(c)})).json();
  const nc = await fetch(base + '/git/commits', {method: 'POST', headers: ghHeaders(c, {'Content-Type': 'application/json'}), body: JSON.stringify({message: 'Handwriting as it is now (history cleared by Paper Map)', tree: head.tree.sha, parents: []})}); if(!nc.ok) return; const j = await nc.json();
  const now = await (await fetch(base + '/git/ref/heads/' + encodeURIComponent(br) + '?_=' + Date.now(), {headers: ghHeaders(c)})).json(); if(!now || !now.object || now.object.sha !== ref.object.sha) return;
  await fetch(base + '/git/refs/heads/' + encodeURIComponent(br), {method: 'PATCH', headers: ghHeaders(c, {'Content-Type': 'application/json'}), body: JSON.stringify({sha: j.sha, force: true})}); }
Object.assign(window, {nsPut, nsUpload, nsHydrate, libSlim, nsPack, nsUnpack, nsCanon, nsSig, nsUnion, NS});
/* tests reach the save path through this, and only under ?pmtest */
if(/[?&]pmtest/.test(location.search)) window.__sec = {ghCfg, ghSaveNow, snapshot, ghIsPrivate, pdfTarget, ghPutPath, ghSectionHTML, wireGhSection, gh: () => gh};
