# batuta-mcp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `batuta-mcp`, un MCP server stateless por stdio que descompone una tarea en planes con fronteras de archivos disjuntas, valida solapes y crea git worktrees con un prompt listo por plan.

**Architecture:** Lógica pura/inyectable en `src/lib` y `src/tools` (testeable con un `FakeRunner`, sin git ni `claude` reales), envuelta por una capa fina MCP en `src/server.ts` que registra 3 tools con esquemas Zod (raw shape) y se conecta por `StdioServerTransport` desde `src/index.ts`. Sin estado, sin web, sin spawning.

**Tech Stack:** Bun 1.3.11 + TypeScript (strict), `@modelcontextprotocol/sdk` ^1.29.0, `zod` ^3, `bun:test`.

## Global Constraints

- Runtime: **Bun** (no Node). Comandos: `bun test`, `bunx tsc --noEmit`, `bun run`.
- SDK: `@modelcontextprotocol/sdk@^1.29.0`. `inputSchema`/`outputSchema` se pasan como **Zod raw shape** (`{ k: z.string() }`), NO `z.object(...)`. Handler devuelve `{ content:[{type:'text',text}], structuredContent }` o `{ content:[...], isError:true }`.
- Validación con `zod@^3`.
- **Logs SOLO a stderr** (`console.error` / `logger`). Nunca `console.log` (stdout = JSON-RPC).
- CLI externo: `claude -p <prompt> --output-format json` (capturar stdout completo).
- Worktrees en `<repoPath>/.worktrees/<branchSlug>`.
- Stateless: sin SQLite, sin daemon, sin archivos de estado.
- Commits: prefijos `feat:`/`docs:`/`chore:`/`test:`. **NUNCA** agregar `Co-Authored-By`.
- Docs en español; identificadores de código en inglés.
- El repo `C:\mcp-s` ya existe (git init hecho) con el spec commiteado.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `C:\mcp-s\tsconfig.base.json` | tsconfig strict base, heredado por cada MCP |
| `C:\mcp-s\README.md` | Índice del monorepo + cómo conectar cada MCP |
| `batuta-mcp\package.json` | Manifiesto + bin + scripts |
| `batuta-mcp\tsconfig.json` | extends base; include src/tests |
| `src\types.ts` | Tipos compartidos (Plan, Runner, Overlap, ScaffoldResult, ...) |
| `src\lib\logger.ts` | Log con niveles a stderr (sink inyectable) |
| `src\lib\runner.ts` | `bunRunner` (Bun.spawn + timeout) + `FakeRunner` (tests) |
| `src\lib\path-safety.ts` | Validación de fronteras (sin `..` ni absolutas) |
| `src\lib\stack-detect.ts` | Inferir stack del repo objetivo |
| `src\lib\prompts.ts` | Builders de prompts (decompose / fix-overlaps / plan) |
| `src\tools\boundaries.ts` | `checkBoundaryOverlaps` (puro) |
| `src\tools\decompose.ts` | `parseDecomposition` + `decomposeIntoPlans` (auto-corrección) |
| `src\tools\scaffold.ts` | worktree helpers + `scaffoldWorktrees` (pre-flight) |
| `src\server.ts` | `createServer(deps)` — registra las 3 tools |
| `src\index.ts` | Entrypoint stdio (bin) |
| `tests\*.test.ts` | Tests por módulo + smoke del server |

Todas las rutas relativas cuelgan de `C:\mcp-s\batuta-mcp\`.

---

## Task 1: Setup del paquete + tipos + logger

**Files:**
- Create: `C:\mcp-s\tsconfig.base.json`
- Create: `C:\mcp-s\README.md`
- Create: `C:\mcp-s\batuta-mcp\package.json`
- Create: `C:\mcp-s\batuta-mcp\tsconfig.json`
- Create: `src\types.ts`
- Create: `src\lib\logger.ts`
- Test: `tests\logger.test.ts`

**Interfaces:**
- Produces: todos los tipos en `src/types.ts` (consumidos por todas las tareas siguientes); `logger` con `setSink`, `setVerbose`, `logger.{debug,info,error}`.

- [ ] **Step 1: Crear `C:\mcp-s\tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": false
  }
}
```

- [ ] **Step 2: Crear `C:\mcp-s\README.md`**

```markdown
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
```

- [ ] **Step 3: Crear `C:\mcp-s\batuta-mcp\package.json`**

```json
{
  "name": "batuta-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "batuta-mcp": "./src/index.ts" },
  "scripts": {
    "start": "bun run src/index.ts",
    "test": "bun test",
    "typecheck": "bunx tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5"
  }
}
```

- [ ] **Step 4: Crear `C:\mcp-s\batuta-mcp\tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "include": ["src", "tests"]
}
```

- [ ] **Step 5: Instalar dependencias**

Run: `cd /c/mcp-s/batuta-mcp && bun install`
Expected: crea `node_modules/` y `bun.lock`; sale 0. Verificá que existe `node_modules/@modelcontextprotocol/sdk/package.json` con versión `1.29.x`.

- [ ] **Step 6: Crear `src/types.ts`**

```ts
/** Un plan de trabajo con frontera de archivos. */
export interface Plan {
  title: string;
  specMd: string;
  fileBoundaries: string[];
  branchSlug: string;
}

/** Subconjunto de Plan usado para chequear solapes. */
export interface BoundaryPlan {
  branchSlug: string;
  fileBoundaries: string[];
}

/** Solape de fronteras entre dos planes. */
export interface Overlap {
  a: string;
  b: string;
  overlap: string[];
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd?: string;
  timeoutMs?: number;
}

/** Ejecutor de comandos inyectable (real o falso en tests). */
export interface Runner {
  run(cmd: string[], opts?: RunOptions): Promise<RunResult>;
}

export interface DecomposeResult {
  plans: Plan[];
  overlapsResolved: boolean;
  attempts: number;
}

export type ScaffoldStatus = "created" | "exists" | "error";

export interface ScaffoldResult {
  branchSlug: string;
  worktreePath: string;
  command: string;
  suggestedPrompt: string;
  status: ScaffoldStatus;
  message?: string;
}
```

- [ ] **Step 7: Escribir el test que falla `tests/logger.test.ts`**

```ts
import { test, expect } from "bun:test";
import { logger, setSink, setVerbose } from "../src/lib/logger";

test("logger envía info al sink con prefijo", () => {
  const lines: string[] = [];
  setSink((l) => lines.push(l));
  setVerbose(false);
  logger.info("hola");
  expect(lines).toEqual(["[batuta-mcp] info: hola"]);
});

test("debug se omite salvo verbose", () => {
  const lines: string[] = [];
  setSink((l) => lines.push(l));
  setVerbose(false);
  logger.debug("oculto");
  expect(lines).toEqual([]);
  setVerbose(true);
  logger.debug("visible");
  expect(lines).toEqual(["[batuta-mcp] debug: visible"]);
});
```

- [ ] **Step 8: Correr el test para verificar que falla**

Run: `cd /c/mcp-s/batuta-mcp && bun test tests/logger.test.ts`
Expected: FAIL — no existe `../src/lib/logger`.

- [ ] **Step 9: Implementar `src/lib/logger.ts`**

```ts
type Level = "debug" | "info" | "error";
type Sink = (line: string) => void;

const ORDER: Record<Level, number> = { debug: 0, info: 1, error: 2 };

let minLevel: Level = "info";
let sink: Sink = (line) => console.error(line); // SIEMPRE stderr

export function setVerbose(verbose: boolean): void {
  minLevel = verbose ? "debug" : "info";
}

/** Solo para tests: redirige la salida. */
export function setSink(s: Sink): void {
  sink = s;
}

function emit(level: Level, msg: string): void {
  if (ORDER[level] >= ORDER[minLevel]) sink(`[batuta-mcp] ${level}: ${msg}`);
}

export const logger = {
  debug: (m: string) => emit("debug", m),
  info: (m: string) => emit("info", m),
  error: (m: string) => emit("error", m),
};
```

- [ ] **Step 10: Correr el test para verificar que pasa**

Run: `bun test tests/logger.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 11: Typecheck**

Run: `bunx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 12: Commit**

```bash
cd /c/mcp-s
git add tsconfig.base.json README.md batuta-mcp/package.json batuta-mcp/tsconfig.json batuta-mcp/bun.lock batuta-mcp/src/types.ts batuta-mcp/src/lib/logger.ts batuta-mcp/tests/logger.test.ts
git commit -m "feat: setup batuta-mcp (package, tsconfig, tipos, logger a stderr)"
```

---

## Task 2: Runner (real + falso)

**Files:**
- Create: `src\lib\runner.ts`
- Test: `tests\runner.test.ts`

**Interfaces:**
- Consumes: `Runner`, `RunResult`, `RunOptions` de `src/types.ts`.
- Produces: `bunRunner: Runner` (real, con timeout) y `class FakeRunner implements Runner` con `calls: {cmd; opts?}[]`, constructor `(responses?: RunResult[], fallback?: RunResult)`.

- [ ] **Step 1: Escribir el test que falla `tests/runner.test.ts`**

```ts
import { test, expect } from "bun:test";
import { bunRunner, FakeRunner } from "../src/lib/runner";

test("FakeRunner devuelve respuestas en orden y registra llamadas", async () => {
  const fake = new FakeRunner([{ code: 0, stdout: "uno", stderr: "" }]);
  const r1 = await fake.run(["git", "status"]);
  const r2 = await fake.run(["git", "log"]); // sin respuesta → fallback
  expect(r1.stdout).toBe("uno");
  expect(r2.code).toBe(0);
  expect(fake.calls).toEqual([
    { cmd: ["git", "status"], opts: undefined },
    { cmd: ["git", "log"], opts: undefined },
  ]);
});

test("bunRunner ejecuta un proceso real y captura stdout", async () => {
  const r = await bunRunner.run(["git", "--version"]);
  expect(r.code).toBe(0);
  expect(r.stdout.toLowerCase()).toContain("git version");
});

test("bunRunner respeta el timeout", async () => {
  const r = await bunRunner.run(["bun", "-e", "await Bun.sleep(2000)"], { timeoutMs: 150 });
  expect(r.code).not.toBe(0);
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun test tests/runner.test.ts`
Expected: FAIL — no existe `../src/lib/runner`.

- [ ] **Step 3: Implementar `src/lib/runner.ts`**

```ts
import type { Runner, RunOptions, RunResult } from "../types";

export const bunRunner: Runner = {
  async run(cmd: string[], opts?: RunOptions): Promise<RunResult> {
    const ac = new AbortController();
    const timer =
      opts?.timeoutMs != null
        ? setTimeout(() => ac.abort(), opts.timeoutMs)
        : null;
    try {
      const proc = Bun.spawn(cmd, {
        cwd: opts?.cwd,
        stdout: "pipe",
        stderr: "pipe",
        signal: ac.signal,
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const code = await proc.exited;
      return { code, stdout, stderr };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { code: 1, stdout: "", stderr: message };
    } finally {
      if (timer) clearTimeout(timer);
    }
  },
};

/** Runner falso para tests: respuestas en orden, registra llamadas. */
export class FakeRunner implements Runner {
  calls: { cmd: string[]; opts?: RunOptions }[] = [];
  private i = 0;
  constructor(
    private responses: RunResult[] = [],
    private fallback: RunResult = { code: 0, stdout: "", stderr: "" },
  ) {}
  run(cmd: string[], opts?: RunOptions): Promise<RunResult> {
    this.calls.push({ cmd, opts });
    const r = this.responses[this.i++] ?? this.fallback;
    return Promise.resolve(r);
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun test tests/runner.test.ts`
Expected: PASS (3 tests). El test de timeout debe tardar ~150ms.

- [ ] **Step 5: Commit**

```bash
cd /c/mcp-s
git add batuta-mcp/src/lib/runner.ts batuta-mcp/tests/runner.test.ts
git commit -m "feat: Runner real (Bun.spawn + timeout) y FakeRunner para tests"
```

---

## Task 3: boundaries — detección de solape (puro)

**Files:**
- Create: `src\tools\boundaries.ts`
- Test: `tests\boundaries.test.ts`

**Interfaces:**
- Consumes: `BoundaryPlan`, `Overlap` de `src/types.ts`.
- Produces: `checkBoundaryOverlaps(plans: BoundaryPlan[]): Overlap[]`.

- [ ] **Step 1: Escribir el test que falla `tests/boundaries.test.ts`**

```ts
import { test, expect } from "bun:test";
import { checkBoundaryOverlaps } from "../src/tools/boundaries";

test("sin solape → []", () => {
  expect(
    checkBoundaryOverlaps([
      { branchSlug: "a", fileBoundaries: ["src/a.ts"] },
      { branchSlug: "b", fileBoundaries: ["src/b.ts"] },
    ]),
  ).toEqual([]);
});

test("detecta solape normalizando mayúsculas y separadores", () => {
  const out = checkBoundaryOverlaps([
    { branchSlug: "a", fileBoundaries: ["src/Shared.ts"] },
    { branchSlug: "b", fileBoundaries: ["src\\shared.ts"] },
  ]);
  expect(out).toEqual([{ a: "a", b: "b", overlap: ["src/shared.ts"] }]);
});

test("ignora planes con fronteras vacías", () => {
  expect(
    checkBoundaryOverlaps([
      { branchSlug: "a", fileBoundaries: [] },
      { branchSlug: "b", fileBoundaries: ["x.ts"] },
    ]),
  ).toEqual([]);
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun test tests/boundaries.test.ts`
Expected: FAIL — no existe `../src/tools/boundaries`.

- [ ] **Step 3: Implementar `src/tools/boundaries.ts`**

```ts
import type { BoundaryPlan, Overlap } from "../types";

function normalize(path: string): string {
  return path.trim().toLowerCase().replace(/\\/g, "/");
}

export function checkBoundaryOverlaps(plans: BoundaryPlan[]): Overlap[] {
  const normalized = plans
    .filter((p) => p.fileBoundaries.length > 0)
    .map((p) => ({
      id: p.branchSlug,
      set: new Set(p.fileBoundaries.map(normalize)),
    }));

  const results: Overlap[] = [];
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i]!;
      const b = normalized[j]!;
      const overlap: string[] = [];
      for (const norm of a.set) if (b.set.has(norm)) overlap.push(norm);
      if (overlap.length > 0) results.push({ a: a.id, b: b.id, overlap });
    }
  }
  return results;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun test tests/boundaries.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /c/mcp-s
git add batuta-mcp/src/tools/boundaries.ts batuta-mcp/tests/boundaries.test.ts
git commit -m "feat: checkBoundaryOverlaps (detección pura de solape de fronteras)"
```

---

## Task 4: path-safety — fronteras seguras

**Files:**
- Create: `src\lib\path-safety.ts`
- Test: `tests\path-safety.test.ts`

**Interfaces:**
- Consumes: `BoundaryPlan` de `src/types.ts`.
- Produces: `isBoundarySafe(boundary: string): boolean`; `unsafeBoundaries(plans: BoundaryPlan[]): { branchSlug: string; boundary: string }[]`.

- [ ] **Step 1: Escribir el test que falla `tests/path-safety.test.ts`**

```ts
import { test, expect } from "bun:test";
import { isBoundarySafe, unsafeBoundaries } from "../src/lib/path-safety";

test("acepta rutas relativas dentro del repo", () => {
  expect(isBoundarySafe("src/a.ts")).toBe(true);
  expect(isBoundarySafe("docs/")).toBe(true);
});

test("rechaza escapes y rutas absolutas", () => {
  expect(isBoundarySafe("../secrets.ts")).toBe(false);
  expect(isBoundarySafe("a/../../b")).toBe(false);
  expect(isBoundarySafe("/etc/passwd")).toBe(false);
  expect(isBoundarySafe("C:\\Windows")).toBe(false);
});

test("unsafeBoundaries reporta plan + frontera ofensora", () => {
  expect(
    unsafeBoundaries([
      { branchSlug: "ok", fileBoundaries: ["src/a.ts"] },
      { branchSlug: "bad", fileBoundaries: ["src/b.ts", "../x"] },
    ]),
  ).toEqual([{ branchSlug: "bad", boundary: "../x" }]);
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun test tests/path-safety.test.ts`
Expected: FAIL — no existe `../src/lib/path-safety`.

- [ ] **Step 3: Implementar `src/lib/path-safety.ts`**

```ts
import type { BoundaryPlan } from "../types";

/** true si la frontera es relativa y no escapa del repo. */
export function isBoundarySafe(boundary: string): boolean {
  const b = boundary.trim().replace(/\\/g, "/");
  if (b === "") return false;
  if (b.startsWith("/")) return false; // absoluta POSIX
  if (/^[a-zA-Z]:/.test(b)) return false; // absoluta Windows (C:\...)
  const segments = b.split("/");
  if (segments.includes("..")) return false;
  return true;
}

export function unsafeBoundaries(
  plans: BoundaryPlan[],
): { branchSlug: string; boundary: string }[] {
  const out: { branchSlug: string; boundary: string }[] = [];
  for (const p of plans) {
    for (const boundary of p.fileBoundaries) {
      if (!isBoundarySafe(boundary)) out.push({ branchSlug: p.branchSlug, boundary });
    }
  }
  return out;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun test tests/path-safety.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /c/mcp-s
git add batuta-mcp/src/lib/path-safety.ts batuta-mcp/tests/path-safety.test.ts
git commit -m "feat: path-safety (rechaza fronteras absolutas o con ..)"
```

---

## Task 5: stack-detect — inferir el stack del repo

**Files:**
- Create: `src\lib\stack-detect.ts`
- Test: `tests\stack-detect.test.ts`

**Interfaces:**
- Produces:
  - `interface RepoReader { has(rel: string): Promise<boolean>; hasGlob(pattern: string): Promise<boolean> }`
  - `detectStack(reader: RepoReader): Promise<string | undefined>`
  - `bunReader(repoPath: string): RepoReader`
  - `detectStackFs(repoPath: string): Promise<string | undefined>`

- [ ] **Step 1: Escribir el test que falla `tests/stack-detect.test.ts`**

```ts
import { test, expect } from "bun:test";
import { detectStack, type RepoReader } from "../src/lib/stack-detect";

function reader(files: string[], globs: string[] = []): RepoReader {
  return {
    has: (rel) => Promise.resolve(files.includes(rel)),
    hasGlob: (pattern) => Promise.resolve(globs.includes(pattern)),
  };
}

test("detecta Node por package.json", async () => {
  expect(await detectStack(reader(["package.json"]))).toContain("Node.js");
});

test("detecta .NET por *.csproj", async () => {
  expect(await detectStack(reader([], ["**/*.csproj"]))).toContain(".NET");
});

test("detecta Go y Python", async () => {
  expect(await detectStack(reader(["go.mod"]))).toContain("Go");
  expect(await detectStack(reader(["pyproject.toml"]))).toContain("Python");
});

test("devuelve undefined si no reconoce nada", async () => {
  expect(await detectStack(reader([]))).toBeUndefined();
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun test tests/stack-detect.test.ts`
Expected: FAIL — no existe `../src/lib/stack-detect`.

- [ ] **Step 3: Implementar `src/lib/stack-detect.ts`**

```ts
export interface RepoReader {
  has(rel: string): Promise<boolean>;
  hasGlob(pattern: string): Promise<boolean>;
}

export async function detectStack(reader: RepoReader): Promise<string | undefined> {
  if (await reader.has("package.json")) return "Node.js / TypeScript";
  if (await reader.hasGlob("**/*.csproj")) return ".NET";
  if (await reader.has("go.mod")) return "Go";
  if (await reader.has("pyproject.toml")) return "Python";
  if (await reader.has("requirements.txt")) return "Python";
  return undefined;
}

/** Reader real basado en el filesystem de Bun. */
export function bunReader(repoPath: string): RepoReader {
  const base = repoPath.replace(/\\/g, "/").replace(/\/$/, "");
  return {
    has: (rel) => Bun.file(`${base}/${rel}`).exists(),
    hasGlob: async (pattern) => {
      const glob = new Bun.Glob(pattern);
      for await (const _ of glob.scan({ cwd: base, onlyFiles: true })) return true;
      return false;
    },
  };
}

export function detectStackFs(repoPath: string): Promise<string | undefined> {
  return detectStack(bunReader(repoPath));
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun test tests/stack-detect.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /c/mcp-s
git add batuta-mcp/src/lib/stack-detect.ts batuta-mcp/tests/stack-detect.test.ts
git commit -m "feat: stack-detect (infiere stack del repo, reader inyectable)"
```

---

## Task 6: prompts — builders generalizados

**Files:**
- Create: `src\lib\prompts.ts`
- Test: `tests\prompts.test.ts`

**Interfaces:**
- Consumes: `Plan`, `Overlap` de `src/types.ts`.
- Produces:
  - `buildDecomposePrompt(brainDump: string, stackHint?: string): string`
  - `buildFixOverlapsPrompt(brainDump: string, plans: Plan[], overlaps: Overlap[], stackHint?: string): string`
  - `buildPlanPrompt(plan: Plan, stackHint?: string): string`

- [ ] **Step 1: Escribir el test que falla `tests/prompts.test.ts`**

```ts
import { test, expect } from "bun:test";
import {
  buildDecomposePrompt,
  buildFixOverlapsPrompt,
  buildPlanPrompt,
} from "../src/lib/prompts";

test("decompose incluye brain dump, pide JSON y fronteras disjuntas", () => {
  const p = buildDecomposePrompt("hacer login y reporte", "Next.js");
  expect(p).toContain("hacer login y reporte");
  expect(p.toLowerCase()).toContain("json");
  expect(p.toLowerCase()).toContain("disjoint");
  expect(p).toContain("Next.js");
});

test("fix-overlaps menciona los solapes a separar", () => {
  const plans = [
    { title: "A", specMd: "", fileBoundaries: ["x.ts"], branchSlug: "a" },
    { title: "B", specMd: "", fileBoundaries: ["x.ts"], branchSlug: "b" },
  ];
  const p = buildFixOverlapsPrompt("dump", plans, [{ a: "a", b: "b", overlap: ["x.ts"] }]);
  expect(p).toContain("x.ts");
  expect(p.toLowerCase()).toContain("overlap");
});

test("plan prompt incluye título, fronteras y es agnóstico sin hint", () => {
  const p = buildPlanPrompt(
    { title: "Login", specMd: "## Goal\nlogin", fileBoundaries: ["src/auth.ts"], branchSlug: "login" },
  );
  expect(p).toContain("Login");
  expect(p).toContain("src/auth.ts");
  expect(p.toLowerCase()).toContain("test");
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun test tests/prompts.test.ts`
Expected: FAIL — no existe `../src/lib/prompts`.

- [ ] **Step 3: Implementar `src/lib/prompts.ts`**

```ts
import type { Plan, Overlap } from "../types";

function stackLine(stackHint?: string): string {
  return stackHint ? `\nTarget project stack: ${stackHint}.` : "";
}

export function buildDecomposePrompt(brainDump: string, stackHint?: string): string {
  return `You are a software architect decomposing a project brain dump into discrete, actionable plans.${stackLine(stackHint)}

Your task:
1. Read the brain dump below
2. Identify 2-5 independent features, modules, or refactors
3. Ensure each plan has DISJOINT file boundaries (no overlapping files across plans)
4. Return ONLY a JSON array — no prose, no markdown fences, just the array

Each plan object must have exactly these fields:
- "title": (string) short feature name in title case
- "specMd": (string) markdown spec with ## headers, acceptance criteria, implementation notes
- "fileBoundaries": (array of strings) exact RELATIVE file or directory paths this plan will touch (no absolute paths, no "..")
- "branchSlug": (string) kebab-case branch name (e.g., "feat/auth-module")

CRITICAL: The output must be valid JSON and nothing else.

Brain dump:
---
${brainDump}
---

Return the JSON array now:`;
}

export function buildFixOverlapsPrompt(
  brainDump: string,
  plans: Plan[],
  overlaps: Overlap[],
  stackHint?: string,
): string {
  const overlapText = overlaps
    .map((o) => `- "${o.a}" and "${o.b}" both touch: ${o.overlap.join(", ")}`)
    .join("\n");
  return `Your previous decomposition has OVERLAPPING file boundaries. Plans must be disjoint.${stackLine(stackHint)}

Overlaps to fix:
${overlapText}

Previous plans:
${JSON.stringify(plans, null, 2)}

Re-assign file boundaries so NO file appears in more than one plan (move shared files into a single owning plan, or split the work differently). Return ONLY the corrected JSON array, same shape as before.

Original brain dump:
---
${brainDump}
---

Return the corrected JSON array now:`;
}

export function buildPlanPrompt(plan: Plan, stackHint?: string): string {
  const boundaries = plan.fileBoundaries.length
    ? plan.fileBoundaries.map((f) => `  - ${f}`).join("\n")
    : "  (no file boundaries specified)";
  return `You are working on a discrete feature branch.${stackLine(stackHint)}

## Plan Title
${plan.title}

## Objective & Specification
${plan.specMd || "(no specification provided)"}

## File Boundaries
You MUST work ONLY within these files and directories:
${boundaries}

Any work outside these boundaries will conflict with other agents. Do not touch files outside this list.

## When You're Done
1. Run the project's test suite and type-check; make sure they pass.
2. Create a NEW commit (do not amend) with your changes:
   git add <specific-files>
   git commit -m "feat: <your-feature>"
3. Report the commit SHA and a short summary.

Begin your work now.`;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun test tests/prompts.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /c/mcp-s
git add batuta-mcp/src/lib/prompts.ts batuta-mcp/tests/prompts.test.ts
git commit -m "feat: builders de prompts (decompose, fix-overlaps, plan) agnósticos al stack"
```

---

## Task 7: decompose — parser + descomposición con auto-corrección

**Files:**
- Create: `src\tools\decompose.ts`
- Test: `tests\decompose.test.ts`

**Interfaces:**
- Consumes: `Plan`, `Runner`, `DecomposeResult` (types), `checkBoundaryOverlaps` (tools/boundaries), `buildDecomposePrompt`/`buildFixOverlapsPrompt` (lib/prompts).
- Produces:
  - `parseDecomposition(raw: string): Plan[]`
  - `interface DecomposeDeps { runner: Runner; detectStack?: (repoPath: string) => Promise<string | undefined>; timeoutMs?: number }`
  - `decomposeIntoPlans(input: { brainDump: string; projectHint?: string; repoPath?: string }, deps: DecomposeDeps): Promise<DecomposeResult>`

- [ ] **Step 1: Escribir el test que falla `tests/decompose.test.ts`**

```ts
import { test, expect } from "bun:test";
import { parseDecomposition, decomposeIntoPlans } from "../src/tools/decompose";
import { FakeRunner } from "../src/lib/runner";
import type { RunResult } from "../src/types";

const cliEnvelope = (text: string): RunResult => ({
  code: 0,
  stdout: JSON.stringify([{ type: "result", result: text }]),
  stderr: "",
});

test("parseDecomposition extrae el array aunque venga con prosa/fences", () => {
  const inner = 'Here you go: ```json\n[{"title":"A","fileBoundaries":["a.ts"],"branchSlug":"a"}]\n``` done';
  const plans = parseDecomposition(JSON.stringify([{ type: "result", result: inner }]));
  expect(plans).toEqual([{ title: "A", specMd: "", fileBoundaries: ["a.ts"], branchSlug: "a" }]);
});

test("parseDecomposition devuelve [] ante basura", () => {
  expect(parseDecomposition("no json here")).toEqual([]);
});

test("sin solape: una sola llamada, attempts=1", async () => {
  const disjoint = '[{"title":"A","fileBoundaries":["a.ts"],"branchSlug":"a"},{"title":"B","fileBoundaries":["b.ts"],"branchSlug":"b"}]';
  const runner = new FakeRunner([cliEnvelope(disjoint)]);
  const res = await decomposeIntoPlans({ brainDump: "x" }, { runner });
  expect(res.attempts).toBe(1);
  expect(res.overlapsResolved).toBe(true);
  expect(res.plans.length).toBe(2);
  expect(runner.calls.length).toBe(1);
});

test("con solape: reintenta una vez y resuelve, attempts=2", async () => {
  const overlap = '[{"title":"A","fileBoundaries":["x.ts"],"branchSlug":"a"},{"title":"B","fileBoundaries":["x.ts"],"branchSlug":"b"}]';
  const fixed = '[{"title":"A","fileBoundaries":["a.ts"],"branchSlug":"a"},{"title":"B","fileBoundaries":["b.ts"],"branchSlug":"b"}]';
  const runner = new FakeRunner([cliEnvelope(overlap), cliEnvelope(fixed)]);
  const res = await decomposeIntoPlans({ brainDump: "x" }, { runner });
  expect(res.attempts).toBe(2);
  expect(res.overlapsResolved).toBe(true);
  expect(runner.calls.length).toBe(2);
});

test("usa projectHint en el prompt", async () => {
  const runner = new FakeRunner([cliEnvelope("[]")]);
  await decomposeIntoPlans({ brainDump: "x", projectHint: "Rust" }, { runner });
  expect(runner.calls[0]!.cmd.join(" ")).toContain("Rust");
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun test tests/decompose.test.ts`
Expected: FAIL — no existe `../src/tools/decompose`.

- [ ] **Step 3: Implementar `src/tools/decompose.ts`**

```ts
import type { Plan, Runner, DecomposeResult } from "../types";
import { checkBoundaryOverlaps } from "./boundaries";
import { buildDecomposePrompt, buildFixOverlapsPrompt } from "../lib/prompts";

function toKebabCase(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function validateEntry(entry: unknown): Plan | null {
  if (typeof entry !== "object" || entry === null) return null;
  const obj = entry as Record<string, unknown>;
  const title = obj["title"];
  if (typeof title !== "string" || title.trim() === "") return null;
  const specMd = typeof obj["specMd"] === "string" ? obj["specMd"] : "";
  let fileBoundaries: string[] = [];
  if (Array.isArray(obj["fileBoundaries"])) {
    fileBoundaries = obj["fileBoundaries"].filter((i): i is string => typeof i === "string");
  }
  const rawSlug = obj["branchSlug"];
  const branchSlug =
    typeof rawSlug === "string" && rawSlug.trim() !== "" ? rawSlug : toKebabCase(title);
  return { title, specMd, fileBoundaries, branchSlug };
}

function extractFirstJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

/** PURE, defensivo: nunca tira; ante cualquier fallo devuelve []. */
export function parseDecomposition(raw: string): Plan[] {
  try {
    if (raw.trim() === "") return [];
    let innerText = raw;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const resultMsg = parsed.find(
          (m): m is Record<string, unknown> =>
            typeof m === "object" && m !== null &&
            (m as Record<string, unknown>)["type"] === "result" &&
            typeof (m as Record<string, unknown>)["result"] === "string",
        );
        if (resultMsg) innerText = resultMsg["result"] as string;
      } else if (
        typeof parsed === "object" && parsed !== null && "result" in parsed &&
        typeof (parsed as Record<string, unknown>)["result"] === "string"
      ) {
        innerText = (parsed as Record<string, unknown>)["result"] as string;
      }
    } catch { /* raw no es JSON externo; seguimos con raw */ }

    const arrayStr = extractFirstJsonArray(innerText);
    if (arrayStr === null) return [];
    const arr = JSON.parse(arrayStr) as unknown;
    if (!Array.isArray(arr)) return [];
    const plans: Plan[] = [];
    for (const entry of arr) {
      const plan = validateEntry(entry);
      if (plan !== null) plans.push(plan);
    }
    return plans;
  } catch {
    return [];
  }
}

export interface DecomposeDeps {
  runner: Runner;
  detectStack?: (repoPath: string) => Promise<string | undefined>;
  timeoutMs?: number;
}

async function runClaude(runner: Runner, prompt: string, timeoutMs: number): Promise<string> {
  const r = await runner.run(["claude", "-p", prompt, "--output-format", "json"], { timeoutMs });
  return r.stdout;
}

export async function decomposeIntoPlans(
  input: { brainDump: string; projectHint?: string; repoPath?: string },
  deps: DecomposeDeps,
): Promise<DecomposeResult> {
  const timeoutMs = deps.timeoutMs ?? 120_000;
  let stackHint = input.projectHint;
  if (!stackHint && input.repoPath && deps.detectStack) {
    stackHint = await deps.detectStack(input.repoPath);
  }

  let plans = parseDecomposition(
    await runClaude(deps.runner, buildDecomposePrompt(input.brainDump, stackHint), timeoutMs),
  );
  let attempts = 1;
  let overlaps = checkBoundaryOverlaps(plans);

  if (overlaps.length > 0 && plans.length > 0) {
    const fixed = parseDecomposition(
      await runClaude(
        deps.runner,
        buildFixOverlapsPrompt(input.brainDump, plans, overlaps, stackHint),
        timeoutMs,
      ),
    );
    attempts = 2;
    if (fixed.length > 0) {
      plans = fixed;
      overlaps = checkBoundaryOverlaps(plans);
    }
  }

  return { plans, overlapsResolved: overlaps.length === 0, attempts };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun test tests/decompose.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /c/mcp-s
git add batuta-mcp/src/tools/decompose.ts batuta-mcp/tests/decompose.test.ts
git commit -m "feat: decompose (parser defensivo + descomposición con auto-corrección de solape)"
```

---

## Task 8: scaffold — worktrees con pre-flight

**Files:**
- Create: `src\tools\scaffold.ts`
- Test: `tests\scaffold.test.ts`

**Interfaces:**
- Consumes: `Plan`, `Runner`, `ScaffoldResult` (types); `checkBoundaryOverlaps` (boundaries); `unsafeBoundaries` (path-safety); `buildPlanPrompt` (prompts).
- Produces:
  - `worktreePathFor(repoPath: string, branchSlug: string): string`
  - `isGitRepo(runner: Runner, repoPath: string): Promise<boolean>`
  - `scaffoldWorktrees(input: { repoPath: string; plans: Plan[]; dryRun?: boolean; stackHint?: string }, deps: { runner: Runner }): Promise<{ ok: boolean; error?: string; results: ScaffoldResult[] }>`

- [ ] **Step 1: Escribir el test que falla `tests/scaffold.test.ts`**

```ts
import { test, expect } from "bun:test";
import { worktreePathFor, scaffoldWorktrees } from "../src/tools/scaffold";
import { FakeRunner } from "../src/lib/runner";
import type { Plan, RunResult } from "../src/types";

const okRepo: RunResult = { code: 0, stdout: "true\n", stderr: "" };
const plan = (slug: string, files: string[]): Plan => ({
  title: slug, specMd: "", fileBoundaries: files, branchSlug: slug,
});

test("worktreePathFor usa .worktrees y normaliza separadores", () => {
  expect(worktreePathFor("C:\\proj", "feat-a")).toBe("C:/proj/.worktrees/feat-a");
});

test("rechaza si no es repo git", async () => {
  const runner = new FakeRunner([{ code: 128, stdout: "", stderr: "not a git repo" }]);
  const res = await scaffoldWorktrees(
    { repoPath: "/x", plans: [plan("a", ["a.ts"])] },
    { runner },
  );
  expect(res.ok).toBe(false);
  expect(res.error).toContain("git");
});

test("rechaza si hay solape", async () => {
  const runner = new FakeRunner([okRepo]);
  const res = await scaffoldWorktrees(
    { repoPath: "/x", plans: [plan("a", ["x.ts"]), plan("b", ["x.ts"])] },
    { runner },
  );
  expect(res.ok).toBe(false);
  expect(res.error?.toLowerCase()).toContain("overlap");
});

test("rechaza fronteras inseguras", async () => {
  const runner = new FakeRunner([okRepo]);
  const res = await scaffoldWorktrees(
    { repoPath: "/x", plans: [plan("a", ["../escape.ts"])] },
    { runner },
  );
  expect(res.ok).toBe(false);
  expect(res.error?.toLowerCase()).toContain("unsafe");
});

test("dryRun no ejecuta git worktree add", async () => {
  const runner = new FakeRunner([okRepo]); // solo el rev-parse
  const res = await scaffoldWorktrees(
    { repoPath: "/x", plans: [plan("a", ["a.ts"])], dryRun: true },
    { runner },
  );
  expect(res.ok).toBe(true);
  expect(res.results[0]!.suggestedPrompt).toContain("a");
  expect(res.results[0]!.message).toContain("dry-run");
  // solo se llamó al rev-parse, no a worktree add
  expect(runner.calls.length).toBe(1);
});

test("crea worktree real (status created)", async () => {
  const runner = new FakeRunner([okRepo, { code: 0, stdout: "", stderr: "" }]);
  const res = await scaffoldWorktrees(
    { repoPath: "/x", plans: [plan("a", ["a.ts"])] },
    { runner },
  );
  expect(res.ok).toBe(true);
  expect(res.results[0]!.status).toBe("created");
  expect(runner.calls[1]!.cmd).toContain("worktree");
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun test tests/scaffold.test.ts`
Expected: FAIL — no existe `../src/tools/scaffold`.

- [ ] **Step 3: Implementar `src/tools/scaffold.ts`**

```ts
import type { Plan, Runner, ScaffoldResult } from "../types";
import { checkBoundaryOverlaps } from "./boundaries";
import { unsafeBoundaries } from "../lib/path-safety";
import { buildPlanPrompt } from "../lib/prompts";

export function worktreePathFor(repoPath: string, branchSlug: string): string {
  const base = repoPath.replace(/\\/g, "/").replace(/\/$/, "");
  return `${base}/.worktrees/${branchSlug}`;
}

export async function isGitRepo(runner: Runner, repoPath: string): Promise<boolean> {
  const r = await runner.run(["git", "-C", repoPath, "rev-parse", "--is-inside-work-tree"]);
  return r.code === 0 && r.stdout.trim() === "true";
}

const ALREADY_EXISTS_RE = /already exists|already used/i;

async function addWorktree(
  runner: Runner,
  repoPath: string,
  wtPath: string,
  branch: string,
): Promise<{ status: ScaffoldResult["status"]; message?: string }> {
  const cmd = (p: string, b: string) => ["git", "-C", repoPath, "worktree", "add", p, "-b", b];
  const first = await runner.run(cmd(wtPath, branch));
  if (first.code === 0) return { status: "created" };
  if (!ALREADY_EXISTS_RE.test(first.stderr)) return { status: "error", message: first.stderr };
  return { status: "exists", message: "branch/path already exists" };
}

export async function scaffoldWorktrees(
  input: { repoPath: string; plans: Plan[]; dryRun?: boolean; stackHint?: string },
  deps: { runner: Runner },
): Promise<{ ok: boolean; error?: string; results: ScaffoldResult[] }> {
  const { repoPath, plans, dryRun = false, stackHint } = input;

  if (!(await isGitRepo(deps.runner, repoPath))) {
    return { ok: false, error: `not a git repository: ${repoPath}`, results: [] };
  }
  const overlaps = checkBoundaryOverlaps(plans);
  if (overlaps.length > 0) {
    return {
      ok: false,
      error: `boundary overlap, refusing to scaffold: ${JSON.stringify(overlaps)}`,
      results: [],
    };
  }
  const unsafe = unsafeBoundaries(plans);
  if (unsafe.length > 0) {
    return { ok: false, error: `unsafe boundaries: ${JSON.stringify(unsafe)}`, results: [] };
  }

  const results: ScaffoldResult[] = [];
  for (const plan of plans) {
    const worktreePath = worktreePathFor(repoPath, plan.branchSlug);
    const command = `git -C ${repoPath} worktree add ${worktreePath} -b ${plan.branchSlug}`;
    const suggestedPrompt = buildPlanPrompt(plan, stackHint);
    if (dryRun) {
      results.push({
        branchSlug: plan.branchSlug, worktreePath, command, suggestedPrompt,
        status: "created", message: "dry-run (no se ejecutó)",
      });
      continue;
    }
    const r = await addWorktree(deps.runner, repoPath, worktreePath, plan.branchSlug);
    results.push({
      branchSlug: plan.branchSlug, worktreePath, command, suggestedPrompt,
      status: r.status, message: r.message,
    });
  }
  return { ok: true, results };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun test tests/scaffold.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd /c/mcp-s
git add batuta-mcp/src/tools/scaffold.ts batuta-mcp/tests/scaffold.test.ts
git commit -m "feat: scaffold (pre-flight git/overlap/path-safety + git worktree add)"
```

---

## Task 9: server — registro de las 3 tools (MCP)

**Files:**
- Create: `src\server.ts`
- Test: `tests\server.test.ts`

**Interfaces:**
- Consumes: `decomposeIntoPlans` (decompose), `checkBoundaryOverlaps` (boundaries), `scaffoldWorktrees` (scaffold), tipos.
- Produces:
  - `interface ServerDeps { runner: Runner; detectStack?: (repoPath: string) => Promise<string | undefined> }`
  - `createServer(deps: ServerDeps): McpServer`

- [ ] **Step 1: Escribir el test que falla `tests/server.test.ts`**

```ts
import { test, expect } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server";
import { FakeRunner } from "../src/lib/runner";
import type { RunResult } from "../src/types";

async function connect(responses: RunResult[] = []) {
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const server = createServer({ runner: new FakeRunner(responses) });
  await server.connect(serverT);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientT);
  return client;
}

test("expone exactamente las 3 tools", async () => {
  const client = await connect();
  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  expect(tools).toEqual([
    "check_boundary_overlaps",
    "decompose_into_plans",
    "scaffold_worktrees",
  ]);
});

test("check_boundary_overlaps devuelve structuredContent", async () => {
  const client = await connect();
  const res = await client.callTool({
    name: "check_boundary_overlaps",
    arguments: {
      plans: [
        { branchSlug: "a", fileBoundaries: ["x.ts"] },
        { branchSlug: "b", fileBoundaries: ["x.ts"] },
      ],
    },
  });
  expect((res.structuredContent as { ok: boolean }).ok).toBe(false);
});

test("decompose_into_plans devuelve isError cuando no hay planes", async () => {
  const client = await connect([{ code: 0, stdout: "no json", stderr: "" }]);
  const res = await client.callTool({
    name: "decompose_into_plans",
    arguments: { brainDump: "x" },
  });
  expect(res.isError).toBe(true);
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun test tests/server.test.ts`
Expected: FAIL — no existe `../src/server`.

- [ ] **Step 3: Implementar `src/server.ts`**

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Runner } from "./types";
import { decomposeIntoPlans } from "./tools/decompose";
import { checkBoundaryOverlaps } from "./tools/boundaries";
import { scaffoldWorktrees } from "./tools/scaffold";

export interface ServerDeps {
  runner: Runner;
  detectStack?: (repoPath: string) => Promise<string | undefined>;
}

const planShape = z.object({
  title: z.string(),
  specMd: z.string(),
  fileBoundaries: z.array(z.string()),
  branchSlug: z.string(),
});

const boundaryPlanShape = z.object({
  branchSlug: z.string(),
  fileBoundaries: z.array(z.string()),
});

function ok(structured: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structured) }],
    structuredContent: structured as Record<string, unknown>,
  };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function createServer(deps: ServerDeps): McpServer {
  const server = new McpServer({ name: "batuta-mcp", version: "0.1.0" });

  server.registerTool(
    "decompose_into_plans",
    {
      title: "Decompose into plans",
      description:
        "Split a brain dump into 2-5 plans with DISJOINT file boundaries (auto-corrects overlaps once). Returns plans, overlapsResolved, attempts.",
      inputSchema: {
        brainDump: z.string().min(1),
        projectHint: z.string().optional(),
        repoPath: z.string().optional(),
      },
      outputSchema: {
        plans: z.array(planShape),
        overlapsResolved: z.boolean(),
        attempts: z.number(),
      },
    },
    async ({ brainDump, projectHint, repoPath }) => {
      const res = await decomposeIntoPlans(
        { brainDump, projectHint, repoPath },
        { runner: deps.runner, detectStack: deps.detectStack },
      );
      if (res.plans.length === 0) {
        return fail("No plans produced (claude returned no parseable JSON array or the CLI failed).");
      }
      return ok(res);
    },
  );

  server.registerTool(
    "check_boundary_overlaps",
    {
      title: "Check boundary overlaps",
      description: "Pure check: do any plans share file boundaries? Returns overlaps and ok.",
      inputSchema: { plans: z.array(boundaryPlanShape) },
      outputSchema: {
        overlaps: z.array(
          z.object({ a: z.string(), b: z.string(), overlap: z.array(z.string()) }),
        ),
        ok: z.boolean(),
      },
    },
    async ({ plans }) => {
      const overlaps = checkBoundaryOverlaps(plans);
      return ok({ overlaps, ok: overlaps.length === 0 });
    },
  );

  server.registerTool(
    "scaffold_worktrees",
    {
      title: "Scaffold git worktrees",
      description:
        "Validate (git repo, no overlaps, safe paths) then create a git worktree per plan and return a ready-to-paste prompt per plan. Set dryRun to preview without touching disk.",
      inputSchema: {
        repoPath: z.string().min(1),
        plans: z.array(planShape),
        dryRun: z.boolean().optional(),
      },
      outputSchema: {
        results: z.array(
          z.object({
            branchSlug: z.string(),
            worktreePath: z.string(),
            command: z.string(),
            suggestedPrompt: z.string(),
            status: z.enum(["created", "exists", "error"]),
            message: z.string().optional(),
          }),
        ),
      },
    },
    async ({ repoPath, plans, dryRun }) => {
      const res = await scaffoldWorktrees({ repoPath, plans, dryRun }, { runner: deps.runner });
      if (!res.ok) return fail(res.error ?? "scaffold failed");
      return ok({ results: res.results });
    },
  );

  return server;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun test tests/server.test.ts`
Expected: PASS (3 tests). Si el SDK instalado rechaza el raw shape, ver nota al pie de esta tarea.

> **Nota de compatibilidad (validar, no asumir):** la doc de v1.29.0 usa `inputSchema` como raw shape (`{ k: z.x }`). Si `bun test` arroja un error de tipo/at-runtime sobre el schema, abrí `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts`, buscá la firma de `registerTool` y ajustá (envolver en `z.object({...})` si esa versión lo pide). Las 3 tools usan el mismo patrón, así que el ajuste es mecánico.

- [ ] **Step 5: Commit**

```bash
cd /c/mcp-s
git add batuta-mcp/src/server.ts batuta-mcp/tests/server.test.ts
git commit -m "feat: server MCP (registro de las 3 tools con schemas Zod)"
```

---

## Task 10: index (entrypoint) + README + verificación final

**Files:**
- Create: `src\index.ts`
- Create: `batuta-mcp\README.md`
- Test: (verificación manual; sin test nuevo)

**Interfaces:**
- Consumes: `createServer` (server), `bunRunner` (runner), `detectStackFs` (stack-detect), `StdioServerTransport` (SDK).

- [ ] **Step 1: Implementar `src/index.ts`**

```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";
import { bunRunner } from "./lib/runner";
import { detectStackFs } from "./lib/stack-detect";
import { setVerbose, logger } from "./lib/logger";

async function main(): Promise<void> {
  if (process.argv.includes("--verbose")) setVerbose(true);
  const server = createServer({ runner: bunRunner, detectStack: detectStackFs });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("batuta-mcp running on stdio");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Fatal error in batuta-mcp:", err);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Verificar que el server arranca por stdio**

Run: `cd /c/mcp-s/batuta-mcp && echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | bun run src/index.ts`
Expected: imprime a stderr `[batuta-mcp] info: batuta-mcp running on stdio` y a stdout una respuesta JSON-RPC que lista las 3 tools (`decompose_into_plans`, `check_boundary_overlaps`, `scaffold_worktrees`). (El proceso puede quedar abierto esperando stdin; cortar con Ctrl-C.)

- [ ] **Step 3: Crear `batuta-mcp/README.md`**

````markdown
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
````

- [ ] **Step 4: Verificación final (toda la suite + typecheck)**

Run: `cd /c/mcp-s/batuta-mcp && bun test && bunx tsc --noEmit`
Expected: todos los tests PASS, `tsc` sin errores.

- [ ] **Step 5: Commit**

```bash
cd /c/mcp-s
git add batuta-mcp/src/index.ts batuta-mcp/README.md
git commit -m "feat: entrypoint stdio + README de conexión (Warp/Claude Code)"
```

- [ ] **Step 6: Verificación manual end-to-end (con el usuario)**

1. `claude mcp add batuta -- bun run C:\mcp-s\batuta-mcp\src\index.ts`
2. En Claude Code: `claude mcp list` → debe aparecer `batuta` conectado.
3. Pedirle al agente: descomponer un brain dump real → `decompose_into_plans`.
4. `scaffold_worktrees` con `dryRun:true` sobre un repo de prueba → revisar `suggestedPrompt` y `command` sin tocar disco.
5. Repetir con `dryRun:false` → confirmar que se crean los worktrees en `.worktrees/`.
6. Conectar también en Warp (pegar el JSON) y repetir el flujo.

---

## Self-Review (hecho al escribir el plan)

- **Cobertura del spec:** §6.1 decompose → Task 7+9; §6.2 boundaries → Task 3+9; §6.3 scaffold (pre-flight, dryRun, tolerancia) → Task 8+9; §7 reuso/generalización → Tasks 3,6,7,8; §8 errores/logger → Tasks 1,7,8,9; §9 testing → todas; §10 conexión → Task 10; §11 criterios → cubiertos por Tasks 9 (3 tools, isError) y 10 (e2e, logs stderr, tsc).
- **Placeholders:** ninguno; todo el código está completo.
- **Consistencia de tipos:** `Plan`, `Runner`, `Overlap`, `ScaffoldResult`, `DecomposeResult` definidos en Task 1 y usados con la misma firma en 3/4/5/6/7/8/9. `FakeRunner(responses, fallback)` consistente entre Tasks 2,7,8,9. Nombres de tools idénticos en Task 9 (registro) y sus tests.
