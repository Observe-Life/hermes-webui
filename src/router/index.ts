import { createRouter, createWebHashHistory } from 'vue-router'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/sessions' },
    { path: '/sessions', component: () => import('../views/SessionsView.vue') },
    { path: '/chat/:id', component: () => import('../views/ChatView.vue') },
    { path: '/extensions', component: () => import('../views/ExtensionsView.vue') },
    { path: '/settings', component: () => import('../views/SettingsView.vue') }
  ]
})
