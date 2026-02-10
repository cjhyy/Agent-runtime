/**
 * Agent Runtime
 * 主入口文件
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

// 导出 Agent
export {
  Agent,
  createAgent,
  AGENT_TOOLS,
  executeTool,
  createLLMClient,
  type AgentConfig,
  type AgentResult,
  type Message,
  type Tool,
  type LLMResponse,
} from "./agent/index.js"

// 导出 Runtime
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
} from "./runtime/index.js"
