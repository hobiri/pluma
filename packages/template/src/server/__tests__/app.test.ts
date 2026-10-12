import { describe, expect, it } from 'vitest';

import { createWebsiteApp } from '@hobiri/website-runtime';

import middlewares from '../middleware/index.js';
import notFound from '../middleware/not-found.js';
import home from '../routes/index.get.js';
import sitemap from '../routes/sitemap.xml.get.js';

async function streamText(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return text;
    }
    text += typeof value === 'string' ? value : decoder.decode(value);
  }
}

describe('pluma application', () => {
  it('serves the home route through the shared bootstrap', async () => {
    const app = await createWebsiteApp({
      routes: [home, sitemap],
      middlewares,
    });

    const response = await app.request('/');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/html/);
    const body = await streamText(response.body as ReadableStream);
    expect(body).toMatch(/<h1>Welcome to your new Pluma website<\/h1>/);
  });

  it('does not mutate the caller-owned route list', async () => {
    const routes = [home, sitemap];

    await createWebsiteApp({ routes, middlewares });

    expect(routes).toHaveLength(2);
  });

  it('serves the sitemap with the application-owned inventory', async () => {
    const app = await createWebsiteApp({
      routes: [home, sitemap],
      middlewares,
    });

    const response = await app.request('/sitemap.xml');
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/xml/);
    expect(text).toMatch(/<urlset/);
    expect(text).toMatch(/http:\/\/localhost\//);
  });

  it('renders the application 404 view for unknown paths', async () => {
    const app = await createWebsiteApp({
      routes: [home, sitemap],
      middlewares,
    });

    const response = await app.request('/missing');
    const text = await streamText(response.body as ReadableStream);

    expect(response.status).toBe(404);
    expect(text).toMatch(/<h1>404 - Not Found<\/h1>/);
  });

  it('passes non-404 responses through the 404 middleware', async () => {
    const ok = { status: 200 as const, body: 'ok' };

    const result = await notFound({} as never, async () => ok);

    expect(result).toBe(ok);
  });
});
