/**
 * MCP Hub Design System
 * 在 TDesign Vue Next 之上构建的设计系统层
 */

export type {
  ActionButtonProps,
  DropdownOption,
} from './components/actions/ActionButton.vue';
// 操作组件
export { default as ActionButton } from './components/actions/ActionButton.vue';
export type {
  Action,
  ActionGroupProps,
} from './components/actions/ActionGroup.vue';
export { default as ActionGroup } from './components/actions/ActionGroup.vue';
export type {
  DataTableColumn,
  DataTablePagination,
  DataTableProps,
} from './components/data-display/DataTable.vue';
export { default as DataTable } from './components/data-display/DataTable.vue';
export type {
  DetailAction,
  DetailField,
  DetailGroup,
  DetailViewProps,
} from './components/data-display/DetailView.vue';
export { default as DetailView } from './components/data-display/DetailView.vue';
export type {
  StatCardProps,
  StatCardTrend,
} from './components/data-display/StatCard.vue';
// 数据展示组件
export { default as StatCard } from './components/data-display/StatCard.vue';
export type {
  TimelineItem,
  TimelineProps,
} from './components/data-display/Timeline.vue';
export { default as Timeline } from './components/data-display/Timeline.vue';
export type { ConfirmDialogProps } from './components/feedback/ConfirmDialog.vue';
export { default as ConfirmDialog } from './components/feedback/ConfirmDialog.vue';
export type {
  EmptyPageAction,
  EmptyPageProps,
} from './components/feedback/EmptyPage.vue';
export { default as EmptyPage } from './components/feedback/EmptyPage.vue';
export type { ErrorPageProps } from './components/feedback/ErrorPage.vue';
export { default as ErrorPage } from './components/feedback/ErrorPage.vue';
export type { LoadingPageProps } from './components/feedback/LoadingPage.vue';
// 反馈组件
export { default as LoadingPage } from './components/feedback/LoadingPage.vue';
export { default as StatusIndicator } from './components/feedback/StatusIndicator.vue';
export type {
  FormDialogProps,
  FormField,
  FormFieldOption,
} from './components/form/FormDialog.vue';
// 表单组件
export { default as FormDialog } from './components/form/FormDialog.vue';
export type {
  AppLayoutProps,
  BreadcrumbItem,
  MenuItem,
  TabItem,
} from './components/layout/AppLayout.vue';
export { default as AppLayout } from './components/layout/AppLayout.vue';
export type { ContentLayoutProps } from './components/layout/ContentLayout.vue';
export { default as ContentLayout } from './components/layout/ContentLayout.vue';
export type {
  FilterAction,
  FilterBarProps,
  FilterField,
  FilterFieldOption,
} from './components/layout/FilterBar.vue';
export { default as FilterBar } from './components/layout/FilterBar.vue';
// 导出类型
export type { PageHeaderProps } from './components/layout/PageHeader.vue';
// 布局组件
export { default as PageHeader } from './components/layout/PageHeader.vue';
// 导出所有设计令牌
export * from './design-system.css';
// 导出 mixins
export * from './styles/mixins.less';
