import { describe, expect, it } from 'vitest';

import {
  assessKeyComplexity,
  calculateEntropy,
  generateSecurityRecommendations,
  validateKeyFormat,
} from './key-policy.js';

describe('key-policy', () => {
  describe('assessKeyComplexity', () => {
    it('应将短密钥评为 weak', () => {
      expect(assessKeyComplexity('123')).toBe('weak');
    });

    it('应将常见模式评为 weak', () => {
      expect(assessKeyComplexity('password123')).toBe('weak');
      expect(assessKeyComplexity('admin123456')).toBe('weak');
    });

    it('应将重复字符评为 weak', () => {
      expect(assessKeyComplexity('aaaa1111')).toBe('weak');
    });

    it('应将中等复杂度密钥评为 medium', () => {
      expect(assessKeyComplexity('MyP@ssw0rd')).toBe('medium');
    });

    it('应将高强度密钥评为 strong', () => {
      expect(assessKeyComplexity('Str0ng!P@ssw0rd#2024')).toBe('strong');
    });
  });

  describe('calculateEntropy', () => {
    it('空字符集应返回 0', () => {
      expect(calculateEntropy('')).toBe(0);
    });

    it('纯数字密钥的熵应低于混合字符密钥', () => {
      const numEntropy = calculateEntropy('1234567890');
      const mixedEntropy = calculateEntropy('Abc123!@#XyZ');
      expect(mixedEntropy).toBeGreaterThan(numEntropy);
    });

    it('更长的密钥应有更高的熵', () => {
      const short = calculateEntropy('Ab1');
      const long = calculateEntropy('Ab1Ab1Ab1Ab1');
      expect(long).toBeGreaterThan(short);
    });
  });

  describe('validateKeyFormat', () => {
    it('空密钥应不通过', () => {
      const result = validateKeyFormat('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('太短的密钥应不通过', () => {
      const result = validateKeyFormat('ab1');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('8');
    });

    it('超过 128 字符的密钥应不通过', () => {
      const result = validateKeyFormat('a'.repeat(129) + '1');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('128');
    });

    it('只有字母的密钥应不通过', () => {
      const result = validateKeyFormat('onlyletters');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('数字');
    });

    it('只有数字的密钥应不通过', () => {
      const result = validateKeyFormat('12345678');
      expect(result.isValid).toBe(false);
    });

    it('包含字母和数字的有效密钥应通过', () => {
      const result = validateKeyFormat('validKey123');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('generateSecurityRecommendations', () => {
    it('弱密钥应生成多条建议', () => {
      const recs = generateSecurityRecommendations('weak');
      expect(recs.length).toBeGreaterThanOrEqual(3);
    });

    it('短密钥应有增加长度的建议', () => {
      const recs = generateSecurityRecommendations('short1');
      expect(recs.some((r) => r.includes('16'))).toBe(true);
    });

    it('无大写字母时应有相关建议', () => {
      const recs = generateSecurityRecommendations('lowercase123');
      expect(recs.some((r) => r.includes('大写'))).toBe(true);
    });

    it('无特殊字符时应有相关建议', () => {
      const recs = generateSecurityRecommendations('NoSpecial123');
      expect(recs.some((r) => r.includes('特殊字符'))).toBe(true);
    });

    it('强密钥应生成较少建议', () => {
      // 包含连续字符 xyz 会触发建议，使用不含连续序列的强密钥
      const recs = generateSecurityRecommendations('Zx9!Qp3#Mk7$vB5n');
      expect(recs.length).toBe(0);
    });
  });
});
