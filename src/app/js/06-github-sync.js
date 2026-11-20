/* ===================== GitHub sync ===================== */
/* Data is saved as one JSON file in the user’s own private repository, committed a few seconds after each change.
   The token stays in this browser’s localStorage; it never goes into backups or repositories. */
const GH_KEY = 'rl:github';
const GH_DELAY = 4000;
const gh = {st:'off', msg:'', when:'', busy:false, again:false, rev:0, timer:null};
function ghCfg(){
  if(PREVIEW) return null;
  const c = lsGet(GH_KEY); if(!c) return null;
  if(c.token === '__keychain__') c.token = KC_TOKEN || '';
  const kind = c.kind || 'github';
  if(kind === 'dropbox') return null;   /* Dropbox sign-in is switched off */
  if(kind === 'folder') return fsDir ? Object.assign({path: 'data/paper-map.json'}, c, {kind}) : null;
  return c.owner && c.repo && c.token ? Object.assign({branch: 'main', path: 'data/paper-map.json'}, c, {kind: 'github'}) : null;
}
function syncKind(){ const c = lsGet(GH_KEY); return c ? (c.kind || 'github') : null; }
function syncName(){ const k = syncKind(); return k === 'dropbox' ? 'Dropbox' : k === 'folder' ? 'your folder' : 'GitHub'; }
function syncWhere(){ const k = syncKind(); return k === 'dropbox' ? 'In Dropbox' : k === 'folder' ? 'In your folder' : 'On GitHub'; }
function syncIn(){ const k = syncKind(); return k === 'dropbox' ? 'in Dropbox' : k === 'folder' ? 'in your folder' : 'on GitHub'; }
function syncShort(){ const k = syncKind(); return k === 'dropbox' ? 'Dropbox' : k === 'folder' ? 'folder’s' : 'GitHub'; }
let KC_TOKEN = '';
function ghStore(c){
  if(window.__TAURI__ && c && c.token && c.token !== '__keychain__'){ const tok = c.token; KC_TOKEN = tok; lsSet(GH_KEY, Object.assign({}, c, {token: '__keychain__'}));
    window.__TAURI__.core.invoke('secret_set', {key: 'github-token', value: tok}).catch(() => { lsSet(GH_KEY, Object.assign({}, c, {token: tok})); }); return; }
  lsSet(GH_KEY, c); }
function ghApi(c){ return 'https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + '/contents/' + String(c.path).split('/').filter(Boolean).map(encodeURIComponent).join('/'); }
function ghHeaders(c, extra){ return Object.assign({'Accept':'application/vnd.github+json', 'Authorization':'Bearer ' + c.token}, extra || {}); }
function b64encode(str){ const bytes = new TextEncoder().encode(str); let bin = ''; for(let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
function b64decode(b64){ const bin = atob(String(b64).replace(/\s/g, '')); const bytes = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
function portableSettings(){ const s = clone(settings); delete s.toc; return s; }
function snapshot(){ return {app: APP, v:1, savedAt: Date.now(), lib, status:{map:status, updatedAt:statusTime}, settings: portableSettings()}; }
function hhmm(ts){ const d = new Date(ts || Date.now()); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function stampText(ts){ const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + hhmm(ts); }
function saveStateText(){
  if(PREVIEW) return 'Preview: changes aren’t saved';
  if(ghCfg()){
    if(gh.st === 'saved') return 'Saved to ' + syncName() + (gh.when ? ' · ' + gh.when : '');
    if(gh.st === 'pending') return 'Unsaved changes, saving shortly';
    if(gh.st === 'saving') return 'Saving to ' + syncName();
    if(gh.st === 'loading') return 'Loading from ' + syncName();
    if(gh.st === 'error') return gh.msg;
    return 'Connected to ' + syncName();
  }
  if(syncKind() === 'folder') return 'Folder needs permission again: Settings → Sync';
  return 'Saved in this browser only';
}
function updateSaveState(){ const txt = saveStateText(); document.querySelectorAll('[data-save-state]').forEach(el => { el.textContent = txt; }); }
function setGh(st, msg){ gh.st = st; gh.msg = msg || ''; updateSaveState(); }
function ghErr(e){
  const s = e && e.status, k = syncKind();
//   if(k === 'dropbox'){
//     if(s === 401) return 'Dropbox needs you to connect again (Settings → Sync → Dropbox).';
//     if(s === 409) return 'The file in Dropbox was just changed elsewhere, so this save didn’t go through.';
//     if(s === 429) return 'Dropbox asked Paper Map to slow down. It will try again shortly.';
//     if(s === 507) return 'Your Dropbox is full, so the list couldn’t be saved there.';
//     if(e instanceof SyntaxError) return 'The data file in Dropbox isn’t valid JSON, so it wasn’t loaded.';
//     if(e instanceof TypeError) return 'Can’t reach Dropbox. Check your connection and try again.';
//     return 'Saving to Dropbox failed' + (s ? ' (error ' + s + ')' : '') + '.';
//   }
  if(k === 'folder'){
    if(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) return 'Paper Map lost permission to your folder. Reconnect it in Settings → Sync.';
    if(s === 409) return 'The file in your folder was just changed elsewhere, so this save didn’t go through.';
    if(e instanceof SyntaxError) return 'The data file in your folder isn’t valid JSON, so it wasn’t loaded.';
    return 'Saving to your folder failed' + (e && e.message ? ': ' + e.message : '') + '.';
  }
  if(s === 401) return 'The GitHub token is invalid or has expired. Renew it (Settings → Sync → GitHub → How to renew) and paste the new one.';
  if(s === 403) return 'This token can’t write to the repository (it needs Contents: Read and write), or there were too many requests.';
  if(s === 404) return 'Repository or branch not found. Check the username, the repository name, and that the token includes this repository.';
  if(s === 409 || s === 422) return 'The file on GitHub was just changed elsewhere, so this save didn’t go through.';
  if(e instanceof SyntaxError) return 'The data file on GitHub isn’t valid JSON, so it wasn’t loaded.';
  if(e instanceof TypeError) return 'Can’t reach GitHub. Check your connection and try again.';
  if(s === 'empty') return 'Your data repository is completely empty. Add any file to it on GitHub (a README is fine), then click Connect again.';
  return 'Saving to GitHub failed' + (s ? ' (error ' + s + ')' : '') + '.';
}
async function ghGetFile(c){
//   if(c.kind === 'dropbox') return dbxGetFile(c, c.path);
  if(c.kind === 'folder') return fsGetFile(c.path);
  const url = ghApi(c) + '?ref=' + encodeURIComponent(c.branch) + '&_=' + Date.now();
  const res = await fetch(url, {headers: ghHeaders(c)});
  if(res.status === 404){
    const probe = await fetch('https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + '?_=' + Date.now(), {headers: ghHeaders(c)});
    if(!probe.ok) throw {status: probe.status};
    return {missing:true};
  }
  if(!res.ok) throw {status: res.status};
  const j = await res.json();
  let text;
  if(j.content && j.encoding === 'base64') text = b64decode(j.content);
  else{
    const r2 = await fetch(url + '1', {headers: ghHeaders(c, {'Accept':'application/vnd.github.raw+json'})});
    if(!r2.ok) throw {status: r2.status};
    text = await r2.text();
  }
  return {sha: j.sha, data: JSON.parse(text)};
}
function ghPut(c, content, message, sha){
  if(c.kind === 'dropbox' || c.kind === 'folder') return remotePut(c, c.path, b64ToBytes(content), sha, true);
  const body = {message, content, branch: c.branch};
  if(sha) body.sha = sha;
  return fetch(ghApi(c), {method:'PUT', headers: ghHeaders(c, {'Content-Type':'application/json'}), body: JSON.stringify(body)});
}
function ghMark(){
  const c = ghCfg();
  /* a folder waiting for permission again: remember there are changes, so they are saved (or combined) once it is allowed */
  if(!c){ const raw = lsGet(GH_KEY); if(raw && raw.kind === 'folder' && !raw.dirty){ raw.dirty = true; ghStore(raw); } return; }
  gh.rev++;
  if(!c.dirty){ c.dirty = true; ghStore(c); }
  if(!gh.busy) setGh('pending');
  clearTimeout(gh.timer);
  gh.timer = setTimeout(ghSave, GH_DELAY);
}
function adoptSnapshot(obj){
  const L = obj && obj.lib;
  if(!validLib(L)) return false;
  if(obj.status && obj.status.map && typeof obj.status.map === 'object'){ status = obj.status.map; statusTime = obj.status.updatedAt || Date.now(); lsSet(LS.status, {map:status, updatedAt:statusTime}); }
  lib = normalizeLib(L); lsSet(LS.lib, lib);
  if(!undoing) clearUndo();
  if(obj.settings && typeof obj.settings === 'object'){ const keep = {toc: settings.toc, range: settings.range, theme: settings.theme}; settings = normalizeSettings(Object.assign(defaultSettings(), obj.settings)); Object.assign(settings, keep); lsSet(LS.settings, settings); }
  reindex(); applyColors();
  if(location.hash.length > 1){ const hv = resolveView(location.hash.slice(1)); ui.topic = hv.topic; ui.sub = hv.sub; }
  fixView(); renderAll();
  return true;
}

/* ---------- combining two devices' changes ----------
   After every successful load or save, the list as it was then is kept as the “base”.
   When both sides changed since, each paper, line, topic, tag and colour line is compared on its own:
   changed on one side only → that change is taken; changed on both sides → you choose, item by item. */
function syncId(c){ return c ? (c.kind || 'github') + ':' + (c.kind === 'github' || !c.kind ? c.owner + '/' + c.repo + '@' + c.branch : c.name || '') + ':' + c.path : ''; }
/* a small key-value store in IndexedDB: no 5 MB limit, kept by the browser like localStorage */
const PMDB = (() => { let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => { try{ const r = indexedDB.open('paper-map', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }catch(e){ rej(e); } }));
  return {get: k => open().then(db => new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); })).catch(() => undefined),
          set: (k, v) => open().then(db => new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); tx.onabort = () => res(false); })).catch(() => false)}; })();
window.__pmdb = PMDB;
let BASE_MEM = null;
const BASE_READY = (typeof indexedDB !== 'undefined' && !PREVIEW ? PMDB.get('rl:base') : Promise.resolve(undefined)).then(v => { if(v && !BASE_MEM) BASE_MEM = v; });
function saveBase(c, data){ const b = {id: syncId(c), lib: clone(data.lib), status: (data.status && data.status.map) || data.status || {}}; BASE_MEM = b;
  PMDB.set('rl:base', b).then(ok => { if(ok){ try{ localStorage.removeItem('rl:base'); }catch(e){} } else { try{ localStorage.setItem('rl:base', JSON.stringify(b)); }catch(e){ try{ localStorage.removeItem('rl:base'); }catch(e2){} } } }); }
function loadBase(c){ try{ const b = BASE_MEM || JSON.parse(localStorage.getItem('rl:base') || 'null'); return b && b.id === syncId(c) && validLib(b.lib) ? b : null; }catch(e){ return null; } }
const stableJSON = v => JSON.stringify(v === undefined ? null : v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
function byKey(arr, key){ const m = {}; (arr || []).forEach(x => { m[key(x)] = x; }); return m; }
/* when both devices changed the same thing, look inside it: fields changed on one side only are taken from that side;
   notes that both sides only added to keep both additions; a notebook's pages are merged page by page.
   Only when the very same field was changed differently on both does Paper Map ask. */
const FIELD_KINDS = new Set(['entry', 'topic', 'tag', 'branch', 'reading', 'notebook', 'mind']);
const isPlain = v => v && typeof v === 'object' && !Array.isArray(v);
function mergeText(b, l, r){
  b = b || ''; if(l === r) return l; if(l === b) return r; if(r === b) return l;
  if(l.startsWith(b) && r.startsWith(b)){ const al = l.slice(b.length), ar = r.slice(b.length); return b + al + (al && !al.endsWith('\n') && ar ? '\n' : '') + ar; }
  return null;
}
const TIME_KEYS = new Set(['edited', 'updatedAt', 'changed', 't0']);
function mergeFields(b, l, r, depth){
  if(!isPlain(l) || !isPlain(r)) return null;
  const bb = isPlain(b) ? b : {}, out = {};
  for(const k of new Set([...Object.keys(bb), ...Object.keys(l), ...Object.keys(r)])){
    const sb = stableJSON(bb[k]), sl = stableJSON(l[k]), sr = stableJSON(r[k]);
    let v;
    if(sl === sr) v = l[k];
    else if(sl === sb) v = r[k];
    else if(sr === sb) v = l[k];
    else if(TIME_KEYS.has(k)) v = String(l[k] || '') > String(r[k] || '') ? l[k] : r[k];
    else if(typeof l[k] === 'string' && typeof r[k] === 'string' && (typeof bb[k] === 'string' || bb[k] === undefined) && /^(n|notes|text|why|what|desc)$/.test(k)){ v = mergeText(bb[k], l[k], r[k]); if(v === null) return null; }
    else if(k === 'pages' && Array.isArray(l[k]) && Array.isArray(r[k]) && (depth || 0) < 2){
      const bp = Array.isArray(bb[k]) ? bb[k] : [], n = Math.max(l[k].length, r[k].length), pages = [];
      for(let i = 0; i < n; i++){ const pl = l[k][i], pr = r[k][i], pb = bp[i];
        if(pl === undefined){ pages.push(pr); continue; } if(pr === undefined){ pages.push(pl); continue; }
        const m = stableJSON(pl) === stableJSON(pr) ? pl : mergeFields(pb, pl, pr, (depth || 0) + 1); if(m === null) return null; pages.push(m); }
      v = pages;
    }
    else if(Array.isArray(l[k]) && Array.isArray(r[k]) && l[k].concat(r[k]).every(x => isPlain(x) && x.id) && (depth || 0) < 2){
      /* lists of things with ids (a mind map's nodes and lines): combined one by one */
      const ix = a => { const o = {}; (a || []).forEach(x => { if(isPlain(x) && x.id) o[x.id] = x; }); return o; }, Bm = ix(Array.isArray(bb[k]) ? bb[k] : []), Lm = ix(l[k]), Rm = ix(r[k]), outA = [];
      for(const id of new Set([...Object.keys(Lm), ...Object.keys(Rm), ...Object.keys(Bm)])){ const sb2 = stableJSON(Bm[id]), sl2 = stableJSON(Lm[id]), sr2 = stableJSON(Rm[id]); let w;
        if(sl2 === sr2) w = Lm[id]; else if(sl2 === sb2) w = Rm[id]; else if(sr2 === sb2) w = Lm[id]; else { w = mergeFields(Bm[id], Lm[id], Rm[id], (depth || 0) + 1); if(w === null) return null; }
        if(w) outA.push(w); }
      v = outA;
    }
    else if(isPlain(l[k]) && isPlain(r[k]) && (depth || 0) < 2){ v = mergeFields(bb[k], l[k], r[k], (depth || 0) + 1); if(v === null) return null; }
    else return null;
    if(v !== undefined) out[k] = v;
  }
  return out;
}
function mergeMaps(B, L, R, kind, label, out){
  const res = {};
  new Set([...Object.keys(B), ...Object.keys(L), ...Object.keys(R)]).forEach(id => {
    const b = stableJSON(B[id]), l = stableJSON(L[id]), r = stableJSON(R[id]);
    let v;
    if(l === r) v = L[id];
    else if(l === b){ v = R[id]; out.fromThere++; }
    else if(r === b){ v = L[id]; out.fromHere++; }
    else { const m = FIELD_KINDS.has(kind) ? mergeFields(B[id], L[id], R[id], 0) : null;
      if(m){ v = m; out.merged = (out.merged || 0) + 1; }
      else { out.conflicts.push({kind, id, here: L[id], there: R[id], label: label(L[id] || R[id] || B[id], id)}); v = L[id]; } }
    if(v !== undefined) res[id] = v;
  });
  return res;
}
function orderLike(map, localArr, remoteArr, key){
  const out = [], seen = new Set();
  (localArr || []).concat(remoteArr || []).forEach(x => { const k = key(x); if(map[k] !== undefined && !seen.has(k)){ seen.add(k); out.push(map[k]); } });
  Object.keys(map).forEach(k => { if(!seen.has(k)) out.push(map[k]); });
  return out;
}
function mergeLibs(base, here, there){
  const N = L => normalizeLib(clone(L));
  const B = N(base.lib), Lh = N(here.lib), Rt = N(there.lib);
  const out = {conflicts: [], fromHere: 0, fromThere: 0};
  const lk = l => l[0] + '|' + l[1] + '|' + l[2], tk = l => l[0] + '|' + l[1], idk = x => x.id;
  const entryLabel = e => e ? (e.kind === 'concept' ? 'Concept: ' : '') + (e.t || e.id) + (e.y ? ' (' + e.y + ')' : '') : '';
  const maps = {
    entries: mergeMaps(B.entries, Lh.entries, Rt.entries, 'entry', entryLabel, out),
    links: mergeMaps(byKey(B.links, lk), byKey(Lh.links, lk), byKey(Rt.links, lk), 'link', (l, k) => { const [a, b] = k.split('|'); const ea = Lh.entries[a] || Rt.entries[a], eb = Lh.entries[b] || Rt.entries[b]; return 'Line: ' + (ea ? ea.t : a) + ' → ' + (eb ? eb.t : b); }, out),
    topics: mergeMaps(byKey(B.topics, idk), byKey(Lh.topics, idk), byKey(Rt.topics, idk), 'topic', tp => 'Topic: ' + (tp ? tp.name : ''), out),
    tags: mergeMaps(byKey(B.tags, idk), byKey(Lh.tags, idk), byKey(Rt.tags, idk), 'tag', x => 'Tag: ' + (x ? x.name : ''), out),
    branches: mergeMaps(byKey(B.branches, idk), byKey(Lh.branches, idk), byKey(Rt.branches, idk), 'branch', x => 'Colour line: ' + (x ? x.name : ''), out),
    lineBranch: mergeMaps(B.lineBranch || {}, Lh.lineBranch || {}, Rt.lineBranch || {}, 'lineBranch', () => 'A line’s colour', out),
    tlinks: mergeMaps(byKey(B.tlinks, tk), byKey(Lh.tlinks, tk), byKey(Rt.tlinks, tk), 'tlink', () => 'Related topics', out),
    tlinkColor: mergeMaps(B.tlinkColor || {}, Lh.tlinkColor || {}, Rt.tlinkColor || {}, 'tlinkColor', () => 'A related-topic colour', out),
    readings: mergeMaps(byKey(B.readings, idk), byKey(Lh.readings, idk), byKey(Rt.readings, idk), 'reading', x => 'Book: ' + (x ? x.title : ''), out),
    minds: mergeMaps(byKey(B.minds || [], idk), byKey(Lh.minds || [], idk), byKey(Rt.minds || [], idk), 'mind', x => 'Mind map: ' + (x ? x.name : ''), out),
    readingCats: mergeMaps(byKey((B.readingCats || []).map(c => ({id: c})), idk), byKey((Lh.readingCats || []).map(c => ({id: c})), idk), byKey((Rt.readingCats || []).map(c => ({id: c})), idk), 'readingCat', x => 'Reading category: ' + (x ? x.id : ''), out),
    notebooks: mergeMaps(byKey(B.notebooks, idk), byKey(Lh.notebooks, idk), byKey(Rt.notebooks, idk), 'notebook', x => 'Research log' + (x && x.pages ? ' (' + x.pages.filter(p => p && p.text).length + ' pages)' : ''), out),
    status: mergeMaps(base.status || {}, here.status || {}, there.status || {}, 'status', (v, k) => 'Read mark', {conflicts: [], fromHere: 0, fromThere: 0})
  };
  const build = () => {
    const L = Object.assign({}, Lh);
    L.entries = maps.entries;
    L.links = orderLike(maps.links, Lh.links, Rt.links, lk);
    L.topics = orderLike(maps.topics, Lh.topics, Rt.topics, idk);
    L.tags = orderLike(maps.tags, Lh.tags, Rt.tags, idk);
    L.branches = orderLike(maps.branches, Lh.branches, Rt.branches, idk);
    L.lineBranch = maps.lineBranch; L.tlinks = orderLike(maps.tlinks, Lh.tlinks, Rt.tlinks, tk); L.tlinkColor = maps.tlinkColor;
    L.readings = orderLike(maps.readings, Lh.readings, Rt.readings, idk); L.readingCats = orderLike(maps.readingCats, (Lh.readingCats || []).map(c => ({id: c})), (Rt.readingCats || []).map(c => ({id: c})), idk).map(x => x.id); L.notebooks = orderLike(maps.notebooks, Lh.notebooks, Rt.notebooks, idk); L.minds = orderLike(maps.minds, Lh.minds || [], Rt.minds || [], idk);
    if(stableJSON(Lh.title) === stableJSON(B.title)) L.title = Rt.title;
    return L;
  };
  const mapOf = {mind: 'minds', entry: 'entries', link: 'links', topic: 'topics', tag: 'tags', branch: 'branches', lineBranch: 'lineBranch', tlink: 'tlinks', tlinkColor: 'tlinkColor', reading: 'readings', readingCat: 'readingCats', notebook: 'notebooks'};
  const choose = (cf, side) => { const m = maps[mapOf[cf.kind]], v = side === 'there' ? cf.there : cf.here; if(v === undefined) delete m[cf.id]; else m[cf.id] = v; };
  { const ents = maps.entries || {}; out.dropped = Object.values(maps.links || {}).filter(l => Array.isArray(l) && (!ents[l[0]] || !ents[l[1]])).length; }
  return {conflicts: out.conflicts, fromHere: out.fromHere, fromThere: out.fromThere, merged: out.merged || 0, dropped: out.dropped || 0, build, choose, status: maps.status};
}
function mergeSummary(cf){
  const d = x => x === undefined ? 'deleted' : 'changed';
  return {here: d(cf.here) + ' on this device', there: d(cf.there) + ' on the other'};
}
async function ghMergeOrAsk(f, title, text){
  const c = ghCfg(); const base = c && loadBase(c);
  if(!base || !f.data || !validLib(f.data.lib)) return ghAskWhich(f, title, text);
  let res;
  try{ res = mergeLibs(base, {lib, status}, {lib: f.data.lib, status: (f.data.status && f.data.status.map) || {}}); }catch(e){ return ghAskWhich(f, title, text); }
  if(!res.conflicts.length) return applyMerge(f, res);
  pickConflicts(res, 'Since the last sync, this device and another one both changed your list.', () => applyMerge(f, res));
}
function pickConflicts(res, intro, then){
  setGh('error', 'Waiting for you to combine the changes');
  const rows = res.conflicts.slice(0, 40).map((cf, i) => { const s = mergeSummary(cf); return '<div class="mg-row"><span class="mg-what">' + esc(cf.label) + '</span><label><input type="radio" name="mg' + i + '" value="here" checked> ' + esc(s.here) + '</label><label><input type="radio" name="mg' + i + '" value="there"> ' + esc(s.there) + '</label></div>'; }).join('');
  openModal({
    title: 'Changed in both places',
    body: '<p>' + esc(intro) + ' ' + (res.fromHere + res.fromThere) + ' changes don’t clash and are combined automatically. For ' + (res.conflicts.length === 1 ? 'this one, which was' : 'these ' + res.conflicts.length + ', which were') + ' changed in both, choose which to keep:</p>' +
      '<div class="mg-quick"><button type="button" class="linkbtn" data-mg-all="here">All from this device</button> · <button type="button" class="linkbtn" data-mg-all="there">All from the other</button></div>' +
      '<div class="mg-list">' + rows + '</div>' + (res.conflicts.length > 40 ? '<p class="hint">The other ' + (res.conflicts.length - 40) + ' keep this device’s version.</p>' : '') +
      '<p class="hint">Whatever you don’t keep stays in Earlier versions.</p>',
    actions: [{label: 'Combine', primary: true, onClick: bd => { res.conflicts.slice(0, 40).forEach((cf, i) => { const r = bd.querySelector('input[name="mg' + i + '"]:checked'); res.choose(cf, r ? r.value : 'here'); }); then(); }}],
    onOpen: bd => bd.addEventListener('click', ev => { const a = ev.target.closest('[data-mg-all]'); if(a) bd.querySelectorAll('.mg-row input[value="' + a.dataset.mgAll + '"]').forEach(x => { x.checked = true; }); })
  });
}
function applyMerge(f, res){
  const before = snapshot();
  const merged = res.build();
  if(!adoptSnapshot({lib: merged, status: {map: res.status, updatedAt: Date.now()}})){ ghAskWhich(f, 'Couldn’t combine the changes', 'Which version do you want to keep?'); return; }
  const c = ghCfg(); if(!c) return;
  c.sha = f.sha; c.dirty = true; ghStore(c); gh.rev++;
  saveBase(c, f.data);
  ghSave();
  toast('Combined the changes: ' + res.fromThere + ' from the other device, ' + res.fromHere + ' from this one' + (res.merged ? ', ' + res.merged + ' combined field by field' : '') + (res.dropped ? '; ' + res.dropped + (res.dropped === 1 ? ' line was' : ' lines were') + ' left out: ' + (res.dropped === 1 ? 'its paper was' : 'their papers were') + ' deleted on the other device' : ''), () => { adoptSnapshot(before); ghMark(); toast('Undone'); });
}

function ghAdopt(f){
  const c = ghCfg(); if(!c) return;
  if(!adoptSnapshot(f.data)){ setGh('error', 'The data file ' + syncIn() + ' has the wrong format, so it wasn’t loaded.'); return; }
  c.sha = f.sha; c.dirty = false; c.lastSyncedAt = (f.data && f.data.savedAt) || Date.now(); c.remoteCount = libCounts(f.data && f.data.lib).all; ghStore(c);
  saveBase(c, f.data);
  gh.when = hhmm(c.lastSyncedAt); setGh('saved');
}
function libCounts(L){ const es = Object.values((L && L.entries) || {}); const c = es.filter(e => e.kind === 'concept').length; return {papers: es.length - c, concepts: c, topics: ((L && L.topics) || []).length, all: es.length}; }
function syncCountText(n){ return n.papers + (n.papers === 1 ? ' paper' : ' papers') + (n.concepts ? ', ' + n.concepts + (n.concepts === 1 ? ' concept' : ' concepts') : '') + ', ' + n.topics + (n.topics === 1 ? ' topic' : ' topics'); }
function localEmpty(){ return Object.keys(lib.entries || {}).length === 0; }
function remoteText(data){ return syncCountText(libCounts(data && data.lib)) + (data && data.savedAt ? ' · saved ' + stampText(data.savedAt) : ''); }
/* replace this browser's list with what GitHub has (undoable) */
function ghUseRemote(f, how){
  const before = snapshot();
  ghAdopt(f);
  toast((how || 'Loaded from ' + syncName()) + ': ' + syncCountText(libCounts(lib)), () => { adoptSnapshot(before); toast('Undone'); });
}
function ghAskWhich(f, title, text, preferLocal){
  const R = libCounts(f.data && f.data.lib), L = libCounts(lib);
  setGh('error', 'Waiting for you to choose a version');
  openModal({
    title,
    body:'<p>' + esc(text) + '</p>' +
      '<div class="ver-cmp"><div><b>' + syncWhere() + '</b><span>' + esc(remoteText(f.data)) + '</span></div><div><b>In this browser</b><span>' + esc(syncCountText(L)) + '</span></div></div>' +
      (R.all < L.all ? '<p class="warn-line">Using the GitHub version replaces ' + L.all + ' items in this browser with ' + R.all + '. You can undo straight away.</p>' : '') +
      (L.all < R.all ? '<p class="warn-line">Keeping this browser’s version replaces ' + R.all + ' items ' + syncIn() + ' with ' + L.all + '. The old version stays in the history (Settings → Sync → Earlier versions).</p>' : '<p class="hint">Whichever you don’t keep stays in the GitHub history.</p>'),
    actions:[
      {label:'Keep this browser’s (' + L.papers + ')', primary: !!preferLocal, onClick: () => { const c = ghCfg(); if(!c) return; c.sha = f.sha; c.dirty = true; ghStore(c); gh.force = true; ghSave(); }},
      {label:'Use the ' + syncShort() + ' version (' + R.papers + ')', primary: !preferLocal, onClick: () => ghUseRemote(f, 'Switched to the ' + syncShort() + ' version')}
    ]
  });
}

/* no data file at the chosen path: look for one nearby before writing anything */
async function ghMissing(c){
  const dir = String(c.path).split('/').slice(0, -1).join('/');
  let others = [];
  try{ others = (await ghListDir(c, dir)).filter(x => x.type === 'file' && /\.json$/i.test(x.name) && x.path !== c.path).map(x => x.path); }catch(e){}
  if(others.length){
    setGh('error', 'Waiting for you to choose a file');
    openModal({
      title: 'Your data may be in another file',
      body: '<p>There is no <code>' + esc(c.path) + '</code> in ' + esc(c.kind === 'github' ? c.owner + '/' + c.repo : syncName()) + ', but it has ' + others.map(p => '<code>' + esc(p) + '</code>').join(', ') + '.</p><p class="hint">Choose one to load it. Nothing is written until you do.</p>',
      actions: others.slice(0, 3).map((p, i) => ({label: 'Use ' + p.split('/').pop(), primary: i === 0, onClick: () => { const c2 = ghCfg(); if(!c2) return; c2.path = p; c2.sha = null; c2.dirty = false; ghStore(c2); ghLoad(); }})).concat([{label: 'Not now'}])
    });
    return;
  }
  c.sha = null; ghStore(c);
  if(localEmpty()){ c.dirty = false; ghStore(c); gh.when = ''; setGh('saved'); toast('Connected. Nothing is saved ' + syncIn() + ' yet; your first paper will be.'); return; }
  c.dirty = true; ghStore(c); return ghSave();
}
async function ghLoad(){
  const c = ghCfg();
  if(c && c.kind === 'folder') fsCheckCopiesSoon();
  if(!c){ updateSaveState(); return; }
  if(gh.busy) return;
  gh.busy = true; setGh('loading');
  let f = null, err = null;
  try{ f = await ghGetFile(c); }catch(e){ err = e; }
  gh.busy = false;
  if(err){ setGh('error', ghErr(err)); return; }
  if(f.missing) return ghMissing(c);
  const remoteChanged = f.sha !== c.sha;
  if(!remoteChanged){ if(c.dirty) return ghSave(); gh.when = hhmm(c.lastSyncedAt); setGh('saved'); return; }
  const localHasData = !localEmpty();
  if(!localHasData) return ghUseRemote(f, 'Loaded from ' + syncName());
  if(!c.sha){
    return ghAskWhich(f, (syncKind() === 'github' ? 'The repository' : syncName().charAt(0).toUpperCase() + syncName().slice(1)) + ' already has data', (syncKind() === 'github' ? 'This repository' : syncName().charAt(0).toUpperCase() + syncName().slice(1)) + ' already holds a Paper Map list, and this browser has one of its own. Which one do you want to keep?');
  }
  if(c.dirty) return ghMergeOrAsk(f, syncName().charAt(0).toUpperCase() + syncName().slice(1) + ' has a newer version', 'This data was changed on another device or directly ' + syncIn() + ', and this browser has unsaved changes too. Which one do you want to keep?');
  { const R = libCounts(f.data && f.data.lib).all, L = libCounts(lib).all;
    if(L > R && (R === 0 || (L >= 10 && R < L / 2))) return ghAskWhich(f, syncName().charAt(0).toUpperCase() + syncName().slice(1) + ' has less than this browser', 'The copy ' + syncIn() + ' holds much less than this browser. If something emptied it by mistake, keep this browser’s list: it is saved back.', true); }
  ghAdopt(f);
  toast('Loaded the latest data from ' + syncName());
}
function ghSave(){ return ghSerial(ghSaveNow); }
function ghGuard(f, mine, theirs){
  setGh('error', 'Not saved: waiting for you to choose');
  openModal({
    title: syncName().charAt(0).toUpperCase() + syncName().slice(1) + ' has more than this browser',
    body: '<div class="ver-cmp"><div><b>' + syncWhere() + '</b><span>' + esc(remoteText(f.data)) + '</span></div><div><b>In this browser</b><span>' + esc(syncCountText(libCounts(lib))) + '</span></div></div>' +
      '<p class="warn-line">Saving now would replace ' + theirs + ' items ' + syncIn() + ' with ' + mine + '. Nothing has been saved.</p>',
    actions: [
      {label: 'Save this browser’s anyway', onClick: () => { const c = ghCfg(); if(!c) return; c.sha = f.sha; c.dirty = true; ghStore(c); gh.force = true; ghSave(); }},
      {label: 'Load from ' + syncName(), primary: true, onClick: () => ghUseRemote(f, 'Loaded from ' + syncName())}
    ]
  });
}
/* Load from GitHub, on request */
async function ghPullNow(){
  const c = ghCfg(); if(!c) return;
  let f;
  try{ setGh('loading'); f = await ghGetFile(c); }catch(e){ setGh('error', ghErr(e)); return; }
  if(f.missing){ updateSaveState(); return ghMissing(c); }
  setGh('saved');
  openModal({
    title: 'Load from ' + syncName(),
    body: '<div class="ver-cmp"><div><b>' + syncWhere() + '</b><span>' + esc(remoteText(f.data)) + '</span></div><div><b>In this browser</b><span>' + esc(syncCountText(libCounts(lib))) + '</span></div></div><p class="hint">This browser’s list is replaced by GitHub’s. You can undo straight away.</p>',
    actions: [{label: 'Cancel'}, {label: 'Load it', primary: true, onClick: () => ghUseRemote(f, 'Loaded from ' + syncName())}]
  });
}
/* Earlier versions: every save is a commit, so any of them can come back */
async function ghHistory(){
  const c = ghCfg(); if(!c) return;
  let list = [];
  try{
    if(c.kind === 'dropbox' || c.kind === 'folder') list = await remoteHistory(c);
    else{
      const r = await fetch('https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + '/commits?path=' + encodeURIComponent(c.path) + '&sha=' + encodeURIComponent(c.branch) + '&per_page=40&_=' + Date.now(), {headers: ghHeaders(c)});
      if(!r.ok) throw {status: r.status};
      list = await r.json();
    }
  }catch(e){ toast(ghErr(e)); return; }
  openModal({
    title: 'Earlier versions in ' + syncName(),
    body: '<p class="hint">' + (c.kind === 'folder' ? 'Paper Map keeps the list as it was before each day’s first save, and before any replace, in the folder’s <code>data/backups</code>.' : c.kind === 'dropbox' ? 'Dropbox keeps earlier versions of the file (for 30 days on a free account).' : 'Every save is kept.') + ' Look at one to see what it holds, then restore it: it becomes your list here and is saved as the newest version.</p>' +
      '<div class="hist-list">' + (list.length ? list.map(x => '<div class="hist-row" data-hist="' + esc(x.sha) + '"><span class="hist-when">' + esc(new Date((x.commit && x.commit.author && x.commit.author.date) || 0).toLocaleString([], {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})) + '</span><span class="hist-what hint"></span><button type="button" class="btn small" data-hist-look="' + esc(x.sha) + '">Look</button></div>').join('') : '<p class="hint">No versions yet.</p>') + '</div>',
    actions: [{label: 'Close'}],
    onOpen: bd => {
      bd.addEventListener('click', async ev => {
        const lk = ev.target.closest('[data-hist-look]');
        const rs = ev.target.closest('[data-hist-restore]');
        if(lk){
          const row = lk.closest('[data-hist]'); lk.disabled = true; lk.textContent = '…';
          try{
            let data;
            if(c.kind === 'dropbox' || c.kind === 'folder') data = await remoteVersion(c, lk.dataset.histLook);
            else{
              const r = await fetch(ghApi(c) + '?ref=' + encodeURIComponent(lk.dataset.histLook), {headers: ghHeaders(c, {'Accept':'application/vnd.github.raw+json'})});
              if(!r.ok) throw {status: r.status};
              data = JSON.parse(await r.text());
            }
            row._data = data;
            row.querySelector('.hist-what').textContent = syncCountText(libCounts(data.lib));
            lk.outerHTML = '<button type="button" class="btn small primary" data-hist-restore="1">Restore</button>';
          }catch(e){ lk.disabled = false; lk.textContent = 'Look'; toast(ghErr(e)); }
          return;
        }
        if(rs){
          const row = rs.closest('[data-hist]'); const data = row && row._data; if(!data) return;
          const before = snapshot();
          if(!adoptSnapshot(data)){ toast('That version has the wrong format'); return; }
          closeModal();
          const c2 = ghCfg(); if(c2){ c2.dirty = true; ghStore(c2); } gh.force = true; gh.rev++; ghSave();
          toast('Restored: ' + syncCountText(libCounts(lib)) + '. Saving it to ' + syncName() + '.', () => { adoptSnapshot(before); ghMark(); toast('Undone'); });
        }
      });
    }
  });
}
async function ghSaveNow(){
  clearTimeout(gh.timer);
  const c = ghCfg();
  if(!c) return;
  if(gh.busy){ gh.again = true; return; }
  gh.busy = true; setGh('saving');
  const rev = gh.rev;
  if(!gh.force){
    const mine = libCounts(lib).all, known = c.remoteCount || 0;
    if(mine === 0 || (known >= 10 && mine < known / 2) || !c.sha){
      let f = null; try{ f = await ghGetFile(c); }catch(e){}
      if(f && !f.missing){
        const theirs = libCounts(f.data && f.data.lib).all;
        if(theirs > mine && (mine === 0 || (theirs >= 10 && mine < theirs / 2))){ gh.busy = false; ghGuard(f, mine, theirs); return; }
      }
    }
  }
  gh.replacing = !!gh.force; gh.force = false;
  const snap = snapshot();
  const content = b64encode(JSON.stringify(snap, null, 1));
  const message = appTitle() + ' autosave ' + stampText(snap.savedAt);
  let ok = false, asked = false;
  try{
    let res = await ghPut(c, content, message, c.sha);
    if(res.status === 409 || res.status === 422){
      const f = await ghGetFile(c);
      if(f.missing){ res = await ghPut(c, content, message, null); if(res.status === 409) throw {status:'empty'}; }
      else if(f.sha !== c.sha){ asked = true; gh.busy = false; ghMergeOrAsk(f, syncName().charAt(0).toUpperCase() + syncName().slice(1) + ' has a newer version', 'While saving, the file ' + syncIn() + ' turned out to have changed elsewhere. Which one do you want to keep?'); return; }
      else res = await ghPut(c, content, message, f.sha);
    }
    if(!res.ok) throw {status: res.status};
    const j = await res.json();
    const c2 = ghCfg();
    if(c2){ c2.sha = j && j.content && j.content.sha; c2.lastSyncedAt = snap.savedAt; c2.remoteCount = libCounts(snap.lib).all; c2.dirty = gh.rev !== rev; ghStore(c2); saveBase(c2, snap); }
    ok = true;
    gh.when = hhmm(snap.savedAt); setGh(c2 && c2.dirty ? 'pending' : 'saved');
  }catch(e){ setGh('error', ghErr(e)); }
  finally{ if(!asked) gh.busy = false; }
  const c3 = ghCfg();
  if(ok && (gh.again || (c3 && c3.dirty))){ gh.again = false; clearTimeout(gh.timer); gh.timer = setTimeout(ghSave, 1200); }
  else gh.again = false;
  if(ok) ghNotesSoon();
  if(ok && c.kind === 'folder') fsCheckCopiesSoon();
}
function ghForget(){
  clearTimeout(gh.timer);
  try{ localStorage.removeItem(GH_KEY); }catch(e){}
  setGh('off');
}


