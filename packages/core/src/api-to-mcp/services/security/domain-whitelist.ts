/**
 * 域名白名单管理器
 * 负责验证API URL的安全性
 */

import type { DomainValidationResult } from '../../types/security.js';

/**
 * 域名白名单接口
 */
export interface DomainWhitelist {
  /**
   * 验证URL是否在白名单中
   * @param url 要验证的URL
   */
  isAllowed(url: string): boolean;

  /**
   * 添加允许的域名
   * @param domain 域名
   */
  addDomain(domain: string): void;

  /**
   * 移除域名
   * @param domain 域名
   */
  removeDomain(domain: string): void;

  /**
   * 获取所有允许的域名
   */
  getAllowedDomains(): string[];

  /**
   * 验证域名并返回详细结果
   * @param url 要验证的URL
   */
  validateDomain(url: string): DomainValidationResult;
}

/**
 * 域名白名单实现类
 */
export class DomainWhitelistImpl implements DomainWhitelist {
  private allowedDomains: Set<string> = new Set();

  constructor(initialDomains: string[] = []) {
    initialDomains.forEach((domain) =>
      this.allowedDomains.add(domain.toLowerCase()),
    );
  }

  isAllowed(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // 检查完全匹配
      if (this.allowedDomains.has(hostname)) {
        return true;
      }

      // 检查通配符匹配
      for (const domain of this.allowedDomains) {
        if (domain.startsWith('*.')) {
          const baseDomain = domain.slice(2);
          if (hostname.endsWith(baseDomain)) {
            return true;
          }
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  addDomain(domain: string): void {
    this.allowedDomains.add(domain.toLowerCase());
  }

  removeDomain(domain: string): void {
    this.allowedDomains.delete(domain.toLowerCase());
  }

  getAllowedDomains(): string[] {
    return Array.from(this.allowedDomains);
  }

  validateDomain(url: string): DomainValidationResult {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      const allowed = this.isAllowed(url);

      return {
        allowed,
        domain,
        reason: allowed ? undefined : '域名不在白名单中',
      };
    } catch (error) {
      return {
        allowed: false,
        domain: '',
        reason: `无效的URL格式: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }
}
