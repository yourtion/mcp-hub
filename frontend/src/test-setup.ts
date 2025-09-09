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
