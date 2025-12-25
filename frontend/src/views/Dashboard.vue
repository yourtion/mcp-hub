<template>
  <div class="dashboard-container">
    <!-- 页面头部 -->
    <div class="dashboard-header">
      <div class="header-left">
        <h1>系统概览</h1>
        <div class="header-subtitle">
          <span>欢迎使用 MCP Hub 管理系统</span>
          <div v-if="lastUpdated" class="last-updated">
            最后更新: {{ formatTime(lastUpdated) }}
          </div>
        </div>
      </div>
      <div class="header-actions">
        <!-- SSE连接状态 -->
        <div class="sse-status" :class="[`sse-status--${sseConnectionState}`]">
          <component :is="sseStatusIconComponent" size="14px" />
          <span>{{ sseStatusText }}</span>
        </div>

        <!-- 刷新按钮 -->
        <t-button
          theme="default"
          :loading="isRefreshing"
          @click="handleRefresh"
        >
          <template #icon>
            <RefreshIcon />
          </template>
          刷新数据
        </t-button>
        
        <!-- 用户信息 -->
        <div class="user-info">
          <span>{{ user?.username }}</span>
          <t-button theme="default" @click="handleLogout">
            退出登录
          </t-button>
        </div>
      </div>
    </div>
    
    <!-- 仪表板内容 -->
    <div class="dashboard-content">
      <!-- 统计卡片行 -->
      <div class="stats-row">
        <div 
          v-for="card in statCards" 
          :key="card.label" 
          class="stat-card-wrapper"
        >
          <StatCard :data="card" />
        </div>
      </div>
      
      <!-- 主要内容区域 -->
      <div class="main-content">
        <!-- 左侧列 -->
        <div class="content-left">
          <!-- 系统健康状态 -->
          <SystemHealthCard 
            :health="systemHealth"
            :loading="loading.health"
            @refresh="fetchSystemHealth"
          />
          
          <!-- 性能统计图表 -->
          <t-card title="性能统计" class="performance-card">
            <template #actions>
              <t-button
                theme="default"
                size="small"
                :loading="loading.performance"
                @click="fetchPerformanceStats"
              >
                <template #icon>
                  <RefreshIcon />
                </template>
                刷新
              </t-button>
            </template>

            <div v-if="loading.performance && !performanceStats" class="card-loading">
              <t-loading size="small" />
              <span>加载中...</span>
            </div>

            <div v-else-if="performanceStats" class="performance-content">
              <div class="performance-metrics">
                <div class="metric-item">
                  <div class="metric-label">总请求数</div>
                  <div class="metric-value">{{ performanceStats.totalRequests }}</div>
                </div>
                <div class="metric-item">
                  <div class="metric-label">平均响应时间</div>
                  <div class="metric-value">{{ performanceStats.averageResponseTime }}ms</div>
                </div>
                <div class="metric-item">
                  <div class="metric-label">错误率</div>
                  <div class="metric-value">{{ (performanceStats.errorRate * 100).toFixed(2) }}%</div>
                </div>
              </div>

              <!-- 热门工具 -->
              <div v-if="performanceStats?.topTools && performanceStats.topTools.length > 0" class="top-tools">
                <h4>热门工具</h4>
                <div class="tools-list">
                  <div
                    v-for="tool in performanceStats.topTools.slice(0, 5)"
                    :key="tool.name"
                    class="tool-item"
                  >
                    <div class="tool-name">{{ tool.name }}</div>
                    <div class="tool-stats">
                      <span>{{ tool.calls }} 次调用</span>
                      <span>{{ tool.avgTime }}ms 平均</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="card-error">
              <CloseIcon size="24px" />
              <span>无法获取性能数据</span>
            </div>
          </t-card>
        </div>
        
        <!-- 右侧列 -->
        <div class="content-right">
          <!-- 最近活动 -->
          <RecentActivityCard 
            :activities="activities"
            :loading="loading.activities"
            @refresh="fetchActivities"
            @show-more="handleShowMoreActivities"
          />
          
          <!-- 快速操作 -->
          <t-card title="快速操作" class="quick-actions-card">
            <div class="quick-actions">
              <t-button
                theme="primary"
                block
                @click="navigateTo('/servers')"
              >
                <template #icon>
                  <ServerIcon />
                </template>
                管理服务器
              </t-button>

              <t-button
                theme="default"
                block
                @click="navigateTo('/tools')"
              >
                <template #icon>
                  <ToolsIcon />
                </template>
                查看工具
              </t-button>

              <t-button
                theme="default"
                block
                @click="navigateTo('/groups')"
              >
                <template #icon>
                  <FolderIcon />
                </template>
                管理组
              </t-button>

              <t-button
                theme="default"
                block
                @click="navigateTo('/debug')"
              >
                <template #icon>
                  <CloseIcon />
                </template>
                调试工具
              </t-button>
            </div>
          </t-card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, markRaw, type Component } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  CheckIcon,
  CloseIcon,
  RefreshIcon,
  ServerIcon,
  ToolsIcon,
  FolderIcon,
  MinusIcon,
} from 'tdesign-icons-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useDashboardStore } from '@/stores/dashboard';
import StatCard from '@/components/dashboard/StatCard.vue';
import SystemHealthCard from '@/components/dashboard/SystemHealthCard.vue';
import RecentActivityCard from '@/components/dashboard/RecentActivityCard.vue';

const router = useRouter();
const authStore = useAuthStore();
const dashboardStore = useDashboardStore();

// 计算属性
const user = computed(() => authStore.user);

// 使用 storeToRefs 保持响应式
const {
  stats,
  systemHealth,
  performanceStats,
  activities,
  loading,
  statCards,
  sseConnectionState,
  lastUpdated: storeLastUpdated,
} = storeToRefs(dashboardStore);

// 方法需要从原 store 解构（不是响应式的）
const { fetchSystemHealth, fetchPerformanceStats, fetchActivities, refreshAll } = dashboardStore;

// 最后更新时间
const lastUpdated = computed(() => {
  const times = Object.values(storeLastUpdated.value);
  if (times.length === 0) return null;
  return times.reduce((latest, current) => {
    return new Date(current) > new Date(latest) ? current : latest;
  });
});

// 是否正在刷新
const isRefreshing = computed(() => {
  return Object.values(loading.value).some(l => l);
});

// SSE状态
const sseStatusIconComponent = computed(() => {
  const iconMap: Record<string, Component> = {
    connecting: markRaw(MinusIcon), // 可以使用旋转动画
    open: markRaw(CheckIcon),
    closed: markRaw(CloseIcon),
  };
  return iconMap[sseConnectionState.value] || iconMap.closed;
});

const sseStatusText = computed(() => {
  const textMap: Record<string, string> = {
    connecting: '连接中',
    open: '已连接',
    closed: '未连接',
  };
  return textMap[sseConnectionState.value] || '未连接';
});

// 方法
const handleLogout = async () => {
  try {
    await authStore.logout();
    MessagePlugin.success('已退出登录');
    router.push('/login');
  } catch (error) {
    console.error('退出登录失败:', error);
    MessagePlugin.error('退出登录失败');
  }
};

const handleRefresh = async () => {
  try {
    await dashboardStore.refreshAll();
    MessagePlugin.success('数据已刷新');
  } catch (error) {
    console.error('刷新数据失败:', error);
    MessagePlugin.error('刷新数据失败');
  }
};

const navigateTo = (path: string) => {
  router.push(path);
};

const handleShowMoreActivities = () => {
  // 可以导航到专门的活动页面或展开更多内容
  console.log('显示更多活动');
};

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN');
};

// 生命周期
onMounted(async () => {
  try {
    // 初始化仪表板数据
    await dashboardStore.initializeDashboard();
    
    // 连接SSE
    await dashboardStore.connectSSE([
      'server_status',
      'tool_execution', 
      'system_alert',
      'health_check'
    ]);
  } catch (error) {
    console.error('初始化仪表板失败:', error);
    MessagePlugin.error('初始化仪表板失败');
  }
});

onUnmounted(() => {
  // 清理资源
  dashboardStore.cleanup();
});
</script>

<style scoped>
.dashboard-container {
  padding: 24px;
  min-height: 100vh;
  background: linear-gradient(135deg, var(--td-bg-color-page) 0%, rgba(64, 158, 255, 0.03) 100%);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  padding: 24px 28px;
  background: var(--td-bg-color-container);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--td-border-level-1-color);
  transition: all 0.3s ease;
}

.dashboard-header:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
}

.header-left h1 {
  margin: 0 0 12px 0;
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--td-text-color-primary) 0%, #409eff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-subtitle {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.header-subtitle > span {
  color: var(--td-text-color-secondary);
  font-size: 15px;
  font-weight: 400;
}

.last-updated {
  font-size: 13px;
  color: var(--td-text-color-placeholder);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.last-updated::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #67c23a;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.sse-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.sse-status--connecting {
  background: linear-gradient(135deg, rgba(255, 159, 64, 0.15) 0%, rgba(255, 159, 64, 0.08) 100%);
  color: #ff9f40;
  border: 1px solid rgba(255, 159, 64, 0.2);
}

.sse-status--open {
  background: linear-gradient(135deg, rgba(103, 194, 58, 0.15) 0%, rgba(103, 194, 58, 0.08) 100%);
  color: #67c23a;
  border: 1px solid rgba(103, 194, 58, 0.2);
}

.sse-status--closed {
  background: linear-gradient(135deg, rgba(245, 108, 108, 0.15) 0%, rgba(245, 108, 108, 0.08) 100%);
  color: #f56c6c;
  border: 1px solid rgba(245, 108, 108, 0.2);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
  color: var(--td-text-color-secondary);
  padding: 8px 16px;
  background-color: var(--td-bg-color-container-hover);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.user-info:hover {
  background-color: var(--td-bg-color-container);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
  margin-bottom: 8px;
}

.stat-card-wrapper {
  min-width: 0;
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 28px;
}

.content-left {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.content-right {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.performance-card {
  min-height: 320px;
}

.card-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: var(--td-text-color-secondary);
  font-size: 15px;
}

.card-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px;
  color: var(--td-text-color-placeholder);
}

.performance-content {
  padding: 12px 0;
}

.performance-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 28px;
}

.metric-item {
  text-align: center;
  padding: 20px 16px;
  background: linear-gradient(135deg, var(--td-bg-color-container-hover) 0%, var(--td-bg-color-page) 100%);
  border-radius: 10px;
  border: 1px solid var(--td-border-level-1-color);
  transition: all 0.3s ease;
  cursor: pointer;
}

.metric-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  border-color: var(--td-brand-color);
}

.metric-label {
  font-size: 13px;
  color: var(--td-text-color-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}

.metric-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--td-text-color-primary);
}

.top-tools {
  margin-top: 24px;
}

.top-tools h4 {
  margin: 0 0 16px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.top-tools h4::before {
  content: '';
  width: 4px;
  height: 18px;
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  border-radius: 2px;
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tool-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, var(--td-bg-color-container-hover) 0%, var(--td-bg-color-page) 100%);
  border-radius: 8px;
  border: 1px solid transparent;
  transition: all 0.3s ease;
  cursor: pointer;
}

.tool-item:hover {
  background: var(--td-bg-color-container);
  border-color: var(--td-brand-color);
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.15);
}

.tool-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.tool-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
  font-weight: 500;
}

.quick-actions-card {
  min-height: 220px;
}

.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 8px 0;
}

.quick-actions :deep(.t-button) {
  height: auto;
  padding: 16px 12px;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.quick-actions :deep(.t-button:hover) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
  }

  .content-right {
    order: -1;
  }

  .quick-actions {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 768px) {
  .dashboard-container {
    padding: 16px;
  }

  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
    padding: 20px;
  }

  .header-left h1 {
    font-size: 24px;
  }

  .header-actions {
    width: 100%;
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .stats-row {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .performance-metrics {
    grid-template-columns: 1fr;
  }

  .quick-actions {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .stats-row {
    grid-template-columns: 1fr;
  }

  .header-subtitle > span {
    font-size: 14px;
  }

  .user-info {
    width: 100%;
    justify-content: space-between;
  }
}
</style>