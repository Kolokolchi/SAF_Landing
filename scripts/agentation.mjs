import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Imported by the server only in development. Nothing is written into public assets or dist.
export async function buildAgentation() {
  const { build } = await import('esbuild');
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./agentation-entry.jsx', import.meta.url))],
    absWorkingDir: path.resolve(fileURLToPath(new URL('..', import.meta.url))),
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'esm',
    target: ['es2020'],
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': JSON.stringify('development') },
    logLevel: 'warning',
  });
  return Buffer.from(result.outputFiles[0].contents);
}
