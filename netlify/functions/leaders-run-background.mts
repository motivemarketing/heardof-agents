import type { Config } from "@netlify/functions"
import { hasServerKey } from "../lib/auth.mts"
import { readJson } from "../lib/http.mts"
import { runLeaders } from "../lib/jobs.mts"

export default async (req: Request) => {
  if (!hasServerKey(req)) return
  const body = await readJson<{ jobId: string; memberId: string }>(req, 2000)
  if (body?.jobId && body.memberId) await runLeaders(body.jobId, body.memberId)
}

export const config: Config = { path: "/api/internal/leaders-run", background: true }
