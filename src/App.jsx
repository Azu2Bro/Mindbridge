import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bookmark,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Coffee,
  FileText,
  Filter,
  Flag,
  Headphones,
  Heart,
  HeartHandshake,
  Info,
  LayoutDashboard,
  Leaf,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  MoonStar,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  SmilePlus,
  Sparkles,
  TrendingUp,
  UserCog,
  UserRoundCheck,
  Users,
  Wind,
  X,
} from 'lucide-react'
import { api, connectRealtime } from './api'
import AuthScreen from './AuthScreen'
import { useAuth } from './AuthContext'

const navItems = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'support', label: 'Peer support', icon: HeartHandshake, badge: 1 },
  { id: 'messages', label: 'Messages', icon: MessageCircle, badge: 2 },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'mood', label: 'Mood journal', icon: SmilePlus },
  { id: 'resources', label: 'Resources', icon: BookOpen },
]

const moods = [
  { score: 1, face: '😞', label: 'Struggling', color: '#d66b5d' },
  { score: 2, face: '😕', label: 'Low', color: '#d99b54' },
  { score: 3, face: '😐', label: 'Okay', color: '#c6a451' },
  { score: 4, face: '🙂', label: 'Good', color: '#6c9f79' },
  { score: 5, face: '😊', label: 'Great', color: '#2c775c' },
]

const volunteers = [
  {
    id: 1,
    name: 'Maya R.',
    initials: 'MR',
    role: 'Peer supporter',
    match: 96,
    color: '#f2bf8e',
    experience: 'Anxiety · Work stress · Burnout',
    bio: 'I know how isolating workplace anxiety can feel. I am here to listen without judgment and help you find your next small step.',
    status: 'Available today',
  },
  {
    id: 2,
    name: 'Sam K.',
    initials: 'SK',
    role: 'Peer supporter',
    match: 91,
    color: '#93c5b1',
    experience: 'Loneliness · Life transitions · Self-esteem',
    bio: 'My own recovery taught me the value of being truly heard. We can take things one conversation at a time.',
    status: 'Available tomorrow',
  },
  {
    id: 3,
    name: 'Nora A.',
    initials: 'NA',
    role: 'Peer supporter',
    match: 87,
    color: '#aab7d4',
    experience: 'Low mood · Grief · Family pressure',
    bio: 'I offer a calm, patient space for difficult days and have lived experience navigating grief and cultural expectations.',
    status: 'Available Wed',
  },
]

const starterPosts = [
  {
    id: 1,
    author: 'QuietRiver',
    initials: 'QR',
    time: '18 min ago',
    category: 'Small wins',
    title: 'I went outside today, even though every part of me wanted to stay in bed',
    body: 'It was only a ten-minute walk, but I noticed the air was cool and the trees were moving. Sharing this here because small still counts.',
    likes: 42,
    comments: 12,
    color: '#d5a36d',
  },
  {
    id: 2,
    author: 'SoftMorning',
    initials: 'SM',
    time: '1 hr ago',
    category: 'Anxiety',
    title: 'What helps you quiet the Sunday evening spiral?',
    body: 'I keep thinking through every possible thing that could go wrong at work. Looking for grounding routines that have genuinely helped people.',
    likes: 28,
    comments: 19,
    color: '#8cb7a3',
  },
  {
    id: 3,
    author: 'NewLeaf',
    initials: 'NL',
    time: '3 hrs ago',
    category: 'Burnout',
    title: 'Learning that rest does not have to be earned',
    body: 'My peer supporter said something that stayed with me: exhaustion is information, not a personal failure. Maybe someone else needs that today.',
    likes: 67,
    comments: 8,
    color: '#a9b8d1',
  },
]

const resources = [
  { id: 1, type: '3 min read', category: 'Anxiety', title: 'A gentle guide to grounding yourself', description: 'Five evidence-informed techniques for returning to the present when your thoughts begin to race.', icon: Wind, color: 'sage', featured: true },
  { id: 2, type: '6 min listen', category: 'Mindfulness', title: 'A pause for difficult moments', description: 'A short guided practice to help you make room for what you are feeling.', icon: Headphones, color: 'lavender' },
  { id: 3, type: '5 min read', category: 'Burnout', title: 'When your body says enough', description: 'Recognizing early signs of burnout and responding with compassion instead of guilt.', icon: Coffee, color: 'apricot' },
  { id: 4, type: 'Worksheet', category: 'Self-care', title: 'Build your personal support map', description: 'A printable exercise for identifying the people, places, and practices you can lean on.', icon: FileText, color: 'blue' },
  { id: 5, type: '8 min read', category: 'Sleep', title: 'Unwinding a busy mind before bed', description: 'Small, realistic shifts that can help your nervous system prepare for rest.', icon: MoonStar, color: 'navy' },
  { id: 6, type: '4 min read', category: 'Loneliness', title: 'Connection when reaching out feels hard', description: 'Low-pressure ways to reconnect without asking more of yourself than you can give.', icon: HeartHandshake, color: 'rose' },
]

const resourceIconMap = { Wind, Headphones, Coffee, FileText, MoonStar, HeartHandshake, BookOpen }

const conversations = [
  { id: 1, name: 'Maya R.', initials: 'MR', preview: 'That sounds like a lot to carry alone.', time: '10:42', unread: 2, color: '#f2bf8e', online: true },
  { id: 2, name: 'Support coordinator', initials: 'SC', preview: 'Your check-in summary is ready.', time: 'Yesterday', unread: 0, color: '#8cb7a3' },
  { id: 3, name: 'Nora A.', initials: 'NA', preview: 'Take all the time you need.', time: 'Mon', unread: 0, color: '#aab7d4' },
]

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initialValue
    } catch {
      return initialValue
    }
  })
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])
  return [value, setValue]
}

function App() {
  const { user, loading: authLoading, logout } = useAuth()
  const [active, setActive] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(() => new URLSearchParams(window.location.search).get('support') === 'open')
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [moodEntries, setMoodEntries] = useStoredState('mentalbridge-moods', [
    { day: 'Mon', score: 2 }, { day: 'Tue', score: 3 }, { day: 'Wed', score: 3 },
    { day: 'Thu', score: 4 }, { day: 'Fri', score: 3 }, { day: 'Sat', score: 4 },
  ])

  const showToast = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  useEffect(() => {
    if (!user) return undefined
    api.moods().then(({ moods }) => {
      setMoodEntries(moods.slice(-7).map((entry) => ({
        id: entry.id,
        day: new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'short' }),
        score: entry.score,
        journal: entry.journal,
      })))
    }).catch(() => undefined)
    const socket = connectRealtime({
      notification: (notification) => showToast(notification.title),
      message: () => window.dispatchEvent(new CustomEvent('mentalbridge:message')),
    })
    return () => socket?.disconnect()
  }, [user?.id])

  const navigate = (id) => {
    setActive(id)
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const titles = {
    home: [`Good morning, ${user?.displayName?.split(' ')[0] || 'friend'}`, 'Take a breath. You’re in a safe place.'],
    support: ['Peer support', 'Thoughtful connection, matched to what you need.'],
    messages: ['Messages', 'A private space for your peer-support conversations.'],
    community: ['Community', 'Real people, honest moments, shared gently.'],
    mood: ['Mood journal', 'Notice patterns without judging the day.'],
    resources: ['Resource library', 'Practical tools for wherever you are today.'],
    admin: ['Care operations', 'Safety, coordination, and community health at a glance.'],
  }

  const page = {
    home: <HomeView onNavigate={navigate} onSupport={() => setSupportOpen(true)} moodEntries={moodEntries} setMoodEntries={setMoodEntries} showToast={showToast} />,
    support: <SupportView onSupport={() => setSupportOpen(true)} onNavigate={navigate} />,
    messages: <MessagesView showToast={showToast} user={user} />,
    community: <CommunityView showToast={showToast} user={user} />,
    mood: <MoodView moodEntries={moodEntries} setMoodEntries={setMoodEntries} showToast={showToast} />,
    resources: <ResourcesView showToast={showToast} />,
    admin: <AdminView />,
  }[active]

  if (authLoading) return <div className="app-loading"><span className="brand-mark"><HeartHandshake size={24} /></span><LoaderCircle className="spin" size={22} /><p>Opening your private space…</p></div>
  if (!user) return <AuthScreen />

  return (
    <div className="app-shell">
      <Sidebar active={active} navigate={navigate} open={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} />
      <div className="app-main">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
          <div className="page-heading">
            <h1>{titles[active][0]}</h1>
            <p>{titles[active][1]}</p>
          </div>
          <div className="topbar-actions">
            <button className="search-button" onClick={() => navigate('resources')} aria-label="Search resources">
              <Search size={18} /><span>Search</span><kbd>⌘ K</kbd>
            </button>
            <div className="popover-wrap">
              <button className="icon-button notification-button" aria-label="Notifications" onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false) }}>
                <Bell size={19} /><span className="notification-dot" />
              </button>
              {notificationsOpen && <NotificationPopover onClose={() => setNotificationsOpen(false)} />}
            </div>
            <div className="popover-wrap">
              <button className="profile-trigger" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false) }} aria-label="Open profile menu">
                <span className="avatar avatar-user">{user.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
                <span className="profile-name">{user.displayName}</span>
                <ChevronDown size={15} />
              </button>
              {profileOpen && <ProfilePopover navigate={navigate} close={() => setProfileOpen(false)} user={user} logout={logout} />}
            </div>
          </div>
        </header>

        <main className="page-content">{page}</main>
        <footer className="app-footer">
          <span><ShieldCheck size={15} /> Your privacy matters. MentalBridge is a peer-support service, not clinical care.</span>
          <button onClick={() => showToast('Safety center opened')}>Safety & privacy</button>
        </footer>
      </div>
      {supportOpen && <SupportModal onClose={() => setSupportOpen(false)} onComplete={() => { setSupportOpen(false); showToast('Your support request has been shared securely'); navigate('support') }} />}
      {toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  )
}

function Sidebar({ active, navigate, open, onClose, user }) {
  return (
    <>
      {open && <button className="sidebar-scrim" aria-label="Close menu" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <button className="brand" onClick={() => navigate('home')} aria-label="MentalBridge home">
            <span className="brand-mark"><HeartHandshake size={24} /></span>
            <span>Mental<span>Bridge</span></span>
          </button>
          <button className="icon-button sidebar-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>
        <div className="care-pill"><span className="pulse-dot" /> Community care is active</div>
        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">YOUR SPACE</p>
          {navItems.map(({ id, label, icon: Icon, badge }) => (
            <button key={id} className={`nav-item ${active === id ? 'active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={19} strokeWidth={1.9} /><span>{label}</span>{badge && <em>{badge}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="supporter-card">
          <div className="mini-avatars"><span>MR</span><span>SK</span><span>+24</span></div>
          <h3>Someone is here</h3>
          <p>24 trained peer supporters are available this week.</p>
          <button onClick={() => navigate('support')}>Find support <ArrowRight size={15} /></button>
        </div>
        <div className="sidebar-bottom">
          {['moderator', 'admin'].includes(user.role) && <button className="nav-item" onClick={() => navigate('admin')}><UserCog size={19} /><span>Care operations</span></button>}
          <button className="nav-item"><Settings size={19} /><span>Settings</span></button>
          <button className="nav-item"><CircleHelp size={19} /><span>Help center</span></button>
        </div>
      </aside>
    </>
  )
}

function HomeView({ onNavigate, onSupport, moodEntries, setMoodEntries, showToast }) {
  const [selectedMood, setSelectedMood] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  useEffect(() => { api.dashboard().then(setDashboard).catch(() => undefined) }, [])
  const currentVolunteer = dashboard?.currentSupport?.volunteer
  const logMood = async (mood) => {
    setSelectedMood(mood.score)
    try {
      await api.saveMood({ score: mood.score, journal: '' })
      const today = { day: 'Today', score: mood.score }
      setMoodEntries((entries) => [...entries.filter((entry) => entry.day !== 'Today'), today])
      showToast(`Mood saved as “${mood.label}”`)
    } catch (error) { showToast(error.message) }
  }

  return (
    <div className="dashboard-grid">
      <section className="dashboard-primary">
        <article className="hero-card">
          <div className="hero-copy">
            <span className="eyebrow light"><Sparkles size={14} /> PEER SUPPORT, MADE PERSONAL</span>
            <h2>You don’t have to carry it alone.</h2>
            <p>Tell us what has been on your mind. We’ll understand the heart of it and connect you with someone who gets it.</p>
            <div className="hero-actions">
              <button className="button button-coral" onClick={onSupport}>Share what’s going on <ArrowRight size={17} /></button>
              <span><LockKeyhole size={15} /> Private by default</span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="orbit orbit-one" /><span className="orbit orbit-two" />
            <div className="hero-center"><HeartHandshake size={44} strokeWidth={1.4} /></div>
            <div className="floating-chip chip-one"><span className="avatar small" style={{ background: '#f0b486' }}>MR</span><span><b>Maya</b><small>Available now</small></span></div>
            <div className="floating-chip chip-two"><ShieldCheck size={18} /><span><b>Safe & moderated</b><small>Your comfort comes first</small></span></div>
          </div>
        </article>

        <section className="section-block mood-check-card">
          <div className="section-heading compact">
            <div><span className="eyebrow">A MOMENT FOR YOU</span><h2>How are you feeling right now?</h2></div>
            <button className="text-button" onClick={() => onNavigate('mood')}>View journal <ArrowUpRight size={15} /></button>
          </div>
          <div className="mood-row">
            {moods.map((mood) => (
              <button key={mood.score} className={`mood-button ${selectedMood === mood.score ? 'selected' : ''}`} onClick={() => logMood(mood)}>
                <span className="mood-face">{mood.face}</span><span>{mood.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div><span className="eyebrow">FROM THE COMMUNITY</span><h2>You’re among people who understand</h2></div>
            <button className="text-button" onClick={() => onNavigate('community')}>Visit community <ArrowRight size={15} /></button>
          </div>
          <div className="post-preview-grid">
            {starterPosts.slice(0, 2).map((post) => <PostPreview key={post.id} post={post} onOpen={() => onNavigate('community')} />)}
          </div>
        </section>
      </section>

      <aside className="dashboard-rail">
        <section className="rail-card session-card">
          <div className="rail-card-head"><span className="eyebrow">NEXT CHECK-IN</span><button aria-label="More options"><MoreHorizontal size={18} /></button></div>
          {currentVolunteer ? <><div className="session-person">
            <span className="avatar large" style={{ background: currentVolunteer.avatarColor }}>{currentVolunteer.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2)}<span className="online-dot" /></span>
            <div><h3>{currentVolunteer.displayName}</h3><p>Peer supporter · {dashboard.currentSupport.matchScore}% match</p></div>
          </div>
          <div className="session-time"><CalendarDays size={17} /><div><b>{dashboard.currentSupport.sessionAt ? new Date(dashboard.currentSupport.sessionAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Check-in when you’re ready'}</b><span>Private text conversation</span></div></div>
          <button className="button button-dark full" onClick={() => onNavigate('messages')}>Open conversation <MessageCircle size={16} /></button></> : <div className="no-session"><HeartHandshake size={28} /><h3>Your next connection starts here</h3><p>Share what is going on and review your peer matches.</p><button className="button button-dark full" onClick={onSupport}>Find support</button></div>}
        </section>

        <section className="rail-card journey-card">
          <div className="rail-card-head"><div><span className="eyebrow">YOUR SUPPORT PATH</span><h3>One step at a time</h3></div><span className="progress-ring">67<small>%</small></span></div>
          <div className="journey-list">
            <div className="journey-item done"><span><Check size={14} /></span><div><b>Shared what’s happening</b><small>Monday</small></div></div>
            <div className="journey-item done"><span><Check size={14} /></span><div><b>Matched with Maya</b><small>Tuesday</small></div></div>
            <div className="journey-item current"><span>3</span><div><b>First peer check-in</b><small>Today at 4:30 PM</small></div></div>
            <div className="journey-item"><span>4</span><div><b>Reflect and continue</b><small>Whenever you’re ready</small></div></div>
          </div>
        </section>

        <section className="rail-card resource-spotlight">
          <div className="resource-illustration"><Leaf size={30} /><span /><span /></div>
          <span className="eyebrow">CHOSEN FOR YOU</span>
          <h3>A two-minute reset for a busy mind</h3>
          <p>A simple breathing practice you can do anywhere.</p>
          <button className="text-button" onClick={() => onNavigate('resources')}>Try it now <Play size={14} fill="currentColor" /></button>
        </section>
      </aside>
    </div>
  )
}

function PostPreview({ post, onOpen }) {
  return (
    <article className="post-preview" onClick={onOpen}>
      <div className="post-meta"><span className="avatar tiny" style={{ background: post.color }}>{post.initials}</span><span>{post.author}</span><i>·</i><span>{post.time}</span></div>
      <span className="category-tag">{post.category}</span>
      <h3>{post.title}</h3>
      <div className="post-stats"><span><Heart size={15} /> {post.likes}</span><span><MessageSquare size={15} /> {post.comments}</span></div>
    </article>
  )
}

function SupportView({ onSupport, onNavigate }) {
  const [requests, setRequests] = useState([])
  useEffect(() => { api.supportRequests().then((result) => setRequests(result.requests)).catch(() => undefined) }, [])
  const current = requests.find((request) => ['assigned', 'in_progress'].includes(request.status))
  const matched = current?.volunteer
  return (
    <div className="support-layout">
      <section className="support-intro-card">
        <div className="support-intro-copy">
          <span className="eyebrow light"><Sparkles size={14} /> SMART, HUMAN COORDINATION</span>
          <h2>Start with your own words.</h2>
          <p>No forms to decode or categories to choose. Share as much or as little as feels comfortable, and we’ll help find the right kind of support.</p>
          <button className="button button-coral" onClick={onSupport}>Create a support request <ArrowRight size={17} /></button>
        </div>
        <div className="privacy-panel">
          <ShieldCheck size={27} />
          <div><b>You stay in control</b><p>Review the summary and support topics before anything is shared with a volunteer.</p></div>
        </div>
      </section>

      <div className="status-strip">
        <div><span className="status-icon coral"><Clock3 size={19} /></span><p><b>{requests.filter((request) => !['completed', 'declined'].includes(request.status)).length} active request</b><small>{current ? current.status.replace('_', ' ') : 'Ready when you are'}</small></p></div>
        <div><span className="status-icon sage"><UserRoundCheck size={19} /></span><p><b>{matched?.displayName || 'No current match'}</b><small>{matched ? `${current.matchScore}% relevance` : 'Create a request to match'}</small></p></div>
        <div><span className="status-icon gold"><MessageCircle size={19} /></span><p><b>{current?.sessionAt ? 'Check-in scheduled' : 'Private messaging'}</b><small>{current?.sessionAt ? new Date(current.sessionAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Available after matching'}</small></p></div>
      </div>

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">YOUR CURRENT MATCH</span><h2>Support that feels understood</h2></div><span className="safe-label"><LockKeyhole size={14} /> Only visible to you and your care team</span></div>
        {matched ? <div className="match-card featured-match">
          <div className="match-profile">
            <span className="avatar xl" style={{ background: matched.avatarColor }}>{matched.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2)}<span className="online-dot" /></span>
            <div><div className="match-name"><h3>{matched.displayName}</h3><span><Sparkles size={13} /> {current.matchScore}% match</span></div><p>Peer supporter · {matched.yearsActive || 1} years on MentalBridge</p><div className="expertise-row">{(matched.expertise || []).map((tag) => <span key={tag}>{tag}</span>)}</div></div>
          </div>
          <blockquote>“{matched.bio}”</blockquote>
          <div className="match-actions"><button className="button button-dark" onClick={() => onNavigate('messages')}>Message {matched.displayName.split(' ')[0]} <MessageCircle size={16} /></button><button className="button button-secondary">View support plan</button></div>
        </div> : <div className="empty-match"><HeartHandshake size={28} /><div><h3>Your next connection can start here</h3><p>Create a private support request and review your recommended peer supporters.</p></div><button className="button button-dark" onClick={onSupport}>Find peer support</button></div>}
      </section>

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">HOW MATCHING WORKS</span><h2>Thoughtful technology. Real human care.</h2></div></div>
        <div className="how-grid">
          <div><span>01</span><Brain size={23} /><h3>We understand the heart of it</h3><p>Your words are organized into a private summary and support themes that you can edit.</p></div>
          <div><span>02</span><SlidersHorizontal size={23} /><h3>We consider the whole match</h3><p>Shared lived experience, communication style, availability, and your preferences all matter.</p></div>
          <div><span>03</span><HeartHandshake size={23} /><h3>You choose who feels right</h3><p>Review recommended supporters and decide whether to connect. There’s never pressure.</p></div>
        </div>
      </section>
    </div>
  )
}

function SupportModal({ onClose, onComplete }) {
  const [step, setStep] = useState(1)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedVolunteer, setSelectedVolunteer] = useState(null)
  const [analysis, setAnalysis] = useState(() => analyzeConcern(''))
  const [matchedVolunteers, setMatchedVolunteers] = useState(volunteers)
  const [error, setError] = useState('')

  const continueFlow = async () => {
    setError('')
    if (step === 1) {
      setLoading(true)
      try {
        const { analysis: serverAnalysis } = await api.analyze(text)
        setAnalysis(serverAnalysis)
        const { volunteers: results } = await api.volunteers(serverAnalysis.tags)
        const formatted = results.map((volunteer) => ({
          id: volunteer.id,
          name: volunteer.displayName,
          initials: volunteer.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2),
          role: 'Peer supporter', match: volunteer.matchScore, color: volunteer.avatarColor,
          experience: (volunteer.expertise || []).join(' · '), bio: volunteer.bio,
          status: volunteer.availability === 'available' ? 'Available today' : 'Limited availability',
        }))
        setMatchedVolunteers(formatted)
        setSelectedVolunteer(formatted[0]?.id || null)
        setStep(2)
      } catch (requestError) { setError(requestError.message) }
      finally { setLoading(false) }
    } else if (step === 2) setStep(3)
    else {
      setLoading(true)
      try {
        await api.createSupportRequest({ description: text, summary: analysis.summary, tags: analysis.tags, priorities: analysis.priorities || analysis.tags.slice(0, 2), volunteerId: selectedVolunteer })
        onComplete()
      } catch (requestError) { setError(requestError.message) }
      finally { setLoading(false) }
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="support-modal" role="dialog" aria-modal="true" aria-labelledby="support-modal-title">
        <div className="modal-head">
          <div className="modal-brand"><span className="brand-mark"><HeartHandshake size={20} /></span><div><b>MentalBridge</b><small>Private support request</small></div></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="stepper">
          {[['Share', 1], ['Review', 2], ['Choose', 3]].map(([label, number]) => <div key={number} className={step >= number ? 'active' : ''}><span>{step > number ? <Check size={13} /> : number}</span><b>{label}</b></div>)}
        </div>

        {step === 1 && <div className="modal-body share-step">
          <span className="eyebrow"><Sparkles size={14} /> START WHERE YOU ARE</span>
          <h2 id="support-modal-title">What’s been weighing on you?</h2>
          <p>Write naturally—there’s no right way to explain it. You’ll review everything before it’s shared.</p>
          <label className="concern-field">
            <span className="sr-only">Describe what has been happening</span>
            <textarea value={text} maxLength={1200} onChange={(e) => setText(e.target.value)} placeholder="Lately I’ve been feeling..." autoFocus />
            <small>{text.length} / 1,200</small>
          </label>
          <div className="prompt-chips"><span>Not sure where to begin?</span>{['Work has been overwhelming', 'I’ve been feeling alone', 'My thoughts won’t slow down'].map((prompt) => <button key={prompt} onClick={() => setText(prompt + '. ')}>{prompt}</button>)}</div>
          <div className="safety-note"><LockKeyhole size={17} /><span><b>Your words are protected.</b> We use them only to coordinate your peer support.</span></div>
        </div>}

        {step === 2 && <div className="modal-body review-step">
          <span className="eyebrow"><Sparkles size={14} /> YOUR PRIVATE SUMMARY</span>
          <h2 id="support-modal-title">Did we understand you correctly?</h2>
          <p>This is a starting point, not a diagnosis. You can change any part before continuing.</p>
          <div className="analysis-card">
            <div className="analysis-title"><span><Brain size={20} /></span><div><b>What we heard</b><small>AI-assisted summary · visible to your matched supporter</small></div><button>Edit</button></div>
            <p>{analysis.summary}</p>
          </div>
          {analysis.crisisNotice && <div className="crisis-notice"><LifeBuoy size={19} /><span><b>Please seek immediate, real-time help</b>{analysis.crisisNotice}</span></div>}
          <div className="topic-section"><b>Support themes</b><span>Choose what feels relevant</span><div className="topic-list">{analysis.tags.map((tag) => <button className="selected" key={tag}><Check size={13} />{tag}</button>)}<button><Plus size={13} /> Add another</button></div></div>
          <div className="safety-note"><Info size={17} /><span>This tool helps coordinate peer support. It does not diagnose conditions or replace professional care.</span></div>
        </div>}

        {step === 3 && <div className="modal-body choose-step">
          <span className="eyebrow"><HeartHandshake size={14} /> RECOMMENDED FOR YOU</span>
          <h2 id="support-modal-title">Choose someone who feels right</h2>
          <p>Each person is trained, approved, and matched using your support themes and preferences.</p>
          <div className="volunteer-options">{matchedVolunteers.map((volunteer) => (
            <button key={volunteer.id} className={selectedVolunteer === volunteer.id ? 'selected' : ''} onClick={() => setSelectedVolunteer(volunteer.id)}>
              <span className="avatar large" style={{ background: volunteer.color }}>{volunteer.initials}</span>
              <span className="volunteer-copy"><span><b>{volunteer.name}</b><em><Sparkles size={12} />{volunteer.match}% match</em></span><small>{volunteer.experience}</small><i>{volunteer.status}</i></span>
              <span className="radio-check">{selectedVolunteer === volunteer.id && <Check size={14} />}</span>
            </button>
          ))}</div>
        </div>}

        <div className="modal-footer">
          <div>{error && <span className="modal-error">{error}</span>}{step > 1 ? <button className="button button-secondary" onClick={() => setStep(step - 1)}>Back</button> : <span className="moderated-label"><ShieldCheck size={15} /> Moderated for safety</span>}</div>
          <button className="button button-dark" disabled={(step === 1 && text.trim().length < 20) || loading} onClick={continueFlow}>
            {loading ? <><LoaderCircle className="spin" size={17} /> {step === 3 ? 'Creating your request…' : 'Understanding your words…'}</> : step === 1 ? <>Review my summary <ArrowRight size={16} /></> : step === 2 ? <>Find my matches <ArrowRight size={16} /></> : <>Request a connection <HeartHandshake size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  )
}

function analyzeConcern(text) {
  const value = text.toLowerCase()
  const tags = []
  if (/work|job|deadline|overwhelm|burnout/.test(value)) tags.push('Work stress')
  if (/alone|lonely|isolat/.test(value)) tags.push('Loneliness')
  if (/anx|worr|thought|panic|slow down/.test(value)) tags.push('Anxious thoughts')
  if (/sleep|tired|exhaust/.test(value)) tags.push('Sleep & energy')
  if (/sad|low|empty|motivation/.test(value)) tags.push('Low mood')
  if (!tags.length) tags.push('Emotional support', 'Feeling overwhelmed')
  if (tags.length === 1) tags.push('Feeling overwhelmed')
  const topic = tags.slice(0, 2).join(' and ').toLowerCase()
  return {
    tags: tags.slice(0, 4),
    summary: text.trim().length > 35
      ? `You’ve been dealing with ${topic}, and it sounds like carrying this by yourself has become difficult. You’re looking for a calm, understanding person who can listen and help you feel less alone in it.`
      : `You’re going through a period of ${topic} and would value a calm, understanding person to talk with.`,
  }
}

function MessagesView({ showToast, user }) {
  const [conversationItems, setConversationItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  const loadConversations = () => api.conversations().then(({ conversations: items }) => {
    setConversationItems(items)
    setSelected((current) => current || items[0]?.id || null)
  }).finally(() => setLoading(false))
  useEffect(() => { loadConversations().catch(() => undefined) }, [])
  useEffect(() => {
    if (!selected) return
    api.messages(selected).then((result) => setMessages(result.messages)).catch(() => undefined)
  }, [selected])
  useEffect(() => {
    const refresh = () => selected && api.messages(selected).then((result) => setMessages(result.messages)).catch(() => undefined)
    window.addEventListener('mentalbridge:message', refresh)
    return () => window.removeEventListener('mentalbridge:message', refresh)
  }, [selected])

  const activeConversation = conversationItems.find((item) => item.id === selected)
  const other = activeConversation?.other

  const sendMessage = async () => {
    if (!draft.trim()) return
    const text = draft.trim()
    setDraft('')
    try {
      const { message } = await api.sendMessage(selected, text)
      setMessages((items) => [...items, message])
      showToast('Message sent privately')
      loadConversations().catch(() => undefined)
    } catch (error) { setDraft(text); showToast(error.message) }
  }

  return (
    <div className="messages-shell">
      <aside className="conversation-list">
        <div className="conversation-head"><h2>Conversations</h2><button className="icon-button"><Plus size={18} /></button></div>
        <label className="inline-search"><Search size={16} /><input placeholder="Search messages" /></label>
        {conversationItems.map((conversation) => <button key={conversation.id} className={`conversation-item ${selected === conversation.id ? 'selected' : ''}`} onClick={() => setSelected(conversation.id)}>
          <span className="avatar" style={{ background: conversation.other.avatarColor }}>{conversation.other.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2)}{conversation.other.availability === 'available' && <span className="online-dot" />}</span>
          <span className="conversation-copy"><span><b>{conversation.other.displayName}</b><small>{conversation.lastMessage ? new Date(conversation.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</small></span><span><p>{conversation.lastMessage?.text || 'Start the conversation when you feel ready.'}</p>{conversation.unread > 0 && <em>{conversation.unread}</em>}</span></span>
        </button>)}
        {!loading && conversationItems.length === 0 && <div className="conversation-empty"><MessageCircle size={24} /><p>Your conversations will appear after you match with a peer supporter.</p></div>}
      </aside>
      <section className="chat-panel">
        {other ? <><div className="chat-head"><div className="session-person"><span className="avatar" style={{ background: other.avatarColor }}>{other.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2)}{other.availability === 'available' && <span className="online-dot" />}</span><div><h3>{other.displayName}</h3><p>{other.availability === 'available' ? 'Online' : 'Offline'} · Peer supporter</p></div></div><button className="icon-button"><MoreHorizontal size={19} /></button></div>
        <div className="chat-safety"><ShieldCheck size={15} /> This conversation is private and monitored only when safety concerns are reported.</div>
        <div className="message-thread">
          <div className="day-divider"><span>Today</span></div>
          {messages.map((message) => <div key={message.id} className={`message-row ${message.senderId === user.id ? 'me' : 'them'}`}>
            {message.senderId !== user.id && <span className="avatar tiny" style={{ background: other.avatarColor }}>{other.displayName.slice(0, 2).toUpperCase()}</span>}
            <div><p>{message.text}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>
          </div>)}
        </div>
        <div className="composer"><textarea aria-label="Write a message" placeholder="Write a message…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }} /><button onClick={sendMessage} aria-label="Send message"><Send size={18} /></button><span>Enter to send · Shift + Enter for a new line</span></div></> : <div className="chat-empty"><HeartHandshake size={38} /><h3>Your private conversations</h3><p>Choose a conversation, or create a peer-support request to begin.</p></div>}
      </section>
    </div>
  )
}

function CommunityView({ showToast, user }) {
  const [filter, setFilter] = useState('All stories')
  const [posts, setPosts] = useState(starterPosts)
  const [composerOpen, setComposerOpen] = useState(false)
  const [postDraft, setPostDraft] = useState('')
  const filters = ['All stories', 'Anxiety', 'Burnout', 'Small wins']
  const visiblePosts = posts

  useEffect(() => { api.posts(filter).then((result) => setPosts(result.posts)).catch(() => undefined) }, [filter])

  const publish = async () => {
    if (postDraft.trim().length < 10) return
    try {
      const { post } = await api.createPost({ title: postDraft.trim(), category: 'Small wins' })
      setPosts([post, ...posts])
      setPostDraft('')
      setComposerOpen(false)
      showToast('Your story was shared anonymously')
    } catch (error) { showToast(error.message) }
  }

  const react = async (postId) => {
    try {
      const { post } = await api.reactToPost(postId)
      setPosts((items) => items.map((item) => item.id === postId ? post : item))
    } catch (error) { showToast(error.message) }
  }

  const report = async (postId) => {
    try { await api.reportPost(postId, 'Potentially harmful or inappropriate content'); showToast('Report sent privately to moderators') }
    catch (error) { showToast(error.message) }
  }

  return (
    <div className="community-layout">
      <section className="community-feed">
        <div className="community-toolbar"><div className="filter-tabs">{filters.map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><button className="button button-dark" onClick={() => setComposerOpen(!composerOpen)}><Plus size={16} /> Share something</button></div>
        {composerOpen && <div className="community-composer"><div><span className="avatar">{user.anonymousName.slice(0, 2).toUpperCase()}</span><div><b>Share as {user.anonymousName}</b><small>Your identity stays private</small></div></div><textarea value={postDraft} onChange={(e) => setPostDraft(e.target.value)} placeholder="What would you like the community to hear?" autoFocus /><div><span><ShieldCheck size={14} /> All posts follow community care guidelines</span><button className="button button-dark" disabled={postDraft.trim().length < 10} onClick={publish}>Share anonymously</button></div></div>}
        <div className="community-posts">{visiblePosts.map((post) => {
          const isLiked = Boolean(post.liked)
          return <article className="community-post" key={post.id}>
            <div className="community-post-head"><div className="post-meta"><span className="avatar" style={{ background: post.avatarColor || post.color }}>{post.initials}</span><span><b>{post.author}</b><small>{post.time} · Anonymous member</small></span></div><button className="icon-button"><MoreHorizontal size={18} /></button></div>
            <span className="category-tag">{post.category}</span><h2>{post.title}</h2><p>{post.body}</p>
            <div className="community-post-actions"><button className={isLiked ? 'liked' : ''} onClick={() => react(post.id)}><Heart size={17} fill={isLiked ? 'currentColor' : 'none'} /> {post.likes}</button><button><MessageSquare size={17} /> {post.comments} replies</button><button onClick={() => showToast('Post bookmarked')}><Bookmark size={17} /> Save</button><button className="report" onClick={() => report(post.id)}><Flag size={15} /> Report</button></div>
          </article>
        })}</div>
      </section>
      <aside className="community-rail">
        <div className="rail-card guidelines-card"><span className="status-icon sage"><ShieldCheck size={20} /></span><h3>A community built on care</h3><p>Lead with empathy, respect privacy, and share from your own experience.</p><button>Read community guidelines <ArrowRight size={14} /></button></div>
        <div className="rail-card topic-card"><span className="eyebrow">TRENDING GENTLY</span><h3>What people are talking about</h3>{[['Setting boundaries', '34 conversations'], ['Starting again', '28 conversations'], ['Sunday anxiety', '21 conversations']].map(([topic, count], index) => <button key={topic}><span>{index + 1}</span><div><b>{topic}</b><small>{count}</small></div><ChevronRight size={16} /></button>)}</div>
      </aside>
    </div>
  )
}

function MoodView({ moodEntries, setMoodEntries, showToast }) {
  const [selectedMood, setSelectedMood] = useState(null)
  const [journal, setJournal] = useState('')
  const maxHeight = 150
  const saveEntry = async () => {
    if (!selectedMood) return
    try {
      await api.saveMood({ score: selectedMood, journal })
      setMoodEntries((entries) => [...entries.filter((entry) => entry.day !== 'Today'), { day: 'Today', score: selectedMood }])
      setJournal('')
      showToast('Today’s check-in is saved')
    } catch (error) { showToast(error.message) }
  }
  const average = moodEntries.length ? (moodEntries.reduce((sum, entry) => sum + entry.score, 0) / moodEntries.length).toFixed(1) : '—'

  return (
    <div className="mood-layout">
      <section className="mood-journal-card">
        <span className="eyebrow">TODAY’S CHECK-IN</span><h2>Meet yourself where you are.</h2><p>No mood is good or bad. This is simply a moment to notice.</p>
        <div className="mood-picker-large">{moods.map((mood) => <button key={mood.score} className={selectedMood === mood.score ? 'selected' : ''} onClick={() => setSelectedMood(mood.score)}><span>{mood.face}</span><b>{mood.label}</b></button>)}</div>
        <label className="journal-field"><span>Anything you want to remember about today? <em>Optional</em></span><textarea value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="A few words is enough…" /></label>
        <button className="button button-dark" disabled={!selectedMood} onClick={saveEntry}>Save today’s check-in <CheckCircle2 size={16} /></button>
      </section>
      <section className="mood-insights">
        <div className="insight-stats"><div><span className="status-icon sage"><TrendingUp size={20} /></span><p><small>7-day average</small><b>{average}<em>/5</em></b></p></div><div><span className="status-icon coral"><Activity size={20} /></span><p><small>Check-in rhythm</small><b>{moodEntries.length}<em>days</em></b></p></div><div><span className="status-icon blue"><CalendarDays size={20} /></span><p><small>Best day</small><b>Sat</b></p></div></div>
        <div className="mood-chart-card"><div className="section-heading compact"><div><span className="eyebrow">YOUR LAST 7 DAYS</span><h2>A gentle upward shift</h2></div><button className="icon-button"><Filter size={17} /></button></div><div className="mood-chart" aria-label="Mood trend chart">{moodEntries.slice(-7).map((entry) => <div className="chart-column" key={entry.day}><span className="chart-score">{moods[entry.score - 1]?.face}</span><i style={{ height: `${(entry.score / 5) * maxHeight}px` }} /><small>{entry.day}</small></div>)}</div><p className="chart-note"><Sparkles size={15} /> Your mood has felt steadier this week. That doesn’t mean every day has to be easy.</p></div>
        <div className="pattern-card"><div><span className="eyebrow">A PATTERN TO NOTICE</span><h3>Movement seems to help</h3><p>On days where you mentioned going outside, your check-in was an average of 0.8 points higher.</p></div><span className="pattern-icon"><Leaf size={28} /></span></div>
      </section>
    </div>
  )
}

function ResourcesView({ showToast }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [bookmarked, setBookmarked] = useState([])
  const [resourceItems, setResourceItems] = useState(resources)
  const categories = ['All', 'Anxiety', 'Burnout', 'Mindfulness', 'Sleep', 'Self-care']
  const filtered = resourceItems
  useEffect(() => {
    const timer = window.setTimeout(() => api.resources(query, category).then((result) => { setResourceItems(result.resources); setBookmarked(result.bookmarks) }).catch(() => undefined), 180)
    return () => window.clearTimeout(timer)
  }, [query, category])
  const toggleBookmark = async (id) => {
    const active = bookmarked.includes(id)
    try {
      const result = await api.toggleBookmark(id)
      setBookmarked(result.bookmarks)
      showToast(active ? 'Removed from saved resources' : 'Saved to your library')
    } catch (error) { showToast(error.message) }
  }
  return (
    <div className="resources-layout">
      <section className="resource-hero">
        <div><span className="eyebrow light"><BookOpen size={14} /> YOUR PRACTICAL TOOLKIT</span><h2>Something helpful for this moment.</h2><p>Explore trusted, plain-language resources chosen for real life—not perfect days.</p><label><Search size={18} /><input aria-label="Search resources" placeholder="Search anxiety, sleep, grounding…" value={query} onChange={(e) => setQuery(e.target.value)} /></label></div>
        <div className="resource-hero-art"><span><Leaf size={42} /></span><i /><i /></div>
      </section>
      <div className="resource-filter-row"><div>{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><button className="saved-filter"><Bookmark size={16} /> Saved ({bookmarked.length})</button></div>
      {filtered.length ? <div className="resource-grid">{filtered.map((resource) => {
        const Icon = typeof resource.icon === 'string' ? (resourceIconMap[resource.icon] || BookOpen) : resource.icon
        const saved = bookmarked.includes(resource.id)
        return <article className={`resource-card ${resource.featured ? 'featured' : ''}`} key={resource.id}>
          <div className={`resource-card-art ${resource.color}`}><Icon size={resource.featured ? 42 : 30} strokeWidth={1.5} />{resource.featured && <span>Recommended for you</span>}</div>
          <div className="resource-card-body"><div className="resource-card-meta"><span>{resource.category}</span><i>·</i><span>{resource.type}</span></div><h3>{resource.title}</h3><p>{resource.description}</p><div><button className="text-button">Open resource <ArrowUpRight size={15} /></button><button className={`icon-button ${saved ? 'saved' : ''}`} aria-label="Bookmark resource" onClick={() => toggleBookmark(resource.id)}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button></div></div>
        </article>
      })}</div> : <div className="empty-state"><Search size={29} /><h3>No resources found</h3><p>Try a broader word or another category.</p><button className="text-button" onClick={() => { setQuery(''); setCategory('All') }}>Clear filters <RefreshCcw size={14} /></button></div>}
    </div>
  )
}

function AdminView() {
  const [adminData, setAdminData] = useState({ stats: { activeUsers: 0, openRequests: 0, supportersOnline: 0, openReports: 0, positiveFeedback: 100 }, queue: [] })
  useEffect(() => { api.adminStats().then(setAdminData).catch(() => undefined) }, [])
  const queue = adminData.queue.map((request) => ({
    name: request.userId.replace('user-', '').slice(0, 12) || 'Member', topic: request.tags.join(', '),
    risk: request.riskLevel === 'urgent' ? 'Review' : 'Standard', wait: new Date(request.createdAt).toLocaleDateString(),
    status: request.status.replaceAll('_', ' '),
  }))
  return <div className="admin-layout">
    <div className="admin-notice"><ShieldCheck size={18} /><span><b>Demo care-operations view</b><small>Role-based access would restrict this area to approved moderators and administrators.</small></span></div>
    <div className="admin-stats"><StatCard icon={Users} label="Active members" value={adminData.stats.activeUsers} trend="Registered accounts" color="sage" /><StatCard icon={HeartHandshake} label="Open requests" value={adminData.stats.openRequests} trend="Live coordination queue" color="coral" /><StatCard icon={UserRoundCheck} label="Supporters online" value={adminData.stats.supportersOnline} trend="Available now" color="blue" /><StatCard icon={Flag} label="Content reports" value={adminData.stats.openReports} trend="Awaiting review" color="gold" /></div>
    <div className="admin-main-grid"><section className="admin-queue"><div className="section-heading compact"><div><span className="eyebrow">COORDINATION QUEUE</span><h2>Support requests</h2></div><button className="button button-secondary"><Filter size={15} /> Filter queue</button></div><div className="queue-table"><div className="queue-row queue-header"><span>Anonymous member</span><span>Support themes</span><span>Safety level</span><span>Waiting</span><span>Status</span></div>{queue.map((item) => <div className="queue-row" key={item.name}><span><span className="avatar tiny">{item.name.slice(0, 2).toUpperCase()}</span><b>{item.name}</b></span><span>{item.topic}</span><span><em className={item.risk === 'Review' ? 'review' : ''}>{item.risk}</em></span><span>{item.wait}</span><span><button>{item.status} <ChevronRight size={14} /></button></span></div>)}</div></section><aside className="rail-card health-card"><span className="eyebrow">COMMUNITY HEALTH</span><div className="health-score"><span>94</span><div><b>Healthy</b><small>+2 from last week</small></div></div><div className="health-metric"><span>First response time</span><b>8m 42s</b></div><div className="health-metric"><span>Match acceptance</span><b>88%</b></div><div className="health-metric"><span>Positive feedback</span><b>92%</b></div><button className="text-button">View analytics <BarChart3 size={15} /></button></aside></div>
  </div>
}

function StatCard({ icon: Icon, label, value, trend, color }) {
  return <div className="stat-card"><span className={`status-icon ${color}`}><Icon size={20} /></span><div><small>{label}</small><b>{value}</b><em>{trend}</em></div></div>
}

function NotificationPopover({ onClose }) {
  const [items, setItems] = useState([])
  useEffect(() => { api.notifications().then((result) => setItems(result.notifications)).catch(() => undefined) }, [])
  const markRead = async () => { await api.markNotificationsRead(); setItems((notifications) => notifications.map((item) => ({ ...item, read: true }))); onClose() }
  const icon = (type) => type === 'message' ? <MessageCircle size={17} /> : type === 'session' ? <CalendarDays size={17} /> : <BookOpen size={17} />
  return <div className="popover notification-popover"><div className="popover-head"><h3>Notifications</h3><button onClick={markRead}>Mark all read</button></div>{items.slice(0, 5).map((item) => <div key={item.id} className={`notification-item ${item.read ? '' : 'unread'}`}><span className={`status-icon ${item.type === 'message' ? 'coral' : item.type === 'session' ? 'sage' : 'blue'}`}>{icon(item.type)}</span><div><b>{item.title}</b><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div></div>)}{items.length === 0 && <div className="popover-empty">You’re all caught up.</div>}</div>
}

function ProfilePopover({ navigate, close, user, logout }) {
  const initials = user.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return <div className="popover profile-popover"><div className="profile-summary"><span className="avatar avatar-user large">{initials}</span><div><b>{user.displayName}</b><small>@{user.anonymousName} · {user.role}</small></div></div>{['moderator', 'admin'].includes(user.role) && <button onClick={() => { navigate('admin'); close() }}><UserCog size={17} /> Care operations</button>}<button><Settings size={17} /> Account & privacy</button><button><CircleHelp size={17} /> Help center</button><div /><button onClick={() => { close(); logout() }}><LogOut size={17} /> Sign out</button></div>
}

export default App
