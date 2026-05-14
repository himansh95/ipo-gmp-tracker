import { scrapeIPOGMP } from './scraper';
import { filterAlerts } from './checker';
import { sendAlertEmail } from './mailer';

async function main() {
  console.log(`🔍 [${new Date().toISOString()}] Starting IPO GMP check...`);

  const ipos = await scrapeIPOGMP();
  console.log(`📋 Scraped ${ipos.length} IPO(s) from investorgain.com`);

  if (ipos.length === 0) {
    console.log('⚠️  No IPOs found — the page structure may have changed.');
    process.exit(0);
  }

  const alerts = filterAlerts(ipos);
  console.log(`🎯 ${alerts.length} IPO(s) qualify (GMP > ${process.env['GMP_THRESHOLD'] ?? 50}% and within open/close window)`);

  if (alerts.length === 0) {
    console.log('✅ No alerts to send today.');
    process.exit(0);
  }

  alerts.forEach((ipo) => {
    console.log(`  → ${ipo.name}: ${ipo.gmpPct.toFixed(1)}% GMP`);
  });

  await sendAlertEmail(alerts);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
