import bcrypt from 'bcryptjs'
import { randomBytes, randomUUID } from 'node:crypto'

// Operator-supplied roster only. No emails are sent by provisioning.
export async function provisionAccounts(store) {
  const roster = [
    ...String(process.env.INITIAL_VOLUNTEER_EMAILS || '').split(',').filter(Boolean).map((email) => ({ email, role: 'volunteer' })),
    ...(process.env.INITIAL_ADMIN_EMAIL ? [{ email: process.env.INITIAL_ADMIN_EMAIL, role: 'admin' }] : []),
  ].map((entry) => ({ ...entry, email: entry.email.trim().toLowerCase() }))
  if (!roster.length) return
  if (roster.some(({ email }) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Invalid provisioning email address')
  await store.mutate(async (data) => {
    data.meta ||= {}
    data.meta.provisionedAccounts ||= []
    for (const entry of roster) {
      const key = `${entry.role}:${entry.email}`
      if (data.meta.provisionedAccounts.includes(key)) continue
      let user = data.users.find((item) => item.email === entry.email)
      if (!user) {
        user = {
          id: `user-${randomUUID()}`, email: entry.email,
          passwordHash: await bcrypt.hash(randomBytes(48).toString('hex'), 12),
          displayName: entry.email.split('@')[0], anonymousName: `Peer${randomBytes(4).toString('hex')}`,
          status: 'active', emailVerified: false, accountSetupRequired: true,
          createdAt: new Date().toISOString(), avatarColor: '#93c5b1',
          bookmarks: [], postBookmarks: [], privacy: { showOnline: true, allowReminders: true },
        }
        data.users.push(user)
      }
      user.role = entry.role
      if (entry.role === 'volunteer') {
        user.availability ||= 'unavailable'
        user.expertise ||= ['Emotional support']
        user.livedExperience ||= []
        user.bio ||= ''
        user.yearsActive ||= 0
      }
      data.auditLogs ||= []
      data.auditLogs.push({ id: `audit-${randomUUID()}`, actorId: 'operator', action: 'account.provisioned', targetId: user.id, createdAt: new Date().toISOString() })
      data.meta.provisionedAccounts.push(key)
    }
  })
}
