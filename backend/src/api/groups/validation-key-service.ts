/**
 * 组验证密钥业务逻辑（纯函数模块）
 *
 * 本模块从 index.ts 抽离，负责 5 个 validation-key 端点的业务逻辑：
 * - 设置组验证密钥
 * - 获取组验证密钥状态
 * - 验证组密钥
 * - 删除组验证密钥
 * - 生成新的验证密钥
 *
 * 设计约束：
 * - 纯函数，不持有 Hono Context，不构造 HTTP 响应。
 * - 依赖（crypto / config / logger / key-policy）按现状 import 方式获取。
 * - 校验失败 / 资源不存在等业务错误以结构化 ServiceError 抛出，由 handler
 *   转换为与原实现逐字一致的 HTTP 响应。
 */

import { getAllConfig, saveConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import { decryptValidationKey, encryptValidationKey, generateValidationKey } from './crypto.js';
import {
  assessKeyComplexity,
  calculateEntropy,
  generateSecurityRecommendations,
  validateKeyFormat,
} from './key-policy.js';
import { validateGroupId } from './validation.js';

import type {
  GroupConfig,
  GroupValidationConfig,
  SetGroupValidationKeyRequest,
} from '@mcp-core/mcp-hub-share';

/**
 * 业务错误码（与原 handler 的响应 error.code 逐字对应）
 */
export type ValidationKeyErrorCode =
  | 'INVALID_GROUP_ID'
  | 'INVALID_VALIDATION_KEY'
  | 'VALIDATION_ERROR'
  | 'GROUP_NOT_FOUND';

/**
 * 结构化业务错误。
 * handler 捕获后用 code/message/status 重建原 c.json 响应。
 */
export class ValidationKeyServiceError extends Error {
  readonly code: ValidationKeyErrorCode;
  readonly status: 400 | 404;

  constructor(code: ValidationKeyErrorCode, message: string, status: 400 | 404) {
    super(message);
    this.name = 'ValidationKeyServiceError';
    this.code = code;
    this.status = status;
  }
}

/**
 * 组配置项（与 index.ts 中的 GroupConfigItem 一致，含 validation 字段）
 */
type GroupItem = {
  validation?: {
    enabled: boolean;
    validationKey?: string;
    createdAt?: string;
    lastUpdated?: string;
  };
  [key: string]: unknown;
};

/**
 * 校验组 ID 格式，无效则抛 INVALID_GROUP_ID。
 */
function assertValidGroupId(groupId: string): void {
  const idValidation = validateGroupId(groupId);
  if (!idValidation.isValid) {
    throw new ValidationKeyServiceError('INVALID_GROUP_ID', idValidation.error ?? '', 400);
  }
}

/**
 * 所有组配置的类型（与 getAllConfig 返回的 groups 字段一致，DeepReadonly）。
 */
type GroupsConfig = Awaited<ReturnType<typeof getAllConfig>>['groups'];

/**
 * 读取所有组配置（返回类型与 getAllConfig 一致，DeepReadonly）。
 */
async function loadGroups(): Promise<GroupsConfig> {
  const config = await getAllConfig();
  return config.groups;
}

/**
 * 读取单个组配置，不存在则抛 GROUP_NOT_FOUND。
 *
 * 入参 groups 为 getAllConfig 返回的 DeepReadonly 结构；
 * 通过 as 转为可索引访问，与 index.ts 原实现访问方式一致。
 */
function requireExistingGroup(groupId: string, groups: GroupsConfig): GroupItem {
  const group = (groups as unknown as Record<string, GroupItem>)[groupId];
  if (!group) {
    throw new ValidationKeyServiceError('GROUP_NOT_FOUND', `组 '${groupId}' 不存在`, 404);
  }
  return group;
}

/**
 * 设置组验证密钥
 *
 * 校验顺序与原 handler 逐字一致：组ID → 密钥格式 → 组存在。
 * 返回原 handler successResponse 的 data 部分（含 validation 摘要）。
 */
export async function createValidationKey(
  groupId: string,
  body: SetGroupValidationKeyRequest,
): Promise<{
  groupId: string;
  validation: {
    enabled: boolean;
    hasKey: boolean;
    createdAt?: string;
    lastUpdated: string;
  };
}> {
  assertValidGroupId(groupId);

  // 验证密钥格式
  const keyValidation = validateKeyFormat(body.validationKey);
  if (!keyValidation.isValid) {
    throw new ValidationKeyServiceError('INVALID_VALIDATION_KEY', keyValidation.error ?? '', 400);
  }

  const groups = await loadGroups();
  const existingGroup = requireExistingGroup(groupId, groups);

  // 加密密钥
  const encryptedKey = encryptValidationKey(body.validationKey);
  const now = new Date().toISOString();
  const createdAt = existingGroup.validation?.createdAt || now;

  // 更新组配置，添加验证配置
  const validationConfig: GroupValidationConfig = {
    enabled: body.enabled !== false, // 默认启用
    validationKey: encryptedKey,
    createdAt,
    lastUpdated: now,
  };

  const updatedGroup = {
    ...existingGroup,
    validation: validationConfig,
  };

  // 保存到配置文件
  const updatedGroups = {
    ...groups,
    [groupId]: updatedGroup,
  };

  await saveConfig('group.json', updatedGroups as GroupConfig);

  // 记录密钥设置日志（不记录实际密钥内容）
  logger.info('组验证密钥设置成功', {
    groupId,
    enabled: validationConfig.enabled,
    keyLength: body.validationKey.length,
    keyComplexity: assessKeyComplexity(body.validationKey),
    isFirstKey: !existingGroup.validation?.validationKey,
    timestamp: now,
  });

  return {
    groupId,
    validation: {
      enabled: validationConfig.enabled,
      hasKey: true,
      createdAt,
      lastUpdated: now,
    },
  };
}

/**
 * 获取组验证密钥状态
 */
export async function getValidationKey(groupId: string): Promise<{
  groupId: string;
  validation: {
    enabled: boolean;
    hasKey: boolean;
    createdAt?: string;
    lastUpdated?: string;
  };
}> {
  assertValidGroupId(groupId);
  const groups = await loadGroups();
  const group = requireExistingGroup(groupId, groups);

  const validation = group.validation || {
    enabled: false,
    validationKey: undefined,
    createdAt: undefined,
    lastUpdated: undefined,
  };

  return {
    groupId,
    validation: {
      enabled: validation.enabled || false,
      hasKey: !!validation.validationKey,
      createdAt: validation.createdAt,
      lastUpdated: validation.lastUpdated,
    },
  };
}

/**
 * 验证组密钥
 *
 * 返回原 handler successResponse 的 data 部分。
 */
export async function validateKey(
  groupId: string,
  validationKey: string | undefined,
): Promise<{
  groupId: string;
  valid: boolean;
  reason: string;
  message: string;
}> {
  assertValidGroupId(groupId);

  // 验证请求数据
  if (!validationKey || typeof validationKey !== 'string') {
    throw new ValidationKeyServiceError('VALIDATION_ERROR', '验证密钥不能为空', 400);
  }

  const groups = await loadGroups();
  const group = requireExistingGroup(groupId, groups);

  const validation = group.validation || {
    enabled: false,
    validationKey: undefined,
    createdAt: undefined,
    lastUpdated: undefined,
  };

  // 检查是否启用了验证
  if (!validation.enabled) {
    return {
      groupId,
      valid: true,
      reason: 'VALIDATION_DISABLED',
      message: '组未启用验证',
    };
  }

  // 检查是否设置了密钥
  if (!validation.validationKey) {
    return {
      groupId,
      valid: false,
      reason: 'NO_KEY_SET',
      message: '组未设置验证密钥',
    };
  }

  // 验证密钥
  let isValid = false;
  let reason = 'INVALID_KEY';
  let message = '验证密钥不正确';

  try {
    const storedKey = decryptValidationKey(validation.validationKey);
    isValid = storedKey === validationKey;

    if (isValid) {
      reason = 'KEY_VALID';
      message = '验证密钥正确';
    }
  } catch (error) {
    logger.error('解密存储的验证密钥失败', error as Error, { groupId });
    reason = 'DECRYPTION_ERROR';
    message = '密钥验证过程出错';
  }

  // 记录验证尝试（不记录实际密钥）
  logger.info('组密钥验证尝试', {
    groupId,
    valid: isValid,
    reason,
    timestamp: new Date().toISOString(),
  });

  return {
    groupId,
    valid: isValid,
    reason,
    message,
  };
}

/**
 * 删除组验证密钥
 */
export async function deleteValidationKey(groupId: string): Promise<{
  groupId: string;
  validation: {
    enabled: boolean;
    hasKey: boolean;
  };
  deleted: boolean;
}> {
  assertValidGroupId(groupId);
  const groups = await loadGroups();
  const existingGroup = requireExistingGroup(groupId, groups);

  // 删除验证配置
  const updatedGroup = { ...existingGroup };
  delete updatedGroup.validation;

  // 保存到配置文件
  const updatedGroups = {
    ...groups,
    [groupId]: updatedGroup,
  };

  await saveConfig('group.json', updatedGroups as GroupConfig);

  logger.info('组验证密钥删除成功', {
    groupId,
    timestamp: new Date().toISOString(),
  });

  return {
    groupId,
    validation: {
      enabled: false,
      hasKey: false,
    },
    deleted: true,
  };
}

/**
 * 生成新的验证密钥
 *
 * 返回原 handler successResponse 的 data 部分（含明文密钥与安全评估）。
 */
export async function generateGroupValidationKey(groupId: string): Promise<{
  groupId: string;
  validationKey: string;
  validation: {
    enabled: boolean;
    hasKey: boolean;
    createdAt: string;
    lastUpdated: string;
  };
  security: {
    keyComplexity: ReturnType<typeof assessKeyComplexity>;
    keyLength: number;
    entropy: ReturnType<typeof calculateEntropy>;
    recommendations: ReturnType<typeof generateSecurityRecommendations>;
  };
  warnings: string[];
}> {
  assertValidGroupId(groupId);
  const groups = await loadGroups();
  const existingGroup = requireExistingGroup(groupId, groups);

  // 生成新密钥
  const newKey = generateValidationKey();
  const encryptedKey = encryptValidationKey(newKey);
  const now = new Date().toISOString();
  const createdAt = existingGroup.validation?.createdAt || now;

  // 更新组配置
  const validationConfig: GroupValidationConfig = {
    enabled: true,
    validationKey: encryptedKey,
    createdAt,
    lastUpdated: now,
  };

  const updatedGroup = {
    ...existingGroup,
    validation: validationConfig,
  };

  // 保存到配置文件
  const updatedGroups = {
    ...groups,
    [groupId]: updatedGroup,
  };

  await saveConfig('group.json', updatedGroups as GroupConfig);

  logger.info('组验证密钥生成成功', {
    groupId,
    keyLength: newKey.length,
    timestamp: now,
  });

  return {
    groupId,
    validationKey: newKey, // 返回明文密钥供用户保存
    validation: {
      enabled: true,
      hasKey: true,
      createdAt,
      lastUpdated: now,
    },
    security: {
      keyComplexity: assessKeyComplexity(newKey),
      keyLength: newKey.length,
      entropy: calculateEntropy(newKey),
      recommendations: generateSecurityRecommendations(newKey),
    },
    warnings: [
      ...(assessKeyComplexity(newKey) === 'weak' ? ['密钥强度较弱，建议使用更复杂的密钥'] : []),
      ...(newKey.length < 16 ? ['密钥长度较短，建议至少16个字符'] : []),
    ],
  };
}
