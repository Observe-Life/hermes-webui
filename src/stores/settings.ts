// 设置库：真配置。读官方 /api/config 与配置结构说明；按板块映射分类渲染与保存。
import { defineStore } from 'pinia'
import { getHermesConfig, getHermesConfigSchema, saveHermesConfig, getStatus, type ConfigFieldSchema, type StatusResponse } from '@/hermes'

export interface Field { key: string; label: string; schema: ConfigFieldSchema; value: unknown }

// 我们的一级按钮 → 官方配置分类（界面层映射，官方为手工分区，此处按分类归拢）
export const SECTION_CATEGORIES: Record<string, string[]> = {
  model: ['auxiliary'],
  chat: ['agent'],
  workspace: ['terminal'],
  safety: ['security'],
  browser: ['browser'],
  memory: ['memory', 'compression'],
  voice: ['voice', 'stt', 'tts'],
  advanced: ['logging']
}

function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj
  for (const seg of path.split('.')) {
    if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[seg]
    else return undefined
  }
  return cur
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const segs = path.split('.')
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]
    if (!cur[seg] || typeof cur[seg] !== 'object') cur[seg] = {}
    cur = cur[seg] as Record<string, unknown>
  }
  cur[segs[segs.length - 1]] = value
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    config: {} as Record<string, unknown>,
    schema: {} as Record<string, ConfigFieldSchema>,
    dirty: new Set<string>(),
    loaded: false,
    loading: false,
    saving: false,
    status: null as null | StatusResponse
  }),
  actions: {
    async load() {
      if (this.loading) return
      this.loading = true
      try {
        const [cfg, schema] = await Promise.all([getHermesConfig(), getHermesConfigSchema()])
        this.config = cfg as unknown as Record<string, unknown>
        this.schema = (schema as { fields: Record<string, ConfigFieldSchema> }).fields || {}
        this.dirty = new Set()
        this.loaded = true
        void getStatus().then(s => { this.status = s }).catch(() => {})
      } finally {
        this.loading = false
      }
    },
    fieldsFor(section: string): Field[] {
      const cats = SECTION_CATEGORIES[section]
      if (!cats) return []
      const out: Field[] = []
      for (const [key, schema] of Object.entries(this.schema)) {
        if (!schema.category || !cats.includes(schema.category)) continue
        out.push({ key, label: key, schema, value: getPath(this.config, key) })
      }
      out.sort((a, b) => a.key.localeCompare(b.key))
      return out
    },
    edit(key: string, value: unknown) {
      setPath(this.config, key, value)
      this.dirty.add(key)
      this.dirty = new Set(this.dirty)
    },
    async save() {
      if (!this.dirty.size) return
      this.saving = true
      try {
        await saveHermesConfig(this.config as never)
        this.dirty = new Set()
        await this.load()
      } finally {
        this.saving = false
      }
    }
  }
})
