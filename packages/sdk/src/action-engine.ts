/**
 * Action Engine
 *
 * 基于坐标的点击 (dispatchEvent + bubbles:true)
 * 基于 execCommand('insertText') 的文本输入
 * 无框架依赖，纯 DOM API。
 */

import { resolveElement, toRefSelector } from "./dom-observer.js"

/** 获取元素中心坐标 */
function getElementCenter(el: Element): { x: number; y: number } {
  const rect = el.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }
}

/** 点击元素 - 使用坐标派发事件 */
export function click(selector: string): { success: boolean; error?: string } {
  const el = resolveElement(selector)
  if (!el) return { success: false, error: `Element not found: ${selector}` }

  const { x, y } = getElementCenter(el)

  // mousedown -> mouseup -> click 完整序列
  const eventInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
  }

  el.dispatchEvent(new MouseEvent("mousedown", eventInit))
  el.dispatchEvent(new MouseEvent("mouseup", eventInit))
  el.dispatchEvent(new MouseEvent("click", eventInit))

  return { success: true }
}

/**
 * 输入文本 - 纯键盘事件模拟
 *
 * 流程: click 聚焦 → (可选 Ctrl+A 全选) → 逐字符 keydown/keypress/input/keyup
 * 和框架无关，完全模拟用户真实打字。
 */
export function type(
  selector: string,
  text: string,
  clear = true
): { success: boolean; error?: string } {
  const el = resolveElement(selector)
  if (!el) return { success: false, error: `Element not found: ${selector}` }
  if (!(el instanceof HTMLElement)) return { success: false, error: `Not an HTML element` }

  // 1. 模拟点击聚焦
  const { x, y } = getElementCenter(el)
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: y }))
  el.focus()
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: x, clientY: y }))
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }))

  // 2. 清空: 全选后删除
  if (clear) {
    // Ctrl+A 全选
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA", ctrlKey: true, bubbles: true }))
    el.dispatchEvent(new KeyboardEvent("keyup", { key: "a", code: "KeyA", ctrlKey: true, bubbles: true }))

    // 用 execCommand selectAll + delete (浏览器原生行为)
    document.execCommand("selectAll", false)
    document.execCommand("delete", false)
  }

  // 3. 逐字符用 execCommand insertText
  //    这是浏览器原生的输入方式，任何框架都能感知到
  for (const char of text) {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }))
    el.dispatchEvent(new KeyboardEvent("keypress", { key: char, bubbles: true }))
    document.execCommand("insertText", false, char)
    el.dispatchEvent(new KeyboardEvent("keyup", { key: char, bubbles: true }))
  }

  return { success: true }
}

/** 悬停元素 */
export function hover(selector: string): { success: boolean; error?: string } {
  const el = resolveElement(selector)
  if (!el) return { success: false, error: `Element not found: ${selector}` }

  const { x, y } = getElementCenter(el)
  el.dispatchEvent(
    new MouseEvent("mouseover", { bubbles: true, clientX: x, clientY: y })
  )
  el.dispatchEvent(
    new MouseEvent("mouseenter", { bubbles: true, clientX: x, clientY: y })
  )

  return { success: true }
}

/** 选择下拉选项 */
export function select(
  selector: string,
  values: string | string[]
): { success: boolean; selected: string[]; error?: string } {
  const el = resolveElement(selector)
  if (!el || !(el instanceof HTMLSelectElement)) {
    return { success: false, selected: [], error: `Select element not found: ${selector}` }
  }

  const vals = Array.isArray(values) ? values : [values]
  const selected: string[] = []

  for (const option of el.options) {
    option.selected = vals.includes(option.value)
    if (option.selected) selected.push(option.value)
  }

  el.dispatchEvent(new Event("change", { bubbles: true }))

  return { success: true, selected }
}

/** 滚动 */
export function scroll(options: {
  direction?: "up" | "down" | "left" | "right"
  distance?: number
  selector?: string
  toTop?: boolean
  toBottom?: boolean
}): { success: boolean } {
  if (options.selector) {
    const el = resolveElement(options.selector)
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
  } else if (options.toTop) {
    window.scrollTo({ top: 0, behavior: "smooth" })
  } else if (options.toBottom) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
  } else {
    const dist = options.distance ?? 500
    const dir = options.direction ?? "down"
    const map = {
      down: [0, dist],
      up: [0, -dist],
      right: [dist, 0],
      left: [-dist, 0],
    }
    const [x, y] = map[dir]
    window.scrollBy({ left: x, top: y, behavior: "smooth" })
  }

  return { success: true }
}

/** 执行 JS */
export function evaluate(code: string): { success: boolean; result?: unknown; error?: string } {
  try {
    const fn = new Function(code)
    const result = fn()
    return { success: true, result }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** 导航 */
export function goto(url: string): { success: boolean } {
  window.location.href = url
  return { success: true }
}
