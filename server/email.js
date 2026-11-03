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
export function appBaseUrl(requestOrigin) {
  const configured = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || '').trim()
  const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((item) => item.trim())
  // Only use browser origins explicitly trusted by the deployment, never Host headers.
  if (process.env.NODE_ENV !== 'production' && requestOrigin && allowedOrigins.includes(requestOrigin) && (!configured || /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:|\/|$)/i.test(configured))) return new URL(requestOrigin).origin
  if (!configured) throw new Error('Set APP_URL to the reachable website address before sending account emails')
  const withScheme = /^https?:\/\//i.test(configured)
    ? configured
    : `${configured.startsWith('localhost') || configured.startsWith('127.0.0.1') ? 'http' : 'https'}://${configured}`
  const url = new URL(withScheme)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('APP_URL must be an HTTP(S) website address')
  if (process.env.NODE_ENV === 'production' && (url.protocol !== 'https:' || /^(localhost|127\..*|\[::1\]|0\.0\.0\.0)$/.test(url.hostname))) throw new Error('Production APP_URL must be a public HTTPS address, not localhost')
  return url.origin
}

const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

export async function sendPasswordResetEmail({ to, displayName, token, requestOrigin }) {
  const transporter = createTransporter()
  if (!transporter) return false
  const resetUrl = `${appBaseUrl(requestOrigin)}/?reset=${encodeURIComponent(token)}`
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

export async function sendVerificationEmail({ to, displayName, token, requestOrigin }) {
  const transporter = createTransporter()
  if (!transporter) return false
  const verificationUrl = `${appBaseUrl(requestOrigin)}/?verify=${encodeURIComponent(token)}`
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
