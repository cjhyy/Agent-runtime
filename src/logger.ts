/**
 * Agent Runtime 结构化日志模块
 * 替代散乱的 console.log/error 调用
 */

/** 日志级别 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/** 日志级别名称映射 */
const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.SILENT]: "SILENT",
}

/** 日志级别颜色 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "\x1b[36m",  // cyan
  [LogLevel.INFO]: "\x1b[32m",   // green
  [LogLevel.WARN]: "\x1b[33m",   // yellow
  [LogLevel.ERROR]: "\x1b[31m",  // red
  [LogLevel.SILENT]: "",
}

const RESET = "\x1b[0m"
const DIM = "\x1b[2m"

/** 日志条目 */
export interface LogEntry {
  level: LogLevel
  module: string
  message: string
  timestamp: Date
  data?: Record<string, unknown>
}

/** 日志配置 */
export interface LoggerConfig {
  /** 最低日志级别 */
  level: LogLevel
  /** 是否启用颜色 */
  colors: boolean
  /** 是否显示时间戳 */
  timestamps: boolean
  /** 是否输出到 stderr（适合 CLI 工具） */
  useStderr: boolean
}

/** 默认配置 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  colors: true,
  timestamps: false,
  useStderr: true,  // CLI 工具通常用 stderr 输出日志
}

/** 全局配置 */
let globalConfig: LoggerConfig = { ...DEFAULT_CONFIG }

/** 设置全局日志配置 */
export function setLogConfig(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config }
}

/** 获取当前日志配置 */
export function getLogConfig(): LoggerConfig {
  return { ...globalConfig }
}

/** 日志器类 */
export class Logger {
  private module: string
  private config: LoggerConfig

  constructor(module: string, config?: Partial<LoggerConfig>) {
    this.module = module
    this.config = { ...globalConfig, ...config }
  }

  /** 更新配置 */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /** 格式化日志消息 */
  private format(level: LogLevel, message: string, data?: Record<string, unknown>): string {
    const { colors, timestamps } = this.config
    const parts: string[] = []

    // 时间戳
    if (timestamps) {
      const time = new Date().toISOString().slice(11, 23)
      parts.push(colors ? `${DIM}${time}${RESET}` : time)
    }

    // 级别
    const levelName = LEVEL_NAMES[level].padEnd(5)
    if (colors) {
      parts.push(`${LEVEL_COLORS[level]}${levelName}${RESET}`)
    } else {
      parts.push(levelName)
    }

    // 模块
    const moduleStr = `[${this.module}]`
    parts.push(colors ? `${DIM}${moduleStr}${RESET}` : moduleStr)

    // 消息
    parts.push(message)

    // 附加数据（过滤敏感信息）
    if (data && Object.keys(data).length > 0) {
      const safeData = this.sanitizeData(data)
      parts.push(colors ? `${DIM}${JSON.stringify(safeData)}${RESET}` : JSON.stringify(safeData))
    }

    return parts.join(" ")
  }

  /** 过滤敏感数据 */
  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ["password", "token", "key", "secret", "cookie", "authorization", "api_key", "apikey"]
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase()
      if (sensitiveKeys.some(k => lowerKey.includes(k))) {
        result[key] = "[REDACTED]"
      } else if (typeof value === "string" && value.length > 100) {
        result[key] = value.slice(0, 100) + "..."
      } else {
        result[key] = value
      }
    }

    return result
  }

  /** 输出日志 */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (level < this.config.level) return

    const formatted = this.format(level, message, data)
    const output = this.config.useStderr ? console.error : console.log
    output(formatted)
  }

  /** DEBUG 级别 */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data)
  }

  /** INFO 级别 */
  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data)
  }

  /** WARN 级别 */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data)
  }

  /** ERROR 级别 */
  error(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, data)
  }

  /** 记录错误对象 */
  logError(err: unknown, context?: string): void {
    if (err instanceof Error) {
      this.error(context ? `${context}: ${err.message}` : err.message, {
        name: err.name,
        stack: err.stack?.split("\n").slice(0, 3).join(" | "),
      })
    } else {
      this.error(context ? `${context}: ${String(err)}` : String(err))
    }
  }

  /** 创建子 Logger */
  child(subModule: string): Logger {
    return new Logger(`${this.module}:${subModule}`, this.config)
  }
}

/** 创建模块 Logger 的快捷函数 */
export function createLogger(module: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger(module, config)
}

// ===== 预定义的模块 Logger =====
export const browserLogger = createLogger("Browser")
export const agentLogger = createLogger("Agent")
export const cliLogger = createLogger("CLI")
export const mcpLogger = createLogger("MCP")
