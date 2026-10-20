import type { IgProfile } from "./apify.mts"

// Turns public profile data into the Heard Of Score answers (0–3 each), so agents only answer
// the four questions no public data can show: how they plan content, DM speed, sphere touches
// and boosting. Pure functions: no I/O, covered by test/signals.test.mts.

export type LinkType = "none" | "brokerage" | "website" | "guide"

export interface Signals {
  followers: number
  posts30: number
  videoPct: number
  reviews: number
  rating: number
  linkType: LinkType
  localShare: number
  marketPosts: number
  bizPosts: number
  storyPosts: number
  bioHasPlace: boolean
  bioHasNiche: boolean
  bioHasCta: boolean
}

export type AutoAnswers = Record<
  "bio" | "lane" | "freq" | "video" | "area" | "data" | "biz" | "reviews" | "stories" | "link" | "followers",
  number
>

export const SELF_REPORT = ["plan", "dm", "sphere", "boost"] as const

const BROKERAGE_DOMAINS = [
  "onereal.com", "realbrokerage.com", "joinreal.com", "kw.com", "kellerwilliams.com", "exprealty.com",
  "compass.com", "coldwellbanker", "remax.com", "century21.com", "bhhs.com", "sothebysrealty.com",
  "redfin.com", "zillow.com", "realtor.com", "homesmart.com", "fathomrealty.com", "epique",
  "unitedrealestate", "howardhanna.com", "longandfoster.com", "weichert.com", "corcoran.com", "elliman.com",
]
const GUIDE_HINTS = [
  "guide", "homevalue", "home-value", "whats-my-home-worth", "worth", "free", "download", "relocat",
  "moving", "leadconnectorhq", "msgsndr", "gohighlevel", "stan.store", "beacons.ai", "lp.", "landing",
]
const AGGREGATORS = ["linktr.ee", "linkin.bio", "bio.site", "taplink", "lnk.bio", "campsite.bio", "allmylinks"]

const NICHE = [
  "first-time", "first time", "buyers", "sellers", "luxury", "relocation", "relocating", "military", "va loan",
  "investor", "investment", "downsiz", "new construction", "condo", "families", "waterfront", "golf", "ranch",
  "land", "veterans", "teachers", "medical", "nurses", "retire",
]
const CTA = ["dm", "message me", "link below", "click", "↓", "👇", "free", "guide", "call", "text"]
const MARKET = [
  "market", "inventory", "interest rate", "rates", "median", "prices", "days on market", "appreciation",
  "listings", "mortgage", "housing", "buyer's market", "seller's market", "price drop",
]
const BIZ = ["local business", "shop local", "small business", "owner", "coffee", "restaurant", "brewery", "bakery", "boutique", "eatery", "cafe"]
const STORY = [
  "closed", "closing", "congrats", "congratulations", "keys", "sold", "under contract", "new homeowner",
  "testimonial", "review", "client", "happy homeowners", "just listed", "welcome home",
]

const has = (text: string, words: string[]) => words.some((w) => text.includes(w))
const count = (texts: string[], words: string[]) => texts.filter((t) => has(t, words)).length

export function linkType(url: string): LinkType {
  const u = url.toLowerCase()
  if (!u) return "none"
  if (GUIDE_HINTS.some((h) => u.includes(h))) return "guide"
  if (BROKERAGE_DOMAINS.some((d) => u.includes(d))) return "brokerage"
  if (AGGREGATORS.some((d) => u.includes(d))) return "website"
  return "website"
}

export function placeWords(city: string, extra: string[] = []): string[] {
  return [city, ...extra]
    .map((w) => w.toLowerCase().trim())
    .filter((w) => w.length >= 3)
}

export function computeSignals(
  profile: IgProfile,
  opts: { city: string; areaWords?: string[]; reviews?: number; rating?: number; now?: Date },
): Signals {
  const now = (opts.now ?? new Date()).getTime()
  const recent = profile.posts.filter((p) => {
    const t = Date.parse(p.timestamp)
    return Number.isFinite(t) && now - t <= 30 * 86400_000
  })
  const sample = profile.posts.slice(0, 12)
  const captions = sample.map((p) => p.caption.toLowerCase())
  const words = placeWords(opts.city, opts.areaWords)
  const bio = `${profile.bio} ${profile.fullName}`.toLowerCase()
  const videos = sample.filter((p) => p.type === "Video").length

  return {
    followers: profile.followers,
    posts30: recent.length,
    videoPct: sample.length ? Math.round((videos / sample.length) * 100) : 0,
    reviews: opts.reviews ?? 0,
    rating: opts.rating ?? 0,
    linkType: linkType(profile.externalUrl),
    localShare: sample.length ? Math.round((count(captions, words) / sample.length) * 100) : 0,
    marketPosts: count(captions, MARKET),
    bizPosts: captions.filter((c, i) => has(c, BIZ) || (sample[i]?.mentions.length ?? 0) > 0).length,
    storyPosts: count(captions, STORY),
    bioHasPlace: has(bio, words),
    bioHasNiche: has(bio, NICHE),
    bioHasCta: has(bio, CTA) || !!profile.externalUrl,
  }
}

const band = (v: number, cuts: [number, number, number]) => (v >= cuts[2] ? 3 : v >= cuts[1] ? 2 : v >= cuts[0] ? 1 : 0)

export function autoAnswers(s: Signals): AutoAnswers {
  const bioPts = Number(s.bioHasPlace) + Number(s.bioHasNiche) + Number(s.bioHasCta)
  return {
    bio: bioPts,
    lane: s.bioHasNiche && s.bioHasPlace ? (s.localShare >= 35 ? 3 : 2) : s.bioHasNiche || s.bioHasPlace ? 1 : 0,
    freq: band(s.posts30, [2, 6, 12]),
    video: s.videoPct >= 60 ? 3 : s.videoPct >= 25 ? 2 : s.videoPct > 0 ? 1 : 0,
    area: s.localShare >= 35 ? 3 : s.localShare >= 15 ? 2 : s.localShare > 0 ? 1 : 0,
    data: band(s.marketPosts, [1, 2, 4]),
    biz: band(s.bizPosts, [1, 2, 4]),
    reviews: band(s.reviews, [10, 25, 75]),
    stories: band(s.storyPosts, [1, 2, 4]),
    link: { none: 0, brokerage: 1, website: 2, guide: 3 }[s.linkType],
    followers: band(s.followers, [500, 2000, 10000]),
  }
}

// What the app shows next to each auto-filled answer, so the agent can see why.
export function evidence(s: Signals): Record<keyof AutoAnswers, string> {
  return {
    bio: `Bio ${s.bioHasNiche ? "names" : "doesn't name"} who you help, ${s.bioHasPlace ? "names" : "doesn't name"} your area, ${s.bioHasCta ? "has" : "has no"} next step`,
    lane: s.bioHasNiche ? "Your bio names a client type" : "No clear client type in your bio",
    freq: `${s.posts30} posts in the last 30 days`,
    video: `${s.videoPct}% of recent posts are video`,
    area: `${s.localShare}% of recent captions mention your area`,
    data: `${s.marketPosts} recent posts about the market`,
    biz: `${s.bizPosts} recent posts feature local people or businesses`,
    reviews: `${s.reviews} Google reviews${s.rating ? `, ${s.rating.toFixed(1)} stars` : ""}`,
    stories: `${s.storyPosts} recent client or closing posts`,
    link: { none: "No link in bio", brokerage: "Link in bio goes to a brokerage page", website: "Link in bio goes to your site or a link page", guide: "Link in bio offers something free" }[s.linkType],
    followers: `${s.followers.toLocaleString("en-US")} followers`,
  }
}
