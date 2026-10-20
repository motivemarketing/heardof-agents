import { env } from "./http.mts"
import type { Member } from "./db.mts"

// Outbound: login emails through Resend, progress updates to the GHL inbound webhook.

export async function sendLoginEmail(member: Member, link: string) {
  const from = Netlify.env.get("LOGIN_FROM_EMAIL") ?? "Heard Of <hello@marketwithmotive.com>"
  const first = member.first_name || "there"
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env("RESEND_API_KEY")}` },
    body: JSON.stringify({
      from,
      to: [member.email],
      subject: "Your Heard Of login link",
      text: `Hi ${first},\n\nHere's your link to the Heard Of app. It works once and expires in 72 hours.\n\n${link}\n\nIf you didn't ask for this, you can ignore it.\n\nThe Heard Of team`,
      html: `<p>Hi ${escapeHtml(first)},</p><p>Here's your link to the Heard Of app. It works once and expires in 72 hours.</p><p><a href="${link}" style="display:inline-block;background:#ff3d17;color:#0b0b0c;padding:12px 20px;border-radius:999px;font-weight:700;text-decoration:none">Open Heard Of</a></p><p style="color:#666;font-size:13px">If you didn't ask for this, you can ignore it.</p><p>The Heard Of team</p>`,
    }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

// Sends member progress to GHL so WF-08 (coaching booking) and WF-09 (90-day emails) can react.
export async function pushProgress(member: Member, progress: Record<string, unknown>) {
  const hook = Netlify.env.get("GHL_MEMBER_WEBHOOK_URL")
  if (!hook) return
  try {
    await fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_type: "member_progress", email: member.email, ghl_contact_id: member.ghl_contact_id ?? "", ...progress }),
    })
  } catch (err) {
    console.error("GHL progress push failed", err)
  }
}
