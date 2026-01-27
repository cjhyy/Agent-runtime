/**
 * 测试：使用 DuckDuckGo 搜索
 */

import { spawn } from "node:child_process"
import * as readline from "node:readline"

const server = spawn("node", ["dist/index.js"], {
  stdio: ["pipe", "pipe", "inherit"],
  env: {
    ...process.env,
    WORKSPACE: "./workspace"
  }
})

const rl = readline.createInterface({
  input: server.stdout,
  crlfDelay: Infinity
})

let messageId = 1
let pendingResolve: ((value: unknown) => void) | null = null

function call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  return new Promise((resolve) => {
    pendingResolve = resolve
    const request = { jsonrpc: "2.0", id: messageId++, method, params }
    server.stdin.write(JSON.stringify(request) + "\n")
  })
}

rl.on("line", (line) => {
  try {
    const response = JSON.parse(line)
    if (pendingResolve) {
      pendingResolve(response)
      pendingResolve = null
    }
  } catch {}
})

async function main() {
  console.log("等待服务器启动...")
  await sleep(3000)

  await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0" }
  })
  console.log("✅ MCP 连接成功\n")

  // 直接用 DuckDuckGo 搜索 URL
  const query = "What is 2+2"
  const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`

  console.log(`📍 直接搜索: ${query}`)
  console.log(`URL: ${searchUrl}\n`)

  await call("tools/call", {
    name: "browser_goto",
    arguments: { url: searchUrl }
  })

  console.log("⏳ 等待页面加载...")
  await sleep(3000)

  // 获取结果
  const snapshot = await call("tools/call", {
    name: "browser_snapshot",
    arguments: { maxTextLen: 4000 }
  }) as any

  const text = snapshot.result?.content?.[0]?.text || ""

  console.log("=".repeat(60))
  console.log("📄 搜索结果:")
  console.log("=".repeat(60))

  // 提取页面文本
  const titleMatch = text.match(/Title: (.*)/)
  const urlMatch = text.match(/URL: (.*)/)
  const pageTextMatch = text.match(/=== Page Text ===\n([\s\S]*?)\n\n===/)

  if (titleMatch) console.log("标题:", titleMatch[1])
  if (urlMatch) console.log("URL:", urlMatch[1])
  console.log("")

  if (pageTextMatch) {
    console.log("页面内容:")
    console.log("-".repeat(40))
    console.log(pageTextMatch[1].slice(0, 2000))
  }

  console.log("\n=== 测试完成 ===")
  server.kill()
  process.exit(0)
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

main().catch(err => {
  console.error("错误:", err)
  server.kill()
  process.exit(1)
})
