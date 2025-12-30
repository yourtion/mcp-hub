<template>
  <div class="ds-config-section">
    <div class="ds-config-section__header" @click="toggleCollapse">
      <div class="ds-config-section__header-left">
        <div v-if="props.icon" class="ds-config-section__icon">
          <ServerIcon v-if="props.icon === 'server'" size="20px" />
          <LockOnIcon v-else-if="props.icon === 'lock-on'" size="20px" />
          <UserIcon v-else-if="props.icon === 'user'" size="20px" />
          <UsergroupIcon v-else-if="props.icon === 'usergroup'" size="20px" />
          <ViewModuleIcon v-else-if="props.icon === 'view-module'" size="20px" />
          <ChartIcon v-else-if="props.icon === 'chart'" size="20px" />
          <SettingIcon v-else size="20px" />
        </div>
        <div class="ds-config-section__info">
          <h4 class="ds-config-section__title">{{ props.title }}</h4>
          <p v-if="props.description" class="ds-config-section__description">
            {{ props.description }}
          </p>
        </div>
      </div>
      <div v-if="props.collapsible" class="ds-config-section__header-right">
        <ChevronDownIcon
          :class="{ 'ds-config-section__icon--collapsed': !isCollapsed }"
          size="20px"
        />
      </div>
    </div>

    <t-collapse-transition>
      <div v-show="!isCollapsed || !props.collapsible" class="ds-config-section__content">
        <slot />
      </div>
    </t-collapse-transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  ChevronDownIcon,
  ServerIcon,
  LockOnIcon,
  UserIcon,
  UsergroupIcon,
  ViewModuleIcon,
  ChartIcon,
  SettingIcon,
} from 'tdesign-icons-vue-next';

interface Props {
  title: string;
  description?: string;
  icon?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  icon: undefined,
  collapsible: true,
  defaultCollapsed: false,
});

const isCollapsed = ref(props.defaultCollapsed);

const toggleCollapse = () => {
  if (props.collapsible) {
    isCollapsed.value = !isCollapsed.value;
  }
};
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/spacing.less';
@import '../../tokens/typography.less';
@import '../../tokens/color.less';
@import '../../tokens/border.less';
@import '../../tokens/radius.less';
@import '../../tokens/transition.less';

.ds-config-section {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  overflow: hidden;
  margin-bottom: @spacing-lg;
  box-shadow: var(--td-shadow-1);
  transition: box-shadow var(--td-duration-normal) var(--td-easing-ease);

  &:hover {
    box-shadow: var(--td-shadow-2);
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.ds-config-section__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: @spacing-lg @spacing-xxl;
  background: var(--td-bg-color-container-hover);
  border-bottom: 1px solid var(--td-border-level-1-color);
  cursor: pointer;
  transition: background-color var(--td-duration-normal) var(--td-easing-ease);
  user-select: none;

  &:hover {
    background: var(--td-bg-color-secondarycontainer);
  }
}

.ds-config-section__header-left {
  display: flex;
  align-items: center;
  flex: 1;
  gap: @spacing-md;
  min-width: 0;
}

.ds-config-section__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--td-radius-medium);
  background: linear-gradient(135deg, var(--td-brand-color) 0%, var(--td-brand-color-7) 100%);
  color: #ffffff;
  flex-shrink: 0;
}

.ds-config-section__info {
  flex: 1;
  min-width: 0;
}

.ds-config-section__title {
  margin: 0 0 @spacing-xs 0;
  font-size: @font-size-lg;
  font-weight: @font-weight-semibold;
  color: var(--td-text-color-primary);
  line-height: @line-height-tight;
}

.ds-config-section__description {
  margin: 0;
  font-size: @font-size-sm;
  color: var(--td-text-color-secondary);
  line-height: @line-height-normal;
}

.ds-config-section__header-right {
  flex-shrink: 0;
  margin-left: @spacing-lg;
  color: var(--td-text-color-secondary);
  transition: transform var(--td-duration-normal) var(--td-easing-ease);
}

.ds-config-section__icon--collapsed {
  transform: rotate(-90deg);
}

.ds-config-section__content {
  padding: @spacing-xl @spacing-xxl;
}

// 响应式
@media (max-width: 768px) {
  .ds-config-section__header {
    padding: @spacing-md @spacing-lg;
  }

  .ds-config-section__icon {
    width: 36px;
    height: 36px;
  }

  .ds-config-section__title {
    font-size: @font-size-md;
  }

  .ds-config-section__description {
    font-size: @font-size-xs;
  }

  .ds-config-section__content {
    padding: @spacing-lg;
  }
}
</style>
