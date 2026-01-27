/**
 * OpenRouter LLM 客户端
 * 支持 Tool Calling
 */

export interface Message {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string // JSON string
  }
}

export interface Tool {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface LLMResponse {
  content: string | null
  tool_calls?: ToolCall[]
  finish_reason: "stop" | "tool_calls" | "length"
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface LLMConfig {
  apiKey: string
  baseUrl?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export class LLMClient {
  private apiKey: string
  private baseUrl: string
  private model: string
  private temperature: number
  private maxTokens: number

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || "https://openrouter.ai/api/v1"
    this.model = config.model || "anthropic/claude-sonnet-4"
    this.temperature = config.temperature ?? 0.7
    this.maxTokens = config.maxTokens ?? 4096
  }

  async chat(messages: Message[], tools?: Tool[]): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens
    }

    if (tools && tools.length > 0) {
      body.tools = tools
      body.tool_choice = "auto"
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://github.com/agent-runtime",
        "X-Title": "Agent Runtime"
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`LLM API error: ${response.status} ${error}`)
    }

    const data = await response.json() as {
      choices: Array<{
        message: {
          content: string | null
          tool_calls?: ToolCall[]
        }
        finish_reason: string
      }>
      usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
      }
    }

    const choice = data.choices[0]
    return {
      content: choice.message.content,
      tool_calls: choice.message.tool_calls,
      finish_reason: choice.finish_reason as LLMResponse["finish_reason"],
      usage: data.usage
    }
  }

  setModel(model: string): void {
    this.model = model
  }

  setTemperature(temperature: number): void {
    this.temperature = temperature
  }
}

export function createLLMClient(apiKey?: string): LLMClient {
  const key = apiKey || process.env.OPENROUTER_API_KEY
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is required")
  }
  return new LLMClient({ apiKey: key })
}
