import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.CHECK_URL || 'http://localhost:5173';
const manifest = JSON.parse(await readFile(path.join(root, 'asset-manifest.json'), 'utf8'));
const materialImages = (await readdir(path.join(root, 'assets/images/materials')))
  .filter(file => file.endsWith('.jpg')).map(file => '/assets/images/materials/' + file);
assert.equal(materialImages.length, 7, 'All seven material illustrations must be present');
const paths = [...new Set(Object.values(manifest)), '/assets/catalog/buildings.svg', ...materialImages];
for (const resource of paths) {
  const file = path.join(root, resource.slice(1));
  assert.ok((await stat(file)).size > 0, `Empty resource: ${resource}`);
  if (file.endsWith('.woff')) {
    const bytes = await readFile(file);
    assert.equal(bytes.subarray(0, 4).toString(), 'wOFF', `Invalid font: ${file}`);
  }
}
for (const page of ['index.html', 'avenue.html', 'avenuekz.html', 'privacy.html', 'privacykz.html']) {
  const text = await readFile(path.join(root, page), 'utf8');
  assert.ok(!text.includes('googletagmanager.com'), `Tracking code in ${page}`);
  assert.ok(!/https:\/\/(?:static|thb)\.tildacdn\.[a-z]+\//.test(text), `Remote visual asset in ${page}`);
  assert.ok(text.includes('/local-runtime.js'));
}
for (const route of ['/', '/avenue', '/avenuekz', '/privacy', '/privacykz', '/local-runtime.js', '/custom.css']) {
  const response = await fetch(base + route);
  assert.equal(response.status, 200, route);
}
for (let i = 0; i < paths.length; i += 16) {
  await Promise.all(paths.slice(i, i + 16).map(async resource => {
    const response = await fetch(base + encodeURI(resource), { method: 'HEAD' });
    assert.equal(response.status, 200, resource);
    assert.ok(Number(response.headers.get('content-length')) > 0, resource);
  }));
}
const malformed = await fetch(base + '/api/leads', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test' }),
});
assert.equal(malformed.status, 400, 'Incomplete contact must not be accepted');
for (const route of ['/data/leads.jsonl', '/source.html', '/server.mjs', '/package.json', '/assets/../../data/leads.jsonl']) {
  assert.equal((await fetch(base + route)).status, 404, `Private file exposed: ${route}`);
}
// Encoded Windows separators must be tested without normalizing away the attack.
for (const route of ['/assets/%2e%2e%5cpackage.json', '/assets/%2e%2e%5cserver.mjs', '/assets/%2e%2e%5cdata%5cleads.jsonl', '/assets/..%2fpackage.json', '/assets/images/avenue-panorama.png%3A%24DATA']) {
  assert.equal((await fetch(base + route)).status, 404, `Private path exposed: ${route}`);
}
for (const route of ['/%', '/%ZZ', '/%E0%A4%A']) {
  assert.equal((await fetch(base + route)).status, 400, `Malformed URL: ${route}`);
  assert.equal((await fetch(base + '/avenue')).status, 200, 'Server must survive malformed URLs');
}
console.log(`Passed: 5 HTML pages, ${paths.length} static resources, routes, fonts, validation, private files, traversal and malformed URLs.`);
