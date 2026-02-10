import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"

import {
  initBrowser,
  closeBrowser,
  browserGoto,
  browserClick,
  browserType,
  browserSnapshot,
  getCookiesFormatted,
  setCookies,
  clearCookies,
  clearCookiesForDomain,
  exportSession,
  importSession,
  saveSession,
  loadSession,
  listSessions
} from "./browser/index.js"
import { runCode } from "./code-executor.js"
import { fileRead, fileWrite, fileList } from "./file-ops.js"

// ===== Tool Definitions =====
const TOOLS = [
  // 浏览器操作
  {
    name: "browser_goto",
    description: "在浏览器中打开指定网页。",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "要打开的 URL" }
      },
      required: ["url"]
    }
  },
  {
    name: "browser_click",
    description: "点击页面上的元素。使用 browser_snapshot 返回的 ref_N 或 CSS 选择器。",
    inputSchema: {
      type: "object" as const,
      properties: {
        selector: { type: "string", description: "元素选择器，如 ref_1 或 CSS 选择器" }
      },
      required: ["selector"]
    }
  },
  {
    name: "browser_type",
    description: "在输入框中输入文字。使用 browser_snapshot 返回的 ref_N 或 CSS 选择器。",
    inputSchema: {
      type: "object" as const,
      properties: {
        selector: { type: "string", description: "输入框选择器，如 ref_1 或 CSS 选择器" },
        text: { type: "string", description: "要输入的文字" }
      },
      required: ["selector", "text"]
    }
  },
  {
    name: "browser_snapshot",
    description: "获取当前页面快照，包括截图、页面文本和可交互元素列表。返回的 elements 包含 ref_N 标识符，可用于 click 和 type 操作。",
    inputSchema: {
      type: "object" as const,
      properties: {
        maxTextLen: { type: "number", description: "页面文本最大长度，默认 5000" }
      }
    }
  },
  // 代码执行
  {
    name: "code_run",
    description: "执行 Python 或 Shell 代码。工作目录为 /workspace。",
    inputSchema: {
      type: "object" as const,
      properties: {
        language: { type: "string", enum: ["python", "shell"], description: "编程语言" },
        code: { type: "string", description: "要执行的代码" }
      },
      required: ["language", "code"]
    }
  },
  // 文件操作
  {
    name: "file_read",
    description: "读取文件内容。路径相对于 /workspace。",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "文件路径，相对于 /workspace" }
      },
      required: ["path"]
    }
  },
  {
    name: "file_write",
    description: "写入文件。路径相对于 /workspace，目录会自动创建。",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "文件路径，相对于 /workspace" },
        content: { type: "string", description: "文件内容" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "file_list",
    description: "列出目录内容。路径相对于 /workspace。",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "目录路径，相对于 /workspace，默认为当前目录" }
      }
    }
  },
  // Cookie 和 Session 管理
  {
    name: "cookie_list",
    description: "获取并展示当前浏览器的所有 Cookie，按域名分组显示。",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "可选，只获取指定 URL 的 Cookie" }
      }
    }
  },
  {
    name: "cookie_clear",
    description: "清除 Cookie。可以清除所有 Cookie 或指定域名的 Cookie。",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: { type: "string", description: "可选，只清除指定域名的 Cookie。不指定则清除所有。" }
      }
    }
  },
  {
    name: "session_export",
    description: "导出当前会话（Cookie + localStorage + sessionStorage）到文件。",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "保存路径，如 ./my-session.json" }
      },
      required: ["path"]
    }
  },
  {
    name: "session_import",
    description: "从文件导入会话数据（Cookie + Storage）。",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Session 文件路径" }
      },
      required: ["path"]
    }
  },
  {
    name: "session_save",
    description: "保存当前会话到用户配置目录，可用名称标识。",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Session 名称，如 google、chatgpt" }
      },
      required: ["name"]
    }
  },
  {
    name: "session_load",
    description: "从用户配置目录加载已保存的会话。",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "要加载的 Session 名称" }
      },
      required: ["name"]
    }
  },
  {
    name: "session_list",
    description: "列出所有已保存的会话名称。",
    inputSchema: {
      type: "object" as const,
      properties: {}
    }
  }
]

// ===== MCP Server =====
const server = new Server(
  { name: "agent-runtime", version: "0.1.0" },
  { capabilities: { tools: {} } }
)

// 注册 tools/list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS }
})

// 注册 tools/call
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    const result = await handleToolCall(name, args ?? {})
    return {
      content: [{ type: "text", text: result }]
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true
    }
  }
})

// ===== Tool Handlers =====
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  // 浏览器操作
  if (name === "browser_goto") {
    const result = await browserGoto(args.url as string)
    return formatResult("browser_goto", result)
  }

  if (name === "browser_click") {
    const result = await browserClick(args.selector as string)
    return formatResult("browser_click", result)
  }

  if (name === "browser_type") {
    const result = await browserType(args.selector as string, args.text as string)
    return formatResult("browser_type", result)
  }

  if (name === "browser_snapshot") {
    const result = await browserSnapshot(args.maxTextLen as number | undefined)

    // 格式化输出，便于 LLM 阅读
    const output = [
      `URL: ${result.url}`,
      `Title: ${result.title}`,
      "",
      "=== Page Text ===",
      result.text,
      "",
      "=== Interactive Elements ===",
      result.elements || "(no elements found)",
      "",
      `Screenshot: [base64 image, ${result.screenshot?.length || 0} chars]`
    ].join("\n")

    return output
  }

  // 代码执行
  if (name === "code_run") {
    const result = await runCode(
      args.language as "python" | "shell",
      args.code as string
    )

    const output = [
      `Exit Code: ${result.exitCode}`,
      `Duration: ${result.duration}ms`,
      result.killed ? "(Process was killed due to timeout)" : "",
      "",
      "=== stdout ===",
      result.stdout || "(empty)",
      "",
      "=== stderr ===",
      result.stderr || "(empty)"
    ].filter(Boolean).join("\n")

    return output
  }

  // 文件操作
  if (name === "file_read") {
    const result = await fileRead(args.path as string)
    return `File: ${args.path} (${result.size} bytes)\n\n${result.content}`
  }

  if (name === "file_write") {
    const result = await fileWrite(args.path as string, args.content as string)
    return formatResult("file_write", result)
  }

  if (name === "file_list") {
    const result = await fileList(args.path as string | undefined)
    const lines = result.items.map((item) =>
      item.type === "directory" ? `${item.name}/` : item.name
    )
    return `Directory: ${args.path || "."}\n\n${lines.join("\n") || "(empty)"}`
  }

  // Cookie 和 Session 管理
  if (name === "cookie_list") {
    const result = await getCookiesFormatted(args.url as string | undefined)
    return formatCookieList(result)
  }

  if (name === "cookie_clear") {
    const domain = args.domain as string | undefined
    if (domain) {
      const removed = await clearCookiesForDomain(domain)
      return `Cleared ${removed} cookies for domain: ${domain}`
    } else {
      await clearCookies()
      return "All cookies cleared"
    }
  }

  if (name === "session_export") {
    const sessionData = await exportSession(args.path as string)
    return `Session exported to: ${args.path}\n- Cookies: ${sessionData.cookies.length}\n- localStorage keys: ${Object.keys(sessionData.localStorage).length}\n- sessionStorage keys: ${Object.keys(sessionData.sessionStorage).length}`
  }

  if (name === "session_import") {
    const result = await importSession(args.path as string)
    return `Session imported from: ${args.path}\n- Cookies: ${result.cookiesImported}\n- localStorage keys: ${result.localStorageKeys}\n- sessionStorage keys: ${result.sessionStorageKeys}`
  }

  if (name === "session_save") {
    const filePath = await saveSession(args.name as string)
    return `Session saved as "${args.name}"\nPath: ${filePath}`
  }

  if (name === "session_load") {
    const result = await loadSession(args.name as string)
    return `Session "${args.name}" loaded\n- Cookies: ${result.cookiesImported}\n- localStorage keys: ${result.localStorageKeys}\n- sessionStorage keys: ${result.sessionStorageKeys}`
  }

  if (name === "session_list") {
    const sessions = listSessions()
    if (sessions.length === 0) {
      return "No saved sessions found"
    }
    return `Saved sessions (${sessions.length}):\n${sessions.map((s: string) => `  - ${s}`).join("\n")}`
  }

  throw new Error(`Unknown tool: ${name}`)
}

function formatResult(tool: string, data: unknown): string {
  return `${tool} OK\n${JSON.stringify(data, null, 2)}`
}

/**
 * 格式化 Cookie 列表，按域名分组展示
 */
function formatCookieList(result: {
  total: number
  byDomain: Record<string, Array<{
    name: string
    value: string
    domain: string
    path: string
    expires: number
    httpOnly: boolean
    secure: boolean
    sameSite: string
  }>>
  list: Array<unknown>
}): string {
  if (result.total === 0) {
    return "No cookies found"
  }

  const lines: string[] = [
    `🍪 Total Cookies: ${result.total}`,
    ""
  ]

  for (const [domain, cookies] of Object.entries(result.byDomain)) {
    lines.push(`━━━ ${domain} (${cookies.length}) ━━━`)

    for (const cookie of cookies) {
      const expiry = cookie.expires === -1
        ? "Session"
        : new Date(cookie.expires * 1000).toLocaleString()

      const flags: string[] = []
      if (cookie.httpOnly) flags.push("HttpOnly")
      if (cookie.secure) flags.push("Secure")
      if (cookie.sameSite !== "None") flags.push(`SameSite=${cookie.sameSite}`)

      lines.push(`  📌 ${cookie.name}`)
      lines.push(`     Value: ${cookie.value}`)
      lines.push(`     Path: ${cookie.path}`)
      lines.push(`     Expires: ${expiry}`)
      if (flags.length > 0) {
        lines.push(`     Flags: ${flags.join(", ")}`)
      }
      lines.push("")
    }
  }

  return lines.join("\n")
}

// ===== Main =====
async function main() {
  // 初始化浏览器
  await initBrowser()

  // 启动 MCP Server
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("[MCP] Agent Runtime server started")

  // 优雅退出
  process.on("SIGTERM", async () => {
    await closeBrowser()
    process.exit(0)
  })
  process.on("SIGINT", async () => {
    await closeBrowser()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error("[MCP] Fatal error:", err)
  process.exit(1)
})
