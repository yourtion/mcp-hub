<template>
  <div class="ds-error-page" :class="[`ds-error-page--code-${props.code}`]">
    <div class="ds-error-page__content">
      <!-- 错误代码 -->
      <div v-if="props.showCode" class="ds-error-page__code">
        {{ props.code }}
      </div>

      <!-- 错误插图/图标 -->
      <div class="ds-error-page__illustration">
        <component :is="illustrationComponent" size="200px" />
      </div>

      <!-- 错误标题 -->
      <h1 class="ds-error-page__title">
        {{ props.title || defaultTitle }}
      </h1>

      <!-- 错误描述 -->
      <p v-if="props.description" class="ds-error-page__description">
        {{ props.description }}
      </p>
      <p v-else class="ds-error-page__description">
        {{ defaultDescription }}
      </p>

      <!-- 操作按钮 -->
      <div class="ds-error-page__actions">
        <t-space size="medium">
          <!-- 返回首页 -->
          <t-button
            v-if="props.showHome"
            theme="primary"
            @click="handleGoHome"
          >
            <template #icon>
              <HomeIcon />
            </template>
            返回首页
          </t-button>

          <!-- 返回上页 -->
          <t-button
            v-if="props.showBack"
            variant="outline"
            @click="handleGoBack"
          >
            <template #icon>
              <ChevronLeftIcon />
            </template>
            返回上页
          </t-button>

          <!-- 自定义操作 -->
          <slot name="actions" />
        </t-space>
      </div>

      <!-- 额外内容 -->
      <div v-if="$slots.extra" class="ds-error-page__extra">
        <slot name="extra" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import { useRouter } from 'vue-router';
import {
  HomeIcon,
  ChevronLeftIcon,
  InfoCircleIcon,
  CloseCircleIcon,
  LockOnIcon,
  ServerIcon,
} from 'tdesign-icons-vue-next';

export interface ErrorPageProps {
  code?: number;
  title?: string;
  description?: string;
  showCode?: boolean;
  showBack?: boolean;
  showHome?: boolean;
  homePath?: string;
}

const props = withDefaults(defineProps<ErrorPageProps>(), {
  code: 404,
  showCode: true,
  showBack: true,
  showHome: true,
  homePath: '/',
});

// Router
const router = useRouter();

// 错误类型配置
const errorConfig: Record<number, { title: string; description: string; icon: Component }> = {
  400: {
    title: '请求错误',
    description: '请求参数错误，请检查后重试',
    icon: InfoCircleIcon,
  },
  403: {
    title: '禁止访问',
    description: '您没有权限访问此页面',
    icon: LockOnIcon,
  },
  404: {
    title: '页面不存在',
    description: '抱歉，您访问的页面不存在',
    icon: InfoCircleIcon,
  },
  500: {
    title: '服务器错误',
    description: '服务器遇到了一些问题，请稍后重试',
    icon: ServerIcon,
  },
  502: {
    title: '网关错误',
    description: '服务器网关超时，请稍后重试',
    icon: ServerIcon,
  },
  503: {
    title: '服务不可用',
    description: '服务暂时不可用，请稍后重试',
    icon: ServerIcon,
  },
};

// 计算属性
const currentConfig = computed(() => {
  return errorConfig[props.code] || errorConfig[404];
});

const defaultTitle = computed(() => {
  return currentConfig.value.title;
});

const defaultDescription = computed(() => {
  return currentConfig.value.description;
});

const illustrationComponent = computed(() => {
  return currentConfig.value.icon;
});

// 方法
const handleGoBack = () => {
  router.back();
};

const handleGoHome = () => {
  router.push(props.homePath);
};
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/spacing.less';
@import '../../tokens/typography.less';
@import '../../tokens/color.less';

.ds-error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: @spacing-xxxl @spacing-lg;
  background: var(--td-bg-color-page);
  text-align: center;

  &__content {
    max-width: 600px;
  }

  &__code {
    font-size: 120px;
    font-weight: @font-weight-bold;
    line-height: 1;
    margin-bottom: @spacing-xxl;
    background: linear-gradient(135deg, var(--td-brand-color) 0%, var(--td-brand-color-7) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  &__illustration {
    margin-bottom: @spacing-xxl;
    color: var(--td-text-color-placeholder);
    opacity: 0.6;
  }

  &__title {
    margin: 0 0 @spacing-md 0;
    font-size: @font-size-xxxl;
    font-weight: @font-weight-semibold;
    color: var(--td-text-color-primary);
  }

  &__description {
    margin: 0 0 @spacing-xxxl 0;
    font-size: @font-size-lg;
    color: var(--td-text-color-secondary);
    line-height: @line-height-relaxed;
  }

  &__actions {
    display: flex;
    justify-content: center;
  }

  &__extra {
    margin-top: @spacing-xxxl;
    padding-top: @spacing-xxxl;
    border-top: 1px solid var(--td-border-level-2-color);
  }

  // 错误代码变体
  &--code-400 {
    .ds-error-page__code {
      background: linear-gradient(135deg, #e6a23c 0%, #f56c6c 100%);
    }
  }

  &--code-403 {
    .ds-error-page__code {
      background: linear-gradient(135deg, #f56c6c 0%, #e74c3c 100%);
    }
  }

  &--code-404 {
    .ds-error-page__code {
      background: linear-gradient(135deg, #409eff 0%, #67c23a 100%);
    }
  }

  &--code-500 {
    .ds-error-page__code {
      background: linear-gradient(135deg, #f56c6c 0%, #e74c3c 100%);
    }
  }

  // 响应式
  @media (max-width: 768px) {
    padding: @spacing-xxl @spacing-md;

    &__code {
      font-size: 80px;
      margin-bottom: @spacing-xl;
    }

    &__illustration {
      margin-bottom: @spacing-xl;
    }

    &__title {
      font-size: @font-size-xxl;
    }

    &__description {
      font-size: @font-size-base;
      margin-bottom: @spacing-xxl;
    }

    &__actions {
      flex-direction: column;
      gap: @spacing-md;
    }
  }
}
</style>
