import type { Config, Context } from "@netlify/functions"
import { currentMember } from "../lib/auth.mts"
import { fail, json, readJson } from "../lib/http.mts"
import { pushProgress } from "../lib/notify.mts"

// The app reports milestones here; they go to GHL to trigger coaching booking and check-in emails.
const KEYS = ["hos_score", "score_day", "brand_anatomy_done", "leaders_done", "month_one_done", "posts_marked"]

export default async (req: Request, context: Context) => {
  const m = await currentMember(context)
  if (!m) return fail(401, "Not signed in")
  const body = await readJson(req, 4000)
  if (!body) return fail(400, "Invalid JSON")
  const progress: Record<string, unknown> = { tier: m.tier }
  for (const k of KEYS) if (k in body) progress[k] = body[k]
  await pushProgress(m, progress)
  return json({ ok: true })
}

export const config: Config = { path: "/api/progress", method: "POST" }
