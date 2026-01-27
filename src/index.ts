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
  browserSnapshot
} from "./browser.js"
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

  throw new Error(`Unknown tool: ${name}`)
}

function formatResult(tool: string, data: unknown): string {
  return `${tool} OK\n${JSON.stringify(data, null, 2)}`
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
