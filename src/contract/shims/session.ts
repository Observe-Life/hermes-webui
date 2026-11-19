// 垫片：连接状态原子。桌面端原版在 store/session.ts（1931 行界面层状态库），
// 这里只保留契约层用到的连接描述字段；网页版模式连接恒为本机。
import { atom } from 'nanostores'

export type ContractConnection = { connectionId?: null | string; profile?: null | string } | null
export const $connection = atom<ContractConnection>(null)
