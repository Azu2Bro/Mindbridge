import 'dotenv/config'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { resolve, sep } from 'node:path'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { Server as SocketServer } from 'socket.io'
import { z } from 'zod'
import { JsonStore, store as defaultStore } from './store.js'
import { MongoStore } from './mongo-store.js'
import { allowRoles, authRequired, publicUser, signToken, verifyToken } from './auth.js'
import { analyzeSupportText, localAnalysis, rankVolunteers } from './ai.js'
import { provisionAccounts } from './provision-accounts.js'
import { publishedResources } from './resources.js'
import { createDemoMatchingVolunteers } from './seed.js'
import { appBaseUrl, sendPasswordResetEmail, sendVerificationEmail } from './email.js'
import { googleIdentityEnabled, verifyGoogleCredential } from './google-auth.js'

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const id = (prefix) => `${prefix}-${randomUUID()}`
const now = () => new Date().toISOString()
const asTimeAgo = (date) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`
  return `${Math.floor(hours / 24)} day${hours < 48 ? '' : 's'} ago`
}

const emailSchema = z.string().trim().toLowerCase().email().max(160)
const passwordSchema = z.string().min(8).max(128).regex(/[A-Z]/, 'Password needs an uppercase letter').regex(/[0-9]/, 'Password needs a number')
const supportTextSchema = z.string().trim().min(20).max(2000)
const anonymousNameSchema = z.string().trim().min(3, 'Anonymous name needs at least 3 characters').max(40, 'Anonymous name must be 40 characters or fewer').regex(
  /^[\p{L}\p{M}\p{N}_ .'’-]+$/u,
  'Anonymous name can contain letters, numbers, spaces, periods, apostrophes, underscores, and hyphens',
)
const optionalAnonymousNameSchema = z.preprocess(
  (value) => typeof value === 'string' && !value.trim() ? undefined : value,
  anonymousNameSchema.optional(),
)

function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success) {
    const error = new Error(result.error.issues[0]?.message || 'Invalid input')
    error.status = 400
    throw error
  }
  return result.data
}

function volunteerProfile(user, matchScore) {
  const safe = publicUser(user)
  delete safe.email
  delete safe.privacy
  delete safe.bookmarks
  delete safe.postBookmarks
  return { ...safe, matchScore }
}

function peerVisibleProfile(user, viewerId) {
  if (!user) return null
  if (user.id === viewerId) return publicUser(user)
  if (user.role === 'user') return { id: user.id, displayName: user.anonymousName, anonymousName: user.anonymousName, role: 'user', avatarColor: user.avatarColor }
  return volunteerProfile(user)
}

function formatPost(post, userId, postBookmarks = []) {
  return {
    ...post,
    time: asTimeAgo(post.createdAt),
    likes: (post.reactions || []).length,
    liked: (post.reactions || []).includes(userId),
    bookmarked: postBookmarks.includes(post.id),
    comments: (post.comments || []).filter((comment) => !comment.removed),
    commentCount: (post.comments || []).filter((comment) => !comment.removed).length,
    reactions: undefined,
  }
}

async function normalizeDataStore(dataStore) {
  const demoMode = process.env.NODE_ENV !== 'production'
  const existingDemoHash = dataStore.data?.users?.find((user) => user.email?.endsWith('@mentalbridge.demo'))?.passwordHash
  const demoVolunteers = demoMode ? createDemoMatchingVolunteers(existingDemoHash || await bcrypt.hash('Demo123!', 12)) : []
  await dataStore.mutate((data) => {
    data.passwordResets ||= []
    data.emailVerifications ||= []
    data.reports ||= []
    data.auditLogs ||= []
    data.notifications ||= []
    data.conversations ||= []
    data.supportRequests ||= []
    data.moods ||= []
    data.posts ||= []
    data.resources ||= []
    data.meta ||= {}
    if (!data.meta.publisherResourcesAdded) {
      for (const resource of publishedResources) if (!data.resources.some((item) => item.id === resource.id)) data.resources.push({ ...resource })
      data.meta.publisherResourcesAdded = true
    }
    data.users ||= []
    if (demoMode && data.meta.demoMatchingVersion !== 2) {
      for (const template of demoVolunteers) {
        const existing = data.users.find((user) => user.id === template.id || user.email === template.email)
        if (!existing) data.users.push(template)
        else for (const field of ['expertise', 'livedExperience', 'communicationStyle', 'languages', 'maxActiveCases', 'rating', 'yearsActive', 'bio', 'avatarColor']) existing[field] ??= template[field]
      }
      data.meta.demoMatchingVersion = 2
    }
    data.users.forEach((user) => {
      user.bookmarks ||= []
      user.postBookmarks ||= []
      user.privacy ||= { showOnline: true, allowReminders: true }
      // Accounts created before email verification was introduced remain usable.
      user.emailVerified ??= true
    })
    data.posts.forEach((post) => {
      post.reactions ||= []
      post.comments ||= []
      post.locked ??= false
      post.pinned ??= false
      post.removed ??= false
    })
    return true
  })
}

function includeDemoMatches() {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_MATCHES !== 'false'
}

function activeVolunteerAssignments(requests = []) {
  const counts = new Map()
  for (const request of requests) {
    if (!request.volunteerId || !['assigned', 'in_progress'].includes(request.status)) continue
    counts.set(request.volunteerId, (counts.get(request.volunteerId) || 0) + 1)
  }
  return counts
}

export async function createApp({ store: suppliedStore, googleVerifier = verifyGoogleCredential } = {}) {
  let dataStore = suppliedStore
  let storageMode = suppliedStore ? 'test' : 'json'
  if (!dataStore && process.env.MONGODB_URI) {
    try {
      dataStore = new MongoStore(process.env.MONGODB_URI)
      await dataStore.init()
      storageMode = 'mongodb'
    } catch (error) {
      if (process.env.NODE_ENV === 'production') throw error
      console.warn(`MongoDB is unavailable; using the local JSON store: ${error.message}`)
      dataStore = defaultStore
      storageMode = 'json-fallback'
    }
  }
  dataStore ||= defaultStore
  await dataStore.init()
  await normalizeDataStore(dataStore)
  if (!suppliedStore) await provisionAccounts(dataStore)
  if (process.env.NODE_ENV === 'production') appBaseUrl()
  const app = express()
  const staffAuthOrigin = process.env.STAFF_AUTH_URL
    ? (/^https?:\/\//.test(process.env.STAFF_AUTH_URL) ? process.env.STAFF_AUTH_URL : `https://${process.env.STAFF_AUTH_URL}`).replace(/\/$/, '')
    : null
  app.locals.store = dataStore
  app.locals.storageMode = storageMode

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    // Helmet's default policy adds upgrade-insecure-requests, which breaks the plain-http
    // LAN URL used to demo this on a phone, so the directives are spelled out instead.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com/gsi/style'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:', staffAuthOrigin, 'https://accounts.google.com/gsi/'].filter(Boolean),
        frameSrc: ['https://accounts.google.com/gsi/'],
        manifestSrc: ["'self'"],
        formAction: ["'self'"],
      },
    },
  }))
  const configuredOrigins = process.env.CLIENT_ORIGIN?.split(',').map((item) => item.trim()).filter(Boolean)
  if (configuredOrigins?.length) app.use(cors({ origin: configuredOrigins, credentials: true }))
  else if (process.env.NODE_ENV !== 'production') app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }))
  app.use(express.json({ limit: '512kb' }))
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 80, standardHeaders: true, legacyHeaders: false }))

  app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'mentalbridge-api', storage: app.locals.storageMode, ai: process.env.AI_PROVIDER || 'ollama', timestamp: now() }))
  app.get('/api/auth/google/config', (req, res) => res.json({ enabled: googleIdentityEnabled(), clientId: process.env.GOOGLE_CLIENT_ID || null }))

  app.post('/api/auth/register', asyncRoute(async (req, res) => {
    const body = parse(z.object({
      displayName: z.string().trim().min(2).max(70),
      anonymousName: optionalAnonymousNameSchema,
      email: emailSchema,
      password: passwordSchema,
      avatarUrl: z.string().regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/).max(450000).optional(),
    }), req.body)
    if (dataStore.data.users.some((user) => user.email === body.email)) return res.status(409).json({ error: 'An account with this email already exists' })
    const user = {
      id: id('user'), email: body.email, passwordHash: await bcrypt.hash(body.password, 12), displayName: body.displayName,
      anonymousName: body.anonymousName || `GentleRiver${Math.floor(Math.random() * 900 + 100)}`,
      role: 'user', status: 'active', privacy: { showOnline: true, allowReminders: true }, bookmarks: [],
      emailVerified: false, createdAt: now(), avatarColor: '#e5aa82', avatarUrl: body.avatarUrl,
    }
    const verificationToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(verificationToken).digest('hex')
    await dataStore.mutate((data) => {
      data.users.push(user)
      data.emailVerifications.push({ id: id('verify'), userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60000).toISOString(), createdAt: now() })
      data.auditLogs.push({ id: id('audit'), actorId: user.id, action: 'account.registered', createdAt: now() })
      return user
    })
    const emailSent = await sendVerificationEmail({ to: user.email, displayName: user.displayName, token: verificationToken, requestOrigin: req.get('origin') }).catch((error) => { console.error('Verification email failed:', error.message); return false })
    res.status(201).json({
      user: publicUser(user), verificationRequired: true, emailSent,
      message: emailSent
        ? 'Check your email and follow the verification link before signing in.'
        : process.env.NODE_ENV === 'production'
          ? 'Account created, but the verification email could not be delivered. Check the address and request a new link.'
          : 'Account created. Email delivery is not configured in this development environment.',
      ...(process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST && !emailSent ? { verificationToken } : {}),
    })
  }))

  const credentialsSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) })
  const staffRoles = ['moderator', 'admin']

  // Shared credential check. Each portal decides separately which roles it will admit.
  async function authenticate(req, res) {
    const body = parse(credentialsSchema, req.body)
    const user = dataStore.data.users.find((item) => item.email === body.email)
    if (!user || user.status !== 'active' || !user.passwordHash || !(await bcrypt.compare(body.password, user.passwordHash))) {
      res.status(401).json({ error: 'Email or password is incorrect' })
      return null
    }
    if (!user.emailVerified) {
      res.status(403).json({ error: 'Verify your email before signing in.', verificationRequired: true })
      return null
    }
    return user
  }

  // Member portal: members and volunteers only. Staff accounts are pushed to their own portal.
  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const user = await authenticate(req, res)
    if (!user) return
    if (staffRoles.includes(user.role)) return res.status(403).json({ error: 'This is a staff account. Sign in from the staff portal at /staff.', staffPortal: true })
    res.json({ token: signToken(user), user: publicUser(user) })
  }))

  app.post('/api/auth/google', asyncRoute(async (req, res) => {
    const identity = await googleVerifier(req.body?.credential)
    const result = await dataStore.mutate((data) => {
      let user = data.users.find((item) => item.googleSub === identity.sub)
      const emailUser = data.users.find((item) => item.email === identity.email)
      if (user && emailUser && user.id !== emailUser.id) {
        const error = new Error('This Google account conflicts with an existing account email')
        error.status = 409
        throw error
      }
      user ||= emailUser
      let created = false

      if (user) {
        if (user.status !== 'active') {
          const error = new Error('This account is unavailable')
          error.status = 403
          throw error
        }
        if (staffRoles.includes(user.role)) {
          const error = new Error('This is a staff account. Sign in from the staff portal at /staff.')
          error.status = 403
          error.staffPortal = true
          throw error
        }
        if (user.googleSub && user.googleSub !== identity.sub) {
          const error = new Error('This email is linked to a different Google account')
          error.status = 409
          throw error
        }
      } else {
        user = {
          id: id('user'), email: identity.email, displayName: identity.name.length >= 2 ? identity.name : 'Google Member',
          anonymousName: `GentleRiver${Math.floor(Math.random() * 900 + 100)}`,
          role: 'user', status: 'active', privacy: { showOnline: true, allowReminders: true }, bookmarks: [], postBookmarks: [],
          emailVerified: true, createdAt: now(), avatarColor: '#e5aa82',
        }
        data.users.push(user)
        created = true
      }

      user.googleSub = identity.sub
      user.emailVerified = true
      delete user.accountSetupRequired
      data.emailVerifications = data.emailVerifications.filter((entry) => entry.userId !== user.id)
      data.auditLogs.push({ id: id('audit'), actorId: user.id, action: created ? 'account.google_registered' : 'account.google_login', createdAt: now() })
      return { user, created }
    })
    res.status(result.created ? 201 : 200).json({ token: signToken(result.user), user: publicUser(result.user), newAccount: result.created })
  }))

  app.post('/api/auth/verify-email', asyncRoute(async (req, res) => {
    const token = parse(z.string().min(32).max(200), req.body?.token)
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const verification = dataStore.data.emailVerifications.find((item) => item.tokenHash === tokenHash && new Date(item.expiresAt) > new Date())
    if (!verification) return res.status(400).json({ error: 'This verification link is invalid or has expired.' })
    const user = await dataStore.mutate((data) => {
      if (!data.emailVerifications.some((entry) => entry.tokenHash === tokenHash && new Date(entry.expiresAt) > new Date())) { const error = new Error('This verification link has already been used or expired'); error.status = 400; throw error }
      const item = data.users.find((candidate) => candidate.id === verification.userId)
      if (!item) { const error = new Error('Account not found'); error.status = 404; throw error }
      item.emailVerified = true
      data.emailVerifications = data.emailVerifications.filter((entry) => entry.userId !== item.id)
      data.auditLogs.push({ id: id('audit'), actorId: item.id, action: 'email.verified', createdAt: now() })
      return item
    })
    res.json({ success: true, message: 'Your email is verified. You can sign in now.', user: publicUser(user) })
  }))

  app.post('/api/auth/resend-verification', asyncRoute(async (req, res) => {
    const email = parse(emailSchema, req.body?.email)
    const user = dataStore.data.users.find((item) => item.email === email && item.status === 'active')
    let verificationToken = null
    let emailSent = false
    if (user && !user.emailVerified) {
      verificationToken = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(verificationToken).digest('hex')
      await dataStore.mutate((data) => {
        data.emailVerifications = data.emailVerifications.filter((entry) => entry.userId !== user.id)
        data.emailVerifications.push({ id: id('verify'), userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60000).toISOString(), createdAt: now() })
        return true
      })
      emailSent = await sendVerificationEmail({ to: user.email, displayName: user.displayName, token: verificationToken, requestOrigin: req.get('origin') }).catch((error) => { console.error('Verification email failed:', error.message); return false })
    }
    res.json({
      message: emailSent ? 'A new verification email has been sent.' : 'If an unverified account exists, a new verification link is ready.',
      ...(process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST && verificationToken && !emailSent ? { verificationToken } : {}),
    })
  }))

  app.post('/api/auth/forgot-password', asyncRoute(async (req, res) => {
    const email = parse(emailSchema, req.body?.email)
    const user = dataStore.data.users.find((item) => item.email === email && item.status === 'active')
    let resetToken = null
    let emailSent = false
    if (user) {
      resetToken = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(resetToken).digest('hex')
      await dataStore.mutate((data) => {
        data.passwordResets ||= []
        data.passwordResets = data.passwordResets.filter((item) => item.userId !== user.id && new Date(item.expiresAt) > new Date())
        data.passwordResets.push({ id: id('reset'), userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60000).toISOString(), createdAt: now() })
        return true
      })
      emailSent = await sendPasswordResetEmail({ to: user.email, displayName: user.displayName, token: resetToken, requestOrigin: req.get('origin') }).catch((error) => { console.error('Password reset email failed:', error.message); return false })
    }
    res.json({ message: 'If that account exists, a reset email has been requested. Check your inbox and spam folder. If it does not arrive, try again or contact support.', ...(process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST && !emailSent && resetToken ? { resetToken } : {}) })
  }))

  app.post('/api/auth/reset-password', asyncRoute(async (req, res) => {
    const body = parse(z.object({ token: z.string().min(32).max(200), password: passwordSchema }), req.body)
    const tokenHash = createHash('sha256').update(body.token).digest('hex')
    const reset = dataStore.data.passwordResets?.find((item) => item.tokenHash === tokenHash && new Date(item.expiresAt) > new Date())
    if (!reset) return res.status(400).json({ error: 'This reset link is invalid or has expired' })
    await dataStore.mutate(async (data) => {
      if (!data.passwordResets.some((item) => item.tokenHash === tokenHash && new Date(item.expiresAt) > new Date())) { const error = new Error('This reset link has already been used or expired'); error.status = 400; throw error }
      const user = data.users.find((item) => item.id === reset.userId)
      if (!user || user.status !== 'active') { const error = new Error('Account is unavailable'); error.status = 400; throw error }
      user.passwordHash = await bcrypt.hash(body.password, 12)
      user.tokenVersion = (user.tokenVersion || 0) + 1
      if (user.accountSetupRequired) { user.emailVerified = true; delete user.accountSetupRequired }
      data.emailVerifications = data.emailVerifications.filter((item) => item.userId !== user.id)
      data.passwordResets = data.passwordResets.filter((item) => item.id !== reset.id)
      data.auditLogs.push({ id: id('audit'), actorId: user.id, action: 'password.reset', createdAt: now() })
      return true
    })
    app.locals.io?.in(reset.userId).disconnectSockets(true)
    res.json({ success: true })
  }))

  const requireAuth = authRequired(dataStore)
  app.use('/api', requireAuth)

  app.get('/api/auth/me', (req, res) => res.json({ user: publicUser(req.user) }))
  app.put('/api/users/me', asyncRoute(async (req, res) => {
    const body = parse(z.object({
      displayName: z.string().trim().min(2).max(70).optional(),
      anonymousName: anonymousNameSchema.optional(),
      privacy: z.object({ showOnline: z.boolean(), allowReminders: z.boolean() }).optional(),
      availability: z.enum(['available', 'limited', 'unavailable']).optional(),
      bio: z.string().max(500).optional(),
      expertise: z.array(z.string().trim().min(2).max(50)).max(8).optional(),
      avatarUrl: z.string().regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/).max(450000).optional(),
    }), req.body)
    const updated = await dataStore.mutate((data) => {
      const user = data.users.find((item) => item.id === req.user.id)
      Object.assign(user, body)
      data.auditLogs.push({ id: id('audit'), actorId: user.id, action: 'profile.updated', createdAt: now() })
      return user
    })
    res.json({ user: publicUser(updated) })
  }))

  app.get('/api/dashboard', allowRoles('user'), (req, res) => {
    const data = dataStore.snapshot()
    const requests = data.supportRequests.filter((request) => request.userId === req.user.id)
    const current = requests.filter((request) => ['assigned', 'in_progress'].includes(request.status)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
    const volunteer = current ? data.users.find((user) => user.id === current.volunteerId) : null
    const moods = data.moods.filter((mood) => mood.userId === req.user.id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-7)
    const notifications = data.notifications.filter((notification) => notification.userId === req.user.id && !notification.read).length
    res.json({ currentSupport: current ? { ...current, volunteer: volunteerProfile(volunteer, current.matchScore) } : null, moods, unreadNotifications: notifications })
  })

  app.post('/api/ai/analyze', allowRoles('user'), rateLimit({ windowMs: 60000, limit: 12 }), asyncRoute(async (req, res) => {
    const text = parse(supportTextSchema, req.body?.text)
    const analysis = await analyzeSupportText(text)
    res.json({ analysis })
  }))

  app.get('/api/volunteers', (req, res) => {
    const tags = String(req.query.tags || '').split(',').map((item) => item.trim()).filter(Boolean)
    const priorities = String(req.query.priorities || '').split(',').map((item) => item.trim()).filter(Boolean)
    const ranked = rankVolunteers(tags, dataStore.data.users, {
      includeDemo: includeDemoMatches(), priorities,
      activeAssignments: activeVolunteerAssignments(dataStore.data.supportRequests),
    }).map((volunteer) => volunteerProfile(volunteer, volunteer.matchScore))
    res.json({ volunteers: ranked })
  })
  app.get('/api/volunteer-directory', (req, res) => {
    const volunteers = dataStore.data.users
      .filter((user) => user.role === 'volunteer' && user.status === 'active' && user.emailVerified)
      .sort((a, b) => Number(b.availability === 'available') - Number(a.availability === 'available') || (b.rating || 0) - (a.rating || 0))
      .map((volunteer) => volunteerProfile(volunteer, undefined))
    res.json({ volunteers })
  })

  app.get('/api/support-requests', (req, res) => {
    const data = dataStore.snapshot()
    let requests = data.supportRequests
    if (req.user.role === 'user') requests = requests.filter((request) => request.userId === req.user.id)
    if (req.user.role === 'volunteer') requests = requests.filter((request) => request.volunteerId === req.user.id)
    requests = requests.map((request) => ({
      ...request,
      user: peerVisibleProfile(data.users.find((user) => user.id === request.userId), req.user.id),
      volunteer: request.volunteerId ? volunteerProfile(data.users.find((user) => user.id === request.volunteerId), request.matchScore) : null,
    }))
    res.json({ requests })
  })

  app.post('/api/support-requests', allowRoles('user'), asyncRoute(async (req, res) => {
    const body = parse(z.object({
      description: supportTextSchema,
      summary: z.string().trim().min(20).max(1200).optional(),
      tags: z.array(z.string().trim().min(2).max(60)).min(1).max(6).optional(),
      priorities: z.array(z.string().trim().min(2).max(60)).max(3).optional(),
      volunteerId: z.string().max(100).nullable().optional(),
    }), req.body)
    const localSafetyCheck = localAnalysis(body.description)
    const analysis = localSafetyCheck.riskLevel === 'urgent'
      ? localSafetyCheck
      : body.summary && body.tags
        ? { summary: body.summary, tags: body.tags, priorities: body.priorities || body.tags.slice(0, 2), riskLevel: 'standard', crisisNotice: null, provider: 'reviewed' }
        : await analyzeSupportText(body.description)
    const ranked = rankVolunteers(analysis.tags, dataStore.data.users, {
      includeDemo: includeDemoMatches(), priorities: analysis.priorities,
      activeAssignments: activeVolunteerAssignments(dataStore.data.supportRequests),
    })
    const selectedVolunteer = ranked.find((user) => user.id === body.volunteerId)
    if (analysis.riskLevel !== 'urgent' && body.volunteerId && !selectedVolunteer) return res.status(409).json({ error: 'This volunteer is no longer available. Refresh your matches.' })
    const volunteer = analysis.riskLevel === 'urgent' ? null : selectedVolunteer || ranked[0]
    const matchScore = volunteer ? (ranked.find((item) => item.id === volunteer.id)?.matchScore || 80) : null
    const request = {
      id: id('support'), userId: req.user.id, description: body.description, summary: analysis.summary, tags: analysis.tags,
      priorities: analysis.priorities, riskLevel: analysis.riskLevel, status: analysis.riskLevel === 'urgent' ? 'moderator_review' : volunteer ? 'assigned' : 'pending',
      volunteerId: volunteer?.id || null, matchScore, createdAt: now(), updatedAt: now(), sessionAt: null, feedback: null,
    }
    const result = await dataStore.mutate((data) => {
      data.supportRequests.push(request)
      let conversation = null
      if (volunteer) {
        conversation = { id: id('conversation'), supportRequestId: request.id, participantIds: [req.user.id, volunteer.id], createdAt: now(), messages: [] }
        data.conversations.push(conversation)
        data.notifications.push({ id: id('notification'), userId: volunteer.id, type: 'support', title: 'New peer-support request', body: `${req.user.anonymousName} has chosen to connect with you.`, read: false, createdAt: now() })
      }
      if (analysis.riskLevel === 'urgent') data.users.filter((user) => ['moderator', 'admin'].includes(user.role)).forEach((moderator) => data.notifications.push({ id: id('notification'), userId: moderator.id, type: 'safety', title: 'Support request needs prompt review', body: 'A request was held for a moderator safety review.', read: false, createdAt: now() }))
      data.auditLogs.push({ id: id('audit'), actorId: req.user.id, action: 'support.created', targetId: request.id, createdAt: now() })
      return { request, conversation }
    })
    if (app.locals.io) {
      if (volunteer) app.locals.io.to(volunteer.id).emit('notification', { type: 'support', title: 'New peer-support request' })
      if (analysis.riskLevel === 'urgent') app.locals.io.to('role:moderator').to('role:admin').emit('notification', { type: 'safety', title: 'Support request needs prompt review' })
    }
    res.status(201).json({ ...result, analysis, volunteer: volunteer ? volunteerProfile(volunteer, matchScore) : null })
  }))

  app.patch('/api/support-requests/:requestId', allowRoles('volunteer', 'moderator', 'admin'), asyncRoute(async (req, res) => {
    const body = parse(z.object({ status: z.enum(['assigned', 'in_progress', 'completed', 'declined', 'moderator_review']).optional(), volunteerId: z.string().nullable().optional(), sessionAt: z.string().datetime().nullable().optional(), sessionNote: z.string().trim().max(1500).optional() }), req.body)
    const request = await dataStore.mutate((data) => {
      const item = data.supportRequests.find((request) => request.id === req.params.requestId)
      if (!item) { const error = new Error('Support request not found'); error.status = 404; throw error }
      if (req.user.role === 'volunteer' && item.volunteerId !== req.user.id) { const error = new Error('This request is not assigned to you'); error.status = 403; throw error }
      if (req.user.role === 'volunteer' && body.volunteerId !== undefined) { const error = new Error('Only moderators and administrators can assign volunteers'); error.status = 403; throw error }
      const previousVolunteerId = item.volunteerId
      Object.assign(item, body, { updatedAt: now() })
      if (body.volunteerId && body.volunteerId !== previousVolunteerId) {
        const volunteer = data.users.find((user) => user.id === body.volunteerId && user.role === 'volunteer' && user.status === 'active')
        if (!volunteer) { const error = new Error('Volunteer not found'); error.status = 400; throw error }
        item.volunteerId = volunteer.id
        item.status = body.status || 'assigned'
        const existingConversation = data.conversations.find((conversation) => conversation.supportRequestId === item.id && conversation.participantIds.includes(volunteer.id))
        if (!existingConversation) data.conversations.push({ id: id('conversation'), supportRequestId: item.id, participantIds: [item.userId, volunteer.id], createdAt: now(), messages: [] })
        data.notifications.push({ id: id('notification'), userId: volunteer.id, type: 'support', title: 'New peer-support request', body: 'A moderator assigned a support request to you.', read: false, createdAt: now() })
      }
      data.notifications.push({ id: id('notification'), userId: item.userId, type: 'support', title: 'Your support request was updated', body: `Status: ${item.status.replace('_', ' ')}`, read: false, createdAt: now() })
      data.auditLogs.push({ id: id('audit'), actorId: req.user.id, action: 'support.updated', targetId: item.id, createdAt: now() })
      return item
    })
    app.locals.io?.to(request.userId).emit('notification', { type: 'support', title: 'Your support request was updated' })
    res.json({ request })
  }))

  app.post('/api/support-requests/:requestId/cancel', allowRoles('user'), asyncRoute(async (req, res) => {
    const request = await dataStore.mutate((data) => {
      const item = data.supportRequests.find((request) => request.id === req.params.requestId && request.userId === req.user.id)
      if (!item) { const error = new Error('Support request not found'); error.status = 404; throw error }
      if (item.status === 'completed') { const error = new Error('A completed request cannot be cancelled'); error.status = 409; throw error }
      item.status = 'declined'
      item.updatedAt = now()
      data.auditLogs.push({ id: id('audit'), actorId: req.user.id, action: 'support.cancelled', targetId: item.id, createdAt: now() })
      return item
    })
    res.json({ request })
  }))

  app.post('/api/support-requests/:requestId/feedback', allowRoles('user'), asyncRoute(async (req, res) => {
    const body = parse(z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() }), req.body)
    const request = await dataStore.mutate((data) => {
      const item = data.supportRequests.find((request) => request.id === req.params.requestId && request.userId === req.user.id)
      if (!item) { const error = new Error('Support request not found'); error.status = 404; throw error }
      item.feedback = { ...body, createdAt: now() }
      return item
    })
    res.json({ request })
  }))

  app.get('/api/moods', allowRoles('user'), (req, res) => {
    const moods = dataStore.data.moods.filter((mood) => mood.userId === req.user.id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    res.json({ moods })
  })
  app.post('/api/moods', allowRoles('user'), asyncRoute(async (req, res) => {
    const body = parse(z.object({ score: z.number().int().min(1).max(5), journal: z.string().trim().max(2000).optional().default('') }), req.body)
    const entry = { id: id('mood'), userId: req.user.id, ...body, createdAt: now() }
    const saved = await dataStore.mutate((data) => {
      const today = new Date().toISOString().slice(0, 10)
      const existing = data.moods.find((mood) => mood.userId === req.user.id && mood.createdAt.slice(0, 10) === today)
      if (existing) Object.assign(existing, body, { createdAt: now() })
      else data.moods.push(entry)
      return existing || entry
    })
    res.status(201).json({ mood: saved })
  }))

  app.get('/api/posts', (req, res) => {
    const category = String(req.query.category || '')
    let posts = dataStore.data.posts.filter((post) => !post.removed)
    if (category && category !== 'All stories') posts = posts.filter((post) => post.category === category)
    res.json({ posts: posts.sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt) - new Date(a.createdAt)).map((post) => formatPost(post, req.user.id, req.user.postBookmarks || [])) })
  })
  app.post('/api/posts', allowRoles('user', 'volunteer'), asyncRoute(async (req, res) => {
    const body = parse(z.object({ title: z.string().trim().min(10).max(240), body: z.string().trim().max(3000).optional().default('Shared anonymously with the MentalBridge community.'), category: z.enum(['Small wins', 'Anxiety', 'Burnout', 'Loneliness', 'General']).default('General') }), req.body)
    const post = { id: id('post'), userId: req.user.id, author: req.user.anonymousName, initials: req.user.anonymousName.slice(0, 2).toUpperCase(), avatarColor: req.user.avatarColor, ...body, createdAt: now(), reactions: [], comments: [], locked: false, pinned: false }
    await dataStore.mutate((data) => { data.posts.push(post); return post })
    res.status(201).json({ post: formatPost(post, req.user.id, req.user.postBookmarks || []) })
  }))
  app.put('/api/posts/:postId', allowRoles('user', 'volunteer'), asyncRoute(async (req, res) => {
    const body = parse(z.object({ title: z.string().trim().min(10).max(240).optional(), body: z.string().trim().max(3000).optional(), category: z.enum(['Small wins', 'Anxiety', 'Burnout', 'Loneliness', 'General']).optional() }), req.body)
    const post = await dataStore.mutate((data) => {
      const item = data.posts.find((post) => post.id === req.params.postId && post.userId === req.user.id && !post.removed)
      if (!item) { const error = new Error('Post not found or cannot be edited'); error.status = 404; throw error }
      Object.assign(item, body, { updatedAt: now() })
      return item
    })
    res.json({ post: formatPost(post, req.user.id, req.user.postBookmarks || []) })
  }))
  app.delete('/api/posts/:postId', allowRoles('user', 'volunteer'), asyncRoute(async (req, res) => {
    await dataStore.mutate((data) => {
      const item = data.posts.find((post) => post.id === req.params.postId && post.userId === req.user.id && !post.removed)
      if (!item) { const error = new Error('Post not found or cannot be deleted'); error.status = 404; throw error }
      item.removed = true
      item.updatedAt = now()
      data.auditLogs.push({ id: id('audit'), actorId: req.user.id, action: 'post.deleted', targetId: item.id, createdAt: now() })
      return true
    })
    res.json({ success: true })
  }))
  app.post('/api/posts/:postId/reactions', allowRoles('user', 'volunteer'), asyncRoute(async (req, res) => {
    const post = await dataStore.mutate((data) => {
      const item = data.posts.find((post) => post.id === req.params.postId && !post.removed)
      if (!item) { const error = new Error('Post not found'); error.status = 404; throw error }
      const index = item.reactions.indexOf(req.user.id)
      if (index >= 0) item.reactions.splice(index, 1); else item.reactions.push(req.user.id)
      return item
    })
    res.json({ post: formatPost(post, req.user.id, req.user.postBookmarks || []) })
  }))
  app.post('/api/posts/:postId/comments', allowRoles('user', 'volunteer'), asyncRoute(async (req, res) => {
    const text = parse(z.string().trim().min(1).max(1200), req.body?.text)
    const comment = { id: id('comment'), userId: req.user.id, author: req.user.anonymousName, text, createdAt: now(), removed: false }
    await dataStore.mutate((data) => {
      const post = data.posts.find((item) => item.id === req.params.postId && !item.removed)
      if (!post || post.locked) { const error = new Error(post?.locked ? 'This discussion is locked' : 'Post not found'); error.status = post ? 409 : 404; throw error }
      post.comments.push(comment); return comment
    })
    res.status(201).json({ comment })
  }))
  app.post('/api/posts/:postId/bookmark', allowRoles('user', 'volunteer'), asyncRoute(async (req, res) => {
    const postBookmarks = await dataStore.mutate((data) => {
      const post = data.posts.find((item) => item.id === req.params.postId && !item.removed)
      if (!post) { const error = new Error('Post not found'); error.status = 404; throw error }
      const user = data.users.find((item) => item.id === req.user.id)
      user.postBookmarks ||= []
      const index = user.postBookmarks.indexOf(post.id)
      if (index >= 0) user.postBookmarks.splice(index, 1); else user.postBookmarks.push(post.id)
      return user.postBookmarks
    })
    res.json({ postBookmarks })
  }))
  app.post('/api/posts/:postId/report', allowRoles('user', 'volunteer'), asyncRoute(async (req, res) => {
    const body = parse(z.object({
      category: z.enum(['harassment', 'bullying', 'hate_speech', 'threats', 'self_harm', 'spam', 'other']),
      details: z.string().trim().max(500).optional().default(''),
    }), req.body)
    const target = dataStore.data.posts.find((post) => post.id === req.params.postId && !post.removed)
    if (!target) return res.status(404).json({ error: 'Post not found' })
    const existing = dataStore.data.reports.find((report) => report.reporterId === req.user.id && report.targetId === req.params.postId && ['open', 'reviewing'].includes(report.status))
    if (existing) return res.status(409).json({ error: 'You have already reported this post' })
    const report = { id: id('report'), reporterId: req.user.id, targetType: 'post', targetId: req.params.postId, category: body.category, reason: body.details || body.category, status: 'open', createdAt: now() }
    await dataStore.mutate((data) => { data.reports.push(report); return report })
    res.status(201).json({ report })
  }))

  app.get('/api/resources', (req, res) => {
    const query = String(req.query.q || '').toLowerCase()
    const category = String(req.query.category || '')
    const resources = dataStore.data.resources.filter((resource) => resource.published && (!category || category === 'All' || resource.category === category) && (!query || `${resource.title} ${resource.description} ${resource.category}`.toLowerCase().includes(query)))
    res.json({ resources, bookmarks: req.user.bookmarks || [] })
  })
  app.post('/api/resources/:resourceId/bookmark', allowRoles('user', 'volunteer'), asyncRoute(async (req, res) => {
    const bookmarks = await dataStore.mutate((data) => {
      const user = data.users.find((item) => item.id === req.user.id)
      user.bookmarks ||= []
      const index = user.bookmarks.indexOf(req.params.resourceId)
      if (index >= 0) user.bookmarks.splice(index, 1); else user.bookmarks.push(req.params.resourceId)
      return user.bookmarks
    })
    res.json({ bookmarks })
  }))

  app.get('/api/conversations', allowRoles('user', 'volunteer'), (req, res) => {
    const data = dataStore.snapshot()
    const conversations = data.conversations.filter((conversation) => conversation.participantIds.includes(req.user.id)).map((conversation) => {
      const otherId = conversation.participantIds.find((participantId) => participantId !== req.user.id)
      const other = data.users.find((user) => user.id === otherId)
      const lastMessage = conversation.messages.at(-1) || null
      return { id: conversation.id, supportRequestId: conversation.supportRequestId, other: peerVisibleProfile(other, req.user.id), lastMessage, unread: conversation.messages.filter((message) => message.senderId !== req.user.id && !message.readBy.includes(req.user.id)).length, createdAt: conversation.createdAt }
    })
    res.json({ conversations })
  })
  app.get('/api/conversations/:conversationId/messages', allowRoles('user', 'volunteer'), asyncRoute(async (req, res) => {
    const conversation = await dataStore.mutate((data) => {
      const item = data.conversations.find((conversation) => conversation.id === req.params.conversationId && conversation.participantIds.includes(req.user.id))
      if (!item) { const error = new Error('Conversation not found'); error.status = 404; throw error }
      item.messages.forEach((message) => { if (!message.readBy.includes(req.user.id)) message.readBy.push(req.user.id) })
      return item
    })
    res.json({ messages: conversation.messages })
  }))
  app.post('/api/conversations/:conversationId/messages', allowRoles('user', 'volunteer'), asyncRoute(async (req, res) => {
    const text = parse(z.string().trim().min(1).max(4000), req.body?.text)
    const result = await dataStore.mutate((data) => {
      const conversation = data.conversations.find((item) => item.id === req.params.conversationId && item.participantIds.includes(req.user.id))
      if (!conversation) { const error = new Error('Conversation not found'); error.status = 404; throw error }
      const message = { id: id('message'), senderId: req.user.id, text, createdAt: now(), readBy: [req.user.id] }
      conversation.messages.push(message)
      const recipientId = conversation.participantIds.find((participantId) => participantId !== req.user.id)
      const senderName = req.user.role === 'user' ? req.user.anonymousName : req.user.displayName
      data.notifications.push({ id: id('notification'), userId: recipientId, type: 'message', title: `${senderName} sent you a message`, body: text.slice(0, 100), read: false, createdAt: now() })
      return { message, recipientId }
    })
    const senderName = req.user.role === 'user' ? req.user.anonymousName : req.user.displayName
    app.locals.io?.to(result.recipientId).emit('message', { conversationId: req.params.conversationId, message: result.message })
    app.locals.io?.to(result.recipientId).emit('notification', { type: 'message', title: `${senderName} sent you a message` })
    res.status(201).json({ message: result.message })
  }))

  app.get('/api/notifications', (req, res) => {
    const notifications = dataStore.data.notifications.filter((item) => item.userId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    res.json({ notifications })
  })
  app.post('/api/notifications/read', asyncRoute(async (req, res) => {
    await dataStore.mutate((data) => { data.notifications.filter((item) => item.userId === req.user.id).forEach((item) => { item.read = true }); return true })
    res.json({ success: true })
  }))

  app.get('/api/admin/stats', allowRoles('moderator', 'admin'), (req, res) => {
    const data = dataStore.snapshot()
    const activeUsers = data.users.filter((user) => user.status === 'active').length
    const openRequests = data.supportRequests.filter((request) => !['completed', 'declined'].includes(request.status)).length
    const supportersOnline = rankVolunteers([], data.users).filter((user) => user.availability === 'available').length
    const openReports = data.reports.filter((report) => report.status === 'open').length
    const completed = data.supportRequests.filter((request) => request.status === 'completed' && request.feedback)
    const positiveFeedback = completed.length ? Math.round(completed.filter((request) => request.feedback.rating >= 4).length / completed.length * 100) : 100
    res.json({ stats: { activeUsers, openRequests, supportersOnline, openReports, positiveFeedback }, queue: data.supportRequests.filter((request) => !['completed', 'declined'].includes(request.status)).slice(-10).reverse() })
  })
  app.get('/api/admin/reports', allowRoles('moderator', 'admin'), (req, res) => res.json({ reports: dataStore.data.reports }))
  app.patch('/api/admin/reports/:reportId', allowRoles('moderator', 'admin'), asyncRoute(async (req, res) => {
    const status = parse(z.enum(['open', 'reviewing', 'resolved', 'dismissed']), req.body?.status)
    const report = await dataStore.mutate((data) => {
      const item = data.reports.find((report) => report.id === req.params.reportId)
      if (!item) { const error = new Error('Report not found'); error.status = 404; throw error }
      item.status = status; item.reviewedBy = req.user.id; item.updatedAt = now()
      data.auditLogs.push({ id: id('audit'), actorId: req.user.id, action: 'report.updated', targetId: item.id, createdAt: now() })
      return item
    })
    res.json({ report })
  }))
  app.patch('/api/admin/posts/:postId', allowRoles('moderator', 'admin'), asyncRoute(async (req, res) => {
    const body = parse(z.object({ removed: z.boolean().optional(), locked: z.boolean().optional(), pinned: z.boolean().optional() }), req.body)
    if (body.removed !== undefined && req.user.role !== 'admin') return res.status(403).json({ error: 'Only an administrator can remove or restore posts' })
    const post = await dataStore.mutate((data) => {
      const item = data.posts.find((post) => post.id === req.params.postId)
      if (!item) { const error = new Error('Post not found'); error.status = 404; throw error }
      Object.assign(item, body)
      data.auditLogs.push({ id: id('audit'), actorId: req.user.id, action: 'post.moderated', targetId: item.id, createdAt: now() })
      return item
    })
    res.json({ post: formatPost(post, req.user.id) })
  }))
  app.get('/api/admin/posts', allowRoles('moderator', 'admin'), (req, res) => {
    const posts = dataStore.data.posts
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((post) => formatPost(post, req.user.id))
    res.json({ posts })
  })
  app.get('/api/admin/resources', allowRoles('moderator', 'admin'), (req, res) => {
    const resources = dataStore.data.resources.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    res.json({ resources })
  })
  app.post('/api/admin/resources', allowRoles('moderator', 'admin'), asyncRoute(async (req, res) => {
    const body = parse(z.object({
      title: z.string().trim().min(5).max(180), description: z.string().trim().min(10).max(600),
      content: z.string().trim().min(20).max(12000), category: z.string().trim().min(2).max(60),
      type: z.string().trim().min(2).max(40).default('5 min read'),
      icon: z.enum(['Wind', 'Headphones', 'Coffee', 'FileText', 'MoonStar', 'HeartHandshake', 'BookOpen']).default('BookOpen'),
      color: z.enum(['sage', 'lavender', 'apricot', 'blue', 'navy', 'rose']).default('sage'),
      featured: z.boolean().default(false), published: z.boolean().default(true),
    }), req.body)
    const resource = { id: id('resource'), ...body, createdBy: req.user.id, createdAt: now(), updatedAt: now() }
    await dataStore.mutate((data) => {
      data.resources.push(resource)
      data.auditLogs.push({ id: id('audit'), actorId: req.user.id, action: 'resource.created', targetId: resource.id, createdAt: now() })
      return resource
    })
    res.status(201).json({ resource })
  }))
  app.put('/api/admin/resources/:resourceId', allowRoles('moderator', 'admin'), asyncRoute(async (req, res) => {
    const body = parse(z.object({
      title: z.string().trim().min(5).max(180).optional(), description: z.string().trim().min(10).max(600).optional(),
      content: z.string().trim().min(20).max(12000).optional(), category: z.string().trim().min(2).max(60).optional(),
      type: z.string().trim().min(2).max(40).optional(),
      icon: z.enum(['Wind', 'Headphones', 'Coffee', 'FileText', 'MoonStar', 'HeartHandshake', 'BookOpen']).optional(),
      color: z.enum(['sage', 'lavender', 'apricot', 'blue', 'navy', 'rose']).optional(),
      featured: z.boolean().optional(), published: z.boolean().optional(),
    }), req.body)
    const resource = await dataStore.mutate((data) => {
      const item = data.resources.find((resource) => resource.id === req.params.resourceId)
      if (!item) { const error = new Error('Resource not found'); error.status = 404; throw error }
      Object.assign(item, body, { updatedAt: now(), updatedBy: req.user.id })
      data.auditLogs.push({ id: id('audit'), actorId: req.user.id, action: 'resource.updated', targetId: item.id, createdAt: now() })
      return item
    })
    res.json({ resource })
  }))
  app.delete('/api/admin/resources/:resourceId', allowRoles('admin'), asyncRoute(async (req, res) => {
    await dataStore.mutate((data) => {
      const index = data.resources.findIndex((resource) => resource.id === req.params.resourceId)
      if (index < 0) { const error = new Error('Resource not found'); error.status = 404; throw error }
      const [removed] = data.resources.splice(index, 1)
      data.users.forEach((user) => { user.bookmarks = (user.bookmarks || []).filter((resourceId) => resourceId !== removed.id) })
      data.auditLogs.push({ id: id('audit'), actorId: req.user.id, action: 'resource.deleted', targetId: removed.id, createdAt: now() })
      return true
    })
    res.json({ success: true })
  }))
  app.get('/api/admin/audit-logs', allowRoles('admin'), (req, res) => res.json({ logs: dataStore.data.auditLogs.slice(-100).reverse() }))
  app.get('/api/admin/users', allowRoles('moderator', 'admin'), (req, res) => {
    const users = dataStore.data.users.map((user) => ({ ...publicUser(user), email: req.user.role === 'admin' ? user.email : undefined }))
    res.json({ users })
  })
  app.patch('/api/admin/users/:userId', allowRoles('moderator', 'admin'), asyncRoute(async (req, res) => {
    const body = parse(z.object({
      status: z.enum(['active', 'suspended', 'pending']).optional(),
      role: z.enum(['user', 'volunteer', 'moderator']).optional(),
    }).refine((value) => value.status !== undefined || value.role !== undefined, 'Choose a status or role to update'), req.body)
    if (req.params.userId === req.user.id && (body.status !== undefined || body.role !== undefined)) return res.status(409).json({ error: 'You cannot change your own access' })
    const user = await dataStore.mutate((data) => {
      const item = data.users.find((user) => user.id === req.params.userId)
      if (!item) { const error = new Error('User not found'); error.status = 404; throw error }
      if (item.role === 'admin') { const error = new Error('Administrator accounts cannot be changed here'); error.status = 403; throw error }
      if (req.user.role === 'moderator' && (item.role === 'moderator' || body.role === 'moderator')) { const error = new Error('Only an administrator can manage moderators'); error.status = 403; throw error }
      if (body.role && !item.emailVerified) { const error = new Error('Verify this account email before assigning a staff or volunteer role'); error.status = 409; throw error }
      if (body.status) item.status = body.status
      if (body.role) {
        item.role = body.role
        if (body.role === 'volunteer') {
          item.availability ||= 'unavailable'
          item.expertise ||= ['Emotional support']
          item.livedExperience ||= []
          item.bio ||= 'Peer supporter assigned by the MentalBridge care team.'
          item.yearsActive ||= 0
        }
      }
      data.notifications.push({ id: id('notification'), userId: item.id, type: 'account', title: 'Your account access was updated', body: `Your MentalBridge role is now ${item.role}.`, read: false, createdAt: now() })
      data.auditLogs.push({ id: id('audit'), actorId: req.user.id, action: body.role ? 'user.role.updated' : 'user.status.updated', targetId: item.id, metadata: body, createdAt: now() })
      return item
    })
    res.json({ user: publicUser(user) })
  }))

  // Serve the built single-page app from the API origin whenever a build exists. One URL then
  // covers the laptop and the phone, which is what makes the installable web app work on a LAN.
  const distPath = resolve(process.cwd(), 'dist')
  const distIndex = resolve(distPath, 'index.html')
  app.locals.servesClient = existsSync(distIndex)
  if (app.locals.servesClient) {
    app.use(express.static(distPath, {
      index: false,
      setHeaders(res, filePath) {
        // Hashed build assets can be cached hard; the shell and worker must always revalidate.
        if (filePath.includes(`${sep}assets${sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        else res.setHeader('Cache-Control', 'no-cache')
      },
    }))
    app.get(/^(?!\/api).*/, (req, res) => res.sendFile(distIndex, { headers: { 'Cache-Control': 'no-cache' } }))
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('No dist/ build found. Run "npm run build" so the server can serve the web app.')
  }
  app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }))
  app.use((error, req, res, next) => {
    console.error(error)
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'Something went wrong on the server',
      ...(error.staffPortal ? { staffPortal: true } : {}),
    })
  })
  return app
}

// Every non-internal IPv4 address, so the phone URL can be read straight off the terminal.
function lanAddresses() {
  return Object.values(networkInterfaces()).flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => item.address)
}

export async function startServer({ store } = {}) {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET is required in production')
  if (process.env.NODE_ENV === 'production' && !process.env.SMTP_HOST) throw new Error('SMTP_HOST is required in production for mandatory email verification')
  if (process.env.NODE_ENV === 'production' && !process.env.SMTP_FROM) throw new Error('SMTP_FROM is required in production for mandatory email verification')
  const app = await createApp({ store })
  const server = createServer(app)
  const configuredOrigins = process.env.CLIENT_ORIGIN?.split(',').map((item) => item.trim()).filter(Boolean)
  const socketOptions = configuredOrigins?.length
    ? { cors: { origin: configuredOrigins, credentials: true } }
    : process.env.NODE_ENV !== 'production'
      ? { cors: { origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true } }
      : {}
  const io = new SocketServer(server, socketOptions)
  app.locals.io = io
  io.use((socket, next) => {
    try {
      const payload = verifyToken(socket.handshake.auth?.token)
      const user = app.locals.store.data.users.find((item) => item.id === payload.sub && item.status === 'active' && item.emailVerified)
      if (!user || (payload.version || 0) !== (user.tokenVersion || 0)) throw new Error('Unavailable user')
      socket.user = user
      next()
    } catch { next(new Error('Authentication required')) }
  })
  io.on('connection', (socket) => {
    socket.join(socket.user.id)
    socket.join(`role:${socket.user.role}`)
  })
  const port = Number(process.env.PORT || 3001)
  await new Promise((resolveListen) => server.listen(port, '0.0.0.0', resolveListen))
  const role = app.locals.servesClient ? 'web app + API' : 'API only'
  console.log(`
MentalBridge ${role} — storage: ${app.locals.storageMode}`)
  console.log(`  This computer   http://localhost:${port}`)
  for (const address of lanAddresses()) console.log(`  Phone / tablet  http://${address}:${port}   (same Wi-Fi)`)
  if (!app.locals.servesClient) console.log('  Run "npm run build" first if you want one URL to serve the app as well.')
  console.log('')
  return { app, server, io }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) startServer().catch((error) => { console.error(error); process.exitCode = 1 })

export { JsonStore }
