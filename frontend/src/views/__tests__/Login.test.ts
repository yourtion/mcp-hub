import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Login from '../Login.vue';

// Mock auth store
const mockLogin = vi.fn();
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    login: mockLogin,
    isAuthenticated: false,
    user: null,
    token: null,
    loading: false,
    error: null,
  }),
}));

// Mock tdesign-icons-vue-next
vi.mock('tdesign-icons-vue-next', () => ({
  UserIcon: { name: 'UserIcon', template: '<i class="mock-icon">User</i>' },
  LockOnIcon: { name: 'LockOnIcon', template: '<i class="mock-icon">Lock</i>' },
}));

const createTestRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/login',
        name: 'Login',
        component: { template: '<div>Login</div>' },
      },
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: { template: '<div>Dashboard</div>' },
      },
    ],
  });

// Stub components that are not in test-setup.ts global stubs
const globalStubs = {
  TForm: {
    name: 'TForm',
    template: `
      <form class="mock-t-form" @submit.prevent="$emit('submit', { validateResult: true })">
        <slot />
      </form>
    `,
    props: ['data', 'rules', 'labelWidth'],
    emits: ['submit'],
  },
  TFormItem: {
    name: 'TFormItem',
    template: '<div class="mock-t-form-item"><slot /></div>',
    props: ['name', 'label'],
  },
  TCheckbox: {
    name: 'TCheckbox',
    template: '<input type="checkbox" class="mock-t-checkbox" />',
    props: ['modelValue'],
    emits: ['update:modelValue'],
  },
};

describe('Login', () => {
  let router: ReturnType<typeof createTestRouter>;

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    router = createTestRouter();
    router.push('/login');
    await router.isReady();
  });

  it('should render the login page with title and subtitle', () => {
    const wrapper = mount(Login, {
      global: {
        plugins: [router],
        stubs: globalStubs,
      },
    });

    expect(wrapper.find('.login-page').exists()).toBe(true);
    expect(wrapper.find('.login-card').exists()).toBe(true);
    expect(wrapper.find('.login-title').text()).toBe('MCP Hub');
    expect(wrapper.find('.login-subtitle').text()).toBe(
      'Model Context Protocol 管理平台',
    );
  });

  it('should render form with username and password fields', () => {
    const wrapper = mount(Login, {
      global: {
        plugins: [router],
        stubs: globalStubs,
      },
    });

    const formItems = wrapper.findAll('.mock-t-form-item');
    expect(formItems.length).toBeGreaterThanOrEqual(2);

    const inputs = wrapper.findAll('.mock-input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('should render the login button', () => {
    const wrapper = mount(Login, {
      global: {
        plugins: [router],
        stubs: globalStubs,
      },
    });

    const buttons = wrapper.findAll('.mock-button');
    const loginButton = buttons.find((btn) => btn.text().includes('登录'));
    expect(loginButton).toBeDefined();
  });

  it('should render the remember-me checkbox', () => {
    const wrapper = mount(Login, {
      global: {
        plugins: [router],
        stubs: globalStubs,
      },
    });

    const checkbox = wrapper.find('.mock-t-checkbox');
    expect(checkbox.exists()).toBe(true);
  });

  it('should not show error message initially', () => {
    const wrapper = mount(Login, {
      global: {
        plugins: [router],
        stubs: globalStubs,
      },
    });

    expect(wrapper.find('.login-error').exists()).toBe(false);
  });

  it('should call authStore.login on form submit with form data', async () => {
    mockLogin.mockResolvedValue(undefined);

    const wrapper = mount(Login, {
      global: {
        plugins: [router],
        stubs: globalStubs,
      },
    });

    const form = wrapper.find('.mock-t-form');
    await form.trigger('submit');

    expect(mockLogin).toHaveBeenCalledWith({
      username: '',
      password: '',
    });
  });

  it('should redirect to dashboard after successful login', async () => {
    mockLogin.mockResolvedValue(undefined);
    const pushSpy = vi.spyOn(router, 'push');

    const wrapper = mount(Login, {
      global: {
        plugins: [router],
        stubs: globalStubs,
      },
    });

    const form = wrapper.find('.mock-t-form');
    await form.trigger('submit');
    await wrapper.vm.$nextTick();

    expect(pushSpy).toHaveBeenCalledWith('/dashboard');
  });

  it('should redirect to query redirect path after successful login', async () => {
    mockLogin.mockResolvedValue(undefined);
    const pushSpy = vi.spyOn(router, 'push');

    // Push to login with redirect query
    await router.push({ path: '/login', query: { redirect: '/servers' } });

    const wrapper = mount(Login, {
      global: {
        plugins: [router],
        stubs: globalStubs,
      },
    });

    const form = wrapper.find('.mock-t-form');
    await form.trigger('submit');
    await wrapper.vm.$nextTick();

    expect(pushSpy).toHaveBeenCalledWith('/servers');
  });

  it('should display error message on login failure with Error instance', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));

    const wrapper = mount(Login, {
      global: {
        plugins: [router],
        stubs: globalStubs,
      },
    });

    const form = wrapper.find('.mock-t-form');
    await form.trigger('submit');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.login-error').exists()).toBe(true);
    expect(wrapper.find('.login-error').text()).toBe('Invalid credentials');
  });

  it('should display default error message for non-Error throw', async () => {
    mockLogin.mockRejectedValue('unknown error');

    const wrapper = mount(Login, {
      global: {
        plugins: [router],
        stubs: globalStubs,
      },
    });

    const form = wrapper.find('.mock-t-form');
    await form.trigger('submit');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.login-error').exists()).toBe(true);
    expect(wrapper.find('.login-error').text()).toBe(
      '登录失败，请检查用户名和密码',
    );
  });
});
