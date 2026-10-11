import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      input: Object.fromEntries(readdirSync('.pages').filter(f => f.endsWith('.html')).map(f => [f.slice(0, -5), resolve('.pages', f)])),
    },
  },
  plugins: [{
    name: 'friendly-lesson-urls',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/' || req.url?.startsWith('/?')) req.url = '/.pages/index.html' + req.url.slice(1);
        else if (req.url && /^\/[\w-]+\.html(?:\?|$)/.test(req.url)) req.url = '/.pages' + req.url;
        next();
      });
    },
  }],
});
