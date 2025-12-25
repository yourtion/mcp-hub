import { Hono } from 'hono';
import { createAuthApi } from './api/auth/index.js';
import { configApi } from './api/config/index.js';
import { dashboardApi } from './api/dashboard/index.js';
import { debugApi } from './api/debug/index.js';
import { hubApi } from './api/hub.js';
import { groupMcpRouter } from './api/mcp/group-router.js';
import { performanceApi } from './api/performance/index.js';
import { serversApi } from './api/servers/index.js';
import { toolsApi } from './api/tools/index.js';
import { toolsAdminApi } from './api/tools-admin/index.js';
import { mcp } from './mcp.js';
import { AuthService } from './services/auth.js';
import { sse } from './sse.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createPerformanceMiddleware } from './utils/performance-monitor.js';

// 创建认证服务实例
const authService = new AuthService();

export const app = new Hono();

// 性能监控中间件（在所有路由之前）
app.use('*', createPerformanceMiddleware());

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

// 应用认证中间件到配置API
configApi.use('*', createAuthMiddleware(authService));

app.route('/', mcp);
app.route('/', sse);
// 具体的 API 路由放在通配符路由之前，避免被拦截
app.route('/api', hubApi);
app.route('/api/auth', createAuthApi(authService));
app.route('/api/config', configApi);
app.route('/api/dashboard', dashboardApi);
app.route('/api/debug', debugApi);
app.route('/api/servers', serversApi);
app.route('/api/tools', toolsApi);
app.route('/api/tools-admin', toolsAdminApi);
app.route('/api/performance', performanceApi);
// 通配符路由放在最后
app.route('/', groupMcpRouter); // 组特定MCP路由

// 导出认证服务供其他模块使用
export { authService };
