# LeadPilot AI

An autonomous demand generation platform that finds local service businesses, qualifies them, builds personalized demo websites, and runs multi-step cold email outreach. Three integrated systems, zero manual intervention.

## Systems

### LeadPilot (Automated Outreach Engine)

The core pipeline. Scrapes leads from multiple sources, scores their websites, generates custom demo sites with their real branding, and sends a timezone-aware 3-email drip sequence.

- **1,000+ websites analyzed**, 954 personalized demo sites generated
- **14 industries**, 80+ U.S. cities
- Multi-source ingestion: Apollo API, BBB directories, CSV imports (~450 raw leads per batch)
- Website scoring: mobile responsiveness, SSL, load time, chatbot detection (50+ widget signatures), 9 marketing signals
- Demo site generation: scrapes prospect branding (logo, colors, services) and builds multi-page responsive sites with 6 design variants
- Email delivery: timezone-aware sending (7:00-9:30 AM local), 4-week domain warmup ramp, CAN-SPAM compliance
- Engagement tracking: opens, demo clicks, repeat visits, chat widget submissions
- Automated follow-ups triggered by high-intent behavior

**Key files:**
- `scripts/openclaw-pipeline.js` - Main orchestrator
- `scripts/openclaw-scout.js` - Lead sourcing
- `scripts/openclaw-demo-builder.js` - Demo site generation
- `scripts/openclaw-outreach.js` - Email drip engine
- `scripts/variation-engine/` - 6 design family generators (craft, emergency, luxury, modern, regional, trust)
- `app/api/cron/outreach/route.ts` - Scheduled outreach dispatch
- `app/api/cron/closer/route.ts` - Follow-up automation

### LeadClaw (Autonomous Lead Qualification)

A daily cron-driven system that scrapes BBB directories, evaluates prospect websites in real time, and delivers call-ready qualified leads every morning.

- Runs Mon-Fri at 8:30 AM automatically
- Targets 4 high-ticket niches: HVAC, plumbing, roofing, electrical
- Scrapes across 40+ U.S. cities (Sun Belt + major metros)
- Fetches and evaluates each prospect's live website for design quality, mobile responsiveness, CTAs, trust signals, and booking flow
- Qualifies 90 leads/day with a minimum 4-issue threshold
- Emails a formatted report with call-ready prospect data every morning

**Key files:**
- `scripts/leadclaw-pipeline.js` - Daily orchestrator
- `scripts/leadclaw-source.js` - BBB directory scraper
- `scripts/leadclaw-qualify.js` - Website evaluation and qualification

### Latchly AI (Chat Widget)

An AI-powered chat widget that installs on any business website. Handles after-hours conversations, qualifies visitors, books appointments, and notifies owners via SMS and email.

- Embeds on prospect demo sites to capture high-intent leads
- Real-time lead capture with owner notifications
- Designed for service businesses losing leads outside operating hours

**Key files:**
- `components/chat/ChatWidget.tsx` - Widget component
- `app/api/lead-capture/route.ts` - Lead capture endpoint
- `app/api/demo-alert/route.js` - Owner notification system
- `app/api/demo-lead/route.js` - Lead processing

## Architecture

```
Lead Sources (Apollo, BBB, CSV)
        |
    Scrape & Deduplicate
        |
    Website Scoring (50+ signals)
        |
    Qualification (8+/10 threshold)
        |
   +----+----+
   |         |
LeadPilot   LeadClaw
   |         |
Demo Site   Daily Email
Generation  Report
   |
3-Email Drip
   |
Engagement Tracking
   |
Automated Follow-up
```

## Tech Stack

- **Framework:** Next.js
- **Database:** Neon (PostgreSQL)
- **Hosting:** Vercel
- **Email:** Resend, AgentMail
- **Scraping:** Chrome DevTools Protocol, BBB API
- **Lead Data:** Apollo API
- **Scheduling:** Vercel Cron, GitHub Actions

## Setup

```bash
npm install
cp .env.example .env  # Add your API keys
npm run dev
```

Required environment variables are listed in `.env.example`.
