import { useState } from 'react'
import { ArrowRight, Check, Eye, EyeOff, HeartHandshake, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from './AuthContext'
import { api } from './api'

export default function AuthScreen() {
  const { login, register } = useAuth()
  const urlResetToken = new URLSearchParams(window.location.search).get('reset') || ''
  const [mode, setMode] = useState(urlResetToken ? 'reset' : 'login')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [resetToken, setResetToken] = useState(urlResetToken)
  const [form, setForm] = useState({ displayName: '', anonymousName: '', email: 'alex@mentalbridge.demo', password: 'Demo123!' })

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'login') await login({ email: form.email, password: form.password })
      else if (mode === 'register') await register(form)
      else if (mode === 'forgot') {
        const result = await api.forgotPassword(form.email)
        if (result.resetToken) { setResetToken(result.resetToken); setMode('reset'); setNotice('A local development reset token was generated for this account.') }
        else setNotice(result.message)
      } else if (mode === 'reset') {
        await api.resetPassword(resetToken, form.password)
        setMode('login')
        setNotice('Your password has been changed. You can sign in now.')
      }
    } catch (submitError) {
      setError(submitError.message.includes('fetch') ? 'The API is not reachable. Start the project with “npm run dev”.' : submitError.message)
    } finally { setLoading(false) }
  }

  const useDemo = () => setForm({ ...form, email: 'alex@mentalbridge.demo', password: 'Demo123!' })

  return <div className="auth-page">
    <section className="auth-story">
      <div className="auth-brand"><span className="brand-mark"><HeartHandshake size={24} /></span><span>Mental<span>Bridge</span></span></div>
      <div className="auth-story-copy"><span className="eyebrow light"><Sparkles size={14} /> PEER SUPPORT, MADE PERSONAL</span><h1>You don’t have to find the right words alone.</h1><p>Share what is happening in your own words. MentalBridge helps organize the heart of it and connects you with someone who understands.</p><div className="auth-trust-list"><span><Check size={15} /> Anonymous by default</span><span><Check size={15} /> Trained peer supporters</span><span><Check size={15} /> Moderated for community safety</span></div></div>
      <div className="auth-privacy"><ShieldCheck size={19} /><span><b>Your privacy comes first.</b><small>Your support conversations are visible only to the people involved and authorized safety moderators.</small></span></div>
      <div className="auth-orbits"><i /><i /><span><HeartHandshake size={48} /></span></div>
    </section>
    <section className="auth-panel">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-mobile-brand"><span className="brand-mark"><HeartHandshake size={20} /></span><b>MentalBridge</b></div>
        <span className="eyebrow">A SAFE PLACE TO BEGIN</span>
        <h2>{mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your private space' : mode === 'forgot' ? 'Reset your password' : 'Choose a new password'}</h2>
        <p>{mode === 'login' ? 'Sign in to continue your support journey.' : mode === 'register' ? 'Your public community identity can stay completely anonymous.' : mode === 'forgot' ? 'Enter your account email to create a secure reset link.' : 'Use a strong password you have not used for this account before.'}</p>
        {mode === 'register' && <div className="auth-field-row"><label><span>Your name</span><input required value={form.displayName} onChange={update('displayName')} placeholder="Alex Morgan" /></label><label><span>Anonymous name</span><input value={form.anonymousName} onChange={update('anonymousName')} placeholder="StillWaters" /></label></div>}
        {mode !== 'reset' && <label className="auth-field"><span>Email address</span><input type="email" required value={form.email} onChange={update('email')} placeholder="you@example.com" autoComplete="email" /></label>}
        {mode !== 'forgot' && <label className="auth-field"><span>{mode === 'reset' ? 'New password' : 'Password'}</span><div><input type={showPassword ? 'text' : 'password'} required minLength={8} value={form.password} onChange={update('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>}
        {['register', 'reset'].includes(mode) && <div className="password-hint"><LockKeyhole size={14} /> Use 8+ characters with an uppercase letter and number.</div>}
        {mode === 'login' && <button type="button" className="forgot-link" onClick={() => { setMode('forgot'); setError(''); setNotice('') }}>Forgot your password?</button>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        {notice && <div className="auth-notice" role="status">{notice}</div>}
        <button className="button button-dark auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={17} /> Please wait…</> : <>{mode === 'login' ? 'Sign in securely' : mode === 'register' ? 'Create my account' : mode === 'forgot' ? 'Create reset link' : 'Save new password'} <ArrowRight size={17} /></>}</button>
        {mode === 'login' && <button type="button" className="demo-login" onClick={useDemo}>Use demo account <span>alex@mentalbridge.demo</span></button>}
        <div className="auth-switch">{mode === 'login' ? 'New to MentalBridge?' : 'Ready to return?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setNotice('') }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></div>
        <small className="auth-disclaimer">MentalBridge provides peer support, not clinical diagnosis, therapy, or emergency response.</small>
      </form>
    </section>
  </div>
}
