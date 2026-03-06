import { json } from "@sveltejs/kit";
import { getBaseDir } from "$lib/server/session-manager";

export function GET() {
  return json({ sessionDir: getBaseDir(), pid: process.pid });
}
