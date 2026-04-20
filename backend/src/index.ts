import { serve } from '@hono/node-server';
import type { GroupConfig, McpConfig } from '@mcp-core/mcp-hub-share/config';
import {
  initializeDashboardServices,
  shutdownDashboardServices,
} from './api/dashboard/index.js';
import { shutdownHubApi } from './api/hub.js';
import { shutdownGroupMcpRouter } from './api/mcp/group-router.js';
import { shutdownServersApi } from './api/servers/index.js';
import { app } from './app.js';
import { shutdownMcpService } from './legacy/index.js';
import {
  createHubService,
  getHubServiceSafe,
  setHubService,
  shutdownHubService,
} from './services/service-registry.js';
import { getAllConfig } from './utils/config.js';
import { logger } from './utils/logger.js';
import { validateAllConfigs } from './validation/config.js';

let httpServer: ReturnType<typeof serve> | null = null;

/**
 * 验证配置文件
 */
async function validateConfigurations() {
  logger.info('开始验证配置文件...');

  try {
    const config = await getAllConfig();

    const systemConfigToValidate =
      config.system && Object.keys(config.system).length > 0
        ? config.system
        : undefined;
    const validationResult = validateAllConfigs(
      config.mcps,
      config.groups,
      systemConfigToValidate,
    );

    if (!validationResult.success) {
      const errorMessage = `配置验证失败: ${validationResult.errors.join(', ')}`;
      logger.error(errorMessage);
      logger.info('配置验证错误详情', {
        errorCount: validationResult.errors.length,
        errors: validationResult.errors,
      });
      throw new Error(errorMessage);
    }

    logger.info('配置验证成功', {
      serverCount: Object.keys(validationResult.data.mcpConfig.servers).length,
      groupCount: Object.keys(validationResult.data.groupConfig).length,
      hasSystemConfig: !!validationResult.data.systemConfig,
    });

    return validationResult.data;
  } catch (error) {
    logger.error('配置验证过程中发生错误', error as Error);
    throw error;
  }
}

/**
 * 初始化 MCP Hub 服务（显式启动编排）
 */
async function initializeHubService(validatedConfig: {
  mcpConfig: McpConfig;
  groupConfig: GroupConfig;
  systemConfig?: Record<string, unknown>;
}) {
  logger.info('开始初始化 MCP Hub 服务...');

  try {
    const service = await createHubService({
      servers: validatedConfig.mcpConfig.servers,
      groups: validatedConfig.groupConfig,
    });

    // 设置初始化超时
    const initPromise = service.initialize();
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('MCP Hub 服务初始化超时 (60秒)')),
        60000,
      );
      timeoutId.unref?.();
    });

    await Promise.race([initPromise, timeoutPromise]);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // 注册到全局服务注册表，所有 API 模块共享此实例
    setHubService(service);

    logger.info('MCP Hub 服务初始化成功');
    return service;
  } catch (error) {
    logger.error('MCP Hub 服务初始化失败', error as Error);
    throw error;
  }
}

/**
 * 启动服务器
 */
async function startServer() {
  try {
    logger.info('开始服务器初始化...', {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
    });

    // 1. 验证配置
    const validatedConfig = await validateConfigurations();

    // 2. 初始化 MCP Hub 服务（显式启动）
    await initializeHubService(validatedConfig);

    // 3. 初始化仪表板服务
    const hubService = getHubServiceSafe();
    if (hubService) {
      logger.info('初始化仪表板服务...');
      initializeDashboardServices(hubService);
      logger.info('仪表板服务初始化完成');
    }

    // 4. 创建 HTTP 服务器
    logger.info('创建 HTTP 服务器...');
    httpServer = serve(
      {
        fetch: app.fetch,
        port: validatedConfig.systemConfig?.server?.port || 8181,
      },
      (info) => {
        logger.info(`服务器启动成功`, {
          port: info.port,
          timestamp: new Date().toISOString(),
          hubServiceInitialized: !!getHubServiceSafe(),
        });
      },
    );

    logger.info('服务器初始化完成');
    return httpServer;
  } catch (error) {
    logger.error('服务器启动失败', error as Error);

    // 清理已创建的资源
    await cleanupResources();

    // 退出进程
    process.exit(1);
  }
}

/**
 * 清理资源
 */
async function cleanupResources() {
  logger.info('开始清理资源...');

  const cleanupPromises: Promise<void>[] = [];

  // 关闭 Hub 服务（从注册表获取）
  const hubService = await shutdownHubService();
  if (hubService) {
    cleanupPromises.push(
      hubService.shutdown().catch((error) => {
        logger.error('Hub 服务关闭失败', error);
      }),
    );
  }

  // 关闭其他服务
  cleanupPromises.push(
    shutdownDashboardServices().catch((error) => {
      logger.error('仪表板服务关闭失败', error);
    }),
  );

  cleanupPromises.push(
    shutdownMcpService().catch((error) => {
      logger.error('MCP 服务关闭失败', error);
    }),
  );

  cleanupPromises.push(
    shutdownHubApi().catch((error) => {
      logger.error('Hub API 关闭失败', error);
    }),
  );

  cleanupPromises.push(
    shutdownServersApi().catch((error) => {
      logger.error('服务器管理API 关闭失败', error);
    }),
  );

  cleanupPromises.push(
    shutdownGroupMcpRouter().catch((error) => {
      logger.error('组MCP路由关闭失败', error);
    }),
  );

  // 等待所有清理操作完成
  await Promise.allSettled(cleanupPromises);

  // 重置全局变量
  httpServer = null;

  logger.info('资源清理完成');
}

/**
 * 优雅关闭处理
 */
async function gracefulShutdown(signal: string) {
  logger.info(`收到 ${signal} 信号，开始优雅关闭`, {
    timestamp: new Date().toISOString(),
    signal,
  });

  // 立即移除所有进程监听器，防止重复触发
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('uncaughtException');
  process.removeAllListeners('unhandledRejection');

  try {
    // 设置关闭超时
    const shutdownTimeout = setTimeout(() => {
      logger.error('优雅关闭超时，强制退出');
      process.exit(1);
    }, 30000); // 30秒超时

    // 执行清理
    await cleanupResources();

    // 清除超时
    clearTimeout(shutdownTimeout);

    logger.info('优雅关闭完成');
    process.exit(0);
  } catch (error) {
    logger.error('优雅关闭过程中发生错误', error as Error);
    process.exit(1);
  }
}

// 启动服务器
startServer().catch((error) => {
  logger.error('服务器启动失败', error);
  process.exit(1);
});

// 注册关闭处理程序
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION').finally(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`未处理的 Promise 拒绝: ${String(reason)}`);
  logger.info('Promise 拒绝详情', {
    reason: String(reason),
    promiseString: String(promise),
  });
  gracefulShutdown('UNHANDLED_REJECTION').finally(() => {
    process.exit(1);
  });
});
