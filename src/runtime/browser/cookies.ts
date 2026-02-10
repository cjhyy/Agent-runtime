/**
 * Cookie 和 Session 管理模块
 */

import type { Cookie } from "playwright"
import * as path from "node:path"
import * as fs from "node:fs"
import { TIMEOUTS, LIMITS } from "../../constants.js"
import { browserLogger as logger } from "../../logger.js"
import { getContext, getPage, getSessionDir, ensureDir } from "./core.js"
import type {
  CookieInfo,
  SessionData,
  CookiesFormattedResult,
  SessionImportResult,
} from "./types.js"

// ===== Cookie 操作 =====

/**
 * 获取所有 Cookie
 * @param urls 可选，只获取指定 URL 的 Cookie
 */
export async function getCookies(urls?: string | string[]): Promise<Cookie[]> {
  const ctx = getContext()
  return await ctx.cookies(urls)
}

/**
 * 获取 Cookie 并格式化为易读的列表
 * @param urls 可选，只获取指定 URL 的 Cookie
 */
export async function getCookiesFormatted(
  urls?: string | string[]
): Promise<CookiesFormattedResult> {
  const cookies = await getCookies(urls)

  const list: CookieInfo[] = cookies.map((c) => ({
    name: c.name,
    value:
      c.value.length > LIMITS.COOKIE_VALUE_DISPLAY
        ? c.value.slice(0, LIMITS.COOKIE_VALUE_DISPLAY) + "..."
        : c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
  }))

  // 按域名分组
  const byDomain: Record<string, CookieInfo[]> = {}
  for (const cookie of list) {
    const domain = cookie.domain
    if (!byDomain[domain]) {
      byDomain[domain] = []
    }
    byDomain[domain].push(cookie)
  }

  return {
    total: cookies.length,
    byDomain,
    list,
  }
}

/** 添加 Cookie */
export async function setCookies(cookies: Cookie[]): Promise<void> {
  const ctx = getContext()
  await ctx.addCookies(cookies)
}

/** 清除所有 Cookie */
export async function clearCookies(): Promise<void> {
  const ctx = getContext()
  await ctx.clearCookies()
}

/** 删除指定域名的 Cookie */
export async function clearCookiesForDomain(domain: string): Promise<number> {
  const ctx = getContext()
  const allCookies = await ctx.cookies()
  const toKeep = allCookies.filter((c) => !c.domain.includes(domain))
  const removed = allCookies.length - toKeep.length

  await ctx.clearCookies()
  if (toKeep.length > 0) {
    await ctx.addCookies(toKeep)
  }

  return removed
}

// ===== Session 导入导出 =====

/** 导出 Session（包括 Cookie、localStorage、sessionStorage） */
export async function exportSession(filePath?: string): Promise<SessionData> {
  const ctx = getContext()
  const page = getPage()

  // 获取 cookies
  const cookies = await ctx.cookies()

  // 获取 storage（需要在页面上下文中执行）
  let localStorage: Record<string, string> = {}
  let sessionStorage: Record<string, string> = {}
  let currentUrl: string | undefined

  try {
    currentUrl = page.url()
    const storageData = await page.evaluate(() => {
      const ls: Record<string, string> = {}
      const ss: Record<string, string> = {}

      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key) {
          ls[key] = window.localStorage.getItem(key) || ""
        }
      }

      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i)
        if (key) {
          ss[key] = window.sessionStorage.getItem(key) || ""
        }
      }

      return { localStorage: ls, sessionStorage: ss }
    })

    localStorage = storageData.localStorage
    sessionStorage = storageData.sessionStorage
  } catch (err) {
    logger.debug("Failed to export storage", { error: (err as Error)?.message })
  }

  const sessionData: SessionData = {
    cookies,
    localStorage,
    sessionStorage,
    exportedAt: new Date().toISOString(),
    url: currentUrl,
  }

  // 如果指定了文件路径，保存到文件
  if (filePath) {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath)
    ensureDir(path.dirname(absolutePath))
    fs.writeFileSync(absolutePath, JSON.stringify(sessionData, null, 2), "utf-8")
  }

  return sessionData
}

/** 导入 Session */
export async function importSession(
  filePathOrData: string | SessionData
): Promise<SessionImportResult> {
  const ctx = getContext()
  const page = getPage()

  let sessionData: SessionData

  if (typeof filePathOrData === "string") {
    const absolutePath = path.isAbsolute(filePathOrData)
      ? filePathOrData
      : path.join(process.cwd(), filePathOrData)
    const content = fs.readFileSync(absolutePath, "utf-8")
    sessionData = JSON.parse(content)
  } else {
    sessionData = filePathOrData
  }

  // 导入 cookies
  if (sessionData.cookies && sessionData.cookies.length > 0) {
    await ctx.addCookies(sessionData.cookies)
  }

  // 导入 storage（需要先导航到对应的页面）
  let localStorageKeys = 0
  let sessionStorageKeys = 0

  if (
    sessionData.url &&
    (Object.keys(sessionData.localStorage).length > 0 ||
      Object.keys(sessionData.sessionStorage).length > 0)
  ) {
    try {
      // 导航到原始 URL 以便设置 storage
      await page.goto(sessionData.url, {
        waitUntil: "domcontentloaded",
        timeout: TIMEOUTS.SESSION_IMPORT,
      })

      await page.evaluate(
        (data) => {
          // 设置 localStorage
          for (const [key, value] of Object.entries(data.localStorage)) {
            window.localStorage.setItem(key, value)
          }
          // 设置 sessionStorage
          for (const [key, value] of Object.entries(data.sessionStorage)) {
            window.sessionStorage.setItem(key, value)
          }
        },
        {
          localStorage: sessionData.localStorage,
          sessionStorage: sessionData.sessionStorage,
        }
      )

      localStorageKeys = Object.keys(sessionData.localStorage).length
      sessionStorageKeys = Object.keys(sessionData.sessionStorage).length
    } catch (err) {
      logger.debug("Failed to import storage", { error: (err as Error)?.message })
    }
  }

  return {
    cookiesImported: sessionData.cookies?.length || 0,
    localStorageKeys,
    sessionStorageKeys,
  }
}

// ===== Session 文件管理 =====

/** 保存当前 session 到用户目录 */
export async function saveSession(name: string): Promise<string> {
  const sessionDir = getSessionDir()
  ensureDir(sessionDir)
  const filePath = path.join(sessionDir, `${name}.json`)
  await exportSession(filePath)
  return filePath
}

/** 加载用户目录中的 session */
export async function loadSession(name: string): Promise<SessionImportResult> {
  const sessionDir = getSessionDir()
  const filePath = path.join(sessionDir, `${name}.json`)
  return await importSession(filePath)
}

/** 列出所有保存的 session */
export function listSessions(): string[] {
  const sessionDir = getSessionDir()
  if (!fs.existsSync(sessionDir)) {
    return []
  }
  return fs
    .readdirSync(sessionDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
}

/** 删除保存的 session */
export function deleteSession(name: string): boolean {
  const sessionDir = getSessionDir()
  const filePath = path.join(sessionDir, `${name}.json`)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
    return true
  }
  return false
}
