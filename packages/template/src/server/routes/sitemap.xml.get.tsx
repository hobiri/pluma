import type { HttpContext } from '@comity/http';
import type { SitemapUrl } from '@comity/seo';

import { sitemapResponse } from '@hobiri/website-runtime';

export default {
  method: 'GET',
  path: '/sitemap.xml',
  handler: async (ctx: HttpContext) => {
    const origin = ctx.request.url.origin;

    // Website provides the URL inventory. This is a baseline example.
    // Replace with your own static and dynamic URL generation.
    const urls: readonly SitemapUrl[] = [
      {
        loc: `${origin}/`,
        priority: '1.0',
        changefreq: 'daily',
      },
    ];

    return sitemapResponse(urls);
  },
};
