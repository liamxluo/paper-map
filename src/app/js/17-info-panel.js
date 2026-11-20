/* ===================== info panel ===================== */
function relChip(oid){
  const o = lib.entries[oid];
  if(!o) return '';
  if(o.kind === 'concept') return '<button type="button" class="relchip pre" data-select="' + oid + '">' + esc(o.short || o.t) + '</button>';
  return '<button type="button" class="relchip" data-select="' + oid + '">' + esc(mapLabel(o)) + ' ' + esc(o.y) + '</button>';
}
function group(title, ids){ ids = ids.filter(x => lib.entries[x]); return ids.length ? '<p class="rel"><span class="rel-k">' + title + '</span>' + ids.map(relChip).join('') + '</p>' : ''; }
function branchChip(bid){ const b = lib.branches.find(x => x.id === bid); return b ? '<button type="button" class="br-chip" data-branch-focus="' + b.id + '" style="--br:' + b.color + '"><i aria-hidden="true"></i>' + esc(b.name) + '</button>' : ''; }
function setShowRelated(on){
  settings.showRelated = on; persistSettings({remote:false});
  renderMap(true); infoEl.innerHTML = ui.branch ? branchInfoHTML(ui.branch) : infoHTML(ui.selected); applyFocus(ui.selected);
  toast(on ? 'Related-to lines shown' : 'Related-to lines hidden');
}
function hfBarHTML(id){
  let h = '';
  {
    const F = focusSets(id);
    const lit = [...F.nodes].filter(x => x !== id && lib.entries[x]);
    const np = lit.filter(x => lib.entries[x].kind !== 'concept').length, nc = lit.length - np;
    const dir = settings.focusDir || 'all', open = !!settings.hfOpen;
    const DIRS = [['all', 'All ways', 'Every connection, in any direction: the whole pipeline'], ['up', 'Earlier only', 'Only what it builds on, and what those build on'], ['down', 'Later only', 'Only what builds on it, and what builds on those'], ['lineage', 'Earlier + later', 'Back and forward in time, without turning into side branches']];
    const hasR = lib.links.some(l => l[2] === 'r');
    const DEPTHS = [[1, '1 step'], [2, '2 steps'], [3, '3 steps'], ['all', 'Whole line']];
    const curDepth = (DEPTHS.find(o => String(o[0]) === String(ui.depth)) || DEPTHS[0])[1];
    const countTxt = np + (np === 1 ? ' paper' : ' papers') + (nc ? ', ' + nc + (nc === 1 ? ' concept' : ' concepts') : '');
    h += '<div class="rel depth-ctl"><span class="rel-k">How far</span>' + DEPTHS.map(o => '<button type="button" class="dchip' + (String(ui.depth) === String(o[0]) ? ' on' : '') + '" data-depth="' + o[0] + '">' + o[1] + '</button>').join('') +
      '<span class="hf-count" title="How much is lit up now">' + np + (np === 1 ? ' paper' : ' papers') + (nc ? ', ' + nc + (nc === 1 ? ' concept' : ' concepts') : '') + '</span>' +
      '<button type="button" class="hf-more' + (dir !== 'all' || (hasR && settings.showRelated === false) ? ' changed' : '') + '" data-hf-open="1" aria-expanded="' + open + '" title="Direction and Related-to lines">' + (dir !== 'all' ? esc(DIRS.find(d => d[0] === dir)[1]) : 'Options') + ' <span aria-hidden="true">' + (open ? '▴' : '▾') + '</span></button>' +
      '<div class="hf-opts"' + (open ? '' : ' hidden') + '><span class="hf-k">Direction</span>' + DIRS.map(d => '<button type="button" class="dchip small' + (dir === d[0] ? ' on' : '') + '" data-hf-dir="' + d[0] + '" title="' + esc(d[2]) + '">' + d[1] + '</button>').join('') +
      (hasR ? '<span class="dsep" aria-hidden="true"></span><button type="button" class="dchip small rel-toggle' + (settings.showRelated !== false ? ' on' : '') + '" data-rel-toggle="1" aria-pressed="' + (settings.showRelated !== false) + '" title="Show or hide the dotted Related-to lines"' + (dir !== 'all' ? ' disabled' : '') + '><svg width="18" height="6" aria-hidden="true"><line x1="1" y1="3" x2="17" y2="3"></line></svg>Related to</button>' : '') +
      '</div></div>';
  }
  return h;
}
function renderHfBar(){
  const el = document.getElementById('hfBar'); if(!el) return;
  const id = ui.selected, e = id && lib.entries[id];
  const has = !!(e && (lib.links.some(l => l[0] === id || l[1] === id) || (e.needs || []).length));
  el.hidden = !has; el.innerHTML = has ? hfBarHTML(id) + '<button type="button" class="dchip lens-btn" data-open-lens="' + id + '" title="See its line of thought laid out (L)">Lens</button>' : '';
}
function refreshInfo(){ infoEl.innerHTML = infoHTML(ui.selected); infoEl.classList.toggle('has-sel', !!ui.selected); renderHfBar(); if(bigCard) refreshBigCard(); }
function focusNoteHTML(id){
  const R = branchesNear(id);
  let h = '';
  if(R.own.length) h += '<p class="rel"><span class="rel-k">On colour lines</span>' + R.own.map(branchChip).join('') + '</p>';
  else if(R.reach.length) h += '<p class="rel"><span class="rel-k">Leads to colour lines</span>' + R.reach.map(branchChip).join('') + '</p>';
  return h;
}
function branchInfoHTML(bid){
  const b = lib.branches.find(x => x.id === bid); if(!b) return infoHTML(null);
  const ids = new Set(); (IDX.branchLines[bid] || []).forEach(k => { const [x, y] = k.split('|'); ids.add(x); ids.add(y); });
  const es = [...ids].map(i => lib.entries[i]).filter(Boolean).sort(byYear);
  const tls = branchTlinks(bid);
  return '<div class="info-grid"><p class="info-year"><span class="br-dot" style="--br:' + b.color + '"></span></p><div><p class="info-meta">Colour line</p><h3 class="info-title">' + esc(b.name) + '</h3>' +
    (es.length ? '<p class="rel"><span class="rel-k">' + es.length + ' on it</span>' + es.map(e => relChip(e.id)).join('') + '</p>' : '') +
    (tls.length ? '<p class="rel"><span class="rel-k">Topics</span>' + tls.map(l => '<button type="button" class="relchip" data-view="' + esc(topicNodeView(l[0])) + '">' + esc(topicNodeName(l[0])) + '</button><span class="hint">⇄</span><button type="button" class="relchip" data-view="' + esc(topicNodeView(l[1])) + '">' + esc(topicNodeName(l[1])) + '</button>').join('<span class="hint"> · </span>') + '</p>' : '') +
    (!es.length && !tls.length ? '<p class="hint">Nothing uses it yet: choose it in a line’s or a related topic’s ✎.</p>' : '') +
    '<p class="info-actions"><button type="button" class="btn" data-branch-edit="' + b.id + '">Rename or recolour</button><button type="button" class="btn" data-branch-hide="' + b.id + '">Hide on the map</button><button type="button" class="linkbtn" data-branch-manage="1">All colour lines</button><button type="button" class="linkbtn" data-clear-sel="1">Clear</button></p></div></div>';
}
function focusBranch(bid){ ui.selected = null; ui.branch = bid; renderMap(true); mapSvg.querySelectorAll('.node.sel').forEach(n => n.classList.remove('sel')); infoEl.innerHTML = branchInfoHTML(bid); applyFocus(null); renderBranchRow(); }
document.addEventListener('dblclick', ev => { const c = ev.target.closest('#branchRow [data-branch-focus]'); if(c){ ev.preventDefault(); openBranchForm(c.dataset.branchFocus); } });
function renderBranchRow(){
  const row = document.getElementById('branchRow'); if(!row) return;
  const used = lib.branches.filter(b => branchUses(b.id) && !brHidden(b.id));
  row.hidden = !used.length;
  /* keep the same buttons when nothing about them changed, so a double-click lands on one button */
  const sig = used.map(b => b.id + ':' + b.name + ':' + b.color).join('|');
  if(row.dataset.sig !== sig){ row.dataset.sig = sig; row.innerHTML = used.map(b => branchChip(b.id)).join(''); }
  const mb = document.getElementById('btnBranches');
  if(mb){ const h = lib.branches.filter(b => brHidden(b.id)).length; mb.textContent = 'Colour lines' + (h ? ' · ' + h + ' hidden' : ''); mb.classList.toggle('has-hidden', !!h); }
  row.querySelectorAll('.br-chip').forEach(c => c.classList.toggle('on', c.dataset.branchFocus === ui.branch));
}
document.addEventListener('click', ev => {
  const be = ev.target.closest('[data-branch-edit]'); if(be){ openBranchForm(be.dataset.branchEdit); return; }
  if(ev.target.closest('#btnExport')){ const m = document.getElementById('exportMenu'), btn = document.getElementById('btnExport'); m.hidden = !m.hidden; btn.setAttribute('aria-expanded', String(!m.hidden)); return; }
  const ek = ev.target.closest('[data-export-kind]'); if(ek){ document.getElementById('exportMenu').hidden = true; document.getElementById('btnExport').setAttribute('aria-expanded', 'false'); if(ek.dataset.exportKind === 'map') openExport(); else if(ek.dataset.exportKind === 'both') openExport({list: true, format: 'pdf'}); else openListExport(); return; }
  if(!ev.target.closest('.export-wrap')){ const m = document.getElementById('exportMenu'); if(m && !m.hidden){ m.hidden = true; document.getElementById('btnExport').setAttribute('aria-expanded', 'false'); } }
  const lx = ev.target.closest('[data-export-papers]'); if(lx){ openListExport(lx.dataset.exportPapers); return; }
  const xp = ev.target.closest('[data-export-paper]'); if(xp){ openExport({mode: 'paper', paper: xp.dataset.exportPaper}); return; }
  if(ev.target.closest('#setPapersExport')){ closeModal(); setTimeout(() => openListExport(), 0); return; }
  const stb = ev.target.closest('[data-sync-tab]'); if(stb){ const root = stb.closest('.sync-section'); root.querySelectorAll('[data-sync-tab]').forEach(x => x.setAttribute('aria-selected', String(x === stb))); root.querySelectorAll('[data-sync-pane]').forEach(p => { p.hidden = p.dataset.syncPane !== stb.dataset.syncTab; }); return; }
  if(ev.target.closest('[data-fs-connect]')){ closeModal(); fsConnect(); return; }
  if(ev.target.closest('[data-fs-reconnect]')){ const tt = document.getElementById('toast'); if(tt) tt.hidden = true; closeModal(); fsReconnect(); return; }
  if(ev.target.closest('[data-sync-pull]')){ closeModal(); ghPullNow(); return; }
  if(ev.target.closest('[data-sync-save]')){ const c = ghCfg(); if(!c) return; c.dirty = true; ghStore(c); gh.rev++; ghSave(); toast('Saving to ' + syncName()); return; }
  if(ev.target.closest('[data-sync-history]')){ closeModal(); ghHistory(); return; }
  if(ev.target.closest('[data-sync-forget]')){ const n = syncName(); syncForget(); closeModal(); toast('Disconnected from ' + n + '. Your list stays in this browser.'); return; }
  if(ev.target.closest('#setMapExport')){ closeModal(); setTimeout(openExport, 0); return; }
  if(ev.target.closest('#setPapersImport, [data-start-import]')){ closeModal(); setTimeout(openImport, 0); return; }
  if(ev.target.closest('[data-token-help]')){ const tt = document.getElementById('toast'); if(tt) tt.hidden = true; closeModal(); openTokenHelp(); return; }
  if(ev.target.closest('[data-token-date]')){ closeModal(); openTokenDate(); return; }
  if(ev.target.closest('#btnBranches, [data-branch-manage], #setBrManage')){ if(ev.target.closest('#setBrManage')) closeModal(); openBranchManager(); return; }
  const bh = ev.target.closest('[data-branch-hide]'); if(bh){ setBranchHidden(bh.dataset.branchHide, true); toast('Hidden on the map. Show it again from Colour lines.'); return; }
  const bf = ev.target.closest('[data-branch-focus]'); if(bf){ ev.preventDefault(); if(ui.branch === bf.dataset.branchFocus){ ui.branch = null; select(null); renderMap(true); renderBranchRow(); } else focusBranch(bf.dataset.branchFocus); return; }
  const rt = ev.target.closest('[data-rel-toggle]'); if(rt){ setShowRelated(settings.showRelated === false); return; }
  const ho = ev.target.closest('[data-hf-open]'); if(ho){ settings.hfOpen = !settings.hfOpen; persistSettings({remote:false}); refreshInfo(); return; }
  const hd = ev.target.closest('[data-hf-dir]'); if(hd){ settings.focusDir = hd.dataset.hfDir; persistSettings({remote:false}); refreshInfo(); applyFocus(ui.selected); return; }
  const dp = ev.target.closest('[data-depth]'); if(dp){ ui.depth = dp.dataset.depth === 'all' ? 'all' : +dp.dataset.depth; settings.focusDepth = ui.depth; persistSettings({remote:false}); refreshInfo(); applyFocus(ui.selected); }
});
/* a paper's lines, folded: one line per related paper, with its note in full */
function linesFoldHTML(id, e){
  const up = IDX.up[id] || [], down = IDX.down[id] || [], rows = [];
  const keyOfLine = (a, b, t) => { const l = lib.links.find(l => l[2] === t && ((l[0] === a && l[1] === b) || (t === 'r' && l[0] === b && l[1] === a))); return l ? l[0] + '|' + l[1] + '|' + l[2] : ''; };
  const add = (label, arr, mk) => arr.filter(x => lib.entries[x[0]]).forEach(x => rows.push({label, id: x[0], note: x[2] || '', key: mk(x)}));
  add('Builds on', up.filter(x => x[1] === 'b'), x => keyOfLine(x[0], id, 'b'));
  add('Responds to', up.filter(x => x[1] === 'c'), x => keyOfLine(x[0], id, 'c'));
  add('Built on by', down.filter(x => x[1] === 'b'), x => keyOfLine(id, x[0], 'b'));
  add('Challenged by', down.filter(x => x[1] === 'c'), x => keyOfLine(id, x[0], 'c'));
  add('Related to', up.filter(x => x[1] === 'r').concat(down.filter(x => x[1] === 'r')), x => keyOfLine(x[0], id, 'r'));
  (e.needs || []).filter(c => lib.entries[c]).forEach(c => rows.push({label: 'Needs', id: c, note: ''}));
  if(!rows.length) return '';
  const counts = {}; rows.forEach(r => { counts[r.label] = (counts[r.label] || 0) + 1; });
  const sum = Object.entries(counts).map(([k, n]) => n + ' ' + k.toLowerCase()).join(' · ');
  return '<details class="rel-fold" data-rel-fold="1"' + (settings.relOpen ? ' open' : '') + '><summary><span class="rel-k">Lines</span><span class="rel-sum">' + esc(sum) + '</span></summary><ul class="rel-list">' +
    rows.map(r => { const o = lib.entries[r.id]; return '<li><span class="rl-k">' + r.label + '</span><span class="rl-main"><button type="button" class="rl-t" data-select="' + r.id + '" title="' + esc(o.t) + '">' + esc(o.kind === 'concept' ? (o.short || o.t) : (o.au ? shortAu(o.au) + ' · ' : '') + o.t) + '</button>' + (r.note ? '<span class="rl-note">' + esc(r.note) + '</span>' : '') + '</span><span class="rl-y">' + esc(o.y || '') + '</span>' + (r.key ? '<span class="rl-act"><button type="button" data-link-note="' + esc(r.key) + '" title="Note and colour" aria-label="Note and colour of this line">✎</button><button type="button" data-link-del="' + esc(r.key) + '" title="Remove this line" aria-label="Remove this line">×</button></span>' : '') + '</li>'; }).join('') +
    '</ul></details>';
}
function relGroup(title, items){
  items = items.filter(x => lib.entries[x[0]]);
  return items.length ? '<p class="rel"><span class="rel-k">' + title + '</span>' + items.map(x => relChip(x[0]) + (x[2] ? '<span class="rel-note">' + esc(x[2]) + '</span>' : '')).join('') + '</p>' : '';
}
function infoHTML(id){
  const e = id && lib.entries[id];
  if(!e) return '<p class="info-empty">Click a dot to see its card here; double-click it to link it to another paper.</p>';
  const tp = IDX.topics[e.topic], s = IDX.subs[e.sub];
  const place = e.kind === 'concept' ? 'Concept' : esc(tp ? tp.name : '') + (s && !s.hidden ? ' / ' + esc(s.name) : '');
  if(e.kind === 'concept'){
    const users = (IDX.users[e.id] || []).map(i => lib.entries[i]).sort(byYear).map(u => u.id);
    const d = conceptDone(e);
    return '<div class="info-grid"><p class="info-year">' + esc(e.y) + '</p><div>' +
      '<p class="info-au">' + place + (d[1] ? ' · readings read ' + d[0] + ' / ' + d[1] : '') + '</p>' +
      '<p class="info-t">' + esc(e.t) + '</p>' +
      (e.what ? '<p class="info-f">' + esc(e.what) + '</p>' : '') + (e.why ? '<p class="info-note">' + esc(e.why) + '</p>' : '') +
      group('Prerequisites', IDX.cUp[e.id] || []) + group('Next', IDX.cDown[e.id] || []) + group('Papers that use it', users) +
      relGroup('Builds on', (IDX.up[e.id] || []).filter(x => x[1] === 'b')) + relGroup('Responds to', (IDX.up[e.id] || []).filter(x => x[1] === 'c')) +
      relGroup('Built on by', (IDX.down[e.id] || []).filter(x => x[1] === 'b')) + relGroup('Challenged by', (IDX.down[e.id] || []).filter(x => x[1] === 'c')) +
      relGroup('Related to', (IDX.up[e.id] || []).filter(x => x[1] === 'r').concat((IDX.down[e.id] || []).filter(x => x[1] === 'r'))) +
      (ui.edit ? editLinksHTML(e.id) + '<p class="info-actions"><button type="button" class="btn" data-link-add="b" data-id="' + e.id + '">+ It builds on…</button><button type="button" class="btn" data-link-add="c" data-id="' + e.id + '">+ It responds to…</button><button type="button" class="btn" data-link-add="r" data-id="' + e.id + '">+ Related to…</button></p>' : '') +
      '<p class="info-actions"><button type="button" class="linkbtn" data-card="' + e.id + '">Readings</button><button type="button" class="linkbtn" data-reader="' + e.id + '">Notes</button><button type="button" class="linkbtn" data-clear-sel="1">Clear selection</button></p></div></div>';
  }
  return smallCardHTML(e) + citesHintHTML(e) + focusNoteHTML(id);
}
function infoTagsHTML(e){
  if(ui.edit) return '<p class="rel"><span class="rel-k">Tags</span>' + lib.tags.map(x => tagToggle(x, (e.tags || []).includes(x.id), 'data-tagtoggle')).join('') + '<button type="button" class="linkbtn" data-act="tags">Manage tags</button></p>';
  const ts = tagsOf(e);
  return ts.length ? '<p class="rel"><span class="rel-k">Tags</span>' + ts.map(tagChip).join('') + '</p>' : '';
}
function editLinksHTML(id){
  const L = lib.links.filter(l => (l[0] === id || l[1] === id) && l[2] !== 'o' && lib.entries[l[0]] && lib.entries[l[1]]);
  if(!L.length) return '';
  return '<p class="rel"><span class="rel-k">Lines</span>' + L.map(l => {
    const other = lib.entries[l[0] === id ? l[1] : l[0]];
    const rel = l[2] === 'r' ? 'Related to' : l[0] === id ? (l[2] === 'c' ? 'Challenged by' : 'Built on by') : (l[2] === 'c' ? 'Responds to' : 'Builds on');
    const key = esc(l[0] + '|' + l[1] + '|' + l[2]);
    return '<span class="pick">' + esc(rel + ': ' + mapLabel(other) + ' ' + other.y) + (l[3] ? ' · <em>' + esc(l[3]) + '</em>' : '') + '<button type="button" data-link-note="' + key + '" aria-label="Note and colour of this line" title="Note and colour">✎</button><button type="button" data-link-del="' + key + '" aria-label="Delete this line">×</button></span>';
  }).join('') + '</p>';
}
function branchListHTML(){
  if(!lib.branches.length) return '<p class="hint">No colour lines yet.</p>';
  return lib.branches.map(x => '<div class="br-set" data-br-row="' + x.id + '"><input type="color" value="' + x.color + '" aria-label="Colour"><input type="text" value="' + esc(x.name) + '" maxlength="40" aria-label="Name"><span class="hint">' + (IDX.branchLines[x.id] || []).length + ' lines</span><button type="button" class="linkbtn danger" data-br-del="' + x.id + '">Remove</button></div>').join('');
}
function brHidden(bid){ return !!bid && (settings.hiddenBranches || []).includes(bid); }
function lineHidden(a, b, t){ return brHidden(lib.lineBranch[a + '|' + b + '|' + t]); }
function setBranchHidden(bid, hide){
  const s = new Set(settings.hiddenBranches || []); if(hide) s.add(bid); else s.delete(bid);
  settings.hiddenBranches = [...s]; persistSettings({remote:false});
  if(hide && ui.branch === bid){ ui.branch = null; }
  renderMap(true); infoEl.innerHTML = ui.branch ? branchInfoHTML(ui.branch) : infoHTML(ui.selected); applyFocus(ui.selected);
}
function branchTlinks(bid){ return (lib.tlinks || []).filter(l => (lib.tlinkColor || {})[l[0] + '|' + l[1]] === bid); }
function branchUses(bid){ return (IDX.branchLines[bid] || []).length + Object.values(lib.tlinkColor || {}).filter(v => v === bid).length; }
function swatchesHTML(cur, idSuffix){
  return '<div class="swatches" data-swatches="' + idSuffix + '">' + BRANCH_PALETTE.map(c => '<button type="button" class="sw' + (String(cur).toLowerCase() === c.toLowerCase() ? ' on' : '') + '" data-sw="' + c + '" style="--c:' + c + '" aria-label="Colour ' + c + '" title="' + c + '"></button>').join('') +
    '<label class="sw-other">Other<input type="color" class="sw-input" value="' + (HEX_RE.test(cur) ? cur : BRANCH_PALETTE[0]) + '" aria-label="Pick any colour"></label></div>';
}
function bindSwatches(box){
  box.querySelectorAll('[data-swatches]').forEach(sw => {
    const input = sw.querySelector('.sw-input');
    sw.addEventListener('click', ev => { const b = ev.target.closest('[data-sw]'); if(!b) return; input.value = b.dataset.sw; sw.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === b)); });
    input.addEventListener('input', () => sw.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x.dataset.sw.toLowerCase() === input.value.toLowerCase())));
  });
}
function openBranchForm(bid, back){
  const b = lib.branches.find(x => x.id === bid); if(!b) return;
  const n = branchUses(bid);
  openModal({
    title: 'Colour line',
    onClose: back ? () => setTimeout(back, 0) : null,
    body: '<div class="form-grid"><label class="full">Name<input type="text" id="bfName" maxlength="40" value="' + esc(b.name) + '"></label>' +
      '<div class="full"><span class="field-k">Colour</span>' + swatchesHTML(b.color, 'bf') + '</div>' +
      '<p class="hint full">' + n + (n === 1 ? ' line uses' : ' lines use') + ' this colour line. A new name or colour changes all of them.</p>' +
      '<p class="full"><button type="button" class="linkbtn danger" data-bf-remove="1">Remove this colour line</button><span class="hint"> · its lines stay, without a colour</span></p></div>',
    actions: [{label:'Cancel'}, {label:'Save', primary:true, onClick: bd => {
      const name = bd.querySelector('#bfName').value.trim(), col = bd.querySelector('[data-swatches="bf"] .sw-input').value;
      if(!name){ bd.querySelector('#bfName').focus(); return false; }
      const before = clone(lib);
      b.name = name.slice(0, 40); if(HEX_RE.test(col)) b.color = col;
      reindex(); touchLib([]); renderMap(true); renderMain();
      infoEl.innerHTML = ui.branch ? branchInfoHTML(ui.branch) : infoHTML(ui.selected); applyFocus(ui.selected);
      toast('Saved “' + b.name + '”', () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
    }}],
    onOpen: bd => {
      bindSwatches(bd);
      bd.querySelector('[data-bf-remove]').addEventListener('click', () => {
        const before = clone(lib);
        lib.branches = lib.branches.filter(x => x.id !== bid);
        if(ui.branch === bid) ui.branch = null;
        reindex(); touchLib([]); closeModal(); renderAll();
        toast('Removed colour line “' + b.name + '”', () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
      });
    }
  });
}
function appSectionHTML(){
  let body;
  if(STANDALONE) body = '<p class="hint">You are using Paper Map as an app. It opens in its own window and works offline; your list is saved in this app and, if you connect sync, there too.</p>';
  else if(!SERVED) body = '<p class="hint">This copy is a file on your computer. To install Paper Map as an app, open its website with <b>?app</b> at the end (the README links to it) and install it from there.</p>';
  else body = '<div class="set-actions"><button type="button" class="btn primary" id="setInstall">Install Paper Map</button></div>' +
    '<p class="hint">It opens in its own window, with its own icon, and works offline. The app keeps its own copy of your list: connect sync, or export a backup here and import it there, to bring your papers across.</p>';
  return '<div class="set-section"><h3>App</h3>' + body + '</div>';
}
function branchManagerHTML(){
  const rows = lib.branches.map(b => {
    const lines = (IDX.branchLines[b.id] || []), tls = branchTlinks(b.id), hid = brHidden(b.id);
    const count = [lines.length ? lines.length + (lines.length === 1 ? ' line' : ' lines') : '', tls.length ? tls.length + (tls.length === 1 ? ' topic link' : ' topic links') : ''].filter(Boolean).join(' · ') || 'not used yet';
    const conns = lines.map(k => { const [a, c, ty] = k.split('|'), A = lib.entries[a], C = lib.entries[c]; if(!A || !C) return '';
        return '<li><button type="button" class="linkbtn" data-bm-pick="' + c + '">' + esc(mapLabel(C) + ' ' + (C.y || '')) + '</button> <span class="hint">' + (ty === 'r' ? 'is related to' : ty === 'c' ? 'responds to' : 'builds on') + '</span> <button type="button" class="linkbtn" data-bm-pick="' + a + '">' + esc(mapLabel(A) + ' ' + (A.y || '')) + '</button></li>'; }).join('') +
      tls.map(l => '<li><button type="button" class="linkbtn" data-bm-view="' + esc(topicNodeView(l[0])) + '">' + esc(topicNodeName(l[0])) + '</button> <span class="hint">⇄</span> <button type="button" class="linkbtn" data-bm-view="' + esc(topicNodeView(l[1])) + '">' + esc(topicNodeName(l[1])) + '</button></li>').join('');
    return '<div class="bm-row' + (hid ? ' is-hidden' : '') + '" data-bm-row="' + b.id + '">' +
      '<div class="bm-head"><span class="br-dot" style="--br:' + b.color + '"></span><b class="bm-name">' + esc(b.name) + '</b><span class="hint">' + count + (hid ? ' · hidden on the map' : '') + '</span>' +
      '<span class="bm-acts"><button type="button" class="btn small" data-bm-toggle="' + b.id + '">' + (hid ? 'Show' : 'Hide') + '</button><button type="button" class="btn small" data-bm-edit="' + b.id + '">Rename or recolour</button></span></div>' +
      (conns ? '<details class="bm-conns"><summary>What is on it</summary><ul>' + conns + '</ul></details>' : '') + '</div>';
  }).join('');
  return '<p class="hint">A colour line is a named path of ideas, such as Monetary Policy or Historical Development. Use it on lines between papers and on links between topics: open a line’s or a related topic’s ✎ and choose it. Names appear here, in panels and in tooltips, never on the map. Hiding a path only affects this device.</p>' +
    '<div class="bm-list">' + (rows || '<p class="hint">No colour lines yet.</p>') + '</div>' +
    '<div class="bm-new" hidden><div class="form-grid"><label class="full">Name<input type="text" id="bmName" maxlength="40" placeholder="Monetary Policy"></label></div><div><span class="field-k">Colour</span>' + swatchesHTML(nextBranchColor(), 'bm') + '</div><div class="set-actions"><button type="button" class="btn primary" id="bmCreate">Add it</button><button type="button" class="linkbtn" id="bmCancel">Cancel</button></div></div>' +
    '<div class="set-actions bm-add"><button type="button" class="btn" id="bmAdd">+ New colour line</button></div>';
}
function openBranchManager(){
  openModal({
    title: 'Colour lines',
    body: '<div id="bmBody">' + branchManagerHTML() + '</div>',
    actions: [{label:'Done', primary:true}],
    onOpen: bd => {
      const box = bd.querySelector('#bmBody');
      const redraw = () => { const open = [...box.querySelectorAll('details[open]')].map(d => d.closest('[data-bm-row]').dataset.bmRow); box.innerHTML = branchManagerHTML(); bindSwatches(box); open.forEach(id => { const d = box.querySelector('[data-bm-row="' + id + '"] details'); if(d) d.open = true; }); };
      bindSwatches(box);
      box.addEventListener('click', ev => {
        const tg = ev.target.closest('[data-bm-toggle]'); if(tg){ setBranchHidden(tg.dataset.bmToggle, !brHidden(tg.dataset.bmToggle)); redraw(); return; }
        const ed = ev.target.closest('[data-bm-edit]'); if(ed){ openBranchForm(ed.dataset.bmEdit, openBranchManager); return; }
        const pk = ev.target.closest('[data-bm-pick]'); if(pk){ closeModal(); select(pk.dataset.bmPick); return; }
        const vw = ev.target.closest('[data-bm-view]'); if(vw){ closeModal(); location.hash = vw.dataset.bmView; return; }
        if(ev.target.closest('#bmAdd')){ box.querySelector('.bm-new').hidden = false; box.querySelector('.bm-add').hidden = true; box.querySelector('#bmName').focus(); return; }
        if(ev.target.closest('#bmCancel')){ box.querySelector('.bm-new').hidden = true; box.querySelector('.bm-add').hidden = false; return; }
        if(ev.target.closest('#bmCreate')){
          const name = box.querySelector('#bmName').value.trim(), col = box.querySelector('[data-swatches="bm"] .sw-input').value;
          if(!name){ box.querySelector('#bmName').focus(); return; }
          const before = clone(lib);
          let id; do{ id = rid('b'); }while(lib.branches.some(x => x.id === id));
          lib.branches.push({id, name: name.slice(0, 40), color: HEX_RE.test(col) ? col : nextBranchColor()});
          reindex(); touchLib([]); renderMap(true); redraw();
          toast('Added colour line “' + name + '”', () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
        }
      });
      box.addEventListener('keydown', ev => { if(ev.key === 'Enter' && ev.target.id === 'bmName'){ ev.preventDefault(); box.querySelector('#bmCreate').click(); } });
    }
  });
}
function nextBranchColor(){ const used = new Set(lib.branches.map(b => b.color.toLowerCase())); return BRANCH_PALETTE.find(c => !used.has(c.toLowerCase())) || BRANCH_PALETTE[lib.branches.length % BRANCH_PALETTE.length]; }
function openLinkNote(a, b, ty){
  const l = lib.links.find(x => x[0] === a && x[1] === b && x[2] === ty); if(!l) return;
  const key = a + '|' + b + '|' + ty, cur = lib.lineBranch[key] || '';
  openModal({
    title:'This line',
    body:'<div class="form-grid"><label class="full">Note, shown on the map next to the line<input type="text" id="lnNote" maxlength="60" value="' + esc(l[3] || '') + '"></label>' +
      '<label class="full">Colour line<select id="lnBranch"><option value="">None: a plain line</option>' + lib.branches.map(x => '<option value="' + x.id + '"' + (x.id === cur ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '<option value="__new">New colour line…</option></select><span class="hint">Give a main line of thought its own colour. Lines of every kind can share one.</span></label>' +
      '<div class="full ln-new" hidden><label class="ln-name">Name of this colour line<input type="text" id="lnBrName" maxlength="40" placeholder="Main line"></label><div class="ln-col"><span class="field-k">Colour</span>' + swatchesHTML(nextBranchColor(), 'ln') + '</div></div></div>',
    actions:[{label:'Cancel'}, {label:'Save', primary:true, onClick: bd => {
      const before = clone(lib);
      const v = bd.querySelector('#lnNote').value.trim();
      if(v) l[3] = v; else l.length = 3;
      let bid = bd.querySelector('#lnBranch').value;
      const nm = bd.querySelector('#lnBrName').value.trim(), col = bd.querySelector('[data-swatches="ln"] .sw-input').value;
      if(bid === '__new'){
        let id; do{ id = rid('b'); }while(lib.branches.some(x => x.id === id));
        lib.branches.push({id, name: nm || 'Colour line ' + (lib.branches.length + 1), color: HEX_RE.test(col) ? col : nextBranchColor()});
        bid = id;
      }else if(bid){
        const br = lib.branches.find(x => x.id === bid);
        if(br){ if(nm) br.name = nm.slice(0, 40); if(HEX_RE.test(col)) br.color = col; }
      }
      if(bid) lib.lineBranch[key] = bid; else delete lib.lineBranch[key];
      reindex(); touchLib(); renderMap(true); refreshInfo(); applyFocus(ui.selected);
      toast('Line saved', () => { lib = before; reindex(); touchLib(); renderAll(); toast('Undone'); });
    }}],
    onOpen: b2 => {
      const sel = b2.querySelector('#lnBranch'), nw = b2.querySelector('.ln-new'), nmI = b2.querySelector('#lnBrName'), sw = b2.querySelector('[data-swatches="ln"]');
      bindSwatches(b2);
      const setCol = c => { sw.querySelector('.sw-input').value = c; sw.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x.dataset.sw.toLowerCase() === c.toLowerCase())); };
      const sync = () => {
        const v = sel.value, br = lib.branches.find(x => x.id === v);
        nw.hidden = !v;
        if(v === '__new'){ nmI.value = ''; nmI.placeholder = 'Main line'; setCol(nextBranchColor()); }
        else if(br){ nmI.value = br.name; setCol(br.color); }
      };
      sel.addEventListener('change', sync); sync();
    }
  });
}
function openLinkPicker(id, type){
  const e = lib.entries[id]; if(!e) return;
  openModal({
    title: type === 'r' ? 'What is “' + e.t + '” related to?' : (type === 'c' ? 'What does “' + e.t + '” respond to?' : 'What does “' + e.t + '” build on?'),
    body:'<div class="lk-done" id="lkDone" aria-live="polite"></div><div class="form-grid"><label class="full">Search author, title or year<input type="search" id="lkq" autocomplete="off"></label></div><div class="picker-list" id="lkList"></div><p class="hint">Click a paper or concept to link it: it moves up to “Linked”. You can link several; × unlinks one.</p>',
    actions:[{label:'Done', primary:true}],
    onOpen: b => {
      const inp = b.querySelector('#lkq'), list = b.querySelector('#lkList'), done = b.querySelector('#lkDone');
      const linkedIds = () => lib.links.filter(l => l[2] === type && (l[1] === id || (type === 'r' && l[0] === id))).map(l => l[0] === id ? l[1] : l[0]);
      const drawDone = fresh => {
        const ids = linkedIds();
        done.innerHTML = '<span class="rel-k">Linked</span>' + (ids.length ? ids.map(o => { const x = lib.entries[o]; return x ? '<span class="pick' + (o === fresh ? ' fresh' : '') + '">' + esc(x.kind === 'concept' ? x.t : mapLabel(x) + ' ' + x.y) + '<button type="button" aria-label="Unlink" data-unlink="' + o + '">×</button></span>' : ''; }).join('') : '<span class="hint">nothing yet</span>');
      };
      done.addEventListener('click', ev => {
        const u = ev.target.closest('[data-unlink]'); if(!u) return;
        const o = u.dataset.unlink, before = clone(lib);
        lib.links = lib.links.filter(l => !(l[2] === type && ((l[0] === o && l[1] === id) || (type === 'r' && l[0] === id && l[1] === o))));
        reindex(); touchLib([]); renderMap(true); refreshInfo(); applyFocus(ui.selected);
        drawDone(); draw();
        toast('Unlinked', () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
      });
      const draw = () => {
        const q = inp.value.trim().toLowerCase();
        const have = new Set(lib.links.filter(l => l[2] === type && (l[1] === id || (type === 'r' && l[0] === id))).map(l => l[0] === id ? l[1] : l[0]));
        const c = Object.values(lib.entries).filter(x => ((x.kind === 'paper' && !x.parent) || x.kind === 'concept') && x.id !== id && !have.has(x.id) && (!q || [x.y, x.au, x.t, x.short].join(' ').toLowerCase().includes(q))).sort(byYear).slice(0, 60);
        list.innerHTML = c.map(x => '<button type="button" data-pick-link="' + x.id + '">' + esc(x.kind === 'concept' ? 'Concept: ' + x.t : [x.y, shortAu(x.au)].filter(Boolean).join('  ') + ': ' + x.t) + '</button>').join('') || '<p class="hint" style="padding:.4em .6em">Nothing found.</p>';
      };
      inp.addEventListener('input', draw);
      drawDone();
      list.addEventListener('click', ev => {
        const pb = ev.target.closest('[data-pick-link]'); if(!pb) return;
        const o = lib.entries[pb.dataset.pickLink]; if(!o) return;
        const before = clone(lib);
        lib.links.push([o.id, id, type]);
        reindex(); touchLib([]);
        renderMap(true); refreshInfo(); applyFocus(ui.selected);
        inp.value = ''; draw(); drawDone(o.id); inp.focus();
        toast('Linked: ' + mapLabel(e) + (type === 'r' ? ' is related to ' : type === 'c' ? ' responds to ' : ' builds on ') + mapLabel(o), () => { lib = before; reindex(); touchLib([]); renderAll(); toast('Undone'); });
      });
      draw();
    }
  });
}
function select(id, center){
  ui.branch = null;
  ui.selected = id && lib.entries[id] ? id : null;
  if(typeof renderBranchRow === 'function') renderBranchRow();
  mapSvg.querySelectorAll('.node.sel').forEach(n => n.classList.remove('sel'));
  if(ui.selected){
    const n = mapSvg.querySelector('.node[data-id="' + ui.selected + '"]');
    if(n) n.classList.add('sel');
    if(center && MAP.P[ui.selected]){
      const px = MAP.P[ui.selected].x;
      if(px < MAP.left || px > MAP.W - 14) setRange(lib.entries[ui.selected].y - 10, lib.entries[ui.selected].y + 10);
    }
  }
  applyFocus(ui.selected);
  refreshInfo();
  if(ui.selected) revealInMap(ui.selected);
  if(typeof phonePan === 'function') phonePan();
}
function revealInMap(id){
  const p = MAP.P[id]; if(!p || mapBox.scrollHeight <= mapBox.clientHeight + 1) return;
  const view = mapBox.clientHeight - 36, top = mapBox.scrollTop;
  if(p.y < top + 20 || p.y > top + view - 20) mapBox.scrollTo({top: Math.max(0, p.y - view / 2), behavior: 'smooth'});
}
