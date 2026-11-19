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
      // 开发预览直转官方网关；来源头改写为官方网页端自己的地址——
      // 网关的跨站写保护（Cookie 鉴权的写请求必须来自 Webapp 同源）因此放行。
      // 仅开发态生效；产线走官方容器托管，天然同源，无需此改写。
      '/api': { target: 'http://192.168.31.115:9120', changeOrigin: true, ws: true, headers: { origin: 'http://192.168.31.115:9120' } },
      '/login': { target: 'http://192.168.31.115:9120', changeOrigin: true, headers: { origin: 'http://192.168.31.115:9120' } },
      '/auth': { target: 'http://192.168.31.115:9120', changeOrigin: true, headers: { origin: 'http://192.168.31.115:9120' } },
      '/fonts': { target: 'http://192.168.31.115:9120', changeOrigin: true }
    }
  }
})
