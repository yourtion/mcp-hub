// 服务器状态管理

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as ServerService from '@/services/server';
import type {
  CreateServerRequest,
  ServerInfo,
  ServerListResponse,
  TestServerRequest,
  UpdateServerRequest,
  ValidateServerRequest,
} from '@/types/server';

export const useServerStore = defineStore('server', () => {
  // 状态
  const servers = ref<Map<string, ServerInfo>>(new Map());
  const loading = ref(false);
  const error = ref<string | null>(null);
  const summary = ref({
    total: 0,
    connected: 0,
    connecting: 0,
    disconnected: 0,
    error: 0,
  });

  // 计算属性
  const serverList = computed(() => Array.from(servers.value.values()));
  const connectedServers = computed(() =>
    serverList.value.filter((server) => server.status === 'connected'),
  );
  const disconnectedServers = computed(() =>
    serverList.value.filter((server) => server.status === 'disconnected'),
  );

  // 操作
  const fetchServers = async () => {
    try {
      loading.value = true;
      error.value = null;

      const response: ServerListResponse = await ServerService.getServers();

      // 更新服务器列表
      servers.value.clear();
      response.servers.forEach((server) => {
        servers.value.set(server.id, server);
      });

      // 更新统计信息
      summary.value = response.summary;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取服务器列表失败';
      console.error('获取服务器列表失败:', err);
    } finally {
      loading.value = false;
    }
  };

  const fetchServer = async (id: string) => {
    try {
      const server = await ServerService.getServer(id);
      servers.value.set(id, server);
      return server;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取服务器信息失败';
      throw err;
    }
  };

  const createServer = async (data: CreateServerRequest) => {
    try {
      loading.value = true;
      error.value = null;

      await ServerService.createServer(data);

      // 重新获取服务器列表
      await fetchServers();
    } catch (err) {
      error.value = err instanceof Error ? err.message : '创建服务器失败';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateServer = async (id: string, data: UpdateServerRequest) => {
    try {
      loading.value = true;
      error.value = null;

      await ServerService.updateServer(id, data);

      // 重新获取服务器信息
      await fetchServer(id);
    } catch (err) {
      error.value = err instanceof Error ? err.message : '更新服务器失败';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteServer = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;

      await ServerService.deleteServer(id);

      // 从本地状态中移除
      servers.value.delete(id);

      // 重新获取服务器列表以更新统计信息
      await fetchServers();
    } catch (err) {
      error.value = err instanceof Error ? err.message : '删除服务器失败';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const connectServer = async (id: string) => {
    try {
      const server = servers.value.get(id);
      if (server) {
        // 乐观更新状态
        server.status = 'connecting';
        servers.value.set(id, { ...server });
      }

      await ServerService.connectServer(id);

      // 获取最新状态
      setTimeout(() => {
        fetchServer(id);
      }, 1000);
    } catch (err) {
      // 恢复状态
      const server = servers.value.get(id);
      if (server) {
        server.status = 'disconnected';
        servers.value.set(id, { ...server });
      }

      error.value = err instanceof Error ? err.message : '连接服务器失败';
      throw err;
    }
  };

  const disconnectServer = async (id: string) => {
    try {
      const server = servers.value.get(id);
      if (server) {
        // 乐观更新状态
        server.status = 'disconnected';
        servers.value.set(id, { ...server });
      }

      await ServerService.disconnectServer(id);

      // 获取最新状态
      setTimeout(() => {
        fetchServer(id);
      }, 1000);
    } catch (err) {
      // 恢复状态
      const server = servers.value.get(id);
      if (server) {
        server.status = 'connected';
        servers.value.set(id, { ...server });
      }

      error.value = err instanceof Error ? err.message : '断开服务器失败';
      throw err;
    }
  };

  const testServer = async (config: TestServerRequest) => {
    try {
      return await ServerService.testServer(config);
    } catch (err) {
      error.value = err instanceof Error ? err.message : '测试服务器失败';
      throw err;
    }
  };

  const validateServer = async (config: ValidateServerRequest) => {
    try {
      return await ServerService.validateServer(config);
    } catch (err) {
      error.value = err instanceof Error ? err.message : '验证服务器配置失败';
      throw err;
    }
  };

  const refreshServerStatus = async (id: string) => {
    try {
      const status = await ServerService.getServerStatus(id);
      const server = servers.value.get(id);
      if (server) {
        server.status = status.status;
        server.lastConnected = status.lastConnected;
        server.reconnectAttempts = status.reconnectAttempts;
        server.toolCount = status.toolCount;
        servers.value.set(id, { ...server });
      }
    } catch (err) {
      console.error(`刷新服务器 ${id} 状态失败:`, err);
    }
  };

  const clearError = () => {
    error.value = null;
  };

  return {
    // 状态
    servers,
    loading,
    error,
    summary,

    // 计算属性
    serverList,
    connectedServers,
    disconnectedServers,

    // 操作
    fetchServers,
    fetchServer,
    createServer,
    updateServer,
    deleteServer,
    connectServer,
    disconnectServer,
    testServer,
    validateServer,
    refreshServerStatus,
    clearError,
  };
});
