<template>
  <div class="d-flex flex-column fill-height">
    <v-toolbar density="comfortable" flat color="background" class="whisper-border">
      <v-btn v-if="!mdAndUp" icon="mdi-arrow-left" variant="text" @click="emit('back')" />
      <v-toolbar-title class="text-subtitle-1 font-weight-bold">{{ session?.name || '会话' }}</v-toolbar-title>
      <v-spacer />
      <span v-if="ui.replying" class="run-pill mr-2"><span class="spin" />回复中</span>
    </v-toolbar>

    <!-- 空会话态：借鉴参考图 -->
    <div v-if="empty" class="emptywrap">
      <img src="/avatar.jpg" class="bigava" alt="Hermes" />
      <div class="greet">你好，我是 Hermes</div>
      <div class="greetsub">描述你需要什么，或从下面的建议开始</div>
      <div class="sugg">
        <div class="pillcard" @click="draft = '总结一下我最近的会话进展'">总结一下我最近的会话进展</div>
        <div class="pillcard" @click="draft = '帮我开一个新项目'">帮我开一个新项目</div>
      </div>
    </div>

    <!-- 消息区 -->
    <div v-else ref="scroller" class="flex-1-1 overflow-y-auto px-4 py-3" style="min-height:0">
      <div v-for="(m, i) in msgs" :key="i" class="d-flex mb-3" :class="m.who === 'me' ? 'justify-end' : 'justify-start'">
        <div v-if="m.who === 'me'" class="msg-me px-4 py-2 text-body-2">{{ m.text }}</div>
        <div v-else class="msg-ai px-4 py-2 text-body-2">
          {{ m.text }}<span v-if="m.streaming" class="cursor">▍</span>
        </div>
      </div>
    </div>

    <!-- 输入框（借鉴参考图；大模型按钮只显示名字） -->
    <div class="inputwrap mx-3 mb-3">
      <input
        v-model="draft" class="draft" :placeholder="empty ? '描述你需要什么' : '发消息…'"
        @keyup.enter="send" />
      <div class="ctrrow">
        <button class="circ" @click="ui.toastMsg('附件（原型占位）')"><v-icon icon="mdi-plus" size="22" /></button>
        <button class="chip" @click="ui.toastMsg('模型选择（原型占位）')">
          <span>GLM 5.3 Flash</span>
          <v-icon icon="mdi-chevron-down" size="16" />
        </button>
        <div class="flex-1" />
        <button class="circ" @click="ui.toastMsg('语音（原型占位）')" aria-label="语音"><svg width="18" height="18" viewBox="0 0 18 18"><g fill="currentColor"><rect x="1" y="6" width="2.4" height="6" rx="1.2"/><rect x="5.4" y="3" width="2.4" height="12" rx="1.2"/><rect x="9.8" y="1" width="2.4" height="16" rx="1.2"/><rect x="14.2" y="5" width="2.4" height="8" rx="1.2"/></g></svg></button>
        <button class="circ send" :class="{ on: !!draft.trim() }" @click="send"><v-icon icon="mdi-arrow-up" size="22" /></button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useUiStore } from '../stores/ui'

const props = defineProps<{ sid?: string }>()
const emit = defineEmits<{ back: [] }>()
const route = useRoute()
const ui = useUiStore()
const { mdAndUp } = useDisplay()
const id = computed(() => props.sid ?? String(route.params.id || ''))
const session = computed(() => ui.sessions.find(s => s.id === id.value))
const msgs = computed(() => ui.chats[id.value] || [])
const empty = computed(() => msgs.value.length === 0)
const draft = ref('')
const scroller = ref<HTMLElement | null>(null)

watch(id, (v) => { if (v) { ui.seed(v); ui.markRead(v) } }, { immediate: true })
watch(() => msgs.value.length, () => nextTick(() => scroller.value?.scrollTo({ top: 999999 })))

function send() {
  const t = draft.value.trim()
  if (!t || ui.replying) return
  draft.value = ''
  ui.send(id.value, t)
}
</script>

<style scoped>
.topava { width: 30px; height: 30px; border-radius: 9px; margin-right: 10px; object-fit: cover; }
.msg-me { max-width: 76%; border-radius: 16px 16px 4px 16px; background: rgb(var(--v-theme-badge-bg)); color: rgb(var(--v-theme-badge-ink)); }
.msg-ai { max-width: 76%; border-radius: 16px 16px 16px 4px; background: rgb(var(--v-theme-surface)); color: rgba(0,0,0,0.95); border: 1px solid rgba(0,0,0,0.1); }
.cursor { animation: blink 0.8s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }

/* 空会话态 */
.emptywrap { flex: 1 1 0; min-height: 0; padding: 22vh 30px 0; }
.bigava { width: 68px; height: 68px; border-radius: 17px; object-fit: cover; }
.greet { font-size: 22px; font-weight: 700; color: rgba(0,0,0,0.95); margin-top: 26px; }
.greetsub { font-size: 14.5px; color: #8f8b86; margin-top: 8px; }
.sugg { display: flex; gap: 12px; margin-top: 22px; }
.pillcard {
  flex: 1; background: #fff; border: 1px solid rgba(0,0,0,0.08);
  border-radius: 14px; padding: 12px 14px; font-size: 13.5px; color: #3a3835;
  line-height: 1.4;
}
.pillcard:active { background: #f6f5f4; }

/* 输入框 */
.inputwrap {
  background: #fff; border: 1px solid rgba(0,0,0,0.08);
  border-radius: 26px; padding: 12px 14px 10px;
}
.draft {
  width: 100%; border: none; outline: none; font-size: 15.5px;
  color: rgba(0,0,0,0.95); background: transparent;
  padding: 2px 4px 10px;
}
.draft::placeholder { color: #a5a09a; }
.ctrrow { display: flex; align-items: center; gap: 10px; }
.circ {
  width: 40px; height: 40px; border-radius: 50%; border: none; flex: none;
  background: #f0efec; color: #55524e; display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.circ:active { background: #e6e4e1; }
.chip {
  white-space: nowrap; display: flex; align-items: center; gap: 4px;
  height: 36px; padding: 0 14px; border: none; border-radius: 999px;
  background: #f0efec; color: #26241f; font-size: 15px; cursor: pointer;
}
.chip:active { background: #e6e4e1; }
.send { background: #ececea; color: #b3b0ac; }
.send.on { background: rgb(var(--v-theme-primary)); color: #fff; }
</style>
