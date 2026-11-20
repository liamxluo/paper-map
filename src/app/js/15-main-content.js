/* ===================== main content ===================== */
function statusDots(e){
  const st = stOf(e), lab = mapLabel(e) + ' ' + e.y;
  return '<span class="stset">' +
    '<button type="button" class="st want" data-st="want" data-id="' + e.id + '" aria-pressed="' + (st === 'want') + '" aria-label="Want to read: ' + esc(lab) + '" title="Want to read"></button>' +
    '<button type="button" class="st read" data-st="read" data-id="' + e.id + '" aria-pressed="' + (st === 'read') + '" aria-label="Read: ' + esc(lab) + '" title="Read"></button></span>';
}
function editButtons(id, isConcept){
  if(!isConcept) return '<span class="row-more">' + moreBtn('p:' + id) + '</span>';
  return '<span class="row-edit"><button type="button" class="linkbtn" data-edit="' + id + '">' + (isConcept ? 'Modify concept' : 'Modify') + '</button>' + (isConcept ? '' : '<button type="button" class="linkbtn" data-tagassign="' + id + '">Tags</button>') + '<button type="button" class="linkbtn danger" data-del="' + id + '">Delete</button></span>';
}
function rowHTML(e, withPlace){
  const st = stOf(e);
  const tags = ['<span class="prio">' + PRIO_LABEL[e.p || 1] + '</span>'];
  if(st) tags.push('<span class="stlabel ' + st + '">' + (st === 'read' ? 'Read' : 'Want to read') + '</span>');
  if(withPlace){ const s = IDX.subs[e.sub]; const g = s && e.group ? s.groups.find(x => x.id === e.group) : null; tags.push('<span class="tag">' + esc(s && !s.hidden ? subPath(s).join(' › ') : (IDX.topics[e.topic] || {}).name) + (g ? ' / ' + esc(g.name) : '') + '</span>'); }
  if(e.l) tags.push('<span class="tag' + '' + '">' + esc(e.l) + '</span>');
  tagsOf(e).forEach(x => tags.push(tagChip(x)));
  const doms = (e.d || []).map(x => '<button type="button" class="dom' + (ui.dom === x ? ' on' : '') + '" data-dom="' + esc(x) + '">' + esc(x) + '</button>').join('');
  const pres = (e.needs || []).filter(c => lib.entries[c]).map(c => '<button type="button" class="prechip" data-card="' + c + '" title="' + esc(lib.entries[c].t) + '">' + esc(lib.entries[c].short || lib.entries[c].t) + '</button>').join('');
  return '<tr id="r-' + e.id + '" class="p' + (e.p || 1) + (st ? ' st-' + st : '') + '">' +
    '<td class="c-st">' + statusDots(e) + '</td>' +
    '<td class="c-year"><span class="spine" aria-hidden="true"></span><span class="node-mark" aria-hidden="true"></span><span class="yr" draggable="true" data-drag-paper="' + e.id + '" title="Drag onto a topic in Contents to move it there">' + esc(e.y) + '</span></td>' +
    '<td class="c-ref"><span class="au">' + esc(e.au) + '</span><span class="t">' + esc(e.t) + '</span><span class="v">' + esc(e.v) + '</span></td>' +
    '<td class="c-tags">' + tags.join('') + (doms ? '<span class="doms">' + doms + '</span>' : '') + (pres ? '<span class="pres"><span class="pres-k">Needs</span>' + pres + '</span>' : '') + '</td>' +
    '<td class="c-note">' + noteCell(e) + editButtons(e.id) + '</td>' +
  '</tr>';
}
function tableHTML(rows, withPlace){
  return '<div class="pc-list">' + rows.map(e => cardRowHTML(e, withPlace)).join('') + '</div>';
}
function noteCell(e){
  const prev = notePreview(e.n), pdf = e.pdf ? '<span class="pdfchip">PDF</span>' : '';
  if(!prev && !pdf) return '<button type="button" class="addnote" data-reader="' + e.id + '">Add notes</button>';
  return '<button type="button" class="notecell" data-reader="' + e.id + '" title="Open notes"><span class="np">' + esc(prev) + '</span>' + pdf + '</button>';
}
function readingRow(e, note){
  const st = stOf(e);
  return '<tr id="r-' + e.id + '" class="pre-row' + (st ? ' st-' + st : '') + '">' +
    '<td class="c-st">' + statusDots(e) + '</td>' +
    '<td class="c-year"><span class="yr">' + esc(e.y) + '</span></td>' +
    '<td class="c-ref"><span class="au">' + esc(e.au) + '</span><span class="t">' + esc(e.t) + '</span><span class="v">' + esc(e.v) + '</span></td>' +
    '<td class="c-kind"><span class="tag' + '' + '">' + esc(e.l || 'Reading') + '</span></td>' +
    '<td class="c-note">' + (note != null ? esc(note) : noteCell(e) + editButtons(e.id)) + '</td></tr>';
}
function conceptReadings(c){
  const kids = (IDX.children[c.id] || []).map(id => lib.entries[id]).sort(byYear);
  const refs = (c.refs || []).filter(r => lib.entries[r.id]).map(r => ({e: lib.entries[r.id], n: r.n}));
  return {kids, refs};
}
function conceptDone(c){
  const r = conceptReadings(c);
  const all = r.kids.concat(r.refs.map(x => x.e));
  return [all.filter(e => stOf(e) === 'read').length, all.length];
}
function conceptChips(ids){ return ids.filter(x => lib.entries[x]).map(x => '<button type="button" class="prechip" data-card="' + x + '">' + esc(lib.entries[x].short || lib.entries[x].t) + '</button>').join(''); }
function conceptCard(c){
  const up = IDX.cUp[c.id] || [], down = IDX.cDown[c.id] || [];
  const users = (IDX.users[c.id] || []).map(id => lib.entries[id]).sort(byYear);
  const r = conceptReadings(c);
  const done = conceptDone(c);
  const rows = r.refs.map(x => readingRow(x.e, x.n || '')).concat(r.kids.map(e => readingRow(e)));
  return '<article class="concept" id="card-' + c.id + '">' +
    '<div class="concept-head"><h4>' + esc(c.t) + '</h4><span class="concept-meta">' + esc(c.y) + ' onwards' + (done[1] ? ' · readings read ' + done[0] + ' / ' + done[1] : '') + '</span></div>' +
    (c.what ? '<p class="concept-what">' + esc(c.what) + '</p>' : '') +
    (c.why ? '<p class="concept-why"><span class="k">Why first</span>' + esc(c.why) + '</p>' : '') +
    (up.length ? '<p class="concept-links"><span class="k">Prerequisites</span>' + conceptChips(up) + '</p>' : '') +
    (down.length ? '<p class="concept-links"><span class="k">Next</span>' + conceptChips(down) + '</p>' : '') +
    (rows.length ? '<div class="table-wrap"><table class="pre-table"><thead><tr><th class="c-st">Status</th><th class="c-year">Year</th><th class="c-ref">Reading</th><th class="c-kind">Type</th><th class="c-note">How to read</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '') +
    (users.length ? '<p class="concept-links"><span class="k">Papers that use it</span>' + users.map(u => '<button type="button" class="relchip" data-goto="' + u.id + '">' + esc(mapLabel(u)) + ' ' + esc(u.y) + '</button>').join('') + '</p>' : '') +
    (ui.edit ? '<p class="concept-links"><button type="button" class="btn" data-edit="' + c.id + '">Modify concept</button><button type="button" class="btn" data-add-reading="' + c.id + '">Add reading</button><button type="button" class="btn danger" data-del="' + c.id + '">Delete concept</button></p>' : '') +
  '</article>';
}
function countText(es){
  const papers = listPapers(es);
  const keys = Array.from(new Set(papers.map(keyOf)));
  const read = keys.filter(k => status[k] === 'read').length, want = keys.filter(k => status[k] === 'want').length;
  const concepts = es.filter(e => e.kind === 'concept').length;
  return (concepts ? concepts + (concepts === 1 ? ' concept' : ' concepts') + (papers.length ? ', ' : '') : '') + (papers.length || !concepts ? papers.length + (papers.length === 1 ? ' paper' : ' papers') + ', ' + read + ' read, ' + want + ' want to read' : '');
}
function conceptsUsedHTML(papers){
  const ids = [...new Set(papers.flatMap(p => p.needs || []))].filter(c => lib.entries[c] && lib.entries[c].kind === 'concept');
  if(!ids.length) return '';
  return '<p class="rel tl-row"><span class="rel-k">Concepts used here</span>' + ids.map(c => lib.entries[c]).sort(byYear).map(c => '<button type="button" class="relchip concept-chip" data-card="' + c.id + '"><i class="sq" aria-hidden="true"></i>' + esc(c.t) + '</button>').join('') + '</p>';
}
function renderConceptsPage(){
  const cs = allConcepts().sort(byYear);
  return '<section class="branch"><div class="branch-head"><h2>Concepts</h2><p class="branch-count">' + cs.length + (cs.length === 1 ? ' concept' : ' concepts') + '</p>' +
    '<p class="branch-desc">Ideas your papers rely on, each with the year it appeared. A paper sits under one topic but can need many concepts: a topic is a shelf, a concept is a tool.</p>' +
    '<div class="head-edit"><button type="button" class="btn" data-act="new-concept">+ New concept</button></div></div>' +
    (cs.length ? cs.map(conceptCard).join('') : '<p class="empty">No concepts yet. A good concept is one idea with a year, such as “Nash equilibrium, 1950”, that papers in different topics rely on. Add one with “+ New concept”, or from a paper’s Prerequisite concepts.</p>') +
    '</section>';
}
function renderSubSection(s, tp, asPart, opts){
  opts = opts || {};
  const es = entriesOfSub(s.id);
  const concepts = es.filter(e => e.kind === 'concept').sort(byYear);
  const papers = listPapers(es);
  const rows = papers.filter(matches).sort(byYear);
  const title = s.hidden ? tp.name : s.name;
  let h = '';
  if(asPart === 'nested'){
    const par = s.parent && IDX.subs[s.parent];
    h += '<h3 class="sub-h3 nest-h"><button type="button" class="nest-link" data-view="' + s.id + '">' + esc(title) + '</button>' + (par && opts.showParent ? '<span class="nest-in">in ' + esc(par.name) + '</span>' : '') + '</h3>';
  }else if(asPart){
    h += '<h3 class="sub-h3">' + esc(s.hidden ? title : subPath(s).join(' › ')) + '</h3>';
  }else{
    const chips = s.groups.length ? '<div class="subs-row">' +
      '<button type="button" class="subchip' + (ui.group ? '' : ' on') + '" data-group="">All<span>' + papers.length + '</span></button>' +
      s.groups.map(g => '<button type="button" class="subchip' + (ui.group === g.id ? ' on' : '') + '" data-group="' + g.id + '">' + esc(g.name) + '<span>' + papers.filter(e => e.group === g.id).length + '</span></button>').join('') + '</div>' : '';
    const edit = '';
    h += '<div class="branch-head"><h2 class="has-more">' + esc(title) + moreBtn(s.hidden ? 't:' + tp.id : 's:' + s.id) + '</h2>' +
      '<p class="branch-count">' + countText(opts.countEs || es) + ((opts.countEs || es).some(e => e.kind === 'paper') ? ' · <button type="button" class="linkbtn" data-export-papers="' + s.id + '">Export list</button>' : '') + '</p>' +
      ((s.hidden ? tp.desc : s.desc) ? '<p class="branch-desc">' + esc(s.hidden ? tp.desc : s.desc) + '</p>' : '') + relatedTopicsHTML(s.hidden ? tp.id : s.id) + conceptsUsedHTML(papers) +
      chips + edit + '</div>';
  }
  h += concepts.map(conceptCard).join('');
  if(papers.length){
    if(concepts.length && !asPart) h += '<h3 class="sub-h3">Other readings</h3>';
    h += rows.length ? tableHTML(rows, false) : '<p class="empty">No papers match the current filters. Check the counts on the labels, or set the filters back to “All”.</p>';
  }else if(!concepts.length && !asPart && !opts.kids){
    h += '<p class="empty">No papers here yet. Add one with + New paper at the top, or from ⋯ next to the title.</p>';
  }
  return h;
}
function emptyGuide(){
  return '<section class="branch"><div class="branch-head"><h2>Get started</h2></div>' +
    '<ol class="guide"><li>Add your first topic with <strong>+ New topic</strong> in Contents, then a paper with <strong>+ New paper</strong>. Everything saves in this browser automatically.</li>' +
    '<li>To keep your list safe and use it on other devices, connect sync under <strong>Settings → Sync</strong>: Dropbox, a folder, or GitHub.</li>' +
    '<li>Already have papers in Zotero or a spreadsheet? <button type="button" class="linkbtn" data-start-import="1">Import them</button> from a CSV, BibTeX or RIS file.</li>' +
    '<li>Have a backup file? Use <strong>Settings → Data → Import backup</strong>.</li></ol></section>';
}
function renderMain(){
  if(ui.page === 'concepts'){ mainEl.innerHTML = renderConceptsPage(); return; }
  if(!Object.keys(lib.entries).length && !lib.topics.some(tp => tp.subs.some(s => !s.hidden))){ mainEl.innerHTML = emptyGuide(); return; }
  const tp = IDX.topics[ui.topic];
  if(!tp){ mainEl.innerHTML = '<p class="empty">No topics yet.</p>'; return; }
  let html = '';
  if(ui.sub){
    const s = IDX.subs[ui.sub];
    const below = subDescendants(s.id), d0 = IDX.depth[s.id] || 0;
    const countEs = below.length ? below.reduce((a, d) => a.concat(entriesOfSub(d.id)), entriesOfSub(s.id)) : null;
    html = '<section class="branch" id="sec-' + s.id + '" data-sub="' + s.id + '">' + renderSubSection(s, tp, false, {kids: below.length, countEs}) + '</section>';
    below.forEach(d => {
      const rel = (IDX.depth[d.id] || 0) - d0;
      html += '<section class="branch nested" id="sec-' + d.id + '" data-sub="' + d.id + '" style="--d:' + rel + '">' + renderSubSection(d, tp, 'nested', {showParent: rel > 1}) + '</section>';
    });
  }else{
    const es = topicEntries(tp.id);
    const anyConcept = es.some(e => e.kind === 'concept');
    html = '<section class="branch" id="sec-' + tp.id + '-all"><div class="branch-head"><h2 class="has-more">' + esc(tp.name) + ': all' + moreBtn('t:' + tp.id) + '</h2>' +
      '<p class="branch-count">' + countText(es) + (es.some(e => e.kind === 'paper') ? ' · <button type="button" class="linkbtn" data-export-papers="' + tp.id + '-all">Export list</button>' : '') + '</p>' + (tp.desc ? '<p class="branch-desc">' + esc(tp.desc) + '</p>' : '') + relatedTopicsHTML(tp.id) + + '</div>';
    if(anyConcept){
      html += tp.subs.filter(s => s.hidden).concat(visibleSubs(tp)).map(s => renderSubSection(s, tp, true)).join('');
    }else{
      const rows = listPapers(es).filter(matches).sort(byYear);
      html += rows.length ? tableHTML(rows, true) : '<p class="empty">No papers match the current filters.</p>';
    }
    html += '</section>';
  }
  mainEl.innerHTML = html;
}
