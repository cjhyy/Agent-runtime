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
