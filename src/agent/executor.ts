/**
 * Tool Executor
 * 执行 Agent 的工具调用
 */

import {
  browserGoto,
  browserClick,
  browserType,
  browserPress,
  browserSnapshot,
  runCode,
  fileRead,
  fileWrite,
  fileList
} from "../runtime/index.js"

export interface ToolResult {
  success: boolean
  output: string
}

/**
 * 执行单个工具调用
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    const output = await executeToolInternal(name, args)
    return { success: true, output }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, output: `Error: ${message}` }
  }
}

async function executeToolInternal(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    // 浏览器操作
    case "browser_goto": {
      const result = await browserGoto(args.url as string)
      return `打开页面成功\nURL: ${result.url}\nTitle: ${result.title}`
    }

    case "browser_click": {
      const result = await browserClick(args.selector as string)
      return `点击成功\nURL: ${result.url}\nTitle: ${result.title}\n导航: ${result.navigated ? "是" : "否"}`
    }

    case "browser_type": {
      const result = await browserType(args.selector as string, args.text as string)
      return `输入成功\nURL: ${result.url}\nTitle: ${result.title}`
    }

    case "browser_press": {
      const result = await browserPress(args.key as string)
      return `按键 ${args.key} 成功\nURL: ${result.url}\nTitle: ${result.title}`
    }

    case "browser_snapshot": {
      const result = await browserSnapshot(args.maxTextLen as number | undefined)
      return [
        `URL: ${result.url}`,
        `Title: ${result.title}`,
        "",
        "=== 页面文本 ===",
        result.text,
        "",
        "=== 可交互元素 ===",
        result.elements || "(无)",
      ].join("\n")
    }

    // 代码执行
    case "code_run": {
      const result = await runCode(
        args.language as "python" | "shell",
        args.code as string
      )
      return [
        `退出码: ${result.exitCode}`,
        `耗时: ${result.duration}ms`,
        result.killed ? "(进程超时被终止)" : "",
        "",
        "=== stdout ===",
        result.stdout || "(空)",
        "",
        "=== stderr ===",
        result.stderr || "(空)"
      ].filter(Boolean).join("\n")
    }

    // 文件操作
    case "file_read": {
      const result = await fileRead(args.path as string)
      return `文件: ${args.path} (${result.size} bytes)\n\n${result.content}`
    }

    case "file_write": {
      await fileWrite(args.path as string, args.content as string)
      return `文件写入成功: ${args.path}`
    }

    case "file_list": {
      const result = await fileList(args.path as string | undefined)
      const lines = result.items.map(item =>
        item.type === "directory" ? `📁 ${item.name}/` : `📄 ${item.name}`
      )
      return `目录: ${args.path || "."}\n\n${lines.join("\n") || "(空目录)"}`
    }

    default:
      throw new Error(`未知工具: ${name}`)
  }
}
