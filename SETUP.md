# Heard Of for Agents · agents.ryanleak.com

The Heard Of app for real estate agents. A Netlify site with Netlify Database (Postgres), Netlify Functions and Netlify Blobs. The front end is `public/index.html`, built from `rise-2026/src/app.html` by `rise-2026/build.py`.

## What's automatic

| Tool | Where the data comes from | What the agent still does |
|---|---|---|
| Heard Of Score | Instagram (Apify) + Google Business Profile (Places API) fill 11 of 15 answers, with the evidence shown under each | Answers 4 questions only they know: content planning, DM speed, sphere touches, boosting |
| Local Leader Report | Google Places finds the agents with the most reviews in their city, their websites give their Instagram, Apify reads those profiles, top 3 by visibility | Nothing; they can edit or swap anyone |
| Brand Anatomy | Claude drafts every field and three bios from their bio and last 12 captions | Edits and saves; Soul Tax and colors are theirs |
| City Content Plan | Google Places supplies real local spots for Wednesday posts; every Monday their Instagram is re-read and posts check themselves off (up to 3 per week) | Posts |
| Conversion Kit | Google review link and QR code come from their Google Business Profile | Nothing |
| Progress | Score, milestones, followers and posting go to GHL so coaching booking and check-in emails fire on real progress | Nothing |
| Profile | Photo upload (resized to 320px in the browser), name, market | Uploads a photo |

## One-time setup

1. **Create the site.** New Netlify project from `agents-app/`. Netlify reads `netlify.toml`.
2. **Database.** `@netlify/database` is a dependency, so Netlify provisions Postgres and applies `netlify/database/migrations/` on the first deploy (Credit-based plan required).
3. **Environment variables** (Site configuration → Environment variables, scope: Functions):

| Variable | What it is |
|---|---|
| `APP_SECRET` | Long random string; signs login sessions. `openssl rand -base64 48` |
| `HEARDOF_SERVER_KEY` | Long random string; GHL sends it as the `x-heardof-key` header, and background jobs use it |
| `APIFY_TOKEN` | Same Apify account the Social Media Scorecard uses |
| `GOOGLE_PLACES_KEY` | Google Cloud API key with **Places API (New)** enabled |
| `ANTHROPIC_API_KEY` | For the Brand Anatomy draft |
| `RESEND_API_KEY` | Sends login links (same Resend account as the Scorecard) |
| `LOGIN_FROM_EMAIL` | e.g. `Heard Of <hello@marketwithmotive.com>` (domain must be verified in Resend) |
| `APP_URL` | `https://agents.ryanleak.com` |
| `GHL_MEMBER_WEBHOOK_URL` | A GHL inbound webhook that receives `member_progress` events (WF-12 in the GHL spec) |

4. **Domain.** Add `agents.ryanleak.com` as a custom domain on this site, and add the CNAME at the DNS host for ryanleak.com.
5. **Deploy.** `npm install`, then `npx netlify deploy --build` for a preview and `--prod` for production.

## How people get in

GHL calls `POST /api/provision` when someone buys (WF-06) or adds coaching (WF-07b):

```http
POST https://agents.ryanleak.com/api/provision
x-heardof-key: <HEARDOF_SERVER_KEY>
content-type: application/json

{ "email": "...", "first_name": "...", "last_name": "...", "phone": "...", "tier": "Toolkit + Coaching",
  "ghl_contact_id": "{{contact.id}}", "instagram_handle": "{{contact.instagram_handle}}",
  "market_city": "{{contact.market_city}}", "market_state": "{{contact.market_state}}",
  "market_size": "{{contact.market_size}}", "start_date": "2026-11-02", "send_login": false }
```

The app creates the member and, unless `send_login` is `false`, emails a one-time login link that lasts 72 hours. Anyone can ask for a new link from the sign-in screen. Sessions last 60 days. A tier never downgrades.

## API

| Route | Who | Does |
|---|---|---|
| `POST /api/provision` | GHL | Create or upgrade a member, email a login link |
| `POST /api/auth/request` · `/verify` · `/logout` | Browser | Email-link sign-in |
| `GET /api/me` | Member | Profile, saved work, latest data pulls |
| `PUT /api/state` | Member | Save their own work (the `auto` data is server-owned) |
| `POST /api/connect` | Member | Save handle and market, start the Instagram + Google audit and the leader search |
| `POST /api/refresh` | Member | Re-run the audit or the leader search |
| `GET /api/job?id=` | Member | Background job status |
| `POST /api/brand-draft` | Member | Claude draft of Brand Anatomy |
| `GET /api/spots` | Member | Local spots for the Content Plan (cached per city for 30 days) |
| `POST /api/progress` | Member | Milestones → GHL |
| `/api/internal/*-run` | Server | Background jobs (15-minute limit) |
| `weekly-refresh` | Schedule | Mondays 13:00 UTC: re-reads every active member's Instagram |

## Costs to expect

- **Apify:** one profile run per audit, one run of up to 6 profiles per leader search, and one batched run per 25 members every Monday.
- **Google Places:** about 2 Text Search calls per audit, 1 per leader search, and 4 per new city (then cached).
- **Claude:** one Brand Anatomy draft per click (Opus, medium effort, at most about 4K tokens out).

## Before launch, verify against live accounts

These pieces are covered by unit tests and a browser test against a mocked API, not by live services:

1. **Apify field names** (`latestPosts`, `followersCount`, `externalUrl`). `netlify/lib/apify.mts` reads the known aliases; compare one real response with what the Social Media Scorecard's `/api/stats` receives.
2. **Places API (New) results for a real city.** Are the top-review results individual agents or brokerage offices? Tune `rankCandidates` in `netlify/lib/leaders.mts` if needed.
3. **Instagram handle discovery** on agent websites (`findHandleOnSite`). Expect it to find handles for most candidates, not all. When it can't, the app asks the agent to fill the gap.
4. **Resend:** sender domain verified, and one login link round trip.
5. `npm test` (scoring and leader logic) and `npm run typecheck` pass today.
