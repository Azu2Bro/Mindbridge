# MentalBridge

MentalBridge is a complete, runnable full-stack peer-support coordination application. It provides private support requests, AI-assisted issue organization, peer-volunteer matching, authenticated messaging, anonymous community discussions, mood tracking, resources, notifications, moderation workflows, and administrative analytics.

MentalBridge coordinates non-clinical peer support. It does not diagnose conditions, provide therapy, prescribe medication, or provide emergency response. For an immediate emergency in Bangladesh, call `999`.

## Quick start

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The member API runs on `http://localhost:3001`, the independent staff-authentication server runs on `http://localhost:3002`, and the local open-source AI runtime runs on `http://localhost:11434`.

Demo accounts all use the password `Demo123!`:

| Role | Email |
|---|---|
| Member | `alex@mentalbridge.demo` |
| Peer volunteer | `maya@mentalbridge.demo` |
| Moderator | `moderator@mentalbridge.demo` |
| Administrator | `admin@mentalbridge.demo` |

### Separate member and staff authentication processes

| Who | Where | Endpoint |
|---|---|---|
| Members and peer volunteers | **Login** / **Sign up** in the landing navbar | `POST /api/auth/login` or `POST /api/auth/google` |
| Moderators and administrators | `/staff` directly | `POST http://localhost:3002/api/auth/staff/login` |

The two portals are enforced by separate Node processes, not just separate pages. The member API never accepts a staff login request; the staff-authentication service only admits moderator and administrator roles. It has its own tighter rate limit and writes every accepted and refused attempt to the shared audit log.
`/admin` and `/moderator` both open the same staff portal.

Email/password registrations must verify their email before their first login. Google verifies the email during Google sign-in. Demo accounts are already verified.

## Showing the project on a phone and on a PC

`npm start` builds the React app and serves it from the API process, so one address covers every
device on the same Wi-Fi:

```bash
npm start
```

The terminal prints both addresses:

```text
MentalBridge web app + API — storage: mongodb
  This computer   http://localhost:3001
  Phone / tablet  http://192.168.0.10:3001   (same Wi-Fi)
```

Open the phone address on the handset. MentalBridge is an installable web app: Chrome on Android
offers **Add to Home screen**, and on iOS use Share → **Add to Home Screen**. Once installed it opens
full screen with its own icon, phones get a bottom tab bar instead of the sidebar, and the app shell
still opens if the network drops mid-demo. The service worker never caches API traffic, so support
requests, messages, and moderation data are always live.

For a demo across different networks, deploy the included `Dockerfile` / `render.yaml` and use the
public https address instead.

## Environment

Copy `.env.example` to `.env` and replace `JWT_SECRET` before any real deployment.

```env
PORT=3001
STAFF_AUTH_PORT=3002
JWT_SECRET=replace-with-at-least-32-random-characters
DATA_FILE=.data/mentalbridge.json
CLIENT_ORIGIN=http://localhost:5173
VITE_STAFF_AUTH_URL=http://127.0.0.1:3002
STAFF_AUTH_URL=http://127.0.0.1:3002
GOOGLE_CLIENT_ID=
MONGODB_URI=
MONGODB_DATABASE=mentalbridge
APP_URL=http://localhost:5173
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=
SMTP_FROM="MentalBridge <verified-sender@example.com>"
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
```

`CLIENT_ORIGIN` only matters while the Vite dev server serves the frontend from a different port.
After `npm start` the API serves the app itself, so there is a single origin and no CORS to configure.

For SendGrid, create an API key with mail-sending permission and set it as
`SMTP_PASSWORD`. Verify the address or domain used by `SMTP_FROM` in SendGrid.
`SMTP_FROM` controls who the message is from; signup and password-reset messages
are addressed to the requesting user's account email. Users verify their own
email links, while only verified moderator and administrator accounts can sign
in through the staff portal.

The default AI provider is the open-source Ollama runtime. For local development, install [Ollama](https://ollama.com/download), pull a model with `ollama pull qwen2.5:1.5b`, and set `AI_PROVIDER=ollama`, `OLLAMA_URL=http://127.0.0.1:11434`, and `OLLAMA_MODEL=qwen2.5:1.5b`.

On Render, the compact open-weight `SmolLM2-135M-Instruct` model and a `llama.cpp` server are packaged inside the MentalBridge Docker image. The model server binds only to the container loopback address, so support text does not leave the MentalBridge service for AI analysis. Do not replace it with a home public IP: residential firewalls, changing addresses, and an offline computer make that connection unreliable. `npm run ai:serve` remains available for running only the local AI service.

For Render, use Groq's hosted open-weight Llama model by setting `AI_PROVIDER=groq`, `GROQ_API_KEY`, and `GROQ_MODEL=llama-3.1-8b-instant`. The model summarizes requests and extracts themes; the local matcher ranks verified, available volunteers using those themes. Urgent-language screening stays local. A failed or timed-out model request uses a clearly labeled basic local analysis and never silently sends the request to a paid provider. `AI_PROVIDER=local` disables model calls; explicitly selecting `gemini` or `openai` enables those optional integrations. Health reports the selected provider, not model readiness. API details: [Ollama chat](https://docs.ollama.com/api/chat) and [Groq API](https://console.groq.com/docs/openai).

The local JSON database works immediately for one process. Because independent services must share account records, configure MongoDB Community Server or Atlas (`MONGODB_URI=mongodb://127.0.0.1:27017`) whenever the staff server is running separately.

In development, one-time verification and password-reset tokens can be completed from the on-screen development controls when SMTP is not configured. Configure the SMTP variables to send real verification and reset links. Gmail users should use an App Password rather than their normal account password.

## Implemented functionality

### Accounts and privacy

- Registration with mandatory expiring email verification and bcrypt password hashing
- Google Identity Services sign-up/sign-in for members and volunteers with server-verified ID tokens; staff authentication remains email/password only
- Separate member/volunteer and moderator/administrator login portals, enforced by two distinct
  server endpoints with their own rate limits and audit logging
- Seven-day signed JWT sessions
- Expiring, hashed password-reset tokens with optional SMTP delivery
- Role-based access for members, volunteers, moderators, and administrators; staff cannot request support or create community posts
- Anonymous community identities separate from account names
- Functional profile, privacy, reminder, and volunteer-availability settings
- Rate-limited authentication and AI endpoints
- Helmet security headers and request-size limits

### Peer-support coordination

- Natural-language support requests
- Reviewable AI/local summaries, themes, and priorities
- Local urgent-language screening and moderator-review routing
- Explainable volunteer ranking by AI-extracted themes, priorities, expertise, lived experience, availability, and active capacity
- User-selected matches
- Request statuses, scheduled check-ins, private notes, and feedback
- Support history and real-time update notifications

### Community and wellbeing

- Authenticated anonymous posts, reactions, persistent saves, editing, and deletion
- Expandable comments, replies, reports, and moderator workflows
- Daily mood check-ins and private journals
- Mood history and trend visualization
- Searchable resource library and persistent bookmarks

### Communication and operations

- Participant-restricted peer-support conversations
- Persistent message history and read tracking
- Socket.IO real-time messages and notifications
- Moderator report review, support assignment, volunteer appointment, post locking/pinning, and resource publishing
- Administrator moderator/volunteer assignment, account controls, post/resource removal, analytics export, and audit logs
- Local or hosted MongoDB adapter plus a persistent JSON fallback
- Serialized writes and repeatable seed data

## Commands

```bash
npm run dev       # Member API, staff-auth process, and React app together
npm run dev:ai    # Start the local open-source AI runtime used during development
npm start         # Build, then serve the web app and API from one address
npm run server    # Serve without rebuilding first
npm run staff:server # Run only the independent staff authentication server
npm run build     # Production React build
npm run icons     # Regenerate the PWA icons from public/icon.svg
npm test          # Full API integration and safety tests
npm run test:ui   # Chrome end-to-end UI and readability smoke test
```

## Production

The member Express server serves the compiled React application from `dist/` whenever a build exists. The staff-authentication server is a separate process, configured through `npm run staff:server`.

A multi-stage `Dockerfile` and `render.yaml` blueprint deploy two Render web services: `mentalbridge` for the member app/API and `mentalbridge-staff-auth` for staff authentication.

Core production variables are configured through the Render service environment:

- `JWT_SECRET` — set the identical secret value on both Render services
- `SMTP_HOST` — email verification is mandatory for new signups, so a real sender is required
- `GOOGLE_CLIENT_ID` — optional OAuth 2.0 Web client ID. Add `https://mentalbridge.onrender.com` as an Authorized JavaScript origin in Google Cloud. The Google button stays hidden until this is configured.

`MONGODB_URI` should point at the same MongoDB Atlas database on both services. Without it the member service falls back to a JSON file, and on a host with no persistent disk that file is wiped on every deploy; the staff service intentionally refuses to start in production without MongoDB. When Atlas is used, allow
`0.0.0.0/0` in its Network Access list, because free hosts do not provide a static outbound IP.

`APP_URL` is the public address used inside verification and reset emails. Render supplies it as a
bare hostname; `server/email.js` normalises a missing scheme to `https://`, so either form works.

Never commit `.env` or real support data. Before serving real users, complete an organizational privacy review, safeguarding review, local helpline configuration, retention policy, backup policy, monitoring, and penetration test.

## Project structure

```text
src/
  App.jsx             React application and workflows
  AuthContext.jsx     Session lifecycle
  LandingPage.jsx     Public landing page and access navigation
  AuthScreen.jsx      Verified registration and member login
  StaffLogin.jsx      Separate moderator and administrator portal at /staff
  api.js              Authenticated API and realtime client
  styles.css          Responsive visual system
server/
  index.js            Express routes and Socket.IO server
  staff-auth-server.js Separate moderator/administrator authentication process
  ai.js               Local/OpenAI analysis and matching
  auth.js             JWT and role middleware
  email.js            SMTP verification and password-reset delivery
  seed.js             Demo data and accounts
  store.js            Persistent JSON repository
  mongo-store.js      Local or hosted MongoDB repository
  tests/api.test.js   Integration and urgent-language tests
public/
  manifest.webmanifest  Installable web app metadata
  sw.js                 Service worker: caches the shell, never the API
  icon.svg              Source artwork for every generated icon size
scripts/
  ui-smoke.mjs        Headless Chrome end-to-end UI verification
  generate-icons.mjs  Renders the PWA PNG icons from icon.svg
```

## Account links and real volunteer setup

Set `APP_URL` to the reachable frontend address, for example `https://your-site.example` in deployment or `http://localhost:5173` for Vite. Production rejects localhost and requires HTTPS; Render's `RENDER_EXTERNAL_URL` is an automatic fallback. In development, an explicitly allowed `CLIENT_ORIGIN` is used in preference to a localhost API address. For phones, configure the reachable LAN frontend address in `APP_URL` and `CLIENT_ORIGIN`; localhost on a phone refers to the phone. Old emails retain their old URLs: request new links after changing configuration.

The operator can provision accounts with `INITIAL_ADMIN_EMAIL` and comma-separated `INITIAL_VOLUNTEER_EMAILS`. Provisioning runs once per email/role at member API startup, preserves existing passwords and verification, and records an audit entry. New accounts have an unknown random password and remain unverified. Their owners use **Forgot your password?** (staff can use **Set up account or reset password** at `/staff`) to receive a one-time setup link. Completing this mailbox-ownership check sets the password and activates a newly provisioned account. No invitations are sent automatically.

Volunteers set their real display name, expertise, bio, and availability in Settings before appearing in matching. Demo volunteers and four varied sample prompts are enabled by default during local development; set `ALLOW_DEMO_MATCHES=false` to test the empty waiting queue. Production always excludes demo addresses. No available volunteer means the request enters the pending queue. Moderators can appoint additional verified accounts in People & roles.

The library includes free publisher-hosted guides from [WHO](https://www.who.int/publications/i/item/9789240003927) and [CCI](https://www.cci.health.wa.gov.au/Resources/Looking-After-Yourself); links open the original workbook/download pages. Existing databases receive these entries once without replacing custom resources.
