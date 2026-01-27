// ===== 沙箱 =====
export interface Sandbox {
  id: string
  containerId: string
  status: "running" | "stopped"
  port: number
}

export interface SandboxConfig {
  memory?: string      // 默认 "512m"
  cpu?: number         // 默认 1
  timeout?: number     // 默认 3600 秒
}

// ===== RPC 通信 =====
export interface RPCRequest {
  method: string
  params: Record<string, unknown>
}

export interface RPCError {
  code: string        // 错误码：BAD_REQUEST / NOT_FOUND / TIMEOUT / INTERNAL
  message: string     // 可读错误信息
}

export interface RPCResponse {
  success: boolean
  data?: unknown
  error?: RPCError
}

// ===== 浏览器 =====
export interface BrowserGotoParams {
  url: string
}

export interface BrowserGotoResult {
  url: string
  title: string
}

export interface BrowserClickParams {
  selector: string    // ref_N 或 CSS selector
}

export interface BrowserClickResult {
  url: string
  title: string
  navigated: boolean
}

export interface BrowserTypeParams {
  selector: string    // ref_N 或 CSS selector
  text: string
}

export interface BrowserTypeResult {
  url: string
  title: string
}

export interface BrowserSnapshotParams {
  maxTextLen?: number  // 默认 5000
}

export interface BrowserSnapshot {
  url: string
  title: string
  screenshot: string    // base64 PNG
  text: string          // 页面可见文本（限制长度）
  elements: string      // 可交互元素列表
}

// ===== 代码执行 =====
export interface CodeRunParams {
  language: "python" | "shell"
  code: string
}

export interface CodeRunResult {
  success: boolean
  exitCode: number
  stdout: string
  stderr: string
  duration: number      // 毫秒
  killed: boolean       // 是否被超时杀死
}

// ===== 文件操作 =====
export interface FileReadParams {
  path: string
}

export interface FileReadResult {
  content: string
  size: number
}

export interface FileWriteParams {
  path: string
  content: string
}

export interface FileWriteResult {
  success: boolean
  path: string
}

export interface FileListParams {
  path?: string        // 默认 "."
}

export interface FileListItem {
  name: string
  type: "file" | "directory"
}

export interface FileListResult {
  items: FileListItem[]
}

// ===== Ping =====
export interface PingResult {
  version: string
  capabilities: {
    browser: boolean
    code: string[]
    file: boolean
  }
}
