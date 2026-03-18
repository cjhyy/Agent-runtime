/**
 * Skill Learner
 * 从任务执行中自动学习和更新 Skills
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { Episode, EpisodeStep } from "../memory/types.js"
import type { Skill } from "./types.js"
import { expandHome } from "./loader.js"

export interface SkillLearnerConfig {
  skillsDir: string        // Skills 存储目录
  minSteps: number         // 最少步骤数才记录
  similarityThreshold: number  // 相似度阈值，超过则合并
}

const DEFAULT_CONFIG: SkillLearnerConfig = {
  skillsDir: "./skills",  // 项目目录下的 skills 文件夹
  minSteps: 2,
  similarityThreshold: 0.6
}

export interface LearnedSkill {
  name: string
  description: string
  domain: string           // 域名或任务类型
  steps: SkillStep[]
  examples: string[]       // 示例任务
  tips: string[]           // 总结的技巧
  successCount: number
  failCount: number
  lastUpdated: number
}

export interface SkillStep {
  tool: string
  purpose: string          // 这一步的目的
  selector?: string        // 常用选择器
  note?: string            // 注意事项
}

export class SkillLearner {
  private config: SkillLearnerConfig
  private skillsDir: string

  constructor(config: Partial<SkillLearnerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.skillsDir = expandHome(this.config.skillsDir)
  }

  /**
   * 从一次成功的 Episode 学习
   */
  async learnFromEpisode(episode: Episode): Promise<LearnedSkill | null> {
    // 只学习成功的、有足够步骤的任务
    if (!episode.success || episode.steps.length < this.config.minSteps) {
      return null
    }

    // 提取域名/任务类型
    const domain = this.extractDomain(episode)

    // 查找是否已有相似的 Skill
    const existingSkill = await this.findSimilarSkill(episode.task, domain)

    if (existingSkill) {
      // 更新现有 Skill
      return await this.updateSkill(existingSkill, episode)
    } else {
      // 创建新 Skill
      return await this.createSkill(episode, domain)
    }
  }

  /**
   * 从 Episode 提取域名
   */
  private extractDomain(episode: Episode): string {
    // 从 URL 提取域名
    for (const step of episode.steps) {
      if (step.tool === "browser_goto" && step.args.url) {
        try {
          const url = new URL(step.args.url as string)
          return url.hostname.replace(/^www\./, "")
        } catch {
          // ignore
        }
      }
    }

    // 从任务描述提取关键词
    const keywords = this.extractKeywords(episode.task)
    return keywords[0] || "general"
  }

  /**
   * 查找相似的现有 Skill
   */
  private async findSimilarSkill(task: string, domain: string): Promise<LearnedSkill | null> {
    const skillPath = path.join(this.skillsDir, domain, "skill.json")

    try {
      const content = await fs.readFile(skillPath, "utf-8")
      const skill = JSON.parse(content) as LearnedSkill

      // 同域名的任务默认认为是相似的（可以合并学习）
      // 因为同一个网站的操作模式通常是相似的
      return skill
    } catch {
      // Skill 不存在
    }

    return null
  }

  /**
   * 创建新 Skill
   */
  private async createSkill(episode: Episode, domain: string): Promise<LearnedSkill> {
    const skill: LearnedSkill = {
      name: this.generateSkillName(episode.task, domain),
      description: episode.task,
      domain,
      steps: this.extractSteps(episode.steps),
      examples: [episode.task],
      tips: this.extractTips(episode.steps),
      successCount: 1,
      failCount: 0,
      lastUpdated: Date.now()
    }

    await this.saveSkill(skill)
    console.error(`[SkillLearner] Created new skill: ${skill.name}`)
    return skill
  }

  /**
   * 更新现有 Skill
   */
  private async updateSkill(existing: LearnedSkill, episode: Episode): Promise<LearnedSkill> {
    // 添加新示例（去重）
    if (!existing.examples.includes(episode.task)) {
      existing.examples.push(episode.task)
      // 最多保留 10 个示例
      if (existing.examples.length > 10) {
        existing.examples = existing.examples.slice(-10)
      }
    }

    // 合并步骤（保留共同模式）
    const newSteps = this.extractSteps(episode.steps)
    existing.steps = this.mergeSteps(existing.steps, newSteps)

    // 合并技巧
    const newTips = this.extractTips(episode.steps)
    for (const tip of newTips) {
      if (!existing.tips.includes(tip)) {
        existing.tips.push(tip)
      }
    }
    // 最多保留 10 个技巧
    if (existing.tips.length > 10) {
      existing.tips = existing.tips.slice(-10)
    }

    // 更新计数
    existing.successCount++
    existing.lastUpdated = Date.now()

    await this.saveSkill(existing)
    console.error(`[SkillLearner] Updated skill: ${existing.name} (${existing.successCount} successes)`)
    return existing
  }

  /**
   * 从步骤中提取抽象的步骤模式
   */
  private extractSteps(steps: EpisodeStep[]): SkillStep[] {
    return steps.map(step => {
      const skillStep: SkillStep = {
        tool: step.tool,
        purpose: this.inferPurpose(step)
      }

      // 提取选择器模式
      if (step.args.selector) {
        const selector = step.args.selector as string
        // 保留 ref_N 或 CSS 选择器
        if (!selector.startsWith("ref_")) {
          skillStep.selector = selector
        }
      }

      // 提取注意事项
      if (step.result.includes("Error")) {
        skillStep.note = this.extractErrorNote(step.result)
      }

      return skillStep
    })
  }

  /**
   * 推断步骤目的
   */
  private inferPurpose(step: EpisodeStep): string {
    const purposes: Record<string, string> = {
      browser_goto: `打开页面 ${step.args.url || ""}`,
      browser_click: `点击 ${step.args.selector || "元素"}`,
      browser_type: `输入文本`,
      browser_press: `按下 ${step.args.key || "按键"}`,
      browser_snapshot: "获取页面状态",
      browser_wait: "等待页面加载",
      browser_scroll: "滚动页面",
      browser_select: "选择下拉选项",
      browser_evaluate: "执行 JavaScript",
      code_run: `执行 ${step.args.language || ""} 代码`,
      file_read: "读取文件",
      file_write: "写入文件"
    }

    return purposes[step.tool] || step.tool
  }

  /**
   * 从步骤中提取技巧
   */
  private extractTips(steps: EpisodeStep[]): string[] {
    const tips: string[] = []

    for (const step of steps) {
      // 从错误中学习
      if (step.result.includes("Error") && step.result.includes("timeout")) {
        tips.push("某些元素加载较慢，可能需要等待")
      }
      if (step.result.includes("contenteditable")) {
        tips.push("输入框可能是 contenteditable 类型，需要特殊处理")
      }

      // 从成功操作中学习
      if (step.tool === "browser_wait" && step.args.timeout) {
        tips.push(`页面可能需要等待 ${step.args.timeout}ms 加载`)
      }
      if (step.tool === "browser_type" && step.args.text) {
        const text = step.args.text as string
        if (text.includes("密码") || text.length > 20) {
          tips.push("可能需要输入密码或长文本")
        }
      }
    }

    return [...new Set(tips)]
  }

  /**
   * 合并步骤模式
   */
  private mergeSteps(existing: SkillStep[], newSteps: SkillStep[]): SkillStep[] {
    // 简单合并：保留工具序列的公共部分
    const merged: SkillStep[] = []
    const maxLen = Math.max(existing.length, newSteps.length)

    for (let i = 0; i < maxLen; i++) {
      const old = existing[i]
      const fresh = newSteps[i]

      if (old && fresh && old.tool === fresh.tool) {
        // 相同工具，合并信息
        merged.push({
          tool: old.tool,
          purpose: old.purpose, // 保留原有描述
          selector: old.selector || fresh.selector,
          note: old.note || fresh.note
        })
      } else if (old) {
        merged.push(old)
      } else if (fresh) {
        merged.push(fresh)
      }
    }

    return merged
  }

  /**
   * 从错误信息提取注意事项
   */
  private extractErrorNote(result: string): string {
    if (result.includes("Timeout")) {
      return "可能需要等待元素加载"
    }
    if (result.includes("not found")) {
      return "元素可能不存在或选择器变化"
    }
    return "执行时遇到问题"
  }

  /**
   * 保存 Skill 到文件
   */
  private async saveSkill(skill: LearnedSkill): Promise<void> {
    const skillDir = path.join(this.skillsDir, skill.domain)
    await fs.mkdir(skillDir, { recursive: true })

    // 保存 JSON 数据
    const jsonPath = path.join(skillDir, "skill.json")
    await fs.writeFile(jsonPath, JSON.stringify(skill, null, 2))

    // 生成 Markdown 文档
    const mdPath = path.join(skillDir, "SKILL.md")
    const mdContent = this.generateMarkdown(skill)
    await fs.writeFile(mdPath, mdContent)
  }

  /**
   * 生成 Markdown 文档
   */
  private generateMarkdown(skill: LearnedSkill): string {
    const lines: string[] = []

    // Frontmatter
    lines.push("---")
    lines.push(`name: ${skill.name}`)
    lines.push(`description: ${skill.description}`)
    lines.push("---")
    lines.push("")

    // 标题
    lines.push(`# ${skill.description}`)
    lines.push("")

    // 统计
    lines.push("## 概要")
    lines.push("")
    lines.push(`- **域名**: ${skill.domain}`)
    lines.push(`- **成功次数**: ${skill.successCount}`)
    lines.push(`- **最后更新**: ${new Date(skill.lastUpdated).toLocaleString("zh-CN")}`)
    lines.push("")

    // 执行步骤
    lines.push("## 执行步骤")
    lines.push("")
    for (let i = 0; i < skill.steps.length; i++) {
      const step = skill.steps[i]
      lines.push(`${i + 1}. **${step.tool}**: ${step.purpose}`)
      if (step.selector) {
        lines.push(`   - 选择器: \`${step.selector}\``)
      }
      if (step.note) {
        lines.push(`   - 注意: ${step.note}`)
      }
    }
    lines.push("")

    // 技巧
    if (skill.tips.length > 0) {
      lines.push("## 技巧与注意事项")
      lines.push("")
      for (const tip of skill.tips) {
        lines.push(`- ${tip}`)
      }
      lines.push("")
    }

    // 示例任务
    lines.push("## 示例任务")
    lines.push("")
    for (const example of skill.examples.slice(0, 5)) {
      lines.push(`- ${example}`)
    }
    lines.push("")

    return lines.join("\n")
  }

  /**
   * 生成 Skill 名称
   */
  private generateSkillName(task: string, domain: string): string {
    const keywords = this.extractKeywords(task)
    const nameParts = [domain, ...keywords.slice(0, 2)]
    return nameParts.join("-").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5-]/g, "")
  }

  /**
   * 提取关键词
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
   * 计算文本相似度（简单的 Jaccard 相似度）
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(this.extractKeywords(text1.toLowerCase()))
    const words2 = new Set(this.extractKeywords(text2.toLowerCase()))

    if (words1.size === 0 || words2.size === 0) return 0

    let intersection = 0
    for (const word of words1) {
      if (words2.has(word)) {
        intersection++
      }
    }

    const union = words1.size + words2.size - intersection
    return intersection / union
  }

  /**
   * 记录失败的任务（用于学习避免错误）
   */
  async recordFailure(episode: Episode): Promise<void> {
    const domain = this.extractDomain(episode)
    const skillPath = path.join(this.skillsDir, domain, "skill.json")

    try {
      const content = await fs.readFile(skillPath, "utf-8")
      const skill = JSON.parse(content) as LearnedSkill

      skill.failCount++
      skill.lastUpdated = Date.now()

      // 从失败中提取教训
      for (const step of episode.steps) {
        if (step.result.includes("Error")) {
          const tip = `避免: ${this.extractErrorNote(step.result)}`
          if (!skill.tips.includes(tip)) {
            skill.tips.push(tip)
          }
        }
      }

      await this.saveSkill(skill)
      console.error(`[SkillLearner] Recorded failure for: ${skill.name}`)
    } catch {
      // Skill 不存在，跳过
    }
  }

  /**
   * 获取 Skills 目录
   */
  getSkillsDir(): string {
    return this.skillsDir
  }

  /**
   * 列出所有学习到的 Skills
   */
  async listLearnedSkills(): Promise<LearnedSkill[]> {
    const skills: LearnedSkill[] = []

    try {
      const entries = await fs.readdir(this.skillsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(this.skillsDir, entry.name, "skill.json")
          try {
            const content = await fs.readFile(skillPath, "utf-8")
            skills.push(JSON.parse(content))
          } catch {
            // 跳过无效的
          }
        }
      }
    } catch {
      // 目录不存在
    }

    return skills.sort((a, b) => b.successCount - a.successCount)
  }
}
