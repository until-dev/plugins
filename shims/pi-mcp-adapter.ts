// Typecheck-only stand-in for pi-mcp-adapter. The published package exports
// TypeScript source that imports optional Pi host packages this plugin does
// not install; runtime still resolves the real dependency.
export function createMcpAdapter(_options: {
  configPath: string;
}): (pi: unknown) => void {
  return () => undefined;
}
