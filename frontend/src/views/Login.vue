<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <h1 class="login-title">MCP Knot</h1>
        <p class="login-subtitle">Model Context Protocol 管理平台</p>
      </div>

      <t-form
        ref="formRef"
        :data="formData"
        :rules="formRules"
        label-width="0"
        @submit="handleLogin"
      >
        <t-form-item name="username">
          <t-input
            v-model="formData.username"
            placeholder="请输入用户名"
            size="large"
            clearable
            @enter="handleLogin"
          >
            <template #prefix-icon>
              <UserIcon />
            </template>
          </t-input>
        </t-form-item>

        <t-form-item name="password">
          <t-input
            v-model="formData.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            clearable
            @enter="handleLogin"
          >
            <template #prefix-icon>
              <LockOnIcon />
            </template>
          </t-input>
        </t-form-item>

        <t-form-item v-if="errorMessage" class="login-error-item">
          <div class="login-error">{{ errorMessage }}</div>
        </t-form-item>

        <t-form-item>
          <t-button theme="primary" type="submit" block size="large" :loading="loading">
            登录
          </t-button>
        </t-form-item>
      </t-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UserIcon, LockOnIcon } from 'tdesign-icons-vue-next';
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';

import { useAuthStore } from '@/stores/auth';

import type { FormInstanceFunctions, FormRule } from 'tdesign-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const formRef = ref<FormInstanceFunctions | null>(null);
const loading = ref(false);
const errorMessage = ref('');

const formData = reactive({
  username: '',
  password: '',
});

const formRules: Record<string, FormRule[]> = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

const handleLogin = async ({ validateResult }: { validateResult: boolean }) => {
  if (validateResult !== true) {
    return;
  }

  loading.value = true;
  errorMessage.value = '';

  try {
    await authStore.login({
      username: formData.username,
      password: formData.password,
    });

    const redirect = (route.query.redirect as string) || '/dashboard';
    await router.push(redirect);
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : '登录失败，请检查用户名和密码';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background:
    radial-gradient(ellipse at 30% 20%, var(--accent-subtle) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 80%, var(--accent-subtle) 0%, transparent 50%), var(--bg-canvas);
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: var(--space-10) var(--space-8);
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  animation: loginEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.login-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.login-title {
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
  letter-spacing: -0.02em;
}

.login-subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.login-error {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--danger);
  background: var(--danger-light);
  border-radius: var(--radius-sm);
  text-align: center;
}

.login-error-item {
  margin-bottom: var(--space-2);
}

@keyframes loginEnter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
