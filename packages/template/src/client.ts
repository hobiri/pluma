import type { IslandComponentRegistry } from '@comity/hydration-preact';

import { createHydrationRuntime } from '@comity/hydration-preact';
import { registerIslandElement } from '@comity/hydration/client';

import './style.css';

const registry: IslandComponentRegistry = {};

registerIslandElement();
createHydrationRuntime({
  root: document,
  islands: registry,
});
