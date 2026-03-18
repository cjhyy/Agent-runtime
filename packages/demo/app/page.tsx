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

// ===== Agent Chat Bubble =====
function AgentChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "system",
      content:
        "我是 Agent 助手。告诉我你想做什么，我会操作页面。\n\n试试：\n- 帮我提交一个 Bug Report\n- 去商品页面搜索手机\n- 帮我注册一个账号\n- 在用户列表里找到管理员",
    },
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

      if (data.toolCalls?.length > 0) {
        for (const tc of data.toolCalls) {
          addMsg({
            role: "tool",
            content: `${tc.tool}(${JSON.stringify(tc.args)}) → ${tc.result.slice(0, 200)}`,
          });
        }
      }

      addMsg({ role: "assistant", content: data.reply });

      setHistory(
        (h): LLMHistory[] =>
          [
            ...h,
            { role: "user" as const, content: text },
            { role: "assistant" as const, content: data.reply },
          ].slice(-10)
      );
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
    <div data-agent-ignore>
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

      {open && (
        <div className="fixed bottom-6 right-6 w-96 h-[540px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl shadow-black/50 flex flex-col z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/80">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="font-semibold text-sm">Agent</span>
              <span className="text-xs text-gray-500">可以操作当前页面</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

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
    </div>
  );
}

// ===== Status Dot =====
function StatusDot({ status }: { status: string }) {
  const c =
    status === "connected" || status === "online"
      ? "bg-green-500"
      : status === "disconnected" || status === "offline"
        ? "bg-red-500"
        : "bg-yellow-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${c}`} />;
}

// ===== Page: Dashboard =====
function PageDashboard({
  sdkStatus,
  serverStatus,
  tools,
  log,
  testTool,
  clearLog,
}: {
  sdkStatus: string;
  serverStatus: string;
  tools: { name: string; source: string }[];
  log: string[];
  testTool: (tool: string, args?: Record<string, unknown>) => void;
  clearLog: () => void;
}) {
  const pageTools = tools.filter((t) => t.source === "sdk-bridge");
  const headlessTools = tools.filter((t) => t.source === "playwright");

  return (
    <div>
      {/* Status bar */}
      <div className="flex gap-4 text-sm mb-4">
        <span className="flex items-center gap-1.5">
          <StatusDot status={sdkStatus} /> SDK: {sdkStatus}
        </span>
        <span className="flex items-center gap-1.5">
          <StatusDot status={serverStatus} /> Server: {serverStatus}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="font-semibold text-sm text-gray-400 mb-3">Quick Actions</h2>
          <div className="space-y-2">
            <button onClick={() => testTool("page_snapshot", { maxTextLen: 300 })} className="w-full text-left px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800/50 rounded-lg text-sm transition-colors">
              📷 Page Snapshot (SDK)
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

        {/* Tools */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="font-semibold text-sm text-gray-400 mb-3">Tools ({tools.length})</h2>
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
            {tools.length === 0 && <p className="text-xs text-gray-600">启动 AgentServer 后显示</p>}
          </div>
        </div>

        {/* Log */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-gray-400">Log</h2>
            <button onClick={clearLog} className="text-xs text-gray-600 hover:text-gray-400">Clear</button>
          </div>
          <div className="font-mono text-xs text-gray-400 space-y-1 max-h-64 overflow-y-auto">
            {log.length === 0 && <p className="text-gray-600">点击左侧按钮测试</p>}
            {log.map((l, i) => (
              <p key={i} className="break-all">{l}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Page: Submit Form (工单提交) =====
function PageSubmitForm() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", type: "bug", priority: "medium", description: "" });

  const handleSubmit = () => {
    if (!formData.name || !formData.email) return;
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    setFormData({ name: "", email: "", type: "bug", priority: "medium", description: "" });
  };

  if (submitted) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="text-center py-8">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-lg font-semibold text-green-400 mb-2">工单已提交</h3>
          <div className="text-sm text-gray-400 space-y-1">
            <p>提交人: {formData.name} ({formData.email})</p>
            <p>类型: {formData.type} | 优先级: {formData.priority}</p>
            {formData.description && <p>描述: {formData.description}</p>}
          </div>
          <button onClick={handleReset} className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
            提交新工单
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="font-semibold mb-4">提交工单</h2>
      <p className="text-sm text-gray-500 mb-4">填写以下表单提交一个工单（Agent 可以帮你填写并提交）</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">姓名 *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
            placeholder="输入姓名..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">邮箱 *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
            placeholder="输入邮箱..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">类型</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="bug">Bug Report</option>
            <option value="feature">Feature Request</option>
            <option value="question">Question</option>
            <option value="improvement">Improvement</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">优先级</label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData((f) => ({ ...f, priority: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="critical">紧急</option>
          </select>
        </div>
      </div>
      <div className="mt-4">
        <label className="block text-sm text-gray-400 mb-1">描述</label>
        <textarea
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
          placeholder="详细描述问题..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors">
          提交工单
        </button>
        <button onClick={handleReset} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
          重置
        </button>
      </div>
    </div>
  );
}

// ===== Page: Product List (商品列表) =====
const PRODUCTS = [
  { id: 1, name: "iPhone 15 Pro", price: 7999, category: "手机", stock: 42, rating: 4.8 },
  { id: 2, name: "MacBook Air M3", price: 8999, category: "笔记本", stock: 18, rating: 4.9 },
  { id: 3, name: "AirPods Pro 2", price: 1799, category: "耳机", stock: 156, rating: 4.7 },
  { id: 4, name: "iPad Air", price: 4799, category: "平板", stock: 63, rating: 4.6 },
  { id: 5, name: "Apple Watch Ultra 2", price: 5999, category: "手表", stock: 27, rating: 4.5 },
  { id: 6, name: "Sony WH-1000XM5", price: 2499, category: "耳机", stock: 89, rating: 4.8 },
  { id: 7, name: "Samsung Galaxy S24", price: 5999, category: "手机", stock: 34, rating: 4.4 },
  { id: 8, name: "ThinkPad X1 Carbon", price: 9999, category: "笔记本", stock: 12, rating: 4.3 },
];

function PageProducts() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cart, setCart] = useState<{ id: number; qty: number }[]>([]);
  const [sortBy, setSortBy] = useState<"name" | "price" | "rating">("name");

  const categories = ["all", ...new Set(PRODUCTS.map((p) => p.category))];

  let filtered = PRODUCTS.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category.includes(search);
    const matchCat = categoryFilter === "all" || p.category === categoryFilter;
    return matchSearch && matchCat;
  });
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === "price") return a.price - b.price;
    if (sortBy === "rating") return b.rating - a.rating;
    return a.name.localeCompare(b.name);
  });

  const addToCart = (id: number) => {
    setCart((c) => {
      const existing = c.find((item) => item.id === id);
      if (existing) return c.map((item) => (item.id === id ? { ...item, qty: item.qty + 1 } : item));
      return [...c, { id, qty: 1 }];
    });
  };

  const cartTotal = cart.reduce((sum, item) => {
    const product = PRODUCTS.find((p) => p.id === item.id);
    return sum + (product?.price ?? 0) * item.qty;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索商品..."
            className="flex-1 min-w-48 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c === "all" ? "全部分类" : c}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name" | "price" | "rating")}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="name">按名称</option>
            <option value="price">按价格</option>
            <option value="rating">按评分</option>
          </select>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {filtered.map((p) => (
          <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium text-sm">{p.name}</h3>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">{p.category}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg font-bold text-blue-400">¥{p.price}</span>
              <span className="text-xs text-yellow-500">★ {p.rating}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">库存: {p.stock} 件</p>
            <button
              onClick={() => addToCart(p.id)}
              aria-label={`加入购物车: ${p.name}`}
              className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs transition-colors"
            >
              加入购物车
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-600 text-sm">没有找到匹配的商品</div>
        )}
      </div>

      {/* Cart Summary */}
      {cart.length > 0 && (
        <div className="bg-gray-900 border border-blue-800/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm text-blue-400 mb-2">🛒 购物车 ({cart.reduce((s, i) => s + i.qty, 0)} 件)</h3>
          <div className="space-y-1">
            {cart.map((item) => {
              const product = PRODUCTS.find((p) => p.id === item.id);
              return (
                <div key={item.id} className="flex justify-between text-sm text-gray-400">
                  <span>{product?.name} x{item.qty}</span>
                  <span>¥{(product?.price ?? 0) * item.qty}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-800">
            <span className="font-semibold">合计: ¥{cartTotal}</span>
            <div className="flex gap-2">
              <button onClick={() => setCart([])} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition-colors">
                清空
              </button>
              <button className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs transition-colors">
                结算
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Page: User Management =====
const USERS = [
  { id: 1, name: "张三", email: "zhangsan@example.com", role: "管理员", status: "active", lastLogin: "2026-03-12 09:30" },
  { id: 2, name: "李四", email: "lisi@example.com", role: "编辑", status: "active", lastLogin: "2026-03-11 16:20" },
  { id: 3, name: "王五", email: "wangwu@example.com", role: "用户", status: "inactive", lastLogin: "2026-02-28 11:00" },
  { id: 4, name: "赵六", email: "zhaoliu@example.com", role: "用户", status: "active", lastLogin: "2026-03-12 08:15" },
  { id: 5, name: "孙七", email: "sunqi@example.com", role: "编辑", status: "banned", lastLogin: "2026-01-15 22:30" },
  { id: 6, name: "周八", email: "zhouba@example.com", role: "用户", status: "active", lastLogin: "2026-03-10 14:45" },
];

function PageUsers() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "用户" });

  const filtered = USERS.filter((u) => roleFilter === "all" || u.role === roleFilter);
  const selected = USERS.find((u) => u.id === selectedId);

  const statusColor = (s: string) =>
    s === "active" ? "text-green-400 bg-green-900/30" : s === "inactive" ? "text-yellow-400 bg-yellow-900/30" : "text-red-400 bg-red-900/30";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">全部角色</option>
          <option value="管理员">管理员</option>
          <option value="编辑">编辑</option>
          <option value="用户">用户</option>
        </select>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors"
        >
          + 添加用户
        </button>
        <span className="text-xs text-gray-500 ml-auto">共 {filtered.length} 个用户</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* User Table */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs">
                <th className="text-left px-4 py-3">用户</th>
                <th className="text-left px-4 py-3">角色</th>
                <th className="text-left px-4 py-3">状态</th>
                <th className="text-left px-4 py-3">最后登录</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedId(u.id)}
                  className={`border-b border-gray-800/50 cursor-pointer transition-colors ${selectedId === u.id ? "bg-blue-900/20" : "hover:bg-gray-800/50"}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{u.role}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${statusColor(u.status)}`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.lastLogin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* User Detail */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="font-semibold text-sm text-gray-400 mb-3">用户详情</h3>
          {selected ? (
            <div className="space-y-3">
              <div className="text-center py-3">
                <div className="w-16 h-16 bg-gray-800 rounded-full mx-auto mb-2 flex items-center justify-center text-2xl">
                  {selected.name[0]}
                </div>
                <div className="font-semibold">{selected.name}</div>
                <div className="text-xs text-gray-500">{selected.email}</div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">角色</span><span>{selected.role}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">状态</span><span className={statusColor(selected.status) + " px-2 py-0.5 rounded text-xs"}>{selected.status}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">最后登录</span><span className="text-xs">{selected.lastLogin}</span></div>
              </div>
              <div className="flex gap-2 pt-2">
                <button className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition-colors">编辑</button>
                <button className="flex-1 px-3 py-1.5 bg-red-900/50 hover:bg-red-900/70 text-red-400 rounded-lg text-xs transition-colors">禁用</button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-600 py-8 text-center">点击左侧用户查看详情</p>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40" onClick={() => setShowAddModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">添加用户</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">姓名</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                  placeholder="输入姓名"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">邮箱</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                  placeholder="输入邮箱"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">角色</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="用户">用户</option>
                  <option value="编辑">编辑</option>
                  <option value="管理员">管理员</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
                取消
              </button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors">
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Page: Settings =====
function PageSettings() {
  const [settings, setSettings] = useState({
    siteName: "Agent Runtime Demo",
    language: "zh-CN",
    theme: "dark",
    notifications: true,
    autoSave: true,
    sessionTimeout: "30",
    maxUploadSize: "10",
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="font-semibold mb-4">基本设置</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">站点名称</label>
            <input
              type="text"
              value={settings.siteName}
              onChange={(e) => setSettings((s) => ({ ...s, siteName: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">语言</label>
            <select
              value={settings.language}
              onChange={(e) => setSettings((s) => ({ ...s, language: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            >
              <option value="zh-CN">简体中文</option>
              <option value="en-US">English</option>
              <option value="ja-JP">日本語</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">主题</label>
            <select
              value={settings.theme}
              onChange={(e) => setSettings((s) => ({ ...s, theme: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            >
              <option value="dark">深色</option>
              <option value="light">浅色</option>
              <option value="auto">跟随系统</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">会话超时 (分钟)</label>
            <input
              type="number"
              value={settings.sessionTimeout}
              onChange={(e) => setSettings((s) => ({ ...s, sessionTimeout: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="font-semibold mb-4">开关选项</h2>
        <div className="space-y-3">
          {[
            { key: "notifications" as const, label: "启用通知", desc: "接收系统通知和告警" },
            { key: "autoSave" as const, label: "自动保存", desc: "每 5 分钟自动保存草稿" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm">{label}</div>
                <div className="text-xs text-gray-500">{desc}</div>
              </div>
              <button
                onClick={() => setSettings((s) => ({ ...s, [key]: !s[key] }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${settings[key] ? "bg-blue-600" : "bg-gray-700"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${settings[key] ? "left-5.5" : "left-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors">
          {saved ? "✅ 已保存" : "保存设置"}
        </button>
        <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
          恢复默认
        </button>
      </div>
    </div>
  );
}

// ===== Main App with Tab Navigation =====
type TabKey = "dashboard" | "form" | "products" | "users" | "settings";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "仪表盘", icon: "📊" },
  { key: "form", label: "工单提交", icon: "📝" },
  { key: "products", label: "商品列表", icon: "🛒" },
  { key: "users", label: "用户管理", icon: "👥" },
  { key: "settings", label: "设置", icon: "⚙️" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
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
      } catch {
        /* server offline */
      }
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

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Top Nav */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
          <h1 className="text-lg font-bold">Agent Runtime Demo</h1>
          <nav className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activeTab === tab.key ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Page Content */}
      <div className="max-w-6xl mx-auto p-6">
        {activeTab === "dashboard" && (
          <PageDashboard sdkStatus={sdkStatus} serverStatus={serverStatus} tools={tools} log={log} testTool={testTool} clearLog={() => setLog([])} />
        )}
        {activeTab === "form" && <PageSubmitForm />}
        {activeTab === "products" && <PageProducts />}
        {activeTab === "users" && <PageUsers />}
        {activeTab === "settings" && <PageSettings />}
      </div>

      <AgentChat />
    </div>
  );
}
