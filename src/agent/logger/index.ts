/**
 * TaskLogger
 * 为每个任务生成 Markdown 日志文件
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { TaskLog, StepLog, LoggerConfig } from "./types.js"
import { DEFAULT_LOGGER_CONFIG } from "./types.js"

export class TaskLogger {
  private config: LoggerConfig
  private currentLog: TaskLog | null = null
  private logDir: string

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_LOGGER_CONFIG, ...config }
    this.logDir = this.expandHome(this.config.logDir)
  }

  /**
   * 开始一个新任务
   */
  async startTask(task: string): Promise<string> {
    // 确保日志目录存在
    await this.ensureLogDir()

    const id = this.generateId()
    this.currentLog = {
      id,
      task,
      startTime: Date.now(),
      steps: [],
      success: false,
      iterations: 0
    }

    console.error(`[Logger] Started task: ${id}`)
    return id
  }

  /**
   * 记录一个步骤
   */
  async logStep(params: {
    tool: string
    args: Record<string, unknown>
    result: string
    duration: number
    screenshot?: Buffer     // 截图数据
  }): Promise<void> {
    if (!this.currentLog) return

    const stepIndex = this.currentLog.steps.length + 1

    // 保存截图
    let screenshotPath: string | undefined
    if (params.screenshot && this.config.enableScreenshots) {
      screenshotPath = await this.saveScreenshot(params.screenshot, stepIndex)
    }

    // 截断过长的结果
    let result = params.result
    if (result.length > this.config.maxResultLength) {
      result = result.slice(0, this.config.maxResultLength) + "\n... (truncated)"
    }

    const step: StepLog = {
      index: stepIndex,
      tool: params.tool,
      args: params.args,
      result,
      duration: params.duration,
      timestamp: Date.now(),
      screenshot: screenshotPath
    }

    this.currentLog.steps.push(step)

    console.error(`[Logger] Step ${stepIndex}: ${params.tool} (${params.duration}ms)`)
  }

  /**
   * 完成任务并生成日志文件
   */
  async finishTask(params: {
    response: string
    success: boolean
    iterations: number
  }): Promise<string> {
    if (!this.currentLog) {
      throw new Error("No task in progress")
    }

    this.currentLog.endTime = Date.now()
    this.currentLog.response = params.response
    this.currentLog.success = params.success
    this.currentLog.iterations = params.iterations

    // 生成 Markdown 文件
    const logPath = await this.generateMarkdown()

    console.error(`[Logger] Task completed: ${logPath}`)

    const result = logPath
    this.currentLog = null
    return result
  }

  /**
   * 生成 Markdown 日志文件
   */
  private async generateMarkdown(): Promise<string> {
    if (!this.currentLog) throw new Error("No task log")

    const log = this.currentLog
    const duration = log.endTime ? log.endTime - log.startTime : 0
    const durationStr = this.formatDuration(duration)

    const lines: string[] = []

    // 标题
    lines.push(`# 任务日志: ${log.task}`)
    lines.push("")

    // 元信息
    lines.push("## 概要")
    lines.push("")
    lines.push(`| 项目 | 值 |`)
    lines.push(`| --- | --- |`)
    lines.push(`| 任务 ID | \`${log.id}\` |`)
    lines.push(`| 状态 | ${log.success ? "✅ 成功" : "❌ 失败"} |`)
    lines.push(`| 开始时间 | ${new Date(log.startTime).toLocaleString("zh-CN")} |`)
    lines.push(`| 总耗时 | ${durationStr} |`)
    lines.push(`| 迭代次数 | ${log.iterations} |`)
    lines.push(`| 步骤数 | ${log.steps.length} |`)
    lines.push("")

    // 执行步骤
    lines.push("## 执行步骤")
    lines.push("")

    for (const step of log.steps) {
      lines.push(`### 步骤 ${step.index}: ${step.tool}`)
      lines.push("")

      // 参数
      if (Object.keys(step.args).length > 0) {
        lines.push("**参数:**")
        lines.push("```json")
        lines.push(JSON.stringify(step.args, null, 2))
        lines.push("```")
        lines.push("")
      }

      // 耗时
      lines.push(`**耗时:** ${step.duration}ms`)
      lines.push("")

      // 截图
      if (step.screenshot) {
        lines.push("**截图:**")
        lines.push("")
        lines.push(`![步骤 ${step.index} 截图](${step.screenshot})`)
        lines.push("")
      }

      // 结果
      lines.push("<details>")
      lines.push("<summary><b>执行结果</b> (点击展开)</summary>")
      lines.push("")
      lines.push("```")
      lines.push(step.result)
      lines.push("```")
      lines.push("")
      lines.push("</details>")
      lines.push("")
      lines.push("---")
      lines.push("")
    }

    // 最终回答
    if (log.response) {
      lines.push("## 最终回答")
      lines.push("")
      lines.push(log.response)
      lines.push("")
    }

    // 写入文件
    const filename = `${log.id}.md`
    const filepath = path.join(this.logDir, filename)
    await fs.writeFile(filepath, lines.join("\n"), "utf-8")

    return filepath
  }

  /**
   * 保存截图
   */
  private async saveScreenshot(data: Buffer, stepIndex: number): Promise<string> {
    if (!this.currentLog) throw new Error("No task log")

    const filename = `${this.currentLog.id}-step${stepIndex}.png`
    const filepath = path.join(this.logDir, filename)

    await fs.writeFile(filepath, data)

    return filename  // 返回相对路径
  }

  /**
   * 确保日志目录存在
   */
  private async ensureLogDir(): Promise<void> {
    await fs.mkdir(this.logDir, { recursive: true })
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, "")
    const time = now.toTimeString().slice(0, 8).replace(/:/g, "")
    const rand = Math.random().toString(36).slice(2, 6)
    return `task-${date}-${time}-${rand}`
  }

  /**
   * 格式化时长
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    const mins = Math.floor(ms / 60000)
    const secs = Math.floor((ms % 60000) / 1000)
    return `${mins}m ${secs}s`
  }

  /**
   * 扩展 ~ 为用户目录
   */
  private expandHome(filepath: string): string {
    if (filepath.startsWith("~")) {
      return path.join(process.env.HOME || "", filepath.slice(1))
    }
    return filepath
  }

  /**
   * 获取当前任务 ID
   */
  getCurrentTaskId(): string | null {
    return this.currentLog?.id || null
  }

  /**
   * 是否有正在进行的任务
   */
  hasActiveTask(): boolean {
    return this.currentLog !== null
  }

  /**
   * 获取日志目录
   */
  getLogDir(): string {
    return this.logDir
  }
}

// 导出类型
export type { TaskLog, StepLog, LoggerConfig } from "./types.js"
