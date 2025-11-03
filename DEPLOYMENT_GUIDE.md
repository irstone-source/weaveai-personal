# WeaveAI Personal - Deployment Guide

## Status: Phase 1 - Infrastructure Setup

### ✅ Completed
- [x] Created GitHub repository: https://github.com/irstone-source/weaveai-personal
- [x] Vercel deployment in progress
- [ ] Neon database setup
- [ ] Pinecone index setup
- [ ] Environment variables configured
- [ ] Database migration run

---

## Step 1: Create Neon Database (5 min)

**Go to:** https://console.neon.tech/app/projects

1. Click "New Project"
2. Name: `weaveai-personal`
3. Region: Choose closest to you (e.g., US East Ohio)
4. Click "Create Project"
5. Copy the connection string:
   ```
   postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
   ```
6. Save this - you'll need it for Vercel environment variables

---

## Step 2: Create Pinecone Index (5 min)

**Go to:** https://app.pinecone.io/

1. Click "Create Index"
2. Name: `weaveai-personal`
3. Dimensions: `1536` (for OpenAI embeddings)
4. Metric: `cosine`
5. Cloud: AWS
6. Region: `us-east-1` (or closest to you)
7. Click "Create Index"
8. Go to "API Keys" section
9. Copy:
   - API Key (starts with `pcsk_`)
   - Environment (e.g., `us-east-1-aws`)

---

## Step 3: Configure Vercel Environment Variables

**Go to:** https://vercel.com/irstone-source/weaveai-personal/settings/environment-variables

Add these variables (one at a time):

### Required Variables

```bash
# Database (from Neon)
DATABASE_URL="postgresql://..."

# AI Provider
ANTHROPIC_API_KEY="sk-ant-..."

# Vector Database (from Pinecone)
PINECONE_API_KEY="pcsk_..."
PINECONE_ENVIRONMENT="us-east-1-aws"
PINECONE_INDEX_NAME="weaveai-personal"

# OAuth (reusing from enterprise)
AUTH_GOOGLE_ID="1093527084995-ne9a84445ofhjqtm4atu9dfk2sun0d06.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="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"

# Auth Secret (generate with: openssl rand -base64 32)
AUTH_SECRET="[GENERATE_NEW_SECRET]"
```

### Optional Variables (can add later)

```bash
# OpenAI (for embeddings alternative)
OPENAI_API_KEY="sk-..."

# AWS S3 (for file storage)
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="weaveai-personal-uploads"
```

---

## Step 4: Generate AUTH_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

Copy the output and add it as `AUTH_SECRET` in Vercel.

---

## Step 5: Redeploy Vercel

After adding all environment variables:

1. Go to Vercel Deployments tab
2. Click the "..." menu on the latest deployment
3. Click "Redeploy"
4. Wait for build to complete

---

## Step 6: Setup Local Environment

```bash
cd /Users/ianstone/weaveai-personal
cp .env.template .env
```

Edit `.env` and fill in the same values as Vercel.

---

## Step 7: Run Database Migration

```bash
cd /Users/ianstone/weaveai-personal
npm install
npm run db:push
```

This creates all necessary tables in your Neon database.

---

## Step 8: Test Local Development

```bash
npm run dev
```

Open: http://localhost:5173

You should see the WeaveAI login page. Log in with your Google account.

---

## Step 9: Verify Vercel Deployment

Once Vercel deployment completes, visit your production URL and test login.

---

## What's Next: Phase 2

Once Phase 1 is complete, we'll:

1. **Remove Enterprise Features** (~15 min)
   - Remove Google Ads integration
   - Remove Meta Ads integration
   - Remove LinkedIn Ads integration
   - Remove Stripe billing code
   - Remove client/project management
   - Clean up database schema

2. **Add Personal Data Sources** (~60 min)
   - Add schema for chat history imports
   - Create ChatGPT parser (JSON)
   - Create Claude parser (JSON/MD/TXT)
   - Create Apple Health parser (XML)
   - Create Oura parser (JSON)
   - Create Apple Mail parser (MBOX)

3. **Update UI** (~45 min)
   - Update navigation
   - Build import dashboard
   - Build conversations browser
   - Build health dashboard

4. **Enhance AI** (~30 min)
   - Update AI chat to query personal knowledge base
   - Add context from chat history, health data, emails

---

## Troubleshooting

### "Module not found" errors
```bash
cd /Users/ianstone/weaveai-personal
rm -rf node_modules package-lock.json
npm install
```

### Database connection fails
- Check `DATABASE_URL` format
- Ensure Neon project is active
- Try connection from Neon dashboard first

### Pinecone errors
- Verify index name matches `.env`
- Check API key is valid
- Ensure dimensions = 1536

---

## Repository Structure

```
weaveai-personal/
├── src/
│   ├── routes/          # SvelteKit pages
│   ├── lib/
│   │   ├── components/  # UI components
│   │   ├── server/      # Backend code
│   │   └── ai/          # AI providers
├── drizzle/             # Database migrations
├── .env.template        # Environment template
├── SETUP.md             # Setup instructions
└── package.json         # Dependencies
```

---

## Resources

- **GitHub Repo:** https://github.com/irstone-source/weaveai-personal
- **Vercel Dashboard:** https://vercel.com/irstone-source/weaveai-personal
- **Neon Console:** https://console.neon.tech/app/projects
- **Pinecone Console:** https://app.pinecone.io/

---

## Questions?

If you encounter any issues or have questions, refer to:
- `/Users/ianstone/weaveai-personal/SETUP.md` - Detailed setup guide
- `/Users/ianstone/weaveai-personal/.env.template` - Environment variable reference
