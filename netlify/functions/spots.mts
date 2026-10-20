import type { Config, Context } from "@netlify/functions"
import { getStore } from "@netlify/blobs"
import { currentMember } from "../lib/auth.mts"
import { fail, json } from "../lib/http.mts"
import { searchPlaces } from "../lib/places.mts"

// Real local places for the City Content Plan ("3 things to do", coffee rankings, business features).
// Cached per city for 30 days so every agent in the same city shares one lookup.
const QUERIES = { coffee: "best coffee shop in", food: "best local restaurant in", outdoors: "best park in", things: "things to do in" } as const
const TTL = 30 * 86400_000

export default async (_req: Request, context: Context) => {
  const m = await currentMember(context)
  if (!m) return fail(401, "Not signed in")
  if (!m.city) return json({ ok: true, spots: {} })
  const where = `${m.city}${m.region ? `, ${m.region}` : ""}`
  const key = where.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const store = getStore("city-spots")
  const cached = await store.get(key, { type: "json" }) as { at: number; spots: Record<string, string[]> } | null
  if (cached && Date.now() - cached.at < TTL) return json({ ok: true, spots: cached.spots })

  const spots: Record<string, string[]> = {}
  await Promise.all(
    Object.entries(QUERIES).map(async ([k, q]) => {
      try {
        const places = await searchPlaces(`${q} ${where}`, 10)
        spots[k] = places.filter((p) => p.rating >= 4.3).sort((a, b) => b.reviews - a.reviews).slice(0, 6).map((p) => p.name)
      } catch (err) {
        console.error("spots lookup failed", k, err)
        spots[k] = []
      }
    }),
  )
  await store.setJSON(key, { at: Date.now(), spots })
  return json({ ok: true, spots })
}

export const config: Config = { path: "/api/spots", method: "GET" }
