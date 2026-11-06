import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const basePath = '/---------------------';
const apiOrigin = 'https://vg-visionary-feedback.clayimage8.chatgpt.site';
export default defineConfig({
  root: fileURLToPath(new URL('./github-pages', import.meta.url)),
  base: `${basePath}/`, publicDir: false,
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  plugins: [react(), { name: 'pages-metadata', transformIndexHtml: html => html.replaceAll('__PAGES_BASE__', basePath) }],
  define: {
    'process.env.NEXT_PUBLIC_API_ORIGIN': JSON.stringify(apiOrigin),
    'process.env.NEXT_PUBLIC_BASE_PATH': JSON.stringify(basePath),
  },
  build: { outDir: '../.pages-build', emptyOutDir: true, assetsDir: 'pages-assets' },
});
