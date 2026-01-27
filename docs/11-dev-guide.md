# 11 开发与联调（MVP）

本章给出最小联调路径：能构建镜像、能启动 MCP Server、能在 MCP Client 中调用 tools。

## 1) 构建沙箱镜像

在仓库根目录：

```bash
docker build -t agent-sandbox:mvp -f docker/Dockerfile .
```

## 2) 构建 MCP Server

```bash
npm install
npm run build
```

## 3) 配置 Claude Desktop（示例）

编辑配置文件（Mac）：

- `~/Library/Application Support/Claude/claude_desktop_config.json`

示例：

```json
{
  "mcpServers": {
    "agent-runtime": {
      "command": "node",
      "args": ["/path/to/agent-runtime/dist/index.js"]
    }
  }
}
```

## 4) 最小冒烟测试（建议顺序）

1. `sandbox_create`
2. `browser_goto` 打开一个页面
3. `browser_snapshot` 看是否能返回 title/text/elements
4. `code_run` 执行 `python`：打印 hello
5. `file_write` 写入一个文本文件
6. `file_read` 读回验证
7. `sandbox_destroy`

