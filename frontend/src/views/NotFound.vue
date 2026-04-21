<template>
  <div class="not-found-page">
    <div class="not-found-content">
      <div class="not-found-code">404</div>
      <h1 class="not-found-title">页面未找到</h1>
      <p class="not-found-desc">抱歉，您访问的页面不存在</p>
      <t-button theme="primary" size="large" @click="goDashboard"> 返回仪表板 </t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const goDashboard = () => {
  router.push('/dashboard');
};
</script>

<style scoped>
.not-found-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg-canvas);
}

.not-found-content {
  text-align: center;
  animation: fadeIn 0.4s ease both;
}

.not-found-code {
  font-size: 96px;
  font-weight: var(--weight-bold);
  color: var(--accent);
  line-height: 1;
  margin-bottom: var(--space-4);
  letter-spacing: -0.04em;
  opacity: 0.85;
}

.not-found-title {
  font-size: var(--text-2xl);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-3);
}

.not-found-desc {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin-bottom: var(--space-8);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
