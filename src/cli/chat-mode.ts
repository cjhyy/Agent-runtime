/**
 * Chat 交互模式
 */

import * as readline from "node:readline"
import { createAgent, type Agent } from "../agent/index.js"
import {
  setBrowserConfig,
  initBrowser,
  launchLoginMode,
  getCookiesFormatted,
  listSessions,
} from "../runtime/index.js"
import { VERSION } from "../constants.js"
import { colors, print, printHeader, printSeparator } from "./colors.js"
import { getBoolEnv, getEnv } from "./env.js"

/** 命令上下文 */
interface CommandContext {
  verbose: boolean
  setVerbose: (v: boolean) => void
}

/** 配置浏览器 */
function configureBrowser(): void {
  const headless = getBoolEnv("BROWSER_HEADLESS", true)
  const useProfile = getBoolEnv("BROWSER_USE_PROFILE", true)
  const profilePath = getEnv("BROWSER_PROFILE_PATH", "")

  setBrowserConfig({
    headless,
    useProfile,
    profilePath: profilePath || undefined,
  })

  if (useProfile) {
    console.error("[Config] Browser: using persistent profile")
  }
}

/** 打印 Chat 模式头部 */
function printChatHeader(): void {
  printHeader(`Agent Runtime CLI v${VERSION}`)
  print("Commands:", "dim")
  print("  /help        - 显示帮助", "dim")
  print("  /login [url] - 登录网站保存 Cookie", "dim")
  print("  /cookies     - 查看 Cookie", "dim")
  print("  /model       - 切换模型", "dim")
  print("  /clear       - 清屏", "dim")
  print("  /exit        - 退出", "dim")
  console.log()
}

/** 在 Chat 中登录 */
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
  printSeparator()
  print("📊 登录状态报告", "cyan")
  printSeparator()
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
  const urlHost = new URL(targetUrl).hostname.split(".").slice(-2).join(".")
  const relatedCookies = Object.entries(saved.byDomain).filter(([domain]) =>
    domain.includes(urlHost)
  )

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

/** 在 Chat 中显示 Cookie */
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

/** 在 Chat 中显示 Sessions */
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

/** 处理 Chat 命令 */
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

/** 运行 Chat 模式 */
export async function runChatMode(): Promise<void> {
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
    output: process.stdout,
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
        await handleChatCommand(trimmed, agent, rl, {
          verbose,
          setVerbose: (v) => {
            verbose = v
          },
        })
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
