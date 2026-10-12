import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  VIRTUAL_ROUTES_ID,
  createRoutesModule,
  discoverRouteFiles,
  isRouteFile,
  plumaRoutes,
} from "../routes.js";

function createFixture(structure: readonly string[]): string {
  const directory = mkdtempSync(join(tmpdir(), "pluma-routes-"));

  for (const entry of structure) {
    if (entry.endsWith("/")) {
      mkdirSync(join(directory, entry), { recursive: true });
    } else {
      mkdirSync(join(directory, entry.slice(0, entry.lastIndexOf("/") + 1)), {
        recursive: true,
      });
      writeFileSync(join(directory, entry), "export default {};");
    }
  }

  return directory;
}

describe("isRouteFile", () => {
  it("discovers method-suffixed source modules", () => {
    assert.equal(isRouteFile("index.get.tsx"), true);
    assert.equal(isRouteFile("sitemap.xml.get.tsx"), true);
    assert.equal(isRouteFile("contact.post.ts"), true);
    assert.equal(isRouteFile("article.put.tsx"), true);
    assert.equal(isRouteFile("item.patch.ts"), true);
    assert.equal(isRouteFile("item.delete.js"), true);
    assert.equal(isRouteFile("fallback.all.jsx"), true);
    assert.equal(isRouteFile("feed.all.mjs"), true);
    assert.equal(isRouteFile("feed.get.mts"), true);
  });

  it("ignores the barrel, middleware, tests, helpers, and declarations", () => {
    assert.equal(isRouteFile("index.ts"), false);
    assert.equal(isRouteFile("not-found.middleware.tsx"), false);
    assert.equal(isRouteFile("page.test.ts"), false);
    assert.equal(isRouteFile("page.spec.tsx"), false);
    assert.equal(isRouteFile("helper.ts"), false);
    assert.equal(isRouteFile("helper.tsx"), false);
    assert.equal(isRouteFile("types.d.ts"), false);
    assert.equal(isRouteFile("route.get.d.ts"), false);
    assert.equal(isRouteFile("styles.css"), false);
    assert.equal(isRouteFile("README.md"), false);
  });
});

describe("discoverRouteFiles", () => {
  it("discovers nested routes and ignores non-route files", () => {
    const directory = createFixture([
      "index.get.tsx",
      "sitemap.xml.get.tsx",
      "index.ts",
      "helper.ts",
      "not-found.middleware.tsx",
      "page.test.ts",
      "page.spec.tsx",
      "types.d.ts",
      "blog/",
      "blog/index.get.tsx",
      "blog/slug.get.tsx",
      "api/",
      "api/v1/",
      "api/v1/contact.post.ts",
    ]);

    try {
      assert.deepEqual(discoverRouteFiles(directory), [
        "api/v1/contact.post.ts",
        "blog/index.get.tsx",
        "blog/slug.get.tsx",
        "index.get.tsx",
        "sitemap.xml.get.tsx",
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("returns an empty collection for a missing directory", () => {
    assert.deepEqual(
      discoverRouteFiles(join(tmpdir(), "pluma-routes-does-not-exist")),
      [],
    );
  });

  it("returns an empty collection for a directory without routes", () => {
    const directory = createFixture(["helper.ts", "index.ts"]);

    try {
      assert.deepEqual(discoverRouteFiles(directory), []);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("virtual module", () => {
  it("resolves the public ID to the internal virtual ID", () => {
    const plugin = plumaRoutes({ root: tmpdir() });

    assert.equal(typeof plugin.resolveId, "function");
    assert.equal(
      (plugin.resolveId as (id: string) => string | null)(
        "virtual:pluma/routes",
      ),
      `\0${VIRTUAL_ROUTES_ID}`,
    );
    assert.equal(
      (plugin.resolveId as (id: string) => string | null)("virtual:other"),
      null,
    );
    assert.equal(
      (plugin.resolveId as (id: string) => string | null)("./index.get.js"),
      null,
    );
  });

  it("loads imports for discovered modules plus a default array", () => {
    const directory = createFixture(["b.get.tsx", "a.get.tsx"]);

    try {
      const plugin = plumaRoutes({ root: directory });

      assert.equal(typeof plugin.buildStart, "function");
      assert.equal(typeof plugin.load, "function");

      (plugin.buildStart as () => void)();

      const code = (plugin.load as (id: string) => string | null)(
        `\0${VIRTUAL_ROUTES_ID}`,
      );

      assert.match(
        code ?? "",
        new RegExp(`import route0 from "${directory}/a\\.get\\.tsx";`),
      );
      assert.match(
        code ?? "",
        new RegExp(`import route1 from "${directory}/b\\.get\\.tsx";`),
      );
      assert.match(code ?? "", /export default \[route0, route1\];/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("loads a valid empty array when no routes exist", () => {
    const directory = createFixture(["helper.ts"]);

    try {
      const plugin = plumaRoutes({ root: directory });

      (plugin.buildStart as () => void)();

      assert.equal(
        (plugin.load as (id: string) => string | null)(
          `\0${VIRTUAL_ROUTES_ID}`,
        ),
        "export default [];\n",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("ignores unrelated module IDs in load", () => {
    const plugin = plumaRoutes({ root: tmpdir() });

    assert.equal(
      (plugin.load as (id: string) => string | null)("other-id"),
      null,
    );
  });
});

describe("createRoutesModule", () => {
  it("emits no imports for an empty collection", () => {
    assert.equal(createRoutesModule("/routes", []), "export default [];\n");
  });
});

describe("development invalidation", () => {
  interface FakeModuleGraph {
    invalidated: unknown[];
    module: unknown;
    getModuleById(id: string): unknown;
    invalidateModule(module: unknown): void;
  }

  function createGraph(module: unknown): FakeModuleGraph {
    const graph: FakeModuleGraph = {
      invalidated: [],
      module,
      getModuleById(_id: string): unknown {
        return this.module;
      },
      invalidateModule(target: unknown): void {
        this.invalidated.push(target);
      },
    };

    return graph;
  }

  function createServer(module: unknown): {
    added: string[];
    graph: FakeModuleGraph;
    ssrGraph: FakeModuleGraph;
    server: unknown;
  } {
    // The legacy client graph never contains the server-only virtual module.
    const graph = createGraph(null);
    const ssrGraph = createGraph(module);
    const added: string[] = [];
    const server = {
      watcher: {
        add(path: string): void {
          added.push(path);
        },
      },
      moduleGraph: graph,
      environments: {
        ssr: { moduleGraph: ssrGraph },
      },
    };

    return { added, graph, ssrGraph, server };
  }

  it("scopes watching to the route directory", () => {
    const directory = createFixture(["index.get.tsx"]);

    try {
      const plugin = plumaRoutes({ root: directory });
      const { added, server } = createServer(null);

      (plugin.configureServer as (server: unknown) => void)(server);

      assert.deepEqual(added, [directory]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("invalidates the virtual module when a route file is added", async () => {
    const directory = createFixture(["index.get.tsx"]);

    try {
      const plugin = plumaRoutes({ root: directory });
      const virtualModule = { id: "virtual" };
      const { graph, ssrGraph, server } = createServer(virtualModule);

      (plugin.buildStart as () => void)();

      writeFileSync(join(directory, "about.get.tsx"), "export default {};");

      await (plugin.handleHotUpdate as (context: unknown) => Promise<void>)({
        file: join(directory, "about.get.tsx"),
        server,
      });

      assert.deepEqual(ssrGraph.invalidated, [virtualModule]);
      assert.deepEqual(graph.invalidated, []);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("invalidates the virtual module when a route file is removed", async () => {
    const directory = createFixture(["index.get.tsx", "about.get.tsx"]);

    try {
      const plugin = plumaRoutes({ root: directory });
      const virtualModule = { id: "virtual" };
      const { ssrGraph, server } = createServer(virtualModule);

      (plugin.buildStart as () => void)();

      rmSync(join(directory, "about.get.tsx"));

      await (plugin.handleHotUpdate as (context: unknown) => Promise<void>)({
        file: join(directory, "about.get.tsx"),
        server,
      });

      assert.deepEqual(ssrGraph.invalidated, [virtualModule]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("does not invalidate when an existing route file is edited", async () => {
    const directory = createFixture(["index.get.tsx"]);

    try {
      const plugin = plumaRoutes({ root: directory });
      const { graph, ssrGraph, server } = createServer({ id: "virtual" });

      (plugin.buildStart as () => void)();

      writeFileSync(
        join(directory, "index.get.tsx"),
        "export default { changed: true };",
      );

      await (plugin.handleHotUpdate as (context: unknown) => Promise<void>)({
        file: join(directory, "index.get.tsx"),
        server,
      });

      assert.deepEqual(graph.invalidated, []);
      assert.deepEqual(ssrGraph.invalidated, []);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("does not rescan for unrelated files", async () => {
    const directory = createFixture(["index.get.tsx"]);

    try {
      const plugin = plumaRoutes({ root: directory });
      const { graph, ssrGraph, server } = createServer({ id: "virtual" });

      (plugin.buildStart as () => void)();

      await (plugin.handleHotUpdate as (context: unknown) => Promise<void>)({
        file: join(tmpdir(), "elsewhere.ts"),
        server,
      });

      assert.deepEqual(graph.invalidated, []);
      assert.deepEqual(ssrGraph.invalidated, []);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("hotUpdate invalidates the virtual module when a route file is removed", async () => {
    const directory = createFixture(["index.get.tsx", "about.get.tsx"]);

    try {
      const plugin = plumaRoutes({ root: directory });
      const virtualModule = { id: "virtual" };
      const { ssrGraph, server } = createServer(virtualModule);

      (plugin.buildStart as () => void)();

      rmSync(join(directory, "about.get.tsx"));

      await (plugin.hotUpdate as (context: unknown) => Promise<void>)({
        type: "delete",
        file: join(directory, "about.get.tsx"),
        server,
      });

      assert.deepEqual(ssrGraph.invalidated, [virtualModule]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("hotUpdate invalidates the virtual module when a route file is added", async () => {
    const directory = createFixture(["index.get.tsx"]);

    try {
      const plugin = plumaRoutes({ root: directory });
      const virtualModule = { id: "virtual" };
      const { ssrGraph, server } = createServer(virtualModule);

      (plugin.buildStart as () => void)();

      writeFileSync(join(directory, "about.get.tsx"), "export default {};");

      await (plugin.hotUpdate as (context: unknown) => Promise<void>)({
        type: "create",
        file: join(directory, "about.get.tsx"),
        server,
      });

      assert.deepEqual(ssrGraph.invalidated, [virtualModule]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
