import type { Config, Context } from "@netlify/functions"
import { redeemLoginToken, startSession } from "../lib/auth.mts"
import { fail, json, readJson, str } from "../lib/http.mts"

export default async (req: Request, context: Context) => {
  const body = await readJson(req, 2000)
  const token = str(body?.token, 200)
  if (!token) return fail(400, "Missing token")
  const member = await redeemLoginToken(token)
  if (!member) return fail(401, "This login link has expired or was already used. Ask for a new one.")
  startSession(context, member.id)
  return json({ ok: true })
}

export const config: Config = { path: "/api/auth/verify", method: "POST" }
