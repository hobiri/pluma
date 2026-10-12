import { createWebsiteApp } from '@hobiri/website-runtime';

import routes from 'virtual:pluma/routes';
import middlewares from './server/middleware/index.js';

const app = await createWebsiteApp({ routes, middlewares });

export default app;
