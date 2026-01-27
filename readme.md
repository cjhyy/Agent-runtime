# Agent Runtime

> 一个 LLM 友好的安全沙箱执行环境，让 AI Agent 能够在隔离容器中完成浏览器操作、代码执行和文件管理。

> **当前仓库状态**：以“设计 + 文档”为主（MVP 代码尚未完全落地）。本文档会持续作为实现参考；实现完成后会补充可运行的 Quickstart 与验收用例。

## 文档入口（docs）

- `docs/index.md`：文档总览与阅读路径
- `docs/01-architecture.md`：整体架构与时序
- `docs/02-mcp-server.md`：MCP Server（Node.js）设计与 tool 映射
- `docs/03-sandbox-manager.md`：Docker 沙箱生命周期与资源限制
- `docs/04-rpc-protocol.md`：RPC 协议、错误与超时约定
- `docs/05-container-server.md`：容器内 RPC Server（Playwright / 执行器 / 文件系统）
- `docs/06-browser.md`：浏览器能力（goto/click/type/snapshot）
- `docs/07-code-execution.md`：代码执行（python/shell）（MVP：先跑通）
- `docs/08-file-ops.md`：文件系统 API（read/write/list）（MVP：按 /workspace 约定）
- `docs/09-docker-image.md`：Docker 镜像设计（依赖、用户、体积与缓存）
- `docs/10-security.md`：安全（后续版本占位）
- `docs/11-dev-guide.md`：开发、调试与联调（Claude Desktop）
- `docs/12-troubleshooting.md`：常见问题排查

> 说明：你当前的目标是 **MVP 先跑通**，因此安全相关内容暂时仅作为后续方向（见 `docs/10-security.md`）。

## 背景

### 问题

当前 LLM Agent 需要执行复杂任务时（如"帮我去某网站搜索信息并保存到文件"），面临以下挑战：

1. **安全隔离**：直接在宿主机执行代码/操作浏览器存在安全风险
2. **环境统一**：代码执行、浏览器、文件系统分散在不同工具中
3. **LLM 不友好**：现有工具返回的信息对 LLM 不够结构化

### 解决方案

Agent Runtime 提供一个 **All-in-One 沙箱环境**：

- 所有操作在 Docker 容器内执行，与宿主机隔离
- 统一的 MCP 接口，LLM 通过 Tool 调用完成所有操作
- 返回结构化、LLM 可理解的结果

### 灵感来源

- [CodeAct](https://arxiv.org/abs/2402.01030) - 用代码作为 Agent Action 空间
- [WebArena](https://arxiv.org/abs/2307.13854) - Web Agent 环境设计
- [E2B](https://github.com/e2b-dev/E2B) - 云端代码沙箱
- [browser-use](https://github.com/browser-use/browser-use) - LLM 浏览器控制

---

## 功能特性

### MVP 核心功能

| 功能 | 说明 |
|------|------|
| 🌐 浏览器操作 | 打开网页、点击、输入、截图、获取页面内容 |
| 🐍 代码执行 | 执行 Python、Shell 脚本 |
| 📁 文件管理 | 读写文件、列出目录 |
| 🔒 安全隔离 | 所有操作在 Docker 容器内执行 |
| 🔌 MCP 协议 | 原生支持 Claude Desktop 等 MCP 客户端 |

### 设计原则

- **LLM 优先**：接口设计以 LLM 易用性为核心
- **最小 MVP**：只实现核心功能，快速验证
- **本地优先**：家用电脑即可运行，无需云服务

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────┐
│            Claude Desktop / MCP Client              │
└─────────────────────────┬───────────────────────────┘
                          │ MCP Protocol (stdio)
                          ▼
┌─────────────────────────────────────────────────────┐
│                MCP Server (Node.js)                 │
│                                                     │
│  • 接收 Tool 调用请求                                │
│  • 管理 Docker 容器生命周期                          │
│  • 转发指令到容器内 RPC Server                       │
└─────────────────────────┬───────────────────────────┘
                          │ Docker API + TCP:9999
                          ▼
┌─────────────────────────────────────────────────────┐
│              Sandbox Container (Docker)             │
│                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  Playwright │ │   Python    │ │  /workspace │   │
│  │  (Browser)  │ │  Executor   │ │   (Files)   │   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
│                         │                           │
│  ┌─────────────────────────────────────────────┐   │
│  │          RPC Server (TCP port 9999)         │   │
│  │     接收指令 → 执行 → 返回 JSON 结果          │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 通信流程

```
1. Claude 调用 Tool: browser_goto { url: "https://github.com" }
2. MCP Server 收到请求
3. MCP Server 通过 TCP 发送 RPC 请求到容器
4. 容器内 RPC Server 执行 Playwright 操作
5. 返回结果: { url: "...", title: "..." }
6. MCP Server 返回给 Claude
```

---

## 项目结构

```
agent-runtime/
├── readme.md
├── docs/                       # 详细技术文档（从这里开始读）
│   └── index.md
├── package.json
├── tsconfig.json
├── docker/
│   └── Dockerfile              # 沙箱容器镜像
├── src/
│   ├── index.ts                # MCP Server 入口
│   ├── sandbox.ts              # Docker 容器管理
│   ├── rpc-client.ts           # RPC 客户端（与容器通信）
│   └── types.ts                # TypeScript 类型定义
└── container/
    ├── package.json
    ├── tsconfig.json
    └── server.ts               # 容器内 RPC Server
```

---

## 技术方案

### 1. MCP Tools 定义

MVP 只实现 **10 个核心 Tools**（命名以动词开头，按能力域分组）：

```typescript
// 沙箱管理
sandbox_create     // 创建沙箱，返回 sandbox_id
sandbox_destroy    // 销毁沙箱

// 浏览器操作
browser_goto       // 导航到 URL
browser_click      // 点击元素（支持 CSS selector 或 ref_id）
browser_type       // 在输入框输入文字（支持 selector 或 ref_id）
browser_snapshot   // 获取页面快照（截图 + 文本 + 可交互元素）

// 代码执行
code_run           // 执行 Python 或 Shell 代码

// 文件操作
file_read          // 读取文件内容
file_write         // 写入文件
file_list          // 列出目录
```

### 2. 类型定义 (src/types.ts)

```typescript
// ===== 沙箱 =====
export interface Sandbox {
  id: string
  containerId: string
  status: "running" | "stopped"
  port: number
}

export interface SandboxConfig {
  memory?: string      // 默认 "512m"
  cpu?: number         // 默认 1
  timeout?: number     // 默认 3600 秒
}

// ===== RPC 通信 =====
export interface RPCRequest {
  method: string
  params: Record<string, any>
}

export interface RPCError {
  code: string        // 错误码：BAD_REQUEST / NOT_FOUND / TIMEOUT / INTERNAL
  message: string     // 可读错误信息
}

export interface RPCResponse {
  success: boolean
  data?: any
  error?: RPCError    // 结构化错误（详见 docs/04-rpc-protocol.md）
}

// ===== 浏览器 =====
export interface BrowserGotoResult {
  url: string
  title: string
}

export interface BrowserClickResult {
  url: string
  title: string
  navigated: boolean
}

export interface BrowserTypeResult {
  url: string
  title: string
}

export interface BrowserSnapshot {
  url: string
  title: string
  screenshot: string    // base64 PNG（MVP 默认 viewport 截图，非全页）
  text: string          // 页面可见文本（限制 5000 字符）
  elements: string      // 可交互元素列表，格式如下：
                        // [ref_1] button "Sign in"
                        // [ref_2] input[type=text] placeholder="Search"
                        // [ref_3] a "Home" -> https://...
}

// ===== 代码执行 =====
export interface CodeRunParams {
  language: "python" | "shell"
  code: string
}

export interface CodeRunResult {
  success: boolean
  exitCode: number
  stdout: string
  stderr: string
  duration: number      // 毫秒
  killed: boolean       // 是否被超时杀死
}

// ===== 文件操作 =====
export interface FileReadResult {
  content: string
  size: number
}

export interface FileWriteResult {
  success: boolean
  path: string
}

export interface FileListItem {
  name: string
  type: "file" | "directory"
}

export interface FileListResult {
  items: FileListItem[]
}
```

### 3. 沙箱管理 (src/sandbox.ts)

关键实现点：

```typescript
import Docker from "dockerode"
import { nanoid } from "nanoid"

const docker = new Docker()
const IMAGE = "agent-sandbox:mvp"

// MVP 只支持单沙箱
let currentSandbox: Sandbox | null = null

export async function createSandbox(config?: SandboxConfig): Promise<Sandbox> {
  // 如果已有沙箱，先销毁
  if (currentSandbox) {
    await destroySandbox()
  }
  
  const id = nanoid(8)
  
  // 创建容器
  const container = await docker.createContainer({
    Image: IMAGE,
    name: `sandbox-${id}`,
    ExposedPorts: { "9999/tcp": {} },
    HostConfig: {
      // 随机映射端口
      PortBindings: { "9999/tcp": [{ HostPort: "0" }] },
      // 资源限制
      Memory: 512 * 1024 * 1024,
      NanoCpus: 1e9,
      // MVP 先允许网络（后续可配置）
      NetworkMode: "bridge",
    }
  })
  
  await container.start()

  // 获取实际映射的端口
  const info = await container.inspect()
  const portMapping = info.NetworkSettings.Ports["9999/tcp"]
  if (!portMapping || !portMapping[0]) {
    throw new Error("Port mapping failed: 9999/tcp not exposed")
  }
  const port = parseInt(portMapping[0].HostPort)

  // 等待 RPC Server 就绪
  await waitForReady(port)
  
  currentSandbox = { id, containerId: container.id, status: "running", port }
  return currentSandbox
}

export async function destroySandbox(): Promise<void> {
  if (!currentSandbox) return
  
  const container = docker.getContainer(currentSandbox.containerId)
  await container.stop({ t: 5 }).catch(() => {})
  await container.remove().catch(() => {})
  
  currentSandbox = null
}

export function getSandbox(): Sandbox | null {
  return currentSandbox
}
```

### 4. RPC 客户端 (src/rpc-client.ts)

通过 TCP Socket 与容器内 RPC Server 通信：

```typescript
import * as net from "net"

export async function rpcCall(
  port: number,
  method: string,
  params: Record<string, any> = {}
): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket()
    let data = ""
    
    const timeout = setTimeout(() => {
      client.destroy()
      reject(new Error("RPC timeout"))
    }, 30000)
    
    client.connect(port, "127.0.0.1", () => {
      client.write(JSON.stringify({ method, params }) + "\n")
    })
    
    client.on("data", (chunk) => {
      data += chunk.toString()
      if (data.includes("\n")) {
        clearTimeout(timeout)
        client.destroy()
        
        const response = JSON.parse(data.trim())
        if (response.success) {
          resolve(response.data)
        } else {
          const err = response.error
          reject(new Error(err?.message || "Unknown RPC error"))
        }
      }
    })
    
    client.on("error", (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}
```

### 5. MCP Server (src/index.ts)

使用 `@modelcontextprotocol/sdk` 实现：

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

const server = new Server(
  { name: "agent-runtime", version: "0.1.0" },
  { capabilities: { tools: {} } }
)

// 注册 tools/list handler
server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "sandbox_create",
      description: "创建一个新的沙箱环境，包含浏览器、Python 和文件系统",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "browser_goto",
      description: "打开指定网页",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "要打开的 URL" }
        },
        required: ["url"]
      }
    },
    // ... 其他 tools
  ]
}))

// 注册 tools/call handler
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params
  
  // 根据 tool name 调用对应的处理函数
  // 返回 { content: [{ type: "text", text: "..." }] }
})

// 启动
const transport = new StdioServerTransport()
await server.connect(transport)
```

### 6. 容器内 RPC Server (container/server.ts)

关键实现：

```typescript
import { chromium, Browser, Page } from "playwright"
import { spawn } from "child_process"
import * as fs from "fs/promises"
import * as net from "net"

const PORT = 9999
const WORKSPACE = "/workspace"

class SandboxServer {
  private browser: Browser | null = null
  private page: Page | null = null
  
  async start() {
    // 启动 Playwright 浏览器
    this.browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    })
    this.page = await this.browser.newPage()
    
    // 启动 TCP Server 监听 RPC 请求
    const server = net.createServer((socket) => {
      // 处理请求...
    })
    server.listen(PORT, "0.0.0.0")
  }
  
  // browser.snapshot 实现要点：
  // 1. 截图返回 base64
  // 2. 获取 body.innerText 作为页面文本
  // 3. 遍历可交互元素，生成 ref_id 并设置 data-agent-ref 属性
  // 4. 返回格式化的元素列表供 LLM 使用
}
```

### 7. Dockerfile (docker/Dockerfile)

```dockerfile
FROM node:20-slim

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    chromium \
    fonts-liberation fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Playwright（使用 Playwright 自带的 Chromium）
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium

# Python 包（使用虚拟环境避免系统包冲突）
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir requests beautifulsoup4 pandas numpy

# 创建用户
RUN useradd -m sandbox && mkdir -p /workspace /app && chown -R sandbox:sandbox /workspace /app

# 复制 RPC Server
WORKDIR /app
COPY container/ ./
RUN npm install && npx tsc

USER sandbox
WORKDIR /workspace
CMD ["node", "/app/server.js"]
```

---

## 开发计划

### Day 1: 基础框架
- [ ] 初始化项目结构
- [ ] 编写 Dockerfile 并构建镜像
- [ ] 实现容器内 RPC Server（先实现 ping/pong）
- [ ] 实现 MCP Server 框架（能启动，返回 tools 列表）

### Day 2: 核心功能
- [ ] 浏览器：goto, click, type, snapshot
- [ ] 代码执行：python, shell
- [ ] 文件操作：read, write, list

### Day 3: 联调测试
- [ ] 与 Claude Desktop 集成测试
- [ ] 修复发现的 bug
- [ ] 完善错误处理

---

## 使用方式

### 1. 构建镜像

```bash
cd agent-runtime
docker build -t agent-sandbox:mvp -f docker/Dockerfile .
```

### 2. 安装依赖

```bash
npm install
npm run build
```

### 3. 配置 Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（Mac）：

```json
{
  "mcpServers": {
    "agent-runtime": {
      "command": "node",
      "args": ["/path/to/agent-runtime/dist/index.js"]
    }
  }
}
```

### 4. 使用示例

在 Claude Desktop 中（伪代码/流程示意）：

```
用户: 帮我打开 GitHub，搜索 "llm agent"，把前 3 个项目名称保存到文件

Claude 会依次调用:
1. sandbox_create → 创建沙箱
2. browser_goto { url: "https://github.com" }
3. browser_snapshot → 获取页面元素
4. browser_type { selector: "ref_1", text: "llm agent" }
5. browser_click { selector: "ref_2" } → 点击搜索
6. browser_snapshot → 获取搜索结果
7. code_run { language: "python", code: "..." } → 解析结果
8. file_write { path: "repos.txt", content: "..." }
9. sandbox_destroy → 清理
```

---

## 依赖

### MCP Server (Node.js)
- `@modelcontextprotocol/sdk` - MCP 协议 SDK
- `dockerode` - Docker API 客户端
- `nanoid` - ID 生成

### Container
- `playwright` - 浏览器自动化
- `python3` - Python 运行时

---

## 后续计划

| 优先级 | 功能 |
|--------|------|
| P0 | 超时控制、错误恢复 |
| P1 | 网络限制（域名白名单） |
| P1 | 容器池预热 |
| P2 | HTTP API |
| P2 | 多沙箱支持 |
| P3 | 策略引擎、审计日志 |

---

## License

MIT