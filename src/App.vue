<template>
  <v-app>
    <AppShell />
    <v-snackbar :model-value="!!ui.toast" location="bottom" color="#31302e" rounded="lg" timeout="1800">
      {{ ui.toast }}
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { useUiStore } from './stores/ui'
import AppShell from './components/MobileShell.vue'
const ui = useUiStore()
</script>
