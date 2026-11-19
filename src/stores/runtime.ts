// 运行时状态：把契约层启动/连接/提示原子映进界面（Pinia 只做界面映射）。
import { defineStore } from 'pinia'
import { bootContract, $bootPhase, $gatewayState } from '../contract/runtime'
import { $bootError } from '../contract/shims/boot'
import { $contractNotices } from '../contract/shims/notifications'
import { useUiStore } from './ui'

let bound = false

export const useRuntimeStore = defineStore('runtime', {
  state: () => ({
    phase: 'idle' as string,
    conn: 'closed' as string,
    bootError: null as null | string
  }),
  actions: {
    bind() {
      if (bound) return
      bound = true
      const ui = useUiStore()
      let lastNotice = 0
      $contractNotices.subscribe(list => {
        if (list.length > lastNotice) {
          ui.toastMsg(list[list.length - 1].text)
          lastNotice = list.length
        }
      })
      $bootPhase.subscribe(p => { this.phase = p })
      $gatewayState.subscribe(s => { this.conn = s })
      $bootError.subscribe(e => { this.bootError = e })
    },
    async boot() {
      this.bind()
      return bootContract()
    },
    async retryAfterSignin() {
      const ok = await bootContract()
      if (!ok && this.phase === 'signin') {
        // 登录完成由「检测到会话后重试」路径触发
      }
      return ok
    },
    async pollSignin() {
      const { isSignedIn } = await import('../contract/runtime')
      return isSignedIn()
    }
  }
})
