/**
 * Skill 类型定义
 */

export interface Skill {
  name: string           // 唯一标识，如 "chatgpt-query"
  description: string    // 描述，用于匹配任务
  content: string        // markdown 内容（不含 frontmatter）
  filePath: string       // 文件路径
}

export interface SkillMatch {
  skill: Skill
  score: number          // 匹配分数 0-1
}

export interface SkillFrontmatter {
  name: string
  description: string
}
