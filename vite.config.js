import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        open911: resolve(__dirname, 'open911.html'),
        resumerx: resolve(__dirname, 'resumerx.html'),
      },
    },
  },
});
