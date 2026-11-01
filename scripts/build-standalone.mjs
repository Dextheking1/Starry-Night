import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Inline the production bundle and fonts so this edition also opens directly
// from disk without a server, an account, or a network connection.
const root = path.resolve('dist');
const licenseFiles = ['three', '@fontsource/cormorant-garamond', '@fontsource/dm-sans'];
const licenses = (await Promise.all(licenseFiles.map(async name => `${name}\n${await readFile(path.join('node_modules', name, 'LICENSE'), 'utf8')}`))).join('\n\n');
await writeFile(path.join(root, 'THIRD-PARTY-LICENSES.txt'), licenses);
let html = await readFile(path.join(root, 'index.html'), 'utf8');
const moduleTag = html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);
const stylesheetTag = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
if (!moduleTag || !stylesheetTag) throw new Error('Build assets missing. Run npm run build first.');
const js = await readFile(path.join(root, moduleTag[1]), 'utf8');
let css = await readFile(path.join(root, stylesheetTag[1]), 'utf8');
for (const match of [...css.matchAll(/url\(([^)]+)\)/g)]) {
  const url = match[1].replace(/^['"]|['"]$/g, '');
  if (!url.startsWith('/assets/')) continue;
  const bytes = await readFile(path.join(root, url));
  const type = url.endsWith('.woff2') ? 'font/woff2' : 'font/woff';
  css = css.replaceAll(match[0], `url(data:${type};base64,${bytes.toString('base64')})`);
}
html = html.replace('<head>', () => `<head>\n<!-- Bundled library and font licenses:\n${licenses.replaceAll('--', '—')}\n-->`);
html = html.replace(moduleTag[0], () => `<script type="module">${js.replaceAll('</script', '<\\/script')}</script>`);
html = html.replace(stylesheetTag[0], () => `<style>${css}</style>`);
const icon = await readFile('public/favicon.svg', 'utf8');
html = html.replace('href="/favicon.svg"', `href="data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}"`);
await writeFile(path.join(root, 'starry-night.html'), html);
console.log(`Standalone game: dist/starry-night.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
