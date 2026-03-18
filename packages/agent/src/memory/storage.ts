/**
 * Memory 存储
 * 使用 JSON 文件持久化
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { MemoryData } from "./types.js"
import { EMPTY_MEMORY } from "./types.js"

export class Storage {
  private dataDir: string
  private memoryFile: string

  constructor(dataDir: string) {
    // 扩展 ~
    this.dataDir = dataDir.startsWith("~")
      ? path.join(process.env.HOME || "", dataDir.slice(1))
      : dataDir

    this.memoryFile = path.join(this.dataDir, "memory.json")
  }

  /**
   * 确保目录存在
   */
  async ensureDir(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true })
  }

  /**
   * 加载记忆数据
   */
  async load(): Promise<MemoryData> {
    try {
      const content = await fs.readFile(this.memoryFile, "utf-8")
      const data = JSON.parse(content) as MemoryData

      // 兼容旧版本
      return {
        episodes: data.episodes || [],
        facts: data.facts || [],
        version: data.version || 1
      }
    } catch {
      // 文件不存在或解析失败，返回空记忆
      return { ...EMPTY_MEMORY }
    }
  }

  /**
   * 保存记忆数据
   */
  async save(data: MemoryData): Promise<void> {
    await this.ensureDir()
    const content = JSON.stringify(data, null, 2)
    await fs.writeFile(this.memoryFile, content, "utf-8")
  }

  /**
   * 获取数据目录
   */
  getDataDir(): string {
    return this.dataDir
  }
}
