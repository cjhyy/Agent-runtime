# 05 容器内 RPC Server

本章描述容器内 `container/server.ts` 的职责、模块拆分、状态管理与生命周期。容器内服务是“真正执行副作用”的地方：浏览器、代码执行、文件系统读写。

## 职责

- TCP 监听 `9999`
- 解析一行 JSON 请求（`{ method, params }`）
- 将请求路由到对应 handler
- 执行并返回一行 JSON 响应（`{ success, data|error }`）
- 维护运行时状态：浏览器实例、page、ref 标识等

## 进程与用户

容器应以非 root 用户运行（例如 `sandbox`）：

- 降低权限（即使逃逸漏洞也能缩小危害面）
- `/workspace` 归属 `sandbox` 用户并可写

## 模块拆分（建议）

建议在 `server.ts` 内部按能力域拆分成若干 handler（即便都在一个文件中也要逻辑分块）：

- `BrowserController`
  - `goto`
  - `click`
  - `type`
  - `snapshot`
- `CodeExecutor`
  - `run(language, code, opts)`
- `FileService`
  - `read(path)`
  - `write(path, content)`
  - `list(path)`

并由一个 `RpcRouter` 做 method → handler 映射（白名单路由）。

## 生命周期

### 启动

- 初始化 TCP Server
- 启动 Playwright browser（headless）
- 创建 `page`
- 进入监听状态

### 关闭（可选）

MVP 可依赖容器 stop 来终止进程；更完整的实现建议支持：

- `SIGTERM`：优雅关闭
  - 关闭 page
  - 关闭 browser
  - 关闭 socket server

## 状态管理

### 浏览器状态

- `browser: Browser | null`
- `page: Page | null`

约束：

- MVP 单 page：简单可控
- 若 page 崩溃/关闭，需要自动重建（返回 `NOT_READY` 并提示重试也可）

### ref 体系（与 snapshot 相关）

`browser.snapshot` 会生成可交互元素列表，并为元素设置 `data-agent-ref` 属性：

- 优点：后续 click/type 可以通过 `[data-agent-ref="ref_1"]` 定位
- 难点：页面导航/重渲染后 ref 可能失效

策略建议：

- snapshot 每次重新生成 ref，并返回新的 elements 列表
- click/type 若找不到 ref，返回 `NOT_FOUND` 并提示先 snapshot

## RPC 路由与白名单

禁止执行任意方法名；应当只允许白名单：

- `ping`
- `browser.goto`
- `browser.click`
- `browser.type`
- `browser.snapshot`
- `code.run`
- `file.read`
- `file.write`
- `file.list`

未知 method → 返回 `BAD_REQUEST`。

## 并发与队列（MVP）

建议序列化执行：

- 同一时刻只处理一个请求（或同一 socket 一请求一响应后关闭）

原因：

- Playwright page 不是为多并发命令设计
- 代码执行与文件写入也需要简化互斥

如需并发，后续可引入队列与 per-domain lock。

## 错误与返回（容器侧）

容器侧返回尽量结构化：

- `success: false`
- `error: { code, message, details? }`

并保证：

- 不泄漏敏感信息（例如系统路径、环境变量）
- message 对 LLM 与人类都可理解

## ping 方法（建议实现）

`ping` 用于就绪探测与版本协商，建议返回：

```json
{
  "version": "0.1.0",
  "capabilities": {
    "browser": true,
    "code": ["python", "shell"],
    "file": true
  }
}
```

