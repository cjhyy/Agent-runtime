/**
 * Agent Tools 定义
 * OpenAI Function Calling 格式
 */

import type { Tool } from "./llm.js"

export const AGENT_TOOLS: Tool[] = [
  // 浏览器操作
  {
    type: "function",
    function: {
      name: "browser_goto",
      description: "打开指定网页。返回页面 URL 和标题。",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "要打开的 URL" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_click",
      description: "点击页面元素。使用 browser_snapshot 返回的 ref_N 标识符或 CSS 选择器。",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "元素选择器，如 ref_1 或 CSS 选择器" }
        },
        required: ["selector"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_type",
      description: "在输入框中输入文字。使用 browser_snapshot 返回的 ref_N 标识符或 CSS 选择器。",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "输入框选择器，如 ref_1" },
          text: { type: "string", description: "要输入的文字" }
        },
        required: ["selector", "text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_press",
      description: "按下键盘按键。常用于输入后按 Enter 提交，或按 Escape 关闭弹窗。支持的按键：Enter, Escape, Tab, Backspace, ArrowUp, ArrowDown, ArrowLeft, ArrowRight 等。",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "按键名称，如 Enter, Escape, Tab" }
        },
        required: ["key"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_snapshot",
      description: "获取当前页面快照。返回页面文本和可交互元素列表（包含 ref_N 标识符）。在操作页面前先调用此工具了解页面结构。",
      parameters: {
        type: "object",
        properties: {
          maxTextLen: { type: "number", description: "页面文本最大长度，默认 5000" }
        }
      }
    }
  },
  // 代码执行
  {
    type: "function",
    function: {
      name: "code_run",
      description: "执行 Python 或 Shell 代码。工作目录为 /workspace。返回 stdout、stderr 和退出码。",
      parameters: {
        type: "object",
        properties: {
          language: { type: "string", enum: ["python", "shell"], description: "编程语言" },
          code: { type: "string", description: "要执行的代码" }
        },
        required: ["language", "code"]
      }
    }
  },
  // 文件操作
  {
    type: "function",
    function: {
      name: "file_read",
      description: "读取文件内容。路径相对于 /workspace。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件路径" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "file_write",
      description: "写入文件。路径相对于 /workspace，目录会自动创建。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件路径" },
          content: { type: "string", description: "文件内容" }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "file_list",
      description: "列出目录内容。路径相对于 /workspace。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "目录路径，默认为当前目录" }
        }
      }
    }
  }
]

// 工具名称列表
export const TOOL_NAMES = AGENT_TOOLS.map(t => t.function.name)
