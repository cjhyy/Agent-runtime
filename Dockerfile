# Agent Runtime Docker Image
FROM node:20-slim

# 安装 Playwright 依赖
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制 package.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 安装 Playwright 浏览器
RUN npx playwright install chromium

# 复制源代码
COPY . .

# 编译 TypeScript
RUN npm run build

# 创建数据目录（用于挂载）
RUN mkdir -p /data/browser-profile /data/memory /data/workspace /data/logs

# 环境变量
ENV WORKSPACE=/data/workspace
ENV BROWSER_PROFILE_PATH=/data/browser-profile
ENV DATA_DIR=/data/memory
ENV LOG_DIR=/data/logs

# 暴露 MCP 端口（如果需要）
EXPOSE 3000

# 默认启动 CLI
CMD ["node", "dist/cli/index.js"]
