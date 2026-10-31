import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function frontendBundleOptions(apiOrigin) {
  return {
    input: path.join(projectRoot, 'frontend', 'src', 'index.js'),
    resolve: { extensions: ['.mjs', '.js', '.jsx', '.json'] },
    onLog(level, log, handler) {
      if (level === 'warn' && log.code === 'MODULE_LEVEL_DIRECTIVE') return;
      handler(level, log);
    },
    transform: {
      jsx: 'react-jsx',
      define: {
        __API_ORIGIN__: JSON.stringify(apiOrigin),
        'process.env.NODE_ENV': JSON.stringify(apiOrigin ? 'development' : 'production')
      }
    }
  };
}
