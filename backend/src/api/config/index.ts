import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { ConfigService } from '../../services/config_service.js';
import type {
  ConfigBackupRequest,
  ConfigHistoryResponse,
  ConfigResponse,
  ConfigRestoreRequest,
  ConfigUpdateRequest,
  ConfigValidationRequest,
  ConfigValidationResponse,
} from '../../types/config.js';

// 创建配置服务实例
const configService = new ConfigService();

// 配置更新请求验证模式
const configUpdateSchema = z.object({
  configType: z.enum(['system', 'mcp', 'groups']),
  config: z.record(z.unknown()),
  description: z.string().optional(),
});

// 配置验证请求验证模式
const configValidationSchema = z.object({
  configType: z.enum(['system', 'mcp', 'groups']),
  config: z.record(z.unknown()),
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

    const response: ConfigResponse = {
      success: true,
      data: {
        system: config.system,
        mcp: config.mcps,
        groups: config.groups,
        lastUpdated: await configService.getLastUpdatedTime(),
        version: await configService.getConfigVersion(),
      },
    };

    return c.json(response);
  } catch (error) {
    console.error('获取配置失败:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'CONFIG_READ_ERROR',
          message: '获取配置失败',
          details: error instanceof Error ? error.message : '未知错误',
        },
      },
      500,
    );
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
        },
        400,
      );
    }

    // 更新配置
    await configService.updateConfig(configType, config, description);

    return c.json({
      success: true,
      message: '配置更新成功',
    });
  } catch (error) {
    console.error('更新配置失败:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'CONFIG_UPDATE_ERROR',
          message: '更新配置失败',
          details: error instanceof Error ? error.message : '未知错误',
        },
      },
      500,
    );
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

      const response: ConfigValidationResponse = {
        success: true,
        data: {
          valid: validationResult.valid,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          impact: impactAnalysis,
        },
      };

      return c.json(response);
    } catch (error) {
      console.error('配置验证失败:', error);
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFIG_VALIDATION_ERROR',
            message: '配置验证失败',
            details: error instanceof Error ? error.message : '未知错误',
          },
        },
        500,
      );
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

    const response: ConfigHistoryResponse = {
      success: true,
      data: {
        history,
        total: await configService.getConfigHistoryCount(configType),
        limit,
        offset,
      },
    };

    return c.json(response);
  } catch (error) {
    console.error('获取配置历史失败:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'CONFIG_HISTORY_ERROR',
          message: '获取配置历史失败',
          details: error instanceof Error ? error.message : '未知错误',
        },
      },
      500,
    );
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

    return c.json({
      success: true,
      data: {
        backupId,
        message: '配置备份创建成功',
      },
    });
  } catch (error) {
    console.error('创建配置备份失败:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'CONFIG_BACKUP_ERROR',
          message: '创建配置备份失败',
          details: error instanceof Error ? error.message : '未知错误',
        },
      },
      500,
    );
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

      return c.json({
        success: true,
        message: '配置恢复成功',
      });
    } catch (error) {
      console.error('恢复配置失败:', error);
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFIG_RESTORE_ERROR',
            message: '恢复配置失败',
            details: error instanceof Error ? error.message : '未知错误',
          },
        },
        500,
      );
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

      return c.json({
        success: true,
        data: testResult,
      });
    } catch (error) {
      console.error('配置测试失败:', error);
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFIG_TEST_ERROR',
            message: '配置测试失败',
            details: error instanceof Error ? error.message : '未知错误',
          },
        },
        500,
      );
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

      return c.json({
        success: true,
        data: preview,
      });
    } catch (error) {
      console.error('配置预览失败:', error);
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFIG_PREVIEW_ERROR',
            message: '配置预览失败',
            details: error instanceof Error ? error.message : '未知错误',
          },
        },
        500,
      );
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

    return c.json({
      success: true,
      data: {
        backups,
        total: await configService.getBackupCount(),
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('获取备份列表失败:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'CONFIG_BACKUP_LIST_ERROR',
          message: '获取备份列表失败',
          details: error instanceof Error ? error.message : '未知错误',
        },
      },
      500,
    );
  }
});
