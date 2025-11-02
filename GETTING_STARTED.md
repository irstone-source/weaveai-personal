# 🚀 Getting Started with WeaveAI Enterprise

**Welcome!** This guide will get you from zero to a running AI SaaS platform in **30 minutes**.

---

## 📋 Prerequisites

Before starting, ensure you have:

- ✅ **Node.js 20+** installed ([Download](https://nodejs.org/))
- ✅ **Git** installed ([Download](https://git-scm.com/downloads))
- ✅ **Code editor** (VS Code recommended)
- ✅ **Neon account** (free) for database ([Sign up](https://neon.tech))
- ✅ **At least one AI provider API key** (see below)

---

## 🎯 Two Paths to Choose From

### Path 1: **Deploy to Production** (30 minutes)
Get a live SaaS platform accepting payments → [**Follow IMPLEMENTATION_GUIDE.md**](./IMPLEMENTATION_GUIDE.md#30-minute-deployment)

### Path 2: **Local Development** (15 minutes)
Set up for customization and development → **Continue reading below**

---

## 💻 Local Development Setup

### Step 1: Get Your Database (5 minutes)

1. Go to [neon.tech](https://neon.tech) and sign up (free)
2. Click "Create Project"
3. Name it "weaveai-dev"
4. Copy the connection string (looks like `postgresql://user:password@host/database`)
5. Keep this handy - you'll need it in Step 3

**Alternative**: Use local PostgreSQL if you prefer.

### Step 2: Get AI Provider API Keys (5 minutes)

**Option A: OpenRouter (Recommended)**
- Go to [openrouter.ai](https://openrouter.ai/keys)
- Sign up (free)
- Create API key
- Gives you access to 32+ models (Claude, GPT, Gemini, Llama, etc.)

**Option B: Individual Providers**
- **Google Gemini**: [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey) (free tier)
- **OpenAI**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys) ($5 minimum)

### Step 3: Configure Environment (2 minutes)

```bash
# Navigate to project
cd ~/weaveai-enterprise

# Copy environment template
cp .env.local .env.local.backup
```

Edit `.env.local` and set these **3 required values**:

```bash
# 1. Your database URL from Step 1
DATABASE_URL=postgresql://YOUR_NEON_CONNECTION_STRING

# 2. Generate auth secret (run this command):
# npx auth secret
AUTH_SECRET=YOUR_GENERATED_SECRET_HERE

# 3. Your AI provider API key from Step 2
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
```

**That's it!** Everything else is optional.

### Step 4: Install & Initialize (3 minutes)

```bash
# Install dependencies
npm install --legacy-peer-deps

# Compile i18n messages
npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/paraglide

# Initialize database (creates all tables)
npm run db:push
```

### Step 5: Start Development Server

```bash
npm run dev
```

🎉 **Done!** Open [http://localhost:5173](http://localhost:5173)

---

## 🔐 Create Your Admin Account

1. **Register** a new account at `http://localhost:5173/register`
2. **Make yourself admin**:
   - Go to [Neon SQL Editor](https://console.neon.tech)
   - Run this query:
   ```sql
   UPDATE "user"
   SET "isAdmin" = true
   WHERE email = 'your-email@example.com';
   ```
3. **Refresh** the page - you now have admin access!
4. **Visit** `/admin` to configure everything

---

## 🎨 What to Do Next

### Immediate Next Steps

1. **Configure AI Providers** → `/admin/settings/ai-models`
   - Add all your API keys
   - Enable/disable specific models
   - Test each provider

2. **Set Up Branding** → `/admin/settings/branding`
   - Upload your logo
   - Customize colors
   - Set site name

3. **Configure Pricing** → `/admin/settings/plans`
   - Review default pricing tiers
   - Adjust limits and prices
   - Create custom plans

4. **Test Features**
   - Create a chat → `/`
   - Generate an image → `/`
   - Upload files → `/`
   - View media library → `/library`

### Customize Your Platform

1. **Read Architecture** → [`ARCHITECTURE.md`](./ARCHITECTURE.md)
   - Understand the codebase structure
   - Learn design patterns used
   - See scalability approach

2. **Read Business Strategy** → [`BUSINESS_STRATEGY.md`](./BUSINESS_STRATEGY.md)
   - Market positioning
   - Pricing strategy
   - Growth roadmap

3. **Start Building**
   - Follow patterns in existing code
   - Use [`CONTRIBUTING.md`](./CONTRIBUTING.md) for guidelines
   - Run `npm test` to ensure quality

---

## 📁 Project Structure Overview

```
weaveai-enterprise/
├── docs/                    # Additional documentation
├── src/
│   ├── lib/
│   │   ├── ai/             # AI provider integrations
│   │   ├── server/         # Backend services
│   │   │   ├── db/         # Database & repositories
│   │   │   ├── services/   # Business logic
│   │   │   └── security/   # Security services
│   │   └── components/     # UI components
│   └── routes/             # SvelteKit routes
│       ├── (app)/          # Application pages
│       ├── (admin)/        # Admin dashboard
│       ├── (auth)/         # Authentication
│       └── api/            # API endpoints
├── static/                 # Static assets
└── tests/                  # Test suites
```

---

## 🛠️ Common Development Tasks

### Run Type Checking
```bash
npm run check
```

### Format Code
```bash
npm run format
```

### Run Tests (when implemented)
```bash
npm test
```

### View Database
```bash
npm run db:studio
# Opens Drizzle Studio at http://localhost:4983
```

### Build for Production
```bash
npm run build
npm run preview
```

---

## 🐛 Troubleshooting

### "Cannot connect to database"
- ✅ Check DATABASE_URL is correct
- ✅ Verify database exists in Neon dashboard
- ✅ Test connection: `psql $DATABASE_URL -c "SELECT 1"`

### "AUTH_SECRET not set"
- ✅ Generate: `npx auth secret`
- ✅ Add to `.env.local`
- ✅ Must be 32+ characters

### "Module not found: paraglide"
- ✅ Run: `npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/paraglide`

### "AI provider returns error"
- ✅ Verify API key is correct
- ✅ Check you have credits/quota remaining
- ✅ Test API key with curl:
  ```bash
  curl https://openrouter.ai/api/v1/models \
    -H "Authorization: Bearer $OPENROUTER_API_KEY"
  ```

### Port 5173 already in use
- ✅ Kill existing process: `lsof -ti:5173 | xargs kill -9`
- ✅ Or use different port: `npm run dev -- --port 3000`

---

## 📚 Documentation Reference

- **[BUSINESS_STRATEGY.md](./BUSINESS_STRATEGY.md)** - Market analysis, revenue model, roadmap
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical architecture & design patterns
- **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Deployment & production guide
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Development guidelines & standards
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Complete project overview
- **[README_ENTERPRISE.md](./README_ENTERPRISE.md)** - Project README

---

## 🚀 Ready to Deploy?

Once you're happy with local development:

1. **Read** [`IMPLEMENTATION_GUIDE.md`](./IMPLEMENTATION_GUIDE.md)
2. **Deploy** to Vercel (30 minutes)
3. **Configure** via admin dashboard
4. **Launch** and grow! 🎉

---

## 💬 Need Help?

- **Issues**: [GitHub Issues](#)
- **Questions**: [GitHub Discussions](#)
- **Email**: support@weaveai.com

---

## ✅ Development Checklist

Use this checklist to track your setup:

### Initial Setup
- [ ] Node.js 20+ installed
- [ ] Git installed
- [ ] Project cloned/downloaded
- [ ] Dependencies installed (`npm install --legacy-peer-deps`)
- [ ] Paraglide compiled

### Configuration
- [ ] Neon database created
- [ ] DATABASE_URL set in `.env.local`
- [ ] AUTH_SECRET generated and set
- [ ] At least one AI provider API key added
- [ ] Database initialized (`npm run db:push`)

### First Run
- [ ] Dev server starts (`npm run dev`)
- [ ] Site loads at `http://localhost:5173`
- [ ] Can register new account
- [ ] Made first user admin
- [ ] Admin dashboard accessible

### Customization
- [ ] Read `ARCHITECTURE.md`
- [ ] Read `BUSINESS_STRATEGY.md`
- [ ] Configured AI providers in admin
- [ ] Customized branding
- [ ] Reviewed pricing plans
- [ ] Tested all major features

### Ready for Production
- [ ] Read `IMPLEMENTATION_GUIDE.md`
- [ ] Deployment platform chosen (Vercel, etc.)
- [ ] Production environment variables prepared
- [ ] Monitoring set up (Sentry, PostHog)
- [ ] Stripe configured for payments
- [ ] Email provider configured

---

**Welcome to WeaveAI Enterprise!** You're building something amazing. 🚀

**Next**: Open [`BUSINESS_STRATEGY.md`](./BUSINESS_STRATEGY.md) to understand the market opportunity and revenue potential.
