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
      // S7：按通知序号判新（dismiss 会让长度回落，长度比较会漏弹）
      const seen = new Set<string>()
      $contractNotices.subscribe(list => {
        for (const n of list) {
          if (seen.has(n.id)) continue
          seen.add(n.id)
          ui.toastMsg(n.text)
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
    async pollSignin() {
      const { isSignedIn } = await import('../contract/runtime')
      return isSignedIn()
    }
  }
})
