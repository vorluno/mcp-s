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
