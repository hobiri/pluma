# @hobiri/pluma-vite

Build-time Vite plugins for Pluma applications. This package is infrastructure:
it runs inside Vite during dev and build and ships no runtime code.

## Install

```sh
pnpm add -D @hobiri/pluma-vite
```

Requires `vite` (peer dependency).

## plumaRoutes()

Discovers Pluma server route modules and exposes them as a virtual module:

```ts
import routes from "virtual:pluma/routes";
```

Register it only where server routes are consumed (Pluma registers it in the
server branch of `vite.config.ts`; the client bundle never sees it):

```ts
import { plumaRoutes } from "@hobiri/pluma-vite";

export default defineConfig(({ mode }) => {
  if (mode === "client") {
    return { plugins: [/* no plumaRoutes here */] };
  }

  return { plugins: [plumaRoutes()] };
});
```

TypeScript understands the virtual module through the application's
`src/pluma-routes.d.ts` declaration (`Route[]`, matching `@comity/router`).

## Default route directory

`src/server/routes`, resolved against the Vite project root. Override only if
the application moves the directory:

```ts
plumaRoutes({ root: "src/server/routes" });
```

An absolute `root` is used as-is.

## Route file convention

A route module is a file named `<name>.<method>.<ext>`:

- methods: `get`, `post`, `put`, `patch`, `delete`, `all`
- extensions: `ts`, `tsx`, `js`, `jsx`, `mjs`, `mts`
- nested directories are discovered recursively

Ignored: the `index.<ext>` barrel, `*.middleware.*`, `*.test.*`, `*.spec.*`,
`*.d.ts`, and any file without a method suffix (helpers, types, assets).

The method suffix is a discovery convention only. The plugin never interprets
it and never derives URL paths from filenames: each route module declares its
own `Route` object, which remains authoritative.

## Deterministic ordering

Discovered files are sorted lexicographically by POSIX relative path. Ordering
is deterministic but otherwise intentionally mechanical: the plugin does not
decide router semantics or route precedence. Avoid ambiguous overlapping route
patterns, or keep them in separate explicit lists.

## Development behavior

Editing a route file flows through Vite's normal module graph. Adding or
removing a route file rescans the route directory and invalidates
`virtual:pluma/routes`. Files outside the route directory never trigger a
rescan.

## plumaOverrides()

Resolves local filesystem overrides for bare module specifiers, so a Pluma
site can replace selected package submodules from a local `overrides/`
directory without modifying the original dependency.

Register it alongside the other plugins; it applies to both client and server
pipelines:

```ts
import { plumaOverrides } from "@hobiri/pluma-vite";

export default defineConfig(({ mode }) => {
  if (mode === "client") {
    return { plugins: [plumaOverrides() /* ... */] };
  }

  return { plugins: [plumaOverrides(), plumaRoutes() /* ... */] };
});
```

### Override directory

Defaults to `<project-root>/overrides`. Override it per application only if
needed:

```ts
plumaOverrides({ dir: "src/overrides" });
```

A relative `dir` is resolved against the Vite project root; an absolute `dir`
is used as-is. The plugin works when the directory does not exist.

### Specifier form

Only bare module specifiers are considered, for example:

```text
@comity/foo
@comity/foo/bar
some-package
some-package/subpath
```

Relative, absolute, URL-scheme (`virtual:`, `data:`, `http:`, ...), and Vite
internal `\0`-prefixed specifiers are never overridden.

### Resolution

A bare specifier maps directly below the override directory:

```text
import '@comity/foo/bar'   →   overrides/@comity/foo/bar
```

and is matched deterministically against:

```text
<candidate>       <candidate>.ts    <candidate>.tsx
<candidate>.js    <candidate>.jsx   <candidate>.mts
<candidate>.mjs   <candidate>/index.ts     <candidate>/index.tsx
<candidate>/index.js      <candidate>/index.jsx   <candidate>/index.mts
<candidate>/index.mjs
```

Scoped package names are never split: `@comity/foo/bar` resolves inside
`overrides/@comity/foo/bar`. The resolved file is always kept inside the
override directory.

### Fallback

When no override exists the plugin returns `null` and Vite's normal module
resolution runs unchanged, preserving package `exports` maps, aliases,
conditions, and SSR behavior.

This is a small filesystem-based override mechanism, not a general alias or
module-resolution system.

## License

MIT — see [LICENSE](./LICENSE).

## Non-goals

This package does not define URL paths, implement route precedence, create a
route registry, provide route metadata or manifests, implement content
collections, provide virtual config, or provide a general plugin system. Its
override capability is intentionally limited to replacing bare package
specifiers with local files.
