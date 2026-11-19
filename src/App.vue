<template>
  <v-app>
    <template v-if="rt.phase === 'ready'"><AppShell /></template>
    <div v-else class="bootwrap">
      <div v-if="rt.phase === 'booting' || rt.phase === 'idle'" class="bootcard">
        <div class="bootava"><img src="/avatar.jpg" alt="Hermes" /></div>
        <div class="boottext">正在连接服务器…</div>
      </div>
      <div v-else-if="rt.phase === 'signin'" class="bootcard">
        <div class="boottext">需要登录服务器</div>
        <v-btn color="primary" variant="flat" rounded="lg" @click="openSignin">打开登录页</v-btn>
        <div class="bootsub">将转到服务器登录页；登录完成会自动回到本页并继续连接</div>
      </div>
      <div v-else class="bootcard">
        <div class="boottext">连接失败</div>
        <div class="bootsub">{{ rt.bootError }}</div>
        <v-btn color="primary" variant="flat" rounded="lg" @click="rt.boot()">重试</v-btn>
      </div>
    </div>
    <v-snackbar :model-value="!!ui.toast" location="bottom" color="#31302e" rounded="lg" timeout="1800">
      {{ ui.toast }}
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useUiStore } from './stores/ui'
import { useRuntimeStore } from './stores/runtime'
import { useSessionsStore } from './stores/sessions'
import { useChatStore } from './stores/chat'
import AppShell from './components/MobileShell.vue'

const ui = useUiStore()
const rt = useRuntimeStore()
const sessions = useSessionsStore()
const chat = useChatStore()

let poll: null | ReturnType<typeof setInterval> = null

onMounted(() => {
  void rt.boot().then(ok => { if (ok) { sessions.listen(); chat.listen(); void sessions.load() } })
  // 登录等待：检测到会话即自动重连
  poll = setInterval(async () => {
    if (rt.phase === 'signin' && (await rt.pollSignin())) {
      const ok = await rt.boot()
      if (ok) { sessions.listen(); chat.listen(); void sessions.load() }
    }
  }, 2500)
})
onUnmounted(() => { if (poll) clearInterval(poll) })

function openSignin() { location.assign('/login') }
</script>

<style scoped>
.bootwrap {
  position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: #f6f5f4;
}
.bootcard { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.bootava { width: 68px; height: 68px; border-radius: 17px; overflow: hidden; }
.bootava img { width: 100%; height: 100%; object-fit: cover; }
.boottext { font-size: 16px; font-weight: 600; color: rgba(0,0,0,0.95); }
.bootsub { font-size: 13px; color: #8f8b86; max-width: 280px; text-align: center; line-height: 1.5; }
</style>
