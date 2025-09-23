<template>
  <div class="system-config-editor">
    <!-- 服务器配置 -->
    <config-section
      v-if="shouldShowSection('server')"
      title="服务器配置"
      description="配置Web服务器的基本参数"
      icon="server"
    >
      <t-form :data="localConfig.server" layout="vertical">
        <t-row :gutter="16">
          <t-col :span="6">
            <t-form-item label="端口" name="port">
              <t-input-number
                v-model="localConfig.server.port"
                :min="1"
                :max="65535"
                placeholder="请输入端口号"
                @change="handleChange"
              />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="主机地址" name="host">
              <t-input
                v-model="localConfig.server.host"
                placeholder="请输入主机地址"
                @change="handleChange"
              />
            </t-form-item>
          </t-col>
        </t-row>
      </t-form>
    </config-section>

    <!-- 认证配置 -->
    <config-section
      v-if="shouldShowSection('auth')"
      title="认证配置"
      description="配置JWT认证和安全参数"
      icon="lock-on"
    >
      <!-- JWT配置 -->
      <config-subsection title="JWT配置">
        <t-form :data="localConfig.auth.jwt" layout="vertical">
          <t-row :gutter="16">
            <t-col :span="8">
              <t-form-item label="JWT密钥" name="secret">
                <t-input
                  v-model="localConfig.auth.jwt.secret"
                  type="password"
                  placeholder="请输入JWT密钥"
                  @change="handleChange"
                />
                <template #tips>
                  密钥长度不能少于32个字符
                </template>
              </t-form-item>
            </t-col>
            <t-col :span="4">
              <t-form-item label="访问令牌过期时间" name="expiresIn">
                <t-input
                  v-model="localConfig.auth.jwt.expiresIn"
                  placeholder="如: 1h, 30m"
                  @change="handleChange"
                />
              </t-form-item>
            </t-col>
            <t-col :span="4">
              <t-form-item label="刷新令牌过期时间" name="refreshExpiresIn">
                <t-input
                  v-model="localConfig.auth.jwt.refreshExpiresIn"
                  placeholder="如: 7d, 24h"
                  @change="handleChange"
                />
              </t-form-item>
            </t-col>
            <t-col :span="8">
              <t-form-item label="签发者" name="issuer">
                <t-input
                  v-model="localConfig.auth.jwt.issuer"
                  placeholder="请输入JWT签发者"
                  @change="handleChange"
                />
              </t-form-item>
            </t-col>
          </t-row>
        </t-form>
      </config-subsection>

      <!-- 安全配置 -->
      <config-subsection title="安全配置">
        <t-form :data="localConfig.auth.security" layout="vertical">
          <t-row :gutter="16">
            <t-col :span="6">
              <t-form-item label="最大登录尝试次数" name="maxLoginAttempts">
                <t-input-number
                  v-model="localConfig.auth.security.maxLoginAttempts"
                  :min="1"
                  :max="10"
                  @change="handleChange"
                />
              </t-form-item>
            </t-col>
            <t-col :span="6">
              <t-form-item label="锁定持续时间(分钟)" name="lockoutDuration">
                <t-input-number
                  v-model="localConfig.auth.security.lockoutDuration"
                  :min="0"
                  :max="1440"
                  @change="handleChange"
                />
              </t-form-item>
            </t-col>
            <t-col :span="6">
              <t-form-item label="密码最小长度" name="passwordMinLength">
                <t-input-number
                  v-model="localConfig.auth.security.passwordMinLength"
                  :min="4"
                  :max="32"
                  @change="handleChange"
                />
              </t-form-item>
            </t-col>
            <t-col :span="6">
              <t-form-item label="要求强密码" name="requireStrongPassword">
                <t-switch
                  v-model="localConfig.auth.security.requireStrongPassword"
                  @change="handleChange"
                />
              </t-form-item>
            </t-col>
          </t-row>
        </t-form>
      </config-subsection>
    </config-section>

    <!-- 用户管理 -->
    <config-section
      v-if="shouldShowSection('users')"
      title="用户管理"
      description="管理系统用户和权限"
      icon="user"
    >
      <user-config-manager
        :users="localConfig.users"
        @change="handleUsersChange"
      />
    </config-section>

    <!-- 界面配置 -->
    <config-section
      v-if="shouldShowSection('ui')"
      title="界面配置"
      description="配置用户界面和功能开关"
      icon="view-module"
    >
      <t-form :data="localConfig.ui" layout="vertical">
        <t-row :gutter="16">
          <t-col :span="8">
            <t-form-item label="系统标题" name="title">
              <t-input
                v-model="localConfig.ui.title"
                placeholder="请输入系统标题"
                @change="handleChange"
              />
            </t-form-item>
          </t-col>
          <t-col :span="8">
            <t-form-item label="主题" name="theme">
              <t-select
                v-model="localConfig.ui.theme"
                placeholder="请选择主题"
                @change="handleChange"
              >
                <t-option value="light" label="浅色主题" />
                <t-option value="dark" label="深色主题" />
                <t-option value="auto" label="自动切换" />
              </t-select>
            </t-form-item>
          </t-col>
        </t-row>

        <!-- 功能开关 -->
        <config-subsection title="功能开关">
          <t-row :gutter="16">
            <t-col :span="8">
              <t-form-item label="API到MCP功能" name="features.apiToMcp">
                <t-switch
                  v-model="localConfig.ui.features.apiToMcp"
                  @change="handleChange"
                />
                <template #tips>
                  启用API到MCP服务转换功能
                </template>
              </t-form-item>
            </t-col>
            <t-col :span="8">
              <t-form-item label="调试工具" name="features.debugging">
                <t-switch
                  v-model="localConfig.ui.features.debugging"
                  @change="handleChange"
                />
                <template #tips>
                  启用MCP协议调试和测试工具
                </template>
              </t-form-item>
            </t-col>
            <t-col :span="8">
              <t-form-item label="监控功能" name="features.monitoring">
                <t-switch
                  v-model="localConfig.ui.features.monitoring"
                  @change="handleChange"
                />
                <template #tips>
                  启用系统监控和性能分析
                </template>
              </t-form-item>
            </t-col>
          </t-row>
        </config-subsection>
      </t-form>
    </config-section>

    <!-- 监控配置 -->
    <config-section
      v-if="shouldShowSection('monitoring')"
      title="监控配置"
      description="配置系统监控和日志参数"
      icon="chart"
    >
      <t-form :data="localConfig.monitoring" layout="vertical">
        <t-row :gutter="16">
          <t-col :span="6">
            <t-form-item label="启用指标收集" name="metricsEnabled">
              <t-switch
                v-model="localConfig.monitoring.metricsEnabled"
                @change="handleChange"
              />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="日志级别" name="logLevel">
              <t-select
                v-model="localConfig.monitoring.logLevel"
                placeholder="请选择日志级别"
                @change="handleChange"
              >
                <t-option value="error" label="错误" />
                <t-option value="warn" label="警告" />
                <t-option value="info" label="信息" />
                <t-option value="debug" label="调试" />
              </t-select>
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="数据保留天数" name="retentionDays">
              <t-input-number
                v-model="localConfig.monitoring.retentionDays"
                :min="1"
                :max="365"
                @change="handleChange"
              />
            </t-form-item>
          </t-col>
        </t-row>
      </t-form>
    </config-section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { SystemConfig, UserConfig } from '@/types/config';

// 导入子组件
import ConfigSection from './ConfigSection.vue';
import ConfigSubsection from './ConfigSubsection.vue';
import UserConfigManager from './UserConfigManager.vue';

// Props
interface Props {
  config: SystemConfig;
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
  (e: 'change', config: SystemConfig): void;
}

const emit = defineEmits<Emits>();

// 响应式数据
const localConfig = ref<SystemConfig>(JSON.parse(JSON.stringify(props.config)));

// 监听配置变化
watch(
  () => props.config,
  (newConfig) => {
    localConfig.value = JSON.parse(JSON.stringify(newConfig));
  },
  { deep: true }
);

// 方法

/**
 * 判断是否应该显示某个配置节
 */
const shouldShowSection = (sectionKey: string): boolean => {
  // 如果有选中的分类，只显示匹配的分类
  if (props.selectedCategory && props.selectedCategory !== sectionKey) {
    return false;
  }

  // 如果有搜索关键词，进行模糊匹配
  if (props.searchKeyword) {
    const keyword = props.searchKeyword.toLowerCase();
    const sectionNames: Record<string, string[]> = {
      server: ['服务器', '端口', '主机', 'server', 'port', 'host'],
      auth: ['认证', '登录', 'jwt', '密码', '安全', 'auth', 'login', 'password', 'security'],
      users: ['用户', '权限', 'user', 'permission', 'role'],
      ui: ['界面', '主题', '功能', 'ui', 'theme', 'feature'],
      monitoring: ['监控', '日志', '指标', 'monitoring', 'log', 'metric'],
    };

    const keywords = sectionNames[sectionKey] || [];
    return keywords.some(k => k.includes(keyword));
  }

  return true;
};

/**
 * 处理配置变更
 */
const handleChange = (): void => {
  emit('change', localConfig.value);
};

/**
 * 处理用户配置变更
 */
const handleUsersChange = (users: Record<string, UserConfig>): void => {
  localConfig.value.users = users;
  handleChange();
};
</script>

<style scoped>
.system-config-editor {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .system-config-editor {
    gap: 16px;
  }
}
</style>