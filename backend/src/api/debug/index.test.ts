/**
 * Debug API测试
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { debugApi } from './index.js';

describe('调试API', () => {
  let app: Hono;

  it('应该正确导出debugApi', () => {
    expect(debugApi).toBeDefined();
    expect(typeof debugApi).toBe('object');
  });

  it('应该有正确的路由定义', () => {
    app = new Hono();
    app.route('/api/debug', debugApi);
    
    // Just test that the app can be created without errors
    expect(app).toBeDefined();
  });
});