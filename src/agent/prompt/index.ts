/**
 * Prompt Builder
 * 动态组装系统提示
 */

import type { Skill } from "../skills/types.js"
import type { Episode, Fact } from "../memory/types.js"
import type { PromptContext, PromptConfig } from "./types.js"
import { DEFAULT_PROMPT_CONFIG } from "./types.js"

export class PromptBuilder {
  private config: PromptConfig

  constructor(config: Partial<PromptConfig> = {}) {
    this.config = { ...DEFAULT_PROMPT_CONFIG, ...config }
  }

  /**
   * 构建完整的系统提示
   */
  build(context: PromptContext): string {
    const sections: string[] = []

    // 1. 基础提示
    sections.push(this.config.basePrompt)

    // 2. 技能部分
    if (context.skills.length > 0) {
      sections.push(this.buildSkillsSection(context.skills))
    }

    // 3. 记忆部分
    if (context.episodes.length > 0 || context.facts.length > 0) {
      sections.push(this.buildMemorySection(context.episodes, context.facts))
    }

    return sections.join("\n\n")
  }

  /**
   * 构建技能部分
   */
  private buildSkillsSection(skills: Skill[]): string {
    const lines: string[] = [this.config.skillSectionTitle]

    for (const skill of skills.slice(0, this.config.maxSkills)) {
      lines.push("")
      lines.push(`### ${skill.name}`)
      lines.push("")
      lines.push(skill.content)
    }

    return lines.join("\n")
  }

  /**
   * 构建记忆部分
   */
  private buildMemorySection(episodes: Episode[], facts: Fact[]): string {
    const lines: string[] = [this.config.memorySectionTitle]

    // 添加相关经验
    if (episodes.length > 0) {
      lines.push("")
      lines.push("### 类似任务的成功经验")
      lines.push("")

      for (const episode of episodes.slice(0, this.config.maxEpisodes)) {
        lines.push(`**任务**: ${episode.task}`)

        if (episode.summary) {
          lines.push(`**总结**: ${episode.summary}`)
        }

        lines.push("**步骤**:")
        for (const step of episode.steps.slice(0, 5)) { // 最多显示 5 步
          const argsPreview = this.formatArgsPreview(step.args)
          lines.push(`  - ${step.tool}${argsPreview}`)
        }

        if (episode.steps.length > 5) {
          lines.push(`  - ... (共 ${episode.steps.length} 步)`)
        }

        lines.push("")
      }
    }

    // 添加相关事实
    if (facts.length > 0) {
      lines.push("")
      lines.push("### 已知信息")
      lines.push("")

      for (const fact of facts) {
        lines.push(`- **${fact.key}**: ${fact.value}`)
      }
    }

    return lines.join("\n")
  }

  /**
   * 格式化参数预览
   */
  private formatArgsPreview(args: Record<string, unknown>): string {
    const keys = Object.keys(args)
    if (keys.length === 0) return ""

    const preview = keys.slice(0, 2).map(k => {
      const value = args[k]
      if (typeof value === "string") {
        return value.length > 30 ? `${value.slice(0, 30)}...` : value
      }
      return String(value)
    }).join(", ")

    return ` (${preview})`
  }

  /**
   * 设置基础提示
   */
  setBasePrompt(prompt: string): void {
    this.config.basePrompt = prompt
  }

  /**
   * 获取配置
   */
  getConfig(): PromptConfig {
    return { ...this.config }
  }

  /**
   * 快速构建（只传任务，技能和记忆为空）
   */
  buildSimple(task: string): string {
    return this.build({
      task,
      skills: [],
      episodes: [],
      facts: []
    })
  }
}

// 导出类型
export type { PromptContext, PromptConfig } from "./types.js"
