/**
 * 浏览器核心模块
 * 管理浏览器生命周期、初始化和关闭
 */

import type { Browser, BrowserContext, Page } from "playwright"
import * as path from "node:path"
import * as os from "node:os"
import * as fs from "node:fs"
import { PATHS } from "../../constants.js"
import { BrowserError } from "../../errors.js"
import { browserLogger as logger } from "../../logger.js"
import type { BrowserConfig, LoginResult } from "./types.js"
import {
  chromium,
  getPersistentContextOptions,
  getDefaultLaunchOptions,
  getDefaultContextOptions,
  getLoginModeOptions,
  injectStealthScripts,
} from "./stealth.js"
import { TIMEOUTS } from "../../constants.js"

// ===== 浏览器实例管理 =====

let browser: Browser | null = null
let context: BrowserContext | null = null
let page: Page | null = null

// 全局配置 - 默认使用持久化配置
let browserConfig: BrowserConfig = {
  headless: true,
  useProfile: true,
  userId: PATHS.DEFAULT_USER,
}

// ===== 配置管理 =====

/** 设置浏览器配置（需要在 initBrowser 之前调用） */
export function setBrowserConfig(config: Partial<BrowserConfig>): void {
  browserConfig = { ...browserConfig, ...config }
}

/** 获取当前浏览器配置 */
export function getBrowserConfig(): BrowserConfig {
  return { ...browserConfig }
}

/** 获取当前用户 ID */
export function getCurrentUserId(): string {
  return browserConfig.userId || PATHS.DEFAULT_USER
}

// ===== 路径管理 =====

/** 获取用户的浏览器配置目录 */
export function getUserProfileDir(userId: string): string {
  return path.join(
    os.homedir(),
    PATHS.BASE_DIR,
    PATHS.PROFILES_DIR,
    userId,
    PATHS.BROWSER_DIR
  )
}

/** 获取 Agent 专用的浏览器配置目录 */
function getAgentProfileDir(): string {
  return getUserProfileDir(browserConfig.userId || PATHS.DEFAULT_USER)
}

/** 获取用户 session 文件目录 */
export function getSessionDir(): string {
  return path.join(
    os.homedir(),
    PATHS.BASE_DIR,
    PATHS.PROFILES_DIR,
    browserConfig.userId || PATHS.DEFAULT_USER,
    PATHS.SESSIONS_DIR
  )
}

/** 确保目录存在 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// ===== 用户管理 =====

/** 切换用户 */
export async function switchUser(userId: string): Promise<void> {
  await closeBrowser()
  browserConfig.userId = userId
  logger.info(`Switched to user: ${userId}`)
}

/** 获取所有用户列表 */
export function listUsers(): string[] {
  const baseDir = path.join(os.homedir(), PATHS.BASE_DIR, PATHS.PROFILES_DIR)
  if (!fs.existsSync(baseDir)) {
    return [PATHS.DEFAULT_USER]
  }
  const users = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
  return users.length > 0 ? users : [PATHS.DEFAULT_USER]
}

// ===== 浏览器生命周期 =====

/** 初始化浏览器 (stealth mode + 持久化配置) */
export async function initBrowser(): Promise<void> {
  if (browser || context) return

  const { headless, useProfile, profilePath } = browserConfig

  // 使用持久化配置文件模式（默认）
  if (useProfile) {
    const userDataDir = profilePath || getAgentProfileDir()
    ensureDir(userDataDir)

    logger.info(`Starting with persistent profile: ${userDataDir}`)

    // 使用 launchPersistentContext 保持登录状态
    context = await chromium.launchPersistentContext(
      userDataDir,
      getPersistentContextOptions(headless ?? true)
    )

    page = context.pages()[0] || (await context.newPage())
    await injectStealthScripts(page)

    logger.info("Ready (persistent profile, login state preserved)")
    return
  }

  // 无持久化的 stealth 模式
  logger.info("Starting Playwright with stealth mode (no persistence)...")
  browser = await chromium.launch(getDefaultLaunchOptions(headless ?? true))

  context = await browser.newContext(getDefaultContextOptions())
  page = await context.newPage()
  await injectStealthScripts(page)

  logger.info("Ready (stealth mode, no persistence)")
}

/** 关闭浏览器 */
export async function closeBrowser(): Promise<void> {
  if (page) {
    await page.close().catch((err) => {
      logger.debug("Error closing page", { error: err?.message })
    })
    page = null
  }
  if (context) {
    await context.close().catch((err) => {
      logger.debug("Error closing context", { error: err?.message })
    })
    context = null
  }
  if (browser) {
    await browser.close().catch((err) => {
      logger.debug("Error closing browser", { error: err?.message })
    })
    browser = null
  }
}

// ===== 实例访问 =====

/** 获取当前 page */
export function getPage(): Page {
  if (!page) {
    throw BrowserError.notInitialized()
  }
  return page
}

/** 获取当前 context */
export function getContext(): BrowserContext {
  if (!context) {
    throw BrowserError.notInitialized()
  }
  return context
}

// ===== 登录模式 =====

/**
 * 启动登录模式 - 打开浏览器窗口让用户手动登录
 * 返回登录后的 Cookie 统计信息
 */
export async function launchLoginMode(
  url: string = "https://www.google.com"
): Promise<LoginResult> {
  const userDataDir = getAgentProfileDir()
  ensureDir(userDataDir)

  logger.info("启动登录模式...")
  logger.info(`配置文件位置: ${userDataDir}`)
  logger.info(`即将打开: ${url}`)

  // 非无头模式启动，让用户可以操作
  const loginContext = await chromium.launchPersistentContext(
    userDataDir,
    getLoginModeOptions()
  )

  const loginPage = loginContext.pages()[0] || (await loginContext.newPage())
  await loginPage.goto(url)

  // 保存最新 cookie 状态
  let lastCookieState = {
    cookieCount: 0,
    cookiesByDomain: {} as Record<string, number>,
    domains: [] as string[],
  }

  // 定期检查 cookie 状态（在浏览器关闭前）
  const checkInterval = setInterval(async () => {
    try {
      const cookies = await loginContext.cookies()
      const byDomain: Record<string, number> = {}
      for (const c of cookies) {
        byDomain[c.domain] = (byDomain[c.domain] || 0) + 1
      }
      lastCookieState = {
        cookieCount: cookies.length,
        cookiesByDomain: byDomain,
        domains: Object.keys(byDomain),
      }
    } catch {
      // context 已关闭，忽略
    }
  }, TIMEOUTS.COOKIE_CHECK_INTERVAL)

  // 等待用户关闭浏览器
  const result = await new Promise<LoginResult>((resolve) => {
    loginContext.once("close", () => {
      clearInterval(checkInterval)
      logger.info("浏览器已关闭，正在保存登录状态...")
      resolve({
        success: true,
        url,
        ...lastCookieState,
      })
    })
  })

  return result
}
