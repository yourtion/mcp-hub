import { describe, it, expect } from 'vitest';

import { GroupSchema } from './group.schema.js';

describe('GroupSchema - cacheHints (P4)', () => {
  it('应接受带 cacheHints 的合法配置', () => {
    const valid = {
      id: 'g1',
      name: 'Group 1',
      servers: ['srv1'],
      tools: [],
      cacheHints: {
        toolsListTtlMs: 120000,
        toolsListCacheScope: 'private',
      },
    };
    const parsed = GroupSchema.parse(valid);
    expect(parsed.cacheHints).toEqual({
      toolsListTtlMs: 120000,
      toolsListCacheScope: 'private',
    });
  });

  it('cacheHints 可选，不填也能通过', () => {
    const parsed = GroupSchema.parse({
      id: 'g1',
      name: 'Group 1',
      servers: ['srv1'],
      tools: [],
    });
    expect(parsed.cacheHints).toBeUndefined();
  });

  it('toolsListTtlMs 拒绝负数', () => {
    const result = GroupSchema.safeParse({
      id: 'g1',
      name: 'G1',
      servers: ['s1'],
      tools: [],
      cacheHints: { toolsListTtlMs: -100 },
    });
    expect(result.success).toBe(false);
  });

  it('toolsListCacheScope 拒绝非法枚举值', () => {
    const result = GroupSchema.safeParse({
      id: 'g1',
      name: 'G1',
      servers: ['s1'],
      tools: [],
      cacheHints: { toolsListCacheScope: 'shared' },
    });
    expect(result.success).toBe(false);
  });
});
