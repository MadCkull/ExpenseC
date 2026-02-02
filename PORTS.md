# Port Reference Guide

## Understanding the Ports

### Backend (API Server)
- **Port:** `3000`
- **URL:** `http://localhost:3000`
- **Start:** `npm run server`
- **What it does:** Handles all API requests and connects to Turso database

### Frontend (Vite Dev Server)
- **Port:** `5173` (default, may vary)
- **URL:** `http://localhost:5173`
- **Start:** `npm run dev`
- **What it does:** Serves your UI and proxies API calls to backend

### Preview Build (Optional)
- **Port:** `4173`
- **URL:** `http://localhost:4173`
- **Start:** `npm run preview`
- **What it does:** Tests production build locally (rarely needed)

## How They Work Together

```
┌─────────────────────────────────────────────┐
│  Browser: http://localhost:5173             │
│  (Your UI)                                  │
└─────────────────┬───────────────────────────┘
                  │
                  │ API calls to /api/*
                  ↓
┌─────────────────────────────────────────────┐
│  Backend: http://localhost:3000             │
│  (Express Server)                           │
└─────────────────┬───────────────────────────┘
                  │
                  │ Database queries
                  ↓
┌─────────────────────────────────────────────┐
│  Turso Database (Cloud)                     │
│  libsql://expensec-madckull.turso.io        │
└─────────────────────────────────────────────┘
```

## Current Configuration

Your `.env.local` is set to:
```env
VITE_API_BASE_URL=http://localhost:3000
```

This tells the frontend (running on 5173) to send API requests to the backend (running on 3000).

## Common Issues

### "Connection Refused" Error
- ✅ Make sure backend is running: `npm run server`
- ✅ Backend should show: "Server running on http://localhost:3000"
- ✅ Check `.env.local` has: `VITE_API_BASE_URL=http://localhost:3000`

### "No route found" Error
- ✅ Restart Vite dev server after changing `.env.local`
- ✅ Hard refresh browser (Ctrl+Shift+R)

### Wrong Port in Browser
- ✅ Use the URL shown by Vite (usually 5173)
- ✅ Don't use 3000 in browser (that's the backend)
- ✅ Don't use 4173 unless running preview build

## Quick Start Checklist

1. ✅ Environment variables configured (`npm run check-env`)
2. ✅ Start backend: `npm run server` → Shows port 3000
3. ✅ Start frontend: `npm run dev` → Shows port 5173
4. ✅ Open browser to port shown by Vite (5173)
5. ✅ Login should work!

## Still Confused?

**Just remember:**
- Backend = 3000 (you don't visit this in browser)
- Frontend = 5173 (this is what you open in browser)
- They talk to each other automatically via the env var
