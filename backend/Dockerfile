# MCP Hub API 服务器 Docker 镜像

FROM node:18-alpine AS base

# 安装 pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/share/package.json ./packages/share/
COPY packages/core/package.json ./packages/core/
COPY backend/package.json ./backend/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder

# 复制源代码
COPY packages/share ./packages/share
COPY packages/core ./packages/core
COPY backend ./backend
COPY tsconfig.json biome.json ./

# 构建所有包
RUN pnpm build:core
RUN pnpm build:api

# 生产阶段
FROM node:18-alpine AS production

# 安装 pnpm
RUN npm install -g pnpm

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcp-hub -u 1001

# 设置工作目录
WORKDIR /app

# 复制 package.json 文件
COPY --chown=mcp-hub:nodejs package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=mcp-hub:nodejs packages/share/package.json ./packages/share/
COPY --chown=mcp-hub:nodejs packages/core/package.json ./packages/core/
COPY --chown=mcp-hub:nodejs backend/package.json ./backend/

# 安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 复制构建产物
COPY --from=builder --chown=mcp-hub:nodejs /app/packages/share/dist ./packages/share/dist
COPY --from=builder --chown=mcp-hub:nodejs /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=mcp-hub:nodejs /app/backend/dist ./backend/dist

# 复制配置文件目录
COPY --chown=mcp-hub:nodejs backend/config ./backend/config

# 切换到非 root 用户
USER mcp-hub

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 启动命令
CMD ["node", "backend/dist/src/index.js"]