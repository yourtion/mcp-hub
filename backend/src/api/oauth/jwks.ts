/**
 * GET /api/oauth/jwks —— 内置 AS 公钥集合（RFC7517 JWK Set）
 */
import { getInternalPublicKeySet } from '../../services/oauth/crypto-keys.js';

import type { Hono } from 'hono';

export function registerJwksRoutes(app: Hono) {
  app.get('/jwks', (c) => {
    const keys = getInternalPublicKeySet();
    return c.json({ keys });
  });
}
