import type { Config } from "@netlify/functions"
import { hasServerKey } from "../lib/auth.mts"
import { db, type Member } from "../lib/db.mts"
import { fetchProfiles } from "../lib/apify.mts"
import { computeSignals } from "../lib/signals.mts"
import { pushProgress } from "../lib/notify.mts"

// Every Monday: re-read every member's Instagram so the app can mark posts as done and show
// follower and posting trends without the agent typing anything.
const BATCH = 25

export default async (req: Request) => {
  if (!hasServerKey(req)) return
  const members = await db().sql<Member>`
    SELECT * FROM members WHERE ig_handle IS NOT NULL AND start_date > CURRENT_DATE - INTERVAL '120 days'`
  for (let i = 0; i < members.length; i += BATCH) {
    const chunk = members.slice(i, i + BATCH)
    try {
      const profiles = await fetchProfiles(chunk.map((m) => m.ig_handle!))
      const byHandle = new Map(profiles.map((p) => [p.handle, p]))
      for (const m of chunk) {
        const p = byHandle.get(m.ig_handle!)
        if (!p || p.isPrivate) continue
        const s = computeSignals(p, { city: m.city ?? "" })
        const postDates = p.posts.map((x) => x.timestamp)
        await db().sql`
          INSERT INTO ig_snapshots (member_id, handle, followers, posts_30d, video_pct, post_dates)
          VALUES (${m.id}, ${p.handle}, ${s.followers}, ${s.posts30}, ${s.videoPct}, ${JSON.stringify(postDates)}::jsonb)`
        await db().sql`
          UPDATE members SET app_state = jsonb_set(app_state, '{auto}',
            COALESCE(app_state->'auto', '{}'::jsonb) || ${JSON.stringify({ weekly: { at: new Date().toISOString(), followers: s.followers, posts30: s.posts30, videoPct: s.videoPct, postDates } })}::jsonb, true)
          WHERE id = ${m.id}`
        await pushProgress(m, { ig_followers: s.followers, ig_posts_30d: s.posts30 })
      }
    } catch (err) {
      console.error("weekly batch failed", i, err)
    }
  }
}

export const config: Config = { path: "/api/internal/weekly-run", background: true }
