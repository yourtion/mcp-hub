/**
 * OAuthStrategy 单元测试
 */

import { describe, expect, it, vi } from 'vitest';

import { OAuthStrategy } from './oauth-strategy.js';

import type { HttpRequestConfig, HttpResponse } from '../types/http-client.js';
import type { CacheManager } from './cache-manager.js';
import type { HttpClient } from './http-client.js';
import type { CachedToken } from './oauth-strategy.js';

function createMockHttpClient(tokenResponse: unknown, status = 200): HttpClient {
  const mockResponse: HttpResponse = {
    status,
    statusText: status === 200 ? 'OK' : 'Bad Request',
    headers: new Headers(),
    data: tokenResponse,
    raw: new Response(),
    config: { url: '', method: 'POST' },
  };
  return {
    request: vi.fn().mockResolvedValue(mockResponse),
  } as unknown as HttpClient;
}

function createMockCache(): CacheManager & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    getStats: vi.fn(() => ({ hits: 0, misses: 0, keys: 0, maxKeys: 0 })),
    setStrategy: vi.fn(),
    clear: vi.fn(async () => {
      store.clear();
    }),
  } as unknown as CacheManager & { store: Map<string, unknown> };
}

describe('OAuthStrategy', () => {
  describe('applyAuth — client_credentials 首次取 token', () => {
    it('缓存未命中 → fetchToken → 注入 Authorization: Bearer', async () => {
      const httpClient = createMockHttpClient({
        access_token: 'tok-123',
        expires_in: 3600,
        token_type: 'Bearer',
      });
      const cache = createMockCache();
      const strategy = new OAuthStrategy(httpClient, cache);

      const request: HttpRequestConfig = {
        url: 'https://api.example.com/x',
        method: 'GET',
        headers: {},
      };
      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'secret',
        tokenUrl: 'https://as.example.com/token',
        scope: 'read',
      };

      const result = await strategy.applyAuth(request, config);

      expect(result.headers!.Authorization).toBe('Bearer tok-123');
      expect(httpClient.request).toHaveBeenCalledOnce();
    });

    it('缓存命中 → 不再调 token endpoint', async () => {
      const httpClient = createMockHttpClient({ access_token: 'tok-fresh', expires_in: 3600 });
      const cache = createMockCache();
      const strategy = new OAuthStrategy(httpClient, cache);

      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'secret',
        tokenUrl: 'https://as.example.com/token',
        scope: 'read',
      };
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/x',
        method: 'GET',
        headers: {},
      };

      // 第一次：miss → fetch
      await strategy.applyAuth(request, config);
      // 第二次：应命中缓存
      await strategy.applyAuth(request, config);

      expect(httpClient.request).toHaveBeenCalledOnce();
    });

    it('自定义 headerName/tokenPrefix → 注入到指定 header', async () => {
      const httpClient = createMockHttpClient({ access_token: 'tok-x', expires_in: 3600 });
      const cache = createMockCache();
      const strategy = new OAuthStrategy(httpClient, cache);

      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'secret',
        tokenUrl: 'https://as.example.com/token',
        headerName: 'X-Token',
        tokenPrefix: '',
      };
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/x',
        method: 'GET',
        headers: {},
      };

      const result = await strategy.applyAuth(request, config);

      expect(result.headers!['X-Token']).toBe('tok-x');
    });
  });

  describe('applyAuth — 失败处理', () => {
    it('token endpoint 返回 401 → 抛 OAUTH_OUTBOUND_TOKEN_FETCH_FAILED', async () => {
      const httpClient = createMockHttpClient({ error: 'invalid_client' }, 401);
      const cache = createMockCache();
      const strategy = new OAuthStrategy(httpClient, cache);

      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'secret',
        tokenUrl: 'https://as.example.com/token',
      };
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/x',
        method: 'GET',
        headers: {},
      };

      await expect(strategy.applyAuth(request, config)).rejects.toThrow();
    });

    it('错误 context 不含 clientSecret', async () => {
      const httpClient = createMockHttpClient({ error: 'bad' }, 500);
      const cache = createMockCache();
      const strategy = new OAuthStrategy(httpClient, cache);

      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'super-secret-value',
        tokenUrl: 'https://as.example.com/token',
      };
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/x',
        method: 'GET',
        headers: {},
      };

      try {
        await strategy.applyAuth(request, config);
        expect.fail('应抛错');
      } catch (err) {
        const str = JSON.stringify(err);
        expect(str).not.toContain('super-secret-value');
      }
    });
  });

  describe('applyAuth — refresh_token 续期', () => {
    it('缓存将过期 + 有 refreshToken → refresh 成功', async () => {
      const cache = createMockCache();

      const httpClient = {
        request: vi.fn(async (req: HttpRequestConfig) => {
          const body = req.data as string;
          if (body.includes('grant_type=refresh_token')) {
            return {
              status: 200,
              statusText: 'OK',
              headers: new Headers(),
              data: { access_token: 'refreshed-tok', expires_in: 3600 },
              raw: new Response(),
              config: req,
            } as unknown as HttpResponse;
          }
          return {
            status: 200,
            statusText: 'OK',
            headers: new Headers(),
            data: { access_token: 'fresh-tok', expires_in: 3600 },
            raw: new Response(),
            config: req,
          } as unknown as HttpResponse;
        }),
      } as unknown as HttpClient;

      const strategy = new OAuthStrategy(httpClient, cache);
      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'secret',
        tokenUrl: 'https://as.example.com/token',
      };
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/x',
        method: 'GET',
        headers: {},
      };

      // 让 cache.get 返回一个"将过期 + 有 refreshToken"的 token，触发 refresh 路径
      vi.spyOn(cache, 'get').mockResolvedValueOnce({
        accessToken: 'old-tok',
        expiresAt: Date.now() + 30_000, // 30s 后过期，< 60s buffer → 触发 refresh
        refreshToken: 'rt-xxx',
      } as unknown as CachedToken);

      const result = await strategy.applyAuth(request, config);
      expect(result.headers!.Authorization).toBe('Bearer refreshed-tok');
      expect(httpClient.request).toHaveBeenCalledOnce();
    });

    it('refresh 失败（invalid_grant）→ 静默回退 client_credentials', async () => {
      const cache = createMockCache();
      const httpClient = {
        request: vi.fn(async (req: HttpRequestConfig) => {
          const body = req.data as string;
          if (body.includes('grant_type=refresh_token')) {
            return {
              status: 400,
              statusText: 'Bad Request',
              headers: new Headers(),
              data: { error: 'invalid_grant' },
              raw: new Response(),
              config: req,
            } as unknown as HttpResponse;
          }
          return {
            status: 200,
            statusText: 'OK',
            headers: new Headers(),
            data: { access_token: 'fallback-tok', expires_in: 3600 },
            raw: new Response(),
            config: req,
          } as unknown as HttpResponse;
        }),
      } as unknown as HttpClient;

      const strategy = new OAuthStrategy(httpClient, cache);
      vi.spyOn(cache, 'get').mockResolvedValueOnce({
        accessToken: 'old-tok',
        expiresAt: Date.now() + 30_000,
        refreshToken: 'rt-xxx',
      } as unknown as CachedToken);

      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'secret',
        tokenUrl: 'https://as.example.com/token',
      };
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/x',
        method: 'GET',
        headers: {},
      };

      const result = await strategy.applyAuth(request, config);
      expect(result.headers!.Authorization).toBe('Bearer fallback-tok');
      expect(httpClient.request).toHaveBeenCalledTimes(2); // refresh 1 次 + client_credentials 1 次
    });

    it('refresh 返回 2xx 但缺 access_token → 回退 client_credentials', async () => {
      const cache = createMockCache();
      const httpClient = {
        request: vi.fn(async (req: HttpRequestConfig) => {
          const body = req.data as string;
          if (body.includes('grant_type=refresh_token')) {
            // 2xx 但响应体缺 access_token
            return {
              status: 200,
              statusText: 'OK',
              headers: new Headers(),
              data: { expires_in: 3600 }, // 缺 access_token
              raw: new Response(),
              config: req,
            } as unknown as HttpResponse;
          }
          return {
            status: 200,
            statusText: 'OK',
            headers: new Headers(),
            data: { access_token: 'fallback-tok', expires_in: 3600 },
            raw: new Response(),
            config: req,
          } as unknown as HttpResponse;
        }),
      } as unknown as HttpClient;

      const strategy = new OAuthStrategy(httpClient, cache);
      vi.spyOn(cache, 'get').mockResolvedValueOnce({
        accessToken: 'old-tok',
        expiresAt: Date.now() + 30_000,
        refreshToken: 'rt-xxx',
      } as unknown as CachedToken);

      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'secret',
        tokenUrl: 'https://as.example.com/token',
      };
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/x',
        method: 'GET',
        headers: {},
      };

      const result = await strategy.applyAuth(request, config);
      expect(result.headers!.Authorization).toBe('Bearer fallback-tok');
      expect(httpClient.request).toHaveBeenCalledTimes(2); // refresh 1 次（抛错）+ client_credentials 1 次
    });
  });

  describe('validateConfig', () => {
    const strategy = new OAuthStrategy({} as HttpClient, {} as CacheManager);

    it('缺 clientId → 无效', async () => {
      const result = await strategy.validateConfig({
        type: 'oauth',
        grantType: 'client_credentials',
        // @ts-expect-error 测试缺字段
        clientId: undefined,
        clientSecret: 's',
        tokenUrl: 'https://x.com/token',
      });
      expect(result.valid).toBe(false);
    });

    it('refresh_token grant 缺 refreshToken → 无效', async () => {
      const result = await strategy.validateConfig({
        type: 'oauth',
        grantType: 'refresh_token',
        clientId: 'cid',
        clientSecret: 's',
        tokenUrl: 'https://x.com/token',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('refreshToken');
    });

    it('完整配置 → 有效', async () => {
      const result = await strategy.validateConfig({
        type: 'oauth',
        grantType: 'client_credentials',
        clientId: 'cid',
        clientSecret: 's',
        tokenUrl: 'https://x.com/token',
      });
      expect(result.valid).toBe(true);
    });
  });
});
