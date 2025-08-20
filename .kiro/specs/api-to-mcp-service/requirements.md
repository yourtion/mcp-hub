# 需求文档

## 介绍

本文档定义了API接口转化为MCP服务的功能需求。该功能允许用户通过配置API接口的详细信息（包括URL、请求方式、参数、响应处理等），动态创建MCP工具，从而将任意REST API转换为可通过MCP协议访问的工具。

## 需求

### 需求 1: API配置管理

**用户故事:** 作为MCP Hub用户，我希望能够通过配置文件定义API接口信息，以便将外部API转换为MCP工具。

#### 验收标准

1. WHEN 用户创建API配置 THEN 系统 SHALL 支持配置API接口地址、请求方式、请求头、参数schema和响应处理规则
2. WHEN 用户配置API参数 THEN 系统 SHALL 支持使用JSON Schema定义参数结构和验证规则
3. WHEN 用户配置请求模板 THEN 系统 SHALL 支持在URL、请求头和请求体中使用 `{{data.xxx}}` 占位符进行参数替换
4. WHEN 用户配置响应处理 THEN 系统 SHALL 支持使用JSONata语法对API响应进行数据转换和提取
5. WHEN 用户定义MCP工具信息 THEN 系统 SHALL 要求提供MCP名称、唯一ID、描述和参数定义
6. WHEN 配置文件被修改 THEN 系统 SHALL 自动重新加载并更新相应的MCP工具

### 需求 2: 动态MCP工具生成

**用户故事:** 作为MCP客户端，我希望能够发现和调用基于API配置生成的MCP工具，就像使用原生MCP工具一样。

#### 验收标准

1. WHEN MCP客户端请求工具列表 THEN 系统 SHALL 包含所有基于API配置生成的工具
2. WHEN MCP客户端调用API生成的工具 THEN 系统 SHALL 根据配置的参数schema验证输入参数
3. WHEN 系统执行API调用 THEN 系统 SHALL 使用配置的请求模板和参数进行HTTP请求
4. WHEN API返回响应 THEN 系统 SHALL 使用配置的JSONata规则处理响应数据
5. WHEN API调用成功 THEN 系统 SHALL 返回标准MCP工具响应格式
6. WHEN API调用失败 THEN 系统 SHALL 返回包含错误信息的MCP错误响应

### 需求 3: 参数模板和数据绑定

**用户故事:** 作为API配置者，我希望能够灵活地将MCP工具参数映射到API请求的各个部分，以支持复杂的API调用场景。

#### 验收标准

1. WHEN 配置URL模板 THEN 系统 SHALL 支持在路径中使用 `{{data.xxx}}` 占位符替换路径参数
2. WHEN 配置请求头模板 THEN 系统 SHALL 支持在请求头值中使用参数占位符
3. WHEN 配置查询参数 THEN 系统 SHALL 支持将MCP参数映射为URL查询参数
4. WHEN 配置请求体 THEN 系统 SHALL 支持JSON格式的请求体模板和参数替换
5. WHEN 参数包含嵌套对象 THEN 系统 SHALL 支持使用点号语法访问嵌套属性（如 `{{data.user.name}}`）
6. WHEN 参数值为空或未定义 THEN 系统 SHALL 提供默认值处理机制

### 需求 4: 响应数据处理

**用户故事:** 作为API配置者，我希望能够使用JSONata语法对API响应进行灵活的数据转换和提取，以返回结构化的结果。

#### 验收标准

1. WHEN 配置JSONata表达式 THEN 系统 SHALL 支持完整的JSONata语法进行数据转换
2. WHEN API返回JSON响应 THEN 系统 SHALL 应用JSONata表达式处理响应数据
3. WHEN API返回非JSON响应 THEN 系统 SHALL 支持将响应作为字符串处理
4. WHEN JSONata表达式执行失败 THEN 系统 SHALL 返回原始响应数据和错误信息
5. WHEN 未配置JSONata表达式 THEN 系统 SHALL 返回原始API响应
6. WHEN 需要复杂数据转换 THEN 系统 SHALL 支持JSONata的聚合、过滤和计算功能

### 需求 5: 配置验证和错误处理

**用户故事:** 作为系统管理员，我希望系统能够验证API配置的正确性，并提供清晰的错误信息，以确保配置的可靠性。

#### 验收标准

1. WHEN 加载API配置 THEN 系统 SHALL 验证配置文件的JSON格式和必需字段
2. WHEN 验证参数schema THEN 系统 SHALL 确保JSON Schema格式的正确性
3. WHEN 验证JSONata表达式 THEN 系统 SHALL 检查语法的有效性
4. WHEN 发现配置错误 THEN 系统 SHALL 提供详细的错误位置和修复建议
5. WHEN API调用超时 THEN 系统 SHALL 返回超时错误并支持配置超时时间
6. WHEN API返回错误状态码 THEN 系统 SHALL 将HTTP错误转换为MCP错误响应

### 需求 6: 安全和权限控制

**用户故事:** 作为安全管理员，我希望API转MCP功能具有适当的安全控制，以防止未授权访问和恶意使用。

#### 验收标准

1. WHEN 配置API认证 THEN 系统 SHALL 支持Bearer Token、API Key和Basic Auth等认证方式
2. WHEN 存储敏感信息 THEN 系统 SHALL 支持环境变量引用避免明文存储
3. WHEN 限制API访问 THEN 系统 SHALL 支持配置允许的域名白名单
4. WHEN 监控API使用 THEN 系统 SHALL 记录API调用日志包含请求和响应信息
5. WHEN 检测异常调用 THEN 系统 SHALL 支持频率限制和异常检测
6. WHEN 处理敏感数据 THEN 系统 SHALL 支持在日志中屏蔽敏感字段

### 需求 7: 性能和可扩展性

**用户故事:** 作为系统用户，我希望API转MCP功能具有良好的性能表现，能够处理大量并发请求。

#### 验收标准

1. WHEN 处理并发API调用 THEN 系统 SHALL 支持连接池和请求复用
2. WHEN API响应较慢 THEN 系统 SHALL 支持配置请求超时和重试机制
3. WHEN 缓存API响应 THEN 系统 SHALL 支持基于TTL的响应缓存（可选）
4. WHEN 监控性能 THEN 系统 SHALL 提供API调用时间和成功率统计
5. WHEN 系统负载较高 THEN 系统 SHALL 支持请求队列和限流机制
6. WHEN 扩展配置数量 THEN 系统 SHALL 支持大量API配置的高效管理