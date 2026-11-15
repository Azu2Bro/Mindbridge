/**
 * One-time operator tool for setting account passwords directly in MongoDB.
 *
 * Required environment variables:
 *   ACCOUNT_SETUP_EMAILS=email1@example.com,email2@example.com
 *   ACCOUNT_SETUP_PASSWORD=<strong temporary password>
 *   ACCOUNT_SETUP_CONFIRM=SET_ACCOUNT_PASSWORDS
 *
 * Optional safeguards:
 *   ACCOUNT_SETUP_VERIFY_EMAILS=true   Marks the selected accounts verified.
 *   ACCOUNT_SETUP_ALLOW_REMOTE=true    Required for non-local MongoDB hosts.
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { MongoClient } from 'mongodb'

const password = process.env.ACCOUNT_SETUP_PASSWORD || ''
const emails = [...new Set(String(process.env.ACCOUNT_SETUP_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean))]
const verifyEmails = process.env.ACCOUNT_SETUP_VERIFY_EMAILS === 'true'
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
const dbName = process.env.MONGODB_DATABASE || 'mentalbridge'

function validateConfiguration() {
  if (process.env.ACCOUNT_SETUP_CONFIRM !== 'SET_ACCOUNT_PASSWORDS') {
    throw new Error('Set ACCOUNT_SETUP_CONFIRM=SET_ACCOUNT_PASSWORDS to confirm this one-time operation.')
  }
  if (!emails.length || emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error('ACCOUNT_SETUP_EMAILS must contain one or more valid comma-separated addresses.')
  }
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error('ACCOUNT_SETUP_PASSWORD must be at least 12 characters and include upper-case, lower-case, and numeric characters.')
  }
  const hostname = new URL(uri).hostname
  const localHostnames = new Set(['127.0.0.1', 'localhost', '::1'])
  if (!localHostnames.has(hostname) && process.env.ACCOUNT_SETUP_ALLOW_REMOTE !== 'true') {
    throw new Error('Refusing to update a remote database without ACCOUNT_SETUP_ALLOW_REMOTE=true.')
  }
}

async function main() {
  validateConfiguration()
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const collection = client.db(dbName).collection('application_state')
    const document = await collection.findOne({ _id: 'mentalbridge' })
    if (!document?.payload?.users) throw new Error('No MentalBridge application data was found in MongoDB.')

    const passwordHash = await bcrypt.hash(password, 12)
    const selected = document.payload.users.filter((user) => emails.includes(user.email?.toLowerCase()))
    const missing = emails.filter((email) => !selected.some((user) => user.email?.toLowerCase() === email))
    if (missing.length) throw new Error(`No account found for: ${missing.join(', ')}`)

    for (const user of selected) {
      user.passwordHash = passwordHash
      user.tokenVersion = (user.tokenVersion || 0) + 1
      delete user.accountSetupRequired
      if (verifyEmails) user.emailVerified = true
    }

    const result = await collection.replaceOne(
      { _id: 'mentalbridge', updatedAt: document.updatedAt },
      { _id: 'mentalbridge', payload: document.payload, updatedAt: new Date() },
    )
    if (result.modifiedCount !== 1) throw new Error('The database changed during the update. No passwords were replaced; run the command again.')
    console.log(`Updated ${selected.length} account password(s). The password was not printed.`)
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error('Password update failed:', error.message)
  process.exit(1)
})
