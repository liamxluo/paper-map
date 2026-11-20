/* ===================== init ===================== */
/* Served from a website next to example/displaydata.json → read-only preview of that example.
   Opened as a downloaded file → the normal app. */
async function loadPreview(){
  if(!/^https?:$/.test(location.protocol) || /[?&](app|add|title)\b/.test(location.search)) return null;
  try{
    const r = await fetch(PREVIEW_DATA, {cache:'no-cache'});
    if(!r.ok) return null;
    const obj = await r.json();
    return obj && validLib(obj.lib) ? obj : null;
  }catch(e){ return null; }
}
(async () => {
const demo = await loadPreview();
if(demo){
  PREVIEW = true;
  lib = normalizeLib(demo.lib);
  status = (demo.status && demo.status.map) || {}; statusTime = 0;
  settings = normalizeSettings(Object.assign(defaultSettings(), demo.settings || {}));
  document.getElementById('previewBanner').hidden = false;
}else loadAll();
reindex();
applyColors();
ui.depth = settings.focusDepth || 1;
const pv = (demo && demo.preview) || {};
const initView = resolveView(location.hash.slice(1) || pv.view || '');
ui.topic = initView.topic; ui.sub = initView.sub;
ui.page = (location.hash.slice(1) || pv.view) === 'concepts' ? 'concepts' : null;
renderAll();
if(pv.select && lib.entries[pv.select]) select(pv.select);
const zoomTools = document.getElementById('zoomTools'), btnZoom = document.getElementById('btnZoom');
function setZoomOpen(open){ zoomTools.hidden = !open; btnZoom.setAttribute('aria-expanded', String(open)); }
setZoomOpen(settings.zoomOpen === 'open');
btnZoom.addEventListener('click', () => { const open = zoomTools.hidden; setZoomOpen(open); settings.zoomOpen = open ? 'open' : null; persistSettings({remote:false}); });
if(settings.filtersOpen === 'open') setFiltersOpen(true);
const mapKey = document.getElementById('mapKey');
mapKey.open = settings.mapKey === 'open';
mapKey.addEventListener('toggle', () => { settings.mapKey = mapKey.open ? 'open' : null; persistSettings({remote:false}); });
setToc(isWide() && settings.toc !== 'closed', false);
updateSaveState();
setBarH();
const onResize = debounce(() => { renderMap(false); setBarH(); document.getElementById('tocBackdrop').hidden = !(tocIsOpen() && !isWide()); }, 100);
if('ResizeObserver' in window) new ResizeObserver(onResize).observe(mapScroll);
window.addEventListener('resize', onResize);
if(location.hash.length > 1) setTimeout(() => scrollToEl(mainEl, 'start'), 80);
fsRestore().catch(() => {}).then(() => { if(!PREVIEW && ghCfg()) ghLoad(); if(TAURI) setTimeout(macFirstRun, 900); });