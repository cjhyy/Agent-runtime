#!/usr/bin/env node
/**
 * Agent Runtime CLI
 * 交互式命令行界面
 */

import * as fs from "node:fs"
import * as path from "node:path"
import * as readline from "node:readline"
import { createAgent, type Agent } from "../agent/index.js"
import { setBrowserConfig } from "../runtime/index.js"

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

// 启动时加载 .env
loadEnv()

// 配置浏览器
function configureBrowser(): void {
  const headless = process.env.BROWSER_HEADLESS !== "false"
  const useProfile = process.env.BROWSER_USE_PROFILE === "true"
  const profilePath = process.env.BROWSER_PROFILE_PATH || undefined

  setBrowserConfig({
    headless,
    useProfile,
    profilePath
  })

  if (useProfile) {
    console.error("[Config] Browser: using real Chrome profile")
  }
}

configureBrowser()

// ANSI 颜色
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
}

function print(text: string, color?: keyof typeof colors): void {
  if (color) {
    console.log(`${colors[color]}${text}${colors.reset}`)
  } else {
    console.log(text)
  }
}

function printHeader(): void {
  console.log()
  print("╔═══════════════════════════════════════╗", "cyan")
  print("║       Agent Runtime CLI v0.1.0        ║", "cyan")
  print("╚═══════════════════════════════════════╝", "cyan")
  console.log()
  print("Commands:", "dim")
  print("  /help     - 显示帮助", "dim")
  print("  /model    - 切换模型", "dim")
  print("  /verbose  - 切换详细模式", "dim")
  print("  /clear    - 清屏", "dim")
  print("  /exit     - 退出", "dim")
  console.log()
}

async function main(): Promise<void> {
  // 检查 API Key
  if (!process.env.OPENROUTER_API_KEY) {
    print("Error: OPENROUTER_API_KEY 环境变量未设置", "yellow")
    print("请设置: export OPENROUTER_API_KEY=your_api_key", "dim")
    process.exit(1)
  }

  printHeader()

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
        await handleCommand(trimmed, agent, rl, { verbose, setVerbose: (v) => { verbose = v } })
        prompt()
        return
      }

      // 运行 Agent
      try {
        print("\nThinking...", "dim")
        const startTime = Date.now()
        const result = await agent.run(trimmed)
        const duration = ((Date.now() - startTime) / 1000).toFixed(1)

        // 显示工具调用摘要
        if (result.toolCalls.length > 0) {
          print(`\n[Used ${result.toolCalls.length} tools in ${result.iterations} iterations]`, "dim")
        }

        // 显示回答
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

  // 处理退出
  rl.on("close", async () => {
    print("\nGoodbye!", "cyan")
    await agent.close()
    process.exit(0)
  })

  // 开始交互
  prompt()
}

interface CommandContext {
  verbose: boolean
  setVerbose: (v: boolean) => void
}

async function handleCommand(
  cmd: string,
  agent: Agent,
  rl: readline.Interface,
  ctx: CommandContext
): Promise<void> {
  const [command, ...args] = cmd.slice(1).split(" ")

  switch (command) {
    case "help":
      print("\n可用命令:", "cyan")
      print("  /help              - 显示此帮助")
      print("  /model <name>      - 切换模型")
      print("  /verbose           - 切换详细模式 (当前: " + (ctx.verbose ? "开" : "关") + ")")
      print("  /clear             - 清屏")
      print("  /exit              - 退出")
      print("\n可用模型示例:", "cyan")
      print("  anthropic/claude-sonnet-4")
      print("  anthropic/claude-haiku")
      print("  openai/gpt-4o")
      print("  google/gemini-2.0-flash-001")
      console.log()
      break

    case "model":
      if (args.length === 0) {
        print("用法: /model <model_name>", "yellow")
      } else {
        agent.setModel(args[0])
        print(`模型已切换为: ${args[0]}`, "green")
      }
      console.log()
      break

    case "verbose":
      ctx.setVerbose(!ctx.verbose)
      // 需要重新创建 agent 来应用 verbose 设置
      print(`详细模式: ${ctx.verbose ? "开启" : "关闭"}`, "green")
      console.log()
      break

    case "clear":
      console.clear()
      printHeader()
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

// 运行
main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
