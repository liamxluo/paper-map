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
function topicColor(t){ const i = D.topics.findIndex(x => x.id === t.id); return PALETTE[(i < 0 ? 0 : i) % PALETTE.length]; }
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
  const maps = D.topics.filter(t => !t.shelf), byId = {}; maps.forEach(t => { byId[t.id] = t; });
  const seen = new Set(), out = [];
  (D.recent || []).forEach(id => { if(byId[id] && !seen.has(id)){ seen.add(id); out.push(byId[id]); } });
  maps.forEach(t => { if(!seen.has(t.id)){ seen.add(t.id); out.push(t); } });
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
function mindCoverHTML(m, i){ const meta = [m.papers ? m.papers + (m.papers === 1 ? ' paper' : ' papers') : '', m.books ? m.books + (m.books === 1 ? ' book' : ' books') : ''].filter(Boolean).join(' · ') || 'Mind map';
  return '<div class="mcard mind" data-mind="' + esc(m.id) + '" style="left:' + (ROW_X0 + i * ROW_DX - 93.33) + 'px;--r:' + TILT[i % TILT.length] + 'deg"><div class="xc" role="button" tabindex="0" title="' + esc(m.name) + '">' +
    '<svg class="mfig" viewBox="0 0 160 120" aria-hidden="true"><g fill="none" stroke="#3B332C" stroke-width="1.2" opacity=".7"><path d="M80 60Q58 40 34 30"/><path d="M80 60Q104 38 128 28"/><path d="M80 60Q60 82 36 92"/><path d="M80 60Q102 84 126 94"/><path d="M34 30Q22 46 18 62"/></g><rect x="62" y="51" width="36" height="18" rx="4" fill="#231E1A"/><g fill="#FBF8F2" stroke="#3B332C" stroke-width="1.2"><rect x="18" y="22" width="30" height="14" rx="3"/><rect x="114" y="20" width="30" height="14" rx="3"/><rect x="20" y="86" width="30" height="14" rx="3"/><rect x="112" y="88" width="30" height="14" rx="3"/></g>' + (m.pin ? '<circle cx="132" cy="104" r="5" fill="#C8492F"/>' : '') + '</svg>' +
    '<b class="mt">' + esc(m.name) + '</b><em class="mk">MIND MAP</em></div><div class="mlabel"><b>' + esc(m.name) + '</b><span>' + esc(meta) + '</span></div></div>'; }
let ROWPOS = {};
const topSlot = () => slotOf(order[0] && ROWPOS[order[0].id] != null ? ROWPOS[order[0].id] : 0);
function layoutRow(){
  const n = order.length;
  const MMs = D.minds || [], n2 = n + MMs.length, rt = D.recentTimes || {};
  /* the row runs in the order you last opened things, timelines and mind maps together */
  const items = order.map((t, i) => ({t, at: rt[t.id] || 0, i})).concat(MMs.map((m, i) => ({m, at: rt['mind:' + m.id] || 0, i: n + i}))).sort((a, b) => (b.at - a.at) || (a.i - b.i));
  ROWPOS = {}; items.forEach((x, k) => { if(x.t) ROWPOS[x.t.id] = k; });
  stripIn.innerHTML = items.map((x, k) => x.t ? coverHTML(x.t, k).replace('class="mcard"', 'class="mcard' + (order[0] && x.t.id === order[0].id ? ' lt' : '') + '"') : mindCoverHTML(x.m, k)).join('') + '<div class="mcard new" style="left:' + (ROW_X0 + n2 * ROW_DX - 93.33) + 'px;--r:-2deg"><div class="xc" id="newMapCard" role="button" tabindex="0" title="New map" style="background-image:url(' + AS + 'newmap.webp)"></div><div class="mlabel"><b>New map</b><span>for another field</span></div></div>';
  stripIn.style.width = (ROW_X0 + n2 * ROW_DX + 93.33 + 140) + 'px';
  stripIn.querySelectorAll('.mcard.mind .xc').forEach(c => { const go = () => { if(state === 'maps' && !strip._dragged && P && P.openMind){ c.parentNode.classList.add('lift'); P.openMind(c.parentNode.dataset.mind); } }; c.addEventListener('click', go); c.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } }); });
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
  if(P && P.setMapColor) P.setMapColor(colPick.dataset.tid, b.dataset.hex); D = load(); const sl = strip.scrollLeft; order = order.map(t => D.topics.find(x => x.id === t.id) || t); layoutRow(); strip.scrollLeft = sl; rowArrows(); assignSheets(); sheets.forEach(el => { if(state === 'maps'){ el.style.opacity = '0'; el.style.pointerEvents = 'none'; } }); });
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
    if(k > 0){ moves.push(anim(el, [{opacity: 1}, {opacity: 0}], {duration: 220, easing: 'ease-out'}).then(() => { el.style.opacity = '0'; setPose(el, p, 1); return fold(el, 0, 1); })); return; }
    const pt = topSlot(); p[0] = pt[0]; p[1] = pt[1]; p[2] = pt[2];
    moves.push(Promise.all([move(el, [p[0], p[1] - 26, p[2]], 1.0, 520, 0, 'cubic-bezier(.3,0,.3,1)').then(() => move(el, p, 1.0, 420, 0, 'cubic-bezier(.2,.7,.2,1)')), fold(el, 160, 560)])); });
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
  [2, 1, 0].forEach((si, k) => { const el = sheets[si]; el.getAnimations().forEach(a => a.cancel()); el.classList.add('flying'); if(!el._topic){ el.style.opacity = '0'; return; } settle(el, true); setPose(el, k > 0 ? STACK[si].a1 : topSlot(), 1); el.style.opacity = k > 0 ? '0' : '1'; el.style.pointerEvents = ''; });
  setState('desk', HINT_DESK);
  sheets.forEach((el, k) => { el.style.zIndex = 10 + k; });
  await Promise.all(sheets.map((el, k) => el._topic ? (k === 2 ? move(el, STACK[k].a1, 1, 760, 0, 'cubic-bezier(.3,.1,.2,1)') : anim(el, [{opacity: 0}, {opacity: 1}], {duration: 420, delay: 520, easing: 'ease-out'}).then(() => { el.style.opacity = '1'; })) : (setPose(el, STACK[k].a1, 1), settle(el, false), el.style.pointerEvents = '', anim(el, [{opacity: 0}, {opacity: 1}], {duration: 500, delay: 400}))));
  await Promise.all(sheets.map((el, k) => el._topic && el.classList.contains('folded') ? unfold(el, 0, k === 2 ? 430 : 1) : null));
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
  if(where === 'maps'){ dismissWelcome(true); layoutRow(); strip.scrollLeft = 0; stripIn.classList.remove('landing'); sheets.forEach(el => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; }); setState('maps', order.length ? 'Choose a map to open it · scroll for more' : 'Make your first map'); }
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
/* ===================== drinks, made once, for every desk =====================
   Each drink is two pictures laid over the wood: what it lets through of the desk (multiplied with it: its shadow, the
   colour of the whisky or the tea) and the light it gives itself (added: the porcelain, reflections, ice, peel, leaves).
   So a drink looks right on any desk, and the ice or the leaves move the same on all of them. */
const VESSELS = {};
const DRINKS = {'': 'espresso', espresso: 'espresso', heart: 'espresso', tea: 'espresso', greentea: 'espresso', osmanthus: 'osmanthus', longjing: 'longjing', whisky: 'whisky', teaglass: 'teaglass'};
const DRINK_BOX = {espresso: [1080, 0, 360], osmanthus: [1080, 0, 360], longjing: [1080, 0, 360], whisky: [1160, 0, 280], teaglass: [1160, 0, 280]};
const drinkOn = () => true;
function paintDrink(){ const k = DRINKS[prefs.cup || ''] || 'espresso', bx = DRINK_BOX[k], T = $('drinkT'), E = $('drinkE'); if(!T || !E) return;
  const Lf = $('drinkL'); if(Lf){ Object.assign(Lf.style, {left: bx[0] + 'px', top: bx[1] + 'px', width: bx[2] + 'px', height: bx[2] + 'px'}); if(k === 'teaglass'){ const s2 = AS + 'drink-teaglass-l.webp'; if(Lf.getAttribute('src') !== s2){ Lf.onload = () => Lf.classList.add('on'); Lf.src = s2; } else Lf.classList.add('on'); } else Lf.classList.remove('on'); }
  [T, E].forEach((el, n) => { Object.assign(el.style, {left: bx[0] + 'px', top: bx[1] + 'px', width: bx[2] + 'px', height: bx[2] + 'px'});
    const src = AS + 'drink-' + k + (n ? '-e' : '-t') + '.webp'; el.onerror = () => el.classList.remove('on');
    if(el.getAttribute('src') !== src){ el.classList.remove('on'); el.onload = () => el.classList.add('on'); el.src = src; } else el.classList.add('on'); }); }
const paintDrinkAnim = paintDrink;
function setWood(v, instant){ prefs.wood = v; document.querySelectorAll('.wd').forEach(w => w.classList.toggle('on', w.dataset.wood === v));
  { const fr = document.querySelector('#leaf .lf-front'), bk = document.querySelector('#leaf .lf-back'); if(fr) fr.style.backgroundImage = 'url(' + AS + 'leaf-r-' + v + '.webp)'; if(bk) bk.style.backgroundImage = 'url(' + AS + 'leaf-l-' + v + '.webp)'; }
  const url = AS + 'bg-' + v + '.webp', img = new Image();
  img.onload = () => { const back = $(bgFront === 'A' ? 'bgB' : 'bgA'), front = $(bgFront === 'A' ? 'bgA' : 'bgB');
    back.style.backgroundImage = 'url(' + url + ')'; back.style.transition = instant ? 'none' : ''; front.style.transition = instant ? 'none' : '';
    back.style.opacity = 1; front.style.opacity = 0; bgFront = bgFront === 'A' ? 'B' : 'A'; document.body.classList.add('ready'); };
  img.onerror = () => document.body.classList.add('ready');
  img.src = url; setTimeout(paintDrinkAnim, 350); }
function setPaper(v){ prefs.paper = v; document.querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o.dataset.paper === v));
  sheets.forEach(el => { const t = D.topics.find(x => x.id === el._topic) || null; paintSheet(el, t); }); setState(state); }
function setStart(v){ prefs.start = v; document.querySelectorAll('.st-opt').forEach(o => o.classList.toggle('on', o.dataset.start === v)); }
document.querySelectorAll('.opt').forEach(o => o.addEventListener('click', () => { setPaper(o.dataset.paper); savePrefs(); }));
document.querySelectorAll('.st-opt').forEach(o => o.addEventListener('click', () => { setStart(o.dataset.start); savePrefs(); }));
document.querySelectorAll('.wd').forEach(w => { w.querySelector('i').style.backgroundImage = 'url(' + AS + 'bg-' + w.dataset.wood + '.webp)'; w.addEventListener('click', () => { setWood(w.dataset.wood); savePrefs(); }); });
const panel = $('panel');
document.querySelectorAll('[data-look]').forEach(g => g.addEventListener('click', e => { e.stopPropagation(); panel.classList.toggle('on'); }));
$('panelX').addEventListener('click', () => panel.classList.remove('on'));
$('moreSettings').addEventListener('click', () => { panel.classList.remove('on'); if(P) P.openSettings(() => { if(state === 'desk' || document.body.classList.contains('reading')) panel.classList.add('on'); }); });
const CUPS = {heart: AS + 'cup-heart.webp', tea: AS + 'cup-tea.webp', greentea: AS + 'cup-greentea.webp'};
const cupImg = $('cupLiquid'), cupMenu = $('cupMenu');
function setCup(key){ prefs.cup = key; paintDrink();
  document.querySelectorAll('#cupKinds button').forEach(b => b.classList.toggle('on', (b.dataset.cup || '') === key));
  if(!CUPS[key] || DRINKS[key] !== 'espresso'){ cupImg.classList.remove('on'); return; }
  cupImg.classList.remove('on'); setTimeout(() => { cupImg.src = CUPS[key]; cupImg.classList.add('on'); }, 10); }
document.querySelectorAll('#cupKinds button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); setCup(b.dataset.cup); savePrefs(); }));
$('cupHit').addEventListener('click', e => { e.stopPropagation(); if(state === 'desk') cupMenu.classList.toggle('on'); });
function closeMenus(){ cupMenu.classList.remove('on'); panel.classList.remove('on'); }
stage.addEventListener('click', e => { if(!e.target.closest('#cupMenu') && !e.target.closest('#cupHit')) cupMenu.classList.remove('on'); });

/* ============ Papers: every paper on your maps, as A4 pages ============ */
let pFilter = {map: '', sub: '', st: '', q: ''}, pAll = false, pOpen = new Set(), pShut = new Set(); const P_FIRST = 240;
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
    { let h = '<button class="tp' + (pFilter.map || pFilter.zc ? '' : ' on') + '" data-map=""><span>All papers</span><em>' + ps.length + '</em></button>'; const allRow = h; h = '';
    const folders = D.topics.filter(t => t.shelf && t.id !== 'ztlib'); $('pbMapsH').hidden = true;
    folders.forEach(t => {
      const tr = topicTree(t), mine = ps.filter(p => p.folder === t.id), has = tr.roots.length > 0, open = (pOpen.has(t.id) || pFilter.map === t.id) && !pShut.has(t.id);
      h += '<div class="tp-row"><button class="tp-tog' + (has ? '' : ' none') + (open ? ' open' : '') + '" data-tog="' + esc(t.id) + '" aria-label="Show its topics"></button><button class="tp' + (pFilter.map === t.id && !pFilter.sub ? ' on' : '') + '" data-map="' + esc(t.id) + '"><span>' + esc(t.name) + '</span><em>' + mine.length + '</em></button><i class="tp-add" data-add-map="' + esc(t.id) + '" title="A folder inside">+</i></div>';
      if(!open) return;
      const row = (r, depth) => { const kids = tr.kids[r.id] || [], o = (pOpen.has(r.id) || (pFilter.sub && subtreeOf(t, r.id).has(pFilter.sub) && pFilter.sub !== r.id)) && !pShut.has(r.id), n = mine.filter(p => subtreeOf(t, r.id).has(p.fsub)).length;
        h += '<div class="tp-row" style="--d:' + depth + '"><button class="tp-tog' + (kids.length ? '' : ' none') + (o ? ' open' : '') + '" data-tog="' + esc(r.id) + '"></button><button class="tp sub' + (pFilter.sub === r.id ? ' on' : '') + '" data-map="' + esc(t.id) + '" data-sub="' + esc(r.id) + '"><span>' + esc(r.name) + '</span><em>' + n + '</em></button><i class="tp-add" data-add-map="' + esc(t.id) + '" data-add-sub="' + esc(r.id) + '" title="A folder inside">+</i></div>';
        if(o) kids.forEach(k => row(k, depth + 1)); };
      tr.roots.forEach(r => row(r, 1)); });
    if(!pShut.has('sec:pm')) h += '<button class="tp tp-new" data-newfolder="1"><span>+ New folder</span></button>';
    /* the two libraries: Zotero's collections exactly as Zotero has them (read only), and your own folders */
    const mine = h; h = '';
    const zt = D.ztree || [], zp = ps.filter(p => p.zkey);
    const secHead = (k, name, icon) => '<button class="pb-sec' + (pShut.has('sec:' + k) ? '' : ' open') + '" data-sec="' + k + '"><i class="pb-ico">' + icon + '</i><span>' + name + '</span><b class="pb-chev"></b></button>';
    const ZI = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 8h8l-8 8h8"/></svg>', MI = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6.5l5.5-2.5 6 2.5 5.5-2.5v13.5l-5.5 2.5-6-2.5-5.5 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></svg>';
    if(zt.length || zp.length){ h += secHead('zotero', 'Zotero', ZI); if(!pShut.has('sec:zotero')){
      const zrow = (k, name, depth, kids, n) => '<div class="tp-row" style="--d:' + depth + '"><button class="tp-tog' + (kids ? (pOpen.has('z:' + k) ? ' open' : '') : ' none') + '" data-ztog="' + esc(k) + '"></button><button class="tp zt' + (pFilter.zc === k ? ' on' : '') + '" data-zc="' + esc(k) + '"><span>' + esc(name) + '</span><em>' + n + '</em></button></div>';
      h += zrow('*', 'All of Zotero', 0, 0, zp.length);
      const walk = (parent, depth) => zt.filter(x => (x.parent || null) === parent).sort((a, b) => a.name.localeCompare(b.name)).forEach(x => { const kids = zt.some(y => y.parent === x.key);
        h += zrow(x.key, x.name, depth, kids, ps.filter(p => (p.zcolls || []).includes(x.key)).length); if(kids && pOpen.has('z:' + x.key)) walk(x.key, depth + 1); });
      walk(null, 0); } }
    h = allRow + h + secHead('pm', 'Paper Map', MI) + (pShut.has('sec:pm') ? '' : mine);
    $('pbMaps').innerHTML = h; }
  $('pbSt').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.st === pFilter.st));
  const q = pFilter.q.trim().toLowerCase();
  const subT = pFilter.map && pFilter.sub ? subtreeOf(D.topics.find(t => t.id === pFilter.map) || {rows: []}, pFilter.sub) : null;
  const list = ps.filter(p => (pFilter.zc ? (pFilter.zc === '*' ? !!p.zkey : (p.zcolls || []).includes(pFilter.zc)) : ((!pFilter.map || p.folder === pFilter.map) && (!subT || subT.has(p.fsub)))) && (!pFilter.st || (pFilter.st === 'none' ? !p.st : p.st === pFilter.st)) && (!q || (p.t + ' ' + p.au + ' ' + p.y + ' ' + (p.v || '')).toLowerCase().includes(q)))
    .sort((a, b) => (a.y || 0) - (b.y || 0) || String(a.t || '').localeCompare(String(b.t || '')));
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
  const tg = e.target.closest('[data-tog]'); if(tg){ const k = tg.dataset.tog, was = tg.classList.contains('open'); if(was){ pOpen.delete(k); pShut.add(k); } else { pShut.delete(k); pOpen.add(k); } renderPapers(); return; }
  const zc = e.target.closest('[data-zc]'); if(zc){ pFilter = {map: '', sub: '', st: '', q: pFilter.q || '', zc: zc.dataset.zc}; pAll = false; renderPapers(); return; }
  const m = e.target.closest('[data-map]'); if(m){ delete pFilter.zc; pFilter.map = m.dataset.map; pFilter.sub = m.dataset.sub || ''; if(pFilter.map) pOpen.add(pFilter.map); pAll = false; renderPapers(); return; }
  const s = e.target.closest('#pbSt button'); if(s){ pFilter.st = pFilter.st === s.dataset.st ? '' : s.dataset.st; renderPapers(); return; }
  const g = e.target.closest('.pg'); if(g) openSpread('paper', g.dataset.id, g.querySelector('.sheet'));
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
  $('ppPdf').hidden = !p.pdf; $('ppPdfImg').removeAttribute('src'); $('ppPg').hidden = true; $('ppPdfMsg').textContent = p.pdf ? 'Drawing a page of its PDF…' : '';
  if(p.pdf && P && P.pdfPage) ppShowPage(id, 0); else if(p.pdf && P && P.pdfThumb) P.pdfThumb(id).then(u => { if(u && ppId === id){ $('ppPdfImg').src = u; $('ppPdfMsg').textContent = ''; } }).catch(() => {});
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
$('ppMind').addEventListener('click', () => { if(P && ppId && P.mindFor) P.mindFor('paper', ppId); });
$('rcMind').addEventListener('click', () => { if(P && rBook && P.mindFor) P.mindFor('book', rBook.id); });
$('ppEdit').addEventListener('click', () => { if(P && ppId) P.openNotes(ppId); });
$('ppLink').addEventListener('click', e => { const u = e.currentTarget.dataset.url; if(u && P) P.openLink(u); });

/* ============ Readings: its own list, its own categories ============ */
const RB = $('rboard'), rcard = $('rcard');
const book = $('book'), bookHome = book.parentNode, bookNext = book.nextSibling, cover = book.querySelector('.bcover');
let R = (D.readings || []).filter(b => !b.deleted), RDEL = (D.readings || []).filter(b => b.deleted), CATS = (D.readingCats || []).slice(), rFilter = 'st:all', rBook = null, rEditing = false;
const BOOKC = [['#2F4A3A', '#D6B670'], ['#6B2A2A', '#E2C58A'], ['#24344F', '#D6B670'], ['#E6DCC6', '#3A2E24'], ['#6A4026', '#E2C58A'], ['#2D5653', '#D9C08A'], ['#A8802F', '#2B2118'], ['#4A5560', '#E0CFA4'], ['#4E3448', '#D9BE84']];
function hashOf(s){ let h = 0; for(const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function clothOf(b){ return b.cover && b.cover.cloth ? [b.cover.cloth, b.cover.ink] : BOOKC[hashOf(b.title + b.id) % BOOKC.length]; }
function rSave(){ if(!P) return; try{ P.saveReadings(R.concat(RDEL), CATS); }catch(e){} }
function rid(){ return 'r-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function lastName(a){ const p = String(a || '').trim().split(/\s+/); return p[p.length - 1] || ''; }
function shortAuthors(b){ const a = b.authors || []; return a.length > 1 ? lastName(a[0]) + ' & ' + lastName(a[1]) : lastName(a[0]); }
function metaLine(b){ return b.status === 'reading' && b.started && !(b.pages && b.at) ? 'Reading since ' + new Date(b.started + 'T12:00:00').toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}) : b.status === 'reading' ? 'Reading' + (b.pages && b.at ? ' · page ' + b.at + ' of ' + b.pages + ' · ' + Math.round(b.at / b.pages * 100) + '%' : b.progress ? ' · about ' + Math.round(b.progress * 100) + '%' : '') : b.status === 'want' ? 'On the list' : b.finished && /^\d{4}-\d{2}$/.test(b.finished) ? 'Finished ' + new Date(b.finished + '-15T12:00:00').toLocaleDateString('en-GB', {month: 'short', year: 'numeric'}) : 'Read'; }
function allCats(){ const set = new Set(CATS); R.forEach(b => (b.categories || []).forEach(c => set.add(c))); return [...set]; }
function coverFit(t){ const w = String(t || '').split(/\s+/), L = Math.max(...w.map(x => x.length), 1), n = String(t || '').length; let fs = 12.5;
  if(L > 8) fs = Math.min(fs, 12.5 * 8.4 / L); if(n > 34) fs = Math.min(fs, 12.5 * Math.sqrt(34 / n)); fs = Math.max(7.5, fs);
  return fs < 12.5 ? ' style="font-size:' + fs.toFixed(2) + 'px;letter-spacing:' + (1.3 * fs / 12.5).toFixed(2) + 'px"' : ''; }
function rbookHTML(b, i){ const [c, tc] = clothOf(b);
  return '<figure class="rbk" data-id="' + esc(b.id) + '" style="--i:' + Math.min(i, 30) + '" tabindex="0" role="button"><div class="rcov' + (b.cover ? ' has-img' : '') + '" style="--c:' + c + ';--t:' + tc + '">' + (b.cover ? '<img src="' + esc(b.cover) + '" alt="" loading="lazy" decoding="async" onerror="this.parentNode.classList.remove(\'has-img\');this.remove()">' : '') + '<i class="rsp"></i><b' + coverFit(b.title) + '>' + esc(b.title) + '</b><span>' + esc(shortAuthors(b)) + '</span></div><figcaption><b>' + esc(b.title) + '</b><span>' + esc((b.authors || [])[0] || '') + ((b.authors || []).length > 1 ? ' et al.' : '') + '</span><em>' + esc(metaLine(b)) + '</em>' + (b.status === 'reading' && b.progress ? '<div class="rbar"><i style="width:' + Math.round(b.progress * 100) + '%"></i></div>' : '') + '</figcaption></figure>'; }
function renderReadings(){
  const [kind, val] = rFilter.split(/:(.+)/);
  const ok = b => kind === 'st' ? (val === 'all' || b.status === val) : (b.categories || []).some(c => c === val);
  const q = ($('rQ') && $('rQ').value || '').trim().toLowerCase(), sort = ($('rSort') && $('rSort').value) || 'shelf';
  const hit = b => !q || [b.title, (b.authors || []).join(' '), b.isbn, (b.categories || []).join(' '), b.notes].concat((b.quotes || []).map(x => x.text + ' ' + (x.note || ''))).join(' ').toLowerCase().includes(q);
  if(q || sort !== 'shelf'){ const key = {added: b => -(Date.parse(b.added || b.edited || 0) || 0), title: b => (b.title || '').toLowerCase(), author: b => lastName((b.authors || [])[0]).toLowerCase(), finished: b => String(9999 - (+String(b.finishedOn || b.finished || '0').slice(0, 4))) + String(b.finishedOn || b.finished || '')}[sort] || (b => (b.title || '').toLowerCase());
    const list = R.filter(b => ok(b) && hit(b)).slice().sort((a, c) => { const x = key(a), y = key(c); return x < y ? -1 : x > y ? 1 : 0; });
    $('rSecs').innerHTML = list.length ? '<section class="rsec"><h3>' + (q ? 'Found' : {added: 'Recently added', title: 'By title', author: 'By author', finished: 'Last finished'}[sort]) + ' <em>' + list.length + '</em></h3><div class="rb-row">' + list.map((b, k) => rbookHTML(b, k)).join('') + '</div></section>' : '<p class="pb-empty">No book matches “' + esc(q) + '”.</p>';
    rCounts(); return; }
  const read = R.filter(b => b.status === 'read'), years = {};
  read.forEach(b => { const y = b.finished ? b.finished.slice(0, 4) : 'Earlier'; (years[y] = years[y] || []).push(b); });
  const secs = [['Reading now', R.filter(b => b.status === 'reading')]].concat(Object.keys(years).sort((a, b) => b.localeCompare(a)).map(y => [y === 'Earlier' ? 'Read earlier' : 'Read in ' + y, years[y].sort((a, b) => String(b.finished || '').localeCompare(String(a.finished || '')))])).concat([['Want to read', R.filter(b => b.status === 'want')]]);
  let i = 0;
  const html = secs.map(([name, items]) => { const vis = items.filter(ok); if(!vis.length) return ''; return '<section class="rsec"><h3>' + esc(name) + ' <em>' + vis.length + '</em></h3><div class="rb-row">' + vis.map(b => rbookHTML(b, i++)).join('') + '</div></section>'; }).join('');
  $('rSecs').innerHTML = html || '<p class="pb-empty">' + (R.length ? 'No books here.' : 'Your Readings is empty. Add the first book you have read with “Add a book”.') + '</p>';
  rCounts();
  const n = s => R.filter(b => s === 'all' || b.status === s).length;
  $('rStatus').innerHTML = [['all', 'All books'], ['reading', 'Reading now'], ['read', 'Read'], ['want', 'Want to read']].map(([k, l]) => '<button class="tp' + (rFilter === 'st:' + k ? ' on' : '') + '" data-filter="st:' + k + '"><span>' + l + '</span><em>' + n(k) + '</em></button>').join('');
  $('rcats').innerHTML = catTreeHTML();
  $('rFilt').textContent = kind === 'cat' ? 'Books in “' + val + '”' : '';
}
RB.addEventListener('click', e => {
  const t = e.target.closest('.tp[data-filter]'); if(t){ rFilter = t.dataset.filter; renderReadings(); return; }
  const f = e.target.closest('.rbk'); if(f){ openSpread('book', f.dataset.id, f.querySelector('.rcov')); return; }
  if(!e.target.closest('.rc-map')) $('rcMaps').classList.remove('on');
});
$('rNewCat').addEventListener('click', e => { e.stopPropagation(); askInline({before: $('rNewCat'), placeholder: 'New category'}).then(n => { if(!n) return; if(!CATS.includes(n)) CATS.push(n); rSave(); renderReadings(); }); });
$('rAdd').addEventListener('click', () => openRCard(null));
function fieldVal(id){ return $(id).value.trim(); }
function monthOf(v){ if(!v) return null; if(/^\d{4}-\d{2}$/.test(v)) return v; const d = new Date(v); return isNaN(d) ? null : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function openRCard(b){
  rBook = b; rEditing = !b;
  const d = b || {id: '', title: '', authors: [], year: '', status: 'read', finished: new Date().toISOString().slice(0, 7), categories: [], notes: ''};
  const [c, tc] = clothOf(d.title ? d : {title: 'x', id: 'x'});
  $('rcCov').style.setProperty('--c', c); $('rcCov').style.setProperty('--t', tc); $('rcCovT').textContent = d.title || 'New book';
  rcard._cover = d.cover || null; rcCover(rcard._cover); $('rcMore').hidden = !b; if(b){ renderQuotes(b); renderFiles(b); }
  $('rcView').hidden = rEditing; $('rcEdit').hidden = !rEditing;
  $('rcK').textContent = (d.year ? d.year + ' · ' : '') + (b ? metaLine(b) : 'A new book');
  $('rcT').textContent = d.title || 'A new book'; $('rcA').textContent = (d.authors || []).join(', ');
  $('rfT').value = d.title || ''; $('rfA').value = (d.authors || []).join(', '); $('rfY').value = d.year || ''; $('rfF').value = d.finished || ''; $('rfP').value = d.progress ? Math.round(d.progress * 100) : '';
  $('rfI').value = d.isbn || ''; $('rfPg').value = d.pages || ''; $('rfAt').value = d.at || (d.pages && d.progress ? Math.round(d.progress * d.pages) : ''); $('rfMsg').textContent = ''; rfPct();
  rcProgShow(b);
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
  /* a category is chosen from your own, or typed in place: no browser pop-up */
  add.addEventListener('click', () => { const opts = allCats().filter(c => !(d.categories || []).includes(c));
    const put = n => { n = (n || '').trim(); if(!n) return; d.categories = [n]; if(!CATS.includes(n)) CATS.push(n); if(rBook){ rBook.categories = d.categories; rSave(); renderReadings(); } renderCardCats(d); };
    const inp = document.createElement('input'); inp.className = 'rc-catin'; inp.placeholder = 'Category'; inp.setAttribute('list', 'rcCatList'); add.replaceWith(inp);
    let dl = document.getElementById('rcCatList'); if(!dl){ dl = document.createElement('datalist'); dl.id = 'rcCatList'; document.body.appendChild(dl); } dl.innerHTML = opts.map(o => '<option value="' + esc(o) + '">').join('');
    let done = false; const end = v => { if(done) return; done = true; put(v); renderCardCats(d); };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if(e.key === 'Enter'){ e.preventDefault(); end(inp.value); } else if(e.key === 'Escape'){ e.preventDefault(); end(''); } });
    inp.addEventListener('blur', () => end(inp.value)); requestAnimationFrame(() => inp.focus()); });
  box.appendChild(add); rcard._draft = d; }
$('rcardX').addEventListener('click', () => rcard.classList.remove('on'));
$('rcEditBtn').addEventListener('click', () => { if(!rBook) return; rEditing = true; editMode(true); $('rfT').focus(); });
$('rcSave').addEventListener('click', () => {
  const t = fieldVal('rfT'); if(!t){ $('rfT').focus(); toast('A book needs a title.'); return; }
  const d = rcard._draft || {};
  const st = (document.querySelector('#rcSt button.on') || {}).dataset ? document.querySelector('#rcSt button.on').dataset.st : 'read';
  const y = parseInt(fieldVal('rfY'), 10), pg = parseInt(fieldVal('rfPg'), 10), at = parseInt(fieldVal('rfAt'), 10);
  const pr = isFinite(pg) && pg > 0 && isFinite(at) ? at / pg * 100 : parseFloat(fieldVal('rfP'));
  const b = rBook || {id: rid(), onMaps: []};
  Object.assign(b, {title: t, authors: fieldVal('rfA').split(/\s*[;,]\s*|\s+&\s+|\s+and\s+/).map(x => x.trim()).filter(Boolean), year: isFinite(y) ? y : null, status: st, finished: st === 'read' ? monthOf(fieldVal('rfF')) : null, progress: st === 'reading' && isFinite(pr) ? Math.max(0, Math.min(1, pr / 100)) : null, categories: d.categories || [], notes: $('rcNotes').innerText || '', edited: new Date().toISOString(),
    cover: rcard._cover || null, added: b.added || new Date().toISOString(), started: st === 'reading' ? (b.started || today()) : (b.started || null), finishedOn: st === 'read' ? (b.finishedOn || today()) : null,
    isbn: isbnOf(fieldVal('rfI')) || (b.isbn || null), pages: isFinite(pg) && pg > 0 ? pg : null, at: st === 'reading' && isFinite(at) ? Math.max(0, isFinite(pg) && pg > 0 ? Math.min(pg, at) : at) : (st === 'read' ? null : b.at || null)});
  const isNew = !rBook; if(isNew) R.push(b);
  rSave(); renderReadings(); openRCard(b); toast(rBook ? 'Saved.' : 'Added to your Readings.'); if(isNew) setTimeout(() => offerOldNotes(b), 900);
});
/* Find: by ISBN (or, with no ISBN, by title and author), from Google Books, then Open Library; nothing is kept until you save */
function isbnOf(s){ const d = String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase(); return d.length === 13 || d.length === 10 ? d : ''; }
function rfPct(){ const pg = parseInt($('rfPg').value, 10), at = parseInt($('rfAt').value, 10); $('rfPct').textContent = pg > 0 && isFinite(at) ? ' of ' + pg + ' · ' + Math.min(100, Math.round(at / pg * 100)) + '%' : (pg > 0 ? ' of ' + pg : ''); }
['rfPg', 'rfAt'].forEach(k => $(k).addEventListener('input', rfPct));
async function bookLookup(q){
  const isbn = isbnOf(q);
  const gq = isbn ? 'isbn:' + isbn : q;
  try{ const r = await fetch('https://www.googleapis.com/books/v1/volumes?maxResults=3&q=' + encodeURIComponent(gq)); if(r.ok){ const j = await r.json(); const v = j.items && j.items[0] && j.items[0].volumeInfo;
    if(v){ const ids = v.industryIdentifiers || []; const i13 = (ids.find(x => x.type === 'ISBN_13') || ids.find(x => x.type === 'ISBN_10') || {}).identifier;
      const im = v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail);
      return {title: [v.title, v.subtitle].filter(Boolean).join(': '), authors: v.authors || [], year: parseInt(String(v.publishedDate || '').slice(0, 4), 10) || null, pages: v.pageCount || null, isbn: isbn || i13 || null, cover: im ? im.replace(/^http:/, 'https:').replace('&edge=curl', '') : null, from: 'Google Books'}; } } }catch(e){}
  if(isbn){ try{ const r = await fetch('https://openlibrary.org/api/books?format=json&jscmd=data&bibkeys=ISBN:' + isbn); if(r.ok){ const j = await r.json(); const v = j['ISBN:' + isbn];
    if(v) return {title: [v.title, v.subtitle].filter(Boolean).join(': '), authors: (v.authors || []).map(a => a.name), year: parseInt(String(v.publish_date || '').match(/\d{4}/) || '', 10) || null, pages: v.number_of_pages || null, isbn, cover: v.cover && (v.cover.large || v.cover.medium) || null, from: 'Open Library'}; } }catch(e){} }
  return null;
}
$('rfFind').addEventListener('click', async () => {
  const q = fieldVal('rfI') || [fieldVal('rfT'), fieldVal('rfA')].filter(Boolean).join(' '); if(!q){ $('rfI').focus(); return; }
  const btn = $('rfFind'); btn.disabled = true; btn.textContent = 'Finding…'; $('rfMsg').textContent = '';
  const f = await bookLookup(q); btn.disabled = false; btn.textContent = 'Find';
  if(!f){ $('rfMsg').textContent = 'Nothing found. Check the ISBN, or fill it in by hand.'; return; }
  if(f.title) $('rfT').value = f.title; if(f.authors.length) $('rfA').value = f.authors.join(', '); if(f.year) $('rfY').value = f.year; if(f.pages) $('rfPg').value = f.pages; if(f.isbn) $('rfI').value = f.isbn;
  $('rcCovT').textContent = f.title || 'New book'; rfPct(); $('rfMsg').textContent = 'Found in ' + f.from + '. Check it, then save.';
  coverFor(f).then(u => { if(u){ rcard._cover = u; rcCover(u); } });
});
$('rfI').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); $('rfFind').click(); } });
/* while you are reading it: the page you are on, right on the book's card; the percentage works itself out */
function rcProgShow(b){ const on = !!(b && b.status === 'reading' && b.pages); $('rcProg').hidden = !on; if(!on) return;
  $('rcAt').value = b.at || ''; $('rcPgN').textContent = b.pages; const pc = b.at ? Math.min(100, Math.round(b.at / b.pages * 100)) : 0; $('rcBar').style.width = pc + '%'; $('rcPct').textContent = pc + '%'; }
$('rcAt').addEventListener('change', () => { if(!rBook || !rBook.pages) return; const at = Math.max(0, Math.min(rBook.pages, parseInt($('rcAt').value, 10) || 0));
  rBook.at = at; rBook.progress = at / rBook.pages; rBook.log = (rBook.log || []).filter(x => x.d !== today()).concat([{d: today(), at}]); if(!rBook.started) rBook.started = today();
  if(at >= rBook.pages){ rBook.status = 'read'; rBook.finished = new Date().toISOString().slice(0, 7); rBook.finishedOn = today(); rBook.at = null; toast('Finished: well done.'); }
  rBook.edited = new Date().toISOString(); rSave(); renderReadings(); openRCard(rBook); });
$('rcAt').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); $('rcAt').blur(); } });
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
/* Readings opens the way Papers does: the desk goes soft behind the glass and the shelves rise into place,
   the book staying where it lies; nothing heavy moves while the screen changes */
async function openBook(){ if(busy || state !== 'desk') return; busy = true; closeMenus(); rcard.classList.remove('on');
  R = (D.readings || []).filter(b => !b.deleted); RDEL = (D.readings || []).filter(b => b.deleted); CATS = (D.readingCats || []).slice(); renderReadings();
  RB.scrollTop = 0; RB.style.clipPath = ''; RB.style.opacity = ''; RB.classList.remove('growing');
  setState('books', ''); requestAnimationFrame(() => RB.classList.add('entered'));
  await sleep(reduce ? 20 : 820); busy = false; }
async function closeBook(){ if(busy || state !== 'books') return; busy = true; panel.classList.remove('on'); rcard.classList.remove('on'); book.style.visibility = '';
  setState('desk', HINT_DESK); await sleep(reduce ? 20 : 520); RB.classList.remove('entered'); busy = false; }
book.addEventListener('click', openBook);
book.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openBook(); } });
$('booksBack').addEventListener('click', closeBook);

/* ============ the notebook: a research log of up to sixty pages ============ */
const memo = $('memo'), memoText = $('memoText');
const NB_MAX = 60;
const FONTS = {ink: ["'PMap Ink'", '9.6px', '46px', 'Handwriting'], times: ["'Times New Roman', Times", '8.9px', '47.2px', 'Times New Roman'], georgia: ['Georgia', '8.4px', '47.4px', 'Georgia'], helv: ["'Helvetica Neue', Helvetica, Arial, sans-serif", '7.9px', '47.6px', 'Helvetica'], courier: ["'Courier New', Courier, monospace", '8.1px', '47.4px', 'Courier']};
let NBS = [], NB = null;
function today(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function lastWritten(n){ let best = -1, at = ''; (n.pages || []).forEach((p, i) => { const t = p && (p.edited || (p.text && p.text.trim() ? (p.date || '') + 'T00' : '')); if(t && t >= at){ at = t; best = i; } }); if(best < 0){ for(let i = (n.pages || []).length - 1; i >= 0; i--) if(n.pages[i] && n.pages[i].text && n.pages[i].text.trim()){ best = i; break; } } return Math.max(0, best); }
function loadNotebooks(keep){ const was = keep && NB ? {id: NB.id, cur: NB.cur} : null; NBS = (D.notebooks || []).filter(n => n && Array.isArray(n.pages)).map(n => JSON.parse(JSON.stringify(n)));
  if(!NBS.length) NBS = [{id: 'nb-' + Date.now().toString(36), font: 'ink', cur: 0, pages: [{text: '', date: null, edited: null}]}];
  NB = NBS[NBS.length - 1]; NB.cur = Math.max(0, Math.min(NB.pages.length - 1, NB.cur || 0));
  if(was){ const same = NBS.find(n => n.id === was.id); if(same){ NB = same; NB.cur = Math.max(0, Math.min(NB.pages.length - 1, was.cur)); } } }
loadNotebooks();
let nbT = null;
function nbSave(now){ clearTimeout(nbT); const go = () => { if(P) try{ P.saveNotebooks(NBS); }catch(e){} }; if(now) go(); else nbT = setTimeout(go, 600); }
const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'short'});
function nbFont(){ const f = FONTS[NB.font] || FONTS.ink; memo.style.setProperty('--mf', f[0]); memo.style.setProperty('--ms', f[1]); memo.style.setProperty('--mt', f[2]);
  $('fontName').textContent = f[3]; document.querySelectorAll('#fontMenu button[data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === NB.font)); renderNbList(); }
function nbSpan(n){ const ds = n.pages.map(p => p.date).filter(Boolean).sort(); if(!ds.length) return 'empty'; const f = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {month: 'short', year: 'numeric'}); return f(ds[0]) === f(ds[ds.length - 1]) ? f(ds[0]) : f(ds[0]) + ' – ' + f(ds[ds.length - 1]); }
function renderNbList(){ const cur = NBS[NBS.length - 1], past = NBS.slice(0, -1);
  $('pastBooks').hidden = true; $('pastName').textContent = NB === cur ? 'Past books' : nbName(NB, NBS.indexOf(NB));
  $('pastMenu').innerHTML = '<p>PAST BOOKS</p>' + (NB !== cur ? '<button data-nb="' + (NBS.length - 1) + '" class="back">Back to your current notebook</button>' : '') + past.map((n, i) => '<button data-nb="' + i + '"' + (n === NB ? ' class="on"' : '') + '>' + esc(nbName(n, i)) + '<em>' + (k => k + (k === 1 ? ' page' : ' pages'))(n.pages.filter(p => p.text && p.text.trim()).length) + ' · ' + nbSpan(n) + '</em></button>').join('');
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
function nbName(n, i){ return (n && n.name && String(n.name).trim()) || 'Notebook ' + (i + 1); }
/* rename a notebook right in the list: double-click it, or right-click */
function nbRename(btn){ const i = +btn.dataset.nb, n = NBS[i]; if(!n) return; const b = btn.querySelector('b'); if(!b || btn.querySelector('input')) return;
  const inp = document.createElement('input'); inp.className = 'nb-rename'; inp.value = nbName(n, i); inp.setAttribute('aria-label', 'Name of this notebook'); b.replaceWith(inp); inp.focus(); inp.select();
  let over = false;
  const done = keep => { if(over || !inp.isConnected) return; over = true; if(keep){ const v = inp.value.trim(); if(v && v !== 'Notebook ' + (i + 1)) n.name = v.slice(0, 60); else delete n.name; nbSave(true); }
    const nb2 = document.createElement('b'); nb2.textContent = nbName(n, i); inp.replaceWith(nb2);
    { const cur = NBS[NBS.length - 1]; if(NB === n && NB !== cur) $('pastName').textContent = nbName(n, i); } };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if(e.key === 'Enter'){ e.preventDefault(); done(true); } else if(e.key === 'Escape'){ e.preventDefault(); done(false); } });
  inp.addEventListener('click', e => e.stopPropagation()); inp.addEventListener('blur', () => done(true)); }
pastMenu.addEventListener('contextmenu', e => { const nb = e.target.closest('button[data-nb]'); if(nb){ e.preventDefault(); e.stopPropagation(); nbRename(nb); } });
$('pastBooks').addEventListener('click', e => { e.stopPropagation(); fontMenu.classList.remove('on'); pastMenu.classList.toggle('on'); });
$('nbShelf').addEventListener('click', e => { e.stopPropagation(); fontMenu.classList.remove('on');
  const cur = NBS[NBS.length - 1], used = n => n.pages.filter(p => (p.text || '').trim()).length, where = P && P.where ? P.where() : 'in this browser';
  pastMenu.innerHTML = '<p>NOTEBOOKS</p>' + NBS.map((n, i) => '<button data-nb="' + i + '"' + (n === NB ? ' class="on"' : '') + '><b>' + esc(nbName(n, i)) + '</b><span>' + used(n) + (used(n) === 1 ? ' page' : ' pages') + '</span><i class="nb-ren" data-nbren="' + i + '" title="Rename" aria-label="Rename this notebook">✎</i></button>').reverse().join('') +
    '<button data-nbnew="1" class="nb-new"><b>+ New notebook</b></button><p class="nb-where">Saved with your library</p>';
  pastMenu.classList.toggle('on'); });
pastMenu.addEventListener('click', e => { e.stopPropagation();
  const ren = e.target.closest('[data-nbren]'); if(ren){ e.preventDefault(); nbRename(ren.closest('button[data-nb]')); return; }
  if(e.target.closest('[data-nbnew]')){ NB = {id: 'nb-' + Date.now().toString(36), font: NB ? NB.font : 'ink', cur: 0, pages: [{text: '', date: null, edited: null}]}; NBS.push(NB); nbFont(); memoShow(); nbSave(true); pastMenu.classList.remove('on'); if(state === 'note') caretEnd(); return; }
  const nb = e.target.closest('button[data-nb]'); if(!nb || nb.querySelector('input')) return;
  NB = NBS[+nb.dataset.nb]; nbFont(); memoShow(); pastMenu.classList.remove('on'); if(state === 'note') caretEnd(); });
$('memoNew').addEventListener('click', e => { e.stopPropagation(); const cur = NBS[NBS.length - 1]; if(NB !== cur || NB.cur < NB_MAX - 1) return;
  NB = {id: 'nb-' + Date.now().toString(36), font: cur.font, cur: 0, pages: [{text: '', date: null, edited: null}]}; NBS.push(NB); nbFont(); memoShow(); nbSave(true); toast('A new notebook. The full one is under Past books.'); if(state === 'note') caretEnd(); });
addEventListener('click', e => { if(!e.target.closest('#fontMenu,#fontPick')) fontMenu.classList.remove('on'); if(!e.target.closest('#pastMenu,#pastBooks')) pastMenu.classList.remove('on'); });
memoText.addEventListener('input', () => { const pg = NB.pages[NB.cur] || (NB.pages[NB.cur] = {text: '', date: null}); pg.edited = new Date().toISOString();
  pg.text = memoText.innerText; pg.edited = new Date().toISOString(); if(!pg.date && pg.text.trim()) pg.date = today(); $('memoDate').textContent = fmtDate(pg.date || today()); nbSave(); });
function zoomTo(on){ stage.classList.add('zooming');
  if(on){ const Z = Math.min(2.4, innerHeight * 0.86 / (290 * FIT.s)), s2 = FIT.s * Z, cx = 840, cy = 175;
    stage.style.transform = 'translate(' + (innerWidth / 2 - cx * s2) + 'px,' + (innerHeight / 2 - cy * s2) + 'px) scale(' + s2 + ')'; }
  else fit();
  clearTimeout(zoomTo._t); zoomTo._t = setTimeout(() => stage.classList.remove('zooming'), 820); }
async function openNote(){ if(busy || state !== 'desk') return; busy = true; closeMenus(); nbSave(true); D = load(); loadNotebooks(true); NB.cur = lastWritten(NB); nbFont(); memoShow();
  setState('note', 'Your research log · up to sixty pages · the right page stays as it is'); zoomTo(true); await sleep(reduce ? 20 : 780);
  memoText.contentEditable = 'true'; caretEnd(); busy = false; }
async function closeNote(){ if(busy || state !== 'note') return; busy = true; fontMenu.classList.remove('on'); pastMenu.classList.remove('on'); nbSave(true); memoText.contentEditable = 'false'; memoText.blur(); nbSave(true);
  setState('desk', HINT_DESK); zoomTo(false); await sleep(reduce ? 20 : 800);
  busy = false; }
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
  assignSheets(); R = (D.readings || []).filter(b => !b.deleted); RDEL = (D.readings || []).filter(b => b.deleted); CATS = (D.readingCats || []).slice(); loadNotebooks(true); nbFont(); if(!(state === 'note' && document.activeElement === memoText) && !busy) memoShow();
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
/* which page of a paper's PDF to show: Paper Map skips a JSTOR-style cover sheet by itself, and ‹ › choose any other */
let ppPage = {n: 1, count: 0};
function ppShowPage(id, n){
  P.pdfPage(id, n).then(r => { if(ppId !== id) return;
    if(!r){ $('ppPdfMsg').textContent = 'This PDF could not be drawn here. Click to open it.'; return; }
    $('ppPdfImg').src = r.u; $('ppPdfMsg').textContent = ''; ppPage = {n: r.n, count: r.count};
    $('ppPg').hidden = !(r.count > 1); $('ppPgN').textContent = 'Page ' + r.n + ' of ' + r.count; $('ppPgPrev').disabled = r.n <= 1; $('ppPgNext').disabled = r.n >= r.count; })
  .catch(() => { if(ppId === id) $('ppPdfMsg').textContent = 'This PDF could not be drawn here. Click to open it.'; });
}
$('ppPgPrev').addEventListener('click', e => { e.stopPropagation(); if(ppPage.n > 1){ const n = ppPage.n - 1; if(P.setPdfPage) P.setPdfPage(ppId, n); ppShowPage(ppId, n); } });
$('ppPgNext').addEventListener('click', e => { e.stopPropagation(); if(ppPage.n < ppPage.count){ const n = ppPage.n + 1; if(P.setPdfPage) P.setPdfPage(ppId, n); ppShowPage(ppId, n); } });

/* ===================== Readings, grown into a real book list ===================== */
function rCounts(){ const read = R.filter(b => b.status === 'read');
  $('rCount').textContent = R.length + (R.length === 1 ? ' book' : ' books') + ' · ' + read.length + ' read · ' + R.filter(b => b.status === 'reading').length + ' reading · ' + R.filter(b => b.status === 'want').length + ' to read'; }
$('rQ').addEventListener('input', () => renderReadings()); $('rSort').addEventListener('change', () => renderReadings());
/* ---- covers: found with the book (Google Books, Open Library), uploaded, or none ---- */
function rcCover(u){ const cv = $('rcCov'); cv.classList.toggle('has-img', !!u); cv.style.backgroundImage = u ? 'url("' + String(u).replace(/"/g, '%22') + '")' : ''; }
function imgOk(u){ return new Promise(res => { if(!u) return res(false); const im = new Image(); im.onload = () => res(im.naturalWidth > 20); im.onerror = () => res(false); im.src = u; setTimeout(() => res(false), 9000); }); }
async function coverFor(f){ const isbn = f && (f.isbn || isbnOf(fieldVal('rfI')));
  if(f && f.cover && await imgOk(f.cover)) return f.cover;
  if(isbn){ const u = 'https://covers.openlibrary.org/b/isbn/' + isbn + '-L.jpg?default=false'; if(await imgOk(u)) return u; }
  return null; }
$('rfCovFind').addEventListener('click', async () => { const q = fieldVal('rfI') || [fieldVal('rfT'), fieldVal('rfA')].filter(Boolean).join(' '); if(!q){ $('rfMsg').textContent = 'Give its ISBN or title first.'; return; }
  $('rfMsg').textContent = 'Looking for a cover…'; const f = await bookLookup(q); const u = await coverFor(f || {isbn: isbnOf(q)});
  if(u){ rcard._cover = u; rcCover(u); $('rfMsg').textContent = 'Cover found. Save to keep it.'; } else $('rfMsg').textContent = 'No cover found; upload one instead.'; });
$('rfCovUp').addEventListener('click', () => $('rfCovFile').click());
$('rfCovFile').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if(!f) return;
  const url = URL.createObjectURL(f), im = new Image(); im.onload = () => { const w = 360, h = Math.round(im.naturalHeight * w / im.naturalWidth), cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(im, 0, 0, w, h);
    rcard._cover = cv.toDataURL('image/jpeg', 0.84); rcCover(rcard._cover); URL.revokeObjectURL(url); $('rfMsg').textContent = 'Save to keep the cover.'; }; im.src = url; });
$('rfCovDel').addEventListener('click', () => { rcard._cover = null; rcCover(null); });
/* ---- highlights: kept by hand, or brought in from a Kindle ---- */
const fmtD = d => d ? new Date(String(d).length <= 10 ? d + 'T12:00:00' : d).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}) : '';
function renderQuotes(b){ const q = b.quotes || []; $('rcQn').textContent = q.length ? q.length : '';
  $('rcQuotes').innerHTML = q.length ? q.map((x, i) => '<blockquote data-q="' + i + '">' + (x.text ? '<p>' + esc(x.text) + '</p>' : '') + (x.note ? '<p class="qn">' + esc(x.note) + '</p>' : '') + '<footer>' + esc([x.loc, x.src === 'kindle' ? 'Kindle' : '', fmtD(x.date)].filter(Boolean).join(' · ')) + '<button type="button" data-qdel="' + i + '" aria-label="Remove this highlight">×</button></footer></blockquote>').join('') : ''; }
$('rcQAdd').addEventListener('click', () => { if(!rBook) return; const t = $('rcQText').value.trim(); if(!t) return; const loc = $('rcQLoc').value.trim();
  rBook.quotes = (rBook.quotes || []).concat([{text: t, loc: loc ? 'p. ' + loc.replace(/^p\.?\s*/i, '') : '', date: today(), src: 'hand'}]); rBook.edited = new Date().toISOString();
  $('rcQText').value = ''; $('rcQLoc').value = ''; rSave(); renderQuotes(rBook); });
$('rcQuotes').addEventListener('click', e => { const x = e.target.closest('[data-qdel]'); if(!x || !rBook) return; rBook.quotes.splice(+x.dataset.qdel, 1); rSave(); renderQuotes(rBook); });
/* ---- the book's own files: any edition kept with your library; a PDF opens here, the rest you can save a copy of ---- */
const fmtSz = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const extOf = n => (String(n).match(/\.([a-z0-9]+)$/i) || [, ''])[1].toUpperCase();
function renderFiles(b){ const fs = b.files || [];
  $('rcFiles').innerHTML = fs.length ? fs.map((f, i) => '<div class="rf-file"><i class="ext">' + esc(extOf(f.name) || 'FILE') + '</i><span><b>' + esc(f.name) + '</b><em>' + fmtSz(f.size || 0) + '</em></span>' +
    (extOf(f.name) === 'PDF' ? '<button type="button" data-fopen="' + i + '">Open</button>' : '') + '<button type="button" data-fsave="' + i + '">Save a copy</button><button type="button" class="x" data-fdel="' + i + '" aria-label="Remove this file">×</button></div>').join('') : ''; }
$('rcFAdd').addEventListener('click', () => $('rcFFile').click());
$('rcFFile').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if(!f || !rBook || !P || !P.bookFileSave) return;
  const btn = $('rcFAdd'); btn.disabled = true; btn.textContent = 'Keeping ' + f.name + '…';
  try{ const meta = await P.bookFileSave(rBook.id, f); rBook.files = (rBook.files || []).filter(x => x.path !== meta.path).concat([meta]); rBook.edited = new Date().toISOString(); rSave(); renderFiles(rBook); toast('Kept with your library.'); }
  catch(err){ toast(String((err && err.message) || 'Could not keep the file')); }
  btn.disabled = false; btn.textContent = '+ Add a file'; });
let rvBlob = null, rvName = '';
$('rcFiles').addEventListener('click', async e => { if(!rBook || !P) return; const o = e.target.closest('[data-fopen]'), s = e.target.closest('[data-fsave]'), x = e.target.closest('[data-fdel]');
  if(x){ const f = rBook.files[+x.dataset.fdel]; if(!confirm('Remove “' + f.name + '” from this book?')) return; rBook.files.splice(+x.dataset.fdel, 1); rSave(); renderFiles(rBook); try{ P.bookFileDelete && P.bookFileDelete(f); }catch(err){} return; }
  const f = rBook.files[+(o || s || {dataset: {}}).dataset[o ? 'fopen' : 'fsave']]; if(!f) return;
  let blob; try{ blob = await P.bookFileBlob(f); }catch(err){ blob = null; } if(!blob){ toast('That file could not be read just now.'); return; }
  if(s){ P.saveBlob(blob, f.name); return; }
  rvBlob = blob; rvName = f.name; $('rvName').textContent = f.name; $('rvFrame').src = URL.createObjectURL(new Blob([blob], {type: 'application/pdf'})); $('rView').hidden = false; });
$('rvX').addEventListener('click', () => { $('rView').hidden = true; try{ URL.revokeObjectURL($('rvFrame').src); }catch(e){} $('rvFrame').removeAttribute('src'); });
$('rvSave').addEventListener('click', () => { if(rvBlob && P) P.saveBlob(rvBlob, rvName); });
/* ---- import: Kindle highlights (My Clippings.txt), a Kindle notebook (HTML), Goodreads (CSV) ---- */
const normT = t => String(t || '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').split(':')[0].replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').trim();
function bookByTitle(t, author){ const n = normT(t); return R.find(b => normT(b.title) === n) || null; }
function ensureBook(t, author, extra){ let b = bookByTitle(t, author); if(b) return [b, false]; setTimeout(() => { const nb = bookByTitle(t, author); if(nb) offerOldNotes(nb); }, 1500);
  b = Object.assign({id: rid(), title: String(t).trim(), authors: author ? String(author).split(/\s*;\s*|\s*&\s*/).map(x => x.split(',').reverse().map(s => s.trim()).join(' ').trim()).filter(Boolean) : [], year: null, status: 'read', finished: null, categories: [], notes: '', onMaps: [], added: new Date().toISOString()}, extra || {}); R.push(b); return [b, true]; }
function addQuote(b, q){ b.quotes = b.quotes || []; if(q.text && b.quotes.some(x => x.text === q.text)) return false; b.quotes.push(q); return true; }
function parseClippings(txt){ const out = [];
  String(txt).replace(/\r/g, '').replace(/^\uFEFF/, '').split(/={6,}\n?/).forEach(block => { const lines = block.split('\n'); while(lines.length && !lines[0].trim()) lines.shift(); if(lines.length < 2) return;
    const head = lines[0].replace(/^\uFEFF/, '').trim(), meta = lines[1].trim(), text = lines.slice(2).join('\n').trim();
    let title = head, author = ''; const m = head.match(/^(.*)\(([^()]*)\)\s*$/); if(m){ title = m[1].trim(); author = m[2].trim(); }
    const kind = /bookmark|书签|lesezeichen|signet|marcador/i.test(meta) ? 'b' : /\bnote\b|笔记|notiz|remarque|\bnota\b/i.test(meta) ? 'n' : 'h';
    const page = ((meta.match(/page\s+([\dxivlc-]+)|第\s*(\d+)\s*页|seite\s+(\d+)|página\s+(\d+)/i) || []).slice(1).find(Boolean)) || '';
    const loc = ((meta.match(/location\s+([\d-]+)|位置\s*#?\s*([\d-]+)|position\s+([\d-]+)|emplacement\s+([\d-]+)|posición\s+([\d-]+)/i) || []).slice(1).find(Boolean)) || '';
    const dm = meta.split('|').pop().replace(/^.*?(added on|添加于|hinzugefügt am|ajouté le|añadido el)\s*/i, '').trim(), dt = Date.parse(dm);
    if(kind !== 'b' && text) out.push({title, author, kind, page, loc, date: isFinite(dt) ? new Date(dt).toISOString().slice(0, 10) : today(), text}); });
  return out; }
function parseKindleHtml(html){ const doc = new DOMParser().parseFromString(html, 'text/html'); const title = ((doc.querySelector('.bookTitle') || {}).textContent || '').trim(), author = ((doc.querySelector('.authors') || {}).textContent || '').trim(), out = [];
  let head = null; doc.querySelectorAll('.noteHeading, .noteText').forEach(el => { if(el.classList.contains('noteHeading')) head = el.textContent; else if(head !== null){ const h = head, t = el.textContent.trim(); head = null;
    const page = (h.match(/page\s+([\dxivlc-]+)|第\s*(\d+)\s*页/i) || []).slice(1).find(Boolean) || '', loc = (h.match(/location\s+([\d-]+)|位置\s*([\d-]+)/i) || []).slice(1).find(Boolean) || '';
    out.push({title, author, kind: /^\s*(note|笔记)/i.test(h) ? 'n' : 'h', page, loc, date: today(), text: t}); } });
  return out; }
function csvRows(txt){ const rows = []; let row = [], cur = '', q = false; txt = String(txt).replace(/^\uFEFF/, '');
  for(let i = 0; i < txt.length; i++){ const ch = txt[i];
    if(q){ if(ch === '"'){ if(txt[i + 1] === '"'){ cur += '"'; i++; } else q = false; } else cur += ch; }
    else if(ch === '"') q = true; else if(ch === ','){ row.push(cur); cur = ''; } else if(ch === '\n' || ch === '\r'){ if(ch === '\r' && txt[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch; }
  if(cur || row.length){ row.push(cur); rows.push(row); } return rows.filter(r => r.some(x => x.trim())); }
function importGoodreads(txt){ const rows = csvRows(txt); if(rows.length < 2) return null; const h = rows[0].map(x => x.trim()), col = n => h.indexOf(n);
  if(col('Title') < 0 || col('Exclusive Shelf') < 0) return null; let made = 0, seen = 0;
  rows.slice(1).forEach(r => { const g = n => (col(n) >= 0 ? r[col(n)] || '' : '').trim(); const t = g('Title'); if(!t) return;
    const isbn = isbnOf(g('ISBN13').replace(/[="]/g, '')) || isbnOf(g('ISBN').replace(/[="]/g, '')), shelf = g('Exclusive Shelf'), dr = g('Date Read').replace(/\//g, '-');
    const st = shelf === 'read' ? 'read' : shelf === 'currently-reading' ? 'reading' : 'want', extra = g('Bookshelves').split(',').map(s => s.trim()).filter(s => s && !['read', 'currently-reading', 'to-read'].includes(s));
    const [b, isNew] = ensureBook(t, [g('Author')].concat(g('Additional Authors').split(',')).filter(Boolean).join('; '), {});
    if(isNew){ made++; Object.assign(b, {status: st, year: +(g('Original Publication Year') || g('Year Published')) || null, pages: +g('Number of Pages') || null, isbn: isbn || null,
      finished: st === 'read' && /^\d{4}-\d{2}/.test(dr) ? dr.slice(0, 7) : null, finishedOn: st === 'read' && /^\d{4}-\d{2}-\d{2}/.test(dr) ? dr.slice(0, 10) : null, categories: extra, notes: g('My Review').replace(/<br\s*\/?>/gi, '\n'), added: g('Date Added') ? new Date(g('Date Added').replace(/\//g, '-') + 'T12:00:00').toISOString() : b.added}); if(st === 'reading') b.started = today(); extra.forEach(c => { if(!CATS.includes(c)) CATS.push(c); }); }
    else{ seen++; if(!b.isbn && isbn) b.isbn = isbn; if(!b.pages && +g('Number of Pages')) b.pages = +g('Number of Pages'); } });
  return {made, seen}; }
function importHighlights(items){ let books = 0, hl = 0; const touched = new Set();
  items.forEach(it => { const [b, isNew] = ensureBook(it.title, it.author, {status: 'read'}); if(isNew) books++; touched.add(b.id);
    const loc = it.page ? 'p. ' + it.page : it.loc ? 'loc. ' + it.loc : '';
    if(it.kind === 'n'){ const last = (b.quotes || []).slice().reverse().find(x => x.src === 'kindle' && x.text && x.loc === loc && !x.note); if(last){ last.note = it.text; hl++; return; } if(addQuote(b, {text: '', note: it.text, loc, date: it.date, src: 'kindle'})) hl++; return; }
    if(addQuote(b, {text: it.text, loc, date: it.date, src: 'kindle'})) hl++; });
  return {books, hl, touched: touched.size}; }
/* the menu belongs to the screen, not to the toolbar it opens from (the toolbar's own movement would carry it off the edge) */
if($('rMenu') && $('rMenu').parentNode !== document.body) document.body.appendChild($('rMenu'));
function rMenu(items, at){ const m = $('rMenu'); if(m.parentNode !== document.body) document.body.appendChild(m); m.innerHTML = items.map((x, i) => '<button type="button" data-ri="' + i + '"><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></button>').join(''); const r = at.getBoundingClientRect();
  m.classList.add('on'); const w = m.offsetWidth || 320, h = m.offsetHeight || 200;
  m.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.right - w)) + 'px'; m.style.top = Math.max(12, Math.min(innerHeight - h - 12, r.bottom + 8)) + 'px'; m._items = items; }
$('rMenu').addEventListener('click', e => { const b = e.target.closest('[data-ri]'); if(!b) return; const it = $('rMenu')._items[+b.dataset.ri]; $('rMenu').classList.remove('on'); it[2](); });
addEventListener('click', e => { if(!e.target.closest('#rMenu,#rImportBtn,#rExportBtn')) $('rMenu').classList.remove('on'); });
let impKind = null;
$('rImportBtn').addEventListener('click', e => { e.stopPropagation(); rMenu([
  ['Kindle highlights', 'My Clippings.txt, from the Kindle’s documents folder', () => { impKind = 'clip'; $('rImpFile').accept = '.txt,text/plain'; $('rImpFile').click(); }],
  ['Kindle notebook', 'The HTML file the Kindle app exports for one book', () => { impKind = 'nb'; $('rImpFile').accept = '.html,.htm,text/html'; $('rImpFile').click(); }],
  ['Goodreads', 'Your library export (goodreads_library_export.csv)', () => { impKind = 'gr'; $('rImpFile').accept = '.csv,text/csv'; $('rImpFile').click(); }]], $('rImportBtn')); });
$('rImpFile').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if(!f) return; const txt = await f.text();
  if(impKind === 'gr'){ const r = importGoodreads(txt); if(!r){ toast('That does not look like a Goodreads export.'); return; } rSave(); renderReadings(); toast(r.made + (r.made === 1 ? ' book' : ' books') + ' brought in from Goodreads' + (r.seen ? '; ' + r.seen + ' you had already' : '') + '.'); return; }
  const items = impKind === 'nb' ? parseKindleHtml(txt) : parseClippings(txt); if(!items.length){ toast('No highlights found in that file.'); return; }
  const r = importHighlights(items); rSave(); renderReadings(); toast(r.hl + (r.hl === 1 ? ' highlight' : ' highlights') + ' from your Kindle, in ' + r.touched + (r.touched === 1 ? ' book' : ' books') + (r.books ? ' (' + r.books + ' new)' : '') + '.'); });
/* ---- export: every book's notes and highlights as one Markdown file, the list as CSV, or one book ---- */
function bookMd(b){ const L = ['## ' + b.title + ((b.authors || []).length ? ' — ' + b.authors.join(', ') : '') + (b.year ? ' (' + b.year + ')' : ''), ''];
  const facts = [b.status === 'read' ? 'Read' + (b.finishedOn ? ' ' + fmtD(b.finishedOn) : b.finished ? ' ' + b.finished : '') : b.status === 'reading' ? 'Reading' + (b.pages && b.at ? ', page ' + b.at + ' of ' + b.pages : '') : 'Want to read', b.pages ? b.pages + ' pages' : '', b.isbn ? 'ISBN ' + b.isbn : '', (b.categories || []).join(', ')].filter(Boolean);
  L.push('*' + facts.join(' · ') + '*', ''); if((b.notes || '').trim()) L.push('### Notes', '', b.notes.trim(), '');
  if((b.quotes || []).length){ L.push('### Highlights', ''); b.quotes.forEach(q => { if(q.text) L.push('> ' + q.text.replace(/\n/g, '\n> ')); if(q.note) L.push((q.text ? '\n' : '') + q.note); L.push('', '<sub>' + [q.loc, fmtD(q.date)].filter(Boolean).join(' · ') + '</sub>', ''); }); }
  return L.join('\n'); }
function saveText(name, text, type){ if(P && P.saveBlob) P.saveBlob(new Blob([text], {type: type || 'text/markdown;charset=utf-8'}), name); }
$('rExportBtn').addEventListener('click', e => { e.stopPropagation(); rMenu([
  ['Reading notes', 'Every book’s notes and highlights, as one Markdown file', () => saveText('Readings ' + today() + '.md', '# Readings\n\n*Exported ' + fmtD(today()) + ' · ' + R.length + ' books*\n\n' + R.slice().sort((a, c) => (a.title || '').localeCompare(c.title || '')).map(bookMd).join('\n\n---\n\n'))],
  ['The book list', 'Title, authors, ISBN, pages, status and dates, as CSV', () => { const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    saveText('Readings ' + today() + '.csv', ['Title,Authors,Year,ISBN,Pages,Status,Started,Finished,Page,Categories,Highlights'].concat(R.map(b => [b.title, (b.authors || []).join('; '), b.year, b.isbn, b.pages, b.status, b.started, b.finishedOn || b.finished, b.at, (b.categories || []).join('; '), (b.quotes || []).length].map(q).join(','))).join('\n'), 'text/csv;charset=utf-8'); }]], $('rExportBtn')); });
$('rcExp').addEventListener('click', () => { if(rBook) saveText(rBook.title.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80) + '.md', '# ' + rBook.title + '\n\n' + bookMd(rBook).split('\n').slice(1).join('\n')); });
/* ---- statistics: this year, month by month, and all of it ---- */
function pagesIn(b, y){ const log = (b.log || []).slice().sort((a, c) => a.d.localeCompare(c.d)); let prev = 0, n = 0;
  if(log.length){ log.forEach(x => { if(x.d.slice(0, 4) === y) n += Math.max(0, x.at - prev); prev = x.at; }); if(b.status === 'read' && String(b.finishedOn || b.finished || '').slice(0, 4) === y && b.pages) n += Math.max(0, b.pages - prev); return n; }
  return b.status === 'read' && String(b.finishedOn || b.finished || '').slice(0, 4) === y ? (b.pages || 0) : 0; }
function renderStats(){ const y = String(new Date().getFullYear()), done = R.filter(b => b.status === 'read'), thisY = done.filter(b => String(b.finishedOn || b.finished || '').slice(0, 4) === y);
  const months = Array.from({length: 12}, (_, m) => thisY.filter(b => +String(b.finishedOn || b.finished || '').slice(5, 7) === m + 1).length), mx = Math.max(1, ...months);
  const pagesY = R.reduce((n, b) => n + pagesIn(b, y), 0), withPages = done.filter(b => b.pages), avg = withPages.length ? Math.round(withPages.reduce((n, b) => n + b.pages, 0) / withPages.length) : 0;
  const reading = R.filter(b => b.status === 'reading'), hl = R.reduce((n, b) => n + (b.quotes || []).length, 0), M = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'], now = new Date().getMonth();
  $('rStats').innerHTML = '<div class="rs-in"><button type="button" class="rs-x" id="rsX" aria-label="Close">×</button><p class="rs-k">YOUR READING</p><h2>' + y + '</h2>' +
    '<div class="rs-big"><div><b>' + thisY.length + '</b><span>' + (thisY.length === 1 ? 'book' : 'books') + ' finished</span></div><div><b>' + pagesY.toLocaleString('en-GB') + '</b><span>pages read</span></div><div><b>' + reading.length + '</b><span>reading now</span></div></div>' +
    '<div class="rs-months">' + months.map((n, m) => '<div class="' + (m === now ? 'now' : '') + '"><i style="height:' + (n / mx * 100).toFixed(0) + '%"></i><em>' + (n || '') + '</em><span>' + M[m] + '</span></div>').join('') + '</div>' +
    (reading.length ? '<p class="rs-h">READING NOW</p>' + reading.map(b => { const pc = b.pages && b.at ? Math.round(b.at / b.pages * 100) : Math.round((b.progress || 0) * 100); return '<div class="rs-book"><span><b>' + esc(b.title) + '</b><em>' + (b.pages && b.at ? 'page ' + b.at + ' of ' + b.pages : b.started ? 'since ' + fmtD(b.started) : '') + '</em></span><i><i style="width:' + pc + '%"></i></i><b class="pc">' + pc + '%</b></div>'; }).join('') : '') +
    '<p class="rs-h">ALL OF IT</p><div class="rs-all"><span><b>' + done.length + '</b> books read</span><span><b>' + R.filter(b => b.status === 'want').length + '</b> waiting</span><span><b>' + (avg || '—') + '</b> pages on average</span><span><b>' + hl + '</b> highlights kept</span></div></div>';
  $('rsX').addEventListener('click', () => { $('rStats').hidden = true; }); }
$('rStatsBtn').addEventListener('click', () => { renderStats(); $('rStats').hidden = false; });
['rStatsBtn', 'rImportBtn', 'rExportBtn'].forEach(k => $(k).addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); $(k).click(); } }));

/* fewer buttons: the Readings tools live under one ⋯, and so do a book's own actions */
$('rMoreBtn').addEventListener('click', e => { e.stopPropagation(); rMenu([
  ['Statistics', 'Your reading this year', () => { renderStats(); $('rStats').hidden = false; }],
  ['Import from Kindle', 'My Clippings.txt, or a notebook the Kindle app exported', () => { impKind = 'clip'; $('rImpFile').accept = '.txt,.html,.htm,text/plain,text/html'; $('rImpFile').click(); }],
  ['Import from Goodreads', 'Your library export', () => { impKind = 'gr'; $('rImpFile').accept = '.csv,text/csv'; $('rImpFile').click(); }],
  ['Export', 'Every note and highlight, as Markdown', () => { $('rExportBtn').click(); setTimeout(() => { const b = document.querySelector('#rMenu [data-ri="0"]'); if(b) b.click(); }, 0); }]], $('rMoreBtn')); });
$('rMoreBtn').addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); $('rMoreBtn').click(); } });
$('rImpFile').addEventListener('change', () => {}, true);
$('rcMoreBtn').addEventListener('click', e => { e.stopPropagation(); if(!rBook) return; rMenu([
  ['Edit', 'Title, authors, ISBN, pages, cover', () => $('rcEditBtn').click()],
  ['Mind map', 'This book in the middle of a map', () => $('rcMind').click()],
  ['Put on a map', 'As a book you can link like a paper', () => { $('rcPut').click(); }],
  ['Export notes', 'This book’s notes and highlights', () => $('rcExp').click()],
  ['Remove', '', () => $('rcDel').click()]], $('rcMoreBtn')); });
/* a highlight is kept with Enter; a page written as “p. 12” at its start or end is kept as its page */
$('rcQText').addEventListener('keydown', e => { if(e.key !== 'Enter' || e.shiftKey) return; e.preventDefault(); let t = $('rcQText').value.trim(); if(!t) return;
  const m = t.match(/^\s*p\.?\s*(\d+)\s*[:·\-–—]?\s*/i) || t.match(/\s*\(?p\.?\s*(\d+)\)?\s*$/i);
  if(m){ $('rcQLoc').value = m[1]; t = t.replace(m[0], '').trim(); } $('rcQText').value = t; $('rcQAdd').click(); });
/* in Edit, the cover itself is the button: find one, upload one, or none */
$('rcCov').addEventListener('click', e => { if(!rcard.classList.contains('editing')) return; e.stopPropagation(); rMenu([
  ['Find a cover', 'From its ISBN or title', () => $('rfCovFind').click()], ['Upload a cover', '', () => $('rfCovUp').click()], ['No cover', '', () => $('rfCovDel').click()]], $('rcCov')); });
{ const _em = editMode; editMode = function(on){ _em(on); rcard.classList.toggle('editing', !!on); }; }

/* ===================== reading: the paper or the book on the left, your notes on the right, over the desk =====================
   PDFs are drawn by pdf.js, with their text selectable; EPUB, MOBI, AZW3, FB2 and comic books by foliate-js. Select words to
   quote them into your notes with their page, or to highlight them; highlights and notes are kept with your library. */
const VEND = 'assets/vendor/';
const NOTE_FONTS = [['book', "'PMap Serif', Georgia, serif", 'Book'], ['hand', "'PMap Ink', 'Bradley Hand', cursive", 'Handwriting'], ['baskerville', "Baskerville, 'Libre Baskerville', Georgia, serif", 'Baskerville'], ['palatino', "Palatino, 'Palatino Linotype', 'Book Antiqua', serif", 'Palatino'],
  ['hoefler', "'Hoefler Text', Garamond, Georgia, serif", 'Hoefler Text'], ['garamond', "Garamond, 'EB Garamond', 'Apple Garamond', Georgia, serif", 'Garamond'], ['georgia', 'Georgia, serif', 'Georgia'], ['times', "'Times New Roman', Times, serif", 'Times'],
  ['avenir', "'Avenir Next', Avenir, 'Helvetica Neue', sans-serif", 'Avenir'], ['helvetica', "'Helvetica Neue', Helvetica, Arial, sans-serif", 'Helvetica'], ['courier', "'Courier New', Courier, monospace", 'Courier']];
const SP = {kind: null, id: null, mode: null, pdf: null, view: null, marks: [], loc: null, caret: null, pending: null, notesT: null, at: 0, io: null};
const spFlow = () => { try{ return Object.assign({doc: 'side', notes: 'down'}, JSON.parse(localStorage.getItem('pm:readFlow') || '{}')); }catch(e){ return {doc: 'side', notes: 'down'}; } };
const spStyle = () => { try{ return Object.assign({paper: 'lines', font: 'book', size: 'm'}, JSON.parse(localStorage.getItem('pm:notesStyle') || '{}')); }catch(e){ return {paper: 'lines', font: 'book', size: 'm'}; } };
function spApplyStyle(){ const s = spStyle(), f = NOTE_FONTS.find(x => x[0] === s.font) || NOTE_FONTS[0], sh = $('spSheet'); sh.dataset.paper = s.paper; sh.classList.toggle('side', spFlow().notes === 'side'); requestAnimationFrame(() => sh.style.setProperty('--cw', Math.max(200, sh.clientWidth - 100) + 'px')); sh.style.setProperty('--nf', f[1]); sh.style.setProperty('--ns', {s: '14.5px', m: '16px', l: '18px'}[s.size] || '16px'); }
const spBook = () => R.find(x => x.id === SP.id) || null;
const spPaper = () => (P && P.paper ? P.paper(SP.id) : null) || (D.papers || []).find(x => x.id === SP.id) || null;
/* notes: kept as plain Markdown, shown as a page you write on */
function notesToHTML(md){ const L = String(md || '').replace(/\r/g, '').split('\n'); let h = '', list = false;
  const inl = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>');
  L.forEach(l => { if(/^\s*[-*] /.test(l)){ if(!list){ h += '<ul>'; list = true; } h += '<li>' + inl(l.replace(/^\s*[-*] /, '')) + '</li>'; return; } if(list){ h += '</ul>'; list = false; }
    if(/^>\s?/.test(l)){ const t = l.replace(/^>\s?/, ''), m = t.match(/^(.*?)\s+—\s+((?:p\.|loc\.|ch\.|§)\s?[^—]*|[^—]*\d+%)$/i); h += '<blockquote>' + inl(m ? m[1] : t) + (m ? '<cite contenteditable="false">' + esc(m[2]) + '</cite>' : '') + '</blockquote>'; return; }
    if(/^#{1,3} /.test(l)){ h += '<h3>' + inl(l.replace(/^#{1,3} /, '')) + '</h3>'; return; }
    h += '<p>' + (l.trim() ? inl(l) : '<br>') + '</p>'; });
  if(list) h += '</ul>'; return h || '<p><br></p>'; }
function notesToMD(el){ const out = [];
  el.childNodes.forEach(n => { if(n.nodeType === 3){ if(n.textContent.trim()) out.push(n.textContent.trim()); return; } if(n.nodeType !== 1) return;
    if(n.tagName === 'BLOCKQUOTE'){ const c = n.querySelector('cite'), t = [...n.childNodes].filter(x => !(x.nodeType === 1 && x.tagName === 'CITE')).map(x => x.textContent).join('').trim(); out.push('> ' + t + (c ? ' — ' + c.textContent.trim() : '')); }
    else if(/^H[1-6]$/.test(n.tagName)) out.push('### ' + n.textContent.trim());
    else if(n.tagName === 'UL' || n.tagName === 'OL') n.querySelectorAll('li').forEach(li => out.push('- ' + li.textContent.trim()));
    else out.push((n.innerText || '').replace(/\n+$/, '')); });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim(); }
function spSaveNotes(now){ clearTimeout(SP.notesT); const go = () => { if(!SP.kind) return; const md = notesToMD($('spNotes'));
  if(SP.kind === 'paper'){ if(P && P.setPaperNotes) P.setPaperNotes(SP.id, md); } else { const b = spBook(); if(b && (b.notes || '') !== md){ b.notes = md; b.edited = new Date().toISOString(); rSave(); } } };
  if(now) go(); else SP.notesT = setTimeout(go, 500); }
$('spNotes').addEventListener('input', () => spSaveNotes());
['keyup', 'pointerup'].forEach(ev => $('spNotes').addEventListener(ev, () => { const s = getSelection(); SP.caret = s && s.anchorNode; }));
$('spNotes').addEventListener('keydown', e => { if(e.key === 'Escape'){ e.stopPropagation(); $('spNotes').blur(); } });
function spQuote(text, loc){ const ed = $('spNotes'), bq = document.createElement('blockquote'); bq.appendChild(document.createTextNode(text));
  if(loc){ const c = document.createElement('cite'); c.contentEditable = 'false'; c.textContent = loc; bq.appendChild(c); }
  const p = document.createElement('p'); p.innerHTML = '<br>';
  let at = SP.caret && SP.caret.nodeType === 3 ? SP.caret.parentNode : SP.caret; while(at && at.parentNode && at.parentNode !== ed) at = at.parentNode;
  if(at && at.parentNode === ed) at.after(bq, p); else { const last = ed.lastElementChild; if(last && last.tagName === 'P' && !last.textContent.trim()) last.before(bq); else ed.append(bq, p); }
  SP.caret = p; bq.classList.add('fresh'); setTimeout(() => bq.classList.remove('fresh'), 1400); bq.scrollIntoView({block: 'nearest', behavior: 'smooth'}); spSaveNotes(true); }
/* ---- opening and closing ---- */
async function openSpread(kind, id, fromEl){
  if(busy) return; SP.kind = kind; SP.id = id; SP.mode = null; SP.pending = null; SP.caret = null;
  let title = '', who = '', md = '';
  if(kind === 'paper'){ const p = spPaper(); if(!p) return; title = p.t; who = [p.au, p.y].filter(Boolean).join(' · '); const rd = P && P.paperRead ? P.paperRead(id) : null; md = rd ? rd.n : (p.n || ''); SP.marks = rd ? rd.marks : []; SP.at = rd ? rd.at : 0; SP.stickies = rd ? rd.stickies || [] : []; }
  else { const b = spBook(); if(!b) return; title = b.title; who = [(b.authors || []).join(', '), b.year].filter(Boolean).join(' · '); md = b.notes || ''; SP.marks = (b.marks || []).slice(); SP.at = b.at || 0; SP.stickies = (b.stickies || []).slice(); }
  $('spStk').innerHTML = ''; setTimeout(spStkDraw, 60);
  $('spT').textContent = title; $('spA').textContent = who; $('spLoc').textContent = ''; $('spNotes').innerHTML = notesToHTML(md); spApplyStyle();
  $('spPop').hidden = true; $('spSel').hidden = true; $('spDoc').innerHTML = ''; $('spDoc').className = 'sp-doc';
  const sp = $('spread'); sp.hidden = false; document.body.classList.add('reading'); SP.from = fromEl || null;
  if(reduce || !fromEl){ requestAnimationFrame(() => requestAnimationFrame(() => sp.classList.add('on'))); spLoadDoc(); return; }
  sp.classList.add('on', 'arriving'); spLoadDoc(); await spArrive(kind, fromEl); sp.classList.remove('arriving');
}
/* the way in: a book leaves its shelf, comes to the middle closed, and its cover opens into the two pages;
   a paper leaves its pile and becomes the left page while a fresh sheet for your notes slides out beside it */
const spRect = el => { const r = el.getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height}; };
const spPlace = (el, r) => Object.assign(el.style, {left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px'});
function spMove(el, a, b, dur, ease){ return el.animate([{left: a.x + 'px', top: a.y + 'px', width: a.w + 'px', height: a.h + 'px'}, {left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px'}], {duration: dur, easing: ease || 'cubic-bezier(.3,.1,.2,1)', fill: 'forwards'}).finished.catch(() => {}); }
async function spArrive(kind, fromEl){
  const L = spRect(document.querySelector('#spread .sp-left')), Rt = spRect($('spSheet')), from = spRect(fromEl), bar = document.querySelector('#spread .sp-bar');
  const fade = (els, a, b, dur, delay) => els.forEach(e => e && e.animate([{opacity: a}, {opacity: b}], {duration: dur, delay: delay || 0, easing: 'ease-out', fill: 'both'}));
  const left = document.querySelector('#spread .sp-left'), right = document.querySelector('#spread .sp-right');
  fade([left, right, bar], 0, 0, 1);
  const fly = document.createElement('div'); fly.className = 'sp-fly ' + kind; document.body.appendChild(fly); spPlace(fly, from);
  const cs = getComputedStyle(fromEl); fly.style.background = cs.backgroundImage !== 'none' ? cs.backgroundImage + ' center/cover, ' + cs.backgroundColor : cs.background;
  if(kind === 'book'){
    /* the very cover from the shelf travels, scaled as one piece, so its gold lettering, its frame and its cloth stay exactly as they are */
    fly.remove(); const wrap = document.createElement('div'); wrap.className = 'sp-flywrap'; document.body.appendChild(wrap); spPlace(wrap, from);
    const cov = fromEl.cloneNode(true); cov.classList.add('sp-flycov'); wrap.appendChild(cov); fromEl.style.visibility = 'hidden';
    const k = Rt.h / from.h, w = from.w * k, dx = Rt.x + (Rt.w - w) / 2 - from.x, dy = Rt.y - from.y;
    await wrap.animate([{transform: 'none'}, {transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')'}], {duration: 600, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'forwards'}).finished.catch(() => {});
    const inner = document.createElement('i'); inner.className = 'sp-fly-in'; cov.appendChild(inner);
    fade([right], 0, 1, 380, 120);
    await cov.animate([{transform: 'perspective(' + (1800 / k) + 'px) rotateY(0deg)'}, {transform: 'perspective(' + (1800 / k) + 'px) rotateY(-180deg)'}], {duration: 760, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards'}).finished.catch(() => {});
    fade([left], 0, 1, 260); fade([bar], 0, 1, 320, 80); await new Promise(r => setTimeout(r, 200)); wrap.remove(); fromEl.style.visibility = '';
  } else {
    fly.remove(); const wrap = document.createElement('div'); wrap.className = 'sp-flywrap'; document.body.appendChild(wrap); spPlace(wrap, from);
    const host = document.createElement('figure'); host.className = 'pg sp-flypg'; const sh = fromEl.cloneNode(true); host.appendChild(sh); wrap.appendChild(host); fromEl.style.visibility = 'hidden';
    const k = L.h / from.h, w = from.w * k, dx = L.x + (L.w - w) / 2 - from.x, dy = L.y - from.y;
    right.animate([{transform: 'translateX(-60px)', opacity: 0}, {transform: 'none', opacity: 1}], {duration: 620, delay: 260, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both'});
    await wrap.animate([{transform: 'none'}, {transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')'}], {duration: 620, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'forwards'}).finished.catch(() => {});
    fade([left], 0, 1, 280); fade([bar], 0, 1, 320, 60); await new Promise(r => setTimeout(r, 240)); wrap.remove(); fromEl.style.visibility = '';
  }
}
async function spLoadDoc(){ const kind = SP.kind, id = SP.id;
  try{
    if(kind === 'paper'){ const p = spPaper(); if(p && p.pdf){ spMsg('Opening its PDF…'); const blob = await P.paperPdfBlob(id); if(SP.id !== id) return; if(blob) await spOpenPdf(blob); else spMsg('Its PDF could not be opened just now.' + (P.pdfWhy && P.pdfWhy() ? ' (' + P.pdfWhy() + ')' : '')); } else spEmpty(); return; }
    const b = spBook(), fs = (b && b.files) || [], f = fs.find(x => /\.(epub|mobi|azw3?|kf8|fb2|fbz|cbz)$/i.test(x.name)) || fs.find(x => /\.epub\.zip$|\.zip$/i.test(x.name)) || fs.find(x => /\.pdf$/i.test(x.name));
    if(!f){ spEmpty(); return; } spMsg('Opening ' + f.name + '…'); const blob = await P.bookFileBlob(f); if(SP.id !== id) return;
    if(!blob){ spMsg('The book’s file could not be read just now.'); return; }
    if(/\.pdf$/i.test(f.name)) await spOpenPdf(blob); else if(/\.zip$/i.test(f.name)){ const nf = await normalizeBook(new File([blob], f.name)); await spOpenEbook(nf, nf.name); } else await spOpenEbook(blob, f.name);
  }catch(err){ spMsg('This file could not be opened here.' + (err && err.message ? ' (' + String(err.message).slice(0, 60) + ')' : '')); }
}
function spMsg(t){ $('spDoc').className = 'sp-doc msg'; $('spDoc').innerHTML = '<p class="sp-m">' + esc(t) + '</p>'; }
function spEmpty(){ const book = SP.kind === 'book', b = book ? spBook() : null, p = book ? null : spPaper();
  $('spDoc').className = 'sp-doc empty';
  $('spDoc').innerHTML = (book && b && b.cover ? '<span class="sp-cov" style="background-image:url(&quot;' + esc(b.cover) + '&quot;)"></span>' : book && b ? '<span class="sp-covwrap">' + rbookHTML(b, 0).replace(/^<figure[^>]*>/, '').replace(/<figcaption>[\s\S]*$/, '') + '</span>' : '<span class="sp-cov none">' + esc((p && p.t) || '') + '</span>') +
    '<button type="button" class="sp-add" id="spAdd">' + (book ? 'Add the book · EPUB, MOBI, PDF' : 'Add its PDF') + '</button>';
  $('spAdd').addEventListener('click', () => { $('spFile').accept = book ? '.epub,.mobi,.azw,.azw3,.fb2,.fbz,.cbz,.pdf' : '.pdf,application/pdf'; $('spFile').click(); }); }
$('spFile').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if(!f || !P) return; spMsg('Keeping ' + f.name + ' with your library…');
  try{ if(SP.kind === 'book'){ const b = spBook(); const meta = await P.bookFileSave(b.id, f); b.files = (b.files || []).filter(x => x.path !== meta.path).concat([meta]); rSave(); }
    else { const ok = await P.attachPaperPdf(SP.id, f); D = load(); if(!ok) throw new Error('not kept'); }
    spLoadDoc(); }catch(err){ spMsg(String((err && err.message) || 'The file could not be kept.')); } });
function closeSpread(){ const sp = $('spread'); if(sp.hidden) return; spSaveNotes(true); $('spSel').hidden = true; $('spPop').hidden = true;
  /* the way out: the pages go back into what they came from */
  const from = SP.from && SP.from.isConnected ? SP.from : null;
  if(from && !reduce){ const fr = spRect(from), L = spRect(document.querySelector('#spread .sp-left'));
    if(SP.kind === 'book'){ const Rt = spRect($('spSheet')), k = Rt.h / fr.h, w = fr.w * k, wrap = document.createElement('div'); wrap.className = 'sp-flywrap'; document.body.appendChild(wrap); spPlace(wrap, fr);
      const cov = from.cloneNode(true); cov.classList.add('sp-flycov'); wrap.appendChild(cov); from.style.visibility = 'hidden';
      const t = 'translate(' + (Rt.x + (Rt.w - w) / 2 - fr.x) + 'px,' + (Rt.y - fr.y) + 'px) scale(' + k + ')';
      wrap.animate([{transform: t, opacity: .0}, {transform: t, opacity: 1, offset: .15}, {transform: 'none', opacity: 1}], {duration: 560, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards'}).finished.catch(() => {}).then(() => { wrap.remove(); from.style.visibility = ''; }); }
    else { const k = L.h / fr.h, w = fr.w * k, wrap = document.createElement('div'); wrap.className = 'sp-flywrap'; document.body.appendChild(wrap); spPlace(wrap, fr);
      const host = document.createElement('figure'); host.className = 'pg sp-flypg'; host.appendChild(from.cloneNode(true)); wrap.appendChild(host); from.style.visibility = 'hidden';
      const t = 'translate(' + (L.x + (L.w - w) / 2 - fr.x) + 'px,' + (L.y - fr.y) + 'px) scale(' + k + ')';
      wrap.animate([{transform: t, opacity: 0}, {transform: t, opacity: 1, offset: .15}, {transform: 'none', opacity: 1}], {duration: 540, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards'}).finished.catch(() => {}).then(() => { wrap.remove(); from.style.visibility = ''; }); } }
  sp.classList.remove('on'); document.body.classList.remove('reading');
  setTimeout(() => { sp.hidden = true; try{ SP.view && SP.view.close && SP.view.close(); }catch(e){} try{ SP.pdf && SP.pdf.destroy(); }catch(e){} try{ SP.io && SP.io.disconnect(); }catch(e){} SP.view = null; SP.pdf = null; $('spDoc').innerHTML = ''; SP.kind = null; }, 320);
  try{ if(state === 'books') renderReadings(); }catch(e){} }
$('spBack').addEventListener('click', closeSpread); $('spVeil').addEventListener('click', closeSpread);
/* ---- PDF: every page drawn as it comes into view, its words selectable ---- */
let deskPdf = null;
function deskPdfJs(){ if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib); return deskPdf || (deskPdf = new Promise((res, rej) => { const s = document.createElement('script'); s.src = VEND + 'pdfjs/pdf.min.js';
  s.onload = () => { try{ window.pdfjsLib.GlobalWorkerOptions.workerSrc = VEND + 'pdfjs/pdf.worker.min.js'; res(window.pdfjsLib); }catch(e){ rej(e); } }; s.onerror = () => { deskPdf = null; rej(new Error('pdf.js')); }; document.head.appendChild(s); })); }
async function spOpenPdf(blob){ const lib2 = await deskPdfJs(), doc = await lib2.getDocument({data: new Uint8Array(await blob.arrayBuffer())}).promise; SP.pdf = doc; SP.mode = 'pdf';
  const box = $('spDoc'), side = spFlow().doc === 'side'; box.className = 'sp-doc pdf' + (side ? ' side' : ''); box.innerHTML = ''; const p1 = await doc.getPage(1), v1 = p1.getViewport({scale: 1});
  const sc = side ? Math.min((box.clientHeight - 28) / v1.height, (box.clientWidth - 24) / v1.width) : Math.max(280, box.clientWidth - 44) / v1.width, W = Math.round(v1.width * sc); SP.scale = sc; SP.side = side; box.style.setProperty('--pw', W + 'px'); box.style.setProperty('--vw', box.clientWidth + 'px');
  for(let i = 1; i <= doc.numPages; i++){ const pg = document.createElement('div'); pg.className = 'sp-pg'; pg.dataset.page = i; pg.style.width = W + 'px'; pg.style.height = Math.round(v1.height * sc) + 'px'; box.appendChild(pg); }
  SP.io = new IntersectionObserver(es => es.forEach(en => { if(en.isIntersecting) spRenderPage(+en.target.dataset.page); }), {root: box, rootMargin: side ? '0px 900px' : '700px 0px'});
  box.querySelectorAll('.sp-pg').forEach(p => SP.io.observe(p));
  const onScroll = () => { const pgs = box.querySelectorAll('.sp-pg'), mid = side ? box.scrollLeft + box.clientWidth * .5 : box.scrollTop + box.clientHeight * .4; let cur = 1; pgs.forEach(p => { if((side ? p.offsetLeft : p.offsetTop) <= mid) cur = +p.dataset.page; });
    $('spLoc').textContent = 'p. ' + cur + ' / ' + doc.numPages; if(cur !== SP.cur){ SP.cur = cur; if(SP.kind === 'paper'){ if(P.setPaperAt) P.setPaperAt(SP.id, cur); } else { const b = spBook(); if(b && b.pdfAt !== cur){ b.pdfAt = cur; clearTimeout(SP.atT); SP.atT = setTimeout(rSave, 1500); } } } };
  box.addEventListener('scroll', onScroll, {passive: true});
  const back = SP.kind === 'paper' ? SP.at : ((spBook() || {}).pdfAt || 0); if(back > 1){ const t = box.querySelector('.sp-pg[data-page="' + back + '"]'); if(t){ if(side) box.scrollLeft = t.offsetLeft - (box.clientWidth - t.offsetWidth) / 2; else box.scrollTop = t.offsetTop - 12; } } onScroll(); }
async function spRenderPage(i){ const box = $('spDoc'), pg = box.querySelector('.sp-pg[data-page="' + i + '"]'); if(!pg || pg.dataset.done || !SP.pdf) return; pg.dataset.done = '1';
  try{ const page = await SP.pdf.getPage(i), vp = page.getViewport({scale: SP.scale}), dpr = Math.min(2, window.devicePixelRatio || 1);
    SP.dims = SP.dims || {}; SP.dims[i] = [page.view[2] - page.view[0], page.view[3] - page.view[1]]; spFromZotero(i);
    const cv = document.createElement('canvas'); cv.width = Math.floor(vp.width * dpr); cv.height = Math.floor(vp.height * dpr); cv.style.width = vp.width + 'px'; cv.style.height = vp.height + 'px'; pg.style.height = vp.height + 'px'; pg.appendChild(cv);
    await page.render({canvasContext: cv.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null}).promise;
    const tl = document.createElement('div'); tl.className = 'textLayer'; tl.style.setProperty('--scale-factor', SP.scale); pg.appendChild(tl);
    try{ await window.pdfjsLib.renderTextLayer({textContentSource: page.streamTextContent(), container: tl, viewport: vp, textDivs: []}).promise; }catch(e){}
    const ml = document.createElement('div'); ml.className = 'sp-marks'; pg.appendChild(ml); const sl = document.createElement('div'); sl.className = 'sp-pgstk'; pg.appendChild(sl); spDrawMarks(i); }catch(e){ pg.dataset.done = ''; } }
/* highlights and notes made in Zotero carry PDF coordinates (from the page's bottom-left): turned into places on the page */
function spFromZotero(i){ const dm = SP.dims && SP.dims[i]; if(!dm) return; const [W, H] = dm;
  SP.marks.forEach(m => { if(m.page !== i || !m.zr || !m.zr.length || m.rects) return; if(m.kind === 'note'){ m.x = m.zr[0][0] / W; m.y = 1 - m.zr[0][3] / H; } else m.rects = m.zr.map(r => [r[0] / W, 1 - r[3] / H, (r[2] - r[0]) / W, (r[3] - r[1]) / H]); }); }
function spDrawMarks(i){ const pg = $('spDoc').querySelector('.sp-pg[data-page="' + i + '"] .sp-marks'); if(!pg) return;
  spDrawPdfNotes(i);
  pg.innerHTML = SP.marks.filter(m => m.page === i && m.kind !== 'note').map(m => (m.rects || []).map(r => '<i style="left:' + (r[0] * 100).toFixed(3) + '%;top:' + (r[1] * 100).toFixed(3) + '%;width:' + (r[2] * 100).toFixed(3) + '%;height:' + (r[3] * 100).toFixed(3) + '%' + (m.color ? ';background:' + m.color : '') + '"></i>').join('')).join(''); }
/* ---- EPUB, MOBI, AZW3, FB2, comics: foliate-js ---- */
const EBOOK_CSS = 'html{color:#231E1A;background:transparent} body{font-family:"PMap Serif",Georgia,serif;line-height:1.55;hyphens:auto} p{text-align:justify} a{color:#7A3E2B} ::selection{background:rgba(180,67,46,.25)}';
/* a book locked by the store that sold it (Apple Books, Kindle, Adobe) can only be opened by that store's own app: say so plainly */
async function drmOf(blob){ try{ const base = new URL(VEND, document.baseURI).href, z = await import(base + 'foliate/vendor/zip.js'); try{ z.configure({useWebWorkers: false}); }catch(e){}
  const names = (await new z.ZipReader(new z.BlobReader(blob)).getEntries()).map(e => e.filename);
  if(names.some(n => /META-INF\/sinf\.xml$/i.test(n))) return 'Apple Books';
  if(names.some(n => /META-INF\/rights\.xml$/i.test(n))) return 'Adobe';
  const enc = (await new z.ZipReader(new z.BlobReader(blob)).getEntries()).find(e => /META-INF\/encryption\.xml$/i.test(e.filename));
  if(enc){ const t = await enc.getData(new z.TextWriter()); if(!/obfuscation|idpf\.org\/2008\/embedding|ns\.adobe\.com\/pdf\/enc#RC/i.test(t)) return 'its store'; } }catch(e){} return null; }
async function spOpenEbook(blob, name){ const box = $('spDoc'); box.className = 'sp-doc ebook'; box.innerHTML = '';
  if(/\.epub$/i.test(name || '')){ const who = await drmOf(blob); if(who){ spMsg('This book is locked by ' + who + ' (copy protection), so only that store\u2019s own app can open it. Books without copy protection open here.'); return; } }
  const base = new URL(VEND, document.baseURI).href; await import(base + 'foliate/view.js'); const {Overlayer} = await import(base + 'foliate/overlayer.js');
  const view = document.createElement('foliate-view'); box.appendChild(view); SP.view = view; SP.mode = 'ebook'; const b = spBook();
  view.addEventListener('load', e => { const {doc, index} = e.detail; doc.addEventListener('pointerup', () => setTimeout(() => spEbookSel(doc, index), 0)); doc.addEventListener('keydown', ev => spKeys(ev));
    /* right-click a word in the book for a sticky note there */
    doc.addEventListener('contextmenu', ev => { ev.preventDefault(); const r0 = doc.caretRangeFromPoint ? doc.caretRangeFromPoint(ev.clientX, ev.clientY) : null; if(!r0 || r0.startContainer.nodeType !== 3) return;
      const t = r0.startContainer, s = t.textContent; let a = r0.startOffset, z = r0.startOffset; while(a > 0 && /\S/.test(s[a - 1])) a--; while(z < s.length && /\S/.test(s[z])) z++; if(z <= a) return;
      const rg = doc.createRange(); rg.setStart(t, a); rg.setEnd(t, z); let cfi = null; try{ cfi = SP.view.getCFI(index, rg); }catch(err){} if(!cfi) return;
      SP.pending = {cfi, text: s.slice(a, z), loc: spEbookLoc(), doc}; spEbookNote(rg, doc); });
    doc.addEventListener('pointerdown', () => { $('spMk').hidden = true; }); });
  view.addEventListener('relocate', e => { const d = e.detail || {}; SP.loc = d; $('spLoc').textContent = spEbookLoc(); if(b && d.cfi && b.loc !== d.cfi){ b.loc = d.cfi; b.locLabel = spEbookLoc(); clearTimeout(SP.atT); SP.atT = setTimeout(rSave, 1500); } });
  view.addEventListener('draw-annotation', e => { const {draw, annotation} = e.detail; if(annotation.note) draw(spStickyDraw, {color: annotation.color || '#F6E27A'}); else draw(Overlayer.highlight, {color: annotation.color || 'rgba(242,207,87,.45)'}); });
  view.addEventListener('show-annotation', e => { const {value, range} = e.detail || {}; spMarkAt(value, range); });
  view.addEventListener('create-overlay', () => { SP.marks.filter(m => m.cfi).forEach(m => { try{ view.addAnnotation({value: m.cfi, color: m.color, note: m.kind === 'note'}); }catch(err){} }); });
  await view.open(new File([blob], name || 'book.epub', {type: blob.type || ''}));
  if(b && !b.cover){ try{ const cv = view.book && view.book.getCover ? await view.book.getCover() : null; if(cv){ const u = await spThumb(cv); if(u){ b.cover = u; rSave(); } } }catch(e){} }
  try{ view.renderer.setAttribute('flow', spFlow().doc === 'side' ? 'paginated' : 'scrolled'); view.renderer.setAttribute('max-column-count', '1'); view.renderer.setAttribute('margin', '44px'); view.renderer.setAttribute('gap', '7%'); view.renderer.setStyles && view.renderer.setStyles(EBOOK_CSS); }catch(e){}
  await view.init({lastLocation: (b && b.loc) || null, showTextStart: !(b && b.loc)});
  setTimeout(() => spPlaceKindle(view, b), 800); }
async function spThumb(blob){ return new Promise(res => { const url = URL.createObjectURL(blob), im = new Image(); im.onload = () => { const w = 360, h = Math.round(im.naturalHeight * w / im.naturalWidth), cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(im, 0, 0, w, h); URL.revokeObjectURL(url); res(cv.toDataURL('image/jpeg', 0.86)); }; im.onerror = () => res(null); im.src = url; }); }
async function spPageAsCover(){ const b = spBook(); if(!b) return;
  if(SP.mode === 'pdf' && SP.pdf){ const page = await SP.pdf.getPage(SP.cur || 1), v = page.getViewport({scale: 1}), sc = 360 / v.width, vp = page.getViewport({scale: sc}), cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    await page.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise; b.cover = cv.toDataURL('image/jpeg', 0.86); }
  else if(SP.mode === 'ebook' && SP.view && SP.view.book && SP.view.book.getCover){ const cvb = await SP.view.book.getCover(); if(!cvb){ toast('This book has no cover of its own'); return; } b.cover = await spThumb(cvb); }
  b.edited = new Date().toISOString(); rSave(); toast('That is its cover now'); }
function spEbookLoc(){ const d = SP.loc || {}; if(d.pageItem && d.pageItem.label) return 'p. ' + d.pageItem.label;
  /* no printed pages in the file: its place the way a Kindle gives it, as a location */
  const loc = d.location && typeof d.location.current === 'number' ? 'loc. ' + (d.location.current + 1) : Math.round((d.fraction || 0) * 100) + '%';
  return [d.tocItem && d.tocItem.label, loc].filter(Boolean).join(', '); }
function spEbookSel(doc, index){ const sel = doc.getSelection(); if(!sel || sel.isCollapsed){ $('spSel').hidden = true; return; } const range = sel.getRangeAt(0), text = sel.toString().replace(/\s+/g, ' ').trim(); if(!text) return;
  let cfi = null; try{ cfi = SP.view.getCFI(index, range); }catch(e){}
  const fe = doc.defaultView && doc.defaultView.frameElement, fr = fe ? fe.getBoundingClientRect() : {left: 0, top: 0}, rr = range.getBoundingClientRect();
  SP.pending = {cfi, text, loc: spEbookLoc(), doc}; spShowSel({left: fr.left + rr.left, top: fr.top + rr.top, width: rr.width}); }
/* ---- selecting words: quote them with their page, or highlight them ---- */
document.addEventListener('pointerup', () => { if(!SP.kind || SP.mode !== 'pdf') return; setTimeout(() => { const sel = getSelection(); if(!sel || sel.isCollapsed || !sel.rangeCount){ if(!$('spSel').matches(':hover')) $('spSel').hidden = true; return; }
  const r = sel.getRangeAt(0), host = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentNode), pg = host && host.closest && host.closest('.sp-pg'); if(!pg) return;
  const text = sel.toString().replace(/\s+/g, ' ').trim(); if(!text) return; const pb = pg.getBoundingClientRect();
  const rects = [...r.getClientRects()].filter(x => x.width > 1 && x.height > 1 && x.left >= pb.left - 2 && x.right <= pb.right + 2).map(x => [(x.left - pb.left) / pb.width, (x.top - pb.top) / pb.height, x.width / pb.width, x.height / pb.height]);
  SP.pending = {page: +pg.dataset.page, text, rects, loc: 'p. ' + pg.dataset.page}; spShowSel(r.getBoundingClientRect()); }, 0); });
function spShowSel(r){ const s = $('spSel'); $('spSelLoc').textContent = SP.pending && SP.pending.loc ? ' · ' + SP.pending.loc : ''; s.hidden = false; const w = s.offsetWidth || 160;
  s.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + (r.width || 0) / 2 - w / 2)) + 'px'; s.style.top = Math.max(12, r.top - 46) + 'px'; }
function spKeep(asQuote, colour){ const p = SP.pending; if(!p) return; const mark = {id: 'm-' + Date.now().toString(36), text: p.text, color: colour || (asQuote ? 'rgba(180,67,46,.22)' : 'rgba(242,207,87,.45)'), date: today()};
  if(p.cfi) mark.cfi = p.cfi; else { mark.page = p.page; mark.rects = p.rects; }
  SP.marks.push(mark);
  if(SP.kind === 'paper'){ if(P.setPaperMarks) P.setPaperMarks(SP.id, SP.marks); if(asQuote && P.addPaperQuote) P.addPaperQuote(SP.id, {id: 'q-' + Date.now().toString(36), text: p.text, loc: p.loc, date: today(), src: 'read'}); }
  else { const b = spBook(); if(b){ b.marks = SP.marks.slice(); if(asQuote) b.quotes = (b.quotes || []).concat([{id: 'q-' + Date.now().toString(36), text: p.text, loc: p.loc, date: today(), src: 'read'}]); b.edited = new Date().toISOString(); rSave(); } }
  if(p.cfi && SP.view){ try{ SP.view.addAnnotation({value: p.cfi, color: mark.color}); }catch(e){} } else if(p.page) spDrawMarks(p.page);
  if(asQuote) spQuote(p.text, p.loc);
  try{ (p.doc ? p.doc.getSelection() : getSelection()).removeAllRanges(); }catch(e){} $('spSel').hidden = true; SP.pending = null; }
$('spSel').addEventListener('pointerdown', e => e.preventDefault());
$('spSel').addEventListener('click', e => { const b = e.target.closest('[data-sel]'); if(!b) return; if(b.dataset.sel === 'note'){ spNoteOnSel(); return; } spKeep(b.dataset.sel === 'quote', b.dataset.hc); });
/* ---- turning pages ---- */
function spTurn(d){ if(SP.mode === 'ebook' && SP.view){ d > 0 ? SP.view.next() : SP.view.prev(); } else if(SP.mode === 'pdf'){ const box = $('spDoc'); if(SP.side){ box.scrollBy({left: d * box.clientWidth, behavior: 'smooth'}); } else box.scrollBy({top: d * box.clientHeight * .9, behavior: 'smooth'}); } }
$('spPrev').addEventListener('click', () => spTurn(-1)); $('spNext').addEventListener('click', () => spTurn(1));
function spKeys(e){ if(!SP.kind || (e.target && e.target.closest && e.target.closest('#spNotes'))) return; if(e.key === 'ArrowRight' || e.key === 'PageDown'){ e.preventDefault(); spTurn(1); } else if(e.key === 'ArrowLeft' || e.key === 'PageUp'){ e.preventDefault(); spTurn(-1); } else if(e.key === 'Escape'){ if(!$('spPop').hidden) $('spPop').hidden = true; else closeSpread(); } }
addEventListener('keydown', spKeys, true);
/* ---- ⓘ about it, Aa paper and type, ⋯ the rest ---- */
function spPopAt(btn, html){ const p = $('spPop'); p.classList.remove('sp-menu'); if(!p.hidden && p._from === btn){ p.hidden = true; return null; } p.innerHTML = html; p._from = btn; p.hidden = false; const r = btn.getBoundingClientRect(), w = p.offsetWidth || 320; p.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.right - w)) + 'px'; p.style.top = (r.bottom + 10) + 'px'; return p; }
$('spInfo').addEventListener('click', e => { e.stopPropagation(); let h = '';
  if(SP.kind === 'book'){ const b = spBook(); if(!b) return; const kq = (b.quotes || []).filter(q => q.src === 'kindle').length, mq = (b.quotes || []).length - kq;
    h = '<div class="sp-about">' + (b.cover ? '<span class="sp-acov" style="background-image:url(&quot;' + esc(b.cover) + '&quot;)"></span>' : '') + '<div><p class="k">' + esc([b.year, b.pages ? b.pages + ' pages' : ''].filter(Boolean).join(' · ')) + '</p><b>' + esc(b.title) + '</b><em>' + esc((b.authors || []).join(', ')) + '</em></div></div>' +
      '<dl><dt>Status</dt><dd>' + esc(metaLine(b)) + '</dd>' + (b.isbn ? '<dt>ISBN</dt><dd>' + esc(b.isbn) + '</dd>' : '') + (b.started ? '<dt>Started</dt><dd>' + esc(fmtD(b.started)) + '</dd>' : '') + ((b.categories || []).length ? '<dt>Shelves</dt><dd>' + esc(b.categories.join(', ')) + '</dd>' : '') +
      '<dt>Highlights</dt><dd>' + ((b.quotes || []).length ? (mq ? mq + ' yours' : '') + (mq && kq ? ' · ' : '') + (kq ? kq + ' from <span class="kd">Kindle</span>' : '') : 'none yet') + '</dd>' + ((b.files || []).length ? '<dt>Files</dt><dd>' + esc(b.files.map(f => f.name).join(', ')) + '</dd>' : '') + '</dl>'; }
  else { const p = spPaper(); if(!p) return; h = '<div class="sp-about"><div><p class="k">' + esc([p.y, p.v].filter(Boolean).join(' · ')) + '</p><b>' + esc(p.t) + '</b><em>' + esc(p.au || '') + '</em></div></div><dl><dt>Status</dt><dd>' + esc(p.st === 'read' ? 'Read' : p.st === 'want' ? 'Want to read' : 'Not marked') + '</dd>' + (p.where ? '<dt>On the map</dt><dd>' + esc(p.where) + '</dd>' : '') + ((p.tags || []).length ? '<dt>Tags</dt><dd>' + esc(p.tags.join(', ')) + '</dd>' : '') + (() => { const rel = P && P.paperLinks ? P.paperLinks(SP.id) : []; return rel.length ? '<dt>Related to</dt><dd>' + esc(rel.join('; ')) + '</dd>' : ''; })() + (p.url ? '<dt>Link</dt><dd><a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.url.replace(/^https?:\/\//, '').slice(0, 40)) + '</a></dd>' : '') + '</dl>'; }
  spPopAt($('spInfo'), h); });
$('spStyle').addEventListener('click', e => { e.stopPropagation(); const s = spStyle();
  const p = spPopAt($('spStyle'), '<p class="k">PAPER</p><div class="sp-seg" data-k="paper">' + [['blank', 'Blank'], ['lines', 'Lines'], ['grid', 'Grid']].map(x => '<button type="button" data-v="' + x[0] + '"' + (s.paper === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>').join('') + '</div>' +
    '<p class="k">SIZE</p><div class="sp-seg" data-k="size">' + [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']].map(x => '<button type="button" data-v="' + x[0] + '"' + (s.size === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>').join('') + '</div>' +
    '<p class="k">PAGES</p><div class="sp-flowrow"><span>' + (SP.kind === 'book' ? 'The book' : 'The paper') + '</span><div class="sp-seg">' + [['side', 'Side to side'], ['down', 'Top to bottom']].map(x => '<button type="button" data-flow="doc" data-v="' + x[0] + '"' + (spFlow().doc === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>').join('') + '</div></div><div class="sp-flowrow"><span>Your notes</span><div class="sp-seg">' + [['side', 'A4 pages'], ['down', 'One long page']].map(x => '<button type="button" data-flow="notes" data-v="' + x[0] + '"' + (spFlow().notes === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>').join('') + '</div></div>' +
    '<p class="k">TYPE</p><div class="sp-fonts" data-k="font">' + NOTE_FONTS.map(f => '<button type="button" data-v="' + f[0] + '"' + (s.font === f[0] ? ' class="on"' : '') + ' style="font-family:' + f[1].replace(/"/g, '&quot;') + '">' + f[2] + '</button>').join('') + '</div>');
  if(!p) return; p.onclick = ev => { const f = ev.target.closest('[data-flow]');
    if(f){ const st = spFlow(); if(st[f.dataset.flow] === f.dataset.v) return; st[f.dataset.flow] = f.dataset.v; localStorage.setItem('pm:readFlow', JSON.stringify(st)); f.parentNode.querySelectorAll('[data-flow]').forEach(x => x.classList.toggle('on', x === f));
      if(f.dataset.flow === 'notes') spApplyStyle(); else { if(SP.mode === 'ebook' && SP.view){ try{ SP.view.renderer.setAttribute('flow', st.doc === 'side' ? 'paginated' : 'scrolled'); }catch(e){} } else if(SP.mode === 'pdf'){ try{ SP.io && SP.io.disconnect(); SP.pdf && SP.pdf.destroy(); }catch(e){} SP.pdf = null; spLoadDoc(); } } return; }
    const b = ev.target.closest('[data-v]'); if(!b) return; const grp = b.parentNode.dataset.k, st = spStyle(); st[grp] = b.dataset.v; localStorage.setItem('pm:notesStyle', JSON.stringify(st)); b.parentNode.querySelectorAll('[data-v]').forEach(x => x.classList.toggle('on', x === b)); spApplyStyle(); }; });
$('spMore').addEventListener('click', e => { e.stopPropagation(); const items = [];
  if(SP.kind === 'book'){ const b = spBook(); items.push(['Edit the book', 'Title, authors, ISBN, pages, cover', () => { const bb = spBook(); closeSpread(); setTimeout(() => { openRCard(bb); $('rcEditBtn').click(); }, 340); }], ['Its mind map', 'This book in the middle of a map', () => { spSaveNotes(true); P.mindFor && P.mindFor('book', b.id); }], ['Add another file', 'EPUB, MOBI, PDF…', () => { $('spFile').click(); }]); if(SP.mode === 'pdf') items.push(['Use this page as its cover', 'The page you are on', spPageAsCover]); else if(SP.mode === 'ebook') items.push(['Use the book’s own cover', 'The cover inside the file', spPageAsCover]); }
  else { const id = SP.id; items.push(['Show it on its map', '', () => { spSaveNotes(true); closeSpread(); P.openPaper(id, 'paper'); }], ['Its mind map', 'This paper in the middle of a map', () => { spSaveNotes(true); P.mindFor && P.mindFor('paper', id); }], ['Details and lines', 'Where it sits, what it builds on', () => { closeSpread(); setTimeout(() => { try{ openPaperPage(id, null); }catch(err){} }, 340); }], ['Edit details', '', () => P.editPaper(id)]); }
  if(SP.kind === 'book') items.push(['Delete this book', 'From your shelves, with its notes and highlights', () => { const b = spBook(); if(b) deleteBook(b.id, () => closeSpread()); }]);
  else items.push(['Delete this paper', 'From your library and from any map it is on', () => { const id = SP.id; P.deletePaper(id, () => { closeSpread(); setTimeout(() => { try{ pReload(); }catch(e){} }, 700); }); }]);
  /* the file itself, saved where downloads go: the paper's PDF (from GitHub or Zotero, wherever it is kept), or the book's file */
  { const fname = s => String(s || 'file').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 90);
    if(SP.kind === 'paper' && spPaper() && spPaper().pdf) items.push(['Save the PDF with my marks', 'Highlights, notes and handwriting written into it', async () => { toast('Writing your marks into the PDF…'); try{ const b = await pdfWithMarks(SP.id); P.saveBlob(b, fname($('spT').textContent) + ' (marked).pdf'); }catch(err){ toast('The PDF could not be written just now'); } }]);
    if(SP.kind === 'paper'){ const id = SP.id; if(spPaper() && spPaper().pdf) items.push(['Save the PDF', 'A copy of the paper, in your Downloads', async () => { toast('Saving the PDF…'); const b = await P.paperPdfBlob(id); if(!b){ toast('The PDF could not be fetched just now'); return; } P.saveBlob(b, fname($('spT').textContent) + '.pdf'); }]); }
    else { const bk = spBook(), f = bk && (bk.files || [])[0]; if(f) items.push(['Save the book file', 'A copy of ' + (f.name || 'the file') + ', in your Downloads', async () => { toast('Saving the file…'); const b = await P.bookFileBlob(f); if(!b){ toast('The file could not be fetched just now'); return; } P.saveBlob(b, f.name || (fname(bk.title) + '.pdf')); }]); } }
  items.push(['Export the notes', 'As Markdown, quotes with their pages', () => { const md = '# ' + $('spT').textContent + '\n\n*' + $('spA').textContent + '*\n\n' + notesToMD($('spNotes')); if(P && P.saveBlob) P.saveBlob(new Blob([md], {type: 'text/markdown;charset=utf-8'}), $('spT').textContent.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80) + ' notes.md'); }]);
  /* the menu opens from the button itself, inside the reading page (the Readings menu lives on the shelves, which are hidden here) */
  const p = spPopAt($('spMore'), items.map((it, i) => '<button type="button" class="sp-act" data-act="' + i + '"><b>' + esc(it[0]) + '</b>' + (it[1] ? '<span>' + esc(it[1]) + '</span>' : '') + '</button>').join(''));
  if(!p) return; p.classList.add('sp-menu'); p.onclick = ev => { const b = ev.target.closest('[data-act]'); if(!b) return; $('spPop').hidden = true; p.classList.remove('sp-menu'); items[+b.dataset.act][2](); }; });
addEventListener('click', e => { if(!e.target.closest('#spPop,#spInfo,#spStyle')) $('spPop').hidden = true; });

/* ===================== sticky notes: on a page of the PDF, and on your notes ===================== */
const STK_COLORS = ['#F6E27A', '#F4B7A0', '#B9DDB0', '#B8D3EE'];
function spSaveMarks(){ if(SP.kind === 'paper'){ if(P.setPaperMarks) P.setPaperMarks(SP.id, SP.marks); } else { const b = spBook(); if(b){ b.marks = SP.marks.slice(); b.edited = new Date().toISOString(); rSave(); } } }
function spSaveStickies(){ if(SP.kind === 'paper'){ if(P.setPaperStickies) P.setPaperStickies(SP.id, SP.stickies); } else { const b = spBook(); if(b){ b.stickies = SP.stickies.slice(); b.edited = new Date().toISOString(); rSave(); } } }
function stkHTML(n, where){ return '<div class="sp-sticky' + (n.open ? ' open' : '') + '" data-stk="' + esc(n.id) + '" data-where="' + where + '" style="left:' + (n.x * 100).toFixed(2) + '%;' + (where === 'sheet' ? 'top:' + Math.round(n.y) + 'px' : 'top:' + (n.y * 100).toFixed(2) + '%') + ';--sc:' + (n.color || STK_COLORS[0]) + '">' +
  '<i class="fold"></i><div class="tx" contenteditable="true" spellcheck="true" data-ph="A note…">' + esc(n.text || '') + '</div>' + (n.quote ? '<p class="q">“' + esc(n.quote.slice(0, 90)) + (n.quote.length > 90 ? '…' : '') + '”</p>' : '') +
  '<span class="bar">' + STK_COLORS.map(c => '<button type="button" data-stkc="' + c + '" style="background:' + c + '" aria-label="Colour"></button>').join('') + '<button type="button" class="del" data-stkdel="1" aria-label="Remove the note">×</button></span></div>'; }
function spDrawPdfNotes(i){ const lay = $('spDoc').querySelector('.sp-pg[data-page="' + i + '"] .sp-pgstk'); if(!lay) return; lay.innerHTML = SP.marks.filter(m => m.kind === 'note' && m.page === i).map(n => stkHTML(n, 'pdf')).join(''); }
function spStkDraw(){ const lay = $('spStk'); if(!lay) return; lay.style.height = Math.max($('spNotes').scrollHeight, $('spSheet').clientHeight) + 'px'; lay.innerHTML = (SP.stickies || []).map(n => stkHTML(n, 'sheet')).join(''); }
function spNewPdfNote(page, x, y, quote){ const n = {id: 'n-' + Date.now().toString(36), kind: 'note', page, x: Math.max(0, Math.min(.86, x)), y: Math.max(0, Math.min(.92, y)), text: '', quote: quote || '', color: STK_COLORS[0], date: today(), open: true};
  SP.marks.forEach(m => { if(m.kind === 'note') m.open = false; }); SP.marks.push(n); spDrawPdfNotes(page); spSaveMarks(); setTimeout(() => { const t = $('spDoc').querySelector('[data-stk="' + n.id + '"] .tx'); if(t) t.focus(); }, 30); }
function spNewSheetNote(x, y){ const n = {id: 's-' + Date.now().toString(36), x: Math.max(0, Math.min(.72, x)), y: Math.max(0, y), text: '', color: STK_COLORS[0], date: today(), open: true};
  (SP.stickies || []).forEach(s => s.open = false); SP.stickies = (SP.stickies || []).concat([n]); spStkDraw(); spSaveStickies(); setTimeout(() => { const t = $('spStk').querySelector('[data-stk="' + n.id + '"] .tx'); if(t) t.focus(); }, 30); }
function spNoteOnSel(){ const p = SP.pending; if(!p) return; if(p.page && p.rects && p.rects.length){ const r = p.rects[p.rects.length - 1]; spNewPdfNote(p.page, r[0] + r[2] + .01, r[1] - .01, p.text); }
  else if(p.cfi && SP.mode === 'ebook'){ let rg = null; try{ const s = p.doc.getSelection(); rg = s && s.rangeCount ? s.getRangeAt(0).cloneRange() : null; }catch(e){} spEbookNote(rg, p.doc); return; }
  else spNewSheetNote(.55, ($('spSheet').scrollTop || 0) + 60);
  try{ (p.doc ? p.doc.getSelection() : getSelection()).removeAllRanges(); }catch(e){} $('spSel').hidden = true; SP.pending = null; }
function stkFind(el){ const id = el.closest('[data-stk]').dataset.stk, where = el.closest('[data-stk]').dataset.where; return where === 'pdf' ? [SP.marks.find(m => m.id === id), 'pdf'] : [(SP.stickies || []).find(s => s.id === id), 'sheet']; }
function stkSave(where){ where === 'pdf' ? spSaveMarks() : spSaveStickies(); }
/* right-click a page or your notes for a sticky note there */
document.addEventListener('contextmenu', e => { if(!SP.kind) return; const pg = e.target.closest && e.target.closest('#spDoc .sp-pg'), sh = e.target.closest && e.target.closest('#spSheet');
  if(!pg && !sh) return; if(e.target.closest('.sp-sticky')) return; e.preventDefault();
  if(pg){ const r = pg.getBoundingClientRect(); spNewPdfNote(+pg.dataset.page, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, ''); }
  else { const r = $('spSheet').getBoundingClientRect(); spNewSheetNote((e.clientX - r.left) / r.width, e.clientY - r.top + $('spSheet').scrollTop); } });
/* a note folds to a small square; a click opens it; drag it by its edge to move it */
document.addEventListener('pointerdown', e => { const st = e.target.closest && e.target.closest('.sp-sticky'); if(!SP.kind) return;
  document.querySelectorAll('#spread .sp-sticky.open').forEach(x => { if(x !== st){ x.classList.remove('open'); const [n] = stkFind(x); if(n) n.open = false; } });
  if(!st || e.target.closest('.tx') || e.target.closest('button')) return;
  const [n, where] = stkFind(st); if(!n) return; const host = st.parentNode, hr = host.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, ox = n.x, oy = n.y; let moved = false;
  const mv = ev => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if(Math.hypot(dx, dy) > 3) moved = true; if(!moved) return; n.x = Math.max(0, Math.min(.92, ox + dx / hr.width)); n.y = where === 'pdf' ? Math.max(0, Math.min(.95, oy + dy / hr.height)) : Math.max(0, oy + dy); st.style.left = (n.x * 100) + '%'; st.style.top = where === 'pdf' ? (n.y * 100) + '%' : n.y + 'px'; };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if(moved) stkSave(where); else { st.classList.add('open'); n.open = true; const t = st.querySelector('.tx'); t && t.focus(); } };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); });
document.addEventListener('input', e => { const t = e.target.closest && e.target.closest('.sp-sticky .tx'); if(!t) return; const [n, where] = stkFind(t); if(!n) return; n.text = t.innerText.trim(); clearTimeout(SP.stkT); SP.stkT = setTimeout(() => stkSave(where), 500); });
document.addEventListener('click', e => { const st = e.target.closest && e.target.closest('.sp-sticky'); if(!st) return; const [n, where] = stkFind(st); if(!n) return;
  const c = e.target.closest('[data-stkc]'); if(c){ n.color = c.dataset.stkc; st.style.setProperty('--sc', n.color); stkSave(where); if(n.cfi && SP.view){ try{ SP.view.deleteAnnotation({value: n.cfi}); SP.view.addAnnotation({value: n.cfi, color: n.color, note: true}); }catch(err){} } return; }
  if(e.target.closest('[data-stkdel]')){ if(n.cfi && SP.view){ try{ SP.view.deleteAnnotation({value: n.cfi}); }catch(err){} $('spEbNote').hidden = true; } if(where === 'pdf'){ SP.marks = SP.marks.filter(m => m.id !== n.id); spDrawPdfNotes(n.page); } else { SP.stickies = SP.stickies.filter(s => s.id !== n.id); spStkDraw(); } stkSave(where); } });

/* notes in A4 pages, Paper Map's own format: each page is one sheet; when a page is full the writing goes on to the next,
   and the page turns with it; ‹ › turn the pages yourself */
function spNStep(){ return $('spSheet').clientWidth; }
function spNPages(){ const ed = $('spNotes'), sh = $('spSheet'), on = sh.classList.contains('side'); $('spNpg').hidden = !on; if(!on) return;
  const step = spNStep(), total = Math.max(1, Math.round(ed.scrollWidth / step)), cur = Math.min(total - 1, Math.round(ed.scrollLeft / step));
  $('spNNum').textContent = (cur + 1) + ' / ' + total; $('spNPrev').disabled = cur <= 0; $('spNNext').disabled = cur >= total - 1; }
function spNTurn(d){ const ed = $('spNotes'), step = spNStep(), cur = Math.round(ed.scrollLeft / step); ed.scrollTo({left: Math.max(0, cur + d) * step, behavior: reduce ? 'auto' : 'smooth'}); setTimeout(spNPages, 380); }
function spNFollow(){ const sh = $('spSheet'); if(!sh.classList.contains('side')) return; const s = getSelection(); if(!s || !s.rangeCount) return;
  const r = s.getRangeAt(0).getClientRects()[0] || s.getRangeAt(0).getBoundingClientRect(), box = sh.getBoundingClientRect(); if(!r || (!r.width && !r.height && !r.left)) return;
  const ed = $('spNotes'), step = spNStep(), page = Math.floor((r.left - box.left + ed.scrollLeft) / step), cur = Math.round(ed.scrollLeft / step);
  if(page !== cur && page >= 0){ ed.scrollTo({left: page * step, behavior: reduce ? 'auto' : 'smooth'}); setTimeout(spNPages, 380); } else spNPages(); }
$('spNPrev').addEventListener('click', () => spNTurn(-1)); $('spNNext').addEventListener('click', () => spNTurn(1));
['input', 'keyup', 'pointerup'].forEach(ev => $('spNotes').addEventListener(ev, () => requestAnimationFrame(spNFollow)));
$('spNotes').addEventListener('wheel', e => { if($('spSheet').classList.contains('side') && Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault(); }, {passive: false});
{ const _ap = spApplyStyle; spApplyStyle = function(){ _ap(); requestAnimationFrame(() => requestAnimationFrame(() => { const ed = $('spNotes'); if(!$('spSheet').classList.contains('side')) ed.scrollLeft = 0; spNPages(); })); }; }
/* the desk's own settings, from the reading page: its wood, its paper, your cup */
$('spGear').addEventListener('click', e => { e.stopPropagation(); $('spPop').hidden = true; panel.classList.toggle('on'); });

/* the research log and the cloud, on every screen but the desk itself: they open over whatever you are doing */
document.addEventListener('click', e => { const b = e.target.closest('[data-over]'); if(!b || !P || !P.over) return; e.stopPropagation(); const r = b.getBoundingClientRect();
  if(b.classList.contains('on')){ P.closeOver(); document.querySelectorAll('[data-over].on').forEach(x => x.classList.remove('on')); return; }
  document.querySelectorAll('[data-over].on').forEach(x => x.classList.remove('on')); P.closeOver(); b.classList.add('on');
  P.over(b.dataset.over, {left: r.left, right: r.right, top: r.top, bottom: r.bottom}); }, true);
document.addEventListener('pointerdown', e => { if(e.target.closest && e.target.closest('[data-over]')) return; if(P && P.closeOver){ P.closeOver(); document.querySelectorAll('[data-over].on').forEach(x => x.classList.remove('on')); } }, true);

/* ============ the first time at the desk: a short tour of what lies on it ============ */
const DT_STEPS = [
  {sel: '#maps', title: 'Your maps', text: 'For when it is time to think it through. Click them to see every map.'},
  {sel: '#papersLayer', title: 'Papers', text: 'Every paper you keep. Open one to read it, with your notes beside it.'},
  {sel: '#book', title: 'Readings', text: 'Your books, on their shelves. Open one and read it right here.'},
  {sel: '#memo', title: 'Your research log', text: 'For a thought, whenever it comes. It is on every screen, too.'}];
const DT = {i: 0, el: null};
function deskTour(force){
  if(!force){ try{ if(localStorage.getItem('pm:deskTour')) return; }catch(e){ return; } }
  if(state !== 'desk' || DT.el) return;
  const el = document.createElement('div'); el.id = 'dtour'; el.innerHTML = '<div class="dt-hole" id="dtHole"></div><div class="dt-card" id="dtCard" role="dialog" aria-live="polite"><p class="dt-k" id="dtK"></p><b id="dtT"></b><span id="dtX"></span><div class="dt-bt"><button type="button" class="dt-skip" id="dtSkip">Skip</button><button type="button" class="dt-next" id="dtNext">Next</button></div></div>';
  document.body.appendChild(el); DT.el = el; DT.i = 0;
  el.addEventListener('click', e => { if(e.target.id === 'dtNext'){ DT.i++; if(DT.i >= DT_STEPS.length) deskTourEnd(); else dtShow(); } else if(e.target.id === 'dtSkip') deskTourEnd(); });
  requestAnimationFrame(() => { el.classList.add('on'); dtShow(); }); }
/* what to light up: the pile of maps as one, the notebook with both its pages */
function dtRect(s){ if(s.sel === '#maps'){ const rs = [...document.querySelectorAll('#maps .ms')].filter(e => getComputedStyle(e).opacity !== '0').map(e => e.getBoundingClientRect()); if(!rs.length) return null;
    return {left: Math.min(...rs.map(r => r.left)), top: Math.min(...rs.map(r => r.top)), right: Math.max(...rs.map(r => r.right)), bottom: Math.max(...rs.map(r => r.bottom))}; }
  const t = document.querySelector(s.sel); if(!t) return null; const r = t.getBoundingClientRect();
  if(s.sel === '#memo') return {left: r.left - r.width * .2, top: r.top - r.height * .02, right: r.right + r.width * .72, bottom: r.bottom + r.height * .03};
  return {left: r.left, top: r.top, right: r.right, bottom: r.bottom}; }
function dtShow(){ const s = DT_STEPS[DT.i], q = dtRect(s); if(!q){ deskTourEnd(); return; }
  const r = {left: q.left, top: q.top, right: q.right, bottom: q.bottom, width: q.right - q.left, height: q.bottom - q.top}, pad = 16, hole = $('dtHole'), card = $('dtCard');
  Object.assign(hole.style, {left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px'});
  $('dtK').textContent = (DT.i + 1) + ' OF ' + DT_STEPS.length; $('dtT').textContent = s.title; $('dtX').textContent = s.text; $('dtNext').textContent = DT.i === DT_STEPS.length - 1 ? 'Done' : 'Next';
  const cw = 300, ch = card.offsetHeight || 150, right = r.right + 28 + cw < innerWidth;
  card.style.left = Math.max(16, Math.min(innerWidth - cw - 16, right ? r.right + 28 : r.left - cw - 28)) + 'px';
  card.style.top = Math.max(16, Math.min(innerHeight - ch - 16, r.top + r.height / 2 - ch / 2)) + 'px';
  card.classList.remove('in'); void card.offsetWidth; card.classList.add('in'); }
function deskTourEnd(){ try{ localStorage.setItem('pm:deskTour', '1'); }catch(e){} const el = DT.el; DT.el = null; if(!el) return; el.classList.remove('on'); setTimeout(() => el.remove(), 380); }
addEventListener('keydown', e => { if(DT.el && e.key === 'Escape'){ e.stopPropagation(); deskTourEnd(); } }, true);
addEventListener('resize', () => { if(DT.el) dtShow(); });
$('deskTourBtn').addEventListener('click', () => { panel.classList.remove('on'); setTimeout(() => deskTour(true), 200); });
/* it begins once the welcome has lifted, the first time only */
if(welcome){ welcome.addEventListener('click', () => setTimeout(() => { if(prefs.start !== 'map') deskTour(); }, 1500)); }

/* ===================== a highlight you can change or take away; sticky notes on e-book pages ===================== */
function spStickyDraw(rects, o = {}){ const NS = 'http://www.w3.org/2000/svg', g = document.createElementNS(NS, 'g'); if(!rects || !rects.length) return g;
  for(const r of rects){ const l = document.createElementNS(NS, 'line'); l.setAttribute('x1', r.left); l.setAttribute('x2', r.left + r.width); l.setAttribute('y1', r.top + r.height - 1); l.setAttribute('y2', r.top + r.height - 1); l.setAttribute('stroke', '#B4432E'); l.setAttribute('stroke-width', '1.2'); l.setAttribute('stroke-dasharray', '2 2.5'); l.setAttribute('opacity', '.7'); g.append(l); }
  const r = rects[rects.length - 1], x = r.left + r.width + 3, y = r.top - 6, s = 15;
  const sq = document.createElementNS(NS, 'rect'); Object.entries({x, y, width: s, height: s, rx: 2, fill: o.color || '#F6E27A', stroke: 'rgba(0,0,0,.2)', 'stroke-width': .6}).forEach(([k, v]) => sq.setAttribute(k, v)); g.append(sq);
  const f = document.createElementNS(NS, 'path'); f.setAttribute('d', 'M' + (x + s - 5) + ' ' + (y + s) + 'L' + (x + s) + ' ' + (y + s - 5) + 'L' + (x + s) + ' ' + (y + s) + 'Z'); f.setAttribute('fill', 'rgba(0,0,0,.18)'); g.append(f);
  return g; }
function spScreenRect(range, doc){ const fe = doc && doc.defaultView && doc.defaultView.frameElement, fr = fe ? fe.getBoundingClientRect() : {left: 0, top: 0}, rr = range.getBoundingClientRect(); return {left: fr.left + rr.left, top: fr.top + rr.top, right: fr.left + rr.right, bottom: fr.top + rr.bottom, width: rr.width}; }
/* a sticky note on an e-book: kept with its words, opened beside them */
function spEbookNote(range, doc){ const p = SP.pending; if(!p || !p.cfi) return;
  const n = {id: 'n-' + Date.now().toString(36), kind: 'note', cfi: p.cfi, quote: p.text, text: '', color: STK_COLORS[0], date: today(), loc: p.loc, open: true};
  SP.marks.push(n); spSaveMarks(); try{ SP.view.addAnnotation({value: n.cfi, color: n.color, note: true}); }catch(e){}
  try{ (p.doc ? p.doc.getSelection() : getSelection()).removeAllRanges(); }catch(e){} $('spSel').hidden = true; SP.pending = null;
  spOpenEbNote(n, range ? spScreenRect(range, doc) : null); }
function spOpenEbNote(n, r){ const box = $('spEbNote'); n.open = true; box.innerHTML = stkHTML(n, 'pdf'); box.hidden = false; const st = box.firstElementChild; st.style.left = '0'; st.style.top = '0'; st.style.position = 'relative';
  const x = r ? r.right + 12 : innerWidth / 2 - 105, y = r ? r.top - 10 : innerHeight / 3; box.style.left = Math.max(12, Math.min(innerWidth - 230, x)) + 'px'; box.style.top = Math.max(12, Math.min(innerHeight - 200, y)) + 'px';
  setTimeout(() => { const t = box.querySelector('.tx'); if(t) t.focus(); }, 30); }
/* clicking a highlight: its colour, quote it, or take it away */
let spMkOn = null;
function spMarkAt(value, range){ const m = SP.marks.find(x => x.cfi === value); if(!m) return; let doc = null; try{ doc = range && range.startContainer && range.startContainer.ownerDocument; }catch(e){}
  const r = range && doc ? spScreenRect(range, doc) : {left: innerWidth / 2, top: innerHeight / 2, right: innerWidth / 2, width: 0};
  if(m.kind === 'note'){ spOpenEbNote(m, r); return; } spShowMk(m, r); }
function spShowMk(m, r){ spMkOn = m; const bar = $('spMk'); bar.hidden = false; const w = bar.offsetWidth || 240;
  bar.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + (r.width || 0) / 2 - w / 2)) + 'px'; bar.style.top = Math.max(12, r.top - 48) + 'px';
  bar.querySelectorAll('[data-mkc]').forEach(b => b.classList.toggle('on', b.dataset.mkc === m.color)); }
$('spMk').addEventListener('pointerdown', e => e.preventDefault());
$('spMk').addEventListener('click', e => { const m = spMkOn; if(!m) return; const c = e.target.closest('[data-mkc]'), a = e.target.closest('[data-mk]');
  if(c){ m.color = c.dataset.mkc; spSaveMarks(); if(m.cfi && SP.view){ try{ SP.view.deleteAnnotation({value: m.cfi}); SP.view.addAnnotation({value: m.cfi, color: m.color}); }catch(err){} } else if(m.page) spDrawMarks(m.page); $('spMk').hidden = true; return; }
  if(a && a.dataset.mk === 'quote'){ spQuote(m.text, m.loc || (m.page ? 'p. ' + m.page : spEbookLoc())); $('spMk').hidden = true; return; }
  if(a && a.dataset.mk === 'del'){ SP.marks = SP.marks.filter(x => x.id !== m.id); spSaveMarks(); if(m.cfi && SP.view){ try{ SP.view.deleteAnnotation({value: m.cfi}); }catch(err){} } else if(m.page) spDrawMarks(m.page); $('spMk').hidden = true; spMkOn = null; } });
/* on a PDF page, a click on a highlight (with nothing being selected) opens the same bar */
$('spDoc').addEventListener('click', e => { if(SP.mode !== 'pdf') return; const s = getSelection(); if(s && !s.isCollapsed) return; const pg = e.target.closest('.sp-pg'); if(!pg || e.target.closest('.sp-sticky')) return;
  const b = pg.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height, page = +pg.dataset.page;
  const m = SP.marks.slice().reverse().find(k => k.page === page && k.kind !== 'note' && (k.rects || []).some(r => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]));
  if(m){ e.stopPropagation(); spShowMk(m, {left: e.clientX, top: e.clientY, right: e.clientX, width: 0}); } else $('spMk').hidden = true; });
document.addEventListener('pointerdown', e => { if(!e.target.closest('#spMk')) $('spMk').hidden = true; if(!e.target.closest('#spEbNote') && !$('spEbNote').hidden){ $('spEbNote').hidden = true; } }, true);

/* ===================== your own folders and categories: make them, nest them, rename them ===================== */
const rOpenCats = new Set();
function catPaths(){ const all = []; allCats().forEach(c => { const parts = String(c).split('/').map(x => x.trim()).filter(Boolean); for(let i = 1; i <= parts.length; i++){ const p = parts.slice(0, i).join('/'); if(!all.includes(p)) all.push(p); } }); return all; }
function catTreeHTML(){ const paths = catPaths(), kids = p => paths.filter(x => x.indexOf(p + '/') === 0 && x.slice(p.length + 1).indexOf('/') < 0);
  const count = p => R.filter(b => (b.categories || []).some(c => c === p)).length;
  let h = ''; const row = (p, depth) => { const ks = kids(p), open = rOpenCats.has(p) || rFilter.indexOf('cat:' + p + '/') === 0, leaf = p.split('/').pop();
    h += '<div class="tp-row" style="--d:' + depth + '"><button class="tp-tog' + (ks.length ? '' : ' none') + (open ? ' open' : '') + '" data-ctog="' + esc(p) + '"></button><button class="tp' + (depth ? ' sub' : '') + (rFilter === 'cat:' + p ? ' on' : '') + '" data-filter="cat:' + esc(p) + '" data-cat="' + esc(p) + '"><span>' + esc(leaf) + '</span><em>' + count(p) + '</em></button><i class="tp-add" data-addcat="' + esc(p) + '" title="A category inside">+</i></div>';
    if(open) ks.forEach(x => row(x, depth + 1)); };
  paths.filter(p => p.indexOf('/') < 0).forEach(p => row(p, 0)); return h; }
function catRename(from, to){ if(!to || to === from || to.indexOf(from + '/') === 0) return;
  const sw = c => c === from ? to : c.indexOf(from + '/') === 0 ? to + c.slice(from.length) : c;
  CATS = [...new Set(CATS.map(sw))]; R.forEach(b => { if((b.categories || []).length) b.categories = [...new Set(b.categories.map(sw))]; });
  if(rFilter === 'cat:' + from) rFilter = 'cat:' + to; rSave(); renderReadings(); }
function catDelete(p){ const gone = c => c === p || c.indexOf(p + '/') === 0; CATS = CATS.filter(c => !gone(c)); R.forEach(b => { if(b.categories) b.categories = b.categories.filter(c => !gone(c)); }); if(rFilter.indexOf('cat:' + p) === 0) rFilter = 'st:all'; rSave(); renderReadings(); }
/* a small menu of its own for the two sidebars */
function tpMenu(x, y, items){ let m = $('tpMenu'); if(!m){ m = document.createElement('div'); m.id = 'tpMenu'; m.className = 'tp-menu'; document.body.appendChild(m); document.addEventListener('pointerdown', e => { if(!e.target.closest('#tpMenu')) m.hidden = true; }, true); }
  m.innerHTML = items.map((it, i) => '<button type="button" data-ti="' + i + '"' + (it[2] ? ' class="danger"' : '') + '>' + esc(it[0]) + '</button>').join(''); m.hidden = false;
  m.style.left = Math.min(innerWidth - 200, x) + 'px'; m.style.top = Math.min(innerHeight - 40 * items.length - 20, y) + 'px';
  m.onclick = e => { const b = e.target.closest('[data-ti]'); if(!b) return; m.hidden = true; items[+b.dataset.ti][1](); }; }
/* a name is typed right in the list, in the row it will become: Enter keeps it, Esc lets it go */
function askInline(o){ return new Promise(res => {
  const row = document.createElement('div'); row.className = 'tp-row tp-editrow'; row.style.setProperty('--d', o.depth || 0);
  const inp = document.createElement('input'); inp.className = 'tp-input'; inp.type = 'text'; inp.maxLength = 60; inp.placeholder = o.placeholder || 'Name'; inp.value = o.value || ''; inp.spellcheck = false; row.appendChild(inp);
  if(o.replace){ o.replace.style.display = 'none'; o.replace.after(row); } else if(o.before) o.before.before(row); else if(o.after) o.after.after(row); else return res(null);
  let done = false; const end = v => { if(done) return; done = true; row.remove(); if(o.replace) o.replace.style.display = ''; res(v ? v.trim().replace(/\//g, '-').slice(0, 60) : null); };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if(e.key === 'Enter'){ e.preventDefault(); end(inp.value); } else if(e.key === 'Escape'){ e.preventDefault(); end(null); } });
  inp.addEventListener('blur', () => end(inp.value)); inp.addEventListener('click', e => e.stopPropagation());
  requestAnimationFrame(() => { inp.focus(); inp.select(); }); }); }
const rowOf = el => el && el.closest('.tp-row');
const depthOf = row => row ? (parseInt(getComputedStyle(row).getPropertyValue('--d')) || 0) : 0;
function pReload(){ D = load(); renderPapers(); }
/* Papers: + New folder, + inside a folder, right-click to rename or delete, drag a folder into another, drag a paper into a folder */
$('pboard').addEventListener('click', e => {
  const nf = e.target.closest('[data-newfolder]'); if(nf){ e.stopPropagation(); askInline({before: nf, placeholder: 'New folder'}).then(n => { if(n && P && P.newFolder){ const id = P.newFolder(n); if(id) pOpen.add(id); pReload(); } }); return; }
  const add = e.target.closest('.tp-add[data-add-map]'); if(add){ e.stopPropagation(); const row = rowOf(add), tid = add.dataset.addMap, sid = add.dataset.addSub || null;
    askInline({after: row, depth: depthOf(row) + 1, placeholder: 'New folder'}).then(n => { if(n && P && P.newFolder){ P.newFolder(n, tid, sid); pOpen.add(tid); if(sid) pOpen.add(sid); pShut.delete(tid); pReload(); } }); return; }
}, true);
$('pboard').addEventListener('contextmenu', e => { const t = e.target.closest('.tp[data-map]'); if(!t || !t.dataset.map) return; e.preventDefault(); const tid = t.dataset.map, sid = t.dataset.sub || null, name = t.querySelector('span').textContent;
  const row = rowOf(t);
  tpMenu(e.clientX, e.clientY, [['Rename', () => askInline({replace: row, depth: depthOf(row), value: name}).then(n => { if(n && n !== name){ P.renameFolder(tid, sid, n); pReload(); } })],
    ['A folder inside', () => askInline({after: row, depth: depthOf(row) + 1, placeholder: 'New folder'}).then(n => { if(n){ P.newFolder(n, tid, sid); pOpen.add(tid); if(sid) pOpen.add(sid); pReload(); } })],
    ['Delete', () => { const r = P.deleteFolder(tid, sid); if(r === 'not-empty') toast('Move its papers into another folder first'); else { if(pFilter.map === tid && (!sid || pFilter.sub === sid)){ pFilter.map = ''; pFilter.sub = ''; } pReload(); } }, true]]); });
/* Readings: categories within categories, made, nested and renamed the same way; drag a book onto a category to put it there */
RB.addEventListener('click', e => {
  const tg = e.target.closest('[data-ctog]'); if(tg){ e.stopPropagation(); const p = tg.dataset.ctog; if(tg.classList.contains('open')) rOpenCats.delete(p); else rOpenCats.add(p); renderReadings(); return; }
  const add = e.target.closest('[data-addcat]'); if(add){ e.stopPropagation(); const row = rowOf(add), up = add.dataset.addcat;
    askInline({after: row, depth: depthOf(row) + 1, placeholder: 'New category'}).then(n => { if(n){ const p = up + '/' + n; if(!CATS.includes(p)) CATS.push(p); rOpenCats.add(up); rSave(); renderReadings(); } }); return; }
}, true);
RB.addEventListener('contextmenu', e => { const t = e.target.closest('[data-cat]'); if(!t) return; e.preventDefault(); const p = t.dataset.cat, leaf = p.split('/').pop(), up = p.split('/').slice(0, -1).join('/');
  const row = rowOf(t);
  tpMenu(e.clientX, e.clientY, [['Rename', () => askInline({replace: row, depth: depthOf(row), value: leaf}).then(n => { if(n && n !== leaf) catRename(p, (up ? up + '/' : '') + n); })],
    ['A category inside', () => askInline({after: row, depth: depthOf(row) + 1, placeholder: 'New category'}).then(n => { if(n){ const q = p + '/' + n; if(!CATS.includes(q)) CATS.push(q); rOpenCats.add(p); rSave(); renderReadings(); } })],
    ...(up ? [['Move to the top', () => catRename(p, leaf)]] : []), ['Delete', () => catDelete(p), true]]); });

document.querySelectorAll('#rSecs').forEach(() => {});

/* ===================== dragging, the same on every Mac and in every browser =====================
   Press on a folder, a category, a paper or a book and move: a small label follows the pointer, the row under it
   lights up, and letting go puts it there. A press that does not move is an ordinary click. */
let sdJust = 0;
function sideDrag(board, o){ let st = null, ghost = null, over = null;
  let zone = 'into'; const clear = () => { if(over) over.classList.remove('drop', 'drop-before', 'drop-after'); over = null; };
  board.addEventListener('pointerdown', e => { if(e.button !== 0 || e.target.closest('.tp-add,.tp-tog,input,.sp-sticky')) return; const src = e.target.closest(o.source); if(!src) return; st = {src, x: e.clientX, y: e.clientY, on: false}; });
  addEventListener('pointermove', e => { if(!st) return;
    if(!st.on){ if(Math.hypot(e.clientX - st.x, e.clientY - st.y) < 7) return; st.payload = o.start(st.src); if(!st.payload){ st = null; return; } st.on = true;
      ghost = document.createElement('div'); ghost.className = 'sd-ghost'; ghost.textContent = st.payload.label || ''; document.body.appendChild(ghost); document.body.classList.add('pm-dragging'); }
    ghost.style.transform = 'translate(' + (e.clientX + 14) + 'px,' + (e.clientY + 10) + 'px)';
    const el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest(o.target);
    let z = 'into'; if(t && o.order && o.order(st.payload)){ const r = t.getBoundingClientRect(), fr = (e.clientY - r.top) / r.height; z = fr < .3 ? 'before' : fr > .7 ? 'after' : 'into'; }
    if(t !== over || z !== zone){ clear(); zone = z; if(t && t !== st.src && (!o.ok || o.ok(st.payload, t, z))){ over = t; t.classList.add(z === 'into' ? 'drop' : 'drop-' + z); } } });
  const finish = e => { if(!st) return; const s = st; st = null; if(!s.on) return; if(ghost){ ghost.remove(); ghost = null; } document.body.classList.remove('pm-dragging');
    const t = over, z = zone; clear(); sdJust = Date.now(); if(t) o.drop(s.payload, t, z); };
  addEventListener('pointerup', finish); addEventListener('pointercancel', () => { if(st && st.on){ if(ghost){ ghost.remove(); ghost = null; } document.body.classList.remove('pm-dragging'); clear(); } st = null; }); }
/* a drag ends with a click on what was dragged: that click is not a choice */
addEventListener('click', e => { if(Date.now() - sdJust < 350){ e.stopPropagation(); e.preventDefault(); } }, true);
sideDrag($('pboard'), {source: '#pbMaps .tp[data-map]:not([data-map=""]), #pbGrid .pg', target: '#pbMaps .tp[data-map]:not([data-map=""])',
  start: el => el.classList.contains('pg') ? {kind: 'paper', id: el.dataset.id, label: (el.querySelector('figcaption b, b') || {}).textContent || 'Paper'} : {kind: 'folder', t: el.dataset.map, s: el.dataset.sub || null, label: el.querySelector('span').textContent},
  order: p => p.kind === 'folder',
  ok: (p, t) => p.kind === 'paper' || !(p.t === t.dataset.map && (p.s || null) === (t.dataset.sub || null)),
  drop: (p, t, z) => { const dT = t.dataset.map, dS = t.dataset.sub || null, name = t.querySelector('span').textContent;
    if(p.kind === 'folder' && z !== 'into'){ const ok = P.placeFolder(p.t, p.s, dT, dS, z); if(!ok) toast('It cannot go inside itself'); pReload(); return; }
    if(p.kind === 'paper'){ P.movePaper(p.id, dT, dS); toast('Moved into ' + name); }
    else { const ok = P.moveFolder(p.t, p.s, dT, dS); if(ok){ pOpen.add(dT); if(dS) pOpen.add(dS); pShut.delete(dT); toast(p.label + ' is now inside ' + name); } else toast('It cannot go inside itself'); }
    pReload(); }});
sideDrag(RB, {source: '#rcats [data-cat], #rSecs .rbk', target: '#rcats [data-cat]',
  start: el => el.classList.contains('rbk') ? {kind: 'book', id: el.dataset.id, label: ((R.find(b => b.id === el.dataset.id) || {}).title) || 'Book'} : {kind: 'cat', p: el.dataset.cat, label: el.dataset.cat.split('/').pop()},
  order: p => p.kind === 'cat',
  ok: (p, t) => p.kind === 'book' || !(t.dataset.cat === p.p || t.dataset.cat.indexOf(p.p + '/') === 0),
  drop: (p, t, z) => { const dst = t.dataset.cat;
    if(p.kind === 'cat' && z !== 'into'){ catPlace(p.p, dst, z); return; }
    if(p.kind === 'book'){ const b = R.find(x => x.id === p.id); if(b){ b.categories = [dst]; rSave(); renderReadings(); toast('Put in ' + dst.split('/').pop()); } }
    else { catRename(p.p, dst + '/' + p.p.split('/').pop()); rOpenCats.add(dst); renderReadings(); } }});
/* a folder inside another can also be taken out to the top of the list */
$('pboard').addEventListener('contextmenu', e => { const t = e.target.closest('.tp[data-map][data-sub]'); if(!t) return; setTimeout(() => { const m = $('tpMenu'); if(!m || m.hidden || m.querySelector('[data-promote]')) return;
  const b = document.createElement('button'); b.type = 'button'; b.dataset.promote = '1'; b.textContent = 'Move to the top'; m.insertBefore(b, m.lastElementChild);
  b.addEventListener('click', ev => { ev.stopPropagation(); m.hidden = true; const id = P.promoteFolder && P.promoteFolder(t.dataset.map, t.dataset.sub); if(id) pOpen.add(id); pReload(); }); }, 0); });

/* a category put beside another, at its level, before or after it */
function catPlace(src, ref, where){ const up = ref.split('/').slice(0, -1).join('/'), np = (up ? up + '/' : '') + src.split('/').pop();
  if(ref === src || ref.indexOf(src + '/') === 0) return;
  CATS = catPaths(); if(np !== src){ const sw = c => c === src ? np : c.indexOf(src + '/') === 0 ? np + c.slice(src.length) : c; CATS = [...new Set(CATS.map(sw))]; R.forEach(b => { if((b.categories || []).length) b.categories = [...new Set(b.categories.map(sw))]; }); if(rFilter === 'cat:' + src) rFilter = 'cat:' + np; }
  const mine = c => c === np || c.indexOf(np + '/') === 0, block = CATS.filter(mine); CATS = CATS.filter(c => !mine(c));
  const inRef = c => c === ref || c.indexOf(ref + '/') === 0; let at = where === 'after' ? CATS.reduce((k, c, i) => inRef(c) ? i + 1 : k, -1) : CATS.findIndex(inRef);
  if(at < 0) at = CATS.length; CATS.splice(at, 0, ...block); rSave(); renderReadings(); }

/* right-click a cover in Your maps to rename it, in place */
stripIn.addEventListener('contextmenu', e => { const c = e.target.closest('.mcard[data-topic], .mcard.mind'); if(!c || state !== 'maps') return; e.preventDefault();
  tpMenu(e.clientX, e.clientY, [['Rename', () => { const b = c.querySelector('.mlabel b'); if(!b) return; const old = b.textContent; b.contentEditable = 'true'; b.classList.add('editing'); b.focus();
    const r = document.createRange(); r.selectNodeContents(b); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    let done = false; const end = keep => { if(done) return; done = true; b.contentEditable = 'false'; b.classList.remove('editing'); const v = b.textContent.trim().slice(0, 80);
      if(!keep || !v || v === old){ b.textContent = old; return; } if(c.dataset.topic) P.renameFolder(c.dataset.topic, null, v); else if(c.dataset.mind && P.renameMind) P.renameMind(c.dataset.mind, v); D = load(); const sl = strip.scrollLeft; layoutRow(); strip.scrollLeft = sl; assignSheets(); sheets.forEach(el => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; }); };
    b.addEventListener('keydown', ev => { ev.stopPropagation(); if(ev.key === 'Enter'){ ev.preventDefault(); end(true); } else if(ev.key === 'Escape'){ ev.preventDefault(); end(false); } }); b.addEventListener('blur', () => end(true), {once: true}); }]]); });

/* ===================== a book dropped on Readings: any EPUB, MOBI, AZW3, FB2, comic or PDF from your Mac =====================
   Its title, authors and cover are read from the file itself; the file is kept with the book. */
const BOOK_RE = /\.(epub|mobi|azw3?|kf8|fb2|fbz|cbz|pdf|zip)$/i;
async function bookFromFile(file){
  file = await normalizeBook(file);
  let title = file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim(), authors = [], cover = null, year = null;
  if(!/\.pdf$/i.test(file.name)){ try{ const base = new URL(VEND, document.baseURI).href, {makeBook} = await import(base + 'foliate/view.js'), bk = await makeBook(file), md = bk.metadata || {};
      const str = v => typeof v === 'string' ? v : v && typeof v === 'object' ? (v.name ? str(v.name) : Object.values(v)[0] || '') : '';
      const t = str(md.title); if(t) title = t.trim();
      const au = Array.isArray(md.author) ? md.author : md.author ? [md.author] : []; authors = au.map(str).map(s => s.trim()).filter(Boolean);
      const y = String(md.published || md.date || '').match(/\b(1[5-9]\d\d|20\d\d)\b/); if(y) year = +y[1];
      if(bk.getCover){ const cb = await bk.getCover(); if(cb) cover = await spThumb(cb); } }catch(e){} }
  const kind = rFilter.split(/:(.+)/), b = {id: 'r-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: title || 'Untitled', authors, year, status: 'want', categories: kind[0] === 'cat' ? [kind[1]] : [], notes: '', quotes: [], files: [], onMaps: [], added: new Date().toISOString()};
  if(cover) b.cover = cover;
  R.unshift(b); rSave(); renderReadings();
  try{ const meta = await P.bookFileSave(b.id, file); b.files = [meta]; rSave(); }catch(err){ toast('“' + b.title + '” is on your shelves, but its file could not be kept: ' + String((err && err.message) || err).slice(0, 80)); }
  return b; }
let rDropN = 0;
addEventListener('dragenter', e => { if(state !== 'books' || !(e.dataTransfer && [...e.dataTransfer.types].includes('Files'))) return; rDropN++; document.body.classList.add('r-filedrop'); });
addEventListener('dragleave', e => { if(state !== 'books') return; rDropN = Math.max(0, rDropN - 1); if(!rDropN) document.body.classList.remove('r-filedrop'); });
addEventListener('dragover', e => { if(state === 'books' && e.dataTransfer && [...e.dataTransfer.types].includes('Files')){ e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
addEventListener('drop', async e => { if(state !== 'books' || !e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); rDropN = 0; document.body.classList.remove('r-filedrop');
  /* a book kept as a folder (Apple Books keeps EPUBs this way) is read file by file and made into one EPUB */
  const files = []; for(const it of [...(e.dataTransfer.items || [])]){ const en = it.webkitGetAsEntry && it.webkitGetAsEntry();
    if(en && en.isDirectory && /\.epub$/i.test(en.name)){ try{ const list = await filesFromEntry(en, ''); files.push(epubFrom(await Promise.all(list.map(async x => ({path: x.path, data: new Uint8Array(await x.file.arrayBuffer())}))), en.name)); }catch(err){} }
    else { const f = it.getAsFile && it.getAsFile(); if(f && BOOK_RE.test(f.name)) files.push(f); } }
  if(!files.length) [...e.dataTransfer.files].filter(f => BOOK_RE.test(f.name)).forEach(f => files.push(f));
  if(!files.length){ toast('Paper Map reads EPUB, MOBI, AZW3, FB2, comics and PDF'); return; }
  for(const f of files){ const b = await bookFromFile(f); toast('Added “' + b.title + '”'); setTimeout(() => offerOldNotes(b), 1200); } });

/* ===================== EPUBs that arrive zipped or as folders =====================
   The Mac hands over an EPUB kept as a folder either as that folder or zipped as Name.epub.zip, with everything one level
   down; a reader cannot open that. Paper Map unpacks it and packs it again as a proper EPUB (its mimetype first). */
const CRC_T = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u){ let c = 0xFFFFFFFF; for(let i = 0; i < u.length; i++) c = CRC_T[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files){ const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  files.forEach(f => { const nm = enc.encode(f.name), dd = f.data, crc = crc32(dd), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, dd.length, true); h.setUint32(22, dd.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nm, dd);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, dd.length, true); c.setUint32(24, dd.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + dd.length; });
  const cd = central.reduce((s, p) => s + p.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cd, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], {type: 'application/epub+zip'}); }
function epubFrom(list, name){ const c = list.find(x => /(^|\/)META-INF\/container\.xml$/i.test(x.path)), strip = c ? c.path.slice(0, c.path.length - 'META-INF/container.xml'.length) : '';
  const files = [{name: 'mimetype', data: new TextEncoder().encode('application/epub+zip')}];
  list.forEach(x => { if(!x.path.startsWith(strip)) return; const p = x.path.slice(strip.length); if(!p || p === 'mimetype' || /(^|\/)(\.DS_Store|__MACOSX)(\/|$)/.test(p) || p.endsWith('/')) return; files.push({name: p, data: x.data}); });
  return new File([zipStore(files)], String(name).replace(/\.zip$/i, '').replace(/\.epub$/i, '') + '.epub', {type: 'application/epub+zip'}); }
async function filesFromEntry(entry, prefix){ if(entry.isFile) return [await new Promise((res, rej) => entry.file(f => res({path: prefix + entry.name, file: f}), rej))];
  const reader = entry.createReader(), out = []; let batch; do { batch = await new Promise((res, rej) => reader.readEntries(res, rej)); for(const x of batch) out.push(...await filesFromEntry(x, prefix + entry.name + '/')); } while(batch.length); return out; }
async function normalizeBook(file){ if(!file || !/\.zip$/i.test(file.name)) return file;
  try{ const base = new URL(VEND, document.baseURI).href, z = await import(base + 'foliate/vendor/zip.js'); try{ z.configure({useWebWorkers: false}); }catch(e){}
    const entries = await new z.ZipReader(new z.BlobReader(file)).getEntries(), list = [];
    for(const en of entries){ if(en.directory) continue; const b = await en.getData(new z.BlobWriter()); list.push({path: en.filename, data: new Uint8Array(await b.arrayBuffer())}); }
    if(list.some(x => /META-INF\/container\.xml$/i.test(x.path))) return epubFrom(list, file.name); }catch(e){}
  return file; }
/* every way a book's file comes in goes through the same repair */
if(P && P.bookFileSave && !P.bookFileSave._norm){ const _bfs = P.bookFileSave; P.bookFileSave = async function(id, f){ return _bfs.call(P, id, await normalizeBook(f)); }; P.bookFileSave._norm = true; }

/* ===================== a PDF dropped on Papers: a paper in your library =====================
   Its title and authors come from the PDF itself, its DOI from its first page; with a DOI, the details are filled in. */
async function paperInfoFromPdf(file){ const info = {t: file.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim()};
  try{ const lib2 = await deskPdfJs(), doc = await lib2.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise;
    try{ const md = await doc.getMetadata(), inf = (md && md.info) || {}; if(inf.Title && String(inf.Title).trim().length > 3 && !/^untitled|microsoft word|\.docx?$/i.test(inf.Title)) info.t = String(inf.Title).trim(); if(inf.Author) info.au = String(inf.Author).trim(); }catch(e){}
    for(let i = 1; i <= Math.min(2, doc.numPages) && !info.doi; i++){ const tc = await (await doc.getPage(i)).getTextContent(), txt = tc.items.map(x => x.str).join(' ');
      const m = txt.match(/\b(10\.\d{4,9}\/[^\s"<>]+[^\s"<>.,;)\]])/); if(m) info.doi = m[1]; }
    doc.destroy(); }catch(e){}
  return info; }
let pDropN = 0;
addEventListener('dragenter', e => { if(state !== 'papers' || !(e.dataTransfer && [...e.dataTransfer.types].includes('Files'))) return; pDropN++; document.body.classList.add('p-filedrop'); });
addEventListener('dragleave', e => { if(state !== 'papers') return; pDropN = Math.max(0, pDropN - 1); if(!pDropN) document.body.classList.remove('p-filedrop'); });
addEventListener('dragover', e => { if(state === 'papers' && e.dataTransfer && [...e.dataTransfer.types].includes('Files')){ e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
addEventListener('drop', async e => { if(state !== 'papers' || !e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); pDropN = 0; document.body.classList.remove('p-filedrop');
  const files = [...e.dataTransfer.files].filter(f => /\.pdf$/i.test(f.name)); if(!files.length){ toast('Drop PDFs here to add them as papers'); return; }
  const fol = D.topics.find(t => t.id === pFilter.map && t.shelf);
  for(const f of files){ const info = await paperInfoFromPdf(f); const r = P.newPaperFromPdf ? await P.newPaperFromPdf(info, f, fol ? fol.id : null, fol ? (pFilter.sub || null) : null) : null; D = load(); renderPapers(); if(r) toast(r.pdf ? 'Added “' + r.t + '”' : 'Added “' + r.t + '”; its PDF needs a place to be kept: choose one in the cloud'); } });
/* ===================== Kindle highlights, found again in your own copy of the book =====================
   A highlight imported from a Kindle keeps its words; when the same book is opened here, those words are looked for in
   the file and, where they are found, marked on its page. */
async function spPlaceKindle(view, b){ if(!view || !b) return; const marks = SP.marks, placed = new Set(marks.filter(m => m.kq).map(m => m.kq));
  const todo = (b.quotes || []).filter(q => q.src === 'kindle' && q.text && !placed.has(q.id || q.text.slice(0, 60))).slice(0, 40); let n = 0;
  for(const q of todo){ if(SP.view !== view) return; const words = q.text.replace(/\s+/g, ' ').trim().slice(0, 70);
    try{ for await (const r of view.search({query: words, matchCase: false, matchDiacritics: false, matchWholeWords: false})){ const it = r && r.subitems && r.subitems[0]; if(it && it.cfi){
          const m = {id: 'mk-' + Math.random().toString(36).slice(2, 9), cfi: it.cfi, text: q.text, color: 'rgba(242,207,87,.45)', src: 'kindle', kq: q.id || q.text.slice(0, 60), date: q.date || today()};
          marks.push(m); try{ view.addAnnotation({value: m.cfi, color: m.color}); }catch(e){} n++; break; } } }catch(e){}
    try{ view.clearSearch(); }catch(e){} }
  if(n){ b.marks = marks.slice(); rSave(); toast(n + (n === 1 ? ' Kindle highlight' : ' Kindle highlights') + ' found in this copy'); } }

/* ===================== deleting a paper or a book ===================== */
function deleteBook(id, after){ const b = R.find(x => x.id === id); if(!b) return;
  P.confirmDanger('Delete book', 'Delete “' + b.title + '”? Its notes and highlights are kept aside: add the same book again and you can bring them back.', () => {
    const at = R.indexOf(b), files = b.files; R = R.filter(x => x !== b); setTimeout(() => { if(b.deleted && P.bookFileDrop) (files || []).forEach(f => P.bookFileDrop(f)); }, 9000); b.deleted = true; b.deletedOn = today(); b.files = []; RDEL.push(b); rSave(); if(after) try{ after(); }catch(e){} renderReadings();
    toastAct('Deleted “' + b.title + '”', 'Undo', () => { RDEL = RDEL.filter(x => x !== b); delete b.deleted; delete b.deletedOn; b.files = files; R.splice(Math.min(at, R.length), 0, b); rSave(); renderReadings(); toast('“' + b.title + '” is back'); }); }); }
/* a toast with one thing to do */
function toastAct(t, label, fn, ms){ const el = $('toast'); el.textContent = ''; const s = document.createElement('span'); s.textContent = t; const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'toast-act'; bt.textContent = label;
  bt.addEventListener('click', e => { e.stopPropagation(); el.classList.remove('on', 'act'); fn(); }); el.append(s, bt); el.classList.add('on', 'act'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('on', 'act'), ms || 7000); }
/* the same book added again: its old notes are offered back, never put back unasked */
function oldNotesFor(b){ const n = normT(b.title); return RDEL.find(x => (b.isbn && x.isbn && x.isbn === b.isbn) || (n && normT(x.title) === n)) || null; }
function offerOldNotes(b){ const old = oldNotesFor(b); if(!old) return; const nq = (old.quotes || []).length + (old.marks || []).length + (old.stickies || []).length;
  toastAct('You kept notes for “' + old.title + '”' + (nq ? ' (' + nq + (nq === 1 ? ' highlight' : ' highlights and quotes') + ')' : ''), 'Bring them back', () => {
    const plain = h => String(h || '').replace(/<[^>]*>/g, '').trim();
    if(plain(old.notes)) b.notes = plain(b.notes) ? b.notes + '<p></p>' + old.notes : old.notes;
    const seen = new Set((b.quotes || []).map(q => q.text)); b.quotes = (b.quotes || []).concat((old.quotes || []).filter(q => !seen.has(q.text)));
    b.marks = (b.marks || []).concat(old.marks || []); b.stickies = (b.stickies || []).concat(old.stickies || []);
    if(!(b.categories || []).length && (old.categories || []).length) b.categories = [old.categories[old.categories.length - 1]];
    ['rating', 'started', 'finishedOn', 'review'].forEach(k => { if(old[k] != null && b[k] == null) b[k] = old[k]; });
    RDEL = RDEL.filter(x => x !== old); rSave(); renderReadings(); toast('Your notes for “' + b.title + '” are back'); }, 12000); }
/* right-click a paper in Papers, or a book in Readings, to delete it */
$('pboard').addEventListener('contextmenu', e => { const g = e.target.closest('#pbGrid .pg'); if(!g) return; e.preventDefault();
  tpMenu(e.clientX, e.clientY, [['Open', () => g.click()], ['Delete this paper', () => P.deletePaper(g.dataset.id, () => setTimeout(() => { try{ pReload(); }catch(err){} }, 300))]]); });
RB.addEventListener('contextmenu', e => { const g = e.target.closest('#rSecs .rbk'); if(!g) return; e.preventDefault();
  tpMenu(e.clientX, e.clientY, [['Open', () => g.click()], ['Delete this book', () => deleteBook(g.dataset.id)]]); });

/* a small window onto the shelves, for checking them */
window.__desk = {get R(){ return R; }, get RDEL(){ return RDEL; }, addBook(b){ R.unshift(b); rSave(); renderReadings(); }};

setTimeout(paintDrink, 60);

/* ===================== writing by hand with the Pencil =====================
   ✎ in the reading page turns the Pencil into ink: on the PDF of a paper and on the notes of a paper or a book (never on a
   book's pages). Fingers still scroll and turn pages; only the Pencil (or, on a Mac, the mouse) draws. With ✎ off, the
   Pencil writes into the notes as text, by iPad's own Scribble. Strokes are kept as lines, in the page's own measure. */
const INK = {on: false, tool: 'pen', color: '#1F1B18', layers: [], undo: [], mouse: !('ontouchstart' in window)};
function inkData(){ if(!SP.kind) return null;
  if(SP.kind === 'paper'){ if(!SP.ink || SP.inkFor !== SP.id){ SP.ink = (P.paperInk && P.paperInk(SP.id)) || {pdf: {}, notes: []}; SP.inkFor = SP.id; } return SP.ink; }
  const b = spBook(); if(!b) return null; b.ink = b.ink || {notes: []}; return b.ink; }
function inkSave(){ clearTimeout(INK.t); INK.t = setTimeout(() => { const dd = inkData(); if(!dd) return; if(SP.kind === 'paper'){ if(P.setPaperInk) P.setPaperInk(SP.id, dd); } else rSave(); }, 400); }
function inkStroke(g, s, w){ const p = s.p; if(!p || p.length < 6) return; g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = s.c; g.globalAlpha = s.h ? 0.38 : 1;
  let px = p[0] * w, py = p[1] * w, mx = px, my = py;
  for(let i = 3; i < p.length; i += 3){ const x = p[i] * w, y = p[i + 1] * w, nx = (px + x) / 2, ny = (py + y) / 2, pr = p[i + 2];
    g.lineWidth = s.h ? s.w : s.w * (0.45 + 1.15 * pr); g.beginPath(); g.moveTo(mx, my); g.quadraticCurveTo(px, py, nx, ny); g.stroke(); mx = nx; my = ny; px = x; py = y; }
  g.restore(); }
function inkLayer(host, get, set){
  const cv = document.createElement('canvas'); cv.className = 'ink-cv'; host.classList.add('ink-host'); host.appendChild(cv);
  const L = {cv, host, get, set, draw(){ const w = host.clientWidth, h = Math.min(Math.max(host.scrollHeight, host.clientHeight), 6000), dpr = Math.min(devicePixelRatio || 1, 2, 16000000 / Math.max(1, w * h));
      if(cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)){ cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); (get() || []).forEach(s => inkStroke(g, s, w)); }};
  let cur = null;
  const pt = e => { const r = cv.getBoundingClientRect(), w = host.clientWidth || 1; return [+((e.clientX - r.left) / w).toFixed(4), +((e.clientY - r.top) / w).toFixed(4), +((e.pointerType === 'pen' ? e.pressure : 0.5) || 0.5).toFixed(2)]; };
  cv.addEventListener('pointerdown', e => { if(!INK.on || !(e.pointerType === 'pen' || (INK.mouse && e.pointerType === 'mouse'))) return; e.preventDefault(); e.stopPropagation(); try{ cv.setPointerCapture(e.pointerId); }catch(err){}
    if(INK.tool === 'eraser'){ cur = {erase: true}; inkErase(L, pt(e)); return; }
    cur = {c: INK.tool === 'hl' ? '#F2CF57' : INK.color, w: INK.tool === 'hl' ? 14 : 2.1, h: INK.tool === 'hl' ? 1 : 0, p: pt(e)}; });
  cv.addEventListener('pointermove', e => { if(!cur) return; e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if(cur.erase){ evs.forEach(ev => inkErase(L, pt(ev))); return; }
    evs.forEach(ev => cur.p.push(...pt(ev))); L.draw(); inkStroke(cv.getContext('2d'), cur, host.clientWidth); });
  const end = () => { if(!cur) return; if(!cur.erase && cur.p.length >= 6){ const a = (get() || []).slice(); a.push(cur); set(a); INK.undo.push({L, s: cur}); inkSave(); } cur = null; L.draw(); };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('touchstart', e => { if(INK.on && [...e.touches].some(t => t.touchType === 'stylus')) e.preventDefault(); }, {passive: false});
  INK.layers.push(L); L.draw(); return L; }
function inkErase(L, q){ const a = L.get() || [], r = 0.012; const keep = a.filter(s => { for(let i = 0; i < s.p.length; i += 3) if(Math.hypot(s.p[i] - q[0], s.p[i + 1] - q[1]) < r) return false; return true; });
  if(keep.length !== a.length){ INK.undo.push({L, erased: a.filter(s => !keep.includes(s))}); L.set(keep); inkSave(); L.draw(); } }
let INK_IO = null;
function inkMount(){ document.querySelectorAll('.ink-cv').forEach(c => c.remove()); INK.layers = []; INK.undo = []; if(INK_IO){ INK_IO.disconnect(); INK_IO = null; } const dd = inkData(); if(!dd) return;
  dd.notes = dd.notes || [];
  /* the notes get their layer only when there is ink on them or ✎ is on */
  if(INK.on || dd.notes.length) inkLayer($('spSheet'), () => inkData().notes, a => { inkData().notes = a; });
  if(SP.kind !== 'paper') return;
  /* a PDF page gets its layer only while it is on screen, and only if it has ink or ✎ is on; it lets it go when it leaves */
  INK_IO = new IntersectionObserver(es => es.forEach(en => { const pg = en.target, n = pg.dataset.page, has = ((inkData() || {}).pdf || {})[n];
      const cur = INK.layers.find(L => L.host === pg);
      if(en.isIntersecting && !cur && (INK.on || (has && has.length))) inkLayer(pg, () => (inkData().pdf || {})[n] || [], a => { const x = inkData(); x.pdf = x.pdf || {}; x.pdf[n] = a; });
      if(!en.isIntersecting && cur){ cur.cv.remove(); INK.layers = INK.layers.filter(L => L !== cur); } }), {rootMargin: '400px 0px'});
  document.querySelectorAll('#spDoc .sp-pg').forEach(pg => INK_IO.observe(pg)); }
const _openSpread = openSpread; openSpread = async function(...args){ const r = await _openSpread.apply(this, args); setTimeout(inkMount, 900); return r; };
const _spOpenPdf = spOpenPdf; spOpenPdf = async function(...args){ const r = await _spOpenPdf.apply(this, args); setTimeout(inkMount, 300); return r; };
addEventListener('resize', () => INK.layers.forEach(L => L.draw()));
$('spInk').addEventListener('click', e => { e.stopPropagation(); INK.on = !INK.on; document.body.classList.toggle('ink-on', INK.on); $('spInk').classList.toggle('on', INK.on); $('inkTools').hidden = !INK.on; inkMount(); });
$('inkTools').addEventListener('click', e => { const t = e.target.closest('[data-ink]'); if(!t) return; e.stopPropagation(); const k = t.dataset.ink;
  if(k === 'undo'){ const op = INK.undo.pop(); if(!op) return; const a = (op.L.get() || []).slice(); op.L.set(op.s ? a.filter(x => x !== op.s) : a.concat(op.erased)); inkSave(); op.L.draw(); return; }
  INK.tool = k; if(t.dataset.c) INK.color = t.dataset.c; document.querySelectorAll('#inkTools [data-ink]').forEach(b => b.classList.toggle('on', b === t)); });

/* one category per book: a book already in several keeps the one it was put in last */
(function(){ let n = 0; R.forEach(b => { if((b.categories || []).length > 1){ b.categories = [b.categories[b.categories.length - 1]]; n++; } }); if(n) rSave(); })();

addEventListener('dragstart', e => { if(e.target && e.target.closest && e.target.closest('#rSecs, #pbGrid, #rcats, #pbMaps')) e.preventDefault(); }, true);

/* choosing where this Mac keeps book files */
async function bookPlaceMenu(){ const pl = P.bookPlaces ? await P.bookPlaces() : null; const cur = P.bookPlace();
  const opts = [['', 'With your library', 'On GitHub, so every device can open them']].concat(pl && pl.icloud ? [['icloud', 'iCloud Drive', 'In iCloud Drive › Paper Map Books: your Macs, and GitHub stays small']] : []).concat(pl && pl.documents ? [['documents', 'Documents on this Mac', 'In Documents › Paper Map Books, on this Mac only']] : []);
  rMenu(opts.map(o => [(o[0] === cur ? '✓ ' : '') + o[1], o[2], () => { P.setBookPlace(o[0]); toast('Book files you add from now on: ' + o[1]); }]), $('rMoreBtn')); }

/* ===================== a PDF with your marks written into it =====================
   Highlights are laid on the page as translucent colour, as a highlighter would; handwriting is drawn as lines; sticky
   notes become PDF notes, which open in any PDF reader. The original is not changed: this is a new file. */
function pdfLibLoad(){ if(window.PDFLib) return Promise.resolve(window.PDFLib); return new Promise((res, rej) => { const s = document.createElement('script'); s.src = new URL(VEND, document.baseURI).href + 'pdf-lib/pdf-lib.min.js'; s.onload = () => res(window.PDFLib); s.onerror = rej; document.head.appendChild(s); }); }
function rgbaOf(c){ const m = String(c || '').match(/rgba?\(([^)]+)\)/); if(m){ const p = m[1].split(',').map(x => parseFloat(x)); return [p[0] / 255, p[1] / 255, p[2] / 255, p[3] == null ? 1 : p[3]]; }
  const h = String(c || '#F2CF57').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1]; }
async function pdfMarked(bytes, marks, ink){ const L = await pdfLibLoad(); const doc = await L.PDFDocument.load(bytes, {ignoreEncryption: true}); const pages = doc.getPages();
  pages.forEach((pg, i) => { const n = i + 1, box = pg.getCropBox ? pg.getCropBox() : {x: 0, y: 0, width: pg.getWidth(), height: pg.getHeight()}, W = box.width, H = box.height, X = box.x, Y = box.y;
    (marks || []).filter(m => m.page === n && m.rects).forEach(m => { const [r, g, b, a] = rgbaOf(m.color);
      m.rects.forEach(([x, y, w, h]) => pg.drawRectangle({x: X + x * W, y: Y + H - (y + h) * H, width: w * W, height: h * H, color: L.rgb(r, g, b), opacity: Math.min(0.55, Math.max(0.28, a)), blendMode: L.BlendMode.Multiply})); });
    const strokes = ((ink || {})[n]) || [];
    strokes.forEach(s => { const p = s.p; if(!p || p.length < 6) return; let path = 'M ' + (p[0] * W).toFixed(2) + ' ' + (p[1] * W).toFixed(2); for(let j = 3; j < p.length; j += 3) path += ' L ' + (p[j] * W).toFixed(2) + ' ' + (p[j + 1] * W).toFixed(2);
      const [r, g, b] = rgbaOf(s.c), pr = p.filter((_, j) => j % 3 === 2), avg = pr.reduce((t, x) => t + x, 0) / Math.max(1, pr.length), k = W / 600;
      pg.drawSvgPath(path, {x: X, y: Y + H, borderColor: L.rgb(r, g, b), borderWidth: (s.h ? s.w : s.w * (0.45 + 1.15 * avg)) * k, borderOpacity: s.h ? 0.38 : 1, borderLineCap: L.LineCapStyle.Round, blendMode: s.h ? L.BlendMode.Multiply : L.BlendMode.Normal}); });
    (marks || []).filter(m => m.kind === 'note' && m.page === n).forEach(m => { const px = X + m.x * W, py = Y + H - m.y * H, [r, g, b] = rgbaOf(m.color);
      const note = doc.context.obj({Type: 'Annot', Subtype: 'Text', Rect: [px, py - 18, px + 18, py], Contents: L.PDFHexString.fromText((m.text || '') + (m.quote ? '\n“' + m.quote + '”' : '')), Name: 'Comment', C: [r, g, b], F: 4, Open: false, T: L.PDFHexString.fromText('Paper Map')});
      pg.node.addAnnot(doc.context.register(note)); }); });
  return new Blob([await doc.save()], {type: 'application/pdf'}); }
async function pdfWithMarks(id){ const blob = await P.paperPdfBlob(id); if(!blob) throw new Error('no pdf'); const dd = inkData() || {};
  return pdfMarked(new Uint8Array(await blob.arrayBuffer()), SP.marks || [], dd.pdf || {}); }
window.__pdfMarked = pdfMarked;

/* Zotero's collections in the Papers list: choosing one shows the papers Zotero keeps in it; the arrow opens it */
$('pboard').addEventListener('click', e => { const t = e.target.closest('[data-ztog]'); if(t){ e.stopPropagation(); const k = 'z:' + t.dataset.ztog; pOpen.has(k) ? pOpen.delete(k) : pOpen.add(k); renderPapers(); return; }
}, true);

/* a library folds away and opens again from its name */
$('pboard').addEventListener('click', e => { const s = e.target.closest('[data-sec]'); if(!s) return; e.stopPropagation(); const k = 'sec:' + s.dataset.sec; pShut.has(k) ? pShut.delete(k) : pShut.add(k); renderPapers(); }, true);
})();
