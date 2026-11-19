// 会话库：真数据。列表走官方侧栏批量接口，操作走官方会话接口。
import { defineStore } from 'pinia'
import {
  listSidebarSessions,
  renameSession,
  deleteSession,
  setSessionPinnedRemote,
  setSessionArchived,
  setSessionUnreadRemote,
  type SessionInfo
} from '@/hermes'
import { gatewayClient, onGatewayEvent } from '../contract/runtime'
import type { SidebarSessionSlice } from '@/api/sessions'

export interface Row {
  id: string
  name: string
  preview: string
  time: string
  unread: boolean
  pinned: boolean
  running: boolean
  archived: boolean
}

export function fmtTime(ms: number | null | undefined): string {
  if (!ms) return ''
  const d = new Date(ms)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return hm
  const yest = new Date(now.getTime() - 86400000)
  if (d.toDateString() === yest.toDateString()) return '昨天'
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  if (now.getTime() - ms < 6 * 86400000) return week[d.getDay()]
  return `${d.getMonth() + 1}-${d.getDate()}`
}

function mapRow(s: SessionInfo): Row {
  return {
    id: s.id,
    name: s.title || '未命名会话',
    preview: s.preview || '',
    time: fmtTime(s.last_active),
    unread: !!s.unread,
    pinned: !!s.pinned,
    running: !!s.is_active,
    archived: !!s.archived
  }
}

let listening = false
let reloadTimer: null | ReturnType<typeof setTimeout> = null
let lastReload = 0

export const useSessionsStore = defineStore('sessions', {
  state: () => ({
    rows: [] as Row[],
    loaded: false,
    loading: false,
    error: '' as string,
    // 待决策会话（审批/澄清请求待处理）
    decisionIds: [] as string[]
  }),
  getters: {
    pinnedRows: s => s.rows.filter(r => r.pinned),
    talkRows: s => s.rows.filter(r => !r.pinned)
  },
  actions: {
    async load() {
      if (this.loading) return
      this.loading = true
      try {
        const req = { recentsProfile: 'all' as const, recentsLimit: 60, recentsExclude: [] as string[], cronLimit: 0, messagingLimit: 0, messagingExclude: [] as string[] }
        const res = await listSidebarSessions(req)
        const slice: SidebarSessionSlice = res.recents
        this.rows = (slice.sessions || []).map(mapRow)
        this.error = slice.failed ? (slice.retry ? '加载失败' : '') : ''
        this.loaded = true
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e)
      } finally {
        this.loading = false
      }
    },
    scheduleReload() {
      // S2：立即刷 + 合并节流（最多每 700ms 一次），避免高频事件把刷新无限顺延
      const now = Date.now()
      if (now - lastReload >= 700) {
        lastReload = now
        void this.load()
        return
      }
      if (reloadTimer) return
      reloadTimer = setTimeout(() => {
        reloadTimer = null
        lastReload = Date.now()
        void this.load()
      }, 750)
    },
    async rename(id: string, title: string) {
      await renameSession(id, title)
      await this.load()
    },
    async remove(id: string) {
      await deleteSession(id)
      await this.load()
    },
    async togglePin(id: string, pinned: boolean) {
      await setSessionPinnedRemote(id, !pinned)
      await this.load()
    },
    async archive(id: string) {
      await setSessionArchived(id, true)
      await this.load()
    },
    async markRead(id: string) {
      try { await setSessionUnreadRemote(id, false) } catch { /* 静默：未读标记失败不影响阅读 */ }
      const row = this.rows.find(r => r.id === id)
      if (row) row.unread = false
    },
    async create(): Promise<null | string> {
      const r = await gatewayClient().request<{ session_id?: string; info?: { id?: string } }>('session.create', { source: 'webapp' })
      const id = r.session_id || r.info?.id || null
      if (id) await this.load()
      return id
    },
    setDecision(id: string, on: boolean) {
      this.decisionIds = on
        ? [...new Set([...this.decisionIds, id])]
        : this.decisionIds.filter(x => x !== id)
    },
    listen() {
      if (listening) return
      listening = true
      // 侧栏数据变化/会话标题更新 → 重新拉列表（防抖）
      for (const t of ['sessions.changed', 'session.info', 'session.title'] as const) {
        onGatewayEvent(ev => { if (ev.type === t) this.scheduleReload() })
      }
      // 待决策：审批/澄清请求到达与了结
      for (const t of ['approval.request', 'clarify.request'] as const) {
        onGatewayEvent(ev => {
          if (ev.type === t && ev.session_id) this.setDecision(ev.session_id, true)
        })
      }
      for (const t of ['approval.settled', 'clarify.settled'] as const) {
        onGatewayEvent(ev => {
          if (ev.type === t && ev.session_id) this.setDecision(ev.session_id, false)
        })
      }
    }
  }
})
