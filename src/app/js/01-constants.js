/* ===================== constants ===================== */
const APP = 'paper-map';
const LS = {lib:'rl:lib', status:'rl:status', settings:'rl:settings'};
const LAYERS = ['Paper','Book','Chapter','Review','Theory','Empirical','Method','Textbook','Other'];
/* Tags: user-defined labels with a name, colour and order */
const TAG_PALETTE = ['#7058A3','#E7609E','#38A1DB','#9C88CF','#C1328E','#5654A2','#86B5D9','#D98FA6','#8C6E9E','#4F7CAC','#B57BA6','#6C9BC4'];
function defaultTags(){ return [
  {id:'must', name:'Must read', color:'#7058A3', map:true},
  {id:'maybe', name:'Optional', color:'#9C88CF', map:true}
]; }
const PRIO_LABEL = {3:'★ Must read', 2:'○ Optional', 1:'· Background'};
const DEFAULT_COLORS = {green:'#009473', red:'#E34234'};
const PREVIEW_DATA = 'example/displaydata.json';
let PREVIEW = false;
/* Set this to the tag of the GitHub release you are about to publish (v1.3.0, v1.3.1, …). */
const APP_VERSION = 'v3.0.2';
const APP_REPO = 'liamxluo/paper-map';
const RELEASES_URL = 'https://github.com/' + APP_REPO + '/releases';
/* Installed as an app (or installable): only when the page comes from a website, never from a downloaded file */
const SERVED = /^https?:$/.test(location.protocol);
const STANDALONE = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
let installPrompt = null;
/* the install card: Chrome and Edge only (they are the browsers that can install with one click) */
function showInstallCard(on){
  const c = document.getElementById('installCard'); if(!c) return;
  c.hidden = !on || STANDALONE;
  let folded = false; try{ folded = localStorage.getItem('rl:installFold') === '1'; }catch(e){}
  c.classList.toggle('folded', folded);
}
window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); installPrompt = ev; showInstallCard(true); });
window.addEventListener('appinstalled', () => { installPrompt = null; showInstallCard(false); try{ toast('Paper Map is installed. Open it from your Dock, Start menu or home screen.'); }catch(e){} });
function verParts(v){ return String(v || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0); }
function verNewer(a, b){ const x = verParts(a), y = verParts(b); for(let i = 0; i < 3; i++){ if((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }
async function latestRelease(){
  let c = null; try{ c = JSON.parse(localStorage.getItem('rl:latest') || 'null'); }catch(e){}
  if(c && Date.now() - c.at < 12 * 3600e3) return c.tag;
  try{
    const r = await fetch('https://api.github.com/repos/' + APP_REPO + '/releases/latest', {headers: {'Accept': 'application/vnd.github+json'}});
    if(!r.ok) return c ? c.tag : null;
    const j = await r.json(); const tag = j && j.tag_name;
    try{ localStorage.setItem('rl:latest', JSON.stringify({tag, at: Date.now()})); }catch(e){}
    return tag;
  }catch(e){ return c ? c.tag : null; }
}
async function showLatest(){
  const el = document.getElementById('setLatest'); if(!el || PREVIEW) return;
  const tag = await latestRelease(); if(!tag || !document.getElementById('setLatest')) return;
  if(verNewer(tag, APP_VERSION)) el.innerHTML = ' · <b>' + esc(tag) + ' is out</b>: ' + (SERVED ? 'reload to update' : '<a href="https://github.com/' + APP_REPO + '/releases/latest" target="_blank" rel="noopener">download it</a>');
  else el.textContent = ' · up to date';
}
/* once after an update, say so */
function announceUpdate(){
  let seen = null; try{ seen = localStorage.getItem('rl:version'); localStorage.setItem('rl:version', APP_VERSION); }catch(e){ return; }
  if(seen && seen !== APP_VERSION && !PREVIEW) setTimeout(() => {
    const el = document.getElementById('toast'); if(!el) return;
    el.innerHTML = '<span>Paper Map updated to ' + esc(APP_VERSION) + '</span><a class="toast-link" href="' + RELEASES_URL + '/tag/' + APP_VERSION + '" target="_blank" rel="noopener">What’s new</a>';
    el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 9000);
  }, 1200);
}
window.addEventListener('load', announceUpdate);
async function runInstall(){
  if(installPrompt){ const p = installPrompt; p.prompt(); let ok = false; try{ ok = (await p.userChoice).outcome === 'accepted'; }catch(e){} if(ok){ installPrompt = null; showInstallCard(false); } return; }
  openInstallHelp();
}
document.addEventListener('click', ev => {
  if(ev.target.closest('#icInstall, #icPill')){ runInstall(); return; }
  if(ev.target.closest('#icFold')){ try{ localStorage.setItem('rl:installFold', '1'); }catch(e){} showInstallCard(true); }
});
/* which browser this is, for install steps */
function browserKind(){
  const ua = navigator.userAgent;
  if(/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if(/Edg\//.test(ua)) return 'edge';
  if(/Firefox\//.test(ua)) return 'firefox';
  if(/Chrome\/|Chromium\//.test(ua)) return 'chrome';
  if(/Safari\//.test(ua) && /Macintosh/.test(ua)) return 'safari';
  return 'other';
}
async function installChecks(){
  const has = async u => { try{ const r = await fetch(u, {cache: 'no-cache'}); return r.ok; }catch(e){ return null; } };
  return {manifest: await has('manifest.webmanifest'), worker: await has('sw.js')};
}
async function openInstallHelp(){
  const k = browserKind(), c = SERVED ? await installChecks() : null;
  const steps = {
    chrome: 'In Chrome, click the install icon at the right end of the address bar, or open the ⋮ menu → <b>Cast, save and share</b> → <b>Install page as app</b>.',
    edge: 'In Edge, click the install icon at the right end of the address bar, or open the … menu → <b>Apps</b> → <b>Install this site as an app</b>.',
    safari: 'In Safari, choose <b>File → Add to Dock</b> (macOS Sonoma or later). Safari has no install button inside pages, so this menu is the way.',
    ios: 'Tap <b>Share</b> (the square with an arrow, in the address bar or at the bottom), then <b>Add to Home Screen</b>. This works in Safari, and in Chrome or Edge on recent iPhones.',
    firefox: 'Firefox on a computer cannot install web apps. Open this page in Chrome, Edge or Safari to install it.',
    other: 'Use your browser’s menu to install this page as an app, or add it to your home screen.'
  }[k];
  let body;
  if(!SERVED) body = '<p>This copy is a file on your computer, which browsers cannot install. Open the website version with <b>?app</b> at the end (the README links to it) and install it from there.</p>';
  else{
    const missing = [];
    if(c.manifest === false) missing.push('<code>manifest.webmanifest</code>');
    if(c.worker === false) missing.push('<code>sw.js</code>');
    body = '<p>' + steps + '</p>' +
      (missing.length ? '<p class="warn-line">This website is missing ' + missing.join(' and ') + '. Upload ' + (missing.length > 1 ? 'them' : 'it') + ', with the <code>icons</code> folder, next to <code>index.html</code> in your repository, wait a minute for GitHub Pages, then reload.</p>' : '') +
      '<p class="hint">Already installed? Open Paper Map from your Dock, Applications or home screen; browsers stop offering to install once it is there.</p>';
  }
  openModal({title: 'Install Paper Map', body, actions: [{label: 'OK', primary: true}]});
}
if(SERVED && 'serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {}); });
const BRANCH_PALETTE = ['#E34234', '#7058A3', '#009473', '#38A1DB', '#E7609E', '#8B5E3C', '#E2A72E'];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
