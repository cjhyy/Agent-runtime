# 01 架构设计

## 目标与边界

### 目标

- **安全隔离**：所有“有副作用”的执行（浏览器、代码、文件）都发生在容器内
- **统一能力面**：对 MCP Client 暴露少量、稳定、结构化的 tools
- **LLM 友好**：输出尽量可直接被 LLM 消费（少歧义、可解析、含必要上下文）

### 非目标（MVP）

- 多沙箱并发与队列调度（后续再做）
- 细粒度网络策略（先默认允许网络，后续加白名单/策略引擎）
- 审计日志与策略引擎（P3）

## 组件

### 组件列表

- **MCP Client**：Claude Desktop / 其他 MCP 宿主
- **MCP Server（Node.js）**：实现 MCP 协议 + tools；管理 Docker 容器；转发 RPC
- **Sandbox Container（Docker）**：执行环境（Playwright、Python、Shell、/workspace）
- **RPC Server（容器内）**：TCP 9999，接受 JSON 请求，执行并返回 JSON 响应

## 数据流与时序

### 典型时序：打开网页并抓取

1. `sandbox_create`
2. `browser_goto { url }`
3. `browser_snapshot` → 返回 `{ screenshot, text, elements }`
4. `browser_click` / `browser_type` → 继续交互
5. `sandbox_destroy`

### 通信链路

- MCP Client ↔ MCP Server：MCP stdio
- MCP Server ↔ Container：Docker API + TCP（容器端口映射到宿主随机端口）
- MCP Server ↔ RPC Server：TCP（宿主 `127.0.0.1:hostPort`）

## 状态模型

### 单沙箱（MVP）

MVP 只维护一个 `currentSandbox`：

- **创建**：若已存在，先销毁旧沙箱，再创建新容器
- **运行**：容器内维护浏览器实例与当前 page（单 page）
- **销毁**：停止容器并 remove；MCP Server 清空 `currentSandbox`

### 容器内状态（核心）

容器内 RPC Server 需要维护：

- `browser: Browser | null`
- `page: Page | null`
- `workspaceRoot: "/workspace"`
- `refRegistry`（可选）：用于 `snapshot` 的 ref 稳定性与 selector 映射

## 错误处理策略（总览）

- MCP Server 负责将所有错误转换为“可读的文本”返回（MCP 标准 `content`）
- 容器 RPC 返回结构化 error（见 `04-rpc-protocol.md`），MCP Server 决定呈现
- 关键分类：
  - **用户入参错误**（400-ish）：缺字段、类型不匹配、非法路径
  - **环境错误**（500-ish）：容器未就绪、RPC 超时、浏览器崩溃
  - **可恢复错误**：例如点击失败可引导用户先 snapshot 再重试

## 关键设计取舍

### 为什么用 TCP RPC 而不是 HTTP

- 实现简单，依赖更少
- 容器内仅需 `net` 监听即可
- MVP 易落地；后续要扩展为 HTTP 也可以

### 为什么 snapshot 里要有“可交互元素列表”

LLM 在没有 DOM 的情况下最难的是“如何点击/输入到正确的元素”。`elements` 列表提供：

- ref（稳定标识）
- 元素类型（button/input/a 等）
- 文本/placeholder/aria-label 等可辨识信息

使得 LLM 可以先 snapshot 再做精确交互。

