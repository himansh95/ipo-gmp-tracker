# IPO GMP Monitor — Technical Design

## Overview

A fully automated system that scrapes live IPO GMP (Grey Market Premium) data from [investorgain.com](https://www.investorgain.com/report/live-ipo-gmp/331/ipo/), checks if any mainboard IPO's GMP exceeds **50%**, and sends a daily email alert **from the IPO's open date to its close date**.

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Runtime | **Node.js (TypeScript)** | Fast, async-friendly, great ecosystem |
| Web Scraping | **Cheerio + Axios** | Lightweight HTML parsing; Playwright if JS-rendered |
| Scheduler | **GitHub Actions** (`on: schedule`) | Free, hosted cron — no server needed |
| Email | **Nodemailer + Gmail SMTP** | Easy email delivery |
| Config / Secrets | **GitHub Actions Secrets** | Secure, no `.env` file needed |

> ✅ No Docker. No VPS. No database. GitHub Actions runs once per day on GitHub's servers — duplicate emails are structurally impossible.

---

## Architecture Diagram

```
  GitHub Actions (runs daily at 9 AM IST)
           │
           ▼
  ┌─────────────────┐
  │  ubuntu-latest  │  ← GitHub's free VM, spins up fresh each run
  │                 │
  │  1. npm install │
  │  2. Scraper     │──── GET investorgain.com ──▶ Parse HTML (Cheerio)
  │  3. GMP Checker │──── Filter: GMP > 50%
  │                 │        + today within open/close dates
  │  4. Mailer      │──── Send email via Gmail SMTP
  └─────────────────┘
           │
           ▼
    Job ends. VM destroyed.
    Next run: tomorrow 9 AM IST.
```

---

## Data Flow

```
1. GitHub Actions cron triggers at 9:00 AM IST (3:30 AM UTC) every day
        │
        ▼
2. Scraper fetches investorgain.com IPO GMP table
        │
        ▼
3. Parse each IPO row:
   - IPO Name
   - Open Date
   - Close Date
   - GMP (₹)
   - Issue Price (₹)
   - GMP % = (GMP / Issue Price) × 100
        │
        ▼
4. Filter IPOs where:
   - Today >= Open Date
   - Today <= Close Date
   - GMP% > 50
        │
        ▼
5. If any qualifying IPOs found → send ONE email with all of them
   If none → exit silently (no email)
        │
        ▼
6. Job finishes. GitHub destroys the VM.
```

> No deduplication logic needed — the job runs exactly once per day by design.

---

## Database Schema

> **Not required.** GitHub Actions runs once per day on a fresh VM — there is no persistent state to manage.

---

---

## Project Structure

```
chittorgarh-poc/
├── src/
│   ├── scraper.ts          # Fetches & parses IPO GMP table
│   ├── checker.ts          # Applies GMP > 50% filter + date range check
│   ├── mailer.ts           # Sends email via Nodemailer
│   └── index.ts            # Entry point (run once and exit)
├── .github/
│   └── workflows/
│       └── ipo-monitor.yml # GitHub Actions workflow (cron schedule)
├── package.json
├── tsconfig.json
└── TECHNICAL_DESIGN.md
```

> No `data/` folder, no `.env` file, no `Dockerfile`, no `docker-compose.yml`.

---

## Environment Variables (GitHub Actions Secrets)

Secrets are stored in **GitHub → Repo Settings → Secrets and variables → Actions**.  
They are injected as environment variables into the workflow at runtime.

```
SMTP_HOST      → smtp.gmail.com
SMTP_PORT      → 587
SMTP_USER      → your@gmail.com
SMTP_PASS      → your_gmail_app_password
ALERT_TO       → recipient@gmail.com
GMP_THRESHOLD  → 50
```

> No `.env` file needed. Secrets are never stored in the repository.

---

## Email Alert Format

**Subject:** `🚨 IPO GMP Alert — {N} IPOs above 50% GMP | {Date}`

**Body:**

```
Hi,

The following IPOs currently have GMP above 50%:

┌─────────────────────┬───────────┬──────────┬───────┬──────────┬────────────┐
│ IPO Name            │ Open Date │ Close    │ Price │ GMP (₹)  │ GMP %      │
├─────────────────────┼───────────┼──────────┼───────┼──────────┼────────────┤
│ Example Corp IPO    │ 14 May    │ 16 May   │ ₹200  │ ₹120     │ 60.0%  🔥  │
└─────────────────────┴───────────┴──────────┴───────┴──────────┴────────────┘

Source: https://www.investorgain.com/report/live-ipo-gmp/331/ipo/
Generated at: 2026-05-14 09:00 IST

Note: GMP is indicative only. Invest at your own risk.
```

---

## Scraping Strategy

The page at investorgain.com renders its table in HTML (not via a heavy JS framework). **Cheerio + Axios** is sufficient:

```
GET https://www.investorgain.com/report/live-ipo-gmp/331/ipo/
  └── Parse HTML with Cheerio
      └── Select table rows: table.table > tbody > tr
          └── Extract columns:
              [0] IPO Name
              [1] Open Date
              [2] Close Date
              [3] Issue Price
              [4] GMP (₹)
              [5] GMP %  ← or compute from [3] and [4]
```

> **Fallback:** If the site uses JavaScript rendering, swap Cheerio for **Playwright** (headless Chromium).

---

## GitHub Actions Workflow (`.github/workflows/ipo-monitor.yml`)

```yaml
name: IPO GMP Monitor

on:
  schedule:
    - cron: '30 3 * * *'   # 9:00 AM IST (UTC+5:30) = 03:30 UTC
  workflow_dispatch:         # Allow manual trigger for testing

jobs:
  check-gmp:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - run: npm run build

      - run: node dist/index.js
        env:
          SMTP_HOST: ${{ secrets.SMTP_HOST }}
          SMTP_PORT: ${{ secrets.SMTP_PORT }}
          SMTP_USER: ${{ secrets.SMTP_USER }}
          SMTP_PASS: ${{ secrets.SMTP_PASS }}
          ALERT_TO:  ${{ secrets.ALERT_TO }}
          GMP_THRESHOLD: ${{ secrets.GMP_THRESHOLD }}
```

> `workflow_dispatch` lets you manually trigger a run from GitHub UI to test without waiting for the cron.

---

## Docker Setup

> **Not required.** GitHub Actions provides the runtime environment.

---

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scheduler | GitHub Actions `on: schedule` | Free, hosted, no server management |
| No database | Stateless script | Job runs once/day on a fresh VM — duplicates impossible |
| No Docker | Not needed | GitHub Actions provides `ubuntu-latest` VM |
| No `.env` | GitHub Secrets | Secure secret injection at runtime |
| Scraper library | Cheerio + Axios | Lightweight; Playwright only if JS rendering needed |
| Email provider | Gmail SMTP (App Password) | Free, no credit card |
| Timezone | 03:30 UTC = 09:00 IST | GitHub cron runs in UTC |
| Manual trigger | `workflow_dispatch` | Test without waiting for cron |

---

## Implementation Steps

1. Create GitHub repo (public or private)
2. `npm init` + install dependencies
3. Build `scraper.ts` — fetch + parse GMP table
4. Build `checker.ts` — filter logic (GMP > 50%, date window)
5. Build `mailer.ts` — email template + Nodemailer send
6. Build `index.ts` — run once and exit (`process.exit(0)`)
7. Add `.github/workflows/ipo-monitor.yml`
8. Add secrets in GitHub → Repo Settings → Secrets
9. Push to GitHub — cron activates automatically
10. Test immediately via **Actions → Run workflow**

---

## Dependencies

```json
{
  "dependencies": {
    "axios": "^1.7.0",
    "cheerio": "^1.0.0",
    "nodemailer": "^6.9.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/nodemailer": "^6.4.0",
    "ts-node": "^10.0.0"
  }
}
```

> Only 3 runtime dependencies. No SQLite, no node-cron, no dotenv.

---

*Last updated: May 14, 2026*
