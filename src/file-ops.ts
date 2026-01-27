import * as fs from "node:fs/promises"
import * as path from "node:path"

// 使用环境变量或默认 /workspace（本地测试时可设置 WORKSPACE=./workspace）
const WORKSPACE_RAW = process.env.WORKSPACE || "/workspace"
// 解析为绝对路径
const WORKSPACE = path.resolve(WORKSPACE_RAW)

/**
 * 解析路径，确保在 workspace 内
 */
function resolvePath(filePath: string): string {
  const resolved = path.resolve(WORKSPACE, filePath)
  if (!resolved.startsWith(WORKSPACE)) {
    throw new Error("Path traversal not allowed")
  }
  return resolved
}

// ===== File Operations =====

export interface FileReadResult {
  content: string
  size: number
}

export async function fileRead(filePath: string): Promise<FileReadResult> {
  const resolved = resolvePath(filePath)
  const content = await fs.readFile(resolved, "utf-8")
  const stats = await fs.stat(resolved)

  // 限制返回大小
  const maxSize = 200 * 1024 // 200KB
  const truncated = content.length > maxSize
    ? content.slice(0, maxSize) + "\n... (truncated)"
    : content

  return {
    content: truncated,
    size: stats.size
  }
}

export interface FileWriteResult {
  success: boolean
  path: string
}

export async function fileWrite(filePath: string, content: string): Promise<FileWriteResult> {
  const resolved = resolvePath(filePath)

  // 自动创建目录
  await fs.mkdir(path.dirname(resolved), { recursive: true })
  await fs.writeFile(resolved, content, "utf-8")

  return {
    success: true,
    path: filePath
  }
}

export interface FileListItem {
  name: string
  type: "file" | "directory"
}

export interface FileListResult {
  items: FileListItem[]
}

export async function fileList(dirPath = "."): Promise<FileListResult> {
  const resolved = resolvePath(dirPath)
  const entries = await fs.readdir(resolved, { withFileTypes: true })

  const items = entries
    .map((entry) => ({
      name: entry.name,
      type: (entry.isDirectory() ? "directory" : "file") as "file" | "directory"
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { items }
}
