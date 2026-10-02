import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const baseIndex = process.argv.indexOf('--base');
const requestedBase = baseIndex >= 0 ? process.argv[baseIndex + 1] : '/';
if (!requestedBase || !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(requestedBase)) {
  throw new Error('The --base path must start and end with /, e.g. /SAF_Landing/.');
}
const base = requestedBase;
const staticHost = process.argv.includes('--static');
if (path.dirname(out) !== root || path.basename(out) !== 'dist') throw new Error('Invalid build output path');
await rm(out, { recursive: true, force: true });
await mkdir(out);
for (const file of ['assets', 'index.html', 'avenue.html', 'avenuekz.html', 'privacy.html', 'privacykz.html', 'custom.css', 'local-runtime.js']) {
  await cp(path.join(root, file), path.join(out, file), { recursive: true });
}
for (const page of ['avenue', 'avenuekz', 'privacy', 'privacykz']) {
  await mkdir(path.join(out, page));
  await cp(path.join(root, page + '.html'), path.join(out, page, 'index.html'));
}

async function prepare(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      await prepare(file);
      continue;
    }
    if (!/\.(?:html|css|js|svg)$/.test(entry.name)) continue;
    let content = await readFile(file, 'utf8');
    if (base !== '/') {
      // Rebase local URLs without touching external URLs, anchors, or regular expressions.
      content = content.replace(/(^|[="'`(\s]|&quot;|&apos;|&#(?:34|39);|&#x(?:22|27);)\/(?=assets\/|custom\.css\b|local-runtime\.js\b)/gi,
        (_, prefix) => prefix + base);
      if (entry.name.endsWith('.html')) {
        content = content.replace(/(^|[="'`(\s]|&quot;|&apos;|&#(?:34|39);|&#x(?:22|27);)\/(?=avenuekz\b|avenue\b|privacykz\b|privacy\b)/gi,
          (_, prefix) => prefix + base);
      }
    }
    if (entry.name.endsWith('.html')) {
      content = content.replace(/<html\b/i,
        `<html data-site-base="${base}"${staticHost ? ' data-static-host="true"' : ''}`);
    }
    await writeFile(file, content);
  }
}
await prepare(out);
await writeFile(path.join(out, '.nojekyll'), '');
console.log(`Static copy built in dist/ for ${base}. ${staticHost ? 'Forms offer WhatsApp contact on the static host.' : 'Forms use /api/leads on the Node server.'}`);
