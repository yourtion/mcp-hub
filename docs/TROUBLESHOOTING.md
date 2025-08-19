# 故障排除指南

本指南帮助您诊断和解决 MCP Hub 使用过程中遇到的常见问题。

## 快速诊断

### 系统健康检查

首先检查系统整体状态：

```bash
# 检查 API 服务器健康状态
curl http://localhost:3000/health

# 检查所有组的状态
curl http://localhost:3000/api/groups

# 检查系统指标
curl http://localhost:3000/api/system/metrics
```

### 日志检查

查看应用程序日志获取详细错误信息：

```bash
# API 服务器日志
pnpm --filter @mcp-core/mcp-hub-api logs

# Docker 环境日志
docker-compose logs -f mcp-hub-api

# 系统日志文件
tail -f logs/mcp-hub.log
```

## 常见问题

### 1. 服务启动问题

#### 问题：API 服务器无法启动

**症状**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方案**:
```bash
# 检查端口占用
lsof -i :3000

# 杀死占用进程
kill -9 <PID>

# 或更改端口
export PORT=3001
pnpm dev:api
```

#### 问题：依赖包缺失

**症状**:
```
Error: Cannot find module '@mcp-core/mcp-hub-core'
```

**解决方案**:
```bash
# 重新安装依赖
pnpm install

# 构建核心包
pnpm build:core

# 清理并重新构建
pnpm clean && pnpm build
```

### 2. 配置问题

#### 问题：配置文件未找到

**症状**:
```
Error: Configuration file not found: mcp_service.json
```

**解决方案**:
```bash
# 检查配置文件路径
ls -la backend/config/

# 创建默认配置
cp backend/config/mcp_service.json.example backend/config/mcp_service.json

# 验证配置格式
cat backend/config/mcp_service.json | jq .
```

#### 问题：配置格式错误

**症状**:
```
Error: Invalid JSON in configuration file
```

**解决方案**:
```bash
# 验证 JSON 格式
jsonlint backend/config/mcp_service.json

# 或使用 jq
jq . backend/config/mcp_service.json

# 检查常见错误：
# - 缺少逗号
# - 多余的逗号
# - 引号不匹配
# - 括号不匹配
```

### 3. MCP 服务器连接问题

#### 问题：无法连接到 MCP 服务器

**症状**:
```
Error: Failed to connect to MCP server 'filesystem'
```

**诊断步骤**:
```bash
# 1. 检查服务器配置
cat backend/config/mcp_service.json | jq '.servers.filesystem'

# 2. 手动测试服务器命令
npx -y @modelcontextprotocol/server-filesystem /path/to/directory

# 3. 检查环境变量
env | grep -i mcp

# 4. 检查网络连接
ping localhost
```

**解决方案**:
```bash
# 更新服务器配置
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/correct/path"],
      "env": {},
      "timeout": 30000,
      "retries": 3
    }
  }
}

# 安装缺失的包
npm install -g @modelcontextprotocol/server-filesystem

# 检查路径权限
ls -la /path/to/directory
```

#### 问题：MCP 服务器超时

**症状**:
```
Error: MCP server timeout after 30000ms
```

**解决方案**:
```bash
# 增加超时时间
{
  "servers": {
    "slow-server": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slow"],
      "timeout": 60000
    }
  }
}

# 检查服务器性能
time npx -y @modelcontextprotocol/server-slow

# 优化服务器配置
```

### 4. 组路由问题

#### 问题：组路由返回 404

**症状**:
```
GET /development/mcp/list_tools -> 404 Not Found
```

**诊断步骤**:
```bash
# 1. 检查组配置
cat backend/config/group.json | jq '.groups.development'

# 2. 检查组是否启用
curl http://localhost:3000/api/groups/development

# 3. 检查路由注册
curl http://localhost:3000/api/groups
```

**解决方案**:
```bash
# 确保组配置正确
{
  "groups": {
    "development": {
      "name": "开发工具组",
      "servers": ["filesystem"],
      "enabled": true
    }
  }
}

# 重启服务器
pnpm dev:api
```

#### 问题：工具不在允许列表中

**症状**:
```
Error: Tool 'write_file' not allowed in group 'development'
```

**解决方案**:
```bash
# 更新组配置，添加工具到允许列表
{
  "groups": {
    "development": {
      "allowedTools": ["read_file", "write_file", "list_directory"]
    }
  }
}

# 或允许所有工具
{
  "groups": {
    "development": {
      "allowedTools": ["*"]
    }
  }
}
```

### 5. CLI 问题

#### 问题：CLI 命令未找到

**症状**:
```
bash: mcp-hub: command not found
```

**解决方案**:
```bash
# 检查 CLI 包是否已构建
cd packages/cli
pnpm build

# 全局安装
npm install -g @mcp-core/mcp-hub-cli

# 或使用本地路径
./packages/cli/bin/mcp-hub.js

# 检查 PATH 环境变量
echo $PATH
```

#### 问题：CLI 配置文件错误

**症状**:
```
Error: Invalid CLI configuration
```

**解决方案**:
```bash
# 创建默认配置
mcp-hub --init

# 或手动创建
cat > mcp_service.json << EOF
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
      "env": {}
    }
  }
}
EOF

# 验证配置
mcp-hub --config mcp_service.json --validate
```

### 6. 性能问题

#### 问题：响应时间过长

**诊断步骤**:
```bash
# 检查系统指标
curl http://localhost:3000/api/system/metrics

# 检查组统计
curl http://localhost:3000/api/groups/development/stats

# 监控资源使用
top -p $(pgrep -f mcp-hub)
```

**解决方案**:
```bash
# 优化连接池配置
{
  "servers": {
    "filesystem": {
      "pool": {
        "min": 2,
        "max": 10,
        "idleTimeout": 300000
      }
    }
  }
}

# 启用缓存
{
  "cache": {
    "enabled": true,
    "ttl": 300,
    "maxSize": 1000
  }
}

# 调整日志级别
{
  "logging": {
    "level": "warn"
  }
}
```

#### 问题：内存使用过高

**诊断步骤**:
```bash
# 检查内存使用
ps aux | grep mcp-hub

# 检查 Node.js 堆使用
node --inspect backend/dist/src/index.js

# 生成堆快照
kill -USR2 <PID>
```

**解决方案**:
```bash
# 限制 Node.js 内存
node --max-old-space-size=512 backend/dist/src/index.js

# 启用垃圾回收日志
node --trace-gc backend/dist/src/index.js

# 优化配置
{
  "performance": {
    "maxConnections": 50,
    "connectionTimeout": 30000,
    "memoryLimit": "512MB"
  }
}
```

### 7. Docker 问题

#### 问题：Docker 容器无法启动

**症状**:
```
Error: Container exited with code 1
```

**诊断步骤**:
```bash
# 查看容器日志
docker logs mcp-hub-api

# 检查容器状态
docker ps -a

# 进入容器调试
docker exec -it mcp-hub-api /bin/sh
```

**解决方案**:
```bash
# 检查 Dockerfile
cat backend/Dockerfile

# 重新构建镜像
docker build -f backend/Dockerfile -t mcp-hub/api .

# 检查挂载的配置文件
ls -la ./backend/config/
```

#### 问题：容器间网络连接问题

**症状**:
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**解决方案**:
```bash
# 检查 docker-compose 网络配置
docker-compose ps
docker network ls

# 使用服务名而不是 localhost
# 错误: http://localhost:3000
# 正确: http://mcp-hub-api:3000

# 检查端口映射
docker-compose port mcp-hub-api 3000
```

### 8. 权限问题

#### 问题：文件权限被拒绝

**症状**:
```
Error: EACCES: permission denied, open '/workspace/file.txt'
```

**解决方案**:
```bash
# 检查文件权限
ls -la /workspace/

# 修改权限
chmod 644 /workspace/file.txt
chown user:group /workspace/file.txt

# Docker 环境中的权限问题
# 在 Dockerfile 中设置正确的用户
USER mcp-hub

# 或在 docker-compose 中设置
services:
  mcp-hub-api:
    user: "1001:1001"
```

#### 问题：环境变量访问权限

**症状**:
```
Error: Environment variable BRAVE_API_KEY not accessible
```

**解决方案**:
```bash
# 检查环境变量
env | grep BRAVE_API_KEY

# 在 docker-compose 中设置
services:
  mcp-hub-api:
    environment:
      - BRAVE_API_KEY=${BRAVE_API_KEY}

# 或使用 .env 文件
echo "BRAVE_API_KEY=your-key" > .env
```

## 调试技巧

### 1. 启用详细日志

```bash
# 设置日志级别
export MCP_HUB_LOG_LEVEL=debug

# 启用调试模式
export DEBUG=mcp-hub:*

# 查看详细的 MCP 协议交互
export MCP_DEBUG=true
```

### 2. 使用 MCP Inspector

```bash
# 启动 MCP Inspector
pnpm inspector

# 连接到本地 MCP 服务器
# URL: stdio://path/to/mcp-hub-cli
```

### 3. 网络调试

```bash
# 使用 curl 测试 API
curl -v http://localhost:3000/health

# 使用 tcpdump 监控网络流量
sudo tcpdump -i lo port 3000

# 使用 netstat 检查端口
netstat -tlnp | grep 3000
```

### 4. 性能分析

```bash
# 使用 Node.js 内置分析器
node --prof backend/dist/src/index.js

# 生成火焰图
node --prof-process isolate-*.log > profile.txt

# 使用 clinic.js
npx clinic doctor -- node backend/dist/src/index.js
```

## 获取帮助

### 1. 收集诊断信息

在寻求帮助时，请提供以下信息：

```bash
# 系统信息
uname -a
node --version
pnpm --version

# MCP Hub 版本
curl http://localhost:3000/api/system/info

# 配置文件（移除敏感信息）
cat backend/config/mcp_service.json | jq 'del(.servers[].env)'

# 错误日志
tail -n 100 logs/mcp-hub.log

# 系统资源使用
free -h
df -h
```

### 2. 创建最小复现示例

```bash
# 创建最小配置
cat > minimal-config.json << EOF
{
  "servers": {
    "test": {
      "command": "echo",
      "args": ["{\"tools\": []}"],
      "env": {}
    }
  }
}
EOF

# 测试最小配置
mcp-hub --config minimal-config.json
```

### 3. 联系支持

- **GitHub Issues**: 在项目仓库中创建详细的 issue
- **文档**: 查看其他文档获取更多信息
- **社区**: 加入社区讨论

## 预防措施

### 1. 定期维护

```bash
# 定期更新依赖
pnpm update

# 清理日志文件
find logs/ -name "*.log" -mtime +7 -delete

# 检查磁盘空间
df -h

# 监控内存使用
free -h
```

### 2. 监控和告警

```bash
# 设置健康检查
curl -f http://localhost:3000/health || echo "Service down!"

# 监控日志错误
tail -f logs/mcp-hub.log | grep ERROR

# 设置资源使用告警
if [ $(free | grep Mem | awk '{print ($3/$2) * 100.0}') -gt 80 ]; then
  echo "High memory usage!"
fi
```

### 3. 备份和恢复

```bash
# 备份配置文件
tar -czf config-backup-$(date +%Y%m%d).tar.gz backend/config/

# 备份日志
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/

# 恢复配置
tar -xzf config-backup-20240115.tar.gz
```

## 相关文档

- [CLI 使用指南](CLI_USAGE.md)
- [组路由指南](GROUP_ROUTING.md)
- [API 参考](API_REFERENCE.md)
- [迁移指南](MIGRATION.md)