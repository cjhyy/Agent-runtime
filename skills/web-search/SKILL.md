---
name: web-search
description: 网页搜索技能。触发词："搜索"、"搜一下"、"查一下"、"Google"、"百度"、"帮我查"
---

# 网页搜索技能

## 重要提示

**优先使用百度搜索**，因为 Google 会触发人机验证导致搜索失败。

## 百度搜索步骤（推荐）

1. **打开百度**
   ```
   browser_goto({ url: "https://www.baidu.com" })
   ```

2. **获取页面快照**
   ```
   browser_snapshot()
   ```

3. **找到搜索框并输入关键词**
   - 搜索框通常是 `input#kw` 或带有 "百度一下" 按钮旁边的输入框
   ```
   browser_type({ selector: "ref_N", text: "搜索关键词" })
   ```

4. **按 Enter 提交搜索**
   ```
   browser_press({ key: "Enter" })
   ```
   注意：不要点击搜索按钮，因为可能被自动补全下拉框遮挡

5. **获取搜索结果**
   ```
   browser_snapshot()
   ```

## 为什么不用 Google

- Google 会检测自动化浏览器
- 即使使用 stealth 模式也经常被人机验证拦截
- 会跳转到 `google.com/sorry/` 验证页面

## 其他搜索引擎备选

如果百度也不行，可以尝试：
- Bing: `https://www.bing.com`
- DuckDuckGo: `https://duckduckgo.com`

## 技巧

- 使用 `browser_press({ key: "Enter" })` 代替点击搜索按钮
- 输入后等待自动补全消失再操作
