import type { Config, Context } from "@netlify/functions"
import { currentMember } from "../lib/auth.mts"
import { createJob, db } from "../lib/db.mts"
import { cleanHandle, fail, isHandle, json, readJson, str } from "../lib/http.mts"
import { startJob } from "../lib/jobs.mts"

// Setup: saves the agent's market and accounts, then pulls their Instagram and Google data and
// finds their local leaders in the background.
export default async (req: Request, context: Context) => {
  const m = await currentMember(context)
  if (!m) return fail(401, "Not signed in")
  const body = await readJson(req, 4000)
  if (!body) return fail(400, "Invalid JSON")

  const handle = cleanHandle(str(body.handle, 100))
  const city = str(body.city, 80)
  if (!isHandle(handle)) return fail(400, "Enter your Instagram handle, like @yourname")
  if (!city) return fail(400, "Enter the city you serve most")
  const size = ["small", "mid", "metro"].includes(str(body.marketSize, 10)) ? str(body.marketSize, 10) : "mid"

  try {
  await db().sql`
    UPDATE members SET ig_handle = ${handle}, business_name = ${str(body.businessName, 120) || null},
      city = ${city}, region = ${str(body.region, 40) || null}, market_size = ${size},
      first_name = COALESCE(NULLIF(${str(body.firstName, 80)}, ''), first_name),
      last_name = COALESCE(NULLIF(${str(body.lastName, 80)}, ''), last_name),
      place_id = CASE WHEN business_name IS DISTINCT FROM ${str(body.businessName, 120) || null} THEN NULL ELSE place_id END,
      updated_at = NOW()
    WHERE id = ${m.id}`

  const auditJob = await createJob(m.id, "audit")
  const leadersJob = await createJob(m.id, "leaders")
  await Promise.all([startJob(req, "audit", auditJob, m.id), startJob(req, "leaders", leadersJob, m.id)])
  return json({ ok: true, jobs: { audit: auditJob, leaders: leadersJob } })
  } catch (err) {
    console.error("connect failed", err)
    return fail(500, err instanceof Error ? err.message : "Couldn't save your details")
  }
}

export const config: Config = { path: "/api/connect", method: "POST" }
