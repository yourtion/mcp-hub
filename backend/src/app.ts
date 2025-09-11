import { Hono } from 'hono';
import { createAuthApi } from './api/auth/index.js';
import { debugApi } from './api/debug/index.js';
import { hubApi } from './api/hub.js';
import { groupMcpRouter } from './api/mcp/group-router.js';
import { serversApi } from './api/servers/index.js';
import { toolsApi } from './api/tools/index.js';
import { mcp } from './mcp.js';
import { AuthService } from './services/auth.js';
import { sse } from './sse.js';

// 创建认证服务实例
const authService = new AuthService();

export const app = new Hono();

// 初始化认证服务
app.use('*', async (_c, next) => {
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
app.route('/api/debug', debugApi);
app.route('/api/servers', serversApi);
app.route('/api/tools', toolsApi);

// 导出认证服务供其他模块使用
export { authService };
