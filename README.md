# Real-Time Poll Rooms

A production-ready web app for creating and voting in polls with real-time result updates.

## Features

- **Poll creation**: Question + minimum 2 options, UUID poll IDs, shareable link `/poll/{id}`
- **Voting**: Single-choice, single vote per user
- **Real-time results**: WebSockets (Socket.IO) push updates to all clients in the poll room
- **Persistence**: PostgreSQL via Prisma (polls and votes)
- **Anti-abuse**: (1) IP-based restriction (hashed IP stored, one vote per IP per poll), (2) Browser fingerprint via localStorage voter token (stored in DB, server-side validation)
- **Optional**: Poll expiration, rate limiting, minimal analytics (total votes)

## Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, React Hooks, Axios
- **Backend**: Next.js API routes + custom Node server for Socket.IO
- **Database**: PostgreSQL (Prisma ORM, UUIDs for poll IDs)
- **Deployment**: Single app deployable to Render (or Vercel for frontend + Render for backend with Socket.IO)

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (local, Supabase, or Neon)

### 1. Clone and install

```bash
cd "Real-Time Poll Rooms"
npm install
```

### 2. Environment variables

Create `.env` in the project root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
IP_HASH_SALT="your-random-salt"
```

- `DATABASE_URL`: PostgreSQL connection string (Supabase/Neon provide this).
- `NEXT_PUBLIC_APP_URL`: Public URL of the app (for share links).
- `IP_HASH_SALT`: Optional; salt for hashing IPs.

### 3. Database

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run

```bash
npm run dev
```

App: `http://localhost:3000`. Create a poll on `/`, share the link, open in another tab/device to see real-time votes.

## How real-time works

1. The app runs a **custom Node server** (`server.js`) that serves Next.js and attaches Socket.IO to the same HTTP server.
2. Clients connect to Socket.IO at path `/api/socketio` and emit `join` with `pollId` to enter room `poll:{pollId}`.
3. When a user votes, the **vote API** updates the DB and then calls `globalThis.io.to('poll:' + pollId).emit('results', { results, totalVotes })`.
4. All clients in that room receive `results` and update the UI (live bar chart and total votes) without refresh.
5. On disconnect/reconnect, the client re-joins the room; results are also refetched from the API on load so refresh never loses data.

## Anti-abuse mechanisms

1. **IP-based**: Server hashes the client IP (with optional salt), stores it in `Vote.hashedIP`. Unique constraint on `(pollId, hashedIP)` prevents the same IP from voting twice on the same poll.
2. **Voter token (localStorage)**: Client generates a persistent `voterToken` (stored in localStorage) and sends it with every vote. Server stores it in `Vote.voterToken`. Unique constraint on `(pollId, voterToken)` prevents duplicate votes from the same browser/device. Both checks are enforced server-side.

## Edge cases handled

- Poll with &lt; 2 options: creation blocked with validation.
- Voting on non-existent poll: 404.
- Double-click vote: button disabled after first submit; server returns 409 if duplicate.
- Race condition: vote uses a DB transaction and unique constraints; duplicate attempts get 409.
- Socket disconnect/reconnect: client re-joins room by `pollId`; UI can show “Live” indicator.
- Refresh after voting: results loaded from DB on page load; “You already voted” derived from 409 or from UI state after successful vote.
- Invalid poll ID: 404 and message on voting page.
- Expired poll: 410 on GET/vote when `expiresAt` is in the past.
- Rate limiting: 429 when exceeding limit (create and vote endpoints).

## Known limitations

- Real-time requires the **custom server** (Socket.IO). Standard `next start` (or Vercel serverless) does not run Socket.IO; for Vercel you’d deploy only the frontend and run a separate Socket.IO backend (e.g. on Render).
- Rate limiting is in-memory; for multi-instance deployments use Redis or similar.
- IP can be spoofed (e.g. via proxies); hashing only prevents plain storage of IPs.

## Deployment

### Deploy to Render (recommended)

**Option 1: Blueprint (Web Service + PostgreSQL)**

1. Push this repo to GitHub/GitLab.
2. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect the repo; Render will read `render.yaml` and create:
   - A **Web Service** (this app)
   - A **PostgreSQL** database (`poll-rooms-db`)
4. After the first deploy, in the Web Service → **Environment** set:
   - `NEXT_PUBLIC_APP_URL` = your service URL (e.g. `https://real-time-poll-rooms.onrender.com`).
5. Redeploy once so the app picks up `NEXT_PUBLIC_APP_URL` (share links will then be correct).

**Option 2: Web Service only (use your own database)**

1. **New** → **Web Service**; connect the repo.
2. **Build command:** `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
3. **Start command:** `npm start`
4. **Environment:**
   - `DATABASE_URL` = your PostgreSQL URL (Supabase, Neon, or Render Postgres).
   - `NEXT_PUBLIC_APP_URL` = `https://<your-service-name>.onrender.com`
   - Optional: `IP_HASH_SALT` (any random string).
5. If the database is empty, run migrations once (e.g. locally with that `DATABASE_URL`, or add `npx prisma migrate deploy` to the build command).

**Note:** On Render free tier the service may spin down after inactivity; WebSocket clients will reconnect when it wakes up.

### Option B: Frontend on Vercel, backend + Socket.IO on Render

1. **Vercel**: Deploy Next.js with `next build` and `next start` (no custom server). Set `NEXT_PUBLIC_APP_URL` to Vercel URL. API routes will run on Vercel but **Socket.IO will not** (no persistent WebSocket on serverless).
2. **Render**: Run a separate Node server that only runs Socket.IO and an HTTP endpoint that receives “broadcast” requests from Vercel API (e.g. after a vote). Set `BROADCAST_URL` and `BROADCAST_SECRET` on Vercel so the vote API can call Render to emit to rooms.
3. **Database**: Same as above; both Vercel and Render can use the same `DATABASE_URL` (e.g. Neon/Supabase).

### Environment variables summary

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | Yes (for share links) | Public app URL |
| `IP_HASH_SALT` | No | Salt for IP hashing |
| `BROADCAST_URL` | If split deploy | URL of Socket.IO broadcast endpoint |
| `BROADCAST_SECRET` | If split deploy | Secret for broadcast API auth |

## Docker (bonus)

```bash
docker build -t poll-rooms .
docker run -p 3000:3000 --env-file .env poll-rooms
```

See `Dockerfile` in the repo.
