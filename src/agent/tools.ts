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
  // 新增浏览器操作
  {
    type: "function",
    function: {
      name: "browser_wait",
      description: "等待指定条件。支持：等待时间、等待元素出现、等待文本出现/消失、等待页面加载状态。",
      parameters: {
        type: "object",
        properties: {
          timeout: { type: "number", description: "等待毫秒数" },
          selector: { type: "string", description: "等待元素出现的选择器" },
          text: { type: "string", description: "等待文本出现" },
          textGone: { type: "string", description: "等待文本消失" },
          state: { type: "string", enum: ["load", "domcontentloaded", "networkidle"], description: "等待页面加载状态" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_scroll",
      description: "滚动页面。支持：按方向滚动、滚动到元素、滚动到顶部/底部。",
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["up", "down", "left", "right"], description: "滚动方向，默认 down" },
          distance: { type: "number", description: "滚动距离（像素），默认 500" },
          selector: { type: "string", description: "滚动到指定元素" },
          toTop: { type: "boolean", description: "滚动到页面顶部" },
          toBottom: { type: "boolean", description: "滚动到页面底部" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_hover",
      description: "鼠标悬停在元素上。用于触发悬停菜单、提示等。",
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
      name: "browser_select",
      description: "选择下拉框选项。用于 <select> 元素。",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "下拉框选择器" },
          value: { type: "string", description: "要选择的值（单个）" },
          values: { type: "array", items: { type: "string" }, description: "要选择的多个值" }
        },
        required: ["selector"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_back",
      description: "返回上一页。",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_forward",
      description: "前进到下一页。",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_reload",
      description: "刷新当前页面。",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_evaluate",
      description: "在页面中执行 JavaScript 代码。返回执行结果。用于获取页面数据或执行复杂操作。",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "要执行的 JavaScript 代码，可以使用 return 返回值" }
        },
        required: ["code"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_upload",
      description: "上传文件到 file input 元素。",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "file input 选择器" },
          files: { type: "array", items: { type: "string" }, description: "要上传的文件路径列表" }
        },
        required: ["selector", "files"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_dialog",
      description: "处理页面弹窗（alert, confirm, prompt）。",
      parameters: {
        type: "object",
        properties: {
          accept: { type: "boolean", description: "是否接受弹窗，true=确定/接受，false=取消" },
          promptText: { type: "string", description: "prompt 弹窗的输入文本" }
        },
        required: ["accept"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_tabs",
      description: "管理浏览器标签页。支持：列出、新建、关闭、切换标签。",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "new", "close", "switch"], description: "操作类型" },
          index: { type: "number", description: "标签页索引（用于 close 和 switch）" },
          url: { type: "string", description: "新标签页的 URL（用于 new）" }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_login",
      description: "打开浏览器让用户手动登录网站。会弹出一个浏览器窗口，用户登录完成后关闭窗口，Cookie 会自动保存。适用于：1) 需要登录才能访问的网站 2) 遇到人机验证 3) 需要保存登录状态。",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "要登录的网站 URL，如 https://www.google.com" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cookie_list",
      description: "查看当前保存的所有 Cookie，按域名分组显示。用于检查登录状态是否保存成功。",
      parameters: {
        type: "object",
        properties: {}
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
  },
  // Claude Code 集成
  {
    type: "function",
    function: {
      name: "claude_code",
      description: "调用 Claude Code 执行编程任务。Claude Code 是 Anthropic 的 AI 编程助手，可以帮你写代码、修改文件、运行命令、调试问题等。适用于复杂的编程任务。",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "要让 Claude Code 执行的任务描述，要尽量详细" },
          workdir: { type: "string", description: "工作目录，默认为当前目录" },
          allowedTools: { type: "string", description: "允许使用的工具，如 'Bash,Edit,Read,Write'，默认使用所有工具" }
        },
        required: ["prompt"]
      }
    }
  }
]

// 工具名称列表
export const TOOL_NAMES = AGENT_TOOLS.map(t => t.function.name)
