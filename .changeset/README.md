# Changesets

This directory holds [Changesets](https://github.com/changesets/changesets)
release metadata for the Pluma workspace. Changesets are the authoritative
mechanism for versioning and changelog generation of the two publishable
packages (`@hobiri/pluma-vite`, `@hobiri/pluma-template`), which are versioned
independently.

## Writing a changeset

```sh
pnpm changeset
```

Select only the packages affected by the change:

- bug fix → `patch`
- new backwards-compatible feature → `minor`
- breaking change → `major`
- change touching both packages → select both, with a bump type per package
- documentation-only change with no effect on the published contract → no
  changeset file is needed

`@hobiri/website-runtime` is an external dependency released from another
workspace: never select it here, and never add it to this workspace.

## How releases happen

1. Merging a PR that contains changeset files lets the release workflow open
   (or update) a `Version Packages` pull request.
2. Merging that version PR writes the new versions and `CHANGELOG.md` entries.
3. The release workflow then builds and publishes the bumped packages to npm
   in dependency order (see `README.md` for the required `NPM_TOKEN` secret).
