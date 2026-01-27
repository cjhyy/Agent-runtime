# 09 Docker 镜像（MVP）

本章描述 MVP 镜像的最小目标：能跑 Playwright（chromium）、能跑 python3、能执行 shell，并提供 `/workspace`。

## 基础镜像

- 推荐：`node:20-slim`（与 MCP Server 生态一致，构建 TS 更方便）

## 必备依赖（MVP）

- `python3` / `python3-pip` / `python3-venv`（使用虚拟环境避免系统包冲突）
- `chromium`
- 常用字体（避免截图/渲染乱码）：`fonts-liberation`、`fonts-noto-cjk`

## Playwright

两种路线：

1. 安装 Playwright 并下载浏览器（README 示例）
2. 使用系统 chromium（更轻量，但要处理兼容参数）

MVP 建议保持 README 的方式，先跑通：

- `ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`
- `npx playwright install chromium`

## 用户与目录

- 创建非 root 用户：`sandbox`
- 创建目录：
  - `/workspace`（运行时读写）
  - `/app`（放 server 代码）
- `WORKDIR /workspace`
- `CMD ["node", "/app/server.js"]`

## 构建缓存建议（可选）

为提升构建速度：

- 先 COPY `package.json` / lockfile 再 `npm install`
- 最后再 COPY 源码并 `tsc`

