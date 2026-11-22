/* ===================== notebooks =====================
   Notebooks of your own, apart from the research log: kept with your Readings ("My notebooks"), opened full on a page of
   their own, or beside a mind map from its notebook button. Each page is paper (lined, dotted or plain) that you type on
   and write on by hand: pens, a highlighter and an eraser, the strokes kept in the page's own coordinates. The library
   keeps the list of notebooks and their pages; what is on each page is kept as handwriting is, on this device first and in
   paper-map-notes on GitHub, one file a page, leaving the library once GitHub has it. */
const NBK = {id: null, page: 0, tool: 'text', color: 0, dock: false, cur: null, lastPen: 0};
const NBK_COVERS = ['#3E5A4A', '#7A2E1F', '#2E4560', '#6B5A3A', '#4A3B5C', '#1F1B18'];
const NBK_PENS = ['#1F1B18', '#2346A8', '#C23A2B'];
function nbkAll(){ if(!Array.isArray(lib.journals)) lib.journals = []; if(!lib.jpages || typeof lib.jpages !== 'object') lib.jpages = {}; return lib.journals; }
function nbkGet(id){ return nbkAll().find(j => j.id === id) || null; }
function nbkNew(title){ const j = {id: 'nb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: title || 'Notebook', color: NBK_COVERS[nbkAll().length % NBK_COVERS.length], created: Date.now(), pages: []};
  lib.journals.push(j); nbkAddPage(j); touchLib(); return j; }
function nbkAddPage(j, at){ const pid = 'pg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); lib.jpages[pid] = {id: pid, jid: j.id, at: Date.now(), ink: {text: '', strokes: [], paper: (j.paper || 'lined')}};
  if(at == null) j.pages.push(pid); else j.pages.splice(at, 0, pid); return pid; }
function nbkPage(pid){ const pg = lib.jpages[pid]; if(!pg) return null; if(!pg.ink) pg.ink = pg.inkRef ? null : {text: '', strokes: [], paper: 'lined'}; return pg; }
function nbkSave(pid){ const pg = lib.jpages[pid]; if(!pg || !pg.ink) return; pg.at = Date.now(); try{ nsPut('page', pid, pg.ink); }catch(e){} touchLib(); }
/* ---- the shelf: your notebooks as covers ---- */
function nbkShelf(){ let s = document.getElementById('nbkShelf'); if(!s){ s = document.createElement('div'); s.id = 'nbkShelf'; document.body.appendChild(s);
    s.addEventListener('click', e => { const c = e.target.closest('[data-nbk]'); if(e.target.closest('.nbk-x') || e.target === s){ s.classList.remove('on'); return; }
      if(e.target.closest('[data-nbknew]')){ const t = prompt('Name the notebook', 'Notebook'); if(t == null) return; const j = nbkNew(t.trim() || 'Notebook'); s.classList.remove('on'); nbkOpen(j.id, 0, false); return; }
      if(c){ s.classList.remove('on'); nbkOpen(c.dataset.nbk, 0, false); } }); }
  const js = nbkAll(); s.innerHTML = '<div class="nbk-shelf-in"><button type="button" class="nbk-x" aria-label="Close">×</button><h2>My notebooks</h2><div class="nbk-covers">' +
    js.map(j => '<button type="button" class="nbk-cover" data-nbk="' + esc(j.id) + '" style="--c:' + esc(j.color) + '"><i class="nbk-band"></i><b>' + esc(j.title) + '</b><span>' + j.pages.length + (j.pages.length === 1 ? ' page' : ' pages') + '</span></button>').join('') +
    '<button type="button" class="nbk-cover new" data-nbknew="1"><b>+</b><span>New notebook</span></button></div></div>';
  requestAnimationFrame(() => s.classList.add('on')); }
/* ---- choosing a notebook to open beside a mind map ---- */
function nbkPicker(btn){ const js = nbkAll(), r = btn.getBoundingClientRect(); const items = js.map(j => ({label: j.title, fn: () => nbkOpen(j.id, 0, true)}));
  items.push({label: 'New notebook…', fn: () => { const t = prompt('Name the notebook', 'Notebook'); if(t == null) return; const j = nbkNew(t.trim() || 'Notebook'); nbkOpen(j.id, 0, true); }});
  openFloatMenu(r.left, r.bottom + 6, items); }
/* ---- a notebook open: a page you type on and write on ---- */
function nbkView(){ let v = document.getElementById('nbkView'); if(v) return v; v = document.createElement('div'); v.id = 'nbkView';
  v.innerHTML = '<div class="nbk-bar"><button type="button" data-nb="back" aria-label="Close">‹</button><input class="nbk-title" spellcheck="false" aria-label="Notebook name"><i></i>' +
    '<button type="button" data-nb="prev" aria-label="Page before">‹</button><span class="nbk-pg"></span><button type="button" data-nb="next" aria-label="Next page">›</button><button type="button" data-nb="add" aria-label="New page" title="New page">+</button><i></i>' +
    '<button type="button" data-nb="text" title="Type">T</button><button type="button" data-nb="pen" title="Pen">✎</button><button type="button" data-nb="hl" title="Highlighter">▍</button><button type="button" data-nb="erase" title="Eraser">⌫</button>' +
    NBK_PENS.map((c, i) => '<button type="button" class="nbk-col" data-nbcol="' + i + '" style="--c:' + c + '" aria-label="Pen colour"></button>').join('') + '<i></i>' +
    '<button type="button" data-nb="paper" title="Paper">≡</button><button type="button" data-nb="del" title="Remove this page">🗑</button><button type="button" data-nb="full" title="Full page or beside the map">⤢</button></div>' +
    '<div class="nbk-stage"><div class="nbk-page"><div class="nbk-text" contenteditable="true" spellcheck="true" data-ph="Write here, or pick up a pen"></div><svg class="nbk-ink" viewBox="0 0 1000 1414" preserveAspectRatio="none"></svg></div></div>';
  document.body.appendChild(v);
  v.addEventListener('click', e => { const b = e.target.closest('[data-nb]'), c = e.target.closest('[data-nbcol]'); if(c){ NBK.color = +c.dataset.nbcol; if(NBK.tool === 'text' || NBK.tool === 'erase') NBK.tool = 'pen'; nbkTools(); return; } if(!b) return; const k = b.dataset.nb, j = nbkGet(NBK.id); if(!j) return;
    if(k === 'back'){ nbkClose(); } else if(k === 'prev'){ nbkTurn(-1); } else if(k === 'next'){ nbkTurn(1); } else if(k === 'add'){ nbkCommitText(); nbkAddPage(j, NBK.page + 1); touchLib(); nbkTurn(1); }
    else if(k === 'paper'){ const pg = nbkPage(j.pages[NBK.page]); if(!pg || !pg.ink) return; const ord = ['lined', 'dots', 'blank']; pg.ink.paper = ord[(ord.indexOf(pg.ink.paper || 'lined') + 1) % 3]; j.paper = pg.ink.paper; nbkSave(j.pages[NBK.page]); nbkDraw(); }
    else if(k === 'del'){ if(j.pages.length < 2){ toast('A notebook keeps at least one page'); return; } if(!confirm('Remove this page?')) return; const pid = j.pages.splice(NBK.page, 1)[0]; delete lib.jpages[pid]; NBK.page = Math.min(NBK.page, j.pages.length - 1); touchLib(); nbkDraw(); }
    else if(k === 'full'){ NBK.dock = !NBK.dock; v.classList.toggle('dock', NBK.dock); document.body.classList.toggle('nbk-docked', NBK.dock); }
    else { NBK.tool = k; nbkTools(); } });
  v.querySelector('.nbk-title').addEventListener('change', e => { const j = nbkGet(NBK.id); if(j){ j.title = e.target.value.trim() || 'Notebook'; touchLib(); } });
  const tx = v.querySelector('.nbk-text'); let tT = 0; tx.addEventListener('input', () => { clearTimeout(tT); tT = setTimeout(nbkCommitText, 500); }); tx.addEventListener('blur', nbkCommitText);
  nbkInkWire(v.querySelector('.nbk-ink')); return v; }
function nbkTools(){ const v = nbkView(); v.querySelectorAll('[data-nb="text"],[data-nb="pen"],[data-nb="hl"],[data-nb="erase"]').forEach(b => b.classList.toggle('on', b.dataset.nb === NBK.tool));
  v.querySelectorAll('[data-nbcol]').forEach(b => b.classList.toggle('on', +b.dataset.nbcol === NBK.color)); v.classList.toggle('inking', NBK.tool !== 'text'); }
function nbkOpen(id, page, dock){ const j = nbkGet(id); if(!j) return; NBK.id = id; NBK.page = Math.max(0, Math.min(page || 0, j.pages.length - 1)); NBK.dock = !!dock; const v = nbkView(); v.classList.toggle('dock', NBK.dock); v.classList.add('on'); document.body.classList.add('nbk-open'); document.body.classList.toggle('nbk-docked', NBK.dock); nbkTools(); nbkDraw(); }
function nbkClose(){ nbkCommitText(); const v = document.getElementById('nbkView'); if(v) v.classList.remove('on'); document.body.classList.remove('nbk-open', 'nbk-docked'); NBK.id = null; }
function nbkCommitText(){ const j = nbkGet(NBK.id), v = document.getElementById('nbkView'); if(!j || !v) return; const pid = j.pages[NBK.page], pg = nbkPage(pid); if(!pg || !pg.ink) return; const html = v.querySelector('.nbk-text').innerHTML; if(pg.ink.text === html) return; pg.ink.text = html; nbkSave(pid); }
function nbkTurn(d){ const j = nbkGet(NBK.id); if(!j) return; const n = NBK.page + d; if(n < 0 || n >= j.pages.length) return; nbkCommitText(); const P = nbkView().querySelector('.nbk-page');
  P.animate([{transform: 'translateX(0)', opacity: 1}, {transform: 'translateX(' + (d > 0 ? -36 : 36) + 'px)', opacity: 0}], {duration: 160, easing: 'ease-in'}).finished.then(() => { NBK.page = n; nbkDraw(); P.animate([{transform: 'translateX(' + (d > 0 ? 36 : -36) + 'px)', opacity: 0}, {transform: 'translateX(0)', opacity: 1}], {duration: 200, easing: 'ease-out'}); }); }
function nbkDraw(){ const j = nbkGet(NBK.id), v = nbkView(); if(!j) return; const pid = j.pages[NBK.page], pg = nbkPage(pid);
  v.querySelector('.nbk-title').value = j.title; v.querySelector('.nbk-pg').textContent = (NBK.page + 1) + ' / ' + j.pages.length; v.style.setProperty('--cover', j.color);
  const tx = v.querySelector('.nbk-text'), svg = v.querySelector('.nbk-ink'), P = v.querySelector('.nbk-page');
  if(!pg || !pg.ink){ tx.innerHTML = ''; svg.innerHTML = ''; P.classList.add('loading'); try{ nsHydrate(); }catch(e){} return; } P.classList.remove('loading');
  P.dataset.paper = pg.ink.paper || 'lined'; if(document.activeElement !== tx) tx.innerHTML = pg.ink.text || '';
  svg.innerHTML = (pg.ink.strokes || []).map(s => '<path d="' + mmInkD(s) + '" fill="' + esc(s.c) + '"' + (s.h ? ' opacity=".38" style="mix-blend-mode:multiply"' : '') + '/>').join(''); }
/* handwriting on the page: in the page's own coordinates (1000 across), pen pressure when there is one; with a pencil in use,
   fingers scroll and do not draw */
function nbkInkWire(svg){ const toP = e => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 1000, (e.clientY - r.top) / r.height * 1414, e.pressure || .5]; };
  svg.addEventListener('pointerdown', e => { if(NBK.tool === 'text') return; if(e.pointerType === 'pen') NBK.lastPen = Date.now(); if(e.pointerType === 'touch' && Date.now() - NBK.lastPen < 60000) return;
    const j = nbkGet(NBK.id), pg = j && nbkPage(j.pages[NBK.page]); if(!pg || !pg.ink) return; e.preventDefault(); svg.setPointerCapture(e.pointerId);
    if(NBK.tool === 'erase'){ NBK.cur = {erase: true}; nbkErase(pg, toP(e)); return; }
    const hl = NBK.tool === 'hl'; NBK.cur = {c: hl ? '#F2CF57' : NBK_PENS[NBK.color], w: hl ? 22 : 2.6, h: hl ? 1 : 0, b: hl ? 'hl' : 'fountain', p: toP(e)};
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path'); el.setAttribute('fill', NBK.cur.c); if(hl){ el.setAttribute('opacity', '.38'); el.style.mixBlendMode = 'multiply'; } svg.appendChild(el); NBK.cur.el = el; });
  svg.addEventListener('pointermove', e => { const c = NBK.cur; if(!c) return; const j = nbkGet(NBK.id), pg = j && nbkPage(j.pages[NBK.page]); if(!pg) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if(c.erase){ evs.forEach(x => nbkErase(pg, toP(x))); return; } evs.forEach(x => c.p.push(...toP(x))); c.el.setAttribute('d', mmInkD(c)); });
  const end = () => { const c = NBK.cur; NBK.cur = null; if(!c) return; const j = nbkGet(NBK.id), pid = j && j.pages[NBK.page], pg = pid && nbkPage(pid); if(!pg || !pg.ink) return;
    if(!c.erase && c.p.length >= 6){ const s = {c: c.c, w: c.w, h: c.h, b: c.b, p: c.p.map(v => Math.round(v * 10) / 10)}; pg.ink.strokes = (pg.ink.strokes || []).concat([s]); }
    nbkSave(pid); nbkDraw(); };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end); }
function nbkErase(pg, q){ const before = (pg.ink.strokes || []).length; pg.ink.strokes = (pg.ink.strokes || []).filter(s => { for(let i = 0; i < s.p.length; i += 3) if(Math.hypot(s.p[i] - q[0], s.p[i + 1] - q[1]) < 18) return false; return true; });
  if(pg.ink.strokes.length !== before) nbkDraw(); }
Object.assign(window, {nbkShelf, nbkOpen, nbkNew, nbkPicker, nbkClose, nbkAll});
