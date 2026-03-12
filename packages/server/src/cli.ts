/**
 * AgentServer standalone entry point
 * Usage: node dist/cli.js [--port 3100] [--no-playwright] [--no-sdk-bridge]
 */

import { AgentServer } from "./index.js"

const args = process.argv.slice(2)
const portIdx = args.indexOf("--port")
const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 3100

const server = new AgentServer({
  port,
  enablePlaywright: !args.includes("--no-playwright"),
  enableSDKBridge: !args.includes("--no-sdk-bridge"),
})

server.start().catch((err) => {
  console.error("Failed to start:", err)
  process.exit(1)
})

const cleanup = async () => {
  await server.stop()
  process.exit(0)
}
process.on("SIGTERM", cleanup)
process.on("SIGINT", cleanup)
