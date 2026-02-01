import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://cyrilon82.github.io',
  base: '/historiqly-books',
  vite: {
    plugins: [tailwindcss()],
  },
  output: 'static',
});
