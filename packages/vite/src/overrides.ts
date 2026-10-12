import type { Plugin } from "vite";

import { statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

export interface PlumaOverridesOptions {
  /**
   * Override directory, resolved against the Vite project root when relative
   * or used as-is when absolute. Defaults to the Pluma convention `overrides`
   * (i.e. `<project-root>/overrides`).
   */
  readonly dir?: string;
}

/** Default override directory, resolved against the Vite project root. */
export const DEFAULT_OVERRIDES_DIR = "overrides";

/**
 * A URL-style scheme prefix (`virtual:`, `data:`, `http:`, `node:`, ...).
 * Specifiers carrying one are never bare and must not be overridden.
 */
const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/** Supported source extensions, in deterministic resolution order. */
const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".mjs",
] as const;

/**
 * Classifies a module specifier as a bare specifier: a package import such as
 * `@comity/foo/bar` that the override resolver is allowed to consider.
 *
 * Relative (`./`, `../`), absolute (`/`), URL-scheme (`virtual:`, `data:`,
 * `http:`, ...), and Vite internal null-prefixed specifiers are never bare.
 */
export function isBareSpecifier(specifier: string): boolean {
  if (specifier.length === 0) {
    return false;
  }

  const first = specifier.charCodeAt(0);

  if (first === 0x2e || first === 0x2f || first === 0x00) {
    return false;
  }

  return !SCHEME_RE.test(specifier);
}

/**
 * Candidate paths for a single override candidate, in exact precedence order:
 * the exact file, each source extension, then directory index files.
 */
function candidatePaths(candidate: string): string[] {
  return [
    candidate,
    ...SOURCE_EXTENSIONS.map((extension) => `${candidate}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) =>
      join(candidate, `index${extension}`),
    ),
  ];
}

function isWithinDirectory(directory: string, file: string): boolean {
  const nested = relative(directory, file);

  return nested !== "" && !nested.startsWith("..") && !isAbsolute(nested);
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;

    if (code === "ENOENT" || code === "ENOTDIR") {
      return false;
    }

    throw error;
  }
}

/**
 * Resolves a module specifier to a local override file below `overridesDir`,
 * or `null` when no override exists.
 *
 * Only bare specifiers are considered. The resolved file must remain inside
 * `overridesDir`; an escaping specifier such as `@comity/../../../x` yields
 * `null`. When nothing matches, `null` lets Vite's normal package resolution
 * (exports maps, aliases, conditions) run unchanged.
 */
export function findOverrideFile(
  overridesDir: string,
  specifier: string,
): string | null {
  if (!isBareSpecifier(specifier)) {
    return null;
  }

  const candidate = resolve(overridesDir, specifier);

  if (!isWithinDirectory(overridesDir, candidate)) {
    return null;
  }

  for (const path of candidatePaths(candidate)) {
    if (isFile(path)) {
      return path;
    }
  }

  return null;
}

/**
 * Resolves local filesystem overrides for bare module specifiers.
 *
 * A bare specifier such as `@comity/foo/bar` is mapped below the override
 * directory (`<root>/overrides` by default) and matched against source files
 * in deterministic order. Anything lacking an override returns `null` and
 * flows through Vite's normal module-resolution pipeline; nothing is
 * resolved manually and no package `exports` map is inspected.
 *
 * This is intentionally a small filesystem override mechanism, not a general
 * alias or module-resolution framework.
 */
export function plumaOverrides(options: PlumaOverridesOptions = {}): Plugin {
  const configuredDir = options.dir ?? DEFAULT_OVERRIDES_DIR;
  let viteRoot = process.cwd();
  let overridesDir = configuredDir;

  const resolveDir = (): void => {
    overridesDir = isAbsolute(configuredDir)
      ? configuredDir
      : resolve(viteRoot, configuredDir);
  };

  resolveDir();

  return {
    name: "pluma:overrides",

    configResolved(config) {
      viteRoot = config.root;
      resolveDir();
    },

    resolveId(id) {
      return findOverrideFile(overridesDir, id);
    },

    /**
     * Watch the override directory so created and deleted override files are
     * picked up by the dev server even when the directory sits outside the
     * Vite root. Existence is re-checked on every resolution, so no module
     * caching or custom invalidation is needed.
     */
    configureServer(server) {
      server.watcher.add(overridesDir);
    },
  };
}
