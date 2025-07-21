import { serve } from '@hono/node-server';
import { shutdownHubApi } from './api/hub';
import { app } from './app';
import { shutdownMcpService } from './mcp';
import { initConfig } from './services/config';
import { McpHubService } from './services/mcp_hub_service';
import { getAllConfig } from './utils/config';
import { logger } from './utils/logger';
import { validateAllConfigs } from './validation/config';

// 全局服务实例
let hubService: McpHubService | null = null;
let httpServer: any = null;

/**
 * 验证配置文件
 */
async function validateConfigurations() {
  logger.info('开始验证配置文件...');

  try {
    const config = await getAllConfig();

    // 验证所有配置
    const validationResult = validateAllConfigs(
      config.mcps,
      config.groups,
      config.system,
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
      serverCount: Object.keys(validationResult.data.mcpConfig.mcpServers)
        .length,
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
 * 初始化 MCP Hub 服务
 */
async function initializeHubService(validatedConfig: any) {
  logger.info('开始初始化 MCP Hub 服务...');

  try {
    // 创建 Hub 服务实例
    hubService = new McpHubService(
      validatedConfig.mcpConfig.mcpServers,
      validatedConfig.groupConfig,
    );

    // 设置初始化超时
    const initPromise = hubService.initialize();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('MCP Hub 服务初始化超时 (60秒)')),
        60000,
      );
    });

    await Promise.race([initPromise, timeoutPromise]);

    logger.info('MCP Hub 服务初始化成功');
    return hubService;
  } catch (error) {
    logger.error('MCP Hub 服务初始化失败', error as Error);
    hubService = null;
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

    // 2. 初始化传统配置系统（向后兼容）
    logger.info('初始化传统配置系统...');
    await initConfig();
    logger.info('传统配置系统初始化完成');

    // 3. 初始化 MCP Hub 服务
    await initializeHubService(validatedConfig);

    // 4. 创建 HTTP 服务器
    logger.info('创建 HTTP 服务器...');
    httpServer = serve(
      {
        fetch: app.fetch,
        port: 3000,
      },
      (info) => {
        logger.info(`服务器启动成功`, {
          port: info.port,
          timestamp: new Date().toISOString(),
          hubServiceInitialized: !!hubService,
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

  // 关闭 Hub 服务
  if (hubService) {
    cleanupPromises.push(
      hubService.shutdown().catch((error) => {
        logger.error('Hub 服务关闭失败', error);
      }),
    );
  }

  // 关闭其他服务
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

  // 等待所有清理操作完成
  await Promise.allSettled(cleanupPromises);

  // 重置全局变量
  hubService = null;
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
  logger.error('未处理的 Promise 拒绝: ' + String(reason));
  logger.info('Promise 拒绝详情', {
    reason: String(reason),
    promiseString: String(promise),
  });
  gracefulShutdown('UNHANDLED_REJECTION').finally(() => {
    process.exit(1);
  });
});
