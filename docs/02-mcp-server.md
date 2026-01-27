# 02 MCP Server（Node.js）

## 职责

- 实现 MCP 协议（stdio transport）
- 暴露 tools：`tools/list` 与 `tools/call`
- 管理 Docker 沙箱生命周期（create/destroy/get）
- 将 tool 调用映射为对容器的 RPC 调用
- 做入参校验、超时控制、错误翻译（对 LLM 友好的文本）

## Tools 设计

### tools/list

- 返回固定的 tool 列表（MVP：10 个）
- 每个 tool 提供：
  - `name`
  - `description`（面向 LLM，说明副作用与返回结构）
  - `inputSchema`（JSON Schema，用于客户端侧与服务端侧校验）

### tools/call

处理流程建议：

1. **解析**：读取 `request.params.name` 与 `request.params.arguments`
2. **路由**：匹配到 tool handler
3. **校验**：必填字段、类型、范围；非法则直接返回“用户可修复”的错误
4. **确保沙箱**：除 `sandbox_create` 外，其它 tool 必须确认存在运行中的沙箱
5. **RPC 调用**：通过 `rpc-client` 调用容器 RPC
6. **格式化输出**：统一为 MCP `content: [{ type: "text", text: "..." }]`

> 注意：MCP 的 `tools/call` 返回是“内容块”，MVP 可以只返回 `text`，但建议文本中包含结构化 JSON（便于 LLM 二次解析）。

## Tool → RPC 方法映射（建议）

| Tool | RPC method | 说明 |
|------|-----------|------|
| sandbox_create | (无 / 本地) | MCP Server 本地创建容器并等待 ready |
| sandbox_destroy | (无 / 本地) | MCP Server 本地 stop/remove 容器 |
| browser_goto | `browser.goto` | `{ url }` |
| browser_click | `browser.click` | `{ selector }`（selector 可为 ref 或 CSS） |
| browser_type | `browser.type` | `{ selector, text }` |
| browser_snapshot | `browser.snapshot` | 可选 `{ maxTextLen }` |
| code_run | `code.run` | `{ language, code }` |
| file_read | `file.read` | `{ path }`（相对 workspace） |
| file_write | `file.write` | `{ path, content }` |
| file_list | `file.list` | `{ path }`（默认 `.`） |

## 返回格式（对 LLM 友好）

建议 MCP Server 对每个 tool 返回类似：

- 第一行：简短总结（成功/失败 + 关键字段）
- 随后附带 JSON（方便复制、后续 tool 输入）

示例（成功）：

```text
browser_snapshot ok: https://github.com (GitHub)
{
  "url": "...",
  "title": "...",
  "text": "...",
  "elements": "[ref_1] ...\n[ref_2] ..."
}
```

示例（失败）：

```text
browser_click failed: element not found (selector="ref_99")
hint: call browser_snapshot first and use one of the returned refs
```

## 入参校验要点

- **url**：MVP 先不做复杂校验（基本 string 即可），出错时把底层错误透出给用户
- **selector**：允许两类：
  - `ref_*`：由 `snapshot` 生成
  - CSS selector：MVP 直接支持（后续再加限制）
- **file path**：MVP 先按“相对 `/workspace`”的约定实现即可（加固留到后续）

## 超时策略（建议）

分层超时：

- MCP tool 层（整体）：例如 30s
- RPC 层：例如 30s
- 容器内执行层：
  - `code.run`：可配置，例如 10s～60s
  - `browser.snapshot`：例如 10s

原则：让最内层能“自我终止”，外层作为兜底（防止卡死）。

## 日志与可观测性（MVP 建议）

- MCP Server log：打印 `tool name`、耗时、关键参数（脱敏）
- RPC error：打印 `method` 与 error code
- 容器 ID、hostPort：创建/销毁时打印，便于排障

