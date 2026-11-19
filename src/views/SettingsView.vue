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
          <div class="srow2 tall" @click="toast('连接服务器（原型占位）')">
            <v-icon icon="mdi-earth" size="22" class="sic" />
            <div class="scol">
              <span class="slabel">连接服务器</span>
              <span class="ssub">http://192.168.31.115:8642 · {{ statusLine }}</span>
            </div>
            <v-icon icon="mdi-chevron-right" size="20" class="schev" />
          </div>
        </v-card>

        <!-- 官方一级按钮，按官方顺序与分组；图标为官方提取件 -->
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

    <!-- 二级页：滑入，二级按钮暂不响应 -->
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
                <div class="srow2">
                  <OfficialIcon :name="sub[1]" :size="22" />
                  <span class="slabel">{{ sub[0] }}</span>
                  <v-icon icon="mdi-chevron-right" size="20" class="schev" />
                </div>
              </template>
            </v-card>
            <!-- 契约层真配置：按板块映射的官方配置字段（改后点右上角保存） -->
            <template v-if="fields.length">
              <v-card class="sgroup" rounded="xl" flat>
                <template v-for="(f, fi) in fields" :key="f.key">
                  <div v-if="fi > 0" class="sdiv" />
                  <div class="frow">
                    <div class="fcol">
                      <span class="flabel">{{ fieldLabel(f) }}</span>
                      <span v-if="f.schema.description" class="fdesc">{{ f.schema.description }}</span>
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
              <div class="text-center pb-4">
                <v-btn color="primary" variant="flat" rounded="lg" :disabled="!settings.dirty.size" :loading="settings.saving" @click="save">
                  保存{{ settings.dirty.size ? '（' + settings.dirty.size + ' 项已改）' : '' }}
                </v-btn>
              </div>
            </template>
            <v-card v-else class="sgroup pa-4 text-center" rounded="xl" flat>
              <span style="font-size: 13px; color: #a5a09a">该板块使用专用接口（模型列表 / 插件 / 密钥等），将在后续轮次逐板块接入。</span>
            </v-card>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
// 图标名对应 src/icons/ 下的官方提取件（名称取自官方前端源码 lib/icons.ts 与 subpages.ts 的映射）
import { computed, onMounted } from 'vue'
import { useUiStore } from '../stores/ui'
import { useSettingsStore, type Field } from '../stores/settings'
import OfficialIcon from '../components/OfficialIcon.vue'

type Sub = [string, string]
interface Row { key: string; label: string; icon: string; subs?: Sub[] }
interface Group { id: string; rows: Row[] }

const props = defineProps<{ overlay?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const ui = useUiStore()
const settings = useSettingsStore()
onMounted(() => { void settings.load() })
const fields = computed(() => (current.value ? settings.fieldsFor(current.value.key) : []))
const statusLine = computed(() => {
  const st = settings.status as null | { version?: string; gateway_state?: string }
  if (!st) return '连接中…'
  return `网关${st.gateway_state === 'running' ? '运行中' : st.gateway_state || ''} · v${st.version || '?'}`
})
function fieldLabel(f: Field) {
  const last = f.key.split('.').pop() || f.key
  return f.schema.description ? last : last
}
async function save() { try { await settings.save(); toast('已保存') } catch (e) { toast(e instanceof Error ? e.message : String(e)) } }

function toast(t: string) { ui.toastMsg(t) }

// 顺序与分组完全按官方设置导航
const groups: Group[] = [
  { id: 'g1', rows: [
    { key: 'model', label: '模型', icon: 'box', subs: [['主模型', 'box'], ['备用模型', 'box'], ['辅助模型', 'cpu'], ['子智能体', 'git-fork'], ['多智能体协作', 'users']] },
    { key: 'chat', label: '对话', icon: 'message-circle', subs: [['行为', 'message-circle'], ['附件', 'photo']] },
    { key: 'appearance', label: '外观', icon: 'palette', subs: [['常规', 'settings-2'], ['主题', 'palette'], ['字体与缩放', 'circle-letter-a'], ['窗口与布局', 'device-desktop'], ['聊天显示', 'message-circle'], ['宠物', 'paw']] },
    { key: 'workspace', label: '工作区', icon: 'device-desktop', subs: [['项目与发现', 'folder-open'], ['Shell 环境', 'terminal-2'], ['文件与执行', 'file-text']] },
    { key: 'safety', label: '安全', icon: 'lock', subs: [['审批', 'shield-lock'], ['隐私与网络', 'lock'], ['检查点', 'archive']] },
    { key: 'browser', label: 'Browser', icon: 'globe', subs: [['浏览器配置', 'globe'], ['本地与私有网址', 'network']] },
    { key: 'vault', label: '密码与登录', icon: 'shield-lock', subs: [['已保存的凭据', 'key'], ['密码管理器', 'lock']] },
    { key: 'memory', label: '记忆与上下文', icon: 'brain', subs: [['持久记忆', 'brain'], ['上下文与压缩', 'file-text']] },
    { key: 'voice', label: '语音', icon: 'microphone', subs: [['语音对话', 'microphone'], ['语音转文字', 'file-text'], ['文字转语音', 'volume-2']] },
    { key: 'advanced', label: '高级', icon: 'tool', subs: [['桌面与启动', 'device-desktop'], ['智能体限制', 'cpu'], ['工具访问', 'tool'], ['终端后端', 'terminal-2'], ['输出限制', 'file-text']] },
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

function openSection(row: Row) {
  if (!row.subs) return  // 网关、插件：官方在网页端无二级页，点击不响应
  ui.settingsSection = row.key
  history.pushState({ sec: row.key }, '')
}
function backSection() { history.back() }
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
.sval { margin-left: auto; font-size: 15px; color: #a5a09a; }
.schev { color: #b8b4ae; margin-left: auto; }
.sval + .schev { margin-left: 12px; }
.scol { display: flex; flex-direction: column; flex: 1; }
.scol .slabel { margin-bottom: 2px; }
.ssub { font-size: 14px; color: #a5a09a; }
.sdiv { height: 1px; background: rgba(0, 0, 0, 0.06); margin: 0 18px; }
.frow { display: flex; align-items: center; gap: 12px; padding: 10px 18px; }
.fcol { flex: 1; min-width: 0; }
.flabel { font-size: 14px; color: rgba(0,0,0,0.9); word-break: break-all; }
.fdesc { display: block; font-size: 11.5px; color: #a5a09a; margin-top: 2px; }
.fctl { flex: none; min-width: 120px; max-width: 220px; }
.subpage {
  position: absolute; inset: 0; z-index: 6;
  background: rgb(var(--v-theme-background));
}
.subin-enter-active, .subin-leave-active { transition: transform 0.26s cubic-bezier(0.3, 0.7, 0.3, 1); }
.subin-enter-from, .subin-leave-to { transform: translateX(100%); }
</style>
