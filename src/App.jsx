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
  Edit3,
  ExternalLink,
  FileText,
  Filter,
  Flag,
  Headphones,
  Heart,
  HeartHandshake,
  Info,
  LayoutDashboard,
  Languages,
  Leaf,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  MoonStar,
  Moon,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  SmilePlus,
  Sparkles,
  TrendingUp,
  Trash2,
  UserCog,
  UserRoundCheck,
  Users,
  Wind,
  X,
  Sun,
} from 'lucide-react'
import { api, connectRealtime } from './api'
import ProfilePicturePicker from './ProfilePicturePicker'
import LandingPage from './LandingPage'
import StaffLogin from './StaffLogin'
import { useAuth } from './AuthContext'

const navItems = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'support', label: 'Peer support', icon: HeartHandshake },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'mood', label: 'Mood journal', icon: SmilePlus },
  { id: 'volunteers', label: 'Peer volunteers', icon: UserRoundCheck },
  { id: 'resources', label: 'Resources', icon: BookOpen },
]

const moods = [
  { score: 1, face: '😞', label: 'Struggling', color: '#d66b5d' },
  { score: 2, face: '😕', label: 'Low', color: '#d99b54' },
  { score: 3, face: '😐', label: 'Okay', color: '#c6a451' },
  { score: 4, face: '🙂', label: 'Good', color: '#6c9f79' },
  { score: 5, face: '😊', label: 'Great', color: '#2c775c' },
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
const resourceImageMap = {
  Anxiety: '/resource-anxiety.jpg',
  Burnout: '/resource-burnout.jpg',
  Mindfulness: '/resource-mindfulness.jpg',
  Sleep: '/resource-sleep.jpg',
  'Self-care': '/resource-self-care.jpg',
  Loneliness: '/resource-loneliness.jpg',
}
const resourceImage = (resource) => resource.image || resourceImageMap[resource.category]

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
  const { user, loading: authLoading, logout, refreshUser } = useAuth()
  const [active, setActive] = useState('home')
  const [accountLinkOpen, setAccountLinkOpen] = useState(() => { const params = new URLSearchParams(window.location.search); return params.has('verify') || params.has('reset') || params.get('mode') === 'forgot' })
  const [theme, setTheme] = useStoredState('mentalbridge-theme', window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(() => new URLSearchParams(window.location.search).get('support') === 'open')
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  useEffect(() => {
    if (!user) return
    const update = () => api.notifications().then(({ notifications }) => setUnreadNotifications(notifications.filter((item) => !item.read).length)).catch(() => {})
    update()
    const socket = connectRealtime()
    socket.on('notification', update)
    window.addEventListener('mentalbridge:notifications', update)
    return () => { socket.disconnect(); window.removeEventListener('mentalbridge:notifications', update) }
  }, [user?.id])
  const [toast, setToast] = useState('')
  const [navCounts, setNavCounts] = useState({ support: 0, messages: 0 })
  const [moodEntries, setMoodEntries] = useStoredState('mentalbridge-moods', [
    { day: 'Mon', score: 2 }, { day: 'Tue', score: 3 }, { day: 'Wed', score: 3 },
    { day: 'Thu', score: 4 }, { day: 'Fri', score: 3 }, { day: 'Sat', score: 4 },
  ])

  const showToast = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  const refreshNavCounts = async () => {
    if (!user || ['moderator', 'admin'].includes(user.role)) {
      setNavCounts({ support: 0, messages: 0 })
      return
    }
    try {
      const [supportResult, conversationResult] = await Promise.all([api.supportRequests(), api.conversations()])
      setNavCounts({
        support: supportResult.requests.filter((request) => !['completed', 'declined'].includes(request.status)).length,
        messages: conversationResult.conversations.reduce((total, conversation) => total + (conversation.unread || 0), 0),
      })
    } catch { /* Individual pages surface backend errors when opened. */ }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Once a staff member is signed in the portal URL has served its purpose.
  useEffect(() => {
    if (user && /^\/(staff|admin|moderator)\/?$/i.test(window.location.pathname)) window.history.replaceState({}, '', '/')
  }, [user])

  useEffect(() => {
    if (['moderator', 'admin'].includes(user?.role)) setActive('admin')
    else if (user?.role === 'volunteer') setActive('support')
  }, [user?.role])

  useEffect(() => {
    if (!user) return undefined
    if (user.role === 'user') api.moods().then(({ moods }) => {
      setMoodEntries(moods.map((entry) => ({
        id: entry.id,
        day: new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'short' }),
        score: entry.score,
        journal: entry.journal,
      })))
    }).catch(() => undefined)
    refreshNavCounts()
    const socket = connectRealtime({
      notification: (notification) => { showToast(notification.title); refreshNavCounts() },
      message: () => { window.dispatchEvent(new CustomEvent('mentalbridge:message')); refreshNavCounts() },
    })
    const refreshCounts = () => refreshNavCounts()
    window.addEventListener('mentalbridge:data', refreshCounts)
    window.addEventListener('mentalbridge:counts', refreshCounts)
    return () => {
      socket?.disconnect()
      window.removeEventListener('mentalbridge:data', refreshCounts)
      window.removeEventListener('mentalbridge:counts', refreshCounts)
    }
  }, [user?.id, user?.role])

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
    volunteers: ['Peer volunteers', 'Meet the people who make peer support feel human.'],
    resources: ['Resource library', 'Practical tools for wherever you are today.'],
    admin: ['Care operations', 'Safety, coordination, and community health at a glance.'],
    settings: ['Account & privacy', 'Control your identity, preferences, and availability.'],
    help: ['Help center', 'Quick answers and guidance for using MentalBridge.'],
    safety: ['Safety & privacy', 'How MentalBridge protects your space and responds to concerns.'],
  }

  const page = {
    home: <HomeView onNavigate={navigate} onSupport={() => setSupportOpen(true)} moodEntries={moodEntries} setMoodEntries={setMoodEntries} showToast={showToast} />,
    support: <SupportView onSupport={() => setSupportOpen(true)} onNavigate={navigate} user={user} showToast={showToast} />,
    messages: <MessagesView showToast={showToast} user={user} onNavigate={navigate} />,
    community: <CommunityView showToast={showToast} user={user} />,
    mood: <MoodView moodEntries={moodEntries} setMoodEntries={setMoodEntries} showToast={showToast} />,
    volunteers: <VolunteerDirectory onNavigate={navigate} />,
    resources: <ResourcesView showToast={showToast} user={user} />,
    admin: <AdminView showToast={showToast} user={user} />,
    settings: <SettingsView user={user} refreshUser={refreshUser} showToast={showToast} />,
    help: <HelpView onNavigate={navigate} user={user} />,
    safety: <SafetyView />,
  }[active]

  if (authLoading) return <div className="app-loading"><span className="brand-mark"><HeartHandshake size={24} /></span><LoaderCircle className="spin" size={22} /><p>Opening your private space…</p></div>
  if (!user || accountLinkOpen) {
    const staffRoute = /^\/(staff|admin|moderator)\/?$/i.test(window.location.pathname)
    if (staffRoute) return <StaffLogin theme={theme} />
    return <LandingPage onAccountFlowComplete={() => setAccountLinkOpen(false)} theme={theme} toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
  }

  return (
    <div className="app-shell">
      <Sidebar active={active} navigate={navigate} open={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} counts={navCounts} />
      <div className="app-main">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
          <div className="page-heading">
            <h1>{titles[active][0]}</h1>
            <p>{titles[active][1]}</p>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <div className="popover-wrap">
              <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false) }}>
                <Bell size={19} />{unreadNotifications > 0 && <span className="notification-dot" />}
              </button>
              {notificationsOpen && <NotificationPopover onClose={() => setNotificationsOpen(false)} onNavigate={navigate} />}
            </div>
            <div className="popover-wrap">
              <button className="profile-trigger" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false) }} aria-label="Open profile menu">
                <span className="avatar avatar-user">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
                <span className="profile-name">{user.displayName}</span>
                <ChevronDown size={15} />
              </button>
              {profileOpen && <ProfilePopover navigate={navigate} close={() => setProfileOpen(false)} user={user} logout={logout} />}
            </div>
          </div>
        </header>

        <main className="page-content">{page}</main>
        <MobileTabBar active={active} navigate={navigate} user={user} counts={navCounts} onMore={() => setSidebarOpen(true)} />
        <footer className="app-footer">
          <span><ShieldCheck size={15} /> Your privacy matters. MentalBridge is a peer-support service, not clinical care.</span>
          <div><a href="mailto:tafhimul456@gmail.com">Support: tafhimul456@gmail.com</a><a href="tel:999">Bangladesh emergency: 999</a><button onClick={() => navigate('safety')}>Safety & privacy</button></div>
        </footer>
      </div>
      {supportOpen && user.role === 'user' && <SupportModal onClose={() => setSupportOpen(false)} onComplete={() => { setSupportOpen(false); window.dispatchEvent(new CustomEvent('mentalbridge:data')); showToast('Your support request has been shared securely'); navigate('support') }} />}
      {toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  )
}

const navItemsForRole = (role) => role === 'user'
  ? navItems
  : role === 'volunteer'
    ? navItems.filter((item) => ['support', 'messages', 'community', 'resources'].includes(item.id))
    : [{ id: 'admin', label: 'Operations', icon: UserCog }, ...navItems.filter((item) => item.id === 'resources')]

// Phone-sized screens get a thumb-reachable tab bar instead of relying only on the slide-out sidebar.
function MobileTabBar({ active, navigate, user, counts, onMore }) {
  const tabs = navItemsForRole(user.role).slice(0, 4)
  return (
    <nav className="mobile-tabbar" aria-label="Primary navigation">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} className={active === id ? 'active' : ''} onClick={() => navigate(id)} aria-current={active === id ? 'page' : undefined}>
          <span><Icon size={21} strokeWidth={1.9} />{counts[id] > 0 && <em aria-hidden="true">{counts[id] > 9 ? '9+' : counts[id]}</em>}</span>
          <small>{label}</small>
        </button>
      ))}
      <button onClick={onMore} aria-label="More navigation options">
        <span><MoreHorizontal size={21} strokeWidth={1.9} /></span>
        <small>More</small>
      </button>
    </nav>
  )
}

function Sidebar({ active, navigate, open, onClose, user, counts }) {
  const visibleNavItems = user.role === 'user' || user.role === 'volunteer'
    ? navItemsForRole(user.role)
    : navItems.filter((item) => item.id === 'resources')
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
          {visibleNavItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${active === id ? 'active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={19} strokeWidth={1.9} /><span>{label}</span>{counts[id] > 0 && <em aria-label={`${label} count`}>{counts[id]}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        {user.role === 'user' && <div className="supporter-card">
          <HeartHandshake size={24} />
          <h3>Find a peer connection</h3>
          <p>See available volunteers or join the support waiting queue.</p>
          <button onClick={() => navigate('support')}>Find support <ArrowRight size={15} /></button>
        </div>}
        <div className="sidebar-bottom">
          {['moderator', 'admin'].includes(user.role) && <button className="nav-item" onClick={() => navigate('admin')}><UserCog size={19} /><span>Care operations</span></button>}
          <button className={`nav-item ${active === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings size={19} /><span>Settings</span></button>
          <button className={`nav-item ${active === 'help' ? 'active' : ''}`} onClick={() => navigate('help')}><CircleHelp size={19} /><span>Help center</span></button>
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
          <div className="rail-card-head"><span className="eyebrow">NEXT CHECK-IN</span><button aria-label="Check-in information" onClick={() => showToast('Use Messages to continue now, or Peer support to manage this request.')}><Info size={18} /></button></div>
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

function LegacySupportView({ onSupport, onNavigate }) {
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
            <div><div className="match-name"><h3>{matched.displayName}</h3><span><Sparkles size={13} /> {current.matchScore}% match</span></div><p>Peer supporter · {matched.yearsActive || 0} years on MentalBridge</p><div className="expertise-row">{(matched.expertise || []).map((tag) => <span key={tag}>{tag}</span>)}</div></div>
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

function SupportView({ onSupport, onNavigate, user, showToast }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [planOpen, setPlanOpen] = useState(false)
  const [feedbackId, setFeedbackId] = useState(null)
  const load = async () => {
    setError('')
    try { setRequests((await api.supportRequests()).requests) }
    catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    window.addEventListener('mentalbridge:data', load)
    return () => window.removeEventListener('mentalbridge:data', load)
  }, [])

  if (['volunteer', 'moderator', 'admin'].includes(user.role)) return <SupportQueueView requests={requests} loading={loading} error={error} reload={load} user={user} showToast={showToast} />

  const current = requests.find((request) => ['pending', 'assigned', 'in_progress', 'moderator_review'].includes(request.status))
  const matched = current?.volunteer
  const cancelRequest = async () => {
    try { await api.cancelSupportRequest(current.id); await load(); showToast('Support request cancelled') }
    catch (requestError) { showToast(requestError.message) }
  }
  const sendFeedback = async (requestId, rating) => {
    try { await api.submitFeedback(requestId, { rating, comment: 'Submitted from the member dashboard.' }); setFeedbackId(null); await load(); showToast('Thank you for your feedback') }
    catch (requestError) { showToast(requestError.message) }
  }

  return <div className="support-layout">
    <section className="support-intro-card"><div className="support-intro-copy"><span className="eyebrow light"><Sparkles size={14} /> SMART, HUMAN COORDINATION</span><h2>Start with your own words.</h2><p>No forms to decode or categories to choose. Share what feels comfortable and review everything before it is shared.</p><button className="button button-coral" onClick={onSupport}>Create a support request <ArrowRight size={17} /></button></div><div className="privacy-panel"><ShieldCheck size={27} /><div><b>You stay in control</b><p>Your request is shared only with your selected supporter and authorized safety moderators.</p></div></div></section>
    {error && <InlineError message={error} onRetry={load} />}
    <div className="status-strip"><div><span className="status-icon coral"><Clock3 size={19} /></span><p><b>{requests.filter((request) => !['completed', 'declined'].includes(request.status)).length} active request</b><small>{loading ? 'Loading…' : current ? current.status.replaceAll('_', ' ') : 'Ready when you are'}</small></p></div><div><span className="status-icon sage"><UserRoundCheck size={19} /></span><p><b>{matched?.displayName || (current?.riskLevel === 'urgent' ? 'Moderator review' : 'No current match')}</b><small>{matched ? `${current.matchScore}% relevance` : 'We will keep you informed'}</small></p></div><div><span className="status-icon gold"><MessageCircle size={19} /></span><p><b>{matched ? 'Private messaging ready' : 'Private messaging'}</b><small>{matched ? 'Open your conversation anytime' : 'Available after matching'}</small></p></div></div>
    <section className="section-block"><div className="section-heading"><div><span className="eyebrow">YOUR CURRENT MATCH</span><h2>Support that feels understood</h2></div><span className="safe-label"><LockKeyhole size={14} /> Only visible to you and your care team</span></div>
      {matched ? <div className="match-card featured-match"><div className="match-profile"><span className="avatar xl" style={{ background: matched.avatarColor }}>{matched.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2)}<span className="online-dot" /></span><div><div className="match-name"><h3>{matched.displayName}</h3><span><Sparkles size={13} /> {current.matchScore}% match</span></div><p>Peer supporter · {matched.yearsActive || 0} years on MentalBridge</p><div className="expertise-row">{(matched.expertise || []).map((tag) => <span key={tag}>{tag}</span>)}</div></div></div><blockquote>“{matched.bio}”</blockquote><div className="match-actions"><button className="button button-dark" onClick={() => onNavigate('messages')}>Message {matched.displayName.split(' ')[0]} <MessageCircle size={16} /></button><button className="button button-secondary" onClick={() => setPlanOpen(true)}>View support plan</button><button className="text-button danger" onClick={cancelRequest}>Cancel request</button></div></div> : current ? <div className="empty-match"><ShieldCheck size={28} /><div><h3>{current.status === 'pending' ? 'Your request is in the waiting queue' : 'Your request is being reviewed'}</h3><p>{current.status === 'pending' ? 'The care team can arrange a connection when a volunteer becomes available.' : 'A moderator will review it before any peer match is made.'} MentalBridge is not an emergency service.</p></div></div> : <div className="empty-match"><HeartHandshake size={28} /><div><h3>Your next connection can start here</h3><p>Create a private support request and review your recommended peer supporters.</p></div><button className="button button-dark" onClick={onSupport}>Find peer support</button></div>}
    </section>
    <section className="section-block"><div className="section-heading"><div><span className="eyebrow">REQUEST HISTORY</span><h2>Your support journey</h2></div></div><div className="history-list">{requests.length ? requests.slice().reverse().map((request) => <div className="history-item" key={request.id}><div><b>{request.tags.join(' · ')}</b><p>{request.summary}</p><small>{new Date(request.createdAt).toLocaleString()} · {request.status.replaceAll('_', ' ')}</small></div>{request.status === 'completed' && !request.feedback && <button className="button button-secondary" onClick={() => setFeedbackId(request.id)}>Leave feedback</button>}{request.feedback && <span className="rating-display">{'★'.repeat(request.feedback.rating)}</span>}</div>) : <p className="empty-copy">No support requests yet.</p>}</div></section>
    {planOpen && <SimpleModal title="Your support plan" onClose={() => setPlanOpen(false)}><p><b>Current focus:</b> {current.priorities.join(', ')}</p><p><b>Supporter:</b> {matched.displayName}</p><p><b>Next step:</b> Continue your private conversation at a pace that feels comfortable. You can pause or cancel at any time.</p><button className="button button-dark" onClick={() => { setPlanOpen(false); onNavigate('messages') }}>Open conversation</button></SimpleModal>}
    {feedbackId && <SimpleModal title="How was your support?" onClose={() => setFeedbackId(null)}><p>Your feedback helps moderators improve peer-support quality.</p><div className="rating-buttons">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} onClick={() => sendFeedback(feedbackId, rating)} aria-label={`${rating} star rating`}>{rating} ★</button>)}</div></SimpleModal>}
  </div>
}

function SupportQueueView({ requests, loading, error, reload, user, showToast }) {
  const [busy, setBusy] = useState('')
  const update = async (requestId, updates) => {
    setBusy(requestId)
    try { await api.updateSupportRequest(requestId, updates); await reload(); window.dispatchEvent(new CustomEvent('mentalbridge:counts')); showToast('Support request updated') }
    catch (requestError) { showToast(requestError.message) }
    finally { setBusy('') }
  }
  return <div className="support-layout"><section className="support-intro-card"><div className="support-intro-copy"><span className="eyebrow light"><UserRoundCheck size={14} /> PEER-SUPPORT WORKSPACE</span><h2>{user.role === 'volunteer' ? 'Your assigned connections.' : 'Coordinate support safely.'}</h2><p>Review user-approved summaries, manage requests, and keep members informed through status updates.</p></div><div className="privacy-panel"><ShieldCheck size={27} /><div><b>Privacy protected</b><p>Members are identified by anonymous display names in coordination views.</p></div></div></section>{error && <InlineError message={error} onRetry={reload} />}<section className="section-block"><div className="section-heading"><div><span className="eyebrow">SUPPORT QUEUE</span><h2>{loading ? 'Loading requests…' : `${requests.length} request${requests.length === 1 ? '' : 's'}`}</h2></div></div><div className="request-card-list">{requests.map((request) => <article className="request-card" key={request.id}><div className="request-card-head"><div><span className={`risk-pill ${request.riskLevel}`}>{request.riskLevel}</span><h3>{request.user?.displayName || 'Anonymous member'}</h3></div><span className="status-badge">{request.status.replaceAll('_', ' ')}</span></div><p>{request.summary}</p><div className="expertise-row">{request.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>{request.sessionNote && <div className="session-note"><b>Moderator-only note</b><p>{request.sessionNote}</p></div>}<div className="request-actions">{request.status === 'assigned' && <button className="button button-dark" disabled={busy === request.id} onClick={() => update(request.id, { status: 'in_progress' })}>Accept & begin</button>}{request.status === 'in_progress' && <button className="button button-dark" disabled={busy === request.id} onClick={() => update(request.id, { status: 'completed' })}>Mark completed</button>}{request.status === 'moderator_review' && user.role !== 'volunteer' && <button className="button button-dark" disabled={busy === request.id} onClick={() => update(request.id, { status: 'assigned' })}>Mark reviewed</button>}{!['completed', 'declined'].includes(request.status) && <button className="button button-secondary" disabled={busy === request.id} onClick={() => update(request.id, { status: 'declined' })}>Decline</button>}</div></article>)}{!loading && !requests.length && <p className="empty-copy">There are no requests in your queue.</p>}</div></section></div>
}

const matchingDemoPrompts = [
  { label: 'Work stress + sleep', text: 'Work deadlines have been overwhelming me, I keep worrying at night, and I am struggling to sleep.' },
  { label: 'Loneliness + confidence', text: 'I have felt isolated since moving and my confidence has dropped. I would value someone patient to talk with.' },
  { label: 'Grief + low mood', text: 'I am grieving someone close to me and have been feeling low and disconnected from the people around me.' },
  { label: 'Family pressure', text: 'Family expectations are making me anxious and I keep feeling that I am not good enough.' },
]

function SupportModal({ onClose, onComplete }) {
  const [step, setStep] = useState(1)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedVolunteer, setSelectedVolunteer] = useState(null)
  const [analysis, setAnalysis] = useState(() => analyzeConcern(''))
  const [matchedVolunteers, setMatchedVolunteers] = useState([])
  const [error, setError] = useState('')
  const [editingSummary, setEditingSummary] = useState(false)
  const [newTag, setNewTag] = useState('')

  const toggleTag = (tag) => setAnalysis((current) => ({ ...current, tags: current.tags.includes(tag) && current.tags.length > 1 ? current.tags.filter((item) => item !== tag) : current.tags }))
  const addTag = () => {
    const tag = newTag.trim()
    if (!tag || analysis.tags.includes(tag) || analysis.tags.length >= 6) return
    setAnalysis((current) => ({ ...current, tags: [...current.tags, tag] }))
    setNewTag('')
  }

  const loadMatches = async (tags, priorities = []) => {
    const { volunteers: results } = await api.volunteers(tags, priorities)
    const formatted = results.map((volunteer) => ({
      id: volunteer.id,
      name: volunteer.displayName,
      initials: volunteer.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2),
      role: 'Peer supporter', match: volunteer.matchScore, color: volunteer.avatarColor,
      experience: (volunteer.expertise || []).join(' · '), bio: volunteer.bio,
      status: (volunteer.matchReasons || [volunteer.availability === 'available' ? 'Available today' : 'Limited availability']).join(' · '),
    }))
    setMatchedVolunteers(formatted)
    setSelectedVolunteer((current) => formatted.some((volunteer) => volunteer.id === current) ? current : formatted[0]?.id || null)
  }

  const createRequest = async (volunteerId = selectedVolunteer) => {
    await api.createSupportRequest({ description: text, summary: analysis.summary, tags: analysis.tags, priorities: analysis.priorities || analysis.tags.slice(0, 2), volunteerId })
    onComplete()
  }

  const continueFlow = async () => {
    setError('')
    if (step === 1) {
      setLoading(true)
      try {
        const { analysis: serverAnalysis } = await api.analyze(text)
        setAnalysis(serverAnalysis)
        if (serverAnalysis.riskLevel !== 'urgent') await loadMatches(serverAnalysis.tags, serverAnalysis.priorities)
        setStep(2)
      } catch (requestError) { setError(requestError.message) }
      finally { setLoading(false) }
    } else if (step === 2) {
      setLoading(true)
      try {
        if (analysis.riskLevel === 'urgent') await createRequest(null)
        else { await loadMatches(analysis.tags, analysis.priorities); setStep(3) }
      } catch (requestError) { setError(requestError.message) }
      finally { setLoading(false) }
    }
    else {
      setLoading(true)
      try {
        await createRequest()
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
          <div className="prompt-chips"><span>Try a sample:</span>{matchingDemoPrompts.map((prompt) => <button key={prompt.label} onClick={() => setText(prompt.text)}>{prompt.label}</button>)}</div>
          <div className="safety-note"><LockKeyhole size={17} /><span><b>Your words are protected.</b> We use them only to coordinate your peer support.</span></div>
        </div>}

        {step === 2 && <div className="modal-body review-step">
          <span className="eyebrow"><Sparkles size={14} /> YOUR PRIVATE SUMMARY</span>
          <h2 id="support-modal-title">Did we understand you correctly?</h2>
          <p>This is a starting point, not a diagnosis. You can change any part before continuing.</p>
          <div className="analysis-card">
            <div className="analysis-title"><span><Brain size={20} /></span><div><b>What we heard</b><small>{analysis.provider === 'ollama' ? 'AI-assisted with self-hosted Qwen' : analysis.provider === 'openai' ? 'AI-assisted with OpenAI' : analysis.provider === 'gemini' ? 'AI-assisted with Gemini' : 'Basic local theme analysis'} · visible to your matched supporter</small></div><button onClick={() => setEditingSummary(!editingSummary)}>{editingSummary ? 'Done' : 'Edit'}</button></div>
            {editingSummary ? <textarea className="summary-editor" value={analysis.summary} onChange={(event) => setAnalysis((current) => ({ ...current, summary: event.target.value }))} /> : <p>{analysis.summary}</p>}
          </div>
          {analysis.crisisNotice && <div className="crisis-notice"><LifeBuoy size={19} /><span><b>Please seek immediate, real-time help</b>{analysis.crisisNotice}</span></div>}
          <div className="topic-section"><b>Support themes</b><span>Select a theme to keep it</span><div className="topic-list">{analysis.tags.map((tag) => <button className="selected" key={tag} onClick={() => toggleTag(tag)}><Check size={13} />{tag}</button>)}</div><div className="add-tag-row"><input value={newTag} onChange={(event) => setNewTag(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag() } }} placeholder="Add a support theme" maxLength={60} /><button className="button button-secondary" onClick={addTag} disabled={!newTag.trim() || analysis.tags.length >= 6}><Plus size={13} /> Add</button></div></div>
          <div className="safety-note"><Info size={17} /><span>This tool helps coordinate peer support. It does not diagnose conditions or replace professional care.</span></div>
        </div>}

        {step === 3 && <div className="modal-body choose-step">
          <span className="eyebrow"><HeartHandshake size={14} /> RECOMMENDED FOR YOU</span>
          <h2 id="support-modal-title">Choose someone who feels right</h2>
          <p>Volunteers are appointed by the care team and ranked using your reviewed support themes and their availability.</p>
          <div className="volunteer-options">{!matchedVolunteers.length && <p role="status">No volunteers are available yet. Submit your request to the waiting queue for the care team to arrange support.</p>}{matchedVolunteers.map((volunteer) => (
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
            {loading ? <><LoaderCircle className="spin" size={17} /> {step === 3 || analysis.riskLevel === 'urgent' ? 'Creating your request…' : step === 2 ? 'Refreshing matches…' : 'Understanding your words…'}</> : step === 1 ? <>Review my summary <ArrowRight size={16} /></> : step === 2 && analysis.riskLevel === 'urgent' ? <>Send for moderator review <ShieldCheck size={16} /></> : step === 2 ? <>Find my matches <ArrowRight size={16} /></> : <>Request a connection <HeartHandshake size={16} /></>}
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
    priorities: tags.slice(0, 2),
    provider: 'local-preview',
    summary: text.trim().length > 35
      ? `You’ve been dealing with ${topic}, and it sounds like carrying this by yourself has become difficult. You’re looking for a calm, understanding person who can listen and help you feel less alone in it.`
      : `You’re going through a period of ${topic} and would value a calm, understanding person to talk with.`,
  }
}

function MessagesView({ showToast, user, onNavigate }) {
  const [conversationItems, setConversationItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [error, setError] = useState('')

  const loadConversations = () => api.conversations().then(({ conversations: items }) => {
    setConversationItems(items)
    setSelected((current) => current || items[0]?.id || null)
  }).finally(() => setLoading(false))
  useEffect(() => { loadConversations().catch((requestError) => setError(requestError.message)) }, [])
  useEffect(() => {
    if (!selected) return
    api.messages(selected).then(async (result) => {
      setMessages(result.messages)
      await loadConversations().catch(() => undefined)
      window.dispatchEvent(new CustomEvent('mentalbridge:counts'))
    }).catch(() => undefined)
  }, [selected])
  useEffect(() => {
    const refresh = () => selected && api.messages(selected).then(async (result) => {
      setMessages(result.messages)
      await loadConversations().catch(() => undefined)
      window.dispatchEvent(new CustomEvent('mentalbridge:counts'))
    }).catch(() => undefined)
    window.addEventListener('mentalbridge:message', refresh)
    return () => window.removeEventListener('mentalbridge:message', refresh)
  }, [selected])

  const activeConversation = conversationItems.find((item) => item.id === selected)
  const other = activeConversation?.other
  const filteredConversations = conversationItems.filter((conversation) => `${conversation.other.displayName} ${conversation.lastMessage?.text || ''}`.toLowerCase().includes(searchText.toLowerCase()))

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
        <div className="conversation-head"><h2>Conversations</h2><button className="icon-button" onClick={() => onNavigate('support')} aria-label="Start a new support request"><Plus size={18} /></button></div>
        <label className="inline-search"><Search size={16} /><input placeholder="Search messages" value={searchText} onChange={(event) => setSearchText(event.target.value)} /></label>
        {error && <InlineError message={error} onRetry={() => { setError(''); loadConversations().catch((requestError) => setError(requestError.message)) }} compact />}
        {filteredConversations.map((conversation) => <button key={conversation.id} className={`conversation-item ${selected === conversation.id ? 'selected' : ''}`} onClick={() => setSelected(conversation.id)}>
          <span className="avatar" style={{ background: conversation.other.avatarColor }}>{conversation.other.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2)}{conversation.other.availability === 'available' && <span className="online-dot" />}</span>
          <span className="conversation-copy"><span><b>{conversation.other.displayName}</b><small>{conversation.lastMessage ? new Date(conversation.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</small></span><span><p>{conversation.lastMessage?.text || 'Start the conversation when you feel ready.'}</p>{conversation.unread > 0 && <em>{conversation.unread}</em>}</span></span>
        </button>)}
        {!loading && conversationItems.length === 0 && <div className="conversation-empty"><MessageCircle size={24} /><p>Your conversations will appear after you match with a peer supporter.</p></div>}
      </aside>
      <section className="chat-panel">
        {other ? <><div className="chat-head"><div className="session-person"><span className="avatar" style={{ background: other.avatarColor }}>{other.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2)}{other.availability === 'available' && <span className="online-dot" />}</span><div><h3>{other.displayName}</h3><p>{other.availability === 'available' ? 'Online' : 'Offline'} · {other.role === 'user' ? 'Anonymous member' : 'Peer supporter'}</p></div></div><button className="icon-button" aria-label="Conversation information" onClick={() => showToast('Conversation privacy: participants and authorized safety moderators only')}><Info size={19} /></button></div>
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

function LegacyCommunityView({ showToast, user }) {
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
    try { await api.reportPost(postId, 'other', 'Potentially harmful or inappropriate content'); showToast('Report sent privately to moderators') }
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

function CommunityView({ showToast, user }) {
  const [filter, setFilter] = useState('All stories')
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState({ title: '', body: '', category: 'General' })
  const [openPost, setOpenPost] = useState(null)
  const [comment, setComment] = useState('')
  const [replyTarget, setReplyTarget] = useState(null)
  const [editing, setEditing] = useState(null)
  const [reportTarget, setReportTarget] = useState(null)
  const [reportCategory, setReportCategory] = useState('harassment')
  const [reportDetails, setReportDetails] = useState('')
  const filters = ['All stories', 'Anxiety', 'Burnout', 'Loneliness', 'Small wins', 'General']
  const load = async () => {
    setError('')
    try { setPosts((await api.posts(filter)).posts) }
    catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [filter])

  const publish = async () => {
    try {
      const { post } = await api.createPost(draft)
      setPosts((items) => [post, ...items])
      setDraft({ title: '', body: '', category: 'General' })
      setComposerOpen(false)
      showToast('Your story was shared anonymously')
    } catch (requestError) { showToast(requestError.message) }
  }
  const replacePost = (post) => setPosts((items) => items.map((item) => item.id === post.id ? post : item))
  const react = async (postId) => { try { replacePost((await api.reactToPost(postId)).post) } catch (requestError) { showToast(requestError.message) } }
  const bookmark = async (post) => {
    try { await api.bookmarkPost(post.id); replacePost({ ...post, bookmarked: !post.bookmarked }); showToast(post.bookmarked ? 'Removed from saved posts' : 'Post saved') }
    catch (requestError) { showToast(requestError.message) }
  }
  const submitComment = async (postId) => {
    if (!comment.trim()) return
    try {
      const { comment: created } = await api.commentOnPost(postId, comment.trim(), replyTarget?.id)
      setPosts((items) => items.map((post) => post.id === postId ? { ...post, comments: [...post.comments, created], commentCount: post.commentCount + 1 } : post))
      setComment('')
      setReplyTarget(null)
      showToast('Reply shared anonymously')
    } catch (requestError) { showToast(requestError.message) }
  }
  const saveEdit = async () => {
    try { const { post } = await api.updatePost(editing.id, { title: editing.title, body: editing.body, category: editing.category }); replacePost(post); setEditing(null); showToast('Post updated') }
    catch (requestError) { showToast(requestError.message) }
  }
  const remove = async (postId) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    try { await api.deletePost(postId); setPosts((items) => items.filter((post) => post.id !== postId)); setOpenPost(null); showToast('Post deleted') }
    catch (requestError) { showToast(requestError.message) }
  }
  const report = async () => { try { await api.reportPost(reportTarget.id, reportCategory, reportDetails.trim()); setReportTarget(null); setReportDetails(''); showToast('Report sent privately to moderators') } catch (requestError) { showToast(requestError.message) } }

  return <div className="community-layout"><section className="community-feed"><div className="community-toolbar"><div className="filter-tabs">{filters.map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><button className="button button-dark" onClick={() => setComposerOpen(!composerOpen)}><Plus size={16} /> Share something</button></div>
    {composerOpen && <div className="community-composer"><div><span className="avatar">{user.anonymousName.slice(0, 2).toUpperCase()}</span><div><b>Share as {user.anonymousName}</b><small>Your identity stays private</small></div></div><label><span>Topic</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{filters.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Give your post a clear title" maxLength={240} /><textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="What would you like the community to hear?" maxLength={3000} /><div><span><ShieldCheck size={14} /> Community care guidelines apply</span><button className="button button-dark" disabled={draft.title.trim().length < 10} onClick={publish}>Share anonymously</button></div></div>}
    {error && <InlineError message={error} onRetry={load} />}
    <div className="community-posts">{posts.map((post) => <article className="community-post" key={post.id}><div className="community-post-head"><div className="post-meta"><span className="avatar" style={{ background: post.avatarColor || post.color }}>{post.initials}</span><span><b>{post.author}</b><small>{post.time} · Anonymous member</small></span></div>{post.pinned && <span className="pinned-label">Pinned</span>}</div><span className="category-tag">{post.category}</span><h2>{post.title}</h2><p>{post.body}</p><div className="community-post-actions"><button className={post.liked ? 'liked' : ''} onClick={() => react(post.id)}><Heart size={17} fill={post.liked ? 'currentColor' : 'none'} /> {post.likes}</button><button onClick={() => setOpenPost(openPost === post.id ? null : post.id)}><MessageSquare size={17} /> {post.commentCount ?? post.comments?.length ?? 0} replies</button><button className={post.bookmarked ? 'liked' : ''} onClick={() => bookmark(post)}><Bookmark size={17} fill={post.bookmarked ? 'currentColor' : 'none'} /> Save</button>{post.userId === user.id && <button onClick={() => setEditing({ ...post })}><Edit3 size={15} /> Edit</button>}{post.userId === user.id && <button className="report" onClick={() => remove(post.id)}><Trash2 size={15} /> Delete</button>    }{post.userId !== user.id && <button className="report" onClick={() => { setReportTarget(post); setReportCategory('harassment'); setReportDetails('') }}><Flag size={15} /> Report</button>}</div>
      {openPost === post.id && <div className="comments-panel"><h3>Conversation</h3>{post.comments?.length ? post.comments.map((item) => <div className={`comment ${item.parentId ? 'comment-reply' : ''}`} key={item.id}><span className="avatar tiny">{item.author.slice(0, 2).toUpperCase()}</span><div><b>{item.author}</b><p>{item.text}</p><small>{new Date(item.createdAt).toLocaleString()}</small>{!post.locked && <button className="comment-reply-button" onClick={() => { setReplyTarget(item); setComment('') }}>Reply</button>}</div></div>) : <p className="empty-copy">No replies yet. You can be the first.</p>}{!post.locked ? <div className="comment-composer">{replyTarget && <div className="replying-to">Replying to {replyTarget.author}<button type="button" onClick={() => setReplyTarget(null)} aria-label="Cancel reply">×</button></div>}<input value={comment} onChange={(event) => setComment(event.target.value)} placeholder={replyTarget ? `Reply to ${replyTarget.author}…` : 'Reply with care…'} maxLength={1200} /><button className="button button-dark" onClick={() => submitComment(post.id)} disabled={!comment.trim()}>Reply</button></div> : <p className="locked-copy"><LockKeyhole size={14} /> This discussion is locked.</p>}</div>}
    </article>)}{!loading && !posts.length && !error && <p className="empty-copy">No posts match this category yet.</p>}</div></section><aside className="community-rail"><div className="rail-card guidelines-card"><span className="status-icon sage"><ShieldCheck size={20} /></span><h3>A community built on care</h3><p>Lead with empathy, respect privacy, and share from your own experience.</p><button onClick={() => showToast('Be kind, protect privacy, avoid diagnosis, and report safety concerns.')}>Read community guidelines <ArrowRight size={14} /></button></div><div className="rail-card topic-card"><span className="eyebrow">TRENDING GENTLY</span><h3>Browse by topic</h3>{filters.slice(1, 4).map((topic, index) => <button key={topic} onClick={() => setFilter(topic)}><span>{index + 1}</span><div><b>{topic}</b><small>Open conversations</small></div><ChevronRight size={16} /></button>)}</div></aside>
    {editing && <SimpleModal title="Edit your post" onClose={() => setEditing(null)}><label className="modal-field"><span>Category</span><select value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })}>{filters.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label className="modal-field"><span>Title</span><input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label><label className="modal-field"><span>Post</span><textarea value={editing.body} onChange={(event) => setEditing({ ...editing, body: event.target.value })} /></label><button className="button button-dark" onClick={saveEdit} disabled={editing.title.trim().length < 10}><Save size={16} /> Save changes</button></SimpleModal>}
    {reportTarget && <SimpleModal title="Report this post" onClose={() => setReportTarget(null)}><p className="modal-copy">Choose the category that best describes your concern. This report is sent privately to moderators.</p><label className="modal-field"><span>Report category</span><select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}><option value="harassment">Harassment</option><option value="bullying">Bullying</option><option value="hate_speech">Hate speech</option><option value="threats">Threats or intimidation</option><option value="self_harm">Self-harm or safety concern</option><option value="spam">Spam or misleading content</option><option value="other">Other</option></select></label><label className="modal-field"><span>Additional details <em>(optional)</em></span><textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={500} placeholder="Tell moderators what happened" /></label><button className="button button-dark" onClick={report}>Submit report</button></SimpleModal>}
  </div>
}

function MoodView({ moodEntries, setMoodEntries, showToast }) {
  const [selectedMood, setSelectedMood] = useState(null)
  const [journal, setJournal] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [saving, setSaving] = useState(false)
  const maxHeight = 150
  const saveEntry = async () => {
    if (!selectedMood) return
    setSaving(true)
    try {
      await api.saveMood({ score: selectedMood, journal })
      setMoodEntries((entries) => [...entries.filter((entry) => entry.day !== 'Today'), { day: 'Today', score: selectedMood, journal }])
      setJournal('')
      setSelectedMood(null)
      showToast('Today’s check-in is saved')
    } catch (error) { showToast(error.message) }
    finally { setSaving(false) }
  }
  const average = moodEntries.length ? (moodEntries.reduce((sum, entry) => sum + entry.score, 0) / moodEntries.length).toFixed(1) : '—'
  const bestEntry = moodEntries.reduce((best, entry) => !best || entry.score > best.score ? entry : best, null)
  const chartEntries = showAll ? moodEntries : moodEntries.slice(-7)

  return (
    <div className="mood-layout">
      <section className="mood-journal-card">
        <span className="eyebrow">TODAY’S CHECK-IN</span><h2>Meet yourself where you are.</h2><p>No mood is good or bad. This is simply a moment to notice.</p>
        <div className="mood-picker-large">{moods.map((mood) => <button key={mood.score} className={selectedMood === mood.score ? 'selected' : ''} onClick={() => setSelectedMood(mood.score)}><span>{mood.face}</span><b>{mood.label}</b></button>)}</div>
        <label className="journal-field"><span>Anything you want to remember about today? <em>Optional</em></span><textarea value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="A few words is enough…" /></label>
        <button className="button button-dark" disabled={!selectedMood || saving} onClick={saveEntry}>{saving ? <><LoaderCircle className="spin" size={16} /> Saving…</> : <>Save today’s check-in <CheckCircle2 size={16} /></>}</button>
      </section>
      <section className="mood-insights">
        <div className="insight-stats"><div><span className="status-icon sage"><TrendingUp size={20} /></span><p><small>Average</small><b>{average}<em>/5</em></b></p></div><div><span className="status-icon coral"><Activity size={20} /></span><p><small>Check-in rhythm</small><b>{moodEntries.length}<em>days</em></b></p></div><div><span className="status-icon blue"><CalendarDays size={20} /></span><p><small>Best day</small><b>{bestEntry?.day || '—'}</b></p></div></div>
        <div className="mood-chart-card"><div className="section-heading compact"><div><span className="eyebrow">{showAll ? 'ALL CHECK-INS' : 'YOUR LAST 7 CHECK-INS'}</span><h2>Your mood pattern</h2></div><button className={`icon-button ${showAll ? 'saved' : ''}`} aria-label="Toggle complete mood history" onClick={() => setShowAll(!showAll)}><Filter size={17} /></button></div><div className="mood-chart" aria-label="Mood trend chart">{chartEntries.map((entry, index) => <div className="chart-column" key={`${entry.id || entry.day}-${index}`} title={entry.journal || moods[entry.score - 1]?.label}><span className="chart-score">{moods[entry.score - 1]?.face}</span><i style={{ height: `${(entry.score / 5) * maxHeight}px` }} /><small>{entry.day}</small></div>)}</div><p className="chart-note"><Sparkles size={15} /> Patterns are information, not judgment. Every check-in can help you notice what supports you.</p></div>
        <div className="mood-notes-card"><div className="section-heading compact"><div><span className="eyebrow">YOUR NOTES</span><h2>What you wanted to remember</h2></div></div>{chartEntries.filter((entry) => entry.journal?.trim()).length ? <div className="mood-notes-list">{chartEntries.filter((entry) => entry.journal?.trim()).slice().reverse().map((entry, index) => <article key={`${entry.id || entry.day}-${index}`}><span>{moods[entry.score - 1]?.face}</span><div><b>{entry.day}</b><p>{entry.journal}</p></div></article>)}</div> : <p className="empty-copy">Add a note to a check-in and it will appear here.</p>}</div>
        <div className="pattern-card"><div><span className="eyebrow">A PATTERN TO NOTICE</span><h3>Movement seems to help</h3><p>On days where you mentioned going outside, your check-in was an average of 0.8 points higher.</p></div><span className="pattern-icon"><Leaf size={28} /></span></div>
      </section>
    </div>
  )
}

function VolunteerDirectory({ onNavigate }) {
  const [volunteers, setVolunteers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    try { setVolunteers((await api.volunteerDirectory()).volunteers) }
    catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return <div className="volunteer-directory">
    <section className="volunteer-directory-hero">
      <div><span className="eyebrow light"><HeartHandshake size={14} /> PEOPLE WHO LISTEN</span><h2>Find a peer who gets it.</h2><p>Every volunteer brings their own lived experience, communication style, and way of making space for difficult days. Read about them before you decide whether to reach out.</p></div>
      <div className="volunteer-directory-art"><Users size={42} /></div>
    </section>
    {error && <InlineError message={error} onRetry={load} />}
    {loading ? <div className="empty-state"><LoaderCircle className="spin" size={28} /><p>Finding your peer support team…</p></div> : volunteers.length ? <div className="volunteer-card-grid">{volunteers.map((volunteer) => <article className="volunteer-directory-card" key={volunteer.id}>
      <div className="volunteer-card-head"><span className="avatar xl" style={{ background: volunteer.avatarColor }}>{volunteer.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2)}<span className={`availability-dot ${volunteer.availability}`} /></span><div><h3>{volunteer.displayName}</h3><span className={`availability-label ${volunteer.availability}`}>{volunteer.availability === 'available' ? 'Available for new connections' : volunteer.availability === 'limited' ? 'Limited availability' : 'Currently away'}</span></div></div>
      <p className="volunteer-card-bio">“{volunteer.bio}”</p>
      <div className="volunteer-card-stat"><span><StarRating rating={volunteer.rating} /> {volunteer.rating?.toFixed(1) || 'New'}</span><span>{volunteer.yearsActive || 0} years volunteering</span></div>
      <div className="volunteer-card-section"><b>Specialties</b><div className="expertise-row">{(volunteer.expertise || []).map((item) => <span key={item}>{item}</span>)}</div></div>
      <div className="volunteer-card-details"><span><Languages size={14} /> {(volunteer.languages || []).join(' · ')}</span><span><MessageCircle size={14} /> {volunteer.communicationStyle}</span></div>
      <button className="button button-dark full" onClick={() => onNavigate('support')}>Find support with this team <ArrowRight size={16} /></button>
    </article>)}</div> : <div className="empty-state"><Users size={29} /><h3>No peer volunteers are listed yet</h3><p>Our care team is preparing the next group of available peer supporters.</p></div>}
  </div>
}

function StarRating({ rating }) {
  return <span className="star-rating" aria-label={`${rating || 0} out of 5 stars`}>★</span>
}

function LegacyResourcesView({ showToast }) {
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
          <div className={`resource-card-art ${resource.color}`}>{resourceImage(resource) && <img src={resourceImage(resource)} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} />}<div className="resource-card-art-icon"><Icon size={resource.featured ? 42 : 30} strokeWidth={1.5} /></div>{resource.featured && <span>Recommended for you</span>}</div>
          <div className="resource-card-body"><div className="resource-card-meta"><span>{resource.category}</span><i>·</i><span>{resource.type}</span></div><h3>{resource.title}</h3><p>{resource.description}</p><div><button className="text-button">Open resource <ArrowUpRight size={15} /></button><button className={`icon-button ${saved ? 'saved' : ''}`} aria-label="Bookmark resource" onClick={() => toggleBookmark(resource.id)}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button></div></div>
        </article>
      })}</div> : <div className="empty-state"><Search size={29} /><h3>No resources found</h3><p>Try a broader word or another category.</p><button className="text-button" onClick={() => { setQuery(''); setCategory('All') }}>Clear filters <RefreshCcw size={14} /></button></div>}
    </div>
  )
}

function ResourcesView({ showToast, user }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [bookmarked, setBookmarked] = useState([])
  const [resourceItems, setResourceItems] = useState([])
  const [savedOnly, setSavedOnly] = useState(false)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const categories = ['All', 'Anxiety', 'Burnout', 'Mindfulness', 'Sleep', 'Self-care', 'Loneliness']
  const canBookmark = ['user', 'volunteer'].includes(user.role)
  const load = async () => {
    setError('')
    try { const result = await api.resources(query, category); setResourceItems(result.resources); setBookmarked(result.bookmarks) }
    catch (requestError) { setError(requestError.message) }
  }
  useEffect(() => {
    const timer = window.setTimeout(load, 180)
    return () => window.clearTimeout(timer)
  }, [query, category])
  useEffect(() => {
    const focus = () => document.getElementById('resource-search')?.focus()
    window.addEventListener('mentalbridge:focus-resource-search', focus)
    return () => window.removeEventListener('mentalbridge:focus-resource-search', focus)
  }, [])
  const toggleBookmark = async (id) => {
    const active = bookmarked.includes(id)
    try { const result = await api.toggleBookmark(id); setBookmarked(result.bookmarks); showToast(active ? 'Removed from saved resources' : 'Saved to your library') }
    catch (requestError) { showToast(requestError.message) }
  }
  const filtered = savedOnly ? resourceItems.filter((resource) => bookmarked.includes(resource.id)) : resourceItems
  return <div className="resources-layout"><section className="resource-hero"><div><span className="eyebrow light"><BookOpen size={14} /> YOUR PRACTICAL TOOLKIT</span><h2>Something helpful for this moment.</h2><p>Explore trusted, plain-language resources chosen for real life—not perfect days.</p><label><Search size={18} /><input id="resource-search" aria-label="Search resources" placeholder="Search anxiety, sleep, grounding…" value={query} onChange={(event) => { setSavedOnly(false); setQuery(event.target.value) }} /></label></div><div className="resource-hero-art"><span><Leaf size={42} /></span><i /><i /></div></section><div className="resource-filter-row"><div>{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => { setSavedOnly(false); setCategory(item) }}>{item}</button>)}</div>{canBookmark && <button className={`saved-filter ${savedOnly ? 'active' : ''}`} aria-pressed={savedOnly} onClick={() => { if (savedOnly) setSavedOnly(false); else { setQuery(''); setCategory('All'); setSavedOnly(true) } }}><Bookmark size={16} fill={savedOnly ? 'currentColor' : 'none'} /> {savedOnly ? 'All resources' : 'Saved resources'} ({bookmarked.length})</button>}</div>{error && <InlineError message={error} onRetry={load} />}
    {filtered.length ? <div className="resource-grid">{filtered.map((resource) => { const Icon = resourceIconMap[resource.icon] || BookOpen; const saved = bookmarked.includes(resource.id); return <article className={`resource-card ${resource.featured ? 'featured' : ''}`} key={resource.id}><div className={`resource-card-art ${resource.color}`}>{resourceImage(resource) && <img src={resourceImage(resource)} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} />}<div className="resource-card-art-icon"><Icon size={resource.featured ? 42 : 30} strokeWidth={1.5} /></div>{resource.featured && <span>Recommended for you</span>}</div><div className="resource-card-body"><div className="resource-card-meta"><span>{resource.category}</span><i>·</i><span>{resource.type}</span></div><h3>{resource.title}</h3><p>{resource.description}</p><div><button className="text-button" onClick={() => setSelected(resource)}>Open resource <ArrowUpRight size={15} /></button>{canBookmark && <button className={`icon-button ${saved ? 'saved' : ''}`} aria-label={`${saved ? 'Remove' : 'Add'} bookmark for ${resource.title}`} onClick={() => toggleBookmark(resource.id)}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button>}</div></div></article> })}</div> : !error && <div className="empty-state"><Search size={29} /><h3>{savedOnly ? 'No saved resources yet' : 'No resources found'}</h3><p>{savedOnly ? 'Bookmark a resource to keep it here.' : 'Try a broader word or another category.'}</p><button className="text-button" onClick={() => { setQuery(''); setCategory('All'); setSavedOnly(false) }}>Clear filters <RefreshCcw size={14} /></button></div>}
    {selected && <SimpleModal title={selected.title} onClose={() => setSelected(null)} wide><div className="resource-reader-meta"><span>{selected.category}</span><span>{selected.type}</span></div><p className="resource-reader-intro">{selected.description}</p><div className="resource-content">{selected.content}</div>{selected.url && /^https:\/\//.test(selected.url) && <p><a className="button button-dark" href={selected.url} target="_blank" rel="noopener noreferrer">Open book / workbook <ExternalLink size={16} /></a><small className="resource-source">Published by {selected.source}</small></p>}<div className="safety-note"><Info size={17} /><span>Educational information only. It does not replace professional mental healthcare.</span></div>{canBookmark && <button className="button button-secondary" onClick={() => toggleBookmark(selected.id)}><Bookmark size={16} /> {bookmarked.includes(selected.id) ? 'Remove bookmark' : 'Save resource'}</button>}</SimpleModal>}
  </div>
}

function LegacyAdminView({ showToast, user }) {
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

function AdminView({ showToast, user }) {
  const [data, setData] = useState({ stats: { activeUsers: 0, openRequests: 0, supportersOnline: 0, openReports: 0, positiveFeedback: 100 }, requests: [], reports: [], users: [], volunteers: [], posts: [], resources: [], logs: [] })
  const [tab, setTab] = useState('requests')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [resourceEditor, setResourceEditor] = useState(null)
  const load = async () => {
    setError('')
    try {
      const [stats, requestResult, reportResult, userResult, volunteerResult, postResult, resourceResult, logResult] = await Promise.all([
        api.adminStats(), api.supportRequests(), api.adminReports(), api.adminUsers(), api.volunteers([]), api.adminPosts(), api.adminResources(),
        user.role === 'admin' ? api.auditLogs() : Promise.resolve({ logs: [] }),
      ])
      setData({ stats: stats.stats, requests: requestResult.requests, reports: reportResult.reports, users: userResult.users, volunteers: volunteerResult.volunteers, posts: postResult.posts, resources: resourceResult.resources, logs: logResult.logs })
    } catch (requestError) { setError(requestError.message) }
  }
  useEffect(() => { load() }, [])
  const updateRequest = async (requestId, updates) => { setBusy(requestId); try { await api.updateSupportRequest(requestId, updates); await load(); showToast('Request updated') } catch (requestError) { showToast(requestError.message) } finally { setBusy('') } }
  const updateReport = async (reportId, status) => { setBusy(reportId); try { await api.updateReport(reportId, status); await load(); showToast('Report updated') } catch (requestError) { showToast(requestError.message) } finally { setBusy('') } }
  const updateUser = async (userId, status) => { setBusy(userId); try { await api.updateUserStatus(userId, status); await load(); showToast('Account status updated') } catch (requestError) { showToast(requestError.message) } finally { setBusy('') } }
  const updateRole = async (userId, role) => { setBusy(userId); try { await api.updateUserAccess(userId, { role }); await load(); showToast(`Role changed to ${role}`) } catch (requestError) { showToast(requestError.message) } finally { setBusy('') } }
  const moderatePost = async (postId, updates) => { setBusy(postId); try { await api.moderatePost(postId, updates); await load(); showToast('Post moderation updated') } catch (requestError) { showToast(requestError.message) } finally { setBusy('') } }
  const saveResource = async (resource) => {
    setBusy(resource.id || 'resource-new')
    try {
      if (resource.id) await api.updateResource(resource.id, resource)
      else await api.createResource(resource)
      setResourceEditor(null); await load(); showToast(resource.id ? 'Resource updated' : 'Resource published')
    } catch (requestError) { showToast(requestError.message) }
    finally { setBusy('') }
  }
  const deleteResource = async (resource) => {
    if (!window.confirm(`Permanently remove “${resource.title}”?`)) return
    setBusy(resource.id)
    try { await api.deleteResource(resource.id); await load(); showToast('Resource removed') }
    catch (requestError) { showToast(requestError.message) }
    finally { setBusy('') }
  }
  const exportReport = () => {
    const rows = [['Metric', 'Value'], ['Active users', data.stats.activeUsers], ['Open requests', data.stats.openRequests], ['Supporters online', data.stats.supportersOnline], ['Open reports', data.stats.openReports], ['Positive feedback', `${data.stats.positiveFeedback}%`]]
    const blob = new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'mentalbridge-analytics.csv'; link.click(); URL.revokeObjectURL(link.href)
    showToast('Analytics report exported')
  }
  return <div className="admin-layout"><div className="admin-notice"><ShieldCheck size={18} /><span><b>Restricted care-operations workspace</b><small>Signed in as {user.role}. Staff accounts manage the platform and cannot create support requests or community posts.</small></span></div>{error && <InlineError message={error} onRetry={load} />}<div className="admin-stats"><StatCard icon={Users} label="Active accounts" value={data.stats.activeUsers} trend="Verified platform access" color="sage" /><StatCard icon={HeartHandshake} label="Open requests" value={data.stats.openRequests} trend="Coordination queue" color="coral" /><StatCard icon={UserRoundCheck} label="Supporters online" value={data.stats.supportersOnline} trend="Available now" color="blue" /><StatCard icon={Flag} label="Open reports" value={data.stats.openReports} trend="Awaiting review" color="gold" /></div><div className="admin-tabs"><button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>Support requests</button><button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>Reports ({data.reports.filter((item) => item.status === 'open').length})</button><button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>People & roles</button><button className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>Community posts</button><button className={tab === 'resources' ? 'active' : ''} onClick={() => setTab('resources')}>Resources</button><button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>Analytics</button>{user.role === 'admin' && <button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>Audit log</button>}</div>
    {tab === 'requests' && <section className="admin-panel"><div className="section-heading"><div><span className="eyebrow">COORDINATION QUEUE</span><h2>Support requests</h2></div></div><div className="request-card-list">{data.requests.map((request) => <article className="request-card" key={request.id}><div className="request-card-head"><div><span className={`risk-pill ${request.riskLevel}`}>{request.riskLevel}</span><h3>{request.user?.displayName || 'Anonymous member'}</h3></div><span className="status-badge">{request.status.replaceAll('_', ' ')}</span></div><p>{request.summary}</p><div className="expertise-row">{request.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="admin-assignment"><select aria-label={`Assign volunteer for ${request.user?.displayName || request.id}`} value={request.volunteerId || ''} onChange={(event) => updateRequest(request.id, { volunteerId: event.target.value || null, status: event.target.value ? 'assigned' : 'moderator_review' })}><option value="">Unassigned</option>{data.volunteers.map((volunteer) => <option key={volunteer.id} value={volunteer.id}>{volunteer.displayName} · {volunteer.availability}</option>)}</select>{!['completed', 'declined'].includes(request.status) && <button className="button button-secondary" disabled={busy === request.id} onClick={() => updateRequest(request.id, { status: 'completed' })}>Complete</button>}</div></article>)}{!data.requests.length && <p className="empty-copy">The queue is clear.</p>}</div></section>}
    {tab === 'reports' && <section className="admin-panel"><div className="section-heading"><div><span className="eyebrow">MODERATION</span><h2>Reported content</h2></div></div><div className="report-list">{data.reports.map((report) => { const targetPost = data.posts.find((post) => post.id === report.targetId); return <article key={report.id}><div><b>{targetPost?.title || `${report.targetType} report`}</b><span className="status-badge">{report.category || 'other'} · {report.status}</span></div><p>{report.reason}</p><small>{new Date(report.createdAt).toLocaleString()}</small><div><button className="button button-secondary" disabled={busy === report.id} onClick={() => updateReport(report.id, 'reviewing')}>Review</button><button className="button button-dark" disabled={busy === report.id} onClick={() => updateReport(report.id, 'resolved')}>Resolve</button>{user.role === 'admin' && targetPost && !targetPost.removed && <button className="button button-danger" disabled={busy === targetPost.id} onClick={() => moderatePost(targetPost.id, { removed: true })}>Remove post</button>}<button className="text-button" disabled={busy === report.id} onClick={() => updateReport(report.id, 'dismissed')}>Dismiss</button></div></article> })}{!data.reports.length && <p className="empty-copy">No content reports have been submitted.</p>}</div></section>}
    {tab === 'users' && <section className="admin-panel"><div className="section-heading"><div><span className="eyebrow">ACCESS MANAGEMENT</span><h2>People and platform roles</h2><p>Administrators assign moderators. Administrators and moderators can appoint verified volunteers.</p></div></div><div className="user-table">{data.users.map((item) => { const protectedFromModerator = user.role === 'moderator' && ['moderator', 'admin'].includes(item.role); return <div key={item.id}><span className="avatar" style={{ background: item.avatarColor }}>{item.displayName.slice(0, 2).toUpperCase()}</span><div><b>{item.displayName}</b><small>{item.email || `@${item.anonymousName}`} · {item.emailVerified ? 'Email verified' : 'Awaiting email verification'}</small></div><select aria-label={`Role for ${item.displayName}`} value={item.role} disabled={item.id === user.id || item.role === 'admin' || protectedFromModerator || busy === item.id} onChange={(event) => updateRole(item.id, event.target.value)}><option value="user">Member</option><option value="volunteer">Volunteer</option>{user.role === 'admin' && <option value="moderator">Moderator</option>}{item.role === 'admin' && <option value="admin">Administrator</option>}</select><span className="status-badge">{item.status}</span>{item.id !== user.id && item.role !== 'admin' && !protectedFromModerator && <button className="button button-secondary" disabled={busy === item.id} onClick={() => updateUser(item.id, item.status === 'active' ? 'suspended' : 'active')}>{item.status === 'active' ? 'Suspend' : 'Activate'}</button>}</div> })}</div></section>}
    {tab === 'posts' && <section className="admin-panel"><div className="section-heading"><div><span className="eyebrow">COMMUNITY CONTROL</span><h2>Community posts</h2></div></div><div className="management-list">{data.posts.map((post) => <article key={post.id} className={post.removed ? 'removed-item' : ''}><div><span className="category-tag">{post.category}</span><span className="status-badge">{post.removed ? 'removed' : post.locked ? 'locked' : 'live'}</span></div><h3>{post.title}</h3><p>{post.body}</p><small>Anonymous author: {post.author} · {new Date(post.createdAt).toLocaleString()}</small><div><button className="button button-secondary" disabled={busy === post.id || post.removed} onClick={() => moderatePost(post.id, { locked: !post.locked })}>{post.locked ? 'Unlock' : 'Lock'} discussion</button><button className="button button-secondary" disabled={busy === post.id || post.removed} onClick={() => moderatePost(post.id, { pinned: !post.pinned })}>{post.pinned ? 'Unpin' : 'Pin'} post</button>{user.role === 'admin' && <button className={post.removed ? 'button button-secondary' : 'button button-danger'} disabled={busy === post.id} onClick={() => moderatePost(post.id, { removed: !post.removed })}>{post.removed ? 'Restore post' : 'Remove post'}</button>}</div></article>)}{!data.posts.length && <p className="empty-copy">No community posts yet.</p>}</div></section>}
    {tab === 'resources' && <section className="admin-panel"><div className="section-heading"><div><span className="eyebrow">RESOURCE LIBRARY</span><h2>Educational resources</h2><p>Both administrators and moderators can create, edit, publish, and unpublish resources.</p></div><button className="button button-dark" onClick={() => setResourceEditor({ title: '', description: '', content: '', category: 'Self-care', type: '5 min read', icon: 'BookOpen', color: 'sage', featured: false, published: true })}><Plus size={16} /> Add resource</button></div><div className="management-list resource-management-list">{data.resources.map((resource) => <article key={resource.id}><div><span className="category-tag">{resource.category}</span><span className="status-badge">{resource.published ? 'published' : 'draft'}</span></div><h3>{resource.title}</h3><p>{resource.description}</p><div><button className="button button-secondary" onClick={() => setResourceEditor({ ...resource })}><Edit3 size={15} /> Edit</button><button className="button button-secondary" disabled={busy === resource.id} onClick={() => saveResource({ ...resource, published: !resource.published })}>{resource.published ? 'Unpublish' : 'Publish'}</button>{user.role === 'admin' && <button className="button button-danger" disabled={busy === resource.id} onClick={() => deleteResource(resource)}><Trash2 size={15} /> Remove</button>}</div></article>)}{!data.resources.length && <p className="empty-copy">No resources have been created.</p>}</div></section>}
    {tab === 'analytics' && <section className="admin-panel analytics-panel"><div className="section-heading"><div><span className="eyebrow">PLATFORM INSIGHTS</span><h2>Operational summary</h2></div><button className="button button-secondary" onClick={exportReport}><ExternalLink size={16} /> Export CSV</button></div><div className="analytics-grid"><div><b>{data.stats.positiveFeedback}%</b><span>Positive session feedback</span></div><div><b>{data.requests.filter((item) => item.status === 'completed').length}</b><span>Completed sessions</span></div><div><b>{data.requests.filter((item) => item.riskLevel === 'urgent').length}</b><span>Safety reviews</span></div><div><b>{data.reports.filter((item) => item.status === 'resolved').length}</b><span>Resolved reports</span></div></div></section>}
    {tab === 'activity' && user.role === 'admin' && <section className="admin-panel"><div className="section-heading"><div><span className="eyebrow">ACCOUNTABILITY</span><h2>Administrator audit log</h2></div></div><div className="audit-list">{data.logs.map((log) => <div key={log.id}><span className="status-icon sage"><ShieldCheck size={16} /></span><div><b>{log.action.replaceAll('.', ' ')}</b><small>Actor: {data.users.find((item) => item.id === log.actorId)?.displayName || log.actorId} · Target: {log.targetId || 'platform'} · {new Date(log.createdAt).toLocaleString()}</small></div></div>)}{!data.logs.length && <p className="empty-copy">No administrative actions recorded yet.</p>}</div></section>}
    {resourceEditor && <ResourceEditor resource={resourceEditor} saving={busy === (resourceEditor.id || 'resource-new')} onClose={() => setResourceEditor(null)} onSave={saveResource} />}
  </div>
}

function ResourceEditor({ resource, saving, onClose, onSave }) {
  const [form, setForm] = useState(resource)
  const field = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  return <SimpleModal title={form.id ? 'Edit resource' : 'Add resource'} onClose={onClose} wide><div className="resource-editor"><label><span>Title</span><input value={form.title} onChange={field('title')} maxLength={180} /></label><div className="editor-row"><label><span>Category</span><input value={form.category} onChange={field('category')} maxLength={60} /></label><label><span>Format</span><input value={form.type} onChange={field('type')} placeholder="5 min read" /></label></div><label><span>Short description</span><textarea value={form.description} onChange={field('description')} maxLength={600} /></label><label><span>Full content</span><textarea className="resource-content-input" value={form.content} onChange={field('content')} maxLength={12000} /></label><div className="editor-row"><label><span>Icon</span><select value={form.icon} onChange={field('icon')}>{Object.keys(resourceIconMap).map((icon) => <option key={icon}>{icon}</option>)}</select></label><label><span>Color</span><select value={form.color} onChange={field('color')}>{['sage', 'lavender', 'apricot', 'blue', 'navy', 'rose'].map((color) => <option key={color}>{color}</option>)}</select></label></div><div className="editor-checks"><label><input type="checkbox" checked={Boolean(form.featured)} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Featured recommendation</label><label><input type="checkbox" checked={Boolean(form.published)} onChange={(event) => setForm({ ...form, published: event.target.checked })} /> Publish immediately</label></div><div className="modal-action-row"><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-dark" disabled={saving || form.title.trim().length < 5 || form.description.trim().length < 10 || form.content.trim().length < 20} onClick={() => onSave(form)}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Save resource</button></div></div></SimpleModal>
}

function StatCard({ icon: Icon, label, value, trend, color }) {
  return <div className="stat-card"><span className={`status-icon ${color}`}><Icon size={20} /></span><div><small>{label}</small><b>{value}</b><em>{trend}</em></div></div>
}

function SettingsView({ user, refreshUser, showToast }) {
  const [form, setForm] = useState({
    displayName: user.displayName || '', anonymousName: user.anonymousName || '',
    showOnline: user.privacy?.showOnline ?? true, allowReminders: user.privacy?.allowReminders ?? true,
    availability: user.availability || 'available', bio: user.bio || '', expertise: (user.expertise || []).join(', '), avatarUrl: user.avatarUrl || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const updates = { displayName: form.displayName, anonymousName: form.anonymousName, privacy: { showOnline: form.showOnline, allowReminders: form.allowReminders } }
      if (form.avatarUrl) updates.avatarUrl = form.avatarUrl
      if (user.role === 'volunteer') Object.assign(updates, { availability: form.availability, bio: form.bio, expertise: form.expertise.split(',').map((item) => item.trim()).filter(Boolean) })
      await api.updateProfile(updates); await refreshUser(); showToast('Account settings saved')
    } catch (requestError) { setError(requestError.message) }
    finally { setSaving(false) }
  }
  return <div className="settings-layout"><form className="settings-card" onSubmit={save}><div className="section-heading"><div><span className="eyebrow">PROFILE</span><h2>Your account</h2></div><span className="safe-label"><LockKeyhole size={14} /> Private account information</span></div>{error && <InlineError message={error} />}<ProfilePicturePicker value={form.avatarUrl} onChange={(avatarUrl) => setForm({ ...form, avatarUrl })} /><div className="settings-grid"><label><span>Full name</span><input required minLength={2} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label><label><span>Anonymous community name</span><input required minLength={3} value={form.anonymousName} onChange={(event) => setForm({ ...form, anonymousName: event.target.value })} /></label><label className="full"><span>Email address</span><input value={user.email} disabled /><small>Email changes require administrator verification.</small></label>{user.role === 'volunteer' && <><label><span>Availability</span><select value={form.availability} onChange={(event) => setForm({ ...form, availability: event.target.value })}><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select></label><label><span>Expertise, separated by commas</span><input value={form.expertise} onChange={(event) => setForm({ ...form, expertise: event.target.value })} /></label><label className="full"><span>Supporter introduction</span><textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} maxLength={500} /></label></>}</div><div className="privacy-settings"><h3>Privacy preferences</h3><label><input type="checkbox" checked={form.showOnline} onChange={(event) => setForm({ ...form, showOnline: event.target.checked })} /><span><b>Show online availability</b><small>Let your current peer connection know when you are available.</small></span></label><label><input type="checkbox" checked={form.allowReminders} onChange={(event) => setForm({ ...form, allowReminders: event.target.checked })} /><span><b>Mood check-in reminders</b><small>Allow MentalBridge to display reminder notifications.</small></span></label></div><button className="button button-dark" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={16} /> Saving…</> : <><Save size={16} /> Save settings</>}</button></form><aside className="settings-aside"><ShieldCheck size={28} /><h3>Your identity stays protected</h3><p>Community posts display your anonymous name. Your full name and email are not shown publicly.</p><div><b>Role</b><span>{user.role}</span></div><div><b>Account status</b><span>{user.status}</span></div></aside></div>
}

function HelpView({ onNavigate, user }) {
  const isStaff = ['moderator', 'admin'].includes(user.role)
  return <div className="info-page"><section className="info-hero"><CircleHelp size={32} /><div><span className="eyebrow light">HELP CENTER</span><h2>How can we help?</h2><p>Learn how the main MentalBridge workflows fit together.</p></div></section><div className="info-grid"><section className="info-card"><h3>Quick actions</h3>{!isStaff && <button onClick={() => onNavigate('support')}><HeartHandshake size={20} /><span><b>{user.role === 'volunteer' ? 'Open support queue' : 'Request peer support'}</b><small>{user.role === 'volunteer' ? 'Review the connections assigned to you.' : 'Describe your concern and choose a matched volunteer.'}</small></span><ChevronRight size={17} /></button>}{!isStaff && <button onClick={() => onNavigate('messages')}><MessageCircle size={20} /><span><b>Open private messages</b><small>Continue an existing peer-support conversation.</small></span><ChevronRight size={17} /></button>}{isStaff && <button onClick={() => onNavigate('admin')}><UserCog size={20} /><span><b>Open care operations</b><small>Manage users, roles, content, resources, and reports.</small></span><ChevronRight size={17} /></button>}<button onClick={() => onNavigate('resources')}><BookOpen size={20} /><span><b>Browse resources</b><small>Read practical educational material.</small></span><ChevronRight size={17} /></button></section><section className="faq-card"><h3>Frequently asked questions</h3><details><summary>Is MentalBridge therapy?</summary><p>No. MentalBridge coordinates non-clinical peer support and does not diagnose or treat mental illness.</p></details><details><summary>Who sees a support request?</summary><p>The approved summary is visible to the selected volunteer and authorized moderators. Community members cannot see it.</p></details><details><summary>How are staff roles assigned?</summary><p>Administrators assign moderators. Administrators and moderators can assign verified members as volunteers.</p></details><details><summary>What if someone needs urgent help?</summary><p>In Bangladesh, call the national emergency service at 999. MentalBridge cannot provide emergency response.</p></details></section></div></div>
}

function SafetyView() {
  return <div className="info-page"><section className="info-hero safety"><ShieldCheck size={34} /><div><span className="eyebrow light">SAFETY & PRIVACY</span><h2>A protected space for peer support.</h2><p>Clear boundaries, anonymous participation, and moderator oversight help keep the community safer.</p></div></section><div className="safety-grid"><article><LockKeyhole size={23} /><h3>Privacy by default</h3><p>Support requests and conversations are restricted to participants and authorized care moderators.</p></article><article><UserCog size={23} /><h3>Human moderation</h3><p>Reports and safety-sensitive requests enter a restricted moderation workflow.</p></article><article><Brain size={23} /><h3>Non-diagnostic AI</h3><p>AI organizes themes for coordination only. It does not diagnose, prescribe, or replace professional care.</p></article></div><div className="urgent-card"><LifeBuoy size={26} /><div><h3>Need immediate help in Bangladesh?</h3><p>MentalBridge is not an emergency or crisis-response service. If you may be in immediate danger, call the national emergency service now and reach out to a trusted person nearby.</p></div><a className="button button-coral" href="tel:999">Call 999</a></div></div>
}

function SimpleModal({ title, onClose, children, wide = false }) {
  return <div className="modal-backdrop" role="presentation"><section className={`simple-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></header><div>{children}</div></section></div>
}

function InlineError({ message, onRetry, compact = false }) {
  return <div className={`inline-error ${compact ? 'compact' : ''}`} role="alert"><Info size={18} /><span>{message}</span>{onRetry && <button onClick={onRetry}>Try again</button>}</div>
}

function NotificationPopover({ onClose, onNavigate }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const load = async () => {
    setError('')
    try { const result = await api.notifications(); setItems(result.notifications) }
    catch (failure) { setError(failure.message) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    const socket = connectRealtime()
    socket.on('notification', load)
    const escape = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', escape)
    return () => { socket.disconnect(); window.removeEventListener('keydown', escape) }
  }, [])
  const markRead = async () => {
    setSaving(true); setError('')
    try { await api.markNotificationsRead(); setItems((notifications) => notifications.map((item) => ({ ...item, read: true }))); window.dispatchEvent(new CustomEvent('mentalbridge:notifications')) }
    catch (failure) { setError(failure.message) }
    finally { setSaving(false) }
  }
  const icon = (type) => type === 'message' ? <MessageCircle size={17} /> : type === 'session' ? <CalendarDays size={17} /> : <BookOpen size={17} />
  const openNotification = (item) => {
    if (!item.read) markRead().catch(() => undefined)
    onClose()
    onNavigate(item.type === 'message' ? 'messages' : item.type === 'safety' || item.type === 'account' ? 'admin' : 'support')
  }
  return <section className="popover notification-popover" role="dialog" aria-label="Notifications"><div className="popover-head"><h3>Notifications</h3><button disabled={saving || !items.some((item) => !item.read)} onClick={markRead}>{saving ? 'Saving…' : 'Mark all read'}</button><button aria-label="Close notifications" onClick={onClose}><X size={17} /></button></div>{error && <InlineError message={error} onRetry={load} compact />}<div className="notification-list">{items.map((item) => <button type="button" key={item.id} className={`notification-item notification-item-clickable ${item.read ? '' : 'unread'}`} onClick={() => openNotification(item)}><span className={`status-icon ${item.type === 'message' ? 'coral' : item.type === 'session' ? 'sage' : 'blue'}`}>{icon(item.type)}</span><span><b>{item.title}</b><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small></span></button>)}{loading && <div className="popover-empty" role="status">Loading notifications…</div>}{!loading && !error && items.length === 0 && <div className="popover-empty">You’re all caught up.</div>}</div></section>
}

function ProfilePopover({ navigate, close, user, logout }) {
  const initials = user.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return <div className="popover profile-popover"><div className="profile-summary"><span className="avatar avatar-user large">{initials}</span><div><b>{user.displayName}</b><small>@{user.anonymousName} · {user.role}</small></div></div>{['moderator', 'admin'].includes(user.role) && <button onClick={() => { navigate('admin'); close() }}><UserCog size={17} /> Care operations</button>}<button onClick={() => { navigate('settings'); close() }}><Settings size={17} /> Account & privacy</button><button onClick={() => { navigate('help'); close() }}><CircleHelp size={17} /> Help center</button><div /><button onClick={() => { close(); logout() }}><LogOut size={17} /> Sign out</button></div>
}

export default App
