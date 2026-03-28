import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Breadcrumb from '../Breadcrumb.vue';

const createTestRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: { template: '<div>Dashboard</div>' },
        meta: { title: '仪表板' },
      },
      {
        path: '/servers',
        name: 'Servers',
        component: { template: '<div>Servers</div>' },
        meta: { title: '服务器管理' },
      },
    ],
  });

describe('Breadcrumb', () => {
  let router: ReturnType<typeof createTestRouter>;

  beforeEach(async () => {
    router = createTestRouter();
    router.push('/dashboard');
    await router.isReady();
  });

  it('should render the breadcrumb container', () => {
    const wrapper = mount(Breadcrumb, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.find('.app-breadcrumb').exists()).toBe(true);
  });

  it('should show home icon', () => {
    const wrapper = mount(Breadcrumb, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.find('.app-breadcrumb__home-icon').exists()).toBe(true);
  });

  it('should show only home when on dashboard', () => {
    const wrapper = mount(Breadcrumb, {
      global: {
        plugins: [router],
      },
    });

    const breadcrumbItems = wrapper.findAll('.mock-breadcrumb-item');
    // Home item only (Dashboard is filtered out since it's the home page)
    expect(breadcrumbItems.length).toBe(1);
  });

  it('should show breadcrumb items for non-dashboard routes', async () => {
    router.push('/servers');
    await router.isReady();

    const wrapper = mount(Breadcrumb, {
      global: {
        plugins: [router],
      },
    });

    const breadcrumbItems = wrapper.findAll('.mock-breadcrumb-item');
    // Home + Servers
    expect(breadcrumbItems.length).toBe(2);
    expect(breadcrumbItems[1].text()).toBe('服务器管理');
  });

  it('should navigate to dashboard when home icon is clicked', async () => {
    const pushSpy = vi.spyOn(router, 'push');

    const wrapper = mount(Breadcrumb, {
      global: {
        plugins: [router],
      },
    });

    const homeIcon = wrapper.find('.app-breadcrumb__home-icon');
    await homeIcon.trigger('click');

    expect(pushSpy).toHaveBeenCalledWith('/dashboard');
  });
});
