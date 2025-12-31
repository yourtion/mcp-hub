<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1 class="login-title">MCP Hub 管理系统</h1>
        <p class="login-subtitle">请登录您的账户</p>
      </div>

      <t-form
        ref="formRef"
        :data="formData"
        :rules="formRules"
        class="login-form"
        @submit="handleSubmit"
      >
        <t-form-item name="username" class="form-item">
          <t-input
            v-model="formData.username"
            placeholder="请输入用户名"
            size="large"
            :disabled="loading"
            clearable
          >
            <template #prefix-icon>
              <UserIcon />
            </template>
          </t-input>
        </t-form-item>

        <t-form-item name="password" class="form-item">
          <t-input
            v-model="formData.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            :disabled="loading"
            clearable
          >
            <template #prefix-icon>
              <LockOnIcon />
            </template>
          </t-input>
        </t-form-item>

        <t-form-item class="form-item">
          <t-button
            type="submit"
            theme="primary"
            size="large"
            block
            :loading="loading"
          >
            {{ loading ? '登录中...' : '登录' }}
          </t-button>
        </t-form-item>
      </t-form>

      <!-- 错误提示 -->
      <t-alert
        v-if="error"
        theme="error"
        :message="error"
        class="error-alert"
        close
        @close="clearError"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { UserIcon, LockOnIcon } from 'tdesign-icons-vue-next';
import { useAuthStore } from '@/stores/auth';
import type { FormInstanceFunctions, FormRule } from 'tdesign-vue-next';

const router = useRouter();
const authStore = useAuthStore();

// 表单引用
const formRef = ref<FormInstanceFunctions>();

// 表单数据
const formData = ref({
  username: '',
  password: '',
});

// 表单验证规则
const formRules: Record<string, FormRule[]> = {
  username: [
    { required: true, message: '请输入用户名' },
    { min: 2, message: '用户名至少2个字符', type: 'string' },
  ],
  password: [
    { required: true, message: '请输入密码' },
    { min: 6, message: '密码至少6个字符', type: 'string' },
  ],
};

// 计算属性
const loading = computed(() => authStore.loading);
const error = computed(() => authStore.error);

// 清除错误信息
const clearError = () => {
  authStore.error = null;
};

// 处理表单提交
const handleSubmit = async ({ validateResult, firstError }: { validateResult: boolean | Record<string, unknown>, firstError?: string }) => {
  if (validateResult === true) {
    try {
      await authStore.login({
        username: formData.value.username,
        password: formData.value.password,
      });

      MessagePlugin.success('登录成功');

      // 等待状态更新后再跳转
      await nextTick();

      // 跳转到首页或之前访问的页面
      const redirect = router.currentRoute.value.query.redirect as string;
      await router.push(redirect || '/dashboard');
    } catch (err) {
      console.error('登录失败:', err);
      // 错误信息已经在store中设置，组件会自动显示
    }
  } else {
    // 验证失败，显示第一个错误信息
    if (firstError) {
      MessagePlugin.warning(firstError);
    }
  }
};

// 组件挂载时检查是否已登录
onMounted(async () => {
  if (authStore.isAuthenticated) {
    await router.push('/dashboard');
  }
});
</script>

<style lang="less" scoped>
@import '../design-system/styles/mixins.less';
@import '../design-system/tokens/spacing.less';
@import '../design-system/tokens/typography.less';

.login-container {
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: @spacing-xl;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  background: var(--td-bg-color-container);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
}

.login-header {
  text-align: center;
  margin-bottom: @spacing-xxxl;
}

.login-title {
  font-size: @font-size-xxxl;
  font-weight: @font-weight-semibold;
  color: var(--td-text-color-primary);
  margin: 0 0 @spacing-sm 0;
}

.login-subtitle {
  font-size: @font-size-lg;
  color: var(--td-text-color-secondary);
  margin: 0;
}

.login-form {
  width: 100%;
}

.form-item {
  margin-bottom: @spacing-xxl;
}

.form-item:last-child {
  margin-bottom: 0;
}

.error-alert {
  margin-top: @spacing-lg;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .login-container {
    padding: @spacing-md;
  }

  .login-card {
    padding: @spacing-xxl;
  }

  .login-title {
    font-size: @font-size-xxl;
  }
}
</style>
