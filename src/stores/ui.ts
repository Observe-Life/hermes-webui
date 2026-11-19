import { defineStore } from 'pinia'
import { FAKE_SESSIONS, REPLY_POOL, type FakeSession } from '../data'

export interface ChatMsg { who: 'me' | 'ai'; text: string; streaming?: boolean }

export const useUiStore = defineStore('ui', {
  state: () => ({
    sessions: FAKE_SESSIONS as FakeSession[],
    chats: {} as Record<string, ChatMsg[]>,
    settings: { compactList: false, streamEffect: true },
    replying: false,
    toast: '',
    activeId: 'webui',
    settingsSection: '',
    mobileView: null as null | 'settings' | 'extensions'
  }),
  getters: {
    pinned: (s) => s.sessions.filter(x => x.pinned),
    chats_: (s) => s.sessions.filter(x => !x.pinned)
  },
  actions: {
    setActive(id: string) { this.activeId = id },
    toastMsg(t: string) {
      this.toast = t
      setTimeout(() => { if (this.toast === t) this.toast = '' }, 1800)
    },
    togglePin(id: string) {
      const s = this.sessions.find(x => x.id === id)
      if (s) { s.pinned = !s.pinned; this.toastMsg(s.pinned ? '已置顶' : '已取消置顶') }
    },
    renameSession(id: string, name: string) {
      const s = this.sessions.find(x => x.id === id)
      if (s && name.trim()) { s.name = name.trim(); this.toastMsg('已重命名') }
    },
    removeSession(id: string) {
      this.sessions = this.sessions.filter(x => x.id !== id)
      delete this.chats[id]
      if (this.activeId === id) this.activeId = this.sessions[0]?.id || ''
    },
    addSession(): FakeSession {
      const s: FakeSession = {
        id: 'n' + Date.now(), name: '新会话', mono: '新', color: '#0075de',
        preview: '新会话', time: '现在', unread: 0
      }
      this.sessions.unshift(s)
      return s
    },
    seed(id: string) {
      if (this.chats[id]) return
      const s = this.sessions.find(x => x.id === id)
      if (s && s.preview === '新会话') { this.chats[id] = []; return }
      this.chats[id] = s ? [
        { who: 'me', text: s.preview.startsWith('你：') ? s.preview.slice(2) : s.preview },
        { who: 'ai', text: '这条是原型阶段的演示回复——界面已接上路由与状态，数据还没接后端。' }
      ] : []
    },
    markRead(id: string) {
      const s = this.sessions.find(x => x.id === id)
      if (s) s.unread = 0
    },
    send(id: string, text: string) {
      this.seed(id)
      this.chats[id].push({ who: 'me', text })
      if (!this.settings.streamEffect) {
        this.chats[id].push({ who: 'ai', text: REPLY_POOL[this.chats[id].length % REPLY_POOL.length] })
        return
      }
      this.replying = true
      const full = REPLY_POOL[this.chats[id].length % REPLY_POOL.length]
      const msg: ChatMsg = { who: 'ai', text: '', streaming: true }
      this.chats[id].push(msg)
      let i = 0
      const t = setInterval(() => {
        i += 2
        msg.text = full.slice(0, i)
        if (i >= full.length) {
          msg.streaming = false
          this.replying = false
          clearInterval(t)
        }
      }, 45)
    }
  }
})
