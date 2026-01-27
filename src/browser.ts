import { chromium, type Browser, type Page } from "playwright"

let browser: Browser | null = null
let page: Page | null = null

/**
 * 初始化浏览器
 */
export async function initBrowser(): Promise<void> {
  if (browser) return

  console.error("[Browser] Starting Playwright...")
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  })
  page = await browser.newPage()
  console.error("[Browser] Ready")
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

  await p.fill(cssSelector, text, { timeout: 5000 })

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
      "input",
      "textarea",
      "select",
      "[role='button']",
      "[role='link']",
      "[contenteditable='true']"
    ]

    const results: string[] = []
    let refIndex = 1

    for (const sel of interactiveSelectors) {
      const els = document.querySelectorAll(sel)
      for (const el of els) {
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

        let desc = `[${refId}] ${tagName}`
        if (type && tagName === "input") desc += `[type=${type}]`
        if (ariaLabel) desc += ` "${ariaLabel}"`
        else if (text) desc += ` "${text}"`
        else if (placeholder) desc += ` placeholder="${placeholder}"`
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
