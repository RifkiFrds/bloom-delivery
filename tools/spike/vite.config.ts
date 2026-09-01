import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

/**
 * Phase 0 spike dev server.
 *
 * HTTPS is not optional: `getUserMedia` requires a secure context, so testing
 * from a real phone against this laptop needs TLS (Doc 05 §3, task E5).
 * `basicSsl` issues a self-signed certificate — the phone will warn once and
 * must be told to proceed.
 *
 * `publicDir` points at the repository's `public/` so the spike serves the same
 * self-hosted `/vision/*` assets the production app will (Doc 01 §7.3). One copy
 * of the 7.7 MB model set, one loading path, exercised from Phase 0 onward.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  plugins: [basicSsl()],
  server: {
    port: 5180,
    strictPort: true,
    host: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
