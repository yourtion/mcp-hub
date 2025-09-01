/**
 * 频率限制器测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RateLimitConfig } from '../../types/api-config.js';
import type { SecurityEvent } from '../../types/security.js';
import { RateLimiterImpl } from './rate-limiter.js';

// Mock日志记录器
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('RateLimiterImpl', () => {
  let rateLimiter: RateLimiterImpl;
  let securityEvents: SecurityEvent[];

  beforeEach(() => {
    securityEvents = [];
    rateLimiter = new RateLimiterImpl();
    rateLimiter.setSecurityEventCallback((event) => {
      securityEvents.push(event);
    });
  });

  describe('基本频率限制', () => {
    it('应该允许在限制范围内的请求', async () => {
      // 使用自定义配置
      const config: RateLimitConfig = {
        windowSeconds: 60,
        maxRequests: 10,
        enabled: true,
      };
      const rateLimiterWithConfig = new RateLimiterImpl(config);

      // 前10个请求应该被允许
      for (let i = 0; i < 10; i++) {
        const allowed = await rateLimiterWithConfig.checkLimit('test-tool');
        expect(allowed).toBe(true);
        await rateLimiterWithConfig.recordCall('test-tool');
      }
    });

    it('应该拒绝超出限制的请求', async () => {
      const config: RateLimitConfig = {
        windowSeconds: 60,
        maxRequests: 5,
        enabled: true,
      };
      const rateLimiterWithConfig = new RateLimiterImpl(config);
      const events: SecurityEvent[] = [];
      rateLimiterWithConfig.setSecurityEventCallback((event) => {
        events.push(event);
      });

      // 前5个请求应该被允许
      for (let i = 0; i < 5; i++) {
        expect(await rateLimiterWithConfig.checkLimit('test-tool')).toBe(true);
        await rateLimiterWithConfig.recordCall('test-tool');
      }

      // 第6个请求应该被拒绝
      expect(await rateLimiterWithConfig.checkLimit('test-tool')).toBe(false);

      // 应该触发安全事件
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('应该在时间窗口重置后允许新请求', async () => {
      const config: RateLimitConfig = {
        windowSeconds: 0.1,
        maxRequests: 2,
        enabled: true,
      };
      const rateLimiterWithConfig = new RateLimiterImpl(config);

      // 使用完配额
      expect(await rateLimiterWithConfig.checkLimit('test-tool')).toBe(true);
      await rateLimiterWithConfig.recordCall('test-tool');
      expect(await rateLimiterWithConfig.checkLimit('test-tool')).toBe(true);
      await rateLimiterWithConfig.recordCall('test-tool');

      // 应该被拒绝
      expect(await rateLimiterWithConfig.checkLimit('test-tool')).toBe(false);

      // 等待时间窗口重置
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 现在应该被允许
      expect(await rateLimiterWithConfig.checkLimit('test-tool')).toBe(true);
    });

    it('应该在禁用时允许所有请求', async () => {
      const config: RateLimitConfig = {
        windowSeconds: 60,
        maxRequests: 1,
        enabled: false,
      };
      const rateLimiterWithConfig = new RateLimiterImpl(config);

      // 即使超过限制也应该被允许
      for (let i = 0; i < 10; i++) {
        expect(await rateLimiterWithConfig.checkLimit('test-tool')).toBe(true);
        await rateLimiterWithConfig.recordCall('test-tool');
      }
    });
  });

  describe('客户端特定限制', () => {
    it('应该为不同客户端分别计算限制', async () => {
      const config: RateLimitConfig = {
        windowSeconds: 60,
        maxRequests: 2,
        enabled: true,
      };
      const rateLimiterWithConfig = new RateLimiterImpl(config);

      // 客户端A使用配额
      expect(
        await rateLimiterWithConfig.checkLimit('test-tool', 'client-a'),
      ).toBe(true);
      await rateLimiterWithConfig.recordCall('test-tool', 'client-a');
      expect(
        await rateLimiterWithConfig.checkLimit('test-tool', 'client-a'),
      ).toBe(true);
      await rateLimiterWithConfig.recordCall('test-tool', 'client-a');

      // 客户端A应该被限制
      expect(
        await rateLimiterWithConfig.checkLimit('test-tool', 'client-a'),
      ).toBe(false);

      // 但客户端B应该仍然被允许
      expect(
        await rateLimiterWithConfig.checkLimit('test-tool', 'client-b'),
      ).toBe(true);
      await rateLimiterWithConfig.recordCall('test-tool', 'client-b');
    });

    it('应该支持工具特定的限制配置', async () => {
      const config: RateLimitConfig = {
        windowSeconds: 60,
        maxRequests: 10,
        enabled: true,
        toolSpecific: {
          'restricted-tool': {
            windowSeconds: 60,
            maxRequests: 2,
          },
        },
      };
      const rateLimiterWithConfig = new RateLimiterImpl(config);

      // 普通工具应该有10个请求的限制
      for (let i = 0; i < 10; i++) {
        expect(await rateLimiterWithConfig.checkLimit('normal-tool')).toBe(
          true,
        );
        await rateLimiterWithConfig.recordCall('normal-tool');
      }

      // 受限工具应该只有2个请求的限制
      expect(await rateLimiterWithConfig.checkLimit('restricted-tool')).toBe(
        true,
      );
      await rateLimiterWithConfig.recordCall('restricted-tool');
      expect(await rateLimiterWithConfig.checkLimit('restricted-tool')).toBe(
        true,
      );
      await rateLimiterWithConfig.recordCall('restricted-tool');
      expect(await rateLimiterWithConfig.checkLimit('restricted-tool')).toBe(
        false,
      );
    });
  });

  describe('基本功能测试', () => {
    it('应该获取剩余请求次数', async () => {
      const config: RateLimitConfig = {
        windowSeconds: 60,
        maxRequests: 5,
        enabled: true,
      };
      const rateLimiterWithConfig = new RateLimiterImpl(config);

      // 初始状态应该有5个剩余请求
      expect(
        await rateLimiterWithConfig.getRemainingRequests('test-tool'),
      ).toBe(5);

      // 使用2个请求
      await rateLimiterWithConfig.recordCall('test-tool');
      await rateLimiterWithConfig.recordCall('test-tool');

      // 应该剩余3个请求
      expect(
        await rateLimiterWithConfig.getRemainingRequests('test-tool'),
      ).toBe(3);
    });

    it('应该重置计数器', async () => {
      const config: RateLimitConfig = {
        windowSeconds: 60,
        maxRequests: 5,
        enabled: true,
      };
      const rateLimiterWithConfig = new RateLimiterImpl(config);

      // 使用一些请求
      await rateLimiterWithConfig.recordCall('test-tool');
      await rateLimiterWithConfig.recordCall('test-tool');

      expect(
        await rateLimiterWithConfig.getRemainingRequests('test-tool'),
      ).toBe(3);

      // 重置计数器
      await rateLimiterWithConfig.resetCounter('test-tool');

      // 应该恢复到初始状态
      expect(
        await rateLimiterWithConfig.getRemainingRequests('test-tool'),
      ).toBe(5);
    });

    it('应该获取频率限制状态', async () => {
      const config: RateLimitConfig = {
        windowSeconds: 60,
        maxRequests: 5,
        enabled: true,
      };
      const rateLimiterWithConfig = new RateLimiterImpl(config);

      // 初始状态
      let status = await rateLimiterWithConfig.getStatus('test-tool');
      expect(status.limited).toBe(false);
      expect(status.remaining).toBe(5);

      // 使用完配额
      for (let i = 0; i < 5; i++) {
        await rateLimiterWithConfig.recordCall('test-tool');
      }

      status = await rateLimiterWithConfig.getStatus('test-tool');
      expect(status.limited).toBe(true);
      expect(status.remaining).toBe(0);
    });
  });

  describe('异常检测', () => {
    it('应该检测连续违规行为', async () => {
      const config: RateLimitConfig = {
        windowSeconds: 60,
        maxRequests: 1,
        enabled: true,
      };
      const anomalyConfig = {
        violationThreshold: 3,
        detectionWindow: 300,
        enabled: true,
      };
      const rateLimiterWithConfig = new RateLimiterImpl(config, anomalyConfig);
      const events: SecurityEvent[] = [];
      rateLimiterWithConfig.setSecurityEventCallback((event) => {
        events.push(event);
      });

      // 使用配额
      await rateLimiterWithConfig.recordCall('test-tool');

      // 连续违规
      for (let i = 0; i < 4; i++) {
        await rateLimiterWithConfig.checkLimit('test-tool');
      }

      // 应该检测到异常活动
      const anomalies =
        await rateLimiterWithConfig.detectAnomalies('test-tool');
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('SUSPICIOUS_ACTIVITY');
      expect(anomalies[0].severity).toBe('high');
    });

    it('应该在禁用异常检测时不检测异常', async () => {
      const config: RateLimitConfig = {
        windowSeconds: 60,
        maxRequests: 1,
        enabled: true,
      };
      const anomalyConfig = {
        violationThreshold: 3,
        detectionWindow: 300,
        enabled: false,
      };
      const rateLimiterWithConfig = new RateLimiterImpl(config, anomalyConfig);

      // 使用配额
      await rateLimiterWithConfig.recordCall('test-tool');

      // 连续违规
      for (let i = 0; i < 5; i++) {
        await rateLimiterWithConfig.checkLimit('test-tool');
      }

      // 不应该检测到异常
      const anomalies =
        await rateLimiterWithConfig.detectAnomalies('test-tool');
      expect(anomalies).toHaveLength(0);
    });
  });
});
