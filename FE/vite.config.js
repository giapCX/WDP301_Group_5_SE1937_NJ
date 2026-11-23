import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, transformWithEsbuild } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [
      {
        name: 'viettour-js-with-jsx',
        enforce: 'pre',
        transform(code, id) {
          if (!/\/src\/.*\.js$/.test(id.split('?')[0])) return;
          return transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
        },
      },
      react(),
    ],
    optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } },
    server: {
      host: 'localhost',
      port: 3000,
      strictPort: true,
      open: true,
      proxy: { '/api': env.VITE_API_TARGET || 'http://127.0.0.1:5000' },
    },
  };
});
