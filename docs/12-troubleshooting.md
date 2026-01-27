# 12 常见问题排查（MVP）

## 容器创建成功但 RPC 连不上（ECONNREFUSED）

可能原因：

- 容器内 `server.js` 没起来 / 监听端口不是 9999
- TypeScript 没编译成功，CMD 指向的文件不存在
- 端口映射未生效（inspect 取错字段）

建议排查：

- `docker ps` 看容器是否在跑
- `docker logs <container>` 看是否有报错
- `docker inspect <container>` 确认 `9999/tcp` 的 HostPort

## Playwright 启动失败 / Chromium 崩溃

常见原因：

- 缺系统依赖（字体/库）
- `/dev/shm` 太小

建议：

- 增加 `--disable-dev-shm-usage`
- 在 Dockerfile 中安装必要依赖与字体

## browser.click 找不到元素

建议：

- 先 `browser_snapshot`，从返回的 `elements` 中挑 ref
- 页面更新后 ref 可能失效，重新 snapshot 再 click

## code_run 没输出 / 卡住

建议：

- 先用简单命令验证：`python -c "print('hi')"`
- 后续可给 `code.run` 增加超时（见 `07-code-execution.md`）

## file_read/file_write 行为不符合预期

建议：

- 确认路径相对 `/workspace`
- 先 `file_list` 看目录内容再读写

