import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigLoader } from './loader';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('ConfigLoader', () => {
  let configLoader: ConfigLoader;

  beforeEach(() => {
    configLoader = new ConfigLoader();
    vi.clearAllMocks();
  });

  describe('loadFromFile', () => {
    it('应该成功从文件加载配置', async () => {
      const mockConfig = {
        servers: {
          test_server: {
            command: 'test-command',
            args: ['--test'],
          },
        },
      };

      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const result = await configLoader.loadFromFile('/path/to/config.json');

      expect(readFile).toHaveBeenCalledWith('/path/to/config.json', 'utf-8');
      expect(result).toEqual(mockConfig);
    });

    it('应该在文件读取失败时抛出错误', async () => {
      const error = new Error('文件不存在');
      vi.mocked(readFile).mockRejectedValue(error);

      await expect(
        configLoader.loadFromFile('/nonexistent/config.json'),
      ).rejects.toThrow(
        '无法加载配置文件 /nonexistent/config.json: Error: 文件不存在',
      );
    });

    it('应该在JSON解析失败时抛出错误', async () => {
      vi.mocked(readFile).mockResolvedValue('invalid json {');

      await expect(
        configLoader.loadFromFile('/path/to/invalid.json'),
      ).rejects.toThrow('无法解析配置JSON:');
    });
  });

  describe('loadFromJson', () => {
    it('应该成功解析有效的JSON字符串', () => {
      const mockConfig = {
        servers: {
          test_server: {
            command: 'test-command',
            args: ['--test'],
          },
        },
      };

      const jsonString = JSON.stringify(mockConfig);
      const result = configLoader.loadFromJson(jsonString);

      expect(result).toEqual(mockConfig);
    });

    it('应该在JSON格式无效时抛出错误', () => {
      const invalidJson = '{ invalid json }';

      expect(() => configLoader.loadFromJson(invalidJson)).toThrow(
        '无法解析配置JSON:',
      );
    });

    it('应该正确处理空对象', () => {
      const emptyConfig = '{}';
      const result = configLoader.loadFromJson(emptyConfig);

      expect(result).toEqual({});
    });

    it('应该正确处理复杂的配置结构', () => {
      const complexConfig = {
        servers: {
          server1: {
            command: 'node',
            args: ['server1.js'],
            env: {
              NODE_ENV: 'production',
            },
            disabled: false,
          },
          server2: {
            command: 'python',
            args: ['-m', 'server2'],
            disabled: true,
          },
        },
        groups: {
          group1: {
            servers: ['server1'],
            tools: ['tool1', 'tool2'],
          },
        },
      };

      const jsonString = JSON.stringify(complexConfig);
      const result = configLoader.loadFromJson(jsonString);

      expect(result).toEqual(complexConfig);
    });
  });
});
