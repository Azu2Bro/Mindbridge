import bcrypt from 'bcryptjs'
import { randomBytes, randomUUID } from 'node:crypto'

// Operator-supplied roster only. No emails are sent by provisioning.
export async function provisionAccounts(store) {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'tafhimul456@gmail.com'
  const modEmails = process.env.INITIAL_MODERATOR_EMAILS || process.env.INITIAL_MODERATOR_EMAIL || 'tafhimulazwad@gmail.com'
  const volEmails = process.env.INITIAL_VOLUNTEER_EMAILS || 'azwadtafhimul78@gmail.com'

  const roster = [
    ...String(volEmails).split(',').filter(Boolean).map((email) => ({ email, role: 'volunteer' })),
    ...(adminEmail ? [{ email: adminEmail, role: 'admin' }] : []),
    ...String(modEmails).split(',').filter(Boolean).map((email) => ({ email, role: 'moderator' })),
  ].map((entry) => ({ ...entry, email: entry.email.trim().toLowerCase() }))
  if (!roster.length) return
  if (roster.some(({ email }) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Invalid provisioning email address')
  await store.mutate(async (data) => {
    data.meta ||= {}
    data.meta.provisionedAccounts ||= []
    data.users ||= []
    for (const entry of roster) {
      const key = `${entry.role}:${entry.email}`
      let user = data.users.find((item) => item.email?.trim().toLowerCase() === entry.email)
      if (!user) {
        user = {
          id: `user-${randomUUID()}`, email: entry.email,
          passwordHash: await bcrypt.hash(randomBytes(48).toString('hex'), 12),
          displayName: entry.email.split('@')[0], anonymousName: `Peer${randomBytes(4).toString('hex')}`,
          status: 'active', emailVerified: ['admin', 'moderator'].includes(entry.role), accountSetupRequired: true,
          createdAt: new Date().toISOString(), avatarColor: '#93c5b1',
          bookmarks: [], postBookmarks: [], privacy: { showOnline: true, allowReminders: true },
        }
        data.users.push(user)
      }
      // Always enforce the provisioned role on the account
      user.role = entry.role
      if (['admin', 'moderator'].includes(entry.role)) {
        user.emailVerified = true
      }
      if (entry.role === 'volunteer') {
        user.availability ||= 'unavailable'
        user.expertise ||= ['Emotional support']
        user.livedExperience ||= []
        user.bio ||= ''
        user.yearsActive ||= 0
      }
      data.auditLogs ||= []
      if (!data.meta.provisionedAccounts.includes(key)) {
        data.auditLogs.push({ id: `audit-${randomUUID()}`, actorId: 'operator', action: 'account.provisioned', targetId: user.id, createdAt: new Date().toISOString() })
        data.meta.provisionedAccounts.push(key)
      }
    }
  })
}
