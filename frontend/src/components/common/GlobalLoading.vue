<template>
  <teleport to="body">
    <transition name="global-loading-fade">
      <div v-if="visible" class="global-loading">
        <div class="global-loading__content">
          <t-loading size="large" :text="text" />
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { Loading as TLoading } from 'tdesign-vue-next';

withDefaults(
  defineProps<{
    visible: boolean;
    text?: string;
  }>(),
  {
    text: '加载中...',
  },
);
</script>

<style scoped>
.global-loading {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-overlay);
  backdrop-filter: blur(4px);
}

.global-loading__content {
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  padding: var(--space-8) var(--space-10);
  box-shadow: var(--shadow-xl);
}

.global-loading-fade-enter-active,
.global-loading-fade-leave-active {
  transition: opacity var(--transition-base);
}

.global-loading-fade-enter-from,
.global-loading-fade-leave-to {
  opacity: 0;
}
</style>
