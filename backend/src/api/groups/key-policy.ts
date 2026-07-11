/**
 * 组验证密钥的安全策略分析
 * 包含密钥复杂度评估、熵值计算、安全建议生成和格式校验
 */

export type KeyComplexity = 'weak' | 'medium' | 'strong';

/**
 * 评估密钥复杂度
 */
export function assessKeyComplexity(key: string): KeyComplexity {
  let score = 0;

  // 长度评分
  if (key.length >= 16) score += 2;
  else if (key.length >= 12) score += 1;

  // 字符类型评分
  const hasLower = /[a-z]/.test(key);
  const hasUpper = /[A-Z]/.test(key);
  const hasNumbers = /[0-9]/.test(key);
  const hasSpecial = /[^a-zA-Z0-9]/.test(key);

  if (hasLower) score += 1;
  if (hasUpper) score += 1;
  if (hasNumbers) score += 1;
  if (hasSpecial) score += 2;

  // 模式检测（避免简单模式）
  const hasRepeatedChars = /(.)\1{2,}/.test(key);
  const hasSequentialChars =
    /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789|890)/i.test(
      key,
    );
  const hasCommonPatterns = /(password|qwerty|asdf|zxcv|1234|admin|user)/i.test(key);

  if (hasRepeatedChars) score -= 1;
  if (hasSequentialChars) score -= 1;
  if (hasCommonPatterns) score -= 2;

  // 确定复杂度
  if (score >= 6) return 'strong';
  if (score >= 3) return 'medium';
  return 'weak';
}

/**
 * 计算密钥熵值
 */
export function calculateEntropy(key: string): number {
  // 估算字符集大小
  let estimatedCharSetSize = 0;
  if (/[a-z]/.test(key)) estimatedCharSetSize += 26;
  if (/[A-Z]/.test(key)) estimatedCharSetSize += 26;
  if (/[0-9]/.test(key)) estimatedCharSetSize += 10;
  if (/[^a-zA-Z0-9]/.test(key)) estimatedCharSetSize += 32; // 特殊字符

  // 计算熵值：log2(字符集大小^长度)
  if (estimatedCharSetSize <= 1) return 0;
  return Math.round(key.length * Math.log2(estimatedCharSetSize) * 100) / 100;
}

/**
 * 生成安全建议
 */
export function generateSecurityRecommendations(key: string): string[] {
  const recommendations: string[] = [];
  const complexity = assessKeyComplexity(key);

  if (complexity === 'weak') {
    recommendations.push('使用大小写字母、数字和特殊字符的组合');
    recommendations.push('避免使用常见词汇或重复字符');
    recommendations.push('建议使用至少16个字符的长度');
  }

  if (key.length < 16) {
    recommendations.push('增加密钥长度至至少16个字符');
  }

  if (!/[A-Z]/.test(key)) {
    recommendations.push('添加大写字母');
  }

  if (!/[a-z]/.test(key)) {
    recommendations.push('添加小写字母');
  }

  if (!/[0-9]/.test(key)) {
    recommendations.push('添加数字');
  }

  if (!/[^a-zA-Z0-9]/.test(key)) {
    recommendations.push('添加特殊字符');
  }

  if (/(.)\1{2,}/.test(key)) {
    recommendations.push('避免重复字符');
  }

  if (
    /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789|890)/i.test(
      key,
    )
  ) {
    recommendations.push('避免连续字符');
  }

  return recommendations;
}

/**
 * 验证密钥格式
 */
export function validateKeyFormat(key: string): { isValid: boolean; error?: string } {
  if (!key || typeof key !== 'string') {
    return { isValid: false, error: '密钥不能为空' };
  }

  if (key.length < 8) {
    return { isValid: false, error: '密钥长度至少为8个字符' };
  }

  if (key.length > 128) {
    return { isValid: false, error: '密钥长度不能超过128个字符' };
  }

  // 检查密钥复杂度（至少包含字母和数字）
  const hasLetter = /[a-zA-Z]/.test(key);
  const hasNumber = /[0-9]/.test(key);

  if (!hasLetter || !hasNumber) {
    return { isValid: false, error: '密钥必须包含字母和数字' };
  }

  return { isValid: true };
}
