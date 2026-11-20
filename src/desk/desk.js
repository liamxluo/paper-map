(function(){
'use strict';
/* ============ the bridge to the app (same origin) ============ */
const P = (function(){ try{ return window.parent && window.parent !== window && window.parent.pmDesk ? window.parent.pmDesk : null; }catch(e){ return null; } })();
const AS = 'assets/desk/';
const W = 560, H = 350;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const stage = $('stage'), hint = $('hint');
let state = 'desk', busy = false;
const EMPTY = {title: 'Paper Map', topics: [], papers: [], links: [], lineBranch: {}, branches: [], readings: [], readingCats: [], notebooks: [], prefs: {}, recent: [], recentTimes: {}, preview: false};
let D = load();
function load(){ try{ const d = P ? P.data() : null; return Object.assign({}, EMPTY, d || {}); }catch(e){ return Object.assign({}, EMPTY); } }
let prefs = Object.assign({wood: 'mahogany', paper: 'creased', cup: 'espresso', start: 'desk'}, D.prefs || {});
function savePrefs(){ if(P) try{ P.savePrefs(Object.assign({}, prefs)); }catch(e){} }
function toast(t){ const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('on'), 2800); }
const HINT_DESK = 'Click the maps on the left, your papers or your books on the right';

/* ============ fit the 1440×900 desk to the window ============ */
let FIT = {s: 1, tx: 0, ty: 0};
function fit(){
  const narrow = innerWidth < 760 || innerWidth / innerHeight < 1.05;
  const s = narrow ? Math.min(innerWidth / 1440, innerHeight / 900) : Math.max(innerWidth / 1440, innerHeight / 900);
  FIT = {s, tx: (innerWidth - 1440 * s) / 2, ty: (innerHeight - 900 * s) / 2};
  stage.style.transform = 'translate(' + FIT.tx + 'px,' + FIT.ty + 'px) scale(' + s + ')';
  document.body.classList.toggle('narrow', narrow);
}
addEventListener('resize', () => { if(state === 'note') zoomTo(true); else fit(); });
fit();

/* ============ animation helpers ============ */
function anim(el, frames, o){ if(reduce) o = Object.assign({}, o, {duration: 1, delay: 0}); const a = el.animate(frames, Object.assign({fill: 'forwards'}, o)); return a.finished.then(() => { const last = frames[frames.length - 1]; Object.keys(last).forEach(k => { if(k !== 'offset') el.style[k] = last[k]; }); a.cancel(); }).catch(() => {}); }
const EASE = 'cubic-bezier(.45,.05,.2,1)';
function poseT(p, sc){ return 'translate(' + (p[0] - W / 2) + 'px,' + (p[1] - H / 2) + 'px) rotate(' + p[2] + 'deg) scale(' + (Array.isArray(sc) ? sc[0] + ',' + sc[1] : sc) + ')'; }
function setPose(el, p, sc){ el.style.transform = poseT(p, sc); el._pose = [p, sc]; }
function move(el, p, sc, dur, delay = 0, easing = EASE){ const from = el.style.transform; el._pose = [p, sc]; return anim(el, [{transform: from}, {transform: poseT(p, sc)}], {duration: dur, delay, easing}); }
function setState(s, h){ state = s; const cl = document.body.classList; [...cl].forEach(c => { if(c.indexOf('st-') === 0) cl.remove(c); }); cl.add('st-' + s); cl.toggle('smooth', prefs.paper === 'smooth'); if(h != null) hint.textContent = h; }

/* ============ map faces and covers, drawn from your own data ============ */
const PALETTE = ['#B4432E', '#2F7F86', '#4A6FA5', '#4F7A4A', '#A8802F', '#6B4A7A', '#8A5A3A', '#3F6F8F'];
function topicColor(t){ if(t && t.cover) return t.cover; const i = D.topics.findIndex(x => x.id === t.id); return PALETTE[(i < 0 ? 0 : i) % PALETTE.length]; }
function svgURL(s){ return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s) + '")'; }
const SERIF = "'PMap Serif',Palatino,Georgia,serif", SANS = "'PMap Sans',Helvetica,Arial,sans-serif";
function faceSVG(t){
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 350" width="1120" height="700">';
  if(!t) return s + '<text x="280" y="180" text-anchor="middle" font-family="' + SERIF + '" font-style="italic" font-size="11" fill="#9A8F80">A map for another field</text></svg>';
  const papers = D.papers.filter(p => p.topic === t.id && typeof p.y === 'number'), ys = papers.map(p => p.y), n = D.topics.length;
  s += '<text x="21.9" y="41.6" font-family="' + SERIF + '" font-weight="700" font-size="10.9" letter-spacing="4.4" fill="#231E1A">' + esc(String(t.name).toUpperCase().slice(0, 30)) + '</text>';
  s += '<text x="21.9" y="50.9" font-family="' + SERIF + '" font-style="italic" font-size="5" fill="#7C7062">' + papers.length + (papers.length === 1 ? ' paper' : ' papers') + (ys.length ? ' · ' + Math.min(...ys) + ' – ' + Math.max(...ys) : '') + ' · one of ' + n + (n === 1 ? ' map' : ' maps') + '</text>';
  return s + '<line x1="21.9" x2="107" y1="58.2" y2="58.2" stroke="#231E1A" stroke-width=".45" opacity=".7"/></svg>';
}
function wrapTitle(name, max){ const words = String(name).toUpperCase().split(/\s+/); const lines = []; let cur = '';
  words.forEach(w => { if((cur + ' ' + w).trim().length > max && cur){ lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if(cur) lines.push(cur); return lines.slice(0, 4); }
function coverSVG(t){
  const c = t ? topicColor(t) : '#9A8F80', papers = t ? D.papers.filter(p => p.topic === t.id) : [], ys = papers.map(p => p.y).filter(y => typeof y === 'number');
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 186.67 350" width="374" height="700">';
  s += '<rect x="0" y="0" width="186.67" height="46" fill="' + c + '"/><text x="16" y="20" font-family="' + SANS + '" font-weight="700" font-size="5.6" letter-spacing="1.6" fill="#FBF6EC">PAPER MAP</text><text x="16" y="32" font-family="' + SERIF + '" font-style="italic" font-size="6.8" fill="#FBF6EC">A personal map of reading</text>';
  const lines = t ? wrapTitle(t.name, 13) : ['A NEW', 'FIELD'];
  lines.forEach((l, i) => { s += '<text x="16" y="' + (84 + i * 19) + '" font-family="' + SERIF + '" font-weight="700" font-size="15.5" letter-spacing=".6" fill="#231E1A">' + esc(l) + '</text>'; });
  const y2 = 84 + lines.length * 19 + 6;
  s += '<text x="16" y="' + y2 + '" font-family="' + SERIF + '" font-style="italic" font-size="7.4" fill="#5E544A">' + (t ? 'A map of ' + papers.length + (papers.length === 1 ? ' paper' : ' papers') : 'Ready to name') + '</text><line x1="16" x2="70" y1="' + (y2 + 8) + '" y2="' + (y2 + 8) + '" stroke="#231E1A" stroke-width=".5" opacity=".6"/>';
  s += '<g transform="translate(93 236)"><line x1="-46" y1="10" x2="0" y2="0" stroke="#3A322B" stroke-width=".8"/><line x1="0" y1="0" x2="44" y2="-10" stroke="' + c + '" stroke-width="1.3"/><line x1="0" y1="0" x2="40" y2="14" stroke="#3A322B" stroke-width=".8"/><circle cx="-46" cy="10" r="3" fill="#F4EEE2" stroke="#3A322B" stroke-width=".9"/><circle cx="0" cy="0" r="4.4" fill="#231E1A"/><circle cx="44" cy="-10" r="3" fill="#F4EEE2" stroke="' + c + '" stroke-width="1.1"/><circle cx="40" cy="14" r="3" fill="#F4EEE2" stroke="#3A322B" stroke-width=".9"/></g>';
  if(ys.length) s += '<text x="16" y="326" font-family="' + SANS + '" font-size="6.6" fill="#7C7062">' + Math.min(...ys) + ' – ' + Math.max(...ys) + '</text>';
  return s + '</svg>';
}
function paintSheet(el, t){
  el._topic = t ? t.id : null;
  const v = prefs.paper === 'smooth' ? 'smooth' : 'creased';
  const face = svgURL(faceSVG(t)), under = t ? 'url(' + AS + 'face-lantern.webp)' : 'url(' + AS + 'map-paper.webp)';
  el.querySelectorAll('.fc').forEach(f => { f.style.backgroundImage = 'url(' + AS + 'light-' + v + '-hl.webp),url(' + AS + 'light-' + v + '-mul.webp),' + face + ',' + under; f.style.backgroundBlendMode = 'screen,multiply,multiply,normal'; });
  el.querySelectorAll('.pn.l .bk, .pn.m .bk').forEach(b => { b.style.backgroundImage = 'url(' + AS + 'back.webp)'; });
  el.querySelector('.pn.r .bk').style.backgroundImage = svgURL(coverSVG(t)) + ',url(' + AS + 'cover-paper.webp)';
  el.setAttribute('aria-label', t ? 'Map: ' + t.name : 'An empty map');
}
function makeSheet(){
  const el = document.createElement('div'); el.className = 'ms';
  el.innerHTML = '<div class="shd"></div><div class="shd2"></div>' + ['l', 'm', 'r'].map(k => '<div class="pn ' + k + '"><div class="fc"></div><div class="bk"></div></div>').join('') + '<div class="hit"></div>';
  $('maps').appendChild(el); return el;
}

/* ============ the three sheets on the desk, whatever the number of maps ============ */
/* bottom, middle, top; the top one is the map you opened last */
const STACK = [{a1: [430, 398, 3], a2: [720, 446, -1.0]}, {a1: [420, 380, 6], a2: [470, 452, 1.5]}, {a1: [428, 494, -2.4], a2: [220, 446, -2.5]}];
const SLOT4 = [970, 452, 2.0], SLOT5 = [1220, 452, -2.0];
const sheets = STACK.map((s, i) => { const el = makeSheet(); el.style.zIndex = 10 + i; el._slot = s; setPose(el, s.a1, 1); return el; });
function orderedTopics(){
  const byId = {}; D.topics.forEach(t => { byId[t.id] = t; });
  const seen = new Set(), out = [];
  (D.recent || []).forEach(id => { if(byId[id] && !seen.has(id)){ seen.add(id); out.push(byId[id]); } });
  D.topics.forEach(t => { if(!seen.has(t.id)){ seen.add(t.id); out.push(t); } });
  return out;
}
let order = [];
function assignSheets(){
  order = orderedTopics();
  sheets.forEach((el, i) => { const t = order[2 - i] || null; paintSheet(el, t); el.classList.toggle('blank', !t); });
  layoutRow();
}
function sheetOf(tid){ return sheets.find(el => el._topic === tid) || null; }
function metaOf(t){ const n = D.papers.filter(p => p.topic === t.id).length, when = (D.recentTimes || {})[t.id];
  let w = ''; if(when){ const days = Math.floor((Date.now() - when) / 864e5); w = days < 1 ? ' · opened today' : days < 2 ? ' · opened yesterday' : days < 8 ? ' · last week' : ' · in ' + new Date(when).toLocaleDateString('en-GB', {month: 'long'}); }
  return n + (n === 1 ? ' paper' : ' papers') + w; }
/* the row of maps: every map as a cover on a strip you scroll left and right, like brochures on a stand */
const ROW_X0 = 220, ROW_DX = 250, ROW_Y = 446, TILT = [-2.5, 1.5, -1.0, 2.0, -1.6, 1.0, -0.6, 1.8];
const strip = $('rowStrip'), stripIn = $('rowIn');
function coverHTML(t, i){ return '<div class="mcard" data-topic="' + esc(t.id) + '" style="left:' + (ROW_X0 + i * ROW_DX - 93.33) + 'px;--r:' + TILT[i % TILT.length] + 'deg"><button class="mc-col" data-col="' + esc(t.id) + '" aria-label="Colour of ' + esc(t.name) + '" title="Colour" style="background:' + topicColor(t) + '"></button><div class="xc" role="button" tabindex="0" title="' + esc(t.name) + '" style="background-image:' + esc(svgURL(coverSVG(t))) + ',url(' + AS + 'cover-paper.webp)"></div><div class="mlabel"><b>' + esc(t.name) + '</b><span>' + esc(metaOf(t)) + '</span></div></div>'; }
function layoutRow(){
  const n = order.length;
  stripIn.innerHTML = order.map(coverHTML).join('') + '<div class="mcard new" style="left:' + (ROW_X0 + n * ROW_DX - 93.33) + 'px;--r:-2deg"><div class="xc" id="newMapCard" role="button" tabindex="0" title="New map" style="background-image:url(' + AS + 'newmap.webp)"></div><div class="mlabel"><b>New map</b><span>for another field</span></div></div>';
  stripIn.style.width = (ROW_X0 + n * ROW_DX + 93.33 + 140) + 'px';
  stripIn.querySelectorAll('.mcard[data-topic] .xc').forEach(c => { const go = () => { if(state === 'maps' && !strip._dragged) openTopic(c.parentNode.dataset.topic); }; c.addEventListener('click', go); c.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } }); });
  const nm = $('newMapCard'), goNew = () => { if(state === 'maps' && P && !strip._dragged) P.newMap(); };
  nm.addEventListener('click', goNew); nm.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); goNew(); } });
  $('mtagCount').textContent = n + (n === 1 ? ' map' : ' maps') + (n ? ' · open one' : ' · make the first');
  rowArrows();
}
function coverOf(tid){ return [...stripIn.querySelectorAll('.mcard[data-topic]')].find(c => c.dataset.topic === tid) || null; }
function indexOf(tid){ return order.findIndex(t => t.id === tid); }
function slotOf(i){ return [ROW_X0 + i * ROW_DX - strip.scrollLeft, ROW_Y, TILT[i % TILT.length]]; }
function rowArrows(){ const max = strip.scrollWidth - strip.clientWidth; $('rowPrev').classList.toggle('on', strip.scrollLeft > 4); $('rowNext').classList.toggle('on', strip.scrollLeft < max - 4); }
strip.addEventListener('scroll', rowArrows, {passive: true});
const colPick = document.createElement('div'); colPick.id = 'colPick'; colPick.className = 'colpick'; document.getElementById('ui').appendChild(colPick);
stripIn.addEventListener('click', e => { const b = e.target.closest('[data-col]'); if(!b) return; e.stopPropagation(); const r = b.getBoundingClientRect(), tid = b.dataset.col;
  colPick.innerHTML = PALETTE.map(c => '<button data-hex="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join(''); colPick.dataset.tid = tid;
  colPick.style.left = Math.min(innerWidth - 230, r.left - 10) + 'px'; colPick.style.top = (r.bottom + 8) + 'px'; colPick.classList.add('on'); });
colPick.addEventListener('click', e => { const b = e.target.closest('[data-hex]'); if(!b) return; e.stopPropagation(); colPick.classList.remove('on');
  if(P && P.setMapColor) P.setMapColor(colPick.dataset.tid, b.dataset.hex); D = load(); assignSheets(); sheets.forEach(el => { if(state === 'maps'){ el.style.opacity = '0'; el.style.pointerEvents = 'none'; } }); });
addEventListener('click', e => { if(!e.target.closest('#colPick,[data-col]')) colPick.classList.remove('on'); });
strip.addEventListener('wheel', e => { if(state !== 'maps') return; if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){ strip.scrollLeft += e.deltaY; e.preventDefault(); } }, {passive: false});
$('rowPrev').addEventListener('click', () => strip.scrollBy({left: -ROW_DX * 3, behavior: 'smooth'}));
$('rowNext').addEventListener('click', () => strip.scrollBy({left: ROW_DX * 3, behavior: 'smooth'}));
/* drag the strip with the mouse; a drag is not a click */
{ let x0 = null, s0 = 0;
  strip.addEventListener('pointerdown', e => { if(e.pointerType !== 'mouse' || state !== 'maps') return; x0 = e.clientX; s0 = strip.scrollLeft; strip._dragged = false; });
  addEventListener('pointermove', e => { if(x0 == null) return; const dx = (e.clientX - x0) / FIT.s; if(Math.abs(dx) > 5){ strip._dragged = true; strip.classList.add('dragging'); } if(strip._dragged) strip.scrollLeft = s0 - dx; });
  addEventListener('pointerup', () => { x0 = null; strip.classList.remove('dragging'); setTimeout(() => { strip._dragged = false; }, 0); }); }
/* ============ folding ============ */
function settle(el, folded){
  el.querySelectorAll('.pn,.shd,.shd2,.fc,.bk').forEach(x => x.getAnimations().forEach(a => a.cancel()));
  el.querySelector('.pn.l').style.transform = folded ? 'rotateY(180deg) translateZ(-2px)' : 'rotateY(0deg)';
  el.querySelector('.pn.r').style.transform = folded ? 'rotateY(-180deg) translateZ(-4px)' : 'rotateY(0deg)';
  el.querySelectorAll('.shd,.shd2').forEach(sd => sd.style.transform = folded ? 'translateX(0) scaleX(.3334)' : 'translateX(0) scaleX(1)');
  el.classList.toggle('folded', folded); void el.offsetWidth; }
function fold(el, d0, dur){ settle(el, false);
  const L = el.querySelector('.pn.l'), R = el.querySelector('.pn.r'), shds = el.querySelectorAll('.shd,.shd2');
  const shade = (pn, d) => { if(!reduce && !el.classList.contains('flying')) pn.querySelectorAll('.fc,.bk').forEach(f => f.animate([{'--sh': 0}, {'--sh': 1, offset: .5}, {'--sh': 0}], {duration: dur, delay: d, fill: 'none'})); };
  shade(L, d0); shade(R, d0 + dur * .55); el.classList.add('folded');
  return Promise.all([
    anim(L, [{transform: 'rotateY(0deg)'}, {transform: 'rotateY(95deg) translateZ(-2px)', offset: .5}, {transform: 'rotateY(180deg) translateZ(-2px)'}], {duration: dur, delay: d0, easing: EASE}),
    anim(R, [{transform: 'rotateY(0deg)'}, {transform: 'rotateY(-95deg) translateZ(-4px)', offset: .5}, {transform: 'rotateY(-180deg) translateZ(-4px)'}], {duration: dur, delay: d0 + dur * .55, easing: EASE}),
    ...[...shds].map(sd => anim(sd, [{transform: 'translateX(0) scaleX(1)'}, {transform: 'translateX(' + (W / 6) + 'px) scaleX(.6667)', offset: .45}, {transform: 'translateX(0) scaleX(.3334)'}], {duration: dur * 1.55, delay: d0, easing: 'linear'}))]); }
function unfold(el, d0, dur){ settle(el, true);
  const L = el.querySelector('.pn.l'), R = el.querySelector('.pn.r'), shds = el.querySelectorAll('.shd,.shd2');
  el.classList.remove('folded');
  return Promise.all([
    anim(R, [{transform: 'rotateY(-180deg) translateZ(-4px)'}, {transform: 'rotateY(-85deg) translateZ(-4px)', offset: .5}, {transform: 'rotateY(0deg)'}], {duration: dur, delay: d0, easing: EASE}),
    anim(L, [{transform: 'rotateY(180deg) translateZ(-2px)'}, {transform: 'rotateY(85deg) translateZ(-2px)', offset: .5}, {transform: 'rotateY(0deg)'}], {duration: dur, delay: d0 + dur * .5, easing: EASE}),
    ...[...shds].map(sd => anim(sd, [{transform: 'translateX(0) scaleX(.3334)'}, {transform: 'translateX(' + (W / 6) + 'px) scaleX(.6667)', offset: .5}, {transform: 'translateX(0) scaleX(1)'}], {duration: dur * 1.5, delay: d0, easing: 'linear'}))]); }

/* ============ desk → Your maps → a map, and back ============ */
async function toMaps(){
  if(busy || state !== 'desk') return; busy = true; closeMenus();
  strip.scrollLeft = 0; layoutRow();
  setState('maps', order.length ? 'Choose a map to open it · scroll for more' : 'Make your first map');
  stripIn.classList.add('landing'); sheets.forEach(el => el.classList.add('flying'));
  const moves = [];
  [2, 1, 0].forEach((si, k) => { const el = sheets[si]; el.classList.remove('lift');
    if(!el._topic){ moves.push(anim(el, [{opacity: 1}, {opacity: 0}], {duration: 360, delay: k * 60})); return; }
    const p = slotOf(k);
    moves.push(Promise.all([move(el, [p[0], p[1] - 26, p[2]], 1.0, 520, k * 90, 'cubic-bezier(.3,0,.3,1)').then(() => move(el, p, 1.0, 420, 0, 'cubic-bezier(.2,.7,.2,1)')), fold(el, 160 + k * 90, 560)])); });
  await Promise.all(moves);
  /* the strip takes over: its covers sit exactly where the sheets landed */
  stripIn.classList.remove('landing'); sheets.forEach(el => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; });
  busy = false;
}
async function toDesk(){
  if(busy || state !== 'maps') return; busy = true;
  if(strip.scrollLeft > 0){ strip.scrollTo({left: 0, behavior: 'smooth'}); await sleep(reduce ? 20 : 420); strip.scrollLeft = 0; }
  /* the first three covers become the sheets again, and fly back to the stack */
  stripIn.classList.add('landing');
  [2, 1, 0].forEach((si, k) => { const el = sheets[si]; el.getAnimations().forEach(a => a.cancel()); el.classList.add('flying'); if(!el._topic){ el.style.opacity = '0'; return; } settle(el, true); setPose(el, slotOf(k), 1); el.style.opacity = '1'; el.style.pointerEvents = ''; });
  setState('desk', HINT_DESK);
  sheets.forEach((el, k) => { el.style.zIndex = 10 + k; });
  await Promise.all(sheets.map((el, k) => el._topic ? move(el, STACK[k].a1, 1, 760, k * 70, 'cubic-bezier(.3,.1,.2,1)') : (setPose(el, STACK[k].a1, 1), settle(el, false), el.style.pointerEvents = '', anim(el, [{opacity: 0}, {opacity: 1}], {duration: 500, delay: 400}))));
  for(const el of sheets){ if(el._topic && el.classList.contains('folded')) await unfold(el, 0, 430); }
  sheets.forEach(el => el.classList.remove('flying')); stripIn.classList.remove('landing'); busy = false;
}
function coverPose(){ const s = FIT.s, cx = (innerWidth / 2 - FIT.tx) / s, cy = (innerHeight / 2 - FIT.ty) / s, m = innerWidth > 760 ? 22 : 6;
  return [[cx, cy, 0], [(innerWidth - 2 * m) / s / W, (innerHeight - 2 * m) / s / H]]; }
let current = null;   /* {el, tid, temp, from} */
function posOf(node){ const r = node.getBoundingClientRect(); return [(r.left + r.width / 2 - FIT.tx) / FIT.s, (r.top + r.height / 2 - FIT.ty) / FIT.s]; }
async function openTopic(tid){
  if(busy || state !== 'maps') return;
  const t = D.topics.find(x => x.id === tid), card = coverOf(tid); if(!t || !card) return;
  busy = true;
  const xc = card.querySelector('.xc'), [x, y] = posOf(xc), i = indexOf(tid);
  const el = makeSheet(); el.classList.add('flying'); paintSheet(el, t); settle(el, true); setPose(el, [x, y, TILT[i % TILT.length]], 1); el.style.zIndex = 60;
  await facesReady(el); xc.style.visibility = 'hidden'; current = {el, tid};
  setState('opening', '');
  await move(el, [720, 452, 0], 1.55, 620, 0, 'cubic-bezier(.3,.1,.2,1)');
  await unfold(el, 0, 640);
  const [cp, cs] = coverPose();
  await move(el, cp, cs, 720, 0, 'cubic-bezier(.4,.1,.2,1)');
  el.classList.add('flat');
  if(P) P.openMap(tid);
  setState('map', ''); xc.style.visibility = '';
  busy = false;
}
/* the app calls this when you come back from a map: the map folds up and goes back to its cover */
/* wait until a sheet's pictures are decoded, so it never shows blank for a moment */
function facesReady(el){
  const urls = []; el.querySelectorAll('.fc, .bk').forEach(f => { (getComputedStyle(f).backgroundImage.match(/url\("?([^")]+)"?\)/g) || []).forEach(u => urls.push(u.replace(/^url\("?|"?\)$/g, ''))); });
  return Promise.race([Promise.all([...new Set(urls)].map(u => { const im = new Image(); im.src = u; return (im.decode ? im.decode() : Promise.resolve()).catch(() => {}); })), sleep(700)]);
}
async function returnFromMap(tid){
  dismissWelcome(true);
  D = load(); prefs = Object.assign(prefs, D.prefs || {});
  /* the sheet that unfolded into this map is still lying open: fold that one, so nothing flickers */
  const keep = current && current.el && current.el.isConnected && current.tid === tid ? current.el : null;
  if(current && current.el && current.el.parentNode && !keep) current.el.remove(); current = null;
  assignSheets(); sheets.forEach(el => { el.getAnimations().forEach(a => a.cancel()); settle(el, true); el.style.opacity = '0'; el.style.pointerEvents = 'none'; });
  const t = D.topics.find(x => x.id === tid); if(!t){ show(); return; }
  strip.scrollLeft = 0;
  const card = coverOf(tid), i = indexOf(tid); if(!card){ show(); return; }
  if(i > 3) strip.scrollLeft = Math.max(0, ROW_X0 + i * ROW_DX - 720);
  const xc = card.querySelector('.xc'); xc.style.visibility = 'hidden';
  const [cp, cs] = coverPose(); let el = keep;
  if(el){ el.classList.remove('flat'); el.classList.add('flying'); paintSheet(el, t); setPose(el, cp, cs); }
  else{ el = makeSheet(); el.classList.add('flying'); paintSheet(el, t); settle(el, false); setPose(el, cp, cs); el.style.zIndex = 60; await facesReady(el); }
  busy = true; setState('closing', '');
  await sleep(40);
  await move(el, [720, 452, 0], 1.55, 620, 0, 'cubic-bezier(.4,.1,.2,1)');
  await fold(el, 0, 520);
  setState('maps', order.length ? 'Choose a map to open it · scroll for more' : 'Make your first map');
  const [x, y] = posOf(xc);
  await move(el, [x, y, TILT[i % TILT.length]], 1, 560, 0, 'cubic-bezier(.3,.1,.2,1)');
  xc.style.visibility = ''; el.remove(); rowArrows(); busy = false;
}
/* the app calls this to bring the desk back without a map to fold */
function show(where){
  D = load(); prefs = Object.assign(prefs, D.prefs || {}); refreshAll();
  if(current){ if(current.el && current.el.parentNode) current.el.remove(); current = null; }
  strip.scrollLeft = 0; stripIn.classList.remove('landing'); sheets.forEach(el => { el.style.pointerEvents = ''; });
  sheets.forEach((el, k) => { el.getAnimations().forEach(a => a.cancel()); settle(el, false); setPose(el, STACK[k].a1, 1); el.style.opacity = '1'; el.style.zIndex = 10 + k; });
  RB.style.opacity = '0'; RB.classList.remove('entered'); rcard.classList.remove('on'); PP.style.opacity = '0'; PP.classList.remove('entered');
  if(book.parentNode !== bookHome) bookHome.insertBefore(book, bookNext);
  [book, cover].forEach(x => { x.getAnimations().forEach(a => a.cancel()); x.style.transform = ''; x.style.visibility = ''; });
  document.body.classList.remove('dof'); stage.classList.remove('zooming'); fit();
  setState('desk', HINT_DESK); busy = false;
  if(where === 'papers'){ dismissWelcome(true); renderPapers(); setState('papers', ''); }
  if(where === 'paper' && arguments[1]){ dismissWelcome(true); renderPapers(); setState('papers', ''); if(fillPaper(arguments[1])){ PP.style.opacity = '1'; PP.style.clipPath = 'none'; setState('paper', ''); PP.classList.add('entered'); } }
}

/* ============ hover and clicks on the desk ============ */
sheets.forEach(el => {
  el.addEventListener('mouseenter', () => { if(state === 'desk'){ sheets.forEach(x => x.classList.add('lift')); document.body.classList.add('hov'); } else if(state === 'maps' && !busy) el.classList.add('lift'); });
  el.addEventListener('mouseleave', () => { sheets.forEach(x => x.classList.remove('lift')); document.body.classList.remove('hov'); });
  el.addEventListener('click', () => { if(state === 'desk') toMaps(); else if(state === 'maps' && el._topic) openTopic(el._topic); });
});
$('tagMaps').addEventListener('click', () => { if(state === 'desk') toMaps(); });
$('deskBack').addEventListener('click', toDesk);

/* ============ desk surfaces, paper, cup ============ */
let bgFront = 'A';
function setWood(v, instant){ prefs.wood = v; document.querySelectorAll('.wd').forEach(w => w.classList.toggle('on', w.dataset.wood === v));
  { const fr = document.querySelector('#leaf .lf-front'), bk = document.querySelector('#leaf .lf-back'); if(fr) fr.style.backgroundImage = 'url(' + AS + 'leaf-r-' + v + '.webp)'; if(bk) bk.style.backgroundImage = 'url(' + AS + 'leaf-l-' + v + '.webp)'; }
  const url = AS + 'bg-' + v + '.webp', img = new Image();
  img.onload = () => { const back = $(bgFront === 'A' ? 'bgB' : 'bgA'), front = $(bgFront === 'A' ? 'bgA' : 'bgB');
    back.style.backgroundImage = 'url(' + url + ')'; back.style.transition = instant ? 'none' : ''; front.style.transition = instant ? 'none' : '';
    back.style.opacity = 1; front.style.opacity = 0; bgFront = bgFront === 'A' ? 'B' : 'A'; document.body.classList.add('ready'); };
  img.onerror = () => document.body.classList.add('ready');
  img.src = url; }
function setPaper(v){ prefs.paper = v; document.querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o.dataset.paper === v));
  sheets.forEach(el => { const t = D.topics.find(x => x.id === el._topic) || null; paintSheet(el, t); }); setState(state); }
function setStart(v){ prefs.start = v; document.querySelectorAll('.st-opt').forEach(o => o.classList.toggle('on', o.dataset.start === v)); }
document.querySelectorAll('.opt').forEach(o => o.addEventListener('click', () => { setPaper(o.dataset.paper); savePrefs(); }));
document.querySelectorAll('.st-opt').forEach(o => o.addEventListener('click', () => { setStart(o.dataset.start); savePrefs(); }));
document.querySelectorAll('.wd').forEach(w => { w.querySelector('i').style.backgroundImage = 'url(' + AS + 'bg-' + w.dataset.wood + '.webp)'; w.addEventListener('click', () => { setWood(w.dataset.wood); savePrefs(); }); });
const panel = $('panel');
document.querySelectorAll('[data-look]').forEach(g => g.addEventListener('click', e => { e.stopPropagation(); panel.classList.toggle('on'); }));
$('panelX').addEventListener('click', () => panel.classList.remove('on'));
$('moreSettings').addEventListener('click', () => { panel.classList.remove('on'); if(P) P.openSettings(); });
const CUPS = {heart: AS + 'cup-heart.webp', tea: AS + 'cup-tea.webp'};
const cupImg = $('cupLiquid'), cupMenu = $('cupMenu');
function setCup(key){ prefs.cup = key;
  document.querySelectorAll('#cupKinds button').forEach(b => b.classList.toggle('on', (b.dataset.cup || '') === key));
  if(!CUPS[key]){ cupImg.classList.remove('on'); return; }
  cupImg.classList.remove('on'); setTimeout(() => { cupImg.src = CUPS[key]; cupImg.classList.add('on'); }, 10); }
document.querySelectorAll('#cupKinds button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); setCup(b.dataset.cup); savePrefs(); }));
$('cupHit').addEventListener('click', e => { e.stopPropagation(); if(state === 'desk') cupMenu.classList.toggle('on'); });
function closeMenus(){ cupMenu.classList.remove('on'); panel.classList.remove('on'); }
stage.addEventListener('click', e => { if(!e.target.closest('#cupMenu') && !e.target.closest('#cupHit')) cupMenu.classList.remove('on'); });

/* ============ Papers: every paper on your maps, as A4 pages ============ */
let pFilter = {map: '', sub: '', st: '', q: ''}, pAll = false, pOpen = new Set(); const P_FIRST = 240;
/* a map's topics as a tree: children by parent, and every topic's own subtree */
function topicTree(t){ const rows = (t.rows || []).filter(r => !r.own), kids = {}, roots = [];
  rows.forEach(r => { const par = r.parent && rows.some(x => x.id === r.parent) ? r.parent : null; if(par) (kids[par] = kids[par] || []).push(r); else roots.push(r); });
  const own = (t.rows || []).find(r => r.own); return {roots, kids, own: own ? own.id : null}; }
function subtreeOf(t, id){ const {kids} = topicTree(t), out = new Set([id]); const walk = x => (kids[x] || []).forEach(k => { out.add(k.id); walk(k.id); }); walk(id); return out; }
function rowPath(t, id){ const rows = t.rows || [], out = []; let r = rows.find(x => x.id === id), guard = 0; while(r && !r.own && guard++ < 20){ out.unshift(r.name); r = r.parent ? rows.find(x => x.id === r.parent) : null; } return out; }
function renderPapers(){
  const ps = D.papers.slice();
  const tName = {}; D.topics.forEach(t => { tName[t.id] = t.name; });
  $('pbCount').textContent = ps.length + (ps.length === 1 ? ' paper' : ' papers') + ' · ' + ps.filter(p => p.st === 'read').length + ' read · ' + ps.filter(p => p.st === 'want').length + ' to read';
    { let h = '<button class="tp' + (pFilter.map ? '' : ' on') + '" data-map=""><span>All papers</span><em>' + ps.length + '</em></button>';
    D.topics.forEach(t => { const tr = topicTree(t), mine = ps.filter(p => p.topic === t.id), has = tr.roots.length > 0, open = pOpen.has(t.id) || pFilter.map === t.id;
      h += '<div class="tp-row"><button class="tp-tog' + (has ? '' : ' none') + (open ? ' open' : '') + '" data-tog="' + esc(t.id) + '" aria-label="Show its topics"></button><button class="tp' + (pFilter.map === t.id && !pFilter.sub ? ' on' : '') + '" data-map="' + esc(t.id) + '"><span>' + esc(t.name) + '</span><em>' + mine.length + '</em></button></div>';
      if(!open) return;
      const row = (r, depth) => { const kids = tr.kids[r.id] || [], o = pOpen.has(r.id) || (pFilter.sub && subtreeOf(t, r.id).has(pFilter.sub) && pFilter.sub !== r.id), n = mine.filter(p => subtreeOf(t, r.id).has(p.sub)).length;
        h += '<div class="tp-row" style="--d:' + depth + '"><button class="tp-tog' + (kids.length ? '' : ' none') + (o ? ' open' : '') + '" data-tog="' + esc(r.id) + '"></button><button class="tp sub' + (pFilter.sub === r.id ? ' on' : '') + '" data-map="' + esc(t.id) + '" data-sub="' + esc(r.id) + '"><span>' + esc(r.name) + '</span><em>' + n + '</em></button></div>';
        if(o) kids.forEach(k => row(k, depth + 1)); };
      tr.roots.forEach(r => row(r, 1)); });
    $('pbMaps').innerHTML = h; }
  $('pbSt').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.st === pFilter.st));
  const q = pFilter.q.trim().toLowerCase();
  const subT = pFilter.map && pFilter.sub ? subtreeOf(D.topics.find(t => t.id === pFilter.map) || {rows: []}, pFilter.sub) : null;
  const list = ps.filter(p => (!pFilter.map || p.topic === pFilter.map) && (!subT || subT.has(p.sub)) && (!pFilter.st || (pFilter.st === 'none' ? !p.st : p.st === pFilter.st)) && (!q || (p.t + ' ' + p.au + ' ' + p.y + ' ' + (p.v || '')).toLowerCase().includes(q)))
    .sort((a, b) => (tName[a.topic] || '').localeCompare(tName[b.topic] || '') || (a.y || 0) - (b.y || 0));
  const shown = pAll ? list : list.slice(0, P_FIRST);
  $('pbGrid').innerHTML = list.length ? shown.map((p, i) => '<figure class="pg" data-id="' + esc(p.id) + '" tabindex="0" role="button" style="--i:' + Math.min(i, 40) + '"><div class="sheet"><p class="pj">' + esc((p.v || tName[p.topic] || '').slice(0, 40)) + (p.y ? ' · ' + p.y : '') + '</p><h4>' + esc(String(p.t || 'Untitled').slice(0, 90)) + '</h4><p class="pa">' + esc(String(p.au || '').slice(0, 60)) + '</p><i class="ln"></i>' + (p.st ? '<span class="stamp ' + p.st + '">' + (p.st === 'read' ? 'READ' : 'TO READ') + '</span>' : '') + (p.book ? '<span class="bk-mark">BOOK</span>' : '') + '</div><figcaption><b>' + esc(String(p.t || 'Untitled').slice(0, 70)) + '</b><span>' + esc([tName[p.topic] || ''].concat(rowPath(D.topics.find(t => t.id === p.topic) || {rows: []}, p.sub)).join(' / ')) + '</span></figcaption></figure>').join('')
    : '<p class="pb-empty">' + (ps.length ? 'Nothing matches.' : 'No papers yet. Open a map and add the first one with +.') + '</p>';
  if(list.length > shown.length) $('pbGrid').insertAdjacentHTML('beforeend', '<button class="rc-btn pb-more" id="pbMore">Show all ' + list.length + ' papers</button>');
  const figs = {}; $('pbGrid').querySelectorAll('.pg').forEach(g => { figs[g.dataset.id] = g; });
  shown.forEach(p => { if(!p.pdf || !figs[p.id]) return; const g = figs[p.id]; g.classList.add('haspdf'); g.title = 'Has its PDF';
    if(P && P.pdfThumb) P.pdfThumb(p.id).then(u => { if(!u || !g.isConnected) return; const sh = g.querySelector('.sheet'); sh.classList.add('pdf1'); sh.style.backgroundImage = 'url(' + u + ')'; }).catch(() => {}); });
}
$('pboard').addEventListener('click', e => {
  if(e.target.closest('#pbMore')){ pAll = true; renderPapers(); return; }
  const tg = e.target.closest('[data-tog]'); if(tg){ const k = tg.dataset.tog; if(pOpen.has(k)) pOpen.delete(k); else pOpen.add(k); renderPapers(); return; }
  const m = e.target.closest('[data-map]'); if(m){ pFilter.map = m.dataset.map; pFilter.sub = m.dataset.sub || ''; if(pFilter.map) pOpen.add(pFilter.map); pAll = false; renderPapers(); return; }
  const s = e.target.closest('#pbSt button'); if(s){ pFilter.st = pFilter.st === s.dataset.st ? '' : s.dataset.st; renderPapers(); return; }
  const g = e.target.closest('.pg'); if(g) openPaperPage(g.dataset.id, g.querySelector('.sheet'));
});
$('pboard').addEventListener('keydown', e => { const g = e.target.closest && e.target.closest('.pg'); if(g && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); openPaperPage(g.dataset.id, g.querySelector('.sheet')); } });
$('pbQ').addEventListener('input', e => { pFilter.q = e.target.value; pAll = false; renderPapers(); });
async function toPapers(){ if(busy || state !== 'desk') return; busy = true; closeMenus(); renderPapers(); setState('papers', ''); await sleep(820); busy = false; }
async function fromPapers(){ if(busy || state !== 'papers') return; busy = true; panel.classList.remove('on'); setState('desk', HINT_DESK); await sleep(700); busy = false; }
$('papersLayer').addEventListener('click', toPapers); $('ptag').addEventListener('click', toPapers);
['papersLayer', 'ptag'].forEach(id => { $(id).addEventListener('mouseenter', () => { if(state === 'desk') document.body.classList.add('plift'); }); $(id).addEventListener('mouseleave', () => document.body.classList.remove('plift')); });
$('ptag').addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toPapers(); } });
$('tagMaps').addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); if(state === 'desk') toMaps(); } });
$('papersBack').addEventListener('click', fromPapers);
$('newPaper').addEventListener('click', () => { if(P) P.newPaper(pFilter.map || (order[0] && order[0].id)); });


/* ============ a paper's own page: it opens out of its page in Papers ============ */
const PP = $('ppage'); let ppId = null, ppFrom = null, ppStack = [];
function md(s){
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
  let out = '', list = false, para = [];
  const flush = () => { if(para.length){ out += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } }, endList = () => { if(list){ out += '</ul>'; list = false; } };
  String(s || '').split('\n').forEach(l => { const h = l.match(/^\s*#{1,6}\s+(.*)/), li = l.match(/^\s*[-*]\s+(.*)/);
    if(h){ flush(); endList(); out += '<h4>' + inline(h[1]) + '</h4>'; }
    else if(li){ flush(); if(!list){ out += '<ul>'; list = true; } out += '<li>' + inline(li[1]) + '</li>'; }
    else if(!l.trim()){ flush(); endList(); }
    else { endList(); para.push(l); } });
  flush(); endList(); return out; }
function fillPaper(id){ const p = P && P.paper(id); if(!p) return false; ppId = id;
  $('ppK').textContent = [p.v, p.y].filter(Boolean).join(' · ');
  $('ppT').textContent = p.t || 'Untitled'; $('ppA').textContent = p.au || '';
  $('ppTags').innerHTML = (p.allTags || []).map(t => '<button data-tag="' + esc(t.id) + '" class="' + ((p.tagIds || []).includes(t.id) ? 'on' : '') + '"><i style="background:' + esc(t.color || '#8E8273') + '"></i>' + esc(t.name) + '</button>').join('') + '<span class="pp-newtag"><input id="ppNewTag" placeholder="+ new tag" maxlength="40"></span>' + (p.book ? '<span class="pp-book">Book</span>' : '');
  document.querySelectorAll('#ppPri button').forEach(x => x.classList.toggle('on', +x.dataset.pri === +p.p));
  $('ppPdf').hidden = !p.pdf; $('ppPdfImg').removeAttribute('src');
  if(p.pdf && P && P.pdfThumb) P.pdfThumb(id).then(u => { if(u && ppId === id) $('ppPdfImg').src = u; }).catch(() => {});
  document.querySelectorAll('#ppSt button').forEach(b => b.classList.toggle('on', b.dataset.st === (p.st || '')));
  $('ppNotes').innerHTML = p.n ? md(p.n) : '<p class="empty">No notes yet. Notes &amp; PDF opens them beside the paper.</p>';
  $('ppLink').hidden = !p.url; $('ppLink').dataset.url = p.url || '';
  $('ppWhere').textContent = p.where || '';
  const sec = (title, arr) => arr && arr.length ? '<div class="pp-ln"><h4>' + title + '</h4>' + arr.map(x => '<button data-pid="' + esc(x.id) + '"><b>' + esc(x.t) + '</b><span>' + esc([x.au, x.y].filter(Boolean).join(' · ')) + '</span></button>').join('') + '</div>' : '';
  $('ppLines').innerHTML = sec('Builds on', p.buildsOn) + sec('Built on by', p.builtOnBy) + sec('Responds to', p.respondsTo) + sec('Challenged by', p.challengedBy) + sec('Related to', p.related) +
    (p.mentions && p.mentions.length ? '<div class="pp-ln"><h4>Mentions</h4><p class="pp-where">' + esc(p.mentions.join(', ')) + '</p></div>' : '');
  PP.scrollTop = 0; return true; }
const insetOf = r => r.top + 'px ' + (innerWidth - r.right) + 'px ' + (innerHeight - r.bottom) + 'px ' + r.left + 'px';
async function openPaperPage(id, fromEl){
  if(busy || state !== 'papers' || !fillPaper(id)) return; busy = true; ppFrom = fromEl || null; ppStack = [];
  const ins = insetOf(fromEl ? fromEl.getBoundingClientRect() : {top: innerHeight / 2 - 110, left: innerWidth / 2 - 78, right: innerWidth / 2 + 78, bottom: innerHeight / 2 + 110});
  PP.style.opacity = '1'; PP.style.clipPath = 'inset(' + ins + ' round 3px)'; setState('paper', '');
  PP.classList.remove('entered'); void PP.offsetWidth; PP.classList.add('entered');
  if(!reduce) await PP.animate([{clipPath: 'inset(' + ins + ' round 3px)'}, {clipPath: 'inset(0px 0px 0px 0px round 0px)'}], {duration: 600, easing: 'cubic-bezier(.25,.8,.2,1)', fill: 'forwards'}).finished.catch(() => {});
  PP.getAnimations().forEach(a => a.cancel()); PP.style.clipPath = 'none'; busy = false; }
async function closePaperPage(){
  if(busy || state !== 'paper') return;
  if(ppStack.length){ const prev = ppStack.pop(); PP.classList.remove('entered'); void PP.offsetWidth; fillPaper(prev); PP.classList.add('entered'); return; }
  busy = true; D = load(); renderPapers();
  const el = [...document.querySelectorAll('#pbGrid .pg')].find(g => g.dataset.id === ppId);
  setState('papers', '');
  if(el && !reduce){ el.scrollIntoView({block: 'nearest'}); const ins = insetOf(el.querySelector('.sheet').getBoundingClientRect());
    await PP.animate([{clipPath: 'inset(0px 0px 0px 0px round 0px)'}, {clipPath: 'inset(' + ins + ' round 3px)'}], {duration: 420, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards'}).finished.catch(() => {}); }
  PP.style.opacity = '0'; PP.getAnimations().forEach(a => a.cancel()); PP.style.clipPath = ''; PP.classList.remove('entered'); busy = false; }
PP.addEventListener('click', e => { const b = e.target.closest('[data-pid]'); if(!b) return; ppStack.push(ppId); PP.classList.remove('entered'); void PP.offsetWidth; fillPaper(b.dataset.pid); PP.classList.add('entered'); });
$('ppBack').addEventListener('click', closePaperPage);
$('ppPri').addEventListener('click', e => { const x = e.target.closest('[data-pri]'); if(!x || !P || !ppId) return; P.setPriority(ppId, +x.dataset.pri); D = load(); fillPaper(ppId); });
$('ppTags').addEventListener('click', e => { const x = e.target.closest('[data-tag]'); if(!x || !P || !ppId) return; P.toggleTag(ppId, x.dataset.tag); D = load(); fillPaper(ppId); });
$('ppTags').addEventListener('keydown', e => { if(e.key !== 'Enter' || e.target.id !== 'ppNewTag') return; const v = e.target.value.trim(); if(!v || !P || !ppId) return; P.addTag(ppId, v); D = load(); fillPaper(ppId); setTimeout(() => { const i = $('ppNewTag'); if(i) i.focus(); }, 0); });
$('ppEditDet').addEventListener('click', () => { if(P && ppId) P.editPaper(ppId); });
$('ppPdf').addEventListener('click', () => { if(P && ppId) P.openNotes(ppId); });
document.querySelectorAll('#ppSt button').forEach(b => b.addEventListener('click', () => { if(!P || !ppId) return; P.setStatus(ppId, b.dataset.st); D = load(); fillPaper(ppId); }));
$('ppOnMap').addEventListener('click', () => { if(P && ppId) P.openPaper(ppId, 'paper'); });
$('ppEdit').addEventListener('click', () => { if(P && ppId) P.openNotes(ppId); });
$('ppLink').addEventListener('click', e => { const u = e.currentTarget.dataset.url; if(u && P) P.openLink(u); });

/* ============ Readings: its own list, its own categories ============ */
const RB = $('rboard'), rcard = $('rcard');
const book = $('book'), bookHome = book.parentNode, bookNext = book.nextSibling, cover = book.querySelector('.bcover');
let R = (D.readings || []).slice(), CATS = (D.readingCats || []).slice(), rFilter = 'st:all', rBook = null, rEditing = false;
const BOOKC = [['#2F4A3A', '#D6B670'], ['#6B2A2A', '#E2C58A'], ['#24344F', '#D6B670'], ['#E6DCC6', '#3A2E24'], ['#6A4026', '#E2C58A'], ['#2D5653', '#D9C08A'], ['#A8802F', '#2B2118'], ['#4A5560', '#E0CFA4'], ['#4E3448', '#D9BE84']];
function hashOf(s){ let h = 0; for(const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function clothOf(b){ return b.cover && b.cover.cloth ? [b.cover.cloth, b.cover.ink] : BOOKC[hashOf(b.title + b.id) % BOOKC.length]; }
function rSave(){ if(!P) return; try{ P.saveReadings(R, CATS); }catch(e){} }
function rid(){ return 'r-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function lastName(a){ const p = String(a || '').trim().split(/\s+/); return p[p.length - 1] || ''; }
function shortAuthors(b){ const a = b.authors || []; return a.length > 1 ? lastName(a[0]) + ' & ' + lastName(a[1]) : lastName(a[0]); }
function metaLine(b){ return b.status === 'reading' ? 'Reading' + (b.progress ? ' · about ' + Math.round(b.progress * 100) + '%' : '') : b.status === 'want' ? 'On the list' : b.finished && /^\d{4}-\d{2}$/.test(b.finished) ? 'Finished ' + new Date(b.finished + '-15T12:00:00').toLocaleDateString('en-GB', {month: 'short', year: 'numeric'}) : 'Read'; }
function allCats(){ const set = new Set(CATS); R.forEach(b => (b.categories || []).forEach(c => set.add(c))); return [...set]; }
function rbookHTML(b, i){ const [c, tc] = clothOf(b);
  return '<figure class="rbk" data-id="' + esc(b.id) + '" style="--i:' + Math.min(i, 30) + '" tabindex="0" role="button"><div class="rcov" style="--c:' + c + ';--t:' + tc + '"><i class="rsp"></i><b>' + esc(b.title) + '</b><span>' + esc(shortAuthors(b)) + '</span></div><figcaption><b>' + esc(b.title) + '</b><span>' + esc((b.authors || [])[0] || '') + ((b.authors || []).length > 1 ? ' et al.' : '') + (b.year ? ' · ' + b.year : '') + '</span><em>' + esc(metaLine(b)) + '</em>' + (b.status === 'reading' && b.progress ? '<div class="rbar"><i style="width:' + Math.round(b.progress * 100) + '%"></i></div>' : '') + '</figcaption></figure>'; }
function renderReadings(){
  const [kind, val] = rFilter.split(/:(.+)/);
  const ok = b => kind === 'st' ? (val === 'all' || b.status === val) : (b.categories || []).includes(val);
  const read = R.filter(b => b.status === 'read'), years = {};
  read.forEach(b => { const y = b.finished ? b.finished.slice(0, 4) : 'Earlier'; (years[y] = years[y] || []).push(b); });
  const secs = [['Reading now', R.filter(b => b.status === 'reading')]].concat(Object.keys(years).sort((a, b) => b.localeCompare(a)).map(y => [y === 'Earlier' ? 'Read earlier' : 'Read in ' + y, years[y].sort((a, b) => String(b.finished || '').localeCompare(String(a.finished || '')))])).concat([['Want to read', R.filter(b => b.status === 'want')]]);
  let i = 0;
  const html = secs.map(([name, items]) => { const vis = items.filter(ok); if(!vis.length) return ''; return '<section class="rsec"><h3>' + esc(name) + ' <em>' + vis.length + '</em></h3><div class="rb-row">' + vis.map(b => rbookHTML(b, i++)).join('') + '</div></section>'; }).join('');
  $('rSecs').innerHTML = html || '<p class="pb-empty">' + (R.length ? 'No books here.' : 'Your Readings is empty. Add the first book you have read with “Add a book”.') + '</p>';
  $('rCount').textContent = R.length + (R.length === 1 ? ' book' : ' books') + ' · ' + read.length + ' read · ' + R.filter(b => b.status === 'reading').length + ' reading · ' + R.filter(b => b.status === 'want').length + ' to read';
  const n = s => R.filter(b => s === 'all' || b.status === s).length;
  $('rStatus').innerHTML = [['all', 'All books'], ['reading', 'Reading now'], ['read', 'Read'], ['want', 'Want to read']].map(([k, l]) => '<button class="tp' + (rFilter === 'st:' + k ? ' on' : '') + '" data-filter="st:' + k + '"><span>' + l + '</span><em>' + n(k) + '</em></button>').join('');
  $('rcats').innerHTML = allCats().map(c => '<button class="tp' + (rFilter === 'cat:' + c ? ' on' : '') + '" data-filter="cat:' + esc(c) + '"><span>' + esc(c) + '</span><em>' + R.filter(b => (b.categories || []).includes(c)).length + '</em></button>').join('');
  $('rFilt').textContent = kind === 'cat' ? 'Books in “' + val + '”' : '';
}
RB.addEventListener('click', e => {
  const t = e.target.closest('.tp[data-filter]'); if(t){ rFilter = t.dataset.filter; renderReadings(); return; }
  const f = e.target.closest('.rbk'); if(f){ openRCard(R.find(b => b.id === f.dataset.id)); return; }
  if(!e.target.closest('.rc-map')) $('rcMaps').classList.remove('on');
});
$('rNewCat').addEventListener('click', () => { const n = (prompt('A new category for your Readings') || '').trim(); if(!n) return; if(!CATS.includes(n)) CATS.push(n); rSave(); renderReadings(); });
$('rAdd').addEventListener('click', () => openRCard(null));
function fieldVal(id){ return $(id).value.trim(); }
function monthOf(v){ if(!v) return null; if(/^\d{4}-\d{2}$/.test(v)) return v; const d = new Date(v); return isNaN(d) ? null : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function openRCard(b){
  rBook = b; rEditing = !b;
  const d = b || {id: '', title: '', authors: [], year: '', status: 'read', finished: new Date().toISOString().slice(0, 7), categories: [], notes: ''};
  const [c, tc] = clothOf(d.title ? d : {title: 'x', id: 'x'});
  $('rcCov').style.setProperty('--c', c); $('rcCov').style.setProperty('--t', tc); $('rcCovT').textContent = d.title || 'New book';
  $('rcView').hidden = rEditing; $('rcEdit').hidden = !rEditing;
  $('rcK').textContent = (d.year ? d.year + ' · ' : '') + (b ? metaLine(b) : 'A new book');
  $('rcT').textContent = d.title || 'A new book'; $('rcA').textContent = (d.authors || []).join(', ');
  $('rfT').value = d.title || ''; $('rfA').value = (d.authors || []).join(', '); $('rfY').value = d.year || ''; $('rfF').value = d.finished || ''; $('rfP').value = d.progress ? Math.round(d.progress * 100) : '';
  document.querySelectorAll('#rcSt button').forEach(x => x.classList.toggle('on', x.dataset.st === (d.status || 'read')));
  renderCardCats(d);
  $('rcNotes').textContent = d.notes || '';
  const onm = b ? (b.onMaps || []).filter(o => D.papers.some(p => p.id === o.paper)) : [];
  $('rcOn').innerHTML = onm.length ? 'Also on ' + onm.map(o => '<b>' + esc((D.topics.find(t => t.id === o.map) || {}).name || 'a map') + '</b>').join(', ') + ', as a book you can link like any paper.' : '';
  $('rcMaps').innerHTML = '<p>Add it to a map as a book; it stays here too.</p>' + (D.topics.length ? D.topics.map(t => '<button data-map="' + esc(t.id) + '">' + esc(t.name) + '</button>').join('') : '<p>Make a map first.</p>');
  $('rcMaps').classList.remove('on'); $('rcPut').disabled = !b; $('rcDel').hidden = !b; editMode(rEditing);
  rcard.classList.add('on'); if(rEditing) setTimeout(() => $('rfT').focus(), 60);
}
function editMode(on){ $('rcSave').hidden = !on; $('rcCancel').hidden = !on; $('rcView').hidden = on; $('rcEdit').hidden = !on; $('rfFrow').hidden = !on || (document.querySelector('#rcSt button.on') || {dataset: {}}).dataset.st !== 'read'; $('rfProw').hidden = !on || (document.querySelector('#rcSt button.on') || {dataset: {}}).dataset.st !== 'reading'; }
function renderCardCats(d){ const box = $('rcCats'); box.innerHTML = '';
  (d.categories || []).forEach(c => { const sp = document.createElement('button'); sp.className = 'chip'; sp.textContent = c + ' ×'; sp.title = 'Remove'; sp.addEventListener('click', () => { d.categories = d.categories.filter(x => x !== c); if(rBook){ rBook.categories = d.categories; rSave(); renderReadings(); } renderCardCats(d); }); box.appendChild(sp); });
  const add = document.createElement('button'); add.className = 'add'; add.textContent = '+ Category';
  add.addEventListener('click', () => { const opts = allCats().filter(c => !(d.categories || []).includes(c)); const n = (prompt('Add a category' + (opts.length ? ' (yours: ' + opts.join(', ') + ')' : '')) || '').trim(); if(!n) return;
    d.categories = (d.categories || []).concat([n]); if(!CATS.includes(n)) CATS.push(n); if(rBook){ rBook.categories = d.categories; rSave(); renderReadings(); } renderCardCats(d); });
  box.appendChild(add); rcard._draft = d; }
$('rcardX').addEventListener('click', () => rcard.classList.remove('on'));
$('rcEditBtn').addEventListener('click', () => { if(!rBook) return; rEditing = true; editMode(true); $('rfT').focus(); });
$('rcSave').addEventListener('click', () => {
  const t = fieldVal('rfT'); if(!t){ $('rfT').focus(); toast('A book needs a title.'); return; }
  const d = rcard._draft || {};
  const st = (document.querySelector('#rcSt button.on') || {}).dataset ? document.querySelector('#rcSt button.on').dataset.st : 'read';
  const y = parseInt(fieldVal('rfY'), 10), pr = parseFloat(fieldVal('rfP'));
  const b = rBook || {id: rid(), onMaps: []};
  Object.assign(b, {title: t, authors: fieldVal('rfA').split(/\s*[;,]\s*|\s+&\s+|\s+and\s+/).map(x => x.trim()).filter(Boolean), year: isFinite(y) ? y : null, status: st, finished: st === 'read' ? monthOf(fieldVal('rfF')) : null, progress: st === 'reading' && isFinite(pr) ? Math.max(0, Math.min(1, pr / 100)) : null, categories: d.categories || [], notes: $('rcNotes').innerText || '', edited: new Date().toISOString()});
  if(!rBook) R.push(b);
  rSave(); renderReadings(); openRCard(b); toast(rBook ? 'Saved.' : 'Added to your Readings.');
});
$('rcCancel').addEventListener('click', () => { if(rBook) openRCard(rBook); else rcard.classList.remove('on'); });
$('rcDel').addEventListener('click', () => { if(!rBook) return; if(!confirm('Remove “' + rBook.title + '” from your Readings? A copy you put on a map stays there.')) return; R = R.filter(b => b !== rBook); rSave(); renderReadings(); rcard.classList.remove('on'); });
let notesT = null;
$('rcNotes').addEventListener('input', e => { if(!rBook || rEditing) return; rBook.notes = e.target.innerText; rBook.edited = new Date().toISOString(); clearTimeout(notesT); notesT = setTimeout(rSave, 600); });
document.querySelectorAll('#rcSt button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#rcSt button').forEach(x => x.classList.toggle('on', x === b));
  if(rEditing){ $('rfFrow').hidden = b.dataset.st !== 'read'; $('rfProw').hidden = b.dataset.st !== 'reading'; }
  if(rBook && !rEditing){ rBook.status = b.dataset.st; if(b.dataset.st === 'read' && !rBook.finished) rBook.finished = new Date().toISOString().slice(0, 7); rBook.edited = new Date().toISOString(); rSave(); renderReadings(); $('rcK').textContent = (rBook.year ? rBook.year + ' · ' : '') + metaLine(rBook); } }));
$('rcPut').addEventListener('click', e => { e.stopPropagation(); $('rcMaps').classList.toggle('on'); });
$('rcMaps').addEventListener('click', e => { const b = e.target.closest('button[data-map]'); if(!b || !rBook || !P) return; e.stopPropagation();
  if((rBook.onMaps || []).some(o => o.map === b.dataset.map && D.papers.some(p => p.id === o.paper))){ $('rcMaps').classList.remove('on'); toast('It is already on ' + b.textContent + '.'); return; }
  const id = P.addBookToMap(rBook, b.dataset.map); if(!id) return;
  rBook.onMaps = (rBook.onMaps || []).concat([{map: b.dataset.map, paper: id}]); rBook.edited = new Date().toISOString(); rSave(); D = load();
  $('rcMaps').classList.remove('on'); openRCard(rBook); toast('Added to ' + b.textContent + ' as a book. It stays in your Readings too.'); });
/* the book opens where it lies, and its title page opens out into Readings */
async function openBook(){ if(busy || state !== 'desk') return; busy = true; closeMenus(); rcard.classList.remove('on');
  R = (D.readings || []).slice(); CATS = (D.readingCats || []).slice(); renderReadings();
  setState('bookopen', ''); $('fly').appendChild(book); book.classList.add('lifted'); document.body.classList.add('dof');
  await Promise.all([anim(cover, [{transform: 'rotateY(-26deg)'}, {transform: 'rotateY(-178deg) translateZ(0px)'}], {duration: 620, easing: 'cubic-bezier(.3,.1,.2,1)'}),
    anim(book, [{transform: 'rotate(7deg)'}, {transform: 'translate(-40px,-30px) rotate(0deg) scale(1.08)'}], {duration: 620, easing: 'cubic-bezier(.3,.1,.2,1)'})]);
  await sleep(60);
  const r = book.querySelector('.bpages').getBoundingClientRect(), ins = r.top + 'px ' + (innerWidth - r.right) + 'px ' + (innerHeight - r.bottom) + 'px ' + r.left + 'px';
  RB.scrollTop = 0; RB.style.opacity = '1'; RB.style.clipPath = 'inset(' + ins + ' round 3px)'; setState('books', ''); RB.classList.add('entered');
  if(!reduce) await RB.animate([{clipPath: 'inset(' + ins + ' round 3px)'}, {clipPath: 'inset(0px 0px 0px 0px round 0px)'}], {duration: 620, easing: 'cubic-bezier(.25,.8,.2,1)', fill: 'forwards'}).finished.catch(() => {});
  RB.getAnimations().forEach(x => x.cancel()); RB.style.clipPath = 'none'; book.style.visibility = 'hidden'; busy = false; }
async function closeBook(){ if(busy || state !== 'books') return; busy = true; panel.classList.remove('on'); rcard.classList.remove('on'); book.style.visibility = '';
  const r = book.querySelector('.bpages').getBoundingClientRect(), ins = r.top + 'px ' + (innerWidth - r.right) + 'px ' + (innerHeight - r.bottom) + 'px ' + r.left + 'px';
  setState('bookopen', '');
  if(!reduce) await RB.animate([{clipPath: 'inset(0px 0px 0px 0px round 0px)'}, {clipPath: 'inset(' + ins + ' round 3px)'}], {duration: 420, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards'}).finished.catch(() => {});
  RB.style.opacity = '0'; RB.getAnimations().forEach(x => x.cancel()); RB.style.clipPath = ''; RB.classList.remove('entered');
  document.body.classList.remove('dof'); book.classList.remove('lifted');
  await Promise.all([anim(cover, [{transform: cover.style.transform || 'rotateY(-178deg)'}, {transform: 'rotateY(0deg)'}], {duration: 480, easing: 'cubic-bezier(.4,0,.2,1)'}), anim(book, [{transform: book.style.transform || 'none'}, {transform: 'rotate(7deg)'}], {duration: 560, easing: 'cubic-bezier(.4,0,.2,1)'})]);
  bookHome.insertBefore(book, bookNext); [book, cover].forEach(x => { x.style.transform = ''; });
  setState('desk', HINT_DESK); await sleep(200); busy = false; }
book.addEventListener('click', openBook);
book.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openBook(); } });
$('booksBack').addEventListener('click', closeBook);

/* ============ the notebook: a research log of up to sixty pages ============ */
const memo = $('memo'), memoText = $('memoText');
const NB_MAX = 60;
const FONTS = {ink: ["'PMap Ink'", '9.6px', '46px', 'Handwriting'], times: ["'Times New Roman', Times", '8.9px', '47.2px', 'Times New Roman'], georgia: ['Georgia', '8.4px', '47.4px', 'Georgia'], helv: ["'Helvetica Neue', Helvetica, Arial, sans-serif", '7.9px', '47.6px', 'Helvetica'], courier: ["'Courier New', Courier, monospace", '8.1px', '47.4px', 'Courier']};
let NBS = [], NB = null;
function today(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function loadNotebooks(){ NBS = (D.notebooks || []).filter(n => n && Array.isArray(n.pages)).map(n => JSON.parse(JSON.stringify(n)));
  if(!NBS.length) NBS = [{id: 'nb-' + Date.now().toString(36), font: 'ink', cur: 0, pages: [{text: '', date: null, edited: null}]}];
  NB = NBS[NBS.length - 1]; NB.cur = Math.max(0, Math.min(NB.pages.length - 1, NB.cur || 0)); }
loadNotebooks();
let nbT = null;
function nbSave(now){ clearTimeout(nbT); const go = () => { if(P) try{ P.saveNotebooks(NBS); }catch(e){} }; if(now) go(); else nbT = setTimeout(go, 600); }
const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'short'});
function nbFont(){ const f = FONTS[NB.font] || FONTS.ink; memo.style.setProperty('--mf', f[0]); memo.style.setProperty('--ms', f[1]); memo.style.setProperty('--mt', f[2]);
  $('fontName').textContent = f[3]; document.querySelectorAll('#fontMenu button[data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === NB.font)); renderNbList(); }
function nbSpan(n){ const ds = n.pages.map(p => p.date).filter(Boolean).sort(); if(!ds.length) return 'empty'; const f = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {month: 'short', year: 'numeric'}); return f(ds[0]) === f(ds[ds.length - 1]) ? f(ds[0]) : f(ds[0]) + ' – ' + f(ds[ds.length - 1]); }
function renderNbList(){ const cur = NBS[NBS.length - 1], past = NBS.slice(0, -1);
  $('pastBooks').hidden = true; $('pastName').textContent = NB === cur ? 'Past books' : 'Notebook ' + (NBS.indexOf(NB) + 1);
  $('pastMenu').innerHTML = '<p>PAST BOOKS</p>' + (NB !== cur ? '<button data-nb="' + (NBS.length - 1) + '" class="back">Back to your current notebook</button>' : '') + past.map((n, i) => '<button data-nb="' + i + '"' + (n === NB ? ' class="on"' : '') + '>Notebook ' + (i + 1) + '<em>' + (k => k + (k === 1 ? ' page' : ' pages'))(n.pages.filter(p => p.text && p.text.trim()).length) + ' · ' + nbSpan(n) + '</em></button>').join('');
  const full = NB === cur && NB.cur >= NB_MAX - 1; $('memoNew').hidden = !full; }
function memoShow(){ const pg = NB.pages[NB.cur] || {text: '', date: null};
  memoText.textContent = pg.text || ''; $('memoDate').textContent = fmtDate(pg.date || today());
  $('memoPage').textContent = (NB.cur + 1) + ' / ' + NB_MAX + (NB.cur + 1 === NB_MAX ? ' · full' : '');
  $('memoPrev').disabled = NB.cur === 0; $('memoNext').disabled = NB.cur >= NB_MAX - 1; renderNbList(); }
/* turning a page, as paper bends: the right page's bottom corner is drawn up and over to the left. The fold is the line
   halfway between where the corner was and where it is now; what lies beyond it is the page's back, folded over. */
const CW = 180, CH = 290, CM = 44, CURL = {w: null, front: null, back: null};
let turning = false;
function curlImgs(){ const w = prefs.wood || 'mahogany'; if(CURL.w === w && CURL.front) return Promise.resolve(); CURL.w = w;
  const ld = src => new Promise(r => { const im = new Image(); im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => r(im)); im.onerror = () => r(null); im.src = src; });
  return Promise.all([ld(AS + 'leaf-r-' + w + '.webp'), ld(AS + 'leaf-l-' + w + '.webp')]).then(([f, bk]) => { CURL.front = f; CURL.back = bk; }); }
function clipHalf(poly, M, n, keepPos){ const out = [], side = p => ((p[0] - M[0]) * n[0] + (p[1] - M[1]) * n[1]) * (keepPos ? 1 : -1);
  for(let i = 0; i < poly.length; i++){ const A = poly[i], B = poly[(i + 1) % poly.length], sa = side(A), sb = side(B);
    if(sa >= 0) out.push(A); if((sa >= 0) !== (sb >= 0)){ const k = sa / (sa - sb); out.push([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k]); } }
  return out; }
function pathOf(ctx, poly){ ctx.beginPath(); poly.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
function drawCurl(ctx, t){
  ctx.clearRect(-CM, -CM, 2 * CW + 2 * CM, CH + 2 * CM);
  if(t <= 0.0005) return;
  const e = t, C0 = [2 * CW, CH];
  let P = [2 * CW - 2 * CW * e, CH - 0.20 * CH * Math.sin(Math.PI * Math.min(1, e))];
  /* paper does not stretch: the corner stays within reach of the spine's two ends */
  const B = [CW, CH], T = [CW, 0], lim = (c, r) => { const dx = P[0] - c[0], dy = P[1] - c[1], d = Math.hypot(dx, dy); if(d > r){ P = [c[0] + dx / d * r, c[1] + dy / d * r]; } };
  lim(B, CW); lim(T, Math.hypot(CW, CH));
  const dx = C0[0] - P[0], dy = C0[1] - P[1], L = Math.hypot(dx, dy) || 1, n = [dx / L, dy / L], M = [(C0[0] + P[0]) / 2, (C0[1] + P[1]) / 2];
  const page = [[CW, 0], [2 * CW, 0], [2 * CW, CH], [CW, CH]];
  const flat = clipHalf(page, M, n, false), lifted = clipHalf(page, M, n, true);
  const refl = p => { const k = 2 * ((p[0] - M[0]) * n[0] + (p[1] - M[1]) * n[1]); return [p[0] - k * n[0], p[1] - k * n[1]]; };
  const flap = lifted.map(refl);
  /* where the corner has lifted, the page beneath shows, darkened close to the fold */
  if(lifted.length > 2){ ctx.save(); pathOf(ctx, lifted); ctx.clip();
    const g = ctx.createLinearGradient(M[0], M[1], M[0] + n[0] * 60, M[1] + n[1] * 60); g.addColorStop(0, 'rgba(30,18,8,.32)'); g.addColorStop(1, 'rgba(30,18,8,0)');
    ctx.fillStyle = g; ctx.fillRect(-CM, -CM, 2 * CW + 2 * CM, CH + 2 * CM); ctx.restore(); }
  /* the part of the page still lying flat */
  if(flat.length > 2 && CURL.front){ ctx.save(); pathOf(ctx, flat); ctx.clip(); ctx.drawImage(CURL.front, CW, 0, CW, CH); ctx.restore(); }
  if(flap.length > 2){
    /* the folded flap's soft shadow on what lies under it */
    ctx.save(); ctx.shadowColor = 'rgba(20,10,4,.38)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = -n[0] * 5; ctx.shadowOffsetY = -n[1] * 3 + 2;
    pathOf(ctx, flap); ctx.fillStyle = '#F3EDE0'; ctx.fill(); ctx.restore();
    /* the flap itself: the back of the page, folded over the line */
    ctx.save(); pathOf(ctx, flap); ctx.clip();
    const a = 1 - 2 * n[0] * n[0], bb = -2 * n[0] * n[1], d = 1 - 2 * n[1] * n[1], mn = M[0] * n[0] + M[1] * n[1];
    ctx.transform(a, bb, bb, d, 2 * mn * n[0], 2 * mn * n[1]);
    if(CURL.back){ ctx.save(); ctx.translate(3 * CW, 0); ctx.scale(-1, 1); ctx.drawImage(CURL.back, CW, 0, CW, CH); ctx.restore(); }
    ctx.restore();
    /* light on the bend: bright beside the fold, deepening towards the free edge */
    ctx.save(); pathOf(ctx, flap); ctx.clip();
    const g2 = ctx.createLinearGradient(M[0], M[1], M[0] - n[0] * L, M[1] - n[1] * L);
    g2.addColorStop(0, 'rgba(60,40,20,.30)'); g2.addColorStop(0.06, 'rgba(255,252,244,.22)'); g2.addColorStop(0.35, 'rgba(255,252,244,0)'); g2.addColorStop(1, 'rgba(60,40,20,.12)');
    ctx.fillStyle = g2; ctx.fillRect(-CM, -CM, 2 * CW + 2 * CM, CH + 2 * CM);
    ctx.strokeStyle = 'rgba(60,40,20,.18)'; ctx.lineWidth = .6; pathOf(ctx, flap); ctx.stroke(); ctx.restore(); }
}
function penLift(up){ const pen = $('pen'); if(!pen || reduce) return Promise.resolve();
  const body = pen.querySelector('.pen-b'), sh = pen.querySelector('.pen-sh');
  const A = {transform: 'translate(0,0) rotate(0deg)'}, Bp = {transform: 'translate(34px,-22px) rotate(-5deg) scale(1.02)'};
  const SA = {opacity: 1, transform: 'translate(0,0)', filter: 'blur(0px)'}, SB = {opacity: .35, transform: 'translate(42px,-4px)', filter: 'blur(3px)'};
  const o = {duration: 260, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards'};
  body.animate(up ? [A, Bp] : [Bp, A], o); return sh.animate(up ? [SA, SB] : [SB, SA], o).finished.catch(() => {}); }
async function memoTurn(d){ const n = NB.cur + d; if(n < 0 || n > NB_MAX - 1 || turning) return;
  while(NB.pages.length <= n) NB.pages.push({text: '', date: null, edited: null});
  if(reduce){ NB.cur = n; memoShow(); nbSave(); if(state === 'note') caretEnd(); return; }
  turning = true; memoText.blur();
  const cv = $('curl'); await curlImgs();
  const box = cv.getBoundingClientRect(), k = Math.max(1, (box.width || 1) / (2 * CW + 2 * CM)) * (window.devicePixelRatio || 1);
  cv.width = Math.round((2 * CW + 2 * CM) * k); cv.height = Math.round((CH + 2 * CM) * k);
  const ctx = cv.getContext('2d'); ctx.setTransform(k, 0, 0, k, CM * k, CM * k); ctx.imageSmoothingQuality = 'high';
  await penLift(true);
  if(d < 0){ drawCurl(ctx, 1); NB.cur = n; memoShow(); }     /* turning back, the leaf lies over the left page at first */
  cv.classList.add('on');
  const dur = window.__curlDur || 1150, t0 = performance.now(), ease = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  await new Promise(res => { const step = now => { const u = Math.min(1, (now - t0) / dur), v = ease(u); drawCurl(ctx, d > 0 ? v : 1 - v);
    if(u < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  if(d > 0){ NB.cur = n; memoShow(); }
  cv.classList.remove('on'); ctx.clearRect(-CM, -CM, 2 * CW + 2 * CM, CH + 2 * CM);
  nbSave(); await penLift(false); turning = false; if(state === 'note') caretEnd(); }
function caretEnd(){ memoText.focus(); const r = document.createRange(); r.selectNodeContents(memoText); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
['memoPrev', 'memoNext'].forEach((id, k) => $(id).addEventListener('click', e => { e.stopPropagation(); memoTurn(k ? 1 : -1); }));
const fontMenu = $('fontMenu');
$('fontPick').addEventListener('click', e => { e.stopPropagation(); fontMenu.classList.toggle('on'); });
fontMenu.addEventListener('click', e => { e.stopPropagation();
  const f = e.target.closest('button[data-f]'); if(f){ NB.font = f.dataset.f; nbFont(); nbSave(); fontMenu.classList.remove('on'); if(state === 'note') memoText.focus(); } });
const pastMenu = $('pastMenu');
$('pastBooks').addEventListener('click', e => { e.stopPropagation(); fontMenu.classList.remove('on'); pastMenu.classList.toggle('on'); });
$('nbShelf').addEventListener('click', e => { e.stopPropagation(); fontMenu.classList.remove('on');
  const cur = NBS[NBS.length - 1], used = n => n.pages.filter(p => (p.text || '').trim()).length, where = P && P.where ? P.where() : 'in this browser';
  pastMenu.innerHTML = '<p>NOTEBOOKS</p>' + NBS.map((n, i) => '<button data-nb="' + i + '"' + (n === NB ? ' class="on"' : '') + '><b>Notebook ' + (i + 1) + '</b><span>' + used(n) + (used(n) === 1 ? ' page' : ' pages') + '</span></button>').reverse().join('') +
    '<button data-nbnew="1" class="nb-new"><b>+ New notebook</b></button><p class="nb-where">Saved with your library</p>';
  pastMenu.classList.toggle('on'); });
pastMenu.addEventListener('click', e => { e.stopPropagation();
  if(e.target.closest('[data-nbnew]')){ NB = {id: 'nb-' + Date.now().toString(36), font: NB ? NB.font : 'ink', cur: 0, pages: [{text: '', date: null, edited: null}]}; NBS.push(NB); nbFont(); memoShow(); nbSave(true); pastMenu.classList.remove('on'); if(state === 'note') caretEnd(); return; }
  const nb = e.target.closest('button[data-nb]'); if(!nb) return;
  NB = NBS[+nb.dataset.nb]; nbFont(); memoShow(); pastMenu.classList.remove('on'); if(state === 'note') caretEnd(); });
$('memoNew').addEventListener('click', e => { e.stopPropagation(); const cur = NBS[NBS.length - 1]; if(NB !== cur || NB.cur < NB_MAX - 1) return;
  NB = {id: 'nb-' + Date.now().toString(36), font: cur.font, cur: 0, pages: [{text: '', date: null, edited: null}]}; NBS.push(NB); nbFont(); memoShow(); nbSave(true); toast('A new notebook. The full one is under Past books.'); if(state === 'note') caretEnd(); });
addEventListener('click', e => { if(!e.target.closest('#fontMenu,#fontPick')) fontMenu.classList.remove('on'); if(!e.target.closest('#pastMenu,#pastBooks')) pastMenu.classList.remove('on'); });
memoText.addEventListener('input', () => { const pg = NB.pages[NB.cur] || (NB.pages[NB.cur] = {text: '', date: null});
  pg.text = memoText.innerText; pg.edited = new Date().toISOString(); if(!pg.date && pg.text.trim()) pg.date = today(); $('memoDate').textContent = fmtDate(pg.date || today()); nbSave(); });
function zoomTo(on){ stage.classList.add('zooming');
  if(on){ const Z = Math.min(2.4, innerHeight * 0.86 / (290 * FIT.s)), s2 = FIT.s * Z, cx = 840, cy = 175;
    stage.style.transform = 'translate(' + (innerWidth / 2 - cx * s2) + 'px,' + (innerHeight / 2 - cy * s2) + 'px) scale(' + s2 + ')'; }
  else fit();
  clearTimeout(zoomTo._t); zoomTo._t = setTimeout(() => stage.classList.remove('zooming'), 820); }
async function openNote(){ if(busy || state !== 'desk') return; busy = true; closeMenus(); D = load(); loadNotebooks(); nbFont(); memoShow();
  setState('note', 'Your research log · up to sixty pages · the right page stays as it is'); zoomTo(true); await sleep(reduce ? 20 : 780);
  memoText.contentEditable = 'true'; caretEnd(); busy = false; }
async function closeNote(){ if(busy || state !== 'note') return; busy = true; fontMenu.classList.remove('on'); pastMenu.classList.remove('on'); NB = NBS[NBS.length - 1]; nbFont(); memoShow(); memoText.contentEditable = 'false'; memoText.blur(); nbSave(true);
  setState('desk', HINT_DESK); zoomTo(false); await sleep(reduce ? 20 : 800); busy = false; }
memo.addEventListener('click', e => { if(state === 'desk'){ e.stopPropagation(); openNote(); } });
$('noteBack').addEventListener('click', closeNote);
stage.addEventListener('click', e => { if(state === 'note' && !e.target.closest('#memo')) closeNote(); });
addEventListener('keydown', e => { if(state !== 'note' || !e.altKey) return; if(e.key === 'ArrowRight'){ e.preventDefault(); memoTurn(1); } else if(e.key === 'ArrowLeft'){ e.preventDefault(); memoTurn(-1); } });

/* ============ keys ============ */
addEventListener('keydown', e => { if(e.key !== 'Escape') return;
  if(panel.classList.contains('on')){ panel.classList.remove('on'); return; }
  if(fontMenu.classList.contains('on')){ fontMenu.classList.remove('on'); return; }
  if(pastMenu.classList.contains('on')){ pastMenu.classList.remove('on'); return; }
  if(rcard.classList.contains('on')){ rcard.classList.remove('on'); return; }
  if(state === 'note') closeNote(); else if(state === 'maps') toDesk(); else if(state === 'papers') fromPapers(); else if(state === 'paper') closePaperPage(); else if(state === 'books') closeBook(); });

/* ============ start ============ */
function refreshAll(){
  $('brandName').textContent = D.title || 'Paper Map';
  const np = D.papers.length; $('ptagCount').textContent = np + (np === 1 ? ' paper' : ' papers');
  assignSheets(); R = (D.readings || []).slice(); CATS = (D.readingCats || []).slice(); loadNotebooks(); nbFont(); memoShow();
  setCup(prefs.cup || 'espresso'); setStart(prefs.start || 'desk');
  document.querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o.dataset.paper === prefs.paper));
  document.querySelectorAll('.wd').forEach(w => w.classList.toggle('on', w.dataset.wood === prefs.wood));
  if(D.preview) document.body.classList.add('preview');
}
/* ============ welcome: each time Paper Map opens ============ */
const welcome = $('welcome');
function dismissWelcome(now){ if(!welcome || welcome.classList.contains('gone')) return; if(now === true) welcome.classList.add('now'); welcome.classList.add('gone'); setTimeout(() => { if(welcome.parentNode) welcome.remove(); }, now === true ? 0 : 1050); }
if(welcome){
  requestAnimationFrame(() => welcome.classList.add('show'));
  welcome.addEventListener('click', dismissWelcome);
  addEventListener('keydown', dismissWelcome, {once: true}); addEventListener('wheel', dismissWelcome, {once: true, passive: true});
  /* it stays a moment once the desk has appeared behind it, then the desk comes into focus */
  const waitReady = () => document.body.classList.contains('ready') ? setTimeout(dismissWelcome, reduce ? 900 : 2400) : setTimeout(waitReady, 120);
  waitReady(); setTimeout(dismissWelcome, 8000);
}
refreshAll(); setWood(prefs.wood || 'mahogany', true); setState('desk', HINT_DESK);
window.pmDeskPage = {returnFromMap, show, openNote: () => { if(state === 'desk') openNote(); }, refresh(){ D = load(); prefs = Object.assign(prefs, D.prefs || {}); if(state === 'desk' && !busy) refreshAll(); }, state: () => state, busy: () => busy};
if(P && P.ready) P.ready();
})();
