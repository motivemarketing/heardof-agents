import type { Config, Context } from "@netlify/functions"
import { currentMember } from "../lib/auth.mts"
import { db } from "../lib/db.mts"
import { fail, json } from "../lib/http.mts"

export default async (req: Request, context: Context) => {
  const m = await currentMember(context)
  if (!m) return fail(401, "Not signed in")
  const id = new URL(req.url).searchParams.get("id") ?? ""
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(400, "Bad job id")
  const rows = await db().sql<{ kind: string; status: string; result: unknown; error: string | null }>`
    SELECT kind, status, result, error FROM jobs WHERE id = ${id} AND member_id = ${m.id}`
  if (!rows[0]) return fail(404, "Job not found")
  return json({ ok: true, ...rows[0] })
}

export const config: Config = { path: "/api/job", method: "GET" }
