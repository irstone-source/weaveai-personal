# WeaveAI Personal - Setup Guide

Welcome to your personal knowledge management system! This guide will help you get everything set up.

## ✅ Phase 1 Complete

The following has already been done:
- ✅ Created `/Users/ianstone/weaveai-personal` directory
- ✅ Copied codebase from weaveai-enterprise
- ✅ Initialized git repository
- ✅ Updated `package.json` to "weaveai-personal"

## 🔧 What You Need To Do Now

### 1. Create New Neon Database (5 min)

**Go to:** https://console.neon.tech/app/projects

**Steps:**
1. Click "New Project"
2. Name: `weaveai-personal`
3. Region: Choose closest to you (e.g., `US East (Ohio)`)
4. Click "Create Project"
5. Copy the connection string (it will look like):
   ```
   postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
   ```
6. Save this for the `.env` file

### 2. Create New Pinecone Index (5 min)

**Go to:** https://app.pinecone.io/

**Steps:**
1. Click "Create Index"
2. Name: `weaveai-personal`
3. Dimensions: `1536` (for OpenAI embeddings)
4. Metric: `cosine`
5. Cloud: `AWS` (or your preference)
6. Region: `us-east-1` (or closest to you)
7. Click "Create Index"
8. Go to "API Keys" section
9. Copy your API Key and Environment
10. Save these for the `.env` file

### 3. Create .env File (2 min)

```bash
cd /Users/ianstone/weaveai-personal
cp .env.template .env
```

Then edit `.env` with your favorite editor and fill in:

**REQUIRED:**
```bash
# Neon Database (from step 1)
DATABASE_URL="postgresql://..."

# Anthropic Claude
ANTHROPIC_API_KEY="sk-ant-api03-..."  # Get from https://console.anthropic.com

# Pinecone (from step 2)
PINECONE_API_KEY="pcsk_..."
PINECONE_ENVIRONMENT="us-east-1-aws"
PINECONE_INDEX_NAME="weaveai-personal"

# OAuth (reuse from weaveai-enterprise)
AUTH_GOOGLE_ID="1093527084995-ne9a84445ofhjqtm4atu9dfk2sun0d06.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="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"

# Auth Secret (generate new one)
AUTH_SECRET="<run: openssl rand -base64 32>"
```

**OPTIONAL (can add later):**
```bash
# OpenAI (for embeddings alternative)
OPENAI_API_KEY="sk-..."

# AWS S3 (for file storage)
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="weaveai-personal-uploads"
```

### 4. Install Dependencies (3 min)

```bash
cd /Users/ianstone/weaveai-personal
npm install
```

### 5. Initialize Database Schema (2 min)

```bash
npm run db:push
```

This will create all the necessary tables in your new Neon database.

### 6. Test Local Development (1 min)

```bash
npm run dev
```

Open: http://localhost:5173

You should see the WeaveAI login page. Log in with your Google account.

---

## 🎯 What You'll Have After Setup

### Current Features (from weaveai-enterprise)
- ✅ AI chat interface (Claude & GPT-4)
- ✅ Document uploads and vector search
- ✅ OAuth authentication
- ✅ Modern SvelteKit UI

### Features We'll Add Next
- 📥 ChatGPT conversation history import
- 📥 Claude conversation history import
- 📊 Apple Health data visualization
- 💍 Oura ring data integration
- 📧 Apple Mail email search
- 🧠 AI queries across all your personal data

---

## 📊 Infrastructure Summary

**Your New Stack:**
```
┌─────────────────────────────────────────┐
│  WeaveAI Personal                        │
│  Location: /Users/ianstone/             │
│            weaveai-personal/             │
├─────────────────────────────────────────┤
│  Database: Neon PostgreSQL (NEW)        │
│  Vectors: Pinecone (NEW INDEX)          │
│  AI: Anthropic Claude + OpenAI          │
│  Auth: Google OAuth (REUSED)            │
│  Deploy: Vercel (LATER)                 │
└─────────────────────────────────────────┘
```

**Completely Separate From:**
- ❌ weaveai-enterprise database
- ❌ weaveai-enterprise Pinecone index
- ❌ weaveai-enterprise deployments

---

## 🚀 Next Steps (After Setup Complete)

Once you have completed steps 1-6 above and confirmed the app runs locally, I will:

1. **Phase 2:** Remove enterprise features (Google Ads, clients, projects)
2. **Phase 3:** Add personal data schema and parsers
3. **Phase 4:** Build import UI for chat history, health data, emails
4. **Phase 5:** Enhance AI to query your personal knowledge base
5. **Phase 6:** Deploy to Vercel with new GitHub repo

---

## ❓ Need Help?

**Common Issues:**

**"Module not found" errors:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Database connection fails:**
- Check `DATABASE_URL` format
- Ensure Neon project is active
- Try connection from Neon dashboard first

**Pinecone errors:**
- Verify index name matches `.env`
- Check API key is valid
- Ensure dimensions = 1536

---

## 📝 Checklist

Before continuing, make sure you have:

- [ ] Created new Neon database
- [ ] Copied DATABASE_URL to `.env`
- [ ] Created new Pinecone index named `weaveai-personal`
- [ ] Copied Pinecone API key and environment to `.env`
- [ ] Copied OAuth credentials to `.env`
- [ ] Generated new AUTH_SECRET and added to `.env`
- [ ] Run `npm install` successfully
- [ ] Run `npm run db:push` successfully
- [ ] Run `npm run dev` and see login page
- [ ] Logged in successfully with Google OAuth

**Once all checkboxes are ✅, reply with "PHASE 1 COMPLETE" and I'll continue!**
