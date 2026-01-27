FROM node:20-slim

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    # Playwright 依赖
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    # 字体
    fonts-liberation \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 创建用户和目录
RUN useradd -m -s /bin/bash sandbox \
    && mkdir -p /workspace /app \
    && chown -R sandbox:sandbox /workspace /app

# 设置 Python 虚拟环境
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir requests beautifulsoup4 pandas numpy

# 复制 MCP Server 代码
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install

# 安装 Playwright 浏览器
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium

# 复制并编译源码
COPY src ./src
RUN npx tsc

# 切换用户
USER sandbox
WORKDIR /workspace

# MCP Server 通过 stdio 通信，不需要暴露端口
CMD ["node", "/app/dist/index.js"]
