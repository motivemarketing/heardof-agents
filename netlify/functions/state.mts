import type { Config, Context } from "@netlify/functions"
import { currentMember } from "../lib/auth.mts"
import { db } from "../lib/db.mts"
import { fail, json, readJson } from "../lib/http.mts"

// Saves the agent's own work (answers, Brand Anatomy, plan checkmarks). The "auto" key belongs
// to the server, so it's kept from the stored copy and never taken from the browser.
export default async (req: Request, context: Context) => {
  const m = await currentMember(context)
  if (!m) return fail(401, "Not signed in")
  const body = await readJson<{ state?: Record<string, unknown> }>(req, 400_000)
  if (!body?.state || typeof body.state !== "object") return fail(400, "Missing state")
  const { auto: _ignored, ...own } = body.state
  await db().sql`
    UPDATE members
    SET app_state = ${JSON.stringify(own)}::jsonb || jsonb_build_object('auto', COALESCE(app_state->'auto', '{}'::jsonb)),
        updated_at = NOW()
    WHERE id = ${m.id}`
  return json({ ok: true })
}

export const config: Config = { path: "/api/state", method: "PUT" }
