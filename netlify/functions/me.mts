import type { Config, Context } from "@netlify/functions"
import { currentMember } from "../lib/auth.mts"
import { latestJob } from "../lib/db.mts"
import { fail, json } from "../lib/http.mts"

// Everything the app needs on load: who you are, your saved work, and the latest data pulls.
export default async (_req: Request, context: Context) => {
  const m = await currentMember(context)
  if (!m) return fail(401, "Not signed in")
  const [audit, leaders] = await Promise.all([latestJob(m.id, "audit"), latestJob(m.id, "leaders")])
  return json({
    ok: true,
    member: {
      email: m.email, firstName: m.first_name, lastName: m.last_name, tier: m.tier, startDate: m.start_date,
      handle: m.ig_handle ?? "", businessName: m.business_name ?? "", city: m.city ?? "", region: m.region ?? "", marketSize: m.market_size,
    },
    state: m.app_state ?? {},
    jobs: {
      audit: audit && { id: audit.id, status: audit.status, error: audit.error },
      leaders: leaders && { id: leaders.id, status: leaders.status, error: leaders.error },
    },
  })
}

export const config: Config = { path: "/api/me", method: "GET" }
