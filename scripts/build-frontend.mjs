import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { rolldown } from 'rolldown';
import { frontendBundleOptions, projectRoot } from './frontend-bundler.mjs';

const root = projectRoot;
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'assets');

await rm(dist, { recursive: true, force: true });
await mkdir(assets, { recursive: true });
const bundle = await rolldown(frontendBundleOptions(''));
try {
  await bundle.write({
    dir: assets,
    format: 'es',
    entryFileNames: 'app.js',
    chunkFileNames: 'chunk-[name]-[hash].js'
  });
} finally {
  await bundle.close();
}
await cp(path.join(root, 'frontend', 'index.html'), path.join(dist, 'index.html'));
await cp(path.join(root, 'frontend', 'src', 'styles.css'), path.join(assets, 'app.css'));
console.log('Đã build frontend vào dist/.');
