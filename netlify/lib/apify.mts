import { env } from "./http.mts"

// Public Instagram profile data through Apify's Instagram Profile Scraper, the same source the
// Social Media Scorecard uses. One call can fetch several handles.

export interface IgPost {
  type: "Video" | "Image" | "Sidecar" | string
  timestamp: string
  caption: string
  likes: number
  comments: number
  mentions: string[]
}

export interface IgProfile {
  handle: string
  fullName: string
  bio: string
  externalUrl: string
  followers: number
  postsCount: number
  isPrivate: boolean
  posts: IgPost[]
}

const ACTOR = "apify~instagram-profile-scraper"

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0)
const s = (v: unknown) => (typeof v === "string" ? v : "")

// The actor's field names have shifted between versions; read the known aliases.
function toProfile(item: Record<string, unknown>): IgProfile {
  const posts = Array.isArray(item.latestPosts) ? (item.latestPosts as Record<string, unknown>[]) : []
  return {
    handle: s(item.username).toLowerCase(),
    fullName: s(item.fullName),
    bio: s(item.biography),
    externalUrl: s(item.externalUrl) || s((item.externalUrls as { url?: string }[] | undefined)?.[0]?.url),
    followers: num(item.followersCount),
    postsCount: num(item.postsCount),
    isPrivate: item.private === true,
    posts: posts.map((p) => ({
      type: s(p.type) || (p.isVideo === true ? "Video" : "Image"),
      timestamp: s(p.timestamp),
      caption: s(p.caption),
      likes: num(p.likesCount),
      comments: num(p.commentsCount),
      mentions: Array.isArray(p.mentions) ? (p.mentions as unknown[]).map(s).filter(Boolean) : [],
    })),
  }
}

export async function fetchProfiles(handles: string[]): Promise<IgProfile[]> {
  if (!handles.length) return []
  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=240`
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env("APIFY_TOKEN")}` },
    body: JSON.stringify({ usernames: handles }),
  })
  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const items = (await res.json()) as Record<string, unknown>[]
  return items.filter((i) => i && typeof i.username === "string").map(toProfile)
}
