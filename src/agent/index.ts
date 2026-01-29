/**
 * Agent Core V2
 * 集成 Skills、Memory、动态 Prompt 构建和任务日志
 */

import { LLMClient, createLLMClient, type Message, type ToolCall } from "./llm.js"
import { AGENT_TOOLS } from "./tools.js"
import { executeTool } from "./executor.js"
import { initBrowser, closeBrowser, browserScreenshot } from "../runtime/index.js"
import { SkillManager } from "./skills/index.js"
import { MemoryManager, type EpisodeStep } from "./memory/index.js"
import { PromptBuilder } from "./prompt/index.js"
import { TaskLogger } from "./logger/index.js"

export interface AgentConfig {
  apiKey?: string
  model?: string
  systemPrompt?: string
  maxIterations?: number
  verbose?: boolean
  // V2 新增配置
  dataDir?: string              // 数据目录，默认 ~/.agent-runtime
  skillDirs?: string[]          // 技能目录列表
  enableMemory?: boolean        // 是否启用记忆，默认 true
  enableSkills?: boolean        // 是否启用技能，默认 true
  // 日志配置
  enableLogging?: boolean       // 是否启用任务日志，默认 true
  logDir?: string               // 日志目录，默认 ./logs
}

export interface AgentResult {
  response: string
  iterations: number
  toolCalls: Array<{
    name: string
    args: Record<string, unknown>
    result: string
    duration?: number
  }>
  episodeId?: string            // 如果记录了经验，返回 ID
  logFile?: string              // 日志文件路径
}

// 浏览器相关的工具名称
const BROWSER_TOOLS = new Set([
  "browser_goto",
  "browser_click",
  "browser_type",
  "browser_press",
  "browser_snapshot"
])

export class Agent {
  private llm: LLMClient
  private maxIterations: number
  private verbose: boolean
  private browserInitialized = false

  // V2 新增模块
  private skillManager: SkillManager
  private memoryManager: MemoryManager
  private promptBuilder: PromptBuilder
  private taskLogger: TaskLogger
  private enableMemory: boolean
  private enableSkills: boolean
  private enableLogging: boolean
  private initialized = false

  constructor(config: AgentConfig = {}) {
    this.llm = createLLMClient(config.apiKey)
    if (config.model) {
      this.llm.setModel(config.model)
    }
    this.maxIterations = config.maxIterations || 20
    this.verbose = config.verbose ?? false

    // V2 初始化
    this.enableMemory = config.enableMemory ?? true
    this.enableSkills = config.enableSkills ?? true
    this.enableLogging = config.enableLogging ?? true

    this.skillManager = new SkillManager()
    this.memoryManager = new MemoryManager(config.dataDir || "~/.agent-runtime")
    this.promptBuilder = new PromptBuilder()
    this.taskLogger = new TaskLogger({ logDir: config.logDir || "./logs" })

    // 如果提供了自定义系统提示，设置到 PromptBuilder
    if (config.systemPrompt) {
      this.promptBuilder.setBasePrompt(config.systemPrompt)
    }
  }

  /**
   * 初始化 Agent（加载 Skills 和 Memory）
   */
  async init(skillDirs?: string[]): Promise<void> {
    if (this.initialized) return

    // 加载技能
    if (this.enableSkills) {
      const dirs = skillDirs || [
        "./skills",                           // 项目目录
        "~/.agent-runtime/skills"             // 用户目录
      ]
      await this.skillManager.loadSkills(dirs)
    }

    // 加载记忆
    if (this.enableMemory) {
      await this.memoryManager.init()
    }

    this.initialized = true
  }

  /**
   * 运行 Agent，处理用户消息
   */
  async run(userMessage: string): Promise<AgentResult> {
    // 确保已初始化
    if (!this.initialized) {
      await this.init()
    }

    // 确保浏览器已初始化
    if (!this.browserInitialized) {
      await initBrowser()
      this.browserInitialized = true
    }

    // 开始任务日志
    if (this.enableLogging) {
      await this.taskLogger.startTask(userMessage)
    }

    // 构建动态系统提示
    const systemPrompt = await this.buildSystemPrompt(userMessage)

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ]

    const toolCallHistory: AgentResult["toolCalls"] = []
    let iterations = 0

    while (iterations < this.maxIterations) {
      iterations++

      if (this.verbose) {
        console.log(`\n[Agent] Iteration ${iterations}`)
      }

      // 调用 LLM
      const response = await this.llm.chat(messages, AGENT_TOOLS)

      if (this.verbose && response.usage) {
        console.log(`[Agent] Tokens: ${response.usage.total_tokens}`)
      }

      // 如果有工具调用
      if (response.tool_calls && response.tool_calls.length > 0) {
        // 添加 assistant 消息（包含 tool_calls）
        messages.push({
          role: "assistant",
          content: response.content,
          tool_calls: response.tool_calls
        })

        // 执行每个工具调用
        for (const toolCall of response.tool_calls) {
          const startTime = Date.now()
          const toolName = toolCall.function.name
          const args = JSON.parse(toolCall.function.arguments || "{}")

          const result = await this.executeToolCall(toolCall)
          const duration = Date.now() - startTime

          // 如果是浏览器操作，获取截图
          let screenshot: Buffer | undefined
          if (this.enableLogging && BROWSER_TOOLS.has(toolName)) {
            try {
              screenshot = await browserScreenshot()
            } catch {
              // 截图失败，忽略
            }
          }

          // 记录到日志
          if (this.enableLogging) {
            await this.taskLogger.logStep({
              tool: toolName,
              args,
              result,
              duration,
              screenshot
            })
          }

          toolCallHistory.push({
            name: toolName,
            args,
            result,
            duration
          })

          // 添加工具结果消息
          messages.push({
            role: "tool",
            content: result,
            tool_call_id: toolCall.id
          })
        }

        continue
      }

      // 没有工具调用，返回最终回答
      if (response.finish_reason === "stop" || response.content) {
        const result: AgentResult = {
          response: response.content || "(无回答)",
          iterations,
          toolCalls: toolCallHistory
        }

        // 记录成功经验
        if (this.enableMemory && toolCallHistory.length > 0) {
          result.episodeId = await this.recordEpisode(userMessage, toolCallHistory, true)
        }

        // 完成任务日志
        if (this.enableLogging) {
          result.logFile = await this.taskLogger.finishTask({
            response: result.response,
            success: true,
            iterations
          })
        }

        return result
      }

      // 异常情况
      if (response.finish_reason === "length") {
        const result: AgentResult = {
          response: response.content || "(回答被截断)",
          iterations,
          toolCalls: toolCallHistory
        }

        if (this.enableLogging) {
          result.logFile = await this.taskLogger.finishTask({
            response: result.response,
            success: false,
            iterations
          })
        }

        return result
      }
    }

    const result: AgentResult = {
      response: "(达到最大迭代次数)",
      iterations,
      toolCalls: toolCallHistory
    }

    if (this.enableLogging) {
      result.logFile = await this.taskLogger.finishTask({
        response: result.response,
        success: false,
        iterations
      })
    }

    return result
  }

  /**
   * 构建动态系统提示
   */
  private async buildSystemPrompt(task: string): Promise<string> {
    // 匹配相关技能
    const skills = this.enableSkills
      ? this.skillManager.matchSkills(task, 3).map(m => m.skill)
      : []

    // 检索相关经验
    const episodes = this.enableMemory
      ? this.memoryManager.recallEpisodes(task, 2)
      : []

    // 检索相关事实
    const facts = this.enableMemory
      ? this.memoryManager.searchFacts(task).slice(0, 5)
      : []

    if (this.verbose) {
      console.log(`[Agent] Matched ${skills.length} skills, ${episodes.length} episodes, ${facts.length} facts`)
    }

    return this.promptBuilder.build({
      task,
      skills,
      episodes,
      facts
    })
  }

  /**
   * 记录执行经验
   */
  private async recordEpisode(
    task: string,
    toolCalls: AgentResult["toolCalls"],
    success: boolean
  ): Promise<string | undefined> {
    if (!this.enableMemory) return undefined

    try {
      const steps: EpisodeStep[] = toolCalls.map(tc => ({
        tool: tc.name,
        args: tc.args,
        result: tc.result.slice(0, 500), // 截断结果
        duration: tc.duration
      }))

      const episode = await this.memoryManager.recordEpisode({
        task,
        steps,
        success
      })

      return episode.id
    } catch (error) {
      console.error("[Agent] Failed to record episode:", error)
      return undefined
    }
  }

  /**
   * 执行单个工具调用
   */
  private async executeToolCall(toolCall: ToolCall): Promise<string> {
    const name = toolCall.function.name
    const argsStr = toolCall.function.arguments || "{}"
    const args = JSON.parse(argsStr)

    if (this.verbose) {
      console.log(`[Tool] ${name}(${JSON.stringify(args)})`)
    }

    const result = await executeTool(name, args)

    if (this.verbose) {
      const preview = result.output.slice(0, 200)
      console.log(`[Tool] Result: ${preview}${result.output.length > 200 ? "..." : ""}`)
    }

    return result.output
  }

  /**
   * 关闭 Agent，释放资源
   */
  async close(): Promise<void> {
    if (this.browserInitialized) {
      await closeBrowser()
      this.browserInitialized = false
    }
  }

  /**
   * 设置模型
   */
  setModel(model: string): void {
    this.llm.setModel(model)
  }

  /**
   * 设置系统提示词（设置到 PromptBuilder）
   */
  setSystemPrompt(prompt: string): void {
    this.promptBuilder.setBasePrompt(prompt)
  }

  // ============ V2 新增 API ============

  /**
   * 获取 SkillManager
   */
  getSkillManager(): SkillManager {
    return this.skillManager
  }

  /**
   * 获取 MemoryManager
   */
  getMemoryManager(): MemoryManager {
    return this.memoryManager
  }

  /**
   * 获取 PromptBuilder
   */
  getPromptBuilder(): PromptBuilder {
    return this.promptBuilder
  }

  /**
   * 获取 TaskLogger
   */
  getTaskLogger(): TaskLogger {
    return this.taskLogger
  }

  /**
   * 记录一个事实
   */
  async recordFact(type: "website" | "preference" | "knowledge", key: string, value: string): Promise<void> {
    if (this.enableMemory) {
      await this.memoryManager.recordFact({ type, key, value })
    }
  }

  /**
   * 导出经验为 Skill
   */
  exportEpisodeAsSkill(episodeId: string): string | null {
    return this.memoryManager.exportEpisodeAsSkill(episodeId)
  }

  /**
   * 获取统计信息
   */
  getStats(): { skills: number; episodes: number; facts: number; successRate: number } {
    const memStats = this.memoryManager.getStats()
    return {
      skills: this.skillManager.size,
      episodes: memStats.episodes,
      facts: memStats.facts,
      successRate: memStats.successRate
    }
  }
}

/**
 * 创建 Agent 实例
 */
export function createAgent(config: AgentConfig = {}): Agent {
  return new Agent(config)
}

// 导出类型和工具
export { AGENT_TOOLS } from "./tools.js"
export { executeTool } from "./executor.js"
export { createLLMClient, type Message, type Tool, type LLMResponse } from "./llm.js"

// 导出 V2 模块
export { SkillManager } from "./skills/index.js"
export { MemoryManager } from "./memory/index.js"
export { PromptBuilder } from "./prompt/index.js"
export { TaskLogger } from "./logger/index.js"
