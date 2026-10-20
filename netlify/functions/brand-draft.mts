import type { Config, Context } from "@netlify/functions"
import { currentMember } from "../lib/auth.mts"
import { fetchProfiles } from "../lib/apify.mts"
import { draftBrand } from "../lib/brand.mts"
import { fail, json } from "../lib/http.mts"

// Drafts Brand Anatomy from the agent's live Instagram bio and captions.
export default async (_req: Request, context: Context) => {
  const m = await currentMember(context)
  if (!m) return fail(401, "Not signed in")
  if (!m.ig_handle) return fail(400, "Connect your Instagram first")
  try {
    const [profile] = await fetchProfiles([m.ig_handle])
    if (!profile || profile.isPrivate) return fail(400, "We couldn't read your Instagram. Make sure it's public.")
    const draft = await draftBrand(profile, { name: `${m.first_name} ${m.last_name}`.trim(), city: m.city ?? "", region: m.region ?? "" })
    return json({ ok: true, draft })
  } catch (err) {
    console.error("brand draft failed", err)
    return fail(502, err instanceof Error ? err.message : "Drafting failed")
  }
}

export const config: Config = { path: "/api/brand-draft", method: "POST" }
