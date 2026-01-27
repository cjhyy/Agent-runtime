/**
 * 简单的 MCP 客户端测试脚本
 * 用于本地测试 MCP Server 功能
 */

import { spawn } from "node:child_process"
import * as readline from "node:readline"

const server = spawn("node", ["dist/index.js"], {
  stdio: ["pipe", "pipe", "inherit"],
  env: {
    ...process.env,
    WORKSPACE: "./workspace"  // 本地测试使用相对路径
  }
})

const rl = readline.createInterface({
  input: server.stdout,
  crlfDelay: Infinity
})

let messageId = 1

// 发送 JSON-RPC 请求
function send(method: string, params: Record<string, unknown> = {}) {
  const request = {
    jsonrpc: "2.0",
    id: messageId++,
    method,
    params
  }
  console.log("\n>>> Sending:", JSON.stringify(request, null, 2))
  server.stdin.write(JSON.stringify(request) + "\n")
}

// 接收响应
rl.on("line", (line) => {
  try {
    const response = JSON.parse(line)
    console.log("\n<<< Received:", JSON.stringify(response, null, 2).slice(0, 2000))
    if (response.result?.content?.[0]?.text) {
      console.log("\n--- Result Text ---")
      console.log(response.result.content[0].text.slice(0, 1500))
    }
  } catch {
    console.log("<<< Raw:", line.slice(0, 500))
  }
})

// 测试序列
async function runTests() {
  // 等待服务器启动
  await sleep(2000)

  // 1. 初始化
  send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0" }
  })
  await sleep(1000)

  // 2. 列出工具
  send("tools/list", {})
  await sleep(1000)

  // 3. 测试浏览器 - 打开网页
  send("tools/call", {
    name: "browser_goto",
    arguments: { url: "https://example.com" }
  })
  await sleep(3000)

  // 4. 测试浏览器 - 获取快照
  send("tools/call", {
    name: "browser_snapshot",
    arguments: {}
  })
  await sleep(2000)

  // 5. 测试代码执行
  send("tools/call", {
    name: "code_run",
    arguments: {
      language: "python",
      code: "print('Hello from Python!')\nprint(1 + 2)"
    }
  })
  await sleep(2000)

  // 6. 测试文件写入
  send("tools/call", {
    name: "file_write",
    arguments: {
      path: "test.txt",
      content: "Hello, Agent Runtime!"
    }
  })
  await sleep(1000)

  // 7. 测试文件读取
  send("tools/call", {
    name: "file_read",
    arguments: { path: "test.txt" }
  })
  await sleep(1000)

  // 8. 测试目录列表
  send("tools/call", {
    name: "file_list",
    arguments: { path: "." }
  })
  await sleep(1000)

  console.log("\n\n=== Tests completed ===")
  server.kill()
  process.exit(0)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

runTests().catch(console.error)
