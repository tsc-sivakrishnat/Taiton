import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name, fallback = undefined) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 8787),
  db: {
    host: required('DB_HOST', '193.203.184.29'),
    port: Number(process.env.DB_PORT ?? 3306),
    user: required('DB_USER', 'u418448115_taiton'),
    password: process.env.DB_PASSWORD ?? 'SivaKrishna$00',
    database: required('DB_NAME', 'u418448115_enterprise_adm'),
    connectionLimit: Math.min(
      25,
      Math.max(1, Number(process.env.DB_CONNECTION_LIMIT ?? 5)),
    ),
    queueLimit: Number(process.env.DB_QUEUE_LIMIT ?? 0),
  },
  jwt: {
    secret: required('JWT_SECRET', 'dev-only-change-in-production'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  mail: {
    resendApiKey: (process.env.RESEND_API_KEY ?? '').trim(),
    smtpHost: ('smtp.gmail.com').trim(),
    smtpPort: Number(587),
    smtpSecure: process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true',
    smtpUser: ('techtrole@gmail.com').trim(),
    smtpPass: ('bcwjwognyigmsede').trim(),
    fromAddress: ('techtrole@gmail.com').trim(),
    devTeamInbox: ('techtrole@gmail.com').trim(),
    publicAppUrl: (process.env.APP_PUBLIC_URL ?? '').trim().replace(/\/$/, ''),
  },
};
