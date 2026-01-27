/**
 * 测试：使用 Bing 搜索问题
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
    const request = {
      jsonrpc: "2.0",
      id: messageId++,
      method,
      params
    }
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
  } catch {
    // ignore
  }
})

async function main() {
  console.log("等待服务器启动...")
  await sleep(3000)

  // 初始化
  await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0" }
  })
  console.log("✅ MCP 连接成功\n")

  // 1. 打开 Google (用国际版 Bing)
  console.log("📍 正在打开 Bing 国际版...")
  await call("tools/call", {
    name: "browser_goto",
    arguments: { url: "https://www.bing.com/?cc=us" }
  })
  await sleep(2000)

  // 2. 获取快照
  console.log("\n📸 获取页面快照...")
  const snapshot1 = await call("tools/call", {
    name: "browser_snapshot",
    arguments: { maxTextLen: 2000 }
  }) as any
  const text1 = snapshot1.result?.content?.[0]?.text || ""
  console.log("页面标题:", text1.match(/Title: (.*)/)?.[1])

  // 显示可交互元素
  const elementsMatch = text1.match(/=== Interactive Elements ===\n([\s\S]*?)\n\nScreenshot/)
  if (elementsMatch) {
    console.log("\n可交互元素:")
    console.log(elementsMatch[1])
  }

  // 3. 找搜索框 - 通常是 input[type=search] 或 textarea
  const searchInputRef = text1.match(/\[(ref_\d+)\] input\[type=search\]/)?.[1]
    || text1.match(/\[(ref_\d+)\] textarea.*[Ss]earch/i)?.[1]
    || text1.match(/\[(ref_\d+)\] input\[type=text\].*[Ss]earch/i)?.[1]

  if (searchInputRef) {
    console.log(`\n⌨️ 找到搜索框: ${searchInputRef}`)
    console.log("输入问题: What is 2+2")

    await call("tools/call", {
      name: "browser_type",
      arguments: {
        selector: searchInputRef,
        text: "What is 2+2"
      }
    })
    await sleep(1000)

    // 4. 使用 CSS 选择器直接点击搜索按钮
    // Bing 的搜索按钮通常是 #sb_form_go 或 form 提交
    console.log("\n🔍 点击搜索按钮...")

    // 尝试用 CSS 选择器
    try {
      await call("tools/call", {
        name: "browser_click",
        arguments: { selector: "#sb_form_go" }
      })
    } catch {
      // 如果失败，尝试 label[for=sb_form_go]
      await call("tools/call", {
        name: "browser_click",
        arguments: { selector: "#search_icon" }
      })
    }

    // 等待搜索结果
    console.log("⏳ 等待搜索结果...")
    await sleep(3000)

    // 5. 获取搜索结果
    const snapshot3 = await call("tools/call", {
      name: "browser_snapshot",
      arguments: { maxTextLen: 5000 }
    }) as any
    const text3 = snapshot3.result?.content?.[0]?.text || ""

    console.log("\n" + "=".repeat(60))
    console.log("📄 搜索结果:")
    console.log("=".repeat(60))

    // 提取页面文本
    const pageTextMatch = text3.match(/=== Page Text ===\n([\s\S]*?)\n\n===/)
    if (pageTextMatch) {
      // 只显示前面的搜索结果
      const resultText = pageTextMatch[1]
      console.log(resultText.slice(0, 2500))
    }

    // 显示 URL
    const urlMatch = text3.match(/URL: (.*)/)
    if (urlMatch) {
      console.log("\n当前 URL:", urlMatch[1])
    }
  } else {
    console.log("未找到搜索框")
    console.log("页面内容:", text1.slice(0, 1500))
  }

  console.log("\n=== 测试完成 ===")
  server.kill()
  process.exit(0)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((err) => {
  console.error("错误:", err)
  server.kill()
  process.exit(1)
})
