import { describe, it, expect } from 'vitest';

describe('Debug Service', () => {
  it('should have getMcpMessages function', async () => {
    const debugService = await import('./debug');
    expect(typeof debugService.getMcpMessages).toBe('function');
  });

  it('should have testTool function', async () => {
    const debugService = await import('./debug');
    expect(typeof debugService.testTool).toBe('function');
  });

  it('should have getPerformanceStats function', async () => {
    const debugService = await import('./debug');
    expect(typeof debugService.getPerformanceStats).toBe('function');
  });

  it('should have getErrorAnalysis function', async () => {
    const debugService = await import('./debug');
    expect(typeof debugService.getErrorAnalysis).toBe('function');
  });
});