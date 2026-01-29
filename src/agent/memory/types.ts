/**
 * Memory 类型定义
 */

/**
 * 情景记忆：记录任务执行经验
 */
export interface Episode {
  id: string
  task: string                    // 用户任务描述
  steps: EpisodeStep[]            // 执行步骤
  success: boolean
  summary?: string                // 摘要
  tags: string[]                  // 标签，用于检索
  timestamp: number
}

export interface EpisodeStep {
  tool: string
  args: Record<string, unknown>
  result: string
  duration?: number
}

/**
 * 事实记忆：存储知识和偏好
 */
export interface Fact {
  id: string
  type: "website" | "preference" | "knowledge"
  key: string                     // 如 "chatgpt.com/input-selector"
  value: string
  timestamp: number
}

/**
 * 完整的记忆数据
 */
export interface MemoryData {
  episodes: Episode[]
  facts: Fact[]
  version: number
}

/**
 * 默认空记忆
 */
export const EMPTY_MEMORY: MemoryData = {
  episodes: [],
  facts: [],
  version: 1
}
