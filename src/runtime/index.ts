/**
 * Runtime 模块统一导出
 * 提供浏览器、代码执行、文件操作的能力
 */

// 浏览器操作 (从拆分后的模块导入)
export {
  initBrowser,
  closeBrowser,
  setBrowserConfig,
  getBrowserConfig,
  launchLoginMode,
  browserGoto,
  browserClick,
  browserType,
  browserPress,
  browserSnapshot,
  browserScreenshot,
  // 新增浏览器操作
  browserWait,
  browserScroll,
  browserHover,
  browserSelect,
  browserBack,
  browserForward,
  browserReload,
  browserEvaluate,
  browserUpload,
  // 标签页和弹窗
  browserTabs,
  browserDialog,
  hasPendingDialog,
  getPendingDialogInfo,
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
  // 类型
  type BrowserConfig,
  type GotoResult,
  type ClickResult,
  type TypeResult,
  type PressResult,
  type SnapshotResult,
  type CookieInfo,
  type SessionData,
  type LoginResult,
  type CookiesFormattedResult,
  type SessionImportResult,
  // 新增类型
  type WaitResult,
  type WaitOptions,
  type ScrollResult,
  type ScrollOptions,
  type HoverResult,
  type SelectResult,
  type BackResult,
  type EvaluateResult,
  type UploadResult,
  type TabInfo,
  type TabsResult,
  type DialogResult,
} from "./browser/index.js"

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
