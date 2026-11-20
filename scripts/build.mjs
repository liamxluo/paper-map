// Builds Paper Map from src/: the web version (index.html at the top of the repository, for GitHub Pages)
// and dist/ (the files the Mac app is made from). No dependencies: node scripts/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
/* the desk: its own page, given to the app as one string (an iframe's srcdoc) */
const desk = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Paper Map · Desk</title><style>'
  + rd('src/desk/fonts.css') + '</style><style>' + rd('src/desk/desk-base.css') + '\n' + rd('src/desk/desk.css') + '</style></head>'
  + rd('src/desk/desk-body.html') + '<script>' + rd('src/desk/desk.js') + '</script>\n</body></html>';
const deskSrc = JSON.stringify(desk).replaceAll('</', '<\\/').replaceAll('<!--', '<\\!--');
/* the app */
const order = JSON.parse(rd('src/app/order.json'));
const css = order.styles.map(f => rd('src/app/styles/' + f)).join('\n');
const js = order.js.map(f => rd('src/app/js/' + f)).join('\n').replace('const DESK_SRC = __DESK_SRC__;', () => 'const DESK_SRC = ' + deskSrc + ';');
const html = [rd('src/app/head.html'), css, rd('src/app/body.html'), js, rd('src/app/tail.html')].join('\n');
fs.writeFileSync(path.join(ROOT, 'index.html'), html);
/* dist/: what goes inside the Mac app */
const DIST = path.join(ROOT, 'dist');
fs.rmSync(DIST, {recursive: true, force: true}); fs.mkdirSync(DIST, {recursive: true});
const copy = (from, to) => fs.cpSync(path.join(ROOT, from), path.join(DIST, to || from), {recursive: true});
fs.writeFileSync(path.join(DIST, 'index.html'), html);
/* everything the app loads while it runs: the desk, the PDF reader (pdf.js), the e-book reader (foliate-js) and the example library */
['manifest.webmanifest', 'icons', 'assets/desk', 'assets/vendor', 'example'].forEach(p => { if(fs.existsSync(path.join(ROOT, p))) copy(p); });
console.log('index.html ' + Math.round(html.length / 1024) + ' KB; dist/ ready');
