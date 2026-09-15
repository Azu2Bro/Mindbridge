import OpenAI from 'openai'

const crisisPattern = /\b(suicide|suicidal|kill myself|end my life|hurt myself|self[- ]harm|don'?t want to live)\b/i

const topicRules = [
  ['Work stress', /\b(work|job|boss|deadline|overwhelm|burnout)\b/i],
  ['Loneliness', /\b(alone|lonely|isolat|no one)\b/i],
  ['Anxious thoughts', /\b(anx|worr|panic|racing thoughts?|won'?t slow down)\b/i],
  ['Sleep & energy', /\b(sleep|tired|exhaust|insomnia|energy)\b/i],
  ['Low mood', /\b(sad|low|empty|hopeless|motivation|depress)\b/i],
  ['Grief', /\b(grief|loss|died|death|bereave)\b/i],
  ['Family pressure', /\b(family|parent|marriage|home pressure)\b/i],
  ['Self-esteem', /\b(worthless|not good enough|self[- ]esteem|confidence)\b/i],
]

export function localAnalysis(text) {
  const tags = topicRules.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag)
  if (!tags.length) tags.push('Emotional support', 'Feeling overwhelmed')
  if (tags.length === 1) tags.push('Feeling overwhelmed')
  const urgent = crisisPattern.test(text)
  const topic = tags.slice(0, 2).join(' and ').toLowerCase()
  return {
    summary: `You’ve been dealing with ${topic}, and it sounds like carrying this by yourself has become difficult. You’re looking for a calm, understanding person who can listen without judgment and help you find a manageable next step.`,
    tags: tags.slice(0, 4),
    priorities: tags.slice(0, 2),
    riskLevel: urgent ? 'urgent' : 'standard',
    crisisNotice: urgent
      ? 'Your words suggest you may need immediate, real-time help. MentalBridge cannot provide emergency response. In Bangladesh, call the national emergency service at 999 now and reach out to someone you trust nearby.'
      : null,
    provider: 'local',
  }
}

export async function analyzeSupportText(text) {
  const local = localAnalysis(text)
  if (local.riskLevel === 'urgent' || !process.env.OPENAI_API_KEY) return local

  // Keep the coordination flow responsive. If the external model is unavailable,
  // the deterministic local analyzer below still returns a useful summary.
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 8000, maxRetries: 0 })
  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      store: false,
      input: [
        {
          role: 'system',
          content: [{
            type: 'input_text',
            text: 'You organize peer-support requests. Be compassionate, concise, and non-diagnostic. Never claim clinical certainty. Extract only themes present in the text. This is coordination, not treatment.',
          }],
        },
        { role: 'user', content: [{ type: 'input_text', text }] },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'peer_support_analysis',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['summary', 'tags', 'priorities'],
            properties: {
              summary: { type: 'string' },
              tags: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } },
              priorities: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string' } },
            },
          },
        },
      },
    })
    const parsed = JSON.parse(response.output_text)
    return { ...parsed, riskLevel: 'standard', crisisNotice: null, provider: 'openai' }
  } catch (error) {
    console.error('OpenAI analysis failed; using local analyzer:', error.message)
    return local
  }
}

export function rankVolunteers(tags, users) {
  return users
    .filter((user) => user.role === 'volunteer' && user.status === 'active')
    .map((volunteer) => {
      const expertise = (volunteer.expertise || []).map((item) => item.toLowerCase())
      const overlap = tags.filter((tag) => expertise.some((item) => item.includes(tag.toLowerCase()) || tag.toLowerCase().includes(item))).length
      const availabilityBonus = volunteer.availability === 'available' ? 8 : 3
      const score = Math.min(98, 72 + overlap * 8 + availabilityBonus + Math.round((volunteer.rating || 4.5) - 4))
      return { ...volunteer, matchScore: score }
    })
    .sort((a, b) => b.matchScore - a.matchScore)
}
