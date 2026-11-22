/* ===================== persistence ===================== */
function touchLib(){ try{ if(window.copySoon && window.copyPlace && window.copyPlace()) window.copySoon(30000); }catch(e){}
  if(undoSlot && !undoSlot.fresh && !undoing) clearUndo();
  lib.updatedAt = Date.now();
  const okLs = lsSet(LS.lib, typeof libSlim === 'function' ? libSlim(lib) : lib); idbSaveSoon();
  if(!okLs && !window.__pmdb) toast('This browser’s storage is full; changes may not be saved here');
  ghMark();
}
/* the browser keeps the library in IndexedDB as well, with no 5 MB limit; localStorage stays a quick copy while it fits */
let idbT = null;
function idbSaveSoon(){ if(PREVIEW || !window.__pmdb) return; clearTimeout(idbT); idbT = setTimeout(() => { try{ window.__pmdb.set('rl:lib', {updatedAt: lib.updatedAt || Date.now(), lib: typeof libSlim === 'function' ? libSlim(lib) : lib}); }catch(e){} }, 400); }
function idbFlush(){ if(PREVIEW || !window.__pmdb || !idbT) return; clearTimeout(idbT); idbT = null; try{ window.__pmdb.set('rl:lib', {updatedAt: lib.updatedAt || Date.now(), lib: typeof libSlim === 'function' ? libSlim(lib) : lib}); }catch(e){} }
addEventListener('pagehide', idbFlush); document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') idbFlush(); });
function touchAllTopics(){ touchLib(); }
function persistStatus(){ lsSet(LS.status, {map:status, updatedAt:statusTime}); ghMark(); }
/* opts.remote === false: view state only (zoom, sidebar), not committed to GitHub */
function persistSettings(opts){ settings.updatedAt = Date.now(); lsSet(LS.settings, settings); if(!(opts && opts.remote === false)) ghMark(); }
