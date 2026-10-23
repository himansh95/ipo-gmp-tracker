import { chromium } from 'playwright';

export interface IPOData {
  name: string;
  openDate: Date;
  closeDate: Date;
  issuePrice: number;
  gmp: number;
  gmpPct: number;
}

// Parse "5-May" or "5-May-2026" → Date (assumes current year if year missing)
function parseDate(raw: string): Date {
  const cleaned = raw.trim().split('\n')[0].trim(); // take only first line e.g. "5-May"
  const currentYear = new Date().getFullYear();
  const withYear = cleaned.includes('-202') ? cleaned : `${cleaned}-${currentYear}`;
  const date = new Date(withYear.replace(/-/g, ' '));
  if (isNaN(date.getTime())) throw new Error(`Cannot parse date: "${raw}"`);
  return date;
}

// Extract number from strings like "₹4 (4.00%)" → 4, or "4.00%" → 4
function extractFirstNumber(raw: string): number {
  const match = raw.match(/([-\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

// Best-effort dismissal of cookie/ad/newsletter modals that can block the table.
// Non-fatal: if nothing matches, we just move on.
async function dismissModals(page: import('playwright').Page): Promise<void> {
  const closeSelectors = [
    '.modal.show .btn-close',
    '.modal.show [aria-label="Close"]',
    '.modal.show .close',
    '#ad-popup .close',
    '.popup-close',
    '.overlay .close',
  ];
  for (const selector of closeSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 1000 })) {
        await el.click({ timeout: 1000 });
      }
    } catch {
      // selector not present / not clickable — ignore
    }
  }
  // Fallback: Escape key closes most dismissible overlays.
  await page.keyboard.press('Escape').catch(() => undefined);
}

async function scrapeOnce(): Promise<IPOData[]> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 'networkidle' is unreliable on ad-heavy pages that never go fully idle,
    // so wait only for the DOM, then explicitly wait for the table we need.
    await page.goto('https://www.investorgain.com/report/live-ipo-gmp/331/ipo/', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    await dismissModals(page);

    await page.waitForSelector('#reportTable tbody tr', { timeout: 20000 });

    const rows = await page.evaluate(() => {
      const trs = document.querySelectorAll('#reportTable tbody tr');
      return Array.from(trs).map(tr => {
        const firstCell = tr.querySelector('td');
        return {
          cols: Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim()),
          // First badge in the name cell: "IPO" for mainboard, "BSE SME"/"NSE SME" for SME
          type: firstCell?.querySelector('.badge')?.textContent?.trim() ?? '',
          linkName: firstCell?.querySelector('a')?.textContent?.trim() ?? '',
        };
      });
    });

    const ipos: IPOData[] = [];

    for (const { cols, type, linkName } of rows) {
      if (cols.length < 9) continue;
      if (/sme/i.test(type)) continue;
      try {
        const name = linkName ? `${linkName} IPO` : (cols[0] ?? '').split('\n')[0].replace(/IPO.*/, 'IPO').trim();
        if (!name) continue;

        // Col 1: "₹4 (4.00%)\n3.50 ↓ / 5 ↑" → GMP = ₹4, GMP% = 4.00
        const gmpLine = (cols[1] ?? '').split('\n')[0]; // "₹4 (4.00%)"
        const gmp = extractFirstNumber(gmpLine.replace(/\(.*\)/, '').trim());
        const gmpPctMatch = gmpLine.match(/\(([-\d.]+)%\)/);
        const gmpPct = gmpPctMatch ? parseFloat(gmpPctMatch[1]) : 0;

        // Col 4: issue price e.g. "100" or "10,50,000"
        const issuePrice = parseFloat((cols[4] ?? '').replace(/[,\s₹]/g, '')) || 0;

        // Col 7: open date e.g. "5-May\nGMP: 4.5"
        const openDate = parseDate(cols[7] ?? '');

        // Col 8: close date e.g. "7-May\nGMP: 4.6"
        const closeDate = parseDate(cols[8] ?? '');

        ipos.push({ name, openDate, closeDate, issuePrice, gmp, gmpPct });
      } catch {
        // skip unparseable rows
      }
    }

    return ipos;
  } finally {
    await browser.close();
  }
}

// Transient timeouts (slow page, stuck modal) happen occasionally — retry once before giving up.
export async function scrapeIPOGMP(): Promise<IPOData[]> {
  try {
    return await scrapeOnce();
  } catch (err) {
    console.warn(`⚠️  Scrape attempt failed (${(err as Error).message}), retrying once...`);
    return await scrapeOnce();
  }
}
