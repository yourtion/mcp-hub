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
  border: 1px solid var(--td-border-level-1-color);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, var(--card-gradient-1) 0%, var(--card-gradient-2) 100%);
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
}

.stat-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  transform: translateY(-4px) scale(1.02);
  border-color: var(--icon-color);
}

.stat-card:hover::before {
  opacity: 0.05;
}

.stat-card__content {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 10px;
  position: relative;
  z-index: 1;
}

.stat-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--icon-bg-color) 0%, var(--icon-bg-color-light, var(--icon-bg-color)) 100%);
  color: var(--icon-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.35s ease;
  position: relative;
}

.stat-card:hover .stat-card__icon {
  transform: scale(1.1) rotate(5deg);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.stat-card__info {
  flex: 1;
}

.stat-card__value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--td-text-color-primary);
  margin-bottom: 6px;
  transition: all 0.3s ease;
}

.stat-card:hover .stat-card__value {
  transform: translateX(4px);
}

.stat-card__label {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  margin-bottom: 6px;
  font-weight: 500;
}

.stat-card__trend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  background-color: var(--trend-bg-color, transparent);
  transition: all 0.3s ease;
}

.stat-card:hover .stat-card__trend {
  transform: scale(1.05);
}

/* 颜色主题 */
.stat-card--blue {
  --icon-color: #409eff;
  --icon-bg-color: rgba(64, 158, 255, 0.12);
  --icon-bg-color-light: rgba(64, 158, 255, 0.18);
  --card-gradient-1: rgba(64, 158, 255, 0.1);
  --card-gradient-2: rgba(64, 158, 255, 0.02);
}

.stat-card--green {
  --icon-color: #67c23a;
  --icon-bg-color: rgba(103, 194, 58, 0.12);
  --icon-bg-color-light: rgba(103, 194, 58, 0.18);
  --card-gradient-1: rgba(103, 194, 58, 0.1);
  --card-gradient-2: rgba(103, 194, 58, 0.02);
}

.stat-card--purple {
  --icon-color: #b453f5;
  --icon-bg-color: rgba(180, 83, 245, 0.12);
  --icon-bg-color-light: rgba(180, 83, 245, 0.18);
  --card-gradient-1: rgba(180, 83, 245, 0.1);
  --card-gradient-2: rgba(180, 83, 245, 0.02);
}

.stat-card--orange {
  --icon-color: #ff9f40;
  --icon-bg-color: rgba(255, 159, 64, 0.12);
  --icon-bg-color-light: rgba(255, 159, 64, 0.18);
  --card-gradient-1: rgba(255, 159, 64, 0.1);
  --card-gradient-2: rgba(255, 159, 64, 0.02);
}

.stat-card--red {
  --icon-color: #f56c6c;
  --icon-bg-color: rgba(245, 108, 108, 0.12);
  --icon-bg-color-light: rgba(245, 108, 108, 0.18);
  --card-gradient-1: rgba(245, 108, 108, 0.1);
  --card-gradient-2: rgba(245, 108, 108, 0.02);
}

/* 趋势颜色 */
.trend--up {
  color: #67c23a;
  --trend-bg-color: rgba(103, 194, 58, 0.1);
}

.trend--down {
  color: #f56c6c;
  --trend-bg-color: rgba(245, 108, 108, 0.1);
}

.trend--stable {
  color: #909399;
  --trend-bg-color: rgba(144, 147, 153, 0.1);
}

/* 响应式 */
@media (max-width: 768px) {
  .stat-card__content {
    gap: 14px;
  }

  .stat-card__icon {
    width: 48px;
    height: 48px;
  }

  .stat-card__value {
    font-size: 24px;
  }

  .stat-card__label {
    font-size: 13px;
  }
}
</style>