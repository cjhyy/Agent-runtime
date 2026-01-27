import { spawn } from "node:child_process"

// 使用环境变量或默认 /workspace
const WORKSPACE = process.env.WORKSPACE || "/workspace"

export interface CodeRunResult {
  success: boolean
  exitCode: number
  stdout: string
  stderr: string
  duration: number
  killed: boolean
}

/**
 * 执行 Python 或 Shell 代码
 */
export async function runCode(
  language: "python" | "shell",
  code: string,
  timeout = 30000
): Promise<CodeRunResult> {
  const startTime = Date.now()

  return new Promise((resolve) => {
    const cmd = language === "python" ? "python3" : "sh"
    const args = ["-c", code]

    const child = spawn(cmd, args, {
      cwd: WORKSPACE,
      timeout
    })

    let stdout = ""
    let stderr = ""
    let killed = false

    child.stdout.on("data", (data) => {
      stdout += data.toString()
      if (stdout.length > 20000) {
        stdout = stdout.slice(0, 20000) + "\n... (truncated)"
      }
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
      if (stderr.length > 20000) {
        stderr = stderr.slice(0, 20000) + "\n... (truncated)"
      }
    })

    child.on("error", (err) => {
      resolve({
        success: false,
        exitCode: -1,
        stdout,
        stderr: err.message,
        duration: Date.now() - startTime,
        killed: false
      })
    })

    child.on("close", (exitCode, signal) => {
      if (signal === "SIGTERM" || signal === "SIGKILL") {
        killed = true
      }

      resolve({
        success: exitCode === 0,
        exitCode: exitCode ?? -1,
        stdout,
        stderr,
        duration: Date.now() - startTime,
        killed
      })
    })
  })
}
