import { env } from './config/env.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(env.port, () => {
  console.log(`cpanel-be listening on port ${env.port}`);
  const { mail } = env;
  if (mail.resendApiKey && mail.fromAddress) {
    console.log('Mail: RESEND_API_KEY + MAIL_FROM (HTTPS — works on Render)');
  } else if (mail.smtpHost && mail.fromAddress) {
    console.log('Mail: SMTP_HOST + MAIL_FROM (may timeout on hosts that block SMTP)');
  } else {
    console.warn(
      'Mail: not configured — set RESEND_API_KEY + MAIL_FROM on Render, or SMTP_* + MAIL_FROM locally',
    );
  }
});
