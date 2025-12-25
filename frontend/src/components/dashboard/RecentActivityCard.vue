<template>
  <t-card title="最近活动" class="activity-card">
    <template #actions>
      <t-button
        theme="default"
        size="small"
        :loading="loading"
        @click="refreshActivities"
      >
        <template #icon>
          <RefreshIcon />
        </template>
        刷新
      </t-button>
    </template>

    <div v-if="loading && activities.length === 0" class="activity-loading">
      <t-loading size="small" />
      <span>加载中...</span>
    </div>

    <div v-else-if="activities.length > 0" class="activity-content">
      <div class="activity-list">
        <div
          v-for="activity in displayActivities"
          :key="activity.id"
          class="activity-item"
          :class="[`activity--${activity.severity}`]"
        >
          <div class="activity-icon">
            <component :is="getActivityIconComponent(activity)" size="16px" />
          </div>
          <div class="activity-info">
            <div class="activity-message">{{ activity.message }}</div>
            <div class="activity-time">{{ formatTime(activity.timestamp) }}</div>
          </div>
          <div class="activity-type">
            <t-tag
              :theme="getActivityTagTheme(activity.severity)"
              size="small"
              variant="light"
            >
              {{ getActivityTypeText(activity.type) }}
            </t-tag>
          </div>
        </div>
      </div>

      <div v-if="activities.length > displayLimit" class="activity-footer">
        <t-button
          theme="default"
          variant="text"
          size="small"
          @click="showMore"
        >
          查看更多 ({{ activities.length - displayLimit }} 条)
        </t-button>
      </div>
    </div>

    <div v-else class="activity-empty">
      <InfoCircleIcon size="32px" />
      <span>暂无活动记录</span>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { computed, markRaw, ref, type Component } from 'vue';
import {
  RefreshIcon,
  LinkIcon,
  LinkUnlinkIcon,
  ToolsIcon,
  CloseCircleIcon,
  InfoCircleIcon,
  PoweroffIcon,
} from 'tdesign-icons-vue-next';
import type { Activity } from '@/types/dashboard';

interface Props {
  activities: Activity[];
  loading?: boolean;
}

interface Emits {
  (e: 'refresh'): void;
  (e: 'show-more'): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<Emits>();

// 显示限制
const displayLimit = ref(10);

// 显示的活动列表
const displayActivities = computed(() => {
  return props.activities.slice(0, displayLimit.value);
});

// 活动图标组件映射
const activityIconMap: Record<string, Component> = {
  server_connected: markRaw(LinkIcon),
  server_disconnected: markRaw(LinkUnlinkIcon),
  tool_executed: markRaw(ToolsIcon),
  error: markRaw(CloseCircleIcon),
  system_start: markRaw(PoweroffIcon),
};

// 获取活动图标组件
const getActivityIconComponent = (activity: Activity): Component => {
  return activityIconMap[activity.type] || activityIconMap.error;
};

// 获取活动类型文本
const getActivityTypeText = (type: Activity['type']): string => {
  const textMap: Record<string, string> = {
    server_connected: '服务器连接',
    server_disconnected: '服务器断开',
    tool_executed: '工具执行',
    error: '系统错误',
    system_start: '系统启动',
  };
  return textMap[type] || '未知';
};

// 获取标签主题
const getActivityTagTheme = (severity: Activity['severity']): string => {
  const themeMap: Record<string, string> = {
    info: 'primary',
    warning: 'warning',
    error: 'danger',
  };
  return themeMap[severity] || 'default';
};

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
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
};

// 刷新活动
const refreshActivities = () => {
  emit('refresh');
};

// 显示更多
const showMore = () => {
  displayLimit.value += 10;
  emit('show-more');
};
</script>

<style scoped>
.activity-card {
  height: 100%;
  border: 1px solid var(--td-border-level-1-color);
  transition: all 0.3s ease;
}

.activity-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.activity-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--td-text-color-secondary);
  font-size: 15px;
}

.activity-content {
  padding: 12px 0;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  border-radius: 10px;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.activity-item:hover {
  background: linear-gradient(135deg, var(--td-bg-color-container-hover) 0%, var(--td-bg-color-page) 100%);
  border-color: var(--activity-border-color, var(--td-border-level-1-color));
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.activity-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.activity-item:hover .activity-icon {
  transform: scale(1.1) rotate(5deg);
}

.activity--info {
  --activity-border-color: rgba(64, 158, 255, 0.3);
}

.activity--info .activity-icon {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.15) 0%, rgba(64, 158, 255, 0.08) 100%);
  color: #409eff;
}

.activity--warning {
  --activity-border-color: rgba(255, 159, 64, 0.3);
}

.activity--warning .activity-icon {
  background: linear-gradient(135deg, rgba(255, 159, 64, 0.15) 0%, rgba(255, 159, 64, 0.08) 100%);
  color: #ff9f40;
}

.activity--error {
  --activity-border-color: rgba(245, 108, 108, 0.3);
}

.activity--error .activity-icon {
  background: linear-gradient(135deg, rgba(245, 108, 108, 0.15) 0%, rgba(245, 108, 108, 0.08) 100%);
  color: #f56c6c;
}

.activity-info {
  flex: 1;
  min-width: 0;
}

.activity-message {
  font-size: 14px;
  color: var(--td-text-color-primary);
  margin-bottom: 6px;
  word-break: break-word;
  font-weight: 500;
  line-height: 1.5;
}

.activity-time {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.activity-time::before {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--td-text-color-placeholder);
}

.activity-type {
  flex-shrink: 0;
}

.activity-footer {
  margin-top: 20px;
  text-align: center;
  padding-top: 16px;
  border-top: 1px solid var(--td-border-level-1-color);
}

.activity-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 56px 32px;
  color: var(--td-text-color-placeholder);
}

/* 响应式 */
@media (max-width: 768px) {
  .activity-item {
    padding: 12px;
  }

  .activity-icon {
    width: 32px;
    height: 32px;
  }

  .activity-message {
    font-size: 13px;
  }
}
</style>