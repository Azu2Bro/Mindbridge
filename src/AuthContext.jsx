import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, session } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(session.getToken()))

  useEffect(() => {
    if (!session.getToken()) return
    api.me().then(({ user: currentUser }) => setUser(currentUser)).catch(() => session.setToken(null)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const expire = () => setUser(null)
    window.addEventListener('mentalbridge:session-expired', expire)
    return () => window.removeEventListener('mentalbridge:session-expired', expire)
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    async login(credentials) {
      const result = await api.login(credentials)
      session.setToken(result.token)
      setUser(result.user)
      return result.user
    },
    async googleLogin(credential) {
      const result = await api.googleLogin(credential)
      session.setToken(result.token)
      setUser(result.user)
      return result.user
    },
    async staffLogin(credentials) {
      const result = await api.staffLogin(credentials)
      session.setToken(result.token)
      setUser(result.user)
      return result.user
    },
    async staffGoogleLogin(credential) {
      const result = await api.staffGoogleLogin(credential)
      session.setToken(result.token)
      setUser(result.user)
      return result.user
    },
    async register(details) {
      return api.register(details)
    },
    logout() {
      session.setToken(null)
      setUser(null)
    },
    async refreshUser() {
      const result = await api.me()
      setUser(result.user)
      return result.user
    },
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
