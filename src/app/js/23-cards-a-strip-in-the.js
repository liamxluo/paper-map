/* ===================== cards: a strip in the list and under the map; open it and it turns over into the full card ===================== */
function stClass(e){ const s = stOf(e); return 'st-' + (s || 'none'); }
function cardRowHTML(e, withPlace){
  const s = IDX.subs[e.sub], place = withPlace ? (s && !s.hidden ? subPath(s).join(' › ') : (IDX.topics[e.topic] || {}).name || '') : '';
  const tags = tagsOf(e);
  return '<div class="pc-row ' + stClass(e) + '" id="r-' + e.id + '" data-open-card="' + e.id + '" tabindex="0" role="button" aria-label="Open the card of ' + esc(e.t) + '">' +
    '<span class="pc-bar" aria-hidden="true"></span>' +
    '<span class="pc-st">' + statusDots(e) + '</span>' +
    '<span class="pc-year"><span class="yr" draggable="true" data-drag-paper="' + e.id + '" title="Drag onto a topic in Contents to move it there">' + esc(e.y) + '</span></span>' +
    '<span class="pc-main"><span class="pc-title">' + esc(e.t) + '</span><span class="pc-meta">' + esc([e.au, e.v].filter(Boolean).join(' · ')) + (place ? ' · ' + esc(place) : '') + '</span></span>' +
    '<span class="pc-tags">' + tags.slice(0, 3).map(tagChip).join('') + (tags.length > 3 ? '<span class="pc-more-tags">+' + (tags.length - 3) + '</span>' : '') + '</span>' +
    '<span class="pc-note">' + noteCell(e) + '</span>' +
    '<span class="row-more">' + moreBtn('p:' + e.id) + '</span></div>';
}
function smallCardHTML(e){
  const st = stOf(e), tp = IDX.topics[e.topic], s = IDX.subs[e.sub];
  const place = (tp ? tp.name : '') + (s && !s.hidden ? ' / ' + subPath(s).join(' / ') : '');
  return '<div class="pc-small ' + stClass(e) + '" data-open-card="' + e.id + '" tabindex="0" role="button" aria-label="Open the card of ' + esc(e.t) + '">' +
    '<span class="pc-bar" aria-hidden="true"></span><span class="pc-year">' + esc(e.y) + '</span>' +
    '<span class="pc-main"><span class="pc-title">' + esc(e.t) + '</span><span class="pc-meta">' + esc([e.au, place].filter(Boolean).join(' · ')) + '</span></span>' +
    '<span class="info-st"><button type="button" class="stbtn want" data-st="want" data-id="' + e.id + '" aria-pressed="' + (st === 'want') + '">Want to read</button><button type="button" class="stbtn read" data-st="read" data-id="' + e.id + '" aria-pressed="' + (st === 'read') + '">Read</button>' + moreBtn('p:' + e.id) + '</span>' +
    '<span class="pc-open" aria-hidden="true">›</span></div>' +
    '<p class="info-actions"><span class="hint">Double-click its dot to link it</span><button type="button" class="linkbtn" data-reader="' + e.id + '">Notes &amp; PDF</button><button type="button" class="linkbtn" data-export-paper="' + e.id + '">Export its lines</button><button type="button" class="linkbtn" data-goto="' + e.id + '">Show in list</button><button type="button" class="linkbtn" data-clear-sel="1">Clear selection</button></p>';
}
/* the paper and the papers one line away, on a little timeline of their own */
function miniMapSVG(id){
  const e = lib.entries[id]; const near = [];
  (IDX.up[id] || []).forEach(x => near.push([x[0], x[1], 'up'])); (IDX.down[id] || []).forEach(x => near.push([x[0], x[1], 'down']));
  const pts = [id].concat([...new Set(near.map(x => x[0]))]).map(k => lib.entries[k]).filter(x => x && typeof x.y === 'number');
  if(pts.length < 2) return '<p class="hint">No lines yet: double-click its dot on the map to link it.</p>';
  const ys = pts.map(x => x.y), y0 = Math.min(...ys), y1 = Math.max(...ys), span = Math.max(1, y1 - y0);
  const W = 460, L = 16, R = 16, X = y => L + 6 + (y - y0) / span * (W - L - R - 12);
  /* earlier papers it builds on above, later ones below; each paper on its own line so its name has room */
  const ups = [...new Set(near.filter(x => x[2] === 'up').map(x => x[0]))].filter(k => lib.entries[k] && typeof lib.entries[k].y === 'number').sort((a, b) => lib.entries[a].y - lib.entries[b].y);
  const dns = [...new Set(near.filter(x => x[2] === 'down').map(x => x[0]))].filter(k => !ups.includes(k) && lib.entries[k] && typeof lib.entries[k].y === 'number').sort((a, b) => lib.entries[a].y - lib.entries[b].y);
  const RowH = 34, top = 18, rows = ups.concat([id], dns), Yof = {}; rows.forEach((k, i) => { Yof[k] = top + i * RowH; });
  const H = top + rows.length * RowH + 6;
  let s = '<svg class="bc-mini" viewBox="0 0 ' + W + ' ' + (H + 16) + '" role="img" aria-label="Its lines on a small timeline">';
  s += '<line class="bm-axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + (H + 1) + '" y2="' + (H + 1) + '"/>';
  near.forEach(([k, ty, dir]) => { const o = lib.entries[k]; if(!o || typeof o.y !== 'number') return;
    const a = dir === 'up' ? [X(o.y), Yof[k]] : [X(e.y), Yof[id]], b = dir === 'up' ? [X(e.y), Yof[id]] : [X(o.y), Yof[k]], mx = (a[0] + b[0]) / 2;
    s += '<path class="bm-line ' + ty + '" d="M' + a[0].toFixed(1) + ' ' + a[1] + ' C' + mx.toFixed(1) + ' ' + a[1] + ' ' + mx.toFixed(1) + ' ' + b[1] + ' ' + b[0].toFixed(1) + ' ' + b[1] + '"/>'; });
  rows.forEach(k => { const o = lib.entries[k], me = k === id, st = stOf(o), cx = X(o.y), cy = Yof[k];
    const left = cx > W * 0.58, tx = left ? cx - 11 : cx + 11, anc = left ? 'end' : 'start';
    const title = (o.t || '').length > 40 ? o.t.slice(0, 38).replace(/[\s,.:;–-]+$/, '') + '…' : (o.t || '');
    s += '<g class="bm-node" data-select="' + esc(k) + '"><circle class="bm-dot' + (me ? ' me' : '') + ' st-' + (st || 'none') + '" cx="' + cx.toFixed(1) + '" cy="' + cy + '" r="' + (me ? 6.5 : 4.5) + '"><title>' + esc(o.y + ' · ' + o.t) + '</title></circle>' +
      '<text class="bm-t' + (me ? ' me' : '') + '" x="' + tx.toFixed(1) + '" y="' + (cy - 1) + '" text-anchor="' + anc + '">' + esc(title) + '</text>' +
      '<text class="bm-a" x="' + tx.toFixed(1) + '" y="' + (cy + 11) + '" text-anchor="' + anc + '">' + esc([shortAu(o.au), o.y].filter(Boolean).join(' · ')) + '</text></g>'; });
  [y0, y1].concat(span > 8 ? [Math.round((y0 + y1) / 2)] : []).forEach(y => { s += '<text class="bm-year" x="' + X(y).toFixed(1) + '" y="' + (H + 14) + '" text-anchor="middle">' + y + '</text>'; });
  return s + '</svg>';
}
function bigCardHTML(id){
  const e = lib.entries[id]; if(!e) return '';
  const st = stOf(e), tp = IDX.topics[e.topic], s = IDX.subs[e.sub];
  const sec = (h, inner) => '<p class="bc-h">' + h + '</p><div class="bc-box">' + inner + '</div>';
  const rows = allLaneRows().map(r => { const key = r.sub.id; return '<option value="' + esc(key) + '"' + (key === e.sub ? ' selected' : '') + '>' + esc(r.sub.hidden ? r.topic.name : r.topic.name + ' › ' + subPath(r.sub).join(' › ')) + '</option>'; }).join('');
  const lines = linesFoldHTML(id, e).replace('<details class="rel-fold" data-rel-fold="1"', '<details class="rel-fold bc-lines" open');
  const tags = tagsOf(e), np = notePreview(e.n || '');
  return '<div class="bc-top"><button type="button" class="bc-x" data-bc-close="1" aria-label="Close">✕</button>' + moreBtn('p:' + id) + '</div>' +
    '<div class="bc-head ' + stClass(e) + '"><span class="pc-bar" aria-hidden="true"></span><div><h2 class="bc-title">' + esc(e.t) + '</h2><p class="bc-sub">' + esc([e.y, e.au].filter(Boolean).join(' · ')) + '</p>' + (e.v ? '<p class="bc-src">' + esc(e.v) + '</p>' : '') + (idLinksHTML(e) ? '<p class="bc-src">' + idLinksHTML(e) + '</p>' : '') + '</div></div>' +
    '<div class="bc-st"><button type="button" class="stbtn want" data-st="want" data-id="' + id + '" aria-pressed="' + (st === 'want') + '">Want to read</button><button type="button" class="stbtn read" data-st="read" data-id="' + id + '" aria-pressed="' + (st === 'read') + '">Read</button></div>' +
    sec('Where', '<button type="button" class="bc-where2" data-bc-where="' + id + '" aria-label="Where it sits: choose another topic to move it"><i class="bc-dot"></i><span class="bc-path">' + [tp ? tp.name : ''].concat(s && !s.hidden ? subPath(s) : []).map(esc).join('<span class="bc-sep"> / </span>') + '</span><svg class="bc-updown" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6 8 2.5 11.5 6M4.5 10 8 13.5 11.5 10"/></svg></button>') +
    sec('On the map', miniMapSVG(id)) +
    (lines ? sec('Lines', lines) : '') +
    ((e.mentions || []).length ? sec('Mentions', mentionsHTML(e).replace('<p class="rel"><span class="rel-k">Mentions</span>', '<p class="rel">')) : '') +
    sec('Labels', '<div class="bc-tags">' + tags.map(x => '<button type="button" class="tagchip bc-tag" data-bc-untag="' + esc(x.id) + '" title="Remove this tag"><i style="background:' + tagColor(x) + '"></i>' + esc(x.name) + '<span class="bc-x-s" aria-hidden="true">×</span></button>').join('') + '<button type="button" class="bc-addtag" data-bc-addtag="' + id + '">+ Tag</button></div>' +
      '<div class="bc-prio"><span class="bc-prio-k">Priority</span><span class="ex-seg" role="radiogroup" aria-label="Priority">' + [3, 2, 1].map(p => '<label' + ((e.p || 1) === p ? ' class="on"' : '') + ' data-bc-prio="' + p + '">' + esc(PRIO_LABEL[p].replace(/^\S+\s/, '')) + '</label>').join('') + '</span></div>') +
    sec('Notes', (np ? '<p class="bc-notes">' + esc(np) + '</p>' : '<p class="hint">No notes yet.</p>') + '<button type="button" class="linkbtn" data-reader="' + id + '">' + (np ? 'Open notes' : 'Write notes') + '</button>') +
    '<details class="bc-pdf"><summary>PDF</summary><div class="bc-box">' + (e.pdf ? '<p>' + esc(e.pdf.name || 'Attached') + '</p><button type="button" class="linkbtn" data-reader="' + id + '">Open the PDF</button>' : '<p class="hint">No PDF yet. Attach one in Notes &amp; PDF.</p>') + '</div></details>';
}
let bigCard = null;
function easeIO(t){ return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function cardTarget(){ const at = document.documentElement.classList.contains('atlas');
  const W = Math.min(at ? 440 : 520, innerWidth - 24), H = Math.min(innerHeight - (at ? 90 : 40), at ? 620 : 780); return {x: (innerWidth - W) / 2, y: Math.max(20, (innerHeight - H) / 2), w: W, h: H}; }
/* on the map page the full card grows out of the small one: the box opens from where the card was, the small card's words
   fade at once, the full card's words come up as the box reaches them; nothing is ever shown twice */
function animateGrow(fl, a, b, forward, done){
  const back = fl.querySelector('.bc-back'), front = fl.querySelector('.bc-front');
  Object.assign(back.style, {position: 'absolute', width: b.w + 'px', height: b.h + 'px', transform: 'none'});
  Object.assign(front.style, {position: 'absolute', width: a.w + 'px', height: a.h + 'px', transform: 'none'});
  fl.style.transform = 'none'; fl.style.overflow = 'hidden'; fl.style.borderRadius = '20px'; fl.style.background = '#FBF8F2';
  const ease = forward ? (u => 1 - Math.pow(1 - u, 3.2)) : (u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const dur = reduceMotion() ? 1 : (window.__growDur || (forward ? 430 : 360)), t0 = performance.now();
  const step = now => {
    const u = Math.min(1, (now - t0) / dur), k = ease(u), m = forward ? k : 1 - k;
    const x = a.x + (b.x - a.x) * m, y = a.y + (b.y - a.y) * m, w = a.w + (b.w - a.w) * m, h = a.h + (b.h - a.h) * m;
    Object.assign(fl.style, {left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px'});
    back.style.left = '0px'; back.style.top = '0px'; front.style.left = '0px'; front.style.top = '0px';   /* both kept to the box's top-left corner: title fades into title */
    front.style.opacity = Math.max(0, 1 - m / .28).toFixed(3); back.style.opacity = Math.min(1, Math.max(0, (m - .22) / .5)).toFixed(3);
    fl.style.boxShadow = '0 2px 4px rgba(40,30,20,.12),0 ' + (18 + 14 * m).toFixed(1) + 'px ' + (50 + 30 * m).toFixed(1) + 'px rgba(24,12,6,' + (.22 + .12 * m).toFixed(3) + ')';
    if(u < 1) requestAnimationFrame(step); else done();
  };
  requestAnimationFrame(step);
}
function animateCard(fl, a, b, forward, done){
  if(document.documentElement.classList.contains('atlas')) return animateGrow(fl, a, b, forward, done);
  const back = fl.querySelector('.bc-back'), front = fl.querySelector('.bc-front');
  const grow = document.documentElement.classList.contains('atlas');
  if(reduceMotion()){ Object.assign(fl.style, {left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px', transform: forward && !grow ? 'rotateY(180deg)' : 'none'}); if(grow){ front.style.opacity = forward ? 0 : 1; back.style.opacity = forward ? 1 : 0; } done(); return; }
  const t0 = performance.now(), dur = 620;
  const step = now => {
    const u = Math.min(1, (now - t0) / dur), k = easeIO(u), lift = Math.sin(Math.PI * k);
    fl.style.left = (a.x + (b.x - a.x) * k) + 'px'; fl.style.top = (a.y + (b.y - a.y) * k - (grow ? 0 : 6 * lift)) + 'px';
    fl.style.width = (a.w + (b.w - a.w) * k) + 'px'; fl.style.height = (a.h + (b.h - a.h) * k) + 'px';
    const ang = forward ? 180 * k : 180 * (1 - k);
    if(grow){ fl.style.transform = 'none'; const v = forward ? k : 1 - k; back.style.opacity = Math.min(1, v * 1.6); front.style.opacity = Math.max(0, 1 - v * 2.2); }
    else fl.style.transform = 'translateZ(' + (110 * lift) + 'px) rotateY(' + ang + 'deg) rotateZ(' + ((forward ? -3 : 3) * lift) + 'deg)';
    fl.style.boxShadow = '0 ' + (14 + 26 * lift) + 'px ' + (30 + 46 * lift) + 'px rgba(20,30,50,' + (0.16 + 0.08 * lift) + ')';
    if(u < 1) requestAnimationFrame(step); else done();
  };
  requestAnimationFrame(step);
}
function openBigCard(id, fromEl){
  const e = lib.entries[id]; if(!e || e.kind !== 'paper') return;
  closeBigCard(true); closeFloatMenu();
  const r = fromEl ? fromEl.getBoundingClientRect() : {left: innerWidth / 2 - 220, top: innerHeight / 2 - 40, width: 440, height: 80};
  const a = {x: r.left, y: r.top, w: r.width, h: r.height}, b = cardTarget();
  const root = document.createElement('div'); root.className = 'bc-root'; root.id = 'bigCard';
  root.innerHTML = '<div class="bc-scrim" data-bc-close="1"></div><div class="bc-stage"><div class="bc-flyer"><div class="bc-face bc-front"></div><div class="bc-face bc-back" role="dialog" aria-modal="true" aria-label="' + esc(e.t) + '"></div></div></div>';
  document.body.appendChild(root);
  const fl = root.querySelector('.bc-flyer');
  root.querySelector('.bc-front').innerHTML = fromEl ? fromEl.outerHTML.replace(/ id="[^"]*"/, '') : '';
  root.querySelector('.bc-back').innerHTML = bigCardHTML(id);
  Object.assign(fl.style, {left: a.x + 'px', top: a.y + 'px', width: a.w + 'px', height: a.h + 'px'});
  if(fromEl){ fromEl.classList.add('pc-pressed'); setTimeout(() => fromEl.classList.remove('pc-pressed'), 200); fromEl.style.visibility = 'hidden'; }
  bigCard = {id, root, from: fromEl, a};
  requestAnimationFrame(() => root.classList.add('on'));
  animateCard(fl, a, b, true, () => { const x = root.querySelector('.bc-x'); if(x) x.focus({preventScroll: true}); });
  root.addEventListener('click', bigCardClick);
  root.addEventListener('change', ev => { const mv = ev.target.closest('[data-bc-move]'); if(mv){ const s2 = IDX.subs[mv.value]; if(s2){ moveEntryTo(mv.dataset.bcMove, s2, s2.hidden ? (IDX.topics[IDX.topicOf[s2.id]] || {}).name : subPath(s2).join(' › ')); refreshBigCard(); } } });
}
function refreshBigCard(){ if(!bigCard) return; const back = bigCard.root.querySelector('.bc-back'); if(!lib.entries[bigCard.id]){ closeBigCard(true); return; } const sc = back.scrollTop; back.innerHTML = bigCardHTML(bigCard.id); back.scrollTop = sc; }
function closeBigCard(instant){
  const c = bigCard; if(!c) return; bigCard = null;
  const fl = c.root.querySelector('.bc-flyer'), from = c.from && document.body.contains(c.from) ? c.from : null;
  const done = () => { c.root.remove(); if(from) from.style.visibility = ''; };
  if(instant || !from){ if(from) from.style.visibility = ''; c.root.classList.remove('on'); setTimeout(() => c.root.remove(), instant ? 0 : 180); return; }
  const r = from.getBoundingClientRect(), b = {x: r.left, y: r.top, w: r.width, h: r.height}, cur = cardTarget();
  c.root.classList.remove('on');
  animateCard(fl, cur, b, false, done);
}
function bigCardClick(ev){
  if(ev.target.closest('[data-bc-close]')){ closeBigCard(); return; }
  const id0 = bigCard && bigCard.id, e0 = id0 && lib.entries[id0];
  const wh = ev.target.closest('[data-bc-where]'); if(wh && e0){
    const r = wh.getBoundingClientRect();
    openFloatMenu(r.left, r.bottom + 4, allLaneRows().map(row => ({label: (row.sub.id === e0.sub ? '✓ ' : '\u2003') + '\u2003'.repeat(row.sub.hidden ? 0 : row.depth + 1) + (row.sub.hidden ? row.topic.name : row.sub.name), fn: () => { if(row.sub.id !== e0.sub){ moveEntryTo(id0, row.sub, row.sub.hidden ? row.topic.name : subPath(row.sub).join(' / ')); refreshBigCard(); } }})));
    const m = document.getElementById('floatMenu'); if(m) m.classList.add('where-menu');
    return; }
  const ut = ev.target.closest('[data-bc-untag]'); if(ut && e0){ toggleTag(id0, ut.dataset.bcUntag); refreshBigCard(); return; }
  const at = ev.target.closest('[data-bc-addtag]'); if(at && e0){
    const r = at.getBoundingClientRect(), have = new Set(e0.tags || []);
    const items = lib.tags.filter(x => !have.has(x.id)).map(x => ({label: '● ' + x.name, fn: () => { toggleTag(id0, x.id); refreshBigCard(); }}));
    openFloatMenu(r.left, r.bottom + 4, (items.length ? items.concat([{sep: 1}]) : []).concat([{label: 'Manage tags…', fn: () => { closeBigCard(true); openTagManager(); }}]));
    return; }
  const pr = ev.target.closest('[data-bc-prio]'); if(pr && e0){
    const p = +pr.dataset.bcPrio; if((e0.p || 1) === p) return;
    const before = clone(lib); e0.p = p; reindex(); touchLib([e0.topic]); renderMain(); renderMap(true); refreshInfo(); refreshBigCard();
    toast('Priority: ' + PRIO_LABEL[p].replace(/^\S+\s/, ''), () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
    return; }
  const st = ev.target.closest('[data-st]'); if(st){ toggleStatus(st.dataset.id, st.dataset.st); refreshBigCard(); return; }
  const rd = ev.target.closest('[data-reader]'); if(rd){ closeBigCard(true); openReader(rd.dataset.reader); return; }
  const sl = ev.target.closest('[data-select]'); if(sl){ const id = sl.dataset.select; closeBigCard(true); select(id, true); return; }
  const vw = ev.target.closest('[data-view]'); if(vw){ closeBigCard(true); openView(vw.dataset.view, {scroll: true}); return; }
  const ln = ev.target.closest('[data-link-note]'); if(ln){ const [a, b, ty] = ln.dataset.linkNote.split('|'); closeBigCard(true); openLinkNote(a, b, ty); return; }
  const ld = ev.target.closest('[data-link-del]'); if(ld){ const [a, b, ty] = ld.dataset.linkDel.split('|'); removeLine(a, b, ty); refreshBigCard(); return; }
}
document.addEventListener('keydown', ev => { if(ev.key === 'Escape' && bigCard && !document.getElementById('floatMenu') && modal.root.hidden){ closeBigCard(); ev.stopPropagation(); } }, true);
/* a press feels like a press; a click on the card (not on its buttons) turns it over */
function cardOpenFrom(ev){
  const c = ev.target.closest('[data-open-card]'); if(!c) return false;
  if(ev.target.closest('button, a, select, input, textarea, label, .yr')) return false;
  openBigCard(c.dataset.openCard, c); return true;
}

