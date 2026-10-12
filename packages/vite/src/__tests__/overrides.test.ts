import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import {
  DEFAULT_OVERRIDES_DIR,
  findOverrideFile,
  isBareSpecifier,
  plumaOverrides,
} from "../overrides.js";

function createFixture(files: readonly string[]): string {
  const directory = mkdtempSync(join(tmpdir(), "pluma-overrides-"));

  for (const file of files) {
    const path = join(directory, file);

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "export default 0;");
  }

  return directory;
}

describe("isBareSpecifier", () => {
  it("classifies package specifiers as bare", () => {
    assert.equal(isBareSpecifier("@comity/foo"), true);
    assert.equal(isBareSpecifier("@comity/foo/bar"), true);
    assert.equal(isBareSpecifier("some-package"), true);
    assert.equal(isBareSpecifier("some-package/subpath"), true);
  });

  it("rejects relative, absolute, virtual, and URL specifiers", () => {
    assert.equal(isBareSpecifier("./foo"), false);
    assert.equal(isBareSpecifier("../foo"), false);
    assert.equal(isBareSpecifier("/foo"), false);
    assert.equal(isBareSpecifier("virtual:foo"), false);
    assert.equal(isBareSpecifier("\0virtual:foo"), false);
    assert.equal(isBareSpecifier("data:foo"), false);
    assert.equal(isBareSpecifier("http://example.com/foo"), false);
    assert.equal(isBareSpecifier("https://example.com/foo"), false);
    assert.equal(isBareSpecifier("node:fs"), false);
    assert.equal(isBareSpecifier(""), false);
  });
});

describe("findOverrideFile", () => {
  it("resolves a .ts override", () => {
    const directory = createFixture(["some-package/mod.ts"]);

    try {
      assert.equal(
        findOverrideFile(directory, "some-package/mod"),
        join(directory, "some-package/mod.ts"),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("supports every documented source extension", () => {
    for (const extension of ["ts", "tsx", "js", "jsx", "mts", "mjs"]) {
      const directory = createFixture([`some-package/mod.${extension}`]);

      try {
        assert.equal(
          findOverrideFile(directory, "some-package/mod"),
          join(directory, `some-package/mod.${extension}`),
        );
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  it("resolves directory index files", () => {
    for (const extension of ["ts", "tsx", "js", "jsx", "mts", "mjs"]) {
      const directory = createFixture([`some-package/mod/index.${extension}`]);

      try {
        assert.equal(
          findOverrideFile(directory, "some-package/mod"),
          join(directory, `some-package/mod/index.${extension}`),
        );
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  it("resolves nested package subpaths", () => {
    const directory = createFixture(["some-package/nested/deep/mod.ts"]);

    try {
      assert.equal(
        findOverrideFile(directory, "some-package/nested/deep/mod"),
        join(directory, "some-package/nested/deep/mod.ts"),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("resolves scoped packages without splitting the scope", () => {
    const directory = createFixture(["@comity/foo/bar.ts", "@comity/foo.ts"]);

    try {
      assert.equal(
        findOverrideFile(directory, "@comity/foo/bar"),
        join(directory, "@comity/foo/bar.ts"),
      );
      assert.equal(
        findOverrideFile(directory, "@comity/foo"),
        join(directory, "@comity/foo.ts"),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("applies deterministic precedence: exact file first", () => {
    const directory = createFixture([
      "some-package/mod",
      "some-package/mod.ts",
    ]);

    try {
      assert.equal(
        findOverrideFile(directory, "some-package/mod"),
        join(directory, "some-package/mod"),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("applies deterministic precedence: extensions before index files", () => {
    const directory = createFixture([
      "some-package/mod.ts",
      "some-package/mod.tsx",
      "some-package/mod/index.ts",
    ]);

    try {
      assert.equal(
        findOverrideFile(directory, "some-package/mod"),
        join(directory, "some-package/mod.ts"),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("applies deterministic precedence: index.ts before index.tsx before index.js", () => {
    const directory = createFixture([
      "some-package/mod/index.js",
      "some-package/mod/index.tsx",
      "some-package/mod/index.ts",
    ]);

    try {
      assert.equal(
        findOverrideFile(directory, "some-package/mod"),
        join(directory, "some-package/mod/index.ts"),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("returns null when no override exists", () => {
    const directory = createFixture(["some-package/other.ts"]);

    try {
      assert.equal(findOverrideFile(directory, "some-package/mod"), null);
      assert.equal(findOverrideFile(directory, "unrelated-package"), null);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("returns null for a nonexistent override directory", () => {
    const directory = createFixture([]);
    const missing = join(directory, "missing");

    try {
      assert.equal(findOverrideFile(missing, "some-package/mod"), null);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects specifiers escaping the override directory", () => {
    const directory = createFixture(["@comity/x/keep.ts"]);
    const outside = resolve(directory, "..", "escape-open.ts");

    writeFileSync(outside, "export default 0;");

    try {
      assert.equal(existsSync(outside), true);

      for (const specifier of [
        "../../escape-open",
        "@comity/x/../../escape-open",
        "some-package/../../../escape-open",
      ]) {
        assert.equal(findOverrideFile(directory, specifier), null);
      }

      assert.equal(findOverrideFile(directory, "escape-open"), null);
    } finally {
      rmSync(outside, { force: true });
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("never resolves a file outside the override directory", () => {
    const root = createFixture([]);
    const overridesDir = join(root, "overrides");

    try {
      writeFileSync(join(root, "outside.ts"), "export default 0;");

      assert.equal(findOverrideFile(overridesDir, "outside"), null);
      assert.equal(findOverrideFile(overridesDir, "@comity/../outside"), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("plumaOverrides plugin", () => {
  it("resolves bare specifiers and returns null otherwise", () => {
    const directory = createFixture(["@comity/foo/bar.ts"]);
    const plugin = plumaOverrides({ dir: directory });
    const resolveId = plugin.resolveId as (id: string) => string | null;

    try {
      assert.equal(
        resolveId("@comity/foo/bar"),
        join(directory, "@comity/foo/bar.ts"),
      );
      assert.equal(resolveId("./relative"), null);
      assert.equal(resolveId("../relative"), null);
      assert.equal(resolveId("/absolute"), null);
      assert.equal(resolveId("virtual:foo"), null);
      assert.equal(resolveId("missing-package"), null);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("defaults to the overrides directory convention", () => {
    const root = createFixture(["overrides/some-package/mod.ts"]);
    const plugin = plumaOverrides();
    const resolveId = plugin.resolveId as (id: string) => string | null;

    try {
      assert.equal(DEFAULT_OVERRIDES_DIR, "overrides");
      (plugin.configResolved as (config: { root: string }) => void)({
        root,
      });
      assert.equal(
        resolveId("some-package/mod"),
        join(root, DEFAULT_OVERRIDES_DIR, "some-package/mod.ts"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves a relative dir against the Vite project root", () => {
    const root = createFixture(["overrides/@comity/foo/bar.ts"]);
    const plugin = plumaOverrides({ dir: "overrides" });
    const resolveId = plugin.resolveId as (id: string) => string | null;

    try {
      (plugin.configResolved as (config: { root: string }) => void)({
        root,
      });
      assert.equal(
        resolveId("@comity/foo/bar"),
        join(root, "overrides", "@comity/foo/bar.ts"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("watches the override directory", () => {
    const directory = createFixture(["some-package/mod.ts"]);
    const plugin = plumaOverrides({ dir: directory });
    const added: string[] = [];

    try {
      (plugin.configureServer as (server: unknown) => void)({
        watcher: {
          add(path: string): void {
            added.push(path);
          },
        },
      });
      assert.deepEqual(added, [directory]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("discovers a created override on the next resolution", () => {
    const directory = createFixture([]);
    const plugin = plumaOverrides({ dir: directory });
    const resolveId = plugin.resolveId as (id: string) => string | null;

    try {
      assert.equal(resolveId("some-package/mod"), null);
      mkdirSync(join(directory, "some-package"), { recursive: true });
      writeFileSync(
        join(directory, "some-package/mod.ts"),
        "export default 0;",
      );
      assert.equal(
        resolveId("some-package/mod"),
        join(directory, "some-package/mod.ts"),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("falls back to null when an override is deleted", () => {
    const directory = createFixture(["some-package/mod.ts"]);
    const plugin = plumaOverrides({ dir: directory });
    const resolveId = plugin.resolveId as (id: string) => string | null;

    try {
      assert.notEqual(resolveId("some-package/mod"), null);
      rmSync(join(directory, "some-package/mod.ts"));
      assert.equal(resolveId("some-package/mod"), null);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("keeps resolving the override after an unrelated file change", () => {
    const directory = createFixture(["some-package/mod.ts", "unrelated.ts"]);
    const plugin = plumaOverrides({ dir: directory });
    const resolveId = plugin.resolveId as (id: string) => string | null;

    try {
      assert.equal(
        resolveId("some-package/mod"),
        join(directory, "some-package/mod.ts"),
      );
      writeFileSync(join(directory, "unrelated.ts"), "export default 1;");
      assert.equal(
        resolveId("some-package/mod"),
        join(directory, "some-package/mod.ts"),
      );
      rmSync(join(directory, "unrelated.ts"));
      assert.equal(
        resolveId("some-package/mod"),
        join(directory, "some-package/mod.ts"),
      );
      assert.equal(resolveId("unrelated"), null);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("does not crash when the override directory does not exist", () => {
    const root = createFixture([]);
    const plugin = plumaOverrides({ dir: join(root, "never-created") });
    const resolveId = plugin.resolveId as (id: string) => string | null;

    try {
      assert.equal(resolveId("some-package"), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
