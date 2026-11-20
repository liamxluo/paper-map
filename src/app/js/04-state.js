/* ===================== state ===================== */
let lib = null, status = {}, statusTime = 0, settings = null, IDX = null;
const ui = {topic:null, sub:null, group:null, prio:'all', q:'', tag:'', dom:'', st:'all', edit:false, selected:null, pending:null, branch:null, depth:1};

function validLib(L){
  if(!(L && Array.isArray(L.topics) && L.entries && typeof L.entries === 'object' && Array.isArray(L.links))) return false;
  for(const tp of L.topics){
    if(!tp || !ID_RE.test(tp.id) || !Array.isArray(tp.subs) || !tp.subs.length) return false;
    for(const s of tp.subs){ if(!s || !ID_RE.test(s.id)) return false; if(!Array.isArray(s.groups)) s.groups = []; }
  }
  for(const id of Object.keys(L.entries)){ const e = L.entries[id]; if(!e || e.id !== id || !ID_RE.test(id)) return false; }
  return true;
}
function defaultSettings(){ return {lanes:null, mapColor:'source', range:null, colors:null, paper:'mist', toc:null, updatedAt:0}; }
function normalizeSettings(S){
  if(S.mapColor !== 'plain') S.mapColor = 'source';
  if(!['mist','warm','white'].includes(S.paper)) S.paper = 'mist';
  if(S.lanes != null && !Array.isArray(S.lanes)) S.lanes = null;
  S.skipModifyConfirm = S.skipModifyConfirm === true;
  S.showPre = S.showPre === true;
  if(!['auto', 'light', 'dark'].includes(S.theme)) S.theme = 'auto';
  if(![1, 2, 3, 'all'].includes(S.focusDepth)) S.focusDepth = 1;
  S.showConcepts = S.showConcepts !== false;
  S.showRelated = S.showRelated !== false;
  S.relOpen = !!S.relOpen;
  S.hfFoldOpen = !!S.hfFoldOpen;
  if(!['flow', 'cite', 'off'].includes(S.arrows)) S.arrows = 'flow';
  if(!['all', 'up', 'down', 'lineage'].includes(S.focusDir)) S.focusDir = 'all';
  S.hfOpen = !!S.hfOpen;
  S.hiddenBranches = Array.isArray(S.hiddenBranches) ? S.hiddenBranches.filter(x => typeof x === 'string') : [];
  S.undoWindow = [0, 5, 10, 30].includes(S.undoWindow) ? S.undoWindow : 10;
  return S;
}
function normalizeLib(L){
  if(!Array.isArray(L.tlinks)) L.tlinks = [];
  if(!L.tlinkColor || typeof L.tlinkColor !== 'object' || Array.isArray(L.tlinkColor)) L.tlinkColor = {};
  if(!Array.isArray(L.branches)) L.branches = [];
  L.branches = L.branches.filter(b => b && ID_RE.test(String(b.id))).map(b => ({id: String(b.id), name: String(b.name || 'Colour line').slice(0, 40), color: HEX_RE.test(b.color) ? b.color : BRANCH_PALETTE[0]}));
  if(!L.lineBranch || typeof L.lineBranch !== 'object' || Array.isArray(L.lineBranch)) L.lineBranch = {};
  if(!Array.isArray(L.tags) || !L.tags.every(x => x && ID_RE.test(String(x.id)))) L.tags = defaultTags();
  Object.values(L.entries).forEach(e => { if(e.kind === 'paper' && !Array.isArray(e.tags)) e.tags = []; });
  /* v2: there are no concepts any more (a concept has no true date); clear what is left of them */
  const gone = new Set(Object.values(L.entries).filter(e => e.kind === 'concept').map(e => e.id));
  gone.forEach(id => { delete L.entries[id]; });
  Object.values(L.entries).forEach(e => { delete e.needs; if(e.parent) delete e.parent; e.mentions = Array.isArray(e.mentions) ? [...new Set(e.mentions.filter(x => typeof x === 'string' && x))] : []; });
  L.links = (L.links || []).filter(l => l[2] !== 'o' && !gone.has(l[0]) && !gone.has(l[1]));
  /* v2.1: the desk keeps your Readings (a reading list of books), its own categories, and research logs (up to 60 pages each) */
  L.readings = (Array.isArray(L.readings) ? L.readings : []).filter(b => b && typeof b === 'object' && typeof b.id === 'string' && typeof b.title === 'string');
  L.readingCats = [...new Set((Array.isArray(L.readingCats) ? L.readingCats : []).filter(c => typeof c === 'string' && c.trim()))];
  L.notebooks = (Array.isArray(L.notebooks) ? L.notebooks : []).filter(n => n && typeof n.id === 'string' && Array.isArray(n.pages)).map(n => Object.assign(n, {pages: n.pages.slice(0, 60)}));
  return L;
}
function loadAll(){
  const L = lsGet(LS.lib);
  lib = validLib(L) ? normalizeLib(L) : buildSeed();
  const S = lsGet(LS.status);
  if(S && S.map && typeof S.map === 'object'){ status = S.map; statusTime = S.updatedAt || 0; }
  else { status = {}; statusTime = 0; }
  const G = lsGet(LS.settings);
  settings = normalizeSettings(Object.assign(defaultSettings(), (G && typeof G === 'object') ? G : {}));
}

/* a topic always has a row of its own (a hidden subtopic holding the papers about the topic as a whole), listed first */
function ensureOwnRow(L){
  (L.topics || []).forEach(tp => {
    if(!Array.isArray(tp.subs)) tp.subs = [];
    let own = tp.subs.find(s => s.hidden);
    if(!own){
      const taken = new Set(); (L.topics || []).forEach(x => (x.subs || []).forEach(s => taken.add(s.id))); (L.topics || []).forEach(x => taken.add(x.id));
      let id = tp.id + '-own', k = 1; while(taken.has(id)) id = tp.id + '-own' + (++k);
      own = {id, name: tp.name, desc: '', groups: [], hidden: true};
      if(Array.isArray(settings.lanes) && tp.subs.some(s => settings.lanes.includes(s.id))) settings.lanes.push(id);
      tp.subs.unshift(own);
    }else if(tp.subs[0] !== own){ tp.subs = [own].concat(tp.subs.filter(s => s !== own)); }
    tp.subs.filter(s => s.hidden && s !== own).forEach(s => { delete s.hidden; });
    own.name = tp.name; delete own.parent;
  });
}
function reindex(){
  if(!Array.isArray(lib.tags)) lib.tags = defaultTags();
  ensureOwnRow(lib);
  const subs = {}, topicOf = {};
  lib.topics.forEach(tp => tp.subs.forEach(s => { subs[s.id] = s; topicOf[s.id] = tp.id; }));
  const topics = Object.fromEntries(lib.topics.map(tp => [tp.id, tp]));
  const up = {}, down = {}, cUp = {}, cDown = {};
  lib.links = lib.links.filter(l => Array.isArray(l) && lib.entries[l[0]] && lib.entries[l[1]] && l[0] !== l[1]);
  lib.links.forEach(([a, b, t, note]) => {
    if(t === 'o'){ (cDown[a] = cDown[a] || []).push(b); (cUp[b] = cUp[b] || []).push(a); }
    else{ (down[a] = down[a] || []).push([b, t, note || '']); (up[b] = up[b] || []).push([a, t, note || '']); }
  });
  const users = {}, children = {}, bySub = {};
  Object.values(lib.entries).forEach(e => {
    if(!subs[e.sub]){ const tp = topics[e.topic] || lib.topics[0]; e.topic = tp.id; e.sub = tp.subs[0].id; }
    else e.topic = topicOf[e.sub];
    if(e.kind !== 'concept') (bySub[e.sub] = bySub[e.sub] || []).push(e);
    (e.needs || []).forEach(c => { if(lib.entries[c]) (users[c] = users[c] || []).push(e.id); });
    if(e.parent){ if(lib.entries[e.parent]) (children[e.parent] = children[e.parent] || []).push(e.id); else delete e.parent; }
  });
  const domains = new Set(DOMAINS);
  Object.values(lib.entries).forEach(e => (e.d || []).forEach(x => domains.add(x)));
  /* subtopics nest without limit: s.parent names another subtopic of the same topic */
  const kids = {}, depth = {}, subOrder = {};
  lib.topics.forEach(tp => {
    const ids = new Set(tp.subs.map(s => s.id));
    tp.subs.forEach(s => { if(s.parent && (s.hidden || s.parent === s.id || !ids.has(s.parent) || subs[s.parent].hidden)) delete s.parent; });
    tp.subs.forEach(s => { const seen = new Set(); let x = s; while(x && x.parent){ if(seen.has(x.id)){ delete s.parent; break; } seen.add(x.id); x = subs[x.parent]; } });
    tp.subs.forEach(s => { if(s.parent) (kids[s.parent] = kids[s.parent] || []).push(s); });
    const order = [];
    const walk = (s, d) => { depth[s.id] = d; order.push(s); (kids[s.id] || []).forEach(k => walk(k, d + 1)); };
    tp.subs.forEach(s => { if(!s.parent) walk(s, 0); });
    subOrder[tp.id] = order;
  });
  /* topic links: [a, b, note?] where a and b are topic or subtopic ids */
  if(!Array.isArray(lib.tlinks)) lib.tlinks = [];
  const nodeOk = id => (topics[id]) || (subs[id] && !subs[id].hidden);
  const seenTL = new Set();
  lib.tlinks = lib.tlinks.filter(l => { if(!Array.isArray(l) || l[0] === l[1] || !nodeOk(l[0]) || !nodeOk(l[1])) return false; const k = [l[0], l[1]].sort().join('|'); if(seenTL.has(k)) return false; seenTL.add(k); return true; });
  if(!lib.tlinkColor || typeof lib.tlinkColor !== 'object') lib.tlinkColor = {};
  { const tk = new Set(lib.tlinks.map(l => l[0] + '|' + l[1])), bids = new Set((lib.branches || []).map(b => b.id));
    Object.keys(lib.tlinkColor).forEach(k => { if(!tk.has(k) || !bids.has(lib.tlinkColor[k])) delete lib.tlinkColor[k]; }); }
  const tlinksOf = {};
  lib.tlinks.forEach(l => { (tlinksOf[l[0]] = tlinksOf[l[0]] || []).push([l[1], l[2] || '', l]); (tlinksOf[l[1]] = tlinksOf[l[1]] || []).push([l[0], l[2] || '', l]); });
  /* colour lines: lineBranch maps "a|b|type" to a colour line's id */
  if(!Array.isArray(lib.branches)) lib.branches = [];
  if(!lib.lineBranch || typeof lib.lineBranch !== 'object') lib.lineBranch = {};
  const brIds = new Set(lib.branches.map(b => b.id)), linkKeys = new Set(lib.links.map(l => l[0] + '|' + l[1] + '|' + l[2]));
  Object.keys(lib.lineBranch).forEach(k => { if(!linkKeys.has(k) || !brIds.has(lib.lineBranch[k])) delete lib.lineBranch[k]; });
  const branchLines = {}, nodeBranches = {};
  Object.entries(lib.lineBranch).forEach(([k, bid]) => { (branchLines[bid] = branchLines[bid] || []).push(k); const [a, b] = k.split('|'); (nodeBranches[a] = nodeBranches[a] || new Set()).add(bid); (nodeBranches[b] = nodeBranches[b] || new Set()).add(bid); });
  IDX = {subs, topicOf, topics, up, down, cUp, cDown, users, children, bySub, kids, depth, subOrder, tlinksOf, branchLines, nodeBranches, domains: Array.from(domains), tags: Object.fromEntries(lib.tags.map(x => [x.id, x]))};
}
const keyOf = e => e.k || e.id;
function stOf(e){ return status[keyOf(e)] || ''; }
function entriesOfSub(sid){ return IDX.bySub[sid] || []; }
function topicEntries(tid){ return Object.values(lib.entries).filter(e => e.topic === tid && e.kind !== 'concept'); }
function allConcepts(){ return Object.values(lib.entries).filter(e => e.kind === 'concept'); }
const CONCEPT_LANE = {sub: {id: '__concepts', name: 'Concepts', groups: []}, topic: {id: '__concepts', name: 'Concepts'}, concepts: true};
function laneOf(e){ return e.kind === 'concept' ? '__concepts' : e.sub; }
function tagsOf(e){ const ts = e.tags || []; return lib.tags.filter(x => ts.includes(x.id)); }
function mapTagsOf(e){ return tagsOf(e).filter(x => x.map !== false).slice(0, 3); }
function rgbHex(c){ return '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function relLum(c){ const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
function isDark(){ const a = document.documentElement.getAttribute('data-theme'); if(a === 'dark') return true; if(a === 'light') return false; return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
/* In dark mode, lighten tag colours that would be too dark to see */
function tagColor(x){
  const hex = x && /^#[0-9a-f]{6}$/i.test(x.color) ? x.color : '#9AA0AA';
  if(!isDark()) return hex;
  let c = hexToRgb(hex), k = 0;
  while(k < 8 && (relLum(c) + 0.05) / 0.058 < 2.6){ c = c.map(v => v + (255 - v) * 0.2); k++; }
  return rgbHex(c);
}
function tagChip(x){ return '<span class="tagchip"><i style="background:' + tagColor(x) + '"></i>' + esc(x.name) + '</span>'; }
function tagToggle(x, on, attr){ return '<button type="button" class="tagchip" ' + attr + '="' + esc(x.id) + '" aria-pressed="' + on + '"><i style="background:' + tagColor(x) + '"></i>' + esc(x.name) + '</button>'; }
function defaultNewTags(){ return []; }
function treeSubs(tp){ return (IDX && IDX.subOrder && IDX.subOrder[tp.id]) || tp.subs; }
function visibleSubs(tp){ return treeSubs(tp).filter(s => !s.hidden); }
function subDescendants(sid){ const out = []; const walk = id => (IDX.kids[id] || []).forEach(k => { out.push(k); walk(k.id); }); walk(sid); return out; }
function subAncestors(s){ const out = []; let x = s, guard = 0; while(x && x.parent && IDX.subs[x.parent] && guard++ < 64){ x = IDX.subs[x.parent]; out.unshift(x); } return out; }
function subPath(s){ return subAncestors(s).concat([s]).filter(x => !x.hidden).map(x => x.name); }
