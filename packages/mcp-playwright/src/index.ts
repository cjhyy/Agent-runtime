/**
 * Playwright MCP Server
 *
 * 将现有 Playwright 浏览器操作包装为 MCP Server 工具。
 * 工具前缀: headless_*
 *
 * 支持两种运行方式:
 * 1. 独立进程 (stdio transport) - 供 mem-deep-research 通过 tool config 调用
 * 2. 编程式创建 - 供 AgentServer 内嵌使用
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"

import {
  initBrowser,
  closeBrowser,
  setBrowserConfig,
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
  type BrowserConfig,
} from "@agent-runtime/browser"
import { mcpLogger as logger } from "@agent-runtime/core"

// ===== Tool Definitions =====

const TOOL_PREFIX = "headless"

const TOOLS = [
  // --- 核心浏览器操作 ---
  {
    name: `${TOOL_PREFIX}_goto`,
    description:
      "Navigate to a URL in the headless browser. Returns the final URL and page title.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "The URL to navigate to" },
      },
      required: ["url"],
    },
  },
  {
    name: `${TOOL_PREFIX}_click`,
    description:
      "Click an element on the page. Use ref_N identifiers from headless_snapshot, or a CSS selector.",
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
      "Type text into an input field. Handles both regular inputs and contenteditable elements.",
    inputSchema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "Input element selector: ref_N or CSS selector",
        },
        text: { type: "string", description: "Text to type" },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: `${TOOL_PREFIX}_press`,
    description:
      "Press a keyboard key (e.g. Enter, Tab, Escape, ArrowDown). Supports key combinations like Control+A.",
    inputSchema: {
      type: "object" as const,
      properties: {
        key: {
          type: "string",
          description: "Key to press, e.g. 'Enter', 'Tab', 'Control+A'",
        },
      },
      required: ["key"],
    },
  },
  {
    name: `${TOOL_PREFIX}_snapshot`,
    description:
      "Capture the current page state: screenshot (base64), visible text, and interactive elements with ref_N identifiers. Use ref_N in click/type/hover operations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        maxTextLen: {
          type: "number",
          description: "Max length of page text to return. Default 5000.",
        },
      },
    },
  },
  {
    name: `${TOOL_PREFIX}_screenshot`,
    description: "Take a screenshot of the current viewport. Returns base64-encoded PNG.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  // --- 导航 ---
  {
    name: `${TOOL_PREFIX}_back`,
    description: "Navigate back to the previous page.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: `${TOOL_PREFIX}_forward`,
    description: "Navigate forward to the next page.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: `${TOOL_PREFIX}_reload`,
    description: "Reload the current page.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  // --- 交互 ---
  {
    name: `${TOOL_PREFIX}_hover`,
    description: "Hover over an element to trigger tooltips or dropdown menus.",
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
    description: "Select option(s) from a <select> dropdown.",
    inputSchema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "Select element selector: ref_N or CSS selector",
        },
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
    name: `${TOOL_PREFIX}_scroll`,
    description:
      "Scroll the page. Can scroll by direction/distance, to an element, or to top/bottom.",
    inputSchema: {
      type: "object" as const,
      properties: {
        direction: {
          type: "string",
          enum: ["up", "down", "left", "right"],
          description: "Scroll direction. Default: down",
        },
        distance: {
          type: "number",
          description: "Scroll distance in pixels. Default: 500",
        },
        selector: {
          type: "string",
          description: "Scroll to this element (ref_N or CSS selector)",
        },
        toTop: { type: "boolean", description: "Scroll to page top" },
        toBottom: { type: "boolean", description: "Scroll to page bottom" },
      },
    },
  },
  {
    name: `${TOOL_PREFIX}_wait`,
    description:
      "Wait for a condition: time (ms), element to appear, text to appear/disappear, or page load state.",
    inputSchema: {
      type: "object" as const,
      properties: {
        timeout: { type: "number", description: "Wait this many milliseconds" },
        selector: {
          type: "string",
          description: "Wait for this element to appear",
        },
        text: {
          type: "string",
          description: "Wait for this text to appear on page",
        },
        textGone: {
          type: "string",
          description: "Wait for this text to disappear from page",
        },
        state: {
          type: "string",
          enum: ["load", "domcontentloaded", "networkidle"],
          description: "Wait for page load state",
        },
      },
    },
  },
  // --- 高级 ---
  {
    name: `${TOOL_PREFIX}_evaluate`,
    description:
      "Execute JavaScript code in the browser page context. Returns the evaluation result.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description: "JavaScript code to execute. Can use 'return' to return a value.",
        },
      },
      required: ["code"],
    },
  },
  {
    name: `${TOOL_PREFIX}_upload`,
    description: "Upload file(s) to a file input element.",
    inputSchema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "File input selector: ref_N or CSS selector",
        },
        files: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
          description: "File path(s) to upload",
        },
      },
      required: ["selector", "files"],
    },
  },
  // --- Session/Cookie 管理 ---
  {
    name: `${TOOL_PREFIX}_cookie_list`,
    description: "List all browser cookies, grouped by domain.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "Optional: only show cookies for this URL",
        },
      },
    },
  },
  {
    name: `${TOOL_PREFIX}_cookie_clear`,
    description: "Clear cookies. Optionally specify a domain to clear only that domain's cookies.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          description: "Optional: only clear cookies for this domain",
        },
      },
    },
  },
  {
    name: `${TOOL_PREFIX}_session_save`,
    description: "Save the current browser session (cookies + storage) with a name for later use.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Session name, e.g. 'google', 'chatgpt'",
        },
      },
      required: ["name"],
    },
  },
  {
    name: `${TOOL_PREFIX}_session_load`,
    description: "Load a previously saved browser session by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Session name to load" },
      },
      required: ["name"],
    },
  },
  {
    name: `${TOOL_PREFIX}_session_list`,
    description: "List all saved session names.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: `${TOOL_PREFIX}_session_export`,
    description: "Export current session to a JSON file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path to save session JSON" },
      },
      required: ["path"],
    },
  },
  {
    name: `${TOOL_PREFIX}_session_import`,
    description: "Import session from a JSON file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Path to session JSON file" },
      },
      required: ["path"],
    },
  },
]

// ===== Tool Handler =====

async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  // Strip prefix
  const action = name.replace(`${TOOL_PREFIX}_`, "")

  switch (action) {
    // --- Core ---
    case "goto": {
      const result = await browserGoto(args.url as string)
      return JSON.stringify(result)
    }
    case "click": {
      const result = await browserClick(args.selector as string)
      return JSON.stringify(result)
    }
    case "type": {
      const result = await browserType(
        args.selector as string,
        args.text as string
      )
      return JSON.stringify(result)
    }
    case "press": {
      const result = await browserPress(args.key as string)
      return JSON.stringify(result)
    }
    case "snapshot": {
      const result = await browserSnapshot(args.maxTextLen as number | undefined)
      return [
        `URL: ${result.url}`,
        `Title: ${result.title}`,
        "",
        "=== Page Text ===",
        result.text,
        "",
        "=== Interactive Elements ===",
        result.elements || "(no interactive elements found)",
        "",
        `Screenshot: [base64, ${result.screenshot?.length || 0} chars]`,
      ].join("\n")
    }
    case "screenshot": {
      const buffer = await browserScreenshot()
      return buffer.toString("base64")
    }

    // --- Navigation ---
    case "back": {
      const result = await browserBack()
      return JSON.stringify(result)
    }
    case "forward": {
      const result = await browserForward()
      return JSON.stringify(result)
    }
    case "reload": {
      const result = await browserReload()
      return JSON.stringify(result)
    }

    // --- Interaction ---
    case "hover": {
      const result = await browserHover(args.selector as string)
      return JSON.stringify(result)
    }
    case "select": {
      const result = await browserSelect(
        args.selector as string,
        args.values as string | string[]
      )
      return JSON.stringify(result)
    }
    case "scroll": {
      const result = await browserScroll({
        direction: args.direction as "up" | "down" | "left" | "right" | undefined,
        distance: args.distance as number | undefined,
        selector: args.selector as string | undefined,
        toTop: args.toTop as boolean | undefined,
        toBottom: args.toBottom as boolean | undefined,
      })
      return JSON.stringify(result)
    }
    case "wait": {
      const result = await browserWait({
        timeout: args.timeout as number | undefined,
        selector: args.selector as string | undefined,
        text: args.text as string | undefined,
        textGone: args.textGone as string | undefined,
        state: args.state as "load" | "domcontentloaded" | "networkidle" | undefined,
      })
      return JSON.stringify(result)
    }

    // --- Advanced ---
    case "evaluate": {
      const result = await browserEvaluate(args.code as string)
      return JSON.stringify(result)
    }
    case "upload": {
      const result = await browserUpload(
        args.selector as string,
        args.files as string | string[]
      )
      return JSON.stringify(result)
    }

    // --- Session/Cookie ---
    case "cookie_list": {
      const result = await getCookiesFormatted(args.url as string | undefined)
      return JSON.stringify(result, null, 2)
    }
    case "cookie_clear": {
      const domain = args.domain as string | undefined
      if (domain) {
        const removed = await clearCookiesForDomain(domain)
        return `Cleared ${removed} cookies for domain: ${domain}`
      }
      await clearCookies()
      return "All cookies cleared"
    }
    case "session_save": {
      const filePath = await saveSession(args.name as string)
      return `Session saved as "${args.name}" at ${filePath}`
    }
    case "session_load": {
      const result = await loadSession(args.name as string)
      return `Session "${args.name}" loaded: ${result.cookiesImported} cookies, ${result.localStorageKeys} localStorage keys`
    }
    case "session_list": {
      const sessions = listSessions()
      return sessions.length > 0
        ? `Saved sessions: ${sessions.join(", ")}`
        : "No saved sessions"
    }
    case "session_export": {
      const sessionData = await exportSession(args.path as string)
      return `Session exported to ${args.path}: ${sessionData.cookies.length} cookies`
    }
    case "session_import": {
      const result = await importSession(args.path as string)
      return `Session imported: ${result.cookiesImported} cookies, ${result.localStorageKeys} localStorage keys`
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

// ===== Server Factory =====

export interface PlaywrightServerOptions {
  /** Browser config overrides */
  browserConfig?: Partial<BrowserConfig>
  /** Server name */
  name?: string
  /** Server version */
  version?: string
}

/**
 * Create a Playwright MCP Server instance.
 * Can be used programmatically (e.g. embedded in AgentServer) or standalone.
 */
export function createPlaywrightServer(
  options: PlaywrightServerOptions = {}
): Server {
  const {
    name = "agent-runtime-playwright",
    version = "0.2.0",
  } = options

  if (options.browserConfig) {
    setBrowserConfig(options.browserConfig)
  }

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
      // Lazy init browser on first tool call
      await initBrowser()

      const result = await handleToolCall(toolName, args ?? {})

      // For snapshot, include image content block
      if (toolName === `${TOOL_PREFIX}_snapshot`) {
        return {
          content: [{ type: "text", text: result }],
        }
      }

      // For screenshot, return as image
      if (toolName === `${TOOL_PREFIX}_screenshot`) {
        return {
          content: [
            {
              type: "image",
              data: result,
              mimeType: "image/png",
            },
          ],
        }
      }

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

  return server
}

/**
 * Get the list of tool definitions (for external use, e.g. skill definitions).
 */
export function getToolDefinitions() {
  return TOOLS
}

// ===== Standalone Entry Point =====

async function main() {
  logger.info("Starting Playwright MCP Server (stdio)...")

  const server = createPlaywrightServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)

  logger.info("Playwright MCP Server started")

  // Graceful shutdown
  const cleanup = async () => {
    logger.info("Shutting down...")
    await closeBrowser()
    process.exit(0)
  }
  process.on("SIGTERM", cleanup)
  process.on("SIGINT", cleanup)
}

// Run standalone if executed directly
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("playwright-server.js")

if (isMain) {
  main().catch((err) => {
    logger.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
