// 界面状态库：只管界面自身（toast、选中态、弹窗、层叠视图）。
// 会话与聊天数据已全部交给 stores/sessions、stores/chat（契约层真数据）。
import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    toast: '',
    activeId: '',
    settingsSection: '',
    settingsSub: '',
    sheetId: '',
    mobileView: null as null | 'settings' | 'extensions'
  }),
  actions: {
    setActive(id: string) { this.activeId = id },
    toastMsg(t: string) {
      this.toast = t
      setTimeout(() => { if (this.toast === t) this.toast = '' }, 1800)
    }
  }
})
