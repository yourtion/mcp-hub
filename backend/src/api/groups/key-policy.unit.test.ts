import { describe, expect, it } from 'vitest';

import {
  assessKeyComplexity,
  calculateEntropy,
  generateSecurityRecommendations,
  validateKeyFormat,
} from './key-policy.js';

describe('key-policy', () => {
  describe('assessKeyComplexity（安全属性验证，非输出固化）', () => {
    it('已知弱密钥绝不应被评为 strong', () => {
      const knownWeak = [
        'password',
        'admin',
        '12345678',
        'qwerty',
        'aaaa1111',
        'password123',
        'abc123',
      ];
      for (const weak of knownWeak) {
        expect(assessKeyComplexity(weak), `"${weak}" should not be strong`).not.toBe('strong');
      }
    });

    it('强随机密钥绝不应被评为 weak', () => {
      const knownStrong = [
        'Xk9$mP2!vQ7#nL4@wR8',
        'Zx9!Qp3#Mk7$vB5nYc2D',
        'aB3$dE6&gH9*kJ2@mN5',
      ];
      for (const strong of knownStrong) {
        const result = assessKeyComplexity(strong);
        expect(result, `"${strong}" should not be weak`).not.toBe('weak');
      }
    });

    it('评分应单调递增：更长 + 更多字符类型 = 更高复杂度', () => {
      const short = assessKeyComplexity('ab12');
      const medium = assessKeyComplexity('Abc123def456');
      const long = assessKeyComplexity('Abc123def456!@#XYZ');

      // 不是严格排序，但弱→中→强的趋势应成立
      const scoreMap = { weak: 0, medium: 1, strong: 2 };
      expect(scoreMap[short]).toBeLessThanOrEqual(scoreMap[medium]);
      expect(scoreMap[medium]).toBeLessThanOrEqual(scoreMap[long]);
    });
  });

  describe('calculateEntropy', () => {
    it('空字符串熵为 0', () => {
      expect(calculateEntropy('')).toBe(0);
    });

    it('纯数字密钥熵低于混合字符密钥', () => {
      const numEntropy = calculateEntropy('1234567890');
      const mixedEntropy = calculateEntropy('Abc123!@#XyZ');
      expect(mixedEntropy).toBeGreaterThan(numEntropy);
    });

    it('熵随长度增加而增加', () => {
      const short = calculateEntropy('Ab1');
      const long = calculateEntropy('Ab1Ab1Ab1Ab1');
      expect(long).toBeGreaterThan(short);
    });
  });

  describe('validateKeyFormat（规则验证）', () => {
    it('空密钥被拒绝', () => {
      expect(validateKeyFormat('').isValid).toBe(false);
    });

    it('短于 8 字符被拒绝', () => {
      const result = validateKeyFormat('ab1');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('8');
    });

    it('超过 128 字符被拒绝', () => {
      const result = validateKeyFormat('a'.repeat(129) + '1');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('128');
    });

    it('纯字母被拒绝（需含数字）', () => {
      const result = validateKeyFormat('onlyletters');
      expect(result.isValid).toBe(false);
    });

    it('纯数字被拒绝（需含字母）', () => {
      const result = validateKeyFormat('12345678');
      expect(result.isValid).toBe(false);
    });

    it('字母+数字的组合被接受', () => {
      expect(validateKeyFormat('validKey123').isValid).toBe(true);
    });

    it('边界值：恰好 8 字符的有效密钥被接受', () => {
      expect(validateKeyFormat('abcd1234').isValid).toBe(true);
    });
  });

  describe('generateSecurityRecommendations', () => {
    it('弱密钥产生多条建议', () => {
      expect(generateSecurityRecommendations('weak').length).toBeGreaterThanOrEqual(3);
    });

    it('缺少大写字母时给出对应建议', () => {
      const recs = generateSecurityRecommendations('lowercase123');
      expect(recs.some((r) => r.includes('大写'))).toBe(true);
    });

    it('缺少特殊字符时给出对应建议', () => {
      const recs = generateSecurityRecommendations('NoSpecial123');
      expect(recs.some((r) => r.includes('特殊字符'))).toBe(true);
    });

    it('不含弱模式的强密钥产生零建议', () => {
      const recs = generateSecurityRecommendations('Zx9!Qp3#Mk7$vB5n');
      expect(recs).toHaveLength(0);
    });
  });
});
