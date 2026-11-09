import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, HeartHandshake, LoaderCircle, LockKeyhole, MailCheck, ShieldCheck, X } from 'lucide-react'
import { useAuth } from './AuthContext'
import { api } from './api'
import GoogleSignInButton from './GoogleSignInButton'
import ProfilePicturePicker from './ProfilePicturePicker'

export default function AuthScreen({ initialMode = 'login', onClose }) {
  const { login, register, googleLogin } = useAuth()
  const [params] = useState(() => new URLSearchParams(window.location.search))
  const verificationStarted = useRef(false)
  const clearTokens = () => { const url = new URL(window.location.href); url.searchParams.delete('reset'); url.searchParams.delete('verify'); window.history.replaceState({}, '', url.pathname + url.search + url.hash) }
  const urlResetToken = params.get('reset') || ''
  const urlVerificationToken = params.get('verify') || ''
  const [mode, setMode] = useState(urlResetToken ? 'reset' : urlVerificationToken ? 'verifying' : initialMode)
  const [staffHint, setStaffHint] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(Boolean(urlVerificationToken))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [resetToken, setResetToken] = useState(urlResetToken)
  const [verificationToken, setVerificationToken] = useState('')
  const [form, setForm] = useState({ displayName: '', anonymousName: '', email: '', password: '', avatarUrl: '', experience: '', motivation: '' })

  useEffect(() => {
    if (!urlVerificationToken || verificationStarted.current) return
    verificationStarted.current = true
    clearTokens()
    api.verifyEmail(urlVerificationToken)
      .then((result) => { setMode('verified'); setNotice(result.message) })
      .catch((requestError) => { setMode('verified'); setError(requestError.message) })
      .finally(() => setLoading(false))
  }, [urlVerificationToken])

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const changeMode = (nextMode) => { clearTokens(); setMode(nextMode); setError(''); setNotice(''); setVerificationToken(''); setStaffHint(false) }
  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    setStaffHint(false)
    try {
      if (mode === 'login') { await login({ email: form.email, password: form.password }); onClose?.() }
      else if (mode === 'register') {
        const result = await register({ ...form, anonymousName: form.anonymousName.trim() || undefined, avatarUrl: form.avatarUrl || undefined })
        setVerificationToken(result.verificationToken || '')
        setNotice(result.message)
        setMode('pending')
      } else if (mode === 'volunteerApply') {
        const result = await api.applyVolunteer({ name: form.displayName, email: form.email, experience: form.experience, motivation: form.motivation })
        setNotice(result.message)
        setMode('applicationSent')
      } else if (mode === 'resend') {
        const result = await api.resendVerification(form.email)
        setVerificationToken(result.verificationToken || '')
        setNotice(result.message)
        setMode('pending')
      } else if (mode === 'forgot') {
        const result = await api.forgotPassword(form.email)
        if (result.resetToken) { setResetToken(result.resetToken); setMode('reset'); setNotice('A development reset link was generated.') }
        else setNotice(result.message)
      } else if (mode === 'reset') {
        await api.resetPassword(resetToken, form.password)
        clearTokens()
        setResetToken('')
        setForm((current) => ({ ...current, password: '' }))
        setMode('login')
        setNotice('Your password has been changed. You can sign in now.')
      }
    } catch (submitError) { setError(submitError.message); setStaffHint(Boolean(submitError.details?.staffPortal)); if (submitError.details?.verificationRequired) setMode('pending') }
    finally { setLoading(false) }
  }

  const resend = async () => {
    setLoading(true); setError('')
    try {
      const result = await api.resendVerification(form.email)
      setVerificationToken(result.verificationToken || '')
      setNotice(result.message)
    } catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }

  const verifyDevelopmentAccount = async () => {
    setLoading(true); setError('')
    try { const result = await api.verifyEmail(verificationToken); setNotice(result.message); setMode('verified') }
    catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }

  const handleGoogleCredential = async (credential) => {
    setLoading(true); setError(''); setNotice(''); setStaffHint(false)
    try { await googleLogin(credential); onClose?.() }
    catch (requestError) { setError(requestError.message); setStaffHint(Boolean(requestError.details?.staffPortal)) }
    finally { setLoading(false) }
  }

  const title = mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your private space' : mode === 'volunteerApply' ? 'Apply to become a volunteer' : mode === 'resend' ? 'Resend verification email' : mode === 'forgot' ? 'Reset your password' : mode === 'reset' ? 'Choose a new password' : mode === 'pending' ? 'Check your inbox' : 'Email verification'

  return <div className="auth-overlay" role="presentation">
    <section className="auth-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <div className="auth-dialog-story">
        <div className="auth-brand"><span className="brand-mark"><HeartHandshake size={23} /></span><span>Mental<span>Bridge</span></span></div>
        <div><span className="eyebrow light">PRIVATE · VERIFIED · HUMAN</span><h2>A safer doorway to peer support.</h2><p>Every account uses a verified email. Community participation stays anonymous.</p></div>
      </div>
      <form className="auth-card" onSubmit={submit}>
        {onClose && <button type="button" className="auth-close" aria-label="Close sign in" onClick={onClose}><X size={19} /></button>}
        {!onClose && <button type="button" className="auth-back" onClick={() => window.location.assign('/')}><ArrowLeft size={16} /> Back home</button>}
        <span className="eyebrow">A SAFE PLACE TO BEGIN</span>
        <h2>{title}</h2>
        {mode === 'login' && <p>Sign in to the member and volunteer space.</p>}
        {mode === 'volunteerApply' && <p>Moderators review every application before volunteer access is granted.</p>}
        {mode === 'register' && <p>Use a real email address. You must verify it before your first sign-in.</p>}
        {mode === 'forgot' && <p>Enter your account email to receive a secure reset link.</p>}
        {mode === 'reset' && <p>Use a strong password you have not used for this account before.</p>}
        {mode === 'applicationSent' ? <div className="verification-state"><span><ShieldCheck size={30} /></span><p>{notice}</p><button type="button" className="button button-dark" onClick={() => changeMode('login')}>Continue to login <ArrowRight size={16} /></button></div> : ['pending', 'verified', 'verifying'].includes(mode) ? <div className="verification-state"><span><MailCheck size={30} /></span><p>{mode === 'verifying' ? 'Verifying your email…' : notice || 'Open the link sent to your email address.'}</p>{error && <div className="auth-error" role="alert">{error}</div>}{mode === 'pending' && <><small>Sent for: {form.email}</small><button type="button" className="button button-secondary" disabled={loading} onClick={resend}>Resend verification email</button>{verificationToken && <button type="button" className="button button-dark" disabled={loading} onClick={verifyDevelopmentAccount}>Verify development account</button>}</>}{mode === 'verified' && error && <button type="button" className="button button-secondary" onClick={() => changeMode('resend')}>Request a new verification link</button>}{mode === 'verified' && !error && <button type="button" className="button button-dark" onClick={() => changeMode('login')}>Continue to sign in <ArrowRight size={16} /></button>}</div> : <>
          {['login', 'register'].includes(mode) && <><GoogleSignInButton onCredential={handleGoogleCredential} disabled={loading} /><div className="auth-divider"><span>or use email</span></div></>}
          {mode === 'volunteerApply' && <><div className="auth-field-row"><label><span>Your name</span><input required minLength={2} maxLength={70} value={form.displayName} onChange={update('displayName')} /></label><label><span>Email address</span><input type="email" required value={form.email} onChange={update('email')} /></label></div><label className="auth-field"><span>Relevant experience</span><textarea className="volunteer-application-textarea" required minLength={20} maxLength={1200} value={form.experience} onChange={update('experience')} placeholder="Tell moderators about your lived or peer-support experience." /></label><label className="auth-field"><span>Why would you like to volunteer?</span><textarea className="volunteer-application-textarea" required minLength={20} maxLength={1200} value={form.motivation} onChange={update('motivation')} placeholder="Share how you would support members safely." /></label></>}
          {mode === 'register' && <><div className="auth-field-row"><label><span>Your name</span><input required minLength={2} maxLength={70} value={form.displayName} onChange={update('displayName')} placeholder="Your private name" /></label><label><span>Anonymous name <em>(optional)</em></span><input minLength={3} maxLength={40} value={form.anonymousName} onChange={update('anonymousName')} placeholder="QuietRiver" /><small className="field-hint">Bengali and English names are supported. Leave blank for an automatic private name.</small></label></div><ProfilePicturePicker value={form.avatarUrl} onChange={(avatarUrl) => setForm({ ...form, avatarUrl })} /></>}
          {mode !== 'reset' && !['volunteerApply'].includes(mode) && <label className="auth-field"><span>Email address</span><input type="email" required value={form.email} onChange={update('email')} placeholder="you@example.com" autoComplete="email" /></label>}
          {!['forgot', 'resend', 'volunteerApply'].includes(mode) && <label className="auth-field"><span>{mode === 'reset' ? 'New password' : 'Password'}</span><div><input type={showPassword ? 'text' : 'password'} required minLength={8} value={form.password} onChange={update('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>}
          {['register', 'reset'].includes(mode) && <div className="password-hint"><LockKeyhole size={14} /> Use 8+ characters with an uppercase letter and number.</div>}
          {mode === 'login' && <button type="button" className="forgot-link" onClick={() => changeMode('forgot')}>Forgot your password?</button>}
          {error && <div className="auth-error" role="alert">{error}{staffHint && <a className="auth-error-link" href="/staff">Go to the staff portal <ArrowRight size={13} /></a>}</div>}
          {notice && <div className="auth-notice" role="status">{notice}</div>}
          <button className="button button-dark auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={17} /> Please wait…</> : <>{mode === 'login' ? 'Login' : mode === 'register' ? 'Create & verify account' : mode === 'volunteerApply' ? 'Submit application' : mode === 'resend' ? 'Send verification link' : mode === 'forgot' ? 'Send reset link' : 'Save new password'} <ArrowRight size={17} /></>}</button>
          <div className="auth-switch">{mode === 'login' ? 'New to MentalBridge?' : 'Ready to return?'} <button type="button" onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></div>
        </>}
        <div className="auth-security"><ShieldCheck size={16} /> MentalBridge never displays your email publicly.</div>
      </form>
    </section>
  </div>
}
