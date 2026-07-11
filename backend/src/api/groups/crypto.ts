/**
 * 组验证密钥的加密/解密/生成
 *
 * 安全注意：加密密钥从环境变量 VALIDATION_KEY_SECRET 读取。
 * 如果未设置或长度不足 32 字符，加解密操作会抛出错误（fail-fast），
 * 避免使用公开的弱默认密钥。
 */

import { ConfigError, ErrorCode } from '@mcp-core/mcp-hub-core';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { logger } from '../../utils/logger.js';

/**
 * 获取系统加密密钥（fail-fast：未设置或强度不足时抛错）
 */
function getSystemKey(): string {
  const systemKey = process.env.VALIDATION_KEY_SECRET;
  if (!systemKey || systemKey.length < 32) {
    throw new ConfigError(
      ErrorCode.INVALID_SERVER_CONFIG,
      'VALIDATION_KEY_SECRET 未设置或长度不足 32 字符，请配置环境变量后重试',
    );
  }
  return systemKey;
}

/**
 * 加密验证密钥
 */
export function encryptValidationKey(key: string): string {
  try {
    const systemKey = getSystemKey();
    const keyHash = createHash('sha256').update(systemKey).digest();

    // 生成随机IV
    const iv = randomBytes(16);

    const cipher = createCipheriv('aes-256-cbc', keyHash, iv);
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 将IV和加密数据一起返回
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('加密验证密钥失败', error as Error);
    throw new Error('密钥加密失败', { cause: error });
  }
}

/**
 * 解密验证密钥
 */
export function decryptValidationKey(encryptedKey: string): string {
  try {
    const systemKey = getSystemKey();
    const keyHash = createHash('sha256').update(systemKey).digest();

    // 分离IV和加密数据
    const parts = encryptedKey.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = createDecipheriv('aes-256-cbc', keyHash, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('解密验证密钥失败', error as Error);
    throw new Error('密钥解密失败', { cause: error });
  }
}

/**
 * 生成随机验证密钥（64 字符 hex）
 */
export function generateValidationKey(): string {
  return randomBytes(32).toString('hex');
}
