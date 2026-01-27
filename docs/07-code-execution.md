# 07 代码执行（python / shell）

本章定义 `code.run` 的最小实现：在容器内执行 Python 或 Shell，并把 stdout/stderr/exitCode 返回给 MCP Server。

## 方法定义

RPC method：`code.run`

入参：

- `language: "python" | "shell"`
- `code: string`

返回（建议）：

- `success: boolean`（是否执行成功：MVP 可用 `exitCode === 0`）
- `exitCode: number`
- `stdout: string`
- `stderr: string`
- `duration: number`（毫秒）
- `killed: boolean`（是否被超时杀死；MVP 可先固定 false）

## 执行策略（MVP）

### Python

- 用 `python3 -c <code>` 执行
- 工作目录：`/workspace`

### Shell

- 用 `sh -lc <code>` 执行（兼容常用命令与管道）
- 工作目录：`/workspace`

## 输出与大小限制（MVP 简化）

为了避免单次输出过大影响 MCP 消息体积，建议做截断（MVP 默认开启）：

- `stdout` 最多保留前 N 字符（例如 20000）
- `stderr` 最多保留前 N 字符（例如 20000）

截断时可在末尾追加：

- `"\n... (truncated)"`

## 超时（可选）

MVP 可以先不做复杂超时控制；如果要加，最简单做法：

- `spawn` 后用 `setTimeout` 触发 `child.kill("SIGKILL")`
- 返回 `killed: true`
- `exitCode` 可置为 `-1`

## 环境变量（MVP）

默认继承容器环境变量即可；后续如需隔离，再增加 allowlist。

