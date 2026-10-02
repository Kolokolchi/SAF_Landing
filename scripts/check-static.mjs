import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const decodeAttribute = (value) => value
  .replace(/&quot;|&#34;|&#x22;/gi, '"')
  .replace(/&apos;|&#39;|&#x27;/gi, "'")
  .replace(/&amp;/g, '&');
const resources = new Set();
let galleries = 0;

for (const filename of ['index.html', 'avenue.html', 'avenuekz.html', 'privacy.html', 'privacykz.html']) {
  const html = await readFile(path.join(root, filename), 'utf8');
  const base = html.match(/data-site-base="([^"]+)"/)?.[1];
  assert.ok(base, `Missing site base in ${filename}`);
  const decoded = decodeAttribute(html);
  if (base !== '/') {
    assert.ok(!/(?:^|[="'`(\s])\/(?:assets\/|custom\.css\b|local-runtime\.js\b|avenuekz\b|avenue\b|privacykz\b|privacy\b)/.test(decoded),
      `URL points outside the project base in ${filename}`);
  }
  const pattern = /(?:^|[="'`(\s])(\/[^"'`<>\s)]*)/g;
  for (const [, reference] of decoded.matchAll(pattern)) {
    if (!reference.startsWith(base)) continue;
    const relative = decodeURIComponent(new URL(reference, 'https://example.test').pathname.slice(base.length));
    if (!/^(?:assets\/|custom\.css$|local-runtime\.js$|avenue(?:kz)?(?:\.html)?\/?$|privacy(?:kz)?(?:\.html)?\/?$)/.test(relative)) continue;
    const resource = path.join(root, relative);
    const info = await stat(resource).catch(() => null);
    assert.ok(info, `Missing resource in ${filename}: ${reference}`);
    if (info.isDirectory() && !relative.startsWith('assets/')) {
      assert.ok((await stat(path.join(resource, 'index.html'))).isFile(), `Missing route: ${reference}`);
    }
    resources.add(relative);
  }
  for (const [, encoded] of html.matchAll(/data-field-imgs-value="([^"]+)"/g)) {
    const images = JSON.parse(decodeAttribute(encoded));
    for (const image of images) {
      assert.ok(image.li_img.startsWith(base + 'assets/'), `Gallery image outside the project: ${image.li_img}`);
      assert.ok((await stat(path.join(root, image.li_img.slice(base.length)))).isFile(), `Missing gallery image: ${image.li_img}`);
    }
    galleries++;
  }
}
assert.ok(galleries >= 6, 'Russian and Kazakh galleries must be included');
for (const entry of await readdir(root)) {
  assert.ok(!['data', 'node_modules', 'server.mjs'].includes(entry), `Private file in static output: ${entry}`);
}
console.log(`Static build verified: 5 pages, ${galleries} galleries, ${resources.size} local resources.`);
