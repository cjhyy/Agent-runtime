#!/usr/bin/env node
/**
 * Agent Runtime CLI
 * 统一命令行入口
 *
 * 模块结构:
 * - colors.ts       - ANSI 颜色和输出工具
 * - env.ts          - 环境变量加载
 * - chat-mode.ts    - 交互式对话模式
 * - login-mode.ts   - 浏览器登录模式
 * - cookies-mode.ts - Cookie/Session 管理
 */

import { VERSION } from "../constants.js"
import { colors, print } from "./colors.js"
import { loadEnv } from "./env.js"
import { runChatMode } from "./chat-mode.js"
import { runLoginMode } from "./login-mode.js"
import { runCookiesMode } from "./cookies-mode.js"

// 加载 .env 文件
loadEnv()

/** 显示主帮助 */
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

/** 主入口 */
async function main(): Promise<void> {
  const command = process.argv[2]
  const args = process.argv.slice(3)

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
      console.log(`agent-runtime v${VERSION}`)
      break

    default:
      print(`Unknown command: ${command}`, "red")
      showMainHelp()
      process.exit(1)
  }
}

// 运行
main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
