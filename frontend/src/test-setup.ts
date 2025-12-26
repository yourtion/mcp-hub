import { config } from '@vue/test-utils';
import { vi } from 'vitest';

// Configure Vue Test Utils
config.global.stubs = {
  TTag: {
    template: '<div class="t-tag"><slot /></div>',
    props: ['theme', 'variant'],
  },
  TIcon: {
    template: '<div class="t-icon"><slot /></div>',
  },
  TTable: {
    template: '<div class="mock-table"><slot /></div>',
    props: ['data', 'columns', 'loading'],
  },
  TCard: {
    template: '<div class="mock-card"><slot name="header" /><slot /></div>',
    props: ['hover'],
  },
  TButton: {
    template:
      '<button class="mock-button"><slot name="icon" /><slot /></button>',
    props: ['theme', 'variant', 'loading', 'size'],
  },
  TInput: {
    template: '<input class="mock-input" />',
    props: ['modelValue', 'placeholder', 'clearable'],
  },
  TSelect: {
    template: '<select class="mock-select"><slot /></select>',
    props: ['modelValue', 'placeholder', 'clearable'],
  },
  TOption: {
    template: '<option class="mock-option"><slot /></option>',
    props: ['value', 'label'],
  },
  TTooltip: {
    template: '<div class="mock-tooltip"><slot /></div>',
    props: ['content'],
  },
  TDropdown: {
    template: '<div class="mock-dropdown"><slot /></div>',
    props: ['options', 'trigger'],
  },
  TProgress: {
    template: '<div class="mock-progress" />',
    props: ['percentage', 'status', 'showInfo', 'size'],
  },
  TEmpty: {
    template: '<div class="mock-empty"><slot name="action" /></div>',
    props: ['description'],
  },
  TSpace: {
    template: '<div class="mock-space"><slot /></div>',
  },
  TPopconfirm: {
    template: '<div class="mock-popconfirm"><slot /></div>',
    props: ['content', 'onConfirm'],
  },
  TRow: {
    template: '<div class="mock-row"><slot /></div>',
    props: ['gutter'],
  },
  TCol: {
    template: '<div class="mock-col"><slot /></div>',
    props: ['span'],
  },
  TDivider: {
    template: '<div class="mock-divider" />',
  },
  TCheckboxGroup: {
    template: '<div class="mock-checkbox-group"><slot /></div>',
    props: ['options', 'modelValue'],
  },
  TTextarea: {
    template: '<textarea class="mock-textarea" />',
    props: ['value', 'readonly', 'rows'],
  },
  TSwitch: {
    template: '<input type="checkbox" class="mock-switch" />',
    props: ['modelValue', 'disabled'],
  },
  TUpload: {
    template: '<div class="mock-upload"><slot /></div>',
    props: ['modelValue', 'format', 'max', 'disabled', 'theme', 'accept'],
  },
  TRadioGroup: {
    template: '<div class="mock-radio-group"><slot /></div>',
    props: ['modelValue', 'variant'],
  },
};

// Mock MessagePlugin
config.global.mocks = {
  $message: {
    success: vi.fn(),
    error: vi.fn(),
  },
};

// Global test utilities
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
