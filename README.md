# Pluma by Hobiri

Pluma is a minimal website starter on Vite, Hono, Preact, and Cloudflare
Pages, composed through the versioned `@hobiri/website-runtime` package.
It is a **normal application template**, not a framework, generator, or
plugin system: copy it, then own the copy.

This repository is the standalone Pluma product workspace. It is separate
from the Hobiri website platform, which owns the shared runtime and the
production website applications.

## Packages

- [`packages/template`](./packages/template/) (`@hobiri/pluma-template`):
  the website starter source (routes, layouts, Vite config, Cloudflare
  Pages entry). It distributes template source and exposes no importable
  library API.
- [`packages/vite`](./packages/vite/) (`@hobiri/pluma-vite`): build-time
  Vite plugins (route discovery, filesystem overrides). Runs inside Vite
  during dev and build; ships no runtime code.

## Relation to `@hobiri/website-runtime`

Reusable application behavior (bootstrap, page rendering, 404 middleware,
sitemap responses) lives in `@hobiri/website-runtime`, which Pluma consumes
as an **external versioned package** (`0.1.0`). The runtime is developed
and released from the Hobiri website-platform workspace; it is not part of
this repository, and this workspace never resolves packages through that
workspace's filesystem.

The template also depends on `@hobiri/pluma-vite` (`0.1.0`), resolved from
this workspace during development and from the registry by external
consumers.

## Commands

```sh
pnpm install
pnpm -r build      # build every package
pnpm -r typecheck  # typecheck every package
pnpm -r test       # run every package test suite
```

Per-package commands live in each `package.json` (`packages/template`
additionally supports `dev`, `preview`, `lint`, `format`).

## Artifact verification

```sh
pnpm --filter @hobiri/pluma-vite build
pnpm --filter @hobiri/pluma-template build
npm pack --dry-run   # from a package directory; inspects tarball contents
```

Published manifests must contain explicit registry versions (no
`workspace:*` references). Installing the template outside this workspace
requires `@hobiri/website-runtime` and `@hobiri/pluma-vite` to be available
from the configured registry at the pinned versions.

## Changesets & releases

Versioning and changelogs are driven by [Changesets](https://github.com/changesets/changesets).
The two packages version independently; `@hobiri/website-runtime` is external
and is never versioned or published here.

```sh
pnpm changeset          # describe the intended release(s) for your change
pnpm changeset status   # validate pending changesets locally (CI runs the
                        # equivalent check as `changeset status --since=origin/main`)
```

Select only the packages your change affects (`patch` for fixes, `minor` for
features, `major` for breaking changes; select both packages when both are
affected). Documentation-only changes need no changeset.

Merging a PR with changesets opens a `Version Packages` PR; merging that PR
publishes the bumped packages from `main` in dependency order
(`@hobiri/pluma-vite` before `@hobiri/pluma-template`).

Releases need an `NPM_TOKEN` repository secret (npm automation token for the
`@hobiri` scope). Until `@hobiri/website-runtime@0.1.0` is available from the
registry, `pnpm install` cannot resolve the full workspace and no
`pnpm-lock.yaml` can be generated; publish the runtime from its own workspace
first, then run `pnpm install` here and commit the lockfile.

## License

MIT — see each package's `LICENSE` file.
