import nodemailer from 'nodemailer';
import type { AlertIPO } from './checker';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
}

function buildHtmlTable(ipos: AlertIPO[]): string {
  const rows = ipos
    .map(
      (ipo) => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #ddd;">${ipo.name}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:center;">${formatDate(ipo.openDate)}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:center;">${formatDate(ipo.closeDate)}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;">₹${ipo.issuePrice}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;">₹${ipo.gmp}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;color:#16a34a;font-weight:bold;">${ipo.gmpPct.toFixed(1)}% 🔥</td>
      </tr>`
    )
    .join('');

  return `
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
      <thead>
        <tr style="background:#1e293b;color:#fff;">
          <th style="padding:10px 12px;text-align:left;">IPO Name</th>
          <th style="padding:10px 12px;">Open</th>
          <th style="padding:10px 12px;">Close</th>
          <th style="padding:10px 12px;">Issue Price</th>
          <th style="padding:10px 12px;">GMP (₹)</th>
          <th style="padding:10px 12px;">GMP %</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export async function sendAlertEmail(ipos: AlertIPO[]): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_TO } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !ALERT_TO) {
    throw new Error('Missing required email environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS, ALERT_TO)');
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT ?? '587'),
    secure: false, // STARTTLS
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });

  const subject = `🚨 IPO GMP Alert — ${ipos.length} IPO${ipos.length > 1 ? 's' : ''} above ${process.env['GMP_THRESHOLD'] ?? 50}% GMP | ${dateStr}`;

  const html = `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto;">
      <h2 style="color:#1e293b;">🚨 IPO GMP Alert</h2>
      <p>The following IPOs currently have GMP above <strong>${process.env['GMP_THRESHOLD'] ?? 50}%</strong>:</p>
      ${buildHtmlTable(ipos)}
      <br/>
      <p style="font-size:12px;color:#64748b;">
        Source: <a href="https://www.investorgain.com/report/live-ipo-gmp/331/ipo/">investorgain.com</a><br/>
        Generated at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST<br/>
        <em>GMP is indicative only. Invest at your own risk.</em>
      </p>
    </div>`;

  await transporter.sendMail({
    from: `"IPO Monitor" <${SMTP_USER}>`,
    to: ALERT_TO,
    subject,
    html,
  });

  console.log(`✅ Email sent to ${ALERT_TO} for ${ipos.length} IPO(s)`);
}
