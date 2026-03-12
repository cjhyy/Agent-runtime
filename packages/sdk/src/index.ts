/**
 * @agent-runtime/sdk
 *
 * 浏览器端 SDK 入口
 *
 * 使用方式:
 *   <script src="https://your-cdn/agent-runtime-sdk.js"></script>
 *   <script>
 *     __agentSDK.init({ url: "ws://localhost:3100" })
 *   </script>
 *
 * 或 ESM:
 *   import { init } from "@agent-runtime/sdk"
 *   init({ url: "ws://localhost:3100" })
 */

import { snapshot, resolveElement } from "./dom-observer.js"
import * as actions from "./action-engine.js"
import { Transport, type TransportOptions } from "./transport.js"

export type { SnapshotData } from "./dom-observer.js"
export type { TransportOptions } from "./transport.js"

let transport: Transport | null = null

/** 初始化 SDK 并连接到 AgentServer */
export function init(options: TransportOptions = {}): Transport {
  if (transport) {
    transport.disconnect()
  }
  transport = new Transport(options)
  transport.connect()
  return transport
}

/** 断开连接 */
export function destroy(): void {
  transport?.disconnect()
  transport = null
}

/** 获取当前 transport */
export function getTransport(): Transport | null {
  return transport
}

/** 是否已连接 */
export function isConnected(): boolean {
  return transport?.isConnected() ?? false
}

// 导出手动操作 API (供页面脚本直接调用，无需通过 Server)
export { snapshot, resolveElement }
export const action = {
  click: actions.click,
  type: actions.type,
  hover: actions.hover,
  select: actions.select,
  scroll: actions.scroll,
  evaluate: actions.evaluate,
  goto: actions.goto,
}

// 自动初始化 (如果有 data 属性配置)
if (typeof document !== "undefined") {
  const scriptEl = document.currentScript as HTMLScriptElement | null
  if (scriptEl) {
    const wsUrl = scriptEl.getAttribute("data-ws-url")
    const pageId = scriptEl.getAttribute("data-page-id")
    const autoConnect = scriptEl.getAttribute("data-auto-connect")

    if (autoConnect !== "false" && wsUrl) {
      // 页面加载完成后自动连接
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          init({ url: wsUrl, pageId: pageId || undefined })
        })
      } else {
        init({ url: wsUrl, pageId: pageId || undefined })
      }
    }
  }
}
