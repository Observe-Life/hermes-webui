export interface FakeSession {
  id: string; name: string; mono: string; color: string;
  preview: string; time: string; unread: number; pinned?: boolean; project?: boolean;
  running?: boolean; needDecision?: boolean; interrupted?: boolean;
}

export const FAKE_SESSIONS: FakeSession[] = [
  { id: 'boss',   name: '总管派活',           mono: '总', color: '#523410', preview: '你：把三基调对照稿放进同步区', time: '09:41', unread: 0, pinned: true, needDecision: true },
  { id: 'webui',  name: 'Hermes 网页端重构',  mono: '网', color: '#2a9d99', preview: '正在生成可交互原型…',          time: '09:40', unread: 0, pinned: true, running: true },
  { id: 'kyllene',name: 'Kyllene 二开',       mono: 'K',  color: '#391c57', preview: '签名库已就位，CI 走固定签名',   time: '昨天', unread: 0, project: true },
  { id: 'daily',  name: '记忆日报',           mono: '记', color: '#dd5b00', preview: '今晨 04:00 备份完成，无异常',   time: '昨天', unread: 0, project: true },
  { id: 'weekly', name: '周报整理',           mono: '周', color: '#0075de', preview: '已汇总本周 12 条交付记录',      time: '周三', unread: 0 },
  { id: 'trans',  name: '说明书翻译',         mono: '译', color: '#1aae39', preview: '你：第三章翻完发我',            time: '周二', unread: 1 },
  { id: 'proxy',  name: '翻墙排障',           mono: '排', color: '#615d59', preview: 'mihomo 已恢复，观察一天',       time: '11-13', unread: 0, interrupted: true },
]

export const REPLY_POOL: string[] = [
  '收到，这一步我记下了。现在手头的活是：把三基调对照稿放进同步区，完成后向你汇报。',
  '好，这条已入列。原型阶段的回复是演的——真正接上后端之后，这里就是智能体的真实回复。',
  '明白。为了演示流式效果，这段话正一个字一个字往外蹦，真界面里也是这个节奏。'
]
