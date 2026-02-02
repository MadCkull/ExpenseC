# Why You Need Both Frontend and Backend

## The Short Answer

Your app has **two parts** that work together:

1. **Frontend (UI)** - What you see in the browser
2. **Backend (API)** - Handles data and talks to the database

Previously, you were running BOTH but didn't realize it because the backend was running in a separate terminal that you might have forgotten about.

## What Changed?

### Before (What You Were Doing)
You had the backend running separately (maybe in another terminal or as a background process), and you only ran `npm run dev` for the frontend.

### Now (Clearer Setup)
We made it explicit that you need both, and gave you **one command** to run them together:

```bash
npm run dev:all
```

## How It Works

```
┌─────────────────────────────────────────────┐
│  npm run dev:all                            │
│  (One command)                              │
└─────────────┬───────────────────────────────┘
              │
              ├─────────────────┐
              │                 │
              ↓                 ↓
    ┌─────────────────┐  ┌─────────────────┐
    │  Backend (API)  │  │  Frontend (UI)  │
    │  Port 3000      │  │  Port 5173      │
    │                 │  │                 │
    │  Connects to    │  │  Shows the UI   │
    │  Turso DB       │  │  in browser     │
    └─────────────────┘  └─────────────────┘
              │                 │
              └────────┬────────┘
                       │
                       ↓
              They talk to each other
              via Vite's proxy
```

## Why Two Servers?

### Frontend (Vite Dev Server - Port 5173)
- Serves your HTML, CSS, JavaScript
- Hot-reloads when you change code
- Runs in the browser

### Backend (Express Server - Port 3000)
- Handles login, user management, expenses
- Talks to Turso database
- Runs on your computer (or Vercel in production)

**They're separate because:**
- Frontend = Client-side (runs in browser)
- Backend = Server-side (runs on server, handles sensitive data)

## The Easy Way

Just remember this **one command**:

```bash
npm run dev:all
```

It starts both servers for you automatically. You'll see output from both:
- `[API]` = Backend messages
- `[UI]` = Frontend messages

Then open `http://localhost:5173` in your browser.

## Production (Vercel)

On Vercel, it's even simpler:
- Frontend and backend are deployed together
- Vercel handles running both automatically
- You just visit your URL and it works

That's why you only push to Git and Vercel does the rest!
