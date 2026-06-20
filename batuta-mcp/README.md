# batuta-mcp

MCP server local (stdio) que descompone tareas en planes con fronteras de archivos
disjuntas, valida solapes y crea git worktrees con un prompt listo por plan.

Diseño: ver `docs/specs/2026-06-20-batuta-mcp-design.md`.

## Tools

- `decompose_into_plans({ brainDump, projectHint?, repoPath? })` → `{ plans, overlapsResolved, attempts }`
- `check_boundary_overlaps({ plans })` → `{ overlaps, ok }`
- `scaffold_worktrees({ repoPath, plans, dryRun? })` → `{ results }`

## Requisitos

- [Bun](https://bun.sh) 1.3+
- `claude` CLI logueado (para `decompose_into_plans`)
- `git` 2.x (para `scaffold_worktrees`)

## Instalación

```bash
bun install
```

## Conexión

### Warp
MCP settings → `+ Add` → pegar (o ponerlo en `~/.agents/.mcp.json`):

```json
{ "mcpServers": { "batuta": { "command": "bun", "args": ["run", "C:\\mcp-s\\batuta-mcp\\src\\index.ts"] } } }
```

### Claude Code

```bash
claude mcp add batuta -- bun run C:\mcp-s\batuta-mcp\src\index.ts
```

## Flujo

1. `decompose_into_plans` → planes con fronteras disjuntas.
2. `check_boundary_overlaps` → confirmar `ok:true` (o reajustar).
3. `scaffold_worktrees` → crea los worktrees; abrí cada uno en un tab de Warp y pegá su `suggestedPrompt`.

## Tests

```bash
bun test
bunx tsc --noEmit
```
