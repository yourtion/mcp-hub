# Implementation Plan

- [x] 1. 创建核心包基础结构
  - 创建 `packages/core` 目录和基本包配置
  - 设置TypeScript配置和构建脚本
  - 定义核心包的导出接口
  - _Requirements: 2.1, 3.1_

- [x] 2. 抽取和重构MCP核心服务逻辑
- [x] 2.1 创建核心MCP服务管理器
  - 从现有 `mcp_service.ts` 抽取核心逻辑到 `packages/core/src/services/mcp/service-manager.ts`
  - 实现 `McpServiceManager` 接口，包含服务注册和工具调用功能
  - 编写单元测试验证服务管理器功能
  - _Requirements: 2.1, 3.3_

- [x] 2.2 创建服务器连接管理器
  - 从现有 `server_manager.ts` 抽取逻辑到 `packages/core/src/services/server/connection-manager.ts`
  - 实现连接池管理和服务器状态监控
  - 编写连接管理器的单元测试
  - _Requirements: 2.1, 3.3_

- [x] 2.3 创建工具注册和管理系统
  - 从现有 `tool_manager.ts` 抽取逻辑到 `packages/core/src/services/tool/tool-registry.ts`
  - 实现工具发现、注册和调用功能
  - 编写工具管理系统的单元测试
  - _Requirements: 2.1, 3.3_

- [x] 2.4 创建配置处理器
  - 实现 `SharedConfigProcessor` 用于处理 `mcp_service.json` 配置
  - 从现有配置逻辑中抽取通用配置处理功能
  - 编写配置处理器的单元测试和验证逻辑
  - _Requirements: 2.1, 3.3_

- [x] 3. 重构API包以使用核心包
- [x] 3.1 更新API包依赖和导入
  - 修改 `backend/package.json` 添加对 `@mcp-core/mcp-hub-core` 的依赖
  - 更新现有服务文件的导入语句使用核心包
  - 移除已迁移到核心包的重复代码
  - _Requirements: 3.1, 4.1_

- [x] 3.2 实现组特定MCP路由
  - 创建 `backend/src/api/mcp/group-router.ts` 处理 `/:group/mcp` 路由
  - 实现 `GroupMcpService` 包装器使用核心包功能
  - 添加组验证和权限检查中间件
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3.3 更新现有MCP端点
  - 修改 `backend/src/mcp.ts` 使用核心包的服务管理器
  - 保持现有 `/mcp` 端点的完全向后兼容性
  - 添加管理和调试功能的增强
  - _Requirements: 1.5, 4.1, 4.2_

- [x] 3.4 创建组管理API端点
  - 实现 `backend/src/api/groups/` 下的组管理端点
  - 提供组列表、组详情、组健康检查等API
  - 编写组管理API的集成测试
  - _Requirements: 1.4, 3.3_

- [x] 4. 创建CLI包
- [x] 4.1 设置CLI包基础结构
  - 创建 `packages/cli` 目录和包配置
  - 设置CLI可执行文件和入口点
  - 配置TypeScript和构建脚本
  - _Requirements: 2.1, 2.2_

- [x] 4.2 实现CLI MCP服务器核心功能
  - 创建 `CliMcpServer` 使用核心包的 `McpServiceManager`
  - 实现StdioServerTransport的MCP服务器
  - 编写CLI MCP服务器的单元测试
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 4.3 实现MCP协议处理
  - 实现 `list_tools` MCP协议请求处理
  - 实现 `call_tool` MCP协议请求处理
  - 实现MCP协议错误处理和响应格式化
  - _Requirements: 2.3, 2.4_

- [x] 4.4 实现CLI配置和启动
  - 实现配置文件加载和验证
  - 创建CLI可执行入口点
  - 添加启动参数和配置选项
  - _Requirements: 2.4, 2.5_

- [x] 4.5 添加CLI配置管理
  - 实现CLI特定的配置文件处理
  - 支持配置文件模板生成
  - 添加配置验证和错误处理
  - _Requirements: 2.4, 2.6_

- [ ] 5. 完善错误处理和日志系统
- [ ] 5.1 实现统一错误处理框架
  - 创建 `ErrorHandler` 接口和实现类
  - 定义错误代码和中文错误信息
  - 实现错误重试和降级机制
  - _Requirements: 3.3, 2.6_

- [ ] 5.2 增强日志系统
  - 为核心包添加结构化日志记录
  - 为CLI添加可配置的日志级别
  - 实现日志文件轮转和清理
  - _Requirements: 3.3_

- [ ] 5.3 添加性能监控
  - 实现请求响应时间监控
  - 添加内存和CPU使用监控
  - 创建性能指标收集和报告
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 6. 编写全面的测试套件
- [ ] 6.1 完善单元测试
  - 为所有核心包组件编写单元测试
  - 为API包的新功能编写单元测试
  - 为CLI包的所有功能编写单元测试
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 6.2 编写集成测试
  - 创建组路由功能的集成测试
  - 创建CLI与核心包交互的集成测试
  - 创建API端点的完整集成测试
  - _Requirements: 3.1, 3.2_

- [ ] 6.3 编写端到端测试
  - 创建完整的用户场景测试
  - 测试向后兼容性场景
  - 测试错误处理和恢复场景
  - _Requirements: 3.2, 4.1, 4.3_

- [ ] 6.4 设置测试覆盖率监控
  - 配置测试覆盖率报告生成
  - 设置覆盖率阈值检查
  - 集成到CI/CD流程中
  - _Requirements: 3.1, 3.2_

- [ ] 7. 更新文档和配置
- [ ] 7.1 更新项目文档
  - 更新README文件说明新的包结构
  - 创建CLI使用指南和示例
  - 编写组路由功能的使用文档
  - _Requirements: 4.4_

- [ ] 7.2 更新构建和部署配置
  - 更新根目录的构建脚本
  - 配置新包的发布流程
  - 更新Docker配置（如果存在）
  - _Requirements: 3.1_

- [ ] 7.3 创建迁移指南
  - 编写从旧版本升级的指南
  - 提供配置迁移示例
  - 创建常见问题解答文档
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 8. 性能优化和最终测试
- [ ] 8.1 性能优化
  - 优化核心包的启动时间
  - 优化API响应时间
  - 优化CLI命令执行速度
  - _Requirements: 5.1, 5.2_

- [ ] 8.2 最终集成测试
  - 运行完整的测试套件
  - 验证所有功能的正确性
  - 检查性能指标是否满足要求
  - _Requirements: 3.2, 5.3_

- [ ] 8.3 部署验证
  - 在测试环境中部署完整系统
  - 验证向后兼容性
  - 进行负载测试和压力测试
  - _Requirements: 4.1, 4.3, 5.3_