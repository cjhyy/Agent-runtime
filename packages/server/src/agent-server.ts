/**
 * AgentServer - 统一入口
 *
 * 提供:
 * 1. HTTP API - 供外部服务调用 (REST)
 * 2. WebSocket - SDK 连接 + 客户端工具调用
 * 3. MCP 路由 - 内嵌 Playwright MCP + SDK Bridge MCP
 *
 * 使用方式:
 *   import { AgentServer } from "@agent-runtime/server"
 *   const server = new AgentServer({ port: 3100 })
 *   await server.start()
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { Server as HTTPServer } from "node:http"
import { WebSocketServer, WebSocket } from "ws"
import {
  initBrowser,
  closeBrowser,
  browserGoto,
  browserClick,
  browserType,
  browserPress,
  browserSnapshot,
  browserScreenshot,
  browserWait,
  browserScroll,
  browserHover,
  browserSelect,
  browserBack,
  browserForward,
  browserEvaluate,
  browserUpload,
  browserReload,
  getCookiesFormatted,
  clearCookies,
  clearCookiesForDomain,
  exportSession,
  importSession,
  saveSession,
  loadSession,
  listSessions,
} from "@agent-runtime/browser"
import { getToolDefinitions, type PlaywrightServerOptions } from "@agent-runtime/mcp-playwright"
import { getSDKBridgeToolDefinitions, SDKConnectionManager } from "@agent-runtime/mcp-sdk-bridge"
import { createLogger } from "@agent-runtime/core"

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

// ===== AgentServer =====

export class AgentServer {
  private config: Required<AgentServerConfig>
  private httpServer: HTTPServer | null = null
  private wss: WebSocketServer | null = null
  private sdkConnections: SDKConnectionManager | null = null
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

  async start(): Promise<void> {
    this.setupToolRegistry()

    this.httpServer = createServer((req, res) => this.handleHTTP(req, res))
    this.wss = new WebSocketServer({ server: this.httpServer })
    this.wss.on("connection", (ws, req) => this.handleWebSocket(ws, req))

    await new Promise<void>((resolve) => {
      this.httpServer!.listen(this.config.port, this.config.host, () => {
        logger.info(`Running on http://${this.config.host}:${this.config.port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    this.sdkConnections?.closeAll()
    if (this.wss) { this.wss.close(); this.wss = null }
    if (this.httpServer) {
      await new Promise<void>((resolve) => this.httpServer!.close(() => resolve()))
      this.httpServer = null
    }
    if (this.config.enablePlaywright) await closeBrowser()
    logger.info("Stopped")
  }

  getSDKConnections(): SDKConnectionManager | null {
    return this.sdkConnections
  }

  // ===== Setup =====

  private setupToolRegistry(): void {
    if (this.config.enablePlaywright) {
      for (const tool of getToolDefinitions()) {
        this.toolRegistry.set(tool.name, "playwright")
      }
      logger.info(`Registered ${getToolDefinitions().length} Playwright tools`)
    }

    if (this.config.enableSDKBridge) {
      this.sdkConnections = new SDKConnectionManager()
      for (const tool of getSDKBridgeToolDefinitions()) {
        this.toolRegistry.set(tool.name, "sdk-bridge")
      }
      logger.info(`Registered ${getSDKBridgeToolDefinitions().length} SDK Bridge tools`)
    }
  }

  // ===== HTTP =====

  private handleHTTP(req: IncomingMessage, res: ServerResponse): void {
    res.setHeader("Access-Control-Allow-Origin", this.config.corsOrigin)
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return }

    const url = new URL(req.url || "/", `http://${req.headers.host}`)

    switch (url.pathname) {
      case "/health":
        this.json(res, 200, {
          status: "ok",
          playwright: this.config.enablePlaywright,
          sdkBridge: this.config.enableSDKBridge,
          sdkConnections: this.sdkConnections?.listPages().length ?? 0,
        })
        break
      case "/tools":
        this.json(res, 200, {
          tools: Array.from(this.toolRegistry.entries()).map(([name, source]) => ({ name, source })),
        })
        break
      case "/tools/call":
        if (req.method === "POST") {
          this.handleToolCallHTTP(req, res)
        } else {
          this.json(res, 405, { error: "Method not allowed" })
        }
        break
      case "/sdk/connections":
        this.json(res, 200, {
          pages: this.sdkConnections?.listPages() ?? [],
          active: this.sdkConnections?.getActivePageId() ?? null,
        })
        break
      default:
        this.json(res, 404, { error: "Not found" })
    }
  }

  private async handleToolCallHTTP(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.readBody(req)
      const request = JSON.parse(body) as ToolCallRequest
      if (!request.tool) { this.json(res, 400, { error: "Missing 'tool' field" }); return }
      const result = await this.routeToolCall(request.tool, request.arguments ?? {})
      this.json(res, 200, { success: true, result })
    } catch (err) {
      this.json(res, 500, { success: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  // ===== WebSocket =====

  private handleWebSocket(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url || "/", `http://localhost:${this.config.port}`)
    const type = url.searchParams.get("type") || "client"

    if (type === "sdk" && this.sdkConnections) {
      const pageId = url.searchParams.get("pageId") || `page_${Date.now()}`
      this.sdkConnections.register(pageId, ws)
      return
    }

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ToolCallRequest & { id?: string }
        const result = await this.routeToolCall(msg.tool, msg.arguments ?? {})
        ws.send(JSON.stringify({ success: true, result, id: msg.id }))
      } catch (err) {
        ws.send(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }))
      }
    })
  }

  // ===== Tool Routing =====

  private async routeToolCall(toolName: string, args: Record<string, unknown>): Promise<string> {
    const source = this.toolRegistry.get(toolName)
    if (!source) {
      throw new Error(`Unknown tool: ${toolName}`)
    }

    if (source === "playwright") return this.execPlaywright(toolName, args)
    if (source === "sdk-bridge") return this.execSDKBridge(toolName, args)
    throw new Error(`Source ${source} not enabled`)
  }

  private async execPlaywright(name: string, args: Record<string, unknown>): Promise<string> {
    await initBrowser()
    const action = name.replace("headless_", "")

    switch (action) {
      case "goto": return JSON.stringify(await browserGoto(args.url as string))
      case "click": return JSON.stringify(await browserClick(args.selector as string))
      case "type": return JSON.stringify(await browserType(args.selector as string, args.text as string))
      case "press": return JSON.stringify(await browserPress(args.key as string))
      case "snapshot": {
        const r = await browserSnapshot(args.maxTextLen as number | undefined)
        return [`URL: ${r.url}`, `Title: ${r.title}`, "", "=== Page Text ===", r.text, "", "=== Interactive Elements ===", r.elements || "(none)"].join("\n")
      }
      case "screenshot": return (await browserScreenshot()).toString("base64")
      case "back": return JSON.stringify(await browserBack())
      case "forward": return JSON.stringify(await browserForward())
      case "reload": return JSON.stringify(await browserReload())
      case "hover": return JSON.stringify(await browserHover(args.selector as string))
      case "select": return JSON.stringify(await browserSelect(args.selector as string, args.values as string | string[]))
      case "scroll": return JSON.stringify(await browserScroll(args as any))
      case "wait": return JSON.stringify(await browserWait(args as any))
      case "evaluate": return JSON.stringify(await browserEvaluate(args.code as string))
      case "upload": return JSON.stringify(await browserUpload(args.selector as string, args.files as string | string[]))
      case "cookie_list": return JSON.stringify(await getCookiesFormatted(args.url as string | undefined))
      case "cookie_clear": {
        const domain = args.domain as string | undefined
        if (domain) { const n = await clearCookiesForDomain(domain); return `Cleared ${n} cookies for ${domain}` }
        await clearCookies(); return "All cookies cleared"
      }
      case "session_save": return `Saved: ${await saveSession(args.name as string)}`
      case "session_load": return JSON.stringify(await loadSession(args.name as string))
      case "session_list": return JSON.stringify(listSessions())
      case "session_export": { const r = await exportSession(args.path as string); return `Exported ${r.cookies.length} cookies` }
      case "session_import": return JSON.stringify(await importSession(args.path as string))
      default: throw new Error(`Unknown action: ${action}`)
    }
  }

  private async execSDKBridge(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.sdkConnections) throw new Error("SDK Bridge not enabled")
    const action = name.replace("page_", "")

    if (action === "list_connections") {
      const pages = this.sdkConnections.listPages()
      const active = this.sdkConnections.getActivePageId()
      return pages.length === 0 ? "No SDK connections" : pages.map((id) => `${id}${id === active ? " (active)" : ""}`).join("\n")
    }
    if (action === "switch") {
      return this.sdkConnections.switchPage(args.pageId as string) ? `Switched to ${args.pageId}` : `Not found: ${args.pageId}`
    }

    const resp = await this.sdkConnections.send(action, args)
    if (!resp.success) throw new Error(resp.error || "SDK command failed")

    if (action === "snapshot" && typeof resp.data === "object" && resp.data) {
      const d = resp.data as Record<string, unknown>
      return [`URL: ${d.url}`, `Title: ${d.title}`, "", "=== Page Text ===", d.text as string || "", "", "=== Interactive Elements ===", d.elements as string || "(none)"].join("\n")
    }

    return typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data ?? { ok: true })
  }

  // ===== Helpers =====

  private json(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json" })
    res.end(JSON.stringify(data))
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      req.on("data", (c) => chunks.push(c))
      req.on("end", () => resolve(Buffer.concat(chunks).toString()))
      req.on("error", reject)
    })
  }
}
