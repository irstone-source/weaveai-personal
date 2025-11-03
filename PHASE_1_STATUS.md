# WeaveAI Personal - Phase 1 Setup Status

## ✅ COMPLETED

### Repository & Deployment
- [x] Created `/Users/ianstone/weaveai-personal` directory
- [x] Copied codebase from weaveai-enterprise (204MB, 572 files)
- [x] Initialized new git repository
- [x] Created GitHub repository: https://github.com/irstone-source/weaveai-personal
- [x] Pushed to GitHub (after removing secrets from history)
- [x] Connected to Vercel
- [x] Fixed Vercel deployment issues (removed cron jobs for free tier)
- [x] Vercel deployment live: https://weaveai-personal.vercel.app

### Database & Services
- [x] Created Neon PostgreSQL database: `weaveai-personal`
- [x] Connection string obtained and configured
- [x] Created Pinecone index: `weaveai-personal`
  - Dimensions: 1536
  - Metric: cosine
  - Region: us-east-1
- [x] API key obtained and configured

### Configuration
- [x] Created `.env.template` with all required variables
- [x] Created `.env` file with actual credentials
- [x] Generated AUTH_SECRET using openssl
- [x] Created `VERCEL_ENV_VARS.txt` for easy copy-paste
- [x] All 8 environment variables added to Vercel:
  1. DATABASE_URL
  2. ANTHROPIC_API_KEY
  3. PINECONE_API_KEY
  4. PINECONE_ENVIRONMENT
  5. PINECONE_INDEX_NAME
  6. AUTH_GOOGLE_ID
  7. AUTH_GOOGLE_SECRET
  8. AUTH_SECRET

### Dependencies
- [x] Ran `npm install` successfully (589 packages)

## ⏳ IN PROGRESS

### Database Migration
- [ ] Run `npm run db:push` and confirm migration

**Status:** The migration SQL is ready and showing the prompt, but automated confirmation is encountering issues with the interactive prompt.

**To Complete:**
```bash
cd /Users/ianstone/weaveai-personal
DATABASE_URL="postgresql://neondb_owner:npg_Q4N8MPjnBeRS@ep-shiny-hat-adjdet0p-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require" npm run db:push
```

When prompted with:
```
Warning  You are about to execute current statements:
...
[?] No, abort
    Yes, I want to execute all statements
```

Press the **down arrow** key once, then press **Enter** to select "Yes, I want to execute all statements".

This will create all 40+ database tables including:
- Core tables: user, account, session, authenticator
- Chat tables: chat, memory, focus_session
- Enterprise tables: project, client_profiles, meetings, linear_integration
- Media tables: image, video
- Admin tables: admin_settings, admin_files
- Subscription tables: pricing_plan, subscription, payment_history

## 📋 NEXT STEPS (After Migration Completes)

### 1. Test Local Development (2 min)
```bash
cd /Users/ianstone/weaveai-personal
npm run dev
```

Open http://localhost:5173 and verify:
- Login page loads
- Google OAuth login works
- Dashboard appears after login

### 2. Verify Vercel Deployment (1 min)
Visit https://weaveai-personal.vercel.app and test:
- Production site loads
- Login works with Google OAuth
- Environment variables are working

### 3. Confirm Phase 1 Complete
Once local and production are both working, reply with **"PHASE 1 COMPLETE"** to proceed to Phase 2.

---

## 📁 Files Created

- `/Users/ianstone/weaveai-personal/.env` - Local environment configuration
- `/Users/ianstone/weaveai-personal/.env.template` - Template for environment variables
- `/Users/ianstone/weaveai-personal/VERCEL_ENV_VARS.txt` - Copy-paste reference for Vercel
- `/Users/ianstone/weaveai-personal/SETUP.md` - Detailed setup instructions
- `/Users/ianstone/weaveai-personal/DEPLOYMENT_GUIDE.md` - Deployment checklist
- `/Users/ianstone/weaveai-personal/package.json` - Updated with "weaveai-personal" name
- `/Users/ianstone/weaveai-personal/vercel.json` - Cleaned (removed cron jobs)

---

## 🔗 Important Links

- **GitHub:** https://github.com/irstone-source/weaveai-personal
- **Vercel:** https://vercel.com/irstone-source/weaveai-personal
- **Production URL:** https://weaveai-personal.vercel.app
- **Neon Dashboard:** https://console.neon.tech/app/projects
- **Pinecone Dashboard:** https://app.pinecone.io/

---

## 📊 Infrastructure Summary

```
┌─────────────────────────────────────────┐
│  WeaveAI Personal                        │
│  Repository: github.com/irstone-source/  │
│             weaveai-personal             │
├─────────────────────────────────────────┤
│  Database: Neon PostgreSQL              │
│  - Host: ep-shiny-hat-adjdet0p-pooler   │
│  - Region: us-east-1                    │
│  - Database: neondb                     │
├─────────────────────────────────────────┤
│  Vector DB: Pinecone                    │
│  - Index: weaveai-personal              │
│  - Dimensions: 1536                     │
│  - Region: us-east-1                    │
├─────────────────────────────────────────┤
│  Auth: Google OAuth (reused)            │
│  - Client ID: 1093527084995-...         │
│  - Secret: GOCSPX-...                   │
├─────────────────────────────────────────┤
│  Deploy: Vercel                         │
│  - Project: weaveai-personal            │
│  - URL: weaveai-personal.vercel.app     │
└─────────────────────────────────────────┘
```

**Completely Isolated From:**
- ❌ weaveai-enterprise database
- ❌ weaveai-enterprise Pinecone index
- ❌ weaveai-enterprise Vercel deployments

---

## 💡 Troubleshooting

### If migration fails:
1. Check DATABASE_URL is correct in .env
2. Verify Neon database is active
3. Try connecting from Neon dashboard first

### If npm run dev fails:
```bash
rm -rf node_modules package-lock.json
npm install
```

### If Vercel build fails:
1. Check environment variables in Vercel dashboard
2. Verify all 8 variables are set for Production, Preview, and Development
3. Trigger manual redeploy
