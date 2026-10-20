import type { Config, Context } from "@netlify/functions"
import { currentMember } from "../lib/auth.mts"
import { createJob, latestJob } from "../lib/db.mts"
import { fail, json, readJson } from "../lib/http.mts"
import { startJob } from "../lib/jobs.mts"

// Re-pull one data source: "audit" (your Instagram + Google) or "leaders".
export default async (req: Request, context: Context) => {
  const m = await currentMember(context)
  if (!m) return fail(401, "Not signed in")
  const body = await readJson<{ kind?: string }>(req, 1000)
  const kind = body?.kind === "leaders" ? "leaders" : "audit"
  const last = await latestJob(m.id, kind)
  if (last && (last.status === "queued" || last.status === "running")) return json({ ok: true, job: last.id })
  const id = await createJob(m.id, kind)
  await startJob(req, kind, id, m.id)
  return json({ ok: true, job: id })
}

export const config: Config = { path: "/api/refresh", method: "POST" }
