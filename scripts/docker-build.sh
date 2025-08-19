#!/bin/bash

# MCP Hub Docker 构建脚本

set -e

# 默认参数
TAG="latest"
PUSH=false
PLATFORM="linux/amd64"

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --tag)
            TAG="$2"
            shift 2
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        --help)
            echo "用法: $0 [选项]"
            echo "选项:"
            echo "  --tag TAG        设置镜像标签 (默认: latest)"
            echo "  --push           构建后推送到仓库"
            echo "  --platform ARCH  目标平台 (默认: linux/amd64)"
            echo "  --help           显示帮助信息"
            exit 0
            ;;
        *)
            echo "未知选项: $1"
            exit 1
            ;;
    esac
done

echo "🐳 开始构建 Docker 镜像..."
echo "  标签: $TAG"
echo "  平台: $PLATFORM"
echo "  推送: $PUSH"

# 构建 API 镜像
echo "🔨 构建 API 镜像..."
docker build \
    --platform $PLATFORM \
    -f backend/Dockerfile \
    -t mcp-hub/api:$TAG \
    .

# 构建前端镜像
echo "🔨 构建前端镜像..."
docker build \
    --platform $PLATFORM \
    -f frontend/Dockerfile \
    -t mcp-hub/web:$TAG \
    .

echo "✅ Docker 镜像构建完成！"

# 显示镜像信息
echo ""
echo "📋 构建的镜像:"
docker images | grep "mcp-hub"

# 推送镜像（如果指定）
if [ "$PUSH" = true ]; then
    echo ""
    echo "📤 推送镜像到仓库..."
    docker push mcp-hub/api:$TAG
    docker push mcp-hub/web:$TAG
    echo "✅ 镜像推送完成！"
fi