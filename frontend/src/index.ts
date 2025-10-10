import { createPinia } from 'pinia';
import TDesign from 'tdesign-vue-next';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { setupGlobalErrorHandler } from './utils/error-handler';
import './index.css';

// 引入TDesign样式
import 'tdesign-vue-next/es/style/index.css';

const app = createApp(App);

// 设置全局错误处理
setupGlobalErrorHandler();

// 安装插件
app.use(createPinia());
app.use(router);
app.use(TDesign);

// 全局错误处理器
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue Error:', err, info);
  // 可以在这里添加错误上报逻辑
};

app.mount('#root');
