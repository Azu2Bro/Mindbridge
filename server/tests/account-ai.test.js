import test from 'node:test'
import assert from 'node:assert/strict'
import { appBaseUrl } from '../email.js'
import { analyzeSupportText, rankVolunteers } from '../ai.js'
import { provisionAccounts } from '../provision-accounts.js'
import { verifyGoogleCredential } from '../google-auth.js'

function setEnv(t, key, value) {
  const previous = process.env[key]
  process.env[key] = value
  t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous })
}

test('email URLs use trusted development origins and reject production localhost', (t) => {
  setEnv(t, 'NODE_ENV', 'development')
  setEnv(t, 'APP_URL', 'http://localhost:3001')
  setEnv(t, 'CLIENT_ORIGIN', 'http://localhost:5173')
  assert.equal(appBaseUrl('http://localhost:5173'), 'http://localhost:5173')
  assert.equal(appBaseUrl('https://attacker.example'), 'http://localhost:3001')
  process.env.NODE_ENV = 'production'
  assert.throws(() => appBaseUrl(), /public HTTPS/)
  process.env.APP_URL = 'mentalbridge.example/'
  assert.equal(appBaseUrl('https://attacker.example'), 'https://mentalbridge.example')
  process.env.APP_URL = ''
  setEnv(t, 'RENDER_EXTERNAL_URL', 'https://example.onrender.com')
  assert.equal(appBaseUrl(), 'https://example.onrender.com')
})

test('Google identity verification requires the configured audience and a verified email', async () => {
  let received
  const client = {
    async verifyIdToken(options) {
      received = options
      return { getPayload: () => ({ sub: 'google-123', email: 'Member@Example.com', email_verified: true, name: 'Test Member' }) }
    },
  }
  const credential = 'x'.repeat(200)
  const identity = await verifyGoogleCredential(credential, { client, clientId: 'web-client.apps.googleusercontent.com' })
  assert.deepEqual(received, { idToken: credential, audience: 'web-client.apps.googleusercontent.com' })
  assert.deepEqual(identity, { sub: 'google-123', email: 'member@example.com', name: 'Test Member' })

  const unverifiedClient = { verifyIdToken: async () => ({ getPayload: () => ({ sub: 'google-456', email: 'member@example.com', email_verified: false }) }) }
  await assert.rejects(() => verifyGoogleCredential(credential, { client: unverifiedClient, clientId: 'client-id' }), /verified email/)
})

test('self-hosted summaries drive matching; malformed AI output falls back locally', async (t) => {
  setEnv(t, 'AI_PROVIDER', 'ollama')
  setEnv(t, 'OLLAMA_URL', 'http://127.0.0.1:11434')
  let calls = 0
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++
    assert.equal(url, 'http://127.0.0.1:11434/api/chat')
    const request = JSON.parse(options.body)
    assert.equal(request.stream, false)
    assert.equal(request.format.type, 'object')
    return { ok: true, json: async () => ({ message: { content: JSON.stringify({ summary: 'Work deadlines feel overwhelming.', tags: ['Work stress'], priorities: ['Work stress'] }) } }) }
  })

  const result = await analyzeSupportText('Work deadlines are overwhelming this week.')
  assert.equal(result.provider, 'ollama')
  const volunteers = [
    { id: 'real', email: 'peer@example.com', displayName: 'Real Peer', role: 'volunteer', emailVerified: true, status: 'active', availability: 'available', expertise: ['Work stress'] },
    { id: 'other', email: 'other@example.com', displayName: 'Other Peer', role: 'volunteer', emailVerified: true, status: 'active', availability: 'available', expertise: ['Grief'] },
  ]
  assert.equal(rankVolunteers(result.tags, volunteers)[0].id, 'real')
  assert.equal(rankVolunteers(result.tags, [...volunteers, { ...volunteers[0], id: 'demo', email: 'maya@mentalbridge.demo' }, { ...volunteers[0], id: 'unverified', emailVerified: false }, { ...volunteers[0], id: 'offline', availability: 'unavailable' }]).length, 2)
  assert.equal(rankVolunteers(result.tags, [...volunteers, { ...volunteers[0], id: 'demo', email: 'maya@mentalbridge.demo' }], { includeDemo: true }).some((item) => item.id === 'demo'), true)
  await analyzeSupportText('I want to kill myself')
  assert.equal(calls, 1, 'Urgent text never reaches the model')
  fetchMock.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ message: { content: '{}' } }) }))
  const fallback = await analyzeSupportText('Work has been overwhelming this week.')
  assert.equal(fallback.provider, 'local')
  assert.ok(fallback.fallbackReason)

  process.env.AI_PROVIDER = 'llamacpp'
  setEnv(t, 'LLAMACPP_URL', 'http://127.0.0.1:8080')
  fetchMock.mock.mockImplementation(async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:8080/v1/chat/completions')
    const request = JSON.parse(options.body)
    assert.equal(request.stream, false)
    assert.equal(request.response_format.type, 'json_schema')
    assert.equal(request.response_format.schema.type, 'object')
    assert.match(request.messages[0].content, /Work stress/)
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '```json\n{"summary":"Work deadlines have been difficult this week.","tags":["Work stress"],"priorities":["Work stress"]}\n```' } }],
      }),
    }
  })
  const embedded = await analyzeSupportText('Work deadlines are overwhelming this week.')
  assert.equal(embedded.provider, 'llamacpp')
  assert.deepEqual(embedded.tags, ['Work stress'])
})

test('Hugging Face uses an open-source model through the router', async (t) => {
 setEnv(t, 'AI_PROVIDER', 'huggingface')
 setEnv(t, 'HF_API_TOKEN', 'hf_test_token')
 setEnv(t, 'HF_MODEL', 'Qwen/Qwen2.5-7B-Instruct')
 const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
   assert.equal(url, 'https://router.huggingface.co/v1/chat/completions')
   assert.equal(options.headers.Authorization, 'Bearer hf_test_token')
   const request = JSON.parse(options.body)
   assert.equal(request.model, 'Qwen/Qwen2.5-7B-Instruct')
   return {
     ok: true,
     json: async () => ({
       choices: [{ message: { content: '{"summary":"Work deadlines feel difficult this week.","tags":["Work stress"],"priorities":["Work stress"]}' } }],
     }),
   }
 })
 const result = await analyzeSupportText('Work deadlines are overwhelming this week.')
 assert.equal(result.provider, 'huggingface')
 assert.deepEqual(result.tags, ['Work stress'])
 fetchMock.mock.restore()
})

test('matching varies by support themes, priorities, availability, and capacity', () => {
  const base = { role: 'volunteer', emailVerified: true, status: 'active', rating: 4.8, yearsActive: 2, maxActiveCases: 3 }
  const volunteers = [
    { ...base, id: 'work', email: 'work@example.com', displayName: 'Work Peer', availability: 'available', expertise: ['Work stress', 'Anxious thoughts'] },
    { ...base, id: 'sleep', email: 'sleep@example.com', displayName: 'Sleep Peer', availability: 'limited', expertise: ['Sleep & energy', 'Work stress'] },
    { ...base, id: 'grief', email: 'grief@example.com', displayName: 'Grief Peer', availability: 'available', expertise: ['Grief', 'Low mood'] },
    { ...base, id: 'full', email: 'full@example.com', displayName: 'Full Peer', availability: 'available', expertise: ['Work stress', 'Anxious thoughts', 'Sleep & energy'], maxActiveCases: 1 },
  ]
  const activeAssignments = new Map([['work', 1], ['full', 1]])

  const workMatches = rankVolunteers(
    ['Work stress', 'Anxious thoughts', 'Sleep & energy'], volunteers,
    { priorities: ['Work stress', 'Anxious thoughts'], activeAssignments },
  )
  assert.equal(workMatches[0].id, 'work')
  assert.ok(workMatches[0].matchScore > workMatches.find((item) => item.id === 'grief').matchScore)
  assert.deepEqual(workMatches[0].matchedThemes, ['work stress', 'anxious thoughts'])
  assert.ok(workMatches[0].matchReasons.includes('Available today'))
  assert.equal(workMatches.some((item) => item.id === 'full'), false, 'Volunteers at capacity are not offered')

  const griefMatches = rankVolunteers(['Grief', 'Low mood'], volunteers, { priorities: ['Grief'] })
  assert.equal(griefMatches[0].id, 'grief')
})

test('provisioning preserves existing passwords and leaves new volunteers unverified and unavailable', async (t) => {
  setEnv(t, 'INITIAL_ADMIN_EMAIL', 'owner@example.com')
  setEnv(t, 'INITIAL_VOLUNTEER_EMAILS', 'peer@example.com')
  const data = { users: [{ id: 'owner', email: 'owner@example.com', passwordHash: 'existing', emailVerified: true }], auditLogs: [] }
  const store = { mutate: async (fn) => fn(data) }
  await provisionAccounts(store)
  await provisionAccounts(store)
  assert.equal(data.users.length, 2)
  assert.equal(data.users[0].role, 'admin')
  assert.equal(data.users[0].passwordHash, 'existing')
  const peer = data.users[1]
  assert.equal(peer.role, 'volunteer')
  assert.equal(peer.emailVerified, false)
  assert.equal(peer.accountSetupRequired, true)
  assert.equal(peer.availability, 'unavailable')
  assert.equal(data.auditLogs.length, 2)
})
