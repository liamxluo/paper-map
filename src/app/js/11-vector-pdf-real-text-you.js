let PDF_IMG_N = 0;
/* ===================== vector PDF: real text you can select and edit, and real lines ===================== */
/* Latin text uses the PDF standard fonts (Helvetica and Times, no embedding needed); Chinese and other
   characters use the standard Chinese font STSong-Light, which PDF readers supply themselves. */
const PDF_LATIN = {H: 'Helvetica', HB: 'Helvetica-Bold', HI: 'Helvetica-Oblique', HBI: 'Helvetica-BoldOblique', T: 'Times-Roman', TB: 'Times-Bold', TI: 'Times-Italic', TBI: 'Times-BoldItalic'};
const PDF_WIN = {0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
function pdfWinByte(ch){ const c = ch.codePointAt(0); if(c >= 32 && c < 127) return c; if(c >= 160 && c <= 255) return c; return PDF_WIN[c] ?? -1; }
function pdfIsSerif(family){ const first = String(family || '').split(',')[0].replace(/["']/g, '').trim(); return /serif|georgia|times|song|garamond|minion|baskerville|palatino/i.test(first) && !/sans/i.test(first); }
function pdfFontKey(family, weight, italic){ const w = parseInt(weight, 10) || (/bold/i.test(weight) ? 700 : 400); return (pdfIsSerif(family) ? 'T' : 'H') + (w >= 600 ? 'B' : '') + (italic ? 'I' : ''); }
const pdfMeasureCtx = (() => { let g = null; return () => g || (g = document.createElement('canvas').getContext('2d')); })();
function pdfCssFont(key, size){
  const fam = key[0] === 'T' ? '"Times New Roman", Times, "Liberation Serif", serif' : 'Helvetica, Arial, "Liberation Sans", sans-serif';
  return (key.includes('I') ? 'italic ' : '') + (key.includes('B') ? '700 ' : '400 ') + size + 'px ' + fam;
}
/* split text into runs the Latin font can show and runs for the Chinese font */
/* ticks and crosses come from the standard Zapf Dingbats font */
const PDF_ZD = {'✓': '3', '✔': '4', '✕': '6', '✗': '7', '✘': '8'};
function pdfRuns(text){
  const runs = []; let cur = null;
  for(const ch of String(text)){
    const zd = PDF_ZD[ch] != null, cjk = !zd && pdfWinByte(ch) < 0, kind = zd ? 'zd' : cjk ? 'cjk' : 'latin';
    if(!cur || cur.kind !== kind){ cur = {kind, cjk, zd, s: ''}; runs.push(cur); }
    cur.s += zd ? PDF_ZD[ch] : ch;
  }
  return runs;
}
function pdfRunWidth(run, key, size){
  if(run.zd) return [...run.s].length * size * 0.78;
  if(run.cjk) return [...run.s].length * size;
  const g = pdfMeasureCtx(); g.font = pdfCssFont(key, size); return g.measureText(run.s).width;
}
function pdfTextWidth(text, key, size, spacing){ const n = [...String(text)].length; return pdfRuns(text).reduce((s, r) => s + pdfRunWidth(r, key, size), 0) + (spacing || 0) * Math.max(0, n - 1); }
function pdfLatinString(s){ let o = '('; for(const ch of s){ const b = pdfWinByte(ch); const c = b < 0 ? 63 : b; if(c === 40 || c === 41 || c === 92) o += '\\' + String.fromCharCode(c); else if(c < 32 || c > 126) o += '\\' + c.toString(8).padStart(3, '0'); else o += String.fromCharCode(c); } return o + ')'; }
function pdfCjkString(s){ let o = '<'; for(const ch of s){ const c = ch.codePointAt(0); o += (c > 0xFFFF ? 0x3013 : c).toString(16).padStart(4, '0').toUpperCase(); } return o + '>'; }
function pdfNum(v){ const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); }
/* colours as CSS gives them: #hex, rgb(), rgba(), color(srgb …) */
function pdfColor(str){
  const s = String(str || '').trim();
  if(!s || s === 'none' || s === 'transparent' || s.startsWith('url(')) return null;
  let m = s.match(/^#([0-9a-f]{3,8})$/i);
  if(m){ let h = m[1]; if(h.length <= 4) h = [...h].map(c => c + c).join(''); return {r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1}; }
  m = s.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
  if(m){ const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]; return {r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a}; }
  m = s.match(/^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i);
  if(m){ const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]; return {r: +m[1], g: +m[2], b: +m[3], a}; }
  const g = pdfMeasureCtx(); g.fillStyle = '#000'; g.fillStyle = s; const v = g.fillStyle;
  if(v !== s) return pdfColor(v);
  return null;
}
/* one page being drawn */
class PdfPage{
  constructor(w, h){ this.w = w; this.h = h; this.ops = []; this.fonts = new Set(); this.gs = new Map(); }
  alpha(fa, sa){ const k = pdfNum(Math.max(0, Math.min(1, fa))) + '/' + pdfNum(Math.max(0, Math.min(1, sa))); if(k === '1/1') return; if(!this.gs.has(k)) this.gs.set(k, 'GS' + (PdfPage.gsCount = (PdfPage.gsCount || 0) + 1)); this.ops.push('/' + this.gs.get(k) + ' gs'); }
  text(str, x, y, o){
    /* o: {key, size, color:{r,g,b,a}, opacity, spacing, anchor, halo:{color,width}} ; x,y in the page's own y-down space */
    const s = String(str); if(!s.trim() || !o.color) return;
    const w = pdfTextWidth(s, o.key, o.size, o.spacing);
    let x0 = x; if(o.anchor === 'middle') x0 -= w / 2; else if(o.anchor === 'end') x0 -= w;
    const runs = pdfRuns(s), pass = (mode) => {
      let cx = x0;
      runs.forEach(r => {
        const f = r.zd ? 'ZD' : r.cjk ? 'FC' : o.key; this.fonts.add(f);
        this.ops.push('BT /' + f + ' ' + pdfNum(o.size) + ' Tf ' + (o.spacing ? pdfNum(o.spacing) + ' Tc ' : '0 Tc ') + mode + ' Tr 1 0 0 -1 ' + pdfNum(cx) + ' ' + pdfNum(y) + ' Tm ' + (r.cjk ? pdfCjkString(r.s) : pdfLatinString(r.s)) + ' Tj ET');
        cx += pdfRunWidth(r, o.key, o.size) + (o.spacing || 0) * [...r.s].length;
      });
    };
    this.ops.push('q');
    if(o.halo && o.halo.color && o.halo.width > 0){ const hc = o.halo.color; this.alpha(1, (o.opacity ?? 1) * hc.a); this.ops.push(pdfNum(hc.r) + ' ' + pdfNum(hc.g) + ' ' + pdfNum(hc.b) + ' RG ' + pdfNum(o.halo.width) + ' w 1 j 1 J'); pass(1); this.ops.push('Q q'); }
    this.alpha((o.opacity ?? 1) * o.color.a, 1);
    this.ops.push(pdfNum(o.color.r) + ' ' + pdfNum(o.color.g) + ' ' + pdfNum(o.color.b) + ' rg'); pass(0);
    this.ops.push('Q');
  }
}
/* draw an SVG (as the export builds it) onto a page, keeping shapes and text as vectors */
const PDF_INHERIT = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'paint-order', 'visibility', 'text-transform'];
function pdfStyleOf(el, parent){
  const st = Object.assign({}, parent, {opacity: 1, display: ''});
  const put = (k, v) => { st[k.trim().toLowerCase()] = v.trim(); };
  const attrs = ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-dasharray', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'display', 'visibility'];
  attrs.forEach(a => { const v = el.getAttribute && el.getAttribute(a); if(v != null) put(a, v); });
  const css = el.getAttribute && el.getAttribute('style');
  if(css) css.split(';').forEach(d => { const i = d.indexOf(':'); if(i < 0) return; const k = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1).trim(); if(!v) return;
    if(k === 'font'){ const m = v.match(/^(italic\s+)?(?:(normal|bold|\d{3})\s+)?([\d.]+)px\s+(.+)$/i); if(m){ if(m[1]) st['font-style'] = 'italic'; if(m[2]) st['font-weight'] = m[2]; st['font-size'] = m[3] + 'px'; st['font-family'] = m[4]; } return; }
    put(k, v); });
  st._op = (parent._op ?? 1) * (parseFloat(st.opacity) >= 0 ? parseFloat(st.opacity) : 1);
  return st;
}
function pdfPathOps(d){
  /* SVG path data to PDF path operators (M L H V C S Q T A Z, absolute and relative) */
  const toks = String(d).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) || [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0, qx = 0, qy = 0, out = [];
  const num = () => parseFloat(toks[i++]);
  const isNum = () => i < toks.length && !/^[a-zA-Z]$/.test(toks[i]);
  const C = (x1, y1, x2, y2, x3, y3) => { out.push(pdfNum(x1) + ' ' + pdfNum(y1) + ' ' + pdfNum(x2) + ' ' + pdfNum(y2) + ' ' + pdfNum(x3) + ' ' + pdfNum(y3) + ' c'); };
  while(i < toks.length){
    if(/^[a-zA-Z]$/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase(), c = cmd.toUpperCase();
    if(c === 'Z'){ out.push('h'); x = sx; y = sy; if(!isNum()) continue; }
    if(c === 'M'){ const nx = num() + (rel ? x : 0), ny = num() + (rel ? y : 0); x = sx = nx; y = sy = ny; out.push(pdfNum(x) + ' ' + pdfNum(y) + ' m'); cmd = rel ? 'l' : 'L'; cx = x; cy = y; continue; }
    if(c === 'L'){ x = num() + (rel ? x : 0); y = num() + (rel ? y : 0); out.push(pdfNum(x) + ' ' + pdfNum(y) + ' l'); cx = x; cy = y; continue; }
    if(c === 'H'){ x = num() + (rel ? x : 0); out.push(pdfNum(x) + ' ' + pdfNum(y) + ' l'); cx = x; cy = y; continue; }
    if(c === 'V'){ y = num() + (rel ? y : 0); out.push(pdfNum(x) + ' ' + pdfNum(y) + ' l'); cx = x; cy = y; continue; }
    if(c === 'C'){ const x1 = num() + (rel ? x : 0), y1 = num() + (rel ? y : 0), x2 = num() + (rel ? x : 0), y2 = num() + (rel ? y : 0), x3 = num() + (rel ? x : 0), y3 = num() + (rel ? y : 0); C(x1, y1, x2, y2, x3, y3); cx = x2; cy = y2; x = x3; y = y3; continue; }
    if(c === 'S'){ const x1 = 2 * x - cx, y1 = 2 * y - cy, x2 = num() + (rel ? x : 0), y2 = num() + (rel ? y : 0), x3 = num() + (rel ? x : 0), y3 = num() + (rel ? y : 0); C(x1, y1, x2, y2, x3, y3); cx = x2; cy = y2; x = x3; y = y3; continue; }
    if(c === 'Q' || c === 'T'){ let x1, y1; if(c === 'Q'){ x1 = num() + (rel ? x : 0); y1 = num() + (rel ? y : 0); } else { x1 = 2 * x - qx; y1 = 2 * y - qy; } const x3 = num() + (rel ? x : 0), y3 = num() + (rel ? y : 0);
      C(x + 2 / 3 * (x1 - x), y + 2 / 3 * (y1 - y), x3 + 2 / 3 * (x1 - x3), y3 + 2 / 3 * (y1 - y3), x3, y3); qx = x1; qy = y1; x = x3; y = y3; cx = x; cy = y; continue; }
    if(c === 'A'){
      let rx = Math.abs(num()), ry = Math.abs(num()); const phi = num() * Math.PI / 180, large = num(), sweep = num(), x2 = num() + (rel ? x : 0), y2 = num() + (rel ? y : 0);
      if(!rx || !ry){ out.push(pdfNum(x2) + ' ' + pdfNum(y2) + ' l'); x = x2; y = y2; continue; }
      const cs = Math.cos(phi), sn = Math.sin(phi), dx = (x - x2) / 2, dy = (y - y2) / 2, x1p = cs * dx + sn * dy, y1p = -sn * dx + cs * dy;
      let lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry); if(lam > 1){ rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
      const sgn = (large === sweep ? -1 : 1), num2 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, co = sgn * Math.sqrt(Math.max(0, num2 / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
      const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx, ccx = cs * cxp - sn * cyp + (x + x2) / 2, ccy = sn * cxp + cs * cyp + (y + y2) / 2;
      const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      let t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry), dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
      if(!sweep && dt > 0) dt -= 2 * Math.PI; else if(sweep && dt < 0) dt += 2 * Math.PI;
      const segs = Math.ceil(Math.abs(dt) / (Math.PI / 2)), dd = dt / segs, kk = 4 / 3 * Math.tan(dd / 4);
      for(let s = 0; s < segs; s++){
        const a1 = t1 + s * dd, a2 = a1 + dd, c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
        const P = (px, py) => [ccx + cs * rx * px - sn * ry * py, ccy + sn * rx * px + cs * ry * py];
        const p1 = P(c1 - kk * s1, s1 + kk * c1), p2 = P(c2 + kk * s2, s2 - kk * c2), p3 = P(c2, s2);
        C(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
      }
      x = x2; y = y2; cx = x; cy = y; continue;
    }
    i++;
  }
  return out.join('\n');
}
function pdfCircleOps(cx, cy, r){ const k = 0.5523 * r; return [pdfNum(cx + r) + ' ' + pdfNum(cy) + ' m', pdfNum(cx + r) + ' ' + pdfNum(cy + k) + ' ' + pdfNum(cx + k) + ' ' + pdfNum(cy + r) + ' ' + pdfNum(cx) + ' ' + pdfNum(cy + r) + ' c', pdfNum(cx - k) + ' ' + pdfNum(cy + r) + ' ' + pdfNum(cx - r) + ' ' + pdfNum(cy + k) + ' ' + pdfNum(cx - r) + ' ' + pdfNum(cy) + ' c', pdfNum(cx - r) + ' ' + pdfNum(cy - k) + ' ' + pdfNum(cx - k) + ' ' + pdfNum(cy - r) + ' ' + pdfNum(cx) + ' ' + pdfNum(cy - r) + ' c', pdfNum(cx + k) + ' ' + pdfNum(cy - r) + ' ' + pdfNum(cx + r) + ' ' + pdfNum(cy - k) + ' ' + pdfNum(cx + r) + ' ' + pdfNum(cy) + ' c', 'h'].join('\n'); }
function pdfPaint(page, st, pathOps){
  if(st.display === 'none' || st.visibility === 'hidden' || st._op <= 0.001) return;
  const fill = pdfColor(st.fill === undefined ? '#000' : st.fill), stroke = pdfColor(st.stroke || 'none');
  const sw = parseFloat(st['stroke-width']); const fo = parseFloat(st['fill-opacity'] ?? 1), so = parseFloat(st['stroke-opacity'] ?? 1);
  if(fill && fill.a * (isNaN(fo) ? 1 : fo) * st._op > 0.003){
    page.ops.push('q'); page.alpha(fill.a * (isNaN(fo) ? 1 : fo) * st._op, 1);
    page.ops.push(pdfNum(fill.r) + ' ' + pdfNum(fill.g) + ' ' + pdfNum(fill.b) + ' rg', pathOps, 'f', 'Q');
  }
  if(stroke && (isNaN(sw) ? 1 : sw) > 0 && stroke.a * (isNaN(so) ? 1 : so) * st._op > 0.003){
    const dash = String(st['stroke-dasharray'] || 'none'), arr = dash === 'none' ? [] : dash.split(/[\s,]+/).map(v => parseFloat(v)).filter(v => v >= 0);
    const cap = {round: 1, square: 2}[st['stroke-linecap']] || 0, join = {round: 1, bevel: 2}[st['stroke-linejoin']] || 0;
    page.ops.push('q'); page.alpha(1, stroke.a * (isNaN(so) ? 1 : so) * st._op);
    page.ops.push(pdfNum(stroke.r) + ' ' + pdfNum(stroke.g) + ' ' + pdfNum(stroke.b) + ' RG ' + pdfNum(isNaN(sw) ? 1 : sw) + ' w ' + cap + ' J ' + join + ' j [' + (arr.length && arr.some(v => v > 0) ? arr.map(pdfNum).join(' ') : '') + '] 0 d', pathOps, 'S', 'Q');
  }
}
function pdfDrawSvg(page, root){
  const doc = root.ownerDocument, byId = id => doc.getElementById(id) || root.querySelector('[id="' + id + '"]');
  const walk = (el, pst) => {
    const tag = (el.localName || el.nodeName || '').toLowerCase();
    if(['defs', 'clippath', 'title', 'desc', 'style', 'metadata', 'lineargradient', 'radialgradient', 'filter', 'mask', 'symbol', 'marker'].includes(tag)) return;
    const st = pdfStyleOf(el, pst);
    if(st.display === 'none') return;
    let pushed = false;
    const enter = () => { if(!pushed){ page.ops.push('q'); pushed = true; } };
    const tr = el.getAttribute && el.getAttribute('transform');
    if(tr){ const re = /(translate|scale|matrix)\(([^)]*)\)/g; let m; while((m = re.exec(tr))){ const v = m[2].split(/[\s,]+/).filter(Boolean).map(Number); enter();
      if(m[1] === 'translate') page.ops.push('1 0 0 1 ' + pdfNum(v[0] || 0) + ' ' + pdfNum(v[1] || 0) + ' cm');
      else if(m[1] === 'scale') page.ops.push(pdfNum(v[0]) + ' 0 0 ' + pdfNum(v[1] ?? v[0]) + ' 0 0 cm');
      else if(v.length === 6) page.ops.push(v.map(pdfNum).join(' ') + ' cm'); } }
    if(tag === 'svg' && el !== root){
      const x = parseFloat(el.getAttribute('x')) || 0, y = parseFloat(el.getAttribute('y')) || 0, w = parseFloat(el.getAttribute('width')), h = parseFloat(el.getAttribute('height'));
      enter(); page.ops.push('1 0 0 1 ' + pdfNum(x) + ' ' + pdfNum(y) + ' cm');
      const vb = (el.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
      if(vb.length === 4 && w > 0 && h > 0 && vb[2] > 0 && vb[3] > 0){ page.ops.push(pdfNum(w / vb[2]) + ' 0 0 ' + pdfNum(h / vb[3]) + ' ' + pdfNum(-vb[0] * w / vb[2]) + ' ' + pdfNum(-vb[1] * h / vb[3]) + ' cm'); }
      if(w > 0 && h > 0 && vb.length === 4) page.ops.push(pdfNum(vb[0]) + ' ' + pdfNum(vb[1]) + ' ' + pdfNum(vb[2]) + ' ' + pdfNum(vb[3]) + ' re W n');
    }
    const cp = el.getAttribute && el.getAttribute('clip-path');
    if(cp){ const id = (cp.match(/url\(["']?#([^"')]+)["']?\)/) || [])[1], c = id && byId(id), r = c && c.querySelector('rect');
      if(r){ enter(); page.ops.push(pdfNum(+r.getAttribute('x') || 0) + ' ' + pdfNum(+r.getAttribute('y') || 0) + ' ' + pdfNum(+r.getAttribute('width') || 0) + ' ' + pdfNum(+r.getAttribute('height') || 0) + ' re W n'); } }
    const A = n => parseFloat(el.getAttribute(n)) || 0;
    if(tag === 'image'){ const href = el.getAttribute('href') || el.getAttribute('xlink:href') || '', w = A('width'), h = A('height');
      if(/^data:image\/jpeg;base64,/.test(href) && w > 0 && h > 0){ try{ const bin = atob(href.split(',')[1]), bytes = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        let pw = A('data-pw'), ph = A('data-ph'); if(!pw || !ph){ for(let i = 2; i < bytes.length - 9; ){ if(bytes[i] !== 0xFF){ i++; continue; } const mk = bytes[i + 1], ln = (bytes[i + 2] << 8) | bytes[i + 3]; if(mk >= 0xC0 && mk <= 0xC2){ ph = (bytes[i + 5] << 8) | bytes[i + 6]; pw = (bytes[i + 7] << 8) | bytes[i + 8]; break; } i += 2 + ln; } }
        page.imgs = page.imgs || []; const name = 'Im' + (PDF_IMG_N = (typeof PDF_IMG_N === 'number' ? PDF_IMG_N : 0) + 1); page.imgs.push({name, bytes, w: pw || 1, h: ph || 1});
        page.ops.push('q ' + pdfNum(w) + ' 0 0 ' + pdfNum(-h) + ' ' + pdfNum(A('x')) + ' ' + pdfNum(A('y') + h) + ' cm /' + name + ' Do Q'); }catch(e){} } }
    else if(tag === 'rect'){ const w = A('width'), h = A('height'); if(w > 0 && h > 0) pdfPaint(page, st, pdfNum(A('x')) + ' ' + pdfNum(A('y')) + ' ' + pdfNum(w) + ' ' + pdfNum(h) + ' re'); }
    else if(tag === 'line'){ pdfPaint(page, Object.assign({}, st, {fill: 'none'}), pdfNum(A('x1')) + ' ' + pdfNum(A('y1')) + ' m ' + pdfNum(A('x2')) + ' ' + pdfNum(A('y2')) + ' l'); }
    else if(tag === 'circle'){ const r = A('r'); if(r > 0) pdfPaint(page, st, pdfCircleOps(A('cx'), A('cy'), r)); }
    else if(tag === 'ellipse'){ const rx = A('rx'), ry = A('ry'); if(rx > 0 && ry > 0){ page.ops.push('q 1 0 0 ' + pdfNum(ry / rx) + ' 0 ' + pdfNum(A('cy') * (1 - ry / rx)) + ' cm'); pdfPaint(page, st, pdfCircleOps(A('cx'), A('cy'), rx)); page.ops.push('Q'); } }
    else if(tag === 'path'){ const d = el.getAttribute('d'); if(d) pdfPaint(page, st, pdfPathOps(d)); }
    else if(tag === 'polyline' || tag === 'polygon'){ const p = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number); if(p.length >= 4){ let o = pdfNum(p[0]) + ' ' + pdfNum(p[1]) + ' m'; for(let k = 2; k + 1 < p.length; k += 2) o += ' ' + pdfNum(p[k]) + ' ' + pdfNum(p[k + 1]) + ' l'; if(tag === 'polygon') o += ' h'; pdfPaint(page, tag === 'polyline' ? Object.assign({}, st, {fill: 'none'}) : st, o); } }
    else if(tag === 'text'){
      if(st.visibility !== 'hidden' && st._op > 0.001){
        let txt = (el.textContent || '').replace(/\s+/g, ' ');
        if(/uppercase/i.test(st['text-transform'] || '')) txt = txt.toUpperCase();
        const size = parseFloat(st['font-size']) || 12, key = pdfFontKey(st['font-family'], st['font-weight'], /italic|oblique/i.test(st['font-style'] || ''));
        const sp = parseFloat(st['letter-spacing']); const fill = pdfColor(st.fill === undefined ? '#000' : st.fill), fo = parseFloat(st['fill-opacity'] ?? 1);
        const halo = /^stroke/i.test(st['paint-order'] || '') ? {color: pdfColor(st.stroke || 'none'), width: parseFloat(st['stroke-width']) || 0} : null;
        if(fill) page.text(txt, A('x'), A('y'), {key, size, color: fill, opacity: st._op * (isNaN(fo) ? 1 : fo), spacing: isNaN(sp) ? 0 : sp, anchor: st['text-anchor'], halo: halo && halo.color ? halo : null});
      }
    }
    else { [...el.children].forEach(ch => walk(ch, st)); }
    if(pushed) page.ops.push('Q');
  };
  walk(root, {_op: 1, fill: '#000'});
}
/* a canvas look-alike that records what the list pages draw, as vector text */
class PdfCanvas{
  constructor(page){ this.page = page; this.fillStyle = '#000'; this.textAlign = 'left'; this.textBaseline = 'alphabetic'; this._font = {key: 'H', size: 10}; }
  set font(v){ const m = String(v).match(/^(italic\s+)?(?:(normal|bold|\d{3})\s+)?([\d.]+)px\s+(.+)$/i); if(m) this._font = {key: pdfFontKey(m[4], m[2] || '400', !!m[1]), size: +m[3]}; }
  get font(){ return pdfCssFont(this._font.key, this._font.size); }
  measureText(s){ return {width: pdfTextWidth(s, this._font.key, this._font.size, 0)}; }
  fillText(s, x, y){ if(!this.page) return; const c = pdfColor(this.fillStyle); this.page.text(s, x, y, {key: this._font.key, size: this._font.size, color: c, anchor: this.textAlign === 'right' || this.textAlign === 'end' ? 'end' : this.textAlign === 'center' ? 'middle' : 'start'}); }
  fillRect(x, y, w, h){ if(!this.page) return; const c = pdfColor(this.fillStyle); if(!c) return; this.page.ops.push('q'); this.page.alpha(c.a, 1); this.page.ops.push(pdfNum(c.r) + ' ' + pdfNum(c.g) + ' ' + pdfNum(c.b) + ' rg ' + pdfNum(x) + ' ' + pdfNum(y) + ' ' + pdfNum(w) + ' ' + pdfNum(h) + ' re f Q'); }
  drawImage(){}
}
/* write the pages out: shared fonts and transparency, one content stream per page */
function vectorPdf(pages, title){
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0, nObj = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const alloc = () => ++nObj, bodies = {};
  const catalog = alloc(), pagesId = alloc(), info = alloc();
  const fontsUsed = new Set(); pages.forEach(p => p.fonts.forEach(f => fontsUsed.add(f)));
  const fontIds = {};
  [...fontsUsed].forEach(f => { fontIds[f] = alloc(); });
  let cjkDesc = 0, cjkCid = 0;
  if(fontsUsed.has('FC')){ cjkCid = alloc(); cjkDesc = alloc(); }
  const gsAll = new Map(); pages.forEach(p => p.gs.forEach((name, k) => gsAll.set(name, k)));
  const gsIds = {}; gsAll.forEach((k, name) => { gsIds[name] = alloc(); });
  const res = alloc();
  const imgIds = {}; pages.forEach(p => (p.imgs || []).forEach(im => { imgIds[im.name] = {id: alloc(), im}; }));
  const pageIds = pages.map(() => [alloc(), alloc()]);
  const str = s => '(' + String(s).replace(/[\\()]/g, m => '\\' + m).replace(/[^\x20-\x7E]/g, '') + ')';
  bodies[catalog] = '<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>';
  bodies[pagesId] = '<< /Type /Pages /Kids [' + pageIds.map(p => p[0] + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>';
  bodies[info] = '<< /Producer (Paper Map) /Creator (Paper Map) /Title ' + str(title || 'Paper Map export') + ' >>';
  Object.entries(fontIds).forEach(([f, id]) => {
    bodies[id] = f === 'FC'
      ? '<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [' + cjkCid + ' 0 R] >>'
      : f === 'ZD' ? '<< /Type /Font /Subtype /Type1 /BaseFont /ZapfDingbats >>'
      : '<< /Type /Font /Subtype /Type1 /BaseFont /' + PDF_LATIN[f] + ' /Encoding /WinAnsiEncoding >>';
  });
  if(cjkCid){
    bodies[cjkCid] = '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /FontDescriptor ' + cjkDesc + ' 0 R /DW 1000 /W [1 95 500] >>';
    bodies[cjkDesc] = '<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [-25 -254 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 93 >>';
  }
  Object.entries(gsIds).forEach(([name, id]) => { const [ca, CA] = gsAll.get(name).split('/'); bodies[id] = '<< /Type /ExtGState /ca ' + ca + ' /CA ' + CA + ' >>'; });
  Object.values(imgIds).forEach(({id, im}) => { bodies[id] = {dict: '/Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', bytes: im.bytes}; });
  bodies[res] = '<< /ProcSet [/PDF /Text /ImageC] ' + (Object.keys(imgIds).length ? '/XObject << ' + Object.entries(imgIds).map(([nm, o]) => '/' + nm + ' ' + o.id + ' 0 R').join(' ') + ' >> ' : '') + '/Font << ' + Object.entries(fontIds).map(([f, id]) => '/' + f + ' ' + id + ' 0 R').join(' ') + ' >> /ExtGState << ' + Object.entries(gsIds).map(([n, id]) => '/' + n + ' ' + id + ' 0 R').join(' ') + ' >> >>';
  pages.forEach((p, i) => {
    const [pg, ct] = pageIds[i];
    const content = '1 0 0 -1 0 ' + pdfNum(p.h) + ' cm\n' + (p.pre || '') + p.ops.join('\n');
    bodies[pg] = '<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + pdfNum(p.w) + ' ' + pdfNum(p.h) + ']' + (p.userUnit ? ' /UserUnit ' + p.userUnit : '') + ' /Resources ' + res + ' 0 R /Contents ' + ct + ' 0 R >>';
    bodies[ct] = {stream: content};
  });
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  for(let n = 1; n <= nObj; n++){
    offs[n] = len; push(n + ' 0 obj\n');
    const b = bodies[n];
    if(b && typeof b === 'object' && b.bytes){ push('<< ' + b.dict + ' /Length ' + b.bytes.length + ' >>\nstream\n'); push(b.bytes); push('\nendstream'); }
    else if(b && typeof b === 'object'){ const bytes = enc.encode(b.stream); push('<< /Length ' + bytes.length + ' >>\nstream\n'); push(bytes); push('\nendstream'); }
    else push(b || '<< >>');
    push('\nendobj\n');
  }
  const xref = len;
  let x = 'xref\n0 ' + (nObj + 1) + '\n0000000000 65535 f \n';
  for(let n = 1; n <= nObj; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
  push(x + 'trailer\n<< /Size ' + (nObj + 1) + ' /Root ' + catalog + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF');
  return new Blob(parts, {type: 'application/pdf'});
}
/* the map as one vector page, scaled to the width of a landscape A4 sheet */
function mapPdfPage(x){
  const W = 842, s = W / x.w, page = new PdfPage(W, x.h * s);
  page.pre = pdfNum(s) + ' 0 0 ' + pdfNum(s) + ' 0 0 cm\n';
  const doc = new DOMParser().parseFromString(x.svg, 'image/svg+xml');
  pdfDrawSvg(page, doc.documentElement);
  return page;
}
/* the list of papers on vector A4 pages */
function listPdfPages(es, o){
  const PW = 595, PH = 842, M = 56, W = PW - 2 * M;
  const probe = new PdfCanvas(null);
  const blocks = listBlocks(probe, es, W, o, 1);
  const groups = []; let cur = [], used = 0;
  blocks.forEach((b, i) => {
    const keepWithNext = b.kind === 'head' && blocks[i + 1] ? blocks[i + 1].h : 0;
    if(cur.length && used + b.h + keepWithNext > PH - 2 * M - 20){ groups.push(cur); cur = []; used = 0; }
    cur.push(b); used += b.h;
  });
  if(cur.length) groups.push(cur);
  return groups.map((bl, n) => {
    const page = new PdfPage(PW, PH), g = new PdfCanvas(page);
    let y = M; bl.forEach(b => { b.draw(g, M, y); y += b.h; });
    g.font = '400 10px ' + LIST_SANS; g.fillStyle = '#8A919C'; g.textAlign = 'right';
    g.fillText('Paper Map · ' + (n + 2) + ' / ' + (groups.length + 1), PW - M, PH - M * 0.5);
    return page;
  });
}

/* a one-page PDF around a JPEG of the map */
async function jpegPdf(c, wPt, hPt){
  const jpg = new Uint8Array(await (await canvasBlob(c, 'image/jpeg', 0.92)).arrayBuffer());
  const enc = new TextEncoder(), parts = [], offs = [];
  let len = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; push(n + ' 0 obj\n'); body(); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const content = 'q ' + wPt.toFixed(2) + ' 0 0 ' + hPt.toFixed(2) + ' 0 0 cm /Im0 Do Q';
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + wPt.toFixed(2) + ' ' + hPt.toFixed(2) + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'));
  obj(4, () => { push('<< /Type /XObject /Subtype /Image /Width ' + c.width + ' /Height ' + c.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n'); push(jpg); push('\nendstream'); });
  obj(5, () => push('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'));
  obj(6, () => push('<< /Producer (Paper Map) /Title (' + 'Paper Map export' + ') >>'));
  const xref = len;
  let x = 'xref\n0 7\n0000000000 65535 f \n';
  for(let i = 1; i <= 6; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  push(x + 'trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF');
  return new Blob(parts, {type: 'application/pdf'});
}
/* save where the person chooses (a Dropbox or iCloud Drive folder works), or download */
async function saveBlobAs(blob, name){
  if(TAURI){ try{ return await macSave(blob, name); }catch(e){ toast('Couldn’t save the file'); return 'failed'; } }
  if(window.showSaveFilePicker && window.isSecureContext !== false){
    try{
      const ext = name.split('.').pop();
      const desc = {pdf: 'PDF document', png: 'PNG image', gif: 'GIF animation', csv: 'CSV spreadsheet', bib: 'BibTeX file', ris: 'RIS file', md: 'Markdown file'}[ext] || 'File';
      const h = await window.showSaveFilePicker({suggestedName: name, types: [{description: desc, accept: {[blob.type.split(';')[0]]: ['.' + ext]}}]});
      const w = await h.createWritable(); await w.write(blob); await w.close();
      return 'saved';
    }catch(e){ if(e && e.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  return 'downloaded';
}
function slugName(s){ return String(s || 'paper-map').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'paper-map'; }
function openExport(preset){
  preset = preset || {};
  const rows = allLaneRows();
  const selPaper = preset.paper || (ui.selected && lib.entries[ui.selected] && MAP.P && MAP.P[ui.selected] ? ui.selected : null);
  const filled = new Set(Object.values(lib.entries).filter(e => e.kind === 'paper' && typeof e.y === 'number').map(e => e.sub));
  const start = ui.topic && IDX.topics[ui.topic] ? new Set(treeSubs(IDX.topics[ui.topic]).map(s => s.id)) : new Set(rows.map(r => r.sub.id));
  const st = {sel: new Set([...start].filter(id => filled.has(id))), concepts: Object.values(lib.entries).some(e => e.kind === 'concept'), notes: false, legend: true, allYears: true, format: preset.format || 'png', title: '', lines: 'all', disclaimer: true, list: !!preset.list, listStatus: 'all', listNotes: false, listLines: true,
    mode: preset.mode || (selPaper ? 'paper' : 'topics'), paper: selPaper, pDepth: ui.depth || 1, pDir: settings.focusDir || 'all', branches: new Set(), pick: new Set(selPaper ? [selPaper] : []), dropEdges: new Set(), dropPapers: new Set(), rest: 'faint', q: '', names: 'all',
    open: {how: false, lines: false, papers: false, pic: false, list: !!preset.list, sug: false}};
  if(!st.sel.size) rows.forEach(r => { if(filled.has(r.sub.id)) st.sel.add(r.sub.id); });
  const defTitle = () => {
    if(st.mode === 'paper' && st.paper && lib.entries[st.paper]) return lib.entries[st.paper].t + ': how it connects';
    if(st.mode === 'branches' && st.branches.size) return lib.branches.filter(b => st.branches.has(b.id)).map(b => b.name).join(' · ');
    if(st.mode === 'papers') return 'Selected papers';
    const tps = lib.topics.filter(tp => treeSubs(tp).some(s => st.sel.has(s.id))); return tps.length === 1 ? tps[0].name : (lib.title || 'Paper Map');
  };
  st.title = defTitle();
  let titleTouched = false;
  /* ---- pieces of the left column; every group folds, and its summary says how it is set ---- */
  const fold = (key, label, sum, inner) => '<details class="ex-fold" data-ex-fold="' + key + '"' + (st.open[key] ? ' open' : '') + '><summary><span class="ex-fk">' + label + '</span><span class="ex-fs">' + esc(sum) + '</span></summary><div class="ex-fb">' + inner + '</div></details>';
  const seg = (name, opts, cur) => '<span class="ex-seg" role="radiogroup">' + opts.map(o => '<label' + (String(cur) === String(o[0]) ? ' class="on"' : '') + '><input type="radio" name="' + name + '" value="' + o[0] + '"' + (String(cur) === String(o[0]) ? ' checked' : '') + '>' + o[1] + '</label>').join('') + '</span>';
  const treeHTML = () => lib.topics.map(tp => {
    const subs = rows.filter(r => r.topic.id === tp.id), on = subs.filter(r => st.sel.has(r.sub.id)).length;
    const head = '<label class="ex-topic"><input type="checkbox" data-ex-topic="' + tp.id + '"' + (on && on === subs.length ? ' checked' : '') + '> <b>' + esc(tp.name) + '</b></label>';
    const kids = subs.filter(r => !r.sub.hidden).map(r => '<label class="ex-sub" style="--d:' + r.depth + '"><input type="checkbox" data-ex-sub="' + r.sub.id + '"' + (st.sel.has(r.sub.id) ? ' checked' : '') + (filled.has(r.sub.id) ? '' : ' disabled') + '> ' + esc(r.name) + (filled.has(r.sub.id) ? '' : ' <span class="hint">no papers</span>') + '</label>').join('');
    return '<div class="ex-group">' + head + kids + '</div>';
  }).join('');
  const suggestHTML = L => {
    const name = id => { const r = rows.find(x => x.sub.id === id); return r ? (r.sub.hidden ? r.topic.name : r.topic.name + ' › ' + r.name) : id; };
    if(!L.suggest.length) return '<p class="hint">Nothing you left out is linked to what you chose.</p>';
    return '<p class="hint">' + (L.left ? L.left + (L.left === 1 ? ' line leads' : ' lines lead') + ' out of your choice and are left out; colour lines keep only the part inside. Add a topic to keep its lines:' : 'Related topics outside your choice:') + '</p>' +
      '<div class="ex-sugs">' + L.suggest.slice(0, 8).map(x => '<button type="button" class="ex-sug" data-ex-add="' + x.id + '"><span aria-hidden="true">+</span> ' + esc(name(x.id)) + ' <span class="hint">' + [x.lines ? x.lines + (x.lines === 1 ? ' line' : ' lines') : '', x.related ? 'related topic' : ''].filter(Boolean).join(' · ') + '</span></button>').join('') + '</div>';
  };
  const pLabel = e => (e.au ? shortAu(e.au) + ' · ' : '') + e.t;
  const papersOnMap = () => Object.values(lib.entries).filter(e => typeof e.y === 'number' && !e.parent && (e.kind === 'paper' || e.kind === 'concept'));
  const exPaperResults = q => {
    const words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
    const es = papersOnMap().filter(e => e.kind === 'paper' && typeof e.y === 'number').filter(e => { const hay = (e.t + ' ' + (e.au || '') + ' ' + e.y + ' ' + ((IDX.topics[e.topic] || {}).name || '') + ' ' + ((IDX.subs[e.sub] || {}).name || '')).toLowerCase(); return words.every(w => hay.includes(w)); }).sort(byYear);
    if(!es.length) return '<p class="hint">No paper matches “' + esc(q) + '”.</p>';
    return es.slice(0, 40).map(e => '<button type="button" class="ex-res" data-ex-setpaper="' + e.id + '"><span class="ex-res-y">' + esc(e.y) + '</span><span class="ex-res-t">' + esc(e.t) + '</span><span class="ex-res-a">' + esc([shortAu(e.au), (IDX.subs[e.sub] && !IDX.subs[e.sub].hidden ? IDX.subs[e.sub].name : (IDX.topics[e.topic] || {}).name)].filter(Boolean).join(' · ')) + '</span></button>').join('') + (es.length > 40 ? '<p class="hint">' + (es.length - 40) + ' more: type a little more to narrow it down.</p>' : '');
  };
  const paperOptions = () => lib.topics.map(tp => { const es = papersOnMap().filter(e => e.kind === 'paper' && e.topic === tp.id).sort(byYear); return es.length ? '<optgroup label="' + esc(tp.name) + '">' + es.map(e => '<option value="' + e.id + '"' + (e.id === st.paper ? ' selected' : '') + '>' + esc(e.y + ' · ' + pLabel(e)) + '</option>').join('') + '</optgroup>' : ''; }).join('');
  const chipRow = (name, opts, cur) => opts.map(o => '<button type="button" class="dchip small' + (String(cur) === String(o[0]) ? ' on' : '') + '" data-ex-' + name + '="' + o[0] + '">' + o[1] + '</button>').join('');
  const DEPTHS = [[1, '1 step'], [2, '2 steps'], [3, '3 steps'], ['all', 'Whole line']], DIRS = [['all', 'All ways'], ['up', 'Earlier only'], ['down', 'Later only'], ['lineage', 'Earlier + later']];
  const linesFold = () => {
    const K = exportKeep(st); if(!K || !K.all.size) return '';
    const keys = [...K.all].sort((x, y) => linkLabel(x).localeCompare(linkLabel(y)));
    return fold('lines', 'Lines', K.edges.size + ' of ' + K.all.size, (keys.length > 8 ? '<input type="search" class="ex-filter" placeholder="Find in this list" autocomplete="off">' : '') + '<div class="ex-linelist">' + keys.map(k => '<label data-hay="' + esc(linkLabel(k).toLowerCase()) + '"><input type="checkbox" data-ex-edge="' + esc(k) + '"' + (st.dropEdges.has(k) ? '' : ' checked') + '> ' + esc(linkLabel(k)) + '</label>').join('') + '</div>');
  };
  const restRow = () => '<div class="ex-row"><span class="ex-fk">Everything else</span>' + seg('exRest', [['faint', 'Faint'], ['out', 'Leave out']], st.rest) + '</div>';
  const modeHTML = () => {
    if(st.mode === 'paper') return (st.paper && lib.entries[st.paper]
        ? '<div class="ex-chosen"><span class="hint">Starting from</span> <b>' + esc(pLabel(lib.entries[st.paper])) + '</b> <span class="hint">' + esc(lib.entries[st.paper].y) + '</span> <button type="button" class="linkbtn" data-ex-unpaper="1">Change</button></div>'
        : '<div class="ex-find"><input type="search" id="exPaperQ" placeholder="Find the paper to start from: title, author or year" value="' + esc(st.paperQ || '') + '" autocomplete="off"><div class="ex-results" id="exPaperRes">' + exPaperResults(st.paperQ || '') + '</div></div>') +
      fold('how', 'How far', (DEPTHS.find(d => String(d[0]) === String(st.pDepth)) || DEPTHS[0])[1] + ' · ' + DIRS.find(d => d[0] === st.pDir)[1], '<div class="ex-chips">' + chipRow('depth', DEPTHS, st.pDepth) + '</div><div class="ex-chips">' + chipRow('dir', DIRS, st.pDir) + '</div>') + linesFold() + restRow();
    if(st.mode === 'branches') return ((lib.branches || []).length ? '<div class="ex-brs">' + lib.branches.map(b => { const n = Object.values(lib.lineBranch || {}).filter(x => x === b.id).length; return '<label><input type="checkbox" data-ex-br="' + b.id + '"' + (st.branches.has(b.id) ? ' checked' : '') + '><i style="background:' + b.color + '"></i> ' + esc(b.name) + ' <span class="hint">' + n + (n === 1 ? ' line' : ' lines') + '</span></label>'; }).join('') + '</div>' : '<p class="hint">No colour lines yet.</p>') + linesFold() + restRow();
    if(st.mode === 'papers'){
      const q = st.q.trim().toLowerCase(), es = papersOnMap().filter(e => !q || (e.t + ' ' + (e.au || '') + ' ' + e.y).toLowerCase().includes(q)).sort((a, b) => (a.topic || '').localeCompare(b.topic || '') || byYear(a, b));
      return '<input type="search" id="exQ" placeholder="Find a paper to add" value="' + esc(st.q) + '">' +
        '<div class="ex-picklist">' + es.slice(0, 300).map(e => '<label><input type="checkbox" data-ex-pick="' + e.id + '"' + (st.pick.has(e.id) ? ' checked' : '') + '> <span class="hint">' + esc(e.y) + '</span> ' + esc(e.kind === 'concept' ? 'Concept: ' + e.t : pLabel(e)) + '</label>').join('') + '</div>' +
        '<div class="ex-chips"><button type="button" class="linkbtn" data-ex-grow="1">+ the papers they link to</button><button type="button" class="linkbtn" data-ex-clear="1">Clear</button></div>' + linesFold() + restRow();
    }
    const L = exportLinks(st.sel);
    return '<div class="ex-tree" id="exTree">' + treeHTML() + '</div>' + fold('sug', 'Linked to your choice', L.suggest.length ? L.suggest.length + (L.suggest.length === 1 ? ' topic' : ' topics') : 'none', suggestHTML(L));
  };
  /* the papers that will be in it: untick one to drop it from the picture and the list */
  const candidates = () => {
    const K = exportKeep(st, true);
    const es = K ? [...K.nodes].map(id => lib.entries[id]).filter(e => e && e.kind === 'paper' && !e.parent && typeof e.y === 'number') : Object.values(lib.entries).filter(e => e.kind === 'paper' && !e.parent && typeof e.y === 'number' && st.sel.has(e.sub));
    const ord = listOrder(); return es.sort((a, b) => (ord[a.sub] ?? 9e9) - (ord[b.sub] ?? 9e9) || byYear(a, b));
  };
  const papersFold = () => { const es = candidates(); if(!es.length) return ''; const kept = es.filter(e => !st.dropPapers.has(e.id)).length;
    return fold('papers', 'Papers', kept + ' of ' + es.length, (es.length > 8 ? '<input type="search" class="ex-filter" placeholder="Find in this list" autocomplete="off">' : '') + '<div class="ex-picklist">' + es.map(e => '<label data-hay="' + esc((e.t + ' ' + (e.au || '') + ' ' + e.y).toLowerCase()) + '"><input type="checkbox" data-ex-drop="' + e.id + '"' + (st.dropPapers.has(e.id) ? '' : ' checked') + '> <span class="hint">' + esc(e.y) + '</span> ' + esc(pLabel(e)) + '</label>').join('') + '</div>'); };
  const picFold = () => fold('pic', 'Picture', [st.lines === 'colour' ? 'only colour lines' : st.lines === 'none' ? 'no lines' : '', st.legend ? 'legend' : '', st.notes ? 'notes' : ''].filter(Boolean).join(' · ') || 'plain',
    '<label class="ex-field">Title<input type="text" id="exTitle" maxlength="80" value="' + esc(st.title) + '"></label>' +
    '<label class="ex-field">Names<select id="exNames"><option value="all"' + (st.names !== 'main' ? ' selected' : '') + '>Every paper’s name</option><option value="main"' + (st.names === 'main' ? ' selected' : '') + '>Only the main ones, as on the map</option></select></label>' +
    '<label class="ex-field">Lines<select id="exLines"><option value="all"' + (st.lines === 'all' ? ' selected' : '') + '>All lines</option><option value="colour"' + (st.lines === 'colour' ? ' selected' : '') + '>Only colour lines</option><option value="none"' + (st.lines === 'none' ? ' selected' : '') + '>No lines, just the papers</option></select></label>' +
    '<div class="ex-checks">' + '<label><input type="checkbox" id="exNotes"' + (st.notes ? ' checked' : '') + '> Notes on lines</label><label><input type="checkbox" id="exLegend"' + (st.legend ? ' checked' : '') + '> Legend</label><label><input type="checkbox" id="exDisc"' + (st.disclaimer ? ' checked' : '') + '> Say the lines are my own reading</label>' + (settings.range ? '<label><input type="checkbox" id="exRange"' + (!st.allYears ? ' checked' : '') + '> Only the years in view</label>' : '') + '</div>');
  const listN = () => { const o = exportOpts(st); return o.keep ? keptPapers(o.keep, st.listStatus).length : papersFor({subs: new Set(o.subs), status: st.listStatus}).length; };
  const listFold = () => fold('list', 'List of papers', st.list ? listN() + ' papers' : 'off',
    '<label class="ex-on"><input type="checkbox" id="exList"' + (st.list ? ' checked' : '') + '> Add the list of these papers</label>' +
    (st.list ? '<label class="ex-field">Which<select id="exListSt"><option value="all">All of them</option><option value="read"' + (st.listStatus === 'read' ? ' selected' : '') + '>Only the ones I’ve read</option><option value="want"' + (st.listStatus === 'want' ? ' selected' : '') + '>Only the ones I want to read</option><option value="none"' + (st.listStatus === 'none' ? ' selected' : '') + '>Only the unmarked ones</option></select></label><div class="ex-checks"><label><input type="checkbox" id="exListLines"' + (st.listLines ? ' checked' : '') + '> The lines between them</label><label><input type="checkbox" id="exListNotes"' + (st.listNotes ? ' checked' : '') + '> Notes</label></div><p class="hint">' + (st.format === 'png' ? 'As a PNG it goes under the map, in one long picture.' : 'As a PDF it follows on A4 pages after the map.') + '</p>' : ''));
  const fmtRow = () => '<div class="ex-row ex-fmt-row"><span class="ex-fk">Format</span>' + seg('exFmt', [['png', 'PNG'], ['pdf', 'PDF'], ['gif', 'GIF']], st.format) + '</div><p class="hint ex-where">' + (st.format === 'gif' ? 'A moving picture of the map growing, year by year. ' : '') + (window.showSaveFilePicker ? 'You choose where to save it.' : 'It downloads to your device.') + '</p>';
  const leftHTML = () => '<div class="ex-modes" role="tablist">' + [['topics', 'Topics'], ['paper', 'From a paper'], ['branches', 'Colour lines'], ['papers', 'Pick papers']].map(m => '<button type="button" role="tab" class="ex-mode' + (st.mode === m[0] ? ' on' : '') + '" aria-selected="' + (st.mode === m[0]) + '" data-ex-mode="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>' +
    '<div class="ex-sec">' + modeHTML() + '</div>' + '<div class="ex-sec">' + papersFold() + picFold() + listFold() + '</div>' + fmtRow();
  openModal({
    title: 'Export the map',
    body: '<div class="ex-wrap ex2"><div class="ex-left" id="exLeft">' + leftHTML() + '</div><div class="ex-right"><div class="ex-prev" id="exPrev"><p class="hint">Drawing…</p></div><div class="ex-listprev" id="exListPrev" hidden></div></div></div>',
    actions: [{label: 'Cancel'}, {label: 'Export', primary: true, onClick: () => { doExport(st); return false; }}],
    onOpen: bd => {
      bd.closest('.modal, #modal, [role="dialog"]') && bd.closest('.modal, #modal, [role="dialog"]').classList.add('modal-wide');
      const left = bd.querySelector('#exLeft'), prev = bd.querySelector('#exPrev'), lp = bd.querySelector('#exListPrev');
      let tm = 0, gen = 0;
      const redraw = () => { clearTimeout(tm); tm = setTimeout(async () => {
        const my = ++gen, o = exportOpts(st), x = buildExportSVG(o);
        prev.innerHTML = x ? '<img alt="Preview of the exported map" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(x.svg) + '">' : '<p class="hint">' + (st.mode === 'topics' ? 'Choose at least one topic with papers.' : 'Choose what to include on the left.') + '</p>';
        const es = st.list && x ? (o.keep ? keptPapers(o.keep, st.listStatus) : papersFor({subs: new Set(o.subs), status: st.listStatus})) : [];
        if(!es.length){ lp.hidden = true; lp.innerHTML = ''; return; }
        try{
          const imgs = st.format === 'png' ? [listCanvas(es, st, 900)] : await listPages(es, st, 150);
          if(my !== gen) return;
          lp.hidden = false;
          lp.className = 'ex-listprev ' + (st.format === 'png' ? 'as-png' : 'as-pdf');
          lp.innerHTML = imgs.map((c, i) => '<img alt="' + (st.format === 'png' ? 'The list under the map' : 'List page ' + (i + 2)) + '" src="' + c.toDataURL('image/png') + '">').join('');
        }catch(e){ lp.hidden = true; }
      }, 140); };
      const refresh = () => {
        const q = bd.querySelector('#exQ'), hadQ = q && document.activeElement === q, pos = hadQ ? q.selectionStart : 0, sc = left.scrollTop;
        if(!titleTouched) st.title = defTitle();
        left.innerHTML = leftHTML(); left.scrollTop = sc;
        if(hadQ){ const q2 = bd.querySelector('#exQ'); if(q2){ q2.focus(); q2.setSelectionRange(pos, pos); } }
        redraw();
      };
      bd.addEventListener('toggle', ev => { const d = ev.target; if(d && d.dataset && d.dataset.exFold) st.open[d.dataset.exFold] = d.open; }, true);
      bd.addEventListener('change', ev => {
        if(ev.target.id === 'exPaperQ' || ev.target.id === 'exQ' || (ev.target.classList && ev.target.classList.contains('ex-filter'))) return;
        const x = ev.target;
        const tsel = x.closest('[data-ex-topic]'), ssel = x.closest('[data-ex-sub]');
        if(tsel){ rows.filter(r => r.topic.id === tsel.dataset.exTopic && filled.has(r.sub.id)).forEach(r => { if(tsel.checked) st.sel.add(r.sub.id); else st.sel.delete(r.sub.id); }); return refresh(); }
        if(ssel){ if(ssel.checked) st.sel.add(ssel.dataset.exSub); else st.sel.delete(ssel.dataset.exSub); return refresh(); }
        if(x.id === 'exPaper'){ st.paper = x.value || null; st.dropEdges.clear(); st.dropPapers.clear(); return refresh(); }
        if(x.dataset.exBr){ if(x.checked) st.branches.add(x.dataset.exBr); else st.branches.delete(x.dataset.exBr); st.dropEdges.clear(); return refresh(); }
        if(x.dataset.exPick){ if(x.checked) st.pick.add(x.dataset.exPick); else st.pick.delete(x.dataset.exPick); return refresh(); }
        if(x.dataset.exEdge){ if(x.checked) st.dropEdges.delete(x.dataset.exEdge); else st.dropEdges.add(x.dataset.exEdge); return refresh(); }
        if(x.dataset.exDrop){ if(x.checked) st.dropPapers.delete(x.dataset.exDrop); else st.dropPapers.add(x.dataset.exDrop); return refresh(); }
        if(x.name === 'exRest') st.rest = x.value;
        if(x.name === 'exFmt') st.format = x.value;
        if(x.id === 'exConcepts') st.concepts = x.checked;
        if(x.id === 'exNotes') st.notes = x.checked;
        if(x.id === 'exLegend') st.legend = x.checked;
        if(x.id === 'exRange') st.allYears = !x.checked;
        if(x.id === 'exLines') st.lines = x.value;
        if(x.id === 'exNames') st.names = x.value;
        if(x.id === 'exDisc') st.disclaimer = x.checked;
        if(x.id === 'exList'){ st.list = x.checked; st.open.list = true; }
        if(x.id === 'exListSt') st.listStatus = x.value;
        if(x.id === 'exListLines') st.listLines = x.checked;
        if(x.id === 'exListNotes') st.listNotes = x.checked;
        refresh();
      });
      bd.addEventListener('input', ev => {
        if(ev.target.id === 'exTitle'){ titleTouched = true; st.title = ev.target.value; redraw(); }
        if(ev.target.id === 'exQ'){ st.q = ev.target.value; refresh(); }
        if(ev.target.id === 'exPaperQ'){ st.paperQ = ev.target.value; const r = bd.querySelector('#exPaperRes'); if(r) r.innerHTML = exPaperResults(st.paperQ); }
        if(ev.target.classList.contains('ex-filter')){ const words = ev.target.value.toLowerCase().split(/\s+/).filter(Boolean), list = ev.target.nextElementSibling;
          if(list) list.querySelectorAll('label[data-hay]').forEach(l => { l.hidden = !words.every(w => l.dataset.hay.includes(w)); }); }
      });
      bd.addEventListener('click', ev => {
        const a = ev.target.closest('[data-ex-add]'); if(a){ st.sel.add(a.dataset.exAdd); return refresh(); }
        const sp = ev.target.closest('[data-ex-setpaper]'); if(sp){ st.paper = sp.dataset.exSetpaper; st.paperQ = ''; st.dropEdges.clear(); st.dropPapers.clear(); return refresh(); }
        if(ev.target.closest('[data-ex-unpaper]')){ st.paper = null; refresh(); setTimeout(() => { const q = bd.querySelector('#exPaperQ'); if(q) q.focus(); }, 0); return; }
        const m = ev.target.closest('[data-ex-mode]'); if(m){ st.mode = m.dataset.exMode; st.dropEdges.clear(); st.dropPapers.clear(); return refresh(); }
        const d = ev.target.closest('[data-ex-depth]'); if(d){ st.pDepth = d.dataset.exDepth === 'all' ? 'all' : +d.dataset.exDepth; st.dropEdges.clear(); return refresh(); }
        const r = ev.target.closest('[data-ex-dir]'); if(r){ st.pDir = r.dataset.exDir; st.dropEdges.clear(); return refresh(); }
        if(ev.target.closest('[data-ex-grow]')){ const add = []; st.pick.forEach(id => { (IDX.up[id] || []).concat(IDX.down[id] || []).forEach(x => add.push(x[0])); }); add.forEach(x => { if(lib.entries[x]) st.pick.add(x); }); return refresh(); }
        if(ev.target.closest('[data-ex-clear]')){ st.pick.clear(); st.dropEdges.clear(); return refresh(); }
      });
      redraw();
    }
  });
}

/* export by lines rather than by topics: one paper's lines (as How far lights them), chosen colour lines,
   or papers you pick; then any single line can be taken out, and the rest is left out or drawn faintly */
function exportKeep(st, noDrop){
  const drop = noDrop ? new Set() : (st.dropPapers || new Set());
  if(!st.mode || st.mode === 'topics'){
    if(!drop.size) return null;
    /* whole topics, minus the papers you unticked */
    const nodes = new Set(), edges = new Set();
    Object.values(lib.entries).forEach(e => { if(e.kind === 'paper' && !e.parent && typeof e.y === 'number' && st.sel.has(e.sub) && !drop.has(e.id)){ nodes.add(e.id); if(st.concepts) (e.needs || []).forEach(c => { if(lib.entries[c]) nodes.add(c); }); } });
    lib.links.forEach(l => { if(nodes.has(l[0]) && nodes.has(l[1])) edges.add(EK(l[0], l[1])); });
    Object.values(lib.entries).forEach(e => (e.needs || []).forEach(c => { if(nodes.has(c) && nodes.has(e.id)) edges.add(EK(c, e.id)); }));
    const all = new Set(edges); (st.dropEdges || new Set()).forEach(k => edges.delete(k));
    return {nodes, edges, all, rest: 'out'};
  }
  const nodes = new Set(), edges = new Set();
  if(st.mode === 'paper' && st.paper && lib.entries[st.paper]){
    const sv = {d: ui.depth, f: settings.focusDir};
    ui.depth = st.pDepth; settings.focusDir = st.pDir;
    try{ const F = focusSets(st.paper); F.nodes.forEach(x => nodes.add(x)); F.edges.forEach(k => edges.add(k)); }
    finally{ ui.depth = sv.d; settings.focusDir = sv.f; }
  }else if(st.mode === 'branches'){
    Object.entries(lib.lineBranch || {}).forEach(([k, bid]) => { if(!st.branches.has(bid)) return; const [a, b] = k.split('|'); if(lib.entries[a] && lib.entries[b]){ nodes.add(a); nodes.add(b); edges.add(EK(a, b)); } });
  }else if(st.mode === 'papers'){
    st.pick.forEach(id => { if(lib.entries[id]) nodes.add(id); });
    lib.links.forEach(l => { if(nodes.has(l[0]) && nodes.has(l[1])) edges.add(EK(l[0], l[1])); });
    lib.entries && Object.values(lib.entries).forEach(e => (e.needs || []).forEach(c => { if(nodes.has(c) && nodes.has(e.id)) edges.add(EK(c, e.id)); }));
  }
  drop.forEach(id => nodes.delete(id));
  [...edges].forEach(k => { const [a, b] = k.split('|'); if(!nodes.has(a) || !nodes.has(b)) edges.delete(k); });
  const all = new Set(edges);
  st.dropEdges.forEach(k => edges.delete(k));
  return {nodes, edges, all, rest: st.rest};
}
function keptPapers(keep, status){
  const ord = listOrder();
  return [...keep.nodes].map(id => lib.entries[id]).filter(e => e && e.kind === 'paper' && !e.parent && (status === 'all' || !status || (status === 'none' ? !stOf(e) : stOf(e) === status)))
    .sort((a, b) => (ord[a.sub] ?? 9e9) - (ord[b.sub] ?? 9e9) || byYear(a, b));
}
function linkLabel(k){
  const [a, b] = k.split('|'), l = lib.links.find(x => x[0] === a && x[1] === b), ea = lib.entries[a], eb = lib.entries[b];
  const kind = l ? ({b: 'builds on', c: 'responds to', r: 'related to', o: 'leads to'})[l[2]] || '' : 'needed by';
  const nm = e => e ? (e.kind === 'concept' ? (e.short || e.t) : mapLabel(e)) + (e.y ? ' ' + e.y : '') : '?';
  return l && (l[2] === 'b' || l[2] === 'c') ? nm(eb) + ' ' + kind + ' ' + nm(ea) : nm(ea) + ' · ' + kind + ' · ' + nm(eb);
}

function exportOpts(st){
  const keep = exportKeep(st);
  if(keep){
    const subs = new Set([...keep.nodes].map(id => lib.entries[id]).filter(e => e && e.kind === 'paper' && typeof e.y === 'number').map(e => e.sub));
    /* faint context means the rest of the map as it is on screen now; leaving it out keeps only the rows with chosen papers */
    if(keep.rest === 'faint') (MAP.lanes || []).forEach(ln => { if(!ln.concepts && ln.sub) subs.add(ln.sub.id); });
    const order = allLaneRows().map(r => r.sub.id).filter(id => subs.has(id));
    const wantConcepts = [...keep.nodes].some(id => (lib.entries[id] || {}).kind === 'concept') || (keep.rest === 'faint' && settings.showConcepts !== false && (MAP.lanes || []).some(ln => ln.concepts));
    return {subs: order, concepts: wantConcepts, notes: st.notes, legend: st.legend, allYears: st.allYears, title: st.title.trim(), width: 1400, lines: st.lines, disclaimer: st.disclaimer, keep, names: st.names};
  }
  const order = allLaneRows().map(r => r.sub.id).filter(id => st.sel.has(id));
  return {subs: order, concepts: st.concepts, notes: st.notes, legend: st.legend, allYears: st.allYears, title: st.title.trim(), width: 1400, lines: st.lines, disclaimer: st.disclaimer, names: st.names};
}

/* ---------- the map and its papers together: a long PNG, or a PDF with the list on the pages after the map ---------- */
const LIST_SANS = '"Helvetica Neue", Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const LIST_SERIF = 'Georgia, "Times New Roman", "Songti SC", "STSong", "Noto Serif SC", serif';
function wrapLines(ctx, text, maxW){
  const toks = String(text || '').match(/[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]|[^\s\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]+|\s+/g) || [];
  const lines = []; let cur = '';
  const pushTok = tok => {
    const test = cur + tok;
    if(ctx.measureText(test).width <= maxW || !cur.trim()){
      if(!cur.trim() && ctx.measureText(tok).width > maxW && tok.trim()){ for(const ch of tok){ if(ctx.measureText(cur + ch).width > maxW && cur){ lines.push(cur); cur = ''; } cur += ch; } return; }
      cur = test;
    } else { lines.push(cur.trimEnd()); cur = tok.trimStart(); }
  };
  toks.forEach(pushTok);
  if(cur.trim()) lines.push(cur.trimEnd());
  return lines;
}
/* lay the list out as blocks with heights, so it can be drawn on one long image or split into pages */
function listBlocks(ctx, es, W, o, k){
  const B = [], ink = '#1C2330', muted = '#5B6472', faint = '#8A919C';
  const font = (w, px, fam) => w + ' ' + (px * k).toFixed(1) + 'px ' + fam;
  const text = (f, color, lines, lh) => ({f, color, lines, lh: lh * k});
  B.push({h: 46 * k, gap: 0, kind: 'title', draw: (g, x, y) => { g.font = font('700', 22, LIST_SERIF); g.fillStyle = ink; g.fillText('The papers on this map', x, y + 24 * k); g.font = font('400', 12.5, LIST_SANS); g.fillStyle = muted; g.fillText(es.length + (es.length === 1 ? ' paper' : ' papers') + (o.listStatus === 'read' ? ', all read' : o.listStatus === 'want' ? ', all to read' : '') + ' · ✓ read · ○ want to read', x, y + 42 * k); }});
  let last = null;
  es.forEach(e => {
    const p = placeOf(e), place = p.topic + (p.sub ? ' › ' + p.sub : '');
    if(place !== last){ last = place; g0(); }
    function g0(){ ctx.font = font('700', 14, LIST_SANS); const ls = wrapLines(ctx, place, W); B.push({h: (14 + ls.length * 19) * k, kind: 'head', draw: (g, x, y) => { g.font = font('700', 14, LIST_SANS); g.fillStyle = ink; ls.forEach((l, i) => g.fillText(l, x, y + (14 + 14 + i * 19) * k)); g.fillStyle = '#E3E6EB'; g.fillRect(x, y + (14 + ls.length * 19 + 2) * k, W, 1 * k); }}); }
    const st = stOf(e), mark = st === 'read' ? '✓' : st === 'want' ? '○' : '';
    const ind = 18 * k, wt = W - ind;
    const parts = [];
    ctx.font = font('700', 13.5, LIST_SERIF); parts.push(text(font('700', 13.5, LIST_SERIF), ink, wrapLines(ctx, e.t || '', wt), 18));
    const meta = [e.au, e.y, e.v].filter(Boolean).join(' · ');
    if(meta){ ctx.font = font('400', 12.5, LIST_SANS); parts.push(text(font('400', 12.5, LIST_SANS), muted, wrapLines(ctx, meta, wt), 16.5)); }
    const ids = [e.doi ? 'doi.org/' + e.doi : '', e.isbn ? 'ISBN ' + e.isbn : '', e.pmid ? 'PubMed ' + e.pmid : ''].filter(Boolean).join(' · ');
    if(ids){ ctx.font = font('400', 11.5, LIST_SANS); parts.push(text(font('400', 11.5, LIST_SANS), faint, wrapLines(ctx, ids, wt), 15)); }
    if(o.listLines){
      [['Builds on', linkTitles(e.id, 'up', 'b')], ['Responds to', linkTitles(e.id, 'up', 'c')]].forEach(([lab, arr]) => { if(arr.length){ ctx.font = font('400', 11.5, LIST_SANS); parts.push(text(font('400', 11.5, LIST_SANS), faint, wrapLines(ctx, lab + ': ' + arr.join('; '), wt), 15)); } });
    }
    if(o.listNotes && e.n){ ctx.font = font('italic 400', 11.5, LIST_SANS); const ls = wrapLines(ctx, e.n.replace(/\s+/g, ' '), wt); parts.push(text(font('italic 400', 11.5, LIST_SANS), muted, ls.slice(0, 4).concat(ls.length > 4 ? ['…'] : []), 15)); }
    const h = (10 * k) + parts.reduce((s, q) => s + q.lines.length * q.lh, 0) + 4 * k;
    B.push({h, kind: 'entry', draw: (g, x, y) => {
      let yy = y + 10 * k;
      if(mark){ g.font = font('700', 13, LIST_SANS); g.fillStyle = st === 'read' ? readColor() : wantColor(); g.fillText(mark, x, yy + 13.5 * k); }
      parts.forEach(q => { g.font = q.f; g.fillStyle = q.color; q.lines.forEach(l => { yy += q.lh; g.fillText(l, x + ind, yy - q.lh * 0.25); }); });
    }});
  });
  return B;
}
/* one long image: the map, then the list under it */
async function longImage(x, es, o){
  const sc = 2, mapC = await svgToCanvas(x, sc);
  const W = mapC.width, kl = sc * Math.max(1, (W / sc) / 960), pad = 36 * kl, listW = W - pad * 2;
  const probe = document.createElement('canvas').getContext('2d');
  const blocks = listBlocks(probe, es, listW, o, kl);
  const listH = blocks.reduce((s, b) => s + b.h, 0) + pad * 1.5;
  if(mapC.height + listH > 30000) return null;
  const c = document.createElement('canvas'); c.width = W; c.height = Math.round(mapC.height + listH);
  const g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height); g.drawImage(mapC, 0, 0);
  g.fillStyle = '#E3E6EB'; g.fillRect(pad, mapC.height, listW, 1 * sc);
  let y = mapC.height + pad * 0.6; g.textBaseline = 'alphabetic';
  blocks.forEach(b => { b.draw(g, pad, y); y += b.h; });
  return c;
}
/* the list on its own, as it will sit under the map in a long PNG (for the preview) */
function listCanvas(es, o, W){
  const k = 2, pad = 28 * k, probe = document.createElement('canvas').getContext('2d');
  W = W * k;
  const blocks = listBlocks(probe, es, W - pad * 2, o, k);
  const c = document.createElement('canvas'); c.width = W; c.height = Math.min(30000, Math.round(blocks.reduce((s, b) => s + b.h, 0) + pad * 1.4));
  const g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height);
  let y = pad * 0.5; blocks.forEach(b => { if(y < c.height){ b.draw(g, pad, y); } y += b.h; });
  return c;
}
/* the list on A4 pages after the map */
async function listPages(es, o, dpi){
  const k = (dpi || 150) / 72, PW = Math.round(595 * k), PH = Math.round(842 * k), M = Math.round(56 * k), W = PW - 2 * M;
  const probe = document.createElement('canvas').getContext('2d');
  const blocks = listBlocks(probe, es, W, o, k);
  const pages = []; let cur = [], used = 0;
  blocks.forEach((b, i) => {
    const keepWithNext = b.kind === 'head' && blocks[i + 1] ? blocks[i + 1].h : 0;
    if(cur.length && used + b.h + keepWithNext > PH - 2 * M - 20 * k){ pages.push(cur); cur = []; used = 0; }
    cur.push(b); used += b.h;
  });
  if(cur.length) pages.push(cur);
  return pages.map((bl, n) => {
    const c = document.createElement('canvas'); c.width = PW; c.height = PH;
    const g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, PW, PH);
    let y = M; bl.forEach(b => { b.draw(g, M, y); y += b.h; });
    g.font = (10 * k).toFixed(1) + 'px ' + LIST_SANS; g.fillStyle = '#8A919C'; g.textAlign = 'right';
    g.fillText('Paper Map · ' + (n + 2) + ' / ' + (pages.length + 1), PW - M, PH - M * 0.5);
    return c;
  });
}
/* a PDF of several pictures, each on its own page and size */
async function picturesPdf(pages){
  const enc = new TextEncoder(), parts = [], offs = [];
  let len = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; push(n + ' 0 obj\n'); body(); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const jpgs = [];
  for(const p of pages) jpgs.push(new Uint8Array(await (await canvasBlob(p.c, 'image/jpeg', 0.9)).arrayBuffer()));
  const n = pages.length, kids = pages.map((p, i) => (3 + i * 3) + ' 0 R').join(' ');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Kids [' + kids + '] /Count ' + n + ' >>'));
  pages.forEach((p, i) => {
    const pg = 3 + i * 3, im = pg + 1, ct = pg + 2, content = 'q ' + p.w.toFixed(2) + ' 0 0 ' + p.h.toFixed(2) + ' 0 0 cm /Im0 Do Q';
    obj(pg, () => push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + p.w.toFixed(2) + ' ' + p.h.toFixed(2) + '] /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + ct + ' 0 R >>'));
    obj(im, () => { push('<< /Type /XObject /Subtype /Image /Width ' + p.c.width + ' /Height ' + p.c.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpgs[i].length + ' >>\nstream\n'); push(jpgs[i]); push('\nendstream'); });
    obj(ct, () => push('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'));
  });
  const info = 3 + n * 3;
  obj(info, () => push('<< /Producer (Paper Map) /Title (Paper Map export) >>'));
  const xref = len;
  let x = 'xref\n0 ' + (info + 1) + '\n0000000000 65535 f \n';
  for(let i = 1; i <= info; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  push(x + 'trailer\n<< /Size ' + (info + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF');
  return new Blob(parts, {type: 'application/pdf'});
}


/* a GIF writer: a palette made from the map's own colours (median cut), LZW, and only the part that changed in each frame */
function gifPalette(datas){
  const N = 32768, cnt = new Float64Array(N), sr = new Float64Array(N), sg = new Float64Array(N), sb = new Float64Array(N);
  datas.forEach(d => { for(let j = 0; j < d.length; j += 8){ const r = d[j], g = d[j + 1], b = d[j + 2], k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3); cnt[k]++; sr[k] += r; sg[k] += g; sb[k] += b; } });
  const keys = []; for(let k = 0; k < N; k++) if(cnt[k]) keys.push(k);
  const ch = (k, c) => c === 0 ? (k >> 10) & 31 : c === 1 ? (k >> 5) & 31 : k & 31;
  let boxes = [keys];
  while(boxes.length < 256){
    let bi = -1, best = 0, bc = 0;
    boxes.forEach((bx, n) => { if(bx.length < 2) return; for(let c = 0; c < 3; c++){ let lo = 31, hi = 0, w = 0; bx.forEach(k => { const v = ch(k, c); if(v < lo) lo = v; if(v > hi) hi = v; w += cnt[k]; }); const score = (hi - lo) * Math.sqrt(w); if(score > best){ best = score; bi = n; bc = c; } } });
    if(bi < 0) break;
    const bx = boxes[bi].slice().sort((a, b) => ch(a, bc) - ch(b, bc));
    let tot = 0; bx.forEach(k => tot += cnt[k]); let acc = 0, m = 0;
    for(; m < bx.length - 1; m++){ acc += cnt[bx[m]]; if(acc >= tot / 2) break; }
    m = Math.min(m, bx.length - 2);
    boxes.splice(bi, 1, bx.slice(0, m + 1), bx.slice(m + 1));
  }
  const pal = boxes.filter(bx => bx.length).map(bx => { let c = 0, r = 0, g = 0, b = 0; bx.forEach(k => { c += cnt[k]; r += sr[k]; g += sg[k]; b += sb[k]; }); return [Math.round(r / c), Math.round(g / c), Math.round(b / c)]; });
  while(pal.length < 256) pal.push([0, 0, 0]);
  return pal;
}
function gifMapper(pal){
  const lut = new Int16Array(32768).fill(-1);
  return (r, g, b) => {
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3); let v = lut[k];
    if(v < 0){ let bd = 1e9; for(let i = 0; i < 256; i++){ const p = pal[i], d = (p[0] - r) * (p[0] - r) * 3 + (p[1] - g) * (p[1] - g) * 4 + (p[2] - b) * (p[2] - b) * 2; if(d < bd){ bd = d; v = i; } } lut[k] = v; }
    return v;
  };
}
function gifLZW(pix){
  const out = [], CLEAR = 256, EOI = 257; let size = 9, next = 258, cur = 0, bits = 0, dict = new Map();
  const emit = c => { cur |= c << bits; bits += size; while(bits >= 8){ out.push(cur & 255); cur >>= 8; bits -= 8; } };
  emit(CLEAR);
  let w = pix[0];
  for(let i = 1; i < pix.length; i++){
    const k = pix[i], key = w * 4096 + k, v = dict.get(key);
    if(v !== undefined){ w = v; continue; }
    emit(w);
    if(next < 4096){ dict.set(key, next++); if(next > (1 << size) && size < 12) size++; }
    else { emit(CLEAR); dict = new Map(); size = 9; next = 258; }
    w = k;
  }
  emit(w); emit(EOI); if(bits > 0) out.push(cur & 255);
  return out;
}
function encodeGIF(frames, w, h, delays){
  const pal = gifPalette([frames[frames.length - 1], frames[Math.floor(frames.length / 2)], frames[0]]), near = gifMapper(pal);
  const bytes = [], str = s => { for(const ch of s) bytes.push(ch.charCodeAt(0)); }, u16 = v => bytes.push(v & 255, (v >> 8) & 255);
  str('GIF89a'); u16(w); u16(h); bytes.push(0xF7, 0, 0); pal.forEach(c => bytes.push(c[0], c[1], c[2]));
  bytes.push(0x21, 0xFF, 11); str('NETSCAPE2.0'); bytes.push(3, 1, 0, 0, 0);
  let prev = null;
  const idxs = frames.map(data => { const a = new Uint8Array(w * h); for(let i = 0, j = 0; i < a.length; i++, j += 4) a[i] = near(data[j], data[j + 1], data[j + 2]); return a; });
  idxs.forEach((a, fi) => {
    let x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
    if(prev){ x0 = w; y0 = h; x1 = -1; y1 = -1;
      for(let y = 0; y < h; y++){ const o = y * w; for(let x = 0; x < w; x++) if(a[o + x] !== prev[o + x]){ if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; } }
      if(x1 < 0){ x0 = y0 = 0; x1 = y1 = 0; } }
    const cw = x1 - x0 + 1, chh = y1 - y0 + 1, sub = new Uint8Array(cw * chh);
    for(let y = 0; y < chh; y++) sub.set(a.subarray((y + y0) * w + x0, (y + y0) * w + x0 + cw), y * cw);
    bytes.push(0x21, 0xF9, 4, 0x04); u16(Math.round((delays[fi] || 60) / 10)); bytes.push(0, 0);
    bytes.push(0x2C); u16(x0); u16(y0); u16(cw); u16(chh); bytes.push(0);
    const lz = gifLZW(sub); bytes.push(8);
    for(let i = 0; i < lz.length; i += 255){ const n = Math.min(255, lz.length - i); bytes.push(n); for(let k = 0; k < n; k++) bytes.push(lz[i + k]); }
    bytes.push(0); prev = a;
  });
  bytes.push(0x3B);
  return new Blob([new Uint8Array(bytes)], {type: 'image/gif'});
}
/* a GIF written as it goes, frame by frame, so long animations don't need every frame in memory */
function gifStream(w, h, pal){
  const near = gifMapper(pal), parts = [], hdr = [], str = (a, s) => { for(const ch of s) a.push(ch.charCodeAt(0)); }, u16 = (a, v) => a.push(v & 255, (v >> 8) & 255);
  str(hdr, 'GIF89a'); u16(hdr, w); u16(hdr, h); hdr.push(0xF7, 0, 0); pal.forEach(c => hdr.push(c[0], c[1], c[2]));
  hdr.push(0x21, 0xFF, 11); str(hdr, 'NETSCAPE2.0'); hdr.push(3, 1, 0, 0, 0); parts.push(new Uint8Array(hdr));
  let prev = null, pending = null;
  const flush = (delay) => {
    if(!pending) return; const {a, x0, y0, cw, chh} = pending, sub = new Uint8Array(cw * chh);
    for(let y = 0; y < chh; y++) sub.set(a.subarray((y + y0) * w + x0, (y + y0) * w + x0 + cw), y * cw);
    const out = [0x21, 0xF9, 4, 0x04]; u16(out, Math.max(2, Math.round(delay / 10))); out.push(0, 0, 0x2C); u16(out, x0); u16(out, y0); u16(out, cw); u16(out, chh); out.push(0, 8);
    const lz = gifLZW(sub); for(let i = 0; i < lz.length; i += 255){ const n = Math.min(255, lz.length - i); out.push(n); for(let k = 0; k < n; k++) out.push(lz[i + k]); }
    out.push(0); parts.push(new Uint8Array(out)); pending = null;
  };
  return {
    add(data, delay){
      const a = new Uint8Array(w * h); for(let i = 0, j = 0; i < a.length; i++, j += 4) a[i] = near(data[j], data[j + 1], data[j + 2]);
      let x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
      if(prev){ x0 = w; y0 = h; x1 = -1; y1 = -1;
        for(let y = 0; y < h; y++){ const o = y * w; for(let x = 0; x < w; x++) if(a[o + x] !== prev[o + x]){ if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; } }
        if(x1 < 0){ if(pending) pending.extra = (pending.extra || 0) + delay; return; } }
      if(pending) flush(pending.delay + (pending.extra || 0));
      pending = {a, x0, y0, cw: x1 - x0 + 1, chh: y1 - y0 + 1, delay}; prev = a;
    },
    finish(lastDelay){ if(pending) flush((pending.extra || 0) + (lastDelay || pending.delay)); parts.push(new Uint8Array([0x3B])); return new Blob(parts, {type: 'image/gif'}); }
  };
}
/* the map growing: papers appear in their year with a small bounce, lines draw themselves from the earlier
   paper to the later one, names fade in, and a quiet line sweeps along the years with the year counting up */
async function growthGIF(x, onProgress){
  const yearOf = id => (lib.entries[id] || {}).y;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-200000px;top:0;width:' + x.w + 'px;height:' + x.h + 'px;pointer-events:none';
  host.innerHTML = x.svg; document.body.appendChild(host);
  try{
    const svg = host.querySelector('svg'); if(!svg) return null;
    const ys = [...new Set([...svg.querySelectorAll('[data-id]')].map(n => yearOf(n.getAttribute('data-id'))).filter(y => typeof y === 'number'))].sort((a, b) => a - b);
    if(!ys.length) return null;
    const first = ys[0], last = ys[ys.length - 1], t0 = first - 1.2, t1 = last + 2.6;
    const ease = v => v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2, back = v => { const c = 1.9; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); };
    const clamp = v => Math.max(0, Math.min(1, v));
    const opOf = el => { const m = (el.getAttribute('style') || '').match(/(?:^|;)\s*opacity:\s*([\d.]+)/); return m ? +m[1] : 1; };
    /* what grows */
    const groups = [...svg.querySelectorAll('g[data-id]')].map(g => { const c = g.querySelector('circle'); return {el: g, y: yearOf(g.getAttribute('data-id')), cx: c ? +c.getAttribute('cx') : 0, cy: c ? +c.getAttribute('cy') : 0, op: opOf(g)}; }).filter(o => typeof o.y === 'number');
    const texts = [...svg.querySelectorAll('text[data-id]')].map(el => ({el, y: yearOf(el.getAttribute('data-id')), op: opOf(el)})).filter(o => typeof o.y === 'number');
    const edges = [...svg.querySelectorAll('[data-a][data-b]')].map(el => {
      const ya = yearOf(el.getAttribute('data-a')), yb = yearOf(el.getAttribute('data-b')); if(typeof ya !== 'number' || typeof yb !== 'number') return null;
      const st = el.getAttribute('style') || '', dashed = /stroke-dasharray:\s*(?!none)[\d.]/.test(st), tag = el.localName;
      let len = 0; if(tag === 'path'){ try{ len = el.getTotalLength(); }catch(err){} }
      const kind = tag === 'text' ? 'note' : (tag === 'path' && len > 26 && !dashed) ? 'draw' : (tag === 'path' && len <= 26) ? 'arrow' : 'fade';
      return {el, start: Math.max(ya, yb), kind, len, op: opOf(el)};
    }).filter(Boolean);
    /* years → across the plot, read off the dots themselves */
    const plot = svg.querySelector('svg'); let fit = null;
    if(groups.length > 1){ const n = groups.length, mx = groups.reduce((s, o) => s + o.y, 0) / n, mv = groups.reduce((s, o) => s + o.cx, 0) / n; let num = 0, den = 0; groups.forEach(o => { num += (o.y - mx) * (o.cx - mv); den += (o.y - mx) * (o.y - mx); }); if(den > 0){ const a = num / den; fit = {a, b: mv - a * mx}; } }
    const ns = 'http://www.w3.org/2000/svg';
    let sweep = null;
    if(plot && fit){ sweep = document.createElementNS(ns, 'line'); sweep.setAttribute('y1', '0'); sweep.setAttribute('y2', plot.getAttribute('height') || '1000'); sweep.setAttribute('style', 'stroke:#7058A3;stroke-width:1.4;opacity:.0'); plot.appendChild(sweep); }
    const counter = document.createElementNS(ns, 'text'); counter.setAttribute('x', String(x.w - 40)); counter.setAttribute('y', '64'); counter.setAttribute('text-anchor', 'end');
    counter.setAttribute('style', 'font:700 34px Georgia, serif;fill:#1C2330;opacity:.82;font-variant-numeric:tabular-nums'); svg.appendChild(counter);
    const paint = T => {
      groups.forEach(o => { const p = clamp((T - o.y) / 1.5); if(p <= 0){ o.el.style.opacity = '0'; return; } const s = back(p);
        o.el.style.opacity = String(Math.min(1, p * 2) * o.op); o.el.setAttribute('transform', 'translate(' + o.cx + ' ' + o.cy + ') scale(' + s.toFixed(3) + ') translate(' + (-o.cx) + ' ' + (-o.cy) + ')'); });
      texts.forEach(o => { const p = clamp((T - o.y - .5) / 1.3); o.el.style.opacity = String(ease(p) * o.op); });
      edges.forEach(o => { const p = clamp((T - o.start - .2) / 2.4), q = ease(p);
        if(o.kind === 'draw'){ o.el.style.strokeDasharray = o.len + ' ' + o.len; o.el.style.strokeDashoffset = String(o.len * (1 - q)); o.el.style.opacity = p > 0 ? String(o.op) : '0'; }
        else if(o.kind === 'arrow') o.el.style.opacity = String(clamp((p - .8) / .2) * o.op);
        else if(o.kind === 'note') o.el.style.opacity = String(clamp((p - .75) / .25) * o.op);
        else o.el.style.opacity = String(q * o.op); });
      if(sweep){ const X = fit.a * T + fit.b, fade = T <= last + .8 ? clamp((T - t0) / 1.5) : clamp(1 - (T - last - .8) / 1.2); sweep.setAttribute('x1', X.toFixed(1)); sweep.setAttribute('x2', X.toFixed(1)); sweep.setAttribute('style', 'stroke:#7058A3;stroke-width:1.4;opacity:' + (0.28 * fade).toFixed(3)); }
      counter.textContent = String(Math.max(first, Math.min(last, Math.floor(T))));
    };
    const sc = Math.min(2, 1600 / x.w), w = Math.round(x.w * sc), h = Math.round(x.h * sc);
    const frameOf = async T => { paint(T); const c = await svgToCanvas({svg: new XMLSerializer().serializeToString(svg), w: x.w, h: x.h}, sc); return c.getContext('2d').getImageData(0, 0, w, h).data; };
    /* the palette from the finished map and an early frame */
    const pal = gifPalette([await frameOf(t1), await frameOf(first + (last - first) * .35)]);
    const N = Math.round(Math.max(70, Math.min(150, (t1 - t0) * 1.9))), enc = gifStream(w, h, pal);
    for(let i = 0; i <= N; i++){
      const T = t0 + (t1 - t0) * (i / N);
      enc.add(await frameOf(T), 50);
      if(onProgress) onProgress(i / N);
      if(i % 6 === 0) await new Promise(r => setTimeout(r, 0));
    }
    return enc.finish(2800);
  } finally { host.remove(); }
}

async function doExport(st){
  const x = buildExportSVG(exportOpts(st));
  if(!x){ toast('Choose at least one topic with papers'); return; }
  const btn = document.querySelector('#modalActions .primary'); if(btn){ btn.disabled = true; btn.textContent = 'Exporting…'; }
  try{
    const name = slugName(st.title) + (st.list && st.format !== 'gif' ? '-map-and-papers-' : st.format === 'gif' ? '-growing-' : '-') + new Date().toISOString().slice(0, 10) + '.' + st.format;
    if(st.format === 'gif'){
      const g = await growthGIF(x, f => { if(btn) btn.textContent = 'Making the GIF… ' + Math.round(f * 100) + '%'; }); if(!g){ if(btn){ btn.disabled = false; btn.textContent = 'Export'; } toast('Nothing to animate'); return; }
      const rg = await saveBlobAs(g, name); if(rg === 'cancelled'){ if(btn){ btn.disabled = false; btn.textContent = 'Export'; } return; }
      closeModal(); toast(rg === 'saved' ? 'Saved ' + name : 'Downloaded ' + name); return;
    }
    const eo = exportOpts(st), es = st.list ? (eo.keep ? keptPapers(eo.keep, st.listStatus) : papersFor({subs: new Set(eo.subs), status: st.listStatus})) : [];
    let blob;
    if(st.list && es.length && st.format === 'png'){
      const c = await longImage(x, es, st);
      if(!c){ if(btn){ btn.disabled = false; btn.textContent = 'Export'; } toast('That list is too long for one image. Choose PDF instead.'); return; }
      blob = await canvasBlob(c, 'image/png');
    }else if(st.list && es.length){
      blob = vectorPdf([mapPdfPage(x)].concat(listPdfPages(es, st)), st.title || 'Paper Map');
    }else{
      blob = st.format === 'pdf' ? vectorPdf([mapPdfPage(x)], st.title || 'Paper Map') : await canvasBlob(await svgToCanvas(x, 3), 'image/png');
    }
    const r = await saveBlobAs(blob, name);
    if(r === 'cancelled'){ if(btn){ btn.disabled = false; btn.textContent = 'Export'; } return; }
    closeModal(); toast(r === 'saved' ? 'Saved ' + name : 'Downloaded ' + name);
  }catch(e){ if(btn){ btn.disabled = false; btn.textContent = 'Export'; } toast('The picture couldn’t be made in this browser'); }
}
