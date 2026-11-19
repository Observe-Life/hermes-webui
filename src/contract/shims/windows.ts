// 垫片：窗口级 profile 覆盖。实现照搬 store/windows.ts（无界面依赖）。
export function windowProfileOverride(): null | string {
  try {
    return new URLSearchParams(window.location.search).get('profile')?.trim() || null
  } catch {
    return null
  }
}

export function windowConnectionOverride(): null | string {
  try {
    return new URLSearchParams(window.location.search).get('connectionId') || null
  } catch {
    return null
  }
}
