/**
 * AgentRuntime — 统一后端入口
 *
 * 融合 AgentServer（HTTP/WS + 工具路由）和 Agent（LLM 编排），
 * 消费者只需:
 *   const runtime = await createRuntime({ port: 3100 })
 *   const result = await runtime.run("去 ChatGPT 问 3 本书推荐")
 */

import { Agent, type AgentResult } from "@agent-runtime/agent"
import { AgentServer, type AgentServerConfig } from "./agent-server.js"
import { Server as MCPServer } from "@modelcontextprotocol/sdk/server/index.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import {
  getSDKBridgeToolDefinitions,
  type SDKConnectionManager,
} from "@agent-runtime/mcp-sdk-bridge"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RuntimeConfig extends AgentServerConfig {
  /** Agent 配置目录（默认使用 @agent-runtime/agent 内置配置） */
  agentProjectDir?: string
  /** 详细日志 */
  verbose?: boolean
}

// ---------------------------------------------------------------------------
// SDK Bridge MCP Server (inprocess)
// ---------------------------------------------------------------------------

/**
 * 创建一个仅用于 inprocess transport 的 SDK Bridge MCP Server。
 * 不创建 WebSocket server，而是使用 AgentServer 已有的 SDKConnectionManager。
 */
function createInprocessSDKBridgeMCPServer(
  connections: SDKConnectionManager
): MCPServer {
  const server = new MCPServer(
    { name: "agent-runtime-sdk-bridge", version: "0.3.0" },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: getSDKBridgeToolDefinitions() }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: toolName, arguments: args } = request.params
    const action = toolName.replace("page_", "")

    try {
      // 连接管理工具
      if (action === "list_connections") {
        const pages = connections.listPages()
        const active = connections.getActivePageId()
        const text = pages.length === 0
          ? "No SDK connections"
          : pages.map((id) => `${id}${id === active ? " (active)" : ""}`).join("\n")
        return { content: [{ type: "text", text }] }
      }
      if (action === "switch") {
        const ok = connections.switchPage((args as any)?.pageId)
        return {
          content: [{ type: "text", text: ok ? `Switched to ${(args as any)?.pageId}` : `Not found: ${(args as any)?.pageId}` }],
        }
      }

      // 其他工具转发到 SDK
      const resp = await connections.send(action, (args as Record<string, unknown>) ?? {})
      if (!resp.success) {
        return {
          content: [{ type: "text", text: `Error: ${resp.error || "SDK command failed"}` }],
          isError: true,
        }
      }

      // 格式化 snapshot
      if (action === "snapshot" && typeof resp.data === "object" && resp.data) {
        const d = resp.data as Record<string, unknown>
        const text = [
          `URL: ${d.url || "unknown"}`,
          `Title: ${d.title || "unknown"}`,
          "",
          "=== Page Text ===",
          (d.text as string) || "(empty)",
          "",
          "=== Interactive Elements ===",
          (d.elements as string) || "(no interactive elements found)",
        ].join("\n")
        return { content: [{ type: "text", text }] }
      }

      const text = typeof resp.data === "string"
        ? resp.data
        : JSON.stringify(resp.data ?? { ok: true })
      return { content: [{ type: "text", text }] }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      }
    }
  })

  return server
}

// ---------------------------------------------------------------------------
// AgentRuntime
// ---------------------------------------------------------------------------

export class AgentRuntime {
  private server: AgentServer
  private agent: Agent
  private config: RuntimeConfig

  constructor(config: RuntimeConfig = {}) {
    this.config = config

    // 1. 创建 AgentServer（HTTP/WS + 工具路由）
    this.server = new AgentServer(config)

    // Agent 创建延迟到 start() 之后，因为需要先获取 SDKConnectionManager
    this.agent = null as unknown as Agent
  }

  async start(): Promise<void> {
    // 启动 HTTP/WS 服务
    await this.server.start()

    // 获取 SDKConnectionManager，创建 inprocess MCP Server
    const connections = this.server.getSDKConnections()
    const mcpServers: Record<string, unknown> = {}

    if (connections) {
      mcpServers["agent-runtime-sdk-bridge"] =
        createInprocessSDKBridgeMCPServer(connections)
    }

    // 创建 Agent，注入 SDK Bridge MCP Server
    this.agent = new Agent({
      projectDir: this.config.agentProjectDir,
      verbose: this.config.verbose,
      mcpServers,
    })
  }

  async run(message: string): Promise<AgentResult> {
    if (!this.agent) {
      throw new Error("Runtime not started. Call start() first.")
    }
    return this.agent.run(message)
  }

  async stop(): Promise<void> {
    await this.server.stop()
    if (this.agent) {
      await this.agent.close()
    }
  }

  /** 获取底层 AgentServer（高级用途） */
  getServer(): AgentServer {
    return this.server
  }

  /** 获取底层 Agent（高级用途） */
  getAgent(): Agent {
    return this.agent
  }
}

/** 便捷函数: 创建并启动 runtime */
export async function createRuntime(config?: RuntimeConfig): Promise<AgentRuntime> {
  const runtime = new AgentRuntime(config ?? {})
  await runtime.start()
  return runtime
}
