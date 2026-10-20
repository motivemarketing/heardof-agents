import { db, memberById, setJob, type Member } from "./db.mts"
import { fetchProfiles, type IgProfile } from "./apify.mts"
import { searchPlaces, reviewLink, type Place } from "./places.mts"
import { computeSignals, autoAnswers, evidence, linkType } from "./signals.mts"
import { rankCandidates, findHandleOnSite, visibility, type Leader } from "./leaders.mts"
import { pushProgress } from "./notify.mts"

// The work behind the background functions. Each run records its result on the jobs row and
// mirrors the parts the app needs into members.app_state.auto.

async function mergeAuto(memberId: string, patch: Record<string, unknown>) {
  await db().sql`
    UPDATE members
    SET app_state = jsonb_set(app_state, '{auto}', COALESCE(app_state->'auto', '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb, true),
        updated_at = NOW()
    WHERE id = ${memberId}`
}

async function ownPlace(m: Member): Promise<Place | null> {
  if (!m.business_name && !m.place_id) return null
  const query = [m.business_name || `${m.first_name} ${m.last_name} realtor`, m.city, m.region].filter(Boolean).join(" ")
  const results = await searchPlaces(query, 5)
  return results.find((p) => p.id === m.place_id) ?? results[0] ?? null
}

async function snapshot(m: Member, p: IgProfile, posts30: number, videoPct: number) {
  await db().sql`
    INSERT INTO ig_snapshots (member_id, handle, followers, posts_30d, video_pct, post_dates)
    VALUES (${m.id}, ${p.handle}, ${p.followers}, ${posts30}, ${videoPct}, ${JSON.stringify(p.posts.map((x) => x.timestamp))}::jsonb)`
}

export async function runAudit(jobId: string, memberId: string) {
  await setJob(jobId, "running")
  try {
    const m = await memberById(memberId)
    if (!m?.ig_handle) throw new Error("Add your Instagram handle first")
    const [profiles, place] = await Promise.all([fetchProfiles([m.ig_handle]), ownPlace(m).catch(() => null)])
    const profile = profiles[0]
    if (!profile) throw new Error(`We couldn't find @${m.ig_handle} on Instagram`)
    if (profile.isPrivate) throw new Error(`@${m.ig_handle} is private, so we can't read it. Switch it to a public or business account and try again.`)

    if (place && place.id !== m.place_id) {
      await db().sql`UPDATE members SET place_id = ${place.id} WHERE id = ${m.id}`
    }
    const signals = computeSignals(profile, { city: m.city ?? "", reviews: place?.reviews, rating: place?.rating })
    const result = {
      at: new Date().toISOString(),
      handle: profile.handle,
      signals,
      answers: autoAnswers(signals),
      evidence: evidence(signals),
      bio: profile.bio,
      externalUrl: profile.externalUrl,
      place: place ? { id: place.id, name: place.name, reviews: place.reviews, rating: place.rating, mapsUrl: place.mapsUrl, reviewUrl: reviewLink(place.id) } : null,
      postDates: profile.posts.map((x) => x.timestamp),
    }
    await snapshot(m, profile, signals.posts30, signals.videoPct)
    await mergeAuto(m.id, { audit: result })
    await setJob(jobId, "done", result)
    await pushProgress(m, { ig_followers: signals.followers, ig_posts_30d: signals.posts30, google_reviews: signals.reviews })
  } catch (err) {
    console.error("audit failed", err)
    await setJob(jobId, "error", undefined, err instanceof Error ? err.message : "Something went wrong")
  }
}

export async function runLeaders(jobId: string, memberId: string) {
  await setJob(jobId, "running")
  try {
    const m = await memberById(memberId)
    if (!m?.city) throw new Error("Add your city first")
    const places = await searchPlaces(`real estate agent in ${m.city}${m.region ? `, ${m.region}` : ""}`, 20)
    const candidates = rankCandidates(places, { placeId: m.place_id, name: m.business_name }).slice(0, 10)

    // Find each candidate's Instagram from their website, in parallel.
    const withHandles = (
      await Promise.all(candidates.map(async (p) => ({ place: p, handle: await findHandleOnSite(p.website) })))
    ).filter((c): c is { place: Place; handle: string } => !!c.handle && c.handle !== m.ig_handle)

    const unique = [...new Map(withHandles.map((c) => [c.handle, c])).values()].slice(0, 6)
    const profiles = await fetchProfiles(unique.map((c) => c.handle))
    const byHandle = new Map(profiles.filter((p) => !p.isPrivate).map((p) => [p.handle, p]))

    const leaders: (Leader & { score: number })[] = unique
      .filter((c) => byHandle.has(c.handle))
      .map((c) => {
        const p = byHandle.get(c.handle)!
        const s = computeSignals(p, { city: m.city ?? "", reviews: c.place.reviews, rating: c.place.rating })
        return {
          name: p.fullName || c.place.name,
          handle: `@${p.handle}`,
          followers: s.followers,
          posts30: s.posts30,
          videoPct: s.videoPct,
          reviews: c.place.reviews,
          rating: c.place.rating,
          linkType: linkType(p.externalUrl),
          mapsUrl: c.place.mapsUrl,
          score: visibility(p, c.place),
        }
      })
      .sort((a, b) => b.score - a.score)

    const result = {
      at: new Date().toISOString(),
      leaders: leaders.slice(0, 3).map(({ score, ...l }) => l),
      alternates: leaders.slice(3).map(({ score, ...l }) => l),
      searched: candidates.length,
    }
    if (!result.leaders.length) throw new Error(`We couldn't match agents in ${m.city} to Instagram accounts. Add three leaders by hand.`)
    await mergeAuto(m.id, { leaders: result })
    await setJob(jobId, "done", result)
  } catch (err) {
    console.error("leaders failed", err)
    await setJob(jobId, "error", undefined, err instanceof Error ? err.message : "Something went wrong")
  }
}

export async function startJob(req: Request, kind: "audit" | "leaders", jobId: string, memberId: string) {
  // Background functions answer 202 right away and keep running for up to 15 minutes.
  const url = new URL(`/api/internal/${kind}-run`, req.url)
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-heardof-key": Netlify.env.get("HEARDOF_SERVER_KEY") ?? "" },
    body: JSON.stringify({ jobId, memberId }),
  })
  if (res.status !== 202 && !res.ok) throw new Error(`Couldn't start ${kind}: ${res.status}`)
}
