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
