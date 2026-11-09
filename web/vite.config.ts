import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cloudflare Pages define CF_PAGES: sin la URL de la API, la web publicada
// apuntaría a localhost y nadie podría entrar. Mejor que falle la publicación.
if (process.env.CF_PAGES && !process.env.VITE_API_URL) {
  throw new Error('Defina VITE_API_URL en Cloudflare Pages (ej.: https://api.tudominio.com/api).');
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
