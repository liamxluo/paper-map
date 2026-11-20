/* ===================== folder sync, and helpers it shares ===================== */
let fsDir = null, fsPending = null;
function b64ToBytes(b64){ const s = atob(b64); const u = new Uint8Array(s.length); for(let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
const utf8 = s => new TextEncoder().encode(s);
async function hexDigest(alg, bytes){ const h = await crypto.subtle.digest(alg, bytes); return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''); }
async function remoteHash(c, text){
  // if(c.kind === 'dropbox') return dbxContentHash(utf8(text));
  if(c.kind === 'folder') return hexDigest('SHA-1', utf8(text));
  return gitBlobSha(text);
}
const fakeRes = (status, body) => ({ok: status >= 200 && status < 300, status, json: async () => body || {}});
/* ---------- Dropbox sign-in: SWITCHED OFF ----------
   Connecting a Dropbox account needed a registered app key, a sign-in redirect and a long-lived sign-in kept in the
   browser, and it was never tested against the real Dropbox. It is kept below only as // comments, so none of it can
   run. To use Dropbox, choose a folder inside Dropbox under Settings → Sync instead. */
// /* Dropbox needs Paper Map itself to be registered once (free) to get an app key; each person then connects
//    their own (free) Dropbox account. Put the key here, or paste it under Settings → Sync → Dropbox → Advanced. */
// const DROPBOX_APP_KEY = '';
// function dbxKey(){ try{ return localStorage.getItem('rl:dbxKey') || DROPBOX_APP_KEY; }catch(e){ return DROPBOX_APP_KEY; } }
// function dbxRedirect(){ return location.origin + location.pathname; }
// async function dbxContentHash(bytes){
//   const B = 4 * 1024 * 1024, parts = [];
//   for(let i = 0; i < bytes.length; i += B) parts.push(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.subarray(i, i + B))));
//   const all = new Uint8Array(parts.length * 32); parts.forEach((p, i) => all.set(p, i * 32));
//   return hexDigest('SHA-256', all);
// }
// /* ---------- Dropbox ---------- */
// const DBX_API = 'https://api.dropboxapi.com/2/', DBX_CONTENT = 'https://content.dropboxapi.com/2/';
// const dbxArg = o => JSON.stringify(o).replace(/[\u007f-\uffff]/g, ch => '\\u' + ('000' + ch.charCodeAt(0).toString(16)).slice(-4));
// function randomString(n){ const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, x => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[x % 66]).join(''); }
// function b64url(bytes){ let s = ''; new Uint8Array(bytes).forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
// async function dbxConnect(){
//   const key = dbxKey(); if(!key){ toast('Dropbox isn’t set up for this copy of Paper Map yet'); return; }
//   const verifier = randomString(64), state = randomString(24);
//   const challenge = b64url(await crypto.subtle.digest('SHA-256', utf8(verifier)));
//   try{ localStorage.setItem('rl:dbxAuth', JSON.stringify({verifier, state, at: Date.now()})); }catch(e){}
//   location.href = 'https://www.dropbox.com/oauth2/authorize?' + new URLSearchParams({client_id: key, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', token_access_type: 'offline', redirect_uri: dbxRedirect(), state});
// }
// /* back from Dropbox with ?code=…: finish connecting, then tidy the address */
// async function dbxFinish(){
//   const q = new URLSearchParams(location.search);
//   if(!q.has('state') || !(q.has('code') || q.has('error'))) return false;
//   let a = null; try{ a = JSON.parse(localStorage.getItem('rl:dbxAuth') || 'null'); localStorage.removeItem('rl:dbxAuth'); }catch(e){}
//   history.replaceState(null, '', location.pathname + '?app' + location.hash);
//   if(!a || a.state !== q.get('state')) return false;
//   if(q.has('error')){ setTimeout(() => toast('Dropbox wasn’t connected'), 800); return true; }
//   try{
//     const r = await fetch('https://api.dropboxapi.com/oauth2/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({code: q.get('code'), grant_type: 'authorization_code', client_id: dbxKey(), code_verifier: a.verifier, redirect_uri: dbxRedirect()})});
//     if(!r.ok) throw {status: r.status};
//     const j = await r.json();
//     const old = lsGet(GH_KEY) || {};
//     const keepSha = old.kind === 'dropbox' ? old.sha : null;
//     ghStore({kind: 'dropbox', refresh: j.refresh_token, access: j.access_token, accessExp: Date.now() + ((j.expires_in || 14400) - 60) * 1000, account: j.account_id || '', sha: keepSha || null, dirty: false, lastSyncedAt: 0});
//     try{
//       const me = await fetch(DBX_API + 'users/get_current_account', {method: 'POST', headers: {'Authorization': 'Bearer ' + j.access_token}});
//       if(me.ok){ const mj = await me.json(); const c2 = lsGet(GH_KEY); c2.who = (mj.email || (mj.name && mj.name.display_name) || ''); ghStore(c2); }
//     }catch(e){}
//     setTimeout(() => toast('Dropbox connected'), 800);
//   }catch(e){ setTimeout(() => toast('Dropbox couldn’t be connected (error ' + (e && e.status || '?') + ')'), 800); }
//   return true;
// }
// async function dbxToken(force){
//   const cur = lsGet(GH_KEY) || {};
//   if(!force && cur.access && cur.accessExp > Date.now() + 30000) return cur.access;
//   const r = await fetch('https://api.dropboxapi.com/oauth2/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({grant_type: 'refresh_token', refresh_token: cur.refresh || '', client_id: dbxKey()})});
//   if(!r.ok) throw {status: 401};
//   const j = await r.json();
//   const c2 = lsGet(GH_KEY) || {}; c2.access = j.access_token; c2.accessExp = Date.now() + ((j.expires_in || 14400) - 60) * 1000; ghStore(c2);
//   return c2.access;
// }
// async function dbxFetch(url, opts){
//   const go = tok => fetch(url, Object.assign({method: 'POST'}, opts, {headers: Object.assign({'Authorization': 'Bearer ' + tok}, (opts && opts.headers) || {})}));
//   let r = await go(await dbxToken(false));
//   if(r.status === 401) r = await go(await dbxToken(true));
//   return r;
// }
// async function dbxSummary(r){ try{ const j = await r.clone().json(); return j.error_summary || ''; }catch(e){ try{ return await r.text(); }catch(e2){ return ''; } } }
// const dbxRpc = (ep, args) => dbxFetch(DBX_API + ep, {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(args)});
// async function dbxDownload(path){
//   const r = await dbxFetch(DBX_CONTENT + 'files/download', {headers: {'Dropbox-API-Arg': dbxArg({path})}});
//   if(r.status === 409){ if(/not_found/.test(await dbxSummary(r))) return null; throw {status: 409}; }
//   if(!r.ok) throw {status: r.status};
//   let meta = null; try{ meta = JSON.parse(r.headers.get('Dropbox-API-Result') || 'null'); }catch(e){}
//   const bytes = new Uint8Array(await r.arrayBuffer());
//   if(!meta || !meta.rev){ const m = await dbxRpc('files/get_metadata', {path}); if(m.ok) meta = await m.json(); }
//   return {bytes, rev: meta && meta.rev};
// }
// async function dbxGetFile(c, path){
//   const d = await dbxDownload('/' + path);
//   if(!d) return {missing: true};
//   return {sha: d.rev, data: JSON.parse(new TextDecoder().decode(d.bytes))};
// }

/* ---------- a folder on this computer ---------- */
function idbOpen(){ return new Promise((res, rej) => { const r = indexedDB.open('paper-map', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbDo(mode, fn){ const db = await idbOpen(); return new Promise((res, rej) => { const tx = db.transaction('kv', mode); const q = fn(tx.objectStore('kv')); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); }); }
const idbGet = k => idbDo('readonly', s => s.get(k)), idbSet = (k, v) => idbDo('readwrite', s => s.put(v, k)), idbDel = k => idbDo('readwrite', s => s.delete(k));
async function fsParent(path, create){ const segs = String(path).split('/').filter(Boolean); const name = segs.pop(); let d = fsDir; for(const s of segs) d = await d.getDirectoryHandle(s, {create}); return [d, name]; }
const notFound = e => e && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError');
async function fsRead(path){
  try{ const [d, n] = await fsParent(path, false); const f = await (await d.getFileHandle(n)).getFile(); return new Uint8Array(await f.arrayBuffer()); }
  catch(e){ if(notFound(e)) return null; throw e; }
}
async function fsWrite(path, bytes){ const [d, n] = await fsParent(path, true); const w = await (await d.getFileHandle(n, {create: true})).createWritable(); await w.write(bytes); await w.close(); }
async function fsGetFile(path){
  const b = await fsRead(path); if(!b) return {missing: true};
  return {sha: await hexDigest('SHA-1', b), data: JSON.parse(new TextDecoder().decode(b))};
}
/* keeps the list as it was before the day's first save (and, separately, before you replace a newer copy) */
async function fsBackup(prev, replacing){
  const now = new Date(), day = now.toISOString().slice(0, 10);
  if(replacing) await fsWrite('data/backups/paper-map-' + day + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + '-before-replace.json', prev);
  else if(!(await fsRead('data/backups/paper-map-' + day + '.json'))) await fsWrite('data/backups/paper-map-' + day + '.json', prev);
  try{
    const [d] = await fsParent('data/backups/x', false), names = [];
    for await (const [n, h] of d.entries()) if(h.kind === 'file' && /^paper-map-\d{4}-\d\d-\d\d(-\d{4}-before-replace)?\.json$/.test(n)) names.push(n);
    names.sort().slice(0, Math.max(0, names.length - 40)).forEach(n => d.removeEntry(n).catch(() => {}));
  }catch(e){}
}
/* ---------- the same few operations for both ---------- */
async function remotePut(c, path, bytes, sha, strict){
//   if(c.kind === 'dropbox'){
//     const mode = strict ? (sha ? {'.tag': 'update', update: sha} : 'add') : 'overwrite';
//     const r = await dbxFetch(DBX_CONTENT + 'files/upload', {headers: {'Dropbox-API-Arg': dbxArg({path: '/' + path, mode, autorename: false, mute: true, strict_conflict: !!strict}), 'Content-Type': 'application/octet-stream'}, body: bytes});
//     if(r.status === 409) return fakeRes(409);
//     if(!r.ok) return fakeRes(r.status);
//     const j = await r.json();
//     return fakeRes(200, {content: {sha: j.rev}});
//   }
  if(strict){
    const cur = await fsRead(path);
    if(cur && (!sha || await hexDigest('SHA-1', cur) !== sha)) return fakeRes(409);
    if(cur) await fsBackup(cur, gh.replacing).catch(() => {});
  }
  await fsWrite(path, bytes);
  return fakeRes(200, {content: {sha: await hexDigest('SHA-1', bytes)}});
}
async function remoteDelete(c, path){
//   if(c.kind === 'dropbox'){ const r = await dbxRpc('files/delete_v2', {path: '/' + path}); return fakeRes(r.status === 409 ? 404 : r.status); }
  try{ const [d, n] = await fsParent(path, false); await d.removeEntry(n); return fakeRes(200); }catch(e){ return fakeRes(notFound(e) ? 404 : 500); }
}
async function remoteList(c, dir){
//   if(c.kind === 'dropbox'){
//     let r = await dbxRpc('files/list_folder', {path: '/' + dir});
//     if(r.status === 409) return [];
//     if(!r.ok) throw {status: r.status};
//     let j = await r.json(), out = [];
//     const add = j2 => j2.entries.forEach(x => out.push({type: x['.tag'] === 'file' ? 'file' : 'dir', name: x.name, path: String(x.path_display || x.path_lower).replace(/^\//, ''), sha: x.content_hash}));
//     add(j);
//     while(j.has_more){ r = await dbxRpc('files/list_folder/continue', {cursor: j.cursor}); if(!r.ok) break; j = await r.json(); add(j); }
//     return out;
//   }
  let d; try{ [d] = await fsParent(dir + '/x', false); }catch(e){ if(notFound(e)) return []; throw e; }
  const out = [];
  for await (const [n, h] of d.entries()){
    if(h.kind !== 'file') continue;
    const b = new Uint8Array(await (await h.getFile()).arrayBuffer());
    out.push({type: 'file', name: n, path: dir + '/' + n, sha: await hexDigest('SHA-1', b)});
  }
  return out;
}
async function remoteMeta(c, path){
//   if(c.kind === 'dropbox'){ const r = await dbxRpc('files/get_metadata', {path: '/' + path}); if(r.status === 409) return null; if(!r.ok) throw {status: r.status}; return (await r.json()).rev || null; }
  const b = await fsRead(path); return b ? hexDigest('SHA-1', b) : null;
}
async function remoteBytes(c, path){
//   if(c.kind === 'dropbox'){ const d = await dbxDownload('/' + path); return d && d.bytes; }
  return fsRead(path);
}
async function remoteHistory(c){
//   if(c.kind === 'dropbox'){
//     const r = await dbxRpc('files/list_revisions', {path: '/' + c.path, mode: 'path', limit: 40});
//     if(r.status === 409) return [];
//     if(!r.ok) throw {status: r.status};
//     return ((await r.json()).entries || []).map(x => ({sha: x.rev, commit: {author: {date: x.server_modified}}}));
//   }
  const out = [];
  try{
    const [d] = await fsParent('data/backups/x', false);
    for await (const [n, h] of d.entries()){ const m = /^paper-map-(\d{4}-\d\d-\d\d)(?:-(\d\d)(\d\d)-before-replace)?\.json$/.exec(n); if(h.kind === 'file' && m) out.push({sha: n, commit: {author: {date: m[1] + 'T' + (m[2] ? m[2] + ':' + m[3] : '00:00') + ':00'}}}); }
  }catch(e){}
  return out.sort((a, b) => b.sha.localeCompare(a.sha));
}
async function remoteVersion(c, id){
//   if(c.kind === 'dropbox'){ const d = await dbxDownload('rev:' + id); if(!d) throw {status: 404}; return JSON.parse(new TextDecoder().decode(d.bytes)); }
  const b = await fsRead('data/backups/' + id); if(!b) throw {status: 404}; return JSON.parse(new TextDecoder().decode(b));
}
/* ---------- connecting a folder ---------- */
const FS_OK = typeof window.showDirectoryPicker === 'function' || !!(window.__TAURI__ && window.__TAURI__.core);
/* Dropbox, iCloud Drive and OneDrive save a second copy when two computers change the file at once,
   e.g. “paper-map (Liam's conflicted copy 2026-11-18).json”, “paper-map 2.json” or “paper-map-LAPTOP.json”. */
const fsCopyAsked = new Set();
async function fsFindCopies(){
  if(syncKind() !== 'folder' || !fsDir) return [];
  let d; try{ [d] = await fsParent('data/x', false); }catch(e){ return []; }
  const out = [];
  for await (const [n, h] of d.entries()) if(h.kind === 'file' && n !== 'paper-map.json' && /^paper-map.*\.json$/i.test(n)) out.push(n);
  return out.sort();
}
function fsCheckCopiesSoon(){ clearTimeout(fsCheckCopiesSoon.t); fsCheckCopiesSoon.t = setTimeout(() => fsCheckCopies().catch(() => {}), 1500); }
async function fsCheckCopies(){
  if(!modal.root.hidden) return fsCheckCopiesSoon();
  const n = (await fsFindCopies()).find(x => !fsCopyAsked.has(x)); if(!n) return;
  fsCopyAsked.add(n);
  let data; try{ data = JSON.parse(new TextDecoder().decode(await fsRead('data/' + n))); }catch(e){ return; }
  if(!data || !validLib(data.lib)) return;
  openModal({title: 'Another copy of your list',
    body: '<p>Your sync app made a second copy, <code>' + esc(n) + '</code>, usually because the list was changed on two computers at the same time.</p>' +
      '<div class="ver-cmp"><div><b>That copy</b><span>' + esc(syncCountText(libCounts(data.lib))) + (data.savedAt ? ' · saved ' + esc(stampText(data.savedAt)) : '') + '</span></div><div><b>Your list</b><span>' + esc(syncCountText(libCounts(lib))) + '</span></div></div>' +
      '<p class="hint">Combining keeps everything that is only in one of them, and asks you about anything that differs. The copy then moves to <code>data/backups</code>.</p>',
    actions: [{label: 'Not now'}, {label: 'Combine', primary: true, onClick: () => { setTimeout(() => fsCombineCopy(n, data), 0); }}]});
}
async function fsCombineCopy(name, data){
  const c = ghCfg(); if(!c) return;
  const here = {lib, status};
  /* A copy branched off at some unknown earlier point, so there is no safe common starting point:
     anything only on one side is kept, and anything that differs between the two is shown to you. Nothing is overwritten silently. */
  const base = {lib: Object.assign(clone(lib), {entries: {}, links: [], tlinks: [], lineBranch: {}, tlinkColor: {}, topics: [], tags: [], branches: []}), status: {}};
  let res; try{ res = mergeLibs(base, here, {lib: data.lib, status: (data.status && data.status.map) || {}}); }catch(e){ toast('That copy couldn’t be combined'); return; }
  const apply = async () => {
    const before = snapshot();
    if(!adoptSnapshot({lib: res.build(), status: {map: res.status, updatedAt: Date.now()}})) return;
    const c2 = ghCfg(); if(c2){ c2.dirty = true; ghStore(c2); } gh.rev++; ghSave();
    try{ const b = await fsRead('data/' + name); if(b){ await fsWrite('data/backups/' + name.replace(/\.json$/i, '') + ' · combined ' + new Date().toISOString().slice(0, 10) + '.json', b); const [d] = await fsParent('data/' + name, false); await d.removeEntry(name); } }catch(e){}
    toast('Combined the copy: ' + res.fromThere + ' changes from it, ' + res.fromHere + ' kept from your list', () => { adoptSnapshot(before); ghMark(); toast('Undone'); });
    fsCheckCopiesSoon();
  };
  if(!res.conflicts.length) return apply();
  pickConflicts(res, 'Your list and the copy differ in a few places, and there is no way to tell which is newer.', apply);
}
async function fsConnect(){
  if(TAURI){ macChooseStorage(); return; }
  if(!FS_OK){ toast('Choosing a folder works in Chrome and Edge on a computer'); return; }
  let dir;
  try{ dir = await window.showDirectoryPicker({id: 'paper-map', mode: 'readwrite'}); }catch(e){ return; }
  if(dir.requestPermission && (await dir.requestPermission({mode: 'readwrite'})) !== 'granted'){ toast('Paper Map needs permission to save in that folder'); return; }
  await idbSet('dir', dir).catch(() => {});
  fsDir = dir; fsPending = null;
  const old = lsGet(GH_KEY) || {};
  ghStore({kind: 'folder', name: dir.name, sha: old.kind === 'folder' ? old.sha || null : null, dirty: false, lastSyncedAt: 0});
  toast('Saving to the folder “' + dir.name + '”');
  updateSaveState(); ghLoad();
}
async function fsReconnect(){
  const h = fsPending || await idbGet('dir').catch(() => null);
  if(!h){ fsConnect(); return; }
  try{ if(h.requestPermission && (await h.requestPermission({mode: 'readwrite'})) !== 'granted') return; }catch(e){ return; }
  fsDir = h; fsPending = null; updateSaveState(); ghLoad();
}
/* on start: get the folder back; browsers ask again after a restart, which needs a click */
async function fsRestore(){
  if(syncKind() !== 'folder' || PREVIEW) return;
  if(TAURI){ const c = lsGet(GH_KEY) || {}; if(c.native){ fsDir = nativeDir(c.native, c.name); fsPending = null; } return; }
  const h = await idbGet('dir').catch(() => null); if(!h) return;
  let p = 'granted'; try{ if(h.queryPermission) p = await h.queryPermission({mode: 'readwrite'}); }catch(e){ p = 'prompt'; }
  if(p === 'granted'){ fsDir = h; return; }
  fsPending = h; updateSaveState();
  setTimeout(() => {
    const el = document.getElementById('toast'); if(!el) return;
    el.innerHTML = '<span>To keep saving to “' + esc((lsGet(GH_KEY) || {}).name || 'your folder') + '”, allow Paper Map to use it again.</span><button type="button" data-fs-reconnect="1">Allow</button>';
    el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 20000);
  }, 1500);
}
function syncForget(){
  const k = syncKind();
//   if(k === 'dropbox'){ const c = lsGet(GH_KEY) || {}; if(c.access) fetch(DBX_API + 'auth/token/revoke', {method: 'POST', headers: {'Authorization': 'Bearer ' + c.access}}).catch(() => {}); }
  if(k === 'folder'){ idbDel('dir').catch(() => {}); fsDir = null; fsPending = null; }
  ghForget();
}

