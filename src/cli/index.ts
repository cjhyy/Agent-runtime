#!/usr/bin/env node
/**
 * Agent Runtime CLI
 * 统一命令行入口
 */

import * as fs from "node:fs"
import * as path from "node:path"
import * as readline from "node:readline"
import { createAgent, type Agent } from "../agent/index.js"
import {
  setBrowserConfig,
  initBrowser,
  closeBrowser,
  launchLoginMode,
  getCookiesFormatted,
  clearCookies,
  clearCookiesForDomain,
  exportSession,
  importSession,
  saveSession,
  loadSession,
  listSessions,
  deleteSession
} from "../runtime/index.js"

// 加载 .env 文件
function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env")
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=")
        const value = valueParts.join("=")
        if (key && value && !process.env[key]) {
          process.env[key] = value
        }
      }
    }
  }
}

loadEnv()

// ANSI 颜色
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m"
}

function print(text: string, color?: keyof typeof colors): void {
  if (color) {
    console.log(`${colors[color]}${text}${colors.reset}`)
  } else {
    console.log(text)
  }
}

// ===== 主入口 =====
const command = process.argv[2]
const args = process.argv.slice(3)

async function main(): Promise<void> {
  switch (command) {
    case "chat":
    case undefined:
      await runChatMode()
      break

    case "login":
      await runLoginMode(args[0])
      break

    case "cookies":
      await runCookiesMode(args)
      break

    case "help":
    case "--help":
    case "-h":
      showMainHelp()
      break

    case "version":
    case "--version":
    case "-v":
      console.log("agent-runtime v0.2.0")
      break

    default:
      print(`Unknown command: ${command}`, "red")
      showMainHelp()
      process.exit(1)
  }
}

function showMainHelp(): void {
  console.log(`
${colors.cyan}Agent Runtime CLI${colors.reset} - LLM Agent with Browser Automation

${colors.bright}Usage:${colors.reset}
  agent-runtime [command] [options]

${colors.bright}Commands:${colors.reset}
  chat              启动交互式对话模式 (默认)
  login [url]       打开浏览器进行登录，保存登录状态
  cookies <cmd>     Cookie 和 Session 管理

${colors.bright}Examples:${colors.reset}
  agent-runtime                     # 启动对话
  agent-runtime chat                # 同上
  agent-runtime login               # 登录 Google
  agent-runtime login https://chatgpt.com
  agent-runtime cookies list        # 查看 Cookie
  agent-runtime cookies --help      # Cookie 帮助

${colors.bright}Environment:${colors.reset}
  OPENROUTER_API_KEY    OpenRouter API Key (required for chat)
  BROWSER_HEADLESS      是否无头模式 (default: true)
  BROWSER_USE_PROFILE   是否使用持久化配置 (default: true)
`)
}

// ===== Chat Mode =====
async function runChatMode(): Promise<void> {
  // 检查 API Key
  if (!process.env.OPENROUTER_API_KEY) {
    print("Error: OPENROUTER_API_KEY 环境变量未设置", "yellow")
    print("请设置: export OPENROUTER_API_KEY=your_api_key", "dim")
    process.exit(1)
  }

  configureBrowser()
  printChatHeader()

  let verbose = false
  const agent = createAgent({ verbose })

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const prompt = (): void => {
    rl.question(`${colors.green}You: ${colors.reset}`, async (input) => {
      const trimmed = input.trim()

      if (!trimmed) {
        prompt()
        return
      }

      // 处理命令
      if (trimmed.startsWith("/")) {
        await handleChatCommand(trimmed, agent, rl, { verbose, setVerbose: (v) => { verbose = v } })
        prompt()
        return
      }

      // 运行 Agent
      try {
        print("\nThinking...", "dim")
        const startTime = Date.now()
        const result = await agent.run(trimmed)
        const duration = ((Date.now() - startTime) / 1000).toFixed(1)

        if (result.toolCalls.length > 0) {
          print(`\n[Used ${result.toolCalls.length} tools in ${result.iterations} iterations]`, "dim")
        }

        console.log()
        print(`Agent: ${result.response}`, "cyan")
        print(`\n(${duration}s)`, "dim")
        console.log()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        print(`Error: ${message}`, "yellow")
        console.log()
      }

      prompt()
    })
  }

  rl.on("close", async () => {
    print("\nGoodbye!", "cyan")
    await agent.close()
    process.exit(0)
  })

  prompt()
}

function configureBrowser(): void {
  const headless = process.env.BROWSER_HEADLESS !== "false"
  const useProfile = process.env.BROWSER_USE_PROFILE !== "false"
  const profilePath = process.env.BROWSER_PROFILE_PATH || undefined

  setBrowserConfig({ headless, useProfile, profilePath })

  if (useProfile) {
    console.error("[Config] Browser: using persistent profile")
  }
}

function printChatHeader(): void {
  console.log()
  print("╔═══════════════════════════════════════╗", "cyan")
  print("║       Agent Runtime CLI v0.2.0        ║", "cyan")
  print("╚═══════════════════════════════════════╝", "cyan")
  console.log()
  print("Commands:", "dim")
  print("  /help        - 显示帮助", "dim")
  print("  /login [url] - 登录网站保存 Cookie", "dim")
  print("  /cookies     - 查看 Cookie", "dim")
  print("  /model       - 切换模型", "dim")
  print("  /clear       - 清屏", "dim")
  print("  /exit        - 退出", "dim")
  console.log()
}

interface CommandContext {
  verbose: boolean
  setVerbose: (v: boolean) => void
}

async function handleChatCommand(
  cmd: string,
  agent: Agent,
  rl: readline.Interface,
  ctx: CommandContext
): Promise<void> {
  const [command, ...cmdArgs] = cmd.slice(1).split(" ")

  switch (command) {
    case "help":
      print("\n可用命令:", "cyan")
      print("  /help              - 显示此帮助")
      print("  /login [url]       - 打开浏览器登录网站")
      print("  /cookies           - 查看当前 Cookie")
      print("  /sessions          - 查看保存的 Session")
      print("  /model <name>      - 切换模型")
      print("  /verbose           - 切换详细模式 (当前: " + (ctx.verbose ? "开" : "关") + ")")
      print("  /clear             - 清屏")
      print("  /exit              - 退出")
      print("\n可用模型:", "cyan")
      print("  anthropic/claude-sonnet-4")
      print("  openai/gpt-4o")
      print("  google/gemini-2.0-flash-001")
      print("\n登录示例:", "cyan")
      print("  /login                     - 登录 Google")
      print("  /login https://github.com  - 登录 GitHub")
      console.log()
      break

    case "login":
      await loginInChat(cmdArgs[0], agent)
      break

    case "cookies":
      await showCookiesInChat()
      break

    case "sessions":
      showSessionsInChat()
      break

    case "model":
      if (cmdArgs.length === 0) {
        print("用法: /model <model_name>", "yellow")
      } else {
        agent.setModel(cmdArgs[0])
        print(`模型已切换为: ${cmdArgs[0]}`, "green")
      }
      console.log()
      break

    case "verbose":
      ctx.setVerbose(!ctx.verbose)
      print(`详细模式: ${ctx.verbose ? "开启" : "关闭"}`, "green")
      console.log()
      break

    case "clear":
      console.clear()
      printChatHeader()
      break

    case "exit":
    case "quit":
      rl.close()
      break

    default:
      print(`未知命令: ${command}`, "yellow")
      print("输入 /help 查看可用命令", "dim")
      console.log()
  }
}

async function loginInChat(url: string | undefined, agent: Agent): Promise<void> {
  const targetUrl = url || "https://www.google.com"

  print(`\n🔐 正在打开浏览器登录: ${targetUrl}`, "cyan")
  print("请在浏览器中完成登录，完成后关闭浏览器窗口。\n", "dim")

  // 先关闭当前 agent 的浏览器
  await agent.close()

  // 运行登录流程
  const result = await launchLoginMode(targetUrl)

  // 显示结果
  console.log()
  print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "dim")
  print("📊 登录状态报告", "cyan")
  print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "dim")
  console.log()

  if (result.cookieCount > 0) {
    print(`✅ 已保存 ${result.cookieCount} 个 Cookie`, "green")
    for (const [domain, count] of Object.entries(result.cookiesByDomain)) {
      print(`   📍 ${domain}: ${count}`, "dim")
    }
  } else {
    print("⚠️  未检测到新 Cookie（可能浏览器关闭太快）", "yellow")
  }

  // 重新验证
  print("\n🔍 验证登录状态...", "dim")
  await initBrowser()

  const saved = await getCookiesFormatted()
  const urlHost = new URL(targetUrl).hostname.split('.').slice(-2).join('.')
  const relatedCookies = Object.entries(saved.byDomain)
    .filter(([domain]) => domain.includes(urlHost))

  if (relatedCookies.length > 0) {
    print(`✅ ${targetUrl} 相关 Cookie:`, "green")
    for (const [domain, cookies] of relatedCookies) {
      print(`   ✓ ${domain}: ${cookies.length} cookies`, "green")
    }
  } else {
    print(`❌ 未找到 ${targetUrl} 相关的 Cookie`, "red")
    print("   请重新登录并确保登录成功后再关闭浏览器", "dim")
  }

  console.log()
}

async function showCookiesInChat(): Promise<void> {
  try {
    const result = await getCookiesFormatted()
    if (result.total === 0) {
      print("\nNo cookies found.", "dim")
      print("Tip: 使用 /login <url> 登录网站\n", "dim")
      return
    }

    print(`\n🍪 Cookies (${result.total}):`, "cyan")
    for (const [domain, cookies] of Object.entries(result.byDomain)) {
      print(`  ${domain}: ${cookies.length} cookies`, "dim")
    }
    print("\n使用 /cookies list 或 'npm run cookies' 查看详情\n", "dim")
  } catch {
    print("\nBrowser not initialized yet.\n", "dim")
  }
}

function showSessionsInChat(): void {
  const sessions = listSessions()
  if (sessions.length === 0) {
    print("\nNo saved sessions.", "dim")
    print("Tip: 使用 'agent-runtime cookies save <name>' 保存\n", "dim")
    return
  }
  print(`\n📂 Saved Sessions (${sessions.length}):`, "cyan")
  for (const s of sessions) {
    print(`  • ${s}`, "dim")
  }
  console.log()
}

// ===== Login Mode =====
async function runLoginMode(url?: string): Promise<void> {
  const targetUrl = url || "https://www.google.com"

  console.log()
  print("╔═══════════════════════════════════════╗", "cyan")
  print("║         Browser Login Tool            ║", "cyan")
  print("╚═══════════════════════════════════════╝", "cyan")
  console.log()

  const result = await launchLoginMode(targetUrl)

  // 显示登录结果
  console.log()
  print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "dim")
  print("📊 登录状态报告", "cyan")
  print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "dim")
  console.log()

  if (result.cookieCount > 0) {
    print(`✅ 登录成功！已保存 ${result.cookieCount} 个 Cookie`, "green")
    console.log()
    print("按域名统计:", "bright")
    for (const [domain, count] of Object.entries(result.cookiesByDomain)) {
      print(`  📍 ${domain}: ${count} cookies`, "dim")
    }
  } else {
    print("⚠️  未检测到新的 Cookie", "yellow")
    print("   可能原因:", "dim")
    print("   - 浏览器关闭太快，Cookie 未保存", "dim")
    print("   - 已经处于登录状态", "dim")
    print("   - 网站使用其他方式存储登录态", "dim")
  }

  console.log()
  print("💡 提示: 使用以下命令查看完整 Cookie 列表:", "dim")
  print("   npm run cookies", "cyan")
  console.log()

  // 验证：重新打开浏览器读取实际保存的 Cookie
  print("🔍 正在验证保存的登录状态...", "dim")
  setBrowserConfig({ headless: true, useProfile: true })
  await initBrowser()

  try {
    const saved = await getCookiesFormatted()
    console.log()
    if (saved.total > 0) {
      print(`✅ 验证成功！共保存 ${saved.total} 个 Cookie`, "green")
      console.log()
      print("已保存的域名:", "bright")
      for (const [domain, cookies] of Object.entries(saved.byDomain)) {
        // 高亮显示与目标 URL 相关的域名
        const urlHost = new URL(targetUrl).hostname
        const isRelated = domain.includes(urlHost.split('.').slice(-2).join('.'))
        if (isRelated) {
          print(`  ✓ ${domain}: ${cookies.length} cookies`, "green")
        } else {
          print(`    ${domain}: ${cookies.length} cookies`, "dim")
        }
      }
    } else {
      print("❌ 验证失败：没有找到保存的 Cookie", "red")
      print("   请重新运行登录命令并确保完成登录后再关闭浏览器", "dim")
    }
  } finally {
    await closeBrowser()
  }

  console.log()
}

// ===== Cookies Mode =====
async function runCookiesMode(cmdArgs: string[]): Promise<void> {
  const subCmd = cmdArgs[0]
  const subArg = cmdArgs[1]

  // 初始化浏览器
  setBrowserConfig({ headless: true, useProfile: true })
  await initBrowser()

  try {
    switch (subCmd) {
      case "list":
      case undefined:
        await cookiesList(subArg)
        break

      case "clear":
        await cookiesClear(subArg)
        break

      case "export":
        if (!subArg) {
          print("Usage: agent-runtime cookies export <path>", "red")
          process.exit(1)
        }
        await cookiesExport(subArg)
        break

      case "import":
        if (!subArg) {
          print("Usage: agent-runtime cookies import <path>", "red")
          process.exit(1)
        }
        await cookiesImport(subArg)
        break

      case "sessions":
        cookiesSessionsList()
        break

      case "save":
        if (!subArg) {
          print("Usage: agent-runtime cookies save <name>", "red")
          process.exit(1)
        }
        await cookiesSave(subArg)
        break

      case "load":
        if (!subArg) {
          print("Usage: agent-runtime cookies load <name>", "red")
          process.exit(1)
        }
        await cookiesLoad(subArg)
        break

      case "delete":
        if (!subArg) {
          print("Usage: agent-runtime cookies delete <name>", "red")
          process.exit(1)
        }
        cookiesDelete(subArg)
        break

      case "help":
      case "--help":
      case "-h":
        showCookiesHelp()
        break

      default:
        print(`Unknown cookies command: ${subCmd}`, "red")
        showCookiesHelp()
        process.exit(1)
    }
  } finally {
    await closeBrowser()
  }
}

function showCookiesHelp(): void {
  console.log(`
${colors.cyan}🍪 Cookie Manager${colors.reset} - 管理浏览器 Cookie 和登录状态

${colors.bright}Usage:${colors.reset}
  agent-runtime cookies <command> [options]

${colors.bright}Commands:${colors.reset}
  list [url]       查看所有 Cookie（可选过滤 URL）
  clear [domain]   清除 Cookie（可选指定域名）
  export <path>    导出 Session 到文件
  import <path>    从文件导入 Session
  sessions         列出所有保存的 Session
  save <name>      保存当前 Session
  load <name>      加载已保存的 Session
  delete <name>    删除保存的 Session

${colors.bright}Examples:${colors.reset}
  agent-runtime cookies                    # 查看所有 Cookie
  agent-runtime cookies list               # 同上
  agent-runtime cookies clear              # 清除所有 Cookie
  agent-runtime cookies clear google.com   # 只清除 google.com 的 Cookie
  agent-runtime cookies export ./backup.json
  agent-runtime cookies import ./backup.json
  agent-runtime cookies save chatgpt       # 保存当前登录态为 "chatgpt"
  agent-runtime cookies load chatgpt       # 加载 "chatgpt" 登录态
  agent-runtime cookies sessions           # 查看所有保存的 Session
`)
}

async function cookiesList(url?: string): Promise<void> {
  console.log()
  print("🍪 Cookie Manager", "cyan")
  console.log()

  const result = await getCookiesFormatted(url)

  if (result.total === 0) {
    print("No cookies found.", "dim")
    print("\nTip: Use 'agent-runtime login <url>' to login first.\n", "dim")
    return
  }

  print(`Total Cookies: ${result.total}\n`, "bright")

  for (const [domain, cookies] of Object.entries(result.byDomain)) {
    console.log()
    print(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, "dim")
    print(`📍 ${domain} (${cookies.length} cookies)`, "cyan")
    print(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, "dim")

    for (const cookie of cookies) {
      const expiry = cookie.expires === -1
        ? "Session"
        : new Date(cookie.expires * 1000).toLocaleString()

      const flags: string[] = []
      if (cookie.httpOnly) flags.push("HttpOnly")
      if (cookie.secure) flags.push("Secure")
      if (cookie.sameSite !== "None") flags.push(`SameSite=${cookie.sameSite}`)

      console.log()
      print(`  📌 ${cookie.name}`, "bright")
      print(`     Value:   ${cookie.value}`, "dim")
      print(`     Path:    ${cookie.path}`, "dim")
      print(`     Expires: ${expiry}`, "dim")
      if (flags.length > 0) {
        print(`     Flags:   ${flags.join(", ")}`, "dim")
      }
    }
  }

  console.log("\n")
}

async function cookiesClear(domain?: string): Promise<void> {
  if (domain) {
    const removed = await clearCookiesForDomain(domain)
    print(`\n✅ Cleared ${removed} cookies for domain: ${domain}\n`, "green")
  } else {
    await clearCookies()
    print("\n✅ All cookies cleared\n", "green")
  }
}

async function cookiesExport(filePath: string): Promise<void> {
  const session = await exportSession(filePath)
  print(`\n✅ Session exported to: ${filePath}`, "green")
  print(`   - Cookies: ${session.cookies.length}`, "dim")
  print(`   - localStorage keys: ${Object.keys(session.localStorage).length}`, "dim")
  print(`   - sessionStorage keys: ${Object.keys(session.sessionStorage).length}\n`, "dim")
}

async function cookiesImport(filePath: string): Promise<void> {
  const result = await importSession(filePath)
  print(`\n✅ Session imported from: ${filePath}`, "green")
  print(`   - Cookies: ${result.cookiesImported}`, "dim")
  print(`   - localStorage keys: ${result.localStorageKeys}`, "dim")
  print(`   - sessionStorage keys: ${result.sessionStorageKeys}\n`, "dim")
}

function cookiesSessionsList(): void {
  const sessions = listSessions()
  console.log()
  print("📂 Saved Sessions", "cyan")
  console.log()

  if (sessions.length === 0) {
    print("No saved sessions.", "dim")
    print("\nTip: Use 'agent-runtime cookies save <name>' to save current session.\n", "dim")
    return
  }

  for (const name of sessions) {
    print(`  • ${name}`, "dim")
  }
  print(`\nTotal: ${sessions.length} sessions\n`, "bright")
}

async function cookiesSave(name: string): Promise<void> {
  const filePath = await saveSession(name)
  print(`\n✅ Session saved as "${name}"`, "green")
  print(`   Path: ${filePath}\n`, "dim")
}

async function cookiesLoad(name: string): Promise<void> {
  const result = await loadSession(name)
  print(`\n✅ Session "${name}" loaded`, "green")
  print(`   - Cookies: ${result.cookiesImported}`, "dim")
  print(`   - localStorage keys: ${result.localStorageKeys}`, "dim")
  print(`   - sessionStorage keys: ${result.sessionStorageKeys}\n`, "dim")
}

function cookiesDelete(name: string): void {
  if (deleteSession(name)) {
    print(`\n✅ Session "${name}" deleted\n`, "green")
  } else {
    print(`\n❌ Session "${name}" not found\n`, "red")
  }
}

// ===== Run =====
main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
