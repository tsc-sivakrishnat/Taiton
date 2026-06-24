import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transport;

function splitRecipients(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  return String(v)
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getTransport() {
  if (!env.mail.smtpHost || !env.mail.fromAddress) {
    return null;
  }
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.mail.smtpHost,
      port: env.mail.smtpPort,
      secure: env.mail.smtpSecure,
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000,
      auth:
        env.mail.smtpUser && env.mail.smtpPass
          ? { user: env.mail.smtpUser, pass: env.mail.smtpPass }
          : undefined,
    });
  }
  return transport;
}

export function isMailConfigured() {
  return Boolean(env.mail.resendApiKey || getTransport());
}

async function sendViaResend({ to, cc, bcc, subject, text, html }) {
  const toList = splitRecipients(to);
  if (!toList.length) {
    return { ok: false, skipped: true };
  }
  const body = {
    from: env.mail.fromAddress,
    to: toList,
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
  };
  const ccList = splitRecipients(cc);
  const bccList = splitRecipients(bcc);
  if (ccList.length) body.cc = ccList;
  if (bccList.length) body.bcc = bccList;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.mail.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = { raw };
  }
  if (!res.ok) {
    const err = new Error(parsed?.message || parsed?.error || raw || `Resend HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return { ok: true, messageId: parsed?.id };
}

export async function sendMail({ to, cc, bcc, subject, text, html }) {
  if (env.mail.resendApiKey) {
    if (!env.mail.fromAddress) {
      return { ok: false, skipped: true };
    }
    const info = await sendViaResend({ to, cc, bcc, subject, text, html });
    return info;
  }

  const t = getTransport();
  if (!t) {
    return { ok: false, skipped: true };
  }
  const info = await t.sendMail({
    from: env.mail.fromAddress,
    to,
    cc,
    bcc,
    subject,
    text: text ?? undefined,
    html: html ?? undefined,
  });
  return { ok: true, messageId: info.messageId };
}

export function getDevTeamInbox() {
  return env.mail.devTeamInbox;
}

export function getPublicAppUrl() {
  return env.mail.publicAppUrl || '';
}
