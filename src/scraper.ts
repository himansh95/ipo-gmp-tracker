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

export async function scrapeIPOGMP(): Promise<IPOData[]> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.investorgain.com/report/live-ipo-gmp/331/ipo/', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.waitForSelector('#reportTable tbody tr', { timeout: 15000 });

    const rows = await page.evaluate(() => {
      const trs = document.querySelectorAll('#reportTable tbody tr');
      return Array.from(trs).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())
      );
    });

    const ipos: IPOData[] = [];

    for (const cols of rows) {
      if (cols.length < 9) continue;
      try {
        // Col 0: "Bagmane REIT IPO\nL@103.50 (3.5%)" → name is first line
        const name = (cols[0] ?? '').split('\n')[0].replace(/IPO.*/, 'IPO').trim();
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
