import { useState } from 'react'
import { ArrowRight, ArrowUpRight, BookOpen, HeartHandshake, LifeBuoy, Mail, Menu, Moon, PhoneCall, ShieldCheck, Sparkles, Sun, UserRoundCheck, Users, X } from 'lucide-react'
import AuthScreen from './AuthScreen'

export default function LandingPage({ theme, toggleTheme, onAccountFlowComplete }) {
  const params = new URLSearchParams(window.location.search)
  const automaticMode = params.has('verify') ? 'login' : params.has('reset') ? 'reset' : params.get('mode') === 'forgot' ? 'forgot' : null
  const [auth, setAuth] = useState(automaticMode ? { mode: automaticMode } : null)
  const [menuOpen, setMenuOpen] = useState(false)
  const openAuth = (mode) => { setAuth({ mode }); setMenuOpen(false) }

  return <div className="landing-page">
    <header className="landing-nav">
      <a className="landing-brand" href="#top"><span className="brand-mark"><HeartHandshake size={23} /></span><span>Mental<span>Bridge</span></span></a>
      <nav className={menuOpen ? 'open' : ''} aria-label="Landing navigation"><a href="#how" onClick={() => setMenuOpen(false)}>How it works</a><a href="#safety" onClick={() => setMenuOpen(false)}>Safety</a><a href="#resources" onClick={() => setMenuOpen(false)}>Resources</a><button className="landing-login" onClick={() => openAuth('login')}>Login</button><button className="button button-coral" onClick={() => openAuth('register')}>Sign up</button></nav>
      <div className="landing-nav-actions"><button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={toggleTheme}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button><button className="landing-menu" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button></div>
    </header>

    <main id="top">
      <section className="landing-hero">
        <div className="landing-hero-copy"><span className="landing-kicker"><Sparkles size={15} /> AI-powered, human-centered peer support</span><h1>A gentler way to find someone who <em>understands.</em></h1><p>Share what is on your mind in your own words. MentalBridge organizes your needs and connects you with a suitable peer volunteer—privately and without judgment.</p><div className="landing-hero-actions"><button className="button button-coral" onClick={() => openAuth('register')}>Create a verified account <ArrowRight size={17} /></button><button className="button landing-outline" onClick={() => openAuth('login')}>Sign in</button></div><div className="landing-trust"><span><ShieldCheck size={17} /> Anonymous by default</span><span><UserRoundCheck size={17} /> Human moderated</span><span><HeartHandshake size={17} /> Non-clinical peer care</span></div></div>
        <div className="landing-visual" aria-label="MentalBridge support illustration"><span className="landing-orbit one" /><span className="landing-orbit two" /><div className="landing-heart"><HeartHandshake size={62} /></div><div className="landing-float volunteer"><span>MR</span><div><b>Maya R.</b><small>Peer supporter · Available</small></div></div><div className="landing-float safe"><ShieldCheck size={22} /><div><b>Your privacy comes first</b><small>Verified access, anonymous sharing</small></div></div></div>
      </section>

      <section className="landing-emergency"><LifeBuoy size={25} /><div><b>Need immediate help in Bangladesh?</b><span>MentalBridge is not an emergency service. Call the national emergency helpline now.</span></div><a href="tel:999">Call 999</a></section>

      <section className="landing-section" id="how"><div className="landing-section-head"><span className="eyebrow">HOW IT WORKS</span><h2>Support that begins with your own words.</h2><p>Technology helps coordinate the connection. People provide the care.</p></div><div className="landing-steps">{[
        ['01', 'Tell us what is happening', 'Write naturally—no forms full of clinical labels or complicated categories.'],
        ['02', 'Review your private summary', 'AI identifies support themes while you stay in control of what is shared.'],
        ['03', 'Meet a suitable peer', 'Choose from available volunteers whose lived experience matches your needs.'],
      ].map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

      <section className="landing-feature-band" id="safety"><div><span className="eyebrow light">SAFETY BY DESIGN</span><h2>A protected community, not an open social network.</h2><p>Verified email access, anonymous public identities, role-based permissions, audit logs, and trained moderation keep every workflow accountable.</p></div><div className="landing-safety-grid"><article><ShieldCheck /><b>Verified access</b><span>Email ownership is required before sign-in.</span></article><article><Users /><b>Care team oversight</b><span>Moderators coordinate people and content.</span></article><article><HeartHandshake /><b>Clear boundaries</b><span>Peer support never claims to replace therapy.</span></article></div></section>

      <section className="landing-section landing-resources" id="resources"><div className="resource-preview"><BookOpen size={35} /><span>Grounding</span><b>Return to the present, one sense at a time.</b></div><div><span className="eyebrow">PRACTICAL RESOURCE LIBRARY</span><h2>Helpful tools for real-life moments.</h2><p>Explore moderator-reviewed guides for anxiety, sleep, burnout, mindfulness, loneliness, and everyday self-care.</p><button className="button button-dark" onClick={() => openAuth('register')}>Explore after sign up <ArrowRight size={16} /></button></div></section>
    </main>
    <footer className="landing-footer">
      <div className="landing-footer-top">
        <div className="landing-footer-brand">
          <a className="landing-brand" href="#top"><span className="brand-mark"><HeartHandshake size={20} /></span><span>Mental<span>Bridge</span></span></a>
          <p>A gentler doorway to peer support, built for honest moments and human connection.</p>
          <span className="landing-footer-badge"><ShieldCheck size={15} /> Private by default</span>
        </div>
        <div className="landing-footer-column"><h3>Explore</h3><a href="#how">How it works <ArrowUpRight size={14} /></a><a href="#safety">Safety by design <ArrowUpRight size={14} /></a><a href="#resources">Resource library <ArrowUpRight size={14} /></a></div>
        <div className="landing-footer-column"><h3>Get started</h3><button onClick={() => openAuth('register')}>Create an account <ArrowUpRight size={14} /></button><button onClick={() => openAuth('login')}>Login <ArrowUpRight size={14} /></button><a href="/staff">Staff portal <ArrowUpRight size={14} /></a></div>
        <div className="landing-footer-contact"><span className="landing-footer-contact-icon"><Mail size={18} /></span><div><h3>Need a hand?</h3><p>Questions about MentalBridge or your account?</p><a href="mailto:tafhimul456@gmail.com">Email our support team <ArrowRight size={14} /></a></div></div>
      </div>
      <div className="landing-footer-bottom"><span>© {new Date().getFullYear()} MentalBridge. Made with care in Bangladesh.</span><span className="landing-footer-emergency"><PhoneCall size={14} /> Emergency help: <a href="tel:999">999</a></span><span>Peer support coordination—not diagnosis or therapy.</span></div>
    </footer>
    {auth && <AuthScreen key={auth.mode} initialMode={auth.mode} onClose={() => { window.history.replaceState({}, '', window.location.pathname); setAuth(null); onAccountFlowComplete?.() }} />}
  </div>
}
