# Quick Setup Guide

## ✅ Step 1: Verify Environment Variables

Your `.env.local` is already configured! Run this to verify:

```bash
npm run check-env
```

You should see:
```
✅ TURSO_DATABASE_URL: OK
✅ TURSO_AUTH_TOKEN: OK
```

## ✅ Step 2: Start Development

### Option A: One Command (Recommended)
```bash
npm run dev:all
```

This starts both the backend and frontend together. You'll see output from both:
- `[API]` - Backend server (port 3000)
- `[UI]` - Frontend dev server (port 5173)

### Option B: Separate Terminals (If you prefer)

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## ✅ Step 3: Open in Browser

Open the URL shown by Vite (usually `http://localhost:5173`)

**Important:** 
- ✅ Use port **5173** (frontend)
- ❌ Don't use port 3000 (that's the backend API)

## ✅ Step 4: Test Login

Try logging in with:
- **Admin PIN:** `6869`
- **User PIN:** `3595`

## 🎉 Success Indicators

- ✅ `[API]` shows: "Database initialized successfully"
- ✅ `[API]` shows: "Server running on http://localhost:3000"
- ✅ `[UI]` shows: "Local: http://localhost:5173/"
- ✅ Frontend loads without errors
- ✅ Login works
- ✅ Data you create appears in both local and production

## 🚨 Troubleshooting

### "Connection Refused" or "Failed to fetch"

**Problem:** Frontend can't reach backend

**Solution:**
1. Make sure backend is running (check for `[API]` output)
2. Restart with `npm run dev:all`
3. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

### "Invalid PIN" or Login Fails

**Problem:** Database not initialized

**Solution:**
1. Check `[API]` terminal output for errors
2. Verify environment variables: `npm run check-env`
3. Restart: `npm run dev:all`

### Port Already in Use

**Problem:** Another process is using port 3000 or 5173

**Solution:**
1. Stop the other process
2. Or kill it: `npx kill-port 3000 5173`
3. Restart: `npm run dev:all`

## How It Works

When you run `npm run dev:all`:

1. **Backend starts** on port 3000
   - Connects to Turso database
   - Initializes tables and default PINs
   - Waits for API requests

2. **Frontend starts** on port 5173
   - Vite dev server starts
   - Proxies `/api/*` requests to backend (port 3000)
   - Opens in your browser

3. **They communicate automatically**
   - Frontend makes requests to `/api/...`
   - Vite proxy forwards to `http://localhost:3000/api/...`
   - Backend responds with data from Turso

## Port Quick Reference

- **Backend:** 3000 (don't visit in browser)
- **Frontend:** 5173 (open this in browser)
- **Vite proxy handles the connection automatically**

---

**Need more help?** Check the full `README.md` for detailed documentation.
