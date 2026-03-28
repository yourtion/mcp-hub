import { ref, watch } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'mcp-hub-theme';

const mode = ref<ThemeMode>(
  (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'auto',
);

function getSystemPreference(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(m: ThemeMode) {
  const resolved = m === 'auto' ? getSystemPreference() : m;
  document.documentElement.setAttribute('data-theme', resolved);
}

export function useTheme() {
  watch(mode, (val) => {
    localStorage.setItem(STORAGE_KEY, val);
    applyTheme(val);
  });

  const resolvedTheme = () => {
    return mode.value === 'auto' ? getSystemPreference() : mode.value;
  };

  const setTheme = (m: ThemeMode) => {
    mode.value = m;
  };

  const toggleTheme = () => {
    const current = resolvedTheme();
    mode.value = current === 'dark' ? 'light' : 'dark';
  };

  return { mode, setTheme, toggleTheme, resolvedTheme, applyTheme };
}
