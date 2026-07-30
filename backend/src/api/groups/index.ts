/**
 * 组管理API端点
 * 提供组列表、组详情、组健康检查等API
 */

import { Hono } from 'hono';

import { errorResponse, successResponse } from '../../utils/api-response.js';
import { logger } from '../../utils/logger.js';
import {
  createGroup,
  deleteGroup,
  getGroupDetail,
  getGroupHealth,
  getGroupServers,
  GroupServiceError,
  listGroups,
  updateGroup,
} from './group-service.js';
import {
  ToolAccessServiceError,
  configureGroupTools,
  getGroupAvailableTools,
  getGroupTools,
  validateToolAccess,
} from './tool-access-service.js';
import {
  ValidationKeyServiceError,
  createValidationKey,
  deleteValidationKey,
  generateGroupValidationKey,
  getValidationKey,
  validateKey,
} from './validation-key-service.js';

import type {
  ConfigureGroupToolsRequest,
  CreateGroupRequest,
  SetGroupValidationKeyRequest,
  UpdateGroupRequest,
} from '@mcp-core/mcp-hub-share';
import type { Context } from 'hono';

// 定义组配置类型
export interface GroupConfigItem {
  id: string;
  name: string;
  description?: string;
  servers: string[];
  tools: string[];
  validation?: {
    enabled: boolean;
    validationKey?: string;
    createdAt?: string;
    lastUpdated?: string;
  };
}

export const groupsApi = new Hono();

/**
 * 将 GroupServiceError 转换为与原 handler 逐字一致的 HTTP 错误响应。
 *
 * 响应结构与原 c.json 调用保持一致：
 * - 通用错误体：{ success: false, error: { code, message }, requestId }，status = error.status
 * - VALIDATION_ERROR 额外携带 error.details（validation.errors），与原响应结构逐字一致；
 *   其它错误码不出现 details 字段。
 */
function groupServiceErrorResponse(c: Context, error: GroupServiceError) {
  const errorBody: {
    success: false;
    error: { code: string; message: string; details?: string[] };
    requestId: string;
  } = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
    },
    requestId: c.get('requestId'),
  };
  if (error.details) {
    errorBody.error.details = error.details;
  }
  return c.json(errorBody, { status: error.status });
}

/**
 * 获取所有组列表
 */
groupsApi.get('/', async (c) => {
  try {
    const data = await listGroups();
    return successResponse(c, data);
  } catch (error) {
    logger.error('获取组列表失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 获取特定组的详细信息
 */
groupsApi.get('/:groupId', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const response = await getGroupDetail(groupId);
    return successResponse(c, response);
  } catch (error) {
    if (error instanceof GroupServiceError) {
      return groupServiceErrorResponse(c, error);
    }
    logger.error('获取组详细信息失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 获取组的健康检查状态
 */
groupsApi.get('/:groupId/health', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const { data, status } = await getGroupHealth(groupId);
    return successResponse(c, data, status);
  } catch (error) {
    if (error instanceof GroupServiceError) {
      return groupServiceErrorResponse(c, error);
    }
    logger.error('组健康检查失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 获取组的工具列表
 */
groupsApi.get('/:groupId/tools', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    logger.debug('获取组工具列表', { groupId });

    const response = await getGroupTools(groupId);
    return successResponse(c, response);
  } catch (error) {
    if (error instanceof ToolAccessServiceError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          requestId: c.get('requestId'),
        },
        { status: error.status },
      );
    }
    logger.error('获取组工具列表失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 获取组的服务器列表
 */
groupsApi.get('/:groupId/servers', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const response = await getGroupServers(groupId);
    return successResponse(c, response);
  } catch (error) {
    if (error instanceof GroupServiceError) {
      return groupServiceErrorResponse(c, error);
    }
    logger.error('获取组服务器列表失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 创建新组
 */
groupsApi.post('/', async (c) => {
  try {
    const body = (await c.req.json()) as CreateGroupRequest;
    const response = await createGroup(body);
    return successResponse(c, response);
  } catch (error) {
    if (error instanceof GroupServiceError) {
      return groupServiceErrorResponse(c, error);
    }
    logger.error('创建组失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 更新组配置
 */
groupsApi.put('/:groupId', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const body = (await c.req.json()) as UpdateGroupRequest;
    const response = await updateGroup(groupId, body);
    return successResponse(c, response);
  } catch (error) {
    if (error instanceof GroupServiceError) {
      return groupServiceErrorResponse(c, error);
    }
    logger.error('更新组失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 删除组
 */
groupsApi.delete('/:groupId', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const response = await deleteGroup(groupId);
    return successResponse(c, response);
  } catch (error) {
    if (error instanceof GroupServiceError) {
      return groupServiceErrorResponse(c, error);
    }
    logger.error('删除组失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 配置组工具过滤
 */
groupsApi.post('/:groupId/tools', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const body = (await c.req.json()) as ConfigureGroupToolsRequest;
    logger.debug('配置组工具过滤请求', { groupId, body });

    const response = await configureGroupTools(groupId, body);
    return successResponse(c, response);
  } catch (error) {
    if (error instanceof ToolAccessServiceError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          requestId: c.get('requestId'),
        },
        { status: error.status },
      );
    }
    logger.error('配置组工具过滤失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 获取组可用工具（支持过滤）
 */
groupsApi.get('/:groupId/available-tools', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    logger.debug('获取组可用工具请求', { groupId });

    const response = await getGroupAvailableTools(groupId);
    return successResponse(c, response);
  } catch (error) {
    if (error instanceof ToolAccessServiceError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          requestId: c.get('requestId'),
        },
        { status: error.status },
      );
    }
    logger.error('获取组可用工具失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 验证工具访问权限
 */
groupsApi.post('/:groupId/validate-tool-access', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const body = (await c.req.json()) as { toolName: string };
    logger.debug('验证工具访问权限请求', { groupId, toolName: body.toolName });

    const response = await validateToolAccess(groupId, body.toolName);
    return successResponse(c, response);
  } catch (error) {
    if (error instanceof ToolAccessServiceError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          requestId: c.get('requestId'),
        },
        { status: error.status },
      );
    }
    logger.error('验证工具访问权限失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 设置组验证密钥
 */
groupsApi.post('/:groupId/validation-key', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const body = (await c.req.json()) as SetGroupValidationKeyRequest;
    logger.debug('设置组验证密钥请求', { groupId });

    const result = await createValidationKey(groupId, body);
    return successResponse(c, result);
  } catch (error) {
    if (error instanceof ValidationKeyServiceError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          requestId: c.get('requestId'),
        },
        { status: error.status },
      );
    }
    logger.error('设置组验证密钥失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 获取组验证密钥状态
 */
groupsApi.get('/:groupId/validation-key', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    logger.debug('获取组验证密钥状态请求', { groupId });

    const result = await getValidationKey(groupId);
    return successResponse(c, result);
  } catch (error) {
    if (error instanceof ValidationKeyServiceError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          requestId: c.get('requestId'),
        },
        { status: error.status },
      );
    }
    logger.error('获取组验证密钥状态失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 验证组密钥
 */
groupsApi.post('/:groupId/validate-key', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const body = (await c.req.json()) as { validationKey: string };
    logger.debug('验证组密钥请求', { groupId });

    const result = await validateKey(groupId, body.validationKey);
    return successResponse(c, result);
  } catch (error) {
    if (error instanceof ValidationKeyServiceError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          requestId: c.get('requestId'),
        },
        { status: error.status },
      );
    }
    logger.error('验证组密钥失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 删除组验证密钥
 */
groupsApi.delete('/:groupId/validation-key', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    logger.debug('删除组验证密钥请求', { groupId });

    const result = await deleteValidationKey(groupId);
    return successResponse(c, result);
  } catch (error) {
    if (error instanceof ValidationKeyServiceError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          requestId: c.get('requestId'),
        },
        { status: error.status },
      );
    }
    logger.error('删除组验证密钥失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 生成新的验证密钥
 */
groupsApi.post('/:groupId/generate-validation-key', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    logger.debug('生成组验证密钥请求', { groupId });

    const result = await generateGroupValidationKey(groupId);
    return successResponse(c, result);
  } catch (error) {
    if (error instanceof ValidationKeyServiceError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          requestId: c.get('requestId'),
        },
        { status: error.status },
      );
    }
    logger.error('生成组验证密钥失败', error as Error);
    return errorResponse(c, error as Error, 500);
  }
});

/**
 * 优雅关闭组管理API服务
 */
export async function shutdownGroupsApi(): Promise<void> {
  try {
    logger.info('关闭组管理API服务');

    const { shutdownCoreServiceManager } = await import('../../services/service-registry.js');
    const manager = await shutdownCoreServiceManager();
    if (manager) {
      await manager.shutdown();
    }

    logger.info('组管理API服务关闭完成');
  } catch (error) {
    logger.error('关闭组管理API服务时出错', error as Error);
    throw error;
  }
}
