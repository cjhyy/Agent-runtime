/**
 * 浏览器操作模块
 * 封装页面导航、点击、输入等操作
 */

import { TIMEOUTS, LIMITS, INTERACTIVE_SELECTORS, REF_SYSTEM } from "../../constants.js"
import { browserLogger as logger } from "../../logger.js"
import { getPage } from "./core.js"
import type {
  GotoResult,
  ClickResult,
  TypeResult,
  PressResult,
  SnapshotResult,
  WaitResult,
  WaitOptions,
  ScrollResult,
  ScrollOptions,
  HoverResult,
  SelectResult,
  BackResult,
  EvaluateResult,
  UploadResult,
} from "./types.js"

/** 转换 ref_N 选择器为 data 属性选择器 */
function toRefSelector(selector: string): string {
  return selector.startsWith(REF_SYSTEM.PREFIX)
    ? `[${REF_SYSTEM.ATTRIBUTE}="${selector}"]`
    : selector
}

/** 导航到指定 URL */
export async function browserGoto(url: string): Promise<GotoResult> {
  const page = getPage()
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUTS.BROWSER_GOTO })
  return {
    url: page.url(),
    title: await page.title(),
  }
}

/** 点击元素 */
export async function browserClick(selector: string): Promise<ClickResult> {
  const page = getPage()
  const cssSelector = toRefSelector(selector)
  const urlBefore = page.url()

  await page.click(cssSelector, { timeout: TIMEOUTS.BROWSER_CLICK })

  // 等待可能的导航
  await page.waitForLoadState("domcontentloaded").catch((err) => {
    logger.debug("waitForLoadState after click", { error: err?.message })
  })

  const urlAfter = page.url()
  return {
    url: urlAfter,
    title: await page.title(),
    navigated: urlBefore !== urlAfter,
  }
}

/** 在元素中输入文本 */
export async function browserType(selector: string, text: string): Promise<TypeResult> {
  const page = getPage()
  const cssSelector = toRefSelector(selector)
  const element = page.locator(cssSelector)

  // 检查元素类型，对 contenteditable 使用不同的输入方式
  const isContentEditable = await element
    .evaluate((el) => {
      return (
        el.getAttribute("contenteditable") === "true" ||
        el.getAttribute("role") === "textbox" ||
        el.id === "prompt-textarea"
      )
    })
    .catch(() => false)

  const inputType = await element
    .evaluate((el) => {
      return (el as HTMLInputElement).type || ""
    })
    .catch(() => "")

  // file input 不能输入文本
  if (inputType === "file") {
    throw new Error("Cannot type into file input. Use file upload instead.")
  }

  if (isContentEditable) {
    // 对于 contenteditable 元素，使用 click + type
    await element.click({ timeout: TIMEOUTS.BROWSER_CLICK })
    await element.pressSequentially(text, { delay: 50 })
  } else {
    // 普通 input/textarea 使用 fill
    await page.fill(cssSelector, text, { timeout: TIMEOUTS.BROWSER_TYPE })
  }

  return {
    url: page.url(),
    title: await page.title(),
  }
}

/** 按下键盘按键 */
export async function browserPress(key: string): Promise<PressResult> {
  const page = getPage()
  await page.keyboard.press(key)

  // 等待可能的导航或页面变化
  await page.waitForLoadState("domcontentloaded").catch((err) => {
    logger.debug("waitForLoadState after press", { error: err?.message })
  })

  return {
    url: page.url(),
    title: await page.title(),
  }
}

/** 获取当前页面截图 (Buffer) */
export async function browserScreenshot(): Promise<Buffer> {
  const page = getPage()
  return await page.screenshot({ fullPage: false })
}

/** 获取页面快照（截图 + 文本 + 可交互元素） */
export async function browserSnapshot(maxTextLen?: number): Promise<SnapshotResult> {
  const textLimit = maxTextLen ?? LIMITS.MAX_SNAPSHOT_TEXT
  const page = getPage()

  // 截图
  const screenshotBuffer = await page.screenshot({ fullPage: false })
  const screenshot = screenshotBuffer.toString("base64")

  // 获取页面文本
  let text = await page.evaluate(() => document.body?.innerText || "")
  if (text.length > textLimit) {
    text = text.slice(0, textLimit) + "\n... (truncated)"
  }

  // 获取可交互元素并设置 ref
  const elements = await page.evaluate(
    ({ selectors, maxRefs, refAttribute, textTruncate, textMaxDisplay, hrefTruncate }) => {
      const results: string[] = []
      const seen = new Set<Element>()
      let refIndex = 1

      for (const sel of selectors) {
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
          el.setAttribute(refAttribute, refId)

          // 获取元素描述
          const tagName = el.tagName.toLowerCase()
          const type = (el as HTMLInputElement).type
          const text = el.textContent?.trim().slice(0, textTruncate) || ""
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
          else if (text && text.length < textMaxDisplay) desc += ` "${text}"`
          if (tagName === "a" && href) desc += ` -> ${href.slice(0, hrefTruncate)}`

          results.push(desc)

          // 限制数量
          if (refIndex > maxRefs) break
        }
        if (refIndex > maxRefs) break
      }

      return results.join("\n")
    },
    {
      selectors: [...INTERACTIVE_SELECTORS],
      maxRefs: LIMITS.MAX_REFS,
      refAttribute: REF_SYSTEM.ATTRIBUTE,
      textTruncate: LIMITS.ELEMENT_TEXT_TRUNCATE,
      textMaxDisplay: LIMITS.ELEMENT_TEXT_MAX_DISPLAY,
      hrefTruncate: LIMITS.HREF_TRUNCATE,
    }
  )

  return {
    url: page.url(),
    title: await page.title(),
    screenshot,
    text,
    elements,
  }
}

// ===== 新增浏览器操作 =====

/**
 * 等待 - 支持时间、元素、文本等多种等待方式
 */
export async function browserWait(options: WaitOptions): Promise<WaitResult> {
  const page = getPage()
  let waited = ""

  // 等待指定时间
  if (options.timeout) {
    await page.waitForTimeout(options.timeout)
    waited = `${options.timeout}ms`
  }
  // 等待元素出现
  else if (options.selector) {
    const cssSelector = toRefSelector(options.selector)
    await page.waitForSelector(cssSelector, { timeout: TIMEOUTS.BROWSER_GOTO })
    waited = `element: ${options.selector}`
  }
  // 等待文本出现
  else if (options.text) {
    await page.waitForFunction(
      (text) => document.body?.innerText?.includes(text),
      options.text,
      { timeout: TIMEOUTS.BROWSER_GOTO }
    )
    waited = `text: "${options.text}"`
  }
  // 等待文本消失
  else if (options.textGone) {
    await page.waitForFunction(
      (text) => !document.body?.innerText?.includes(text),
      options.textGone,
      { timeout: TIMEOUTS.BROWSER_GOTO }
    )
    waited = `text gone: "${options.textGone}"`
  }
  // 等待页面加载状态
  else if (options.state) {
    await page.waitForLoadState(options.state, { timeout: TIMEOUTS.BROWSER_GOTO })
    waited = `state: ${options.state}`
  }
  // 默认等待 1 秒
  else {
    await page.waitForTimeout(1000)
    waited = "1000ms (default)"
  }

  return {
    url: page.url(),
    title: await page.title(),
    waited,
  }
}

/**
 * 滚动页面
 */
export async function browserScroll(options: ScrollOptions = {}): Promise<ScrollResult> {
  const page = getPage()

  // 滚动到元素
  if (options.selector) {
    const cssSelector = toRefSelector(options.selector)
    await page.locator(cssSelector).scrollIntoViewIfNeeded({ timeout: TIMEOUTS.BROWSER_CLICK })
  }
  // 滚动到顶部
  else if (options.toTop) {
    await page.evaluate(() => window.scrollTo(0, 0))
  }
  // 滚动到底部
  else if (options.toBottom) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  }
  // 按方向滚动
  else {
    const distance = options.distance ?? 500
    const direction = options.direction ?? "down"

    await page.evaluate(
      ({ dir, dist }) => {
        switch (dir) {
          case "down":
            window.scrollBy(0, dist)
            break
          case "up":
            window.scrollBy(0, -dist)
            break
          case "right":
            window.scrollBy(dist, 0)
            break
          case "left":
            window.scrollBy(-dist, 0)
            break
        }
      },
      { dir: direction, dist: distance }
    )
  }

  // 获取当前滚动位置
  const scrollPos = await page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
  }))

  return {
    url: page.url(),
    title: await page.title(),
    scrolledTo: scrollPos,
  }
}

/**
 * 鼠标悬停
 */
export async function browserHover(selector: string): Promise<HoverResult> {
  const page = getPage()
  const cssSelector = toRefSelector(selector)

  await page.hover(cssSelector, { timeout: TIMEOUTS.BROWSER_CLICK })

  return {
    url: page.url(),
    title: await page.title(),
  }
}

/**
 * 选择下拉框选项
 */
export async function browserSelect(
  selector: string,
  values: string | string[]
): Promise<SelectResult> {
  const page = getPage()
  const cssSelector = toRefSelector(selector)

  const selected = await page.selectOption(cssSelector, values, {
    timeout: TIMEOUTS.BROWSER_CLICK,
  })

  return {
    url: page.url(),
    title: await page.title(),
    selected,
  }
}

/**
 * 返回上一页
 */
export async function browserBack(): Promise<BackResult> {
  const page = getPage()
  const urlBefore = page.url()

  await page.goBack({ waitUntil: "domcontentloaded", timeout: TIMEOUTS.BROWSER_GOTO })

  const urlAfter = page.url()
  return {
    url: urlAfter,
    title: await page.title(),
    navigated: urlBefore !== urlAfter,
  }
}

/**
 * 前进到下一页
 */
export async function browserForward(): Promise<BackResult> {
  const page = getPage()
  const urlBefore = page.url()

  await page.goForward({ waitUntil: "domcontentloaded", timeout: TIMEOUTS.BROWSER_GOTO })

  const urlAfter = page.url()
  return {
    url: urlAfter,
    title: await page.title(),
    navigated: urlBefore !== urlAfter,
  }
}

/**
 * 执行 JavaScript 代码
 */
export async function browserEvaluate(code: string): Promise<EvaluateResult> {
  const page = getPage()

  // 执行代码并获取结果
  const result = await page.evaluate((js) => {
    // 使用 Function 构造器执行代码，支持 return
    const fn = new Function(js)
    return fn()
  }, code)

  return {
    url: page.url(),
    title: await page.title(),
    result,
  }
}

/**
 * 上传文件
 */
export async function browserUpload(
  selector: string,
  files: string | string[]
): Promise<UploadResult> {
  const page = getPage()
  const cssSelector = toRefSelector(selector)

  const fileList = Array.isArray(files) ? files : [files]
  await page.setInputFiles(cssSelector, fileList, { timeout: TIMEOUTS.BROWSER_CLICK })

  return {
    url: page.url(),
    title: await page.title(),
    uploaded: fileList.map((f) => f.split("/").pop() || f),
  }
}

/**
 * 刷新页面
 */
export async function browserReload(): Promise<GotoResult> {
  const page = getPage()
  await page.reload({ waitUntil: "domcontentloaded", timeout: TIMEOUTS.BROWSER_GOTO })

  return {
    url: page.url(),
    title: await page.title(),
  }
}
