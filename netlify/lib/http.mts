// Small helpers shared by every function.

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  })

export const fail = (status: number, error: string) => json({ ok: false, error }, status)

export async function readJson<T = Record<string, unknown>>(req: Request, maxBytes = 200_000): Promise<T | null> {
  const raw = await req.text()
  if (!raw || raw.length > maxBytes) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "")

export function env(name: string): string {
  const v = Netlify.env.get(name)
  if (!v) throw new Error(`Missing environment variable ${name}`)
  return v
}

export const cleanHandle = (h: string) =>
  h.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "").toLowerCase()

export const isHandle = (h: string) => /^[a-z0-9._]{1,30}$/.test(h)
