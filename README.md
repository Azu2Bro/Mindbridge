# MentalBridge

MentalBridge is a complete, runnable full-stack peer-support coordination application. It provides private support requests, AI-assisted issue organization, peer-volunteer matching, authenticated messaging, anonymous community discussions, mood tracking, resources, notifications, moderation workflows, and administrative analytics.

MentalBridge coordinates non-clinical peer support. It does not diagnose conditions, provide therapy, prescribe medication, or provide emergency response. For an immediate emergency in Bangladesh, call `999`.

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

### Two separate sign-in entrances

| Who | Where | Endpoint |
|---|---|---|
| Members and peer volunteers | **Login** / **Sign up** in the landing navbar | `POST /api/auth/login` |
| Moderators and administrators | **Staff portal** in the navbar, or `/staff` directly | `POST /api/auth/staff/login` |

The two portals are enforced on the server, not just in the interface. A staff account sent to
`/api/auth/login` is refused and pointed at `/staff`; a member or volunteer account sent to
`/api/auth/staff/login` is refused as well. The staff endpoint additionally carries a much tighter
rate limit than the member endpoint and writes every accepted and refused attempt to the audit log.
`/admin` and `/moderator` both open the same staff portal.

New registrations must verify their email before their first login. Demo accounts are already verified.

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
JWT_SECRET=replace-with-at-least-32-random-characters
DATA_FILE=.data/mentalbridge.json
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=
MONGODB_DATABASE=mentalbridge
APP_URL=http://localhost:3001
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
```

`CLIENT_ORIGIN` only matters while the Vite dev server serves the frontend from a different port.
After `npm start` the API serves the app itself, so there is a single origin and no CORS to configure.

The application works without an OpenAI key using its deterministic local support-theme analyzer. When `OPENAI_API_KEY` is configured, the server uses the OpenAI Responses API with strict structured output and `store: false`. Urgent-language detection runs locally before any optional model request.

The local JSON database works immediately. To use MongoDB Community Server and Compass locally, set `MONGODB_URI=mongodb://127.0.0.1:27017`. You can later replace it with an Atlas connection string without changing the API or client.

In development, one-time verification and password-reset tokens can be completed from the on-screen development controls when SMTP is not configured. Configure the SMTP variables to send real verification and reset links. Gmail users should use an App Password rather than their normal account password.

## Implemented functionality

### Accounts and privacy

- Registration with mandatory expiring email verification and bcrypt password hashing
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
- Volunteer ranking by expertise and availability
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
npm run dev       # API and React app together, with hot reload
npm start         # Build, then serve the web app and API from one address
npm run server    # Serve without rebuilding first
npm run build     # Production React build
npm run icons     # Regenerate the PWA icons from public/icon.svg
npm test          # Full API integration and safety tests
npm run test:ui   # Chrome end-to-end UI and readability smoke test
```

## Production

The Express server serves the compiled React application from `dist/` whenever a build exists, so the
project deploys as a single service. `npm start` does the build and the serve in one step.

A multi-stage `Dockerfile` and a `render.yaml` blueprint are included, deploying one service that
serves both the API and the built React app.

Two variables are mandatory when `NODE_ENV=production`, or the server throws on startup:

- `JWT_SECRET` — generated automatically by the Render blueprint
- `SMTP_HOST` — email verification is mandatory for new signups, so a real sender is required

`MONGODB_URI` should point at MongoDB Atlas. Without it the server falls back to a JSON file, and on
a host with no persistent disk that file is wiped on every deploy. When Atlas is used, allow
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
