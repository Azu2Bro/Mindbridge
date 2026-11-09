import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { MongoStore } from './mongo-store.js'
import { store as defaultStore } from './store.js'
import { publicUser, signToken } from './auth.js'
import { verifyGoogleCredential } from './google-auth.js'

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const now = () => new Date().toISOString()
const id = (prefix) => `${prefix}-${randomUUID()}`
const emailSchema = z.string().trim().toLowerCase().email().max(160)
const credentialsSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) })
const staffRoles = ['moderator', 'admin']

function allowedOrigins() {
  const configured = process.env.CLIENT_ORIGIN?.split(',').map((item) => item.trim()).filter(Boolean)
  if (configured?.length) return configured.map((origin) => /^https?:\/\//.test(origin) ? origin : `https://${origin}`)
  if (process.env.NODE_ENV !== 'production') return ['http://localhost:5173', 'http://127.0.0.1:5173']
  return []
}

async function openStore(suppliedStore) {
  if (suppliedStore) {
    await suppliedStore.init()
    return { dataStore: suppliedStore, storageMode: 'test' }
  }
  if (process.env.MONGODB_URI) {
    const dataStore = new MongoStore(process.env.MONGODB_URI)
    await dataStore.init()
    return { dataStore, storageMode: 'mongodb' }
  }
  if (process.env.NODE_ENV === 'production') throw new Error('MONGODB_URI is required for the separate staff authentication service')
  await defaultStore.init()
  return { dataStore: defaultStore, storageMode: 'json-development-only' }
}

async function findUser(dataStore, email) {
  if (typeof dataStore.findUserByEmail === 'function') return dataStore.findUserByEmail(email)
  return dataStore.data.users.find((user) => user.email === email)
}

async function writeAuditLog(dataStore, entry) {
  if (typeof dataStore.appendAuditLog === 'function') return dataStore.appendAuditLog(entry)
  return dataStore.mutate((data) => data.auditLogs.push(entry))
}

export async function createStaffAuthApp({ store, googleVerifier = verifyGoogleCredential } = {}) {
  const { dataStore, storageMode } = await openStore(store)
  const app = express()
  app.locals.store = dataStore
  app.locals.storageMode = storageMode

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  const origins = allowedOrigins()
  if (origins.length) app.use(cors({ origin: origins, credentials: true }))
  app.use(express.json({ limit: '16kb' }))
  app.use('/api/auth/staff', rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many staff sign-in attempts. Try again in a few minutes.' } }))

  app.get('/api/staff/health', (req, res) => res.json({ status: 'ok', service: 'mentalbridge-staff-auth', storage: storageMode, timestamp: now() }))
  app.post('/api/auth/staff/login', asyncRoute(async (req, res) => {
    const body = credentialsSchema.parse(req.body)
    const user = await findUser(dataStore, body.email)
    if (!user || user.status !== 'active' || !user.passwordHash || !(await bcrypt.compare(body.password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect' })
    if (!user.emailVerified) return res.status(403).json({ error: 'Verify your email before signing in.', verificationRequired: true })
    if (!staffRoles.includes(user.role)) {
      await writeAuditLog(dataStore, { id: id('audit'), actorId: user.id, action: 'staff.login.denied', metadata: { role: user.role }, createdAt: now() })
      return res.status(403).json({ error: 'This account does not have moderator or administrator access.' })
    }
    await writeAuditLog(dataStore, { id: id('audit'), actorId: user.id, action: 'staff.login', metadata: { role: user.role }, createdAt: now() })
    res.json({ token: signToken(user), user: publicUser(user) })
  }))

  app.post('/api/auth/staff/google', asyncRoute(async (req, res) => {
    const identity = await googleVerifier(req.body?.credential)
    const user = await findUser(dataStore, identity.email)
    if (!user || user.status !== 'active' || !user.emailVerified) return res.status(403).json({ error: 'No active, verified staff account matches this Google email.' })
    if (!staffRoles.includes(user.role)) {
      await writeAuditLog(dataStore, { id: id('audit'), actorId: user.id, action: 'staff.google_login.denied', metadata: { role: user.role }, createdAt: now() })
      return res.status(403).json({ error: 'This account does not have moderator or administrator access.' })
    }
    await writeAuditLog(dataStore, { id: id('audit'), actorId: user.id, action: 'staff.google_login', metadata: { role: user.role }, createdAt: now() })
    res.json({ token: signToken(user), user: publicUser(user) })
  }))

  app.use((error, req, res, next) => {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message || 'Invalid request' })
    console.error(error)
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong on the staff authentication server' })
  })
  return app
}

export async function startStaffAuthServer({ store } = {}) {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET is required in production')
  const app = await createStaffAuthApp({ store })
  const port = Number(process.env.STAFF_AUTH_PORT || (process.env.NODE_ENV === 'production' ? process.env.PORT : 3002))
  const server = await new Promise((resolveListen) => {
    const instance = app.listen(port, '0.0.0.0', () => resolveListen(instance))
  })
  console.log(`MentalBridge staff authentication server — http://localhost:${port}`)
  return { app, server }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) startStaffAuthServer().catch((error) => { console.error(error); process.exitCode = 1 })
