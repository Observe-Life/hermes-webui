<template>
  <div class="fill-height">
    <v-toolbar density="comfortable" flat color="background">
      <v-btn v-if="overlay" icon="mdi-arrow-left" variant="text" @click="emit('close')" />
      <v-toolbar-title class="font-weight-bold">扩展</v-toolbar-title>
    </v-toolbar>
    <div class="d-flex flex-column align-center justify-center" style="height: 70%">
      <v-icon icon="mdi-puzzle-outline" size="48" color="warm-mut" />
      <div class="text-subtitle-1 font-weight-medium mt-3">扩展市场（原型占位）</div>
      <div class="text-body-2 text-medium-emphasis mt-1">接上后端后，这里展示可安装的扩展与技能</div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ overlay?: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>
