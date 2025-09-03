<template>
  <div class="not-found-container">
    <div class="not-found-content">
      <h1>404</h1>
      <p>页面未找到</p>
      <t-button theme="primary" @click="goHome">
        返回首页
      </t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const goHome = () => {
  router.push('/');
};
</script>

<style scoped>
.not-found-container {
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
}

.not-found-content {
  text-align: center;
}

.not-found-content h1 {
  font-size: 72px;
  font-weight: bold;
  color: #6b7280;
  margin: 0 0 16px 0;
}

.not-found-content p {
  font-size: 18px;
  color: #9ca3af;
  margin: 0 0 24px 0;
}
</style>