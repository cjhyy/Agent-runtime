/**
 * Runtime 模块统一导出
 * 提供浏览器、代码执行、文件操作的能力
 */

// 浏览器操作
export {
  initBrowser,
  closeBrowser,
  setBrowserConfig,
  launchLoginMode,
  browserGoto,
  browserClick,
  browserType,
  browserPress,
  browserSnapshot,
  browserScreenshot,
  // Cookie 管理
  getCookies,
  getCookiesFormatted,
  setCookies,
  clearCookies,
  clearCookiesForDomain,
  // Session 管理
  exportSession,
  importSession,
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  // 用户管理
  getCurrentUserId,
  switchUser,
  listUsers,
  type BrowserConfig,
  type GotoResult,
  type ClickResult,
  type TypeResult,
  type PressResult,
  type SnapshotResult,
  type CookieInfo,
  type SessionData,
  type LoginResult
} from "./browser.js"

// 代码执行
export { runCode, type CodeRunResult } from "./code-executor.js"

// 文件操作
export {
  fileRead,
  fileWrite,
  fileList,
  type FileReadResult,
  type FileWriteResult,
  type FileListResult
} from "./file-ops.js"

// 类型定义
export * from "./types.js"
