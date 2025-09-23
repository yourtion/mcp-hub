<template>
  <div class="config-category-nav">
    <div class="category-list">
      <div
        v-for="category in categories"
        :key="category.key"
        class="category-item"
        :class="{ active: selectedCategory === category.key }"
        @click="handleCategoryClick(category.key)"
      >
        <div class="category-icon">
          <t-icon :name="category.icon || 'setting'" />
        </div>
        <div class="category-content">
          <div class="category-label">{{ category.label }}</div>
          <div class="category-description">{{ category.description }}</div>
        </div>
        <div class="category-type-badge">
          <t-tag
            :theme="getConfigTypeTheme(category.configType)"
            size="small"
            variant="light"
          >
            {{ getConfigTypeLabel(category.configType) }}
          </t-tag>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConfigCategory, ConfigType } from '@/types/config';

// Props
interface Props {
  categories: ConfigCategory[];
  selectedCategory?: string;
}

const props = withDefaults(defineProps<Props>(), {
  selectedCategory: undefined,
});

// Emits
interface Emits {
  (e: 'category-select', categoryKey: string): void;
}

const emit = defineEmits<Emits>();

// 事件处理函数
const handleCategoryClick = (categoryKey: string): void => {
  emit('category-select', categoryKey);
};

// 获取配置类型主题
const getConfigTypeTheme = (configType: ConfigType): string => {
  switch (configType) {
    case 'system':
      return 'primary';
    case 'mcp':
      return 'success';
    case 'groups':
      return 'warning';
    default:
      return 'default';
  }
};

// 获取配置类型标签
const getConfigTypeLabel = (configType: ConfigType): string => {
  switch (configType) {
    case 'system':
      return '系统';
    case 'mcp':
      return 'MCP';
    case 'groups':
      return '组';
    default:
      return '未知';
  }
};
</script>

<style scoped>
.config-category-nav {
  width: 100%;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #e5e7eb;
  background-color: #ffffff;
}

.category-item:hover {
  border-color: #3b82f6;
  background-color: #f8fafc;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.category-item.active {
  border-color: #3b82f6;
  background-color: #eff6ff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}

.category-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background-color: #f3f4f6;
  color: #6b7280;
  margin-right: 12px;
  transition: all 0.2s ease;
}

.category-item:hover .category-icon,
.category-item.active .category-icon {
  background-color: #3b82f6;
  color: #ffffff;
}

.category-content {
  flex: 1;
  min-width: 0;
}

.category-label {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 4px;
  line-height: 1.4;
}

.category-description {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.category-type-badge {
  flex-shrink: 0;
  margin-left: 8px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .category-item {
    padding: 12px;
  }
  
  .category-icon {
    width: 32px;
    height: 32px;
    margin-right: 8px;
  }
  
  .category-label {
    font-size: 13px;
  }
  
  .category-description {
    font-size: 11px;
  }
}

/* 暗色主题支持 */
@media (prefers-color-scheme: dark) {
  .category-item {
    border-color: #374151;
    background-color: #1f2937;
  }
  
  .category-item:hover {
    border-color: #60a5fa;
    background-color: #111827;
  }
  
  .category-item.active {
    border-color: #60a5fa;
    background-color: #1e3a8a;
  }
  
  .category-icon {
    background-color: #374151;
    color: #9ca3af;
  }
  
  .category-label {
    color: #f9fafb;
  }
  
  .category-description {
    color: #9ca3af;
  }
}
</style>