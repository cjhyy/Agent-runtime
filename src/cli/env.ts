/**
 * 环境变量加载
 */

import * as fs from "node:fs"
import * as path from "node:path"

/** 加载 .env 文件 */
export function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env")
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=")
        const value = valueParts.join("=")
        if (key && value && !process.env[key]) {
          process.env[key] = value
        }
      }
    }
  }
}

/** 检查必需的环境变量 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/** 获取可选的环境变量，带默认值 */
export function getEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue
}

/** 获取布尔环境变量 */
export function getBoolEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]
  if (value === undefined) return defaultValue
  return value !== "false" && value !== "0"
}
