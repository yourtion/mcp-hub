<template>
  <t-dialog
    v-model:visible="dialogVisible"
    header="备份管理"
    width="800px"
    :footer="false"
  >
    <div class="backup-dialog-content">
      <div class="backup-header">
        <t-button
          theme="primary"
          @click="handleCreateBackup"
        >
          <template #icon>
            <AddIcon />
          </template>
          创建新备份
        </t-button>
      </div>
      
      <div class="backup-list">
        <div
          v-for="backup in backups"
          :key="backup.id"
          class="backup-item"
        >
          <div class="backup-info">
            <div class="backup-time">{{ formatTime(backup.timestamp) }}</div>
            <div class="backup-description">{{ backup.description || '无描述' }}</div>
            <div class="backup-meta">
              <t-space>
                <span class="backup-size">{{ formatSize(backup.size) }}</span>
                <span class="backup-user">{{ backup.user }}</span>
                <div class="backup-types">
                  <t-tag
                    v-for="type in backup.configTypes"
                    :key="type"
                    size="small"
                    theme="primary"
                    variant="light"
                  >
                    {{ type }}
                  </t-tag>
                </div>
              </t-space>
            </div>
          </div>
          <div class="backup-actions">
            <t-button
              theme="success"
              variant="outline"
              size="small"
              @click="handleRestoreBackup(backup.id)"
            >
              恢复
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
import { AddIcon } from 'tdesign-icons-vue-next';
import type { ConfigBackup, ConfigType } from '@/types/config';

// Props
interface Props {
  visible: boolean;
  backups: ConfigBackup[];
  total: number;
  loading: boolean;
}

const props = defineProps<Props>();

// Emits
interface Emits {
  (e: 'update:visible', visible: boolean): void;
  (e: 'create-backup'): void;
  (e: 'restore-backup', backupId: string, configTypes?: ConfigType[]): void;
  (e: 'load-more', offset: number): void;
}

const emit = defineEmits<Emits>();

// 响应式数据
const dialogVisible = ref(props.visible);

// 计算属性
const hasMore = computed(() => props.backups.length < props.total);

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

const formatSize = (size: number): string => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const handleCreateBackup = (): void => {
  emit('create-backup');
};

const handleRestoreBackup = (backupId: string): void => {
  emit('restore-backup', backupId);
};

const handleLoadMore = (): void => {
  emit('load-more', props.backups.length);
};
</script>

<style scoped>
.backup-dialog-content {
  max-height: 600px;
  overflow-y: auto;
}

.backup-header {
  margin-bottom: 20px;
  text-align: right;
}

.backup-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.backup-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #f9fafb;
}

.backup-info {
  flex: 1;
}

.backup-time {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 4px;
}

.backup-description {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 8px;
}

.backup-meta {
  font-size: 12px;
  color: #9ca3af;
}

.backup-size,
.backup-user {
  margin-right: 12px;
}

.backup-types {
  display: inline-flex;
  gap: 4px;
}

.backup-actions {
  flex-shrink: 0;
  margin-left: 16px;
}

.loading-more,
.load-more {
  display: flex;
  justify-content: center;
  padding: 16px;
}
</style>