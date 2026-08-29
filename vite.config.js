import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        /**
         * React, the router and the Supabase client go in their own file.
         *
         * This does not make the first visit smaller — the same bytes still
         * have to arrive. It makes every visit after a deploy smaller. These
         * three change when we upgrade them, which is rarely; the site's own
         * code changes several times a day. Kept together they share one
         * filename, so every deploy expires the lot and a returning visitor
         * downloads React again to read a fixed typo.
         *
         * Split, the vendor file keeps its name and stays in the browser
         * cache across deploys.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router')) return 'vendor-react';
          if (id.includes('/react-dom/') || id.includes('/react/')
              || id.includes('/scheduler/')) return 'vendor-react';
          if (id.includes('@supabase')) return 'vendor-supabase';
          return undefined;
        },
      },
    },
  },
})
