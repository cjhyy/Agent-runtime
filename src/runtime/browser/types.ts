/**
 * 浏览器模块类型定义
 */

import type { Cookie } from "playwright"

/** 浏览器配置 */
export interface BrowserConfig {
  /** 是否无头模式，默认 true */
  headless?: boolean
  /** 是否使用持久化配置文件，默认 true */
  useProfile?: boolean
  /** 自定义配置文件路径 */
  profilePath?: string
  /** 用户 ID，用于多用户切换 */
  userId?: string
}

/** 导航结果 */
export interface GotoResult {
  url: string
  title: string
}

/** 点击结果 */
export interface ClickResult {
  url: string
  title: string
  navigated: boolean
}

/** 输入结果 */
export interface TypeResult {
  url: string
  title: string
}

/** 按键结果 */
export interface PressResult {
  url: string
  title: string
}

/** 快照结果 */
export interface SnapshotResult {
  url: string
  title: string
  screenshot: string
  text: string
  elements: string
}

/** Cookie 信息（简化版，用于展示） */
export interface CookieInfo {
  name: string
  value: string
  domain: string
  path: string
  /** Unix timestamp, -1 = session cookie */
  expires: number
  httpOnly: boolean
  secure: boolean
  sameSite: "Strict" | "Lax" | "None"
}

/** Session 数据结构 */
export interface SessionData {
  cookies: Cookie[]
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  exportedAt: string
  url?: string
}

/** 登录结果 */
export interface LoginResult {
  success: boolean
  url: string
  cookieCount: number
  cookiesByDomain: Record<string, number>
  domains: string[]
}

/** Cookie 格式化结果 */
export interface CookiesFormattedResult {
  total: number
  byDomain: Record<string, CookieInfo[]>
  list: CookieInfo[]
}

/** Session 导入结果 */
export interface SessionImportResult {
  cookiesImported: number
  localStorageKeys: number
  sessionStorageKeys: number
}

// ===== 新增操作类型 =====

/** 等待结果 */
export interface WaitResult {
  url: string
  title: string
  waited: string  // 描述等待了什么
}

/** 等待选项 */
export interface WaitOptions {
  /** 等待指定毫秒数 */
  timeout?: number
  /** 等待元素出现（选择器） */
  selector?: string
  /** 等待文本出现 */
  text?: string
  /** 等待文本消失 */
  textGone?: string
  /** 等待页面加载状态 */
  state?: "load" | "domcontentloaded" | "networkidle"
}

/** 滚动结果 */
export interface ScrollResult {
  url: string
  title: string
  scrolledTo: { x: number; y: number }
}

/** 滚动选项 */
export interface ScrollOptions {
  /** 滚动方向 */
  direction?: "up" | "down" | "left" | "right"
  /** 滚动距离（像素），默认 500 */
  distance?: number
  /** 滚动到元素（选择器） */
  selector?: string
  /** 滚动到页面顶部 */
  toTop?: boolean
  /** 滚动到页面底部 */
  toBottom?: boolean
}

/** 悬停结果 */
export interface HoverResult {
  url: string
  title: string
}

/** 选择下拉框结果 */
export interface SelectResult {
  url: string
  title: string
  selected: string[]  // 选中的值
}

/** 返回结果 */
export interface BackResult {
  url: string
  title: string
  navigated: boolean
}

/** JS 执行结果 */
export interface EvaluateResult {
  url: string
  title: string
  result: unknown  // JS 执行返回值
}

/** 弹窗处理结果 */
export interface DialogResult {
  handled: boolean
  dialogType: string
  message: string
}

/** 文件上传结果 */
export interface UploadResult {
  url: string
  title: string
  uploaded: string[]  // 上传的文件名
}

/** 标签页信息 */
export interface TabInfo {
  index: number
  url: string
  title: string
  active: boolean
}

/** 标签页操作结果 */
export interface TabsResult {
  action: "list" | "new" | "close" | "switch"
  tabs: TabInfo[]
  activeIndex: number
}
