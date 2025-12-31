# Timeline 时间轴

垂直或水平展示一系列时间节点，用于记录事件流程、历史轨迹等。

## 基本用法

最基础的用法，垂直方向展示时间轴。

```vue
<template>
  <Timeline
    :items="timelineItems"
    direction="vertical"
    mode="left"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Timeline } from '@/design-system';

const timelineItems = ref([
  {
    time: '2024-01-01 10:00',
    title: '项目启动',
    description: '项目正式启动，完成需求分析',
    status: 'success',
    icon: 'check-circle',
  },
  {
    time: '2024-01-15 14:30',
    title: '设计完成',
    description: '完成UI/UX设计，进入开发阶段',
    status: 'info',
    icon: 'info-circle',
  },
  {
    time: '2024-02-01 09:00',
    title: '开发中',
    description: '正在进行核心功能开发',
    status: 'warning',
    icon: 'time',
  },
]);
</script>
```

## 水平时间轴

设置 `direction` 为 `horizontal` 可展示水平时间轴。

```vue
<template>
  <Timeline
    :items="timelineItems"
    direction="horizontal"
    mode="left"
  />
</template>
```

## 时间轴模式

通过 `mode` 属性控制时间轴内容的显示位置。

- `left`: 内容显示在时间轴线右侧（或下侧）
- `right`: 内容显示在时间轴线左侧（或上侧）
- `alternate`: 内容交替显示在时间轴两侧

```vue
<template>
  <Timeline
    :items="timelineItems"
    mode="alternate"
  />
</template>
```

## 自定义图标

可以通过 `icon` 属性自定义时间轴节点的图标。

```vue
<template>
  <Timeline
    :items="[
      {
        time: '2024-01-01',
        title: '成功',
        icon: 'check-circle',
      },
      {
        time: '2024-01-02',
        title: '错误',
        icon: 'close-circle',
      },
      {
        time: '2024-01-03',
        title: '警告',
        icon: 'error-circle',
      },
    ]"
  />
</template>
```

## 预设图标

支持使用字符串引用预设图标：

- `check-circle` - 成功图标
- `close-circle` - 错误图标
- `error-circle` - 警告图标
- `info-circle` - 信息图标
- `time` - 时间图标
- `check` - 勾选图标
- `close` - 关闭图标
- `circle` - 圆点图标

## API

### Props

| 参数 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| items | 时间轴数据 | `TimelineItem[]` | `[]` (必填) |
| direction | 时间轴方向 | `'vertical' \| 'horizontal'` | `'vertical'` |
| mode | 时间轴模式 | `'left' \| 'right' \| 'alternate'` | `'left'` |

### TimelineItem 类型

| 参数 | 说明 | 类型 | 必填 |
|------|------|------|------|
| time | 时间标签 | `string` | 是 |
| title | 标题 | `string` | 是 |
| description | 描述信息 | `string` | 否 |
| icon | 图标 | `string \| Component` | 否 |
| color | 自定义颜色 | `string` | 否 |
| status | 状态类型 | `'success' \| 'error' \| 'warning' \| 'info' \| 'default'` | 否 |
| extra | 额外内容插槽 | `Component` | 否 |

### status 状态值

| 值 | 说明 | 颜色 |
|----|------|------|
| `success` | 成功状态 | 绿色 |
| `error` | 错误状态 | 红色 |
| `warning` | 警告状态 | 橙色 |
| `info` | 信息状态 | 蓝色 |
| `default` | 默认状态 | 灰色 |

## 设计规范

### 何时使用

- 展示一系列时间节点的事件流程
- 记录操作日志或历史轨迹
- 展示项目进度或里程碑
- 追踪系统事件或调试信息

### 使用场景

- **操作日志**: 展示用户的操作历史记录
- **审批流程**: 展示多级审批的流程进度
- **版本历史**: 展示产品或文档的版本迭代
- **事件追踪**: 追踪系统事件或错误日志
- **项目进度**: 展示项目里程碑和进度节点

### 最佳实践

1. **时间格式**: 保持时间格式统一，推荐使用 `YYYY-MM-DD HH:mm` 格式
2. **内容长度**: 标题建议不超过20字，描述建议不超过100字
3. **状态使用**: 根据事件性质合理使用状态颜色
   - 成功/完成: `success`
   - 失败/错误: `error`
   - 进行中/等待: `warning`
   - 中性/信息: `info`
4. **响应式**: 在移动端会自动优化布局，垂直方向强制使用左侧模式

## 示例

### 项目进度展示

```vue
<template>
  <Timeline
    :items="projectTimeline"
    mode="alternate"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';

const projectTimeline = ref([
  {
    time: '2024-01-01',
    title: '项目启动',
    description: '完成需求分析和项目规划',
    status: 'success',
  },
  {
    time: '2024-01-15',
    title: '原型设计',
    description: '完成产品原型和UI设计',
    status: 'success',
  },
  {
    time: '2024-02-01',
    title: '开发阶段',
    description: '前后端开发进行中',
    status: 'warning',
  },
  {
    time: '2024-02-15（计划）',
    title: '测试上线',
    description: '完成测试并正式上线',
    status: 'info',
  },
]);
</script>
```

### 操作日志

```vue
<template>
  <Timeline
    :items="logTimeline"
    mode="left"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';

const logTimeline = ref([
  {
    time: '2024-01-15 10:30:25',
    title: '用户登录',
    description: '用户 admin 从 192.168.1.100 登录成功',
    status: 'success',
  },
  {
    time: '2024-01-15 10:31:12',
    title: '数据导出',
    description: '导出用户列表数据，共 1250 条记录',
    status: 'info',
  },
  {
    time: '2024-01-15 10:35:08',
    title: '权限错误',
    description: '尝试访问未授权页面 /admin/settings',
    status: 'error',
  },
]);
</script>
```

## 响应式行为

- **桌面端 (>768px)**: 保持设置的 direction 和 mode
- **移动端 (≤768px)**:
  - 强制使用垂直方向
  - 强制使用左侧模式
  - 图标和文字大小自动调整

## 注意事项

1. **数据必填**: `items` 是必填属性，必须提供至少一个时间轴项
2. **时间唯一性**: 建议每个时间节点的 `time` 保持唯一
3. **图标优先级**: 如果同时设置了 `icon` 和 `status`，`status` 的颜色样式会覆盖 `icon` 的默认颜色
4. **水平方向限制**: 水平时间轴在节点过多时建议使用滚动容器

## 更新日志

- **v1.0.0** (2024-01-01): 初始版本发布
  - 支持垂直/水平方向
  - 支持左/右/交替模式
  - 支持状态样式和自定义图标
  - 完整的响应式设计
