import type { Plugin } from "vite";

import { readdirSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export interface PlumaRoutesOptions {
  /**
   * Route directory, relative to the resolved Vite project root or absolute.
   * Defaults to the Pluma convention `src/server/routes`.
   */
  readonly root?: string;
}

/** User-facing virtual module ID. */
export const VIRTUAL_ROUTES_ID = "virtual:pluma/routes";

const RESOLVED_ROUTES_ID = `\0${VIRTUAL_ROUTES_ID}`;
const DEFAULT_ROUTES_ROOT = "src/server/routes";
const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
]);
const ROUTE_METHODS = new Set(["get", "post", "put", "patch", "delete", "all"]);
const IGNORED_STEM_SEGMENTS = new Set(["middleware", "test", "spec"]);

/**
 * Returns true when a file base name follows the Pluma route convention:
 * `<name>.<method>.<ext>` where method is a route method suffix.
 *
 * The method suffix is a discovery convention only. It is never interpreted:
 * the imported module remains authoritative for method, path, and handler.
 *
 * Note: `index.get.tsx` is a route (the home page). Only the bare barrel
 * name `index.<ext>` is excluded.
 */
export function isRouteFile(fileName: string): boolean {
  if (fileName.endsWith(".d.ts")) {
    return false;
  }

  const extensionIndex = fileName.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return false;
  }

  if (!SOURCE_EXTENSIONS.has(fileName.slice(extensionIndex))) {
    return false;
  }

  const stem = fileName.slice(0, extensionIndex);

  if (stem === "index") {
    return false;
  }

  const segments = stem.split(".");

  if (segments.length < 2) {
    return false;
  }

  const method = segments[segments.length - 1];

  if (method === undefined || !ROUTE_METHODS.has(method)) {
    return false;
  }

  return !segments
    .slice(0, -1)
    .some((segment) => IGNORED_STEM_SEGMENTS.has(segment));
}

/**
 * Discovers route modules below a directory.
 *
 * Returns POSIX-normalized paths relative to the directory, in deterministic
 * lexicographic order. Ordering is intentionally mechanical: the plugin does
 * not decide router semantics or route precedence.
 *
 * A missing directory yields an empty collection rather than an error.
 */
export function discoverRouteFiles(routesDir: string): string[] {
  let entries: string[];

  try {
    entries = readdirSync(routesDir, { encoding: "utf8", recursive: true });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const routes: string[] = [];

  for (const entry of entries) {
    const relativePath = entry.split(sep).join("/");
    const slashIndex = relativePath.lastIndexOf("/");
    const fileName =
      slashIndex < 0 ? relativePath : relativePath.slice(slashIndex + 1);

    if (isRouteFile(fileName)) {
      routes.push(relativePath);
    }
  }

  routes.sort();

  return routes;
}

/**
 * Generates the virtual module source: default imports of the discovered
 * physical modules plus a default-exported array. No metadata, no manifest,
 * no filename exposure.
 */
export function createRoutesModule(
  routesDir: string,
  files: readonly string[],
): string {
  const absoluteDir = routesDir.split(sep).join("/");
  const imports = files.map(
    (file, index) =>
      `import route${index} from ${JSON.stringify(`${absoluteDir}/${file}`)};`,
  );
  const names = files.map((_, index) => `route${index}`).join(", ");
  const body = imports.length > 0 ? `${imports.join("\n")}\n\n` : "";

  return `${body}export default [${names}];\n`;
}

function isWithinDirectory(directory: string, file: string): boolean {
  const nested = relative(directory, file);

  return nested !== "" && !nested.startsWith("..") && !isAbsolute(nested);
}

interface InvalidatableModuleGraph {
  getModuleById(id: string): unknown;
  invalidateModule(module: unknown): unknown;
}

interface HotUpdateServer {
  readonly moduleGraph?: InvalidatableModuleGraph | undefined;
  readonly environments?:
    | Record<
        string,
        | { readonly moduleGraph?: InvalidatableModuleGraph | undefined }
        | undefined
      >
    | undefined;
}

/**
 * Invalidates the virtual module in every module graph Vite exposes.
 *
 * Vite 7.3 keeps per-environment graphs (`server.environments`); the legacy
 * `server.moduleGraph` only tracks the client graph, which never contains
 * the server-only route module. Without the environment pass, removed routes
 * keep serving stale code in SSR until restart.
 */
async function invalidateVirtualModule(
  server: HotUpdateServer,
  id: string,
): Promise<void> {
  const graphs: Array<InvalidatableModuleGraph | undefined> = [
    server.moduleGraph,
  ];

  for (const environment of Object.values(server.environments ?? {})) {
    graphs.push(environment?.moduleGraph);
  }

  for (const graph of graphs) {
    const target = graph?.getModuleById(id);

    if (target !== undefined && target !== null) {
      await graph?.invalidateModule(target);
    }
  }
}

function sameFiles(
  previous: readonly string[],
  next: readonly string[],
): boolean {
  return (
    previous.length === next.length &&
    previous.every((file, index) => file === next[index])
  );
}

/**
 * Discovers Pluma server route modules and exposes them as
 * `virtual:pluma/routes` (default-exported `Route[]`).
 *
 * Build-time infrastructure only: filesystem discovery plus deterministic
 * ordering. Routing stays with `@comity/router-path-to-regexp`; each route
 * module stays authoritative for its own `Route` object.
 */
export function plumaRoutes(options: PlumaRoutesOptions = {}): Plugin {
  const configuredRoot = options.root ?? DEFAULT_ROUTES_ROOT;
  let viteRoot = process.cwd();
  let routesDir = configuredRoot;
  let cached: string[] | null = null;

  const resolveRoutesDir = (): void => {
    routesDir = isAbsolute(configuredRoot)
      ? configuredRoot
      : resolve(viteRoot, configuredRoot);
  };

  const scan = (): string[] => {
    resolveRoutesDir();
    cached = discoverRouteFiles(routesDir);

    return cached;
  };

  /**
   * Rescans the route directory and invalidates the virtual module when the
   * route set changed. Scoped to the route directory: unrelated files return
   * before any filesystem work.
   */
  const refreshRoutes = async (
    file: string,
    server: HotUpdateServer,
  ): Promise<void> => {
    if (!isWithinDirectory(routesDir, file)) {
      return;
    }

    const previous = cached ?? [];
    const next = scan();

    if (sameFiles(previous, next)) {
      return;
    }

    await invalidateVirtualModule(server, RESOLVED_ROUTES_ID);
  };

  resolveRoutesDir();

  return {
    name: "pluma:routes",

    configResolved(config) {
      viteRoot = config.root;
      resolveRoutesDir();
      cached = null;
    },

    buildStart() {
      scan();
    },

    resolveId(id) {
      if (id === VIRTUAL_ROUTES_ID) {
        return RESOLVED_ROUTES_ID;
      }

      return null;
    },

    load(id) {
      if (id !== RESOLVED_ROUTES_ID) {
        return null;
      }

      const files = cached ?? scan();

      return createRoutesModule(routesDir, files);
    },

    configureServer(server) {
      server.watcher.add(routesDir);
    },

    /**
     * Per-environment update hook (Vite 7.3+). This is the hook that runs for
     * created and deleted files; the legacy `handleHotUpdate` below only runs
     * for edits on this Vite version.
     */
    async hotUpdate({ file, server }) {
      await refreshRoutes(file, server);
    },

    /**
     * Legacy update hook, kept for older Vite versions without `hotUpdate`.
     * On Vite 7.3+ it is skipped whenever `hotUpdate` is defined.
     */
    async handleHotUpdate({ file, server }) {
      await refreshRoutes(file, server);
    },
  };
}
