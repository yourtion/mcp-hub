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
  background-color: var(--td-bg-color-page);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding: 20px 24px;
  background: var(--td-bg-color-container);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-left h1 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.header-subtitle {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-subtitle > span {
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.last-updated {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sse-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.sse-status--connecting {
  background-color: rgba(255, 159, 64, 0.1);
  color: #ff9f40;
}

.sse-status--open {
  background-color: rgba(103, 194, 58, 0.1);
  color: #67c23a;
}

.sse-status--closed {
  background-color: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: var(--td-text-color-secondary);
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.stat-card-wrapper {
  min-width: 0;
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
}

.content-left {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.content-right {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.performance-card {
  min-height: 300px;
}

.card-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px;
  color: var(--td-text-color-secondary);
}

.card-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: var(--td-text-color-placeholder);
}

.performance-content {
  padding: 8px 0;
}

.performance-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.metric-item {
  text-align: center;
  padding: 16px;
  background-color: var(--td-bg-color-container-hover);
  border-radius: 6px;
}

.metric-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-bottom: 4px;
}

.metric-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.top-tools h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--td-bg-color-container-hover);
  border-radius: 4px;
}

.tool-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.tool-stats {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--td-text-color-secondary);
}

.quick-actions-card {
  min-height: 200px;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
  }
  
  .content-right {
    order: -1;
  }
}

@media (max-width: 768px) {
  .dashboard-container {
    padding: 16px;
  }
  
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .stats-row {
    grid-template-columns: 1fr;
  }
  
  .performance-metrics {
    grid-template-columns: 1fr;
  }
}
</style>