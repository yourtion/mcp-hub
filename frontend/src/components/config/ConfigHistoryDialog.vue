<template>
  <t-dialog
    v-model:visible="dialogVisible"
    header="配置历史"
    width="900px"
    :footer="false"
  >
    <div class="history-dialog-content">
      <div class="history-list">
        <div
          v-for="entry in historyEntries"
          :key="entry.id"
          class="history-item"
        >
          <div class="history-header">
            <div class="history-time">{{ formatTime(entry.timestamp) }}</div>
            <div class="history-user">{{ entry.user }}</div>
            <div class="history-type">
              <t-tag size="small" theme="primary">{{ entry.configType }}</t-tag>
            </div>
          </div>
          <div class="history-description">{{ entry.description || '无描述' }}</div>
          <div class="history-actions">
            <t-button
              theme="primary"
              variant="text"
              size="small"
              @click="handleRestore(entry)"
            >
              恢复此版本
            </t-button>
          </div>
        </div>
      </div>
      
      <div v-if="loading" class="loading-more">
        <t-loading size="small" text="加载中..." />
      </div>
      
      <div v-if="hasMore" class="load-more">
        <t-button
          theme="default"
          variant="outline"
          @click="handleLoadMore"
        >
          加载更多
        </t-button>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ConfigHistoryEntry } from '@/types/config';

// Props
interface Props {
  visible: boolean;
  historyEntries: ConfigHistoryEntry[];
  total: number;
  loading: boolean;
}

const props = defineProps<Props>();

// Emits
interface Emits {
  (e: 'update:visible', visible: boolean): void;
  (e: 'load-more', offset: number): void;
  (e: 'restore', entry: ConfigHistoryEntry): void;
}

const emit = defineEmits<Emits>();

// 响应式数据
const dialogVisible = ref(props.visible);

// 计算属性
const hasMore = computed(() => props.historyEntries.length < props.total);

// 监听visible变化
watch(
  () => props.visible,
  (newVisible) => {
    dialogVisible.value = newVisible;
  }
);

watch(
  () => dialogVisible.value,
  (newVisible) => {
    emit('update:visible', newVisible);
  }
);

// 方法
const formatTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  } catch {
    return '未知时间';
  }
};

const handleLoadMore = (): void => {
  emit('load-more', props.historyEntries.length);
};

const handleRestore = (entry: ConfigHistoryEntry): void => {
  emit('restore', entry);
};
</script>

<style scoped>
.history-dialog-content {
  max-height: 600px;
  overflow-y: auto;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-item {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #f9fafb;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.history-time {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.history-user {
  font-size: 12px;
  color: #6b7280;
}

.history-description {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 12px;
}

.history-actions {
  display: flex;
  justify-content: flex-end;
}

.loading-more,
.load-more {
  display: flex;
  justify-content: center;
  padding: 16px;
}
</style>