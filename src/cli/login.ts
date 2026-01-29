#!/usr/bin/env node
/**
 * 浏览器登录工具
 * 让用户手动登录网站，保存登录状态
 */

import { launchLoginMode } from "../runtime/index.js"

const url = process.argv[2] || "https://www.google.com"

console.log("╔═══════════════════════════════════════╗")
console.log("║       Browser Login Tool              ║")
console.log("╚═══════════════════════════════════════╝")

launchLoginMode(url).catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
