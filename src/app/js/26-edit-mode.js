/* ===================== edit mode ===================== */
/* there is no Modify mode any more: everything can be changed at any time, and Undo is always there */
function setEditUI(){ ui.edit = false; const b = document.getElementById('editBanner'); if(b) b.hidden = true; document.body.classList.remove('editing'); setBarH(); }
function enterEditMode(then){ if(typeof then === 'function') setTimeout(then, 0); }
function askEditMode(then){ if(typeof then === 'function') setTimeout(then, 0); }


/* ---------- pickers ---------- */
function pickerHTML(name, label, ids, hint){
  return '<div class="field full picker" data-picker="' + name + '"><span>' + esc(label) + (hint ? '<span class="hint"> · ' + esc(hint) + '</span>' : '') + '</span>' +
    '<div class="picked">' + ids.map(pickChip).join('') + '</div>' +
    '<input type="search" class="picker-input" placeholder="Search by author, title or year" autocomplete="off"><div class="picker-list"></div></div>';
}
function pickChip(id){
  const e = lib.entries[id];
  if(!e) return '';
  return '<span class="pick" data-pid="' + id + '">' + esc(e.kind === 'concept' ? (e.short || e.t) : mapLabel(e) + ' ' + e.y) + '<button type="button" aria-label="Remove" data-unpick="' + id + '">×</button></span>';
}
function bindPickers(body, state, selfId){
  body.querySelectorAll('[data-picker]').forEach(box => {
    const name = box.dataset.picker;
    const input = box.querySelector('.picker-input'), list = box.querySelector('.picker-list'), picked = box.querySelector('.picked');
    const pool = () => Object.values(lib.entries).filter(e => e.id !== selfId && !state[name].includes(e.id) &&
      (name === 'needs' || name === 'cup' ? e.kind === 'concept' : e.kind === 'paper'));
    const refresh = () => {
      const q = input.value.trim().toLowerCase();
      if(!q){ list.innerHTML = ''; return; }
      const terms = q.split(/\s+/);
      const hits = pool().filter(e => { const hay = (e.y + ' ' + (e.au || '') + ' ' + (e.t || '') + ' ' + (e.short || '')).toLowerCase(); return terms.every(t => hay.includes(t)); }).sort(byYear).slice(0, 8);
      const raw = input.value.trim();
      const exact = (name === 'needs' || name === 'cup') && allConcepts().some(c => c.t.trim().toLowerCase() === raw.toLowerCase());
      list.innerHTML = hits.map(e => '<button type="button" data-pick="' + e.id + '">' + esc(e.kind === 'concept' ? e.t : [e.y, shortAu(e.au), e.t].filter(Boolean).join('  ')) + '</button>').join('') +
        ((name === 'needs' || name === 'cup') && !exact ? '<button type="button" class="pick-new" data-pick-new="1">+ New concept “' + esc(raw) + '”</button>' : '');
    };
    input.addEventListener('input', refresh);
    input.addEventListener('focus', refresh);
    list.addEventListener('click', ev => {
      const nb = ev.target.closest('[data-pick-new]');
      if(nb){
        const nameNew = input.value.trim(); if(!nameNew) return;
        const h = clashHint(nameNew);
        list.innerHTML = '<div class="pick-new-form"><span>New concept “' + esc(nameNew) + '”</span>' + (h ? '<span class="hint">' + esc(h) + '</span>' : '') +
          '<label>Year it appeared<input type="number" class="pn-year" placeholder="e.g. 1950"></label><button type="button" class="btn" data-pn-add="1">Add</button><button type="button" class="linkbtn" data-pn-cancel="1">Cancel</button><span class="form-error pn-err" hidden></span></div>';
        const yIn = list.querySelector('.pn-year'); yIn.focus();
        const add = () => {
          const y = parseInt(yIn.value, 10);
          if(!isFinite(y) || y < 1 || y > 2100){ const er = list.querySelector('.pn-err'); er.hidden = false; er.textContent = 'Add the year as a whole number.'; return; }
          let cid; do{ cid = rid('c'); }while(lib.entries[cid]);
          const sub = defaultViewOf(lib.topics[0].id).sub;
          const before = clone(lib);
          lib.entries[cid] = {id: cid, kind: 'concept', topic: IDX.topicOf[sub], sub, group: '', y, t: nameNew, short: nameNew.slice(0, 14), what: '', why: '', refs: []};
          reindex(); touchLib(); renderMap(true); renderTabs();
          state[name].push(cid); picked.insertAdjacentHTML('beforeend', pickChip(cid));
          input.value = ''; list.innerHTML = ''; input.focus();
          toast('Created concept “' + nameNew + '”', () => { lib = before; reindex(); touchAllTopics(); renderAll(); toast('Undone'); });
        };
        list.querySelector('[data-pn-add]').addEventListener('click', add);
        yIn.addEventListener('keydown', e2 => { if(e2.key === 'Enter'){ e2.preventDefault(); add(); } });
        list.querySelector('[data-pn-cancel]').addEventListener('click', () => { list.innerHTML = ''; input.focus(); });
        return;
      }
      const b = ev.target.closest('[data-pick]'); if(!b) return;
      state[name].push(b.dataset.pick);
      picked.insertAdjacentHTML('beforeend', pickChip(b.dataset.pick));
      input.value = ''; list.innerHTML = ''; input.focus();
    });
    picked.addEventListener('click', ev => {
      const b = ev.target.closest('[data-unpick]'); if(!b) return;
      state[name] = state[name].filter(x => x !== b.dataset.unpick);
      const chip = b.closest('.pick'); if(chip) chip.remove();
    });
  });
}

/* ---------- entry form ---------- */
function optionList(items, val){ return items.map(([v, l]) => '<option value="' + esc(v) + '"' + (v === val ? ' selected' : '') + '>' + esc(l) + '</option>').join(''); }
function subOptions(tid, val){ const tp = IDX.topics[tid]; return tp ? optionList(treeSubs(tp).map(s => { const d = IDX.depth[s.id] || 0; return [s.id, s.hidden ? (tp.subs.length > 1 ? tp.name + ' itself (no subtopic)' : '(no subtopics)') : '\u00a0\u00a0\u00a0'.repeat(d) + (d ? '↳ ' : '') + s.name]; }), val) : ''; }
function groupOptions(sid, val){ const s = IDX.subs[sid]; return '<option value="">No group</option>' + (s ? optionList(s.groups.map(g => [g.id, g.name]), val) : ''); }
function parentOptions(sid, val){ const cs = entriesOfSub(sid).filter(e => e.kind === 'concept').sort(byYear); return '<option value="">Not under a concept</option>' + optionList(cs.map(c => [c.id, c.t]), val); }
function openEntryForm(id, preset){
  const isNew = !id;
  const base = isNew ? Object.assign({kind:'paper', topic: ui.topic, sub: ui.sub || defaultViewOf(ui.topic).sub, group: ui.group || '', y: new Date().getFullYear(), au:'', t:'', v:'', l:'Paper', p:2, tags: defaultNewTags(), d:[], f:'', n:'', needs:[]}, preset || {}) : clone(lib.entries[id]);
  const state = {
    b: isNew ? [] : (IDX.up[id] || []).filter(x => x[1] === 'b').map(x => x[0]),
    c: isNew ? [] : (IDX.up[id] || []).filter(x => x[1] === 'c').map(x => x[0]),
    needs: [],
    mentions: (base.mentions || []).slice(),
    d: (base.d || []).slice(),
    tags: (base.tags || []).slice()
  };
  const doms = IDX.domains.slice();
  state.d.forEach(x => { if(!doms.includes(x)) doms.push(x); });
  const body = '<div class="form-grid">' +
    '<div class="full doi-field"><label for="fDoi">DOI, ISBN, other ID or the paper’s web address <span class="hint">optional · fills in the rest for you</span></label><div class="doi-row"><input type="text" id="fDoi" name="doi" value="' + esc(base.doi || base.isbn || (base.pmid ? 'PMID ' + base.pmid : '') || base.pii || '') + '" placeholder="DOI, ISBN, Elsevier PII, arXiv or PubMed ID" autocomplete="off" spellcheck="false"><button type="button" class="btn" id="doiFill">Fill in</button></div><p class="doi-msg hint" id="doiMsg" aria-live="polite"></p></div>' +
    '<label class="full">Title<input type="text" name="t" value="' + esc(base.t) + '" required></label>' +
    '<label class="full">Authors<input type="text" name="au" value="' + esc(base.au) + '" placeholder="Kahneman, D. &amp; Tversky, A."></label>' +
    '<label>Year<input type="number" name="y" value="' + esc(base.y) + '" inputmode="numeric"></label>' +
    '<label>Type<select name="l">' + optionList((base.l && !LAYERS.includes(base.l) ? [base.l] : []).concat(LAYERS).map(x => [x, x]), base.l) + '</select></label>' +
    '<label class="full">Source<input type="text" name="v" value="' + esc(base.v) + '" placeholder="Journal vol(issue): pages, or publisher"></label>' +
    '<label>Topic<select name="topic">' + optionList(lib.topics.map(tp => [tp.id, tp.name]), base.topic) + '</select></label>' +
    '<label>Subtopic<select name="sub">' + subOptions(base.topic, base.sub) + '</select></label>' +
    '<label>Group<select name="group">' + groupOptions(base.sub, base.group) + '</select></label>' +
    '<label>Concept<select name="parent">' + parentOptions(base.sub, base.parent || '') + '</select></label>' +
    '<div class="field full prio-field"><span>Priority</span><span class="ex-seg" role="radiogroup" aria-label="Priority">' + [3, 2, 1].map(p => '<label' + ((base.p || 1) === p ? ' class="on"' : '') + '><input type="radio" name="p" value="' + p + '"' + ((base.p || 1) === p ? ' checked' : '') + '>' + esc(PRIO_LABEL[p].replace(/^\S+\s/, '')) + '</label>').join('') + '</span></div>' +
    '<div class="field full"><span>Tags</span><div class="domchips" id="tagChips">' + lib.tags.map(x => tagToggle(x, state.tags.includes(x.id), 'data-ftag')).join('') + '</div>' +
      '<div style="display:flex;gap:8px;margin-top:6px"><input type="text" id="newTag" placeholder="New tag name"><button type="button" class="btn" id="addTag">New tag</button></div></div>' +
    '<div class="field full"><span>Interests</span><div class="domchips" id="domChips">' + doms.map(x => '<button type="button" class="dom' + (state.d.includes(x) ? ' on' : '') + '" data-fdom="' + esc(x) + '" aria-pressed="' + state.d.includes(x) + '">' + esc(x) + '</button>').join('') + '</div>' +
      '<div style="display:flex;gap:8px;margin-top:6px"><input type="text" id="newDom" placeholder="New interest"><button type="button" class="btn" id="addDom">Add</button></div></div>' +
    '<details class="full more-fields"' + (base.f ? ' open' : '') + '><summary>More details</summary><label>Focus <span class="hint">optional · the question it answers, if the title doesn’t say it</span><textarea name="f" rows="2" placeholder="The question this paper answers">' + esc(base.f) + '</textarea></label></details>' +
    '<div class="field full"><span>Mentions <span class="hint">topics it talks about, without linking it to a paper there</span></span><div class="domchips" id="mentChips"></div><select id="mentAdd"><option value="">+ Add a topic…</option>' + allLaneRows().map(r => { const key = r.sub.hidden ? r.topic.id : r.sub.id; return '<option value="' + esc(key) + '">' + esc(r.sub.hidden ? r.topic.name : r.topic.name + ' › ' + subPath(r.sub).join(' › ')) + '</option>'; }).join('') + '</select></div>' +
    '<label class="full">Notes<textarea name="n" rows="3" placeholder="Why read it, and how">' + esc(base.n) + '</textarea></label>' +
    pickerHTML('b', 'Builds on', state.b, 'earlier papers it builds on') +
    pickerHTML('c', 'Responds to', state.c, 'papers it replicates, rebuts or revises') +
  '</div><p class="form-error" id="formErr" hidden></p>';
  openModal({
    title: isNew ? 'New paper' : 'Modify paper',
    body,
    actions:[{label:'Cancel'}, {label:'Save', primary:true, onClick: b => { const r = saveEntry(b, id, state, base); if(r !== false && !id) bookmarkletSaved(); return r; }}],
    onOpen: b => {
      const fTopic = b.querySelector('[name=topic]'), fSub = b.querySelector('[name=sub]'), fGroup = b.querySelector('[name=group]'), fParent = b.querySelector('[name=parent]');
      fTopic.addEventListener('change', () => { fSub.innerHTML = subOptions(fTopic.value, ''); fGroup.innerHTML = groupOptions(fSub.value, ''); fParent.innerHTML = parentOptions(fSub.value, ''); });
      const drawMent = () => { const box = b.querySelector('#mentChips'); if(box) box.innerHTML = state.mentions.map(m => '<button type="button" class="dom on" data-ment-x="' + esc(m) + '">' + esc(mentionName(m)) + ' ×</button>').join(''); };
      drawMent();
      b.querySelector('#mentAdd').addEventListener('change', ev => { const v = ev.target.value; if(v && !state.mentions.includes(v)){ state.mentions.push(v); drawMent(); } ev.target.value = ''; });
      b.addEventListener('click', ev => { const x = ev.target.closest('[data-ment-x]'); if(x){ state.mentions = state.mentions.filter(m => m !== x.dataset.mentX); drawMent(); } });
      b.querySelectorAll('.prio-field input[name=p]').forEach(r => r.addEventListener('change', () => b.querySelectorAll('.prio-field label').forEach(l => l.classList.toggle('on', !!(l.querySelector('input') || {}).checked))));
      wireDoiFill(b, isNew);
      fSub.addEventListener('change', () => { fGroup.innerHTML = groupOptions(fSub.value, ''); fParent.innerHTML = parentOptions(fSub.value, ''); });
      b.querySelector('#domChips').addEventListener('click', ev => {
        const x = ev.target.closest('[data-fdom]'); if(!x) return;
        const v = x.dataset.fdom;
        if(state.d.includes(v)){ state.d = state.d.filter(z => z !== v); x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }
        else{ state.d.push(v); x.classList.add('on'); x.setAttribute('aria-pressed', 'true'); }
      });
      b.querySelector('#addDom').addEventListener('click', () => {
        const inp = b.querySelector('#newDom'); const v = inp.value.trim(); if(!v) return;
        if(!state.d.includes(v)) state.d.push(v);
        const box = b.querySelector('#domChips');
        const ex = Array.from(box.querySelectorAll('[data-fdom]')).find(z => z.dataset.fdom === v);
        if(ex){ ex.classList.add('on'); ex.setAttribute('aria-pressed', 'true'); }
        else box.insertAdjacentHTML('beforeend', '<button type="button" class="dom on" data-fdom="' + esc(v) + '" aria-pressed="true">' + esc(v) + '</button>');
        inp.value = '';
      });
      b.querySelector('#tagChips').addEventListener('click', ev => {
        const x = ev.target.closest('[data-ftag]'); if(!x) return;
        const v = x.dataset.ftag, on = state.tags.includes(v);
        state.tags = on ? state.tags.filter(z => z !== v) : state.tags.concat([v]);
        x.setAttribute('aria-pressed', String(!on));
      });
      b.querySelector('#addTag').addEventListener('click', () => {
        const inp = b.querySelector('#newTag'); const v = inp.value.trim(); if(!v) return;
        let x = lib.tags.find(z => z.name === v);
        if(!x) x = newTag(v);
        if(!state.tags.includes(x.id)) state.tags.push(x.id);
        b.querySelector('#tagChips').innerHTML = lib.tags.map(z => tagToggle(z, state.tags.includes(z.id), 'data-ftag')).join('');
        inp.value = '';
      });
      bindPickers(b, state, id);
    }
  });
}
function formErr(b, msg){ const el = b.querySelector('#formErr'); el.hidden = false; el.textContent = msg; return false; }
/* ---------- DOI ---------- */
function cleanDoi(s){
  s = String(s || '').trim().replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').trim();
  return /^10\.\d{4,9}\/\S+$/.test(s) ? s : '';
}
function initials(given){ return String(given || '').split(/\s+/).filter(Boolean).map(p => p.split('-').map(q => { const m = /\p{L}/u.exec(q); return m ? m[0].toUpperCase() + '.' : ''; }).filter(Boolean).join('-')).filter(Boolean).join(' '); }
function joinAuthors(list){
  const names = list.filter(a => a && (a.family || a.name)).map(a => a.family ? a.family + (a.given ? ', ' + initials(a.given) : '') : a.name);
  if(names.length <= 1) return names[0] || '';
  if(names.length > 6) return names.slice(0, 6).join(', ') + ' et al.';
  return names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
}
async function lookupDoi(doi){
  /* Crossref first: it registers most journal and book DOIs; then DataCite, for data, preprints and repositories */
  try{
    const r = await fetch('https://api.crossref.org/works/' + encodeURIComponent(doi), {headers: {'Accept': 'application/json'}});
    if(r.ok){
      const m = (await r.json()).message || {};
      const dp = (m.issued && m.issued['date-parts'] && m.issued['date-parts'][0]) || (m['published-print'] && m['published-print']['date-parts'][0]) || (m['published-online'] && m['published-online']['date-parts'][0]) || [];
      const box = (m['container-title'] || [])[0] || '';
      const vol = m.volume ? ' ' + m.volume + (m.issue ? '(' + m.issue + ')' : '') : '';
      const src = box ? box + vol + (m.page ? ': ' + String(m.page).replace('-', '–') : '') : (m.publisher || '');
      const type = {'journal-article': 'Paper', 'proceedings-article': 'Paper', 'posted-content': 'Paper', 'report': 'Paper', 'book': 'Book', 'monograph': 'Book', 'edited-book': 'Book', 'reference-book': 'Book', 'book-chapter': 'Chapter', 'book-section': 'Chapter'}[m.type] || '';
      return {from: 'Crossref', t: ((m.title || [])[0] || '').replace(/\s+/g, ' ').trim(), au: joinAuthors((m.author || []).map(a => ({family: a.family, given: a.given, name: a.name}))), y: dp[0] || '', v: src, l: type};
    }
  }catch(e){}
  /* then any other DOI agency (mEDRA, JaLC, KISTI…) through doi.org itself */
  const viaDoiOrg = async () => {
    try{
      const r = await fetch('https://doi.org/' + doi.split('/').map(encodeURIComponent).join('/'), {headers: {'Accept': 'application/vnd.citationstyles.csl+json'}});
      if(!r.ok) return null;
      const m = await r.json();
      const dp = (m.issued && m.issued['date-parts'] && m.issued['date-parts'][0]) || [];
      const box = Array.isArray(m['container-title']) ? m['container-title'][0] : m['container-title'];
      const vol = m.volume ? ' ' + m.volume + (m.issue ? '(' + m.issue + ')' : '') : '';
      const type = {'article-journal': 'Paper', 'paper-conference': 'Paper', 'report': 'Paper', 'book': 'Book', 'chapter': 'Chapter'}[m.type] || '';
      const title = Array.isArray(m.title) ? m.title[0] : m.title;
      return title ? {from: 'doi.org', t: String(title).replace(/\s+/g, ' ').trim(), au: joinAuthors((m.author || []).map(a => ({family: a.family, given: a.given, name: a.literal || a.name}))), y: dp[0] || '', v: box ? box + vol + (m.page ? ': ' + String(m.page).replace('-', '–') : '') : (m.publisher || ''), l: type} : null;
    }catch(e){ return null; }
  };
  try{
    const r = await fetch('https://api.datacite.org/dois/' + encodeURIComponent(doi));
    if(r.ok){
      const a = ((await r.json()).data || {}).attributes || {};
      return {from: 'DataCite', t: ((a.titles || [])[0] || {}).title || '', au: joinAuthors((a.creators || []).map(c => ({family: c.familyName, given: c.givenName, name: c.name}))), y: a.publicationYear || '', v: a.publisher || '', l: ''};
    }
  }catch(e){}
  return viaDoiOrg();
}

/* ---------- other identifiers: ISBN, PII, arXiv, PubMed ---------- */
function isbnValid(d){
  if(d.length === 10){ let s = 0; for(let i = 0; i < 10; i++){ const v = d[i] === 'X' ? 10 : +d[i]; if(isNaN(v) || (d[i] === 'X' && i !== 9)) return false; s += v * (10 - i); } return s % 11 === 0; }
  if(d.length === 13 && /^\d{13}$/.test(d)){ let s = 0; for(let i = 0; i < 13; i++) s += +d[i] * (i % 2 ? 3 : 1); return s % 10 === 0; }
  return false;
}
function idKind(raw){
  const s = String(raw || '').trim(); if(!s) return null;
  const doi = cleanDoi(s) || ((/(10\.\d{4,9}\/[^\s"<>]+)/.exec(s) || [])[1] || '').replace(/[.,;)]+$/, '');
  if(doi) return {kind: 'doi', id: doi};
  const ax = /^(?:https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf)\/|arxiv:\s*)?(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?(?:\.pdf)?$/i.exec(s);
  if(ax) return {kind: 'arxiv', id: ax[1]};
  const pmc = /^(?:pmcid:?\s*)?(PMC\d{4,9})$/i.exec(s); if(pmc) return {kind: 'pmcid', id: pmc[1].toUpperCase()};
  const pm = /^(?:pmid:?\s*|https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/)?(\d{1,9})\/?$/i.exec(s); if(pm) return {kind: 'pmid', id: pm[1]};
  const digits = s.replace(/^isbn(?:-1[03])?[:\s]*/i, '').replace(/[\s-]/g, '').toUpperCase();
  if(/^\d{9}[\dX]$|^\d{13}$/.test(digits) && isbnValid(digits)) return {kind: 'isbn', id: digits};
  const pii = s.replace(/^pii:?\s*/i, '').replace(/[^\dA-Za-z]/g, '').toUpperCase();
  if(/^[SB]\d{15}[\dX]$/.test(pii)) return {kind: 'pii', id: pii};
  return null;
}
const ID_NAME = {doi: 'DOI', isbn: 'ISBN', pii: 'PII', arxiv: 'arXiv ID', pmid: 'PubMed ID', pmcid: 'PubMed Central ID', url: 'web page'};
/* Zotero's own translators, through Wikipedia's citation service (Citoid): free and without an account. It reads DOIs, ISBNs,
   PubMed IDs and, like Zotero's browser button, the page of an article at a publisher, JSTOR, SSRN, NBER or a library. */
async function lookupZotero(q){
  try{
    const r = await fetch('https://en.wikipedia.org/api/rest_v1/data/citation/zotero/' + encodeURIComponent(q), {headers: {'Accept': 'application/json'}});
    if(!r.ok) return null;
    const arr = await r.json(), z = Array.isArray(arr) ? arr[0] : null;
    if(!z || !z.title || (z.itemType === 'webpage' && !z.creators && !z.date)) return null;
    const au = joinAuthors((z.creators || []).filter(c => !c.creatorType || c.creatorType === 'author' || c.creatorType === 'editor').map(c => ({family: c.lastName, given: c.firstName, name: c.name})));
    const y = (String(z.date || '').match(/\b(1[5-9]|20)\d{2}\b/) || [''])[0];
    const box = z.publicationTitle || z.bookTitle || z.proceedingsTitle || z.institution || z.university || z.publisher || z.websiteTitle || '';
    const vol = z.volume ? ' ' + z.volume + (z.issue ? '(' + z.issue + ')' : '') : '';
    const v = box ? box + vol + (z.pages ? ': ' + String(z.pages).replace('-', '–') : '') : '';
    const l = {journalArticle: 'Paper', conferencePaper: 'Paper', preprint: 'Paper', report: 'Paper', thesis: 'Paper', manuscript: 'Paper', book: 'Book', bookSection: 'Chapter'}[z.itemType] || '';
    return {from: 'Zotero', t: String(z.title).replace(/\s+/g, ' ').trim(), au, y: y ? +y : '', v, l, doi: z.DOI || '', isbn: String(z.ISBN || '').split(/[\s,]+/)[0] || '', pmid: z.PMID || ''};
  }catch(e){ return null; }
}
async function lookupIsbn(isbn){
  try{
    const r = await fetch('https://openlibrary.org/api/books?bibkeys=ISBN:' + isbn + '&format=json&jscmd=data');
    if(r.ok){ const b = (await r.json())['ISBN:' + isbn]; if(b && b.title) return {from: 'Open Library', t: b.title + (b.subtitle ? ': ' + b.subtitle : ''), au: joinAuthors((b.authors || []).map(a => personFrom(a.name)).filter(Boolean)), y: yearFrom(b.publish_date), v: ((b.publishers || [])[0] || {}).name || '', l: 'Book', isbn}; }
  }catch(e){}
  try{
    const r = await fetch('https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbn);
    if(r.ok){ const v = (((await r.json()).items || [])[0] || {}).volumeInfo; if(v && v.title) return {from: 'Google Books', t: v.title + (v.subtitle ? ': ' + v.subtitle : ''), au: joinAuthors((v.authors || []).map(personFrom).filter(Boolean)), y: yearFrom(v.publishedDate), v: v.publisher || '', l: 'Book', isbn}; }
  }catch(e){}
  return null;
}
async function lookupPii(pii){
  /* Elsevier article numbers: Crossref keeps them alongside the DOI */
  try{
    const r = await fetch('https://api.crossref.org/works?filter=alternative-id:' + encodeURIComponent(pii) + '&rows=1');
    if(r.ok){ const it = (((await r.json()).message || {}).items || [])[0]; if(it && it.DOI){ const m = await lookupDoi(it.DOI); if(m) return Object.assign(m, {doi: it.DOI}); } }
  }catch(e){}
  return null;
}
async function lookupPubmed(kind, id){
  try{
    const q = kind === 'pmcid' ? 'PMCID:' + id : 'EXT_ID:' + id + ' AND SRC:MED';
    const r = await fetch('https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&pageSize=1&query=' + encodeURIComponent(q));
    if(!r.ok) return null;
    const m = (((await r.json()).resultList || {}).result || [])[0]; if(!m || !m.title) return null;
    const au = (m.authorList && m.authorList.author || []).map(a => a.lastName ? {family: a.lastName, given: a.firstName || a.initials || ''} : {name: a.fullName}).filter(Boolean);
    const j = m.journalInfo || {}, jt = (j.journal || {}).title || m.journalTitle || '';
    return {from: 'Europe PMC', t: String(m.title).replace(/\.$/, ''), au: au.length ? joinAuthors(au) : (m.authorString || '').replace(/\.$/, ''), y: yearFrom(m.pubYear || j.yearOfPublication), v: sourceFrom(jt, j.volume, j.issue, m.pageInfo), l: 'Paper', doi: m.doi || '', pmid: m.pmid || (kind === 'pmid' ? id : '')};
  }catch(e){ return null; }
}
async function lookupAny(k){
  if(k.kind === 'url') return lookupZotero(k.id);
  let m = null;
  if(k.kind === 'doi') m = await lookupDoi(k.id);
  else if(k.kind === 'isbn') m = await lookupIsbn(k.id);
  else if(k.kind === 'pii') m = await lookupPii(k.id);
  else if(k.kind === 'arxiv'){ const doi = '10.48550/arXiv.' + k.id; m = await lookupDoi(doi); if(m) m = Object.assign(m, {doi}); }
  else m = await lookupPubmed(k.kind, k.id);
  /* when the registries have nothing, Zotero's translators often do */
  if(!m) m = await lookupZotero(k.kind === 'arxiv' ? 'https://arxiv.org/abs/' + k.id : k.kind === 'pii' ? 'https://www.sciencedirect.com/science/article/pii/' + k.id : k.id);
  return m;
}
/* where each identifier links to */
function idLinksHTML(e){
  const out = [];
  if(e.doi) out.push('<a href="https://doi.org/' + esc(e.doi) + '" target="_blank" rel="noopener">doi.org/' + esc(e.doi) + '</a>');
  if(e.isbn) out.push('<a href="https://openlibrary.org/isbn/' + esc(e.isbn) + '" target="_blank" rel="noopener">ISBN ' + esc(e.isbn) + '</a>');
  if(e.pmid) out.push('<a href="https://pubmed.ncbi.nlm.nih.gov/' + esc(e.pmid) + '/" target="_blank" rel="noopener">PubMed ' + esc(e.pmid) + '</a>');
  if(e.pii && !e.doi) out.push('<a href="https://www.sciencedirect.com/science/article/pii/' + esc(e.pii) + '" target="_blank" rel="noopener">PII ' + esc(e.pii) + '</a>');
  return out.join(' · ');
}

function wireDoiFill(b, isNew){
  const btn = b.querySelector('#doiFill'), inp = b.querySelector('#fDoi'), msg = b.querySelector('#doiMsg');
  if(!btn) return;
  const run = async () => {
    let k = idKind(inp.value);
    if(!k && /^https?:\/\/\S+\.\S+/i.test(inp.value.trim())) k = {kind: 'url', id: inp.value.trim()};
    if(!k){
      const d = inp.value.replace(/^isbn(?:-1[03])?[:\s]*/i, '').replace(/[\s-]/g, '');
      msg.textContent = /^\d{9}[\dXx]$|^\d{13}$/.test(d) ? 'That looks like an ISBN, but its last digit doesn’t check out. Look for a typo.' : 'That doesn’t look like a DOI (10.1257/…), an ISBN (978…), an Elsevier PII (S0…), an arXiv ID (2101.00001) or a PubMed ID.';
      msg.classList.add('warn-line'); return;
    }
    inp.value = k.id; msg.classList.remove('warn-line'); msg.textContent = 'Looking up the ' + ID_NAME[k.kind] + '…'; btn.disabled = true;
    const m = await lookupAny(k);
    btn.disabled = false;
    if(!m){ msg.textContent = navigator.onLine === false ? 'You’re offline, so it can’t be looked up now.' : 'No record found for this ' + ID_NAME[k.kind] + '. Check it, or fill in the fields yourself.'; msg.classList.add('warn-line'); return; }
    if(m.doi && k.kind !== 'doi'){ inp.value = m.doi; }
    const set = (n, v) => { const el = b.querySelector('[name="' + n + '"]'); if(!el || v === '' || v == null) return false; const cur = el.value.trim(); const empty = !cur || (n === 'y' && isNew && +cur === new Date().getFullYear()) || (n === 'l' && cur === 'Paper'); if(!empty) return false; if(el.tagName === 'SELECT' && ![...el.options].some(o => o.value === String(v))) return false; el.value = v; el.classList.add('just-filled'); setTimeout(() => el.classList.remove('just-filled'), 1800); return true; };
    const filled = [['t', 'title'], ['au', 'authors'], ['y', 'year'], ['v', k.kind === 'isbn' ? 'publisher' : 'source'], ['l', 'type']].filter(([n]) => set(n, m[n])).map(x => x[1]);
    b._ids = {isbn: m.isbn || (k.kind === 'isbn' ? k.id : ''), pmid: m.pmid || (k.kind === 'pmid' ? k.id : ''), pii: k.kind === 'pii' ? k.id : ''};
    msg.textContent = (filled.length ? 'Filled in ' + filled.join(', ') + ' from ' + m.from + '.' : 'Found it on ' + m.from + ', but every field was already filled, so nothing changed.') + (m.doi && k.kind !== 'doi' ? ' Its DOI is ' + m.doi + '.' : '') + (filled.length ? ' Fields you had already filled were left as they were.' : '');
  };
  btn.addEventListener('click', run);
  inp.addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); run(); } });
}

function saveEntry(b, id, state, base){
  const val = n => { const el = b.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
  const t = val('t'), au = val('au'), y = parseInt(val('y'), 10);
  if(!t) return formErr(b, 'The title can’t be empty.');
  if(!isFinite(y) || y < 1 || y > 2100) return formErr(b, 'The year must be a whole number between 1 and 2100.');
  const sub = val('sub');
  if(!IDX.subs[sub]) return formErr(b, 'Choose a subtopic.');
  const isNew = !id;
  const eid = isNew ? (function(){ let x; do{ x = rid('e'); }while(lib.entries[x]); return x; })() : id;
  const prev = isNew ? null : lib.entries[eid];
  const pv = b.querySelector('[name=p]:checked');
  const e = Object.assign({}, prev || {}, {
    id: eid, kind:'paper', topic: IDX.topicOf[sub], sub, group: val('group'), y, au, t, v: val('v'), l: val('l'),
    p: pv ? +pv.value : 2,
    tags: state.tags.filter(x => lib.tags.some(z => z.id === x)),
    d: state.d.slice(), f: val('f'), n: val('n'), doi: undefined,
    mentions: state.mentions.filter(x => IDX.subs[x] || IDX.topics[x])
  });
  const parent = val('parent');
  if(parent && lib.entries[parent] && lib.entries[parent].kind === 'concept') e.parent = parent; else delete e.parent;
  {
    const k = idKind(val('doi')), extra = b._ids || {};
    delete e.doi; delete e.isbn; delete e.pmid; delete e.pii;
    if(k && k.kind === 'doi') e.doi = k.id;
    else if(k && k.kind === 'arxiv') e.doi = '10.48550/arXiv.' + k.id;
    else if(k && k.kind === 'isbn') e.isbn = k.id;
    else if(k && k.kind === 'pmid') e.pmid = k.id;
    else if(k && k.kind === 'pii') e.pii = k.id;
    if(extra.isbn && !e.isbn) e.isbn = extra.isbn;
    if(extra.pmid && !e.pmid) e.pmid = extra.pmid;
    if(extra.pii && !e.pii && !e.doi) e.pii = extra.pii;
  }
  const before = clone(lib);
  const oldTopic = prev ? prev.topic : null;
  lib.entries[eid] = e;
  lib.links = lib.links.filter(l => !(l[1] === eid && (l[2] === 'b' || l[2] === 'c')));
  state.b.forEach(a => { if(a !== eid && lib.entries[a]) lib.links.push([a, eid, 'b']); });
  state.c.forEach(a => { if(a !== eid && lib.entries[a]) lib.links.push([a, eid, 'c']); });
  if(Array.isArray(settings.lanes) && !settings.lanes.includes(sub)){ settings.lanes.push(sub); persistSettings(); }
  reindex();
  touchLib([e.topic, oldTopic]);
  syncControls();
  if(isNew || (prev && prev.sub !== sub)) openView(sub, {row: e.parent ? null : eid, card: e.parent || null}); else renderAll();
  toast(isNew ? 'Added “' + t + '”' : 'Saved', () => { lib = before; reindex(); touchAllTopics(); renderAll(); toast('Undone'); });
  return true;
}

/* ---------- concept form ---------- */
function topicNameClash(name){
  const n = String(name || '').trim().toLowerCase(); if(!n) return '';
  for(const tp of lib.topics){
    if(tp.name.trim().toLowerCase() === n) return tp.name;
    const s = tp.subs.find(x => !x.hidden && x.name.trim().toLowerCase() === n); if(s) return s.name;
  }
  return '';
}
function clashHint(name){ const c = topicNameClash(name); return c ? 'There’s already a topic called “' + c + '”. Use a topic for a whole field you file papers under, and a concept for one idea papers rely on.' : ''; }
function openConceptForm(id, preset){
  const isNew = !id;
  const defSub = IDX.subs[ui.sub] ? ui.sub : defaultViewOf(ui.topic || lib.topics[0].id).sub;
  const base = isNew ? Object.assign({kind:'concept', topic: IDX.topicOf[defSub], sub: defSub, y: '', t:'', short:'', what:'', why:'', refs:[]}, preset || {}) : clone(lib.entries[id]);
  const state = {cup: isNew ? [] : (IDX.cUp[id] || []).slice()};
  const body = '<div class="form-grid">' +
    '<p class="hint full concept-intro">A concept is one idea that papers rely on, with the year it appeared, such as “Nash equilibrium, 1950”. It lives in the Concepts row at the top of the map, not under a topic.</p>' +
    '<label>Name<input type="text" name="t" value="' + esc(base.t) + '" required></label>' +
    '<label>Year it appeared<input type="number" name="y" value="' + esc(base.y) + '" placeholder="e.g. 1950"></label>' +
    '<p class="hint full name-clash" hidden></p>' +
    '<label class="full">Short name (shown on the map)<input type="text" name="short" value="' + esc(base.short) + '"></label>' +
    '<label class="full">What it is<textarea name="what" rows="2">' + esc(base.what) + '</textarea></label>' +
    '<label class="full">Why learn it first<textarea name="why" rows="3">' + esc(base.why) + '</textarea></label>' +
    pickerHTML('cup', 'Prerequisite concepts', state.cup, 'concepts to learn first') +
    '</div><p class="form-error" id="formErr" hidden></p>';
  openModal({
    title: isNew ? 'New concept' : 'Modify concept', body,
    actions:[{label:'Cancel'}, {label:'Save', primary:true, onClick: b => {
      const val = n => { const el = b.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
      const t = val('t'), y = parseInt(val('y'), 10);
      const sub = IDX.subs[base.sub] ? base.sub : defaultViewOf(lib.topics[0].id).sub;
      if(!t) return formErr(b, 'The name can’t be empty.');
      if(!isFinite(y) || y < 1 || y > 2100) return formErr(b, 'Add the year the idea appeared, as a whole number between 1 and 2100.');
      const before = clone(lib);
      const cid = isNew ? (function(){ let x; do{ x = rid('c'); }while(lib.entries[x]); return x; })() : id;
      const prev = lib.entries[cid];
      const e = Object.assign({}, prev || {}, {id:cid, kind:'concept', topic: IDX.topicOf[sub], sub, group:'', y, t, short: val('short') || t.slice(0, 6), what: val('what'), why: val('why'), refs: (prev && prev.refs) || []});
      lib.entries[cid] = e;
      (IDX.children[cid] || []).forEach(k => { const r = lib.entries[k]; if(r){ r.sub = sub; r.topic = e.topic; } });
      lib.links = lib.links.filter(l => !(l[1] === cid && l[2] === 'o'));
      state.cup.forEach(a => { if(a !== cid && lib.entries[a] && lib.entries[a].kind === 'concept') lib.links.push([a, cid, 'o']); });
      reindex();
      touchLib([e.topic, prev ? prev.topic : null]);
      openView('__concepts', {card: cid});
      toast(isNew ? 'Added concept “' + t + '”' : 'Saved', () => { lib = before; reindex(); touchAllTopics(); renderAll(); toast('Undone'); });
      return true;
    }}],
    onOpen: b => {
      const fName = b.querySelector('[name=t]'), clash = b.querySelector('.name-clash');
      const check = () => { const h = clashHint(fName.value); clash.hidden = !h; clash.textContent = h; };
      fName.addEventListener('input', check); check();
      bindPickers(b, state, id);
    }
  });
}

/* ---------- topic & sub forms ---------- */
function openTopicForm(tid){
  const isNew = !tid;
  const tp = isNew ? {name:'', desc:''} : IDX.topics[tid];
  const body = '<div class="form-grid">' +
    '<label class="full">Topic name<input type="text" name="name" value="' + esc(tp.name) + '" ></label>' +
    (isNew ? '<p class="hint full topic-intro">Top-level topics are for big areas, such as a field or a project. Links between them are drawn with lines, colour lines and Related topics, and the map shows them all.</p>' : '') +
    '<label class="full">Description<textarea name="desc" rows="2">' + esc(tp.desc) + '</textarea></label>' +
    (isNew ? '<label class="full">Subtopics<textarea name="subs" rows="3" placeholder="One per line"></textarea><span class="hint">Leave empty to keep papers directly under the topic; you can add subtopics any time.</span></label>' : '') +
    '</div><p class="form-error" id="formErr" hidden></p>';
  openModal({
    title: isNew ? 'New topic' : 'Modify topic', body,
    actions:[{label:'Cancel'}, {label:'Save', primary:true, onClick: b => {
      const name = b.querySelector('[name=name]').value.trim();
      const desc = b.querySelector('[name=desc]').value.trim();
      if(!name) return formErr(b, 'The topic name can’t be empty.');
      const before = clone(lib);
      if(isNew){
        let id; do{ id = rid('t'); }while(IDX.topics[id] || IDX.subs[id]);
        const names = b.querySelector('[name=subs]').value.split('\n').map(x => x.trim()).filter(Boolean);
        const mk = (n, hidden) => { let s; do{ s = rid('s'); }while(IDX.subs[s] || IDX.topics[s]); const o = {id:s, name:n, desc:'', groups:[]}; if(hidden) o.hidden = true; return o; };
        const subs = names.length ? names.map(n => mk(n, false)) : [mk(name, true)];
        lib.topics.push({id, name, desc, subs});
        if(Array.isArray(settings.lanes)){ subs.forEach(s => settings.lanes.push(s.id)); persistSettings(); }
        reindex(); touchLib([id]);
        openView(subs[0].id);
        toast('Created topic “' + name + '”', () => { lib = before; reindex(); touchAllTopics(); fixView(); renderAll(); toast('Undone'); });
      }else{
        tp.name = name; tp.desc = desc;
        lib.topics.forEach(t => { if(t.id === tid) t.subs.forEach(s => { if(s.hidden) s.name = name; }); });
        reindex(); touchLib([]); renderAll();
        toast('Saved');
      }
      return true;
    }}]
  });
}
function openSubForm(sid, topicId, parentId){
  const isNew = !sid;
  const tp = IDX.topics[isNew ? topicId : IDX.topicOf[sid]];
  const s = isNew ? {name:'', desc:'', groups:[], parent: parentId && IDX.subs[parentId] && !IDX.subs[parentId].hidden ? parentId : ''} : IDX.subs[sid];
  const below = new Set(isNew ? [] : [sid].concat(subDescendants(sid).map(x => x.id)));
  const here = s.parent ? 's:' + s.parent : 't:' + tp.id;
  const insideSel = '<label class="full">Inside<select name="parent">' + lib.topics.map(X =>
      '<option value="t:' + X.id + '"' + (here === 't:' + X.id ? ' selected' : '') + '>Top level of “' + esc(X.name) + '”</option>' +
      visibleSubs(X).filter(x => !below.has(x.id)).map(x => '<option value="s:' + x.id + '"' + (here === 's:' + x.id ? ' selected' : '') + '>' + '\u00a0\u00a0\u00a0'.repeat((IDX.depth[x.id] || 0) + 1) + esc(x.name) + '</option>').join('')).join('') +
    (isNew ? '' : '<option value="new">A topic of its own</option>') + '</select><span class="hint">You can also drag it in the Contents panel while Modify is on.</span></label>';
  const groups = s.groups.map(g => ({id:g.id, name:g.name}));
  const grpRows = () => groups.map((g, i) => '<div class="grp-row"><input type="text" data-gi="' + i + '" value="' + esc(g.name) + '"><button type="button" class="btn" data-gdel="' + i + '">Delete</button></div>').join('');
  const body = '<div class="form-grid">' +
    (s.hidden ? '<p class="full hint">This topic has no subtopics. Here you change how its papers are grouped.</p>' : '<label class="full">Subtopic name<input type="text" name="name" value="' + esc(s.name) + '"></label>' + insideSel) +
    (s.hidden ? '' : '<label class="full">Description<textarea name="desc" rows="2">' + esc(s.desc) + '</textarea></label>') +
    '<div class="field full"><span>Groups (small filters above the table, optional)</span><div id="grpBox">' + grpRows() + '</div><button type="button" class="btn" id="grpAdd">Add group</button></div>' +
    '</div><p class="form-error" id="formErr" hidden></p>';
  openModal({
    title: isNew ? 'New subtopic' : (s.hidden ? 'Modify groups' : 'Modify subtopic'), body,
    actions:[{label:'Cancel'}, {label:'Save', primary:true, onClick: b => {
      b.querySelectorAll('[data-gi]').forEach(inp => { groups[+inp.dataset.gi].name = inp.value.trim(); });
      const name = s.hidden ? s.name : b.querySelector('[name=name]').value.trim();
      if(!name) return formErr(b, 'The subtopic name can’t be empty.');
      const before = clone(lib);
      const cleanGroups = groups.filter(g => g.name).map(g => g.id ? g : {id: (function(){ let x; do{ x = rid('g'); }while(IDX.subs[x]); return x; })(), name: g.name});
      if(isNew){
        let nid; do{ nid = rid('s'); }while(IDX.subs[nid] || IDX.topics[nid]);
        const ns = {id:nid, name, desc: b.querySelector('[name=desc]').value.trim(), groups: cleanGroups};
        const pv = b.querySelector('[name=parent]').value;
        attachSubtree([ns], pv.startsWith('s:') && IDX.subs[pv.slice(2)] ? {k:'s', id: pv.slice(2)} : {k:'t', id: pv.startsWith('t:') && IDX.topics[pv.slice(2)] ? pv.slice(2) : tp.id}, 'inside');
        if(Array.isArray(settings.lanes)){ settings.lanes.push(nid); persistSettings(); }
        reindex(); touchAllTopics();
        openView(nid);
        toast('Created subtopic “' + name + '”', () => { lib = before; reindex(); touchAllTopics(); fixView(); renderAll(); toast('Undone'); });
      }else{
        const S = IDX.subs[sid];
        const keep = new Set(cleanGroups.map(g => g.id));
        S.groups = cleanGroups;
        (IDX.bySub[sid] || []).forEach(e => { if(e.group && !keep.has(e.group)) e.group = ''; });
        if(!S.hidden){
          S.name = name; S.desc = b.querySelector('[name=desc]').value.trim(); delete S.chain;
          const pv = b.querySelector('[name=parent]').value;
          if(pv !== here){
            const target = pv === 'new' ? {k:'t', id: tp.id} : pv.startsWith('s:') ? {k:'s', id: pv.slice(2)} : {k:'t', id: pv.slice(2)};
            if(canDrop({k:'s', id: sid}, target, pv === 'new' ? 'after' : 'inside')) moveNode({k:'s', id: sid}, target, pv === 'new' ? 'after' : 'inside');
          }
        }
        reindex(); touchAllTopics(); fixView(); renderAll();
        toast('Saved', () => { lib = before; reindex(); touchAllTopics(); fixView(); renderAll(); toast('Undone'); });
      }
      return true;
    }}],
    onOpen: b => {
      const box = b.querySelector('#grpBox');
      b.querySelector('#grpAdd').addEventListener('click', () => {
        box.querySelectorAll('[data-gi]').forEach(inp => { groups[+inp.dataset.gi].name = inp.value; });
        groups.push({id:'', name:''}); box.innerHTML = grpRows();
        const last = box.querySelector('[data-gi="' + (groups.length - 1) + '"]'); if(last) last.focus();
      });
      box.addEventListener('click', ev => {
        const d = ev.target.closest('[data-gdel]'); if(!d) return;
        box.querySelectorAll('[data-gi]').forEach(inp => { groups[+inp.dataset.gi].name = inp.value; });
        groups.splice(+d.dataset.gdel, 1); box.innerHTML = grpRows();
      });
    }
  });
}

/* ---------- deletion ---------- */
function deletionWarning(ids, all){
  const es = ids.map(k => lib.entries[k]).filter(Boolean);
  const papers = es.filter(e => e.kind === 'paper').length, concepts = es.filter(e => e.kind === 'concept').length;
  const noted = es.filter(e => e.n && String(e.n).trim()).length;
  if(!papers && !concepts) return 'No papers will be deleted.';
  const parts = [];
  if(papers) parts.push((all ? 'all ' : '') + papers + (papers === 1 ? ' paper' : ' papers'));
  if(concepts) parts.push(concepts + (concepts === 1 ? ' concept' : ' concepts'));
  return 'You will delete ' + parts.join(' and ') + '.' + (noted ? ' Notes on ' + noted + ' of them go too.' : '');
}
function countPapers(ids){ return ids.map(k => lib.entries[k]).filter(e => e && e.kind === 'paper').length; }
function confirmDanger(title, text, label, fn, warn){
  openModal({
    title, body:(warn ? '<p class="danger-count">' + esc(warn) + '</p>' : '') + '<p>' + esc(text) + '</p><label style="display:flex;gap:.5em;align-items:center;margin-top:.6em"><input type="checkbox" id="dangerAgree"> Yes, delete it</label>',
    actions:[{label:'Cancel'}, {label: label, primary:true, disabled:true, onClick: () => { fn(); }}],
    onOpen: (b, a) => { const cb = b.querySelector('#dangerAgree'), go = a.querySelector('[data-mi="1"]'); cb.addEventListener('change', () => { go.disabled = !cb.checked; }); }
  });
}
function deleteEntry(id){
  const e = lib.entries[id];
  if(!e) return;
  const kids = e.kind === 'concept' ? (IDX.children[id] || []) : [];
  const name = e.kind === 'concept' ? 'concept “' + e.t + '”' : '“' + e.t + '”';
  confirmDanger('Delete ' + (e.kind === 'concept' ? 'concept' : 'paper'), 'Delete ' + name + '? Its lines are deleted too' + (kids.length ? ', along with its ' + kids.length + ' readings' : '') + '.' + (e.pdf ? ' Its PDF stays in your GitHub repository.' : ''), 'Delete', () => {
    const before = clone(lib), stBefore = clone(status);
    [id].concat(kids).forEach(k => { const x = lib.entries[k]; if(x) delete status[keyOf(x)]; delete lib.entries[k]; });
    statusTime = Date.now(); persistStatus();
    Object.values(lib.entries).forEach(x => { if(x.needs) x.needs = x.needs.filter(c => c !== id); });
    lib.links = lib.links.filter(l => l[0] !== id && l[1] !== id && !kids.includes(l[0]) && !kids.includes(l[1]));
    if(ui.selected === id) ui.selected = null;
    reindex(); touchAllTopics(); renderAll();
    toast('Deleted ' + name, () => { lib = before; status = stBefore; statusTime = Date.now(); persistStatus(); reindex(); touchAllTopics(); renderAll(); toast('Undone'); });
  }, deletionWarning([id].concat(kids)));
}
function deleteSub(sid){
  const tp = IDX.topics[IDX.topicOf[sid]], s = IDX.subs[sid];
  const n = (IDX.bySub[sid] || []).length;
  const kn = (IDX.kids[sid] || []).length;
  const sIds = (IDX.bySub[sid] || []).map(e => e.id), sPapers = countPapers(sIds);
  confirmDanger('Delete subtopic “' + s.name + '”', 'This deletes the subtopic “' + s.name + '” and the ' + n + ' items directly in it.' + (kn ? ' Its ' + kn + (kn === 1 ? ' subtopic moves' : ' subtopics move') + ' up one level and keeps its papers.' : ''), sPapers ? 'Delete subtopic and ' + sPapers + (sPapers === 1 ? ' paper' : ' papers') : 'Delete subtopic', () => {
    const before = clone(lib), stBefore = clone(status);
    const gone = new Set((IDX.bySub[sid] || []).map(e => e.id));
    gone.forEach(k => { const x = lib.entries[k]; if(x) delete status[keyOf(x)]; delete lib.entries[k]; });
    statusTime = Date.now(); persistStatus();
    lib.links = lib.links.filter(l => !gone.has(l[0]) && !gone.has(l[1]));
    Object.values(lib.entries).forEach(x => { if(x.needs) x.needs = x.needs.filter(c => !gone.has(c)); });
    const T = lib.topics.find(t => t.id === tp.id);
    T.subs.forEach(x => { if(x.parent === sid){ if(s.parent) x.parent = s.parent; else delete x.parent; } });
    T.subs = T.subs.filter(x => x.id !== sid);
    if(!T.subs.length){ let h; do{ h = rid('s'); }while(IDX.subs[h]); T.subs.push({id:h, name:T.name, desc:'', groups:[], hidden:true}); }
    if(Array.isArray(settings.lanes)){ settings.lanes = settings.lanes.filter(x => x !== sid); persistSettings(); }
    reindex(); touchAllTopics(); ui.sub = null; openView(T.id);
    toast('Deleted subtopic “' + s.name + '”', () => { lib = before; status = stBefore; statusTime = Date.now(); persistStatus(); reindex(); touchAllTopics(); fixView(); renderAll(); toast('Undone'); });
  }, deletionWarning(sIds));
}
function deleteTopic(tid){
  const tp = IDX.topics[tid]; if(!tp) return;
  const n = topicEntries(tid).length, last = lib.topics.length <= 1;
  const subN = tp.subs.filter(s => !s.hidden).length;
  const tIds = topicEntries(tid).map(e => e.id), tPapers = countPapers(tIds);
  confirmDanger('Delete topic “' + tp.name + '”', 'This deletes the topic “' + tp.name + '”, its ' + subN + ' subtopics and ' + n + ' items.' + (last ? ' It is your only topic, so an empty “Untitled topic” will take its place.' : ''), tPapers ? 'Delete topic and ' + tPapers + (tPapers === 1 ? ' paper' : ' papers') : 'Delete topic', () => {
    const before = clone(lib), stBefore = clone(status);
    if(last){
      let id; do{ id = rid('t'); }while(IDX.topics[id] || IDX.subs[id]);
      let sid; do{ sid = rid('s'); }while(IDX.subs[sid] || IDX.topics[sid] || sid === id);
      lib.topics.push({id, name:'Untitled topic', desc:'', subs:[{id:sid, name:'Untitled topic', desc:'', groups:[], hidden:true}]});
    }
    const gone = new Set(topicEntries(tid).map(e => e.id));
    gone.forEach(k => { const x = lib.entries[k]; if(x) delete status[keyOf(x)]; delete lib.entries[k]; });
    statusTime = Date.now(); persistStatus();
    lib.links = lib.links.filter(l => !gone.has(l[0]) && !gone.has(l[1]));
    Object.values(lib.entries).forEach(x => { if(x.needs) x.needs = x.needs.filter(c => !gone.has(c)); });
    const subIds = new Set(tp.subs.map(s => s.id));
    lib.topics = lib.topics.filter(t => t.id !== tid);
    if(Array.isArray(settings.lanes)){ settings.lanes = settings.lanes.filter(x => !subIds.has(x)); persistSettings(); }
    reindex(); touchLib([tid].concat(lib.topics.map(t => t.id))); ui.selected = null; openView(lib.topics[0].id);
    toast('Deleted topic “' + tp.name + '”', () => { lib = before; status = stBefore; statusTime = Date.now(); persistStatus(); reindex(); touchAllTopics(); fixView(); renderAll(); toast('Undone'); });
  }, deletionWarning(tIds));
}

/* ---------- tags ---------- */
function nextTagColor(){ const used = new Set(lib.tags.map(x => String(x.color).toLowerCase())); return TAG_PALETTE.find(c => !used.has(c.toLowerCase())) || TAG_PALETTE[lib.tags.length % TAG_PALETTE.length]; }
function newTag(name){ let id; do{ id = rid('tag'); }while(lib.tags.some(x => x.id === id)); const x = {id, name, color: nextTagColor(), map:true}; lib.tags.push(x); reindex(); touchLib([]); syncControls(); return x; }
const persistTagsSoon = debounce(() => { touchLib([]); }, 400);
function refreshAfterTags(){ reindex(); syncControls(); renderMain(); renderMap(true); refreshInfo(); applyFocus(ui.selected); }
function toggleTag(id, tid){
  const e = lib.entries[id]; if(!e) return;
  const ts = Array.isArray(e.tags) ? e.tags : (e.tags = []);
  const i = ts.indexOf(tid);
  if(i >= 0) ts.splice(i, 1); else ts.push(tid);
  reindex(); touchLib([e.topic]);
  renderMain(); renderMap(true); refreshInfo(); applyFocus(ui.selected);
}
function openTagAssign(id){
  const e = lib.entries[id]; if(!e) return;
  const draw = b => { b.querySelector('#taBox').innerHTML = lib.tags.map(x => tagToggle(x, (e.tags || []).includes(x.id), 'data-tagtoggle')).join(''); };
  openModal({
    title:'Tags for “' + e.t + '”',
    body:'<div class="domchips" id="taBox"></div><p class="hint">Click to add a tag, click again to remove it.</p>',
    actions:[{label:'Manage tags', onClick: () => { setTimeout(openTagManager, 0); }}, {label:'Done', primary:true}],
    onOpen: b => { draw(b); b.querySelector('#taBox').addEventListener('click', ev => { const x = ev.target.closest('[data-tagtoggle]'); if(!x) return; toggleTag(id, x.dataset.tagtoggle); draw(b); }); }
  });
}
function viewPapers(){ return listPapers(ui.sub ? entriesOfSub(ui.sub) : topicEntries(ui.topic)).filter(matches); }
function openTagManager(){
  const counts = () => { const c = {}; Object.values(lib.entries).forEach(e => (e.tags || []).forEach(x => { c[x] = (c[x] || 0) + 1; })); return c; };
  const rowsHTML = () => {
    const c = counts();
    return lib.tags.map((x, i) => '<div class="tagrow" data-tid="' + esc(x.id) + '">' +
      '<input type="color" value="' + esc(/^#[0-9a-f]{6}$/i.test(x.color) ? x.color : '#9AA0AA') + '" data-tcolor aria-label="Colour of “' + esc(x.name) + '”">' +
      '<input type="text" value="' + esc(x.name) + '" data-tname aria-label="Tag name">' +
      '<label class="tagmap"><input type="checkbox" data-tmap' + (x.map !== false ? ' checked' : '') + '> Colour on map</label>' +
      '<span class="tagcount">' + (c[x.id] || 0) + ((c[x.id] || 0) === 1 ? ' paper' : ' papers') + '</span>' +
      '<button type="button" class="btn" data-tup' + (i ? '' : ' disabled') + ' aria-label="Move up">↑</button>' +
      '<button type="button" class="btn" data-tdown' + (i < lib.tags.length - 1 ? '' : ' disabled') + ' aria-label="Move down">↓</button>' +
      '<button type="button" class="btn" data-tdel>Delete</button></div>').join('') || '<p class="hint">No tags yet.</p>';
  };
  const bulkHTML = () => {
    const n = viewPapers().length, tp = IDX.topics[ui.topic], s = ui.sub ? IDX.subs[ui.sub] : null;
    const where = tp ? tp.name + (s ? (s.hidden ? '' : ' / ' + s.name) : ' / All') : '';
    const off = n && lib.tags.length ? '' : ' disabled';
    return '<p class="hint">The ' + n + (n === 1 ? ' paper' : ' papers') + ' shown on this page (' + esc(where) + ') with the current filters:</p><div class="set-actions"><label class="sel"><span class="sr">Tag</span><select id="bulkTag">' + lib.tags.map(x => '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>').join('') + '</select></label><button type="button" class="btn" id="bulkAdd"' + off + '>Add to all</button><button type="button" class="btn" id="bulkDel"' + off + '>Remove from all</button></div>';
  };
  openModal({
    title:'Tags & colours',
    body:'<p class="hint">Create, rename, recolour and reorder tags. Dots not yet marked Read or Want to read take their tags’ colours; a paper with several tags gets a split dot (up to three slices, in the order below). Tags with “Colour on map” off appear only in the table.</p>' +
      '<div id="tagRows">' + rowsHTML() + '</div>' +
      '<div class="set-actions"><input type="text" id="newTagName" class="tag-new" placeholder="New tag name"><button type="button" class="btn" id="newTagBtn">+ New tag</button></div>' +
      '<div class="set-section"><h3>Tag in bulk</h3><div id="bulkBox">' + bulkHTML() + '</div></div>',
    actions:[{label:'Done', primary:true}],
    onOpen: b => {
      const rows = b.querySelector('#tagRows');
      const redraw = () => { rows.innerHTML = rowsHTML(); b.querySelector('#bulkBox').innerHTML = bulkHTML(); };
      const tagOf = el => { const r = el.closest('[data-tid]'); return r ? lib.tags.find(x => x.id === r.dataset.tid) : null; };
      rows.addEventListener('input', ev => {
        if(!ev.target.matches('[data-tcolor]')) return;
        const x = tagOf(ev.target); if(!x) return;
        x.color = ev.target.value; refreshAfterTags(); persistTagsSoon();
      });
      rows.addEventListener('change', ev => {
        const x = tagOf(ev.target); if(!x) return;
        if(ev.target.matches('[data-tname]')){
          const v = ev.target.value.trim();
          if(!v){ ev.target.value = x.name; return; }
          x.name = v; refreshAfterTags(); touchLib([]); b.querySelector('#bulkBox').innerHTML = bulkHTML();
        }else if(ev.target.matches('[data-tmap]')){ x.map = ev.target.checked; refreshAfterTags(); touchLib([]); }
        else if(ev.target.matches('[data-tcolor]')){ x.color = ev.target.value; refreshAfterTags(); touchLib([]); }
      });
      rows.addEventListener('click', ev => {
        const x = tagOf(ev.target); if(!x) return;
        const i = lib.tags.indexOf(x);
        if(ev.target.closest('[data-tup]') && i > 0){ lib.tags.splice(i, 1); lib.tags.splice(i - 1, 0, x); refreshAfterTags(); touchLib([]); redraw(); }
        else if(ev.target.closest('[data-tdown]') && i < lib.tags.length - 1){ lib.tags.splice(i, 1); lib.tags.splice(i + 1, 0, x); refreshAfterTags(); touchLib([]); redraw(); }
        else if(ev.target.closest('[data-tdel]')){
          const btn = ev.target.closest('[data-tdel]');
          if(!btn.dataset.armed){ btn.dataset.armed = '1'; btn.textContent = 'Confirm delete'; return; }
          const before = clone(lib);
          lib.tags.splice(i, 1);
          Object.values(lib.entries).forEach(e => { if(Array.isArray(e.tags)) e.tags = e.tags.filter(z => z !== x.id); });
          if(ui.tag === x.id) ui.tag = '';
          refreshAfterTags(); touchAllTopics(); redraw();
          toast('Deleted tag “' + x.name + '”', () => { lib = before; reindex(); touchAllTopics(); renderAll(); toast('Undone'); });
        }
      });
      const addNew = () => { const inp = b.querySelector('#newTagName'); const v = inp.value.trim(); if(!v){ inp.focus(); return; } if(!lib.tags.some(z => z.name === v)) newTag(v); inp.value = ''; refreshAfterTags(); redraw(); };
      b.querySelector('#newTagBtn').addEventListener('click', addNew);
      b.querySelector('#newTagName').addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); addNew(); } });
      b.querySelector('#bulkBox').addEventListener('click', ev => {
        const add = ev.target.closest('#bulkAdd'), del = ev.target.closest('#bulkDel'); if(!add && !del) return;
        const tid = b.querySelector('#bulkTag').value, x = lib.tags.find(z => z.id === tid); if(!x) return;
        const before = clone(lib); let n = 0;
        viewPapers().forEach(e => {
          const ts = Array.isArray(e.tags) ? e.tags : (e.tags = []), has = ts.includes(tid);
          if(add && !has){ ts.push(tid); n++; }
          if(del && has){ e.tags = ts.filter(z => z !== tid); n++; }
        });
        refreshAfterTags(); touchAllTopics(); redraw();
        toast((add ? 'Added “' + x.name + '” to ' : 'Removed “' + x.name + '” from ') + n + (n === 1 ? ' paper' : ' papers'), () => { lib = before; reindex(); touchAllTopics(); renderAll(); toast('Undone'); });
      });
    }
  });
}

/* ---------- lane picker ---------- */
const lanePicker = document.getElementById('lanePicker');
function renderLanePicker(){
  const shown = new Set(lanesShown().map(l => l.sub.id));
  lanePicker.innerHTML = (allConcepts().length ? '<div class="lp-topic"><label><input type="checkbox" data-lpc="1"' + (settings.showConcepts !== false ? ' checked' : '') + '>Concepts (their own row at the top)</label></div>' : '') + '<div class="lp-actions"><button type="button" class="btn" data-lp="all">Show all</button><button type="button" class="btn" data-lp="current">Current topic only</button><button type="button" class="btn" data-lp="none">Clear all</button></div>' +
    lib.topics.map(tp => {
      const ids = tp.subs.map(s => s.id);
      const n = ids.filter(x => shown.has(x)).length;
      const hiddenOnly = tp.subs.length === 1 && tp.subs[0].hidden;
      return '<div class="lp-topic"><label><input type="checkbox" data-lpt="' + tp.id + '"' + (n === ids.length ? ' checked' : '') + (n && n < ids.length ? ' data-mixed="1"' : '') + '>' + esc(tp.name) + '</label>' +
        (hiddenOnly ? '' : '<div class="lp-subs">' + treeSubs(tp).map(s => '<label><input type="checkbox" data-lps="' + s.id + '"' + (shown.has(s.id) ? ' checked' : '') + '>' + esc(s.hidden ? tp.name + ' itself' : subPath(s).join(' › ')) + '</label>').join('') + '</div>') + '</div>';
    }).join('');
  lanePicker.querySelectorAll('[data-mixed]').forEach(cb => { cb.indeterminate = true; });
}
function setLanes(ids){
  const all = [];
  lib.topics.forEach(tp => tp.subs.forEach(s => all.push(s.id)));
  const set = new Set(ids);
  settings.lanes = all.length === set.size && all.every(x => set.has(x)) ? null : all.filter(x => set.has(x));
  persistSettings();
  renderLanePicker();
  renderMap(true);
}
lanePicker.addEventListener('change', ev => {
  if(ev.target.dataset.lpc){ settings.showConcepts = ev.target.checked; persistSettings({remote:false}); renderLanePicker(); renderMap(true); return; }
  const shown = new Set(lanesShown().map(l => l.sub.id));
  const t = ev.target;
  if(t.dataset.lpt){ const tp = IDX.topics[t.dataset.lpt]; tp.subs.forEach(s => { if(t.checked) shown.add(s.id); else shown.delete(s.id); }); }
  else if(t.dataset.lps){ if(t.checked) shown.add(t.dataset.lps); else shown.delete(t.dataset.lps); }
  setLanes(Array.from(shown));
});
lanePicker.addEventListener('click', ev => {
  const b = ev.target.closest('[data-lp]'); if(!b) return;
  if(b.dataset.lp === 'all') setLanes(lib.topics.flatMap(tp => tp.subs.map(s => s.id)));
  else if(b.dataset.lp === 'none') setLanes([]);
  else{ const tp = IDX.topics[ui.topic]; setLanes(tp ? tp.subs.map(s => s.id) : []); }
});
document.getElementById('btnLanes').addEventListener('click', () => {
  const open = lanePicker.hidden;
  lanePicker.hidden = !open;
  document.getElementById('btnLanes').setAttribute('aria-expanded', String(open));
  if(open) renderLanePicker();
});

/* ---------- settings, backup ---------- */
function openSettings(){
  const c = settings.colors || {};
  openModal({
    title:'Settings',
    body:'<div class="set-section" style="border-top:0;margin-top:0;padding-top:0"><h3>Page name</h3><div class="form-grid"><label class="full"><span class="sr">Page name</span><input type="text" id="setTitle" value="' + esc(lib.title || '') + '" placeholder="Paper Map"></label></div><p class="hint">Saved with your data, so it follows you across devices.</p></div>' +
      '<div class="set-section"><h3>Read and Want-to-read colours</h3>' +
      '<p class="hint">The defaults are emerald #009473 and cinnabar #E34234. They sit almost opposite each other on the colour wheel, so both stay bright on a light page without clashing. Nothing else on the page uses these two colours.</p>' +
      '<div class="color-row"><label><input type="color" id="cGreen" value="' + esc(c.green || DEFAULT_COLORS.green) + '"> Read</label><label><input type="color" id="cRed" value="' + esc(c.red || DEFAULT_COLORS.red) + '"> Want to read</label><button type="button" class="btn" id="cReset">Reset to defaults</button></div></div>' +
      '<div class="set-section"><h3>Paper</h3><div class="form-grid"><fieldset class="full"><legend>Light or dark</legend>' + [['auto', 'Match my system'], ['light', 'Light'], ['dark', 'Dark']].map(p => '<label><input type="radio" name="theme" value="' + p[0] + '"' + ((settings.theme || 'auto') === p[0] ? ' checked' : '') + '> ' + p[1] + '</label>').join('') + '</fieldset><fieldset class="full"><legend>Page background in light mode</legend>' +
        [['mist','Mist (cool, default)'],['warm','Warm white'],['white','Pure white']].map(p => '<label><input type="radio" name="paper" value="' + p[0] + '"' + ((settings.paper || 'mist') === p[0] ? ' checked' : '') + '> ' + p[1] + '</label>').join('') + '</fieldset></div></div>' +
      '<div class="set-section"><h3>Map</h3><label style="display:flex;gap:.5em;align-items:center"><input type="checkbox" id="srcColors"' + (settings.mapColor !== 'plain' ? ' checked' : '') + '> Colour unmarked dots by tag</label><label style="display:flex;gap:.5em;align-items:center;margin-top:.4em"><input type="checkbox" id="setShowRel"' + (settings.showRelated !== false ? ' checked' : '') + '> Show Related-to lines (dotted)</label><label style="display:flex;gap:.5em;align-items:center;margin-top:.6em"><input type="checkbox" id="setReadHints"' + (settings.readHints !== false ? ' checked' : '') + '> When I mark a paper read, show which papers on my map it cites</label><label class="set-arrows">Arrows on lines<select id="setArrows"><option value="flow"' + (settings.arrows === 'flow' ? ' selected' : '') + '>Point to the later paper: how ideas flow</option><option value="cite"' + (settings.arrows === 'cite' ? ' selected' : '') + '>Point to the paper it builds on: how citations go</option><option value="off"' + (settings.arrows === 'off' ? ' selected' : '') + '>Don’t show arrows</option></select></label><div class="set-actions"><button type="button" class="btn" id="setTags">Manage tags &amp; colours</button></div></div>' +
      '<div class="set-section"><h3>Undo</h3><label style="display:flex;gap:.5em;align-items:center">Undo stays available for <select id="setUndoWin">' + [[5, '5 minutes'], [10, '10 minutes'], [30, '30 minutes'], [0, 'until my next change']].map(o => '<option value="' + o[0] + '"' + (undoMinutes() === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label><p class="hint" style="margin:.4em 0 0">Undo always covers your last change, until you make another one. ' + (ghCfg() ? 'Every version saved before that stays in <a href="https://github.com/' + encodeURIComponent(ghCfg().owner) + '/' + encodeURIComponent(ghCfg().repo) + '/commits/' + encodeURIComponent(ghCfg().branch || 'main') + '/' + ghCfg().path.split('/').map(encodeURIComponent).join('/') + '" target="_blank" rel="noopener">your repository’s history</a>.' : 'With sync, earlier versions are kept too: Settings → Sync → Earlier versions.') + '</p></div>' +
      '<div class="set-section"><h3>Colour lines</h3><p class="hint">Named paths of ideas, with their colours. Add, rename, recolour or hide them, and see what is on each.</p><div class="set-actions"><button type="button" class="btn" id="setBrManage">Manage colour lines</button></div></div>' +
      syncSectionHTML() +
      '<div class="set-section"><h3>Data</h3><p class="hint">Saving status: <span data-save-state>' + esc(saveStateText()) + '</span>. A backup is one JSON file with all your topics, papers, lines and marks, in the same format as the data file in your repository.</p>' +
      '<div class="set-actions"><button type="button" class="btn" id="setExport">Export backup</button><button type="button" class="btn" id="setImport">Import backup</button><button type="button" class="btn" id="setNotes">Export notes</button><button type="button" class="btn" id="setMapExport">Export map (PNG or PDF)</button><button type="button" class="btn" id="setPapersImport">Import papers (Zotero, CSV, BibTeX, RIS)</button></div><p class="hint" style="margin-top:.9em"><b>Add from any page.</b> Drag this button to your bookmarks bar: <a class="bookmarklet" id="setBookmarklet" href="#" title="Drag me to your bookmarks bar">+ Paper Map</a>. On a paper’s page (a journal, arXiv, Google Scholar), click it: New paper opens here with its DOI and title, and you choose where it goes.</p><div class="set-actions"><button type="button" class="btn" id="setPapersExport">Export papers (CSV, BibTeX, RIS)</button><button type="button" class="btn" id="setReset">Start over</button>' + '</div></div>' +
      appSectionHTML() +
      '<p class="hint set-version" id="setVersion">Paper Map ' + APP_VERSION + ' · <a href="' + RELEASES_URL + '/tag/' + APP_VERSION + '" target="_blank" rel="noopener">What’s new</a><span id="setLatest"></span></p>',
    actions:[{label:'Done', primary:true}],
    onOpen: b => {
      const g = b.querySelector('#cGreen'), r = b.querySelector('#cRed');
      const upd = () => { settings.colors = {green: g.value, red: r.value}; if(g.value.toLowerCase() === DEFAULT_COLORS.green.toLowerCase() && r.value.toLowerCase() === DEFAULT_COLORS.red.toLowerCase()) settings.colors = null; applyColors(); persistSettings(); renderMap(true); };
      g.addEventListener('input', upd); r.addEventListener('input', upd);
      b.querySelector('#cReset').addEventListener('click', () => { g.value = DEFAULT_COLORS.green; r.value = DEFAULT_COLORS.red; settings.colors = null; applyColors(); persistSettings(); renderMap(true); });
      b.querySelector('#setTitle').addEventListener('change', ev => { lib.title = ev.target.value.trim(); applyTitle(); touchLib([]); });
      b.querySelector('#srcColors').addEventListener('change', ev => { settings.mapColor = ev.target.checked ? 'source' : 'plain'; persistSettings(); renderMap(true); });
      { const bm = b.querySelector('#setBookmarklet'); if(bm){ bm.setAttribute('href', bookmarkletHref()); bm.addEventListener('click', ev => { ev.preventDefault(); toast('Drag it to your bookmarks bar, then click it on a paper’s page'); }); } }
      b.querySelector('#setArrows').addEventListener('change', ev => { settings.arrows = ev.target.value; persistSettings(); renderMap(true); });
      b.querySelector('#setReadHints').addEventListener('change', ev => { settings.readHints = ev.target.checked; persistSettings(); });
      showLatest();
      const inst = b.querySelector('#setInstall');
      if(inst) inst.addEventListener('click', () => { closeModal(); runInstall(); });
      b.querySelector('#setShowRel').addEventListener('change', ev => { settings.showRelated = ev.target.checked; persistSettings({remote:false}); renderMap(true); refreshInfo(); applyFocus(ui.selected); });
      b.querySelector('#setUndoWin').addEventListener('change', ev => { settings.undoWindow = +ev.target.value; persistSettings({remote:false}); renderUndo(); });
      b.querySelectorAll('input[name=paper]').forEach(rb => rb.addEventListener('change', () => { if(rb.checked){ settings.paper = rb.value; applyColors(); persistSettings(); renderMap(true); } }));
      b.querySelectorAll('input[name=theme]').forEach(rb => rb.addEventListener('change', () => { if(rb.checked){ settings.theme = rb.value; applyColors(); persistSettings({remote:false}); renderMap(true); } }));
      wireGhSection(b);
      b.querySelector('#setTags').addEventListener('click', () => { closeModal(); setTimeout(openTagManager, 0); });
      b.querySelector('#setExport').addEventListener('click', () => { closeModal(); exportBackup(); });
      b.querySelector('#setImport').addEventListener('click', () => { closeModal(); importBackup(); });
      b.querySelector('#setReset').addEventListener('click', () => { closeModal(); resetBuiltin(); });
      b.querySelector('#setNotes').addEventListener('click', () => { closeModal(); setTimeout(() => openNotesExport(notedEntries(), false), 0); });
    }
  });
}
const REPO_LINK = 'https://github.com/new?name=paper-map-data&visibility=private&description=Paper+Map+data';
const TOKEN_LINK = 'https://github.com/settings/personal-access-tokens/new?name=Paper+Map&description=Lets+Paper+Map+save+to+one+private+repository&expires_in=366&contents=write';
function fmtDay(ms){ return new Date(ms).toLocaleDateString([], {day: 'numeric', month: 'short', year: 'numeric'}); }
function tokenDaysLeft(c){ return c && c.tokenExp ? Math.ceil((c.tokenExp - Date.now()) / 864e5) : null; }
const TOKENS_LINK = 'https://github.com/settings/personal-access-tokens';
function tokenRenewHTML(){
  return '<ol class="gh-steps"><li>Open <a href="' + TOKENS_LINK + '" target="_blank" rel="noopener">your tokens on GitHub</a> and click the Paper Map token.</li><li>Click <b>Regenerate token</b> and choose a year. Its repository and permission stay the same.</li><li>Copy the new token, then paste it in <b>Settings → Sync → GitHub</b> and click <b>Save and reload</b>.</li></ol>';
}
function tokenLineHTML(c){
  if(c && c.tokenNever) return '<p class="hint">Token: never expires. <button type="button" class="linkbtn" data-token-date="1">Change</button></p>';
  const d = tokenDaysLeft(c); if(d == null) return '';
  const when = fmtDay(c.tokenExp) + (c.tokenExpKnown ? '' : ' (estimated: a year after you connected)');
  const cls = d <= 14 ? ' warn-line' : '';
  return '<p class="hint' + cls + '">Token ' + (d < 0 ? 'expired on ' + when : 'expires on ' + when + (d <= 30 ? ' · in ' + d + (d === 1 ? ' day' : ' days') : '')) + '. <button type="button" class="linkbtn" data-token-help="1">How to renew</button> · <button type="button" class="linkbtn" data-token-date="1">Change the date</button></p>';
}
function askTokenExpiry(then){
  const yr = Date.now() + 366 * 864e5;
  let done = false;
  const go = () => { if(done) return; done = true; const c = lsGet(GH_KEY); if(c && !c.tokenExpKnown && !c.tokenExp){ c.tokenExp = yr; ghStore(c); } setTimeout(then, 0); };
  openModal({title: 'When does this token expire?', onClose: go, body: '<p class="hint">Paper Map reminds you two weeks before, so saving never stops by surprise. You can see the date on the token’s page on GitHub.</p>' +
      '<div class="tok-opts"><label><input type="radio" name="tokExp" value="year" checked> In a year, on ' + esc(fmtDay(yr)) + ' <span class="hint">(what the Create a token link sets)</span></label>' +
      '<label><input type="radio" name="tokExp" value="date"> On another date <input type="date" id="tokDate2" value="' + new Date(yr).toISOString().slice(0, 10) + '"></label>' +
      '<label><input type="radio" name="tokExp" value="never"> It never expires</label></div>',
    actions: [{label: 'Save', primary: true, onClick: bd => {
      const v = (bd.querySelector('input[name="tokExp"]:checked') || {}).value, c = lsGet(GH_KEY); if(!c) return;
      if(v === 'never'){ c.tokenExp = null; c.tokenNever = true; }
      else{ c.tokenNever = false; c.tokenExp = v === 'date' ? (Date.parse(bd.querySelector('#tokDate2').value + 'T12:00:00') || yr) : yr; }
      c.tokenExpKnown = true; ghStore(c);
      go();
    }}],
    onOpen: bd => { const d = bd.querySelector('#tokDate2'); d.addEventListener('focus', () => { bd.querySelector('input[value="date"]').checked = true; }); }
  });
}
function openTokenHelp(){ openModal({title: 'Renew your GitHub token', body: '<p>Tokens stop working on the date they expire. Renewing takes a minute and keeps everything as it is.</p>' + tokenRenewHTML(), actions: [{label: 'OK', primary: true}]}); }
function openTokenDate(){
  const c = ghCfg(); if(!c) return;
  if(c.tokenNever || !c.tokenExpKnown){ askTokenExpiry(() => {}); return; }
  openModal({title: 'When does your token expire?', body: '<p class="hint">GitHub shows it on the token’s page. Paper Map reminds you two weeks before.</p><div class="form-grid"><label class="full">Expires on<input type="date" id="tokDate" value="' + new Date(c.tokenExp || Date.now()).toISOString().slice(0, 10) + '"></label></div>',
    actions: [{label: 'Cancel'}, {label: 'Save', primary: true, onClick: bd => { const v = bd.querySelector('#tokDate').value; const ms = Date.parse(v + 'T12:00:00'); if(!ms) return false; const c2 = ghCfg(); if(!c2) return; c2.tokenExp = ms; c2.tokenExpKnown = true; ghStore(c2); toast('Saved: the token expires on ' + fmtDay(ms)); }}]});
}
/* once a day, close to the date, say so */
function tokenReminder(){
  const c = ghCfg(); if(!c || (c.kind && c.kind !== 'github') || PREVIEW) return;
  if(c.tokenNever) return;
  if(!c.tokenExp){ c.tokenExp = Date.now() + 366 * 864e5; c.tokenExpKnown = false; ghStore(c); return; }
  const d = tokenDaysLeft(c); if(d > 14) return;
  let last = 0; try{ last = +localStorage.getItem('rl:tokenNag') || 0; }catch(e){}
  if(Date.now() - last < 864e5) return;
  try{ localStorage.setItem('rl:tokenNag', String(Date.now())); }catch(e){}
  setTimeout(() => {
    const el = document.getElementById('toast'); if(!el) return;
    el.innerHTML = '<span>' + (d < 0 ? 'Your GitHub token has expired, so nothing is saving to GitHub.' : 'Your GitHub token expires ' + (d <= 0 ? 'today' : 'in ' + d + (d === 1 ? ' day' : ' days')) + '.') + '</span><button type="button" data-token-help="1">How to renew</button>';
    el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 14000);
  }, 2500);
}
window.addEventListener('load', tokenReminder);
/* Dropbox pane switched off together with Dropbox sign-in:
// function dbxSectionHTML(){
//   const c = lsGet(GH_KEY) || {}, on = c.kind === 'dropbox' && c.refresh, key = dbxKey();
//   let h = '<p class="hint">Your list is kept in your own Dropbox, in <b>Apps › Paper Map</b>, with earlier versions of the file. A free Dropbox account is enough, and Paper Map can only see that one folder.</p>';
//   if(on) h += '<p class="hint">Status: <span data-save-state>' + esc(saveStateText()) + '</span>' + (c.who ? ' · ' + esc(c.who) : '') + '</p>' + syncButtonsHTML('Dropbox');
//   else if(key) h += (syncKind() && syncKind() !== 'dropbox' ? '<p class="hint">You are syncing with ' + esc(syncName()) + ' now. Connecting Dropbox switches to it; what is in ' + esc(syncName()) + ' stays there.</p>' : '') + '<div class="set-actions"><button type="button" class="btn primary" data-dbx-connect="1">Connect Dropbox</button></div><p class="hint">You sign in on Dropbox’s own page and come straight back.</p>';
//   else h += '<p class="hint warn-line">Dropbox isn’t set up for this copy of Paper Map yet: it needs an app key (free, made once by whoever hosts Paper Map).</p>';
//   h += '<details class="gh-adv"><summary>Advanced</summary><div class="form-grid"><label class="full">Dropbox app key<input type="text" id="dbxKey" autocomplete="off" spellcheck="false" value="' + esc(localStorage.getItem('rl:dbxKey') || '') + '" placeholder="' + esc(DROPBOX_APP_KEY ? 'built in' : 'paste the app key') + '"></label></div><div class="set-actions"><button type="button" class="btn" data-dbx-key="1">Save key</button></div></details>';
//   return h;
// }
*/
function fsSectionHTML(){
  const c = lsGet(GH_KEY) || {}, on = c.kind === 'folder';
  let h = '<p class="hint">Paper Map keeps your list as one file in a folder you choose. Put the folder inside <b>iCloud Drive</b>, <b>Dropbox</b> or <b>OneDrive</b>: that app copies it to your other computers and keeps its own history, and Paper Map also keeps earlier copies in <code>data/backups</code>. No account or token needed.</p>' +
    '<details class="gh-adv"><summary>How, for each</summary><ul class="fs-tips"><li><b>iCloud Drive</b>: in Finder, open iCloud Drive, make a folder called Paper Map, then choose it here.</li><li><b>Dropbox</b>: choose a folder inside your Dropbox folder, and in Finder or Explorer right-click it → <b>Make available offline</b>.</li><li><b>OneDrive</b>: choose a folder inside OneDrive, and right-click it → <b>Always keep on this device</b>.</li></ul></details>';
  if(!FS_OK) return h + '<p class="hint warn-line">This works in Chrome and Edge on a computer, not in this browser. On a phone, use GitHub.</p>';
  if(on) h += '<p class="hint">Status: <span data-save-state>' + esc(saveStateText()) + '</span> · “' + esc(c.name || '') + '”</p>' + (fsDir ? syncButtonsHTML('your folder') : '<div class="set-actions"><button type="button" class="btn primary" data-fs-reconnect="1">Allow access again</button><button type="button" class="btn" data-sync-forget="1">Disconnect</button></div>');
  else h += (syncKind() === 'github' ? '<p class="hint">You are syncing with GitHub now. Choosing a folder switches to it; what is on GitHub stays there.</p>' : '') + '<div class="set-actions"><button type="button" class="btn primary" data-fs-connect="1">Choose a folder</button></div><p class="hint">After the browser restarts, it asks once more before Paper Map can save there.</p>';
  return h;
}
function syncButtonsHTML(where){
  return '<div class="set-actions"><button type="button" class="btn" data-sync-pull="1">Load from ' + esc(where) + '</button><button type="button" class="btn" data-sync-save="1">Save now</button><button type="button" class="btn" data-sync-history="1">Earlier versions</button><button type="button" class="btn" data-sync-forget="1">Disconnect</button></div>';
}
function syncSectionHTML(){
  if(PREVIEW) return ghSectionHTML();
  const k = syncKind() === 'folder' ? 'folder' : 'github';
  const tab = (id, label) => '<button type="button" role="tab" class="sync-tab" data-sync-tab="' + id + '" aria-selected="' + (k === id) + '">' + label + (syncKind() === id ? ' <span class="sync-dot" aria-label="connected"></span>' : '') + '</button>';
  return '<div class="set-section sync-section"><h3>Sync</h3><p class="hint">Keep your list safe and on every device. GitHub is the most reliable: every save is kept for good. Choose one; you can switch later.</p>' +
    '<div class="sync-tabs" role="tablist">' + tab('github', 'GitHub') + tab('folder', 'iCloud / Dropbox folder') + '</div>' +
    '<div class="sync-pane" data-sync-pane="github"' + (k === 'github' ? '' : ' hidden') + '>' + ghSectionHTML().replace('<div class="set-section"><h3>GitHub sync</h3>', '<div class="sync-gh">') + '</div>' +
    '<div class="sync-pane" data-sync-pane="folder"' + (k === 'folder' ? '' : ' hidden') + '>' + fsSectionHTML() + '</div></div>';
}
function ghSectionHTML(){
  if(PREVIEW) return '<div class="set-section"><h3>Sync</h3><p class="hint">Not available in the preview. Download the page to use it with your own list.</p></div>';
  const g0 = lsGet(GH_KEY) || {}, g = (g0.kind || 'github') === 'github' ? g0 : {};
  const has = !!(g.owner && g.repo && g.token);
  return '<div class="set-section"><h3>GitHub sync</h3>' +
    '<p class="hint">The copy in this browser is lost if its data is cleared. This keeps your list in a private GitHub repository you own: each change is saved there within seconds, earlier versions stay in its history, and you can open the list on any device. The token stays in this browser only.</p>' +
    (has ? '' : '<ol class="gh-steps">' +
      '<li><a href="' + REPO_LINK + '" target="_blank" rel="noopener">Create a private repository</a>. The name is filled in; tick <em>Add a README file</em>.</li>' +
      '<li><a href="' + TOKEN_LINK + '" target="_blank" rel="noopener">Create a token</a>: under Repository access, choose <em>Only select repositories</em> and pick that repository. The only permission it needs, <em>Contents: Read and write</em>, is already filled in; remove anything else.</li>' +
      '<li>Paste the token below and click Connect.</li></ol>') +
    '<div class="form-grid">' +
    '<label>Repository<input type="text" id="ghRepo" autocomplete="off" spellcheck="false" value="' + esc(g.repo || 'paper-map-data') + '"></label>' +
    '<label>Token<input type="password" id="ghToken" autocomplete="off" spellcheck="false" placeholder="github_pat_…" value="' + esc(g.token || '') + '"></label>' +
    '</div>' +
    '<details class="gh-adv"><summary>Advanced</summary><div class="form-grid">' +
    '<label>GitHub username<input type="text" id="ghOwner" autocomplete="off" spellcheck="false" placeholder="found from the token" value="' + esc(g.owner || '') + '"></label>' +
    '<label>Branch<input type="text" id="ghBranch" autocomplete="off" spellcheck="false" value="' + esc(g.branch || 'main') + '"></label>' +
    '<label class="full">File path<input type="text" id="ghPath" autocomplete="off" spellcheck="false" value="' + esc(g.path || 'data/paper-map.json') + '"></label>' +
    '</div></details>' +
    '<div class="set-actions"><button type="button" class="btn primary" id="ghConnect">' + (has ? 'Save and reload' : 'Connect') + '</button>' +
    '<button type="button" class="btn" id="ghPull"' + (has ? '' : ' disabled') + '>Load from GitHub</button>' +
    '<button type="button" class="btn" id="ghSaveNow"' + (has ? '' : ' disabled') + '>Save to GitHub now</button>' +
    '<button type="button" class="btn" id="ghHistoryBtn"' + (has ? '' : ' disabled') + '>Earlier versions</button>' +
    '<button type="button" class="btn" id="ghForgetBtn"' + (has ? '' : ' disabled') + '>Disconnect</button></div>' +
    '<p class="hint">Status: <span data-save-state>' + esc(has ? saveStateText() : 'Not connected') + '</span>' + (has ? ' · ' + esc(g.owner + '/' + g.repo) : '') + '</p>' + (has ? tokenLineHTML(Object.assign({}, g)) : '') + '<p class="form-error" id="ghFormErr" hidden></p></div>';
}
let ghTokenExpHeader = null;
async function ghWhoAmI(token){
  const res = await fetch('https://api.github.com/user?_=' + Date.now(), {headers: {'Accept':'application/vnd.github+json', 'Authorization':'Bearer ' + token}});
  if(!res.ok) throw {status: res.status};
  try{ const h = res.headers.get('github-authentication-token-expiration'); ghTokenExpHeader = h ? Date.parse(h.replace(' UTC', 'Z').replace(' ', 'T')) || null : null; }catch(e){ ghTokenExpHeader = null; }
  const j = await res.json();
  return j && j.login;
}
function wireGhSection(b){
  if(!b.querySelector('#ghConnect')) return;   /* the preview has no sync form */
  const err = msg => { const el = b.querySelector('#ghFormErr'); el.hidden = !msg; el.textContent = msg || ''; };
  const go = b.querySelector('#ghConnect');
  go.addEventListener('click', async () => {
    const repo = b.querySelector('#ghRepo').value.trim();
    const token = b.querySelector('#ghToken').value.trim();
    let owner = b.querySelector('#ghOwner').value.trim();
    const branch = b.querySelector('#ghBranch').value.trim() || 'main';
    const path = b.querySelector('#ghPath').value.trim().replace(/^\/+/, '') || 'data/paper-map.json';
    if(!/^[A-Za-z0-9._-]{1,100}$/.test(repo)) return err('A repository name can contain only letters, numbers, dots, underscores and hyphens.');
    if(token.length < 20) return err('Paste the whole token.');
    if(!/\.json$/i.test(path) || /\.\./.test(path)) return err('The file path must end in .json.');
    err('');
    const old = lsGet(GH_KEY) || {};
    if(!owner || old.token !== token){
      go.disabled = true; go.textContent = 'Connecting…';
      try{ owner = await ghWhoAmI(token) || owner; }
      catch(e){ go.disabled = false; go.textContent = 'Connect'; return err(ghErr(e)); }
      go.disabled = false;
      b.querySelector('#ghOwner').value = owner || '';
    }
    if(!/^[A-Za-z0-9-]{1,39}$/.test(owner || '')) return err('Couldn’t find your GitHub username. Enter it under Advanced.');
    go.textContent = 'Save and reload';
    const same = old.owner === owner && old.repo === repo && old.branch === branch && old.path === path;
    const tokenSame = old.token === token;
    const tokenExp = !tokenSame ? (ghTokenExpHeader || Date.now() + 366 * 864e5) : (old.tokenExp || ghTokenExpHeader || Date.now() + 366 * 864e5);
    const tokenExpKnown = !tokenSame ? !!ghTokenExpHeader : (old.tokenExpKnown || !!ghTokenExpHeader);
    ghStore({owner, repo, branch, path, token, tokenExp, tokenExpKnown, sha: same ? old.sha || null : null, dirty: same ? !!old.dirty : false, lastSyncedAt: same ? old.lastSyncedAt || 0 : 0});
    b.querySelector('#ghSaveNow').disabled = false; b.querySelector('#ghForgetBtn').disabled = false; b.querySelector('#ghPull').disabled = false; b.querySelector('#ghHistoryBtn').disabled = false;
    if(!tokenSame && !ghTokenExpHeader) askTokenExpiry(() => ghLoad()); else ghLoad();
  });
  b.querySelector('#ghSaveNow').addEventListener('click', () => { const c = ghCfg(); if(!c) return; c.dirty = true; ghStore(c); gh.rev++; ghSave(); });
  b.querySelector('#ghPull').addEventListener('click', () => { closeModal(); ghPullNow(); });
  b.querySelector('#ghHistoryBtn').addEventListener('click', () => { closeModal(); ghHistory(); });
  b.querySelector('#ghForgetBtn').addEventListener('click', () => {
    ghForget();
    b.querySelector('#ghToken').value = '';
    b.querySelector('#ghSaveNow').disabled = true; b.querySelector('#ghForgetBtn').disabled = true; b.querySelector('#ghPull').disabled = true; b.querySelector('#ghHistoryBtn').disabled = true;
    toast('Disconnected; the token was removed from this browser');
  });
}
async function exportBackup(){
  const payload = JSON.stringify(snapshot(), null, 1);
  const fname = 'paper-map-' + new Date().toISOString().slice(0, 10) + '.json';
  {
    try{
      const url = URL.createObjectURL(new Blob([payload], {type:'application/json'}));
      const link = document.createElement('a'); link.href = url; link.download = fname;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Backup downloaded'); return;
    }catch(e){}
  }
  openModal({
    title:'Export backup',
    body:'<p>Downloading isn’t available here. Copy everything below and save it as a .json file.</p><textarea class="backup" id="backupText" readonly>' + esc(payload) + '</textarea>',
    actions:[{label:'Copy', onClick: b => { const ta = b.querySelector('#backupText'); ta.select(); let okc = false; try{ okc = document.execCommand('copy'); }catch(e){} if(navigator.clipboard) navigator.clipboard.writeText(payload).then(() => toast('Copied'), () => { if(!okc) toast('Select all and copy it by hand'); }); else toast(okc ? 'Copied' : 'Select all and copy it by hand'); return false; }}, {label:'Close', primary:true}]
  });
}
function importBackup(){
  openModal({
    title:'Import backup',
    body:(countPapers(Object.keys(lib.entries)) ? '<p class="danger-count">Importing replaces your current list of ' + countPapers(Object.keys(lib.entries)) + ' papers.</p>' : '') + '<p>Choose a .json file you exported earlier, or paste a backup below. Importing replaces all current content and marks.</p>' +
      '<p><input type="file" id="impFile" accept=".json,application/json"></p><textarea class="backup" id="impText" placeholder="Or paste a backup here"></textarea><p class="form-error" id="formErr" hidden></p>',
    actions:[{label:'Cancel'}, {label:'Import and replace', primary:true, onClick: b => {
      let obj;
      try{ obj = JSON.parse(b.querySelector('#impText').value); }catch(e){ return formErr(b, 'This isn’t valid JSON.'); }
      const L = obj && obj.lib;
      if(!validLib(L)) return formErr(b, 'This isn’t a backup from this page, or the file is damaged.');
      const before = {lib: clone(lib), status: clone(status), statusTime};
      if(obj.status && obj.status.map){ status = obj.status.map; statusTime = Date.now(); persistStatus(); }
      lib = normalizeLib(L); lib.updatedAt = Date.now();
      if(obj.settings && typeof obj.settings === 'object'){ const keepToc = settings.toc; settings = normalizeSettings(Object.assign(defaultSettings(), obj.settings)); settings.toc = keepToc; applyColors(); persistSettings(); }
      reindex(); touchAllTopics();
      if(location.hash.length > 1){ const hv = resolveView(location.hash.slice(1)); ui.topic = hv.topic; ui.sub = hv.sub; }
      fixView(); renderAll();
      toast('Backup imported', () => { lib = before.lib; status = before.status; statusTime = Date.now(); persistStatus(); reindex(); touchAllTopics(); fixView(); renderAll(); toast('Undone'); });
      return true;
    }}],
    onOpen: b => {
      b.querySelector('#impFile').addEventListener('change', ev => {
        const f = ev.target.files && ev.target.files[0]; if(!f) return;
        const rd = new FileReader();
        rd.onload = () => { b.querySelector('#impText').value = String(rd.result || ''); };
        rd.readAsText(f);
      });
    }
  });
}
function resetBuiltin(){
  openModal({
    title:'Start over',
    body:'<p class="danger-count">' + esc(deletionWarning(Object.keys(lib.entries), true)) + '</p><p>This deletes all topics, papers, tags and lines and returns to a blank page. Export a backup first if you might want them back.</p><label style="display:flex;gap:.5em;align-items:center"><input type="checkbox" id="keepSt" checked> Keep Read and Want-to-read marks</label><label style="display:flex;gap:.5em;align-items:center;margin-top:.5em"><input type="checkbox" id="dangerAgree"> Yes, start over</label>',
    actions:[{label:'Cancel'}, {label:'Start over', primary:true, disabled:true, onClick: b => {
      const keep = b.querySelector('#keepSt').checked;
      const before = {lib: clone(lib), status: clone(status)};
      const oldTopics = lib.topics.map(t => t.id);
      lib = buildSeed(); lib.updatedAt = Date.now();
      if(!keep){ status = {}; statusTime = Date.now(); persistStatus(); }
      settings.lanes = null; persistSettings();
      reindex(); touchLib(oldTopics.concat(lib.topics.map(t => t.id))); fixView(); renderAll();
      toast('Cleared', () => { lib = before.lib; status = before.status; statusTime = Date.now(); persistStatus(); reindex(); touchAllTopics(); fixView(); renderAll(); toast('Undone'); });
      return true;
    }}],
    onOpen: (b, a) => { const cb = b.querySelector('#dangerAgree'), go = a.querySelector('[data-mi="1"]'); cb.addEventListener('change', () => { go.disabled = !cb.checked; }); }
  });
}

