// 聊天库：历史读官方接口，发送走 prompt.submit，流式增量走 message.delta 事件。
import { defineStore } from 'pinia'
import { getLatestSessionMessages, type SessionMessage } from '@/hermes'
import { gatewayClient, onGatewayEvent, PROMPT_SUBMIT_REQUEST_TIMEOUT_MS } from '../contract/runtime'
import { useSessionsStore } from './sessions'
import { useUiStore } from './ui'

export interface Msg { who: 'me' | 'ai'; text: string }

// B3：流式状态按契约携带 turn_id/segment/offset（UTF-16 已发送数），重发块按偏移去重
interface Stream { text: string; applied: number; segment: number | null; turnId: string | null }
// 段游标：封口后低于该段号的帧直接忽略（官方 admitSegmentDelta/admitSegmentSeal 语义）
interface Cursor { turnId: string | null; segment: number }

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
    cursor: null as null | Cursor,
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
        } else if (ev.type === 'message.interim') {
          // SR1：段封口事件（工具前评注）。官方 admitSegmentSeal：收口气泡、游标推进到 segment+1
          const p = ev.payload as { turn_id?: null | string; segment?: null | number; text?: null | string; already_streamed?: null | boolean }
          const seg = typeof p.segment === 'number' ? p.segment : 0
          if (!p.already_streamed && typeof p.text === 'string' && p.text) {
            if (this.stream && this.stream.text) this.msgs.push({ who: 'ai', text: this.stream.text })
            this.msgs.push({ who: 'ai', text: p.text })
          } else if (this.stream && this.stream.text) {
            this.msgs.push({ who: 'ai', text: this.stream.text })
          }
          this.stream = null
          this.cursor = { turnId: p.turn_id ?? null, segment: seg + 1 }
        } else if (ev.type === 'message.delta') {
          const p = ev.payload as { text?: null | string; turn_id?: null | string; segment?: null | number; offset?: null | number }
          const seg = typeof p.segment === 'number' ? p.segment : null
          // 过期段：低于已封口游标的帧整体忽略（官方 #144609 防重复气泡）
          if (seg !== null && this.cursor && this.cursor.turnId === (p.turn_id ?? null) && seg < this.cursor.segment) return
          // 段界：本轮文字盒在此收口，落成一个气泡，后续段开新气泡
          if (p.text === null || p.text === undefined) {
            if (this.stream && this.stream.text) this.msgs.push({ who: 'ai', text: this.stream.text })
            this.stream = null
            return
          }
          if (!this.stream) this.stream = { text: '', applied: 0, segment: seg, turnId: p.turn_id ?? null }
          // 仅在真正前进到新段/新轮时收口旧气泡；过期段帧忽略
          if ((seg === null || this.stream.segment === null || seg > this.stream.segment || (p.turn_id ?? null) !== this.stream.turnId)) {
            if (this.stream.text) this.msgs.push({ who: 'ai', text: this.stream.text })
            this.stream = { text: '', applied: 0, segment: seg, turnId: p.turn_id ?? null }
          }
          if (typeof p.text === 'string' && p.text) {
            const off = typeof p.offset === 'number' ? p.offset : null
            // B3R1：官方 admitSegmentDelta 语义——只丢已应用前缀，保留未见尾部
            if (off === null) {
              this.stream.text += p.text
            } else if (off >= this.stream.applied) {
              this.stream.text += p.text
              this.stream.applied = off + p.text.length
            } else {
              const overlap = this.stream.applied - off
              const tail = p.text.slice(Math.max(0, overlap))
              if (tail) {
                this.stream.text += tail
                this.stream.applied = off + p.text.length
              }
            }
          }
        } else if (ev.type === 'message.complete') {
          const p = ev.payload as { text?: unknown; status?: null | string; failure_reason?: null | string; error?: null | string; warning?: null | string }
          // B2R1：契约 TurnStatus='complete'|'error'|'interrupted'；普通服务商错误走 status='error'+payload.error
          const failed = p.status === 'error' || !!p.failure_reason
          let final = this.stream?.text || ''
          if (typeof p.text === 'string' && p.text.length >= final.length) final = p.text
          if (final) this.msgs.push({ who: 'ai', text: final })
          this.stream = null
          this.cursor = null
          if (failed) {
            useUiStore().toastMsg('回复失败：' + (p.failure_reason || p.error || p.status || '未知原因'))
          }
          // SR2：警告与正常回复并存，不进 else
          if (p.warning) useUiStore().toastMsg(String(p.warning))
          void useSessionsStore().load()
        }
      })
    }
  }
})
