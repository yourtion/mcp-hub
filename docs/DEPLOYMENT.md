# MCP Hub 部署指南

本指南介绍如何在生产环境中部署 MCP Hub。

## 目录

- [部署架构](#部署架构)
- [环境要求](#环境要求)
- [部署方式](#部署方式)
- [配置管理](#配置管理)
- [安全加固](#安全加固)
- [监控和日志](#监控和日志)
- [备份和恢复](#备份和恢复)
- [性能优化](#性能优化)
- [故障排除](#故障排除)

## 部署架构

### 推荐架构

```
┌─────────────────┐
│   Load Balancer │
│    (Nginx)      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│ API 1 │ │ API 2 │  (后端实例)
└───┬───┘ └──┬────┘
    │        │
    └────┬───┘
         │
┌────────▼────────┐
│  Static Files   │  (前端静态文件)
│    (Nginx)      │
└─────────────────┘
```

### 组件说明

1. **负载均衡器**: Nginx 或其他反向代理
2. **后端 API**: Node.js 应用（可多实例）
3. **前端静态文件**: 构建后的 Vue.js 应用
4. **配置存储**: JSON 文件或数据库
5. **日志系统**: 集中式日志收集

## 环境要求

### 硬件要求

**最小配置**:
- CPU: 2 核心
- 内存: 2GB RAM
- 存储: 10GB 可用空间

**推荐配置**:
- CPU: 4 核心
- 内存: 4GB RAM
- 存储: 20GB 可用空间（SSD）

### 软件要求

- **Node.js**: 18.x 或更高版本
- **pnpm**: 8.x 或更高版本
- **操作系统**: Linux (Ubuntu 20.04+, CentOS 8+) 或 macOS
- **反向代理**: Nginx 1.18+ 或 Apache 2.4+
- **进程管理**: PM2 或 systemd

### 网络要求

- **端口**: 
  - 3000 (后端 API，内部)
  - 80/443 (HTTP/HTTPS，外部)
- **防火墙**: 允许必要的入站和出站连接
- **域名**: 推荐使用域名和 SSL 证书

## 部署方式

### 方式 1: 传统部署

#### 1. 准备服务器

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 pnpm
npm install -g pnpm

# 安装 PM2
npm install -g pm2
```

#### 2. 部署应用

```bash
# 克隆代码
git clone https://github.com/your-org/mcp-hub.git
cd mcp-hub

# 安装依赖
pnpm install --frozen-lockfile

# 构建所有包
pnpm build:production
```

#### 3. 配置环境变量

创建 `.env` 文件：

```bash
# 后端配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# 日志配置
LOG_LEVEL=info
LOG_FILE=/var/log/mcp-hub/app.log

# 配置文件路径
CONFIG_DIR=/etc/mcp-hub/config
```

#### 4. 配置生产环境

```bash
# 创建配置目录
sudo mkdir -p /etc/mcp-hub/config
sudo mkdir -p /var/log/mcp-hub

# 复制配置文件
sudo cp backend/config/*.json /etc/mcp-hub/config/

# 设置权限
sudo chown -R $USER:$USER /etc/mcp-hub
sudo chown -R $USER:$USER /var/log/mcp-hub
```

#### 5. 启动服务

使用 PM2 管理进程：

```bash
# 启动后端
cd backend
pm2 start dist/src/index.js --name mcp-hub-api

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

#### 6. 配置 Nginx

创建 Nginx 配置文件 `/etc/nginx/sites-available/mcp-hub`:

```nginx
# 后端 API 上游
upstream mcp_hub_backend {
    server 127.0.0.1:3000;
    # 如果有多个实例，添加更多服务器
    # server 127.0.0.1:3001;
    # server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name mcp-hub.example.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mcp-hub.example.com;

    # SSL 证书配置
    ssl_certificate /etc/ssl/certs/mcp-hub.crt;
    ssl_certificate_key /etc/ssl/private/mcp-hub.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 安全头部
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 前端静态文件
    location / {
        root /var/www/mcp-hub/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API 代理
    location /api/ {
        proxy_pass http://mcp_hub_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # MCP 端点代理
    location /mcp/ {
        proxy_pass http://mcp_hub_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # SSE 事件流
    location /api/events {
        proxy_pass http://mcp_hub_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }

    # 健康检查
    location /health {
        proxy_pass http://mcp_hub_backend;
        access_log off;
    }
}
```

启用配置：

```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/mcp-hub /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 方式 2: Docker 部署

#### 1. 构建 Docker 镜像

项目已包含 Dockerfile，直接构建：

```bash
# 构建后端镜像
docker build -t mcp-hub-api:latest -f backend/Dockerfile .

# 构建前端镜像
docker build -t mcp-hub-web:latest -f frontend/Dockerfile .
```

#### 2. 使用 Docker Compose

创建 `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  api:
    image: mcp-hub-api:latest
    container_name: mcp-hub-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - JWT_SECRET=${JWT_SECRET}
      - JWT_EXPIRES_IN=1h
      - JWT_REFRESH_EXPIRES_IN=7d
    volumes:
      - ./config:/app/config
      - ./logs:/app/logs
    networks:
      - mcp-hub-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  web:
    image: mcp-hub-web:latest
    container_name: mcp-hub-web
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl:ro
    depends_on:
      - api
    networks:
      - mcp-hub-network

networks:
  mcp-hub-network:
    driver: bridge
```

启动服务：

```bash
# 设置环境变量
export JWT_SECRET="your-super-secret-jwt-key"

# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 停止服务
docker-compose -f docker-compose.prod.yml down
```

### 方式 3: Kubernetes 部署

#### 1. 创建 Kubernetes 配置

`k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-hub-api
  labels:
    app: mcp-hub-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-hub-api
  template:
    metadata:
      labels:
        app: mcp-hub-api
    spec:
      containers:
      - name: api
        image: mcp-hub-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: mcp-hub-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-hub-api-service
spec:
  selector:
    app: mcp-hub-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

部署到 Kubernetes：

```bash
# 创建 Secret
kubectl create secret generic mcp-hub-secrets \
  --from-literal=jwt-secret=your-super-secret-jwt-key

# 部署应用
kubectl apply -f k8s/deployment.yaml

# 查看状态
kubectl get pods
kubectl get services

# 查看日志
kubectl logs -f deployment/mcp-hub-api
```

## 配置管理

### 生产环境配置

#### 1. 系统配置 (`system.json`)

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "cors": {
      "origin": ["https://mcp-hub.example.com"],
      "credentials": true
    }
  },
  "auth": {
    "jwtSecret": "${JWT_SECRET}",
    "jwtExpiresIn": "1h",
    "jwtRefreshExpiresIn": "7d",
    "bcryptRounds": 10,
    "maxLoginAttempts": 5,
    "lockoutDuration": 900000
  },
  "logging": {
    "level": "info",
    "file": "/var/log/mcp-hub/app.log",
    "maxFiles": 10,
    "maxSize": "10m"
  },
  "monitoring": {
    "enabled": true,
    "metricsInterval": 60000,
    "healthCheckInterval": 30000
  },
  "rateLimit": {
    "windowMs": 60000,
    "maxRequests": 100
  }
}
```

#### 2. 用户配置

生产环境中修改默认密码：

```bash
# 生成密码哈希
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your-strong-password', 10));"

# 更新配置文件中的密码哈希
```

#### 3. 环境变量

使用环境变量管理敏感信息：

```bash
# .env.production
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this
DATABASE_URL=postgresql://user:pass@localhost:5432/mcp_hub
API_KEY=your-api-key
```

加载环境变量：

```bash
# 使用 dotenv
npm install dotenv

# 在应用启动时加载
require('dotenv').config({ path: '.env.production' });
```

## 安全加固

### 1. HTTPS 配置

使用 Let's Encrypt 获取免费 SSL 证书：

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d mcp-hub.example.com

# 自动续期
sudo certbot renew --dry-run
```

### 2. 防火墙配置

```bash
# 使用 UFW
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# 或使用 iptables
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -j DROP
```

### 3. 应用安全

**JWT 密钥管理**:
```bash
# 生成强随机密钥
openssl rand -base64 64
```

**密码策略**:
- 最小长度: 12 字符
- 包含大小写字母、数字和特殊字符
- 定期更换密码
- 使用密码管理器

**访问控制**:
- 实施最小权限原则
- 使用角色基础访问控制 (RBAC)
- 定期审计用户权限

### 4. 安全头部

在 Nginx 配置中添加安全头部：

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
```

### 5. 速率限制

在应用层实施速率限制：

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 限制 100 个请求
  message: '请求过于频繁，请稍后再试'
});

app.use('/api/', limiter);
```

## 监控和日志

### 1. 应用监控

使用 PM2 监控：

```bash
# 查看进程状态
pm2 status

# 查看详细信息
pm2 show mcp-hub-api

# 查看实时日志
pm2 logs mcp-hub-api

# 查看监控面板
pm2 monit
```

### 2. 日志管理

配置日志轮转：

```bash
# 创建 logrotate 配置
sudo nano /etc/logrotate.d/mcp-hub
```

```
/var/log/mcp-hub/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 mcp-hub mcp-hub
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 3. 性能监控

使用 Prometheus 和 Grafana：

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'mcp-hub'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
```

### 4. 错误追踪

集成 Sentry 进行错误追踪：

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production",
  tracesSampleRate: 1.0,
});
```

## 备份和恢复

### 1. 配置备份

自动备份脚本：

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/mcp-hub"
DATE=$(date +%Y%m%d_%H%M%S)
CONFIG_DIR="/etc/mcp-hub/config"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份配置文件
tar -czf $BACKUP_DIR/config_$DATE.tar.gz $CONFIG_DIR

# 保留最近 30 天的备份
find $BACKUP_DIR -name "config_*.tar.gz" -mtime +30 -delete

echo "备份完成: config_$DATE.tar.gz"
```

设置定时任务：

```bash
# 编辑 crontab
crontab -e

# 每天凌晨 2 点执行备份
0 2 * * * /path/to/backup.sh
```

### 2. 数据恢复

从备份恢复：

```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1
CONFIG_DIR="/etc/mcp-hub/config"

if [ -z "$BACKUP_FILE" ]; then
    echo "用法: ./restore.sh <backup_file>"
    exit 1
fi

# 停止服务
pm2 stop mcp-hub-api

# 备份当前配置
cp -r $CONFIG_DIR ${CONFIG_DIR}.backup

# 恢复配置
tar -xzf $BACKUP_FILE -C /

# 重启服务
pm2 start mcp-hub-api

echo "恢复完成"
```

## 性能优化

### 1. Node.js 优化

```bash
# 增加内存限制
NODE_OPTIONS="--max-old-space-size=4096" pm2 start dist/src/index.js

# 启用集群模式
pm2 start dist/src/index.js -i max
```

### 2. Nginx 优化

```nginx
# 启用 gzip 压缩
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

# 启用缓存
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=mcp_cache:10m max_size=1g inactive=60m;
proxy_cache mcp_cache;
proxy_cache_valid 200 60m;
proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;

# 连接优化
keepalive_timeout 65;
keepalive_requests 100;
```

### 3. 数据库优化

如果使用数据库：

```sql
-- 创建索引
CREATE INDEX idx_server_status ON servers(status);
CREATE INDEX idx_tool_name ON tools(name);
CREATE INDEX idx_execution_timestamp ON executions(timestamp);

-- 定期清理旧数据
DELETE FROM executions WHERE timestamp < NOW() - INTERVAL '30 days';
```

### 4. 缓存策略

实施多层缓存：

```typescript
// 内存缓存
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 600 });

// Redis 缓存
import Redis from 'ioredis';
const redis = new Redis({
  host: 'localhost',
  port: 6379,
});
```

## 故障排除

### 常见问题

#### 1. 服务无法启动

检查日志：
```bash
pm2 logs mcp-hub-api --lines 100
```

常见原因：
- 端口被占用
- 配置文件错误
- 权限问题
- 依赖缺失

#### 2. 内存泄漏

监控内存使用：
```bash
pm2 monit
```

解决方案：
- 定期重启服务
- 检查代码中的内存泄漏
- 增加内存限制

#### 3. 性能下降

分析性能：
```bash
# 使用 Node.js 性能分析
node --prof dist/src/index.js

# 生成报告
node --prof-process isolate-*.log > profile.txt
```

#### 4. SSL 证书问题

检查证书：
```bash
# 查看证书信息
openssl x509 -in /etc/ssl/certs/mcp-hub.crt -text -noout

# 测试 SSL 配置
openssl s_client -connect mcp-hub.example.com:443
```

### 紧急恢复

如果系统出现严重问题：

1. **回滚到上一个版本**:
   ```bash
   git checkout <previous-version>
   pnpm install
   pnpm build
   pm2 restart mcp-hub-api
   ```

2. **从备份恢复**:
   ```bash
   ./restore.sh /backup/mcp-hub/config_latest.tar.gz
   ```

3. **重置到默认配置**:
   ```bash
   cp backend/config/*.json.default /etc/mcp-hub/config/
   pm2 restart mcp-hub-api
   ```

## 维护计划

### 日常维护

- 检查服务状态
- 查看错误日志
- 监控资源使用
- 验证备份完成

### 每周维护

- 审查安全日志
- 更新依赖包
- 清理旧日志
- 性能分析

### 每月维护

- 系统更新
- 安全审计
- 备份测试
- 容量规划

### 季度维护

- 全面安全评估
- 灾难恢复演练
- 性能优化
- 架构审查

## 扩展和升级

### 水平扩展

添加更多后端实例：

```bash
# 启动多个实例
pm2 start dist/src/index.js -i 4 --name mcp-hub-api

# 或使用不同端口
PORT=3001 pm2 start dist/src/index.js --name mcp-hub-api-2
PORT=3002 pm2 start dist/src/index.js --name mcp-hub-api-3
```

更新 Nginx 配置：

```nginx
upstream mcp_hub_backend {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}
```

### 垂直扩展

增加服务器资源：
- 升级 CPU
- 增加内存
- 使用 SSD 存储
- 优化网络带宽

### 版本升级

安全升级流程：

1. **准备阶段**:
   ```bash
   # 备份当前版本
   ./backup.sh
   
   # 在测试环境验证新版本
   ```

2. **升级阶段**:
   ```bash
   # 拉取新版本
   git pull origin main
   
   # 安装依赖
   pnpm install
   
   # 构建
   pnpm build
   ```

3. **部署阶段**:
   ```bash
   # 滚动更新（零停机）
   pm2 reload mcp-hub-api
   
   # 或重启
   pm2 restart mcp-hub-api
   ```

4. **验证阶段**:
   ```bash
   # 检查服务状态
   pm2 status
   
   # 查看日志
   pm2 logs mcp-hub-api --lines 50
   
   # 测试关键功能
   curl https://mcp-hub.example.com/health
   ```

## 相关文档

- [Web 界面使用指南](WEB_UI_GUIDE.md)
- [API 参考文档](API_REFERENCE.md)
- [故障排除指南](TROUBLESHOOTING.md)
- [开发指南](../README.md)
