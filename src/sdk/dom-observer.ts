/**
 * DOM Observer
 *
 * 扫描页面可交互元素，分配 ref_N 标识符。
 * 与 Playwright snapshot 使用相同的选择器和 ref 系统，保持一致。
 *
 * 浏览器端运行，不依赖 Node.js API。
 */

// 常量内联（SDK 不能 import Node 模块）
const REF_ATTRIBUTE = "data-agent-ref"
const REF_PREFIX = "ref_"
const MAX_REFS = 50
const ELEMENT_TEXT_TRUNCATE = 50
const ELEMENT_TEXT_MAX_DISPLAY = 40
const HREF_TRUNCATE = 50
const MAX_SNAPSHOT_TEXT = 5000

const INTERACTIVE_SELECTORS = [
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
  "#prompt-textarea",
]

export interface SnapshotData {
  url: string
  title: string
  text: string
  elements: string
}

/** 将 ref_N 转为 CSS 选择器 */
export function toRefSelector(selector: string): string {
  return selector.startsWith(REF_PREFIX)
    ? `[${REF_ATTRIBUTE}="${selector}"]`
    : selector
}

/** 解析选择器，返回元素 */
export function resolveElement(selector: string): Element | null {
  const css = toRefSelector(selector)
  return document.querySelector(css)
}

/**
 * 扫描当前页面，生成快照
 * - 给可交互元素分配 ref_N
 * - 提取页面文本
 * - 返回元素描述列表
 */
export function snapshot(maxTextLen?: number): SnapshotData {
  const textLimit = maxTextLen ?? MAX_SNAPSHOT_TEXT

  // 页面文本
  let text = document.body?.innerText || ""
  if (text.length > textLimit) {
    text = text.slice(0, textLimit) + "\n... (truncated)"
  }

  // 扫描可交互元素
  const results: string[] = []
  const seen = new Set<Element>()
  let refIndex = 1

  for (const sel of INTERACTIVE_SELECTORS) {
    const els = document.querySelectorAll(sel)
    for (const el of els) {
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

      const refId = `${REF_PREFIX}${refIndex++}`
      el.setAttribute(REF_ATTRIBUTE, refId)

      // 元素描述
      const tagName = el.tagName.toLowerCase()
      const type = (el as HTMLInputElement).type
      const elText = el.textContent?.trim().slice(0, ELEMENT_TEXT_TRUNCATE) || ""
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
      else if (elText && elText.length < ELEMENT_TEXT_MAX_DISPLAY) desc += ` "${elText}"`
      if (tagName === "a" && href) desc += ` -> ${href.slice(0, HREF_TRUNCATE)}`

      results.push(desc)

      if (refIndex > MAX_REFS) break
    }
    if (refIndex > MAX_REFS) break
  }

  return {
    url: window.location.href,
    title: document.title,
    text,
    elements: results.join("\n"),
  }
}
