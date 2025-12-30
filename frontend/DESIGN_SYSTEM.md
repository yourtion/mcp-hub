# MCP Hub 前端设计系统架构

## 📐 设计原则

### 1. 一致性优先
- 所有UI组件必须通过设计系统组件使用，不直接使用TDesign
- 统一的间距、颜色、字体、动画
- 统一的交互模式和反馈方式

### 2. 分层架构
```
应用层 (Views/Pages)
    ↓
业务组件层 (Business Components)
    ↓
设计系统层 (Design System) ← 我们在这一层
    ↓
TDesign Vue Next (UI Library)
    ↓
Vue 3 Core
```

### 3. 组件分类
- **Layout Components** - 布局容器
- **Data Display** - 数据展示
- **Form Components** - 表单输入
- **Feedback** - 反馈提示
- **Navigation** - 导航
- **Action** - 操作按钮

---

## 🎨 设计令牌系统

### 颜色系统
```less
// 主色
@primary-color: #409eff;
@success-color: #67c23a;
@warning-color: #e6a23c;
@danger-color: #f56c6c;
@info-color: #909399;

// 中性色
@text-primary: #303133;
@text-regular: #606266;
@text-secondary: #909399;
@text-placeholder: #c0c4cc;

// 背景色
@bg-page: #f2f3f5;
@bg-container: #ffffff;

// 边框色
@border-base: #dcdfe6;
@border-light: #e4e7ed;
@border-lighter: #ebeef5;
@border-extra-light: #f2f6fc;
```

### 间距系统 (8px基准)
```less
@spacing-xs: 4px;   // 0.5x
@spacing-sm: 8px;   // 1x
@spacing-md: 12px;  // 1.5x
@spacing-lg: 16px;  // 2x
@spacing-xl: 20px;  // 2.5x
@spacing-xxl: 24px; // 3x
@spacing-xxxl: 32px; // 4x
```

### 字体系统
```less
@font-size-xs: 12px;
@font-size-sm: 13px;
@font-size-base: 14px;
@font-size-md: 15px;
@font-size-lg: 16px;
@font-size-xl: 18px;
@font-size-xxl: 20px;
@font-size-xxxl: 24px;

@font-weight-normal: 400;
@font-weight-medium: 500;
@font-weight-semibold: 600;
@font-weight-bold: 700;
```

### 圆角系统
```less
@radius-sm: 2px;
@radius-base: 4px;
@radius-md: 6px;
@radius-lg: 8px;
@radius-xl: 12px;
@radius-round: 999px;
```

### 阴影系统
```less
@shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
@shadow-base: 0 2px 4px rgba(0, 0, 0, 0.1);
@shadow-md: 0 4px 8px rgba(0, 0, 0, 0.12);
@shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.15);
@shadow-xl: 0 16px 32px rgba(0, 0, 0, 0.18);
```

---

## 🧩 组件清单

### 布局组件 (Layout)

#### 1. AppLayout
**用途**: 应用主布局框架
**特性**:
- 顶部导航栏
- 侧边菜单栏
- 主内容区域
- 页脚

**Props**:
```typescript
interface AppLayoutProps {
  showHeader?: boolean;
  showSidebar?: boolean;
  showFooter?: boolean;
  headerHeight?: string;
  sidebarWidth?: string;
  collapsed?: boolean;
}
```

#### 2. ContentLayout
**用途**: 内容区域布局
**特性**:
- PageHeader集成
- 内容padding
- 滚动区域

**Props**:
```typescript
interface ContentLayoutProps {
  title?: string;
  description?: string;
  actions?: Action[];
  maxWidth?: string;
  fluid?: boolean;
}
```

#### 3. TwoColumnLayout
**用途**: 双列布局（主内容 + 侧边栏）

**Props**:
```typescript
interface TwoColumnLayoutProps {
  mainWidth?: string;
  sideWidth?: string;
  gap?: string;
  reverse?: boolean;
}
```

---

### 数据展示组件 (Data Display)

#### 1. DataTable
**用途**: 统一数据表格
**特性**:
- 统一的列配置
- 内置分页
- 内置筛选
- 内置排序
- 批量操作

**Props**:
```typescript
interface DataTableProps {
  data: any[];
  columns: Column[];
  loading?: boolean;
  pagination?: PaginationConfig;
  selectable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  rowKey?: string;
  stripe?: boolean;
  border?: boolean;
}

interface Column {
  colKey: string;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  ellipsis?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  cell?: string;
  render?: (data: any) => VNode;
}
```

#### 2. DetailView
**用途**: 详情视图
**特性**:
- 字段分组
- 自定义渲染
- 编辑模式

**Props**:
```typescript
interface DetailViewProps {
  data: Record<string, any>;
  fields: DetailField[];
  columns?: number;
  editable?: boolean;
  loading?: boolean;
}

interface DetailField {
  key: string;
  label: string;
  type?: 'text' | 'image' | 'link' | 'tag' | 'date' | 'json' | 'code';
  span?: number;
  render?: (value: any, data: any) => VNode;
}
```

#### 3. StatCard
**用途**: 统计卡片（已实现）

#### 4. Timeline
**用途**: 时间线展示

**Props**:
```typescript
interface TimelineProps {
  items: TimelineItem[];
  mode?: 'left' | 'right' | 'alternate';
  direction?: 'horizontal' | 'vertical';
}

interface TimelineItem {
  time: string;
  title: string;
  description?: string;
  icon?: Component;
  color?: string;
  status?: 'success' | 'error' | 'warning' | 'info';
}
```

---

### 表单组件 (Form Components)

#### 1. FormDialog
**用途**: 统一表单对话框
**特性**:
- 标准化布局
- 表单验证
- 提交/取消逻辑
- 加载状态

**Props**:
```typescript
interface FormDialogProps {
  visible: boolean;
  title: string;
  mode: 'create' | 'edit' | 'view';
  formState: any;
  fields: FormField[];
  rules?: Record<string, any>;
  loading?: boolean;
  width?: string | number;
}

interface FormField {
  name: string;
  label: string;
  type: 'input' | 'textarea' | 'select' | 'number' | 'date' | 'switch' | 'checkbox' | 'radio' | 'upload' | 'json-editor' | 'code-editor';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: SelectOption[];
  span?: number;
  tip?: string;
  defaultValue?: any;
  props?: Record<string, any>;
}
```

#### 2. FormSection
**用途**: 表单分组

**Props**:
```typescript
interface FormSectionProps {
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}
```

#### 3. FormBuilder
**用途**: 动态表单构建器
**特性**:
- 基于配置生成表单
- 支持复杂布局
- 动态字段

#### 4. SearchBar
**用途**: 搜索栏

**Props**:
```typescript
interface SearchBarProps {
  fields: SearchField[];
  modelValue: Record<string, any>;
  collapsible?: boolean;
  inline?: boolean;
}
```

---

### 反馈组件 (Feedback)

#### 1. LoadingPage
**用途**: 页面加载状态

**Props**:
```typescript
interface LoadingPageProps {
  text?: string;
  size?: 'small' | 'medium' | 'large';
  fullscreen?: boolean;
}
```

#### 2. EmptyPage
**用途**: 空状态页面

**Props**:
```typescript
interface EmptyPageProps {
  type?: 'no-data' | 'no-result' | 'no-permission' | 'error';
  title?: string;
  description?: string;
  actions?: Action[];
  illustration?: boolean;
}
```

#### 3. ErrorPage
**用途**: 错误页面

**Props**:
```typescript
interface ErrorPageProps {
  code?: number;
  title?: string;
  description?: string;
  showBack?: boolean;
  showHome?: boolean;
}
```

#### 4. ConfirmDialog
**用途**: 确认对话框

**Props**:
```typescript
interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  content: string;
  type?: 'warning' | 'danger' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
}
```

---

### 导航组件 (Navigation)

#### 1. Breadcrumb
**用途**: 面包屑导航

**Props**:
```typescript
interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: string;
}

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: Component;
}
```

#### 2. TabNav
**用途**: 标签页导航

**Props**:
```typescript
interface TabNavProps {
  items: TabItem[];
  modelValue: string;
  closable?: boolean;
  addable?: boolean;
  type?: 'card' | 'line' | 'pills';
}
```

#### 3. SideMenu
**用途**: 侧边菜单

---

### 操作组件 (Action)

#### 1. ActionButton
**用途**: 统一操作按钮

**Props**:
```typescript
interface ActionButtonProps {
  action: string;
  type?: 'create' | 'edit' | 'delete' | 'view' | 'refresh' | 'export' | 'import';
  icon?: boolean;
  text?: boolean;
  loading?: boolean;
  disabled?: boolean;
  confirm?: boolean | string;
  onClick: () => void | Promise<void>;
}
```

#### 2. ActionGroup
**用途**: 操作按钮组

**Props**:
```typescript
interface ActionGroupProps {
  actions: Action[];
  max?: number;
  type?: 'button' | 'dropdown' | 'icon';
}
```

---

## 📐 布局规范

### 页面布局结构
```vue
<template>
  <AppLayout>
    <template #header>
      <!-- 页面头部 -->
    </template>

    <template #sidebar>
      <!-- 侧边菜单 -->
    </template>

    <ContentLayout
      :title="pageTitle"
      :description="pageDescription"
      :actions="pageActions"
    >
      <!-- 页面内容 -->
      <DataTable />
      或
      <DetailView />
      或
      <FormDialog />
    </ContentLayout>

    <template #footer>
      <!-- 页脚 -->
    </template>
  </AppLayout>
</template>
```

### 列表页面标准结构
```vue
<template>
  <ContentLayout>
    <!-- 统计卡片 -->
    <StatRow :cards="statsCards" />

    <!-- 筛选栏 -->
    <FilterBar
      v-model="filters"
      :fields="filterFields"
      @search="handleSearch"
      @reset="handleReset"
    />

    <!-- 数据表格 -->
    <DataTable
      :data="tableData"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      @selection-change="handleSelectionChange"
    />
  </ContentLayout>
</template>
```

### 表单页面标准结构
```vue
<template>
  <ContentLayout :title="formTitle">
    <FormDialog
      v-model:visible="showForm"
      :mode="formMode"
      :form-state="formData"
      :fields="formFields"
      :rules="formRules"
      @submit="handleSubmit"
    />
  </ContentLayout>
</template>
```

---

## 🎯 组件命名规范

### BEM + Namespace规范
```less
// 设计系统组件前缀: .ds-
.ds-page-header { }
.ds-stat-card { }
.ds-data-table { }

// 业务组件前缀: 页面模块
.server-list__table { }
.group-detail__info { }
.tool-test__result { }
```

### 组件文件命名
```
设计系统组件: PascalCase + 描述性名称
- PageHeader.vue
- DataTable.vue
- FormDialog.vue

业务组件: PascalCase + 模块前缀
- ServerList.vue
- GroupDetail.vue
- ToolExecuteForm.vue
```

---

## 📊 重构优先级

### P0 - 核心组件（必须）
1. ✅ PageHeader - 已完成
2. ✅ StatCard - 已完成
3. ⏳ DataTable - 待开发
4. ⏳ FormDialog - 待开发
5. ⏳ DetailView - 待开发

### P1 - 常用组件（重要）
6. ContentLayout
7. FilterBar
8. LoadingPage
9. EmptyPage
10. ActionButton

### P2 - 增强组件（可选）
11. Timeline
12. TabNav
13. Breadcrumb
14. FormBuilder
15. ConfirmDialog

---

## 🔄 迁移策略

### 阶段1: 核心组件开发
- 开发P0优先级组件
- 建立组件文档
- 编写单元测试

### 阶段2: 页面迁移
- 按页面类型分组迁移
- 每次迁移一个页面类型
  - 所有列表页面
  - 所有表单页面
  - 所有详情页面
- 保持测试通过

### 阶段3: 清理优化
- 删除旧组件
- 清理未使用代码
- 性能优化

---

## 📚 组件文档标准

每个组件必须包含：

### 1. README.md
```markdown
# ComponentName

## 基本用法
\`\`\`vue
<example>
\`\`\`

## API
### Props
| 参数 | 说明 | 类型 | 默认值 |
|------|------|------|--------|

### Events
| 事件名 | 说明 | 参数 |
|--------|------|------|

### Slots
| 插槽名 | 说明 | 作用域参数 |
|--------|------|-----------|
\`\`\`

## 设计规范
- 何时使用
- 使用场景
- 最佳实践
```

### 2. 示例代码
- 基本用法示例
- 高级用法示例
- 边界情况示例

### 3. 单元测试
- 覆盖率 >80%
- 测试主要交互
- 测试边界情况

---

## 🎨 主题系统

### CSS变量映射
```less
:root {
  // 间距
  --ds-spacing-xs: @spacing-xs;
  --ds-spacing-sm: @spacing-sm;
  // ...

  // 颜色
  --ds-color-primary: @primary-color;
  --ds-color-success: @success-color;
  // ...

  // 字体
  --ds-font-size-base: @font-size-base;
  // ...
}
```

### 暗色主题支持
```less
[data-theme='dark'] {
  --ds-color-bg-page: #1a1a1a;
  --ds-color-bg-container: #2a2a2a;
  // ...
}
```

---

这个文档将指导整个重构过程，确保设计系统的一致性和完整性。
