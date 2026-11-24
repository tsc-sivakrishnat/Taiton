const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  if (!user || !pass) {
    console.warn('[MailHelper] Warning: SMTP_USER or SMTP_PASS is missing in environment variables.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  try {
    const transporter = createTransporter();
    const fromAddress = process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER || 'techtrole@gmail.com';

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0f172a; margin: 0;">Password Reset Request</h2>
          <p style="color: #64748b; font-size: 14px;">Taiton Enterprise CPanel</p>
        </div>
        <div style="background-color: #ffffff; padding: 24px; border-radius: 6px; border: 1px solid #cbd5e1;">
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hello,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">We received a request to reset the password for your account associated with <strong>${toEmail}</strong>.</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">If button does not work, copy and paste this link into your browser:<br/><a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a></p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">This reset link is valid for 1 hour. If you did not request a password reset, please ignore this email.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Taiton CPanel Security" <${fromAddress}>`,
      to: toEmail,
      subject: 'Reset Your Taiton CPanel Password',
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[MailHelper] Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('[MailHelper] Failed to send password reset email:', error);
    throw error;
  }
}

module.exports = {
  sendPasswordResetEmail,
};
