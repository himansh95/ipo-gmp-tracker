# 📈 IPO GMP Monitor

Automatically tracks live IPO Grey Market Premium (GMP) data and sends a daily email alert whenever a mainboard IPO's GMP crosses **50%** — from its open date to its close date.

Runs fully automatically on **GitHub Actions** — no server, no database, no manual effort.

---

## How It Works

```
Every day ~9:00 AM IST (GitHub Actions cron, or external workflow_dispatch trigger)
        │
        ▼
Scrape investorgain.com using headless Chromium (Playwright)
        │
        ▼
Filter IPOs where:
  • Today is between Open Date and Close Date
  • GMP% > 50%
        │
        ├── No matches → exit silently (no email)
        │
        └── Matches found → send HTML email via Gmail SMTP
```

---

## Tech Stack

| Layer | Tool |
|---|---|
| Scraping | [Playwright](https://playwright.dev/) (headless Chromium) |
| Language | TypeScript / Node.js |
| Scheduler | GitHub Actions `on: schedule` (cron) |
| Email | Nodemailer + Gmail SMTP (App Password) |
| Secrets | GitHub Actions Secrets & Variables |

> ✅ No Docker. No VPS. No database. Runs free on GitHub's servers.

---

## Project Structure

```
├── src/
│   ├── scraper.ts      # Playwright scraper for investorgain.com
│   ├── checker.ts      # Filters IPOs by GMP% threshold and date window
│   ├── mailer.ts       # Builds HTML email and sends via Gmail SMTP
│   └── index.ts        # Entry point — runs once and exits
├── .github/
│   └── workflows/
│       └── ipo-monitor.yml   # GitHub Actions workflow (daily cron)
├── .env.example        # Template for local development
└── TECHNICAL_DESIGN.md # Architecture and design decisions
```

---

## Configuration

### GitHub Variables (`Settings → Secrets and variables → Actions → Variables`)

| Variable | Example | Description |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | Gmail SMTP host |
| `SMTP_PORT` | `587` | SMTP port (STARTTLS) |
| `SMTP_USER` | `you@gmail.com` | Gmail address used to send |
| `ALERT_TO` | `a@gmail.com,b@gmail.com` | Recipient(s), comma-separated |
| `GMP_THRESHOLD` | `50` | Alert when GMP% exceeds this |

### GitHub Secrets (`Settings → Secrets and variables → Actions → Secrets`)

| Secret | Description |
|---|---|
| `SMTP_PASS` | Gmail [App Password](https://myaccount.google.com/apppasswords) (16 chars, not your main password) |

---

## Setup

### 1. Fork / clone this repo

```zsh
git clone https://github.com/himansh95/ipo-gmp-tracker.git
cd ipo-gmp-tracker
```

### 2. Set GitHub Variables via CLI

```zsh
gh variable set SMTP_HOST --body "smtp.gmail.com"
gh variable set SMTP_PORT --body "587"
gh variable set SMTP_USER --body "you@gmail.com"
gh variable set ALERT_TO  --body "recipient@gmail.com"
gh variable set GMP_THRESHOLD --body "50"
```

### 3. Set Gmail App Password as a Secret

```zsh
gh secret set SMTP_PASS
# Paste your 16-char App Password when prompted
```

> **How to get a Gmail App Password:**
> 1. Enable 2-Step Verification at [myaccount.google.com/security](https://myaccount.google.com/security)
> 2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
> 3. Create a new app password → copy the 16-character code

### 4. Push to GitHub — cron activates automatically

The workflow runs every day at approximately **9:10 AM IST**. No further setup needed.

> ⚠️ **GitHub's `schedule` trigger has no timing guarantee.** GitHub queues
> scheduled workflows with low priority and explicitly warns they "may be
> delayed during periods of high load" — in practice this repo has seen
> delays of several hours on a low-traffic repo. If you need the email by a
> specific time (e.g. to apply for an IPO same-day), see **Reliable
> scheduling** below.

---

## Reliable scheduling (optional, recommended)

If the built-in cron is too unpredictable, trigger the workflow externally
via its `workflow_dispatch` API instead of relying on `schedule`. API/manual
dispatches are queued with normal priority and start within seconds.

1. Create a GitHub [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
   scoped only to this repo, with **Actions: Read and write** permission.
2. Sign up for a free external cron service (e.g. [cron-job.org](https://cron-job.org)).
3. Create a daily job at **03:30 UTC** (9:00 AM IST) that sends:

   ```
   POST https://api.github.com/repos/<owner>/ipo-gmp-tracker/actions/workflows/ipo-monitor.yml/dispatches
   Headers:
     Authorization: Bearer <your fine-grained PAT>
     Accept: application/vnd.github+json
   Body:
     {"ref":"main"}
   ```

4. Keep the existing `schedule:` trigger in place as a free fallback in case
   the external cron service has an outage — worst case you get two emails
   on the same day instead of zero.

Never commit the PAT to the repo — store it only in the external cron
service's secret/header configuration.

---

## Testing Manually

Trigger a run immediately from the CLI:

```zsh
gh workflow run ipo-monitor.yml
```

Or from GitHub UI: **Actions → IPO GMP Monitor → Run workflow**

Watch the logs:

```zsh
gh run watch
```

---

## Local Development

```zsh
npm install
npx playwright install chromium

# Copy and fill in your credentials
cp .env.example .env

npm run build
node dist/index.js
```

---

## Email Sample

**Subject:** `🚨 IPO GMP Alert — 2 IPOs above 50% GMP | 18 May 2026`

| IPO Name | Open | Close | Issue Price | GMP (₹) | GMP % |
|---|---|---|---|---|---|
| Example Corp IPO | 16 May | 19 May | ₹200 | ₹120 | **60.0% 🔥** |
| Another IPO | 15 May | 18 May | ₹150 | ₹90 | **60.0% 🔥** |

> GMP is indicative only. Invest at your own risk.

---

## Data Source

[investorgain.com — Live IPO GMP](https://www.investorgain.com/report/live-ipo-gmp/331/ipo/)
