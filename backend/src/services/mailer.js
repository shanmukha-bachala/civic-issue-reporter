const nodemailer = require('nodemailer');

function buildTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/**
 * Send an email via SMTP. Returns true on success, false on failure.
 * Does not log or expose secrets.
 */
async function sendMail(to, subject, text) {
  const transport = buildTransport();
  if (!transport) return false;
  const fromEmail = process.env.FROM_EMAIL || 'noreply@example.com';
  const fromName = process.env.FROM_NAME || 'Civic Issues Platform';
  try {
    await transport.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      text,
    });
    return true;
  } catch (e) {
    // Fail closed
    return false;
  }
}

module.exports = { sendMail };