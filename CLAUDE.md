# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Runtime is an LLM-friendly sandbox execution environment that allows AI agents to perform browser operations, code execution, and file management in isolated Docker containers. It exposes capabilities via MCP (Model Context Protocol) for integration with Claude Desktop.

**Current Status**: Design + documentation phase. MVP code implementation is in progress.

## Architecture

Three-layer communication model:

```
Claude Desktop (MCP Client)
        │ stdio (JSON-RPC)
        ▼
MCP Server (Node.js) ─── src/
        │ TCP Socket (port 9999)
        ▼
Sandbox Container (Docker) ─── container/
   ├── Playwright (browser)
   ├── Python/Shell executor
   └── /workspace filesystem
```

Key components:
- `src/index.ts` - MCP Server entry point, exposes 10 tools
- `src/sandbox.ts` - Docker container lifecycle management via dockerode
- `src/rpc-client.ts` - TCP client for container communication
- `container/server.ts` - In-container RPC server handling browser/code/file operations
- `docker/Dockerfile` - Sandbox image with Node.js, Python, Chromium, Playwright

## Build Commands

```bash
# Build sandbox Docker image
docker build -t agent-sandbox:mvp -f docker/Dockerfile .

# Install dependencies and build MCP Server
npm install
npm run build

# Build container RPC server (inside container or for local testing)
cd container && npm install && npx tsc
```

## MCP Tools (10 total)

Sandbox: `sandbox_create`, `sandbox_destroy`
Browser: `browser_goto`, `browser_click`, `browser_type`, `browser_snapshot`
Code: `code_run` (python/shell)
File: `file_read`, `file_write`, `file_list`

## RPC Protocol

Newline-delimited JSON over TCP port 9999:
- Request: `{"method":"browser.goto","params":{"url":"..."}}\n`
- Response: `{"success":true,"data":{...}}\n` or `{"success":false,"error":{"code":"NOT_FOUND","message":"..."}}\n`

## Key Design Decisions

- **ref system**: `browser_snapshot` assigns `data-agent-ref="ref_N"` attributes to interactive elements, enabling LLM to reference elements by `ref_1`, `ref_2`, etc.
- **Single sandbox (MVP)**: Only one container at a time; `sandbox_create` destroys existing sandbox first
- **Workspace constraint**: All file operations are relative to `/workspace` inside container

## Documentation

Detailed specs in `docs/`:
- `01-architecture.md` - System design and data flow
- `02-mcp-server.md` - Tool definitions and MCP protocol
- `04-rpc-protocol.md` - RPC message format and error codes
- `05-container-server.md` - Container-side implementation
- `06-browser.md` - Playwright integration and snapshot format
