# mcp-s — Índice de MCP servers (Vorluno)

Catálogo de los Model Context Protocol servers de Jose / Vorluno.

**No es un monorepo:** cada MCP vive en su **propio repo independiente** para versionarse,
publicarse y clonarse por separado. Este repo solo los lista.

| MCP | Repo | Descripción |
|---|---|---|
| **batuta-mcp** | https://github.com/vorluno/batuta-mcp | Descompone tareas en planes con fronteras de archivos disjuntas y crea git worktrees. Para Warp / Claude Code. |
| **agora-mcp** | https://github.com/vorluno/agora-mcp | Espacio compartido por repo: las sesiones de Claude Code ven qué hacen las demás, avisos de colisión, notas y persistencia (hooks + MCP + SQLite WAL). |

## Convención

- Cada MCP nuevo = su propio repo `vorluno/<nombre>-mcp`.
- Al crearlo, se agrega una fila a la tabla de arriba.
- Conexión típica (stdio): `claude mcp add <nombre> -- bun run C:\<nombre>-mcp\src\index.ts`,
  o el JSON `mcpServers` equivalente en Warp.
