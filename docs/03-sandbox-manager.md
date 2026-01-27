# 03 沙箱管理（Docker）

本章描述 MCP Server 侧的沙箱管理逻辑（`src/sandbox.ts` 的设计目标），包括容器创建、资源限制、端口映射与就绪探测。

## 核心职责

- **创建容器**：使用固定镜像（例如 `agent-sandbox:mvp`）
- **资源限制**：memory / cpu / timeout（MVP 先做 memory/cpu）
- **端口映射**：容器 `9999/tcp` → 宿主随机端口
- **就绪探测**：确保容器内 RPC Server 已开始监听
- **销毁容器**：stop + remove，确保清理彻底

## 单沙箱策略（MVP）

MVP 简化为“同一时刻只允许存在一个沙箱”：

- `sandbox_create`：若已有沙箱，先 `sandbox_destroy`
- 任何非 `sandbox_create` 的 tool：如果沙箱不存在，返回可修复提示

优点：状态简单，联调容易。缺点：不能并发；后续再扩展多沙箱池。

## 容器创建建议

### Image 与 name

- Image：`agent-sandbox:mvp`
- Name：`sandbox-${id}`（便于 `docker ps` 排查）

### ExposedPorts / PortBindings

容器内固定监听 `9999`，宿主随机映射：

- `ExposedPorts: { "9999/tcp": {} }`
- `PortBindings: { "9999/tcp": [{ "HostPort": "0" }] }`

创建后 inspect 获取实际映射端口：

- `info.NetworkSettings.Ports["9999/tcp"][0].HostPort`

### 资源限制

建议默认值（可配置覆盖）：

- memory：512MB
- cpu：1 vCPU（`NanoCpus: 1e9`）

> 注意：不同 Docker 环境对 `NanoCpus` 的支持略有差异；必要时可用 `CpuQuota/CpuPeriod` 兼容。

### 文件系统与挂载（可选）

MVP 可以先不挂载宿主目录，只在容器内 `/workspace` 操作（容器销毁即清理）。

如果需要持久化：

- 将宿主某目录 bind mount 到容器 `/workspace`
- 严格限制为只读/读写（取决于产品需求）

## 就绪探测（waitForReady）

问题：容器 start 并不等于 RPC Server ready。

建议的就绪探测：

- **TCP connect 探测**：循环尝试连接 `127.0.0.1:hostPort`
- 或 **RPC ping**：增加一个 `ping` 方法（更可靠，可返回版本信息）

建议策略：

- 总超时：例如 10s
- 间隔：100～200ms backoff
- 失败信息：包含 hostPort、容器 id、最近一次错误（ECONNREFUSED 等）

## 销毁策略

销毁流程建议：

1. `stop`（带超时，例如 `t: 5`）
2. `remove`（即使 stop 失败也尝试 remove）
3. 清空 `currentSandbox`

注意：

- stop/remove 调用失败时，MVP 可 catch 并继续（避免影响后续 create）
- 但需要日志记录，方便排查资源泄漏

## 超时与自动回收（建议）

MVP README 提到 `timeout`（3600s），建议实现方式：

- 在 MCP Server 层维护一个定时器
- 到期自动 `sandbox_destroy`
- 每次 tool 调用可选择“续租”（更新 lastUsedAt）

这能防止用户忘记 destroy 导致容器长期占用资源。

