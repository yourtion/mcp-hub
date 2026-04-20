import { Hono } from 'hono';
import { apiToMcpRoutes } from './api/api-to-mcp/index.js';
import { createAuthApi } from './api/auth/index.js';
import { configApi } from './api/config/index.js';
import { dashboardApi } from './api/dashboard/index.js';
import { debugApi } from './api/debug/index.js';
import { groupsApi } from './api/groups/index.js';
import { hubApi } from './api/hub.js';
import { groupMcpRouter } from './api/mcp/group-router.js';
import { performanceApi } from './api/performance/index.js';
import { serversApi } from './api/servers/index.js';
import { toolsApi } from './api/tools/index.js';
import { toolsAdminApi } from './api/tools-admin/index.js';
import { mcp } from './legacy/index.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { secureHeadersMiddleware } from './middleware/security.js';
import { ApiToMcpWebService } from './services/api-to-mcp-web-service.js';
import { AuthService } from './services/auth.js';
import { sse } from './sse.js';
import { getAllConfig } from './utils/config.js';
import { logger } from './utils/logger.js';
import { createPerformanceMiddleware } from './utils/performance-monitor.js';

// 创建认证服务实例
const authService = new AuthService();

// 创建 API 到 MCP Web 服务实例
const apiToMcpWebService = new ApiToMcpWebService();

export const app = new Hono();

// 安全头中间件（在所有路由之前）
app.use('*', secureHeadersMiddleware());

// Request ID 中间件（在安全头之后）
app.use('*', requestIdMiddleware);

// 性能监控中间件（在所有路由之前）
app.use('*', createPerformanceMiddleware());

// 认证服务初始化中间件（不阻止请求，只是确保服务已初始化）
app.use('*', async (_c, next) => {
  try {
    await authService.initialize();
  } catch (error) {
    // 初始化失败不阻止请求，只记录错误
    // 公开端点（如登录）仍然可以工作
    // 受保护的端点会在认证中间件中处理初始化失败
    logger.warn('认证服务初始化失败，某些功能可能不可用', {
      error: error instanceof Error ? error.message : String(error),
    } as Record<string, unknown>);
  }
  await next();
});

// 初始化 API 到 MCP Web 服务
app.use('*', async (c, next) => {
  // 始终将服务实例注入到上下文，确保路由处理器可访问
  c.set('apiToMcpWebService', apiToMcpWebService);

  try {
    const config = await getAllConfig();
    const configPath = config.apiToolsConfigPath;

    // 检查服务是否已初始化
    const healthStatus = await apiToMcpWebService.getHealthStatus();
    if (!healthStatus.initialized && configPath) {
      await apiToMcpWebService.initialize(configPath);
      logger.info('API 到 MCP Web 服务初始化成功', { configPath });
    }
  } catch (error) {
    logger.error('API 到 MCP Web 服务初始化失败', error as Error);
    // 不阻止请求继续，只是服务不可用
  }
  await next();
});

// 创建认证中间件
const authMiddleware = createAuthMiddleware(authService);

// 应用认证中间件到受保护的API路由
configApi.use('*', authMiddleware);
serversApi.use('*', authMiddleware);
toolsApi.use('*', authMiddleware);
groupsApi.use('*', authMiddleware);
dashboardApi.use('*', authMiddleware);
apiToMcpRoutes.use('*', authMiddleware);

// 也在app级别应用认证中间件到受保护的API路径（确保生效）
app.use('/api/servers/*', authMiddleware);
app.use('/api/tools/*', authMiddleware);
app.use('/api/groups/*', authMiddleware);
app.use('/api/config/*', authMiddleware);
app.use('/api/dashboard/*', authMiddleware);
app.use('/api/api-to-mcp/*', authMiddleware);

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
app.route('/api/groups', groupsApi);
app.route('/api/performance', performanceApi);
app.route('/api/api-to-mcp', apiToMcpRoutes);
// 通配符路由放在最后
app.route('/', groupMcpRouter); // 组特定MCP路由

// 导出认证服务供其他模块使用
export { authService };
