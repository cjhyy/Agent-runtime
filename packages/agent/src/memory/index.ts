/**
 * Memory Manager
 * 管理情景记忆和事实记忆
 */

import { Storage } from "./storage.js"
import type { Episode, EpisodeStep, Fact, MemoryData } from "./types.js"

export class MemoryManager {
  private storage: Storage
  private data: MemoryData | null = null

  constructor(dataDir: string = "~/.agent-runtime") {
    this.storage = new Storage(dataDir)
  }

  /**
   * 初始化，加载已有记忆
   */
  async init(): Promise<void> {
    this.data = await this.storage.load()
    console.error(`[Memory] Loaded ${this.data.episodes.length} episodes, ${this.data.facts.length} facts`)
  }

  /**
   * 确保已初始化
   */
  private ensureInit(): MemoryData {
    if (!this.data) {
      throw new Error("MemoryManager not initialized. Call init() first.")
    }
    return this.data
  }

  // ============ Episode 操作 ============

  /**
   * 记录一次任务执行
   */
  async recordEpisode(params: {
    task: string
    steps: EpisodeStep[]
    success: boolean
    summary?: string
    tags?: string[]
  }): Promise<Episode> {
    const data = this.ensureInit()

    const episode: Episode = {
      id: this.generateId(),
      task: params.task,
      steps: params.steps,
      success: params.success,
      summary: params.summary,
      tags: params.tags || this.extractTags(params.task),
      timestamp: Date.now()
    }

    data.episodes.push(episode)
    await this.storage.save(data)

    console.error(`[Memory] Recorded episode: ${episode.id} (${episode.success ? "success" : "failed"})`)
    return episode
  }

  /**
   * 根据任务检索相关经验
   */
  recallEpisodes(task: string, limit = 3): Episode[] {
    const data = this.ensureInit()

    // 计算每个 episode 与当前任务的相关性
    const scored = data.episodes
      .filter(ep => ep.success) // 只返回成功的经验
      .map(ep => ({
        episode: ep,
        score: this.calculateRelevance(task, ep)
      }))
      .filter(item => item.score > 0.1)
      .sort((a, b) => b.score - a.score)

    return scored.slice(0, limit).map(item => item.episode)
  }

  /**
   * 计算任务与经验的相关性
   */
  private calculateRelevance(task: string, episode: Episode): number {
    const taskLower = task.toLowerCase()
    const epTaskLower = episode.task.toLowerCase()

    // 1. 任务描述相似度
    let score = 0
    const taskWords = this.extractKeywords(taskLower)
    const epWords = this.extractKeywords(epTaskLower)

    let matchCount = 0
    for (const word of taskWords) {
      if (epWords.includes(word) || epTaskLower.includes(word)) {
        matchCount++
      }
    }

    if (taskWords.length > 0) {
      score += (matchCount / taskWords.length) * 0.5
    }

    // 2. 标签匹配
    const taskTags = this.extractTags(task)
    let tagMatch = 0
    for (const tag of taskTags) {
      if (episode.tags.includes(tag)) {
        tagMatch++
      }
    }
    if (taskTags.length > 0) {
      score += (tagMatch / taskTags.length) * 0.3
    }

    // 3. 时间衰减（越新的经验权重越高）
    const ageInDays = (Date.now() - episode.timestamp) / (1000 * 60 * 60 * 24)
    const timeBonus = Math.max(0, 0.2 * (1 - ageInDays / 30)) // 30天内有加成
    score += timeBonus

    return Math.min(1, score)
  }

  // ============ Fact 操作 ============

  /**
   * 记录/更新一个事实
   */
  async recordFact(params: {
    type: Fact["type"]
    key: string
    value: string
  }): Promise<Fact> {
    const data = this.ensureInit()

    // 查找是否已存在
    const existingIndex = data.facts.findIndex(
      f => f.type === params.type && f.key === params.key
    )

    const fact: Fact = {
      id: existingIndex >= 0 ? data.facts[existingIndex].id : this.generateId(),
      type: params.type,
      key: params.key,
      value: params.value,
      timestamp: Date.now()
    }

    if (existingIndex >= 0) {
      data.facts[existingIndex] = fact
    } else {
      data.facts.push(fact)
    }

    await this.storage.save(data)
    console.error(`[Memory] Recorded fact: ${params.type}/${params.key}`)
    return fact
  }

  /**
   * 获取一个事实
   */
  getFact(type: Fact["type"], key: string): Fact | undefined {
    const data = this.ensureInit()
    return data.facts.find(f => f.type === type && f.key === key)
  }

  /**
   * 获取某类型的所有事实
   */
  getFactsByType(type: Fact["type"]): Fact[] {
    const data = this.ensureInit()
    return data.facts.filter(f => f.type === type)
  }

  /**
   * 搜索相关事实
   */
  searchFacts(query: string): Fact[] {
    const data = this.ensureInit()
    const queryLower = query.toLowerCase()

    return data.facts.filter(f =>
      f.key.toLowerCase().includes(queryLower) ||
      f.value.toLowerCase().includes(queryLower)
    )
  }

  // ============ 导出为 Skill ============

  /**
   * 将一次成功的 Episode 导出为 Skill 格式
   */
  exportEpisodeAsSkill(episodeId: string): string | null {
    const data = this.ensureInit()
    const episode = data.episodes.find(ep => ep.id === episodeId)

    if (!episode || !episode.success) {
      return null
    }

    // 生成 Skill 名称
    const name = this.generateSkillName(episode.task)

    // 生成步骤描述
    const stepsMarkdown = episode.steps
      .map((step, i) => {
        const argsStr = Object.keys(step.args).length > 0
          ? `\n   参数: \`${JSON.stringify(step.args)}\``
          : ""
        return `${i + 1}. 使用 \`${step.tool}\` 工具${argsStr}`
      })
      .join("\n")

    // 生成 SKILL.md 内容
    const skillContent = `---
name: ${name}
description: ${episode.summary || episode.task}
---

# ${episode.task}

## 执行步骤

${stepsMarkdown}

## 备注

- 原始任务: ${episode.task}
- 记录时间: ${new Date(episode.timestamp).toISOString()}
- 标签: ${episode.tags.join(", ")}
`

    return skillContent
  }

  // ============ 辅助方法 ============

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * 从任务描述提取标签
   */
  private extractTags(task: string): string[] {
    const tags: string[] = []
    const taskLower = task.toLowerCase()

    // 预定义的标签关键词
    const tagKeywords: Record<string, string[]> = {
      "browser": ["浏览器", "网页", "打开", "访问", "browser", "web", "page"],
      "chatgpt": ["chatgpt", "gpt", "openai"],
      "code": ["代码", "执行", "运行", "code", "execute", "run"],
      "file": ["文件", "保存", "读取", "file", "save", "read"],
      "search": ["搜索", "查找", "search", "find"]
    }

    for (const [tag, keywords] of Object.entries(tagKeywords)) {
      for (const keyword of keywords) {
        if (taskLower.includes(keyword)) {
          tags.push(tag)
          break
        }
      }
    }

    return [...new Set(tags)]
  }

  /**
   * 从任务描述提取关键词
   */
  private extractKeywords(text: string): string[] {
    const keywords: string[] = []

    // 中文词组
    const chineseMatches = text.match(/[\u4e00-\u9fa5]{2,4}/g)
    if (chineseMatches) {
      keywords.push(...chineseMatches)
    }

    // 英文单词
    const englishMatches = text.match(/[a-z]{3,}/gi)
    if (englishMatches) {
      keywords.push(...englishMatches.map(w => w.toLowerCase()))
    }

    return [...new Set(keywords)]
  }

  /**
   * 生成 Skill 名称
   */
  private generateSkillName(task: string): string {
    // 提取关键词生成名称
    const keywords = this.extractKeywords(task.toLowerCase())
    if (keywords.length === 0) {
      return `skill-${Date.now()}`
    }

    return keywords.slice(0, 3).join("-")
  }

  /**
   * 获取统计信息
   */
  getStats(): { episodes: number; successRate: number; facts: number } {
    const data = this.ensureInit()
    const successCount = data.episodes.filter(ep => ep.success).length

    return {
      episodes: data.episodes.length,
      successRate: data.episodes.length > 0 ? successCount / data.episodes.length : 0,
      facts: data.facts.length
    }
  }

  /**
   * 获取数据目录
   */
  getDataDir(): string {
    return this.storage.getDataDir()
  }
}

// 导出类型
export type { Episode, EpisodeStep, Fact, MemoryData } from "./types.js"
