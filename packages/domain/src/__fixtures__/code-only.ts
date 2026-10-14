// Shared test helper: TypeScript source with comments and string literals blanked, so a guard test searches code only.
export function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, "''")
    .replace(/\/\/.*$/gm, ' ')
}
