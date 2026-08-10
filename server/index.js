import 'dotenv/config'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
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
import { sendPasswordResetEmail } from './email.js'

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
  return { ...safe, matchScore }
}

function peerVisibleProfile(user, viewerId) {
  if (!user) return null
  if (user.id === viewerId) return publicUser(user)
  if (user.role === 'user') return { id: user.id, displayName: user.anonymousName, anonymousName: user.anonymousName, role: 'user', avatarColor: user.avatarColor }
  return volunteerProfile(user)
}

function formatPost(post, userId) {
  return {
    ...post,
    time: asTimeAgo(post.createdAt),
    likes: post.reactions.length,
    liked: post.reactions.includes(userId),
    comments: post.comments.length,
    reactions: undefined,
  }
}

export async function createApp({ store: suppliedStore } = {}) {
  const dataStore = suppliedStore || (process.env.MONGODB_URI ? new MongoStore(process.env.MONGODB_URI) : defaultStore)
  await dataStore.init()
  const app = express()
  app.locals.store = dataStore

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  const configuredOrigins = process.env.CLIENT_ORIGIN?.split(',').map((item) => item.trim()).filter(Boolean)
  if (configuredOrigins?.length) app.use(cors({ origin: configuredOrigins, credentials: true }))
  else if (process.env.NODE_ENV !== 'production') app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }))
  app.use(express.json({ limit: '48kb' }))
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 80, standardHeaders: true, legacyHeaders: false }))

  app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'mentalbridge-api', ai: process.env.OPENAI_API_KEY ? 'openai' : 'local', timestamp: now() }))

  app.post('/api/auth/register', asyncRoute(async (req, res) => {
    const body = parse(z.object({
      displayName: z.string().trim().min(2).max(70),
      anonymousName: z.string().trim().min(3).max(40).regex(/^[\p{L}\p{N}_ -]+$/u).optional(),
      email: emailSchema,
      password: passwordSchema,
    }), req.body)
    if (dataStore.data.users.some((user) => user.email === body.email)) return res.status(409).json({ error: 'An account with this email already exists' })
    const user = {
      id: id('user'), email: body.email, passwordHash: await bcrypt.hash(body.password, 12), displayName: body.displayName,
      anonymousName: body.anonymousName || `GentleRiver${Math.floor(Math.random() * 900 + 100)}`,
      role: 'user', status: 'active', privacy: { showOnline: true, allowReminders: true }, bookmarks: [],
      createdAt: now(), avatarColor: '#e5aa82',
    }
    await dataStore.mutate((data) => { data.users.push(user); data.auditLogs.push({ id: id('audit'), actorId: user.id, action: 'account.registered', createdAt: now() }); return user })
    res.status(201).json({ token: signToken(user), user: publicUser(user) })
  }))

  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const body = parse(z.object({ email: emailSchema, password: z.string().min(1).max(128) }), req.body)
    const user = dataStore.data.users.find((item) => item.email === body.email)
    if (!user || user.status !== 'active' || !(await bcrypt.compare(body.password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect' })
    res.json({ token: signToken(user), user: publicUser(user) })
  }))

  app.post('/api/auth/forgot-password', asyncRoute(async (req, res) => {
    const email = parse(emailSchema, req.body?.email)
    const user = dataStore.data.users.find((item) => item.email === email && item.status === 'active')
    let resetToken = null
    if (user) {
      resetToken = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(resetToken).digest('hex')
      await dataStore.mutate((data) => {
        data.passwordResets ||= []
        data.passwordResets = data.passwordResets.filter((item) => item.userId !== user.id && new Date(item.expiresAt) > new Date())
        data.passwordResets.push({ id: id('reset'), userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60000).toISOString(), createdAt: now() })
        return true
      })
      await sendPasswordResetEmail({ to: user.email, displayName: user.displayName, token: resetToken }).catch((error) => console.error('Password reset email failed:', error.message))
    }
    res.json({ message: 'If that account exists, password-reset instructions are ready.', ...(process.env.NODE_ENV !== 'production' && resetToken ? { resetToken } : {}) })
  }))

  app.post('/api/auth/reset-password', asyncRoute(async (req, res) => {
    const body = parse(z.object({ token: z.string().min(32).max(200), password: passwordSchema }), req.body)
    const tokenHash = createHash('sha256').update(body.token).digest('hex')
    const reset = dataStore.data.passwordResets?.find((item) => item.tokenHash === tokenHash && new Date(item.expiresAt) > new Date())
    if (!reset) return res.status(400).json({ error: 'This reset link is invalid or has expired' })
    await dataStore.mutate(async (data) => {
      const user = data.users.find((item) => item.id === reset.userId)
      user.passwordHash = await bcrypt.hash(body.password, 12)
      data.passwordResets = data.passwordResets.filter((item) => item.id !== reset.id)
      data.auditLogs.push({ id: id('audit'), actorId: user.id, action: 'password.reset', createdAt: now() })
      return true
    })
    res.json({ success: true })
  }))

  const requireAuth = authRequired(dataStore)
  app.use('/api', requireAuth)

  app.get('/api/auth/me', (req, res) => res.json({ user: publicUser(req.user) }))
  app.put('/api/users/me', asyncRoute(async (req, res) => {
    const body = parse(z.object({
      displayName: z.string().trim().min(2).max(70).optional(),
      anonymousName: z.string().trim().min(3).max(40).optional(),
      privacy: z.object({ showOnline: z.boolean(), allowReminders: z.boolean() }).optional(),
      availability: z.enum(['available', 'limited', 'unavailable']).optional(),
      bio: z.string().max(500).optional(),
      expertise: z.array(z.string().trim().min(2).max(50)).max(8).optional(),
    }), req.body)
    const updated = await dataStore.mutate((data) => {
      const user = data.users.find((item) => item.id === req.user.id)
      Object.assign(user, body)
      data.auditLogs.push({ id: id('audit'), actorId: user.id, action: 'profile.updated', createdAt: now() })
      return user
    })
    res.json({ user: publicUser(updated) })
  }))

  app.get('/api/dashboard', (req, res) => {
    const data = dataStore.snapshot()
    const requests = data.supportRequests.filter((request) => request.userId === req.user.id)
    const current = requests.find((request) => ['assigned', 'in_progress'].includes(request.status)) || null
    const volunteer = current ? data.users.find((user) => user.id === current.volunteerId) : null
    const moods = data.moods.filter((mood) => mood.userId === req.user.id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-7)
    const notifications = data.notifications.filter((notification) => notification.userId === req.user.id && !notification.read).length
    res.json({ currentSupport: current ? { ...current, volunteer: volunteerProfile(volunteer, current.matchScore) } : null, moods, unreadNotifications: notifications })
  })

  app.post('/api/ai/analyze', rateLimit({ windowMs: 60000, limit: 12 }), asyncRoute(async (req, res) => {
    const text = parse(supportTextSchema, req.body?.text)
    const analysis = await analyzeSupportText(text)
    res.json({ analysis })
  }))

  app.get('/api/volunteers', (req, res) => {
    const tags = String(req.query.tags || '').split(',').map((item) => item.trim()).filter(Boolean)
    const ranked = rankVolunteers(tags, dataStore.data.users).map((volunteer) => volunteerProfile(volunteer, volunteer.matchScore))
    res.json({ volunteers: ranked })
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

  app.post('/api/support-requests', asyncRoute(async (req, res) => {
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
    const selectedVolunteer = analysis.riskLevel === 'urgent' ? null : dataStore.data.users.find((user) => user.id === body.volunteerId && user.role === 'volunteer' && user.status === 'active')
    const ranked = rankVolunteers(analysis.tags, dataStore.data.users)
    const volunteer = selectedVolunteer || (analysis.riskLevel === 'standard' ? ranked[0] : null)
    const matchScore = volunteer ? (ranked.find((item) => item.id === volunteer.id)?.matchScore || 80) : null
    const request = {
      id: id('support'), userId: req.user.id, description: body.description, summary: analysis.summary, tags: analysis.tags,
      priorities: analysis.priorities, riskLevel: analysis.riskLevel, status: analysis.riskLevel === 'urgent' ? 'moderator_review' : 'assigned',
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
      Object.assign(item, body, { updatedAt: now() })
      data.notifications.push({ id: id('notification'), userId: item.userId, type: 'support', title: 'Your support request was updated', body: `Status: ${item.status.replace('_', ' ')}`, read: false, createdAt: now() })
      data.auditLogs.push({ id: id('audit'), actorId: req.user.id, action: 'support.updated', targetId: item.id, createdAt: now() })
      return item
    })
    app.locals.io?.to(request.userId).emit('notification', { type: 'support', title: 'Your support request was updated' })
    res.json({ request })
  }))

  app.post('/api/support-requests/:requestId/feedback', asyncRoute(async (req, res) => {
    const body = parse(z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() }), req.body)
    const request = await dataStore.mutate((data) => {
      const item = data.supportRequests.find((request) => request.id === req.params.requestId && request.userId === req.user.id)
      if (!item) { const error = new Error('Support request not found'); error.status = 404; throw error }
      item.feedback = { ...body, createdAt: now() }
      return item
    })
    res.json({ request })
  }))

  app.get('/api/moods', (req, res) => {
    const moods = dataStore.data.moods.filter((mood) => mood.userId === req.user.id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    res.json({ moods })
  })
  app.post('/api/moods', asyncRoute(async (req, res) => {
    const body = parse(z.object({ score: z.number().int().min(1).max(5), journal: z.string().trim().max(2000).optional().default('') }), req.body)
    const entry = { id: id('mood'), userId: req.user.id, ...body, createdAt: now() }
    await dataStore.mutate((data) => {
      const today = new Date().toISOString().slice(0, 10)
      const existing = data.moods.find((mood) => mood.userId === req.user.id && mood.createdAt.slice(0, 10) === today)
      if (existing) Object.assign(existing, body, { createdAt: now() })
      else data.moods.push(entry)
      return existing || entry
    })
    res.status(201).json({ mood: entry })
  }))

  app.get('/api/posts', (req, res) => {
    const category = String(req.query.category || '')
    let posts = dataStore.data.posts.filter((post) => !post.removed)
    if (category && category !== 'All stories') posts = posts.filter((post) => post.category === category)
    res.json({ posts: posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((post) => formatPost(post, req.user.id)) })
  })
  app.post('/api/posts', asyncRoute(async (req, res) => {
    const body = parse(z.object({ title: z.string().trim().min(10).max(240), body: z.string().trim().max(3000).optional().default('Shared anonymously with the MentalBridge community.'), category: z.enum(['Small wins', 'Anxiety', 'Burnout', 'Loneliness', 'General']).default('General') }), req.body)
    const post = { id: id('post'), userId: req.user.id, author: req.user.anonymousName, initials: req.user.anonymousName.slice(0, 2).toUpperCase(), avatarColor: req.user.avatarColor, ...body, createdAt: now(), reactions: [], comments: [], locked: false, pinned: false }
    await dataStore.mutate((data) => { data.posts.push(post); return post })
    res.status(201).json({ post: formatPost(post, req.user.id) })
  }))
  app.post('/api/posts/:postId/reactions', asyncRoute(async (req, res) => {
    const post = await dataStore.mutate((data) => {
      const item = data.posts.find((post) => post.id === req.params.postId && !post.removed)
      if (!item) { const error = new Error('Post not found'); error.status = 404; throw error }
      const index = item.reactions.indexOf(req.user.id)
      if (index >= 0) item.reactions.splice(index, 1); else item.reactions.push(req.user.id)
      return item
    })
    res.json({ post: formatPost(post, req.user.id) })
  }))
  app.post('/api/posts/:postId/comments', asyncRoute(async (req, res) => {
    const text = parse(z.string().trim().min(1).max(1200), req.body?.text)
    const comment = { id: id('comment'), userId: req.user.id, author: req.user.anonymousName, text, createdAt: now(), removed: false }
    await dataStore.mutate((data) => {
      const post = data.posts.find((item) => item.id === req.params.postId && !item.removed)
      if (!post || post.locked) { const error = new Error(post?.locked ? 'This discussion is locked' : 'Post not found'); error.status = post ? 409 : 404; throw error }
      post.comments.push(comment); return comment
    })
    res.status(201).json({ comment })
  }))
  app.post('/api/posts/:postId/report', asyncRoute(async (req, res) => {
    const reason = parse(z.string().trim().min(3).max(500), req.body?.reason || 'Potentially harmful content')
    const report = { id: id('report'), reporterId: req.user.id, targetType: 'post', targetId: req.params.postId, reason, status: 'open', createdAt: now() }
    await dataStore.mutate((data) => { data.reports.push(report); return report })
    res.status(201).json({ report })
  }))

  app.get('/api/resources', (req, res) => {
    const query = String(req.query.q || '').toLowerCase()
    const category = String(req.query.category || '')
    const resources = dataStore.data.resources.filter((resource) => resource.published && (!category || category === 'All' || resource.category === category) && (!query || `${resource.title} ${resource.description} ${resource.category}`.toLowerCase().includes(query)))
    res.json({ resources, bookmarks: req.user.bookmarks || [] })
  })
  app.post('/api/resources/:resourceId/bookmark', asyncRoute(async (req, res) => {
    const bookmarks = await dataStore.mutate((data) => {
      const user = data.users.find((item) => item.id === req.user.id)
      user.bookmarks ||= []
      const index = user.bookmarks.indexOf(req.params.resourceId)
      if (index >= 0) user.bookmarks.splice(index, 1); else user.bookmarks.push(req.params.resourceId)
      return user.bookmarks
    })
    res.json({ bookmarks })
  }))

  app.get('/api/conversations', (req, res) => {
    const data = dataStore.snapshot()
    const conversations = data.conversations.filter((conversation) => conversation.participantIds.includes(req.user.id)).map((conversation) => {
      const otherId = conversation.participantIds.find((participantId) => participantId !== req.user.id)
      const other = data.users.find((user) => user.id === otherId)
      const lastMessage = conversation.messages.at(-1) || null
      return { id: conversation.id, supportRequestId: conversation.supportRequestId, other: peerVisibleProfile(other, req.user.id), lastMessage, unread: conversation.messages.filter((message) => message.senderId !== req.user.id && !message.readBy.includes(req.user.id)).length, createdAt: conversation.createdAt }
    })
    res.json({ conversations })
  })
  app.get('/api/conversations/:conversationId/messages', asyncRoute(async (req, res) => {
    const conversation = await dataStore.mutate((data) => {
      const item = data.conversations.find((conversation) => conversation.id === req.params.conversationId && conversation.participantIds.includes(req.user.id))
      if (!item) { const error = new Error('Conversation not found'); error.status = 404; throw error }
      item.messages.forEach((message) => { if (!message.readBy.includes(req.user.id)) message.readBy.push(req.user.id) })
      return item
    })
    res.json({ messages: conversation.messages })
  }))
  app.post('/api/conversations/:conversationId/messages', asyncRoute(async (req, res) => {
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
    const supportersOnline = data.users.filter((user) => user.role === 'volunteer' && user.availability === 'available').length
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
    const post = await dataStore.mutate((data) => {
      const item = data.posts.find((post) => post.id === req.params.postId)
      if (!item) { const error = new Error('Post not found'); error.status = 404; throw error }
      Object.assign(item, body)
      data.auditLogs.push({ id: id('audit'), actorId: req.user.id, action: 'post.moderated', targetId: item.id, createdAt: now() })
      return item
    })
    res.json({ post: formatPost(post, req.user.id) })
  }))
  app.get('/api/admin/audit-logs', allowRoles('admin'), (req, res) => res.json({ logs: dataStore.data.auditLogs.slice(-100).reverse() }))

  if (process.env.NODE_ENV === 'production') {
    const distPath = resolve(process.cwd(), 'dist')
    app.use(express.static(distPath))
    app.get(/^(?!\/api).*/, (req, res) => res.sendFile(resolve(distPath, 'index.html')))
  }
  app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }))
  app.use((error, req, res, next) => {
    console.error(error)
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong on the server' })
  })
  return app
}

export async function startServer({ store } = {}) {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET is required in production')
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
      const user = app.locals.store.data.users.find((item) => item.id === payload.sub && item.status === 'active')
      if (!user) throw new Error('Unavailable user')
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
  console.log(`MentalBridge API listening on http://localhost:${port}`)
  return { app, server, io }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) startServer().catch((error) => { console.error(error); process.exitCode = 1 })

export { JsonStore }
