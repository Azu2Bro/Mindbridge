import jwt from 'jsonwebtoken'

const fallbackSecret = 'mentalbridge-development-secret-change-before-production'

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.displayName, version: user.tokenVersion || 0 },
    process.env.JWT_SECRET || fallbackSecret,
    { expiresIn: '7d', issuer: 'mentalbridge' },
  )
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || fallbackSecret, { issuer: 'mentalbridge' })
}

export function publicUser(user) {
  if (!user) return null
  const { passwordHash, ...safe } = user
  return safe
}

export function authRequired(storeInstance) {
  return (req, res, next) => {
    try {
      const header = req.headers.authorization || ''
      const token = header.startsWith('Bearer ') ? header.slice(7) : null
      if (!token) return res.status(401).json({ error: 'Authentication required' })
      const payload = verifyToken(token)
      const user = storeInstance.data.users.find((item) => item.id === payload.sub && item.status === 'active' && item.emailVerified)
      if (!user || (payload.version || 0) !== (user.tokenVersion || 0)) return res.status(401).json({ error: 'Account is unavailable' })
      req.user = user
      next()
    } catch {
      res.status(401).json({ error: 'Your session is invalid or has expired' })
    }
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: 'You do not have permission to perform this action' })
}
