import type { Config } from "@netlify/functions"
import { hasServerKey } from "../lib/auth.mts"
import { readJson } from "../lib/http.mts"
import { runAudit } from "../lib/jobs.mts"

export default async (req: Request) => {
  if (!hasServerKey(req)) return
  const body = await readJson<{ jobId: string; memberId: string }>(req, 2000)
  if (body?.jobId && body.memberId) await runAudit(body.jobId, body.memberId)
}

export const config: Config = { path: "/api/internal/audit-run", background: true }
