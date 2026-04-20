import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod/v4';
import { ConfigService } from '../../services/config_service.js';
import { errorResponse, successResponse } from '../../utils/api-response.js';

// 创建配置服务实例
const configService = new ConfigService();

// 配置更新请求验证模式
const configUpdateSchema = z.object({
  configType: z.enum(['system', 'mcp', 'groups']),
  config: z.record(z.string(), z.unknown()),
  description: z.string().optional(),
});

// 配置验证请求验证模式
const configValidationSchema = z.object({
  configType: z.enum(['system', 'mcp', 'groups']),
  config: z.record(z.string(), z.unknown()),
});

// 配置备份请求验证模式
const configBackupSchema = z.object({
  description: z.string().optional(),
  includeTypes: z.array(z.enum(['system', 'mcp', 'groups'])).optional(),
});

// 配置恢复请求验证模式
const configRestoreSchema = z.object({
  backupId: z.string(),
  configTypes: z.array(z.enum(['system', 'mcp', 'groups'])).optional(),
});

export const configApi = new Hono();

/**
 * GET /api/config - 获取当前系统配置
 */
configApi.get('/', async (c) => {
  try {
    const config = await configService.getCurrentConfig();

    return successResponse(c, {
      system: config.system,
      mcp: config.mcps,
      groups: config.groups,
      lastUpdated: await configService.getLastUpdatedTime(),
      version: await configService.getConfigVersion(),
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * PUT /api/config - 更新系统配置
 */
configApi.put('/', zValidator('json', configUpdateSchema), async (c) => {
  try {
    const { configType, config, description } = c.req.valid('json');

    // 验证配置
    const validationResult = await configService.validateConfig(
      configType,
      config,
    );
    if (!validationResult.valid) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFIG_VALIDATION_ERROR',
            message: '配置验证失败',
            details: validationResult.errors,
          },
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    // 更新配置
    await configService.updateConfig(configType, config, description);

    return successResponse(c, { message: '配置更新成功' });
  } catch (error) {
    console.error('更新配置失败:', error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * POST /api/config/validate - 验证配置
 */
configApi.post(
  '/validate',
  zValidator('json', configValidationSchema),
  async (c) => {
    try {
      const { configType, config } = c.req.valid('json');

      const validationResult = await configService.validateConfig(
        configType,
        config,
      );
      const impactAnalysis = await configService.analyzeConfigImpact(
        configType,
        config,
      );

      return successResponse(c, {
        valid: validationResult.valid,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        impact: impactAnalysis,
      });
    } catch (error) {
      console.error('配置验证失败:', error);
      return errorResponse(c, error as Error, 500);
    }
  },
);

/**
 * GET /api/config/history - 获取配置历史
 */
configApi.get('/history', async (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 50;
    const offset = Number(c.req.query('offset')) || 0;
    const configType = c.req.query('configType') as
      | 'system'
      | 'mcp'
      | 'groups'
      | undefined;

    const history = await configService.getConfigHistory(
      limit,
      offset,
      configType,
    );

    return successResponse(c, {
      history,
      total: await configService.getConfigHistoryCount(configType),
      limit,
      offset,
    });
  } catch (error) {
    console.error('获取配置历史失败:', error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * POST /api/config/backup - 创建配置备份
 */
configApi.post('/backup', zValidator('json', configBackupSchema), async (c) => {
  try {
    const { description, includeTypes } = c.req.valid('json');

    const backupId = await configService.createBackup(
      description,
      includeTypes,
    );

    return successResponse(c, {
      backupId,
      message: '配置备份创建成功',
    });
  } catch (error) {
    console.error('创建配置备份失败:', error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * POST /api/config/restore - 恢复配置
 */
configApi.post(
  '/restore',
  zValidator('json', configRestoreSchema),
  async (c) => {
    try {
      const { backupId, configTypes } = c.req.valid('json');

      await configService.restoreFromBackup(backupId, configTypes);

      return successResponse(c, { message: '配置恢复成功' });
    } catch (error) {
      console.error('恢复配置失败:', error);
      return errorResponse(c, error as Error, 500);
    }
  },
);

/**
 * POST /api/config/test - 测试配置
 */
configApi.post(
  '/test',
  zValidator('json', configValidationSchema),
  async (c) => {
    try {
      const { configType, config } = c.req.valid('json');

      const testResult = await configService.testConfig(configType, config);

      return successResponse(c, testResult);
    } catch (error) {
      console.error('配置测试失败:', error);
      return errorResponse(c, error as Error, 500);
    }
  },
);

/**
 * POST /api/config/preview - 预览配置更改
 */
configApi.post(
  '/preview',
  zValidator('json', configValidationSchema),
  async (c) => {
    try {
      const { configType, config } = c.req.valid('json');

      const preview = await configService.previewConfigChanges(
        configType,
        config,
      );

      return successResponse(c, preview);
    } catch (error) {
      console.error('配置预览失败:', error);
      return errorResponse(c, error as Error, 500);
    }
  },
);

/**
 * GET /api/config/backups - 获取备份列表
 */
configApi.get('/backups', async (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 50;
    const offset = Number(c.req.query('offset')) || 0;

    const backups = await configService.getBackupList(limit, offset);

    return successResponse(c, {
      backups,
      total: await configService.getBackupCount(),
      limit,
      offset,
    });
  } catch (error) {
    console.error('获取备份列表失败:', error);
    return errorResponse(c, error as Error, 500);
  }
});
