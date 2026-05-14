import { type IPOData } from './scraper';

export type AlertIPO = IPOData;

export function filterAlerts(ipos: IPOData[]): AlertIPO[] {
  const threshold = parseFloat(process.env['GMP_THRESHOLD'] ?? '50');

  // Get today's date in IST (UTC+5:30), zeroed to midnight for date comparison
  const nowIST = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
  const today = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate());

  return ipos.filter((ipo) => {
    const open = new Date(ipo.openDate.getFullYear(), ipo.openDate.getMonth(), ipo.openDate.getDate());
    const close = new Date(ipo.closeDate.getFullYear(), ipo.closeDate.getMonth(), ipo.closeDate.getDate());

    const withinWindow = today >= open && today <= close;
    const aboveThreshold = ipo.gmpPct > threshold;

    return withinWindow && aboveThreshold;
  });
}
