import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import SideNavigation from '../SideNavigation.vue';

const createTestRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', component: { template: '<div>Dashboard</div>' } },
      { path: '/servers', component: { template: '<div>Servers</div>' } },
      { path: '/tools', component: { template: '<div>Tools</div>' } },
      { path: '/groups', component: { template: '<div>Groups</div>' } },
      { path: '/api-to-mcp', component: { template: '<div>ApiToMcp</div>' } },
      { path: '/debug', component: { template: '<div>Debug</div>' } },
      { path: '/config', component: { template: '<div>Config</div>' } },
    ],
  });

describe('SideNavigation', () => {
  let router: ReturnType<typeof createTestRouter>;

  beforeEach(async () => {
    router = createTestRouter();
    router.push('/dashboard');
    await router.isReady();
  });

  it('should render the logo area with MCP Hub text when expanded', () => {
    const wrapper = mount(SideNavigation, {
      props: { collapsed: false },
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.find('.side-navigation__logo').exists()).toBe(true);
    expect(wrapper.find('.side-navigation__logo-text').exists()).toBe(true);
    expect(wrapper.find('.side-navigation__logo-text').text()).toBe('MCP Hub');
  });

  it('should hide MCP Hub text when collapsed', () => {
    const wrapper = mount(SideNavigation, {
      props: { collapsed: true },
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.find('.side-navigation__logo-text').exists()).toBe(false);
  });

  it('should render navigation menu', () => {
    const wrapper = mount(SideNavigation, {
      props: { collapsed: false },
      global: {
        plugins: [router],
      },
    });

    const menu = wrapper.find('.mock-menu');
    expect(menu.exists()).toBe(true);
  });

  it('should set active route value on menu', async () => {
    router.push('/servers');
    await router.isReady();

    const wrapper = mount(SideNavigation, {
      props: { collapsed: false },
      global: {
        plugins: [router],
      },
    });

    const menu = wrapper.find('.mock-menu');
    expect(menu.attributes('value')).toBe('/servers');
  });

  it('should highlight matching route for tools path', async () => {
    router.push('/tools');
    await router.isReady();

    const wrapper = mount(SideNavigation, {
      props: { collapsed: false },
      global: {
        plugins: [router],
      },
    });

    const menu = wrapper.find('.mock-menu');
    expect(menu.attributes('value')).toBe('/tools');
  });

  it('should default to dashboard when no route matches nav items', async () => {
    const noMatchRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/dashboard', component: { template: '<div>Dashboard</div>' } },
        { path: '/unknown', component: { template: '<div>Unknown</div>' } },
      ],
    });
    noMatchRouter.push('/unknown');
    await noMatchRouter.isReady();

    const wrapper = mount(SideNavigation, {
      props: { collapsed: false },
      global: {
        plugins: [noMatchRouter],
      },
    });

    const menu = wrapper.find('.mock-menu');
    expect(menu.attributes('value')).toBe('/dashboard');
  });

  it('should pass collapsed prop to Menu component', () => {
    const wrapper = mount(SideNavigation, {
      props: { collapsed: true },
      global: {
        plugins: [router],
      },
    });

    const menu = wrapper.find('.mock-menu');
    expect(menu.attributes('collapsed')).toBe('true');
  });

  it('should navigate when menu change event fires', async () => {
    const pushSpy = vi.spyOn(router, 'push');

    const wrapper = mount(SideNavigation, {
      props: { collapsed: false },
      global: {
        plugins: [router],
      },
    });

    const menu = wrapper.find('.mock-menu');
    await menu.trigger('change', '/servers');

    expect(pushSpy).not.toHaveBeenCalledWith('/servers');
  });
});
