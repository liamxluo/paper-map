/* ===================== persistence ===================== */
function touchLib(){
  if(undoSlot && !undoSlot.fresh && !undoing) clearUndo();
  lib.updatedAt = Date.now();
  const okLs = lsSet(LS.lib, lib); idbSaveSoon();
  if(!okLs && !window.__pmdb) toast('This browser’s storage is full; changes may not be saved here');
  ghMark();
}
/* the browser keeps the library in IndexedDB as well, with no 5 MB limit; localStorage stays a quick copy while it fits */
let idbT = null;
function idbSaveSoon(){ if(PREVIEW || !window.__pmdb) return; clearTimeout(idbT); idbT = setTimeout(() => { try{ window.__pmdb.set('rl:lib', {updatedAt: lib.updatedAt || Date.now(), lib}); }catch(e){} }, 400); }
function touchAllTopics(){ touchLib(); }
function persistStatus(){ lsSet(LS.status, {map:status, updatedAt:statusTime}); ghMark(); }
/* opts.remote === false: view state only (zoom, sidebar), not committed to GitHub */
function persistSettings(opts){ settings.updatedAt = Date.now(); lsSet(LS.settings, settings); if(!(opts && opts.remote === false)) ghMark(); }
