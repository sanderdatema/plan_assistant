/**
 * Output formatting helpers for CLI commands.
 * All commands output JSON by default (for AI parsing).
 */

export function outputJson(data: unknown, pretty = false): void {
  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  process.stdout.write(json + "\n");
}

export function outputError(error: string, code?: string): void {
  const payload: { error: string; code?: string } = { error };
  if (code) payload.code = code;
  process.stderr.write(JSON.stringify(payload) + "\n");
}
