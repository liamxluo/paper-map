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
function poseT(p, sc){ return 'translate(' + (p[0] - W / 2) + 'px,' + (p[1] - H / 2) + 'px) rotate(' + p[2] + 'deg) scale(' + sc + ')'; }
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
  if(!t){ s += '<text x="280" y="180" text-anchor="middle" font-family="' + SERIF + '" font-style="italic" font-size="11" fill="#9A8F80">A map for another field</text></svg>'; return s; }
  const papers = D.papers.filter(p => p.topic === t.id && typeof p.y === 'number');
  const ys = papers.map(p => p.y), y0 = ys.length ? Math.min(...ys) : 2000, y1 = ys.length ? Math.max(...ys) : 2020;
  s += '<text x="34" y="40" font-family="' + SERIF + '" font-weight="700" font-size="12" letter-spacing="3" fill="#231E1A">' + esc(String(t.name).toUpperCase().slice(0, 34)) + '</text>';
  s += '<text x="34" y="53" font-family="' + SERIF + '" font-style="italic" font-size="6.6" fill="#7C7062">' + papers.length + (papers.length === 1 ? ' paper' : ' papers') + (ys.length ? ' · ' + y0 + '–' + y1 : '') + ' · one of ' + D.topics.length + (D.topics.length === 1 ? ' map' : ' maps') + '</text>';
  s += '<line x1="34" x2="170" y1="59" y2="59" stroke="#231E1A" stroke-width=".6" opacity=".7"/>';
  if(!papers.length){ s += '<text x="300" y="190" text-anchor="middle" font-family="' + SERIF + '" font-style="italic" font-size="10" fill="#9A8F80">No papers on this map yet</text></svg>'; return s; }
  const rows = (t.rows || []).filter((r, i) => i === 0 || papers.some(p => p.sub === r.id)).slice(0, 7);
  const rowY = {}, top = 100, bot = 262, n = Math.max(1, rows.length - 1);
  rows.forEach((r, i) => { rowY[r.id] = rows.length === 1 ? (top + bot) / 2 : top + (bot - top) * i / n; });
  const span = Math.max(4, y1 - y0), a0 = y0 - span * 0.06, a1 = y1 + span * 0.06, X = y => 132 + (y - a0) / (a1 - a0) * 396;
  const step = span > 60 ? 20 : span > 24 ? 10 : 5, first = Math.ceil(a0 / step) * step;
  for(let yr = first; yr <= a1; yr += step){ const x = X(yr); s += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="86" y2="276" stroke="#CDBFA6" stroke-width=".35"/><text x="' + x.toFixed(1) + '" y="286" text-anchor="middle" font-family="' + SANS + '" font-size="5.6" fill="#9A8F80">' + yr + '</text>'; }
  rows.forEach((r, i) => { s += '<text x="' + (i === 0 ? 34 : 40) + '" y="' + (rowY[r.id] + 2.4).toFixed(1) + '" font-family="' + SERIF + '" font-size="' + (i === 0 ? 7.2 : 6.6) + '"' + (i === 0 ? ' font-weight="700"' : '') + ' fill="#3A322B">' + esc(String(r.name).slice(0, 22)) + '</text>' + (i ? '<line x1="35" x2="35" y1="' + (rowY[r.id] - 4).toFixed(1) + '" y2="' + (rowY[r.id] + 3).toFixed(1) + '" stroke="#B8AA92" stroke-width=".6"/>' : ''); });
  const pos = {}, jitter = {};
  papers.forEach(p => { const ry = rowY[p.sub] != null ? rowY[p.sub] : rowY[rows[0].id]; const k = p.y + '|' + ry; jitter[k] = (jitter[k] || 0) + 1; pos[p.id] = [X(p.y), ry + (jitter[k] - 1) * 3.4]; });
  const deg = {}, brColor = {};
  (D.branches || []).forEach(b => { brColor[b.id] = b.color; });
  D.links.forEach(l => { if(!pos[l[0]] || !pos[l[1]]) return; deg[l[0]] = (deg[l[0]] || 0) + 1; deg[l[1]] = (deg[l[1]] || 0) + 1;
    const [ax, ay] = pos[l[0]], [bx, by] = pos[l[1]], c = (D.lineBranch || {})[l[0] + '|' + l[1] + '|' + l[2]], col = c && brColor[c] ? brColor[c] : null, dx = Math.max(14, Math.abs(bx - ax) * 0.45);
    s += '<path d="M' + ax.toFixed(1) + ' ' + ay.toFixed(1) + 'C' + (ax + dx).toFixed(1) + ' ' + ay.toFixed(1) + ' ' + (bx - dx).toFixed(1) + ' ' + by.toFixed(1) + ' ' + bx.toFixed(1) + ' ' + by.toFixed(1) + '" fill="none" stroke="' + (col || '#8E857A') + '" stroke-width="' + (col ? 1.1 : .6) + '" opacity="' + (col ? .95 : .75) + '"/>'; });
  papers.forEach(p => { const [x, y] = pos[p.id];
    s += p.st === 'read' ? '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.2" fill="#2B2622"/>' : '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.1" fill="#F4EEE2" stroke="' + (p.st === 'want' ? '#B4432E' : '#3A322B') + '" stroke-width=".8"/>'; });
  papers.slice().sort((a, b) => (deg[b.id] || 0) - (deg[a.id] || 0)).slice(0, 4).forEach(p => { const [x, y] = pos[p.id]; const tt = String(p.t || '').split(':')[0].slice(0, 28);
    s += '<text x="' + x.toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="middle" font-family="' + SERIF + '" font-weight="700" font-size="5.8" fill="#231E1A">' + esc(tt) + '</text>'; });
  s += '<g font-family="' + SANS + '" font-size="5.2" fill="#7C7062"><line x1="34" x2="46" y1="318" y2="318" stroke="#B4432E" stroke-width="1"/><text x="50" y="320">main line</text><circle cx="92" cy="318" r="2" fill="#2B2622"/><text x="97" y="320">read</text><circle cx="122" cy="318" r="2" fill="none" stroke="#B4432E" stroke-width=".8"/><text x="127" y="320">want to read</text></g></svg>';
  return s;
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
  const face = svgURL(faceSVG(t));
  el.querySelectorAll('.fc').forEach(f => { f.style.backgroundImage = 'url(' + AS + 'light-' + v + '-hl.webp),url(' + AS + 'light-' + v + '-mul.webp),' + face + ',url(' + AS + 'map-paper.webp)'; f.style.backgroundBlendMode = 'screen,multiply,multiply,normal'; });
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
/* the row of folded maps: three sheets, then a fourth map or "More maps", then New map */
function layoutRow(){
  const row = $('rowItems'); row.innerHTML = '';
  const lab = (x, y, b, s) => '<div class="mlabel" style="left:' + x + 'px;top:' + (y + 198) + 'px"><b>' + esc(b) + '</b><span>' + esc(s) + '</span></div>';
  const slotX = [STACK[2].a2, STACK[1].a2, STACK[0].a2, SLOT4, SLOT5];
  /* each sheet keeps its map; its label sits under its place in the row */
  let html = '', next = 0;
  [2, 1, 0].forEach(si => { const t = D.topics.find(x => x.id === sheets[si]._topic); if(t){ html += lab(STACK[si].a2[0], STACK[si].a2[1], t.name, metaOf(t)); next++; } });
  const onSheets = sheets.map(el => el._topic).filter(Boolean), rest = order.filter(t => !onSheets.includes(t.id));
  if(rest.length === 1){ const t = rest[0], sx = slotX[next]; html += '<div class="xcover" data-topic="' + esc(t.id) + '" style="left:' + (sx[0] - 93.33) + 'px;top:' + (sx[1] - 175) + 'px;--r:' + sx[2] + 'deg;background-image:' + esc(svgURL(coverSVG(t))) + ',url(' + AS + 'cover-paper.webp)" title="' + esc(t.name) + '"></div>' + lab(sx[0], sx[1], t.name, metaOf(t)); next++; }
  else if(rest.length > 1){ const sx = slotX[next]; html += '<div class="xcover more" id="moreMaps" style="left:' + (sx[0] - 93.33) + 'px;top:' + (sx[1] - 175) + 'px;--r:' + sx[2] + 'deg"><b>' + rest.length + '</b><span>more maps</span></div>' + lab(sx[0], sx[1], 'More maps', 'all ' + order.length + ' of them'); next++; }
  const ns = slotX[Math.min(next, 4)];
  html += '<div id="newMap" style="left:' + (ns[0] - 93.33) + 'px;top:' + (ns[1] - 175) + 'px;background-image:url(' + AS + 'newmap.webp)" title="New map" role="button" tabindex="0"></div>' + lab(ns[0], ns[1], 'New map', 'for another field');
  row.innerHTML = html;
  row.querySelectorAll('.xcover[data-topic]').forEach(c => c.addEventListener('click', () => { if(state === 'maps') openTopic(c.dataset.topic, c); }));
  const more = $('moreMaps'); if(more) more.addEventListener('click', e => { e.stopPropagation(); if(state === 'maps') openList(); });
  $('newMap').addEventListener('click', () => { if(state === 'maps' && P){ P.newMap(); } });
  $('newMap').addEventListener('keydown', e => { if((e.key === 'Enter' || e.key === ' ') && state === 'maps' && P){ e.preventDefault(); P.newMap(); } });
  const n = order.length; $('mtagCount').textContent = n + (n === 1 ? ' map' : ' maps') + (n ? ' · open one' : ' · make the first');
}
function openList(){ const box = $('mapList'); box.innerHTML = '<h3>All your maps</h3>' + order.map(t => '<button data-topic="' + esc(t.id) + '"><b>' + esc(t.name) + '</b><span>' + esc(metaOf(t)) + '</span></button>').join('');
  box.classList.add('on'); box.querySelectorAll('button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); box.classList.remove('on'); openTopic(b.dataset.topic, $('moreMaps')); })); }
addEventListener('click', e => { if(!e.target.closest('#mapList,#moreMaps')) $('mapList').classList.remove('on'); });

/* ============ folding ============ */
function settle(el, folded){
  el.querySelectorAll('.pn,.shd,.shd2,.fc,.bk').forEach(x => x.getAnimations().forEach(a => a.cancel()));
  el.querySelector('.pn.l').style.transform = folded ? 'rotateY(180deg) translateZ(-1px)' : 'rotateY(0deg)';
  el.querySelector('.pn.r').style.transform = folded ? 'rotateY(-180deg) translateZ(-2px)' : 'rotateY(0deg)';
  el.querySelectorAll('.shd,.shd2').forEach(sd => sd.style.transform = folded ? 'translateX(0) scaleX(.3334)' : 'translateX(0) scaleX(1)');
  el.classList.toggle('folded', folded); void el.offsetWidth; }
function fold(el, d0, dur){ settle(el, false);
  const L = el.querySelector('.pn.l'), R = el.querySelector('.pn.r'), shds = el.querySelectorAll('.shd,.shd2');
  const shade = (pn, d) => { if(!reduce) pn.querySelectorAll('.fc,.bk').forEach(f => f.animate([{'--sh': 0}, {'--sh': 1, offset: .5}, {'--sh': 0}], {duration: dur, delay: d, fill: 'none'})); };
  shade(L, d0); shade(R, d0 + dur * .55); el.classList.add('folded');
  return Promise.all([
    anim(L, [{transform: 'rotateY(0deg)'}, {transform: 'rotateY(95deg) translateZ(-1px)', offset: .5}, {transform: 'rotateY(180deg) translateZ(-1px)'}], {duration: dur, delay: d0, easing: EASE}),
    anim(R, [{transform: 'rotateY(0deg)'}, {transform: 'rotateY(-95deg) translateZ(-2px)', offset: .5}, {transform: 'rotateY(-180deg) translateZ(-2px)'}], {duration: dur, delay: d0 + dur * .55, easing: EASE}),
    ...[...shds].map(sd => anim(sd, [{transform: 'translateX(0) scaleX(1)'}, {transform: 'translateX(' + (W / 6) + 'px) scaleX(.6667)', offset: .45}, {transform: 'translateX(0) scaleX(.3334)'}], {duration: dur * 1.55, delay: d0, easing: 'linear'}))]); }
function unfold(el, d0, dur){ settle(el, true);
  const L = el.querySelector('.pn.l'), R = el.querySelector('.pn.r'), shds = el.querySelectorAll('.shd,.shd2');
  el.classList.remove('folded');
  return Promise.all([
    anim(R, [{transform: 'rotateY(-180deg) translateZ(-2px)'}, {transform: 'rotateY(-85deg) translateZ(-2px)', offset: .5}, {transform: 'rotateY(0deg)'}], {duration: dur, delay: d0, easing: EASE}),
    anim(L, [{transform: 'rotateY(180deg) translateZ(-1px)'}, {transform: 'rotateY(85deg) translateZ(-1px)', offset: .5}, {transform: 'rotateY(0deg)'}], {duration: dur, delay: d0 + dur * .5, easing: EASE}),
    ...[...shds].map(sd => anim(sd, [{transform: 'translateX(0) scaleX(.3334)'}, {transform: 'translateX(' + (W / 6) + 'px) scaleX(.6667)', offset: .5}, {transform: 'translateX(0) scaleX(1)'}], {duration: dur * 1.5, delay: d0, easing: 'linear'}))]); }

/* ============ desk → Your maps → a map, and back ============ */
async function toMaps(){
  if(busy || state !== 'desk') return; busy = true; closeMenus();
  setState('maps', order.length ? 'Choose a map to open it' : 'Make your first map');
  const moves = [];
  [2, 1, 0].forEach((si, k) => { const el = sheets[si]; el.classList.remove('lift');
    if(!el._topic){ moves.push(anim(el, [{opacity: 1}, {opacity: 0}], {duration: 360, delay: k * 60})); return; }
    const s = STACK[si];
    moves.push(Promise.all([move(el, [s.a2[0], s.a2[1] - 26, s.a2[2]], 1.0, 520, k * 90, 'cubic-bezier(.3,0,.3,1)').then(() => move(el, s.a2, 1.0, 420, 0, 'cubic-bezier(.2,.7,.2,1)')), fold(el, 160 + k * 90, 560)])); });
  await Promise.all(moves); busy = false;
}
async function toDesk(){
  if(busy || state !== 'maps') return; busy = true; $('mapList').classList.remove('on');
  setState('desk', HINT_DESK);
  sheets.forEach((el, k) => { el.style.zIndex = 10 + k; });
  await Promise.all(sheets.map((el, k) => el._topic ? move(el, STACK[k].a1, 1, 760, k * 70, 'cubic-bezier(.3,.1,.2,1)') : (setPose(el, STACK[k].a1, 1), settle(el, false), anim(el, [{opacity: 0}, {opacity: 1}], {duration: 500, delay: 400}))));
  for(const el of sheets){ if(el._topic && el.classList.contains('folded')) await unfold(el, 0, 430); }
  busy = false;
}
function coverPose(){ const s = FIT.s, cx = (innerWidth / 2 - FIT.tx) / s, cy = (innerHeight / 2 - FIT.ty) / s;
  return [[cx, cy, 0], Math.max(innerWidth / s / W, innerHeight / s / H) * 1.005]; }
let current = null;   /* {el, tid, temp, from} */
function posOf(node){ const r = node.getBoundingClientRect(); return [(r.left + r.width / 2 - FIT.tx) / FIT.s, (r.top + r.height / 2 - FIT.ty) / FIT.s]; }
async function openTopic(tid, fromNode){
  if(busy || state !== 'maps') return;
  let el = sheetOf(tid), temp = false, home = null;
  if(!el){ const t = D.topics.find(x => x.id === tid); if(!t) return;
    el = makeSheet(); temp = true; paintSheet(el, t); settle(el, true);
    const [x, y] = fromNode ? posOf(fromNode) : [SLOT4[0], SLOT4[1]]; home = [x, y, SLOT4[2]]; setPose(el, home, 1); el.style.zIndex = 58; }
  busy = true; setState('opening', ''); el.style.zIndex = 60;
  current = {el, tid, temp, home: temp ? home : el._slot.a2};
  sheets.filter(o => o !== el && o._topic).forEach((o, k) => { o._p = o.style.transform; anim(o, [{transform: o.style.transform, opacity: 1}, {transform: o.style.transform + ' translateY(60px)', opacity: 0}], {duration: 420, delay: k * 40, easing: 'ease-in'}); });
  await move(el, [720, 452, 0], 1.55, 620, 0, 'cubic-bezier(.3,.1,.2,1)');
  await unfold(el, 0, 640);
  const [cp, cs] = coverPose();
  await move(el, cp, cs, 720, 0, 'cubic-bezier(.4,.1,.2,1)');
  if(P) P.openMap(tid);
  setState('map', '');
  busy = false;
}
/* the app calls this when you come back from a map */
async function returnFromMap(tid){
  if(typeof dismissWelcome === 'function') dismissWelcome(true);
  D = load(); prefs = Object.assign(prefs, D.prefs || {});
  const keepOrder = order.map(t => t.id); order = orderedTopics();
  if(!sheets.some(el => el._topic === tid) && !(current && current.tid === tid)){ /* the map you were on has no sheet: a sheet for it, which goes back to its cover */ }
  sheets.forEach((el, i) => { const t = D.topics.find(x => x.id === el._topic); if(el._topic && t) paintSheet(el, t); else if(el._topic){ paintSheet(el, null); el.classList.add('blank'); } });
  layoutRow();
  let el = sheetOf(tid), temp = false, home;
  if(el){ home = el._slot.a2; if(current && current.temp && current.el !== el){ current.el.remove(); } }
  else if(current && current.tid === tid){ el = current.el; temp = current.temp; home = current.home; }
  else { const t = D.topics.find(x => x.id === tid); if(!t){ show(); return; }
    el = makeSheet(); temp = true; paintSheet(el, t); const cov = $('rowItems').querySelector('.xcover'); home = cov ? posOf(cov).concat([SLOT4[2]]) : SLOT4.slice(); }
  busy = true; setState('closing', '');
  settle(el, false); const [cp, cs] = coverPose(); setPose(el, cp, cs); el.style.opacity = '1'; el.style.zIndex = 60;
  sheets.filter(o => o !== el).forEach(o => { if(o._topic){ o.style.opacity = 0; settle(o, true); setPose(o, o._slot.a2, 1); } });
  await sleep(40);
  await move(el, [720, 452, 0], 1.55, 620, 0, 'cubic-bezier(.4,.1,.2,1)');
  await fold(el, 0, 520);
  setState('maps', order.length ? 'Choose a map to open it' : 'Make your first map');
  sheets.filter(o => o !== el && o._topic).forEach((o, k) => { anim(o, [{transform: poseT(o._slot.a2, 1) + ' translateY(60px)', opacity: 0}, {transform: poseT(o._slot.a2, 1), opacity: 1}], {duration: 460, delay: k * 50, easing: 'cubic-bezier(.2,.7,.2,1)'}); });
  await move(el, home, 1, 560, 0, 'cubic-bezier(.3,.1,.2,1)');
  if(temp){ await anim(el, [{opacity: 1}, {opacity: 0}], {duration: 200}); el.remove(); }
  else el.style.zIndex = 10 + sheets.indexOf(el);
  current = null; busy = false;
}
/* the app calls this to bring the desk back without a map to fold */
function show(where){
  D = load(); prefs = Object.assign(prefs, D.prefs || {}); refreshAll();
  if(current){ if(current.temp) current.el.remove(); current = null; }
  sheets.forEach((el, k) => { el.getAnimations().forEach(a => a.cancel()); settle(el, false); setPose(el, STACK[k].a1, 1); el.style.opacity = '1'; el.style.zIndex = 10 + k; });
  RB.style.opacity = '0'; RB.classList.remove('entered'); rcard.classList.remove('on');
  if(book.parentNode !== bookHome) bookHome.insertBefore(book, bookNext);
  [book, cover].forEach(x => { x.getAnimations().forEach(a => a.cancel()); x.style.transform = ''; x.style.visibility = ''; });
  document.body.classList.remove('dof'); stage.classList.remove('zooming'); fit();
  setState('desk', HINT_DESK); busy = false;
  if(where === 'papers'){ dismissWelcome(true); renderPapers(); setState('papers', ''); }
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
function closeMenus(){ cupMenu.classList.remove('on'); panel.classList.remove('on'); $('mapList').classList.remove('on'); }
stage.addEventListener('click', e => { if(!e.target.closest('#cupMenu') && !e.target.closest('#cupHit')) cupMenu.classList.remove('on'); });

/* ============ Papers: every paper on your maps, as A4 pages ============ */
let pFilter = {map: '', st: '', q: ''}, pAll = false; const P_FIRST = 240;
function renderPapers(){
  const ps = D.papers.slice();
  const tName = {}; D.topics.forEach(t => { tName[t.id] = t.name; });
  $('pbCount').textContent = ps.length + (ps.length === 1 ? ' paper' : ' papers') + ' · ' + ps.filter(p => p.st === 'read').length + ' read · ' + ps.filter(p => p.st === 'want').length + ' to read';
  $('pbMaps').innerHTML = '<button class="tp' + (pFilter.map ? '' : ' on') + '" data-map=""><span>All papers</span><em>' + ps.length + '</em></button>' + D.topics.map(t => '<button class="tp' + (pFilter.map === t.id ? ' on' : '') + '" data-map="' + esc(t.id) + '"><span>' + esc(t.name) + '</span><em>' + ps.filter(p => p.topic === t.id).length + '</em></button>').join('');
  $('pbSt').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.st === pFilter.st));
  const q = pFilter.q.trim().toLowerCase();
  const list = ps.filter(p => (!pFilter.map || p.topic === pFilter.map) && (!pFilter.st || (pFilter.st === 'none' ? !p.st : p.st === pFilter.st)) && (!q || (p.t + ' ' + p.au + ' ' + p.y + ' ' + (p.v || '')).toLowerCase().includes(q)))
    .sort((a, b) => (tName[a.topic] || '').localeCompare(tName[b.topic] || '') || (a.y || 0) - (b.y || 0));
  const shown = pAll ? list : list.slice(0, P_FIRST);
  $('pbGrid').innerHTML = list.length ? shown.map((p, i) => '<figure class="pg" data-id="' + esc(p.id) + '" tabindex="0" role="button" style="--i:' + Math.min(i, 40) + '"><div class="sheet"><p class="pj">' + esc((p.v || tName[p.topic] || '').slice(0, 40)) + (p.y ? ' · ' + p.y : '') + '</p><h4>' + esc(String(p.t || 'Untitled').slice(0, 90)) + '</h4><p class="pa">' + esc(String(p.au || '').slice(0, 60)) + '</p><i class="ln"></i>' + (p.st ? '<span class="stamp ' + p.st + '">' + (p.st === 'read' ? 'READ' : 'TO READ') + '</span>' : '') + (p.book ? '<span class="bk-mark">BOOK</span>' : '') + '</div><figcaption><b>' + esc(String(p.t || 'Untitled').slice(0, 70)) + '</b><span>' + esc(tName[p.topic] || '') + '</span></figcaption></figure>').join('')
    : '<p class="pb-empty">' + (ps.length ? 'Nothing matches.' : 'No papers yet. Open a map and add the first one with +.') + '</p>';
  if(list.length > shown.length) $('pbGrid').insertAdjacentHTML('beforeend', '<button class="rc-btn pb-more" id="pbMore">Show all ' + list.length + ' papers</button>');
}
$('pboard').addEventListener('click', e => {
  if(e.target.closest('#pbMore')){ pAll = true; renderPapers(); return; }
  const m = e.target.closest('[data-map]'); if(m){ pFilter.map = m.dataset.map; pAll = false; renderPapers(); return; }
  const s = e.target.closest('#pbSt button'); if(s){ pFilter.st = pFilter.st === s.dataset.st ? '' : s.dataset.st; renderPapers(); return; }
  const g = e.target.closest('.pg'); if(g && P){ P.openPaper(g.dataset.id); }
});
$('pboard').addEventListener('keydown', e => { const g = e.target.closest && e.target.closest('.pg'); if(g && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); if(P) P.openPaper(g.dataset.id); } });
$('pbQ').addEventListener('input', e => { pFilter.q = e.target.value; pAll = false; renderPapers(); });
async function toPapers(){ if(busy || state !== 'desk') return; busy = true; closeMenus(); renderPapers(); setState('papers', ''); await sleep(820); busy = false; }
async function fromPapers(){ if(busy || state !== 'papers') return; busy = true; panel.classList.remove('on'); setState('desk', HINT_DESK); await sleep(700); busy = false; }
$('papersLayer').addEventListener('click', toPapers); $('ptag').addEventListener('click', toPapers);
['papersLayer', 'ptag'].forEach(id => { $(id).addEventListener('mouseenter', () => { if(state === 'desk') document.body.classList.add('plift'); }); $(id).addEventListener('mouseleave', () => document.body.classList.remove('plift')); });
$('ptag').addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toPapers(); } });
$('tagMaps').addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); if(state === 'desk') toMaps(); } });
$('papersBack').addEventListener('click', fromPapers);
$('newPaper').addEventListener('click', () => { if(P) P.newPaper(pFilter.map || (order[0] && order[0].id)); });

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
  $('pastBooks').hidden = !past.length; $('pastName').textContent = NB === cur ? 'Past books' : 'Notebook ' + (NBS.indexOf(NB) + 1);
  $('pastMenu').innerHTML = '<p>PAST BOOKS</p>' + (NB !== cur ? '<button data-nb="' + (NBS.length - 1) + '" class="back">Back to your current notebook</button>' : '') + past.map((n, i) => '<button data-nb="' + i + '"' + (n === NB ? ' class="on"' : '') + '>Notebook ' + (i + 1) + '<em>' + (k => k + (k === 1 ? ' page' : ' pages'))(n.pages.filter(p => p.text && p.text.trim()).length) + ' · ' + nbSpan(n) + '</em></button>').join('');
  const full = NB === cur && NB.cur >= NB_MAX - 1; $('memoNew').hidden = !full; }
function memoShow(){ const pg = NB.pages[NB.cur] || {text: '', date: null};
  memoText.textContent = pg.text || ''; $('memoDate').textContent = fmtDate(pg.date || today());
  $('memoPage').textContent = (NB.cur + 1) + ' / ' + NB_MAX + (NB.cur + 1 === NB_MAX ? ' · full' : '');
  $('memoPrev').disabled = NB.cur === 0; $('memoNext').disabled = NB.cur >= NB_MAX - 1; renderNbList(); }
function memoTurn(d){ const n = NB.cur + d; if(n < 0 || n > NB_MAX - 1) return;
  memoText.classList.add(d > 0 ? 'out-l' : 'out-r');
  setTimeout(() => { while(NB.pages.length <= n) NB.pages.push({text: '', date: null, edited: null}); NB.cur = n; memoShow(); nbSave();
    memoText.classList.remove('out-l', 'out-r'); memoText.classList.add(d > 0 ? 'out-r' : 'out-l'); void memoText.offsetWidth; memoText.classList.remove('out-l', 'out-r');
    if(state === 'note') caretEnd(); }, 170); }
function caretEnd(){ memoText.focus(); const r = document.createRange(); r.selectNodeContents(memoText); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
['memoPrev', 'memoNext'].forEach((id, k) => $(id).addEventListener('click', e => { e.stopPropagation(); memoTurn(k ? 1 : -1); }));
const fontMenu = $('fontMenu');
$('fontPick').addEventListener('click', e => { e.stopPropagation(); fontMenu.classList.toggle('on'); });
fontMenu.addEventListener('click', e => { e.stopPropagation();
  const f = e.target.closest('button[data-f]'); if(f){ NB.font = f.dataset.f; nbFont(); nbSave(); fontMenu.classList.remove('on'); if(state === 'note') memoText.focus(); } });
const pastMenu = $('pastMenu');
$('pastBooks').addEventListener('click', e => { e.stopPropagation(); fontMenu.classList.remove('on'); pastMenu.classList.toggle('on'); });
pastMenu.addEventListener('click', e => { e.stopPropagation(); const nb = e.target.closest('button[data-nb]'); if(!nb) return;
  NB = NBS[+nb.dataset.nb]; if(NB !== NBS[NBS.length - 1]) NB.cur = 0; nbFont(); memoShow(); pastMenu.classList.remove('on'); if(state === 'note') caretEnd(); });
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
async function openNote(){ if(busy || state !== 'desk') return; busy = true; closeMenus();
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
  if(state === 'note') closeNote(); else if(state === 'maps') toDesk(); else if(state === 'papers') fromPapers(); else if(state === 'books') closeBook(); });

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
window.pmDeskPage = {returnFromMap, show, refresh(){ D = load(); prefs = Object.assign(prefs, D.prefs || {}); if(state === 'desk' && !busy) refreshAll(); }, state: () => state, busy: () => busy};
if(P && P.ready) P.ready();
})();
