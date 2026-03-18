---
name: chatgpt-query
description: 向 ChatGPT 提问并获取回答
type: procedure
when_to_use: 当用户需要通过浏览器访问 ChatGPT 并提问时使用
triggers:
  keywords:
    - 问 ChatGPT
    - ChatGPT
    - GPT
    - 问一下
    - 问问
  intents:
    - query_chatgpt
    - ask_ai
  tools_mentioned:
    - headless_goto
    - headless_type
    - headless_click
    - headless_snapshot
    - headless_wait
metadata:
  priority: 5
  tags:
    - chatgpt
    - ai
    - query
    - browser
examples:
  - input: 问 ChatGPT 什么是量子计算
  - input: 用 GPT 帮我写一段代码
---

# ChatGPT 查询技能

## 操作步骤

1. **打开 ChatGPT**
   ```
   headless_goto({ url: "https://chatgpt.com" })
   ```

2. **等待页面加载**
   ```
   headless_wait({ time: 2000 })
   ```

3. **获取页面快照**
   ```
   headless_snapshot()
   ```
   找到输入框元素（通常是 textarea 或 contenteditable div）

4. **输入问题**
   ```
   headless_type({ ref: "ref_N", text: "你的问题" })
   ```
   注意：ChatGPT 的输入框可能是 contenteditable 元素

5. **发送问题**
   - 找到发送按钮并点击
   ```
   headless_click({ ref: "ref_M" })
   ```

6. **等待回答**
   ```
   headless_wait({ time: 10000 })
   ```
   ChatGPT 生成回答需要时间，建议等待 10-15 秒

7. **获取回答**
   ```
   headless_snapshot()
   ```
   在快照中找到回答内容

## 常见问题

- **找不到输入框**: ChatGPT 页面可能有登录提示，需要等待或处理
- **回答未完成**: 增加等待时间
- **页面结构变化**: 使用 snapshot 重新获取元素引用

## 技巧

- 中文问题可以正常使用
- 如果需要截图保存结果，使用 `headless_screenshot`
