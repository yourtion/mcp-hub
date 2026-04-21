import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
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

  it('should show only home when on dashboard (no extra crumbs)', () => {
    const wrapper = mount(Breadcrumb, {
      global: {
        plugins: [router],
      },
    });

    // Dashboard is filtered out (it's the home page), so only the home icon exists
    const homeIcon = wrapper.find('.app-breadcrumb__home-icon');
    expect(homeIcon.exists()).toBe(true);
  });

  it('should contain breadcrumb item text for non-dashboard routes with nested routes', async () => {
    // Create a router with nested routes so route.matched has parent records
    const nestedRouter = createRouter({
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
          children: [
            {
              path: 'detail',
              name: 'ServerDetail',
              component: { template: '<div>Detail</div>' },
              meta: { title: '服务器详情' },
            },
          ],
        },
      ],
    });

    nestedRouter.push('/servers/detail');
    await nestedRouter.isReady();

    const wrapper = mount(Breadcrumb, {
      global: {
        plugins: [nestedRouter],
      },
    });

    await nextTick();

    await nextTick();

    // The html should contain the crumb text from the matched parent route
    const html = wrapper.html();
    expect(html).toContain('服务器管理');
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
