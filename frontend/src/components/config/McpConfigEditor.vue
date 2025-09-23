<template>
  <div class="mcp-config-editor">
    <config-section
      title="MCP服务器配置"
      description="配置MCP服务器连接和传输参数"
      icon="server"
    >
      <div class="server-list">
        <div
          v-for="(server, serverId) in localConfig.mcpServers"
          :key="serverId"
          class="server-item"
        >
          <div class="server-header">
            <h5 class="server-name">{{ serverId }}</h5>
            <t-button
              theme="danger"
              variant="text"
              size="small"
              @click="handleDeleteServer(serverId)"
            >
              <t-icon name="delete" />
            </t-button>
          </div>
          
          <t-form :data="server" layout="vertical">
            <t-row :gutter="16">
              <t-col :span="12">
                <t-form-item label="命令" name="command">
                  <t-input
                    v-model="server.command"
                    placeholder="请输入启动命令"
                    @change="handleChange"
                  />
                </t-form-item>
              </t-col>
              <t-col :span="12">
                <t-form-item label="工作目录" name="cwd">
                  <t-input
                    v-model="server.cwd"
                    placeholder="请输入工作目录"
                    @change="handleChange"
                  />
                </t-form-item>
              </t-col>
            </t-row>
            
            <!-- 参数配置 -->
            <t-form-item label="启动参数" name="args">
              <t-tag-input
                v-model="server.args"
                placeholder="请输入启动参数"
                @change="handleChange"
              />
            </t-form-item>
            
            <!-- 环境变量配置 -->
            <t-form-item label="环境变量" name="env">
              <div class="env-vars">
                <div
                  v-for="(value, key) in server.env"
                  :key="key"
                  class="env-var-item"
                >
                  <t-input
                    :value="key"
                    placeholder="变量名"
                    readonly
                  />
                  <t-input
                    v-model="server.env[key]"
                    placeholder="变量值"
                    @change="handleChange"
                  />
                  <t-button
                    theme="danger"
                    variant="text"
                    size="small"
                    @click="handleDeleteEnvVar(serverId, key)"
                  >
                    <t-icon name="delete" />
                  </t-button>
                </div>
                <t-button
                  theme="default"
                  variant="dashed"
                  size="small"
                  @click="handleAddEnvVar(serverId)"
                >
                  <template #icon>
                    <t-icon name="add" />
                  </template>
                  添加环境变量
                </t-button>
              </div>
            </t-form-item>
          </t-form>
        </div>
        
        <!-- 添加服务器按钮 -->
        <t-button
          theme="primary"
          variant="dashed"
          @click="handleAddServer"
        >
          <template #icon>
            <t-icon name="add" />
          </template>
          添加MCP服务器
        </t-button>
      </div>
    </config-section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import type { McpConfig } from '@/types/config';
import ConfigSection from './ConfigSection.vue';

// Props
interface Props {
  config: McpConfig;
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
  (e: 'change', config: McpConfig): void;
}

const emit = defineEmits<Emits>();

// 响应式数据
const localConfig = ref<McpConfig>(JSON.parse(JSON.stringify(props.config)));

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

const handleAddServer = (): void => {
  const serverId = `server_${Date.now()}`;
  localConfig.value.mcpServers[serverId] = {
    command: '',
    args: [],
    env: {},
  };
  handleChange();
};

const handleDeleteServer = (serverId: string): void => {
  delete localConfig.value.mcpServers[serverId];
  handleChange();
  MessagePlugin.success('服务器删除成功');
};

const handleAddEnvVar = (serverId: string): void => {
  const key = `ENV_${Date.now()}`;
  if (!localConfig.value.mcpServers[serverId].env) {
    localConfig.value.mcpServers[serverId].env = {};
  }
  localConfig.value.mcpServers[serverId].env![key] = '';
  handleChange();
};

const handleDeleteEnvVar = (serverId: string, key: string): void => {
  if (localConfig.value.mcpServers[serverId].env) {
    delete localConfig.value.mcpServers[serverId].env[key];
    handleChange();
  }
};
</script>

<style scoped>
.mcp-config-editor {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.server-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.server-item {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 16px;
  background-color: #f9fafb;
}

.server-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.server-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.env-vars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.env-var-item {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>