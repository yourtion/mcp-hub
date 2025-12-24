<template>
  <t-card title="系统健康状态" class="health-card">
    <template #actions>
      <t-button
        theme="default"
        size="small"
        :loading="loading"
        @click="refreshHealth"
      >
        <template #icon>
          <RefreshIcon />
        </template>
        刷新
      </t-button>
    </template>

    <div v-if="loading && !health" class="health-loading">
      <t-loading size="small" />
      <span>加载中...</span>
    </div>

    <div v-else-if="health" class="health-content">
      <!-- 整体状态 -->
      <div class="health-status">
        <div class="status-indicator" :class="[`status--${health.status}`]">
          <component :is="statusIconComponent" size="20px" />
        </div>
        <div class="status-info">
          <div class="status-text">{{ statusText }}</div>
          <div v-if="health.lastCheck" class="status-time">
            最后检查: {{ formatTime(health.lastCheck) }}
          </div>
        </div>
      </div>

      <!-- 问题列表 -->
      <div v-if="health.issues.length > 0" class="health-issues">
        <div class="issues-title">
          <ErrorCircleIcon size="16px" />
          发现 {{ health.issues.length }} 个问题
        </div>
        <ul class="issues-list">
          <li v-for="(issue, index) in health.issues" :key="index" class="issue-item">
            {{ issue }}
          </li>
        </ul>
      </div>

      <!-- 健康指标 -->
      <div v-else class="health-metrics">
        <div class="metric-item">
          <CheckCircleIcon size="16px" class="metric-icon success" />
          <span>所有服务运行正常</span>
        </div>
        <div class="metric-item">
          <CheckCircleIcon size="16px" class="metric-icon success" />
          <span>系统资源充足</span>
        </div>
        <div class="metric-item">
          <CheckCircleIcon size="16px" class="metric-icon success" />
          <span>网络连接稳定</span>
        </div>
      </div>
    </div>

    <div v-else class="health-error">
      <CloseCircleIcon size="24px" />
      <span>无法获取健康状态</span>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { computed, markRaw, type Component } from 'vue';
import {
  CheckCircleIcon,
  CloseCircleIcon,
  ErrorCircleIcon,
  RefreshIcon,
} from 'tdesign-icons-vue-next';
import type { SystemHealth } from '@/types/dashboard';

interface Props {
  health: SystemHealth | null;
  loading?: boolean;
}

interface Emits {
  (e: 'refresh'): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<Emits>();

// 状态图标组件映射
const statusIconMap: Record<string, Component> = {
  healthy: markRaw(CheckCircleIcon),
  warning: markRaw(ErrorCircleIcon),
  error: markRaw(CloseCircleIcon),
};

// 状态图标组件
const statusIconComponent = computed(() => {
  if (!props.health) return markRaw(CloseCircleIcon);
  return statusIconMap[props.health.status] || statusIconMap.error;
});

// 状态文本
const statusText = computed(() => {
  if (!props.health) return '未知状态';

  const textMap: Record<string, string> = {
    healthy: '系统运行正常',
    warning: '系统存在警告',
    error: '系统存在错误',
  };
  return textMap[props.health.status] || '未知状态';
});

// 格式化时间
const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) { // 1分钟内
    return '刚刚';
  } else if (diff < 3600000) { // 1小时内
    return `${Math.floor(diff / 60000)}分钟前`;
  } else if (diff < 86400000) { // 24小时内
    return `${Math.floor(diff / 3600000)}小时前`;
  } else {
    return date.toLocaleString('zh-CN');
  }
};

// 刷新健康状态
const refreshHealth = () => {
  emit('refresh');
};
</script>

<style scoped>
.health-card {
  height: 100%;
}

.health-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--td-text-color-secondary);
}

.health-content {
  padding: 8px 0;
}

.health-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.status--healthy {
  background-color: rgba(103, 194, 58, 0.1);
  color: #67c23a;
}

.status--warning {
  background-color: rgba(255, 159, 64, 0.1);
  color: #ff9f40;
}

.status--error {
  background-color: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.status-info {
  flex: 1;
}

.status-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--td-text-color-primary);
  margin-bottom: 4px;
}

.status-time {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.health-issues {
  margin-top: 16px;
  padding: 12px;
  background-color: rgba(245, 108, 108, 0.05);
  border-radius: 6px;
  border-left: 3px solid #f56c6c;
}

.issues-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #f56c6c;
  margin-bottom: 8px;
}

.issues-list {
  margin: 0;
  padding-left: 16px;
}

.issue-item {
  font-size: 13px;
  color: var(--td-text-color-secondary);
  margin-bottom: 4px;
}

.issue-item:last-child {
  margin-bottom: 0;
}

.health-metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--td-text-color-secondary);
}

.metric-icon.success {
  color: #67c23a;
}

.health-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--td-text-color-placeholder);
}
</style>