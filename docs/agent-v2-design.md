# Agent V2 技术方案

## 1. 目标

将当前简单的 Agent 升级为具备 **记忆** 和 **技能** 的智能 Agent：

- **Skill 系统**：可复用的任务执行模式，支持内置 + 用户自定义
- **Memory 系统**：记录成功经验，越用越好用
- **动态 Prompt**：根据任务自动注入相关 skill 和记忆

---

## 2. 核心概念

### 2.1 Skill（技能）

Skill 是一个 markdown 文件，描述如何完成某类任务。

**格式**（借鉴 Claude Code）：

```markdown
---
name: skill-name
description: 技能描述，用于自动匹配。当用户说"xxx"时触发。
---

# 技能标题

## 操作步骤
1. ...
2. ...

## 注意事项
- ...
```

**特点**：
- 简洁的 markdown 格式，易于编写和维护
- YAML frontmatter 包含元数据
- `description` 用于自动匹配任务
- 内容在匹配后注入到 system prompt

### 2.2 Memory（记忆）

Memory 记录 Agent 的执行经验，分为两类：

| 类型 | 说明 | 用途 |
|------|------|------|
| **Episode** | 情景记忆，完整的任务执行记录 | 相似任务时参考 |
| **Fact** | 事实记忆，如网站结构、用户偏好 | 快速回忆已知信息 |

**Episode 示例**：
```json
{
  "id": "ep_001",
  "task": "问 ChatGPT 今天天气",
  "success": true,
  "steps": [
    { "tool": "browser_goto", "args": { "url": "https://chatgpt.com" } },
    { "tool": "browser_snapshot", "args": {} },
    { "tool": "browser_type", "args": { "selector": "ref_21", "text": "今天天气" } }
  ],
  "summary": "打开 ChatGPT，输入问题，点击发送，获取回答",
  "timestamp": 1706000000
}
```

### 2.3 Prompt 组装

根据任务动态构建 system prompt：

```
┌─────────────────────────────────────┐
│         System Prompt               │
├─────────────────────────────────────┤
│  1. Base Prompt (基础人设)           │
│  2. Tools Description (工具说明)     │
│  3. Matched Skills (匹配的技能)      │
│  4. Relevant Memory (相关记忆)       │
└─────────────────────────────────────┘
```

---

## 3. 目录结构

```
src/agent/
├── index.ts              # Agent 入口
├── llm.ts                # LLM 客户端（保持不变）
├── tools.ts              # Tool 定义（保持不变）
├── executor.ts           # Tool 执行器（保持不变）
│
├── skills/               # Skill 系统（新增）
│   ├── index.ts          # SkillManager
│   ├── types.ts          # Skill 类型
│   └── loader.ts         # 加载 .md 文件
│
├── memory/               # Memory 系统（新增）
│   ├── index.ts          # MemoryManager
│   ├── types.ts          # Memory 类型
│   └── storage.ts        # JSON 文件存储
│
└── prompt/               # Prompt 构建（新增）
    ├── index.ts          # PromptBuilder
    └── base.ts           # 基础 prompt 模板

# Skill 文件目录
skills/                   # 项目根目录下
├── browser-basics/
│   └── SKILL.md
├── chatgpt-query/
│   └── SKILL.md
└── google-search/
    └── SKILL.md

# 数据存储目录
~/.agent-runtime/         # 用户目录下
├── memory/
│   ├── episodes.json     # 情景记忆
│   └── facts.json        # 事实记忆
└── config.json           # 配置
```

---

## 4. 类型定义

### 4.1 Skill 类型

```typescript
// src/agent/skills/types.ts

interface Skill {
  name: string           // 唯一标识，如 "chatgpt-query"
  description: string    // 描述，用于匹配
  content: string        // markdown 内容（不含 frontmatter）
  filePath: string       // 文件路径
}

interface SkillMatch {
  skill: Skill
  score: number          // 匹配分数 0-1
}
```

### 4.2 Memory 类型

```typescript
// src/agent/memory/types.ts

interface Episode {
  id: string
  task: string                    // 用户任务
  steps: EpisodeStep[]            // 执行步骤
  success: boolean
  summary?: string                // 摘要
  tags: string[]                  // 标签
  timestamp: number
}

interface EpisodeStep {
  tool: string
  args: Record<string, unknown>
  result: string
  duration?: number
}

interface Fact {
  id: string
  type: "website" | "preference" | "knowledge"
  key: string                     // 如 "chatgpt.com/input-selector"
  value: string
  timestamp: number
}
```

---

## 5. 核心模块设计

### 5.1 SkillManager

```typescript
// src/agent/skills/index.ts

class SkillManager {
  private skills: Map<string, Skill> = new Map()

  // 加载所有 skill 文件
  async loadSkills(dirs: string[]): Promise<void> {
    // 1. 扫描目录找到所有 SKILL.md
    // 2. 解析 frontmatter + content
    // 3. 存入 Map
  }

  // 根据任务匹配相关 skill
  matchSkills(task: string, limit = 3): SkillMatch[] {
    // 1. 遍历所有 skill
    // 2. 计算 task 与 skill.description 的相似度
    // 3. 返回 top N 匹配
  }

  // 获取指定 skill
  getSkill(name: string): Skill | undefined

  // 列出所有 skill
  listSkills(): Skill[]
}
```

**匹配算法**（简单版）：

```typescript
function matchScore(task: string, description: string): number {
  const taskLower = task.toLowerCase()
  const descLower = description.toLowerCase()

  // 关键词匹配
  const keywords = descLower.split(/[，,。.、\s]+/).filter(k => k.length > 1)
  let matches = 0
  for (const keyword of keywords) {
    if (taskLower.includes(keyword)) {
      matches++
    }
  }

  return keywords.length > 0 ? matches / keywords.length : 0
}
```

### 5.2 MemoryManager

```typescript
// src/agent/memory/index.ts

class MemoryManager {
  private storage: Storage
  private episodes: Episode[] = []
  private facts: Fact[] = []

  constructor(dataDir: string) {
    this.storage = new Storage(dataDir)
  }

  // 加载记忆
  async load(): Promise<void>

  // 保存记忆
  async save(): Promise<void>

  // 记录成功的任务执行
  async recordEpisode(task: string, steps: EpisodeStep[], success: boolean): Promise<Episode>

  // 检索相关经验
  recallEpisodes(task: string, limit = 3): Episode[]

  // 记录事实
  async recordFact(type: Fact["type"], key: string, value: string): Promise<void>

  // 获取事实
  getFact(key: string): Fact | undefined

  // 将 Episode 导出为 Skill
  exportAsSkill(episodeId: string): string  // 返回 markdown
}
```

### 5.3 PromptBuilder

```typescript
// src/agent/prompt/index.ts

class PromptBuilder {
  constructor(
    private skillManager: SkillManager,
    private memoryManager: MemoryManager
  ) {}

  // 构建完整的 system prompt
  build(task: string): string {
    const parts: string[] = []

    // 1. 基础 prompt
    parts.push(BASE_PROMPT)

    // 2. 工具说明
    parts.push(this.buildToolsSection())

    // 3. 匹配的技能
    const skills = this.skillManager.matchSkills(task)
    if (skills.length > 0) {
      parts.push("\n## 相关技能\n")
      for (const { skill } of skills) {
        parts.push(`### ${skill.name}\n${skill.content}\n`)
      }
    }

    // 4. 相关记忆
    const episodes = this.memoryManager.recallEpisodes(task)
    if (episodes.length > 0) {
      parts.push("\n## 相关经验\n")
      parts.push(this.formatEpisodes(episodes))
    }

    return parts.join("\n")
  }
}
```

### 5.4 Base Prompt

```typescript
// src/agent/prompt/base.ts

export const BASE_PROMPT = `你是一个智能助手，可以使用工具帮助用户完成任务。

## 工作原则

1. 先理解任务，明确目标
2. 操作前先获取当前状态（如 browser_snapshot）
3. 根据返回的 ref_N 标识符选择要操作的元素
4. 每步操作后验证结果
5. 遇到错误时尝试其他方法

## 回答风格

- 简洁明了，直接给出结果
- 必要时说明关键步骤
- 出错时说明原因
`
```

---

## 6. Agent 改造

```typescript
// src/agent/index.ts

class Agent {
  private llm: LLMClient
  private skillManager: SkillManager
  private memoryManager: MemoryManager
  private promptBuilder: PromptBuilder

  constructor(config: AgentConfig) {
    this.llm = createLLMClient(config.apiKey)
    this.skillManager = new SkillManager()
    this.memoryManager = new MemoryManager(config.dataDir)
    this.promptBuilder = new PromptBuilder(this.skillManager, this.memoryManager)
  }

  async init(): Promise<void> {
    // 加载 skills
    await this.skillManager.loadSkills([
      "./skills",                    // 项目 skills
      "~/.agent-runtime/skills"      // 用户 skills
    ])

    // 加载记忆
    await this.memoryManager.load()

    // 初始化浏览器
    await initBrowser()
  }

  async run(task: string): Promise<AgentResult> {
    // 1. 构建动态 prompt
    const systemPrompt = this.promptBuilder.build(task)

    // 2. 执行任务
    const result = await this.executeLoop(systemPrompt, task)

    // 3. 记录结果
    if (result.toolCalls.length > 0) {
      await this.memoryManager.recordEpisode(
        task,
        result.toolCalls.map(c => ({
          tool: c.name,
          args: c.args,
          result: c.result
        })),
        result.success
      )
      await this.memoryManager.save()
    }

    return result
  }
}
```

---

## 7. 内置 Skills

### 7.1 browser-basics

```markdown
---
name: browser-basics
description: 浏览器基础操作指南。当需要操作网页、点击、输入时参考。
---

# 浏览器操作指南

## 工具说明

| 工具 | 用途 |
|------|------|
| `browser_goto` | 打开网页 |
| `browser_snapshot` | 获取页面结构和可交互元素 |
| `browser_click` | 点击元素 |
| `browser_type` | 在输入框输入文字 |

## 操作流程

1. **打开页面**：`browser_goto({ url: "https://..." })`
2. **获取结构**：`browser_snapshot()` 返回可交互元素列表
3. **识别元素**：从返回的 `[ref_N]` 中选择目标
4. **执行操作**：`browser_click` 或 `browser_type`
5. **验证结果**：再次 `browser_snapshot` 确认

## 元素选择

snapshot 返回的元素格式：
```
[ref_1] button "Login"
[ref_2] input[type=text] placeholder="Search"
[ref_3] div[contenteditable]#prompt-textarea
```

使用 `ref_N` 作为 selector 参数。
```

### 7.2 chatgpt-query

```markdown
---
name: chatgpt-query
description: 使用 ChatGPT 提问。当用户说"问 ChatGPT"、"用 ChatGPT"、"让 ChatGPT 回答"时使用。
---

# ChatGPT 查询

## 步骤

1. 打开 `https://chatgpt.com`
2. 等待 2 秒，调用 `browser_snapshot`
3. 找到输入框（`div[contenteditable]#prompt-textarea`）
4. 如果有弹窗，先关闭
5. `browser_type` 输入问题
6. `browser_snapshot` 找到发送按钮（`data-testid="send-button"`）
7. `browser_click` 点击发送
8. 等待 10-15 秒
9. `browser_snapshot` 获取回答

## 提取回答

从页面文本中找 "ChatGPT said:" 后面的内容。
```

### 7.3 code-execution

```markdown
---
name: code-execution
description: 执行代码。当需要运行 Python 或 Shell 脚本、计算、数据处理时使用。
---

# 代码执行

## 工具

`code_run({ language: "python" | "shell", code: "..." })`

## Python 示例

```python
# 计算
print(1 + 1)

# 文件处理
with open("data.txt") as f:
    print(f.read())

# HTTP 请求
import requests
r = requests.get("https://api.example.com")
print(r.json())
```

## Shell 示例

```bash
# 文件操作
ls -la
cat file.txt

# 系统信息
uname -a
```

## 注意

- 工作目录为 `/workspace`
- 超时 30 秒
- 输出限制 20KB
```

---

## 8. 实现计划

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| **Phase 1** | Skill 系统 + Prompt 分离 | P0 |
| **Phase 2** | Memory 系统（记录 + 检索） | P0 |
| **Phase 3** | 内置 Skills | P1 |
| **Phase 4** | Episode 导出为 Skill | P2 |

---

## 9. 配置

```typescript
interface AgentConfig {
  apiKey?: string                // OpenRouter API Key
  model?: string                 // 模型名称

  // Skill 配置
  skillDirs?: string[]           // Skill 目录列表

  // Memory 配置
  dataDir?: string               // 数据存储目录，默认 ~/.agent-runtime
  enableMemory?: boolean         // 是否启用记忆，默认 true

  // 其他
  verbose?: boolean
  maxIterations?: number
}
```

---

## 10. 使用示例

```typescript
const agent = createAgent({
  skillDirs: ["./skills"],
  dataDir: "~/.agent-runtime",
  enableMemory: true
})

await agent.init()

// 第一次：Agent 根据 skill 指导完成任务
const result1 = await agent.run("问 ChatGPT 今天天气怎么样")
// → 匹配 chatgpt-query skill，按指导执行

// 第二次：Agent 有了经验，更快更准
const result2 = await agent.run("用 ChatGPT 查一下明天天气")
// → 匹配 skill + 相关记忆

// 导出成功经验为新 skill
const skillMd = agent.exportEpisodeAsSkill("ep_001")
fs.writeFileSync("./skills/weather-query/SKILL.md", skillMd)
```
