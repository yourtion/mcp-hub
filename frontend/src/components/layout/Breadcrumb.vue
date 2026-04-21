<template>
  <Breadcrumb class="app-breadcrumb" :separator="() => h(ChevronRightIcon, { size: '16px' })">
    <BreadcrumbItem @click="navigateTo('/dashboard')">
      <template #default>
        <HomeIcon class="app-breadcrumb__home-icon" />
      </template>
    </BreadcrumbItem>
    <BreadcrumbItem v-for="crumb in breadcrumbs" :key="crumb.path">
      {{ crumb.title }}
    </BreadcrumbItem>
  </Breadcrumb>
</template>

<script setup lang="ts">
import { HomeIcon, ChevronRightIcon } from 'tdesign-icons-vue-next';
import { Breadcrumb, BreadcrumbItem } from 'tdesign-vue-next';
import { computed, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';

interface BreadcrumbCrumb {
  path: string;
  title: string;
}

const route = useRoute();
const router = useRouter();

const breadcrumbs = computed<BreadcrumbCrumb[]>(() => {
  const matched = route.matched;
  const crumbs: BreadcrumbCrumb[] = [];

  for (const record of matched) {
    const title = record.meta?.title as string | undefined;
    if (title && record.name !== 'Dashboard') {
      crumbs.push({
        path: record.path,
        title,
      });
    }
  }

  return crumbs;
});

const navigateTo = (path: string) => {
  router.push(path);
};
</script>

<style scoped>
.app-breadcrumb {
  display: flex;
  align-items: center;
  font-size: var(--text-sm);
}

.app-breadcrumb__home-icon {
  width: 18px;
  height: 18px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

.app-breadcrumb__home-icon:hover {
  color: var(--accent);
}
</style>
