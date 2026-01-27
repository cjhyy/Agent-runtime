import { chromium } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import type { Browser, Page } from "playwright"

// 添加 stealth 插件来绕过 bot 检测
chromium.use(StealthPlugin())

let browser: Browser | null = null
let page: Page | null = null

/**
 * 初始化浏览器 (stealth mode)
 */
export async function initBrowser(): Promise<void> {
  if (browser) return

  console.error("[Browser] Starting Playwright with stealth mode...")
  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1920,1080"
    ]
  })

  // 创建带有真实浏览器特征的 context
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "en-US",
    timezoneId: "America/New_York",
    permissions: ["geolocation"],
    geolocation: { latitude: 40.7128, longitude: -74.0060 }
  })

  page = await context.newPage()

  // 注入脚本来隐藏 webdriver 特征
  await page.addInitScript(() => {
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
      get: () => ["en-US", "en"]
    })
  })

  console.error("[Browser] Ready (stealth mode enabled)")
}

/**
 * 关闭浏览器
 */
export async function closeBrowser(): Promise<void> {
  if (page) {
    await page.close().catch(() => {})
    page = null
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

export interface SnapshotResult {
  url: string
  title: string
  screenshot: string
  text: string
  elements: string
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
