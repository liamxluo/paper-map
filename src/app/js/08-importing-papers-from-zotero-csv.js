/* ===================== importing papers from Zotero, CSV, BibTeX, RIS or CSL JSON ===================== */
function guessDelim(text){ const line = (text.split('\n')[0] || ''); const n = ch => line.split(ch).length - 1; return ['\t', ';', ','].reduce((a, b) => n(b) > n(a) ? b : a, ','); }
function parseCSV(text){
  text = text.replace(/^\uFEFF/, ''); const d = guessDelim(text), rows = []; let row = [], f = '', q = false;
  for(let i = 0; i < text.length; i++){
    const ch = text[i];
    if(q){ if(ch === '"'){ if(text[i + 1] === '"'){ f += '"'; i++; } else q = false; } else f += ch; continue; }
    if(ch === '"' && f === '') q = true;
    else if(ch === d){ row.push(f); f = ''; }
    else if(ch === '\n'){ row.push(f); rows.push(row); row = []; f = ''; }
    else if(ch !== '\r') f += ch;
  }
  if(f !== '' || row.length){ row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}
const TEX_MARK = {"'": '\u0301', '`': '\u0300', '^': '\u0302', '"': '\u0308', '~': '\u0303', '=': '\u0304', '.': '\u0307', u: '\u0306', v: '\u030C', H: '\u030B', c: '\u0327', k: '\u0328'};
function cleanTex(v){
  return String(v)
    .replace(/\\([`'^"~=.uvHck])\s*\{?\s*\\?([a-zA-Z])\s*\}?/g, (m, a, ch) => (ch + TEX_MARK[a]).normalize('NFC'))
    .replace(/\\(ss|o|O|aa|AA|ae|AE|oe|OE|l|L|i)\b\s*\{?\}?/g, (m, a) => ({ss: 'ß', o: 'ø', O: 'Ø', aa: 'å', AA: 'Å', ae: 'æ', AE: 'Æ', oe: 'œ', OE: 'Œ', l: 'ł', L: 'Ł', i: 'ı'})[a])
    .replace(/\\([&%$#_])/g, '$1').replace(/\\[a-zA-Z]+\*?\s*\{([^{}]*)\}/g, '$1').replace(/\\[a-zA-Z]+\*?/g, '')
    .replace(/``/g, '“').replace(/''/g, '”').replace(/---/g, '—').replace(/--/g, '–').replace(/[{}]/g, '').replace(/~/g, ' ').replace(/\s+/g, ' ').trim();
}
function bibSkip(s, at){ const open = s[at], close = open === '(' ? ')' : '}'; let d = 0; for(let i = at; i < s.length; i++){ if(s[i] === open) d++; else if(s[i] === close && --d === 0) return i + 1; } return s.length; }
function parseBib(text){
  const out = []; let i = 0;
  while((i = text.indexOf('@', i)) !== -1){
    const m = /^@\s*([A-Za-z]+)\s*([{(])/.exec(text.slice(i, i + 80)); if(!m){ i++; continue; }
    const type = m[1].toLowerCase(), at = i + m[0].length - 1, end = bibSkip(text, at);
    const body = text.slice(at + 1, end - 1); i = end;
    if(type === 'comment' || type === 'string' || type === 'preamble') continue;
    const comma = body.indexOf(','); if(comma < 0) continue;
    const fields = {}; let k = comma + 1;
    while(k < body.length){
      const fm = /^\s*([A-Za-z][\w:-]*)\s*=\s*/.exec(body.slice(k)); if(!fm) break;
      const name = fm[1].toLowerCase(); k += fm[0].length; let val = '';
      for(;;){
        const ch = body[k];
        if(ch === '{'){ const e = bibSkip(body, k); val += body.slice(k + 1, e - 1); k = e; }
        else if(ch === '"'){ let e = k + 1, dd = 0; while(e < body.length && !(body[e] === '"' && dd === 0)){ if(body[e] === '{') dd++; else if(body[e] === '}') dd--; e++; } val += body.slice(k + 1, e); k = e + 1; }
        else { const mm = /^[^,#}\s]+/.exec(body.slice(k)); if(mm){ val += mm[0]; k += mm[0].length; } }
        const cat = /^\s*#\s*/.exec(body.slice(k)); if(cat){ k += cat[0].length; continue; } break;
      }
      fields[name] = cleanTex(val);
      const cm = /^\s*,/.exec(body.slice(k)); if(cm) k += cm[0].length; else break;
    }
    out.push({type, key: body.slice(0, comma).trim(), fields});
  }
  return out;
}
function parseRIS(text){
  const items = []; let cur = null;
  text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach(line => {
    const m = /^([A-Z][A-Z0-9])  -\s?(.*)$/.exec(line); if(!m) return;
    const tag = m[1], val = m[2].trim();
    if(tag === 'TY'){ cur = {TY: val, AU: [], KW: []}; return; }
    if(!cur) return;
    if(tag === 'ER'){ items.push(cur); cur = null; return; }
    if(tag === 'AU' || tag === 'A1') cur.AU.push(val);
    else if(tag === 'KW') cur.KW.push(val);
    else cur[tag] = cur[tag] ? cur[tag] + '\n' + val : val;
  });
  if(cur) items.push(cur);
  return items;
}
/* “Family, Given; Family, Given”, “Given Family and Given Family”, or a list of {family, given} */
function personFrom(s){
  s = String(s || '').trim(); if(!s) return null;
  if(s.includes(',')){ const [fam, ...rest] = s.split(','); return {family: fam.trim(), given: rest.join(',').trim()}; }
  const w = s.split(/\s+/); if(w.length === 1) return {family: w[0]};
  return {family: w[w.length - 1], given: w.slice(0, -1).join(' ')};
}
function authorsFrom(v){
  if(Array.isArray(v)) return joinAuthors(v.map(a => typeof a === 'string' ? personFrom(a) : {family: a.family, given: a.given, name: a.literal || a.name}).filter(Boolean));
  const s = String(v || '').trim(); if(!s) return '';
  const parts = s.includes(';') ? s.split(';') : /\s+and\s+/i.test(s) ? s.split(/\s+and\s+/i) : null;
  return parts ? joinAuthors(parts.map(personFrom).filter(Boolean)) : (/,/.test(s) && s.split(',').length === 2 ? joinAuthors([personFrom(s)]) : s);
}
const yearFrom = v => { const m = /\b(1[0-9]{3}|20[0-9]{2}|2100)\b/.exec(String(v || '')); return m ? +m[1] : null; };
const sourceFrom = (box, vol, iss, pages, pub) => box ? box + (vol ? ' ' + vol + (iss ? '(' + iss + ')' : '') : '') + (pages ? ': ' + String(pages).replace(/\s*-{1,2}\s*/, '–') : '') : (pub || '');
const htmlText = s => String(s || '').replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();
const TYPE_MAP = {journalarticle: 'Paper', conferencepaper: 'Paper', preprint: 'Paper', report: 'Paper', manuscript: 'Paper', book: 'Book', booksection: 'Chapter', thesis: 'Other', webpage: 'Other',
  article: 'Paper', inproceedings: 'Paper', conference: 'Paper', techreport: 'Paper', unpublished: 'Paper', incollection: 'Chapter', inbook: 'Chapter', phdthesis: 'Other', mastersthesis: 'Other', misc: 'Other',
  jour: 'Paper', conf: 'Paper', cpaper: 'Paper', rprt: 'Paper', chap: 'Chapter', thes: 'Other', 'article-journal': 'Paper', 'paper-conference': 'Paper', chapter: 'Chapter'};
const typeFrom = v => TYPE_MAP[String(v || '').toLowerCase().replace(/[\s_]/g, '')] || '';
const doiFrom = (...vs) => { for(const v of vs){ const m = /(10\.\d{4,9}\/[^\s"<>]+)/.exec(String(v || '')); if(m) return m[1].replace(/[.,;)]+$/, ''); } return ''; };
const isbnFrom = v => { for(const part of String(v || '').split(/[;,\s]+(?=\d)/)){ const k = idKind(part); if(k && k.kind === 'isbn') return k.id; } return ''; };
const tagsFrom = v => (Array.isArray(v) ? v : String(v || '').split(/[;,]/)).map(x => String(x).trim()).filter(Boolean);
/* CSV columns: which one is which */
const CSV_GUESS = {t: ['title', 'titel', 'titre', 'título', 'titolo', '标题', '題名', '题名', '篇名'], au: ['author', 'authors', 'creator', 'creators', 'autor', 'autoren', 'auteur', 'auteurs', 'autores', '作者', '著者'], y: ['publication year', 'year', 'date', 'issued', 'jahr', 'année', 'año', 'anno', '年份', '年', '出版年', '发表年份'], box: ['publication title', 'journal', 'source', 'container', 'publication', 'venue', 'booktitle', 'container-title', 'zeitschrift', 'revue', 'revista', 'rivista', '期刊', '来源', '刊名', '出处'],
  vol: ['volume'], iss: ['issue', 'number'], pages: ['pages', 'page'], pub: ['publisher'], doi: ['doi'], isbn: ['isbn'], url: ['url', 'link'], tags: ['manual tags', 'tags', 'keywords', 'keyword'], n: ['notes', 'note'], type: ['item type', 'type']};
function guessColumns(head){
  const h = head.map(x => String(x).trim().toLowerCase()), map = {};
  Object.entries(CSV_GUESS).forEach(([k, names]) => { let i = h.findIndex(x => names.includes(x)); if(i < 0) i = h.findIndex(x => names.some(nm => x.includes(nm))); if(i >= 0 && !Object.values(map).includes(i)) map[k] = i; });
  return map;
}
function itemsFromCSV(rows, map){
  const get = (r, k) => map[k] != null ? String(r[map[k]] == null ? '' : r[map[k]]).trim() : '';
  return rows.slice(1).map(r => ({t: get(r, 't'), au: authorsFrom(get(r, 'au')), y: yearFrom(get(r, 'y')), v: sourceFrom(get(r, 'box'), get(r, 'vol'), get(r, 'iss'), get(r, 'pages'), get(r, 'pub')),
    doi: doiFrom(get(r, 'doi'), get(r, 'url')), isbn: isbnFrom(get(r, 'isbn')), tags: tagsFrom(get(r, 'tags')), n: htmlText(get(r, 'n')), l: typeFrom(get(r, 'type'))})).filter(x => x.t);
}
function readImport(text, name){
  const s = String(text || '').replace(/^\uFEFF/, ''), lower = String(name || '').toLowerCase(), first = s.trim().charAt(0);
  if(/\.json$/.test(lower) || first === '[' || first === '{'){
    let j; try{ j = JSON.parse(s); }catch(e){ return {error: 'That JSON file couldn’t be read.'}; }
    if(j && j.app && j.lib) return {error: 'That’s a Paper Map backup. Use Settings → Data → Import backup for it.'};
    const arr = Array.isArray(j) ? j : (j && (j.items || j.data)) || [];
    return {format: 'CSL JSON', items: arr.map(m => ({t: String(Array.isArray(m.title) ? m.title[0] : m.title || '').replace(/\s+/g, ' ').trim(), au: authorsFrom(m.author || []), y: yearFrom(m.issued && m.issued['date-parts'] ? m.issued['date-parts'][0][0] : m.issued && m.issued.raw || m.year),
      v: sourceFrom(Array.isArray(m['container-title']) ? m['container-title'][0] : m['container-title'], m.volume, m.issue, m.page, m.publisher), doi: doiFrom(m.DOI, m.URL), isbn: isbnFrom(m.ISBN), tags: tagsFrom(m.keyword), n: htmlText(m.note), l: typeFrom(m.type)})).filter(x => x.t)};
  }
  if(/\.ris$/.test(lower) || /^TY  - /m.test(s)){
    return {format: 'RIS', items: parseRIS(s).map(r => ({t: (r.TI || r.T1 || r.CT || '').split('\n')[0], au: joinAuthors(r.AU.map(personFrom).filter(Boolean)), y: yearFrom(r.PY || r.Y1 || r.DA), v: sourceFrom(r.T2 || r.JO || r.JF || r.JA, r.VL, r.IS, r.SP ? r.SP + (r.EP ? '–' + r.EP : '') : '', r.PB),
      doi: doiFrom(r.DO, r.UR), isbn: isbnFrom(r.SN), tags: r.KW, n: htmlText(r.N1), l: typeFrom(r.TY)})).filter(x => x.t)};
  }
  if(/\.bib(tex)?$/.test(lower) || /@\s*[a-z]+\s*[{(]/i.test(s)){
    const items = parseBib(s).map(b => { const f = b.fields; return {t: f.title || '', au: authorsFrom(f.author || f.editor || ''), y: yearFrom(f.year || f.date), v: sourceFrom(f.journal || f.journaltitle || f.booktitle, f.volume, f.number, f.pages, f.publisher || f.institution || f.school),
      doi: doiFrom(f.doi, f.url), isbn: isbnFrom(f.isbn), tags: tagsFrom(f.keywords), n: f.annote || f.note || '', l: typeFrom(b.type)}; }).filter(x => x.t);
    if(items.length) return {format: 'BibTeX', items};
  }
  const rows = parseCSV(s);
  if(rows.length < 2) return {error: 'No papers found in that file. It should be a CSV with a header row, or a BibTeX, RIS or CSL JSON file.'};
  const head = rows[0], map = guessColumns(head), zotero = head.map(x => String(x).trim()).includes('Item Type') && head.map(x => String(x).trim()).includes('Publication Year');
  return {format: zotero ? 'Zotero CSV' : 'CSV', head, rows, map, items: itemsFromCSV(rows, map)};
}
const normTitle = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
function existingKeys(){
  const dois = new Set(), isbns = new Set(), titles = new Set();
  Object.values(lib.entries).forEach(e => { if(e.kind !== 'paper') return; if(e.doi) dois.add(String(e.doi).toLowerCase()); if(e.isbn) isbns.add(e.isbn); titles.add(normTitle(e.t) + '|' + (e.y || '')); });
  return {has: x => (x.doi && dois.has(x.doi.toLowerCase())) || (x.isbn && isbns.has(x.isbn)) || titles.has(normTitle(x.t) + '|' + (x.y || ''))};
}
function openImport(){
  const pick = '<p>Bring in papers from Zotero or another reference tool: a <b>CSV</b>, <b>BibTeX</b> (.bib), <b>RIS</b> (.ris) or <b>CSL JSON</b> file. You choose where they go and check them before anything is added.</p>' +
    '<div class="imp-drop" id="impDrop"><button type="button" class="btn primary" id="impPick">Choose a file</button><input type="file" id="impFile" accept=".csv,.tsv,.txt,.bib,.bibtex,.ris,.json,text/csv" hidden><span class="hint">or drop it here</span></div>' +
    '<details class="imp-help"><summary>Exporting from Zotero</summary><ol><li>Right-click a collection and choose <b>Export Collection…</b> (or select items and choose <b>Export Items…</b>).</li><li>Choose <b>CSV</b> or <b>BibTeX</b>, then OK.</li><li>Choose that file here.</li></ol></details>' +
    '<details class="imp-help"><summary>Or paste the text</summary><textarea id="impText2" rows="6" placeholder="Paste CSV, BibTeX, RIS or CSL JSON"></textarea><div class="set-actions"><button type="button" class="btn" id="impRead">Read it</button></div></details>' +
    '<p class="form-error" id="impErr" hidden></p>';
  openModal({title: 'Import papers', body: '<div id="impBody">' + pick + '</div>', actions: [{label: 'Cancel'}],
    onOpen: bd => {
      const err = m => { const e = bd.querySelector('#impErr'); if(e){ e.hidden = !m; e.textContent = m || ''; } };
      const take = (text, name) => { const r = readImport(text, name); if(r.error){ err(r.error); return; } if(!r.items.length && !r.head){ err('No papers with a title were found in that file.'); return; } importReview(bd, r, String(name || 'Imported').replace(/\.[^.]+$/, '')); };
      const file = f => { if(!f) return; if(f.size > 20 * 1048576){ err('That file is larger than 20 MB.'); return; } const rd = new FileReader(); rd.onload = () => take(String(rd.result), f.name); rd.onerror = () => err('That file couldn’t be read.'); rd.readAsText(f); };
      bd.querySelector('#impPick').addEventListener('click', () => bd.querySelector('#impFile').click());
      bd.querySelector('#impFile').addEventListener('change', ev => file(ev.target.files[0]));
      bd.querySelector('#impRead').addEventListener('click', () => take(bd.querySelector('#impText2').value, 'Pasted'));
      const drop = bd.querySelector('#impDrop');
      drop.addEventListener('dragover', ev => { ev.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', ev => { ev.preventDefault(); drop.classList.remove('over'); file(ev.dataTransfer.files[0]); });
    }});
}
function importReview(bd, r, srcName){
  const ex = existingKeys();
  const st = {dupSkip: true, tags: false, notes: true, pick: new Set(), topic: ui.topic && IDX.topics[ui.topic] ? ui.topic : (lib.topics[0] || {}).id, sub: '__new', newName: srcName === 'Pasted' ? 'Imported' : srcName};
  const draw = () => {
    if(r.head) r.items = itemsFromCSV(r.rows, r.map);
    r.items.forEach((x, i) => { x.dup = ex.has(x); x.i = i; });
    if(!st.pick.size || st.pick.__n !== r.items.length){ st.pick = new Set(r.items.filter(x => !x.dup).map(x => x.i)); st.pick.__n = r.items.length; }
    const nd = r.items.filter(x => x.dup).length, ny = r.items.filter(x => !x.y).length, tagSet = new Set(r.items.flatMap(x => x.tags || [])), nn = r.items.filter(x => x.n).length;
    const tp = IDX.topics[st.topic];
    const subOpts = tp ? treeSubs(tp).map(s => '<option value="' + s.id + '"' + (st.sub === s.id ? ' selected' : '') + '>' + esc(s.hidden ? tp.name + ' itself (no subtopic)' : subPath(s).join(' › ')) + '</option>').join('') : '';
    const cols = r.head ? '<details class="imp-cols" id="impCols"' + (r.map.t == null || st.colsOpen ? ' open' : '') + '><summary>Columns</summary><div class="imp-colgrid">' + [['t', 'Title'], ['au', 'Authors'], ['y', 'Year'], ['box', 'Journal or book'], ['vol', 'Volume'], ['iss', 'Issue'], ['pages', 'Pages'], ['doi', 'DOI'], ['tags', 'Tags'], ['n', 'Notes'], ['type', 'Type']].map(([k, label]) => '<label>' + label + '<select data-imp-col="' + k + '"><option value="">(none)</option>' + r.head.map((h, i) => '<option value="' + i + '"' + (r.map[k] === i ? ' selected' : '') + '>' + esc(h || 'Column ' + (i + 1)) + '</option>').join('') + '</select></label>').join('') + '</div></details>' : '';
    const n = [...st.pick].length;
    bd.querySelector('#impBody').innerHTML =
      (r.head && r.map.t == null ? '<p class="warn-line">Choose which column holds each paper’s title (under Columns), and the rest if you like.</p>' : '') +
      '<p><b>' + r.items.length + (r.items.length === 1 ? ' paper' : ' papers') + '</b> in “' + esc(srcName) + '” (' + esc(r.format) + ').' + (nd ? ' ' + nd + ' already in your map ' + (nd === 1 ? 'is' : 'are') + ' unticked.' : '') + (ny ? ' ' + ny + ' without a year won’t show on the map until you add one.' : '') + '</p>' + cols +
      '<div class="form-grid"><label>Topic<select id="impTopic">' + lib.topics.map(x => '<option value="' + x.id + '"' + (x.id === st.topic ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>' +
      '<label>Subtopic<select id="impSub"><option value="__new"' + (st.sub === '__new' ? ' selected' : '') + '>New subtopic…</option>' + subOpts + '</select></label>' +
      (st.sub === '__new' ? '<label class="full">Name of the new subtopic<input type="text" id="impNew" maxlength="80" value="' + esc(st.newName) + '"></label>' : '') + '</div>' +
      '<div class="ex-opts">' + (tagSet.size ? '<label><input type="checkbox" id="impTags"' + (st.tags ? ' checked' : '') + '> Keep their tags (' + tagSet.size + ')</label>' : '') + (nn ? '<label><input type="checkbox" id="impNotes"' + (st.notes ? ' checked' : '') + '> Keep their notes (' + nn + ')</label>' : '') + '<span class="hint"><button type="button" class="linkbtn" data-imp-all="1">Tick all</button> · <button type="button" class="linkbtn" data-imp-none="1">Untick all</button></span></div>' +
      '<div class="imp-list">' + r.items.map(x => '<label class="imp-row' + (x.dup ? ' dup' : '') + '"><input type="checkbox" data-imp-i="' + x.i + '"' + (st.pick.has(x.i) ? ' checked' : '') + '><span class="imp-y">' + esc(x.y || '—') + '</span><span class="imp-t"><b>' + esc(x.t) + '</b><span class="hint">' + esc([x.au, x.v].filter(Boolean).join(' · ')) + (x.dup ? ' · already in your map' : '') + '</span></span></label>').join('') + '</div>';
    const act = document.getElementById('modalActions');
    act.innerHTML = '<button type="button" class="btn" id="impBack">Back</button><button type="button" class="btn primary" id="impGo"' + (n ? '' : ' disabled') + '>Import ' + n + (n === 1 ? ' paper' : ' papers') + '</button>';
    act.querySelector('#impBack').onclick = () => { closeModal(); openImport(); };
    act.querySelector('#impGo').onclick = () => doImport(r, st);
  };
  bd.onchange = ev => {
    const c = ev.target.closest('[data-imp-col]'); if(c){ r.map[c.dataset.impCol] = c.value === '' ? undefined : +c.value; st.pick = new Set(); st.colsOpen = true; draw(); return; }
    const k = ev.target.closest('[data-imp-i]'); if(k){ if(k.checked) st.pick.add(+k.dataset.impI); else st.pick.delete(+k.dataset.impI); st.pick.__n = r.items.length; const n = st.pick.size, g = document.getElementById('impGo'); if(g){ g.textContent = 'Import ' + n + (n === 1 ? ' paper' : ' papers'); g.disabled = !n; } return; }
    if(ev.target.id === 'impTopic'){ st.topic = ev.target.value; st.sub = '__new'; draw(); return; }
    if(ev.target.id === 'impSub'){ st.sub = ev.target.value; draw(); return; }
    if(ev.target.id === 'impTags') st.tags = ev.target.checked;
    if(ev.target.id === 'impNotes') st.notes = ev.target.checked;
  };
  bd.oninput = ev => { if(ev.target.id === 'impNew') st.newName = ev.target.value; };
  bd.addEventListener('toggle', ev => { if(ev.target.id === 'impCols') st.colsOpen = ev.target.open; }, true);
  bd.onclick = ev => {
    if(ev.target.closest('[data-imp-all]')){ st.pick = new Set(r.items.map(x => x.i)); st.pick.__n = r.items.length; draw(); }
    if(ev.target.closest('[data-imp-none]')){ st.pick = new Set(); st.pick.__n = r.items.length; draw(); }
  };
  draw();
}
function doImport(r, st){
  const items = r.items.filter(x => st.pick.has(x.i)); if(!items.length) return;
  const before = clone(lib);
  let sid = st.sub;
  if(sid === '__new' || !IDX.subs[sid]){
    const name = (st.newName || '').trim() || 'Imported';
    let nid; do{ nid = rid('s'); }while(IDX.subs[nid] || IDX.topics[nid]);
    attachSubtree([{id: nid, name, desc: '', groups: []}], {k: 't', id: st.topic}, 'inside');
    if(Array.isArray(settings.lanes)){ settings.lanes.push(nid); persistSettings(); }
    reindex(); sid = nid;
  }
  const tagId = {};
  if(st.tags) items.forEach(x => (x.tags || []).forEach(nm => { if(tagId[nm]) return; const ex = lib.tags.find(z => z.name.toLowerCase() === nm.toLowerCase()); tagId[nm] = ex ? ex.id : (function(){ let id; do{ id = rid('tag'); }while(lib.tags.some(z => z.id === id)); lib.tags.push({id, name: nm, color: nextTagColor(), map: true}); return id; })(); }));
  items.forEach(x => {
    let id; do{ id = rid('e'); }while(lib.entries[id]);
    const e = {id, kind: 'paper', topic: IDX.topicOf[sid], sub: sid, group: '', y: x.y || undefined, au: x.au || '', t: x.t, v: x.v || '', l: LAYERS.includes(x.l) ? x.l : 'Paper', p: 2,
      tags: st.tags ? [...new Set((x.tags || []).map(nm => tagId[nm]).filter(Boolean))] : [], d: [], f: '', n: st.notes ? (x.n || '') : '', needs: []};
    if(x.doi) e.doi = x.doi; if(x.isbn) e.isbn = x.isbn; if(!e.n) delete e.n; if(e.y == null) delete e.y;
    lib.entries[id] = e;
  });
  reindex(); touchAllTopics(); syncControls();
  closeModal(); openView(sid);
  const where = (IDX.subs[sid] || {}).name || 'your map';
  toast('Imported ' + items.length + (items.length === 1 ? ' paper' : ' papers') + ' into “' + where + '”', () => { lib = before; reindex(); touchAllTopics(); fixView(); renderAll(); toast('Undone'); });
}

