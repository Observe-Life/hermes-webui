// 垫片：桌面通知/提示。原版 store/notifications.ts 是 400+ 行界面层实现；
// 这里把提示路由到内部事件总线，由界面层（Pinia）订阅并弹 toast。
import { atom } from 'nanostores'

export type ContractNotice = { id: string; kind: string; text: string }
export const $contractNotices = atom<ContractNotice[]>([])
let seq = 0

function push(kind: string, text: string): string {
  const id = `n${++seq}`
  $contractNotices.set([...$contractNotices.get(), { id, kind, text }])
  return id
}

export type NotificationInput = { kind?: string; text?: string; title?: string } & Record<string, unknown>

export function notify(input: NotificationInput): string {
  return push(input.kind || 'info', input.text || input.title || '')
}

export function notifyError(error: unknown, fallback: string, _options: Record<string, unknown> = {}): string {
  const readable = error instanceof Error ? error.message : String(error ?? '')
  return push('error', readable || fallback)
}

export function dismissNotification(id: string) {
  $contractNotices.set($contractNotices.get().filter(n => n.id !== id))
}

export function flagTabAttention(_mode?: string) {
  // 浏览器标签页提醒：原型阶段空实现（官方网页版本身即空壳能力）。
}
