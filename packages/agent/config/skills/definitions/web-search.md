---
name: web-search
description: 网页搜索技能，通过浏览器进行 Google/Bing 搜索
type: procedure
when_to_use: 当用户需要搜索信息、查找内容、查询问题时使用
triggers:
  keywords:
    - 搜索
    - 搜一下
    - 查一下
    - Google
    - 帮我查
    - 查找
    - search
    - look up
    - find
  intents:
    - web_search
    - find_information
  tools_mentioned:
    - headless_goto
    - headless_type
    - headless_press
    - headless_snapshot
metadata:
  priority: 8
  tags:
    - search
    - google
    - browser
examples:
  - input: 搜索一下最新的 AI 新闻
  - input: 帮我查一下今天天气
  - input: Google 搜索 TypeScript MCP
---

# 网页搜索技能

## 重要提示

**优先使用 Google 搜索**，因为已保存登录状态，可以正常使用。

## Google 搜索步骤（推荐）

1. **打开 Google**
   ```
   headless_goto({ url: "https://www.google.com" })
   ```

2. **获取页面快照**
   ```
   headless_snapshot()
   ```

3. **找到搜索框并输入关键词**
   - 搜索框通常是 `textarea[name="q"]` 或 `input[name="q"]`
   ```
   headless_type({ ref: "ref_N", text: "搜索关键词" })
   ```

4. **按 Enter 提交搜索**
   ```
   headless_press({ key: "Enter" })
   ```

5. **获取搜索结果**
   ```
   headless_snapshot()
   ```

## 其他搜索引擎备选

如果 Google 遇到人机验证，可以尝试：
- Bing: `https://www.bing.com`
- DuckDuckGo: `https://duckduckgo.com`

## 技巧

- 使用 `headless_press({ key: "Enter" })` 代替点击搜索按钮
- 输入后等待自动补全消失再操作
- 如果遇到验证码，切换到其他搜索引擎
