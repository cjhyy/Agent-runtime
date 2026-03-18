/**
 * @agent-runtime/server
 *
 * 统一后端包 — 包含 LLM agent 编排 + Playwright + SDK Bridge + HTTP/WS 服务
 *
 * 消费者用法:
 *   import { createRuntime } from "@agent-runtime/server"
 *   const runtime = await createRuntime({ port: 3100 })
 *   const result = await runtime.run("去 ChatGPT 问 3 本书推荐")
 */

// 主 API
export { AgentRuntime, createRuntime, type RuntimeConfig } from "./runtime.js"

// 底层 API（高级用户）
export { AgentServer, type AgentServerConfig } from "./agent-server.js"

// 从 agent 包 re-export
export { Agent, createAgent, type AgentConfig, type AgentResult } from "@agent-runtime/agent"
