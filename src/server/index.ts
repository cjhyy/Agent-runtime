/**
 * AgentServer - 统一入口
 *
 * 提供:
 * 1. HTTP API - 供外部服务调用 (REST + SSE)
 * 2. WebSocket - SDK 连接 + 实时通信
 * 3. MCP 路由 - 内嵌 Playwright MCP + SDK Bridge MCP
 *
 * 使用方式:
 *   import { AgentServer } from "agent-runtime/server"
 *   const server = new AgentServer({ port: 3100 })
 *   await server.start()
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { Server as HTTPServer } from "node:http"
import { WebSocketServer, WebSocket } from "ws"
import {
  createPlaywrightServer,
  type PlaywrightServerOptions,
} from "../mcp/playwright-server.js"
import {
  createSDKBridgeServer,
  SDKConnectionManager,
} from "../mcp/sdk-bridge-server.js"
import { initBrowser, closeBrowser } from "../runtime/browser/core.js"
import { createLogger } from "../logger.js"

const logger = createLogger("AgentServer")

// ===== Types =====

export interface AgentServerConfig {
  /** HTTP server port. Default 3100. */
  port?: number
  /** Host to bind. Default 0.0.0.0 */
  host?: string
  /** Enable Playwright headless tools. Default true. */
  enablePlaywright?: boolean
  /** Enable SDK Bridge tools. Default true. */
  enableSDKBridge?: boolean
  /** Playwright MCP options */
  playwrightOptions?: PlaywrightServerOptions
  /** CORS origin. Default "*" */
  corsOrigin?: string
}

interface ToolCallRequest {
  tool: string
  arguments?: Record<string, unknown>
}

interface ToolCallResponse {
  success: boolean
  result?: unknown
  error?: string
}

// ===== AgentServer =====

export class AgentServer {
  private config: Required<AgentServerConfig>
  private httpServer: HTTPServer | null = null
  private wss: WebSocketServer | null = null
  private sdkConnections: SDKConnectionManager | null = null

  // MCP Server instances (for tool routing)
  private playwrightToolHandler: ((name: string, args: Record<string, unknown>) => Promise<string>) | null = null
  private sdkBridgeToolHandler: ((name: string, args: Record<string, unknown>) => Promise<string>) | null = null

  // Tool registry for routing
  private toolRegistry = new Map<string, "playwright" | "sdk-bridge">()

  constructor(config: AgentServerConfig = {}) {
    this.config = {
      port: config.port ?? 3100,
      host: config.host ?? "0.0.0.0",
      enablePlaywright: config.enablePlaywright ?? true,
      enableSDKBridge: config.enableSDKBridge ?? true,
      playwrightOptions: config.playwrightOptions ?? {},
      corsOrigin: config.corsOrigin ?? "*",
    }
  }

  /** Start the server */
  async start(): Promise<void> {
    // 1. Setup MCP tool handlers
    await this.setupToolHandlers()

    // 2. Create HTTP server
    this.httpServer = createServer((req, res) => this.handleHTTP(req, res))

    // 3. Create WebSocket server on same HTTP server
    this.wss = new WebSocketServer({ server: this.httpServer })
    this.wss.on("connection", (ws, req) => this.handleWebSocket(ws, req))

    // 4. Start listening
    await new Promise<void>((resolve) => {
      this.httpServer!.listen(this.config.port, this.config.host, () => {
        logger.info(
          `AgentServer running on http://${this.config.host}:${this.config.port}`
        )
        resolve()
      })
    })
  }

  /** Stop the server */
  async stop(): Promise<void> {
    this.sdkConnections?.closeAll()

    if (this.wss) {
      this.wss.close()
      this.wss = null
    }

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve())
      })
      this.httpServer = null
    }

    if (this.config.enablePlaywright) {
      await closeBrowser()
    }

    logger.info("AgentServer stopped")
  }

  /** Get SDK connection manager (for external use) */
  getSDKConnections(): SDKConnectionManager | null {
    return this.sdkConnections
  }

  // ===== Setup =====

  private async setupToolHandlers(): Promise<void> {
    // Playwright tools
    if (this.config.enablePlaywright) {
      const { getToolDefinitions } = await import("../mcp/playwright-server.js")
      const tools = getToolDefinitions()

      // Import the actual operation functions for direct invocation
      const ops = await import("../runtime/browser/operations.js")
      const cookies = await import("../runtime/browser/index.js")

      // Create a handler that matches tool names to operations
      this.playwrightToolHandler = async (name: string, args: Record<string, unknown>) => {
        // Lazy init browser
        await initBrowser()
        return this.executePlaywrightTool(name, args, ops, cookies)
      }

      for (const tool of tools) {
        this.toolRegistry.set(tool.name, "playwright")
      }

      logger.info(`Registered ${tools.length} Playwright tools`)
    }

    // SDK Bridge tools
    if (this.config.enableSDKBridge) {
      this.sdkConnections = new SDKConnectionManager()

      const { getSDKBridgeToolDefinitions } = await import("../mcp/sdk-bridge-server.js")
      const tools = getSDKBridgeToolDefinitions()

      this.sdkBridgeToolHandler = async (name: string, args: Record<string, unknown>) => {
        return this.executeSDKBridgeTool(name, args)
      }

      for (const tool of tools) {
        this.toolRegistry.set(tool.name, "sdk-bridge")
      }

      logger.info(`Registered ${tools.length} SDK Bridge tools`)
    }
  }

  // ===== HTTP Handler =====

  private handleHTTP(req: IncomingMessage, res: ServerResponse): void {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", this.config.corsOrigin)
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url || "/", `http://${req.headers.host}`)

    // Route
    switch (url.pathname) {
      case "/health":
        this.sendJSON(res, 200, {
          status: "ok",
          playwright: this.config.enablePlaywright,
          sdkBridge: this.config.enableSDKBridge,
          sdkConnections: this.sdkConnections?.listPages().length ?? 0,
        })
        break

      case "/tools":
        this.handleListTools(res)
        break

      case "/tools/call":
        if (req.method === "POST") {
          this.handleToolCallHTTP(req, res)
        } else {
          this.sendJSON(res, 405, { error: "Method not allowed" })
        }
        break

      case "/sdk/connections":
        this.sendJSON(res, 200, {
          pages: this.sdkConnections?.listPages() ?? [],
          active: this.sdkConnections?.getActivePageId() ?? null,
        })
        break

      default:
        this.sendJSON(res, 404, { error: "Not found" })
    }
  }

  private handleListTools(res: ServerResponse): void {
    const tools: Array<{ name: string; source: string }> = []
    for (const [name, source] of this.toolRegistry) {
      tools.push({ name, source })
    }
    this.sendJSON(res, 200, { tools })
  }

  private async handleToolCallHTTP(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    try {
      const body = await this.readBody(req)
      const request = JSON.parse(body) as ToolCallRequest

      if (!request.tool) {
        this.sendJSON(res, 400, { error: "Missing 'tool' field" })
        return
      }

      const result = await this.routeToolCall(
        request.tool,
        request.arguments ?? {}
      )
      this.sendJSON(res, 200, { success: true, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.sendJSON(res, 500, { success: false, error: message })
    }
  }

  // ===== WebSocket Handler =====

  private handleWebSocket(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url || "/", `http://localhost:${this.config.port}`)
    const type = url.searchParams.get("type") || "client"

    if (type === "sdk" && this.sdkConnections) {
      // SDK 连接 - 注册到 SDKConnectionManager
      const pageId =
        url.searchParams.get("pageId") || `page_${Date.now()}`
      this.sdkConnections.register(pageId, ws)
      return
    }

    // Client 连接 - 支持工具调用
    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ToolCallRequest & { id?: string }
        const result = await this.routeToolCall(
          msg.tool,
          msg.arguments ?? {}
        )
        const response: ToolCallResponse & { id?: string } = {
          success: true,
          result,
          id: msg.id,
        }
        ws.send(JSON.stringify(response))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        ws.send(JSON.stringify({ success: false, error: message }))
      }
    })

    ws.on("error", (err) => {
      logger.error(`WebSocket client error: ${err.message}`)
    })
  }

  // ===== Tool Routing =====

  private async routeToolCall(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    const source = this.toolRegistry.get(toolName)

    if (!source) {
      throw new Error(
        `Unknown tool: ${toolName}. Available: ${Array.from(this.toolRegistry.keys()).join(", ")}`
      )
    }

    if (source === "playwright" && this.playwrightToolHandler) {
      return this.playwrightToolHandler(toolName, args)
    }

    if (source === "sdk-bridge" && this.sdkBridgeToolHandler) {
      return this.sdkBridgeToolHandler(toolName, args)
    }

    throw new Error(`Tool source ${source} is not enabled`)
  }

  // ===== Playwright Tool Execution =====

  private async executePlaywrightTool(
    name: string,
    args: Record<string, unknown>,
    ops: typeof import("../runtime/browser/operations.js"),
    cookies: typeof import("../runtime/browser/index.js")
  ): Promise<string> {
    const action = name.replace("headless_", "")

    switch (action) {
      case "goto":
        return JSON.stringify(await ops.browserGoto(args.url as string))
      case "click":
        return JSON.stringify(await ops.browserClick(args.selector as string))
      case "type":
        return JSON.stringify(
          await ops.browserType(args.selector as string, args.text as string)
        )
      case "press":
        return JSON.stringify(await ops.browserPress(args.key as string))
      case "snapshot": {
        const r = await ops.browserSnapshot(args.maxTextLen as number | undefined)
        return [
          `URL: ${r.url}`,
          `Title: ${r.title}`,
          "",
          "=== Page Text ===",
          r.text,
          "",
          "=== Interactive Elements ===",
          r.elements || "(none)",
        ].join("\n")
      }
      case "screenshot": {
        const buf = await ops.browserScreenshot()
        return buf.toString("base64")
      }
      case "back":
        return JSON.stringify(await ops.browserBack())
      case "forward":
        return JSON.stringify(await ops.browserForward())
      case "reload":
        return JSON.stringify(await ops.browserReload())
      case "hover":
        return JSON.stringify(await ops.browserHover(args.selector as string))
      case "select":
        return JSON.stringify(
          await ops.browserSelect(
            args.selector as string,
            args.values as string | string[]
          )
        )
      case "scroll":
        return JSON.stringify(await ops.browserScroll(args as any))
      case "wait":
        return JSON.stringify(await ops.browserWait(args as any))
      case "evaluate":
        return JSON.stringify(await ops.browserEvaluate(args.code as string))
      case "upload":
        return JSON.stringify(
          await ops.browserUpload(
            args.selector as string,
            args.files as string | string[]
          )
        )
      case "cookie_list":
        return JSON.stringify(
          await cookies.getCookiesFormatted(args.url as string | undefined)
        )
      case "cookie_clear": {
        const domain = args.domain as string | undefined
        if (domain) {
          const n = await cookies.clearCookiesForDomain(domain)
          return `Cleared ${n} cookies for ${domain}`
        }
        await cookies.clearCookies()
        return "All cookies cleared"
      }
      case "session_save":
        return `Saved: ${await cookies.saveSession(args.name as string)}`
      case "session_load": {
        const r = await cookies.loadSession(args.name as string)
        return JSON.stringify(r)
      }
      case "session_list":
        return JSON.stringify(cookies.listSessions())
      case "session_export": {
        const r = await cookies.exportSession(args.path as string)
        return `Exported ${r.cookies.length} cookies`
      }
      case "session_import": {
        const r = await cookies.importSession(args.path as string)
        return JSON.stringify(r)
      }
      default:
        throw new Error(`Unknown Playwright tool action: ${action}`)
    }
  }

  // ===== SDK Bridge Tool Execution =====

  private async executeSDKBridgeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<string> {
    if (!this.sdkConnections) {
      throw new Error("SDK Bridge is not enabled")
    }

    const action = name.replace("page_", "")

    // 本地处理的管理工具
    switch (action) {
      case "list_connections": {
        const pages = this.sdkConnections.listPages()
        const active = this.sdkConnections.getActivePageId()
        if (pages.length === 0) return "No SDK connections"
        return pages
          .map((id) => `${id}${id === active ? " (active)" : ""}`)
          .join("\n")
      }
      case "switch": {
        const ok = this.sdkConnections.switchPage(args.pageId as string)
        return ok ? `Switched to ${args.pageId}` : `Page not found: ${args.pageId}`
      }
    }

    // 转发到 SDK
    const resp = await this.sdkConnections.send(action, args)

    if (!resp.success) {
      throw new Error(resp.error || "SDK command failed")
    }

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
        (d.elements as string) || "(none)",
      ].join("\n")
    }

    return typeof resp.data === "string"
      ? resp.data
      : JSON.stringify(resp.data ?? { ok: true })
  }

  // ===== Helpers =====

  private sendJSON(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json" })
    res.end(JSON.stringify(data))
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      req.on("data", (chunk) => chunks.push(chunk))
      req.on("end", () => resolve(Buffer.concat(chunks).toString()))
      req.on("error", reject)
    })
  }
}
