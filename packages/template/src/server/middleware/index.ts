import type { HttpMiddleware } from '@comity/http';

import notFound from './not-found.js';

const middlewares = [notFound] as HttpMiddleware[];

export default middlewares;
