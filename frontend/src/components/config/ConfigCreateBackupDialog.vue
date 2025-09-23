<template>
  <t-dialog
    v-model:visible="dialogVisible"
    header="创建配置备份"
    width="500px"
    :confirm-btn="{ content: '创建备份', theme: 'primary' }"
    :cancel-btn="{ content: '取消', theme: 'default' }"
    @confirm="handleConfirm"
  >
    <div class="create-backup-content">
      <t-form :data="formData" layout="vertical">
        <t-form-item label="备份描述" name="description">
          <t-textarea
            v-model="formData.description"
            placeholder="请输入备份描述（可选）"
            :maxlength="200"
          />
        </t-form-item>
        
        <t-form-item label="包含的配置类型" name="includeTypes">
          <t-checkbox-group v-model="formData.includeTypes">
            <t-checkbox value="system">系统配置</t-checkbox>
            <t-checkbox value="mcp">MCP配置</t-checkbox>
            <t-checkbox value="groups">组配置</t-checkbox>
          </t-checkbox-group>
        </t-form-item>
      </t-form>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { ConfigType } from '@/types/config';

// Props
interface Props {
  visible: boolean;
}

const props = defineProps<Props>();

// Emits
interface Emits {
  (e: 'update:visible', visible: boolean): void;
  (e: 'create', description: string, includeTypes: ConfigType[]): void;
}

const emit = defineEmits<Emits>();

// 响应式数据
const dialogVisible = ref(props.visible);
const formData = ref({
  description: '',
  includeTypes: ['system', 'mcp', 'groups'] as ConfigType[],
});

// 监听visible变化
watch(
  () => props.visible,
  (newVisible) => {
    dialogVisible.value = newVisible;
    if (newVisible) {
      // 重置表单
      formData.value = {
        description: '',
        includeTypes: ['system', 'mcp', 'groups'] as ConfigType[],
      };
    }
  }
);

watch(
  () => dialogVisible.value,
  (newVisible) => {
    emit('update:visible', newVisible);
  }
);

// 方法
const handleConfirm = (): void => {
  emit('create', formData.value.description, formData.value.includeTypes);
};
</script>

<style scoped>
.create-backup-content {
  padding: 8px 0;
}
</style>