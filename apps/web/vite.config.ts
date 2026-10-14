import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ command, mode }) => {
  // Falla el build de producción si falta la URL del backend: es mejor un error
  // en el log de Vercel que una página en blanco en producción.
  if (command === 'build' && mode === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    if (!env.VITE_API_URL) {
      throw new Error(
        'Falta VITE_API_URL. Defínela en Vercel (Settings → Environment Variables) ' +
          'o en apps/web/.env.local para builds locales.',
      );
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173 },
    build: { sourcemap: true },
    test: {
      environment: 'jsdom',
      include: ['test/**/*.test.{ts,tsx}'],
      setupFiles: ['test/setup.ts'],
      env: { VITE_API_URL: 'http://localhost:8080' },
    },
  };
});
