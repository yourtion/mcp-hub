<template>
  <!-- mode: tag (默认模式) -->
  <t-tag
    v-if="props.mode === 'tag'"
    :theme="config.theme"
    :variant="props.variant"
    :size="props.size"
    :class="['ds-status-indicator', `ds-status-indicator--${props.status}`]"
  >
    <component :is="config.icon" size="14px" />
    {{ config.text }}
  </t-tag>

  <!-- mode: badge -->
  <t-badge
    v-else-if="props.mode === 'badge'"
    :count="config.text"
    :color="badgeColor"
    :size="props.size"
  >
    <slot />
  </t-badge>

  <!-- mode: dot -->
  <div
    v-else-if="props.mode === 'dot'"
    :class="['ds-status-dot', `ds-status-dot--${props.status}`, `ds-status-dot--${props.size}`]"
  >
    <span class="ds-status-dot__indicator"></span>
    <span v-if="props.showText" class="ds-status-dot__text">{{ config.text }}</span>
  </div>

  <!-- mode: text -->
  <span
    v-else
    :class="['ds-status-text', `ds-status-text--${props.status}`, `ds-status-text--${props.size}`]"
  >
    <component v-if="props.size !== 'small'" :is="config.icon" size="14px" />
    {{ config.text }}
  </span>
</template>

<script setup lang="ts">
import { computed, markRaw } from 'vue';
import {
  CheckCircleIcon,
  CloseCircleIcon,
  LoadingIcon,
  ErrorCircleIcon,
} from 'tdesign-icons-vue-next';

export interface StatusConfig {
  text: string;
  theme: 'success' | 'warning' | 'danger' | 'default';
  icon: any;
  color: string;
}

export interface StatusIndicatorProps {
  status: string;
  mode?: 'tag' | 'badge' | 'dot' | 'text';
  variant?: 'dark' | 'light' | 'outline' | 'light-outline';
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  customConfig?: Record<string, StatusConfig>;
}

const props = withDefaults(defineProps<StatusIndicatorProps>(), {
  mode: 'tag',
  variant: 'light',
  size: 'medium',
  showText: true,
});

// 默认状态配置
const defaultConfig: Record<string, StatusConfig> = {
  connected: {
    text: '已连接',
    theme: 'success',
    icon: markRaw(CheckCircleIcon),
    color: '#00a870',
  },
  disconnected: {
    text: '未连接',
    theme: 'default',
    icon: markRaw(CloseCircleIcon),
    color: '#909399',
  },
  connecting: {
    text: '连接中',
    theme: 'warning',
    icon: markRaw(LoadingIcon),
    color: '#ed7b2f',
  },
  error: {
    text: '错误',
    theme: 'danger',
    icon: markRaw(ErrorCircleIcon),
    color: '#e34d59',
  },
  success: {
    text: '成功',
    theme: 'success',
    icon: markRaw(CheckCircleIcon),
    color: '#00a870',
  },
  warning: {
    text: '警告',
    theme: 'warning',
    icon: markRaw(ErrorCircleIcon),
    color: '#ed7b2f',
  },
  pending: {
    text: '待处理',
    theme: 'default',
    icon: markRaw(CloseCircleIcon),
    color: '#909399',
  },
  // 工具状态
  available: {
    text: '可用',
    theme: 'success',
    icon: markRaw(CheckCircleIcon),
    color: '#00a870',
  },
  unavailable: {
    text: '不可用',
    theme: 'danger',
    icon: markRaw(CloseCircleIcon),
    color: '#e34d59',
  },
};

const config = computed(() => {
  return (
    props.customConfig?.[props.status] ||
    defaultConfig[props.status] ||
    defaultConfig.disconnected
  );
});

const badgeColor = computed(() => config.value.color);
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';

// Tag 模式样式
.ds-status-indicator--connecting :deep(.t-icon) {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// Dot 模式样式
.ds-status-dot {
  .flex-center();
  gap: 6px;
}

.ds-status-dot__indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: currentColor;
  flex-shrink: 0;
}

.ds-status-dot--small {
  font-size: var(--font-size-xs);

  .ds-status-dot__indicator {
    width: 6px;
    height: 6px;
  }
}

.ds-status-dot--large {
  font-size: var(--font-size-md);

  .ds-status-dot__indicator {
    width: 10px;
    height: 10px;
  }
}

// 不同状态的 dot 颜色
.ds-status-dot--connected {
  color: #00a870;
}

.ds-status-dot--disconnected {
  color: #909399;
}

.ds-status-dot--connecting {
  color: #ed7b2f;

  .ds-status-dot__indicator {
    animation: pulse 1.5s ease-in-out infinite;
  }
}

.ds-status-dot--error {
  color: #e34d59;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

// Text 模式样式
.ds-status-text {
  .flex-center();
  gap: 4px;
  font-weight: var(--font-weight-medium);
}

.ds-status-text--small {
  font-size: var(--font-size-xs);
}

.ds-status-text--medium {
  font-size: var(--font-size-base);
}

.ds-status-text--large {
  font-size: var(--font-size-lg);
}

// 不同状态的文本颜色
.ds-status-text--connected {
  color: #00a870;
}

.ds-status-text--disconnected {
  color: var(--td-text-color-secondary);
}

.ds-status-text--connecting {
  color: #ed7b2f;

  :deep(.t-icon) {
    animation: spin 1s linear infinite;
  }
}

.ds-status-text--error {
  color: #e34d59;
}
</style>
