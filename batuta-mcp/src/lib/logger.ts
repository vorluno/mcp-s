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
