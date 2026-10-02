import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = '/__dev/agentation.js';
const pages = ['/', '/avenue', '/avenuekz', '/privacy', '/privacykz', '/avenue.html'];

async function withServer(env, args, run) {
  const child = spawn(process.execPath, ['server.mjs', '--port', '0', ...args], {
    cwd: root, env: { ...process.env, PORT: '', NODE_ENV: env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const base = await new Promise((resolve, reject) => {
      let output = '', errors = '';
      const timeout = setTimeout(() => reject(new Error('Server startup timed out: ' + errors)), 15_000);
      child.stderr.on('data', data => { errors += data; });
      child.stdout.on('data', data => {
        output += data;
        const match = output.match(/localhost:(\d+)\/avenue/);
        if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
      });
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${errors}`)); });
    });
    await run(base);
  } finally {
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  }
}

test('Development compiles and serves Agentation globally without changing source pages', async () => {
  const original = await readFile(path.join(root, 'avenue.html'), 'utf8');
  for (const [env, args] of [['', ['--dev']], ['development', []]]) {
    await withServer(env, args, async base => {
      for (const page of pages) {
        const response = await fetch(base + page);
        const html = await response.text();
        assert.equal(response.status, 200);
        assert.equal(html.split(`src="${script}"`).length - 1, 1, page);
        assert.equal(Number(response.headers.get('content-length')), Buffer.byteLength(html));
      }
      const response = await fetch(base + script);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /javascript/);
      const bundle = await response.text();
      assert.ok(bundle.includes('agentation-dev-root'));
      assert.ok(bundle.includes('SAF Avenue'));
      assert.ok(!/\bimport\s+.*?from\s+["'](?:react|agentation)/.test(bundle));
      const head = await fetch(base + script, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(await head.text(), '');
      assert.equal(head.headers.get('content-length'), response.headers.get('content-length'));
      assert.equal((await fetch(base + '/scripts/agentation-entry.jsx')).status, 404);
      assert.equal((await fetch(base + '/node_modules/agentation/package.json')).status, 404);
    });
  }
  assert.equal(await readFile(path.join(root, 'avenue.html'), 'utf8'), original);
});

test('Default and production servers never inject or serve Agentation, including --dev override', async () => {
  for (const [env, args] of [['', []], ['production', []], ['production', ['--dev']]]) {
    await withServer(env, args, async base => {
      for (const page of pages) {
        const response = await fetch(base + page);
        assert.equal(response.status, 200);
        assert.ok(!(await response.text()).includes(script), page);
      }
      assert.equal((await fetch(base + script)).status, 404);
    });
  }
});

test('Production static build excludes the toolbar and its dependencies', async () => {
  const child = spawn(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = '';
  child.stderr.on('data', data => { errors += data; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, errors);
  async function inspect(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      assert.ok(!/agentation|node_modules/i.test(entry.name), entry.name);
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) await inspect(file);
      else if (entry.name.endsWith('.html')) assert.ok(!(await readFile(file, 'utf8')).includes(script), file);
    }
  }
  await inspect(path.join(root, 'dist'));
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  for (const name of ['agentation', 'react', 'react-dom', 'esbuild']) {
    assert.ok(pkg.devDependencies[name]);
    assert.ok(!pkg.dependencies?.[name]);
  }
});
