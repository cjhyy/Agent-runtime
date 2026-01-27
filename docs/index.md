# docs 总览（阅读路径）

这份文档集以 “MVP 可落地实现” 为目标，把 Agent Runtime 拆成几个可独立实现/测试的模块。推荐按顺序阅读：

1. `01-architecture.md`：整体架构、数据流、时序与边界
2. `02-mcp-server.md`：MCP Server 的 tool 定义、入参校验、错误返回规范
3. `03-sandbox-manager.md`：Docker 容器生命周期、资源限制、端口映射、就绪探测
4. `04-rpc-protocol.md`：RPC 协议（请求/响应/ framing）、超时与错误分类
5. `05-container-server.md`：容器内 RPC Server 的模块划分与状态管理
6. `06-browser.md`：Playwright 浏览器能力实现细节（ref 体系、snapshot 结构）
7. `07-code-execution.md`：python/shell 执行器（超时、stdout/stderr、工作目录）
8. `08-file-ops.md`：文件读写与目录列举（路径安全、workspace 约束）
9. `09-docker-image.md`：Dockerfile 设计（依赖、用户权限、体积与缓存）
10. `10-security.md`：威胁模型、风险边界、MVP 允许/禁止的能力
11. `11-dev-guide.md`：本地开发、构建镜像、联调（Claude Desktop / MCP）
12. `12-troubleshooting.md`：常见问题排查

## MVP 的“可验收”定义（建议，偏可演示）

- **Tool 完整性**：README 列出的 10 个 tools 均可调用并返回结构化结果
- **可重复性**：同一任务重复执行结果稳定（尤其是 `browser_snapshot` 的 element 列表）
- **资源与清理**：`sandbox_destroy` 后容器与浏览器进程无泄漏（可用 Docker/ps 验证）
- **最小约束**：先不做复杂安全策略；以“默认可用”为主（安全加固放到后续版本）

