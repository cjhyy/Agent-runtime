/**
 * Tool Executor
 * 执行 Agent 的工具调用
 */

import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import {
  browserGoto,
  browserClick,
  browserType,
  browserPress,
  browserSnapshot,
  launchLoginMode,
  getCookiesFormatted,
  initBrowser,
  closeBrowser,
  runCode,
  fileRead,
  fileWrite,
  fileList,
  // 新增浏览器操作
  browserWait,
  browserScroll,
  browserHover,
  browserSelect,
  browserBack,
  browserForward,
  browserReload,
  browserEvaluate,
  browserUpload,
  browserTabs,
  browserDialog,
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
      const result = await browserSnapshot(args.maxTextLen as number)
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

    // 新增浏览器操作
    case "browser_wait": {
      const result = await browserWait({
        timeout: args.timeout as number | undefined,
        selector: args.selector as string | undefined,
        text: args.text as string | undefined,
        textGone: args.textGone as string | undefined,
        state: args.state as "load" | "domcontentloaded" | "networkidle" | undefined,
      })
      return `等待完成: ${result.waited}\nURL: ${result.url}\nTitle: ${result.title}`
    }

    case "browser_scroll": {
      const result = await browserScroll({
        direction: args.direction as "up" | "down" | "left" | "right" | undefined,
        distance: args.distance as number | undefined,
        selector: args.selector as string | undefined,
        toTop: args.toTop as boolean | undefined,
        toBottom: args.toBottom as boolean | undefined,
      })
      return `滚动完成\n位置: (${result.scrolledTo.x}, ${result.scrolledTo.y})\nURL: ${result.url}\nTitle: ${result.title}`
    }

    case "browser_hover": {
      const result = await browserHover(args.selector as string)
      return `悬停成功: ${args.selector}\nURL: ${result.url}\nTitle: ${result.title}`
    }

    case "browser_select": {
      const values = args.values || (args.value ? [args.value as string] : [])
      const result = await browserSelect(args.selector as string, values as string[])
      return `选择成功: ${result.selected.join(", ")}\nURL: ${result.url}\nTitle: ${result.title}`
    }

    case "browser_back": {
      const result = await browserBack()
      return `返回${result.navigated ? "成功" : "（无历史）"}\nURL: ${result.url}\nTitle: ${result.title}`
    }

    case "browser_forward": {
      const result = await browserForward()
      return `前进${result.navigated ? "成功" : "（无历史）"}\nURL: ${result.url}\nTitle: ${result.title}`
    }

    case "browser_reload": {
      const result = await browserReload()
      return `刷新成功\nURL: ${result.url}\nTitle: ${result.title}`
    }

    case "browser_evaluate": {
      const result = await browserEvaluate(args.code as string)
      const output = result.result !== undefined
        ? JSON.stringify(result.result, null, 2)
        : "(无返回值)"
      return `执行完成\n结果: ${output}\nURL: ${result.url}\nTitle: ${result.title}`
    }

    case "browser_upload": {
      const result = await browserUpload(
        args.selector as string,
        args.files as string[]
      )
      return `上传成功: ${result.uploaded.join(", ")}\nURL: ${result.url}\nTitle: ${result.title}`
    }

    case "browser_tabs": {
      const result = await browserTabs(
        args.action as "list" | "new" | "close" | "switch",
        { index: args.index as number | undefined, url: args.url as string | undefined }
      )
      const tabList = result.tabs
        .map(t => `${t.active ? "→ " : "  "}[${t.index}] ${t.title || "(无标题)"} - ${t.url}`)
        .join("\n")
      return `标签页 (${result.tabs.length} 个):\n${tabList}`
    }

    case "browser_dialog": {
      const result = await browserDialog(
        args.accept as boolean,
        args.promptText as string | undefined
      )
      if (!result.handled) {
        return "当前没有待处理的弹窗"
      }
      return `弹窗已处理\n类型: ${result.dialogType}\n消息: ${result.message}`
    }

    case "browser_login": {
      const url = args.url as string
      console.log(`\n🔐 正在打开浏览器登录: ${url}`)
      console.log("请在浏览器中完成登录，完成后关闭浏览器窗口。\n")

      // 先关闭当前浏览器实例
      await closeBrowser()

      // 执行登录
      const result = await launchLoginMode(url)

      // 重新初始化浏览器以使用新的 Cookie
      await initBrowser()

      // 验证保存的 Cookie
      const savedCookies = await getCookiesFormatted()
      const urlHost = new URL(url).hostname.split('.').slice(-2).join('.')
      const relatedCookies = Object.entries(savedCookies.byDomain)
        .filter(([domain]) => domain.includes(urlHost))

      if (relatedCookies.length > 0) {
        const domains = relatedCookies
          .map(([domain, cookies]) => `  ✓ ${domain}: ${cookies.length} cookies`)
          .join("\n")
        return `✅ 登录成功！\n\n${url} 相关 Cookie:\n${domains}\n\n登录状态已保存，后续访问将自动使用。`
      } else if (result.cookieCount > 0) {
        const domains = Object.entries(result.cookiesByDomain)
          .map(([domain, count]) => `  - ${domain}: ${count} cookies`)
          .join("\n")
        return `✅ 已保存 ${result.cookieCount} 个 Cookie\n\n按域名统计:\n${domains}`
      } else {
        return `⚠️ 未检测到新的 Cookie。可能原因：\n- 浏览器关闭太快\n- 已经处于登录状态\n- 网站使用其他方式存储登录态\n\n请使用 cookie_list 工具检查当前保存的 Cookie。`
      }
    }

    case "cookie_list": {
      const result = await getCookiesFormatted()
      if (result.total === 0) {
        return "当前没有保存任何 Cookie。请使用 browser_login 工具登录网站。"
      }

      const lines = [`共保存 ${result.total} 个 Cookie:\n`]
      for (const [domain, cookies] of Object.entries(result.byDomain)) {
        lines.push(`📍 ${domain} (${cookies.length} cookies)`)
        for (const c of cookies.slice(0, 3)) {  // 每个域名只显示前3个
          lines.push(`   - ${c.name}: ${c.value.slice(0, 30)}${c.value.length > 30 ? "..." : ""}`)
        }
        if (cookies.length > 3) {
          lines.push(`   ... 还有 ${cookies.length - 3} 个`)
        }
      }
      return lines.join("\n")
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

    case "claude_code": {
      const prompt = args.prompt as string
      const workdir = (args.workdir as string | undefined) || "./workspace"
      const allowedTools = args.allowedTools as string | undefined

      console.log(`\n${"=".repeat(50)}`)
      console.log(`🤖 Claude Code 开始执行`)
      console.log(`${"=".repeat(50)}`)
      console.log(`📝 任务: ${prompt.slice(0, 100)}${prompt.length > 100 ? "..." : ""}`)
      console.log(`📁 工作目录: ${path.resolve(workdir)}`)
      console.log(`${"=".repeat(50)}\n`)

      const result = await executeClaudeCode(prompt, workdir, allowedTools)
      return result
    }

    default:
      throw new Error(`未知工具: ${name}`)
  }
}

/**
 * 执行 Claude Code CLI
 */
async function executeClaudeCode(
  prompt: string,
  workdir?: string,
  allowedTools?: string
): Promise<string> {
  return new Promise((resolve) => {
    const args = [
      "-p",  // 非交互模式
      "--dangerously-skip-permissions",  // 跳过权限确认，允许自动执行
      "--output-format", "stream-json",  // 流式 JSON 输出，可以看到实时进度
      "--verbose",  // stream-json 需要 verbose 模式
    ]

    if (allowedTools) {
      args.push("--allowedTools", allowedTools)
    }

    // 添加 prompt
    args.push(prompt)

    const cwd = workdir ? path.resolve(workdir) : path.resolve("./workspace")

    // 确保工作目录存在
    if (!fs.existsSync(cwd)) {
      fs.mkdirSync(cwd, { recursive: true })
    }

    const proc = spawn("claude", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env }
    })

    let fullOutput = ""
    let lastContent = ""

    proc.stdout.on("data", (data) => {
      const text = data.toString()

      // 解析 stream-json 格式，提取实时内容
      const lines = text.split("\n").filter((l: string) => l.trim())
      for (const line of lines) {
        try {
          const json = JSON.parse(line)

          // 显示工具调用
          if (json.type === "tool_use") {
            console.log(`\n🔧 [${json.tool}] ${JSON.stringify(json.input).slice(0, 100)}...`)
          }

          // 显示工具结果
          if (json.type === "tool_result") {
            const preview = (json.content || "").slice(0, 200)
            console.log(`   ✓ ${preview}${json.content?.length > 200 ? "..." : ""}`)
          }

          // 显示文本输出
          if (json.type === "text" && json.content) {
            // 只显示新增的内容
            if (json.content !== lastContent) {
              const newContent = json.content.slice(lastContent.length)
              if (newContent) {
                process.stdout.write(newContent)
              }
              lastContent = json.content
            }
          }

          // 最终结果
          if (json.type === "result") {
            fullOutput = json.result || json.content || ""
          }
        } catch {
          // 非 JSON 行，直接输出
          process.stdout.write(text)
          fullOutput += text
        }
      }
    })

    proc.stderr.on("data", (data) => {
      const text = data.toString()
      // 过滤掉一些噪音
      if (!text.includes("Debugger") && !text.includes("node --inspect")) {
        process.stderr.write(`⚠️ ${text}`)
      }
    })

    proc.on("close", (code) => {
      console.log(`\n${"=".repeat(50)}`)
      console.log(`✅ Claude Code 执行完成 (exit code: ${code})`)
      console.log(`${"=".repeat(50)}\n`)

      if (code === 0) {
        resolve(`Claude Code 执行成功！\n\n${fullOutput || lastContent || "(任务已完成)"}`)
      } else {
        resolve(`Claude Code 执行完成 (exit code: ${code})\n\n${fullOutput || lastContent}`)
      }
    })

    proc.on("error", (err) => {
      resolve(`Claude Code 执行失败: ${err.message}\n\n请确保已安装 Claude Code CLI:\n  npm install -g @anthropic-ai/claude-code`)
    })

    // 超时处理 (10分钟)
    setTimeout(() => {
      proc.kill()
      resolve(`Claude Code 执行超时 (10分钟)\n\n已完成部分:\n${fullOutput || lastContent}`)
    }, 10 * 60 * 1000)
  })
}
