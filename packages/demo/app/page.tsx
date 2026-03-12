"use client";

import { useState, useRef, useEffect } from "react";

// ===== Types =====
interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

interface LLMHistory {
  role: "user" | "assistant";
  content: string;
}

// ===== Agent Chat Bubble (右下角悬浮) =====
function AgentChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "system", content: "我是 Agent 助手，用自然语言告诉我你想做什么，我会自动操作页面。\n\n比如：在名字里输入张三、点击提交按钮、滚动到底部" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<LLMHistory[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMsg = (msg: ChatMessage) => setMessages((p) => [...p, msg]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    addMsg({ role: "user", content: text });
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();

      // 显示工具调用过程
      if (data.toolCalls?.length > 0) {
        for (const tc of data.toolCalls) {
          addMsg({
            role: "tool",
            content: `${tc.tool}(${JSON.stringify(tc.args)}) → ${tc.result.slice(0, 200)}`,
          });
        }
      }

      // 显示 LLM 回复
      addMsg({ role: "assistant", content: data.reply });

      // 更新对话历史（给下一轮 LLM 用）
      setHistory((h) => [
        ...h,
        { role: "user", content: text },
        { role: "assistant", content: data.reply },
      ].slice(-10));
    } catch (err) {
      addMsg({
        role: "assistant",
        content: `执行失败: ${err instanceof Error ? err.message : "请确保 AgentServer 和 API 已启动"}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 悬浮气泡按钮 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all hover:scale-105 z-50"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Chat 面板 */}
      {open && (
        <div className="fixed bottom-6 right-6 w-96 h-[540px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl shadow-black/50 flex flex-col z-50 overflow-hidden">
          {/* Chat Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/80">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="font-semibold text-sm">Agent</span>
              <span className="text-xs text-gray-500">可以操作当前页面</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : msg.role === "tool"
                        ? "bg-gray-800 text-gray-500 font-mono text-xs border border-gray-700/50"
                        : msg.role === "system"
                          ? "bg-gray-800/50 text-gray-400 text-xs"
                          : "bg-gray-800 text-gray-100"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-xl px-3 py-2 text-sm text-gray-400">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce">·</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>·</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-700 bg-gray-800/50">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !loading) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="说说你想做什么..."
                disabled={loading}
                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
              >
                ↵
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ===== Dashboard (测试仪表盘主页面) =====
function StatusDot({ status }: { status: string }) {
  const c =
    status === "connected" || status === "online"
      ? "bg-green-500"
      : status === "disconnected" || status === "offline"
        ? "bg-red-500"
        : "bg-yellow-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${c}`} />;
}

function Dashboard() {
  const [sdkStatus, setSdkStatus] = useState("connecting");
  const [serverStatus, setServerStatus] = useState("checking");
  const [tools, setTools] = useState<{ name: string; source: string }[]>([]);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const check = () => {
      const sdk = (window as any).__agentSDK;
      setSdkStatus(sdk?.isConnected?.() ? "connected" : sdk ? "disconnected" : "connecting");
    };
    const t = setInterval(check, 2000);
    check();
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("http://localhost:3100/health");
        setServerStatus(res.ok ? "online" : "offline");
      } catch {
        setServerStatus("offline");
      }
    };
    const t = setInterval(check, 5000);
    check();
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("http://localhost:3100/tools");
        const data = await res.json();
        setTools(data.tools || []);
      } catch { /* server offline */ }
    };
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const addLog = (s: string) => setLog((p) => [...p, `[${new Date().toLocaleTimeString()}] ${s}`]);

  const testTool = async (tool: string, args: Record<string, unknown> = {}) => {
    addLog(`→ ${tool} ${JSON.stringify(args)}`);
    try {
      const res = await fetch("http://localhost:3100/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, arguments: args }),
      });
      const data = await res.json();
      addLog(data.success ? `✅ ${String(data.result).slice(0, 200)}` : `❌ ${data.error}`);
    } catch (e) {
      addLog(`❌ ${e instanceof Error ? e.message : "failed"}`);
    }
  };

  const pageTools = tools.filter((t) => t.source === "sdk-bridge");
  const headlessTools = tools.filter((t) => t.source === "playwright");

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Title */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Agent Runtime Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">测试仪表盘 · 右下角可以和 Agent 对话指挥操作</p>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <StatusDot status={sdkStatus} /> SDK: {sdkStatus}
            </span>
            <span className="flex items-center gap-1.5">
              <StatusDot status={serverStatus} /> Server: {serverStatus}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Quick Actions */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="font-semibold text-sm text-gray-400 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <button onClick={() => testTool("page_snapshot", { maxTextLen: 300 })} className="w-full text-left px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800/50 rounded-lg text-sm transition-colors">
                📷 Page Snapshot
              </button>
              <button onClick={() => testTool("page_list_connections")} className="w-full text-left px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800/50 rounded-lg text-sm transition-colors">
                🔗 List SDK Connections
              </button>
              <button onClick={() => testTool("headless_goto", { url: "https://www.google.com" })} className="w-full text-left px-3 py-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-800/50 rounded-lg text-sm transition-colors">
                🎭 Headless → Google
              </button>
              <button onClick={() => testTool("headless_snapshot", { maxTextLen: 300 })} className="w-full text-left px-3 py-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-800/50 rounded-lg text-sm transition-colors">
                🎭 Headless Snapshot
              </button>
            </div>
          </div>

          {/* Registered Tools */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="font-semibold text-sm text-gray-400 mb-3">
              Tools ({tools.length})
            </h2>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {pageTools.length > 0 && (
                <div>
                  <p className="text-xs text-blue-400 mb-1">page_* (SDK Bridge)</p>
                  <div className="flex flex-wrap gap-1">
                    {pageTools.map((t) => (
                      <span key={t.name} className="px-2 py-0.5 bg-blue-900/30 border border-blue-800/40 rounded text-xs text-blue-300">{t.name}</span>
                    ))}
                  </div>
                </div>
              )}
              {headlessTools.length > 0 && (
                <div>
                  <p className="text-xs text-purple-400 mb-1">headless_* (Playwright)</p>
                  <div className="flex flex-wrap gap-1">
                    {headlessTools.map((t) => (
                      <span key={t.name} className="px-2 py-0.5 bg-purple-900/30 border border-purple-800/40 rounded text-xs text-purple-300">{t.name}</span>
                    ))}
                  </div>
                </div>
              )}
              {tools.length === 0 && (
                <p className="text-xs text-gray-600">启动 AgentServer 后显示</p>
              )}
            </div>
          </div>

          {/* Log */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm text-gray-400">Log</h2>
              <button onClick={() => setLog([])} className="text-xs text-gray-600 hover:text-gray-400">Clear</button>
            </div>
            <div className="font-mono text-xs text-gray-400 space-y-1 max-h-64 overflow-y-auto">
              {log.length === 0 && <p className="text-gray-600">点击左侧按钮测试</p>}
              {log.map((l, i) => (
                <p key={i} className="break-all">{l}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Sample Content (for Agent to interact with) */}
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Sample Form (Agent 可以操作这些元素)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">名字</label>
              <input
                type="text"
                placeholder="输入名字..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">邮箱</label>
              <input
                type="email"
                placeholder="输入邮箱..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">类型</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="bug">Bug Report</option>
                <option value="feature">Feature Request</option>
                <option value="question">Question</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">操作</label>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors">
                  提交
                </button>
                <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
                  重置
                </button>
                <a href="#top" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors inline-block">
                  回到顶部
                </a>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm text-gray-400 mb-1">备注</label>
            <textarea
              rows={3}
              placeholder="输入备注..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Main Page =====
export default function Home() {
  return (
    <>
      <Dashboard />
      <AgentChat />
    </>
  );
}
