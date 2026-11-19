<template>
  <span class="oicon" :style="{ width: size + 'px', height: size + 'px' }" v-html="svg" />
</template>

<script setup lang="ts">
// 逐个提取的官方图标（Tabler outline + VS Code codicon），仅本项目用到的 33 个
const raws = import.meta.glob('../icons/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const props = defineProps<{ name: string; size?: number }>()
const svg = computed(() => {
  const raw = raws[`../icons/${props.name}.svg`] || ''
  return raw.replace(/<!--(.|\n)*?-->/g, '')
})
</script>

<script lang="ts">
import { computed } from 'vue'
export default { name: 'OfficialIcon' }
</script>

<style scoped>
.oicon { display: inline-flex; flex: none; }
.oicon :deep(svg) { width: 100%; height: 100%; display: block; }
</style>
