/**
 * Skill 文件加载器
 * 解析 SKILL.md 文件
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { Skill, SkillFrontmatter } from "./types.js"

/**
 * 解析 SKILL.md 文件
 */
export async function parseSkillFile(filePath: string): Promise<Skill | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8")
    return parseSkillContent(content, filePath)
  } catch {
    return null
  }
}

/**
 * 解析 Skill 内容
 */
export function parseSkillContent(content: string, filePath: string): Skill | null {
  // 解析 YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!frontmatterMatch) {
    return null
  }

  const frontmatterStr = frontmatterMatch[1]
  const markdownContent = frontmatterMatch[2].trim()

  // 简单解析 YAML（不引入依赖）
  const frontmatter = parseSimpleYaml(frontmatterStr)
  if (!frontmatter.name || !frontmatter.description) {
    return null
  }

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    content: markdownContent,
    filePath
  }
}

/**
 * 简单的 YAML 解析（只支持 key: value 格式）
 */
function parseSimpleYaml(yaml: string): SkillFrontmatter {
  const result: Record<string, string> = {}

  for (const line of yaml.split("\n")) {
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (match) {
      result[match[1]] = match[2].trim()
    }
  }

  return result as unknown as SkillFrontmatter
}

/**
 * 扫描目录加载所有 Skill
 */
export async function loadSkillsFromDir(dir: string): Promise<Skill[]> {
  const skills: Skill[] = []

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFile = path.join(dir, entry.name, "SKILL.md")
        const skill = await parseSkillFile(skillFile)
        if (skill) {
          skills.push(skill)
        }
      }
    }
  } catch {
    // 目录不存在，忽略
  }

  return skills
}

/**
 * 扩展 ~ 为用户目录
 */
export function expandHome(filepath: string): string {
  if (filepath.startsWith("~")) {
    return path.join(process.env.HOME || "", filepath.slice(1))
  }
  return filepath
}
