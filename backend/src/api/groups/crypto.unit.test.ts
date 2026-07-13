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

  describe('安全边界（fail-fast）', () => {
    it('VALIDATION_KEY_SECRET 未设置时加密应抛出错误', () => {
      vi.stubEnv('VALIDATION_KEY_SECRET', '');
      expect(() => encryptValidationKey('test')).toThrow('密钥加密失败');
    });

    it('VALIDATION_KEY_SECRET 长度不足 32 字符时加密应抛出错误', () => {
      vi.stubEnv('VALIDATION_KEY_SECRET', 'short-secret-only-20');
      expect(() => encryptValidationKey('test')).toThrow('密钥加密失败');
    });

    it('VALIDATION_KEY_SECRET 未设置时解密应抛出错误', () => {
      vi.stubEnv('VALIDATION_KEY_SECRET', '');
      expect(() => decryptValidationKey('iv:enc')).toThrow('密钥解密失败');
    });

    it('恰好 32 字符的密钥应被接受（边界值）', () => {
      vi.stubEnv('VALIDATION_KEY_SECRET', 'b'.repeat(32));
      const enc = encryptValidationKey('test');
      expect(decryptValidationKey(enc)).toBe('test');
    });
  });

  describe('加密/解密正确性', () => {
    it('round-trip：加密后的数据能正确解密回原文', () => {
      const plainKey = 'my-secret-validation-key-123';
      const encrypted = encryptValidationKey(plainKey);

      expect(encrypted).not.toBe(plainKey);
      expect(encrypted).toContain(':');
      expect(decryptValidationKey(encrypted)).toBe(plainKey);
    });

    it('每次加密生成不同密文（IV 随机性）', () => {
      const plainKey = 'same-key';
      const enc1 = encryptValidationKey(plainKey);
      const enc2 = encryptValidationKey(plainKey);

      expect(enc1).not.toBe(enc2);
      expect(decryptValidationKey(enc1)).toBe(plainKey);
      expect(decryptValidationKey(enc2)).toBe(plainKey);
    });

    it('解密篡改过的数据应抛出错误', () => {
      const encrypted = encryptValidationKey('secret');
      const [iv, data] = encrypted.split(':');
      // 篡改密文部分
      const tampered = `${iv}:${data!.slice(0, -2)}ff`;
      expect(() => decryptValidationKey(tampered)).toThrow();
    });

    it('解密格式无效的数据应抛出错误', () => {
      expect(() => decryptValidationKey('no-colon-here')).toThrow();
      expect(() => decryptValidationKey('invalid-data')).toThrow('密钥解密失败');
    });
  });

  describe('跨密钥隔离（安全属性）', () => {
    it('用密钥 A 加密的数据不能用密钥 B 解密', () => {
      const secretA = 'A'.repeat(32);
      const secretB = 'B'.repeat(32);
      vi.stubEnv('VALIDATION_KEY_SECRET', secretA);
      const encrypted = encryptValidationKey('sensitive-data');

      vi.stubEnv('VALIDATION_KEY_SECRET', secretB);
      expect(() => decryptValidationKey(encrypted)).toThrow();
    });

    it('重启后密钥不变时能正确解密旧数据', () => {
      const encrypted = encryptValidationKey('persistent-key');

      // 模拟重启（环境变量不变，重新调用解密）
      expect(decryptValidationKey(encrypted)).toBe('persistent-key');
    });
  });

  describe('generateValidationKey', () => {
    it('生成 64 字符的 hex 密钥（256 bit 熵）', () => {
      const key = generateValidationKey();
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('每次生成不同的密钥', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        keys.add(generateValidationKey());
      }
      expect(keys.size).toBe(100);
    });
  });
});
