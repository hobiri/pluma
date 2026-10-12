import { plumaOverrides, plumaRoutes } from '@hobiri/pluma-vite';
import honoViteBuildCloudflarePagesPlugin from '@hono/vite-build/cloudflare-pages';
import honoDevServerPlugin from '@hono/vite-dev-server';
import honoDevServerCloudflareAdapter from '@hono/vite-dev-server/cloudflare';
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  if (mode === 'client') {
    return {
      build: {
        rollupOptions: {
          input: ['./src/client.ts'],
          output: {
            entryFileNames: 'static/client.js',
            chunkFileNames: 'static/assets/[name]-[hash].js',
            assetFileNames: 'static/assets/[name].[ext]',
          },
        },
        emptyOutDir: true,
      },
      plugins: [
        // Client and server pipelines both honor local overrides.
        plumaOverrides(),
        mdx({
          jsxImportSource: 'preact',
          remarkPlugins: [remarkGfm],
        }),
      ],
    };
  }

  return {
    plugins: [
      plumaOverrides(),
      // Server-only: discovers src/server/routes into virtual:pluma/routes.
      // The client bundle (mode === 'client' above) never consumes routes.
      plumaRoutes(),
      mdx({
        jsxImportSource: 'preact',
        remarkPlugins: [remarkGfm],
      }),
      honoDevServerPlugin({
        entry: './src/server.tsx',
        adapter: honoDevServerCloudflareAdapter,
      }),
      honoViteBuildCloudflarePagesPlugin({
        entry: './src/server.tsx',
      }),
    ],
  };
});
