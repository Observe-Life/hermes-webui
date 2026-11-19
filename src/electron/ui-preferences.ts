// 类型声明垫片：Electron 专用的偏好读写实现（node:fs/crypto 版）不在浏览器
// 运行路径上，未平移；这里原样保留其类型定义供 lib/ui-preferences/sync 引用。
export interface UiPreferencesSnapshot {
  exists: boolean
  /** One store's lifetime; a replaced (deleted or corrupt) store gets a new one. */
  generation?: string
  revision: number
  values: Record<string, string>
}

export interface UiPreferencesWrite {
  seed?: boolean
  values: Record<string, null | string>
}
