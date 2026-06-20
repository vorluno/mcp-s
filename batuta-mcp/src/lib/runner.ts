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
