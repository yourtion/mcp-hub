import { createPinia } from 'pinia';
import TDesign from 'tdesign-vue-next';
import { createApp } from 'vue';
import App from './App.vue';
import { useTheme } from './composables/useTheme';
import router from './router';

import 'tdesign-vue-next/es/style/index.css';
import './index.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(TDesign);

// Initialize theme
const { applyTheme } = useTheme();
applyTheme(useTheme().mode.value);

app.mount('#app');
