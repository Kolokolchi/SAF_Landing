import http from 'node:http';
import { createReadStream } from 'node:fs';
import { appendFile, mkdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const portIndex = process.argv.indexOf('--port');
const port = Number(process.env.PORT || (portIndex >= 0 && process.argv[portIndex + 1]) || 5173);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.mp4': 'video/mp4',
};
const routes = new Map([
  ['/', 'index.html'], ['/avenue', 'avenue.html'], ['/avenuekz', 'avenuekz.html'],
  ['/privacy', 'privacy.html'], ['/privacykz', 'privacykz.html'],
]);
const publicFiles = new Set([...routes.values(), 'custom.css', 'local-runtime.js']);
const realRoot = await realpath(root);
const assetRoot = await realpath(path.join(root, 'assets'));
// --dev is the local development flag; an explicit production environment always wins.
const development = process.env.NODE_ENV !== 'production' &&
  (process.env.NODE_ENV === 'development' || process.argv.includes('--dev'));
const agentationPath = '/__dev/agentation.js';
const agentationBundle = development
  ? await (await import('./scripts/agentation.mjs')).buildAgentation()
  : null;

function isWithin(base, file) {
  const relative = path.relative(base, file);
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

async function handleRequest(req, res) {
  let requestPath;
  try {
    requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Invalid URL');
    return;
  }
  // Reject Windows separators, alternate data streams and decoded traversal segments.
  if (/[\\:\x00-\x1f\x7f]/.test(requestPath) || requestPath.split('/').some(part => part === '.' || part === '..')) {
    res.writeHead(404).end('Not found');
    return;
  }
  if (requestPath === '/api/leads' && req.method === 'POST') {
    // The replica owns its submissions; it does not send contacts to the original site.
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16_384) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      res.writeHead(400, { 'Content-Type': types['.json'] }).end(JSON.stringify({ error: 'Некорректная заявка.' }));
      return;
    }
    if (!body || typeof body.name !== 'string' || !body.name.trim() ||
        typeof body.phone !== 'string' || body.phone.replace(/\D/g, '').length < 10 ||
        typeof body.room !== 'string' || !body.room || body.consent !== true) {
      res.writeHead(400, { 'Content-Type': types['.json'] }).end(JSON.stringify({ error: 'Проверьте заполнение полей.' }));
      return;
    }
    const lead = { name: body.name.slice(0, 120), phone: body.phone.slice(0, 40), room: body.room.slice(0, 100), consent: true, createdAt: new Date().toISOString() };
    await mkdir(path.join(root, 'data'), { recursive: true });
    await appendFile(path.join(root, 'data', 'leads.jsonl'), JSON.stringify(lead) + '\n', { encoding: 'utf8', mode: 0o600 });
    res.writeHead(201, { 'Content-Type': types['.json'] }).end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  if (development && requestPath === agentationPath) {
    res.writeHead(200, {
      'Content-Type': types['.js'], 'Content-Length': agentationBundle.length,
      'Cache-Control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : agentationBundle);
    return;
  }
  const relative = routes.get(requestPath.replace(/\/$/, '') || '/') || requestPath.slice(1);
  const isAsset = relative.startsWith('assets/');
  // Serve only public replica files, never source tooling or submitted contacts.
  if (!isAsset && !publicFiles.has(relative)) {
    res.writeHead(404).end('Not found');
    return;
  }
  const file = path.resolve(root, relative);
  if (!(isAsset ? isWithin(path.join(root, 'assets'), file) : isWithin(root, file))) {
    res.writeHead(404).end('Not found');
    return;
  }
  try {
    const realFile = await realpath(file);
    // A link inside assets must not expose a private file outside that folder.
    if (isAsset ? !isWithin(realRoot, assetRoot) || !isWithin(assetRoot, realFile)
                : !publicFiles.has(path.relative(realRoot, realFile))) {
      res.writeHead(404).end('Not found');
      return;
    }
    const info = await stat(realFile);
    if (!info.isFile()) throw new Error('Not a file');
    if (development && path.extname(file) === '.html') {
      const original = await readFile(realFile, 'utf8');
      const html = original.replace(/<\/body>/i,
        `<script type="module" src="${agentationPath}"></script></body>`);
      res.writeHead(200, {
        'Content-Type': types['.html'], 'Content-Length': Buffer.byteLength(html),
        'Cache-Control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : html);
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(realFile).on('error', () => res.destroy()).pipe(res);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

export const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(() => {
    if (res.destroyed) return;
    if (res.headersSent) res.destroy();
    else res.writeHead(500, { 'Content-Type': types['.json'] }).end(JSON.stringify({ error: 'Не удалось обработать запрос.' }));
  });
});

server.listen(port, '127.0.0.1', () => console.log(`SAF Avenue: http://localhost:${server.address().port}/avenue`));
