# batuta-mcp — Diseño (spec)

- **Fecha:** 2026-06-20
- **Autor:** Jose (Vorluno / Oruslabs) + Claude Code
- **Estado:** Aprobado para implementación
- **Repo:** `C:\mcp-s\batuta-mcp` (primer paquete del monorepo de MCPs `C:\mcp-s`)

---

## 1. Contexto y motivación

Batuta (`C:\batuta`) es un orquestador local multi-agente para Claude Code con dos fases
completas: visibilidad/coordinación (daemon + dashboard web + hooks) y captura de planes +
spawning headless en git worktrees.

Tras migrar el flujo de trabajo a **Warp**, la mayor parte de Batuta quedó redundante: Warp
ya da multi-agente local en tabs, **git worktrees nativos** por agente, panel unificado, code
review y soporte de Claude Code CLI directo (sin consumir platform credits). Lo único que Warp
**no** regala gratis es la pieza de valor de Batuta: **descomponer una tarea en planes con
fronteras de archivos disjuntas** para que varios agentes trabajen en paralelo sin pisarse.

Este proyecto extrae esa pieza de valor y la expone como **MCP server** — consumible por Warp,
Claude Code y cualquier cliente MCP — descartando la web (que no se usará) y todo el estado.

## 2. Objetivo

Un MCP server **stateless** ("Batuta cerebro") que el agente invoca como herramientas para:

1. Descomponer un volcado de ideas en planes con fronteras de archivos disjuntas.
2. Validar que no haya solape de fronteras entre planes.
3. Crear los git worktrees y entregar, por plan, el prompt listo para pegar en un tab.

El **músculo** (lanzar las sesiones, panel de visibilidad, code review, merge) queda en Warp.
El MCP no lanza sesiones, no guarda estado y no expone web.

## 3. No-objetivos (fuera de alcance)

- No lanzar sesiones `claude` headless (lo hace el humano en cada tab de Warp).
- No persistir estado (sin SQLite, sin daemon, sin archivos de estado).
- No reimplementar visibilidad/detección de choque en vivo (con worktrees el choque
  desaparece por diseño; Warp da el panel).
- No portar `daemon/`, `dashboard/`, `store/`, `service.ts`, `spawn.ts` ni los hooks.

## 4. Decisiones técnicas (validadas contra fuente)

| Decisión | Veredicto | Validado contra |
|---|---|---|
| SDK `@modelcontextprotocol/sdk` v1.29.0 estable (no 2.0-alpha) | ✅ | Context7 `/modelcontextprotocol/typescript-sdk` |
| `McpServer` + `StdioServerTransport` + `server.connect()` | ✅ | docs/server.md del SDK |
| `registerTool(name, {title,description,inputSchema,outputSchema}, handler)` con Zod | ✅ | docs/server.md |
| Respuesta `{ content:[{type:'text',text}], structuredContent }` | ✅ | docs/server.md |
| Errores con `{ ..., isError:true }` (auto-corrección del agente) | ✅ | docs/server.md |
| Logs SOLO a `stderr` (`console.error`); stdout = JSON-RPC | ✅ | server-quickstart.md |
| `claude -p <prompt> --output-format json` (lo que parsea `parseDecomposition`) | ✅ | `claude --help` local v2.1.183 |
| Warp: `{ "mcpServers": { name:{command,args,env} } }` / `~/.agents/.mcp.json` | ✅ | docs.warp.dev/agent-platform/capabilities/mcp |
| Claude Code: `claude mcp add <name> -- bun run <ruta>` (scope user/project) | ✅ | `claude mcp --help` local + code.claude.com/docs/mcp |
| Runtime: Bun 1.3.11 · Node 22.17 · git 2.50 | ✅ | entorno local |

**Runtime:** Bun + TypeScript (consistente con Batuta). **Transporte:** stdio.
**Workspaces de Bun:** NO al inicio (YAGNI); cada MCP del monorepo es autónomo con su
`package.json`. `tsconfig.base.json` en la raíz (strict) lo heredan todos.

## 5. Estructura

```
C:\mcp-s\
  .gitignore
  README.md                 # índice de MCPs del monorepo + cómo conectarlos
  tsconfig.base.json        # strict; heredado por cada MCP
  batuta-mcp\
    package.json            # { bin: { "batuta-mcp": "./src/index.ts" } }
    tsconfig.json           # extends ../tsconfig.base.json
    src\
      index.ts              # bootstrap: McpServer + registro de 3 tools + stdio
      tools\
        decompose.ts        # decompose_into_plans (+ auto-corrección de solape)
        boundaries.ts       # check_boundary_overlaps (puro, portado de Batuta)
        scaffold.ts         # scaffold_worktrees (pre-flight + git worktree + prompt)
      lib\
        runner.ts           # Bun.spawn wrapper + FakeRunner (portado de Batuta)
        prompts.ts          # buildDecomposePrompt + buildPlanPrompt (generalizados)
        stack-detect.ts     # infiere el stack del repo objetivo
        path-safety.ts      # valida fileBoundaries (sin `..` ni escape del repo)
        logger.ts           # niveles a stderr
    tests\
      *.test.ts
    docs\specs\
      2026-06-20-batuta-mcp-design.md   # este documento
```

## 6. Contrato de las tools

Cada tool define `inputSchema` y `outputSchema` con Zod y devuelve `structuredContent`.

### 6.1 `decompose_into_plans`

- **Input:** `{ brainDump: string (min 1), projectHint?: string, repoPath?: string }`
- **Output:** `{ plans: Plan[], overlapsResolved: boolean, attempts: number }`
  - `Plan = { title: string, specMd: string, fileBoundaries: string[], branchSlug: string }`
- **Lógica:**
  1. Si `repoPath` viene y `projectHint` no → `stack-detect` lee `package.json` /
     `*.csproj` / `go.mod` / `pyproject.toml` para inferir el stack y adaptar el prompt.
  2. Corre `claude -p <buildDecomposePrompt> --output-format json` vía `runner` con
     **timeout** (AbortSignal, default 120 s).
  3. Parsea con `parseDecomposition` (defensivo: nunca tira; ante fallo → `[]`).
  4. **Auto-corrección acotada:** corre `checkBoundaryOverlaps`; si hay solape, reintenta
     **una sola vez** un prompt que pide separar las fronteras. `attempts` refleja 1 ó 2.
  5. Si tras el reintento sigue habiendo solape → devuelve los planes con
     `overlapsResolved:false` (no es error; el agente decide).
- **Error (`isError:true`):** `plans` vacío tras parsear, o el CLI `claude` falla / agota
  el timeout. Mensaje accionable.

### 6.2 `check_boundary_overlaps`

- **Input:** `{ plans: { branchSlug: string, fileBoundaries: string[] }[] }`
- **Output:** `{ overlaps: { a: string, b: string, overlap: string[] }[], ok: boolean }`
  (`ok = overlaps.length === 0`)
- **Lógica:** `checkBoundaryOverlaps` de Batuta tal cual (puro; normaliza paths a
  minúsculas y `/`). Sin efectos.

### 6.3 `scaffold_worktrees`

- **Input:** `{ repoPath: string, plans: Plan[], dryRun?: boolean (default false) }`
- **Output:** `{ results: ScaffoldResult[] }`
  - `ScaffoldResult = { branchSlug, worktreePath, command, suggestedPrompt, status: "created"|"exists"|"error", message? }`
- **Pre-flight (antes de cualquier efecto):**
  1. `git -C <repoPath> rev-parse --is-inside-work-tree` → si no es repo git → `isError`.
  2. `checkBoundaryOverlaps(plans)` → si hay solape sin resolver → `isError` (no scaffoldea
     parcialmente algo que va a chocar).
  3. `path-safety`: rechaza cualquier `fileBoundary` con `..`, raíz absoluta distinta, o que
     escape de `repoPath`.
  4. `path-safety` del `branchSlug`: rechaza cualquier `branchSlug` inseguro (`..`, absoluto)
     vía `isBoundarySafe`, porque se interpola en la ruta del worktree (`.worktrees/<branchSlug>`)
     y podría escapar del repo.
- **Lógica:** por plan, `git -C <repoPath> worktree add <repoPath>/.worktrees/<branchSlug> -b <branchSlug>`.
  Si el worktree/branch ya existe (`already exists`/`already used`), reporta `status:"exists"`
  de forma **idempotente, sin auto-renombrar** (decisión de diseño para un tool stateless:
  nombres de branch predecibles, sin sufijos sorpresa). Genera `suggestedPrompt`
  con `buildPlanPrompt` generalizado por stack. Con `dryRun:true` devuelve `command` y
  `suggestedPrompt` sin tocar el disco (`status:"created"` simulado marcado como dry-run en `message`).
- **Tolerancia a fallos:** un plan que falle queda `status:"error"` con `message`; los demás
  continúan (no aborta todo el lote).

## 7. Reuso de Batuta y generalización

- **Portado tal cual:** `boundaries.ts` (puro), `parseDecomposition` +
  `extractFirstJsonArray` + `validateEntry` de `decompose.ts`, `runner.ts` (con `FakeRunner`),
  helpers de `worktree.ts`.
- **Generalizado:**
  - `buildPlanPrompt` / `buildDecomposePrompt`: hoy hardcodean *"Bun + TypeScript project
    (Batuta)"* y `bun test`/`bunx tsc`. Se vuelven **agnósticos al stack** y usan
    `projectHint` (ej. ".NET 9", "Next.js") para adaptar comandos de verificación y commit.
  - `worktree.ts`: la carpeta base deja de ser `.batuta-worktrees` (atada a Batuta) y pasa a
    `.worktrees`.
- **Descartado:** todo lo de §3 (web, estado, spawning, hooks).

## 8. Manejo de errores y observabilidad

- Cada handler envuelve su lógica; un fallo devuelve `{ isError:true, content:[texto] }` con
  mensaje accionable (no crashea el server) → el agente se auto-corrige.
- `parseDecomposition` conserva su garantía: nunca tira (devuelve `[]`).
- **Logger** (`lib/logger.ts`) escribe SOLO a `stderr` con niveles `debug|info|error`;
  `--verbose` sube el nivel. Nunca `console.log` (rompería el JSON-RPC de stdout).
- Timeout en el spawn de `claude` (AbortSignal) para no colgar el handler.

## 9. Testing

- **Unit:** `parseDecomposition` (casos del parser defensivo), `checkBoundaryOverlaps`,
  `stack-detect`, `path-safety`.
- **Tool-level:** las 3 tools con `FakeRunner` (sin git ni `claude` reales), incluyendo el
  loop de auto-corrección de `decompose_into_plans`.
- **Smoke del server:** arranca, lista exactamente 3 tools, schemas válidos.
- **Gate:** `bun test` verde + `bunx tsc --noEmit` verde.
- **Verificación manual final:** conectar el MCP a Warp y a Claude Code, correr el flujo
  completo (decompose → check → scaffold) contra un repo de prueba real.

## 10. Conexión

- **Warp:** pegar en MCP settings (o `~/.agents/.mcp.json`):
  ```json
  { "mcpServers": { "batuta": { "command": "bun", "args": ["run", "C:\\mcp-s\\batuta-mcp\\src\\index.ts"] } } }
  ```
- **Claude Code:** `claude mcp add batuta -- bun run C:\mcp-s\batuta-mcp\src\index.ts` (scope user).

## 11. Criterios de aceptación

- [ ] El server arranca por stdio y expone exactamente 3 tools con input/output schema.
- [ ] `decompose_into_plans` devuelve planes con fronteras disjuntas; ante solape, reintenta
      una vez y reporta `attempts`/`overlapsResolved`.
- [ ] `check_boundary_overlaps` detecta correctamente solapes (normalizando paths).
- [ ] `scaffold_worktrees` valida repo git + path-safety + solapes antes de tocar el disco;
      crea worktrees reales y entrega `suggestedPrompt` por plan; `dryRun` no toca el disco.
- [ ] Errores se devuelven con `isError:true` y mensaje accionable; el server nunca crashea.
- [ ] Logs solo a stderr. `bun test` y `bunx tsc --noEmit` en verde.
- [ ] Conecta y funciona end-to-end desde Warp y desde Claude Code.
