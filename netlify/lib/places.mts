import { env } from "./http.mts"

// Google Business Profile data through the Places API (New): ratings, review counts, websites.

export interface Place {
  id: string
  name: string
  rating: number
  reviews: number
  website: string
  address: string
  mapsUrl: string
  types: string[]
}

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.formattedAddress",
  "places.googleMapsUri",
  "places.types",
].join(",")

export async function searchPlaces(textQuery: string, pageSize = 20): Promise<Place[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": env("GOOGLE_PLACES_KEY"),
      "X-Goog-FieldMask": FIELDS,
    },
    body: JSON.stringify({ textQuery, pageSize }),
  })
  if (!res.ok) throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = (await res.json()) as { places?: Record<string, any>[] }
  return (data.places ?? []).map((p) => ({
    id: String(p.id ?? ""),
    name: String(p.displayName?.text ?? ""),
    rating: Number(p.rating ?? 0),
    reviews: Number(p.userRatingCount ?? 0),
    website: String(p.websiteUri ?? ""),
    address: String(p.formattedAddress ?? ""),
    mapsUrl: String(p.googleMapsUri ?? ""),
    types: Array.isArray(p.types) ? p.types.map(String) : [],
  }))
}

export const reviewLink = (placeId: string) =>
  `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
