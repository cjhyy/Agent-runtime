---
name: code-execution
description: 执行 Python 或 Shell 代码
type: procedure
when_to_use: 当用户需要执行代码、运行脚本、进行计算时使用
triggers:
  keywords:
    - 执行代码
    - 运行代码
    - Python
    - 计算
    - 代码
    - 脚本
    - execute
    - run code
    - calculate
  intents:
    - execute_code
    - run_script
    - calculate
  tools_mentioned:
    - code_execute
    - code_run
metadata:
  priority: 6
  tags:
    - code
    - python
    - shell
    - execution
examples:
  - input: 帮我算一下 123 * 456
  - input: 运行一段 Python 代码
  - input: 执行 ls -la 命令
---

# 代码执行技能

## 工具

**code_execute** - 执行代码

参数:
- `code` (必填): 要执行的代码
- `language` (可选): 语言类型，支持 "python" (默认) 和 "shell"

## Python 执行

```
code_execute({
  code: "print('Hello, World!')",
  language: "python"
})
```

### 常用场景

1. **数学计算**
   ```python
   result = 123 * 456
   print(f"结果: {result}")
   ```

2. **数据处理**
   ```python
   import json
   data = {"name": "test", "value": 42}
   print(json.dumps(data, indent=2))
   ```

3. **文件操作**
   ```python
   with open("output.txt", "w") as f:
       f.write("Hello")
   print("文件已写入")
   ```

## Shell 执行

```
code_execute({
  code: "ls -la",
  language: "shell"
})
```

## 注意事项

- Python 代码在沙箱环境中执行
- 工作目录由 WORKSPACE 环境变量指定
- 执行结果包含 stdout 和 stderr
- 长时间运行的代码可能超时
