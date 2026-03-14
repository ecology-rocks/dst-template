import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

// Ensure you have initialized Firebase in a file like src/firebase.js
import './firebase' 

createApp(App).use(router).mount('#app')