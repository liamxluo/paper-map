/* ===================== utils ===================== */
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function debounce(fn, ms){ let t; return function(){ clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(null, a), ms); }; }
function reduceMotion(){ return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
function lsGet(k){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }catch(e){ return null; } }
function lsSet(k, v){ if(PREVIEW) return true; try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }
function textW(str, fs){ let w = 0; for(const ch of String(str)){ w += /[\u0000-\u024F\u0370-\u03FF\u2000-\u206F]/.test(ch) ? fs * 0.56 : fs; } return w; }
function surnames(au){
  return String(au || '').replace(/\s*\(eds?\.\)/gi, '').split(/\s*,\s*|\s*&\s*/).map(x => x.trim())
    .filter(x => x && !/^([A-Z]\.\s*)+$/.test(x) && !/^[A-Z]\.-[A-Z]\.$/.test(x));
}
function shortAu(au){
  const n = surnames(au);
  if(!n.length) return au || '';
  if(n.length === 1) return n[0];
  if(n.length === 2) return n[0] + ' & ' + n[1];
  return n[0] + ' et al.';
}
function shortTitle(s){ s = String(s || ''); return s.length > 44 ? s.slice(0, 42).replace(/\s+\S*$/, '') + '…' : s; }
function mapLabel(e){
  if(e.short) return e.short;
  if(e.kind === 'concept') return e.t;
  const n = surnames(e.au);
  if(!n.length) return shortTitle(e.t);
  if(n.length === 1) return n[0];
  if(n.length === 2) return n[0] + ' & ' + n[1];
  return n[0] + ' et al.';
}
function hexToRgb(h){ const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if(!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rid(prefix){ return prefix + '-' + Math.random().toString(36).slice(2, 8); }
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
const byYear = (a, b) => (a.y || 0) - (b.y || 0) || String(a.au || a.t).localeCompare(String(b.au || b.t));
