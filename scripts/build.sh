#!/bin/bash

# MCP Knot 构建脚本

set -e

echo "🚀 开始构建 MCP Knot..."

# 检查 Node.js 和 pnpm
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm 未安装"
    exit 1
fi

# 清理之前的构建
echo "🧹 清理之前的构建..."
pnpm clean

# 安装依赖
echo "📦 安装依赖..."
pnpm install --frozen-lockfile

# 代码检查
echo "🔍 运行代码检查..."
pnpm check:all

# 运行测试
echo "🧪 运行测试..."
pnpm test:coverage

# 构建所有包
echo "🔨 构建核心包..."
pnpm build:core

echo "🔨 构建 API 包..."
pnpm build:api

echo "🔨 构建 CLI 包..."
pnpm build:cli

echo "🔨 构建前端..."
pnpm build:fe

# 生成覆盖率报告
echo "📊 生成覆盖率报告..."
pnpm coverage:full

echo "✅ 构建完成！"

# 显示构建结果
echo ""
echo "📋 构建结果:"
echo "  - 核心包: packages/core/dist/"
echo "  - API 包: backend/dist/"
echo "  - CLI 包: packages/cli/dist/"
echo "  - 前端: frontend/dist/"
echo "  - 覆盖率报告: coverage/"