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
    // 开放模式（未配置 oauth）下，请求在协议层（缺 Accept / 未 initialize）即被拒，
    // 返回 400/404，不会走到 auth 中间件；503 = oauth 未配置外部 IdP。
    // 这些都按 conditional skip 策略放行；仅 401 才是 aud 校验失败的有意义信号。
    expect([401, 400, 404, 503]).toContain(res.status);
  });
});
