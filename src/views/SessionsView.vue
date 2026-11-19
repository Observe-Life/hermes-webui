<template>
  <div class="fill-height">
    <v-toolbar density="comfortable" flat color="background">
      <v-toolbar-title class="font-weight-bold">Hermes</v-toolbar-title>
      <v-spacer />
      <v-btn icon="mdi-puzzle-outline" variant="text" @click="goExtensions" />
      <v-btn icon="mdi-cog-outline" variant="text" @click="goSettings" />
    </v-toolbar>
    <div class="px-4 pb-2">
      <v-text-field
        v-model="q" density="comfortable" variant="solo-filled" flat
        prepend-inner-icon="mdi-magnify" placeholder="搜索会话" hide-details rounded="lg" />
    </div>
    <div class="px-3 overflow-y-auto listarea">
      <template v-for="group in groups" :key="group.label">
        <div v-if="group.items.length" class="grp">{{ group.label }}</div>
        <component
          :is="embedded ? 'div' : 'router-link'"
          v-for="s in group.items" :key="s.id"
          class="srow"
          :to="embedded ? undefined : '/chat/' + s.id"
          @click="rowClick(s.id)"
          @touchstart.passive="pressStart(s.id, $event)"
          @touchmove.passive="pressMove"
          @touchend.passive="pressEnd"
          @touchcancel="pressEnd"
          @contextmenu.prevent="openSheet(s.id)">
          <div class="ava" :style="{ background: s.color }">{{ s.mono }}</div>
          <div class="mid">
            <div class="t1">
              <span class="tname">{{ s.name }}</span>
              <span v-if="s.running" class="run-pill"><span class="spin" />进行中</span>
            </div>
            <div class="t2">{{ s.preview }}</div>
          </div>
          <div class="side">
            <span class="time">{{ s.time }}</span>
            <span v-if="s.unread" class="dot" />
          </div>
        </component>
      </template>
      <div style="height: 96px" />
    </div>

    <!-- 右下角悬浮新建按钮 -->
    <v-btn
      icon="mdi-square-edit-outline" color="primary" class="fab"
      size="48" rounded="circle" elevation="3" @click="newChat" />

    <!-- 长按弹窗：完全照抄参考图 -->
    <teleport to="body">
      <transition name="fade">
        <div v-if="sheetId" class="scrim" @click="sheetId = ''" />
      </transition>
      <transition name="sheetup">
        <div v-if="sheetId" class="sheet" @click.stop>
          <div class="handle" />
          <div class="sheet-title">{{ sheetSession?.name }}</div>
          <div class="sheet-sub">{{ activeText }}</div>
          <div class="sheet-row" @click="doRename">
            <div class="tile"><v-icon icon="mdi-pencil-outline" size="20" /></div>
            <span>重命名</span>
          </div>
          <div class="sheet-row" @click="doPin">
            <div class="tile"><v-icon :icon="sheetSession?.pinned ? 'mdi-pin-off-outline' : 'mdi-pin-outline'" size="20" /></div>
            <span>{{ sheetSession?.pinned ? '取消置顶' : '置顶' }}</span>
          </div>
          <div class="sheet-row" @click="doArchive">
            <div class="tile"><v-icon icon="mdi-archive-outline" size="20" /></div>
            <span>归档</span>
          </div>
          <div class="sheet-row del" @click="doDelete">
            <div class="tile del"><v-icon icon="mdi-trash-can-outline" size="20" /></div>
            <span>删除</span>
          </div>
        </div>
      </transition>
      <v-dialog v-model="renaming" width="320">
        <v-card rounded="xl">
          <v-card-text class="pt-4">
            <v-text-field
              v-model="renameText" label="会话名称" variant="outlined" density="comfortable"
              hide-details @keyup.enter="saveRename" />
          </v-card-text>
          <v-card-actions class="px-4 pb-3">
            <v-spacer />
            <v-btn variant="text" @click="renaming = false">取消</v-btn>
            <v-btn color="primary" variant="flat" @click="saveRename">保存</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '../stores/ui'

const props = defineProps<{ embedded?: boolean }>()
const emit = defineEmits<{ open: [] }>()
const ui = useUiStore()
const router = useRouter()
const q = ref('')
const match = (t: string) => !q.value || t.toLowerCase().includes(q.value.toLowerCase())
const groups = computed(() => [
  { label: '置顶', items: ui.pinned.filter(x => match(x.name + x.preview)) },
  { label: '对话', items: ui.chats_.filter(x => match(x.name + x.preview)) }
])

let pressTimer: number | undefined
let suppress = false
let px = 0, py = 0
function pressStart(id: string, e: TouchEvent) {
  const t = e.touches[0]
  px = t?.clientX ?? 0; py = t?.clientY ?? 0
  suppress = false
  pressTimer = window.setTimeout(() => { suppress = true; openSheet(id) }, 500)
}
function pressMove(e: TouchEvent) {
  if (!pressTimer) return
  const t = e.touches[0]
  if (Math.abs((t?.clientX ?? 0) - px) > 10 || Math.abs((t?.clientY ?? 0) - py) > 10) {
    clearTimeout(pressTimer); pressTimer = undefined
  }
}
function pressEnd() { if (pressTimer) { clearTimeout(pressTimer); pressTimer = undefined } }

function rowClick(id: string) {
  if (suppress) { suppress = false; return }
  if (props.embedded) openSession(id)
  else router.push('/chat/' + id)
}
function openSession(id: string) {
  ui.setActive(id)
  ui.markRead(id)
  emit('open')
}
function newChat() {
  const s = ui.addSession()
  if (props.embedded) openSession(s.id)
  else router.push('/chat/' + s.id)
}
function goSettings() {
  if (props.embedded) ui.mobileView = 'settings'
  else router.push('/settings')
}
function goExtensions() {
  if (props.embedded) ui.mobileView = 'extensions'
  else router.push('/extensions')
}

// 长按弹窗
const sheetId = ref('')
const renaming = ref(false)
const renameText = ref('')
const sheetSession = computed(() => ui.sessions.find(s => s.id === sheetId.value))
const activeText = computed(() => {
  const t = sheetSession.value?.time || ''
  if (t === '现在') return '刚刚活跃'
  if (t === '昨天') return '1 天前活跃'
  if (/^\\d{2}:\\d{2}$/.test(t)) return '今天活跃'
  return '2 天前活跃'
})
function openSheet(id: string) {
  pressEnd()
  sheetId.value = id
}
function doRename() {
  renameText.value = sheetSession.value?.name || ''
  renaming.value = true
}
function saveRename() {
  if (sheetId.value) ui.renameSession(sheetId.value, renameText.value)
  renaming.value = false
  sheetId.value = ''
}
function doPin() {
  if (sheetId.value) ui.togglePin(sheetId.value)
  sheetId.value = ''
}
function doArchive() {
  if (sheetId.value) { ui.removeSession(sheetId.value); ui.toastMsg('已归档') }
  sheetId.value = ''
}
function doDelete() {
  if (sheetId.value) { ui.removeSession(sheetId.value); ui.toastMsg('已删除') }
  sheetId.value = ''
}
</script>

<style scoped>
/* 会话标题区：间距全面收紧 */
.listarea { height: calc(100% - 124px); }
.grp {
  font-size: 11px; font-weight: 700; letter-spacing: 1.2px;
  color: #a39e98; padding: 9px 6px 3px;
}
.grp:first-child { padding-top: 6px; }
.srow {
  display: flex; align-items: center; gap: 10px;
  padding: 5px 6px; border-radius: 10px;
  text-decoration: none; color: rgba(0, 0, 0, 0.95);
  cursor: pointer; user-select: none; -webkit-user-select: none;
}
.srow:hover { background: #f6f5f4; }
.mid { flex: 1; min-width: 0; }
.t1 {
  display: flex; align-items: center; gap: 6px;
  font-size: 14.5px; font-weight: 600; line-height: 1.2;
  white-space: nowrap; overflow: hidden;
}
.tname { overflow: hidden; text-overflow: ellipsis; }
.t2 {
  font-size: 12.5px; color: #615d59; margin-top: 1px; line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.side {
  flex: none; display: flex; flex-direction: column;
  align-items: flex-end; gap: 3px;
  font-size: 11px; color: #a39e98;
}
.dot { width: 7px; height: 7px; border-radius: 50%; background: #0075de; }
.fab { position: absolute; right: 20px; bottom: 20px; z-index: 5; }

/* 长按弹窗（照抄参考图） */
.scrim { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.42); z-index: 90; }
.sheet {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 91;
  background: #fff; border-radius: 22px 22px 0 0;
  padding: 12px 18px calc(22px + env(safe-area-inset-bottom));
}
.handle { width: 36px; height: 4px; border-radius: 2px; background: #e3e1de; margin: 0 auto 16px; }
.sheet-title { font-size: 20px; font-weight: 700; line-height: 1.3; word-break: break-all; }
.sheet-sub { font-size: 13px; color: #8f8b86; margin: 3px 0 4px; }
.sheet-row {
  display: flex; align-items: center; gap: 14px;
  padding: 7px 0; font-size: 15.5px; color: rgba(0, 0, 0, 0.95);
  cursor: pointer;
}
.sheet-row:active { opacity: 0.6; }
.tile {
  width: 38px; height: 38px; border-radius: 10px; flex: none;
  background: #f3f2f0; display: flex; align-items: center; justify-content: center;
  color: #1c1b1a;
}
.sheet-row.del span { color: #e5443a; }
.tile.del { background: rgba(229, 68, 58, 0.08); color: #e5443a; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.sheetup-enter-active, .sheetup-leave-active { transition: transform 0.28s cubic-bezier(0.3, 0.7, 0.3, 1); }
.sheetup-enter-from, .sheetup-leave-to { transform: translateY(100%); }
</style>
