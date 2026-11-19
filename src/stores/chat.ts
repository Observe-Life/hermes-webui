// 聊天库：历史读官方接口，发送走 prompt.submit，流式增量走 message.delta 事件。
import { defineStore } from 'pinia'
import { getLatestSessionMessages, type SessionMessage } from '@/hermes'
import { gatewayClient, onGatewayEvent, PROMPT_SUBMIT_REQUEST_TIMEOUT_MS } from '../contract/runtime'
import { useSessionsStore } from './sessions'
import { useUiStore } from './ui'

export interface Msg { who: 'me' | 'ai'; text: string }

function textOf(v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) {
    // 内容零件列表：抽取文字零件
    return v.map(p => (p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : '')).join('')
  }
  return ''
}

function mapHistory(list: SessionMessage[]): Msg[] {
  const out: Msg[] = []
  for (const m of list) {
    const role = (m as { role?: string }).role
    if (role === 'user') {
      const t = textOf(m.display_content ?? m.content)
      if (t) out.push({ who: 'me', text: t })
    } else if (role === 'assistant') {
      const t = textOf(m.display_content ?? m.content)
      if (t) out.push({ who: 'ai', text: t })
    }
    // tool 等内部行不渲染（后续阶段再上工具行界面）
  }
  return out
}

let listening = false

export const useChatStore = defineStore('chat', {
  state: () => ({
    activeId: '' as string,
    msgs: [] as Msg[],
    stream: null as null | { text: string },
    sending: false,
    loaded: false
  }),
  actions: {
    async open(id: string) {
      this.activeId = id
      this.stream = null
      this.msgs = []
      this.loaded = false
      try {
        const res = await getLatestSessionMessages(id)
        this.msgs = mapHistory(res.messages || [])
      } catch (e) {
        useUiStore().toastMsg(e instanceof Error ? e.message : String(e))
      }
      this.loaded = true
      void useSessionsStore().markRead(id)
    },
    async send(text: string) {
      const t = text.trim()
      if (!t || !this.activeId || this.sending) return
      this.msgs.push({ who: 'me', text: t })
      this.stream = { text: '' }
      this.sending = true
      try {
        await gatewayClient().request('prompt.submit', { session_id: this.activeId, text: t }, PROMPT_SUBMIT_REQUEST_TIMEOUT_MS)
      } catch (e) {
        this.stream = null
        useUiStore().toastMsg(e instanceof Error ? e.message : String(e))
      } finally {
        this.sending = false
      }
    },
    listen() {
      if (listening) return
      listening = true
      onGatewayEvent(ev => {
        if (!ev.session_id || ev.session_id !== this.activeId) return
        if (ev.type === 'message.start') {
          if (!this.stream) this.stream = { text: '' }
        } else if (ev.type === 'message.delta') {
          const p = ev.payload as { text?: null | string }
          if (this.stream && typeof p.text === 'string' && p.text) this.stream.text += p.text
        } else if (ev.type === 'message.complete') {
          const p = ev.payload as { text?: unknown; rendered?: unknown }
          let final = this.stream?.text || ''
          const t = typeof p.text === 'string' ? p.text : ''
          if (!final && t) final = t
          if (final) this.msgs.push({ who: 'ai', text: final })
          this.stream = null
          void useSessionsStore().load()
        }
      })
    }
  }
})
