<template>
  <v-main class="shell" :class="{ desktop: mdAndUp }">
    <!-- 手机：双页跟手平移 -->
    <div
      v-if="!mdAndUp" class="pager"
      @touchstart="ts" @touchmove="tm" @touchend="te" @touchcancel="te">
      <div class="track" :class="{ anim: !dragging }" :style="trackStyle">
        <div class="pane">
          <div class="pane-inner">
            <SessionsView embedded @open="go(1)" />
            <div class="dim" :style="dimStyle(0)" />
          </div>
        </div>
        <div class="pane">
          <div class="pane-inner">
            <ChatView :sid="ui.activeId" @back="go(0)" />
            <div class="dim" :style="dimStyle(1)" />
          </div>
        </div>
      </div>
    </div>

    <!-- 电脑：左列表 + 右聊天，同一套设计元素 -->
    <div v-else class="desk">
      <div class="desk-list"><SessionsView embedded /></div>
      <div class="desk-chat"><ChatView :sid="ui.activeId" /></div>
    </div>

    <!-- 扩展 / 设置：滑入式全屏层（手机电脑通用） -->
    <transition name="pagein">
      <SettingsView
        v-if="ui.mobileView === 'settings'"
        overlay class="overlay" @close="closeOverlay" />
    </transition>
    <transition name="pagein">
      <ExtensionsView
        v-if="ui.mobileView === 'extensions'"
        overlay class="overlay" @close="closeOverlay" />
    </transition>
  </v-main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useUiStore } from '../stores/ui'
import SessionsView from '../views/SessionsView.vue'
import ChatView from '../views/ChatView.vue'
import SettingsView from '../views/SettingsView.vue'
import ExtensionsView from '../views/ExtensionsView.vue'

const ui = useUiStore()
const { mdAndUp } = useDisplay()
const pane = ref(0)
const dragging = ref(false)
const drag = ref(0)

let sx = 0, sy = 0, st = 0, lx = 0, lt = 0

function ts(e: TouchEvent) {
  if (mdAndUp.value) return
  const t = e.touches[0]
  sx = t.clientX; sy = t.clientY; st = Date.now(); lx = sx; lt = st
  dragging.value = false; drag.value = 0
}
function tm(e: TouchEvent) {
  if (mdAndUp.value) return
  const t = e.touches[0]
  const dx = t.clientX - sx, dy = t.clientY - sy
  if (!dragging.value) {
    if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.2) return
    const allowed = (pane.value === 0 && dx < 0) || (pane.value === 1 && dx > 0)
    if (!allowed) return
    dragging.value = true
  }
  let d = dx
  if (pane.value === 0) d = Math.min(0, Math.max(dx, -window.innerWidth))
  else d = Math.max(0, Math.min(dx, window.innerWidth))
  drag.value = d
  lx = t.clientX; lt = Date.now()
}
function te() {
  if (mdAndUp.value) return
  if (!dragging.value) { drag.value = 0; return }
  const w = window.innerWidth
  const elapsed = Math.max(1, lt - st)
  const v = Math.abs(lx - sx) / elapsed
  const commit = Math.abs(drag.value) > w * 0.25 || (Math.abs(drag.value) > 50 && v > 0.45)
  if (commit) {
    if (pane.value === 0) { pane.value = 1; history.pushState({ l: 'chat' }, '') }
    else { pane.value = 0; history.back() }
  }
  dragging.value = false
  drag.value = 0
}
function go(p: number) {
  if (mdAndUp.value) return
  if (p === 1 && pane.value === 0) { pane.value = 1; history.pushState({ l: 'chat' }, '') }
  else if (p === 0 && pane.value === 1) { pane.value = 0; history.back() }
}

function dimStyle(idx: number) {
  if (mdAndUp.value) return { opacity: '0', transition: 'none' }
  const w = window.innerWidth || 360
  const exiting = pane.value === idx ? Math.abs(drag.value) / w : 0
  const op = Math.min(0.5, exiting * 0.5)
  return { opacity: String(op), transition: dragging.value ? 'none' : 'opacity 0.3s' }
}

const trackStyle = computed(() => ({
  transform: `translateX(calc(${-pane.value * 50}% + ${drag.value}px))`
}))

// 扩展/设置层拦截系统返回键：打开时压入历史，返回键（popstate）关闭
watch(() => ui.mobileView, (v) => {
  if (v) history.pushState({ m: v }, '')
})
function onPop() {
  // 从最上层开始逐层关：设置三级子页 > 设置二级页 > 设置/扩展层 > 会话弹窗 > 聊天页
  if (ui.settingsSub) ui.settingsSub = ''
  else if (ui.settingsSection) ui.settingsSection = ''
  else if (ui.mobileView) ui.mobileView = null
  else if (ui.sheetId) ui.sheetId = ''
  else if (pane.value === 1) pane.value = 0
}
function closeOverlay() { history.back() }
onMounted(() => window.addEventListener('popstate', onPop))
onUnmounted(() => window.removeEventListener('popstate', onPop))
</script>

<style scoped>
.shell { height: 100dvh; position: relative; overflow: hidden; }
.pager { height: 100%; overflow: hidden; touch-action: pan-y; }
.track { display: flex; width: 200%; height: 100%; }
.track.anim { transition: transform 0.3s cubic-bezier(0.3, 0.7, 0.3, 1); }
.pane { width: 50%; height: 100%; overflow: hidden; }
.pane-inner { position: relative; height: 100%; }
.dim { position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none; }

/* 电脑：左列表固定宽，右聊天填满 */
.desk { display: flex; height: 100%; }
.desk-list { width: 330px; flex: none; position: relative; border-right: 1px solid rgba(0,0,0,0.1); }
.desk-chat { flex: 1; min-width: 0; height: 100%; }

.overlay {
  position: absolute; inset: 0; z-index: 10;
  background: rgb(var(--v-theme-background));
}
.pagein-enter-active, .pagein-leave-active { transition: transform 0.26s cubic-bezier(0.3, 0.7, 0.3, 1); }
.pagein-enter-from, .pagein-leave-to { transform: translateX(100%); }
</style>
