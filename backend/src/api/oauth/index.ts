/**
 * OAuth 路由聚合
 *
 * /api/oauth/token   —— 内置 AS token 端点（client_credentials）
 * /api/oauth/jwks    —— 内置 AS 公钥（RFC7517 JWK Set）
 * /.well-known/*     —— Protected Resource / AS metadata（在 app.ts 单独挂载，不在 /api 下）
 */
import { Hono } from 'hono';

import { registerJwksRoutes } from './jwks.js';
import { registerTokenRoutes } from './token.js';

export { registerWellKnownRoutes } from './well-known.js';

export const oauthApi = new Hono();
registerTokenRoutes(oauthApi);
registerJwksRoutes(oauthApi);
