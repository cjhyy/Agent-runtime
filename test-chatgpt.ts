/**
 * 测试：打开 ChatGPT 并尝试交互
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

// 发送请求并等待响应
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

// 接收响应
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

  // 1. 打开 ChatGPT
  console.log("📍 正在打开 ChatGPT...")
  const gotoResult = await call("tools/call", {
    name: "browser_goto",
    arguments: { url: "https://chatgpt.com" }
  }) as any
  console.log("页面:", gotoResult.result?.content?.[0]?.text?.slice(0, 200))
  await sleep(3000)

  // 2. 获取页面快照
  console.log("\n📸 获取页面快照...")
  const snapshot1 = await call("tools/call", {
    name: "browser_snapshot",
    arguments: { maxTextLen: 3000 }
  }) as any
  const text1 = snapshot1.result?.content?.[0]?.text || ""
  console.log(text1.slice(0, 2000))

  // 3. 查找输入框并输入问题
  console.log("\n✏️ 尝试找输入框...")

  // 先看看有哪些元素
  const elementsMatch = text1.match(/=== Interactive Elements ===\n([\s\S]*?)\n\nScreenshot/)
  if (elementsMatch) {
    console.log("可交互元素:\n", elementsMatch[1])
  }

  // 尝试在输入框输入
  // ChatGPT 的输入框通常是 textarea 或有 contenteditable
  console.log("\n⌨️ 尝试输入问题...")

  // 找到可能的输入框 ref
  const textareaRef = text1.match(/\[(ref_\d+)\] textarea/)?.[1]
  const inputRef = text1.match(/\[(ref_\d+)\] .*contenteditable/)?.[1]
  const targetRef = textareaRef || inputRef

  if (targetRef) {
    console.log(`找到输入框: ${targetRef}`)

    const typeResult = await call("tools/call", {
      name: "browser_type",
      arguments: {
        selector: targetRef,
        text: "What is 2+2? Reply with just the number."
      }
    }) as any
    console.log("输入结果:", typeResult.result?.content?.[0]?.text?.slice(0, 200))
    await sleep(1000)

    // 4. 查找发送按钮并点击
    console.log("\n🔍 查找发送按钮...")
    const snapshot2 = await call("tools/call", {
      name: "browser_snapshot",
      arguments: {}
    }) as any
    const text2 = snapshot2.result?.content?.[0]?.text || ""

    // 找发送按钮
    const sendButtonRef = text2.match(/\[(ref_\d+)\] button.*[Ss]end/)?.[1]

    if (sendButtonRef) {
      console.log(`找到发送按钮: ${sendButtonRef}`)

      const clickResult = await call("tools/call", {
        name: "browser_click",
        arguments: { selector: sendButtonRef }
      }) as any
      console.log("点击结果:", clickResult.result?.content?.[0]?.text?.slice(0, 200))

      // 等待回复
      console.log("\n⏳ 等待 ChatGPT 回复...")
      await sleep(10000)

      // 5. 获取回复
      const snapshot3 = await call("tools/call", {
        name: "browser_snapshot",
        arguments: { maxTextLen: 5000 }
      }) as any
      const text3 = snapshot3.result?.content?.[0]?.text || ""
      console.log("\n📄 页面内容:\n", text3.slice(0, 3000))
    } else {
      console.log("未找到发送按钮，尝试按 Enter 发送...")
      // 可以尝试用 keyboard 事件，但当前没有实现
    }
  } else {
    console.log("未找到输入框")
    console.log("\n当前页面可能需要登录，或者页面结构不同")
  }

  // 保存截图
  console.log("\n💾 保存最终截图...")
  const finalSnapshot = await call("tools/call", {
    name: "browser_snapshot",
    arguments: {}
  }) as any
  const finalText = finalSnapshot.result?.content?.[0]?.text || ""

  // 提取 base64 截图并保存
  const screenshotMatch = finalText.match(/Screenshot: \[base64 image, (\d+) chars\]/)
  if (screenshotMatch) {
    // 截图信息在 snapshot 返回的 data 中，这里只打印长度
    console.log(`截图大小: ${screenshotMatch[1]} 字符`)
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
