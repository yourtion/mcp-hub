# MCP Hub 常见问题解答 (FAQ)

本文档收集了 MCP Hub 使用过程中的常见问题和解决方案。

## 目录

- [安装和设置](#安装和设置)
- [认证和登录](#认证和登录)
- [服务器管理](#服务器管理)
- [工具使用](#工具使用)
- [组管理](#组管理)
- [API 到 MCP](#api-到-mcp)
- [性能和优化](#性能和优化)
- [故障排除](#故障排除)
- [安全性](#安全性)
- [部署相关](#部署相关)

## 安装和设置

### Q: 支持哪些 Node.js 版本？

**A:** MCP Hub 需要 Node.js 18.x 或更高版本。推荐使用 LTS 版本（18.x 或 20.x）。

```bash
# 检查 Node.js 版本
node --version

# 如果版本过低，使用 nvm 升级
nvm install 18
nvm use 18
```

### Q: 为什么推荐使用 pnpm 而不是 npm？

**A:** pnpm 提供了更好的性能和磁盘空间利用率，特别是在 monorepo 项目中。它还能更好地处理依赖关系。

```bash
# 安装 pnpm
npm install -g pnpm

# 使用 pnpm 安装依赖
pnpm install
```

### Q: 安装依赖时出现权限错误怎么办？

**A:** 不要使用 `sudo` 安装全局包。配置 npm 使用用户目录：

```bash
# 配置 npm 全局目录
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'

# 添加到 PATH（在 ~/.bashrc 或 ~/.zshrc 中）
export PATH=~/.npm-global/bin:$PATH

# 重新加载配置
source ~/.bashrc  # 或 source ~/.zshrc
```

### Q: 如何在 Windows 上运行 MCP Hub？

**A:** 推荐使用 WSL2 (Windows Subsystem for Linux)：

1. 安装 WSL2
2. 安装 Ubuntu 或其他 Linux 发行版
3. 在 WSL2 中安装 Node.js 和 pnpm
4. 按照 Linux 的安装步骤进行

或者使用 Windows 原生环境，但某些 MCP 服务器可能不兼容。

## 认证和登录

### Q: 默认的登录凭据是什么？

**A:** 
- **用户名**: `admin`
- **密码**: `admin`

⚠️ **重要**: 在生产环境中必须立即更改默认密码！

### Q: 如何更改管理员密码？

**A:** 

1. 生成新密码的哈希值：
```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your-new-password', 10));"
```

2. 编辑 `backend/config/system.json`，更新密码哈希

3. 重启后端服务：
```bash
pm2 restart mcp-hub-api
```

### Q: 忘记密码怎么办？

**A:** 需要直接编辑配置文件重置密码：

1. 停止服务
2. 编辑 `backend/config/system.json`
3. 将密码哈希重置为默认值（`admin` 的哈希）
4. 重启服务
5. 使用默认密码登录后立即更改

### Q: 为什么一直提示"令牌已过期"？

**A:** 可能的原因：

1. **系统时间不正确**: JWT 依赖准确的系统时间
   ```bash
   # 检查系统时间
   date
   
   # 同步时间（Linux）
   sudo ntpdate -s time.nist.gov
   ```

2. **JWT 密钥不匹配**: 确保前后端使用相同的 JWT 密钥

3. **令牌过期时间太短**: 在配置中增加过期时间

### Q: 如何实现多用户管理？

**A:** 当前版本支持单用户（管理员）。多用户功能计划在未来版本中实现。如果需要多用户，可以：

1. 为不同用户创建不同的组
2. 使用组级别的验证密钥
3. 通过反向代理实现基本的访问控制

## 服务器管理

### Q: 支持哪些类型的 MCP 服务器？

**A:** MCP Hub 支持三种类型的 MCP 服务器：

1. **stdio**: 通过标准输入/输出通信（最常见）
2. **SSE**: 通过 Server-Sent Events 通信
3. **WebSocket**: 通过 WebSocket 通信（计划支持）

### Q: 如何添加自定义 MCP 服务器？

**A:** 

1. 在 Web 界面中点击"添加服务器"
2. 填写服务器配置：
   ```json
   {
     "id": "my-server",
     "type": "stdio",
     "command": "node",
     "args": ["/path/to/my-server.js"],
     "env": {
       "API_KEY": "your-api-key"
     }
   }
   ```
3. 点击"测试连接"验证配置
4. 保存配置

### Q: 服务器连接失败怎么办？

**A:** 检查以下几点：

1. **命令和参数是否正确**:
   ```bash
   # 手动测试命令
   npx -y @modelcontextprotocol/server-filesystem /path
   ```

2. **环境变量是否设置**:
   - 检查所需的 API 密钥
   - 验证环境变量格式

3. **权限问题**:
   ```bash
   # 检查文件权限
   ls -la /path/to/server
   
   # 添加执行权限
   chmod +x /path/to/server
   ```

4. **查看日志**:
   ```bash
   # 后端日志
   pm2 logs mcp-hub-api
   
   # 或查看文件日志
   tail -f /var/log/mcp-hub/app.log
   ```

### Q: 服务器连接后立即断开？

**A:** 可能的原因：

1. **服务器进程崩溃**: 检查服务器日志
2. **MCP 协议握手失败**: 使用 MCP Inspector 调试
3. **超时设置太短**: 增加连接超时时间
4. **资源不足**: 检查系统资源（内存、CPU）

### Q: 如何更新服务器配置？

**A:** 

1. 在服务器列表中点击"编辑"
2. 修改配置
3. 点击"测试连接"验证
4. 保存更改

⚠️ **注意**: 更新配置会断开现有连接并重新连接。

### Q: 删除服务器会影响什么？

**A:** 删除服务器会：

1. 断开服务器连接
2. 从所有组中移除该服务器
3. 使该服务器的工具不可用
4. 删除服务器配置（不可恢复）

建议在删除前先禁用服务器，确认无影响后再删除。

## 工具使用

### Q: 如何查找特定的工具？

**A:** 使用工具管理页面的搜索和过滤功能：

1. **搜索框**: 输入工具名称或描述关键词
2. **服务器过滤**: 选择特定服务器
3. **组过滤**: 选择特定组
4. **状态过滤**: 只显示可用或不可用的工具

### Q: 工具执行失败，显示"工具未找到"？

**A:** 检查：

1. **服务器是否已连接**: 在服务器列表中查看状态
2. **工具名称是否正确**: 区分大小写
3. **组权限**: 如果在组中执行，检查工具是否在允许列表中
4. **刷新工具列表**: 重新连接服务器以刷新工具列表

### Q: 工具执行超时怎么办？

**A:** 

1. **增加超时时间**: 在配置中设置更长的超时
   ```json
   {
     "timeout": 60000  // 60 秒
   }
   ```

2. **优化工具参数**: 减少处理的数据量

3. **检查服务器性能**: 确保服务器有足够的资源

### Q: 如何查看工具的执行历史？

**A:** 

1. 进入工具详情页面
2. 点击"执行历史"标签
3. 查看历史记录，包括：
   - 执行时间
   - 使用的参数
   - 执行结果
   - 执行时长

### Q: 工具参数应该如何填写？

**A:** 

1. 查看工具的输入模式（Input Schema）
2. 根据模式填写参数：
   - **必需参数**: 标记为 `required` 的参数必须填写
   - **类型**: 确保参数类型正确（字符串、数字、布尔值等）
   - **格式**: 遵循描述中的格式要求

3. 参考示例：
   ```json
   {
     "path": "/workspace/file.txt",
     "encoding": "utf-8"
   }
   ```

## 组管理

### Q: 什么是组？为什么需要组？

**A:** 组是服务器的逻辑集合，用于：

1. **组织服务器**: 将相关服务器分组管理
2. **访问控制**: 限制特定组可用的工具
3. **独立端点**: 每个组有独立的 MCP 端点
4. **权限管理**: 使用验证密钥控制访问

### Q: 如何创建组？

**A:** 

1. 进入组管理页面
2. 点击"创建组"
3. 填写组信息：
   - **组 ID**: 唯一标识符（用于 URL）
   - **名称**: 显示名称
   - **描述**: 组的用途说明
4. 选择成员服务器
5. 配置工具过滤（可选）
6. 设置验证密钥（可选）
7. 保存

### Q: 组的端点 URL 是什么？

**A:** 每个组都有专用的 MCP 端点：

```
http://your-domain.com/:groupId/mcp
```

例如：
- `development` 组: `http://localhost:3000/development/mcp`
- `production` 组: `http://localhost:3000/production/mcp`

### Q: 如何限制组可用的工具？

**A:** 

1. 编辑组配置
2. 在"工具过滤"部分：
   - 选择"自定义工具列表"
   - 从可用工具中选择允许的工具
3. 保存配置

只有选中的工具才能通过该组的端点访问。

### Q: 验证密钥是如何工作的？

**A:** 

1. 为组设置验证密钥
2. 客户端访问组端点时需要提供密钥：
   ```bash
   curl -X POST http://localhost:3000/development/mcp/call_tool \
     -H "X-Validation-Key: your-key" \
     -H "Content-Type: application/json" \
     -d '{"name": "read_file", "arguments": {"path": "/file.txt"}}'
   ```
3. 密钥不匹配时请求会被拒绝

### Q: 可以将一个服务器添加到多个组吗？

**A:** 可以。一个服务器可以属于多个组，每个组可以配置不同的工具过滤规则。

## API 到 MCP

### Q: 什么是 API 到 MCP 功能？

**A:** API 到 MCP 功能允许你将现有的 REST API 转换为 MCP 工具，使其可以通过 MCP 协议访问。

### Q: 如何将 API 转换为 MCP 工具？

**A:** 

1. 进入 API 到 MCP 管理页面
2. 点击"添加 API 配置"
3. 填写 API 信息：
   - API URL
   - HTTP 方法
   - 认证信息
4. 配置参数映射：
   - MCP 工具参数 → API 参数
5. 测试 API 配置
6. 保存，系统会自动生成 MCP 工具

### Q: 参数映射如何配置？

**A:** 参数映射定义了 MCP 工具参数如何转换为 API 参数：

```json
{
  "parameters": {
    "city": {
      "type": "string",
      "required": true,
      "mapping": {
        "target": "query",  // query, path, body, header
        "name": "q"         // API 参数名
      }
    }
  }
}
```

支持的映射目标：
- `query`: URL 查询参数
- `path`: URL 路径参数
- `body`: 请求体参数
- `header`: 请求头

### Q: API 配置测试失败怎么办？

**A:** 检查：

1. **API URL 是否可访问**: 使用 curl 或 Postman 测试
2. **认证信息是否正确**: 验证 API 密钥或令牌
3. **参数映射是否正确**: 检查参数名称和类型
4. **网络连接**: 确保服务器可以访问外部 API

查看测试结果中的详细错误信息进行诊断。

### Q: 如何处理 API 认证？

**A:** 支持多种认证方式：

1. **Bearer Token**:
   ```json
   {
     "auth": {
       "type": "bearer",
       "token": "your-token"
     }
   }
   ```

2. **API Key**:
   ```json
   {
     "auth": {
       "type": "apiKey",
       "key": "X-API-Key",
       "value": "your-key"
     }
   }
   ```

3. **Basic Auth**:
   ```json
   {
     "auth": {
       "type": "basic",
       "username": "user",
       "password": "pass"
     }
   }
   ```

### Q: 生成的 MCP 工具在哪里？

**A:** 生成的工具会自动添加到系统中：

1. 在工具列表中查找
2. 工具名称为配置中指定的 `toolName`
3. 可以像其他工具一样使用和测试

## 性能和优化

### Q: 系统响应慢怎么办？

**A:** 优化建议：

1. **减少实时监控频率**:
   ```json
   {
     "monitoring": {
       "updateInterval": 5000  // 增加到 5 秒
     }
   }
   ```

2. **限制日志和历史记录**:
   - 定期清理旧日志
   - 减少保留的历史记录数量

3. **优化服务器连接**:
   - 关闭不需要的服务器
   - 使用连接池

4. **启用缓存**:
   - 缓存工具列表
   - 缓存配置数据

### Q: 内存使用过高怎么办？

**A:** 

1. **检查内存使用**:
   ```bash
   pm2 monit
   ```

2. **增加 Node.js 内存限制**:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" pm2 restart mcp-hub-api
   ```

3. **定期重启服务**:
   ```bash
   # 每天凌晨 3 点重启
   0 3 * * * pm2 restart mcp-hub-api
   ```

4. **检查内存泄漏**:
   - 使用 Node.js 性能分析工具
   - 查看日志中的异常

### Q: 如何提高并发处理能力？

**A:** 

1. **使用集群模式**:
   ```bash
   pm2 start dist/src/index.js -i max
   ```

2. **配置负载均衡**:
   - 使用 Nginx 负载均衡
   - 部署多个后端实例

3. **优化数据库查询**:
   - 添加索引
   - 使用缓存

4. **启用 HTTP/2**:
   - 在 Nginx 中启用 HTTP/2
   - 减少连接开销

### Q: 如何监控系统性能？

**A:** 

1. **使用内置监控**:
   - 仪表板性能指标
   - 实时监控图表

2. **使用 PM2 监控**:
   ```bash
   pm2 monit
   pm2 status
   ```

3. **集成外部监控**:
   - Prometheus + Grafana
   - New Relic
   - Datadog

## 故障排除

### Q: 服务无法启动？

**A:** 检查：

1. **端口是否被占用**:
   ```bash
   lsof -i :3000
   # 如果被占用，杀死进程或使用其他端口
   ```

2. **配置文件是否有效**:
   ```bash
   # 验证 JSON 格式
   cat backend/config/system.json | jq .
   ```

3. **依赖是否完整**:
   ```bash
   pnpm install
   ```

4. **查看错误日志**:
   ```bash
   pm2 logs mcp-hub-api --lines 100
   ```

### Q: 前端无法连接到后端？

**A:** 检查：

1. **后端是否运行**:
   ```bash
   curl http://localhost:3000/health
   ```

2. **CORS 配置**:
   - 确保后端允许前端域名
   - 检查 `system.json` 中的 CORS 设置

3. **代理配置**:
   - 检查前端的 API 代理配置
   - 验证 Nginx 配置

4. **防火墙**:
   - 确保端口未被防火墙阻止

### Q: 数据丢失怎么办？

**A:** 

1. **从备份恢复**:
   ```bash
   ./restore.sh /backup/mcp-hub/config_latest.tar.gz
   ```

2. **检查配置历史**:
   - 在 Web 界面查看配置历史
   - 恢复到之前的版本

3. **重建配置**:
   - 如果没有备份，需要手动重建
   - 参考文档重新配置

### Q: SSL 证书错误？

**A:** 

1. **检查证书有效期**:
   ```bash
   openssl x509 -in /etc/ssl/certs/mcp-hub.crt -noout -dates
   ```

2. **更新证书**:
   ```bash
   sudo certbot renew
   ```

3. **验证证书配置**:
   ```bash
   sudo nginx -t
   ```

## 安全性

### Q: 如何保护 MCP Hub 的安全？

**A:** 安全最佳实践：

1. **更改默认密码**: 立即更改 admin 密码
2. **使用 HTTPS**: 配置 SSL 证书
3. **设置防火墙**: 只开放必要的端口
4. **定期更新**: 保持系统和依赖最新
5. **备份数据**: 定期备份配置
6. **监控日志**: 定期检查安全日志
7. **限制访问**: 使用 IP 白名单或 VPN

### Q: 如何生成安全的 JWT 密钥？

**A:** 

```bash
# 生成 64 字节的随机密钥
openssl rand -base64 64

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

将生成的密钥设置为环境变量：
```bash
export JWT_SECRET="your-generated-secret"
```

### Q: 如何实施 IP 白名单？

**A:** 在 Nginx 配置中：

```nginx
# 只允许特定 IP 访问
location /api/ {
    allow 192.168.1.0/24;
    allow 10.0.0.0/8;
    deny all;
    
    proxy_pass http://mcp_hub_backend;
}
```

### Q: 如何防止暴力破解？

**A:** 

1. **实施速率限制**:
   ```json
   {
     "rateLimit": {
       "windowMs": 900000,  // 15 分钟
       "maxRequests": 5     // 最多 5 次尝试
     }
   }
   ```

2. **账户锁定**:
   - 5 次失败后锁定账户
   - 15 分钟后自动解锁

3. **使用强密码**:
   - 最小 12 字符
   - 包含大小写字母、数字和特殊字符

## 部署相关

### Q: 推荐的部署方式是什么？

**A:** 推荐使用以下方式之一：

1. **传统部署**: PM2 + Nginx（适合小型部署）
2. **Docker**: Docker Compose（适合容器化环境）
3. **Kubernetes**: 适合大规模部署和高可用

### Q: 如何实现零停机部署？

**A:** 

1. **使用 PM2 集群模式**:
   ```bash
   pm2 start dist/src/index.js -i max
   pm2 reload mcp-hub-api  # 滚动重启
   ```

2. **使用蓝绿部署**:
   - 部署新版本到新实例
   - 切换负载均衡器
   - 停止旧实例

3. **使用 Kubernetes**:
   - 配置滚动更新策略
   - 设置健康检查

### Q: 如何配置自动备份？

**A:** 

创建备份脚本并设置 cron 任务：

```bash
# 创建备份脚本
cat > /usr/local/bin/mcp-hub-backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/mcp-hub"
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /etc/mcp-hub/config
find $BACKUP_DIR -name "config_*.tar.gz" -mtime +30 -delete
EOF

chmod +x /usr/local/bin/mcp-hub-backup.sh

# 设置 cron 任务（每天凌晨 2 点）
crontab -e
0 2 * * * /usr/local/bin/mcp-hub-backup.sh
```

### Q: 如何监控生产环境？

**A:** 

1. **应用监控**: PM2 或 Kubernetes 监控
2. **日志监控**: ELK Stack 或 Loki
3. **性能监控**: Prometheus + Grafana
4. **错误追踪**: Sentry
5. **告警**: 配置告警规则和通知

### Q: 如何扩展系统容量？

**A:** 

**水平扩展**:
```bash
# 增加后端实例
pm2 scale mcp-hub-api +2
```

**垂直扩展**:
- 升级服务器 CPU 和内存
- 使用 SSD 存储
- 优化网络带宽

**数据库扩展**:
- 使用读写分离
- 实施分片策略
- 添加缓存层

## 获取更多帮助

如果以上答案没有解决你的问题：

1. **查看文档**:
   - [Web 界面使用指南](WEB_UI_GUIDE.md)
   - [API 参考文档](API_REFERENCE.md)
   - [部署指南](DEPLOYMENT.md)
   - [开发指南](DEVELOPMENT.md)
   - [故障排除指南](TROUBLESHOOTING.md)

2. **查看日志**:
   ```bash
   # 后端日志
   pm2 logs mcp-hub-api
   
   # 系统日志
   tail -f /var/log/mcp-hub/app.log
   ```

3. **使用调试工具**:
   - MCP 协议监控
   - 错误分析工具
   - 性能分析器

4. **社区支持**:
   - GitHub Issues
   - GitHub Discussions
   - Discord 服务器

5. **提交问题**:
   - 在 GitHub 上提交 Issue
   - 提供详细的错误信息和日志
   - 包含系统环境信息

## 贡献

发现文档中的错误或有改进建议？欢迎：

1. 在 GitHub 上提交 Issue
2. 提交 Pull Request 改进文档
3. 在 Discussions 中分享经验

感谢你使用 MCP Hub！
