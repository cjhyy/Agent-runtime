/**
 * Agent Runtime
 * 独立的浏览器自动化基础设施包
 *
 * 提供:
 * - MCP Server: Playwright headless 浏览器工具 (headless_*)
 * - MCP Server: SDK Bridge 页面控制工具 (page_*)
 * - AgentServer: 统一 HTTP + WebSocket 入口
 * - Runtime: 浏览器操作、代码执行、文件操作的底层 API
 * - 常量、错误、日志等基础模块
 */

// 导出常量
export * from "./constants.js"

// 导出错误类
export * from "./errors.js"

// 导出日志模块
export {
  Logger,
  createLogger,
  LogLevel,
  setLogConfig,
  getLogConfig,
  type LogEntry,
  type LoggerConfig,
} from "./logger.js"

// 导出 MCP Server (Playwright + SDK Bridge)
export {
  createPlaywrightServer,
  getToolDefinitions,
  type PlaywrightServerOptions,
  createSDKBridgeServer,
  getSDKBridgeToolDefinitions,
  SDKConnectionManager,
  type SDKBridgeServerOptions,
  type SDKCommand,
  type SDKResponse,
  type SDKEvent,
} from "./mcp/index.js"

// 导出 AgentServer
export { AgentServer, type AgentServerConfig } from "./server/index.js"

// 导出 Runtime (底层 API, 供直接调用或自定义 MCP Server)
export {
  // 浏览器
  initBrowser,
  closeBrowser,
  setBrowserConfig,
  getBrowserConfig,
  browserGoto,
  browserClick,
  browserType,
  browserPress,
  browserSnapshot,
  browserScreenshot,
  browserWait,
  browserScroll,
  browserHover,
  browserSelect,
  browserBack,
  browserForward,
  browserReload,
  browserEvaluate,
  browserUpload,
  launchLoginMode,
  // Cookie/Session
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
  // 用户管理
  getCurrentUserId,
  switchUser,
  listUsers,
  // 代码执行
  runCode,
  // 文件操作
  fileRead,
  fileWrite,
  fileList,
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
  type WaitResult,
  type WaitOptions,
  type ScrollResult,
  type ScrollOptions,
  type HoverResult,
  type SelectResult,
  type BackResult,
  type EvaluateResult,
  type UploadResult,
} from "./runtime/index.js"
