import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import AppHeader from '../AppHeader.vue';

// Mock Breadcrumb child component
vi.mock('../Breadcrumb.vue', () => ({
  default: {
    name: 'MockBreadcrumb',
    template: '<div class="mock-breadcrumb-nav" />',
  },
}));

// Mock useTheme composable
const mockToggleTheme = vi.fn();
const mockResolvedTheme = vi.fn().mockReturnValue('light');
vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({
    toggleTheme: mockToggleTheme,
    resolvedTheme: mockResolvedTheme,
    mode: { value: 'light' },
  }),
}));

const createTestRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/dashboard', component: { template: '<div>Dashboard</div>' } }],
  });

describe('AppHeader', () => {
  let router: ReturnType<typeof createTestRouter>;

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    router = createTestRouter();
    router.push('/dashboard');
    await router.isReady();
  });

  it('should render header with left and right sections', () => {
    const wrapper = mount(AppHeader, {
      props: { collapsed: false },
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.find('.app-header__left').exists()).toBe(true);
    expect(wrapper.find('.app-header__right').exists()).toBe(true);
  });

  it('should emit toggle-sidebar when hamburger button is clicked', async () => {
    const wrapper = mount(AppHeader, {
      props: { collapsed: false },
      global: {
        plugins: [router],
      },
    });

    // The first button is the hamburger toggle
    const buttons = wrapper.findAll('.mock-button');
    await buttons[0].trigger('click');

    expect(wrapper.emitted('toggle-sidebar')).toBeTruthy();
  });

  it('should call toggleTheme when theme button is clicked', async () => {
    const wrapper = mount(AppHeader, {
      props: { collapsed: false },
      global: {
        plugins: [router],
      },
    });

    // The theme button is the first button in the right section
    const rightButtons = wrapper.findAll('.app-header__right .mock-button');
    await rightButtons[0].trigger('click');

    expect(mockToggleTheme).toHaveBeenCalled();
  });

  it('should not display username when no user', () => {
    const wrapper = mount(AppHeader, {
      props: { collapsed: false },
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.find('.app-header__username').exists()).toBe(false);
  });
});
