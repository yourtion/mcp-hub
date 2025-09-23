// 配置管理状态管理

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { configService } from '@/services/config';
import type {
  ConfigBackup,
  ConfigData,
  ConfigFormData,
  ConfigHistoryEntry,
  ConfigPreview,
  ConfigSearchFilter,
  ConfigTestResult,
  ConfigType,
  ConfigUpdateRequest,
  ConfigValidationRequest,
  ConfigValidationResponse,
} from '@/types/config';

export const useConfigStore = defineStore('config', () => {
  // 状态
  const configData = ref<ConfigData | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 表单相关状态
  const formData = ref<ConfigFormData | null>(null);
  const validationResult = ref<ConfigValidationResponse | null>(null);
  const testResult = ref<ConfigTestResult | null>(null);
  const previewResult = ref<ConfigPreview | null>(null);

  // 历史和备份相关状态
  const historyEntries = ref<ConfigHistoryEntry[]>([]);
  const historyTotal = ref(0);
  const backups = ref<ConfigBackup[]>([]);
  const backupTotal = ref(0);

  // 搜索过滤器
  const searchFilter = ref<ConfigSearchFilter>({
    keyword: '',
    configType: undefined,
    category: undefined,
    showAdvanced: false,
  });

  // 计算属性
  const isLoading = computed(() => loading.value);
  const hasError = computed(() => !!error.value);
  const hasConfigData = computed(() => !!configData.value);
  const isFormDirty = computed(() => formData.value?.isDirty ?? false);
  const hasValidationErrors = computed(() =>
    validationResult.value ? !validationResult.value.valid : false,
  );

  // 过滤后的配置项
  const filteredConfigData = computed(() => {
    if (!configData.value || !searchFilter.value.keyword) {
      return configData.value;
    }

    // 这里可以实现更复杂的搜索逻辑
    // 简化实现，实际项目中可以使用更高效的搜索算法
    return configData.value;
  });

  // Actions

  /**
   * 获取当前配置
   */
  const fetchConfig = async (): Promise<void> => {
    try {
      loading.value = true;
      error.value = null;

      const data = await configService.getCurrentConfig();
      configData.value = data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取配置失败';
      console.error('获取配置失败:', err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * 更新配置
   */
  const updateConfig = async (request: ConfigUpdateRequest): Promise<void> => {
    try {
      loading.value = true;
      error.value = null;

      await configService.updateConfig(request);

      // 更新成功后重新获取配置
      await fetchConfig();

      // 清除表单状态
      clearFormData();
    } catch (err) {
      error.value = err instanceof Error ? err.message : '更新配置失败';
      console.error('更新配置失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 验证配置
   */
  const validateConfig = async (
    request: ConfigValidationRequest,
  ): Promise<ConfigValidationResponse> => {
    try {
      loading.value = true;
      error.value = null;

      const result = await configService.validateConfig(request);
      validationResult.value = result;

      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '验证配置失败';
      console.error('验证配置失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 测试配置
   */
  const testConfig = async (
    request: ConfigValidationRequest,
  ): Promise<ConfigTestResult> => {
    try {
      loading.value = true;
      error.value = null;

      const result = await configService.testConfig(request);
      testResult.value = result;

      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '测试配置失败';
      console.error('测试配置失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 预览配置更改
   */
  const previewConfigChanges = async (
    request: ConfigValidationRequest,
  ): Promise<ConfigPreview> => {
    try {
      loading.value = true;
      error.value = null;

      const result = await configService.previewConfigChanges(request);
      previewResult.value = result;

      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '预览配置失败';
      console.error('预览配置失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 获取配置历史
   */
  const fetchConfigHistory = async (
    limit = 50,
    offset = 0,
    configType?: ConfigType,
  ): Promise<void> => {
    try {
      loading.value = true;
      error.value = null;

      const result = await configService.getConfigHistory(
        limit,
        offset,
        configType,
      );

      if (offset === 0) {
        historyEntries.value = result.history;
      } else {
        historyEntries.value.push(...result.history);
      }

      historyTotal.value = result.total;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取配置历史失败';
      console.error('获取配置历史失败:', err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * 创建配置备份
   */
  const createBackup = async (
    description?: string,
    includeTypes?: ConfigType[],
  ): Promise<string> => {
    try {
      loading.value = true;
      error.value = null;

      const result = await configService.createBackup({
        description,
        includeTypes,
      });

      // 刷新备份列表
      await fetchBackupList();

      return result.backupId;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '创建备份失败';
      console.error('创建备份失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 恢复配置
   */
  const restoreFromBackup = async (
    backupId: string,
    configTypes?: ConfigType[],
  ): Promise<void> => {
    try {
      loading.value = true;
      error.value = null;

      await configService.restoreFromBackup({ backupId, configTypes });

      // 恢复成功后重新获取配置
      await fetchConfig();
    } catch (err) {
      error.value = err instanceof Error ? err.message : '恢复配置失败';
      console.error('恢复配置失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 获取备份列表
   */
  const fetchBackupList = async (limit = 50, offset = 0): Promise<void> => {
    try {
      loading.value = true;
      error.value = null;

      const result = await configService.getBackupList(limit, offset);

      if (offset === 0) {
        backups.value = result.backups;
      } else {
        backups.value.push(...result.backups);
      }

      backupTotal.value = result.total;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取备份列表失败';
      console.error('获取备份列表失败:', err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * 设置表单数据
   */
  const setFormData = (data: ConfigFormData): void => {
    formData.value = data;
  };

  /**
   * 更新表单数据
   */
  const updateFormData = (config: Record<string, unknown>): void => {
    if (formData.value) {
      formData.value.config = config;
      formData.value.isDirty =
        JSON.stringify(config) !==
        JSON.stringify(formData.value.originalConfig);
    }
  };

  /**
   * 清除表单数据
   */
  const clearFormData = (): void => {
    formData.value = null;
    validationResult.value = null;
    testResult.value = null;
    previewResult.value = null;
  };

  /**
   * 设置搜索过滤器
   */
  const setSearchFilter = (filter: Partial<ConfigSearchFilter>): void => {
    searchFilter.value = { ...searchFilter.value, ...filter };
  };

  /**
   * 清除错误
   */
  const clearError = (): void => {
    error.value = null;
  };

  /**
   * 重置状态
   */
  const reset = (): void => {
    configData.value = null;
    loading.value = false;
    error.value = null;
    clearFormData();
    historyEntries.value = [];
    historyTotal.value = 0;
    backups.value = [];
    backupTotal.value = 0;
    searchFilter.value = {
      keyword: '',
      configType: undefined,
      category: undefined,
      showAdvanced: false,
    };
  };

  return {
    // 状态
    configData,
    loading,
    error,
    formData,
    validationResult,
    testResult,
    previewResult,
    historyEntries,
    historyTotal,
    backups,
    backupTotal,
    searchFilter,

    // 计算属性
    isLoading,
    hasError,
    hasConfigData,
    isFormDirty,
    hasValidationErrors,
    filteredConfigData,

    // Actions
    fetchConfig,
    updateConfig,
    validateConfig,
    testConfig,
    previewConfigChanges,
    fetchConfigHistory,
    createBackup,
    restoreFromBackup,
    fetchBackupList,
    setFormData,
    updateFormData,
    clearFormData,
    setSearchFilter,
    clearError,
    reset,
  };
});
