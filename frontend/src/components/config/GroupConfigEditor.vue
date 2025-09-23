<template>
  <div class="group-config-editor">
    <config-section
      title="组配置管理"
      description="管理服务器组和工具过滤规则"
      icon="usergroup"
    >
      <div class="group-list">
        <div
          v-for="(group, groupId) in localConfig"
          :key="groupId"
          class="group-item"
        >
          <div class="group-header">
            <h5 class="group-name">{{ group.name || groupId }}</h5>
            <t-button
              theme="danger"
              variant="text"
              size="small"
              @click="handleDeleteGroup(groupId)"
            >
              <t-icon name="delete" />
            </t-button>
          </div>
          
          <t-form :data="group" layout="vertical">
            <t-row :gutter="16">
              <t-col :span="12">
                <t-form-item label="组名称" name="name">
                  <t-input
                    v-model="group.name"
                    placeholder="请输入组名称"
                    @change="handleChange"
                  />
                </t-form-item>
              </t-col>
              <t-col :span="12">
                <t-form-item label="组ID" name="id">
                  <t-input
                    v-model="group.id"
                    placeholder="请输入组ID"
                    @change="handleChange"
                  />
                </t-form-item>
              </t-col>
            </t-row>
            
            <t-form-item label="描述" name="description">
              <t-textarea
                v-model="group.description"
                placeholder="请输入组描述"
                @change="handleChange"
              />
            </t-form-item>
            
            <t-row :gutter="16">
              <t-col :span="12">
                <t-form-item label="服务器" name="servers">
                  <t-select
                    v-model="group.servers"
                    placeholder="请选择服务器"
                    multiple
                    @change="handleChange"
                  >
                    <t-option
                      v-for="server in availableServers"
                      :key="server"
                      :value="server"
                      :label="server"
                    />
                  </t-select>
                </t-form-item>
              </t-col>
              <t-col :span="12">
                <t-form-item label="工具" name="tools">
                  <t-select
                    v-model="group.tools"
                    placeholder="请选择工具"
                    multiple
                    @change="handleChange"
                  >
                    <t-option
                      v-for="tool in availableTools"
                      :key="tool"
                      :value="tool"
                      :label="tool"
                    />
                  </t-select>
                </t-form-item>
              </t-col>
            </t-row>
            
            <!-- 验证配置 -->
            <config-subsection title="验证配置">
              <t-form-item label="启用验证" name="validation.enabled">
                <t-switch
                  v-model="group.validation.enabled"
                  @change="handleChange"
                />
              </t-form-item>
              
              <t-form-item
                v-if="group.validation?.enabled"
                label="验证密钥"
                name="validation.validationKey"
              >
                <t-input
                  v-model="group.validation.validationKey"
                  type="password"
                  placeholder="请输入验证密钥"
                  @change="handleChange"
                />
              </t-form-item>
            </config-subsection>
          </t-form>
        </div>
        
        <!-- 添加组按钮 -->
        <t-button
          theme="primary"
          variant="dashed"
          @click="handleAddGroup"
        >
          <template #icon>
            <t-icon name="add" />
          </template>
          添加组
        </t-button>
      </div>
    </config-section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import type { GroupConfig } from '@/types/config';
import ConfigSection from './ConfigSection.vue';
import ConfigSubsection from './ConfigSubsection.vue';

// Props
interface Props {
  config: GroupConfig;
  selectedCategory?: string;
  searchKeyword?: string;
  showAdvanced?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selectedCategory: undefined,
  searchKeyword: '',
  showAdvanced: false,
});

// Emits
interface Emits {
  (e: 'change', config: GroupConfig): void;
}

const emit = defineEmits<Emits>();

// 响应式数据
const localConfig = ref<GroupConfig>(JSON.parse(JSON.stringify(props.config)));

// 计算属性 - 模拟可用的服务器和工具
const availableServers = computed(() => [
  'server1',
  'server2',
  'server3',
]);

const availableTools = computed(() => [
  'tool1',
  'tool2',
  'tool3',
]);

// 监听配置变化
watch(
  () => props.config,
  (newConfig) => {
    localConfig.value = JSON.parse(JSON.stringify(newConfig));
  },
  { deep: true }
);

// 方法
const handleChange = (): void => {
  emit('change', localConfig.value);
};

const handleAddGroup = (): void => {
  const groupId = `group_${Date.now()}`;
  localConfig.value[groupId] = {
    id: groupId,
    name: '',
    description: '',
    servers: [],
    tools: [],
    validation: {
      enabled: false,
    },
  };
  handleChange();
};

const handleDeleteGroup = (groupId: string): void => {
  delete localConfig.value[groupId];
  handleChange();
  MessagePlugin.success('组删除成功');
};
</script>

<style scoped>
.group-config-editor {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.group-item {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 16px;
  background-color: #f9fafb;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.group-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}
</style>