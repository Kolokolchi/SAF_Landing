import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import { after, before, test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let child, port;
before(async () => {
  child = spawn(process.execPath, ['server.mjs', '--port', '0'], { cwd: root, env: { ...process.env, PORT: '', NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    let output = '', errors = '';
    const timeout = setTimeout(() => reject(new Error('Server startup timed out: ' + errors)), 10_000);
    child.stderr.on('data', data => { errors += data; });
    child.stdout.on('data', data => {
      output += data;
      const match = output.match(/localhost:(\d+)\/avenue/);
      if (match) { clearTimeout(timeout); port = Number(match[1]); resolve(); }
    });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited with ${code}: ${errors}`)); });
  });
});
after(async () => {
  if (child && child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
});

function request(route, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: route, method: options.method || 'GET', headers: options.headers }, res => {
      const chunks = [];
      res.on('data', data => chunks.push(data));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(options.body);
  });
}

test('Windows traversal and encoded slash cannot expose private files', async () => {
  for (const route of [
    '/assets/%2e%2e%5cpackage.json', '/assets/%2e%2e%5cserver.mjs',
    '/assets/%2e%2e%5cdata%5cleads.jsonl', '/assets/..%2fpackage.json',
    '/assets/images/..%2f..%2fpackage.json', '/assets/%252e%252e%255cpackage.json',
    '/assets/images/avenue-panorama.png%3A%24DATA', '/assets/%00/package.json',
  ]) assert.equal((await request(route)).status, 404, route);
  assert.equal((await request('/assets/images/avenue-panorama.png')).status, 200);
});

test('Malformed URLs return 400 and leave the server running', async () => {
  for (const route of ['/%', '/%ZZ', '/%E0%A4%A']) {
    assert.equal((await request(route)).status, 400, route);
    assert.equal((await request('/avenue')).status, 200);
  }
  assert.equal(child.exitCode, null);
});

test('Kazakh privacy link has a served Kazakh page', async () => {
  const page = await request('/privacykz');
  assert.equal(page.status, 200);
  assert.ok(page.body.includes('ҚҰПИЯЛЫЛЫҚ САЯСАТЫ'));
  assert.ok(page.body.includes('href="/avenuekz"'));
  assert.ok((await request('/avenuekz')).body.includes('href="/privacykz"'));
});

test('Bad and oversized form bodies do not stop the server', async () => {
  for (const body of ['{', 'null', '{}']) {
    assert.equal((await request('/api/leads', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } })).status, 400);
  }
  assert.equal((await request('/api/leads', { method: 'POST', body: 'x'.repeat(17_000) })).status, 413);
  assert.equal((await request('/avenue')).status, 200);
});

test('An interrupted form upload does not crash the request handler', async () => {
  await new Promise(resolve => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/api/leads', method: 'POST', headers: { 'Content-Length': '1000' } });
    req.on('error', () => {});
    req.on('close', resolve);
    req.write('{"name":');
    setTimeout(() => req.destroy(), 30);
  });
  await pause(60);
  assert.equal((await request('/avenue')).status, 200);
  assert.equal(child.exitCode, null);
});
