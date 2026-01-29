/**
 * Skill Manager
 * 管理技能的加载和匹配
 */

import { loadSkillsFromDir, expandHome } from "./loader.js"
import type { Skill, SkillMatch } from "./types.js"

export class SkillManager {
  private skills: Map<string, Skill> = new Map()
  private loaded = false

  /**
   * 从多个目录加载 Skills
   */
  async loadSkills(dirs: string[]): Promise<void> {
    for (const dir of dirs) {
      const expandedDir = expandHome(dir)
      const skills = await loadSkillsFromDir(expandedDir)

      for (const skill of skills) {
        this.skills.set(skill.name, skill)
      }
    }

    this.loaded = true
    console.error(`[Skills] Loaded ${this.skills.size} skills`)
  }

  /**
   * 根据任务匹配相关 Skills
   */
  matchSkills(task: string, limit = 3): SkillMatch[] {
    const matches: SkillMatch[] = []

    for (const skill of this.skills.values()) {
      const score = this.calculateMatchScore(task, skill.description)
      if (score > 0.1) {
        matches.push({ skill, score })
      }
    }

    // 按分数排序，返回 top N
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * 计算任务与技能描述的匹配分数
   */
  private calculateMatchScore(task: string, description: string): number {
    const taskLower = task.toLowerCase()
    const descLower = description.toLowerCase()

    // 提取关键词（中文按字符，英文按空格分词）
    const keywords = this.extractKeywords(descLower)
    if (keywords.length === 0) return 0

    let matchCount = 0
    let weightedScore = 0

    for (const keyword of keywords) {
      if (taskLower.includes(keyword)) {
        matchCount++
        // 长关键词权重更高
        weightedScore += keyword.length > 2 ? 2 : 1
      }
    }

    // 综合计算：匹配数量 + 加权分数
    const baseScore = matchCount / keywords.length
    const bonusScore = weightedScore / (keywords.length * 2)

    return Math.min(1, baseScore * 0.6 + bonusScore * 0.4)
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    const keywords: string[] = []

    // 提取引号内的触发词（如 "问 ChatGPT"）
    const quotedMatches = text.match(/"([^"]+)"/g)
    if (quotedMatches) {
      for (const match of quotedMatches) {
        keywords.push(match.replace(/"/g, "").toLowerCase())
      }
    }

    // 提取中文词组（2-4个字）
    const chineseMatches = text.match(/[\u4e00-\u9fa5]{2,4}/g)
    if (chineseMatches) {
      keywords.push(...chineseMatches)
    }

    // 提取英文单词（3字符以上）
    const englishMatches = text.match(/[a-z]{3,}/gi)
    if (englishMatches) {
      keywords.push(...englishMatches.map(w => w.toLowerCase()))
    }

    // 去重
    return [...new Set(keywords)]
  }

  /**
   * 获取指定 Skill
   */
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  /**
   * 列出所有 Skills
   */
  listSkills(): Skill[] {
    return Array.from(this.skills.values())
  }

  /**
   * 是否已加载
   */
  isLoaded(): boolean {
    return this.loaded
  }

  /**
   * Skill 数量
   */
  get size(): number {
    return this.skills.size
  }
}

// 导出类型
export type { Skill, SkillMatch } from "./types.js"
