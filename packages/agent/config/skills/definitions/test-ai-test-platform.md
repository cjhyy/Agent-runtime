---
name: test-ai-test-platform
description: 在 test-ai-test-platform.aws.tankatalk.com 发送消息
type: procedure
when_to_use: 当用户需要在 tankatalk 测试平台发送消息、联系人时使用
triggers:
  keywords:
    - tankatalk
    - test-ai-test-platform
    - 测试平台
    - Yao JIANG
    - Andrew CHEN
  intents:
    - send_message
    - contact_person
  tools_mentioned:
    - headless_goto
    - headless_click
    - headless_type
    - headless_press
    - headless_snapshot
  context_conditions:
    - field: domain
      operator: contains
      value: tankatalk
metadata:
  priority: 7
  tags:
    - messaging
    - tankatalk
    - test-platform
    - browser
examples:
  - input: 在 test-ai-test-platform.aws.tankatalk.com 找到 Yao JIANG 并发送消息问他在做什么
  - input: 打开 test-ai-test-platform.aws.tankatalk.com 联系 Andrew CHEN 问他项目进度
---

# 在 test-ai-test-platform.aws.tankatalk.com 发送消息

## 概要

- **域名**: test-ai-test-platform.aws.tankatalk.com
- **成功次数**: 2

## 执行步骤

1. **打开聊天页面**
   ```
   headless_goto({ url: "https://test-ai-test-platform.aws.tankatalk.com/chat" })
   ```

2. **获取快照并找到密码输入**
   ```
   headless_snapshot()
   ```
   点击密码输入框（通常是 ref_5）

3. **输入密码**
   ```
   headless_type({ ref: "ref_N", text: "密码" })
   ```
   选择器: `input[type=password]`

4. **点击确认按钮**
   ```
   headless_click({ ref: "ref_M" })
   ```

5. **选择联系人**
   - 获取快照找到目标联系人（如 Yao JIANG）
   ```
   headless_click({ ref: "ref_K" })
   ```

6. **输入消息**
   ```
   headless_type({ ref: "ref_L", text: "消息内容" })
   ```
   选择器: `textarea`

7. **发送消息**
   ```
   headless_press({ key: "Enter" })
   ```

## 技巧与注意事项

- 可能需要输入密码或长文本
- 每一步操作后都应获取新的 snapshot 确认状态
