import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

// 契约层路径映射：垫片精确命中优先，其余 @/ 指向契约层根；shared 为官方共享包原样平移。
const contract = (p: string) => new URL(p, import.meta.url).pathname

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: {
      '@/store/session': contract('./src/contract/shims/session.ts'),
      '@/store/windows': contract('./src/contract/shims/windows.ts'),
      '@/store/boot': contract('./src/contract/shims/boot.ts'),
      '@/store/notifications': contract('./src/contract/shims/notifications.ts'),
      '@/store/gateway': contract('./src/contract/shims/gateway.ts'),
      '@/i18n': contract('./src/contract/shims/i18n.ts'),
      '@hermes/shared/skin': contract('./shared/src/skin.ts'),
      '@hermes/shared/translucency': contract('./shared/src/translucency.ts'),
      '@hermes/shared': contract('./shared/src/index.ts'),
      '@': contract('./src/contract')
    }
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    // 开发预览：契约层请求直转官方网关（同源策略下由网关的登录会话凭证说话）。
    proxy: {
      '/api': { target: 'http://192.168.31.115:9120', changeOrigin: true, ws: true },
      // 登录链路一并代理：登录页与其口令接口都在官方网关上；种下的会话凭证
      // 绑定主机（不区分端口），登录一次开发预览即可用。
      '/login': { target: 'http://192.168.31.115:9120', changeOrigin: true },
      '/auth': { target: 'http://192.168.31.115:9120', changeOrigin: true },
      '/fonts': { target: 'http://192.168.31.115:9120', changeOrigin: true }
    }
  }
})
