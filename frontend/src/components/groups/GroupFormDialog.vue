<template>
  <t-dialog
    v-model:visible="dialogVisible"
    :header="dialogTitle"
    width="600px"
    :confirm-btn="confirmBtnProps"
    :cancel-btn="{ content: '取消' }"
    @confirm="handleSubmit"
    @cancel="handleCancel"
    @close="handleCancel"
  >
    <div class="group-form">
      <t-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-align="top"
        @submit="handleSubmit"
      >
        <!-- 基本信息 -->
        <div class="form-section">
          <h4 class="section-title">基本信息</h4>
          
          <t-form-item 
            label="组ID" 
            name="id"
            :help="mode === 'edit' ? '组ID创建后不可修改' : '组的唯一标识符，创建后不可修改'"
          >
            <t-input
              v-model="formData.id"
              placeholder="请输入组ID，如: my-group"
              :disabled="mode === 'edit'"
            />
          </t-form-item>

          <t-form-item label="组名称" name="name">
            <t-input
              v-model="formData.name"
              placeholder="请输入组名称"
            />
          </t-form-item>

          <t-form-item label="组描述" name="description">
            <t-textarea
              v-model="formData.description"
              placeholder="请输入组描述（可选）"
              :autosize="{ minRows: 3, maxRows: 5 }"
            />
          </t-form-item>
        </div>

        <!-- 服务器选择 -->
        <div class="form-section">
          <h4 class="section-title">服务器选择</h4>
          <div class="server-selection">
            <t-checkbox-group
              v-model="formData.servers"
              :options="serverOptions"
              class="server-checkbox-group"
            />
            <div v-if="availableServers.length === 0" class="no-servers">
              <t-alert theme="warning">
                当前没有可用的服务器，请先配置服务器
              </t-alert>
            </div>
          </div>
        </div>

        <!-- 工具过滤 -->
        <div class="form-section">
          <h4 class="section-title">工具过滤</h4>
          <div class="tool-filter">
            <t-checkbox
              v-model="enableToolFilter"
              @change="handleToolFilterChange"
            >
              启用工具过滤
            </t-checkbox>
            
            <div v-if="enableToolFilter" class="tool-selection">
              <p class="tool-selection__description">
                选择该组可访问的工具，未选择的工具将被过滤
              </p>
              <t-tree
                v-model:checked="formData.tools"
                :data="toolTreeData"
                checkable
                check-strictly
                :expand-all="true"
                class="tool-tree"
              />
              <div v-if="availableTools.length === 0" class="no-tools">
                <t-alert theme="warning">
                  当前没有可用的工具，请先配置服务器
                </t-alert>
              </div>
            </div>
          </div>
        </div>
      </t-form>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import type { FormInstance, FormRule, TreeNodeData } from 'tdesign-vue-next';
import { useServerStore } from '@/stores/server';
import { useGroupStore } from '@/stores/group';
import type { CreateGroupRequest, GroupInfo, UpdateGroupRequest } from '@/types/group';

interface Props {
  visible: boolean;
  group?: GroupInfo | null;
  mode: 'create' | 'edit';
}

interface Emits {
  'update:visible': [visible: boolean];
  'success': [];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 状态
const serverStore = useServerStore();
const groupStore = useGroupStore();
const formRef = ref<FormInstance>();
const enableToolFilter = ref(false);

// 计算属性
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const dialogTitle = computed(() => 
  props.mode === 'create' ? '创建组' : '编辑组'
);

const confirmBtnProps = computed(() => ({
  content: props.mode === 'create' ? '创建' : '保存',
  theme: 'primary',
  loading: groupStore.loading,
}));

const availableServers = computed(() => 
  serverStore.serverList.map(server => ({
    label: `${server.name} (${server.id})`,
    value: server.id,
  }))
);

const serverOptions = computed(() => 
  availableServers.value.map(server => ({
    label: server.label,
    value: server.value,
    disabled: false,
  }))
);

const availableTools = computed(() => {
  const selectedServers = formData.value.servers || [];
  return serverStore.serverList
    .filter(server => selectedServers.includes(server.id))
    .flatMap(server => 
      (server.tools || []).map(tool => ({
        ...tool,
        serverId: server.id,
        serverName: server.name,
      }))
    );
});

const toolTreeData = computed((): TreeNodeData[] => {
  const toolsByServer = availableTools.value.reduce((acc, tool) => {
    if (!acc[tool.serverId]) {
      acc[tool.serverId] = {
        id: tool.serverId,
        label: tool.serverName,
        children: [],
      };
    }
    acc[tool.serverId].children?.push({
      id: tool.name,
      label: tool.name,
      value: tool.name,
    });
    return acc;
  }, {} as Record<string, TreeNodeData>);

  return Object.values(toolsByServer);
});

// 表单数据
const formData = ref({
  id: '',
  name: '',
  description: '',
  servers: [] as string[],
  tools: [] as string[],
});

// 表单验证规则
const formRules: Record<string, FormRule[]> = {
  id: [
    { required: true, message: '请输入组ID', trigger: 'blur' },
    { 
      pattern: /^[a-zA-Z0-9_-]+$/, 
      message: '组ID只能包含字母、数字、连字符和下划线',
      trigger: 'blur',
    },
    { 
      min: 1, 
      max: 50, 
      message: '组ID长度必须在1-50个字符之间',
      trigger: 'blur',
    },
  ],
  name: [
    { required: true, message: '请输入组名称', trigger: 'blur' },
    {
      max: 100,
      message: '组名称长度不能超过100个字符',
      trigger: 'blur',
    },
  ],
  description: [
    {
      max: 500,
      message: '组描述长度不能超过500个字符',
      trigger: 'blur',
    },
  ],
  servers: [
    {
      validator: (value: string[]) => {
        if (!value || value.length === 0) {
          return { result: false, message: '请至少选择一个服务器', type: 'error' };
        }
        return { result: true, type: 'success' };
      },
      trigger: 'change',
    },
  ],
};

// 方法
const resetForm = () => {
  formData.value = {
    id: '',
    name: '',
    description: '',
    servers: [],
    tools: [],
  };
  enableToolFilter.value = false;
  formRef.value?.clearValidate();
};

const handleToolFilterChange = (checked: boolean) => {
  if (!checked) {
    formData.value.tools = [];
  }
};

const handleSubmit = async () => {
  try {
    const valid = await formRef.value?.validate();
    if (!valid) return;

    const submitData = {
      ...formData.value,
      tools: enableToolFilter.value ? formData.value.tools : [],
    };

    if (props.mode === 'create') {
      await groupStore.createGroup(submitData as CreateGroupRequest);
      MessagePlugin.success('组创建成功');
    } else {
      if (!props.group) return;
      await groupStore.updateGroup(props.group.id, submitData as UpdateGroupRequest);
      MessagePlugin.success('组更新成功');
    }

    emit('success');
  } catch (error) {
    console.error('表单提交失败:', error);
  }
};

const handleCancel = () => {
  resetForm();
  emit('update:visible', false);
};

// 监听器
watch(
  () => props.visible,
  (visible) => {
    if (visible && props.group) {
      // 编辑模式
      formData.value = {
        id: props.group.id,
        name: props.group.name,
        description: props.group.description || '',
        servers: props.group.servers,
        tools: props.group.tools,
      };
      enableToolFilter.value = props.group.toolFilterMode === 'whitelist';
    } else if (visible) {
      // 创建模式
      resetForm();
      nextTick(() => {
        // 确保服务器列表已加载
        serverStore.fetchServers();
      });
    }
  },
  { immediate: true }
);

// 监听选中的服务器变化，清空工具选择
watch(
  () => formData.value.servers,
  (newServers, oldServers) => {
    if (newServers.length !== oldServers?.length) {
      formData.value.tools = [];
    }
  },
  { deep: true }
);
</script>

<style scoped>
.group-form {
  padding: 16px 0;
}

.form-section {
  margin-bottom: 32px;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--td-text-color-primary);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--td-component-border);
}

.server-selection {
  min-height: 100px;
}

.server-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.no-servers {
  margin-top: 16px;
}

.tool-filter {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tool-selection__description {
  margin: 0;
  font-size: 14px;
  color: var(--td-text-color-secondary);
  line-height: 1.5;
}

.tool-tree {
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-default);
  padding: 8px;
  min-height: 200px;
}

.no-tools {
  margin-top: 16px;
}
</style>