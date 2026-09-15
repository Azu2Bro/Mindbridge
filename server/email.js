import nodemailer from 'nodemailer'

function createTransporter() {
  if (!process.env.SMTP_HOST) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  })
}

// Hosts such as Render supply the public address as a bare hostname with no
// scheme. Pasting that straight into an email produces a link that no client
// will resolve, so normalise it here and drop any trailing slash.
function appBaseUrl() {
  const configured = (process.env.APP_URL || '').trim()
  if (!configured) return 'http://localhost:3001'
  const withScheme = /^https?:\/\//i.test(configured)
    ? configured
    : `${configured.startsWith('localhost') || configured.startsWith('127.0.0.1') ? 'http' : 'https'}://${configured}`
  return withScheme.replace(/\/+$/, '')
}

const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

export async function sendPasswordResetEmail({ to, displayName, token }) {
  const transporter = createTransporter()
  if (!transporter) return false
  const resetUrl = `${appBaseUrl()}/?reset=${encodeURIComponent(token)}`
  const safeName = escapeHtml(displayName)
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'MentalBridge <no-reply@mentalbridge.local>',
    to,
    subject: 'Reset your MentalBridge password',
    text: `Hello ${displayName},\n\nUse this link within 30 minutes to reset your MentalBridge password:\n${resetUrl}\n\nIf you did not request this, you can ignore this message.`,
    html: `<p>Hello ${safeName},</p><p>Use the link below within 30 minutes to reset your MentalBridge password:</p><p><a href="${resetUrl}">Reset my password</a></p><p>If you did not request this, you can ignore this message.</p>`,
  })
  return true
}

export async function sendVerificationEmail({ to, displayName, token }) {
  const transporter = createTransporter()
  if (!transporter) return false
  const verificationUrl = `${appBaseUrl()}/?verify=${encodeURIComponent(token)}`
  const safeName = escapeHtml(displayName)
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'MentalBridge <no-reply@mentalbridge.local>',
    to,
    subject: 'Verify your MentalBridge email',
    text: `Hello ${displayName},\n\nVerify your email within 24 hours to activate your MentalBridge account:\n${verificationUrl}\n\nIf you did not create this account, you can ignore this message.`,
    html: `<p>Hello ${safeName},</p><p>Verify your email within 24 hours to activate your MentalBridge account.</p><p><a href="${verificationUrl}">Verify my email</a></p><p>If you did not create this account, you can ignore this message.</p>`,
  })
  return true
}
