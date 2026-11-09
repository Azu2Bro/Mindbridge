import { useEffect, useRef, useState } from 'react'
import { api } from './api'

let googleScriptPromise
let initializedClientId = null
let activeCredentialHandler = null

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
      const script = existing || document.createElement('script')
      script.addEventListener('load', resolve, { once: true })
      script.addEventListener('error', () => reject(new Error('Google sign-in could not load')), { once: true })
      if (!existing) {
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        document.head.appendChild(script)
      }
    })
  }
  return googleScriptPromise
}

export default function GoogleSignInButton({ onCredential, disabled = false, text = 'continue_with' }) {
  const buttonRef = useRef(null)
  const handlerRef = useRef(onCredential)
  const [state, setState] = useState('loading')
  handlerRef.current = onCredential

  useEffect(() => {
    let mounted = true
    const handleCredential = (credential) => handlerRef.current?.(credential)
    activeCredentialHandler = handleCredential

    api.googleConfig()
      .then(async ({ enabled, clientId }) => {
        if (!enabled || !clientId) {
          if (mounted) setState('disabled')
          return
        }
        await loadGoogleScript()
        if (!mounted || !buttonRef.current) return
        if (initializedClientId !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => activeCredentialHandler?.(response.credential),
          })
          initializedClientId = clientId
        }
        buttonRef.current.replaceChildren()
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular',
          text, logo_alignment: 'left', width: Math.min(400, Math.max(240, buttonRef.current.clientWidth)),
        })
        setState('ready')
      })
      .catch(() => { if (mounted) setState('error') })

    return () => {
      mounted = false
      if (activeCredentialHandler === handleCredential) activeCredentialHandler = null
    }
  }, [text])

  if (state === 'disabled') return null
  return <div className={`google-login ${disabled ? 'disabled' : ''}`} aria-busy={state === 'loading'}>
    <div ref={buttonRef} />
    {state === 'loading' && <span>Loading Google sign-in…</span>}
    {state === 'error' && <span>Google sign-in is temporarily unavailable.</span>}
  </div>
}
