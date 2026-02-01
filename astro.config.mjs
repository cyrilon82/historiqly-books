import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://books.historiqly.com',
  vite: {
    plugins: [tailwindcss()],
  },
  output: 'static',
});
