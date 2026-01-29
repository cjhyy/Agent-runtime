import { chromium } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import type { Browser, BrowserContext, Page } from "playwright"
import * as path from "node:path"
import * as os from "node:os"
import * as fs from "node:fs"

// 添加 stealth 插件来绕过 bot 检测
chromium.use(StealthPlugin())

let browser: Browser | null = null
let context: BrowserContext | null = null
let page: Page | null = null

/**
 * 浏览器配置
 */
export interface BrowserConfig {
  headless?: boolean           // 是否无头模式，默认 true
  useProfile?: boolean         // 是否使用持久化配置文件，默认 true
  profilePath?: string         // 自定义配置文件路径
  userId?: string              // 用户 ID，用于多用户切换
}

// 全局配置 - 默认使用持久化配置
let browserConfig: BrowserConfig = {
  headless: true,
  useProfile: true,
  userId: "default"
}

/**
 * 设置浏览器配置（需要在 initBrowser 之前调用）
 */
export function setBrowserConfig(config: Partial<BrowserConfig>): void {
  browserConfig = { ...browserConfig, ...config }
}

/**
 * 获取当前用户 ID
 */
export function getCurrentUserId(): string {
  return browserConfig.userId || "default"
}

/**
 * 切换用户
 */
export async function switchUser(userId: string): Promise<void> {
  // 先关闭当前浏览器
  await closeBrowser()
  // 设置新用户
  browserConfig.userId = userId
  console.error(`[Browser] Switched to user: ${userId}`)
}

/**
 * 获取所有用户列表
 */
export function listUsers(): string[] {
  const baseDir = path.join(os.homedir(), ".agent-runtime", "profiles")
  if (!fs.existsSync(baseDir)) {
    return ["default"]
  }
  const users = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
  return users.length > 0 ? users : ["default"]
}

/**
 * 获取用户的浏览器配置目录
 */
function getUserProfileDir(userId: string): string {
  const home = os.homedir()
  return path.join(home, ".agent-runtime", "profiles", userId, "browser")
}

/**
 * 获取 Agent 专用的浏览器配置目录
 */
function getAgentProfileDir(): string {
  return getUserProfileDir(browserConfig.userId || "default")
}

/**
 * 确保目录存在
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * 初始化浏览器 (stealth mode + 持久化配置)
 */
export async function initBrowser(): Promise<void> {
  if (browser || context) return

  const { headless, useProfile, profilePath } = browserConfig

  // 使用持久化配置文件模式（默认）
  if (useProfile) {
    const userDataDir = profilePath || getAgentProfileDir()
    ensureDir(userDataDir)

    console.error(`[Browser] Starting with persistent profile: ${userDataDir}`)

    // 使用 launchPersistentContext 保持登录状态
    context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--window-size=1920,1080"
      ],
      viewport: { width: 1920, height: 1080 },
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai"
    })

    page = context.pages()[0] || await context.newPage()

    // 注入 stealth 脚本
    await injectStealthScripts(page)

    console.error("[Browser] Ready (persistent profile, login state preserved)")
    return
  }

  // 无持久化的 stealth 模式
  console.error("[Browser] Starting Playwright with stealth mode (no persistence)...")
  browser = await chromium.launch({
    headless,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1920,1080"
    ]
  })

  context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    permissions: ["geolocation"],
    geolocation: { latitude: 31.2304, longitude: 121.4737 }
  })

  page = await context.newPage()
  await injectStealthScripts(page)

  console.error("[Browser] Ready (stealth mode, no persistence)")
}

/**
 * 注入 stealth 脚本
 */
async function injectStealthScripts(p: Page): Promise<void> {
  await p.addInitScript(() => {
    // 删除 webdriver 标志
    Object.defineProperty(navigator, "webdriver", { get: () => undefined })

    // 模拟真实的 chrome 对象
    const mockChrome = {
      runtime: {},
      loadTimes: function () {},
      csi: function () {},
      app: {}
    }
    Object.defineProperty(window, "chrome", { get: () => mockChrome })

    // 修改 permissions API
    const originalQuery = window.navigator.permissions.query
    window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission, onchange: null } as PermissionStatus)
        : originalQuery(parameters)

    // 隐藏自动化相关属性
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5]
    })
    Object.defineProperty(navigator, "languages", {
      get: () => ["zh-CN", "zh", "en"]
    })
  })
}

/**
 * 启动登录模式 - 打开浏览器窗口让用户手动登录
 */
export async function launchLoginMode(url: string = "https://www.google.com"): Promise<void> {
  const userDataDir = getAgentProfileDir()
  ensureDir(userDataDir)

  console.log("\n🔐 启动登录模式...")
  console.log(`📁 配置文件位置: ${userDataDir}`)
  console.log(`🌐 即将打开: ${url}`)
  console.log("\n请在浏览器中完成登录，登录状态会自动保存。")
  console.log("完成后关闭浏览器窗口即可。\n")

  // 非无头模式启动，让用户可以操作
  const loginContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1280,800"
    ],
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai"
  })

  const loginPage = loginContext.pages()[0] || await loginContext.newPage()
  await loginPage.goto(url)

  // 等待用户关闭浏览器
  await new Promise<void>((resolve) => {
    loginContext.on("close", () => {
      console.log("\n✅ 登录状态已保存！下次运行时会自动使用。\n")
      resolve()
    })
  })
}

/**
 * 关闭浏览器
 */
export async function closeBrowser(): Promise<void> {
  if (page) {
    await page.close().catch(() => {})
    page = null
  }
  if (context) {
    await context.close().catch(() => {})
    context = null
  }
  if (browser) {
    await browser.close().catch(() => {})
    browser = null
  }
}

/**
 * 获取当前 page
 */
function getPage(): Page {
  if (!page) {
    throw new Error("Browser not initialized. Call initBrowser() first.")
  }
  return page
}

// ===== Browser Operations =====

export interface GotoResult {
  url: string
  title: string
}

export async function browserGoto(url: string): Promise<GotoResult> {
  const p = getPage()
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
  return {
    url: p.url(),
    title: await p.title()
  }
}

export interface ClickResult {
  url: string
  title: string
  navigated: boolean
}

export async function browserClick(selector: string): Promise<ClickResult> {
  const p = getPage()

  // 转换 ref_N 为 data 属性选择器
  const cssSelector = selector.startsWith("ref_")
    ? `[data-agent-ref="${selector}"]`
    : selector

  const urlBefore = p.url()
  await p.click(cssSelector, { timeout: 5000 })

  // 等待可能的导航
  await p.waitForLoadState("domcontentloaded").catch(() => {})

  const urlAfter = p.url()
  return {
    url: urlAfter,
    title: await p.title(),
    navigated: urlBefore !== urlAfter
  }
}

export interface TypeResult {
  url: string
  title: string
}

export async function browserType(selector: string, text: string): Promise<TypeResult> {
  const p = getPage()

  const cssSelector = selector.startsWith("ref_")
    ? `[data-agent-ref="${selector}"]`
    : selector

  const element = p.locator(cssSelector)

  // 检查元素类型，对 contenteditable 使用不同的输入方式
  const isContentEditable = await element.evaluate((el) => {
    return el.getAttribute("contenteditable") === "true" ||
           el.getAttribute("role") === "textbox" ||
           el.id === "prompt-textarea"
  }).catch(() => false)

  const inputType = await element.evaluate((el) => {
    return (el as HTMLInputElement).type || ""
  }).catch(() => "")

  // file input 不能输入文本
  if (inputType === "file") {
    throw new Error("Cannot type into file input. Use file upload instead.")
  }

  if (isContentEditable) {
    // 对于 contenteditable 元素，使用 click + type
    await element.click({ timeout: 5000 })
    await element.pressSequentially(text, { delay: 50 })
  } else {
    // 普通 input/textarea 使用 fill
    await p.fill(cssSelector, text, { timeout: 5000 })
  }

  return {
    url: p.url(),
    title: await p.title()
  }
}

export interface PressResult {
  url: string
  title: string
}

/**
 * 按下键盘按键
 */
export async function browserPress(key: string): Promise<PressResult> {
  const p = getPage()
  await p.keyboard.press(key)

  // 等待可能的导航或页面变化
  await p.waitForLoadState("domcontentloaded").catch(() => {})

  return {
    url: p.url(),
    title: await p.title()
  }
}

export interface SnapshotResult {
  url: string
  title: string
  screenshot: string
  text: string
  elements: string
}

/**
 * 获取当前页面截图 (Buffer)
 */
export async function browserScreenshot(): Promise<Buffer> {
  const p = getPage()
  return await p.screenshot({ fullPage: false })
}

export async function browserSnapshot(maxTextLen = 5000): Promise<SnapshotResult> {
  const p = getPage()

  // 截图
  const screenshotBuffer = await p.screenshot({ fullPage: false })
  const screenshot = screenshotBuffer.toString("base64")

  // 获取页面文本
  let text = await p.evaluate(() => document.body?.innerText || "")
  if (text.length > maxTextLen) {
    text = text.slice(0, maxTextLen) + "\n... (truncated)"
  }

  // 获取可交互元素并设置 ref
  const elements = await p.evaluate(() => {
    const interactiveSelectors = [
      "button",
      "a[href]",
      "input:not([type='hidden'])",
      "textarea",
      "select",
      "[role='button']",
      "[role='link']",
      "[role='textbox']",
      "[contenteditable='true']",
      "[data-testid*='input']",
      "[data-testid*='textarea']",
      "#prompt-textarea"  // ChatGPT 特定
    ]

    const results: string[] = []
    const seen = new Set<Element>()
    let refIndex = 1

    for (const sel of interactiveSelectors) {
      const els = document.querySelectorAll(sel)
      for (const el of els) {
        // 跳过已处理的元素
        if (seen.has(el)) continue
        seen.add(el)

        // 跳过不可见元素
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        if (
          rect.width === 0 ||
          rect.height === 0 ||
          style.display === "none" ||
          style.visibility === "hidden"
        ) {
          continue
        }

        const refId = `ref_${refIndex++}`
        el.setAttribute("data-agent-ref", refId)

        // 获取元素描述
        const tagName = el.tagName.toLowerCase()
        const type = (el as HTMLInputElement).type
        const text = el.textContent?.trim().slice(0, 50) || ""
        const placeholder = (el as HTMLInputElement).placeholder || ""
        const ariaLabel = el.getAttribute("aria-label") || ""
        const href = (el as HTMLAnchorElement).href || ""
        const role = el.getAttribute("role") || ""
        const contentEditable = el.getAttribute("contenteditable")
        const id = el.id || ""
        const testId = el.getAttribute("data-testid") || ""

        let desc = `[${refId}] ${tagName}`
        if (type && tagName === "input") desc += `[type=${type}]`
        if (role) desc += `[role=${role}]`
        if (contentEditable === "true") desc += `[contenteditable]`
        if (id) desc += `#${id}`
        if (testId) desc += ` data-testid="${testId}"`
        if (ariaLabel) desc += ` "${ariaLabel}"`
        else if (placeholder) desc += ` placeholder="${placeholder}"`
        else if (text && text.length < 40) desc += ` "${text}"`
        if (tagName === "a" && href) desc += ` -> ${href.slice(0, 50)}`

        results.push(desc)

        // 限制数量
        if (refIndex > 50) break
      }
      if (refIndex > 50) break
    }

    return results.join("\n")
  })

  return {
    url: p.url(),
    title: await p.title(),
    screenshot,
    text,
    elements
  }
}
