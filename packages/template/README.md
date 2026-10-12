# Pluma by Hobiri

Pluma is a minimal generic Comity application initially used to build [Hobiri Corporate Website](https://hobiri.com).

It is a **normal application repository**, not a framework, generator, or plugin system.

## What it is

- **Stack:** Vite + Hono + Comity Kernel/Composition/Router + Preact + Cloudflare Pages/Workers.
- **Baseline:** Renders one page (`/`), serves `GET /sitemap.xml`, returns `404` for unknown paths. Typechecks, builds, and runs with the commands below.
- **Shared runtime:** application composition uses the versioned
  [`@hobiri/website-runtime`](https://www.npmjs.com/package/@hobiri/website-runtime)
  package (`createWebsiteApp`, `renderPage`, `createNotFoundMiddleware`,
  `sitemapResponse`); routes, views, layouts, and content stay in the
  application. Build-time route discovery and overrides come from
  [`@hobiri/pluma-vite`](https://www.npmjs.com/package/@hobiri/pluma-vite).

## Technology baseline

See `package.json`. Core dependencies are the `@comity/*` application packages, `hono`, `preact`, `cubito` (CSS), and build tooling (`vite`, `@hono/vite-*`, `wrangler`). MDX (`@mdx-js/*`, `remark-gfm`) is already wired in `vite.config.ts` for both client and server builds.

## MDX is optional

MDX is an optional application capability, not a mandatory Pluma architectural layer. Pluma ships no MDX content. To adopt MDX, add a `src/data/` collection using an `import.meta.glob` pattern and write `.mdx` pages — no registry or CMS is required. The model is `Git + filesystem + normal application code`.

## How applications evolve

Copy Pluma, then change it with ordinary Git and application development:

1. Change `wrangler.jsonc` `name` and `src/config/site.ts` `SITE_NAME`/`SITE_URL`.
2. Edit `public/robots.txt` and add pages under `src/server/routes/*.get.tsx` + `src/server/routes/index.ts`.
3. Edit `src/layouts/empty.tsx` and `src/style.css` for branding.
4. Commit.

## What Pluma does not provide

- generator / `create` / scaffolding CLI
- manifest / operation log / file ownership / hashes / safety guards
- plugin registry / feature registry / extension engine
- upgrade/migration machinery
- template lifecycle or versioning

Git, package management, TypeScript, Vite, and Cloudflare are the lifecycle mechanisms.

## Commands

```sh
pnpm install
pnpm run dev      # Vite dev server (Hono + Cloudflare adapter)
pnpm run build    # client build + worker build -> dist/
pnpm run preview  # wrangler pages dev dist
pnpm run test     # request-level integration tests (vitest)
pnpm run typecheck # tsc --noEmit
```

## Minimal route example

```tsx
import type { HttpResponse } from '@comity/http';

import { renderPage } from '@hobiri/website-runtime';

import { EmptyLayout } from '../../layouts/index.js';

export default {
  method: 'GET',
  path: '/hello',
  handler: async (): Promise<HttpResponse> => {
    return renderPage(
      <EmptyLayout
        page={{
          id: 'hello',
          url: '/hello',
          title: 'Hello',
          seo: { title: 'Hello', description: 'Hello page' },
          layout: 'empty',
          blocks: [],
          status: 'published',
        }}
      >
        <h1>Hello</h1>
      </EmptyLayout>,
    );
  },
};
```

New routes are discovered automatically from `src/server/routes/` (see
`@hobiri/pluma-vite`) and composed through `createWebsiteApp` in
`src/server.tsx`. No registry or CMS is required.

## Limitations

- Pluma is a starter baseline, not a supported framework: copy it, then own
  the copy. There is no upgrade path between Pluma versions.
- Package `@hobiri/pluma-template` distributes this template source; it exposes no
  importable library API. Reusable behavior lives in
  `@hobiri/website-runtime` and `@hobiri/pluma-vite`.
- `0.x` releases may change template structure without migration tooling.

## License

MIT — see [LICENSE](./LICENSE).
