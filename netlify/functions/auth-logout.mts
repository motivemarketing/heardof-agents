import type { Config, Context } from "@netlify/functions"
import { endSession } from "../lib/auth.mts"
import { json } from "../lib/http.mts"

export default async (_req: Request, context: Context) => {
  endSession(context)
  return json({ ok: true })
}

export const config: Config = { path: "/api/auth/logout", method: "POST" }
