import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // 后端API包
  {
    extends: './backend/vitest.config.ts',
    test: {
      name: 'backend',
      root: './backend',
    },
  },
  // 核心包
  {
    extends: './packages/core/vitest.config.ts',
    test: {
      name: 'core',
      root: './packages/core',
    },
  },
  // CLI包
  {
    extends: './packages/cli/vitest.config.ts',
    test: {
      name: 'cli',
      root: './packages/cli',
    },
  },
])