import { NextResponse } from "next/server"
import { getRuntime } from "../lib/runtime"

export async function POST(request: Request) {
  const { message } = await request.json()

  try {
    const runtime = await getRuntime()
    const result = await runtime.run(message)

    return NextResponse.json({
      reply: result.response,
      status: result.status,
    })
  } catch (err) {
    return NextResponse.json({
      reply: `执行失败: ${err instanceof Error ? err.message : String(err)}`,
      status: "failed",
    })
  }
}
