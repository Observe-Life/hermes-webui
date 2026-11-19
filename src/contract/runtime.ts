// 启动胶水（我们自己的代码，非契约层）：装浏览器桥→取连接→拨号网关对话通道。
import { installBrowserDesktopBridge } from '@/lib/browser-desktop-bridge'
import { browserBootstrap, BrowserReauthRequiredError } from '@/lib/browser-transport'
import { $bootError } from '@/store/boot'
import { resolveDesktopGatewayWsUrl } from '@/lib/gateway-ws-url'
import { atom } from 'nanostores'
import { HermesGateway, PROMPT_SUBMIT_REQUEST_TIMEOUT_MS, STARTUP_REQUEST_TIMEOUT_MS } from '@/hermes'
import type { GatewayEvent } from '@hermes/shared'

export { PROMPT_SUBMIT_REQUEST_TIMEOUT_MS, STARTUP_REQUEST_TIMEOUT_MS }
export type BootPhase = 'idle' | 'booting' | 'ready' | 'signin' | 'error'
export const $bootPhase = atom<BootPhase>('idle')
export const $gatewayState = atom<string>('closed')

let gateway: HermesGateway | null = null
let booting: null | Promise<boolean> = null

export function gatewayClient(): HermesGateway {
  if (!gateway) throw new Error('契约层尚未就绪（服务器连接未建立）')
  return gateway
}

export function onGatewayEvent(handler: (ev: GatewayEvent) => void): () => void {
  return gatewayClient().onAny(handler)
}

export async function bootContract(): Promise<boolean> {
  if (gateway) return true
  if (booting) return booting
  const run = (async () => {
    if (!installBrowserDesktopBridge() && !window.hermesDesktop) {
      $bootError.set('页面缺少服务器身份标记（请用 5173 端口的开发预览打开）')
      $bootPhase.set('error')
      return false
    }
    $bootPhase.set('booting')
    try {
      const desktop = window.hermesDesktop!
      const conn = await desktop.getConnection(undefined)
      // 官方两段式拨号：先取连接描述符，再铸一次性票据对话通道（resolveGatewayWsUrl）
      const wsUrl = await resolveDesktopGatewayWsUrl(desktop, conn)
      const g = new HermesGateway()
      g.onState(state => $gatewayState.set(state))
      await g.connect(wsUrl)
      gateway = g
      $bootPhase.set('ready')
      return true
    } catch (e) {
      if (e instanceof BrowserReauthRequiredError) {
        $bootPhase.set('signin')
      } else {
        $bootError.set(e instanceof Error ? e.message : String(e))
        $bootPhase.set('error')
      }
      return false
    }
  })()
  booting = run
  const ok = await run
  // B1：失败不复位缓存会把重试按钮和登录后自动重连一起锁死；成功则保留缓存
  if (!ok) booting = null
  return ok
}

export function isSignedIn(): Promise<boolean> {
  return fetch('/api/auth/me', { credentials: 'same-origin' }).then(r => r.ok).catch(() => false)
}
