import { createPinia } from 'pinia';
import TDesign from 'tdesign-vue-next';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './index.css';

// 引入TDesign样式
import 'tdesign-vue-next/es/style/index.css';

const app = createApp(App);

// 安装插件
app.use(createPinia());
app.use(router);
app.use(TDesign);

app.mount('#root');
