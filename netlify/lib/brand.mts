import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import type { IgProfile } from "./apify.mts"

// Drafts a Brand Anatomy from the agent's own Instagram bio and captions. The agent edits it.

export const BrandDraft = z.object({
  who: z.string(),
  where: z.string(),
  promise: z.string(),
  known: z.string(),
  p1: z.string(),
  p2: z.string(),
  p3: z.string(),
  voice: z.string(),
  look: z.string(),
  bios: z.array(z.string()).length(3),
})
export type BrandDraft = z.infer<typeof BrandDraft>

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["who", "where", "promise", "known", "p1", "p2", "p3", "voice", "look", "bios"],
  properties: {
    who: { type: "string", description: "Who they help most, plural noun phrase, e.g. 'first-time buyers'" },
    where: { type: "string", description: "The area they serve, as specific as the evidence allows" },
    promise: { type: "string", description: "What they help those people do, verb phrase, e.g. 'win without overpaying'" },
    known: { type: "string", description: "One sentence: the topic they could talk about for two hours" },
    p1: { type: "string", description: "Content pillar 1, 2-4 words" },
    p2: { type: "string", description: "Content pillar 2, 2-4 words" },
    p3: { type: "string", description: "Content pillar 3, 2-4 words" },
    voice: { type: "string", description: "Three adjectives for how they sound, comma separated" },
    look: { type: "string", description: "One sentence on their photo and video style" },
    bios: { type: "array", items: { type: "string" }, description: "Exactly three Instagram bios, each 150 characters or fewer, line breaks allowed, no hashtags" },
  },
}

const SYSTEM = `You are a brand strategist for real estate agents, working in the Heard Of Method (Clarity, Consistency, Patience, Feedback).
From an agent's public Instagram bio and recent captions, draft their Brand Anatomy: the lane they own, their message, three content pillars, their voice and look, and three bios.
Base every field on the evidence. Where the evidence is thin, make a sensible, specific suggestion for an agent in their market rather than a generic one.
Write plainly, in the agent's own voice where you can hear it. No hashtags, no emoji in bios except a single ↓ before a call to action.`

export async function draftBrand(profile: IgProfile, ctx: { name: string; city: string; region: string }): Promise<BrandDraft> {
  const client = new Anthropic()
  const captions = profile.posts
    .slice(0, 12)
    .map((p, i) => `${i + 1}. [${p.type}] ${p.caption.replace(/\s+/g, " ").slice(0, 600)}`)
    .join("\n")
  const user = `Agent: ${ctx.name || profile.fullName}
Market: ${ctx.city}${ctx.region ? `, ${ctx.region}` : ""}
Instagram: @${profile.handle} (${profile.followers} followers)
Current bio: ${profile.bio || "(empty)"}
Link in bio: ${profile.externalUrl || "(none)"}

Recent captions:
${captions || "(no recent posts)"}`

  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  })

  if (response.stop_reason === "refusal") throw new Error("The draft was declined. Fill in Brand Anatomy by hand.")
  const text = response.content.find((b) => b.type === "text")
  if (!text || text.type !== "text") throw new Error("No draft returned")
  const parsed = BrandDraft.safeParse(JSON.parse(text.text))
  if (!parsed.success) throw new Error("The draft came back in an unexpected shape")
  return { ...parsed.data, bios: parsed.data.bios.map((b) => b.slice(0, 150)) }
}
