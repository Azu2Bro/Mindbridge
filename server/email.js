import nodemailer from 'nodemailer'

export async function sendPasswordResetEmail({ to, displayName, token }) {
  if (!process.env.SMTP_HOST) return false
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  })
  const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/?reset=${encodeURIComponent(token)}`
  const safeName = displayName.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'MentalBridge <no-reply@mentalbridge.local>',
    to,
    subject: 'Reset your MentalBridge password',
    text: `Hello ${displayName},\n\nUse this link within 30 minutes to reset your MentalBridge password:\n${resetUrl}\n\nIf you did not request this, you can ignore this message.`,
    html: `<p>Hello ${safeName},</p><p>Use the link below within 30 minutes to reset your MentalBridge password:</p><p><a href="${resetUrl}">Reset my password</a></p><p>If you did not request this, you can ignore this message.</p>`,
  })
  return true
}
