# 04 RPC 协议（MCP Server ↔ 容器）

本章定义 MCP Server 与容器内 RPC Server 的通信协议：framing、字段、错误、超时与兼容性约束。

## 传输层

- TCP socket
- 容器内监听：`0.0.0.0:9999`
- MCP Server 连接：`127.0.0.1:${hostPort}`（Docker 端口映射得到）

## 消息 framing（换行分隔 JSON）

### 请求

一条请求是一行 JSON，以 `\n` 作为结束符：

- 写入：`JSON.stringify({ method, params }) + "\n"`

要求：

- 单行 JSON（禁止 pretty print）
- `params` 必须是 object（无 params 时为空对象 `{}`）

### 响应

响应同样是一行 JSON，以 `\n` 结束。

MVP 可以采用“一请求一响应”模型：服务端收到完整一行后处理并回写一行响应，然后可主动关闭连接或等待下一请求（建议 MVP：处理完即关闭连接，简化状态与背压）。

## 字段定义

### RPCRequest

- `method: string`：例如 `browser.goto`
- `params: object`：与 method 对应的入参

### RPCResponse

建议统一结构：

- `success: boolean`
- `data?: any`：成功时返回
- `error?: { code: string; message: string; details?: any }`：失败时返回

> README 示例里 `error` 是 string。文档建议升级为结构化 error，MCP Server 可以降级为文本返回。

## 错误码规范（建议）

### 通用错误码

- `BAD_REQUEST`：params 缺失/类型不正确
- `NOT_READY`：浏览器/page 未初始化，或 sandbox 未 ready
- `NOT_FOUND`：元素不存在、文件不存在
- `TIMEOUT`：操作超时
- `INTERNAL`：未分类错误

### 领域错误码（可选）

- `BROWSER_NAVIGATION_FAILED`
- `BROWSER_CLICK_FAILED`
- `CODE_EXIT_NONZERO`
- `FILE_PATH_TRAVERSAL_BLOCKED`

## 超时与重试

### 超时层级

建议三层：

- RPC client（socket）超时：例如 30s
- server method 内部超时：对 browser/code 分别控制
- tool 级超时：MCP Server 兜底（对用户返回一致错误）

### 重试策略（MVP 建议）

仅对“连接类错误”做轻量重试：

- 连接拒绝（ECONNREFUSED）/ 连接重置（ECONNRESET）在 sandbox 刚启动阶段可能出现
- 但对于业务错误（NOT_FOUND/BAD_REQUEST）不要重试

## 兼容性与版本

建议 RPC Server 支持：

- `ping`：返回 `{ version, capabilities }`

用于 MCP Server 的就绪探测与兼容性判断（不同镜像版本时尤为重要）。

## MVP 约定（先简单）

- `method` 仍建议用白名单路由（避免写错/难排查），但暂不做复杂安全策略
- path 的约束先以“相对 `/workspace` 读写”为主，先跑通再加固

