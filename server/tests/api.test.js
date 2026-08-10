import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, JsonStore } from '../index.js'

process.env.OPENAI_API_KEY = ''

async function startTestApi() {
  const directory = await mkdtemp(join(tmpdir(), 'mentalbridge-test-'))
  const store = new JsonStore(join(directory, 'database.json'))
  const app = await createApp({ store })
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const address = server.address()
  return { baseUrl: `http://127.0.0.1:${address.port}/api`, server, directory }
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

test('complete member and administration workflow', { timeout: 90000 }, async (context) => {
  const api = await startTestApi()
  context.after(async () => {
    await new Promise((resolve) => api.server.close(resolve))
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
  assert.ok(registration.data.token)
  const token = registration.data.token

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

  const adminLogin = await call(api.baseUrl, '/auth/login', { method: 'POST', body: { email: 'admin@mentalbridge.demo', password: 'Demo123!' } })
  assert.equal(adminLogin.response.status, 200)
  const stats = await call(api.baseUrl, '/admin/stats', { token: adminLogin.data.token })
  assert.equal(stats.response.status, 200)
  assert.ok(stats.data.stats.activeUsers >= 7)
  assert.equal(stats.data.stats.openReports, 1)
})

test('urgent language is held for moderator review and never auto-matched', { timeout: 90000 }, async (context) => {
  const api = await startTestApi()
  context.after(async () => {
    await new Promise((resolve) => api.server.close(resolve))
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
