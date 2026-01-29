---
name: web-search
description: 网页搜索技能。触发词："搜索"、"搜一下"、"查一下"、"Google"、"帮我查"
---

# 网页搜索技能

## 重要提示

**优先使用 Google 搜索**，因为已保存登录状态，可以正常使用。

## Google 搜索步骤（推荐）

1. **打开 Google**
   ```
   browser_goto({ url: "https://www.google.com" })
   ```

2. **获取页面快照**
   ```
   browser_snapshot()
   ```

3. **找到搜索框并输入关键词**
   - 搜索框通常是 `textarea[name="q"]` 或 `input[name="q"]`
   ```
   browser_type({ selector: "ref_N", text: "搜索关键词" })
   ```

4. **按 Enter 提交搜索**
   ```
   browser_press({ key: "Enter" })
   ```

5. **获取搜索结果**
   ```
   browser_snapshot()
   ```

## 其他搜索引擎备选

如果 Google 遇到人机验证，可以尝试：
- Bing: `https://www.bing.com`
- DuckDuckGo: `https://duckduckgo.com`

## 技巧

- 使用 `browser_press({ key: "Enter" })` 代替点击搜索按钮
- 输入后等待自动补全消失再操作
- 如果遇到验证码，切换到其他搜索引擎
