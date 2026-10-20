import type { Config, Context } from "@netlify/functions"
import { db, memberByEmail, type Member } from "../lib/db.mts"
import { createLoginToken, hasServerKey } from "../lib/auth.mts"
import { fail, json, readJson, str } from "../lib/http.mts"
import { sendLoginEmail } from "../lib/notify.mts"

// Called by GHL (WF-06 / WF-07b) when someone buys or adds coaching. Creates or updates the
// member and emails a login link. Header: x-heardof-key: HEARDOF_SERVER_KEY.
export default async (req: Request, context: Context) => {
  if (!hasServerKey(req)) return fail(401, "Unauthorized")
  const body = await readJson(req)
  if (!body) return fail(400, "Invalid JSON")

  const email = str(body.email, 200).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(400, "Invalid email")
  const tier = str(body.tier, 40).toLowerCase().includes("coach") ? "coaching" : "toolkit"
  const city = str(body.market_city, 80) || null
  const region = str(body.market_state, 40) || null
  const size = ["small", "mid", "metro"].includes(str(body.market_size, 10)) ? str(body.market_size, 10) : "mid"
  const handle = str(body.instagram_handle, 60).replace(/^@/, "").toLowerCase() || null

  const existing = await memberByEmail(email)
  let member: Member
  if (existing) {
    // Never downgrade: adding coaching later upgrades, a repeat Toolkit purchase keeps coaching.
    const nextTier = existing.tier === "coaching" ? "coaching" : tier
    const rows = await db().sql<Member>`
      UPDATE members SET tier = ${nextTier},
        ghl_contact_id = COALESCE(${str(body.ghl_contact_id, 80) || null}, ghl_contact_id),
        updated_at = NOW()
      WHERE id = ${existing.id} RETURNING *`
    member = rows[0]
  } else {
    const rows = await db().sql<Member>`
      INSERT INTO members (email, first_name, last_name, phone, tier, ghl_contact_id, ig_handle, city, region, market_size, start_date)
      VALUES (${email}, ${str(body.first_name, 80)}, ${str(body.last_name, 80)}, ${str(body.phone, 40)}, ${tier},
              ${str(body.ghl_contact_id, 80) || null}, ${handle}, ${city}, ${region}, ${size},
              ${str(body.start_date, 10) || new Date().toISOString().slice(0, 10)})
      RETURNING *`
    member = rows[0]
  }

  if (body.send_login !== false) {
    const token = await createLoginToken(member.id)
    const base = Netlify.env.get("APP_URL") ?? new URL(req.url).origin
    await sendLoginEmail(member, `${base}/?login=${token}`)
  }
  return json({ ok: true, member_id: member.id, tier: member.tier })
}

export const config: Config = { path: "/api/provision", method: "POST" }
