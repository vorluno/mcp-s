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
