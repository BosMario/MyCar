// XMAX Logbook build: src/index.src.html -> index.html (self-contained, offline, no CDN, no runtime Babel)
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const V = (f) => path.join(__dirname, 'vendor', f);

const VENDORS = {
  'react.js': 'https://unpkg.com/react@18/umd/react.production.min.js',
  'react-dom.js': 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'tailwind.js': 'https://cdn.tailwindcss.com/3.4.16',
  'babel.js': 'https://unpkg.com/@babel/standalone@7/babel.min.js',
};

async function ensureVendors() {
  await mkdir(path.join(__dirname, 'vendor'), { recursive: true });
  for (const [file, url] of Object.entries(VENDORS)) {
    try { await access(V(file)); }
    catch {
      process.stdout.write('↓ fetching ' + file + ' ... ');
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed ' + url + ' ' + res.status);
      await writeFile(V(file), Buffer.from(await res.arrayBuffer()));
      console.log('done');
    }
  }
}

// neutralize accidental "</script>" so inlined JS can't break the HTML parser
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');

async function main() {
  await ensureVendors();
  const require = createRequire(import.meta.url);
  const Babel = require(V('babel.js'));

  let html = await readFile(path.join(__dirname, 'src', 'index.src.html'), 'utf8');

  const [react, reactDom, tailwind] = await Promise.all([
    readFile(V('react.js'), 'utf8'), readFile(V('react-dom.js'), 'utf8'), readFile(V('tailwind.js'), 'utf8'),
  ]);

  // 1) extract + transpile the app (text/babel) script
  const appRe = /<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/;
  const m = html.match(appRe);
  if (!m) throw new Error('app script not found in source');
  const compiled = Babel.transform(m[1], {
    presets: ['react', ['env', { targets: { safari: '15', chrome: '90' }, loose: true }]],
  }).code;

  // NOTE: use FUNCTION replacements everywhere — string replacements treat $&, $`, $', $$
  // specially, and minified vendor code is full of `$`, which corrupts the output.

  // 2) inline tailwind (keep the tailwind.config script that follows it)
  html = html.replace('<script src="https://cdn.tailwindcss.com"></script>', () => '<script>' + safe(tailwind) + '</script>');

  // 3) inline react + react-dom, drop babel CDN
  html = html.replace('<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>', () => '<script>' + safe(react) + '</script>');
  html = html.replace('<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>', () => '<script>' + safe(reactDom) + '</script>');
  html = html.replace('  <script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>\n', () => '');

  // 4) swap the app script for precompiled plain JS
  html = html.replace(appRe, () => '<script>\n' + safe(compiled) + '\n</script>');

  // 5) build marker
  html = html.replace('<title>XMAX Logbook</title>', '<title>XMAX Logbook</title>\n  <!-- self-contained offline build · no CDN · no runtime Babel -->');

  await writeFile(path.join(__dirname, 'index.html'), html);
  const kb = (html.length / 1024).toFixed(0);
  console.log('✓ built index.html (' + kb + ' KB, fully self-contained)');

  // emit network-first service worker (fresh HTML when online, cached when offline)
  const build = String(Date.now());
  const sw = [
    "const CACHE = 'xmax-" + build + "';",
    "self.addEventListener('install', e => self.skipWaiting());",
    "self.addEventListener('message', e => { if (e.data === 'skip-waiting') self.skipWaiting(); });",
    "self.addEventListener('activate', e => e.waitUntil((async () => {",
    "  const keys = await caches.keys();",
    "  await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));",
    "  await self.clients.claim();",
    "})()));",
    "self.addEventListener('fetch', e => {",
    "  const req = e.request;",
    "  if (req.method !== 'GET') return;",
    "  const url = new URL(req.url);",
    "  if (url.origin !== location.origin) return;",
    "  const isDoc = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');",
    "  e.respondWith((async () => {",
    "    if (isDoc) {",
    "      try { const net = await fetch(req, { cache: 'no-store' }); (await caches.open(CACHE)).put('./index.html', net.clone()); return net; }",
    "      catch (err) { return (await caches.match('./index.html')) || (await caches.match(req)) || Response.error(); }",
    "    }",
    "    const cached = await caches.match(req);",
    "    if (cached) return cached;",
    "    try { const net = await fetch(req); if (net && net.status === 200) (await caches.open(CACHE)).put(req, net.clone()); return net; }",
    "    catch (err) { return cached || Response.error(); }",
    "  })());",
    "});",
  ].join('\n');
  await writeFile(path.join(__dirname, 'sw.js'), sw);
  console.log('✓ wrote sw.js (cache xmax-' + build + ')');
}

main().catch(e => { console.error('BUILD FAILED:', e.message); process.exit(1); });
