#!/bin/bash

# MCP Hub 部署脚本

set -e

# 默认参数
ENVIRONMENT="production"
CONFIG_DIR="./config"
COMPOSE_FILE="docker-compose.yml"

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --config)
            CONFIG_DIR="$2"
            shift 2
            ;;
        --dev)
            ENVIRONMENT="development"
            COMPOSE_FILE="docker-compose.dev.yml"
            shift
            ;;
        --help)
            echo "用法: $0 [选项]"
            echo "选项:"
            echo "  --env ENV        设置环境 (production|development, 默认: production)"
            echo "  --config DIR     配置文件目录 (默认: ./config)"
            echo "  --dev            使用开发环境配置"
            echo "  --help           显示帮助信息"
            exit 0
            ;;
        *)
            echo "未知选项: $1"
            exit 1
            ;;
    esac
done

echo "🚀 开始部署 MCP Hub..."
echo "  环境: $ENVIRONMENT"
echo "  配置目录: $CONFIG_DIR"
echo "  Compose 文件: $COMPOSE_FILE"

# 检查配置文件
if [ ! -d "$CONFIG_DIR" ]; then
    echo "❌ 配置目录不存在: $CONFIG_DIR"
    exit 1
fi

# 检查必需的配置文件
REQUIRED_CONFIGS=("mcp_service.json")
if [ "$ENVIRONMENT" = "production" ]; then
    REQUIRED_CONFIGS+=("group.json")
fi

for config in "${REQUIRED_CONFIGS[@]}"; do
    if [ ! -f "$CONFIG_DIR/$config" ]; then
        echo "❌ 缺少配置文件: $CONFIG_DIR/$config"
        exit 1
    fi
done

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p logs
mkdir -p workspace

# 停止现有服务
echo "🛑 停止现有服务..."
docker-compose -f $COMPOSE_FILE down --remove-orphans

# 拉取最新镜像（生产环境）
if [ "$ENVIRONMENT" = "production" ]; then
    echo "📥 拉取最新镜像..."
    docker-compose -f $COMPOSE_FILE pull
fi

# 启动服务
echo "🚀 启动服务..."
docker-compose -f $COMPOSE_FILE up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose -f $COMPOSE_FILE ps

# 健康检查
echo "🏥 执行健康检查..."
if [ "$ENVIRONMENT" = "production" ]; then
    # 检查 API 服务
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ API 服务健康"
    else
        echo "❌ API 服务不健康"
        docker-compose -f $COMPOSE_FILE logs mcp-hub-api
        exit 1
    fi

    # 检查前端服务
    if curl -f http://localhost:8080 > /dev/null 2>&1; then
        echo "✅ 前端服务健康"
    else
        echo "❌ 前端服务不健康"
        docker-compose -f $COMPOSE_FILE logs mcp-hub-web
        exit 1
    fi
fi

echo "✅ 部署完成！"

# 显示访问信息
echo ""
echo "📋 服务访问信息:"
if [ "$ENVIRONMENT" = "production" ]; then
    echo "  - API 服务: http://localhost:3000"
    echo "  - 前端界面: http://localhost:8080"
    echo "  - 健康检查: http://localhost:3000/health"
    echo "  - API 文档: http://localhost:3000/api/docs"
else
    echo "  - API 开发服务: http://localhost:3000"
    echo "  - 前端开发服务: http://localhost:8080"
fi

echo ""
echo "📝 有用的命令:"
echo "  - 查看日志: docker-compose -f $COMPOSE_FILE logs -f"
echo "  - 停止服务: docker-compose -f $COMPOSE_FILE down"
echo "  - 重启服务: docker-compose -f $COMPOSE_FILE restart"
echo "  - 查看状态: docker-compose -f $COMPOSE_FILE ps"