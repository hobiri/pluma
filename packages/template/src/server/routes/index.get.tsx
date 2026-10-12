import type { HttpResponse } from '@comity/http';

import { renderPage } from '@hobiri/website-runtime';

import { EmptyLayout } from '../../layouts/index.js';

export default {
  method: 'GET',
  path: '/',
  handler: async (): Promise<HttpResponse> => {
    const view = (
      <EmptyLayout
        page={{
          id: 'home',
          url: '/',
          title: 'Welcome',
          seo: {
            title: 'Welcome',
            description: 'A new Pluma website',
          },
          layout: 'empty',
          blocks: [],
          status: 'published',
        }}
      >
        <h1>Welcome to your new Pluma website</h1>
        <p>This is the starter baseline. Replace this with your own content.</p>
      </EmptyLayout>
    );

    return renderPage(view);
  },
};
