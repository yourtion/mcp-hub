<template>
  <div class="config-subsection">
    <div class="subsection-header">
      <h5 class="subsection-title">{{ title }}</h5>
      <p v-if="description" class="subsection-description">{{ description }}</p>
    </div>
    <div class="subsection-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// Props
interface Props {
  title: string;
  description?: string;
}

withDefaults(defineProps<Props>(), {
  description: '',
});
</script>

<style scoped>
.config-subsection {
  margin-bottom: 24px;
}

.config-subsection:last-child {
  margin-bottom: 0;
}

.subsection-header {
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.subsection-title {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  line-height: 1.4;
}

.subsection-description {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
}

.subsection-content {
  /* 内容区域样式 */
}

/* 响应式设计 */
@media (max-width: 768px) {
  .config-subsection {
    margin-bottom: 20px;
  }
  
  .subsection-header {
    margin-bottom: 12px;
  }
  
  .subsection-title {
    font-size: 13px;
  }
  
  .subsection-description {
    font-size: 11px;
  }
}

/* 暗色主题支持 */
@media (prefers-color-scheme: dark) {
  .subsection-header {
    border-color: #374151;
  }
  
  .subsection-title {
    color: #e5e7eb;
  }
  
  .subsection-description {
    color: #9ca3af;
  }
}
</style>