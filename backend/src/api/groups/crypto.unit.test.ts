import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { decryptValidationKey, encryptValidationKey, generateValidationKey } from './crypto.js';

const VALID_SECRET = 'a'.repeat(32);

describe('crypto', () => {
  beforeEach(() => {
    vi.stubEnv('VALIDATION_KEY_SECRET', VALID_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getSystemKey (fail-fast)', () => {
    it('加密时应在 VALIDATION_KEY_SECRET 未设置时抛出错误', () => {
      vi.stubEnv('VALIDATION_KEY_SECRET', '');
      expect(() => encryptValidationKey('test')).toThrow('密钥加密失败');
    });

    it('加密时应在密钥长度不足 32 字符时抛出错误', () => {
      vi.stubEnv('VALIDATION_KEY_SECRET', 'short');
      expect(() => encryptValidationKey('test')).toThrow('密钥加密失败');
    });

    it('解密时应在密钥未设置时抛出错误', () => {
      vi.stubEnv('VALIDATION_KEY_SECRET', '');
      expect(() => decryptValidationKey('iv:enc')).toThrow('密钥解密失败');
    });
  });

  describe('encryptValidationKey / decryptValidationKey', () => {
    it('应正确加密和解密密钥（round-trip）', () => {
      const plainKey = 'my-secret-validation-key-123';
      const encrypted = encryptValidationKey(plainKey);

      // 加密结果不应等于原文
      expect(encrypted).not.toBe(plainKey);
      // 加密结果应包含 IV 分隔符
      expect(encrypted).toContain(':');

      const decrypted = decryptValidationKey(encrypted);
      expect(decrypted).toBe(plainKey);
    });

    it('每次加密应生成不同的 IV', () => {
      const plainKey = 'same-key';
      const enc1 = encryptValidationKey(plainKey);
      const enc2 = encryptValidationKey(plainKey);

      // IV 随机，所以加密结果不同
      expect(enc1).not.toBe(enc2);

      // 但都能正确解密
      expect(decryptValidationKey(enc1)).toBe(plainKey);
      expect(decryptValidationKey(enc2)).toBe(plainKey);
    });

    it('解密无效数据应抛出错误', () => {
      expect(() => decryptValidationKey('invalid-data')).toThrow('密钥解密失败');
    });
  });

  describe('generateValidationKey', () => {
    it('应生成 64 字符的 hex 密钥', () => {
      const key = generateValidationKey();
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('每次应生成不同的密钥', () => {
      const key1 = generateValidationKey();
      const key2 = generateValidationKey();
      expect(key1).not.toBe(key2);
    });
  });
});
