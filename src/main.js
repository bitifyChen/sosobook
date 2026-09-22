import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { registerPwa } from './services/pwa';
import '@fontsource-variable/chiron-goround-tc';
import './style.css';

registerPwa();
createApp(App).use(createPinia()).use(router).mount('#app');
