import { OAuth2Client } from 'google-auth-library'

const googleClient = new OAuth2Client()

export function googleIdentityEnabled() {
  return Boolean(process.env.GOOGLE_CLIENT_ID)
}

export async function verifyGoogleCredential(credential, { client = googleClient, clientId = process.env.GOOGLE_CLIENT_ID } = {}) {
  if (!clientId) {
    const error = new Error('Google sign-in is not configured')
    error.status = 503
    throw error
  }
  if (typeof credential !== 'string' || credential.length < 100 || credential.length > 10000) {
    const error = new Error('Google sign-in credential is invalid')
    error.status = 400
    throw error
  }

  let payload
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId })
    payload = ticket.getPayload()
  } catch {
    const error = new Error('Google could not verify this sign-in. Please try again.')
    error.status = 401
    throw error
  }

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    const error = new Error('Google did not provide a verified email address')
    error.status = 401
    throw error
  }

  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: String(payload.name || payload.given_name || payload.email.split('@')[0]).trim().slice(0, 70),
  }
}
