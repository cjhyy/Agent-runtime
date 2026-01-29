---
name: chatgpt-query
description: 向 ChatGPT 提问并获取回答。触发词："问 ChatGPT"、"ChatGPT"、"GPT"、"问一下"
---

# ChatGPT 查询技能

## 操作步骤

1. **打开 ChatGPT**
   ```
   browser_goto({ url: "https://chatgpt.com" })
   ```

2. **等待页面加载**
   ```
   browser_wait({ time: 2000 })
   ```

3. **获取页面快照**
   ```
   browser_snapshot()
   ```
   找到输入框元素（通常是 textarea 或 contenteditable div）

4. **输入问题**
   ```
   browser_type({ ref: "ref_N", text: "你的问题" })
   ```
   注意：ChatGPT 的输入框可能是 contenteditable 元素

5. **发送问题**
   - 找到发送按钮并点击
   ```
   browser_click({ ref: "ref_M" })
   ```

6. **等待回答**
   ```
   browser_wait({ time: 10000 })
   ```
   ChatGPT 生成回答需要时间，建议等待 10-15 秒

7. **获取回答**
   ```
   browser_snapshot()
   ```
   在快照中找到回答内容

## 常见问题

- **找不到输入框**: ChatGPT 页面可能有登录提示，需要等待或处理
- **回答未完成**: 增加等待时间
- **页面结构变化**: 使用 snapshot 重新获取元素引用

## 技巧

- 中文问题可以正常使用
- 如果需要截图保存结果，使用 `browser_screenshot`
