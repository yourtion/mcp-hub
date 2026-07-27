/**
 * 组级 validationKey 校验（填补现状缺口）
 *
 * 现状：group-router.ts 的 groupValidationMiddleware 只校验组存在，
 * 从不校验 validationKey。P2 把这块逻辑抽成纯函数，供 mcp-auth 中间件调用。
 *
 * 复用现有 crypto.ts 的 AES 解密；加常量时间比较防时序攻击。
 */
import { timingSafeEqual } from 'node:crypto';

import { decryptValidationKey } from '../../api/groups/crypto.js';
import { logger } from '../../utils/logger.js';

/**
 * 校验输入的 validationKey 是否匹配存储的加密 key
 * @param input 客户端送来的明文 key（从 Authorization: Bearer 取）
 * @param encryptedStored 配置里存的 AES 加密 key
 */
export function verifyValidationKey(input: string, encryptedStored: string): boolean {
  try {
    const stored = decryptValidationKey(encryptedStored);
    const a = Buffer.from(input);
    const b = Buffer.from(stored);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch (err) {
    logger.warn('validationKey 解密失败', { error: (err as Error).message });
    return false;
  }
}
