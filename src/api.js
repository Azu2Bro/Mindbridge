import { io } from 'socket.io-client'

const TOKEN_KEY = 'mentalbridge-token'

export const session = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token) => token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY),
}

async function request(path, options = {}) {
  const token = session.getToken()
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') session.setToken(null)
    throw new Error(data.error || `Request failed (${response.status})`)
  }
  return data
}

const json = (method, body) => ({ method, body: JSON.stringify(body) })

export const api = {
  health: () => request('/health'),
  login: (credentials) => request('/auth/login', json('POST', credentials)),
  register: (details) => request('/auth/register', json('POST', details)),
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
  moods: () => request('/moods'),
  saveMood: (entry) => request('/moods', json('POST', entry)),
  posts: (category = '') => request(`/posts${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  createPost: (post) => request('/posts', json('POST', post)),
  reactToPost: (postId) => request(`/posts/${postId}/reactions`, json('POST', {})),
  reportPost: (postId, reason) => request(`/posts/${postId}/report`, json('POST', { reason })),
  resources: (query = '', category = '') => request(`/resources?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`),
  toggleBookmark: (resourceId) => request(`/resources/${resourceId}/bookmark`, json('POST', {})),
  conversations: () => request('/conversations'),
  messages: (conversationId) => request(`/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, text) => request(`/conversations/${conversationId}/messages`, json('POST', { text })),
  notifications: () => request('/notifications'),
  markNotificationsRead: () => request('/notifications/read', json('POST', {})),
  adminStats: () => request('/admin/stats'),
}

export function connectRealtime(handlers = {}) {
  const token = session.getToken()
  if (!token) return null
  const socket = io({ auth: { token }, transports: ['websocket', 'polling'] })
  Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler))
  return socket
}
