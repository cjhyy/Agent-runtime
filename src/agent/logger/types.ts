/**
 * TaskLogger 类型定义
 */

/**
 * 单个步骤的日志
 */
export interface StepLog {
  index: number
  tool: string
  args: Record<string, unknown>
  result: string
  duration: number
  timestamp: number
  screenshot?: string          // 截图文件路径（相对于日志文件）
}

/**
 * 完整的任务日志
 */
export interface TaskLog {
  id: string
  task: string
  startTime: number
  endTime?: number
  steps: StepLog[]
  response?: string
  success: boolean
  iterations: number
}

/**
 * Logger 配置
 */
export interface LoggerConfig {
  logDir: string               // 日志目录
  enableScreenshots: boolean   // 是否启用截图
  maxResultLength: number      // 结果最大长度（超过截断）
}

/**
 * 默认配置
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  logDir: "./logs",
  enableScreenshots: true,
  maxResultLength: 2000
}
