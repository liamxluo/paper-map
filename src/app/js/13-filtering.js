/* ===================== filtering ===================== */
function matches(e){
  if(e.kind !== 'paper') return true;
  const TG = e.tags || [];
  if(ui.group && e.group !== ui.group) return false;
  if(ui.prio === '3' && e.p !== 3) return false;
  if(ui.prio === '2' && (e.p || 1) < 2) return false;
  if(ui.dom && !(e.d || []).includes(ui.dom)) return false;
  if(ui.tag && (ui.tag === '__none' ? TG.some(x => IDX.tags[x]) : !TG.includes(ui.tag))) return false;
  const st = stOf(e);
  if(ui.st === 'want' && st !== 'want') return false;
  if(ui.st === 'read' && st !== 'read') return false;
  if(ui.st === 'none' && st) return false;
  if(ui.q){
    const sub = IDX.subs[e.sub];
    const hay = [e.y, e.au, e.t, e.v, e.f, e.n, e.l, TG.map(x => (IDX.tags[x] || {}).name || '').join(' '), (e.d || []).join(' '), sub ? sub.name : ''].join(' ').toLowerCase();
    const terms = ui.q.toLowerCase().split(/\s+/).filter(Boolean);
    for(const term of terms){ if(!hay.includes(term)) return false; }
  }
  return true;
}
function listPapers(es){ return es.filter(e => e.kind === 'paper' && !e.parent); }
function subCount(s){
  const es = entriesOfSub(s.id);
  const concepts = es.filter(e => e.kind === 'concept').length;
  return concepts + listPapers(es).filter(matches).length;
}
function topicCount(tp){ return tp.subs.reduce((n, s) => n + subCount(s), 0); }
function subCountDeep(s){ return subDescendants(s.id).reduce((n, d) => n + subCount(d), subCount(s)); }
