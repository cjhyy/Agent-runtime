---
name: browser-basics
description: 浏览器基础操作，包括打开网页、点击、输入、截图。触发词："打开网页"、"访问网站"、"浏览器"、"截图"
---

# 浏览器基础操作

## 核心工具

1. **browser_goto** - 打开网页
   - 参数: `url` (必填)
   - 示例: `browser_goto({ url: "https://example.com" })`

2. **browser_snapshot** - 获取页面快照
   - 返回页面的可交互元素列表，每个元素有 `ref_N` 标识符
   - 这是了解页面结构的关键步骤

3. **browser_click** - 点击元素
   - 参数: `ref` (必填) - 元素的引用标识符
   - 示例: `browser_click({ ref: "ref_5" })`

4. **browser_type** - 输入文本
   - 参数: `ref` (必填), `text` (必填)
   - 示例: `browser_type({ ref: "ref_10", text: "Hello World" })`

5. **browser_wait** - 等待
   - 参数: `time` (毫秒)
   - 用于等待页面加载或动画完成

6. **browser_screenshot** - 截图保存
   - 参数: `filename` (必填)
   - 保存当前页面截图到文件

## 操作流程

1. 先用 `browser_goto` 打开目标网页
2. 用 `browser_snapshot` 获取页面结构
3. 根据 snapshot 返回的 `ref_N` 选择要操作的元素
4. 使用 `browser_click` 或 `browser_type` 进行交互
5. 操作后再次 `browser_snapshot` 确认结果

## 注意事项

- 每次操作后都应该获取新的 snapshot 来确认状态
- 如果找不到目标元素，可能需要滚动页面或等待加载
- 某些网站可能有反爬虫机制，需要适当等待
