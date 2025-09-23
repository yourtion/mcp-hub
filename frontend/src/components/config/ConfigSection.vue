<template>
  <div class="config-section">
    <div class="section-header" @click="toggleCollapse">
      <div class="header-left">
        <div class="section-icon">
          <t-icon :name="icon" />
        </div>
        <div class="section-info">
          <h4 class="section-title">{{ title }}</h4>
          <p class="section-description">{{ description }}</p>
        </div>
      </div>
      <div class="header-right">
        <t-button
          theme="default"
          variant="text"
          size="small"
          :class="{ rotated: !collapsed }"
        >
          <t-icon name="chevron-down" />
        </t-button>
      </div>
    </div>
    
    <t-collapse-transition>
      <div v-show="!collapsed" class="section-content">
        <slot />
      </div>
    </t-collapse-transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// Props
interface Props {
  title: string;
  description?: string;
  icon?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  icon: 'setting',
  collapsible: true,
  defaultCollapsed: false,
});

// 响应式数据
const collapsed = ref(props.defaultCollapsed);

// 方法
const toggleCollapse = (): void => {
  if (props.collapsible) {
    collapsed.value = !collapsed.value;
  }
};
</script>

<style scoped>
.config-section {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #ffffff;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.section-header:hover {
  background-color: #f3f4f6;
}

.header-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.section-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background-color: #3b82f6;
  color: #ffffff;
  margin-right: 12px;
  flex-shrink: 0;
}

.section-info {
  flex: 1;
  min-width: 0;
}

.section-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.4;
}

.section-description {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.4;
}

.header-right {
  flex-shrink: 0;
  margin-left: 16px;
}

.header-right .t-button {
  transition: transform 0.2s ease;
}

.header-right .t-button.rotated {
  transform: rotate(180deg);
}

.section-content {
  padding: 24px 20px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .section-header {
    padding: 12px 16px;
  }
  
  .section-icon {
    width: 28px;
    height: 28px;
    margin-right: 8px;
  }
  
  .section-title {
    font-size: 15px;
  }
  
  .section-description {
    font-size: 12px;
  }
  
  .section-content {
    padding: 16px;
  }
}

/* 暗色主题支持 */
@media (prefers-color-scheme: dark) {
  .config-section {
    border-color: #374151;
    background-color: #1f2937;
  }
  
  .section-header {
    background-color: #111827;
    border-color: #374151;
  }
  
  .section-header:hover {
    background-color: #0f172a;
  }
  
  .section-title {
    color: #f9fafb;
  }
  
  .section-description {
    color: #9ca3af;
  }
}
</style>