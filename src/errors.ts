/**
 * Agent Runtime 自定义错误类
 * 统一错误处理和分类
 */

/** 错误代码枚举 */
export enum ErrorCode {
  // 浏览器相关
  BROWSER_NOT_INITIALIZED = "BROWSER_NOT_INITIALIZED",
  BROWSER_LAUNCH_FAILED = "BROWSER_LAUNCH_FAILED",
  BROWSER_NAVIGATION_FAILED = "BROWSER_NAVIGATION_FAILED",
  BROWSER_ELEMENT_NOT_FOUND = "BROWSER_ELEMENT_NOT_FOUND",
  BROWSER_TIMEOUT = "BROWSER_TIMEOUT",

  // Cookie/Session 相关
  COOKIE_OPERATION_FAILED = "COOKIE_OPERATION_FAILED",
  SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
  SESSION_IMPORT_FAILED = "SESSION_IMPORT_FAILED",
  SESSION_EXPORT_FAILED = "SESSION_EXPORT_FAILED",

  // 文件相关
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_READ_FAILED = "FILE_READ_FAILED",
  FILE_WRITE_FAILED = "FILE_WRITE_FAILED",
  PATH_TRAVERSAL = "PATH_TRAVERSAL",

  // 代码执行相关
  CODE_EXECUTION_FAILED = "CODE_EXECUTION_FAILED",
  CODE_EXECUTION_TIMEOUT = "CODE_EXECUTION_TIMEOUT",
  INVALID_LANGUAGE = "INVALID_LANGUAGE",

  // Agent 相关
  LLM_API_ERROR = "LLM_API_ERROR",
  TOOL_NOT_FOUND = "TOOL_NOT_FOUND",
  TOOL_EXECUTION_FAILED = "TOOL_EXECUTION_FAILED",

  // 通用
  INVALID_ARGUMENT = "INVALID_ARGUMENT",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/** 基础错误类 */
export class AgentError extends Error {
  readonly code: ErrorCode
  readonly cause?: Error
  readonly context?: Record<string, unknown>

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      cause?: Error
      context?: Record<string, unknown>
    }
  ) {
    super(message)
    this.name = "AgentError"
    this.code = code
    this.cause = options?.cause
    this.context = options?.context

    // 保持正确的原型链
    Object.setPrototypeOf(this, new.target.prototype)
  }

  /** 转换为 JSON 格式 */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      cause: this.cause?.message,
    }
  }
}

/** 浏览器相关错误 */
export class BrowserError extends AgentError {
  constructor(
    code: ErrorCode,
    message: string,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(code, message, options)
    this.name = "BrowserError"
  }

  /** 浏览器未初始化 */
  static notInitialized(): BrowserError {
    return new BrowserError(
      ErrorCode.BROWSER_NOT_INITIALIZED,
      "Browser not initialized. Call initBrowser() first."
    )
  }

  /** 导航失败 */
  static navigationFailed(url: string, cause?: Error): BrowserError {
    return new BrowserError(
      ErrorCode.BROWSER_NAVIGATION_FAILED,
      `Failed to navigate to: ${url}`,
      { cause, context: { url } }
    )
  }

  /** 元素未找到 */
  static elementNotFound(selector: string): BrowserError {
    return new BrowserError(
      ErrorCode.BROWSER_ELEMENT_NOT_FOUND,
      `Element not found: ${selector}`,
      { context: { selector } }
    )
  }

  /** 操作超时 */
  static timeout(operation: string, timeout: number): BrowserError {
    return new BrowserError(
      ErrorCode.BROWSER_TIMEOUT,
      `Browser operation timed out: ${operation} (${timeout}ms)`,
      { context: { operation, timeout } }
    )
  }
}

/** Session/Cookie 相关错误 */
export class SessionError extends AgentError {
  constructor(
    code: ErrorCode,
    message: string,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(code, message, options)
    this.name = "SessionError"
  }

  /** Session 未找到 */
  static notFound(name: string): SessionError {
    return new SessionError(
      ErrorCode.SESSION_NOT_FOUND,
      `Session not found: ${name}`,
      { context: { name } }
    )
  }

  /** 导入失败 */
  static importFailed(path: string, cause?: Error): SessionError {
    return new SessionError(
      ErrorCode.SESSION_IMPORT_FAILED,
      `Failed to import session from: ${path}`,
      { cause, context: { path } }
    )
  }
}

/** 文件操作相关错误 */
export class FileError extends AgentError {
  constructor(
    code: ErrorCode,
    message: string,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(code, message, options)
    this.name = "FileError"
  }

  /** 路径遍历攻击 */
  static pathTraversal(path: string): FileError {
    return new FileError(
      ErrorCode.PATH_TRAVERSAL,
      `Path traversal not allowed: ${path}`,
      { context: { path } }
    )
  }
}

/** 代码执行相关错误 */
export class ExecutionError extends AgentError {
  constructor(
    code: ErrorCode,
    message: string,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(code, message, options)
    this.name = "ExecutionError"
  }

  /** 执行超时 */
  static timeout(language: string, timeout: number): ExecutionError {
    return new ExecutionError(
      ErrorCode.CODE_EXECUTION_TIMEOUT,
      `Code execution timed out (${language}): ${timeout}ms`,
      { context: { language, timeout } }
    )
  }
}

/** 工具函数：安全地包装错误 */
export function wrapError(err: unknown, defaultCode = ErrorCode.UNKNOWN_ERROR): AgentError {
  if (err instanceof AgentError) {
    return err
  }

  if (err instanceof Error) {
    return new AgentError(defaultCode, err.message, { cause: err })
  }

  return new AgentError(defaultCode, String(err))
}

/** 工具函数：检查是否为特定错误码 */
export function isErrorCode(err: unknown, code: ErrorCode): boolean {
  return err instanceof AgentError && err.code === code
}
