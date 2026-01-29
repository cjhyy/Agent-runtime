/**
 * Prompt Builder 类型定义
 */

import type { Skill } from "../skills/types.js"
import type { Episode, Fact } from "../memory/types.js"

/**
 * Prompt 构建上下文
 */
export interface PromptContext {
  task: string                    // 当前任务
  skills: Skill[]                 // 匹配的技能
  episodes: Episode[]             // 相关经验
  facts: Fact[]                   // 相关事实
}

/**
 * Prompt 模板配置
 */
export interface PromptConfig {
  basePrompt: string              // 基础系统提示
  skillSectionTitle: string       // 技能部分标题
  memorySectionTitle: string      // 记忆部分标题
  maxSkills: number               // 最大技能数量
  maxEpisodes: number             // 最大经验数量
}

/**
 * 默认配置
 */
export const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  basePrompt: `你是一个智能助手，可以通过工具完成各种任务。

## 工具使用原则

1. 仔细分析用户的需求，选择合适的工具
2. 如果一个工具失败了，尝试其他方法
3. 完成任务后，向用户报告结果
4. 如果无法完成任务，诚实地说明原因

## 可用工具

你可以使用以下工具：
- browser_goto: 打开网页
- browser_snapshot: 获取页面快照
- browser_click: 点击元素
- browser_type: 输入文本
- browser_wait: 等待一段时间
- browser_screenshot: 截图保存
- code_execute: 执行 Python 代码
- file_read: 读取文件
- file_write: 写入文件
`,
  skillSectionTitle: "## 相关技能指南",
  memorySectionTitle: "## 历史经验参考",
  maxSkills: 3,
  maxEpisodes: 2
}
