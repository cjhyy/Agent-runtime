import { createRuntime, type AgentRuntime } from "@agent-runtime/server"

let runtime: AgentRuntime | null = null

export async function getRuntime(): Promise<AgentRuntime> {
  if (!runtime) {
    runtime = await createRuntime({ port: 3100 })
  }
  return runtime
}
