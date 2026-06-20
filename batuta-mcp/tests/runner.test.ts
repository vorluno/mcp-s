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
