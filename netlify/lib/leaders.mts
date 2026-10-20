import type { IgProfile } from "./apify.mts"
import type { Place } from "./places.mts"

// Finding the most visible agents in a market: Google Places gives the agents with the most
// reviews, their websites give their Instagram handles. Pure helpers here; I/O lives in jobs.mts.

// Brokerage and portal accounts that agent websites often link to. These are never "leaders".
export const IGNORE_HANDLES = new Set([
  "realbrokerage", "real", "joinreal", "kellerwilliams", "kellerwilliamsrealty", "exprealty", "compass",
  "coldwellbanker", "coldwellbankerrealty", "remax", "century21", "bhhsrealestate", "sothebysrealty",
  "redfin", "zillow", "realtordotcom", "realtors", "nar_realtors", "homesmart", "fathomrealty",
  "p", "reel", "reels", "explore", "accounts", "stories", "tv", "share", "direct",
])

export function handlesFromHtml(html: string): string[] {
  const out = new Set<string>()
  const re = /instagram\.com\/(?:#!\/)?([A-Za-z0-9._]{1,30})(?=[/?"'#\s<]|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const h = m[1].toLowerCase().replace(/\.$/, "")
    if (h && !IGNORE_HANDLES.has(h)) out.add(h)
  }
  return [...out]
}

export async function findHandleOnSite(url: string, timeoutMs = 6000): Promise<string | null> {
  if (!/^https?:\/\//i.test(url)) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; HeardOfBot/1.0)" } })
    if (!res.ok) return null
    const html = (await res.text()).slice(0, 600_000)
    return handlesFromHtml(html)[0] ?? null
  } catch {
    return null
  }
}

// Agents with the most Google reviews first; drop the member's own listing and big brokerage offices.
export function rankCandidates(places: Place[], exclude: { placeId?: string | null; name?: string | null }): Place[] {
  const own = (exclude.name ?? "").toLowerCase()
  return places
    .filter((p) => p.id !== exclude.placeId)
    .filter((p) => !own || !p.name.toLowerCase().includes(own))
    .filter((p) => p.website)
    .sort((a, b) => b.reviews - a.reviews)
}

export interface Leader {
  name: string
  handle: string
  followers: number
  posts30: number
  videoPct: number
  reviews: number
  rating: number
  linkType: string
  mapsUrl: string
}

// Visibility score for picking the top 3: followers and reviews, both on a log scale.
export function visibility(profile: IgProfile, place: Place): number {
  return Math.log10(profile.followers + 10) * 2 + Math.log10(place.reviews + 1) * 3
}
