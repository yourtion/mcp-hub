<template>
  <t-dialog
    :visible="visible"
    header="管理验证密钥"
    :width="520"
    placement="center"
    :footer="false"
    @close="handleClose"
  >
    <div v-if="dialogLoading" style="padding: var(--space-10) 0">
      <t-loading size="medium" text="加载中..." />
    </div>

    <template v-else>
      <!-- Current status -->
      <div class="group-validation__status">
        <div class="group-validation__field">
          <span class="group-validation__label">验证状态</span>
          <t-tag
            :theme="validationEnabled ? 'success' : 'default'"
            variant="light"
          >
            {{ validationEnabled ? '已启用' : '未启用' }}
          </t-tag>
        </div>
        <div class="group-validation__field">
          <span class="group-validation__label">密钥状态</span>
          <t-tag
            :theme="hasKey ? 'success' : 'default'"
            variant="light"
          >
            {{ hasKey ? '已设置' : '未设置' }}
          </t-tag>
        </div>
      </div>

      <!-- Toggle validation -->
      <div class="group-validation__section">
        <t-form label-align="top" :label-width="0">
          <t-form-item label="启用/禁用验证">
            <t-switch
              :value="validationEnabled"
              @change="handleToggleValidation"
              :loading="actionLoading"
            />
          </t-form-item>
        </t-form>
      </div>

      <!-- Set validation key -->
      <div class="group-validation__section">
        <t-form label-align="top" :label-width="0">
          <t-form-item label="设置验证密钥">
            <div class="group-validation__key-row">
              <t-input
                v-model="validationKey"
                type="password"
                placeholder="输入新的验证密钥"
                clearable
              />
              <t-button
                theme="primary"
                :loading="actionLoading"
                :disabled="!validationKey.trim()"
                @click="handleSetKey"
              >
                设置
              </t-button>
            </div>
          </t-form-item>
        </t-form>
      </div>

      <!-- Generate key -->
      <div class="group-validation__section">
        <t-button
          variant="outline"
          block
          :loading="actionLoading"
          @click="handleGenerateKey"
        >
          生成随机密钥
        </t-button>
        <div v-if="generatedKey" class="group-validation__generated">
          <span class="group-validation__generated-label">已生成密钥：</span>
          <code class="group-validation__generated-key">{{ generatedKey }}</code>
          <t-button
            variant="text"
            size="small"
            @click="copyToClipboard(generatedKey)"
          >
            复制
          </t-button>
        </div>
      </div>

      <!-- Delete key -->
      <div class="group-validation__section group-validation__section--danger">
        <t-popconfirm
          content="确认删除验证密钥？删除后已配置的客户端将无法访问。"
          @confirm="handleDeleteKey"
        >
          <t-button
            theme="danger"
            variant="outline"
            block
            :loading="actionLoading"
            :disabled="!hasKey"
          >
            删除验证密钥
          </t-button>
        </t-popconfirm>
      </div>
    </template>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useGroupStore } from '@/stores/group';

const props = defineProps<{
  visible: boolean;
  groupId: string;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const groupStore = useGroupStore();
const dialogLoading = ref(false);
const actionLoading = ref(false);
const validationEnabled = ref(false);
const hasKey = ref(false);
const validationKey = ref('');
const generatedKey = ref('');

const currentGroup = computed(() =>
  groupStore.groupList.find((g) => g.id === props.groupId),
);

// Load current validation status when dialog opens
watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible && props.groupId) {
      dialogLoading.value = true;
      generatedKey.value = '';
      validationKey.value = '';
      try {
        const response = await groupStore.getGroupValidationKeyStatus(props.groupId);
        validationEnabled.value = response.data.validation.enabled;
        hasKey.value = response.data.validation.hasKey;
      } catch (err: unknown) {
        // Fallback to local store data
        if (currentGroup.value) {
          validationEnabled.value = currentGroup.value.validation.enabled;
          hasKey.value = currentGroup.value.validation.hasKey;
        }
      } finally {
        dialogLoading.value = false;
      }
    }
  },
);

async function handleToggleValidation(enabled: boolean) {
  actionLoading.value = true;
  try {
    await groupStore.setGroupValidationKey(props.groupId, {
      validationKey: '',
      enabled,
    });
    validationEnabled.value = enabled;
    MessagePlugin.success(enabled ? '验证已启用' : '验证已禁用');
  } catch (err: unknown) {
    MessagePlugin.error(
      err instanceof Error ? err.message : '切换验证状态失败',
    );
  } finally {
    actionLoading.value = false;
  }
}

async function handleSetKey() {
  if (!validationKey.value.trim()) return;
  actionLoading.value = true;
  try {
    await groupStore.setGroupValidationKey(props.groupId, {
      validationKey: validationKey.value.trim(),
      enabled: true,
    });
    validationEnabled.value = true;
    hasKey.value = true;
    validationKey.value = '';
    generatedKey.value = '';
    MessagePlugin.success('验证密钥已设置');
  } catch (err: unknown) {
    MessagePlugin.error(
      err instanceof Error ? err.message : '设置验证密钥失败',
    );
  } finally {
    actionLoading.value = false;
  }
}

async function handleGenerateKey() {
  actionLoading.value = true;
  try {
    const response = await groupStore.generateGroupValidationKey(props.groupId);
    generatedKey.value = response.data.validationKey;
    validationEnabled.value = response.data.validation.enabled;
    hasKey.value = response.data.validation.hasKey;
    MessagePlugin.success('验证密钥已生成');
  } catch (err: unknown) {
    MessagePlugin.error(
      err instanceof Error ? err.message : '生成验证密钥失败',
    );
  } finally {
    actionLoading.value = false;
  }
}

async function handleDeleteKey() {
  actionLoading.value = true;
  try {
    await groupStore.deleteGroupValidationKey(props.groupId);
    validationEnabled.value = false;
    hasKey.value = false;
    generatedKey.value = '';
    MessagePlugin.success('验证密钥已删除');
  } catch (err: unknown) {
    MessagePlugin.error(
      err instanceof Error ? err.message : '删除验证密钥失败',
    );
  } finally {
    actionLoading.value = false;
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    MessagePlugin.success('已复制到剪贴板');
  } catch {
    MessagePlugin.error('复制失败，请手动复制');
  }
}

function handleClose() {
  emit('update:visible', false);
}
</script>

<style scoped>
.group-validation__status {
  display: flex;
  gap: var(--space-6);
  margin-bottom: var(--space-5);
  padding: var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.group-validation__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.group-validation__label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--weight-medium);
}

.group-validation__section {
  margin-bottom: var(--space-4);
}

.group-validation__section--danger {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}

.group-validation__key-row {
  display: flex;
  gap: var(--space-2);
  width: 100%;
}

.group-validation__key-row .t-input {
  flex: 1;
}

.group-validation__generated {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.group-validation__generated-label {
  color: var(--text-secondary);
  white-space: nowrap;
}

.group-validation__generated-key {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--accent);
  word-break: break-all;
  flex: 1;
}
</style>
