import type { Config } from "@netlify/functions"
import { memberByEmail } from "../lib/db.mts"
import { createLoginToken } from "../lib/auth.mts"
import { json, readJson, str } from "../lib/http.mts"
import { sendLoginEmail } from "../lib/notify.mts"

// "Email me a login link." Always answers the same way so it never reveals who is a member.
export default async (req: Request) => {
  const body = await readJson(req, 2000)
  const email = str(body?.email, 200).toLowerCase()
  const member = email ? await memberByEmail(email) : null
  if (member) {
    try {
      const token = await createLoginToken(member.id)
      const base = Netlify.env.get("APP_URL") ?? new URL(req.url).origin
      await sendLoginEmail(member, `${base}/?login=${token}`)
    } catch (err) {
      console.error("login email failed", err)
    }
  }
  return json({ ok: true })
}

export const config: Config = { path: "/api/auth/request", method: "POST" }
