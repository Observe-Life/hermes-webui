// 聊天库：历史读官方接口，发送走 prompt.submit，流式增量走 message.delta 事件。
import { defineStore } from 'pinia'
import { getLatestSessionMessages, type SessionMessage } from '@/hermes'
import { gatewayClient, onGatewayEvent, PROMPT_SUBMIT_REQUEST_TIMEOUT_MS } from '../contract/runtime'
import { useSessionsStore } from './sessions'
import { useUiStore } from './ui'

export interface Msg { who: 'me' | 'ai'; text: string }

// B3：流式状态按契约携带 turn_id/segment/offset（UTF-16 已发送数），重发块按偏移去重
interface Stream { text: string; applied: number; segment: number | null; turnId: string | null }

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
    stream: null as null | Stream,
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
      this.stream = { text: '', applied: 0, segment: null, turnId: null }
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
        // 重放缺口：恢复游标被淘汰时，弃用累积流、重拉历史快照
        if (ev.type === 'session.replay_gap') {
          this.stream = null
          void this.open(this.activeId)
          return
        }
        if (ev.type === 'message.start') {
          if (!this.stream) this.stream = { text: '', applied: 0, segment: null, turnId: null }
        } else if (ev.type === 'message.delta') {
          const p = ev.payload as { text?: null | string; turn_id?: null | string; segment?: null | number; offset?: null | number }
          // 段界：本轮文字盒在此收口，落成一个气泡，后续段开新气泡
          if (p.text === null || p.text === undefined) {
            if (this.stream && this.stream.text) this.msgs.push({ who: 'ai', text: this.stream.text })
            this.stream = null
            return
          }
          if (!this.stream) this.stream = { text: '', applied: 0, segment: null, turnId: null }
          // 新轮/新段：收口旧气泡、重置偏移
          if ((p.turn_id ?? null) !== this.stream.turnId || (p.segment ?? null) !== this.stream.segment) {
            if (this.stream.text) this.msgs.push({ who: 'ai', text: this.stream.text })
            this.stream = { text: '', applied: 0, segment: p.segment ?? null, turnId: p.turn_id ?? null }
          }
          if (typeof p.text === 'string' && p.text) {
            const off = typeof p.offset === 'number' ? p.offset : null
            // 重发的已应用块直接丢弃（契约：client drops a re-sent chunk it already applied）
            if (off === null || off >= this.stream.applied) {
              this.stream.text += p.text
              if (off !== null) this.stream.applied = off + p.text.length
            }
          }
        } else if (ev.type === 'message.complete') {
          const p = ev.payload as { text?: unknown; status?: null | string; failure_reason?: null | string; warning?: null | string }
          // B2：完整文本优先（防中途丢段静默截断）；服务端失败/警告要给用户看得见的反馈
          if (p.status === 'failure' || p.failure_reason) {
            if (this.stream?.text) this.msgs.push({ who: 'ai', text: this.stream.text })
            this.stream = null
            useUiStore().toastMsg('回复失败：' + (p.failure_reason || p.status || '未知原因'))
            void useSessionsStore().load()
            return
          }
          let final = this.stream?.text || ''
          if (typeof p.text === 'string' && p.text.length >= final.length) final = p.text
          if (final) this.msgs.push({ who: 'ai', text: final })
          else if (p.warning) useUiStore().toastMsg(String(p.warning))
          this.stream = null
          void useSessionsStore().load()
        }
      })
    }
  }
})
