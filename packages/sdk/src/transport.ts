/**
 * WebSocket Transport
 *
 * 连接到 AgentServer/SDK Bridge Server，
 * 接收指令 (SDKCommand)，执行后返回结果 (SDKResponse)。
 */

import { snapshot } from "./dom-observer.js"
import * as actions from "./action-engine.js"

/** 从 SDK Bridge Server 收到的指令 */
interface SDKCommand {
  id: string
  method: string
  params: Record<string, unknown>
}

/** 返回给 Server 的响应 */
interface SDKResponse {
  id: string
  success: boolean
  data?: unknown
  error?: string
}

export interface TransportOptions {
  /** WebSocket server URL. Default ws://localhost:3100?type=sdk */
  url?: string
  /** Page identifier */
  pageId?: string
  /** Auto reconnect. Default true. */
  autoReconnect?: boolean
  /** Reconnect interval ms. Default 3000. */
  reconnectInterval?: number
  /** Connection timeout ms. Default 5000. */
  connectTimeout?: number
}

export class Transport {
  private ws: WebSocket | null = null
  private url: string
  private pageId: string
  private autoReconnect: boolean
  private reconnectInterval: number
  private connectTimeout: number
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connected = false

  constructor(options: TransportOptions = {}) {
    this.pageId = options.pageId || `page_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    this.autoReconnect = options.autoReconnect ?? true
    this.reconnectInterval = options.reconnectInterval ?? 3000
    this.connectTimeout = options.connectTimeout ?? 5000

    const base = options.url || "ws://localhost:3100"
    const sep = base.includes("?") ? "&" : "?"
    this.url = `${base}${sep}type=sdk&pageId=${encodeURIComponent(this.pageId)}`
  }

  /** 连接到 Server */
  connect(): void {
    if (this.ws) this.disconnect()

    try {
      this.ws = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }

    const timeout = setTimeout(() => {
      if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
        this.ws.close()
        this.scheduleReconnect()
      }
    }, this.connectTimeout)

    this.ws.onopen = () => {
      clearTimeout(timeout)
      this.connected = true
      console.log(`[agent-sdk] Connected as ${this.pageId}`)
    }

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data as string)
    }

    this.ws.onclose = () => {
      clearTimeout(timeout)
      this.connected = false
      console.log("[agent-sdk] Disconnected")
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      // onclose will fire after this
    }
  }

  /** 断开连接 */
  disconnect(): void {
    this.autoReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  /** 是否已连接 */
  isConnected(): boolean {
    return this.connected
  }

  /** 获取 pageId */
  getPageId(): string {
    return this.pageId
  }

  private scheduleReconnect(): void {
    if (!this.autoReconnect) return
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      console.log("[agent-sdk] Reconnecting...")
      this.connect()
    }, this.reconnectInterval)
  }

  private handleMessage(raw: string): void {
    let command: SDKCommand
    try {
      command = JSON.parse(raw)
    } catch {
      console.error("[agent-sdk] Invalid message:", raw)
      return
    }

    const response = this.executeCommand(command)
    this.send(response)
  }

  private executeCommand(cmd: SDKCommand): SDKResponse {
    try {
      const { method, params } = cmd
      let data: unknown

      switch (method) {
        case "snapshot":
          data = snapshot(params.maxTextLen as number | undefined)
          break
        case "click":
          data = actions.click(params.selector as string)
          break
        case "type":
          data = actions.type(
            params.selector as string,
            params.text as string,
            params.clear as boolean | undefined
          )
          break
        case "hover":
          data = actions.hover(params.selector as string)
          break
        case "select":
          data = actions.select(
            params.selector as string,
            params.values as string | string[]
          )
          break
        case "scroll":
          data = actions.scroll(params as any)
          break
        case "evaluate":
          data = actions.evaluate(params.code as string)
          break
        case "goto":
          data = actions.goto(params.url as string)
          break
        case "wait":
          // wait 在浏览器端简单实现为延时
          data = { waited: `${params.timeout ?? 1000}ms` }
          setTimeout(() => {}, (params.timeout as number) ?? 1000)
          break
        default:
          return { id: cmd.id, success: false, error: `Unknown method: ${method}` }
      }

      // 检查 action 返回的 success 字段
      if (typeof data === "object" && data && "success" in data && !(data as any).success) {
        return { id: cmd.id, success: false, error: (data as any).error }
      }

      return { id: cmd.id, success: true, data }
    } catch (err) {
      return {
        id: cmd.id,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  private send(msg: SDKResponse): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }
}
