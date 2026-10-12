import type { LayoutProps } from './types.js';

import { useLayout } from '@comity/html-preact';

export function EmptyLayout({ page, resolvers, children }: LayoutProps) {
  const layout = useLayout();
  const clientScript = import.meta.env.DEV ? '/src/client.ts' : '/static/client.js';
  const stylesheet = import.meta.env.DEV ? '/src/style.css' : '/static/assets/client.css';
  const mainContentId = 'main-content';

  // Register document metadata in Comity's layout collector.
  layout?.setHtmlAttributes({ lang: page.seo?.openGraph?.locale || 'en' });
  layout?.setTitle(page.seo?.title || page.title);
  layout?.addMeta({
    name: 'viewport',
    content: 'width=device-width, initial-scale=1',
  });
  layout?.addLink({ rel: 'stylesheet', href: stylesheet });

  // Apply SEO head tags from the page's SEO model (application-owned composition).
  const seo = page.seo;

  if (seo) {
    // Apply description, robots, and canonical link if present in the SEO model.
    if (seo.description) {
      layout?.addMeta({ name: 'description', content: seo.description });
    }

    // Apply robots meta tag if present in the SEO model.
    if (seo.robots) {
      layout?.addMeta({ name: 'robots', content: seo.robots });
    }

    // Apply canonical link if present in the SEO model.
    if (seo.canonical) {
      layout?.addLink({ rel: 'canonical', href: seo.canonical });
    }

    // Apply Open Graph metadata if present in the SEO model.
    if (seo.openGraph) {
      const og = seo.openGraph;

      if (og.title) layout?.addMeta({ property: 'og:title', content: og.title });

      if (og.description)
        layout?.addMeta({
          property: 'og:description',
          content: og.description,
        });

      if (og.image) layout?.addMeta({ property: 'og:image', content: og.image });

      if (og.url) layout?.addMeta({ property: 'og:url', content: og.url });

      if (og.siteName) layout?.addMeta({ property: 'og:site_name', content: og.siteName });

      if (og.type) layout?.addMeta({ property: 'og:type', content: og.type });

      if (og.locale) layout?.addMeta({ property: 'og:locale', content: og.locale });
    }

    // Apply Twitter Card metadata if present in the SEO model.
    if (seo.twitterCard) {
      const twitter = seo.twitterCard;

      if (twitter.card) layout?.addMeta({ name: 'twitter:card', content: twitter.card });

      if (twitter.title) layout?.addMeta({ name: 'twitter:title', content: twitter.title });

      if (twitter.description)
        layout?.addMeta({
          name: 'twitter:description',
          content: twitter.description,
        });

      if (twitter.image) layout?.addMeta({ name: 'twitter:image', content: twitter.image });

      if (twitter.creator) layout?.addMeta({ name: 'twitter:creator', content: twitter.creator });

      if (twitter.site) layout?.addMeta({ name: 'twitter:site', content: twitter.site });
    }

    // Apply structured data scripts if present in the SEO model.
    if (seo.structuredData?.length) {
      for (const item of seo.structuredData) {
        layout?.addScript({
          type: 'application/ld+json',
          content: JSON.stringify(item.data),
        });
      }
    }
  }

  return (
    <>
      <main id={mainContentId}>
        {page.blocks
          ?.filter(({ region }) => region === 'hero')
          .map((block) => resolvers?.find((r) => r.supports(block))?.resolve(block))}

        <div
          className="wrapper"
          style={{
            '--flow-space': 'var(--space-s-m)',
            '--region-space': 'var(--space-m-l)',
          }}
        >
          {children}

          {page.blocks
            ?.filter(({ region }) => region === 'footer')
            .map((block) => resolvers?.find((r) => r.supports(block))?.resolve(block))}
        </div>
      </main>

      <script type="module" src={clientScript}></script>
    </>
  );
}
