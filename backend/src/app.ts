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
import { mcp } from './mcp.js';
import { createAuthMiddleware } from './middleware/auth.js';
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

// 性能监控中间件（在所有路由之前）
app.use('*', createPerformanceMiddleware());

// 初始化认证服务
app.use('*', async (c, next) => {
  // 确保认证服务已初始化
  try {
    await authService.initialize();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to initialize auth service', error as Error);

    // 在测试环境中，区分配置文件不存在/无效和其他错误
    if (process.env.NODE_ENV === 'test') {
      // 如果是配置文件不存在或无法读取的错误，继续执行（允许某些测试不配置认证）
      if (
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('no such file') ||
        errorMessage.includes('Cannot convert undefined or null to object') ||
        errorMessage.includes('Failed to load system config')
      ) {
        await next();
        return;
      }

      // 其他错误（如配置格式错误）应该明确失败
      return c.json(
        {
          success: false,
          error: {
            code: 'AUTH_INIT_FAILED',
            message: 'Authentication service failed to initialize',
            details: errorMessage,
          },
        },
        500,
      );
    }
  }
  await next();
});

// 初始化 API 到 MCP Web 服务
app.use('*', async (c, next) => {
  try {
    const config = await getAllConfig();
    const configPath = config.apiToolsConfigPath;

    // 检查服务是否已初始化
    const healthStatus = await apiToMcpWebService.getHealthStatus();
    if (!healthStatus.initialized && configPath) {
      await apiToMcpWebService.initialize(configPath);
      logger.info('API 到 MCP Web 服务初始化成功', { configPath });
    }

    // 将服务实例注入到上下文
    c.set('apiToMcpWebService', apiToMcpWebService);
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
