/**
 * Cookie 管理模式
 */

import {
  setBrowserConfig,
  initBrowser,
  closeBrowser,
  getCookiesFormatted,
  clearCookies,
  clearCookiesForDomain,
  exportSession,
  importSession,
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
} from "../runtime/index.js"
import { colors, print, printSeparator } from "./colors.js"

/** 显示 Cookies 帮助 */
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

/** 列出所有 Cookie */
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
    printSeparator()
    print(`📍 ${domain} (${cookies.length} cookies)`, "cyan")
    printSeparator()

    for (const cookie of cookies) {
      const expiry =
        cookie.expires === -1
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

/** 清除 Cookie */
async function cookiesClear(domain?: string): Promise<void> {
  if (domain) {
    const removed = await clearCookiesForDomain(domain)
    print(`\n✅ Cleared ${removed} cookies for domain: ${domain}\n`, "green")
  } else {
    await clearCookies()
    print("\n✅ All cookies cleared\n", "green")
  }
}

/** 导出 Session */
async function cookiesExport(filePath: string): Promise<void> {
  const session = await exportSession(filePath)
  print(`\n✅ Session exported to: ${filePath}`, "green")
  print(`   - Cookies: ${session.cookies.length}`, "dim")
  print(`   - localStorage keys: ${Object.keys(session.localStorage).length}`, "dim")
  print(`   - sessionStorage keys: ${Object.keys(session.sessionStorage).length}\n`, "dim")
}

/** 导入 Session */
async function cookiesImport(filePath: string): Promise<void> {
  const result = await importSession(filePath)
  print(`\n✅ Session imported from: ${filePath}`, "green")
  print(`   - Cookies: ${result.cookiesImported}`, "dim")
  print(`   - localStorage keys: ${result.localStorageKeys}`, "dim")
  print(`   - sessionStorage keys: ${result.sessionStorageKeys}\n`, "dim")
}

/** 列出所有保存的 Session */
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

/** 保存 Session */
async function cookiesSave(name: string): Promise<void> {
  const filePath = await saveSession(name)
  print(`\n✅ Session saved as "${name}"`, "green")
  print(`   Path: ${filePath}\n`, "dim")
}

/** 加载 Session */
async function cookiesLoad(name: string): Promise<void> {
  const result = await loadSession(name)
  print(`\n✅ Session "${name}" loaded`, "green")
  print(`   - Cookies: ${result.cookiesImported}`, "dim")
  print(`   - localStorage keys: ${result.localStorageKeys}`, "dim")
  print(`   - sessionStorage keys: ${result.sessionStorageKeys}\n`, "dim")
}

/** 删除 Session */
function cookiesDelete(name: string): void {
  if (deleteSession(name)) {
    print(`\n✅ Session "${name}" deleted\n`, "green")
  } else {
    print(`\n❌ Session "${name}" not found\n`, "red")
  }
}

/** 运行 Cookies 模式 */
export async function runCookiesMode(cmdArgs: string[]): Promise<void> {
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
