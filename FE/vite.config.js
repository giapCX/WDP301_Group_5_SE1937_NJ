import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const backendDirectory = fileURLToPath(new URL('../BE/', import.meta.url));
  const backendEnv = command === 'serve' ? loadEnv(mode, backendDirectory, 'PORT') : {};
  const backendPort = Number(backendEnv.PORT) || 9999;

  return {
    plugins: [react()],
    server: {
      host: 'localhost',
      port: 3000,
      strictPort: true,
      open: true,
      proxy: { '/api': 'http://127.0.0.1:' + backendPort },
    },
  };
});
