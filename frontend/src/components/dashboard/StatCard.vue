<template>
  <t-card class="stat-card" :class="[`stat-card--${color}`]">
    <div class="stat-card__content">
      <div class="stat-card__icon">
        <component :is="iconComponent" size="24px" />
      </div>
      <div class="stat-card__info">
        <div class="stat-card__value">{{ formattedValue }}</div>
        <div class="stat-card__label">{{ label }}</div>
        <div v-if="trend" class="stat-card__trend" :class="[`trend--${trend.direction}`]">
          <component :is="trendIconComponent" size="12px" />
          <span>{{ trend.value }}{{ trend.value === parseInt(trend.value.toString()) ? '' : '%' }} {{ trend.period }}</span>
        </div>
      </div>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { computed, markRaw, type Component } from 'vue';
import {
  ServerIcon,
  LinkIcon,
  ToolsIcon,
  FolderIcon,
  UserIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MinusIcon,
} from 'tdesign-icons-vue-next';
import type { StatCardData } from '@/types/dashboard';

interface Props {
  data: StatCardData;
}

const props = defineProps<Props>();

// 图标组件映射
const iconComponentMap: Record<string, Component> = {
  server: markRaw(ServerIcon),
  link: markRaw(LinkIcon),
  tool: markRaw(ToolsIcon),
  tools: markRaw(ToolsIcon),
  folder: markRaw(FolderIcon),
  user: markRaw(UserIcon),
  chart: markRaw(MinusIcon), // 临时使用
  warning: markRaw(MinusIcon), // 临时使用
  success: markRaw(MinusIcon), // 临时使用
};

const trendIconMap: Record<string, Component> = {
  up: markRaw(ChevronUpIcon),
  down: markRaw(ChevronDownIcon),
  stable: markRaw(MinusIcon),
};

// 格式化数值显示
const formattedValue = computed(() => {
  const value = props.data.value;
  if (typeof value === 'number') {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  }
  return value;
});

// 图标组件
const iconComponent = computed(() => {
  const iconKey = props.data.icon || 'chart';
  return iconComponentMap[iconKey] || iconComponentMap.chart;
});

// 趋势图标组件
const trendIconComponent = computed(() => {
  if (!props.data.trend) return markRaw(MinusIcon);
  const direction = props.data.trend.direction;
  return trendIconMap[direction] || trendIconMap.stable;
});

// 颜色和标签
const { color, label, trend } = props.data;
</script>

<style scoped>
.stat-card {
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
}

.stat-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.stat-card__content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px;
}

.stat-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background-color: var(--icon-bg-color);
  color: var(--icon-color);
}

.stat-card__info {
  flex: 1;
}

.stat-card__value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--td-text-color-primary);
  margin-bottom: 4px;
}

.stat-card__label {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  margin-bottom: 4px;
}

.stat-card__trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
}

/* 颜色主题 */
.stat-card--blue {
  --icon-bg-color: rgba(64, 158, 255, 0.1);
  --icon-color: #409eff;
}

.stat-card--green {
  --icon-bg-color: rgba(103, 194, 58, 0.1);
  --icon-color: #67c23a;
}

.stat-card--purple {
  --icon-bg-color: rgba(180, 83, 245, 0.1);
  --icon-color: #b453f5;
}

.stat-card--orange {
  --icon-bg-color: rgba(255, 159, 64, 0.1);
  --icon-color: #ff9f40;
}

.stat-card--red {
  --icon-bg-color: rgba(245, 108, 108, 0.1);
  --icon-color: #f56c6c;
}

/* 趋势颜色 */
.trend--up {
  color: #67c23a;
}

.trend--down {
  color: #f56c6c;
}

.trend--stable {
  color: #909399;
}
</style>