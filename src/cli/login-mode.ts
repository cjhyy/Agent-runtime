/**
 * 登录模式 - 打开浏览器让用户登录并保存状态
 */

import {
  setBrowserConfig,
  initBrowser,
  closeBrowser,
  launchLoginMode,
  getCookiesFormatted,
} from "../runtime/index.js"
import { print, printHeader, printSeparator } from "./colors.js"

/** 运行登录模式 */
export async function runLoginMode(url?: string): Promise<void> {
  const targetUrl = url || "https://www.google.com"

  printHeader("Browser Login Tool")

  const result = await launchLoginMode(targetUrl)

  // 显示登录结果
  console.log()
  printSeparator()
  print("📊 登录状态报告", "cyan")
  printSeparator()
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
        const isRelated = domain.includes(urlHost.split(".").slice(-2).join("."))
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
