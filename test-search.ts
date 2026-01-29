/**
 * 测试脚本：搜索最火的 AI repo
 */
import { createAgent } from "./src/agent/index.js"

async function main() {
  const agent = createAgent({
    verbose: true,
    maxIterations: 35  // 增加迭代次数
  })

  try {
    console.log("🚀 开始搜索最火的 AI repo...\n")

    const result = await agent.run(
      `帮我搜索2025年最火的AI GitHub项目。请：
1. 先去Google搜索 "2025 trending AI GitHub repositories"
2. 找到至少5个热门AI项目
3. 去GitHub上查看每个项目的详细信息（星标数、描述）
4. 最后用中文总结这些项目，包括：项目名、GitHub链接、星标数、简介`
    )

    console.log("\n" + "=".repeat(60))
    console.log("📊 最终结果:")
    console.log("=".repeat(60))
    console.log(result.response)
    console.log("\n📈 统计:")
    console.log(`  - 迭代次数: ${result.iterations}`)
    console.log(`  - 工具调用: ${result.toolCalls.length}`)

  } catch (err) {
    console.error("Error:", err)
  } finally {
    await agent.close()
  }
}

main()
