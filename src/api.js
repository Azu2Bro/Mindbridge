import { io } from 'socket.io-client'

const TOKEN_KEY = 'mentalbridge-token'

export const session = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token) => token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY),
}

async function request(path, options = {}) {
  const token = session.getToken()
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20000)
  let response
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The server took too long to respond. Please try again.')
    throw new Error('The backend server is unavailable. Start MentalBridge with “npm run dev”.')
  } finally {
    window.clearTimeout(timeout)
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') {
      session.setToken(null)
      window.dispatchEvent(new CustomEvent('mentalbridge:session-expired'))
    }
    const requestError = new Error(data.error || `Request failed (${response.status})`)
    Object.assign(requestError, { status: response.status, details: data })
    throw requestError
  }
  return data
}

const json = (method, body) => ({ method, body: JSON.stringify(body) })

export const api = {
  health: () => request('/health'),
  login: (credentials) => request('/auth/login', json('POST', credentials)),
  staffLogin: (credentials) => request('/auth/staff/login', json('POST', credentials)),
  register: (details) => request('/auth/register', json('POST', details)),
  verifyEmail: (token) => request('/auth/verify-email', json('POST', { token })),
  resendVerification: (email) => request('/auth/resend-verification', json('POST', { email })),
  forgotPassword: (email) => request('/auth/forgot-password', json('POST', { email })),
  resetPassword: (token, password) => request('/auth/reset-password', json('POST', { token, password })),
  me: () => request('/auth/me'),
  updateProfile: (updates) => request('/users/me', json('PUT', updates)),
  dashboard: () => request('/dashboard'),
  analyze: (text) => request('/ai/analyze', json('POST', { text })),
  volunteers: (tags = []) => request(`/volunteers?tags=${encodeURIComponent(tags.join(','))}`),
  supportRequests: () => request('/support-requests'),
  createSupportRequest: (supportRequest) => request('/support-requests', json('POST', supportRequest)),
  updateSupportRequest: (requestId, updates) => request(`/support-requests/${requestId}`, json('PATCH', updates)),
  cancelSupportRequest: (requestId) => request(`/support-requests/${requestId}/cancel`, json('POST', {})),
  submitFeedback: (requestId, feedback) => request(`/support-requests/${requestId}/feedback`, json('POST', feedback)),
  moods: () => request('/moods'),
  saveMood: (entry) => request('/moods', json('POST', entry)),
  posts: (category = '') => request(`/posts${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  createPost: (post) => request('/posts', json('POST', post)),
  updatePost: (postId, post) => request(`/posts/${postId}`, json('PUT', post)),
  deletePost: (postId) => request(`/posts/${postId}`, { method: 'DELETE' }),
  reactToPost: (postId) => request(`/posts/${postId}/reactions`, json('POST', {})),
  commentOnPost: (postId, text) => request(`/posts/${postId}/comments`, json('POST', { text })),
  bookmarkPost: (postId) => request(`/posts/${postId}/bookmark`, json('POST', {})),
  reportPost: (postId, reason) => request(`/posts/${postId}/report`, json('POST', { reason })),
  resources: (query = '', category = '') => request(`/resources?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`),
  toggleBookmark: (resourceId) => request(`/resources/${resourceId}/bookmark`, json('POST', {})),
  conversations: () => request('/conversations'),
  messages: (conversationId) => request(`/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, text) => request(`/conversations/${conversationId}/messages`, json('POST', { text })),
  notifications: () => request('/notifications'),
  markNotificationsRead: () => request('/notifications/read', json('POST', {})),
  adminStats: () => request('/admin/stats'),
  adminReports: () => request('/admin/reports'),
  updateReport: (reportId, status) => request(`/admin/reports/${reportId}`, json('PATCH', { status })),
  adminUsers: () => request('/admin/users'),
  updateUserStatus: (userId, status) => request(`/admin/users/${userId}`, json('PATCH', { status })),
  updateUserAccess: (userId, updates) => request(`/admin/users/${userId}`, json('PATCH', updates)),
  adminPosts: () => request('/admin/posts'),
  moderatePost: (postId, updates) => request(`/admin/posts/${postId}`, json('PATCH', updates)),
  adminResources: () => request('/admin/resources'),
  createResource: (resource) => request('/admin/resources', json('POST', resource)),
  updateResource: (resourceId, resource) => request(`/admin/resources/${resourceId}`, json('PUT', resource)),
  deleteResource: (resourceId) => request(`/admin/resources/${resourceId}`, { method: 'DELETE' }),
  auditLogs: () => request('/admin/audit-logs'),
}

export function connectRealtime(handlers = {}) {
  const token = session.getToken()
  if (!token) return null
  const socket = io({ auth: { token }, transports: ['websocket', 'polling'] })
  Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler))
  return socket
}
