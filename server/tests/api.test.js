import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, JsonStore } from '../index.js'
import { createStaffAuthApp } from '../staff-auth-server.js'
import { provisionAccounts } from '../provision-accounts.js'

process.env.AI_PROVIDER = 'local'
process.env.ALLOW_DEMO_MATCHES = 'true'
process.env.OPENAI_API_KEY = ''
// Tests assert development-only verification tokens and must never send real email.
process.env.SMTP_HOST = ''
process.env.SMTP_USER = ''
process.env.SMTP_PASSWORD = ''

async function startTestApi({ googleVerifier } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'mentalbridge-test-'))
  const store = new JsonStore(join(directory, 'database.json'))
  const app = await createApp({ store, ...(googleVerifier ? { googleVerifier } : {}) })
  const staffApp = await createStaffAuthApp({ store })
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const staffServer = await new Promise((resolve) => {
    const instance = staffApp.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const address = server.address()
  const staffAddress = staffServer.address()
  return { baseUrl: `http://127.0.0.1:${address.port}/api`, staffBaseUrl: `http://127.0.0.1:${staffAddress.port}/api`, server, staffServer, directory, store }
}

async function call(baseUrl, path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  return { response, data }
}

test('signup accepts Bengali names, common punctuation, and a blank optional alias', async (context) => {
  const api = await startTestApi()
  context.after(async () => {
    await new Promise((resolve) => api.server.close(resolve))
    await new Promise((resolve) => api.staffServer.close(resolve))
    await rm(api.directory, { recursive: true, force: true })
  })

  const bengaliRegistration = await call(api.baseUrl, '/auth/register', {
    method: 'POST',
    body: { displayName: 'তাফহিমুল ইসলাম', anonymousName: 'নীরব নদী', email: 'bangla@example.com', password: 'StrongPass1' },
  })
  assert.equal(bengaliRegistration.response.status, 201)
  assert.equal(bengaliRegistration.data.user.anonymousName, 'নীরব নদী')

  const blankAliasRegistration = await call(api.baseUrl, '/auth/register', {
    method: 'POST',
    body: { displayName: "Nadia O'Neil", anonymousName: '   ', email: 'automatic@example.com', password: 'StrongPass1' },
  })
  assert.equal(blankAliasRegistration.response.status, 201)
  assert.match(blankAliasRegistration.data.user.anonymousName, /^GentleRiver\d{3}$/)

  const invalidAlias = await call(api.baseUrl, '/auth/register', {
    method: 'POST',
    body: { displayName: 'Private Member', anonymousName: 'email@example.com', email: 'invalid-alias@example.com', password: 'StrongPass1' },
  })
  assert.equal(invalidAlias.response.status, 400)
  assert.equal(invalidAlias.data.error, 'Anonymous name can contain letters, numbers, spaces, periods, apostrophes, underscores, and hyphens')
})

test('Google login creates members without granting access to staff accounts', async (context) => {
  const identities = {
    member: { sub: 'google-member-1', email: 'google.member@example.com', name: 'Google Member' },
    admin: { sub: 'google-admin-1', email: 'admin@mentalbridge.demo', name: 'Demo Admin' },
  }
  const api = await startTestApi({ googleVerifier: async (credential) => identities[credential] })
  context.after(async () => {
    await new Promise((resolve) => api.server.close(resolve))
    await new Promise((resolve) => api.staffServer.close(resolve))
    await rm(api.directory, { recursive: true, force: true })
  })

  const registration = await call(api.baseUrl, '/auth/google', { method: 'POST', body: { credential: 'member' } })
  assert.equal(registration.response.status, 201)
  assert.equal(registration.data.newAccount, true)
  assert.equal(registration.data.user.emailVerified, true)
  assert.equal(registration.data.user.role, 'user')
  assert.equal('googleSub' in registration.data.user, false)
  assert.ok(registration.data.token)

  const repeatLogin = await call(api.baseUrl, '/auth/google', { method: 'POST', body: { credential: 'member' } })
  assert.equal(repeatLogin.response.status, 200)
  assert.equal(repeatLogin.data.user.id, registration.data.user.id)

  const passwordAttempt = await call(api.baseUrl, '/auth/login', { method: 'POST', body: { email: 'google.member@example.com', password: 'Anything1' } })
  assert.equal(passwordAttempt.response.status, 401)

  const adminOnMemberPortal = await call(api.baseUrl, '/auth/google', { method: 'POST', body: { credential: 'admin' } })
  assert.equal(adminOnMemberPortal.response.status, 403)
  assert.equal(adminOnMemberPortal.data.staffPortal, true)

})

test('complete member and administration workflow', { timeout: 90000 }, async (context) => {
  const api = await startTestApi()
  context.after(async () => {
    await new Promise((resolve) => api.server.close(resolve))
    await new Promise((resolve) => api.staffServer.close(resolve))
    await rm(api.directory, { recursive: true, force: true })
  })

  const health = await call(api.baseUrl, '/health')
  assert.equal(health.response.status, 200)
  assert.equal(health.data.status, 'ok')

  const registration = await call(api.baseUrl, '/auth/register', {
    method: 'POST',
    body: { displayName: 'Taylor Reed', anonymousName: 'NewHarbor', email: 'taylor@example.com', password: 'StrongPass1' },
  })
  assert.equal(registration.response.status, 201)
  assert.equal(registration.data.user.role, 'user')
  assert.equal(registration.data.verificationRequired, true)
  assert.ok(registration.data.verificationToken)
  assert.equal('token' in registration.data, false)

  const blockedLogin = await call(api.baseUrl, '/auth/login', { method: 'POST', body: { email: 'taylor@example.com', password: 'StrongPass1' } })
  assert.equal(blockedLogin.response.status, 403)
  assert.equal(blockedLogin.data.verificationRequired, true)
  const verification = await call(api.baseUrl, '/auth/verify-email', { method: 'POST', body: { token: registration.data.verificationToken } })
  assert.equal(verification.response.status, 200)
  const firstLogin = await call(api.baseUrl, '/auth/login', { method: 'POST', body: { email: 'taylor@example.com', password: 'StrongPass1' } })
  assert.equal(firstLogin.response.status, 200)
  let token = firstLogin.data.token

  const me = await call(api.baseUrl, '/auth/me', { token })
  assert.equal(me.data.user.anonymousName, 'NewHarbor')
  assert.equal('passwordHash' in me.data.user, false)

  const forgot = await call(api.baseUrl, '/auth/forgot-password', { method: 'POST', body: { email: 'taylor@example.com' } })
  assert.equal(forgot.response.status, 200)
  assert.ok(forgot.data.resetToken)
  const reset = await call(api.baseUrl, '/auth/reset-password', { method: 'POST', body: { token: forgot.data.resetToken, password: 'NewStrong2' } })
  assert.equal(reset.response.status, 200)
  const relogin = await call(api.baseUrl, '/auth/login', { method: 'POST', body: { email: 'taylor@example.com', password: 'NewStrong2' } })
  assert.equal(relogin.response.status, 200)
  assert.equal((await call(api.baseUrl, '/auth/me', { token })).response.status, 401)
  token = relogin.data.token
  assert.equal((await call(api.baseUrl, '/auth/reset-password', { method: 'POST', body: { token: forgot.data.resetToken, password: 'AnotherPass3' } })).response.status, 400)

  const analysis = await call(api.baseUrl, '/ai/analyze', {
    token, method: 'POST', body: { text: 'Work has been overwhelming and my anxious thoughts will not slow down at night.' },
  })
  assert.equal(analysis.response.status, 200)
  assert.ok(analysis.data.analysis.tags.includes('Work stress'))
  assert.equal(analysis.data.analysis.riskLevel, 'standard')

  const volunteerResult = await call(api.baseUrl, `/volunteers?tags=${encodeURIComponent(analysis.data.analysis.tags.join(','))}`, { token })
  assert.equal(volunteerResult.response.status, 200)
  assert.ok(volunteerResult.data.volunteers.length >= 3)

  const support = await call(api.baseUrl, '/support-requests', {
    token,
    method: 'POST',
    body: {
      description: 'Work has been overwhelming and my anxious thoughts will not slow down at night.',
      summary: analysis.data.analysis.summary,
      tags: analysis.data.analysis.tags,
      priorities: analysis.data.analysis.priorities,
      volunteerId: volunteerResult.data.volunteers[0].id,
    },
  })
  assert.equal(support.response.status, 201)
  assert.equal(support.data.request.status, 'assigned')
  assert.ok(support.data.conversation.id)

  const volunteerLogin = await call(api.baseUrl, '/auth/login', { method: 'POST', body: { email: 'maya@mentalbridge.demo', password: 'Demo123!' } })
  const volunteerQueue = await call(api.baseUrl, '/support-requests', { token: volunteerLogin.data.token })
  const assignedRequest = volunteerQueue.data.requests.find((item) => item.id === support.data.request.id)
  assert.equal(assignedRequest.user.displayName, 'NewHarbor')
  assert.equal('email' in assignedRequest.user, false)

  const mood = await call(api.baseUrl, '/moods', { token, method: 'POST', body: { score: 4, journal: 'A walk helped today.' } })
  assert.equal(mood.response.status, 201)
  const moods = await call(api.baseUrl, '/moods', { token })
  assert.equal(moods.data.moods.length, 1)

  const post = await call(api.baseUrl, '/posts', { token, method: 'POST', body: { title: 'I took one small step today', category: 'Small wins' } })
  assert.equal(post.response.status, 201)
  assert.equal(post.data.post.author, 'NewHarbor')
  const reaction = await call(api.baseUrl, `/posts/${post.data.post.id}/reactions`, { token, method: 'POST', body: {} })
  assert.equal(reaction.data.post.likes, 1)
  assert.equal(reaction.data.post.liked, true)
  const comment = await call(api.baseUrl, `/posts/${post.data.post.id}/comments`, { token, method: 'POST', body: { text: 'Small steps really do count.' } })
  assert.equal(comment.response.status, 201)
  const postBookmark = await call(api.baseUrl, `/posts/${post.data.post.id}/bookmark`, { token, method: 'POST', body: {} })
  assert.deepEqual(postBookmark.data.postBookmarks, [post.data.post.id])
  const postUpdate = await call(api.baseUrl, `/posts/${post.data.post.id}`, { token, method: 'PUT', body: { title: 'I took two small steps today', body: 'I am noticing progress.' } })
  assert.equal(postUpdate.data.post.title, 'I took two small steps today')
  assert.equal(postUpdate.data.post.commentCount, 1)
  const report = await call(api.baseUrl, `/posts/${post.data.post.id}/report`, { token, method: 'POST', body: { reason: 'Testing the moderator workflow' } })
  assert.equal(report.response.status, 201)

  const resourceList = await call(api.baseUrl, '/resources', { token })
  assert.ok(resourceList.data.resources.length >= 6)
  const bookmark = await call(api.baseUrl, `/resources/${resourceList.data.resources[0].id}/bookmark`, { token, method: 'POST', body: {} })
  assert.equal(bookmark.data.bookmarks.length, 1)

  const conversationList = await call(api.baseUrl, '/conversations', { token })
  assert.equal(conversationList.data.conversations.length, 1)
  const message = await call(api.baseUrl, `/conversations/${conversationList.data.conversations[0].id}/messages`, { token, method: 'POST', body: { text: 'Hello, thank you for connecting with me.' } })
  assert.equal(message.response.status, 201)

  const accepted = await call(api.baseUrl, `/support-requests/${support.data.request.id}`, { token: volunteerLogin.data.token, method: 'PATCH', body: { status: 'in_progress' } })
  assert.equal(accepted.data.request.status, 'in_progress')
  const completed = await call(api.baseUrl, `/support-requests/${support.data.request.id}`, { token: volunteerLogin.data.token, method: 'PATCH', body: { status: 'completed' } })
  assert.equal(completed.data.request.status, 'completed')
  const feedback = await call(api.baseUrl, `/support-requests/${support.data.request.id}/feedback`, { token, method: 'POST', body: { rating: 5, comment: 'I felt heard.' } })
  assert.equal(feedback.data.request.feedback.rating, 5)

  const adminMemberPortal = await call(api.baseUrl, '/auth/login', { method: 'POST', body: { email: 'admin@mentalbridge.demo', password: 'Demo123!' } })
  assert.equal(adminMemberPortal.response.status, 403)
  assert.equal(adminMemberPortal.data.staffPortal, true)
  const memberOnStaffPortal = await call(api.staffBaseUrl, '/auth/staff/login', { method: 'POST', body: { email: 'alex@mentalbridge.demo', password: 'Demo123!' } })
  assert.equal(memberOnStaffPortal.response.status, 403)
  const adminLogin = await call(api.staffBaseUrl, '/auth/staff/login', { method: 'POST', body: { email: 'admin@mentalbridge.demo', password: 'Demo123!' } })
  assert.equal(adminLogin.response.status, 200)
  const forbiddenAdminSupport = await call(api.baseUrl, '/support-requests', { token: adminLogin.data.token, method: 'POST', body: { description: 'This administrator should never be able to submit a support request.' } })
  assert.equal(forbiddenAdminSupport.response.status, 403)
  const stats = await call(api.baseUrl, '/admin/stats', { token: adminLogin.data.token })
  assert.equal(stats.response.status, 200)
  assert.ok(stats.data.stats.activeUsers >= 7)
  assert.equal(stats.data.stats.openReports, 1)
  const users = await call(api.baseUrl, '/admin/users', { token: adminLogin.data.token })
  assert.equal(users.response.status, 200)
  assert.ok(users.data.users.some((item) => item.email === 'taylor@example.com'))
  const reportUpdate = await call(api.baseUrl, `/admin/reports/${report.data.report.id}`, { token: adminLogin.data.token, method: 'PATCH', body: { status: 'resolved' } })
  assert.equal(reportUpdate.data.report.status, 'resolved')

  const moderatorAssignment = await call(api.baseUrl, `/admin/users/${registration.data.user.id}`, { token: adminLogin.data.token, method: 'PATCH', body: { role: 'moderator' } })
  assert.equal(moderatorAssignment.data.user.role, 'moderator')
  const moderatorLogin = await call(api.staffBaseUrl, '/auth/staff/login', { method: 'POST', body: { email: 'taylor@example.com', password: 'NewStrong2' } })
  assert.equal(moderatorLogin.response.status, 200)
  const forbiddenModeratorPost = await call(api.baseUrl, '/posts', { token: moderatorLogin.data.token, method: 'POST', body: { title: 'Moderators cannot publish community stories' } })
  assert.equal(forbiddenModeratorPost.response.status, 403)

  const secondRegistration = await call(api.baseUrl, '/auth/register', { method: 'POST', body: { displayName: 'Casey Noor', anonymousName: 'WarmSky', email: 'casey@example.com', password: 'StrongPass1' } })
  await call(api.baseUrl, '/auth/verify-email', { method: 'POST', body: { token: secondRegistration.data.verificationToken } })
  const volunteerAssignment = await call(api.baseUrl, `/admin/users/${secondRegistration.data.user.id}`, { token: moderatorLogin.data.token, method: 'PATCH', body: { role: 'volunteer' } })
  assert.equal(volunteerAssignment.data.user.role, 'volunteer')

  const createdResource = await call(api.baseUrl, '/admin/resources', { token: moderatorLogin.data.token, method: 'POST', body: { title: 'A Bangladesh grounding guide', description: 'A short practical grounding guide for difficult moments.', content: 'Place both feet on the floor, breathe slowly, and name what you notice around you.', category: 'Anxiety', type: '3 min read', published: true } })
  assert.equal(createdResource.response.status, 201)
  const moderatorDelete = await call(api.baseUrl, `/admin/resources/${createdResource.data.resource.id}`, { token: moderatorLogin.data.token, method: 'DELETE' })
  assert.equal(moderatorDelete.response.status, 403)
  const adminDelete = await call(api.baseUrl, `/admin/resources/${createdResource.data.resource.id}`, { token: adminLogin.data.token, method: 'DELETE' })
  assert.equal(adminDelete.response.status, 200)
  const removedPost = await call(api.baseUrl, `/admin/posts/${post.data.post.id}`, { token: adminLogin.data.token, method: 'PATCH', body: { removed: true } })
  assert.equal(removedPost.data.post.removed, true)
})

test('urgent language is held for moderator review and never auto-matched', { timeout: 90000 }, async (context) => {
  const api = await startTestApi()
  context.after(async () => {
    await new Promise((resolve) => api.server.close(resolve))
    await new Promise((resolve) => api.staffServer.close(resolve))
    await rm(api.directory, { recursive: true, force: true })
  })
  const login = await call(api.baseUrl, '/auth/login', { method: 'POST', body: { email: 'alex@mentalbridge.demo', password: 'Demo123!' } })
  const token = login.data.token
  const urgent = await call(api.baseUrl, '/support-requests', {
    token, method: 'POST', body: {
      description: 'I have been thinking about suicide and do not want to live anymore.',
      summary: 'A harmless reviewed summary that attempts to bypass screening.',
      tags: ['Emotional support'],
      volunteerId: 'volunteer-maya',
    },
  })
  assert.equal(urgent.response.status, 201)
  assert.equal(urgent.data.request.status, 'moderator_review')
  assert.equal(urgent.data.request.volunteerId, null)
  assert.ok(urgent.data.analysis.crisisNotice)
})


test('provisioned account activation and pending support without demo volunteers', async (context) => {
  const api = await startTestApi()
  const prior = { INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL, INITIAL_VOLUNTEER_EMAILS: process.env.INITIAL_VOLUNTEER_EMAILS, ALLOW_DEMO_MATCHES: process.env.ALLOW_DEMO_MATCHES }
  context.after(async () => {
    for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
    await new Promise((resolve) => api.server.close(resolve))
    await new Promise((resolve) => api.staffServer.close(resolve))
    await rm(api.directory, { recursive: true, force: true })
  })
  process.env.INITIAL_ADMIN_EMAIL = 'setup-owner@example.com'
  process.env.INITIAL_VOLUNTEER_EMAILS = 'setup-peer@example.com'
  process.env.ALLOW_DEMO_MATCHES = 'false'
  await provisionAccounts(api.store)
  const forgot = await call(api.baseUrl, '/auth/forgot-password', { method: 'POST', body: { email: 'setup-owner@example.com' } })
  const reset = await call(api.baseUrl, '/auth/reset-password', { method: 'POST', body: { token: forgot.data.resetToken, password: 'SetupOwner123' } })
  assert.equal(reset.response.status, 200)
  const staff = await call(api.staffBaseUrl, '/auth/staff/login', { method: 'POST', body: { email: 'setup-owner@example.com', password: 'SetupOwner123' } })
  assert.equal(staff.response.status, 200)
  assert.equal(staff.data.user.role, 'admin')
  assert.equal(staff.data.user.emailVerified, true)
  const login = await call(api.baseUrl, '/auth/login', { method: 'POST', body: { email: 'alex@mentalbridge.demo', password: 'Demo123!' } })
  const token = login.data.token
  assert.deepEqual((await call(api.baseUrl, '/volunteers', { token })).data.volunteers, [])
  const pending = await call(api.baseUrl, '/support-requests', { token, method: 'POST', body: { description: 'I am having a difficult week with work deadlines.' } })
  assert.equal(pending.response.status, 201)
  assert.equal(pending.data.request.status, 'pending')
  assert.equal(pending.data.request.volunteerId, null)
  const stale = await call(api.baseUrl, '/support-requests', { token, method: 'POST', body: { description: 'I am having a difficult week with work deadlines.', volunteerId: 'volunteer-maya' } })
  assert.equal(stale.response.status, 409)
  const library = await call(api.baseUrl, '/resources', { token })
  assert.equal(library.data.resources.filter((item) => item.url?.startsWith('https://')).length, 3)
})
