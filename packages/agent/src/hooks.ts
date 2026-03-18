/**
 * Agent Runtime - Lifecycle hooks
 */

import type { HookRegistry } from "mem-deep-research"

// 从 HookRegistry.registerFn 推导 HookContext 类型
type RegisterFnParams = Parameters<HookRegistry["registerFn"]>
type HookFn = RegisterFnParams[1]
type HookContext = Parameters<HookFn>[0]

export function registerHooks(registry: HookRegistry): void {
  // on_env_inject: 注入浏览器环境变量到 MCP server 进程
  registry.registerFn("on_env_inject", (ctx: HookContext, next) => {
    const serverParams = ctx.serverParams as Record<string, unknown> | undefined
    if (serverParams && typeof serverParams === "object") {
      const env = (serverParams.env ?? {}) as Record<string, string>

      // 从当前进程环境注入浏览器配置
      if (process.env.BROWSER_HEADLESS) {
        env.BROWSER_HEADLESS = process.env.BROWSER_HEADLESS
      }
      if (process.env.BROWSER_USE_PROFILE) {
        env.BROWSER_USE_PROFILE = process.env.BROWSER_USE_PROFILE
      }
      if (process.env.BROWSER_PROFILE_PATH) {
        env.BROWSER_PROFILE_PATH = process.env.BROWSER_PROFILE_PATH
      }
      if (process.env.BROWSER_USER_ID) {
        env.BROWSER_USER_ID = process.env.BROWSER_USER_ID
      }

      serverParams.env = env
    }

    return next(ctx)
  }, 10)

  // ─────────────────────────────────────────────────────────────
  // on_tool_end: 记录浏览器工具调用日志
  // ─────────────────────────────────────────────────────────────
  registry.registerFn("on_tool_end", (ctx: HookContext, next) => {
    const toolName = ctx.toolName || ""
    if (toolName.startsWith("headless_")) {
      const duration = ctx.durationMs ?? 0
      const args = ctx.arguments ?? {}
      console.error(
        `[Browser] ${toolName}(${JSON.stringify(args)}) - ${duration}ms`
      )
    }

    return next(ctx)
  }, 0)

  // ─────────────────────────────────────────────────────────────
  // on_agent_end: 记录任务完成摘要
  // ─────────────────────────────────────────────────────────────
  registry.registerFn("on_agent_end", (ctx: HookContext, next) => {
    const query = ctx.query || "(unknown)"
    const toolCalls = ctx.toolCallsCount ?? 0
    console.error(
      `[Agent] Completed: "${query.slice(0, 60)}" | ${toolCalls} tool calls`
    )

    return next(ctx)
  }, 0)
}
