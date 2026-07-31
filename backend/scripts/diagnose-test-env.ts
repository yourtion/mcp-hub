#!/usr/bin/env tsx
/**
 * CI 环境诊断脚本
 * 在运行测试前检查测试环境是否配置正确
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

console.log('=== 测试环境诊断 ===\n');

// 1. 检查环境变量
console.log('1. 环境变量检查:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || '未设置'}`);
console.log(`   CONFIG_PATH: ${process.env.CONFIG_PATH || '未设置'}`);
console.log(`   TEST_ENV: ${process.env.TEST_ENV || '未设置'}`);
console.log(`   LOG_LEVEL: ${process.env.LOG_LEVEL || '未设置'}`);

// 2. 检查临时目录
console.log('\n2. 临时目录检查:');
const tempDir = tmpdir();
console.log(`   系统临时目录: ${tempDir}`);

const testDir = path.join(tempDir, 'mcp-knot-test-diagnostic');
try {
  mkdirSync(testDir, { recursive: true });
  console.log(`   ✓ 临时目录可创建: ${testDir}`);

  // 测试写入
  const testFile = path.join(testDir, 'test.txt');
  writeFileSync(testFile, 'test content');
  console.log(`   ✓ 临时目录可写`);

  // 测试读取
  const content = readFileSync(testFile, 'utf-8');
  if (content === 'test content') {
    console.log(`   ✓ 临时文件可读`);
  }

  // 清理
  rmSync(testDir, { recursive: true });
  console.log(`   ✓ 临时目录可清理`);
} catch (error) {
  console.error(`   ✗ 临时目录操作失败:`, error);
  process.exit(1);
}

// 3. 检查配置文件结构
console.log('\n3. 配置文件结构检查:');
const configDir = process.env.CONFIG_PATH || path.join(tempDir, 'test-config-check');

try {
  // 创建测试配置目录
  mkdirSync(configDir, { recursive: true });

  // 创建测试配置文件
  const groupConfig = {
    'test-group': {
      id: 'test-group',
      name: '测试组',
      servers: [],
      tools: [],
    },
  };
  writeFileSync(path.join(configDir, 'group.json'), JSON.stringify(groupConfig, null, 2));

  const mcpConfig = {
    servers: {
      'test-server': {
        type: 'stdio' as const,
        command: 'echo',
        args: ['test'],
        env: {},
      },
    },
  };
  writeFileSync(path.join(configDir, 'mcp_server.json'), JSON.stringify(mcpConfig, null, 2));

  const systemConfig = {
    server: {
      port: 3000,
      host: 'localhost',
    },
    auth: {
      jwt: {
        secret: 'test-secret',
        expiresIn: '1h',
        refreshExpiresIn: '7d',
        issuer: 'test',
      },
      security: {
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000,
        passwordMinLength: 6,
        requireStrongPassword: false,
      },
    },
    users: {
      admin: {
        id: 'admin-id',
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        groups: [],
        createdAt: new Date().toISOString(),
        enabled: true,
      },
    },
  };
  writeFileSync(path.join(configDir, 'system.json'), JSON.stringify(systemConfig, null, 2));

  console.log(`   ✓ 配置目录可创建: ${configDir}`);
  console.log(`   ✓ group.json 可写入`);
  console.log(`   ✓ mcp_server.json 可写入`);
  console.log(`   ✓ system.json 可写入`);

  // 验证配置文件可读
  const groupData = JSON.parse(readFileSync(path.join(configDir, 'group.json'), 'utf-8'));
  if (groupData['test-group']) {
    console.log(`   ✓ group.json 可读且格式正确`);
  }

  // 清理
  rmSync(configDir, { recursive: true });
  console.log(`   ✓ 配置目录可清理`);
} catch (error) {
  console.error(`   ✗ 配置文件操作失败:`, error);
  process.exit(1);
}

// 4. 检查 Node.js 版本
console.log('\n4. Node.js 环境检查:');
console.log(`   Node.js 版本: ${process.version}`);
console.log(`   平台: ${process.platform}`);
console.log(`   架构: ${process.arch}`);
const nodeMajorVersion = parseInt(process.version.slice(1).split('.')[0], 10);
if (nodeMajorVersion < 20) {
  console.warn(`   ⚠ 警告: Node.js 版本过低，建议使用 Node.js 20 或更高版本`);
} else {
  console.log(`   ✓ Node.js 版本符合要求`);
}

// 5. 总结
console.log('\n=== 诊断完成 ===');
console.log('✓ 所有检查通过，测试环境配置正确');
console.log('\n建议运行测试命令:');
console.log('  pnpm test:coverage  # 运行所有测试并生成覆盖率报告');
console.log('  pnpm test          # 仅运行单元测试');
console.log('  pnpm test:e2e      # 仅运行端到端测试');

process.exit(0);
