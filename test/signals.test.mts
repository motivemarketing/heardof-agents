import { test } from "node:test"
import assert from "node:assert/strict"
import { autoAnswers, computeSignals, linkType } from "../netlify/lib/signals.mts"
import { handlesFromHtml, rankCandidates } from "../netlify/lib/leaders.mts"
import type { IgProfile } from "../netlify/lib/apify.mts"

const now = new Date("2026-11-20T12:00:00Z")
const day = (n: number) => new Date(now.getTime() - n * 86400_000).toISOString()

const strong: IgProfile = {
  handle: "danasellsscottsdale", fullName: "Dana Rivera | Scottsdale Realtor",
  bio: "Helping first-time buyers in North Scottsdale win without overpaying ↓ free guide",
  externalUrl: "https://danarivera.com/scottsdale-buyer-guide", followers: 12400, postsCount: 800, isPrivate: false,
  posts: [
    { type: "Video", timestamp: day(1), caption: "3 things to do in Scottsdale this weekend", likes: 1, comments: 0, mentions: [] },
    { type: "Video", timestamp: day(3), caption: "Scottsdale market update: inventory is up", likes: 1, comments: 0, mentions: [] },
    { type: "Video", timestamp: day(5), caption: "Closing day! Congrats to the Lees on their keys", likes: 1, comments: 0, mentions: [] },
    { type: "Image", timestamp: day(8), caption: "Best coffee in Scottsdale", likes: 1, comments: 0, mentions: ["bunkercoffee"] },
    { type: "Video", timestamp: day(10), caption: "Interest rates explained", likes: 1, comments: 0, mentions: [] },
    { type: "Video", timestamp: day(12), caption: "Scottsdale neighborhood tour", likes: 1, comments: 0, mentions: [] },
    { type: "Video", timestamp: day(14), caption: "Client testimonial", likes: 1, comments: 0, mentions: [] },
    { type: "Sidecar", timestamp: day(17), caption: "Median prices in Scottsdale", likes: 1, comments: 0, mentions: [] },
    { type: "Video", timestamp: day(19), caption: "Local business: meet the owner", likes: 1, comments: 0, mentions: [] },
    { type: "Video", timestamp: day(21), caption: "Sold over asking in Scottsdale", likes: 1, comments: 0, mentions: [] },
    { type: "Video", timestamp: day(24), caption: "Market minute", likes: 1, comments: 0, mentions: [] },
    { type: "Video", timestamp: day(27), caption: "Welcome home!", likes: 1, comments: 0, mentions: [] },
  ],
}
const weak: IgProfile = {
  handle: "agentjoe", fullName: "Joe", bio: "Realtor. Real Broker.", externalUrl: "https://onereal.com/joe",
  followers: 320, postsCount: 40, isPrivate: false,
  posts: [{ type: "Image", timestamp: day(45), caption: "Just listed!", likes: 1, comments: 0, mentions: [] }],
}

test("strong local agent scores high on every observable answer", () => {
  const s = computeSignals(strong, { city: "Scottsdale", reviews: 186, rating: 4.9, now })
  assert.equal(s.posts30, 12)
  assert.equal(s.videoPct, 83)
  assert.equal(s.linkType, "guide")
  const a = autoAnswers(s)
  assert.deepEqual(a, { bio: 3, lane: 3, freq: 3, video: 3, area: 3, data: 3, biz: 2, reviews: 3, stories: 3, link: 3, followers: 3 })
})

test("quiet agent with a brokerage link scores low", () => {
  const s = computeSignals(weak, { city: "Scottsdale", reviews: 4, now })
  const a = autoAnswers(s)
  assert.equal(s.posts30, 0)
  assert.equal(a.freq, 0)
  assert.equal(a.link, 1)
  assert.equal(a.reviews, 0)
  assert.equal(a.followers, 0)
  assert.equal(a.bio, 1) // has a link, no niche, no place
})

test("link types", () => {
  assert.equal(linkType(""), "none")
  assert.equal(linkType("https://www.kw.com/agent/jane"), "brokerage")
  assert.equal(linkType("https://linktr.ee/jane"), "website")
  assert.equal(linkType("https://jane.com/home-value"), "guide")
})

test("finds agent handles on a website and skips brokerage accounts", () => {
  const html = `<a href="https://www.instagram.com/realbrokerage/">Real</a>
    <a href="https://instagram.com/janesellsaustin?igsh=1">IG</a> <a href="https://www.instagram.com/p/Cxyz/">post</a>`
  assert.deepEqual(handlesFromHtml(html), ["janesellsaustin"])
})

test("ranks candidates by reviews and drops the member and agents without websites", () => {
  const p = (id: string, name: string, reviews: number, website = "https://x.com") =>
    ({ id, name, reviews, rating: 5, website, address: "", mapsUrl: "", types: [] })
  const ranked = rankCandidates([p("1", "Dana Rivera", 300), p("2", "Ann", 50), p("3", "Bo", 200), p("4", "Cy", 900, "")], { placeId: "9", name: "Dana Rivera" })
  assert.deepEqual(ranked.map((r) => r.id), ["3", "2"])
})
