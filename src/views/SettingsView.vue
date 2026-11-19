<template>
  <div class="fill-height settings-page">
    <v-toolbar density="comfortable" flat color="background">
      <v-btn v-if="overlay" icon="mdi-arrow-left" variant="text" @click="emit('close')" />
      <v-toolbar-title class="font-weight-bold">设置</v-toolbar-title>
    </v-toolbar>
    <div class="overflow-y-auto" style="height: calc(100% - 56px)">
      <div class="px-3 pb-8" style="max-width: 640px">
        <!-- 顶部保留：连接服务器 -->
        <v-card class="sgroup" rounded="xl" flat>
          <div class="srow2 tall" @click="toast('连接服务器（后续接入专用面板）')">
            <v-icon icon="mdi-earth" size="22" class="sic" />
            <div class="scol">
              <span class="slabel">连接服务器</span>
              <span class="ssub">{{ statusLine }}</span>
            </div>
            <v-icon icon="mdi-chevron-right" size="20" class="schev" />
          </div>
        </v-card>

        <!-- 官方一级按钮，按官方顺序与分组；二级按钮与字段归属按官方定义文件 -->
        <v-card v-for="g in groups" :key="g.id" class="sgroup" rounded="xl" flat>
          <template v-for="(row, ri) in g.rows" :key="row.key">
            <div v-if="ri > 0" class="sdiv" />
            <div class="srow2" @click="openSection(row)">
              <OfficialIcon :name="row.icon" :size="22" />
              <span class="slabel">{{ row.label }}</span>
              <v-icon v-if="row.subs" icon="mdi-chevron-right" size="20" class="schev" />
            </div>
          </template>
        </v-card>
      </div>
    </div>

    <!-- 二级页：官方定义的子页清单；滑入 -->
    <transition name="subin">
      <div v-if="current" class="subpage">
        <v-toolbar density="comfortable" flat color="background">
          <v-btn icon="mdi-arrow-left" variant="text" @click="backSection" />
          <v-toolbar-title class="font-weight-bold">{{ current.label }}</v-toolbar-title>
        </v-toolbar>
        <div class="overflow-y-auto" style="height: calc(100% - 56px)">
          <div class="px-3 pb-8" style="max-width: 640px">
            <v-card v-if="current.subs" class="sgroup" rounded="xl" flat>
              <template v-for="(sub, si) in current.subs" :key="sub[0]">
                <div v-if="si > 0" class="sdiv" />
                <div class="srow2" @click="openSub(sub)">
                  <OfficialIcon :name="sub[1]" :size="22" />
                  <span class="slabel">{{ sub[0] }}</span>
                  <v-icon icon="mdi-chevron-right" size="20" class="schev" />
                </div>
              </template>
            </v-card>
          </div>
        </div>
      </div>
    </transition>

    <!-- 三级子页：官方归属的配置字段，可改可存；无官方定义的子页显示待接说明 -->
    <transition name="subin">
      <div v-if="subFields !== null || subNote" class="subpage sub3">
        <v-toolbar density="comfortable" flat color="background">
          <v-btn icon="mdi-arrow-left" variant="text" @click="backSub" />
          <v-toolbar-title class="font-weight-bold">{{ subLabel }}</v-toolbar-title>
          <v-spacer />
          <v-btn
            v-if="subFields !== null && subFields.length"
            variant="text" :disabled="!settings.dirty.size" :loading="settings.saving"
            @click="save">保存{{ settings.dirty.size ? '（' + settings.dirty.size + ' 项）' : '' }}</v-btn>
        </v-toolbar>
        <div class="overflow-y-auto" style="height: calc(100% - 56px)">
          <div class="px-3 pb-8" style="max-width: 640px">
            <template v-if="subFields !== null && subFields.length">
              <v-card class="sgroup" rounded="xl" flat>
                <template v-for="(f, fi) in subFields" :key="f.key">
                  <div v-if="fi > 0" class="sdiv" />
                  <div class="frow">
                    <div class="fcol">
                      <span class="flabel">{{ fieldLabel(f.key) }}</span>
                      <span v-if="fieldDesc(f.key) || (f.schema.description && !f.schema.description.includes('→'))" class="fdesc">{{ fieldDesc(f.key) || f.schema.description }}</span>
                    </div>
                    <div class="fctl">
                      <v-switch
                        v-if="f.schema.type === 'boolean'"
                        :model-value="!!f.value" density="compact" hide-details color="primary"
                        @update:model-value="v => settings.edit(f.key, v)" />
                      <v-select
                        v-else-if="f.schema.type === 'select' && f.schema.options?.length"
                        :model-value="String(f.value ?? '')" :items="f.schema.options.map(String)" density="compact"
                        variant="underlined" hide-details @update:model-value="v => settings.edit(f.key, v)" />
                      <v-text-field
                        v-else-if="f.schema.type === 'number'"
                        :model-value="String(f.value ?? '')" type="number" density="compact"
                        variant="underlined" hide-details @update:model-value="v => settings.edit(f.key, v === '' ? undefined : Number(v))" />
                      <v-text-field
                        v-else-if="f.schema.type === 'list'"
                        :model-value="Array.isArray(f.value) ? f.value.join(', ') : String(f.value ?? '')" density="compact"
                        variant="underlined" hide-details @update:model-value="v => settings.edit(f.key, String(v || '').split(',').map(x => x.trim()).filter(Boolean))" />
                      <v-textarea
                        v-else-if="f.schema.type === 'text'"
                        :model-value="String(f.value ?? '')" density="compact" rows="2" auto-grow
                        variant="underlined" hide-details @update:model-value="v => settings.edit(f.key, v)" />
                      <v-text-field
                        v-else
                        :model-value="String(f.value ?? '')" density="compact"
                        variant="underlined" hide-details @update:model-value="v => settings.edit(f.key, v)" />
                    </div>
                  </div>
                </template>
              </v-card>
            </template>
            <v-card v-else class="sgroup pa-4 text-center" rounded="xl" flat>
              <span style="font-size: 13px; color: #a5a09a">该子页使用专用接口或自定义界面（模型列表 / 密钥 / 插件等），将在后续轮次逐板块接入。</span>
            </v-card>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
// 图标名对应 src/icons/ 下的官方提取件；层级对应按官方 config-subpages 定义文件。
import { computed, onMounted } from 'vue'
import { useUiStore } from '../stores/ui'
import { useSettingsStore, fieldLabel, fieldDesc } from '../stores/settings'
import OfficialIcon from '../components/OfficialIcon.vue'

type Sub = [string, string, string?]
interface Row { key: string; label: string; icon: string; subs?: Sub[] }
interface Group { id: string; rows: Row[] }

const props = defineProps<{ overlay?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const ui = useUiStore()
const settings = useSettingsStore()
onMounted(() => { void settings.load() })

function toast(t: string) { ui.toastMsg(t) }

// 官方一级按钮顺序与分组（照官方设置导航）；subs=[中文, 图标, 官方子页 id]
const groups: Group[] = [
  { id: 'g1', rows: [
    { key: 'model', label: '模型', icon: 'box', subs: [['主模型', 'box', 'main'], ['备用模型', 'box', 'fallbacks'], ['辅助模型', 'cpu', 'auxiliary'], ['子智能体', 'git-fork', 'delegation'], ['多智能体协作', 'users', 'moa']] },
    { key: 'chat', label: '对话', icon: 'message-circle', subs: [['行为', 'message-circle', 'behavior'], ['附件', 'photo', 'attachments']] },
    { key: 'appearance', label: '外观', icon: 'palette', subs: [['常规', 'settings-2'], ['主题', 'palette'], ['字体与缩放', 'circle-letter-a'], ['窗口与布局', 'device-desktop'], ['聊天显示', 'message-circle'], ['宠物', 'paw']] },
    { key: 'workspace', label: '工作区', icon: 'device-desktop', subs: [['项目与发现', 'folder-open', 'projects'], ['Shell 环境', 'terminal-2', 'shell'], ['文件与执行', 'file-text', 'files']] },
    { key: 'safety', label: '安全', icon: 'lock', subs: [['审批', 'shield-lock', 'approvals'], ['隐私与网络', 'lock', 'privacy'], ['检查点', 'archive', 'checkpoints']] },
    { key: 'browser', label: 'Browser', icon: 'globe', subs: [['浏览器配置', 'globe', 'profile'], ['本地与私有网址', 'network', 'network']] },
    { key: 'vault', label: '密码与登录', icon: 'shield-lock', subs: [['已保存的凭据', 'key'], ['密码管理器', 'lock']] },
    { key: 'memory', label: '记忆与上下文', icon: 'brain', subs: [['持久记忆', 'brain', 'persistent'], ['上下文与压缩', 'file-text', 'context']] },
    { key: 'voice', label: '语音', icon: 'microphone', subs: [['语音对话', 'microphone', 'conversation'], ['语音转文字', 'file-text', 'transcription'], ['文字转语音', 'volume-2', 'speech']] },
    { key: 'advanced', label: '高级', icon: 'tool', subs: [['桌面与启动', 'device-desktop', 'desktop'], ['智能体限制', 'cpu', 'runtime'], ['工具访问', 'tool', 'tools'], ['终端后端', 'terminal-2', 'terminal'], ['输出限制', 'file-text', 'output']] },
    { key: 'notifications', label: '通知', icon: 'bell', subs: [['桌面通知', 'bell'], ['声音', 'volume-2']] },
    { key: 'billing', label: '账单', icon: 'chart-bar', subs: [['概览', 'chart-bar']] }
  ] },
  { id: 'g2', rows: [
    { key: 'providers', label: '提供方', icon: 'bolt', subs: [['账号', 'codicon-account'], ['API 密钥', 'key'], ['自定义端点', 'globe']] },
    { key: 'gateway', label: '网关', icon: 'globe' },
    { key: 'keybinds', label: '键盘快捷键', icon: 'keyboard', subs: [['按键绑定', 'keyboard'], ['HUD 手势', 'keyboard'], ['屏幕捕获', 'photo']] },
    { key: 'keys', label: '工具与密钥', icon: 'key', subs: [['工具', 'tool'], ['设置', 'settings-2']] },
    { key: 'sessions', label: '会话', icon: 'archive', subs: [['归档与保留', 'archive'], ['默认项目文件夹', 'folder-open']] }
  ] },
  { id: 'g3', rows: [ { key: 'plugins', label: '插件', icon: 'codicon-extensions' } ] },
  { id: 'g4', rows: [ { key: 'about', label: '关于', icon: 'info-circle', subs: [['版本与更新', 'download'], ['卸载', 'trash']] } ] }
]

const current = computed(() => {
  if (!ui.settingsSection) return null
  for (const g of groups) {
    const row = g.rows.find(r => r.key === ui.settingsSection)
    if (row) return row
  }
  return null
})

// 三级子页状态：subId 空=未开；'note'=说明页；其它=字段页
const subNote = computed(() => !!ui.settingsSub && ui.settingsSub === 'note')
const subLabel = computed(() => {
  if (!current.value) return ''
  const sub = (current.value.subs || []).find(s => s[2] === ui.settingsSub)
  return sub ? sub[0] : ''
})
const subFields = computed(() => {
  if (!ui.settingsSub || ui.settingsSub === 'note' || !current.value) return null
  return settings.fieldsFor(current.value.key, ui.settingsSub)
})
const statusLine = computed(() => {
  const st = settings.status as null | { version?: string; gateway_state?: string }
  if (!st) return 'http://192.168.31.115:8642'
  return `http://192.168.31.115:8642 · 网关${st.gateway_state === 'running' ? '运行中' : st.gateway_state || ''} · v${st.version || '?'}`
})

function openSection(row: Row) {
  if (!row.subs) return  // 网关、插件：官方在网页端无二级页
  ui.settingsSection = row.key
  history.pushState({ sec: row.key }, '')
}
function backSection() {
  ui.settingsSub = ''
  history.back()
}
function openSub(sub: Sub) {
  // 有官方定义 → 字段页；无 → 说明页
  const def = current.value ? settings.hasSubpages(current.value.key) : false
  const hasId = !!sub[2] && def && settings.subpagesFor(current.value!.key).some(d => d.id === sub[2])
  ui.settingsSub = hasId ? sub[2]! : 'note'
  history.pushState({ sub: ui.settingsSub }, '')
}
function backSub() { history.back() }
async function save() {
  try { await settings.save(); toast('已保存') } catch (e) { toast(e instanceof Error ? e.message : String(e)) }
}
</script>

<style scoped>
.settings-page { background: rgb(var(--v-theme-surface)); position: relative; }
.sgroup { margin: 0 12px 14px; padding: 2px 0; }
.srow2 {
  display: flex; align-items: center; gap: 16px;
  padding: 14px 18px; cursor: pointer; min-height: 50px;
}
.srow2:active { opacity: 0.65; }
.sic { color: #1c1b1a; flex: none; }
.slabel { font-size: 16px; color: rgba(0, 0, 0, 0.95); }
.schev { color: #b8b4ae; margin-left: auto; }
.scol { display: flex; flex-direction: column; flex: 1; }
.scol .slabel { margin-bottom: 2px; }
.ssub { font-size: 13px; color: #a5a09a; }
.sdiv { height: 1px; background: rgba(0, 0, 0, 0.06); margin: 0 18px; }
.subpage {
  position: absolute; inset: 0; z-index: 6;
  background: rgb(var(--v-theme-background));
}
.sub3 { z-index: 8; }
.frow { display: flex; align-items: center; gap: 14px; padding: 10px 18px; }
.fcol { flex: 1; min-width: 0; }
.flabel { font-size: 14px; color: rgba(0,0,0,0.9); }
.fdesc { display: block; font-size: 11.5px; color: #a5a09a; margin-top: 2px; }
.fctl { flex: none; width: 40%; min-width: 96px; max-width: 190px; display: flex; justify-content: flex-end; }
.fctl :deep(.v-input) { width: 100%; }
.fctl :deep(.v-switch) { justify-content: flex-end; }
.subin-enter-active, .subin-leave-active { transition: transform 0.26s cubic-bezier(0.3, 0.7, 0.3, 1); }
.subin-enter-from, .subin-leave-to { transform: translateX(100%); }
</style>
