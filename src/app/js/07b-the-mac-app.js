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
