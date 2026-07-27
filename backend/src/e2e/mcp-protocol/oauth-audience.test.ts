import { SignJWT, generateKeyPair } from 'jose';
/**
 * e2e：RFC8707 audience 校验
 *   签发一个 aud 指向其它 resource 的 token，访问本 Hub 应被拒（401）。
 */
import { describe, expect, it } from 'vitest';

import { defaultMcpTestConfig } from './mcp-test-config.js';

describe('OAuth audience 校验（RFC8707）', () => {
  it('aud 不匹配的 token 被拒', async () => {
    // 用任意密钥签一个 aud 错的 token（即使签名不被信任，也会因 aud 校验失败被拒）
    const { privateKey } = await generateKeyPair('RS256');
    const wrongToken = await new SignJWT({ scope: 'mcp:tools' })
      .setProtectedHeader({ alg: 'RS256', kid: 'wrong' })
      .setIssuedAt()
      .setIssuer('https://idp.example.com')
      .setSubject('c1')
      .setAudience('https://other-resource.example.com') // 故意错的 aud
      .setExpirationTime('1h')
      .sign(privateKey);

    const res = await fetch(`${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wrongToken}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    // oauth profile：配了 oauth，无有效 token 或 aud 不匹配必拒（auth 中间件返回 401）。
    // 不再放行 400/404/503——那些是「测试环境未进入 oauth-enforced 状态」的信号，
    // 现在 oauth profile 已强制配置，必须严格 401。
    expect(res.status).toBe(401);
  });
});
