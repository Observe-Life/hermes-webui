// 设置库：真配置。层级归属完全按官方 config-subpages 定义文件解析（照搬）。
import { defineStore } from 'pinia'
import {
  getHermesConfig,
  getHermesConfigSchema,
  saveHermesConfig,
  getStatus,
  type ConfigFieldSchema,
  type StatusResponse
} from '@/hermes'
import { CONFIG_SUBPAGE_DEFINITIONS, configSubpageForField } from '../data/settings-subpages'
import { fieldCopyForSchemaKey } from '../data/field-copy'
import { FIELD_LABELS_ZH, FIELD_DESCRIPTIONS_ZH } from '../data/field-copy-zh'

export interface Field { key: string; schema: ConfigFieldSchema; value: unknown; original: unknown }

// 官方中文文案：键匹配规则同官方 field-copy（段内 snake→camel），查不到时回退原名
export function fieldLabel(key: string): string {
  return fieldCopyForSchemaKey(FIELD_LABELS_ZH, key) || key
}
export function fieldDesc(key: string): string {
  return fieldCopyForSchemaKey(FIELD_DESCRIPTIONS_ZH, key) || ''
}

// 官方二级页 id → 中文（官方 i18n zh.ts 原文）
export const SUBPAGE_LABELS: Record<string, string> = {
  main: '主模型', fallbacks: '备用模型', auxiliary: '辅助模型', delegation: '子智能体', moa: '多智能体协作',
  behavior: '行为', attachments: '附件',
  projects: '项目与发现', shell: 'Shell 环境', files: '文件与执行',
  approvals: '审批', privacy: '隐私与网络', checkpoints: '检查点',
  profile: '浏览器配置', network: '本地与私有网址',
  persistent: '持久记忆', context: '上下文与压缩',
  conversation: '语音对话', transcription: '语音转文字', speech: '文字转语音',
  desktop: '桌面与启动', runtime: '智能体限制', tools: '工具访问', terminal: '终端后端', output: '输出限制'
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

function inferSchema(value: unknown): ConfigFieldSchema {
  if (typeof value === 'boolean') return { type: 'boolean' }
  if (typeof value === 'number') return { type: 'number' }
  return { type: 'string' }
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
    // 官方定义：某一级板块下有哪些二级页
    subpagesFor(section: string) {
      const defs: Array<{ id: string; labelKey: string }> = CONFIG_SUBPAGE_DEFINITIONS[section] || []
      return defs.map(d => ({ id: d.id, label: SUBPAGE_LABELS[d.labelKey] || d.labelKey }))
    },
    hasSubpages(section: string) {
      return (CONFIG_SUBPAGE_DEFINITIONS[section] || []).length > 0
    },
    // 官方定义：某二级页下有哪些配置字段（官方 fields/prefixes 精确匹配）
    fieldsFor(section: string, subId: string): Field[] {
      const def = (CONFIG_SUBPAGE_DEFINITIONS[section] || []).find(d => d.id === subId)
      if (!def) return []
      const keys = new Set<string>([...Object.keys(this.schema), ...(def.fields || [])])
      const out: Field[] = []
      for (const key of keys) {
        if (configSubpageForField(section, key) !== subId) continue
        const value = getPath(this.config, key)
        out.push({ key, schema: this.schema[key] || inferSchema(value), value, original: value })
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
        // S1：只送改动键（官方 patch 模式），避免陈旧快照盖回期间别端的改动
        const patch: Record<string, unknown> = {}
        for (const key of this.dirty) {
          setPath(patch, key, getPath(this.config, key))
        }
        await saveHermesConfig(patch as never)
        this.dirty = new Set()
        await this.load()
      } finally {
        this.saving = false
      }
    }
  }
})
