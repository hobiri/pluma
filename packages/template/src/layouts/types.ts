import type { BlockResolver, PageModel } from '@comity/content';
import type { ComponentChildren } from 'preact';

/**
 * LayoutProps interface defines the properties that are passed to a layout component.
 * It includes the page model containing metadata and content, as well as optional
 * children components that can be rendered within the layout.
 */
export interface LayoutProps {
  /** Page model containing metadata and content */
  readonly page: PageModel;

  /** Array of block resolvers used to render specific blocks within the layout */
  readonly resolvers?: ReadonlyArray<BlockResolver>;

  /** Children components */
  readonly children?: ComponentChildren;
}
