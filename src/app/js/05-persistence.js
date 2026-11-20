/* ===================== persistence ===================== */
function touchLib(){
  if(undoSlot && !undoSlot.fresh && !undoing) clearUndo();
  lib.updatedAt = Date.now();
  if(!lsSet(LS.lib, lib)) toast('This browser’s storage is full; changes may not be saved here');
  ghMark();
}
function touchAllTopics(){ touchLib(); }
function persistStatus(){ lsSet(LS.status, {map:status, updatedAt:statusTime}); ghMark(); }
/* opts.remote === false: view state only (zoom, sidebar), not committed to GitHub */
function persistSettings(opts){ settings.updatedAt = Date.now(); lsSet(LS.settings, settings); if(!(opts && opts.remote === false)) ghMark(); }
