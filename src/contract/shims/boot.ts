// 垫片：启动失败上报。桌面端原版写 $desktopBoot 状态由 React 界面展示；
// 这里写原子，由我们的 App 界面消费。
import { atom } from 'nanostores'

export const $bootError = atom<string | null>(null)

export function failDesktopBoot(message: string) {
  console.error('[契约层启动失败]', message)
  $bootError.set(message)
}
