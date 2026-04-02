/**
 * getAllConfig 配置工具测试
 * 覆盖 apiToolsConfigPath 在不同场景下的返回值
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock JsonStorage
vi.mock('./json_storage.js', () => ({
  JsonStorage: vi.fn().mockImplementation(() => ({
    read: vi.fn().mockResolvedValue({}),
  })),
}));

describe('getAllConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('api-tools.json 文件不存在时应返回 apiToolsConfigPath 路径', async () => {
    // Mock fs.access 抛出 ENOENT（文件不存在）
    vi.doMock('node:fs/promises', () => ({
      access: vi.fn().mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
      ),
    }));

    const { getAllConfig } = await import('./config.js');
    const config = await getAllConfig();

    // 即使文件不存在，也应该返回路径（允许后续创建）
    expect(config.apiToolsConfigPath).toBeDefined();
    expect(config.apiToolsConfigPath).toMatch(/api-tools\.json$/);
  });

  it('api-tools.json 文件存在时应返回正确的路径', async () => {
    vi.doMock('node:fs/promises', () => ({
      access: vi.fn().mockResolvedValue(undefined),
    }));

    const { getAllConfig } = await import('./config.js');
    const config = await getAllConfig();

    expect(config.apiToolsConfigPath).toBeDefined();
    expect(config.apiToolsConfigPath).toMatch(/api-tools\.json$/);
  });

  it('始终返回 mcps, groups, system 配置', async () => {
    vi.doMock('node:fs/promises', () => ({
      access: vi.fn().mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
      ),
    }));

    const { getAllConfig } = await import('./config.js');
    const config = await getAllConfig();

    expect(config).toHaveProperty('mcps');
    expect(config).toHaveProperty('groups');
    expect(config).toHaveProperty('system');
    expect(config).toHaveProperty('apiToolsConfigPath');
  });
});
