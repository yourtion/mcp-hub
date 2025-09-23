<template>
  <div class="global-config-view">
    <div class="config-overview">
      <h4>配置概览</h4>
      <p>查看和管理所有配置项的全局视图</p>
    </div>
    
    <!-- 配置统计卡片 -->
    <div class="config-stats">
      <t-row :gutter="16">
        <t-col :span="8">
          <t-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon system">
                <t-icon name="setting" />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ systemConfigCount }}</div>
                <div class="stat-label">系统配置项</div>
              </div>
            </div>
          </t-card>
        </t-col>
        <t-col :span="8">
          <t-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon mcp">
                <t-icon name="server" />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ mcpServerCount }}</div>
                <div class="stat-label">MCP服务器</div>
              </div>
            </div>
          </t-card>
        </t-col>
        <t-col :span="8">
          <t-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon groups">
                <t-icon name="usergroup" />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ groupCount }}</div>
                <div class="stat-label">配置组</div>
              </div>
            </div>
          </t-card>
        </t-col>
      </t-row>
    </div>
    
    <!-- 快速配置入口 -->
    <div class="quick-config">
      <h5>快速配置</h5>
      <div class="quick-config-grid">
        <div
          v-for="item in quickConfigItems"
          :key="item.key"
          class="quick-config-item"
          @click="handleQuickConfig(item.configType, item.path)"
        >
          <div class="quick-config-icon">
            <t-icon :name="item.icon" />
          </div>
          <div class="quick-config-content">
            <div class="quick-config-title">{{ item.title }}</div>
            <div class="quick-config-description">{{ item.description }}</div>
          </div>
          <div class="quick-config-arrow">
            <t-icon name="chevron-right" />
          </div>
        </div>
      </div>
    </div>
    
    <!-- 最近更改 -->
    <div class="recent-changes">
      <h5>最近更改</h5>
      <div class="changes-list">
        <div class="change-item">
          <div class="change-time">{{ formatTime(configData.lastUpdated) }}</div>
          <div class="change-description">配置已更新</div>
          <div class="change-version">版本: {{ configData.version }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ConfigData, ConfigType } from '@/types/config';

// Props
interface Props {
  configData: ConfigData;
  searchKeyword?: string;
  showAdvanced?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  searchKeyword: '',
  showAdvanced: false,
});

// Emits
interface Emits {
  (e: 'config-change', configType: ConfigType, config: Record<string, unknown>): void;
}

const emit = defineEmits<Emits>();

// 计算属性
const systemConfigCount = computed(() => {
  // 简化计算系统配置项数量
  return Object.keys(props.configData.system || {}).length;
});

const mcpServerCount = computed(() => {
  return Object.keys(props.configData.mcp?.mcpServers || {}).length;
});

const groupCount = computed(() => {
  return Object.keys(props.configData.groups || {}).length;
});

// 快速配置项
const quickConfigItems = computed(() => [
  {
    key: 'server',
    title: '服务器设置',
    description: '配置端口和主机地址',
    icon: 'server',
    configType: 'system' as ConfigType,
    path: 'server',
  },
  {
    key: 'auth',
    title: '认证配置',
    description: '管理JWT和安全设置',
    icon: 'lock-on',
    configType: 'system' as ConfigType,
    path: 'auth',
  },
  {
    key: 'users',
    title: '用户管理',
    description: '添加和管理系统用户',
    icon: 'user',
    configType: 'system' as ConfigType,
    path: 'users',
  },
  {
    key: 'mcp-servers',
    title: 'MCP服务器',
    description: '配置MCP服务器连接',
    icon: 'server',
    configType: 'mcp' as ConfigType,
    path: 'mcpServers',
  },
  {
    key: 'groups',
    title: '组管理',
    description: '管理服务器组和权限',
    icon: 'usergroup',
    configType: 'groups' as ConfigType,
    path: '',
  },
  {
    key: 'monitoring',
    title: '监控设置',
    description: '配置日志和监控参数',
    icon: 'chart',
    configType: 'system' as ConfigType,
    path: 'monitoring',
  },
]);

// 方法
const handleQuickConfig = (configType: ConfigType, path: string): void => {
  // 这里可以触发导航到特定配置页面
  console.log('Quick config:', configType, path);
};

const formatTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  } catch {
    return '未知';
  }
};
</script>

<style scoped>
.global-config-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.config-overview h4 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.config-overview p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.config-stats {
  margin-bottom: 8px;
}

.stat-card {
  height: 100%;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #ffffff;
  font-size: 20px;
}

.stat-icon.system {
  background-color: #3b82f6;
}

.stat-icon.mcp {
  background-color: #10b981;
}

.stat-icon.groups {
  background-color: #f59e0b;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
  margin-top: 4px;
}

.quick-config h5,
.recent-changes h5 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.quick-config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px;
}

.quick-config-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-config-item:hover {
  border-color: #3b82f6;
  background-color: #f8fafc;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.quick-config-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background-color: #f3f4f6;
  color: #6b7280;
  margin-right: 12px;
  flex-shrink: 0;
}

.quick-config-item:hover .quick-config-icon {
  background-color: #3b82f6;
  color: #ffffff;
}

.quick-config-content {
  flex: 1;
  min-width: 0;
}

.quick-config-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 4px;
}

.quick-config-description {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
}

.quick-config-arrow {
  color: #9ca3af;
  margin-left: 8px;
  flex-shrink: 0;
}

.changes-list {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background-color: #ffffff;
}

.change-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
}

.change-time {
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
}

.change-description {
  flex: 1;
  font-size: 14px;
  color: #1f2937;
}

.change-version {
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .quick-config-grid {
    grid-template-columns: 1fr;
  }
  
  .change-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>