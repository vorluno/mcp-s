# mcp-s — Monorepo de MCP servers

Colección de Model Context Protocol servers locales (stdio) de Jose / Vorluno.
Cada subcarpeta es un MCP autónomo con su propio `package.json`.

| MCP | Descripción | Estado |
|---|---|---|
| [`batuta-mcp`](./batuta-mcp) | Descompone tareas en planes con fronteras disjuntas y crea git worktrees. | En desarrollo |

## Conexión (genérico)

- **Warp:** MCP settings → `+ Add` → pegar el JSON del `mcpServers` del MCP, o usar `~/.agents/.mcp.json`.
- **Claude Code:** `claude mcp add <name> -- bun run <ruta-al-index.ts>` (scope user).

Ver el README de cada MCP para su comando exacto.
