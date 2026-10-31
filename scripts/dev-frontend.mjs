import express from 'express';
import path from 'node:path';
import { watch } from 'rolldown';
import { frontendBundleOptions, projectRoot } from './frontend-bundler.mjs';

const root = projectRoot;
const frontend = path.join(root, 'frontend');
const assets = path.join(frontend, '.dev-assets');
const port = Number(process.env.FRONTEND_PORT || 5174);
const watcher = watch({
  ...frontendBundleOptions(process.env.API_ORIGIN || 'http://localhost:3000'),
  output: {
    dir: assets,
    format: 'es',
    entryFileNames: 'app.js',
    chunkFileNames: 'chunk-[name]-[hash].js'
  }
});

watcher.on('event', (event) => {
  if (event.code === 'ERROR') console.error(event.error);
  if (event.code === 'BUNDLE_END') console.log('Frontend đã biên dịch.');
});

const app = express();
app.use('/assets', express.static(assets));
app.get('/assets/app.css', (_req, res) => res.sendFile(path.join(frontend, 'src', 'styles.css')));
app.get('*', (_req, res) => res.sendFile(path.join(frontend, 'index.html')));

const server = app.listen(port, 'localhost', () => {
  console.log(`Frontend đang chạy tại http://localhost:${port}`);
});

async function shutdown() {
  server.close();
  await watcher.close();
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
