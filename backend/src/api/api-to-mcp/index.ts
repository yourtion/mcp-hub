/**
 * API到MCP配置管理API端点
 * 提供API配置的CRUD操作和测试功能
 */

import { Hono } from 'hono';
import { requireAuth } from '../../middleware/simple-auth.js';
import type { ApiToMcpWebService } from '../../services/api-to-mcp-web-service.js';
import type { McpHubService } from '../../services/mcp_hub_service.js';
import type {
  ApiConfigListResponse,
  ApiResponse,
  ApiToolConfig,
  CreateApiConfigRequest,
  TestApiConfigRequest,
  TestApiConfigResponse,
} from '../../types/web-api.js';
import { logger } from '../../utils/logger.js';

// 扩展Hono的Context类型以包含API到MCP服务
declare module 'hono' {
  interface ContextVariableMap {
    apiToMcpWebService: ApiToMcpWebService;
  }
}

/**
 * 重新加载Hub服务的API工具配置
 * 确保McpHubService中的工具列表与ApiToMcpWebService同步
 */
async function reloadHubApiTools(): Promise<void> {
  try {
    const { getExistingHubService } = await import('../tools/index.js');
    const hubService = getExistingHubService();
    if (!hubService) {
      logger.debug('Hub服务尚未初始化，跳过API工具同步');
      return;
    }
    await hubService.reloadApiToolConfig();
    logger.info('Hub服务API工具配置同步完成');
  } catch (error) {
    logger.warn('Hub服务API工具配置同步失败，不影响配置管理操作', {
      error: (error as Error).message,
    });
  }
}

// 创建API路由
const apiToMcpRoutes = new Hono();

// 服务可用性检查中间件
apiToMcpRoutes.use('*', async (c, next) => {
  const service = c.get('apiToMcpWebService');
  if (!service) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'API到MCP服务不可用',
        },
      },
      503,
    );
  }
  await next();
});

/**
 * 获取API配置列表
 * GET /api/api-to-mcp/configs
 */
apiToMcpRoutes.get('/configs', requireAuth, async (c) => {
  try {
    logger.info('获取API配置列表');

    // 获取API到MCP Web服务实例
    const apiToMcpService = c.get('apiToMcpWebService') as ApiToMcpWebService;

    // 获取API配置列表
    const configs = await apiToMcpService.getConfigs();

    const response: ApiResponse<ApiConfigListResponse> = {
      success: true,
      data: configs,
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error) {
    logger.error('获取API配置列表失败', error as Error);

    const response = {
      success: false,
      error: {
        code: 'GET_API_CONFIGS_FAILED',
        message: '获取API配置列表失败',
        details: (error as Error).message,
      },
    };

    return c.json(response, 500);
  }
});

/**
 * 创建新的API配置
 * POST /api/api-to-mcp/configs
 */
apiToMcpRoutes.post('/configs', requireAuth, async (c) => {
  try {
    const body = (await c.req.json()) as CreateApiConfigRequest;

    logger.info('创建新的API配置', { context: { config: body.config } });

    // 获取API到MCP Web服务实例
    const apiToMcpService = c.get('apiToMcpWebService') as ApiToMcpWebService;

    // 创建配置
    const result = await apiToMcpService.createConfig(body.config);

    if (!result.success) {
      const response = {
        success: false,
        error: {
          code: 'CREATE_API_CONFIG_FAILED',
          message: result.message,
        },
      };

      return c.json(response, 400);
    }

    logger.info('API配置创建成功', { context: { configId: body.config.id } });

    // 同步Hub服务的API工具配置
    await reloadHubApiTools();

    const response: ApiResponse<{
      id: string;
      message: string;
      config?: ApiToolConfig;
    }> = {
      success: true,
      data: {
        id: body.config.id,
        message: result.message,
        config: result.config,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response, 201);
  } catch (error) {
    logger.error('创建API配置失败', error as Error);

    // Check if it's a JSON parsing error
    if (
      error instanceof SyntaxError &&
      (error as Error).message?.includes('JSON')
    ) {
      const response = {
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: '请求体包含无效的JSON格式',
        },
      };

      return c.json(response, 400);
    }

    const response = {
      success: false,
      error: {
        code: 'CREATE_API_CONFIG_FAILED',
        message: '创建API配置失败',
        details: (error as Error).message,
      },
    };

    return c.json(response, 500);
  }
});

/**
 * 更新API配置
 * PUT /api/api-to-mcp/configs/:id
 */
apiToMcpRoutes.put('/configs/:id', requireAuth, async (c) => {
  try {
    const configId = c.req.param('id');
    const body = (await c.req.json()) as { config: ApiToolConfig };

    logger.info('更新API配置', { context: { configId, config: body.config } });

    // 验证配置数据
    if (!body.config || !body.config.name) {
      const response = {
        success: false,
        error: {
          code: 'INVALID_CONFIG',
          message: '配置数据无效：缺少必要字段',
        },
      };

      return c.json(response, 400);
    }

    // 验证配置ID匹配
    if (body.config.id !== configId) {
      const response = {
        success: false,
        error: {
          code: 'UPDATE_API_CONFIG_FAILED',
          message: '配置ID不匹配',
        },
      };

      return c.json(response, 400);
    }

    // 获取API到MCP Web服务实例
    const apiToMcpService = c.get('apiToMcpWebService') as ApiToMcpWebService;

    // 更新配置
    const result = await apiToMcpService.updateConfig(configId, body.config);

    if (!result.success) {
      const response = {
        success: false,
        error: {
          code: 'UPDATE_API_CONFIG_FAILED',
          message: result.message,
        },
      };

      return c.json(response, 400);
    }

    logger.info('API配置更新成功', { context: { configId } });

    // 同步Hub服务的API工具配置
    await reloadHubApiTools();

    const response: ApiResponse<{
      id: string;
      message: string;
      config?: ApiToolConfig;
    }> = {
      success: true,
      data: {
        id: configId,
        message: result.message,
        config: result.config,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error) {
    logger.error('更新API配置失败', error as Error);

    const response = {
      success: false,
      error: {
        code: 'UPDATE_API_CONFIG_FAILED',
        message: '更新API配置失败',
        details: (error as Error).message,
      },
    };

    return c.json(response, 500);
  }
});

/**
 * 删除API配置
 * DELETE /api/api-to-mcp/configs/:id
 */
apiToMcpRoutes.delete('/configs/:id', requireAuth, async (c) => {
  try {
    const configId = c.req.param('id');

    logger.info('删除API配置', { context: { configId } });

    // 获取API到MCP Web服务实例
    const apiToMcpService = c.get('apiToMcpWebService') as ApiToMcpWebService;

    // 删除配置
    const result = await apiToMcpService.deleteConfig(configId);

    if (!result.success) {
      const response = {
        success: false,
        error: {
          code: 'DELETE_API_CONFIG_FAILED',
          message: result.message,
        },
      };

      return c.json(response, 400);
    }

    logger.info('API配置删除成功', { context: { configId } });

    // 同步Hub服务的API工具配置
    await reloadHubApiTools();

    const response: ApiResponse<{ id: string; message: string }> = {
      success: true,
      data: {
        id: configId,
        message: result.message,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error) {
    logger.error('删除API配置失败', error as Error);

    const response = {
      success: false,
      error: {
        code: 'DELETE_API_CONFIG_FAILED',
        message: '删除API配置失败',
        details: (error as Error).message,
      },
    };

    return c.json(response, 500);
  }
});

/**
 * 测试API配置
 * POST /api/api-to-mcp/configs/:id/test
 */
apiToMcpRoutes.post('/configs/:id/test', requireAuth, async (c) => {
  try {
    const configId = c.req.param('id');
    const body = (await c.req.json()) as TestApiConfigRequest;

    logger.info('测试API配置', {
      context: { configId, parameters: body.parameters },
    });

    // 获取API到MCP Web服务实例
    const apiToMcpService = c.get('apiToMcpWebService') as ApiToMcpWebService;

    // 执行API配置测试
    const testResponse = await apiToMcpService.testConfig(
      configId,
      body.parameters,
    );

    return c.json(testResponse);
  } catch (error) {
    logger.error('测试API配置失败', error as Error);

    const response: TestApiConfigResponse = {
      success: false,
      error: 'Test failed',
      executionTime: 0,
    };

    return c.json(response, 200);
  }
});

/**
 * 获取API配置详情
 * GET /api/api-to-mcp/configs/:id
 */
apiToMcpRoutes.get('/configs/:id', requireAuth, async (c) => {
  try {
    const configId = c.req.param('id');

    logger.info('获取API配置详情', { context: { configId } });

    // 获取API到MCP Web服务实例
    const apiToMcpService = c.get('apiToMcpWebService') as ApiToMcpWebService;

    // 获取API配置详情
    const config = await apiToMcpService.getConfigDetails(configId);

    if (!config) {
      const response = {
        success: false,
        error: {
          code: 'API_CONFIG_NOT_FOUND',
          message: `API配置 ${configId} 不存在`,
        },
      };

      return c.json(response, 404);
    }

    const response: ApiResponse<ApiToolConfig> = {
      success: true,
      data: config,
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error) {
    logger.error('获取API配置详情失败', error as Error);

    const response = {
      success: false,
      error: {
        code: 'GET_API_CONFIG_DETAIL_FAILED',
        message: '获取API配置详情失败',
        details: (error as Error).message,
      },
    };

    return c.json(response, 500);
  }
});

export { apiToMcpRoutes };
