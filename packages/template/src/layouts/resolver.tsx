import type { PageModel } from '@comity/content';

import { EmptyLayout } from './empty.js';

/**
 * DefaultLayoutResolver provides a simple layout resolution strategy.
 * Websites can extend or replace this with their own resolver.
 */
export class DefaultLayoutResolver {
  resolve(page: PageModel) {
    switch (page.layout) {
      case 'empty':
        return EmptyLayout;

      default:
        return EmptyLayout;
    }
  }
}
