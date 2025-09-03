import { Hono } from 'hono';
import { createAuthApi } from './api/auth/index.js';
import { hubApi } from './api/hub.js';
import { groupMcpRouter } from './api/mcp/group-router.js';
import { mcp } from './mcp.js';
import { AuthService } from './services/auth.js';
import { sse } from './sse.js';

// 创建认证服务实例
const authService = new AuthService();

export const app = new Hono();

// 初始化认证服务
app.use('*', async (c, next) => {
  // 确保认证服务已初始化
  try {
    await authService.initialize();
  } catch (error) {
    console.error('Failed to initialize auth service:', error);
  }
  await next();
});

app.route('/', mcp);
app.route('/', sse);
app.route('/', groupMcpRouter); // 组特定MCP路由
app.route('/api', hubApi);
app.route('/api/auth', createAuthApi(authService));

// 导出认证服务供其他模块使用
export { authService };
