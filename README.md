# ExpenseC - Local Development Setup

## Architecture Overview

- **Single Git Repository** ✅
- **Single Turso Database** ✅ (shared between local and production)
- **Two Environments**: Local Dev & Vercel Production
- **No data duplication or syncing**

## Prerequisites

1. Node.js installed
2. Turso account with database created
3. Vercel account (for production deployment)

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
# Turso Database Configuration
# Get these values from your Vercel dashboard or Turso CLI
TURSO_DATABASE_URL=libsql://your-database-name.turso.io
TURSO_AUTH_TOKEN=your-auth-token-here

# Local API URL for frontend development
VITE_API_BASE_URL=http://localhost:3000
```

**⚠️ IMPORTANT**: Never commit `.env.local` to Git. It's already in `.gitignore`.

### 3. Get Your Turso Credentials

**Option A: From Vercel Dashboard**
1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Copy `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`

**Option B: From Turso CLI**
```bash
turso db show your-database-name
```

## Running Locally

### Start Backend Server
```bash
npm run server
```
Backend runs on `http://localhost:3000`

### Start Frontend Dev Server
```bash
npm run dev
```
Frontend runs on `http://localhost:5173` (or similar)

## How It Works

### Local Development Flow
```
Frontend (Vite) → http://localhost:3000/api → Backend (Express) → Turso DB (Cloud)
```

### Production Flow
```
Frontend (Vercel) → /api → Backend (Vercel Serverless) → Turso DB (Cloud)
```

**Same database, same data, different servers.**

## Environment Variables Explained

| Variable | Purpose | Where Used |
|----------|---------|------------|
| `TURSO_DATABASE_URL` | Turso connection string | Backend (local & production) |
| `TURSO_AUTH_TOKEN` | Turso authentication | Backend (local & production) |
| `VITE_API_BASE_URL` | API endpoint for frontend | Frontend (local only) |

## Deployment

### Push to GitHub
```bash
git add .
git commit -m "Your changes"
git push
```

### Vercel Auto-Deploy
Vercel automatically:
1. Detects the push
2. Rebuilds the app
3. Connects to the same Turso DB
4. Deploys to production

**Zero data drift. Zero manual syncing.**

## Safety Best Practices

### ⚠️ You Are Using Production Data Locally

**DO NOT:**
- Run destructive migrations casually
- Execute `DROP TABLE` commands
- Test "delete all" features
- Auto-seed fake data

### ✅ Recommended: Use Separate Databases

Create two Turso databases:
- `expensec-prod` (production)
- `expensec-dev` (development)

Switch between them using `.env.local`:

```env
# Development
TURSO_DATABASE_URL=libsql://expensec-dev.turso.io

# Production (in Vercel)
TURSO_DATABASE_URL=libsql://expensec-prod.turso.io
```

## Troubleshooting

### Backend won't connect to Turso
- ✅ Check credentials are correct
- ✅ Verify `dotenv` is installed
- ✅ Ensure `.env.local` is in project root
- ✅ Restart backend server after changing env vars

### Frontend can't reach backend
- ✅ Check `VITE_API_BASE_URL` in `.env.local`
- ✅ Verify backend is running on port 3000
- ✅ Restart Vite dev server after changing env vars

### "Invalid PIN" on login
- ✅ Database might be empty (first run)
- ✅ Check backend logs for initialization messages
- ✅ Default PINs: Admin `6869`, User `3595`

## Project Structure

```
ExpenseC/
├── api/                    # Backend (Express + Turso)
│   ├── database/
│   │   └── db.js          # Turso client setup
│   ├── routes/            # API endpoints
│   └── index.js           # Express app entry
├── src/                   # Frontend (Vite)
│   ├── components/
│   ├── utils/
│   │   └── api.js         # API client (uses VITE_API_BASE_URL)
│   └── main.js
├── .env.local             # Local environment variables (NOT committed)
├── .gitignore             # Protects secrets
├── package.json
└── vercel.json            # Vercel configuration
```

## Final Checklist

- [ ] Backend runs locally
- [ ] Backend connects to Turso using real credentials
- [ ] Frontend points to local backend
- [ ] Same DB credentials as Vercel
- [ ] `.env.local` is ignored by Git
- [ ] Can login with default PINs
- [ ] Data persists between local and production

---

**You are now set up like a professional development team.** 🚀
