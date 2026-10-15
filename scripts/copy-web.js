// Copies the web app into www/, the folder Capacitor packages into the phone apps.
// In the app build, fonts are bundled locally (from @fontsource) instead of loaded from Google Fonts,
// so the app works fully offline and makes no third-party font requests.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
const items = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const it of items) fs.cpSync(path.join(root, it), path.join(out, it), { recursive: true });

const fonts = [['barlow-condensed', 'Barlow Condensed', [600, 700]], ['figtree', 'Figtree', [400, 500, 600, 700, 800]]];
const nm = path.join(root, 'node_modules', '@fontsource');
if (fonts.every(([pkg]) => fs.existsSync(path.join(nm, pkg)))) {
  fs.mkdirSync(path.join(out, 'fonts'));
  let css = '';
  for (const [pkg, family, weights] of fonts) {
    for (const w of weights) {
      const file = `${pkg}-latin-${w}-normal.woff2`;
      fs.copyFileSync(path.join(nm, pkg, 'files', file), path.join(out, 'fonts', file));
      css += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(../fonts/${file}) format('woff2');}\n`;
    }
  }
  fs.writeFileSync(path.join(out, 'css', 'fonts.css'), css);
  // The fonts are under the SIL Open Font License, which asks that the license travel with the font files.
  for (const [pkg] of fonts) { const lic = ['LICENSE', 'LICENSE.md', 'OFL.txt'].map(f => path.join(nm, pkg, f)).find(f => fs.existsSync(f)); if (lic) fs.copyFileSync(lic, path.join(out, 'fonts', `${pkg}-LICENSE.txt`)); }
  const idx = path.join(out, 'index.html');
  let html = fs.readFileSync(idx, 'utf8');
  html = html.replace(/<link rel="preconnect"[^>]*>\s*/g, '')
    .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link rel="stylesheet" href="css/fonts.css">');
  fs.writeFileSync(idx, html);
  console.log('Bundled fonts locally');
}
console.log('Copied web app to www/');
