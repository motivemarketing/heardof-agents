import { getDatabase } from "@netlify/database"

export const db = () => getDatabase()

export interface Member {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string
  tier: "toolkit" | "coaching"
  ghl_contact_id: string | null
  start_date: string
  ig_handle: string | null
  business_name: string | null
  city: string | null
  region: string | null
  market_size: "small" | "mid" | "metro"
  place_id: string | null
  app_state: Record<string, unknown>
}

export async function memberById(id: string): Promise<Member | null> {
  const rows = await db().sql<Member>`SELECT * FROM members WHERE id = ${id}`
  return rows[0] ?? null
}

export async function memberByEmail(email: string): Promise<Member | null> {
  const rows = await db().sql<Member>`SELECT * FROM members WHERE email = ${email.toLowerCase()}`
  return rows[0] ?? null
}

export type JobKind = "audit" | "leaders"

export async function createJob(memberId: string, kind: JobKind): Promise<string> {
  const rows = await db().sql<{ id: string }>`
    INSERT INTO jobs (member_id, kind) VALUES (${memberId}, ${kind}) RETURNING id`
  return rows[0].id
}

export async function setJob(id: string, status: "running" | "done" | "error", result?: unknown, error?: string) {
  const done = status === "done" || status === "error"
  await db().sql`
    UPDATE jobs SET status = ${status},
      result = ${result === undefined ? null : JSON.stringify(result)}::jsonb,
      error = ${error ?? null},
      finished_at = ${done ? new Date().toISOString() : null}
    WHERE id = ${id}`
}

export async function latestJob(memberId: string, kind: JobKind) {
  const rows = await db().sql<{ id: string; status: string; result: unknown; error: string | null; created_at: string }>`
    SELECT id, status, result, error, created_at FROM jobs
    WHERE member_id = ${memberId} AND kind = ${kind}
    ORDER BY created_at DESC LIMIT 1`
  return rows[0] ?? null
}
