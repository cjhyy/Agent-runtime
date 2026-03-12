/**
 * SDK Bridge MCP Server
 *
 * 通过 WebSocket 与浏览器端 SDK 通信，将用户当前页面的操作暴露为 MCP 工具。
 * 工具前缀: page_*
 *
 * 架构:
 *   Browser Page (SDK inject) <--- WebSocket ---> SDK Bridge MCP Server
 *
 * SDK 在页面中注入后，通过 WebSocket 连接到此 Server，
 * Server 将 LLM 的工具调用转发为 SDK 指令，SDK 执行后返回结果。
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { WebSocketServer, WebSocket } from "ws"
import { mcpLogger } from "@agent-runtime/core"

const logger = mcpLogger.child("sdk-bridge")

// ===== SDK Protocol =====

/** SDK 指令 - Server -> SDK */
export interface SDKCommand {
  id: string
  method: string
  params: Record<string, unknown>
}

/** SDK 响应 - SDK -> Server */
export interface SDKResponse {
  id: string
  success: boolean
  data?: unknown
  error?: string
}

/** SDK 事件 - SDK -> Server (主动推送) */
export interface SDKEvent {
  event: string
  data: unknown
}

type SDKMessage = SDKResponse | SDKEvent

function isSDKEvent(msg: SDKMessage): msg is SDKEvent {
  return "event" in msg
}

// ===== Connection Manager =====

/**
 * 管理 SDK WebSocket 连接
 * 支持多 tab 连接，通过 pageId 标识
 */
export class SDKConnectionManager {
  private connections = new Map<string, WebSocket>()
  private activePageId: string | null = null
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: SDKResponse) => void
      reject: (reason: Error) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()
  private requestIdCounter = 0
  private eventListeners = new Map<string, Array<(data: unknown) => void>>()

  /** 注册一个 SDK 连接 */
  register(pageId: string, ws: WebSocket): void {
    // 关闭旧连接
    const existing = this.connections.get(pageId)
    if (existing && existing.readyState === WebSocket.OPEN) {
      existing.close()
    }

    this.connections.set(pageId, ws)

    // 第一个连接自动设为 active
    if (!this.activePageId || !this.connections.has(this.activePageId)) {
      this.activePageId = pageId
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as SDKMessage
        if (isSDKEvent(msg)) {
          this.handleEvent(msg)
        } else {
          this.handleResponse(msg)
        }
      } catch (err) {
        logger.error(`Invalid message from SDK ${pageId}: ${err}`)
      }
    })

    ws.on("close", () => {
      this.connections.delete(pageId)
      if (this.activePageId === pageId) {
        // 切换到下一个可用连接
        const next = this.connections.keys().next()
        this.activePageId = next.done ? null : next.value
      }
      logger.info(`SDK disconnected: ${pageId}`)
    })

    logger.info(`SDK connected: ${pageId} (total: ${this.connections.size})`)
  }

  /** 向 active SDK 发送指令并等待响应 */
  async send(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 30000
  ): Promise<SDKResponse> {
    const ws = this.getActiveConnection()
    if (!ws) {
      throw new Error("No SDK connection available. Is the browser SDK loaded?")
    }

    const id = `req_${++this.requestIdCounter}`
    const command: SDKCommand = { id, method, params }

    return new Promise<SDKResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`SDK command timed out: ${method} (${timeoutMs}ms)`))
      }, timeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timer })
      ws.send(JSON.stringify(command))
    })
  }

  /** 切换 active page */
  switchPage(pageId: string): boolean {
    if (!this.connections.has(pageId)) return false
    this.activePageId = pageId
    return true
  }

  /** 获取所有连接的 page */
  listPages(): string[] {
    return Array.from(this.connections.keys())
  }

  /** 获取 active page ID */
  getActivePageId(): string | null {
    return this.activePageId
  }

  /** 是否有可用连接 */
  hasConnection(): boolean {
    return this.activePageId !== null && this.connections.has(this.activePageId)
  }

  /** 注册事件监听 */
  on(event: string, listener: (data: unknown) => void): void {
    const listeners = this.eventListeners.get(event) || []
    listeners.push(listener)
    this.eventListeners.set(event, listeners)
  }

  /** 关闭所有连接 */
  closeAll(): void {
    for (const ws of this.connections.values()) {
      ws.close()
    }
    this.connections.clear()
    this.activePageId = null

    for (const { reject, timer } of this.pendingRequests.values()) {
      clearTimeout(timer)
      reject(new Error("Connection closed"))
    }
    this.pendingRequests.clear()
  }

  private getActiveConnection(): WebSocket | null {
    if (!this.activePageId) return null
    const ws = this.connections.get(this.activePageId)
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      this.connections.delete(this.activePageId)
      this.activePageId = null
      return null
    }
    return ws
  }

  private handleResponse(resp: SDKResponse): void {
    const pending = this.pendingRequests.get(resp.id)
    if (pending) {
      clearTimeout(pending.timer)
      this.pendingRequests.delete(resp.id)
      pending.resolve(resp)
    }
  }

  private handleEvent(evt: SDKEvent): void {
    const listeners = this.eventListeners.get(evt.event)
    if (listeners) {
      for (const fn of listeners) {
        try {
          fn(evt.data)
        } catch (err) {
          logger.error(`Event listener error: ${err}`)
        }
      }
    }
  }
}

// ===== Tool Definitions =====

const TOOL_PREFIX = "page"

const TOOLS = [
  {
    name: `${TOOL_PREFIX}_snapshot`,
    description:
      "Capture the current page state from the user's browser: visible text and interactive elements with ref_N identifiers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        maxTextLen: {
          type: "number",
          description: "Max length of page text. Default 5000.",
        },
      },
    },
  },
  {
    name: `${TOOL_PREFIX}_click`,
    description:
      "Click an element on the user's page. Use ref_N from page_snapshot or a CSS selector.",
    inputSchema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "Element selector: ref_N or CSS selector",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: `${TOOL_PREFIX}_type`,
    description:
      "Type text into an input field on the user's page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "Input element selector: ref_N or CSS selector",
        },
        text: { type: "string", description: "Text to type" },
        clear: {
          type: "boolean",
          description: "Clear existing content before typing. Default true.",
        },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: `${TOOL_PREFIX}_scroll`,
    description:
      "Scroll the user's page by direction/distance, to an element, or to top/bottom.",
    inputSchema: {
      type: "object" as const,
      properties: {
        direction: {
          type: "string",
          enum: ["up", "down", "left", "right"],
        },
        distance: { type: "number", description: "Pixels. Default 500." },
        selector: { type: "string", description: "Scroll to this element" },
        toTop: { type: "boolean" },
        toBottom: { type: "boolean" },
      },
    },
  },
  {
    name: `${TOOL_PREFIX}_hover`,
    description: "Hover over an element on the user's page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "Element selector: ref_N or CSS selector",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: `${TOOL_PREFIX}_select`,
    description: "Select option(s) from a dropdown on the user's page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        selector: { type: "string", description: "Select element selector" },
        values: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
          description: "Value(s) to select",
        },
      },
      required: ["selector", "values"],
    },
  },
  {
    name: `${TOOL_PREFIX}_evaluate`,
    description:
      "Execute JavaScript code in the user's page context. Returns the result.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "JavaScript code to execute" },
      },
      required: ["code"],
    },
  },
  {
    name: `${TOOL_PREFIX}_wait`,
    description:
      "Wait for a condition on the user's page: element, text, or timeout.",
    inputSchema: {
      type: "object" as const,
      properties: {
        timeout: { type: "number", description: "Wait milliseconds" },
        selector: { type: "string", description: "Wait for element" },
        text: { type: "string", description: "Wait for text to appear" },
        textGone: { type: "string", description: "Wait for text to disappear" },
      },
    },
  },
  {
    name: `${TOOL_PREFIX}_goto`,
    description: "Navigate the user's page to a URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL to navigate to" },
      },
      required: ["url"],
    },
  },
  // --- 连接管理 ---
  {
    name: `${TOOL_PREFIX}_list_connections`,
    description: "List all connected browser pages (tabs) with their page IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: `${TOOL_PREFIX}_switch`,
    description: "Switch to a different connected browser page by its page ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pageId: { type: "string", description: "Target page ID" },
      },
      required: ["pageId"],
    },
  },
]

// ===== Tool Handler =====

async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  connections: SDKConnectionManager
): Promise<string> {
  const action = name.replace(`${TOOL_PREFIX}_`, "")

  // 连接管理工具不需要 SDK 连接
  switch (action) {
    case "list_connections": {
      const pages = connections.listPages()
      const active = connections.getActivePageId()
      if (pages.length === 0) return "No SDK connections"
      return pages
        .map((id) => `${id}${id === active ? " (active)" : ""}`)
        .join("\n")
    }
    case "switch": {
      const ok = connections.switchPage(args.pageId as string)
      return ok
        ? `Switched to page: ${args.pageId}`
        : `Page not found: ${args.pageId}`
    }
  }

  // 其他工具需要 SDK 连接，直接转发
  const resp = await connections.send(action, args)

  if (!resp.success) {
    throw new Error(resp.error || "SDK command failed")
  }

  // 格式化 snapshot 输出
  if (action === "snapshot" && typeof resp.data === "object" && resp.data) {
    const d = resp.data as Record<string, unknown>
    return [
      `URL: ${d.url || "unknown"}`,
      `Title: ${d.title || "unknown"}`,
      "",
      "=== Page Text ===",
      (d.text as string) || "(empty)",
      "",
      "=== Interactive Elements ===",
      (d.elements as string) || "(no interactive elements found)",
    ].join("\n")
  }

  return typeof resp.data === "string"
    ? resp.data
    : JSON.stringify(resp.data ?? { ok: true })
}

// ===== Server Factory =====

export interface SDKBridgeServerOptions {
  /** WebSocket server port for SDK connections. Default 9800. */
  wsPort?: number
  /** Server name */
  name?: string
  /** Server version */
  version?: string
}

/**
 * Create an SDK Bridge MCP Server.
 *
 * Returns the MCP Server, the WebSocket server, and the connection manager.
 */
export function createSDKBridgeServer(options: SDKBridgeServerOptions = {}): {
  server: Server
  wss: WebSocketServer
  connections: SDKConnectionManager
} {
  const {
    wsPort = 9800,
    name = "agent-runtime-sdk-bridge",
    version = "0.3.0",
  } = options

  const connections = new SDKConnectionManager()

  // --- WebSocket Server for SDK connections ---
  const wss = new WebSocketServer({ port: wsPort })

  wss.on("connection", (ws, req) => {
    // pageId from query param or header
    const url = new URL(req.url || "/", `http://localhost:${wsPort}`)
    const pageId =
      url.searchParams.get("pageId") ||
      req.headers["x-page-id"]?.toString() ||
      `page_${Date.now()}`

    connections.register(pageId, ws)
  })

  wss.on("error", (err) => {
    logger.error(`WebSocket server error: ${err.message}`)
  })

  logger.info(`SDK Bridge WebSocket listening on port ${wsPort}`)

  // --- MCP Server ---
  const server = new Server(
    { name, version },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: toolName, arguments: args } = request.params

    try {
      const result = await handleToolCall(toolName, args ?? {}, connections)
      return {
        content: [{ type: "text", text: result }],
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`Tool ${toolName} failed: ${message}`)
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      }
    }
  })

  return { server, wss, connections }
}

/** Get the SDK Bridge tool definitions */
export function getSDKBridgeToolDefinitions() {
  return TOOLS
}
