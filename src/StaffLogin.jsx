import { useState } from 'react'
import { ArrowRight, CheckCircle2, Eye, EyeOff, HeartHandshake, LoaderCircle, LockKeyhole, Mail, ScrollText, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useAuth } from './AuthContext'
import { api } from './api'

export default function StaffLogin({ theme }) {
  const { staffLogin } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'forgot'
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotSent, setForgotSent] = useState(false)

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await staffLogin({ email: form.email.trim(), password: form.password })
      window.history.replaceState({}, '', '/')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setLoading(false)
    }
  }

  const submitForgot = async (event) => {
    event.preventDefault()
    setForgotLoading(true)
    setForgotError('')
    try {
      await api.forgotPassword(forgotEmail.trim())
      setForgotSent(true)
    } catch (err) {
      setForgotError(err.message)
    } finally {
      setForgotLoading(false)
    }
  }

  return <div className="staff-page" data-theme={theme === 'dark' ? 'dark' : undefined}>
    <div className="staff-backdrop" aria-hidden="true"><i /><i /><i /></div>

    <header className="staff-topbar">
      <button className="staff-brand" onClick={() => { setMode('login'); setForgotSent(false); setForgotError('') }} type="button"><span className="brand-mark"><HeartHandshake size={22} /></span><span>Mental<span>Bridge</span></span></button>
      <span className="staff-badge"><LockKeyhole size={14} /> Staff portal</span>
    </header>

    <main className="staff-main">
      <section className="staff-intro">
        <span className="eyebrow light">RESTRICTED ACCESS</span>
        <h1>Care operations console.</h1>
        <p>This entrance is reserved for moderators and administrators. Member and volunteer accounts sign in from the main site.</p>
        <ul className="staff-facts">
          <li><ShieldAlert size={18} /><div><b>Separate from member sign-in</b><span>Staff credentials are checked by their own endpoint, so a member account can never authenticate here.</span></div></li>
          <li><LockKeyhole size={18} /><div><b>Stricter attempt limit</b><span>Repeated failures on this portal are throttled well before the member portal would be.</span></div></li>
          <li><ScrollText size={18} /><div><b>Every attempt is recorded</b><span>Successful and refused staff sign-ins are written to the audit log with the role and timestamp.</span></div></li>
        </ul>
      </section>

      {mode === 'login' ? (
        <form className="staff-card" onSubmit={submit}>
          <h2>Sign in as staff</h2>
          <p>Use the work email attached to your moderator or administrator role.</p>

          <label className="auth-field">
            <span>Staff email address</span>
            <input type="email" required value={form.email} onChange={update('email')} placeholder="you@mentalbridge.demo" autoComplete="email" />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <div>
              <input type={showPassword ? 'text' : 'password'} required minLength={8} value={form.password} onChange={update('password')} autoComplete="current-password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </label>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <button className="button button-dark auth-submit" disabled={loading}>
            {loading ? <><LoaderCircle className="spin" size={17} /> Verifying…</> : <>Enter the console <ArrowRight size={17} /></>}
          </button>

          <button type="button" className="forgot-link" onClick={() => { setMode('forgot'); setForgotSent(false); setForgotError(''); setForgotEmail(form.email) }}>Set up account or reset password</button>
          <div className="auth-security"><ShieldCheck size={16} /> Staff sessions carry elevated permissions. Never share these credentials.</div>
        </form>
      ) : (
        <form className="staff-card" onSubmit={submitForgot}>
          <h2>Reset your staff password</h2>
          <p>Enter the email attached to your staff account. We'll send a password reset link.</p>

          {forgotSent ? (
            <div className="staff-reset-sent">
              <CheckCircle2 size={28} />
              <p><b>Check your inbox.</b> If a staff account exists for that address, a reset link has been sent. It expires in 30 minutes.</p>
              <button type="button" className="button button-dark auth-submit" onClick={() => { setMode('login'); setForgotSent(false) }}>Back to sign-in</button>
            </div>
          ) : (
            <>
              <label className="auth-field">
                <span>Staff email address</span>
                <div style={{ position: 'relative' }}>
                  <input type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@mentalbridge.demo" autoComplete="email" />
                  <Mail size={17} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.35, pointerEvents: 'none' }} />
                </div>
              </label>

              {forgotError && <div className="auth-error" role="alert">{forgotError}</div>}

              <button className="button button-dark auth-submit" disabled={forgotLoading}>
                {forgotLoading ? <><LoaderCircle className="spin" size={17} /> Sending…</> : <>Send reset link <ArrowRight size={17} /></>}
              </button>

              <button type="button" className="forgot-link" onClick={() => setMode('login')}>Back to sign-in</button>
            </>
          )}

          <div className="auth-security"><ShieldCheck size={16} /> Password reset links are single-use and expire after 30 minutes.</div>
        </form>
      )}
    </main>
  </div>
}
