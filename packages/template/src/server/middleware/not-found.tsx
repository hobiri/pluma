import { createNotFoundMiddleware, renderPage } from '@hobiri/website-runtime';

import { EmptyLayout } from '../../layouts/index.js';

export default createNotFoundMiddleware(async () => {
  const view = (
    <EmptyLayout
      page={{
        id: 'not-found',
        url: '/404',
        title: 'Not Found',
        seo: {
          title: 'Not Found',
          description: 'The page you are looking for does not exist.',
          robots: 'noindex',
        },
        layout: 'empty',
        blocks: [],
        status: 'published',
      }}
    >
      <h1>404 - Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <p>
        <a href="/">Return home</a>
      </p>
    </EmptyLayout>
  );

  return renderPage(view, { status: 404 });
});
