/**
 * @agent-runtime/agent
 *
 * LLM agent core powered by mem-deep-research framework.
 * Config files are in packages/agent/config/ (adjacent to this package).
 */

import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import {
  AgentFactory,
  type MessageHistoryEntry,
  type TaskContext,
  type OnProgressCallback,
} from "mem-deep-research"

// ESM __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * packages/agent/ 根目录
 * 编译后 dist/index.js 在 packages/agent/dist/，所以向上一级到 packages/agent/
 * config/ 在 packages/agent/config/
 */
const PACKAGE_ROOT = resolve(__dirname, "..")

/** hooks 是否已加载 */
let hooksLoaded = false

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type {
  ResearchResult,
  MessageHistoryEntry,
  TaskContext,
  OnProgressCallback,
} from "mem-deep-research"

export {
  DeepResearch,
  AgentFactory,
  HookRegistry,
  hooks,
  ToolManager,
  SkillMatcher,
  SkillInjector,
  ContextManager,
  ExecutionMonitor,
} from "mem-deep-research"

export { MemoryManager } from "./memory/index.js"
export { SkillLearner, type LearnedSkill } from "./skills/learner.js"

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface AgentConfig {
  /** 自定义 projectDir（默认使用本 package 根目录） */
  projectDir?: string
  /** 详细日志 */
  verbose?: boolean
  /** 外部 MCP Server 实例映射（name → MCP Server），用于 inprocess transport */
  mcpServers?: Record<string, unknown>
}

export interface AgentResult {
  response: string
  status: "completed" | "failed"
  durationSeconds: number
  error?: string
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class Agent {
  private factory: AgentFactory
  private verbose: boolean
  private projectDir: string
  private history: MessageHistoryEntry[] = []

  constructor(config: AgentConfig = {}) {
    this.projectDir = resolve(config.projectDir || PACKAGE_ROOT)
    this.verbose = config.verbose ?? false

    // 使用 fromProjectDir 加载 YAML 配置
    // 通过 _mcpServers extra 传递外部 MCP Server 实例，
    // 在 buildServerConfigs 中被 inprocess transport 的工具配置引用
    this.factory = AgentFactory.fromProjectDir(this.projectDir)

    // 如果有外部 mcpServers，注入到 factory 的 configExtras 中
    if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
      // AgentFactory.fromProjectDir 返回的实例的 configExtras 包含 _projectDir
      // 通过 (factory as any) 注入 _mcpServers —— 在 pipeline 的 buildServerConfigs 中读取
      ;(this.factory as any).configExtras._mcpServers = config.mcpServers
    }

    if (this.verbose) {
      console.error("[Agent] Initialized from", this.projectDir)
    }
  }

  /**
   * 确保 hooks 已加载（首次 run 时调用）
   */
  private async ensureHooks(): Promise<void> {
    if (!hooksLoaded) {
      const { registerHooks } = await import("./hooks.js")
      const { hooks } = await import("mem-deep-research")
      registerHooks(hooks)
      hooksLoaded = true
    }
  }

  /**
   * 执行任务（单轮，追加到对话历史）
   */
  async run(
    userMessage: string,
    options?: {
      context?: TaskContext
      onProgress?: OnProgressCallback
    }
  ): Promise<AgentResult> {
    await this.ensureHooks()

    if (this.verbose) {
      console.error(`[Agent] Running: "${userMessage.slice(0, 100)}"`)
    }

    const result = await this.factory.run(userMessage, {
      history: this.history,
      context: options?.context,
      onProgress: options?.onProgress,
    })

    // 追加到对话历史，支持多轮
    this.history.push({ role: "user", content: userMessage })
    this.history.push({ role: "assistant", content: result.finalAnswer })

    return {
      response: result.finalAnswer || "(无回答)",
      status: result.status,
      durationSeconds: result.durationSeconds,
      error: result.error,
    }
  }

  /** 清空对话历史 */
  clearHistory(): void {
    this.history = []
  }

  /** 关闭 Agent，释放资源 */
  async close(): Promise<void> {
    if (this.verbose) {
      console.error("[Agent] Closing")
    }
  }
}

/** 创建 Agent 实例 */
export function createAgent(config: AgentConfig = {}): Agent {
  return new Agent(config)
}
