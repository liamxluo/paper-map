/* ===================== export the paper list: CSV, BibTeX, RIS or a Markdown reading list ===================== */
/* “Kahneman, D. & Tversky, A.” → [{family, given}] (and “et al.” → more authors exist) */
function splitAuthors(au){
  let s = String(au || '').trim(); if(!s) return {list: [], more: false};
  const more = /\bet al\.?$/i.test(s); s = s.replace(/,?\s*\bet al\.?$/i, '').trim();
  const parts = s.split(/\s+&\s+|\s+and\s+/i);
  const out = [];
  parts.forEach(p => p.split(/(?<=\.),\s+(?=[^,]+,)/).forEach(q => { q = q.trim(); if(!q) return; const i = q.indexOf(','); out.push(i > 0 ? {family: q.slice(0, i).trim(), given: q.slice(i + 1).trim()} : {family: q, given: ''}); }));
  return {list: out, more};
}
/* “Econometrica 47(2): 263–291” → journal, volume, issue, pages */
function splitSource(v){
  const s = String(v || '').trim();
  const m = /^(.*?)\s+(\d+[A-Za-z]?)(?:\((\w+)\))?(?::\s*([\w–-]+))?$/.exec(s);
  return m && m[1] ? {box: m[1], vol: m[2], iss: m[3] || '', pages: (m[4] || '').replace('–', '-')} : {box: s, vol: '', iss: '', pages: ''};
}
function listOrder(){ const ord = {}; allLaneRows().forEach((r, i) => { ord[r.sub.id] = i; }); return ord; }
function papersFor(o){
  const ord = listOrder();
  return Object.values(lib.entries).filter(e => e.kind === 'paper' && !e.parent && (!o.subs || o.subs.has(e.sub)) && (o.status === 'all' || (o.status === 'none' ? !stOf(e) : stOf(e) === o.status)))
    .sort((a, b) => (ord[a.sub] ?? 9e9) - (ord[b.sub] ?? 9e9) || byYear(a, b));
}
const linkTitles = (id, dir, ty) => ((dir === 'up' ? IDX.up[id] : IDX.down[id]) || []).filter(x => x[1] === ty).map(x => lib.entries[x[0]]).filter(Boolean).map(e => (e.t || '') + (e.y ? ' (' + e.y + ')' : ''));
const placeOf = e => { const tp = IDX.topics[e.topic], s = IDX.subs[e.sub]; return {topic: tp ? tp.name : '', sub: s && !s.hidden ? subPath(s).join(' › ') : ''}; };
const statusWord = e => ({read: 'Read', want: 'Want to read'})[stOf(e)] || '';
const tagNames = e => (e.tags || []).map(id => (lib.tags.find(x => x.id === id) || {}).name).filter(Boolean);
function csvCell(v){ const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function papersCSV(es, o){
  const head = ['Title', 'Authors', 'Year', 'Source', 'DOI', 'ISBN', 'Type', 'Topic', 'Subtopic', 'Status', 'Priority', 'Tags', 'Focus'].concat(o.notes ? ['Notes'] : []).concat(o.lines ? ['Builds on', 'Responds to', 'Related to', 'Built on by'] : []);
  const rows = es.map(e => { const p = placeOf(e); return [e.t, e.au, e.y || '', e.v, e.doi || '', e.isbn || '', e.l || 'Paper', p.topic, p.sub, statusWord(e), PRIO_LABEL[e.p || 1] || '', tagNames(e).join('; '), e.f || '']
    .concat(o.notes ? [e.n || ''] : []).concat(o.lines ? [linkTitles(e.id, 'up', 'b').join('; '), linkTitles(e.id, 'up', 'c').join('; '), linkTitles(e.id, 'up', 'r').concat(linkTitles(e.id, 'down', 'r')).join('; '), linkTitles(e.id, 'down', 'b').join('; ')] : []); });
  return '\uFEFF' + [head].concat(rows).map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
function bibKey(e, used){
  const fam = (splitAuthors(e.au).list[0] || {}).family || 'anon';
  const word = (String(e.t || '').normalize('NFKD').replace(/[^\w\s]/g, '').split(/\s+/).find(w => w.length > 3 && !/^(the|a|an|on|of|and|for|with|from|into)$/i.test(w)) || 'paper');
  const base = (fam.normalize('NFKD').replace(/[^A-Za-z]/g, '') || 'anon').toLowerCase() + (e.y || '') + word.toLowerCase();
  let k = base, n = 1; while(used.has(k)) k = base + String.fromCharCode(96 + (++n)); used.add(k); return k;
}
const bibEsc = s => String(s || '').replace(/[{}]/g, '').replace(/([&%$#_])/g, '\\$1');
function papersBib(es, o){
  const used = new Set();
  return es.map(e => {
    const A = splitAuthors(e.au), src = splitSource(e.v), type = e.l === 'Book' ? 'book' : e.l === 'Chapter' ? 'incollection' : src.vol || src.box ? 'article' : 'misc';
    const f = [['title', '{' + bibEsc(e.t) + '}'], ['author', A.list.map(a => bibEsc(a.family) + (a.given ? ', ' + bibEsc(a.given) : '')).concat(A.more ? ['others'] : []).join(' and ')], ['year', e.y || '']];
    if(type === 'book') f.push(['publisher', bibEsc(e.v)]);
    else if(type === 'incollection') f.push(['booktitle', bibEsc(src.box)], ['pages', src.pages]);
    else f.push([type === 'misc' ? 'howpublished' : 'journal', bibEsc(src.box)], ['volume', src.vol], ['number', src.iss], ['pages', src.pages.replace('-', '--')]);
    f.push(['doi', e.doi || ''], ['isbn', e.isbn || ''], ['keywords', tagNames(e).map(bibEsc).join(', ')]);
    if(o.notes && e.n) f.push(['annote', bibEsc(e.n.replace(/\s+/g, ' '))]);
    return '@' + type + '{' + bibKey(e, used) + ',\n' + f.filter(x => String(x[1]).trim()).map(([k, v]) => '  ' + k + ' = ' + (/^\{/.test(v) ? v : '{' + v + '}')).join(',\n') + '\n}';
  }).join('\n\n') + '\n';
}
function papersRIS(es, o){
  return es.map(e => {
    const A = splitAuthors(e.au), src = splitSource(e.v), ty = e.l === 'Book' ? 'BOOK' : e.l === 'Chapter' ? 'CHAP' : src.vol || src.box ? 'JOUR' : 'GEN';
    const L = [['TY', ty]].concat(A.list.map(a => ['AU', a.family + (a.given ? ', ' + a.given : '')]), [['TI', e.t], ['PY', e.y || '']]);
    if(ty === 'BOOK') L.push(['PB', e.v]); else L.push(['T2', src.box], ['VL', src.vol], ['IS', src.iss]);
    if(src.pages){ const [sp, ep] = src.pages.split('-'); L.push(['SP', sp], ['EP', ep || '']); }
    L.push(['DO', e.doi || ''], ['SN', e.isbn || '']); tagNames(e).forEach(nm => L.push(['KW', nm]));
    if(o.notes && e.n) L.push(['N1', e.n.replace(/\s+/g, ' ')]);
    L.push(['ER', '']);
    return L.filter(([k, v]) => k === 'ER' || String(v).trim()).map(([k, v]) => k + '  - ' + v).join('\r\n');
  }).join('\r\n\r\n') + '\r\n';
}
function papersMD(es, o, title){
  let out = '# ' + title + '\n\n' + es.length + (es.length === 1 ? ' paper' : ' papers') + ' · exported from Paper Map on ' + new Date().toLocaleDateString([], {day: 'numeric', month: 'long', year: 'numeric'}) + '\n';
  let lastPlace = null;
  es.forEach(e => {
    const p = placeOf(e), place = p.topic + (p.sub ? ' › ' + p.sub : '');
    if(place !== lastPlace){ out += '\n## ' + place + '\n\n'; lastPlace = place; }
    const st = stOf(e), box = st === 'read' ? '[x] ' : st === 'want' ? '[ ] ' : '';
    out += '- ' + box + (e.au ? e.au + ' ' : '') + (e.y ? '(' + e.y + '). ' : '') + '**' + (e.t || '') + '**' + (e.v ? '. *' + e.v + '*' : '') + '.' + (e.doi ? ' https://doi.org/' + e.doi : '') + (e.isbn ? ' ISBN ' + e.isbn : '') + '\n';
    if(o.lines){ const b = linkTitles(e.id, 'up', 'b'), c = linkTitles(e.id, 'up', 'c'); if(b.length) out += '  - Builds on: ' + b.join('; ') + '\n'; if(c.length) out += '  - Responds to: ' + c.join('; ') + '\n'; }
    if(o.notes && e.n) out += '  - Notes: ' + e.n.replace(/\s+/g, ' ').slice(0, 600) + '\n';
  });
  return out;
}
const LIST_FORMATS = {csv: {label: 'CSV', hint: 'Excel, Google Sheets, Numbers, Zotero', ext: 'csv', type: 'text/csv;charset=utf-8', make: papersCSV},
  bib: {label: 'BibTeX', hint: 'LaTeX, Overleaf, Zotero', ext: 'bib', type: 'application/x-bibtex;charset=utf-8', make: papersBib},
  ris: {label: 'RIS', hint: 'Zotero, EndNote, Mendeley', ext: 'ris', type: 'application/x-research-info-systems;charset=utf-8', make: papersRIS},
  md: {label: 'Reading list', hint: 'Markdown: grouped by topic, read ones ticked', ext: 'md', type: 'text/markdown;charset=utf-8', make: papersMD}};
function openListExport(view){
  /* which papers: this view, everything, or the topics you tick */
  const here = view || (ui.sub ? ui.sub : ui.topic ? ui.topic + '-all' : null);
  let hereSubs = null, hereName = '';
  if(here && IDX.subs[here]){ const s = IDX.subs[here]; hereSubs = new Set([here].concat(subDescendants(here).map(x => x.id))); hereName = s.hidden ? (IDX.topics[IDX.topicOf[here]] || {}).name : subPath(s).join(' › '); }
  else if(here){ const tp = IDX.topics[String(here).replace(/-all$/, '')]; if(tp){ hereSubs = new Set(treeSubs(tp).map(s => s.id)); hereName = tp.name; } }
  const rows = allLaneRows();
  const st = {scope: hereSubs ? 'here' : 'all', status: 'all', format: 'csv', notes: true, lines: true, pick: new Set(hereSubs || rows.map(r => r.sub.id))};
  const subsOf = () => st.scope === 'here' ? hereSubs : st.scope === 'pick' ? st.pick : null;
  const title = () => st.scope === 'here' ? hereName : st.scope === 'pick' ? 'Chosen topics' : (lib.title || 'Paper Map');
  const count = sc => papersFor({subs: sc === 'here' ? hereSubs : sc === 'pick' ? st.pick : null, status: st.status}).length;
  const tree = () => lib.topics.map(tp => '<div class="ex-group"><label class="ex-topic"><input type="checkbox" data-le-topic="' + tp.id + '"' + (treeSubs(tp).every(s => st.pick.has(s.id)) ? ' checked' : '') + '> <b>' + esc(tp.name) + '</b></label>' +
    rows.filter(r => r.topic.id === tp.id && !r.sub.hidden).map(r => '<label class="ex-sub" style="--d:' + r.depth + '"><input type="checkbox" data-le-sub="' + r.sub.id + '"' + (st.pick.has(r.sub.id) ? ' checked' : '') + '> ' + esc(r.name) + '</label>').join('') + '</div>').join('');
  const draw = bd => {
    const es = papersFor({subs: subsOf(), status: st.status}), F = LIST_FORMATS[st.format];
    const preview = es.length ? F.make(es.slice(0, 3), st, title()).replace(/^\uFEFF/, '').split(/\r?\n/).slice(0, 14).join('\n') : '';
    bd.querySelector('#leBody').innerHTML =
      '<div class="le-scope">' + (hereSubs ? '<label><input type="radio" name="leScope" value="here"' + (st.scope === 'here' ? ' checked' : '') + '> This view: <b>' + esc(hereName) + '</b> <span class="hint">(' + count('here') + ')</span></label>' : '') +
        '<label><input type="radio" name="leScope" value="all"' + (st.scope === 'all' ? ' checked' : '') + '> Everything <span class="hint">(' + count('all') + ')</span></label>' +
        '<label><input type="radio" name="leScope" value="pick"' + (st.scope === 'pick' ? ' checked' : '') + '> Choose topics</label></div>' +
      (st.scope === 'pick' ? '<div class="ex-tree le-tree">' + tree() + '</div>' : '') +
      '<div class="form-grid"><label>Which papers<select id="leStatus"><option value="all">All of them</option><option value="read"' + (st.status === 'read' ? ' selected' : '') + '>Only the ones I’ve read</option><option value="want"' + (st.status === 'want' ? ' selected' : '') + '>Only the ones I want to read</option><option value="none"' + (st.status === 'none' ? ' selected' : '') + '>Only the unmarked ones</option></select></label></div>' +
      '<div class="le-fmts">' + Object.entries(LIST_FORMATS).map(([k, x]) => '<label class="le-fmt' + (st.format === k ? ' on' : '') + '"><input type="radio" name="leFmt" value="' + k + '"' + (st.format === k ? ' checked' : '') + '><b>' + x.label + '</b><span class="hint">' + x.hint + '</span></label>').join('') + '</div>' +
      '<div class="ex-opts"><label><input type="checkbox" id="leNotes"' + (st.notes ? ' checked' : '') + '> Include notes</label>' + (st.format === 'csv' || st.format === 'md' ? '<label><input type="checkbox" id="leLines"' + (st.lines ? ' checked' : '') + '> Include the lines between papers</label>' : '') + '</div>' +
      (preview ? '<p class="ex-h">Preview</p><pre class="le-prev">' + esc(preview) + (es.length > 3 ? '\n…' : '') + '</pre>' : '<p class="hint">No papers match.</p>');
    const go = document.querySelector('#modalActions .primary'); if(go){ go.textContent = 'Export ' + es.length + (es.length === 1 ? ' paper' : ' papers'); go.disabled = !es.length; }
  };
  openModal({title: 'Export papers', body: '<div id="leBody"></div>',
    actions: [{label: 'Cancel'}, {label: 'Export', primary: true, onClick: () => { doListExport(st, subsOf(), title()); return false; }}],
    onOpen: bd => {
      bd.addEventListener('change', ev => {
        const x = ev.target;
        if(x.name === 'leScope') st.scope = x.value;
        else if(x.name === 'leFmt') st.format = x.value;
        else if(x.id === 'leStatus') st.status = x.value;
        else if(x.id === 'leNotes') st.notes = x.checked;
        else if(x.id === 'leLines') st.lines = x.checked;
        else if(x.dataset.leTopic){ const tp = IDX.topics[x.dataset.leTopic]; treeSubs(tp).forEach(s => { if(x.checked) st.pick.add(s.id); else st.pick.delete(s.id); }); }
        else if(x.dataset.leSub){ if(x.checked) st.pick.add(x.dataset.leSub); else st.pick.delete(x.dataset.leSub); }
        draw(bd);
      });
      draw(bd);
    }});
}
async function doListExport(st, subs, title){
  const es = papersFor({subs, status: st.status}); if(!es.length) return;
  const F = LIST_FORMATS[st.format];
  const blob = new Blob([F.make(es, st, title)], {type: F.type});
  const name = slugName(title) + '-papers-' + new Date().toISOString().slice(0, 10) + '.' + F.ext;
  const r = await saveBlobAs(blob, name);
  if(r === 'cancelled') return;
  closeModal(); toast((r === 'saved' ? 'Saved ' : 'Downloaded ') + name);
}
