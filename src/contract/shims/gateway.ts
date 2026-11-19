// 垫片：网关状态库只保留 mcp.ts 动态引用的 requestGatewayForAgent 入口。
// 桌面端原版是 2355 行的网关路由/激活状态库；本阶段仅 MCP OAuth 流会用到它，
// 界面对接完成后按需替换为真实路由。
export async function requestGatewayForAgent<T>(
  _connectionId: null | string,
  _profile: string,
  _method: string,
  _params: Record<string, unknown>,
  _timeoutMs: number
): Promise<T> {
  throw new Error('requestGatewayForAgent 尚未在本阶段接线（MCP OAuth 流未启用）')
}
