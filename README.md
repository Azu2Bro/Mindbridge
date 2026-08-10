# MentalBridge

MentalBridge is a complete, runnable full-stack peer-support coordination application. It provides private support requests, AI-assisted issue organization, peer-volunteer matching, authenticated messaging, anonymous community discussions, mood tracking, resources, notifications, moderation workflows, and administrative analytics.

MentalBridge coordinates non-clinical peer support. It does not diagnose conditions, provide therapy, prescribe medication, or provide emergency response.

## Quick start

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:3001` and Vite proxies API and Socket.IO traffic during development.

Demo accounts all use the password `Demo123!`:

| Role | Email |
|---|---|
| Member | `alex@mentalbridge.demo` |
| Peer volunteer | `maya@mentalbridge.demo` |
| Moderator | `moderator@mentalbridge.demo` |
| Administrator | `admin@mentalbridge.demo` |

You can also register a completely new member account from the login page.

## Environment

Copy `.env.example` to `.env` and replace `JWT_SECRET` before any real deployment.

```env
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=replace-with-at-least-32-random-characters
DATA_FILE=.data/mentalbridge.json
MONGODB_URI=
MONGODB_DATABASE=mentalbridge
APP_URL=http://localhost:5173
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
```

The application works without an OpenAI key using its deterministic local support-theme analyzer. When `OPENAI_API_KEY` is configured, the server uses the OpenAI Responses API with strict structured output and `store: false`. Urgent-language detection runs locally before any optional model request.

The local JSON database works immediately. Set `MONGODB_URI` to a MongoDB Atlas connection string to switch persistence to MongoDB without changing the API or client.

In development, the password-reset screen receives its one-time reset token directly. Configure the SMTP variables in production to email expiring reset links.

## Implemented functionality

### Accounts and privacy

- Registration and login with bcrypt password hashing
- Seven-day signed JWT sessions
- Expiring, hashed password-reset tokens with optional SMTP delivery
- Role-based access for members, volunteers, moderators, and administrators
- Anonymous community identities separate from account names
- Profile and privacy preference API
- Rate-limited authentication and AI endpoints
- Helmet security headers and request-size limits

### Peer-support coordination

- Natural-language support requests
- Reviewable AI/local summaries, themes, and priorities
- Local urgent-language screening and moderator-review routing
- Volunteer ranking by expertise and availability
- User-selected matches
- Request statuses, scheduled check-ins, private notes, and feedback
- Support history and real-time update notifications

### Community and wellbeing

- Authenticated, anonymous posts and reactions
- Comments, reports, moderator removal, locking, and pinning APIs
- Daily mood check-ins and private journals
- Mood history and trend visualization
- Searchable resource library and persistent bookmarks

### Communication and operations

- Participant-restricted peer-support conversations
- Persistent message history and read tracking
- Socket.IO real-time messages and notifications
- Moderator report review and support queue
- Administrator analytics and audit logs
- MongoDB Atlas adapter plus a persistent local JSON fallback
- Serialized writes and repeatable seed data

## Commands

```bash
npm run dev       # API and React app together
npm run server    # API only
npm run build     # Production React build
npm test          # Full API integration and safety tests
```

## Production

The Express server serves the compiled React application when `NODE_ENV=production`, so the project can be deployed as one service:

```bash
npm run build
NODE_ENV=production JWT_SECRET="a-long-random-secret" npm run server
```

A multi-stage `Dockerfile` and `render.yaml` are included. The Render configuration mounts a persistent disk for the JSON store; set `MONGODB_URI` to use MongoDB Atlas instead.

Never commit `.env` or real support data. Before serving real users, complete an organizational privacy review, safeguarding review, local helpline configuration, retention policy, backup policy, monitoring, and penetration test.

## Project structure

```text
src/
  App.jsx             React application and workflows
  AuthContext.jsx     Session lifecycle
  AuthScreen.jsx      Registration and login
  api.js              Authenticated API and realtime client
  styles.css          Responsive visual system
server/
  index.js            Express routes and Socket.IO server
  ai.js               Local/OpenAI analysis and matching
  auth.js             JWT and role middleware
  email.js            SMTP password-reset delivery
  seed.js             Demo data and accounts
  store.js            Persistent JSON repository
  mongo-store.js      MongoDB Atlas repository
  tests/api.test.js   Integration and urgent-language tests
```
