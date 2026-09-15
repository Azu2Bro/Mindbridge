import bcrypt from 'bcryptjs'

const now = () => new Date().toISOString()

export async function createSeedData() {
  const passwordHash = await bcrypt.hash('Demo123!', 12)

  return {
    meta: { version: 1, createdAt: now() },
    users: [
      {
        id: 'user-alex', email: 'alex@mentalbridge.demo', passwordHash,
        displayName: 'Alex Morgan', anonymousName: 'StillWaters', role: 'user', status: 'active', emailVerified: true,
        privacy: { showOnline: true, allowReminders: true }, bookmarks: ['resource-grounding'],
        createdAt: now(), avatarColor: '#e5aa82',
      },
      {
        id: 'volunteer-maya', email: 'maya@mentalbridge.demo', passwordHash,
        displayName: 'Maya R.', anonymousName: 'Maya R.', role: 'volunteer', status: 'active', emailVerified: true,
        expertise: ['Anxiety', 'Work stress', 'Burnout'], livedExperience: ['Workplace anxiety', 'Burnout recovery'],
        availability: 'available', yearsActive: 2, rating: 4.9, avatarColor: '#f2bf8e',
        bio: 'I know how isolating workplace anxiety can feel. I am here to listen without judgment and help you find your next small step.',
        createdAt: now(),
      },
      {
        id: 'volunteer-sam', email: 'sam@mentalbridge.demo', passwordHash,
        displayName: 'Sam K.', anonymousName: 'Sam K.', role: 'volunteer', status: 'active', emailVerified: true,
        expertise: ['Loneliness', 'Life transitions', 'Self-esteem'], livedExperience: ['Relocation', 'Social isolation'],
        availability: 'available', yearsActive: 1, rating: 4.8, avatarColor: '#93c5b1',
        bio: 'My own recovery taught me the value of being truly heard. We can take things one conversation at a time.',
        createdAt: now(),
      },
      {
        id: 'volunteer-nora', email: 'nora@mentalbridge.demo', passwordHash,
        displayName: 'Nora A.', anonymousName: 'Nora A.', role: 'volunteer', status: 'active', emailVerified: true,
        expertise: ['Low mood', 'Grief', 'Family pressure'], livedExperience: ['Grief', 'Cultural expectations'],
        availability: 'limited', yearsActive: 3, rating: 4.9, avatarColor: '#aab7d4',
        bio: 'I offer a calm, patient space for difficult days and have lived experience navigating grief and cultural expectations.',
        createdAt: now(),
      },
      {
        id: 'moderator-lee', email: 'moderator@mentalbridge.demo', passwordHash,
        displayName: 'Lee Chen', anonymousName: 'Care moderator', role: 'moderator', status: 'active', emailVerified: true,
        createdAt: now(), avatarColor: '#8cb7a3',
      },
      {
        id: 'admin-jordan', email: 'admin@mentalbridge.demo', passwordHash,
        displayName: 'Jordan Admin', anonymousName: 'Administrator', role: 'admin', status: 'active', emailVerified: true,
        createdAt: now(), avatarColor: '#8498bd',
      },
    ],
    supportRequests: [
      {
        id: 'support-alex-1', userId: 'user-alex', description: 'Work has felt overwhelming and my thoughts keep racing about everything waiting for me.',
        summary: 'Alex has been dealing with work stress and anxious thoughts and would value a calm, understanding peer who can listen without judgment.',
        tags: ['Work stress', 'Anxious thoughts', 'Feeling overwhelmed'], priorities: ['Work stress', 'Anxious thoughts'],
        riskLevel: 'standard', status: 'in_progress', volunteerId: 'volunteer-maya', matchScore: 96,
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: now(),
        sessionAt: new Date(Date.now() + 3 * 3600000).toISOString(), feedback: null,
      },
    ],
    conversations: [
      {
        id: 'conversation-alex-maya', supportRequestId: 'support-alex-1', participantIds: ['user-alex', 'volunteer-maya'],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        messages: [
          { id: 'msg-1', senderId: 'volunteer-maya', text: 'Hi Alex, I’m glad you reached out today. How is this afternoon feeling compared with this morning?', createdAt: new Date(Date.now() - 25 * 60000).toISOString(), readBy: ['volunteer-maya', 'user-alex'] },
          { id: 'msg-2', senderId: 'user-alex', text: 'A little more manageable, but I can still feel myself thinking about everything waiting for me tomorrow.', createdAt: new Date(Date.now() - 22 * 60000).toISOString(), readBy: ['volunteer-maya', 'user-alex'] },
          { id: 'msg-3', senderId: 'volunteer-maya', text: 'That sounds like a lot to carry alone. We don’t have to solve tomorrow right now—would it help to name the one thought that keeps returning?', createdAt: new Date(Date.now() - 19 * 60000).toISOString(), readBy: ['volunteer-maya'] },
        ],
      },
    ],
    moods: [
      { id: 'mood-1', userId: 'user-alex', score: 2, journal: '', createdAt: new Date(Date.now() - 6 * 86400000).toISOString() },
      { id: 'mood-2', userId: 'user-alex', score: 3, journal: '', createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
      { id: 'mood-3', userId: 'user-alex', score: 3, journal: '', createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
      { id: 'mood-4', userId: 'user-alex', score: 4, journal: 'A short walk helped.', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
      { id: 'mood-5', userId: 'user-alex', score: 3, journal: '', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
      { id: 'mood-6', userId: 'user-alex', score: 4, journal: 'Spent time outside.', createdAt: new Date(Date.now() - 86400000).toISOString() },
    ],
    posts: [
      {
        id: 'post-small-win', userId: 'community-quiet-river', author: 'QuietRiver', initials: 'QR', avatarColor: '#d5a36d',
        category: 'Small wins', title: 'I went outside today, even though every part of me wanted to stay in bed',
        body: 'It was only a ten-minute walk, but I noticed the air was cool and the trees were moving. Sharing this here because small still counts.',
        createdAt: new Date(Date.now() - 18 * 60000).toISOString(), reactions: Array.from({ length: 42 }, (_, i) => `seed-like-${i}`), comments: [], locked: false, pinned: false,
      },
      {
        id: 'post-anxiety', userId: 'community-soft-morning', author: 'SoftMorning', initials: 'SM', avatarColor: '#8cb7a3',
        category: 'Anxiety', title: 'What helps you quiet the Sunday evening spiral?',
        body: 'I keep thinking through every possible thing that could go wrong at work. Looking for grounding routines that have genuinely helped people.',
        createdAt: new Date(Date.now() - 3600000).toISOString(), reactions: Array.from({ length: 28 }, (_, i) => `seed-like-a-${i}`), comments: [], locked: false, pinned: false,
      },
      {
        id: 'post-burnout', userId: 'community-new-leaf', author: 'NewLeaf', initials: 'NL', avatarColor: '#a9b8d1',
        category: 'Burnout', title: 'Learning that rest does not have to be earned',
        body: 'My peer supporter said something that stayed with me: exhaustion is information, not a personal failure. Maybe someone else needs that today.',
        createdAt: new Date(Date.now() - 3 * 3600000).toISOString(), reactions: Array.from({ length: 67 }, (_, i) => `seed-like-b-${i}`), comments: [], locked: false, pinned: false,
      },
    ],
    resources: [
      { id: 'resource-grounding', type: '3 min read', category: 'Anxiety', title: 'A gentle guide to grounding yourself', description: 'Five evidence-informed techniques for returning to the present when your thoughts begin to race.', content: 'Name five things you can see, four you can feel, three you can hear, two you can smell, and one you can taste. Move slowly and breathe normally.', icon: 'Wind', color: 'sage', featured: true, published: true, createdAt: now() },
      { id: 'resource-pause', type: '6 min listen', category: 'Mindfulness', title: 'A pause for difficult moments', description: 'A short guided practice to help you make room for what you are feeling.', content: 'Place both feet on the floor. Notice the support beneath you. Let your exhale be a little longer than your inhale.', icon: 'Headphones', color: 'lavender', published: true, createdAt: now() },
      { id: 'resource-burnout', type: '5 min read', category: 'Burnout', title: 'When your body says enough', description: 'Recognizing early signs of burnout and responding with compassion instead of guilt.', content: 'Burnout often shows up as exhaustion, distance, and reduced confidence. Treat these signs as information, not failure.', icon: 'Coffee', color: 'apricot', published: true, createdAt: now() },
      { id: 'resource-support-map', type: 'Worksheet', category: 'Self-care', title: 'Build your personal support map', description: 'A printable exercise for identifying the people, places, and practices you can lean on.', content: 'List one person, one place, and one practice that help you feel steadier. Add the smallest next action beside each.', icon: 'FileText', color: 'blue', published: true, createdAt: now() },
      { id: 'resource-sleep', type: '8 min read', category: 'Sleep', title: 'Unwinding a busy mind before bed', description: 'Small, realistic shifts that can help your nervous system prepare for rest.', content: 'Create a ten-minute transition before bed. Dim one light, put tomorrow on paper, and choose a repeatable closing ritual.', icon: 'MoonStar', color: 'navy', published: true, createdAt: now() },
      { id: 'resource-connection', type: '4 min read', category: 'Loneliness', title: 'Connection when reaching out feels hard', description: 'Low-pressure ways to reconnect without asking more of yourself than you can give.', content: 'Connection can begin with a low-pressure signal: reacting to a message, sharing a photo, or asking for ten minutes of company.', icon: 'HeartHandshake', color: 'rose', published: true, createdAt: now() },
    ],
    notifications: [
      { id: 'notification-1', userId: 'user-alex', type: 'message', title: 'Maya sent you a message', body: 'That sounds like a lot to carry alone…', read: false, createdAt: new Date(Date.now() - 4 * 60000).toISOString() },
      { id: 'notification-2', userId: 'user-alex', type: 'session', title: 'Check-in later today', body: 'Your conversation with Maya begins at 4:30 PM.', read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
    ],
    passwordResets: [],
    emailVerifications: [],
    reports: [],
    auditLogs: [],
  }
}
