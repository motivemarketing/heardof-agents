import type { Config, Context } from "@netlify/functions"

// Mondays 8 AM Central (13:00 UTC during CDT, 7 AM CST in winter). Scheduled functions have a
// 30-second limit, so this only kicks off the background run.
export default async (_req: Request, context: Context) => {
  const base = context.site?.name ? `https://${context.site.name}.netlify.app` : Netlify.env.get("URL")
  const key = Netlify.env.get("HEARDOF_SERVER_KEY")
  if (!base || !key) return
  await fetch(`${base}/api/internal/weekly-run`, { method: "POST", headers: { "x-heardof-key": key } })
}

export const config: Config = { schedule: "0 13 * * 1" }
