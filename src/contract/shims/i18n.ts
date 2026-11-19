// 垫片：契约层内部错误文案。桌面端 i18n 是 295 文件的界面层翻译树，
// 本阶段按原样回退英文键值，不影响契约行为；中文界面文案由界面层负责。
export function translateNow(key: string, ...args: unknown[]): string {
  void args
  return key
}
