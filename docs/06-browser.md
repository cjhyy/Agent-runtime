# 06 浏览器能力（Playwright）

本章定义容器内 `browser.*` 方法的行为与返回结构，重点是 `snapshot`：它决定了 LLM 是否能可靠地“看懂页面并操作”。

## 浏览器初始化

建议参数：

- `headless: true`
- `args`：
  - `--no-sandbox`
  - `--disable-dev-shm-usage`

> 在容器内运行 Chromium 时常见问题是 `/dev/shm` 太小导致崩溃，`--disable-dev-shm-usage` 可缓解。

## 方法定义

### `browser.goto`

入参：

- `url: string`

行为：

- `page.goto(url, { waitUntil: "domcontentloaded" })`
- 返回 `{ url, title }`

错误：

- URL 非法：`BAD_REQUEST`
- 导航失败：`BROWSER_NAVIGATION_FAILED`

### `browser.click`

入参：

- `selector: string`（ref 或 CSS）

行为：

- 如果 selector 以 `ref_` 开头：转换为 `[data-agent-ref="${selector}"]`
- 否则按 CSS selector 处理（MVP 直接允许）
- 可选：如果点击导致导航，等待 `domcontentloaded`

返回：

- `{ url, title, navigated: boolean }`

错误：

- 找不到元素：`NOT_FOUND`
- 点击被拦截/不可见：`BROWSER_CLICK_FAILED`

### `browser.type`

入参：

- `selector: string`（ref 或 CSS）
- `text: string`

行为：

- 定位输入框（ref → data 属性；否则 CSS）
- `fill` 或 `type`：
  - `fill` 更稳定（直接设置值）
  - `type` 更接近真实输入（可触发 key events）

MVP 建议：默认 `fill`，必要时后续加 `slowly`/`pressEnter` 参数。

返回：

- `{ url, title }`

错误：

- 元素不存在：`NOT_FOUND`
- 元素不可编辑：`BAD_REQUEST` 或 `BROWSER_TYPE_FAILED`

### `browser.snapshot`

入参（可选）：

- `maxTextLen?: number`（默认 5000）

返回（建议字段）：

- `url: string`
- `title: string`
- `screenshot: string`（base64 PNG）
- `text: string`（可见文本，限制长度）
- `elements: string`（可交互元素列表，文本格式）

#### elements 列表格式（强约束）

每行一个元素，便于 LLM 引用：

```text
[ref_1] button "Sign in"
[ref_2] input placeholder="Search"
[ref_3] a "Home" -> https://example.com
```

要求：

- ref 唯一：`ref_1...ref_n`
- 文本取值优先级：
  - `aria-label`
  - `innerText`（截断）
  - `placeholder`
  - `title`
- 对链接 `a`：尽量包含 `href`（可截断）

#### 何为“可交互元素”

MVP 建议覆盖：

- `button`
- `a[href]`
- `input`
- `textarea`
- `select`
- `role=button` / `role=link` / `contenteditable=true`

过滤建议：

- 忽略不可见元素（`display:none` / `visibility:hidden` / `offsetParent=null` 等）
- 忽略尺寸过小（可选）

#### ref 注入策略

在 snapshot 中对每个元素设置属性：

- `element.setAttribute("data-agent-ref", "ref_1")`

注意：

- 页面强 CSP/框架渲染可能导致元素重建，ref 会失效
- 因此 ref 不保证跨 snapshot 稳定；LLM 每次交互前最好先 snapshot

## 截图策略

MVP 默认行为：

- `page.screenshot({ fullPage: false })`（仅 viewport，降低体积）
- base64 返回

后续可扩展：

- 增加 `fullPage` 参数支持全页截图
- 对大截图做压缩或存文件

## 稳定性建议（很重要）

- `goto/click` 后尽量等待 `domcontentloaded`
- 对 SPA 页面，必要时增加 `networkidle`（但可能导致长等待）
- snapshot 前可以短暂 `waitForTimeout(100~300ms)`（减少抖动），但不要过度依赖

