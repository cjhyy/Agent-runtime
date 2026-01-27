/**
 * Agent Core
 * 管理 LLM 对话和工具调用循环
 */

import { LLMClient, createLLMClient, type Message, type ToolCall } from "./llm.js"
import { AGENT_TOOLS } from "./tools.js"
import { executeTool } from "./executor.js"
import { initBrowser, closeBrowser } from "../runtime/index.js"

export interface AgentConfig {
  apiKey?: string
  model?: string
  systemPrompt?: string
  maxIterations?: number
  verbose?: boolean
}

export interface AgentResult {
  response: string
  iterations: number
  toolCalls: Array<{
    name: string
    args: Record<string, unknown>
    result: string
  }>
}

const DEFAULT_SYSTEM_PROMPT = `你是一个智能助手，可以使用以下工具来帮助用户完成任务：

1. 浏览器操作：打开网页、点击元素、输入文字、获取页面快照
2. 代码执行：运行 Python 或 Shell 代码
3. 文件操作：读写文件、列出目录

使用工具时：
- 先用 browser_snapshot 了解页面结构，再进行操作
- 根据返回的 ref_N 标识符选择要操作的元素
- 操作后再次调用 snapshot 确认结果

请简洁地回答用户问题，必要时使用工具获取信息。`

export class Agent {
  private llm: LLMClient
  private systemPrompt: string
  private maxIterations: number
  private verbose: boolean
  private browserInitialized = false

  constructor(config: AgentConfig = {}) {
    this.llm = createLLMClient(config.apiKey)
    if (config.model) {
      this.llm.setModel(config.model)
    }
    this.systemPrompt = config.systemPrompt || DEFAULT_SYSTEM_PROMPT
    this.maxIterations = config.maxIterations || 20
    this.verbose = config.verbose ?? false
  }

  /**
   * 运行 Agent，处理用户消息
   */
  async run(userMessage: string): Promise<AgentResult> {
    // 确保浏览器已初始化
    if (!this.browserInitialized) {
      await initBrowser()
      this.browserInitialized = true
    }

    const messages: Message[] = [
      { role: "system", content: this.systemPrompt },
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
          const result = await this.executeToolCall(toolCall)

          toolCallHistory.push({
            name: toolCall.function.name,
            args: JSON.parse(toolCall.function.arguments || "{}"),
            result: result
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
        return {
          response: response.content || "(无回答)",
          iterations,
          toolCalls: toolCallHistory
        }
      }

      // 异常情况
      if (response.finish_reason === "length") {
        return {
          response: response.content || "(回答被截断)",
          iterations,
          toolCalls: toolCallHistory
        }
      }
    }

    return {
      response: "(达到最大迭代次数)",
      iterations,
      toolCalls: toolCallHistory
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
   * 设置系统提示词
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt
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
