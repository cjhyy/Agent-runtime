/**
 * Agent Runtime 全局常量配置
 * 统一管理所有魔法数字和硬编码值
 */

// ===== 超时配置 (毫秒) =====
export const TIMEOUTS = {
  /** 浏览器导航超时 */
  BROWSER_GOTO: 30000,
  /** 浏览器点击超时 */
  BROWSER_CLICK: 5000,
  /** 浏览器输入超时 */
  BROWSER_TYPE: 5000,
  /** 代码执行超时 */
  CODE_EXECUTION: 30000,
  /** Session 导入时的页面导航超时 */
  SESSION_IMPORT: 10000,
  /** Cookie 检查间隔 */
  COOKIE_CHECK_INTERVAL: 1000,
} as const

// ===== 大小限制 =====
export const LIMITS = {
  /** 最大标准输出/错误大小 (字节) */
  MAX_STDOUT: 20000,
  /** 快照文本最大长度 */
  MAX_SNAPSHOT_TEXT: 5000,
  /** 文件读取最大大小 (字节) */
  MAX_FILE_SIZE: 200 * 1024,  // 200KB
  /** 最大可交互元素引用数量 */
  MAX_REFS: 50,
  /** Cookie 值显示截断长度 */
  COOKIE_VALUE_DISPLAY: 50,
  /** 元素文本截断长度 */
  ELEMENT_TEXT_TRUNCATE: 50,
  /** 元素文本最大显示长度 */
  ELEMENT_TEXT_MAX_DISPLAY: 40,
  /** 链接 URL 截断长度 */
  HREF_TRUNCATE: 50,
} as const

// ===== 浏览器配置 =====
export const BROWSER_CONFIG = {
  /** 默认视口宽度 */
  VIEWPORT_WIDTH: 1920,
  /** 默认视口高度 */
  VIEWPORT_HEIGHT: 1080,
  /** 登录模式视口宽度 */
  LOGIN_VIEWPORT_WIDTH: 1280,
  /** 登录模式视口高度 */
  LOGIN_VIEWPORT_HEIGHT: 800,
  /** 默认 User-Agent */
  USER_AGENT: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  /** 默认语言 */
  LOCALE: "zh-CN",
  /** 默认时区 */
  TIMEZONE: "Asia/Shanghai",
  /** 默认地理位置 - 上海 */
  GEOLOCATION: { latitude: 31.2304, longitude: 121.4737 },
  /** Chromium 启动参数 */
  LAUNCH_ARGS: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
  ] as const,
} as const

// ===== 路径配置 =====
export const PATHS = {
  /** Agent Runtime 基础目录名 */
  BASE_DIR: ".agent-runtime",
  /** 用户配置文件目录名 */
  PROFILES_DIR: "profiles",
  /** 浏览器数据目录名 */
  BROWSER_DIR: "browser",
  /** Session 数据目录名 */
  SESSIONS_DIR: "sessions",
  /** 默认用户 ID */
  DEFAULT_USER: "default",
} as const

// ===== 可交互元素选择器 =====
export const INTERACTIVE_SELECTORS = [
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
  "#prompt-textarea",  // ChatGPT 特定
] as const

// ===== Agent Ref 系统 =====
export const REF_SYSTEM = {
  /** ref 属性名 */
  ATTRIBUTE: "data-agent-ref",
  /** ref 前缀 */
  PREFIX: "ref_",
} as const

// ===== 版本信息 =====
export const VERSION = "0.2.0"

// ===== 类型导出 =====
export type Timeout = typeof TIMEOUTS[keyof typeof TIMEOUTS]
export type Limit = typeof LIMITS[keyof typeof LIMITS]
