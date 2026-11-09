import { useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, HeartHandshake, LoaderCircle, LockKeyhole, ScrollText, ShieldAlert, ShieldCheck, UserCog } from 'lucide-react'
import { useAuth } from './AuthContext'
import GoogleSignInButton from './GoogleSignInButton'

const demoAccounts = [
  { role: 'Moderator', email: 'moderator@mentalbridge.demo', icon: UserCog },
  { role: 'Administrator', email: 'admin@mentalbridge.demo', icon: ShieldCheck },
]

export default function StaffLogin({ theme }) {
  const { staffLogin, staffGoogleLogin } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  const handleGoogleCredential = async (credential) => {
    setLoading(true)
    setError('')
    try {
      await staffGoogleLogin(credential)
      window.history.replaceState({}, '', '/')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setLoading(false)
    }
  }

  return <div className="staff-page" data-theme={theme === 'dark' ? 'dark' : undefined}>
    <div className="staff-backdrop" aria-hidden="true"><i /><i /><i /></div>

    <header className="staff-topbar">
      <a className="staff-brand" href="/"><span className="brand-mark"><HeartHandshake size={22} /></span><span>Mental<span>Bridge</span></span></a>
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

      <form className="staff-card" onSubmit={submit}>
        <a className="staff-back" href="/"><ArrowLeft size={16} /> Back to the member site</a>
        <h2>Sign in as staff</h2>
        <p>Use the work email attached to your moderator or administrator role.</p>

        <GoogleSignInButton onCredential={handleGoogleCredential} disabled={loading} text="signin_with" />
        <div className="auth-divider"><span>or use staff credentials</span></div>

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

        <a className="forgot-link" href="/?mode=forgot">Set up account or reset password</a>
        <div className="staff-demo">
          <small>Demo accounts for review</small>
          {demoAccounts.map(({ role, email, icon: Icon }) => (
            <button type="button" key={email} onClick={() => setForm({ email, password: 'Demo123!' })}>
              <Icon size={16} /><b>{role}</b><span>{email}</span>
            </button>
          ))}
        </div>

        <div className="auth-security"><ShieldCheck size={16} /> Staff sessions carry elevated permissions. Never share these credentials.</div>
      </form>
    </main>
  </div>
}
