# MCP Test Setup - Official Package

## Quick Start

### 1. Start your Next.js app
```bash
npm run dev
# Runs on http://localhost:3000
```

### 2. Start MCP server (official package)
```bash
npx @playwright/mcp@latest --port 8080
# Or with specific browser options:
npx @playwright/mcp@latest --port 8080 --headless --browser chromium
```

### 3. Run the smoke test
```bash
export MCP_URL=http://127.0.0.1:8080/sse
export NEXT_PUBLIC_APP_URL=http://localhost:3000
node tests/mcp-smoke.mjs
```

## One-liner Commands

### Headless Chrome test:
```bash
MCP_URL=http://127.0.0.1:8080/sse NEXT_PUBLIC_APP_URL=http://localhost:3000 node tests/mcp-smoke.mjs
```

### Visible browser test:
```bash
# Start server with visible browser (headed mode is default)
npx @playwright/mcp@latest --port 8080 --browser chromium

# Then run test
MCP_URL=http://127.0.0.1:8080/sse NEXT_PUBLIC_APP_URL=http://localhost:3000 HEADLESS=false node tests/mcp-smoke.mjs
```

## Available MCP Server Flags

- `--headless` - Run browser in headless mode
- `--browser <name>` - Browser to use (chromium, firefox, webkit)
- `--isolated` - Use isolated browser contexts
- `--save-trace` - Save traces for debugging
- `--user-data-dir <path>` - Custom user data directory
- `--port <number>` - Server port (default: 8080)

## Install Browsers (if needed)
```bash
npx playwright install chromium
```

## Troubleshooting

1. Check MCP server is running:
```bash
curl -I http://127.0.0.1:8080/sse
```

2. Check app is running:
```bash
curl -I http://localhost:3000
```

3. Kill any stale processes:
```bash
lsof -tiTCP:8080 -sTCP:LISTEN | xargs -r kill
```