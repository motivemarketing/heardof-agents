import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import type { Context } from "@netlify/functions"
import { db, memberById, type Member } from "./db.mts"
import { env } from "./http.mts"

// Sessions are a signed cookie holding the member id. Login links carry a one-time token
// whose hash is stored in login_tokens.

const COOKIE = "ho_session"
const SESSION_DAYS = 60
const LINK_HOURS = 72

const sign = (value: string) => createHmac("sha256", env("APP_SECRET")).update(value).digest("base64url")
const hash = (token: string) => createHash("sha256").update(token).digest("hex")

export async function createLoginToken(memberId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url")
  const expires = new Date(Date.now() + LINK_HOURS * 3600_000).toISOString()
  await db().sql`INSERT INTO login_tokens (token_hash, member_id, expires_at) VALUES (${hash(token)}, ${memberId}, ${expires})`
  return token
}

export async function redeemLoginToken(token: string): Promise<Member | null> {
  const rows = await db().sql<{ member_id: string }>`
    UPDATE login_tokens SET used_at = NOW()
    WHERE token_hash = ${hash(token)} AND used_at IS NULL AND expires_at > NOW()
    RETURNING member_id`
  return rows[0] ? memberById(rows[0].member_id) : null
}

export function startSession(context: Context, memberId: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400
  const payload = `${memberId}.${exp}`
  context.cookies.set({
    name: COOKIE,
    value: `${payload}.${sign(payload)}`,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    expires: new Date(exp * 1000),
  })
}

export function endSession(context: Context) {
  context.cookies.delete({ name: COOKIE, path: "/" })
}

export async function currentMember(context: Context): Promise<Member | null> {
  const raw = context.cookies.get(COOKIE)
  if (!raw) return null
  const parts = raw.split(".")
  if (parts.length !== 3) return null
  const [id, exp, sig] = parts
  const expected = Buffer.from(sign(`${id}.${exp}`))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  if (Number(exp) * 1000 < Date.now()) return null
  return memberById(id)
}

// Server-to-server calls (GHL webhooks, background jobs) send this shared key.
export function hasServerKey(req: Request, name = "HEARDOF_SERVER_KEY"): boolean {
  // Trimmed on both sides: a key pasted into Netlify or a terminal often picks up a stray space or newline.
  const given = (req.headers.get("x-heardof-key") ?? "").trim()
  const expected = env(name).trim()
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
