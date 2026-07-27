/**
 * e2e：OAuth 出站（api-to-mcp）骨架（conditional skip）
 *
 * 降级策略：mock 外部 AS 成本高，本 task 只产出骨架文件 + conditional skip 标记，
 * 证明 DoD 项有交代。fixture 激活后（设置环境变量 P3_OAUTH_OUTBOUND_E2E）
 * 展开为真实假 AS + 假受保护资源的端到端验证。
 *
 * 参考 P2 oauth-client-credentials.test.ts 的 conditional skip 模式。
 */
import { describe, it } from 'vitest';

// 参考 P2：若测试环境未配 api-to-mcp oauth 工具，conditional skip
const hasOAuthOutboundFixture = !!process.env.P3_OAUTH_OUTBOUND_E2E;

describe.skipIf(!hasOAuthOutboundFixture)('OAuth 出站（api-to-mcp）', () => {
  it('调 oauth 保护的 API 工具 → 自动取 token + 注入 + 缓存命中', async () => {
    // TODO(fixture 激活): 用 test-app 挂假 AS token endpoint + 假受保护资源
    // 1. 配置一个 api-to-mcp 工具，auth.type=oauth, tokenUrl 指向假 AS
    // 2. 调工具 → 验证 Authorization: Bearer <token> 注入到受保护资源请求
    // 3. 第二次调 → 验证不再打 token endpoint（缓存命中）
    throw new Error(
      'P3_OAUTH_OUTBOUND_E2E fixture 未实现：设置 P3_OAUTH_OUTBOUND_E2E=1 前需先完成 fixture',
    );
  });
});
