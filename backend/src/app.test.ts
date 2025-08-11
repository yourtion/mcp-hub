import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock所有依赖的路由模块
vi.mock('./api/hub', () => ({
  hubApi: {
    routes: [],
    fetch: vi.fn(),
  },
}));

vi.mock('./api/mcp/group-router.js', () => ({
  groupMcpRouter: {
    routes: [],
    fetch: vi.fn(),
  },
}));

vi.mock('./mcp', () => ({
  mcp: {
    routes: [],
    fetch: vi.fn(),
  },
}));

vi.mock('./sse', () => ({
  sse: {
    routes: [],
    fetch: vi.fn(),
  },
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该是一个Hono应用实例', async () => {
    const { app } = await import('./app.js');

    expect(app).toBeDefined();
    expect(typeof app.fetch).toBe('function');
  });

  it('应该正确配置路由结构', async () => {
    const { app } = await import('./app.js');

    // 验证应用实例存在且具有正确的方法
    expect(app.route).toBeDefined();
    expect(typeof app.route).toBe('function');
  });

  it('应该能处理基本的HTTP请求', async () => {
    const { app } = await import('./app.js');

    // 测试应用的基本功能
    const response = await app.request('http://localhost/nonexistent');
    expect(response.status).toBe(404);
  });

  it('应该正确设置应用配置', async () => {
    const { app } = await import('./app.js');

    // 验证应用配置
    expect(app).toBeDefined();
    expect(app.route).toBeDefined();
  });
});
