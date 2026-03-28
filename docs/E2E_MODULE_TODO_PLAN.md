# MCP Hub 浏览器 E2E 全量模块化 TODO 与缺陷记录规范（面向 SubAgent 执行）

## 摘要
把全量功能点拆成可勾选的模块化 TODO 清单，并定义统一的错误记录与证据路径规范，支持多个 SubAgent 并行独立测试、统一汇总。

## SubAgent 分工（独立执行）
1. `SubAgent-AUTH-NAV`：认证 + 路由 + 布局导航
2. `SubAgent-DASH`：仪表板 + SSE 事件
3. `SubAgent-SRV`：服务器管理
4. `SubAgent-TOOL`：工具列表/详情/测试/执行/监控
5. `SubAgent-GRP`：组管理 + 成员 + 验证密钥
6. `SubAgent-API2MCP`：API 配置管理 + 导入导出 + 测试预览
7. `SubAgent-DEBUG`：消息监控 + 工具调试 + 性能分析 + 错误分析
8. `SubAgent-CFG`：系统配置 + 历史 + 备份恢复
9. `SubAgent-RESP`：移动端与全局行为验证
10. `SubAgent-COORD`：汇总结果、去重缺陷、生成总报告

## 执行与产物路径规范
1. 本轮执行根目录：`/Users/yourtionguo/codes/open/mcp-hub/qa/e2e/runs/<run_id>/`
2. 每个模块目录：`.../modules/<module>/`
3. 每条用例目录：`.../modules/<module>/<case_id>/`
4. 强制产物：
`result.json`、`steps.log`、`console.log`、`network.har`、`dom.html`、`screenshot.png`
5. 失败额外产物：
`error-stack.txt`、`request-response.json`、`repro.md`
6. 全局汇总：
`.../summary/module-summary.json`、`.../summary/final-report.md`、`.../summary/defects.json`

## 全量功能点 TODO（可直接打勾）

### 模块 AUTH + NAV
- [ ] `AUTH-01` 未登录访问 `/dashboard` 跳转 `/login` 且保留 redirect
- [ ] `AUTH-02` 正确账号登录成功并写入 `auth_token/refresh_token/user_info`
- [ ] `AUTH-03` 错误账号登录失败并显示错误提示
- [ ] `AUTH-04` 已登录访问 `/login` 重定向 `/dashboard`
- [ ] `AUTH-05` 401 后自动 refresh 并重试原请求
- [ ] `AUTH-06` refresh 失败后清理会话并跳转 `/login`
- [ ] `AUTH-07` 顶栏退出登录成功
- [ ] `NAV-01` 左侧菜单 7 个入口均可达
- [ ] `NAV-02` 菜单高亮与当前路由一致
- [ ] `NAV-03` 侧栏折叠/展开行为正确
- [ ] `NAV-04` 未知路由进入 404 页面并可返回

### 模块 DASHBOARD
- [ ] `DASH-01` 统计卡片加载成功
- [ ] `DASH-02` 健康状态卡片加载与刷新成功
- [ ] `DASH-03` 性能卡片加载与刷新成功
- [ ] `DASH-04` 最近活动加载成功
- [ ] `DASH-05` SSE 状态 connecting/open/closed 显示正确
- [ ] `DASH-06` 快速操作跳转 `servers/tools/groups/debug`
- [ ] `DASH-07` 页面“刷新数据”可触发全量刷新
- [ ] `DASH-08` 退出登录按钮流程正确
- [ ] `DASH-09` SSE 断开后可恢复并继续收事件

### 模块 SERVERS
- [ ] `SRV-01` 服务器列表加载、搜索、分页
- [ ] `SRV-02` 新建 stdio 服务器成功
- [ ] `SRV-03` 新建 sse 服务器成功
- [ ] `SRV-04` 新建 websocket 服务器成功
- [ ] `SRV-05` 表单校验（必填/格式/规则）正确
- [ ] `SRV-06` 配置验证接口返回并展示 errors/warnings/suggestions
- [ ] `SRV-07` 应用 suggestion 后表单值更新
- [ ] `SRV-08` 测试连接成功分支
- [ ] `SRV-09` 测试连接失败分支
- [ ] `SRV-10` 编辑服务器成功（ID 禁改）
- [ ] `SRV-11` 连接操作状态流转正确
- [ ] `SRV-12` 断开操作状态流转正确
- [ ] `SRV-13` 删除服务器确认框与删除结果正确
- [ ] `SRV-14` 详情抽屉展示字段正确
- [ ] `SRV-15` 定时状态刷新有效

### 模块 TOOLS
- [ ] `TOOL-01` 工具列表加载成功
- [ ] `TOOL-02` 名称/描述搜索有效
- [ ] `TOOL-03` 按服务器过滤有效
- [ ] `TOOL-04` 按状态过滤有效
- [ ] `TOOL-05` 排序字段与方向切换有效
- [ ] `TOOL-06` 列表视图/卡片视图切换正确
- [ ] `TOOL-07` 工具详情基础信息展示正确
- [ ] `TOOL-08` 参数 schema 可视化展示正确
- [ ] `TOOL-09` schema JSON 视图切换正确
- [ ] `TOOL-10` 复制 schema 成功
- [ ] `TOOL-11` 跳转测试页与执行页正确
- [ ] `TOOL-12` 参数验证通过分支
- [ ] `TOOL-13` 参数验证失败分支
- [ ] `TOOL-14` 执行成功文本结果展示
- [ ] `TOOL-15` 执行成功图片结果展示
- [ ] `TOOL-16` 执行成功资源结果展示
- [ ] `TOOL-17` 执行失败结果展示
- [ ] `TOOL-18` 结果复制成功
- [ ] `TOOL-19` 结果导出成功
- [ ] `TOOL-20` 清空结果成功
- [ ] `TOOL-21` 测试历史生成与回填成功
- [ ] `TOOL-22` 历史重跑成功
- [ ] `TOOL-23` 执行历史列表与分页正确
- [ ] `TOOL-24` 执行详情弹窗字段正确
- [ ] `TOOL-25` 重新执行流程正确
- [ ] `TOOL-26` 监控总览指标正确
- [ ] `TOOL-27` 监控自动刷新开关正确
- [ ] `TOOL-28` 性能时间范围切换正确
- [ ] `TOOL-29` 实时日志清空正确

### 模块 GROUPS
- [ ] `GRP-01` 组列表加载、搜索、分页
- [ ] `GRP-02` 创建组成功
- [ ] `GRP-03` 创建组必填校验（至少一个服务器）
- [ ] `GRP-04` 编辑组成功（ID 禁改）
- [ ] `GRP-05` 成员管理弹窗打开/关闭正确
- [ ] `GRP-06` 选择服务器生效
- [ ] `GRP-07` 工具过滤启用/禁用生效
- [ ] `GRP-08` 工具全选/清空生效
- [ ] `GRP-09` 配置预览统计正确
- [ ] `GRP-10` 保存成员配置成功
- [ ] `GRP-11` 验证密钥状态查询成功
- [ ] `GRP-12` 手动设置密钥成功
- [ ] `GRP-13` 密钥规则校验失败提示正确
- [ ] `GRP-14` 生成新密钥成功并可复制
- [ ] `GRP-15` 验证密钥成功分支
- [ ] `GRP-16` 验证密钥失败分支
- [ ] `GRP-17` 删除密钥成功
- [ ] `GRP-18` 组删除成功

### 模块 API-TO-MCP
- [ ] `API2MCP-01` 配置列表加载成功
- [ ] `API2MCP-02` 搜索条件过滤有效
- [ ] `API2MCP-03` 状态过滤有效
- [ ] `API2MCP-04` HTTP 方法过滤有效
- [ ] `API2MCP-05` 新建配置表单校验正确
- [ ] `API2MCP-06` schema 验证成功分支
- [ ] `API2MCP-07` schema 验证失败分支
- [ ] `API2MCP-08` 新建配置提交成功
- [ ] `API2MCP-09` 编辑配置提交成功
- [ ] `API2MCP-10` 单条删除成功
- [ ] `API2MCP-11` 批量删除成功
- [ ] `API2MCP-12` 导入（文件）成功
- [ ] `API2MCP-13` 导入（URL）成功
- [ ] `API2MCP-14` 导入（手动 JSON）成功
- [ ] `API2MCP-15` 导入失败提示正确
- [ ] `API2MCP-16` 导出 JSON 成功
- [ ] `API2MCP-17` 导出 YAML 成功
- [ ] `API2MCP-18` 导出 Postman 成功
- [ ] `API2MCP-19` API 测试（参数模式）成功
- [ ] `API2MCP-20` API 测试（JSON 模式）成功
- [ ] `API2MCP-21` API 测试失败提示正确
- [ ] `API2MCP-22` 工具预览生成成功
- [ ] `API2MCP-23` 复制工具定义成功

### 模块 DEBUG
- [ ] `DEBUG-01` 协议消息列表加载成功
- [ ] `DEBUG-02` 协议消息按文本筛选成功
- [ ] `DEBUG-03` 协议消息按服务器筛选成功
- [ ] `DEBUG-04` 协议消息按类型筛选成功
- [ ] `DEBUG-05` 消息详情弹窗内容正确
- [ ] `DEBUG-06` 工具调试表单执行成功
- [ ] `DEBUG-07` 工具调试执行失败分支记录正确
- [ ] `DEBUG-08` 工具调试历史回填正确
- [ ] `DEBUG-09` 性能总览指标加载正确
- [ ] `DEBUG-10` 热门工具表格展示正确
- [ ] `DEBUG-11` 性能图表渲染正确
- [ ] `DEBUG-12` 性能自动刷新启停正确
- [ ] `DEBUG-13` 错误分析统计加载正确
- [ ] `DEBUG-14` 常见错误占比展示正确
- [ ] `DEBUG-15` 最近错误详情展示正确
- [ ] `DEBUG-16` 错误建议生成合理
- [ ] `DEBUG-17` 页面清空日志按钮行为可用
- [ ] `DEBUG-18` 页面导出日志按钮行为可用

### 模块 CONFIG
- [ ] `CFG-01` system/mcp/groups 三 tab 加载正确
- [ ] `CFG-02` 搜索筛选有效
- [ ] `CFG-03` 分类筛选有效
- [ ] `CFG-04` 高级开关联动正确
- [ ] `CFG-05` 重置筛选恢复默认
- [ ] `CFG-06` 配置修改后 dirty 状态正确
- [ ] `CFG-07` 保存配置确认框正确
- [ ] `CFG-08` 保存配置成功并刷新
- [ ] `CFG-09` 配置验证流程成功
- [ ] `CFG-10` 配置测试流程成功
- [ ] `CFG-11` 配置预览流程成功
- [ ] `CFG-12` 配置验证/测试/预览失败提示正确
- [ ] `CFG-13` 历史记录加载成功
- [ ] `CFG-14` 历史记录加载更多成功
- [ ] `CFG-15` 备份列表加载成功
- [ ] `CFG-16` 创建备份成功
- [ ] `CFG-17` 备份恢复确认流程正确
- [ ] `CFG-18` 备份恢复成功并回读一致
- [ ] `CFG-19` 备份恢复失败提示正确

### 模块 全局 + 响应式
- [ ] `GLB-01` 全局 loading 在异步请求期间正确显示/隐藏
- [ ] `GLB-02` 主题切换可用
- [ ] `GLB-03` 顶栏全屏按钮可用
- [ ] `GLB-04` 页面标题随路由变更
- [ ] `GLB-05` 关键页面移动端布局可操作（登录/列表/表单/弹窗）
- [ ] `GLB-06` 异常后页面可继续操作，无白屏

## 缺陷记录规范（必须）
1. 缺陷文件路径：`/Users/yourtionguo/codes/open/mcp-hub/qa/e2e/runs/<run_id>/defects/<defect_id>.json`
2. 缺陷最小字段：
`defect_id/module/case_id/title/severity/environment/url/steps_to_reproduce/expected/actual/root_cause_guess/status/owner`
3. 日志与证据字段：
`console_log_path/network_har_path/screenshot_path/dom_snapshot_path/video_path/request_response_path`
4. 复现文档路径：`.../defects/<defect_id>.repro.md`
5. 每个失败用例必须关联 `defect_id` 或标注 `known_issue_id`

## 执行阶段与验收
1. 阶段1：SubAgent 并行跑各模块 TODO，逐项打勾。
2. 阶段2：`SubAgent-COORD` 合并结果并去重缺陷。
3. 阶段3：回归重跑全部失败与阻塞用例。
4. 验收标准：
`P0 关键链路 100% 通过`、`全量 TODO 覆盖率 100%`、`失败项都有完整证据路径`。

## 假设与默认
1. 使用真实后端与真实配置执行。
2. 不修改业务接口，只补充测试侧清单与日志规范。
3. AI 自主探索主导，但每条结论必须可复现且有证据文件。
4. 以上 TODO 为本轮完整基线，后续增量需求在同目录追加新 case_id。
