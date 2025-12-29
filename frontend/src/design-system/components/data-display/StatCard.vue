<template>
  <t-card class="ds-stat-card" :class="[`ds-stat-card--${props.theme}`]">
    <div class="ds-stat-card__content">
      <div class="ds-stat-card__icon">
        <component :is="iconComponent" size="24px" />
      </div>
      <div class="ds-stat-card__info">
        <div v-if="props.loading" class="ds-stat-card__value--skeleton">
          <t-skeleton :animation="true" />
        </div>
        <div v-else class="ds-stat-card__value">{{ formattedValue }}</div>
        <div class="ds-stat-card__label">{{ props.label }}</div>
        <div v-if="props.trend" class="ds-stat-card__trend" :class="[`trend--${props.trend.direction}`]">
          <component :is="trendIconComponent" size="12px" />
          <span>{{ trendValue }} {{ trendPeriod }}</span>
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
  CheckCircleIcon,
  CloseCircleIcon,
  ErrorCircleIcon,
} from 'tdesign-icons-vue-next';

export interface StatCardTrend {
  direction: 'up' | 'down' | 'stable';
  value: number | string;
  period?: string;
}

export interface StatCardProps {
  value: number | string;
  label: string;
  icon?: string | Component;
  theme?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  trend?: StatCardTrend;
  clickable?: boolean;
  loading?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<StatCardProps>(), {
  theme: 'blue',
  clickable: true,
  loading: false,
});

// 图标映射
const iconComponentMap: Record<string, Component> = {
  server: markRaw(ServerIcon),
  link: markRaw(LinkIcon),
  tool: markRaw(ToolsIcon),
  tools: markRaw(ToolsIcon),
  folder: markRaw(FolderIcon),
  user: markRaw(UserIcon),
  'check-circle': markRaw(CheckCircleIcon),
  'close-circle': markRaw(CloseCircleIcon),
  'error-circle': markRaw(ErrorCircleIcon),
  success: markRaw(CheckCircleIcon),
  chart: markRaw(MinusIcon),
};

const trendIconMap: Record<string, Component> = {
  up: markRaw(ChevronUpIcon),
  down: markRaw(ChevronDownIcon),
  stable: markRaw(MinusIcon),
};

// 格式化数值
const formattedValue = computed(() => {
  const value = props.value;
  if (typeof value === 'number') {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  }
  return value;
});

// 图标组件
const iconComponent = computed(() => {
  if (typeof props.icon === 'string') {
    return iconComponentMap[props.icon] || iconComponentMap.server;
  }
  return props.icon || iconComponentMap.server;
});

// 趋势图标组件
const trendIconComponent = computed(() => {
  if (!props.trend) return markRaw(MinusIcon);
  return trendIconMap[props.trend.direction] || trendIconMap.stable;
});

// 趋势值格式化
const trendValue = computed(() => {
  if (!props.trend) return '';
  const val = props.trend.value;
  return val === parseInt(val.toString()) ? val : `${val}%`;
});

// 趋势周期
const trendPeriod = computed(() => {
  return props.trend?.period || '';
});
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/color.less';

.ds-stat-card {
  border: 1px solid var(--td-border-level-1-color);
  cursor: pointer;
  transition: all var(--duration-normal) var(--easing-cubic);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, var(--card-gradient-1) 0%, var(--card-gradient-2) 100%);
    opacity: 0;
    transition: opacity var(--duration-normal) var(--easing-ease);
    pointer-events: none;
  }

  &:hover {
    box-shadow: var(--shadow-lg);
    transform: translateY(-4px) scale(1.02);
    border-color: var(--icon-color);

    &::before {
      opacity: 0.05;
    }
  }
}

.ds-stat-card__content {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 10px;
  position: relative;
  z-index: 1;
}

.ds-stat-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--stat-card-icon-size);
  height: var(--stat-card-icon-size);
  border-radius: var(--stat-card-icon-bg-radius);
  background: linear-gradient(135deg, var(--icon-bg-color) 0%, var(--icon-bg-color-light) 100%);
  color: var(--icon-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all var(--duration-normal) var(--easing-ease);
  flex-shrink: 0;
}

.ds-stat-card:hover .ds-stat-card__icon {
  transform: scale(1.1) rotate(5deg);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.ds-stat-card__info {
  flex: 1;
  min-width: 0;
}

.ds-stat-card__value {
  font-size: var(--stat-card-value-size);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  color: var(--td-text-color-primary);
  margin-bottom: 6px;
  transition: all var(--duration-normal) var(--easing-ease);
}

.ds-stat-card:hover .ds-stat-card__value {
  transform: translateX(4px);
}

.ds-stat-card__value--skeleton {
  width: 80px;
  height: 32px;
}

.ds-stat-card__label {
  font-size: var(--stat-card-label-size);
  color: var(--td-text-color-secondary);
  margin-bottom: 6px;
  font-weight: var(--font-weight-medium);
}

.ds-stat-card__trend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  padding: 2px 8px;
  border-radius: 12px;
  transition: all var(--duration-normal) var(--easing-ease);
}

.ds-stat-card:hover .ds-stat-card__trend {
  transform: scale(1.05);
}

// 颜色主题
.ds-stat-card--blue {
  --icon-color: @stat-card-blue;
  --icon-bg-color: @stat-card-blue-bg;
  --icon-bg-color-light: @stat-card-blue-bg-light;
  --card-gradient-1: @stat-card-blue-gradient-1;
  --card-gradient-2: @stat-card-blue-gradient-2;
}

.ds-stat-card--green {
  --icon-color: @stat-card-green;
  --icon-bg-color: @stat-card-green-bg;
  --icon-bg-color-light: @stat-card-green-bg-light;
  --card-gradient-1: @stat-card-green-gradient-1;
  --card-gradient-2: @stat-card-green-gradient-2;
}

.ds-stat-card--purple {
  --icon-color: @stat-card-purple;
  --icon-bg-color: @stat-card-purple-bg;
  --icon-bg-color-light: @stat-card-purple-bg-light;
  --card-gradient-1: @stat-card-purple-gradient-1;
  --card-gradient-2: @stat-card-purple-gradient-2;
}

.ds-stat-card--orange {
  --icon-color: @stat-card-orange;
  --icon-bg-color: @stat-card-orange-bg;
  --icon-bg-color-light: @stat-card-orange-bg-light;
  --card-gradient-1: @stat-card-orange-gradient-1;
  --card-gradient-2: @stat-card-orange-gradient-2;
}

.ds-stat-card--red {
  --icon-color: @stat-card-red;
  --icon-bg-color: @stat-card-red-bg;
  --icon-bg-color-light: @stat-card-red-bg-light;
  --card-gradient-1: @stat-card-red-gradient-1;
  --card-gradient-2: @stat-card-red-gradient-2;
}

// 趋势颜色
.trend--up {
  color: @stat-card-green;
  background-color: rgba(103, 194, 58, 0.1);
}

.trend--down {
  color: @stat-card-red;
  background-color: rgba(245, 108, 108, 0.1);
}

.trend--stable {
  color: var(--td-gray-color-6);
  background-color: rgba(144, 147, 153, 0.1);
}

// 响应式设计
@media (max-width: 768px) {
  .ds-stat-card__content {
    gap: 14px;
  }

  .ds-stat-card__icon {
    width: 48px;
    height: 48px;
  }

  .ds-stat-card__value {
    font-size: var(--font-size-xxxl);
  }

  .ds-stat-card__label {
    font-size: var(--font-size-sm);
  }
}
</style>
