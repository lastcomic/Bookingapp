# John Heffron — Booking App (v1)

A private booking page John sends to comedy clubs and corporate buyers.
Buyers see open dates, get one official deal quote for their room, and either
request the dates or submit a structured offer. John approves everything from
his phone at `/office`. On acceptance, a clean deal sheet is emailed to
management, who papers the contract as usual. Offer stage only — no
contracts, no payments.

## Core principles

1. Buyers never see pricing floors, the engine, walkout potential,
   breakpoints, or any other buyer's activity. One quote, stated as fact.
2. Language is "deal memo," "terms," "the office," "request these dates."
   Never "price," "rate," "discount." No exclamation points.
3. Drive-radius pricing is framed as "Regional Routing — Qualified."
4. Held dates show only HELD — never where, who, or for how much.
5. Nothing is binding until John taps Accept.

All engine math runs server-side (`lib/engine.ts`); floors and formulas are
never shipped to the client. The API returns only the `PublicQuote` subset.

## Stack

- Next.js (App Router), deployed on Vercel
- Postgres (Vercel Postgres or Supabase) — schema auto-creates on first use
- Google Calendar API (read-only) for held dates
- Google Maps Distance Matrix for drive time from home base
- Resend for transactional email
- Single-password admin at `/office`

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in values. Only
   `DATABASE_URL` and `ADMIN_PASSWORD` are strictly required to run; the
   Google and Resend integrations degrade gracefully (no calendar → only
   app-accepted dates hold; no Maps key → fly terms; no Resend key → emails
   log to the console and verification codes surface in the UI outside
   production).
3. `npm run dev`

## Deploying to Vercel

1. Push this repo and import it in Vercel.
2. Add the environment variables from `.env.example` in the project settings.
3. Attach a Vercel Postgres database (its `POSTGRES_URL` is picked up
   automatically) or point `DATABASE_URL` at Supabase.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Buyer booking page — calendar, room form, live deal memo |
| `/corporate` | Plain contact form for corporate & private events |
| `/office` | John's admin — inbox, engine settings, past-venue list |

## Engine defaults (all editable in `/office`)

Home base Detroit, MI · drive radius 3.0 h (2.0 h Nov–Mar) · drive floor
$3,000 for a 4-show weekend (scaled down modestly for fewer shows) · fly
floor $3,500 plus $500 air/ground buyout · guarantee target 18% of gross
potential, sanity-capped at 35%, never below the floor, rounded to $250 ·
door split 65% · sellout bonus $250 per show · 20% first-time deposit due
72 hours after contract · 100-seat minimum · offers under 70% of the engine
quote auto-decline (toggleable; logged, never shown to John).

Engine config and branding are stored per artist (`artist_id`) so a
multi-comedian version is possible later without a rewrite.
