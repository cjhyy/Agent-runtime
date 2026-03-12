import { NextResponse } from "next/server";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const MODEL = "google/gemini-2.5-flash";
const AGENT_SERVER = "http://localhost:3100";

// 可用工具定义 (给 LLM 的 function calling)
const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "page_snapshot",
      description:
        "获取当前用户浏览器页面的快照：页面文本和可交互元素列表（每个元素有 ref_N 标识符）",
      parameters: {
        type: "object",
        properties: {
          maxTextLen: { type: "number", description: "页面文本最大长度，默认 500" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "page_click",
      description: "点击页面上的元素。使用 ref_N 标识符（从 page_snapshot 获取）",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "元素选择器，如 ref_1" },
        },
        required: ["selector"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "page_type",
      description: "在输入框中输入文本。使用 ref_N 标识符",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "输入框选择器，如 ref_10" },
          text: { type: "string", description: "要输入的文本" },
        },
        required: ["selector", "text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "page_scroll",
      description: "滚动页面",
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["up", "down", "left", "right"] },
          distance: { type: "number", description: "像素，默认 500" },
          toTop: { type: "boolean" },
          toBottom: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "page_hover",
      description: "悬停在元素上",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "元素选择器" },
        },
        required: ["selector"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "page_select",
      description: "选择下拉框选项",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "select 元素选择器" },
          values: { type: "string", description: "要选择的值" },
        },
        required: ["selector", "values"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "page_evaluate",
      description: "在页面中执行 JavaScript 代码",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "要执行的 JS 代码" },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "headless_goto",
      description: "用后台无头浏览器打开一个 URL",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "要打开的 URL" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "headless_snapshot",
      description: "获取后台无头浏览器的页面快照",
      parameters: {
        type: "object",
        properties: {
          maxTextLen: { type: "number" },
        },
      },
    },
  },
];

const SYSTEM_PROMPT = `你是一个浏览器自动化助手。用户会给你自然语言指令，你需要通过工具来操作用户的浏览器页面。

工作流程：
1. 收到指令后，先用 page_snapshot 获取当前页面状态和元素列表
2. 根据元素列表中的 ref_N 标识符来执行操作（点击、输入等）
3. 操作完成后简短回复结果

注意：
- 每个可交互元素都有 [ref_N] 标识，用这个来定位元素
- 输入前先 snapshot 找到目标输入框的 ref
- 回复简洁，不要重复工具返回的原始数据
- 用中文回复`;

// 调用 AgentServer 工具
async function callAgentTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const res = await fetch(`${AGENT_SERVER}/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool: name, arguments: args }),
  });
  const data = await res.json();
  if (!data.success) return `Error: ${data.error}`;
  return String(data.result);
}

// 调用 LLM
async function callLLM(
  messages: Array<{ role: string; content?: string; tool_calls?: any; tool_call_id?: string; name?: string }>
) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error ${res.status}: ${err}`);
  }

  return res.json();
}

export async function POST(request: Request) {
  const { message, history } = await request.json();

  if (!OPENROUTER_KEY) {
    return NextResponse.json({
      reply: "❌ OPENROUTER_API_KEY 未配置",
      toolCalls: [],
    });
  }

  // 构建消息历史
  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    // 带入前几轮历史（只保留最近 10 条）
    ...(history || []).slice(-10),
    { role: "user", content: message },
  ];

  const toolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string }> = [];

  try {
    // Agent loop: 最多执行 8 轮工具调用
    for (let i = 0; i < 8; i++) {
      const completion = await callLLM(messages);
      const choice = completion.choices?.[0];

      if (!choice) {
        return NextResponse.json({ reply: "LLM 无响应", toolCalls });
      }

      const msg = choice.message;

      // 如果 LLM 想调用工具
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // 把 assistant message (含 tool_calls) 加入历史
        messages.push(msg);

        // 执行每个工具调用
        for (const tc of msg.tool_calls) {
          const fnName = tc.function.name;
          let fnArgs: Record<string, unknown> = {};
          try {
            fnArgs = JSON.parse(tc.function.arguments || "{}");
          } catch {
            fnArgs = {};
          }

          const result = await callAgentTool(fnName, fnArgs);
          toolCalls.push({ tool: fnName, args: fnArgs, result: result.slice(0, 500) });

          // 把工具结果加入历史
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result.slice(0, 2000), // 截断避免 token 过多
          });
        }

        // 继续循环让 LLM 看到工具结果并决定下一步
        continue;
      }

      // LLM 直接回复文本，结束循环
      return NextResponse.json({
        reply: msg.content || "（无回复）",
        toolCalls,
      });
    }

    // 超过最大轮数
    return NextResponse.json({
      reply: "操作步骤过多，已停止。",
      toolCalls,
    });
  } catch (err) {
    return NextResponse.json({
      reply: `❌ ${err instanceof Error ? err.message : String(err)}`,
      toolCalls,
    });
  }
}
