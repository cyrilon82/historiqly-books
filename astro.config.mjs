import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://books.historiqly.com',
  base: '/',
  vite: {
    plugins: [tailwindcss()],
  },
  output: 'static',
});
