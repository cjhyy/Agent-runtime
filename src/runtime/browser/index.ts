/**
 * 浏览器模块统一导出
 *
 * 模块结构:
 * - types.ts      - 类型定义
 * - stealth.ts    - 反检测配置
 * - core.ts       - 生命周期管理
 * - operations.ts - 页面操作
 * - cookies.ts    - Cookie/Session 管理
 * - tabs.ts       - 标签页/弹窗管理
 */

// 类型导出
export type {
  BrowserConfig,
  GotoResult,
  ClickResult,
  TypeResult,
  PressResult,
  SnapshotResult,
  CookieInfo,
  SessionData,
  LoginResult,
  CookiesFormattedResult,
  SessionImportResult,
  // 新增类型
  WaitResult,
  WaitOptions,
  ScrollResult,
  ScrollOptions,
  HoverResult,
  SelectResult,
  BackResult,
  EvaluateResult,
  UploadResult,
  TabInfo,
  TabsResult,
  DialogResult,
} from "./types.js"

// 核心功能
export {
  setBrowserConfig,
  getBrowserConfig,
  getCurrentUserId,
  getUserProfileDir,
  getSessionDir,
  ensureDir,
  switchUser,
  listUsers,
  initBrowser,
  closeBrowser,
  getPage,
  setActivePage,
  getContext,
  launchLoginMode,
} from "./core.js"

// 页面操作
export {
  browserGoto,
  browserClick,
  browserType,
  browserPress,
  browserScreenshot,
  browserSnapshot,
  // 新增操作
  browserWait,
  browserScroll,
  browserHover,
  browserSelect,
  browserBack,
  browserForward,
  browserEvaluate,
  browserUpload,
  browserReload,
} from "./operations.js"

// 标签页和弹窗管理
export {
  browserTabs,
  browserTabsList,
  browserTabsNew,
  browserTabsClose,
  browserTabsSwitch,
  browserDialog,
  hasPendingDialog,
  getPendingDialogInfo,
  setupDialogHandler,
} from "./tabs.js"

// Cookie/Session 管理
export {
  getCookies,
  getCookiesFormatted,
  setCookies,
  clearCookies,
  clearCookiesForDomain,
  exportSession,
  importSession,
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
} from "./cookies.js"
