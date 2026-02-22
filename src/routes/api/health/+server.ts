import { json } from "@sveltejs/kit";
import { join } from "node:path";
import { homedir } from "node:os";

export function GET() {
  const sessionDir =
    process.env.SESSION_DIR || join(homedir(), ".plan-assistant", "sessions");
  return json({ sessionDir, pid: process.pid });
}
