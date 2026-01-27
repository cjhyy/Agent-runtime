# 08 文件操作（read / write / list）

本章定义 `file.*` 的最小实现：在容器内对 `/workspace` 执行文件读写与目录列举。

## 统一约定（MVP）

- 所有路径都以 `/workspace` 为根目录
- MCP Server 与容器端都建议将“相对路径”解析为 `/workspace/<path>`

> MVP 先不做复杂安全加固；按约定读写 `/workspace` 即可（后续再逐步加固）。

## `file.read`

RPC method：`file.read`

入参：

- `path: string`（相对 workspace，例如 `repos.txt`）

返回：

- `content: string`
- `size: number`

建议：

- 对大文件做截断（例如 200KB），避免返回太大

## `file.write`

RPC method：`file.write`

入参：

- `path: string`
- `content: string`

返回：

- `success: boolean`
- `path: string`

行为（MVP）：

- 如果目录不存在，可选择自动 `mkdir -p`（推荐）

## `file.list`

RPC method：`file.list`

入参：

- `path?: string`（默认 `.`）

返回：

- `items: Array<{ name: string; type: "file" | "directory" }>`

建议：

- 返回按 name 排序，提升可读性与稳定性

