# MCP Hub 开发指南

本指南介绍如何设置开发环境并参与 MCP Hub 的开发。

## 目录

- [开发环境设置](#开发环境设置)
- [项目结构](#项目结构)
- [开发工作流](#开发工作流)
- [代码规范](#代码规范)
- [测试指南](#测试指南)
- [调试技巧](#调试技巧)
- [贡献指南](#贡献指南)
- [发布流程](#发布流程)

## 开发环境设置

### 前置要求

确保已安装以下软件：

- **Node.js**: 18.x 或更高版本
- **pnpm**: 8.x 或更高版本
- **Git**: 2.x 或更高版本
- **代码编辑器**: VS Code（推荐）或其他

### 安装 Node.js

**macOS**:
```bash
# 使用 Homebrew
brew install node@18

# 或使用 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

**Linux**:
```bash
# 使用 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# 或使用包管理器
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows**:
- 从 [Node.js 官网](https://nodejs.org/) 下载安装器
- 或使用 [nvm-windows](https://github.com/coreybutler/nvm-windows)

### 安装 pnpm

```bash
npm install -g pnpm

# 验证安装
pnpm --version
```

### 克隆项目

```bash
# 克隆仓库
git clone https://github.com/your-org/mcp-hub.git
cd mcp-hub

# 安装依赖
pnpm install

# 构建所有包
pnpm build
```

### VS Code 设置

推荐的 VS Code 扩展：

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "biomejs.biome",
    "vue.volar",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

工作区设置 (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "editor.codeActionsOnSave": {
    "source.fixAll": true,
    "source.organizeImports": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[vue]": {
    "editor.defaultFormatter": "Vue.volar"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

## 项目结构

### Monorepo 架构

```
mcp-hub/
├── backend/              # API 服务器
│   ├── src/
│   │   ├── api/         # API 路由处理器
│   │   ├── services/    # 业务逻辑服务
│   │   ├── types/       # TypeScript 类型定义
│   │   ├── utils/       # 工具函数
│   │   ├── middleware/  # 中间件
│   │   └── validation/  # 输入验证
│   ├── config/          # 配置文件
│   └── dist/            # 编译输出
├── frontend/            # Vue.js Web 界面
│   ├── src/
│   │   ├── components/  # Vue 组件
│   │   ├── views/       # 页面组件
│   │   ├── stores/      # Pinia 状态管理
│   │   ├── services/    # API 服务
│   │   ├── router/      # 路由配置
│   │   └── types/       # TypeScript 类型
│   └── dist/            # 构建输出
├── packages/
│   ├── core/            # 核心 MCP 逻辑
│   ├── cli/             # CLI 工具
│   └── share/           # 共享类型和工具
├── docs/                # 文档
└── scripts/             # 构建和部署脚本
```

### 包依赖关系

```
backend (API)
  ├── @mcp-core/mcp-hub-core
  └── @mcp-core/mcp-hub-share

frontend (Web)
  └── @mcp-core/mcp-hub-share

packages/cli
  ├── @mcp-core/mcp-hub-core
  └── @mcp-core/mcp-hub-share

packages/core
  └── @mcp-core/mcp-hub-share
```

## 开发工作流

### 启动开发服务器

**后端开发**:
```bash
# 启动后端开发服务器（带热重载）
pnpm dev:api

# 或在 backend 目录中
cd backend
pnpm dev
```

后端将在 `http://localhost:3000` 运行。

**前端开发**:
```bash
# 启动前端开发服务器
pnpm dev:fe

# 或在 frontend 目录中
cd frontend
pnpm dev
```

前端将在 `http://localhost:8080` 运行。

**同时启动前后端**:
```bash
# 在两个终端窗口中分别运行
# 终端 1
pnpm dev:api

# 终端 2
pnpm dev:fe
```

### 开发核心包

```bash
cd packages/core

# 监视模式编译
pnpm dev

# 运行测试（监视模式）
pnpm test:watch
```

### 开发 CLI 包

```bash
cd packages/cli

# 监视模式编译
pnpm dev

# 测试 CLI
node dist/cli.js
```

### 构建项目

```bash
# 构建所有包
pnpm build

# 构建特定包
pnpm build:core    # 核心包
pnpm build:api     # 后端
pnpm build:cli     # CLI
pnpm build:fe      # 前端

# 生产构建（所有包）
pnpm build:production
```

### 代码检查和格式化

```bash
# 检查和修复所有包
pnpm check

# 检查特定包
cd backend
pnpm check

# 只检查不修复
pnpm check --apply=off
```

## 代码规范

### TypeScript 规范

**类型定义**:
```typescript
// ✅ 好的做法
interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

function getUser(id: string): Promise<User> {
  // ...
}

// ❌ 避免使用 any
function processData(data: any) {  // 不推荐
  // ...
}

// ✅ 使用泛型或具体类型
function processData<T>(data: T): T {
  // ...
}
```

**命名约定**:
- **接口**: PascalCase (`UserInfo`, `ServerConfig`)
- **类型**: PascalCase (`ToolResult`, `ApiResponse`)
- **函数**: camelCase (`getUserById`, `connectServer`)
- **变量**: camelCase (`userId`, `serverList`)
- **常量**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **文件**: kebab-case (`user-service.ts`, `api-client.ts`)

### Vue 组件规范

**组件命名**:
```vue
<!-- ✅ 多词组件名 -->
<template>
  <div class="server-list">
    <!-- ... -->
  </div>
</template>

<script setup lang="ts">
// 组件逻辑
</script>
```

**Props 定义**:
```typescript
// ✅ 使用 TypeScript 定义 props
interface Props {
  serverId: string;
  status: 'connected' | 'disconnected';
  onConnect?: () => void;
}

const props = defineProps<Props>();
```

**事件定义**:
```typescript
// ✅ 定义事件类型
const emit = defineEmits<{
  update: [value: string];
  delete: [id: string];
}>();
```

### 注释规范

**函数注释**:
```typescript
/**
 * 连接到 MCP 服务器
 * @param serverId - 服务器唯一标识符
 * @param config - 服务器配置对象
 * @returns Promise，解析为连接结果
 * @throws {ConnectionError} 当连接失败时抛出
 */
async function connectServer(
  serverId: string,
  config: ServerConfig
): Promise<ConnectionResult> {
  // 实现...
}
```

**代码注释**:
```typescript
// ✅ 解释为什么，而不是做什么
// 使用指数退避策略重试，避免服务器过载
const retryDelay = Math.pow(2, attempt) * 1000;

// ❌ 避免显而易见的注释
// 设置 userId 为 123
const userId = 123;
```

### Git 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type)**:
- `feat`: 新功能
- `fix`: 错误修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例**:
```bash
# 新功能
git commit -m "feat(api): 添加服务器健康检查端点"

# 错误修复
git commit -m "fix(frontend): 修复工具列表分页问题"

# 文档更新
git commit -m "docs: 更新部署指南"

# 重构
git commit -m "refactor(core): 优化 MCP 连接管理器"
```

## 测试指南

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定包的测试
cd backend
pnpm test

# 监视模式
pnpm test:watch

# 生成覆盖率报告
pnpm test:coverage

# 运行 E2E 测试
pnpm test:e2e
```

### 编写单元测试

**后端测试示例**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ServerManager } from './server-manager';

describe('ServerManager', () => {
  let manager: ServerManager;

  beforeEach(() => {
    manager = new ServerManager();
  });

  it('应该成功添加服务器', async () => {
    const config = {
      id: 'test-server',
      command: 'node',
      args: ['server.js'],
    };

    await manager.addServer(config);
    const server = manager.getServer('test-server');

    expect(server).toBeDefined();
    expect(server?.id).toBe('test-server');
  });

  it('添加重复服务器应该抛出错误', async () => {
    const config = {
      id: 'test-server',
      command: 'node',
      args: ['server.js'],
    };

    await manager.addServer(config);

    await expect(
      manager.addServer(config)
    ).rejects.toThrow('服务器已存在');
  });
});
```

**前端测试示例**:
```typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ServerList from './ServerList.vue';

describe('ServerList', () => {
  it('应该渲染服务器列表', () => {
    const servers = [
      { id: 'server1', name: '服务器 1', status: 'connected' },
      { id: 'server2', name: '服务器 2', status: 'disconnected' },
    ];

    const wrapper = mount(ServerList, {
      props: { servers },
    });

    expect(wrapper.findAll('.server-item')).toHaveLength(2);
  });

  it('点击连接按钮应该触发事件', async () => {
    const wrapper = mount(ServerList, {
      props: {
        servers: [
          { id: 'server1', name: '服务器 1', status: 'disconnected' },
        ],
      },
    });

    await wrapper.find('.connect-button').trigger('click');

    expect(wrapper.emitted('connect')).toBeTruthy();
    expect(wrapper.emitted('connect')?.[0]).toEqual(['server1']);
  });
});
```

### 测试覆盖率

目标覆盖率：
- **语句覆盖率**: > 80%
- **分支覆盖率**: > 75%
- **函数覆盖率**: > 80%
- **行覆盖率**: > 80%

查看覆盖率报告：
```bash
pnpm test:coverage
open coverage/index.html
```

## 调试技巧

### 后端调试

**使用 VS Code 调试器**:

创建 `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "调试后端",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev:api"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    }
  ]
}
```

**使用 Node.js 调试器**:
```bash
# 启动调试模式
node --inspect dist/src/index.js

# 在 Chrome 中打开
chrome://inspect
```

**日志调试**:
```typescript
import { logger } from './utils/logger';

// 不同级别的日志
logger.debug('调试信息', { data });
logger.info('信息日志', { userId });
logger.warn('警告信息', { error });
logger.error('错误信息', { error, stack });
```

### 前端调试

**Vue DevTools**:
- 安装 [Vue DevTools](https://devtools.vuejs.org/) 浏览器扩展
- 在开发模式下自动启用

**浏览器调试**:
```typescript
// 使用 console
console.log('调试信息', data);
console.table(arrayData);
console.group('分组日志');
console.log('项目 1');
console.log('项目 2');
console.groupEnd();

// 使用 debugger
function processData(data: unknown) {
  debugger; // 断点
  // 处理逻辑
}
```

**网络请求调试**:
```typescript
// 在 Axios 拦截器中添加日志
axios.interceptors.request.use(config => {
  console.log('请求:', config.method, config.url, config.data);
  return config;
});

axios.interceptors.response.use(
  response => {
    console.log('响应:', response.status, response.data);
    return response;
  },
  error => {
    console.error('错误:', error.response?.status, error.message);
    return Promise.reject(error);
  }
);
```

### MCP 协议调试

**使用 MCP Inspector**:
```bash
# 启动 MCP Inspector
pnpm inspector

# 连接到 MCP 服务器
# 在浏览器中打开 http://localhost:5173
```

**查看 MCP 消息**:
```typescript
// 在代码中记录 MCP 消息
mcpClient.on('message', (message) => {
  logger.debug('MCP 消息', {
    type: message.type,
    method: message.method,
    content: message.content,
  });
});
```

## 贡献指南

### 贡献流程

1. **Fork 仓库**
   ```bash
   # 在 GitHub 上 Fork 仓库
   # 克隆你的 Fork
   git clone https://github.com/your-username/mcp-hub.git
   ```

2. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **进行更改**
   - 编写代码
   - 添加测试
   - 更新文档

4. **提交更改**
   ```bash
   git add .
   git commit -m "feat: 添加新功能"
   ```

5. **推送到 Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **创建 Pull Request**
   - 在 GitHub 上创建 PR
   - 填写 PR 模板
   - 等待代码审查

### Pull Request 检查清单

在提交 PR 前，确保：

- [ ] 代码通过所有测试 (`pnpm test`)
- [ ] 代码通过 lint 检查 (`pnpm check`)
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] 提交消息遵循规范
- [ ] 没有合并冲突
- [ ] PR 描述清晰完整

### 代码审查

代码审查关注点：

1. **功能正确性**: 代码是否实现了预期功能
2. **代码质量**: 代码是否清晰、可维护
3. **测试覆盖**: 是否有足够的测试
4. **性能**: 是否有性能问题
5. **安全性**: 是否有安全隐患
6. **文档**: 是否更新了文档

### 问题报告

报告问题时，请包含：

1. **问题描述**: 清晰描述问题
2. **重现步骤**: 如何重现问题
3. **预期行为**: 应该发生什么
4. **实际行为**: 实际发生了什么
5. **环境信息**: 
   - Node.js 版本
   - 操作系统
   - 浏览器（如果相关）
6. **错误日志**: 相关的错误信息
7. **截图**: 如果有帮助

## 发布流程

### 版本号规范

遵循 [Semantic Versioning](https://semver.org/):

- **主版本号 (MAJOR)**: 不兼容的 API 变更
- **次版本号 (MINOR)**: 向后兼容的功能新增
- **修订号 (PATCH)**: 向后兼容的问题修复

### 发布步骤

1. **更新版本号**
   ```bash
   # 更新所有包的版本号
   pnpm version:bump
   
   # 或手动更新 package.json
   ```

2. **更新 CHANGELOG**
   ```bash
   # 记录版本变更
   echo "## [1.2.0] - 2024-01-15" >> CHANGELOG.md
   echo "### Added" >> CHANGELOG.md
   echo "- 新功能描述" >> CHANGELOG.md
   ```

3. **运行测试**
   ```bash
   pnpm test
   pnpm test:e2e
   ```

4. **构建**
   ```bash
   pnpm build:production
   ```

5. **提交变更**
   ```bash
   git add .
   git commit -m "chore: 发布 v1.2.0"
   git tag v1.2.0
   ```

6. **推送到远程**
   ```bash
   git push origin main
   git push origin v1.2.0
   ```

7. **发布到 npm**
   ```bash
   pnpm publish:packages
   ```

### 发布检查清单

- [ ] 所有测试通过
- [ ] 文档已更新
- [ ] CHANGELOG 已更新
- [ ] 版本号已更新
- [ ] 创建了 Git 标签
- [ ] 发布说明已准备

## 常见开发问题

### 依赖安装失败

```bash
# 清理缓存
pnpm store prune

# 删除 node_modules
rm -rf node_modules packages/*/node_modules backend/node_modules frontend/node_modules

# 重新安装
pnpm install
```

### 构建失败

```bash
# 清理构建输出
pnpm clean

# 重新构建
pnpm build
```

### 测试失败

```bash
# 运行单个测试文件
pnpm test path/to/test.ts

# 使用调试模式
pnpm test:debug
```

### 端口冲突

```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或使用不同端口
PORT=3001 pnpm dev:api
```

## 有用的资源

### 文档

- [MCP 协议规范](https://modelcontextprotocol.io/)
- [Vue 3 文档](https://vuejs.org/)
- [TDesign 文档](https://tdesign.tencent.com/)
- [Hono 文档](https://hono.dev/)

### 工具

- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [Vue DevTools](https://devtools.vuejs.org/)
- [Postman](https://www.postman.com/) - API 测试
- [Insomnia](https://insomnia.rest/) - API 测试

### 社区

- GitHub Issues
- GitHub Discussions
- Discord 服务器（如果有）

## 相关文档

- [Web 界面使用指南](WEB_UI_GUIDE.md)
- [API 参考文档](API_REFERENCE.md)
- [部署指南](DEPLOYMENT.md)
- [故障排除指南](TROUBLESHOOTING.md)
