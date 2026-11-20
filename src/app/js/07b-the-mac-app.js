/* ===================== the Mac app: your library as a file, on this Mac or in iCloud Drive =====================
   Inside the Mac app (Tauri), the folder sync above works on real folders through a few native commands,
   so a "Paper Map" folder in iCloud Drive (or in Documents) syncs, keeps daily backups and combines copies
   exactly as a folder chosen in Chrome does. Outside the Mac app none of this runs. */
const TAURI = !!(window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function');
const tinvoke = (cmd, args) => window.__TAURI__.core.invoke(cmd, args || {});
function b64ToU8(s){ const bin = atob(s); const u = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function u8ToB64(u){ let s = ''; for(let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function nfErr(kind){ const e = new Error(kind === 'type' ? 'Not that kind of item' : 'Not found'); e.name = kind === 'type' ? 'TypeMismatchError' : 'NotFoundError'; return e; }
async function nCall(cmd, args){ try{ return await tinvoke(cmd, args); }catch(e){ const m = String((e && e.message) || e); if(/NotFound|No such file/i.test(m)) throw nfErr(); throw new Error(m); } }
function nativeFile(p, name){
  return {kind: 'file', name,
    async getFile(){ const st = await nCall('fs_stat', {path: p}); if(!st) throw nfErr(); const b = b64ToU8(await nCall('fs_read', {path: p}));
      return {name, size: b.length, lastModified: st.mtime || Date.now(), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), text: async () => new TextDecoder().decode(b)}; },
    async createWritable(){ const parts = []; return {write: async d => { parts.push(d); }, close: async () => { const u = new Uint8Array(await new Blob(parts).arrayBuffer()); await nCall('fs_write', {path: p, data: u8ToB64(u)}); }}; }};
}
function nativeDir(p, name){
  const at = n => p.replace(/\/+$/, '') + '/' + n;
  return {kind: 'directory', name: name || p.split('/').filter(Boolean).pop() || p, nativePath: p,
    async getDirectoryHandle(n, o){ const q = at(n), st = await nCall('fs_stat', {path: q});
      if(!st){ if(o && o.create) await nCall('fs_mkdir', {path: q}); else throw nfErr(); } else if(!st.dir) throw nfErr('type');
      return nativeDir(q, n); },
    async getFileHandle(n, o){ const q = at(n), st = await nCall('fs_stat', {path: q});
      if(!st){ if(!(o && o.create)) throw nfErr(); } else if(st.dir) throw nfErr('type');
      return nativeFile(q, n); },
    async removeEntry(n){ await nCall('fs_remove', {path: at(n)}); },
    async *entries(){ const list = await nCall('fs_list', {path: p}); for(const x of list) yield [x.name, x.dir ? nativeDir(at(x.name), x.name) : nativeFile(at(x.name), x.name)]; },
    async *values(){ for await (const [, h] of this.entries()) yield h; },
    async queryPermission(){ return 'granted'; }, async requestPermission(){ return 'granted'; }};
}
async function macPlaces(){ try{ return await tinvoke('storage_places'); }catch(e){ return {}; } }
async function macUseFolder(root, label){
  await nCall('fs_mkdir', {path: root});
  fsDir = nativeDir(root, label); fsPending = null;
  const old = lsGet(GH_KEY) || {};
  ghStore({kind: 'folder', name: label, native: root, sha: old.kind === 'folder' && old.native === root ? old.sha || null : null, dirty: false, lastSyncedAt: 0});
  try{ localStorage.setItem('pm:storageAsked', '1'); }catch(e){}
  toast('Saving to ' + label); updateSaveState(); ghLoad();
}
/* where your library lives: asked once, when the Mac app first opens; Settings → Sync can change it */
async function macChooseStorage(){
  const pl = await macPlaces();
  const icloud = pl.icloud ? pl.icloud + '/Paper Map' : null, here = (pl.documents || ((pl.home || '') + '/Documents')) + '/Paper Map';
  const card = (k, title, text, off) => '<button type="button" class="mac-place" data-place="' + k + '"' + (off ? ' disabled' : '') + '><b>' + title + '</b><span>' + text + '</span></button>';
  openModal({title: 'Where should Paper Map keep your library?',
    body: '<p>Your maps, papers, notes, Readings and notebooks are kept as one file in a folder you can see in Finder. You can change this later in Settings.</p><div class="mac-places">' +
      card('icloud', 'iCloud Drive', icloud ? 'On all your Macs, through your own iCloud: a “Paper Map” folder in iCloud Drive.' : 'iCloud Drive is not turned on for this Mac (System Settings → Apple Account → iCloud).', !icloud) +
      card('mac', 'This Mac only', 'A “Paper Map” folder in your Documents folder.') +
      card('github', 'GitHub', 'A private repository of your own, with every change kept.') + '</div>',
    actions: [{label: 'Decide later', onClick: () => { try{ localStorage.setItem('pm:storageAsked', '1'); }catch(e){} }}],
    onOpen: bd => bd.addEventListener('click', ev => { const b = ev.target.closest('[data-place]'); if(!b || b.disabled) return;
      closeModal();
      if(b.dataset.place === 'icloud') macUseFolder(icloud, 'iCloud Drive');
      else if(b.dataset.place === 'mac') macUseFolder(here, 'This Mac');
      else { try{ localStorage.setItem('pm:storageAsked', '1'); }catch(e){} openSettings(); toast('Connect GitHub under Sync'); } })});
}
function macFirstRun(){ if(!TAURI || PREVIEW) return; let asked = null; try{ asked = localStorage.getItem('pm:storageAsked'); }catch(e){} if(asked || lsGet(GH_KEY)) return; macChooseStorage(); }
/* exported files go to Downloads (and Finder shows them); web links open in your browser */
async function macSave(blob, name){ const u = new Uint8Array(await blob.arrayBuffer()); const p = await tinvoke('save_download', {name, data: u8ToB64(u)}); toast('Saved to Downloads: ' + String(p).split('/').pop()); return 'saved'; }
if(TAURI){
  document.addEventListener('click', ev => { const a = ev.target.closest && ev.target.closest('a[href]'); if(!a) return; const href = a.getAttribute('href') || '';
    if(/^(https?:|mailto:)/i.test(href)){ ev.preventDefault(); tinvoke('open_url', {url: a.href}).catch(() => {}); } }, true);
  window.open = u => { if(/^(https?:|mailto:)/i.test(String(u || ''))) tinvoke('open_url', {url: String(u)}).catch(() => {}); return null; };
}

/* the GitHub token in the Mac's Keychain: read at start; a token still kept in plain text moves there */
if(TAURI){ (async () => {
  try{ const v = await tinvoke('secret_get', {key: 'github-token'}); if(v){ KC_TOKEN = v; } }catch(e){}
  try{ const c = lsGet(GH_KEY); if(c && c.token && c.token !== '__keychain__') ghStore(c); else if(c && c.token === '__keychain__' && KC_TOKEN) setTimeout(() => { try{ ghLoad(); }catch(e){} }, 0); }catch(e){}
})(); }

/* ===================== updates, in the Mac app =====================
   A few seconds after it opens (and every six hours while it stays open) the app asks GitHub Releases whether a newer
   Paper Map is out. If so a small note says so, with what is new; Install downloads it, checks its signature, puts it in
   place of the app and restarts. Only the app is replaced: your library, notes and PDFs live in their own folder. */
const UPD = {box: null, busy: false};
function updNotes(md){ return String(md || '').split('\n').map(l => l.trim()).filter(l => /^[-*] /.test(l)).map(l => l.replace(/^[-*] /, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '')).map(l => l.length > 110 ? l.slice(0, l.lastIndexOf(' ', 104)) + '…' : l).slice(0, 3); }
function updBox(info){
  if(UPD.box) UPD.box.remove();
  const b = document.createElement('div'); b.id = 'updNote'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Paper Map update');
  const notes = updNotes(info.notes);
  b.innerHTML = '<p class="un-k">Paper Map update</p><b class="un-t">Paper Map ' + esc(info.version) + ' is ready</b>' +
    (notes.length ? '<ul class="un-l">' + notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '') +
    '<p class="un-s">Your maps, papers, notes and PDFs stay as they are.</p>' +
    '<div class="un-bar" hidden><i></i></div><div class="un-btns"><button type="button" class="un-later">Later</button><button type="button" class="un-go">Install and restart</button></div>';
  document.body.appendChild(b); UPD.box = b; requestAnimationFrame(() => b.classList.add('on'));
  b.querySelector('.un-later').addEventListener('click', () => { try{ localStorage.setItem('pm:updLater', JSON.stringify({v: info.version, t: Date.now()})); }catch(e){} b.classList.remove('on'); setTimeout(() => b.remove(), 250); UPD.box = null; });
  b.querySelector('.un-go').addEventListener('click', () => updInstall(info));
}
async function updInstall(info){
  if(UPD.busy || !UPD.box) return; UPD.busy = true;
  const b = UPD.box, go = b.querySelector('.un-go'), bar = b.querySelector('.un-bar'), fill = bar.querySelector('i'), s = b.querySelector('.un-s');
  go.disabled = true; b.querySelector('.un-later').disabled = true; go.textContent = 'Saving your library…';
  /* everything saved first: the library to its folder or GitHub, notebooks with it */
  try{ if(typeof ghSaveNow === 'function' && ghCfg()) await Promise.race([ghSaveNow(), new Promise(r => setTimeout(r, 6000))]); }catch(e){}
  let un = null;
  try{ un = await window.__TAURI__.event.listen('update-progress', ev => { const [got, total] = ev.payload || []; if(total){ fill.style.width = Math.min(100, got / total * 100).toFixed(1) + '%'; go.textContent = 'Downloading… ' + Math.round(got / total * 100) + '%'; } }); }catch(e){}
  bar.hidden = false; go.textContent = 'Downloading…';
  try{ await tinvoke('update_install'); go.textContent = 'Restarting…'; }
  catch(e){ UPD.busy = false; go.disabled = false; b.querySelector('.un-later').disabled = false; go.textContent = 'Try again'; bar.hidden = true;
    s.textContent = 'The update could not be installed (' + String((e && e.message) || e).slice(0, 80) + '). Paper Map is unchanged; you can try again.'; }
  if(un) try{ un(); }catch(e){}
}
async function updCheck(manual){
  if(!TAURI) return;
  let info = null;
  try{ info = await tinvoke('update_check'); }catch(e){ if(manual) toast('Could not check for updates just now'); return; }
  if(!info){ if(manual) toast('You have the latest Paper Map (' + APP_VERSION + ')'); return; }
  if(!manual){ try{ const l = JSON.parse(localStorage.getItem('pm:updLater') || 'null'); if(l && l.v === info.version && Date.now() - l.t < 864e5) return; }catch(e){} }
  updBox(info);
}
if(TAURI){ setTimeout(() => updCheck(false), 6000); setInterval(() => updCheck(false), 6 * 3600e3); }
