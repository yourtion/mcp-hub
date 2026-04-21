<template>
  <div class="execution-detail mcp-card">
    <div class="execution-detail__header">
      <div class="execution-detail__meta">
        <span class="execution-detail__tool">{{ execution.toolName }}</span>
        <span class="execution-detail__server">{{ execution.serverId }}</span>
        <span
          class="execution-detail__badge"
          :class="
            execution.isError
              ? 'execution-detail__badge--error'
              : 'execution-detail__badge--success'
          "
        >
          {{ execution.isError ? '执行失败' : '执行成功' }}
        </span>
      </div>
      <div class="execution-detail__time">
        <span class="execution-detail__time-badge">
          {{ executionTimeFormatted }}
        </span>
        <span class="execution-detail__timestamp">{{ timeFormatted }}</span>
      </div>
    </div>

    <!-- Result Content -->
    <div v-if="hasResults" class="execution-detail__results">
      <div v-for="(item, index) in resultItems" :key="index" class="execution-detail__result-item">
        <!-- Text result -->
        <template v-if="item.type === 'text' && item.text">
          <pre class="mcp-code">{{ item.text }}</pre>
        </template>

        <!-- Image result -->
        <template v-else-if="item.type === 'image' && item.data">
          <div class="execution-detail__image-wrap">
            <img
              :src="imageSrc(item)"
              :alt="`Result image ${index + 1}`"
              class="execution-detail__image"
            />
          </div>
        </template>

        <!-- Resource result -->
        <template v-else-if="item.type === 'resource'">
          <div class="execution-detail__resource">
            <span v-if="item.uri" class="execution-detail__resource-uri">
              {{ item.uri }}
            </span>
            <span v-if="item.text" class="mcp-code">{{ item.text }}</span>
          </div>
        </template>
      </div>
    </div>

    <!-- Error message -->
    <div v-if="execution.isError && errorMessage" class="execution-detail__error">
      <pre class="mcp-code execution-detail__error-text">{{ errorMessage }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { ToolExecution, ToolExecuteResponse, ToolResult } from '@/types/tool';

type ExecutionData = ToolExecution | ToolExecuteResponse;

const props = defineProps<{
  execution: ExecutionData;
}>();

const resultItems = computed((): ToolResult[] => {
  return props.execution.result || [];
});

const hasResults = computed(() => resultItems.value.length > 0);

const errorMessage = computed(() => {
  if (!props.execution.isError) return null;
  const textResults = resultItems.value
    .filter((r) => r.type === 'text' && r.text)
    .map((r) => r.text);
  return textResults.length > 0 ? textResults.join('\n') : null;
});

const executionTimeFormatted = computed(() => {
  const ms = props.execution.executionTime;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
});

const timeFormatted = computed(() => {
  try {
    const date = new Date(props.execution.timestamp);
    return date.toLocaleString('zh-CN');
  } catch {
    return props.execution.timestamp;
  }
});

const imageSrc = (item: ToolResult): string => {
  if (!item.data) return '';
  const mime = item.mimeType || 'image/png';
  return `data:${mime};base64,${item.data}`;
};
</script>

<style scoped>
.execution-detail {
  padding: var(--space-5);
}

.execution-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.execution-detail__meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.execution-detail__tool {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
}

.execution-detail__server {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.execution-detail__badge {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  padding: 2px 10px;
  border-radius: var(--radius-full);
}

.execution-detail__badge--success {
  color: var(--success);
  background: var(--success-light);
}

.execution-detail__badge--error {
  color: var(--danger);
  background: var(--danger-light);
}

.execution-detail__time {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.execution-detail__time-badge {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--accent);
  background: var(--accent-light);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.execution-detail__timestamp {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.execution-detail__results {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.execution-detail__result-item {
  animation: fadeIn var(--transition-base);
}

.execution-detail__image-wrap {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  max-width: 100%;
}

.execution-detail__image {
  display: block;
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
}

.execution-detail__resource {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.execution-detail__resource-uri {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--accent);
  word-break: break-all;
}

.execution-detail__error {
  margin-top: var(--space-3);
}

.execution-detail__error-text {
  color: var(--danger);
  border-color: var(--danger-light);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
