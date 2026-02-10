/**
 * 浏览器隐身/反检测模块
 * 统一管理 stealth 相关配置和脚本注入
 */

import { chromium } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import type { Page, LaunchOptions, BrowserContextOptions } from "playwright"
import { BROWSER_CONFIG } from "../../constants.js"

// 添加 stealth 插件来绕过 bot 检测
chromium.use(StealthPlugin())

/** 导出带 stealth 插件的 chromium */
export { chromium }

/** 获取 Chromium 启动参数 */
export function getLaunchArgs(windowSize?: { width: number; height: number }): string[] {
  const args: string[] = [...BROWSER_CONFIG.LAUNCH_ARGS]
  const size = windowSize || { width: BROWSER_CONFIG.VIEWPORT_WIDTH, height: BROWSER_CONFIG.VIEWPORT_HEIGHT }
  args.push(`--window-size=${size.width},${size.height}`)
  return args
}

/** 获取默认的浏览器启动选项 */
export function getDefaultLaunchOptions(headless: boolean): LaunchOptions {
  return {
    headless,
    args: getLaunchArgs(),
  }
}

/** 获取默认的浏览器上下文选项 */
export function getDefaultContextOptions(): BrowserContextOptions {
  return {
    viewport: {
      width: BROWSER_CONFIG.VIEWPORT_WIDTH,
      height: BROWSER_CONFIG.VIEWPORT_HEIGHT,
    },
    userAgent: BROWSER_CONFIG.USER_AGENT,
    locale: BROWSER_CONFIG.LOCALE,
    timezoneId: BROWSER_CONFIG.TIMEZONE,
    permissions: ["geolocation"],
    geolocation: BROWSER_CONFIG.GEOLOCATION,
  }
}

/** 获取持久化上下文选项 */
export function getPersistentContextOptions(
  headless: boolean,
  viewport?: { width: number; height: number }
): Parameters<typeof chromium.launchPersistentContext>[1] {
  const vp = viewport || { width: BROWSER_CONFIG.VIEWPORT_WIDTH, height: BROWSER_CONFIG.VIEWPORT_HEIGHT }
  return {
    headless,
    args: getLaunchArgs(vp),
    viewport: vp,
    userAgent: BROWSER_CONFIG.USER_AGENT,
    locale: BROWSER_CONFIG.LOCALE,
    timezoneId: BROWSER_CONFIG.TIMEZONE,
  }
}

/** 获取登录模式的上下文选项 */
export function getLoginModeOptions(): Parameters<typeof chromium.launchPersistentContext>[1] {
  return getPersistentContextOptions(false, {
    width: BROWSER_CONFIG.LOGIN_VIEWPORT_WIDTH,
    height: BROWSER_CONFIG.LOGIN_VIEWPORT_HEIGHT,
  })
}

/**
 * 注入 stealth 脚本
 * 隐藏自动化检测标志
 */
export async function injectStealthScripts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // 删除 webdriver 标志
    Object.defineProperty(navigator, "webdriver", { get: () => undefined })

    // 模拟真实的 chrome 对象
    const mockChrome = {
      runtime: {},
      loadTimes: function () {},
      csi: function () {},
      app: {},
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
      get: () => [1, 2, 3, 4, 5],
    })
    Object.defineProperty(navigator, "languages", {
      get: () => ["zh-CN", "zh", "en"],
    })
  })
}
