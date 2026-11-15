/**
 * One-time script to set known passwords for provisioned staff accounts.
 * Usage:  node scripts/set-passwords.js
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { MongoClient } from 'mongodb'

const PASSWORD = 'Mindbridge123!'
const EMAILS = [
  'tafhimul456@gmail.com',
  'azwadtafhimul78@gmail.com',
  'tafhimulazwad@gmail.com',
]

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
const dbName = process.env.MONGODB_DATABASE || 'mentalbridge'

async function main() {
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const collection = client.db(dbName).collection('application_state')
    const doc = await collection.findOne({ _id: 'mentalbridge' })
    if (!doc?.payload?.users) {
      console.error('No data found in MongoDB. Make sure the server has been started at least once.')
      process.exit(1)
    }

    const hash = await bcrypt.hash(PASSWORD, 12)
    let updated = 0

    for (const email of EMAILS) {
      const user = doc.payload.users.find((u) => u.email === email)
      if (!user) {
        console.log(`⚠️  ${email} — not found in database, skipping`)
        continue
      }
      user.passwordHash = hash
      user.accountSetupRequired = false
      user.emailVerified = true
      updated++
      console.log(`✅ ${email} (${user.role}) — password set`)
    }

    if (updated > 0) {
      await collection.replaceOne(
        { _id: 'mentalbridge' },
        { _id: 'mentalbridge', payload: doc.payload, updatedAt: new Date() },
        { upsert: true },
      )
      console.log(`\n🎉 Done! ${updated} account(s) updated.`)
      console.log(`   Password for all accounts: ${PASSWORD}`)
      console.log(`   Login at: http://localhost:5173/staff`)
    } else {
      console.log('\n⚠️  No accounts were updated.')
    }
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
