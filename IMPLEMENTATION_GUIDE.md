# WeaveAI Enterprise - Implementation Guide

## Quick Start (Production Deployment)

### Prerequisites Checklist
- [ ] GitHub account (for repository)
- [ ] Vercel account (for hosting) - https://vercel.com
- [ ] Neon account (for database) - https://neon.tech
- [ ] Stripe account (for payments) - https://stripe.com
- [ ] At least one AI provider API key (OpenRouter recommended)
- [ ] Domain name (optional, Vercel provides free subdomain)

### 30-Minute Deployment

#### Step 1: Set Up Database (5 minutes)
1. Go to https://neon.tech and sign up
2. Create a new project called "weaveai-production"
3. Copy the connection string (looks like: `postgresql://user:pass@host/db`)
4. Save it securely - you'll need it shortly

#### Step 2: Get API Keys (10 minutes)

**Required (choose at least one)**:
```bash
OpenRouter: https://openrouter.ai/keys
  - Sign up → API Keys → Create New Key
  - Free tier available, pay-as-you-go
  - Access to 32+ models
```

**Optional (add more capabilities)**:
```bash
Google Gemini: https://makersuite.google.com/app/apikey
  - For image/video generation

OpenAI: https://platform.openai.com/api-keys
  - For DALL-E, GPT-Image

Stripe: https://dashboard.stripe.com/test/apikeys
  - For payment processing
  - Get both publishable and secret keys
```

#### Step 3: Deploy to Vercel (10 minutes)

1. **Push code to GitHub**:
```bash
cd weaveai-enterprise
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/weaveai-enterprise.git
git push -u origin main
```

2. **Import to Vercel**:
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect SvelteKit

3. **Configure Environment Variables**:
   Click "Environment Variables" and add:
```env
# Required
DATABASE_URL=your_neon_connection_string
AUTH_SECRET=run_npx_auth_secret_to_generate
PUBLIC_ORIGIN=https://your-app.vercel.app
NODE_ENV=production

# AI Provider (at least one)
OPENROUTER_API_KEY=your_openrouter_key

# Optional
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key

# Stripe (for billing)
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

4. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes for build

#### Step 4: Initialize Database (5 minutes)

```bash
# Clone your repo locally
git clone https://github.com/YOUR_USERNAME/weaveai-enterprise.git
cd weaveai-enterprise

# Install dependencies
npm install

# Create .env file
echo "DATABASE_URL=your_neon_connection_string" > .env

# Push database schema
npm run db:push
```

#### Step 5: Create Admin Account (5 minutes)

1. Visit your deployed site: `https://your-app.vercel.app`
2. Register a new account with your email
3. Go to Neon dashboard → SQL Editor
4. Run this query:
```sql
UPDATE "user"
SET "isAdmin" = true
WHERE email = 'your-email@example.com';
```
5. Refresh the page → You now have admin access at `/admin`

### Configuration via Admin Dashboard

After deployment, configure everything visually:

#### 1. AI Model Configuration (`/admin/settings/ai-models`)
- Add all your AI provider API keys
- Enable/disable specific models
- Set default models

#### 2. Pricing Plans (`/admin/settings/plans`)
```
Starter: $19/mo
- 500 requests/month
- Basic models only

Professional: $49/mo
- 2,500 requests/month
- All text models
- Basic image generation

Business: $99/mo
- 10,000 requests/month
- All models
- Unlimited image generation
- Video generation
```

#### 3. Branding (`/admin/settings/branding`)
- Upload your logo
- Customize colors
- Set site name and tagline

#### 4. Email Configuration (`/admin/settings/mailing`)
```
SMTP Settings:
- Host: smtp.gmail.com (for Gmail)
- Port: 587
- User: your-email@gmail.com
- Password: your-app-specific-password
```

#### 5. OAuth Providers (`/admin/settings/oauth-providers`)
Configure social login (optional):
- Google OAuth
- Apple OAuth
- Facebook OAuth
- Twitter/X OAuth

#### 6. Cloud Storage (`/admin/settings/cloud-storage`)
Cloudflare R2 for user uploads:
- Account ID
- Access Key
- Secret Key
- Bucket Name

---

## Local Development Setup

### Prerequisites
- Node.js 20+ (check: `node --version`)
- PostgreSQL 15+ (or use Neon for local dev too)
- Git

### Step-by-Step Setup

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/weaveai-enterprise.git
cd weaveai-enterprise

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your values

# 4. Set up database
npm run db:push

# 5. (Optional) Seed initial data
npm run db:seed

# 6. Start development server
npm run dev
```

Visit http://localhost:5173

### Environment Variables for Local Development

```env
# Database (use Neon or local PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/weaveai_dev

# Auth (generate with: npx auth secret)
AUTH_SECRET=your_generated_secret

# Site
PUBLIC_ORIGIN=http://localhost:5173
NODE_ENV=development

# AI Providers (get free keys for testing)
OPENROUTER_API_KEY=sk-or-v1-...
GEMINI_API_KEY=AIza...

# Stripe (use test mode)
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (optional for local dev)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Cloudflare R2 (optional for local dev)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=weaveai-dev
```

---

## Development Workflow

### Creating a New Feature

1. **Create a branch**:
```bash
git checkout -b feature/chat-folders
```

2. **Follow the architecture**:
```bash
src/
├── lib/
│   ├── server/
│   │   ├── repositories/
│   │   │   └── folder.repository.ts     # Data access
│   │   └── services/
│   │       └── folder.service.ts        # Business logic
│   └── components/
│       └── chat/
│           └── FolderSidebar.svelte     # UI component
├── routes/
│   └── (app)/
│       └── folders/
│           └── +page.svelte             # Route page
└── api/
    └── v1/
        └── folders/
            └── +server.ts               # API endpoint
```

3. **Write tests**:
```bash
tests/
├── unit/
│   └── services/
│       └── folder.service.test.ts
└── integration/
    └── api/
        └── folders.test.ts
```

4. **Test locally**:
```bash
npm run test
npm run check
npm run dev
```

5. **Commit and push**:
```bash
git add .
git commit -m "feat: add folder organization for chats"
git push origin feature/chat-folders
```

6. **Create Pull Request**:
   - Go to GitHub
   - Create PR from your branch to main
   - CI will run automatically
   - Merge after approval

### Common Development Tasks

#### Add a New AI Provider

1. **Create provider implementation**:
```typescript
// src/lib/ai/providers/new-provider/client.ts
export class NewProviderClient {
  constructor(private apiKey: string) {}

  async generateText(prompt: string): Promise<string> {
    // Implementation
  }
}
```

2. **Add to provider registry**:
```typescript
// src/lib/ai/providers/index.ts
export { NewProviderClient } from './new-provider/client';
```

3. **Update model configuration**:
```typescript
// src/lib/ai/constants/model-capabilities.ts
export const NEW_PROVIDER_MODELS = [
  {
    id: 'new-provider/model-1',
    name: 'Model 1',
    capabilities: ['text'],
    pricing: { input: 0.01, output: 0.03 }
  }
];
```

4. **Add admin UI**:
```typescript
// Update admin settings to include new provider API key field
```

#### Add a New API Endpoint

1. **Create repository** (if needed):
```typescript
// src/lib/server/repositories/resource.repository.ts
export class ResourceRepository {
  async findAll(): Promise<Resource[]> { }
  async findById(id: string): Promise<Resource | null> { }
  async create(data: CreateResourceDTO): Promise<Resource> { }
}
```

2. **Create service**:
```typescript
// src/lib/server/services/resource.service.ts
export class ResourceService {
  constructor(private repo: ResourceRepository) { }

  async getResources(userId: string): Promise<Resource[]> {
    // Business logic
    return this.repo.findAll();
  }
}
```

3. **Create API route**:
```typescript
// src/routes/api/v1/resources/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const service = new ResourceService(new ResourceRepository());
  const resources = await service.getResources(locals.user.id);
  return json({ data: resources });
};
```

4. **Add types**:
```typescript
// src/lib/types/resources.d.ts
export interface Resource {
  id: string;
  name: string;
  createdAt: Date;
}
```

#### Create a New UI Component

1. **Create component file**:
```svelte
<!-- src/lib/components/shared/NewComponent.svelte -->
<script lang="ts">
  interface Props {
    title: string;
    onClick?: () => void;
  }

  let { title, onClick }: Props = $props();
</script>

<div class="component">
  <h2>{title}</h2>
  <button onclick={onClick}>Click me</button>
</div>

<style>
  .component {
    /* Styles */
  }
</style>
```

2. **Export from index**:
```typescript
// src/lib/components/shared/index.ts
export { default as NewComponent } from './NewComponent.svelte';
```

3. **Use in page**:
```svelte
<script>
  import { NewComponent } from '$lib/components/shared';
</script>

<NewComponent title="Hello" onClick={() => console.log('clicked')} />
```

---

## Testing Strategy

### Unit Tests
Test individual functions and services:

```typescript
// tests/unit/services/subscription.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SubscriptionService } from '$lib/server/services/billing/subscription.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  beforeEach(() => {
    service = new SubscriptionService();
  });

  it('should calculate prorated amount correctly', () => {
    const amount = service.calculateProration(
      { plan: 'pro', amount: 49 },
      { plan: 'business', amount: 99 },
      15 // days remaining
    );
    expect(amount).toBe(25); // Roughly half of $50 difference
  });
});
```

### Integration Tests
Test API endpoints:

```typescript
// tests/integration/api/chats.test.ts
import { describe, it, expect } from 'vitest';
import { createAuthenticatedRequest } from '../helpers';

describe('Chats API', () => {
  it('should create a new chat', async () => {
    const response = await createAuthenticatedRequest()
      .post('/api/v1/chats')
      .send({ title: 'New Chat' });

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data.title).toBe('New Chat');
  });
});
```

### E2E Tests
Test user flows:

```typescript
// tests/e2e/user-flows/signup.test.ts
import { test, expect } from '@playwright/test';

test('user can sign up and access dashboard', async ({ page }) => {
  await page.goto('/register');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'SecurePass123!');
  await page.click('button[type=submit]');

  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

### Run Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

---

## Database Management

### Migrations

Create a new migration:
```bash
npm run db:generate
```

Apply migrations:
```bash
npm run db:migrate
```

### Drizzle Studio

Open visual database editor:
```bash
npm run db:studio
```

Visit http://localhost:4983

### Backup & Restore

**Backup**:
```bash
# Production backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Or use Neon's built-in backups
```

**Restore**:
```bash
psql $DATABASE_URL < backup-20250125.sql
```

---

## Monitoring & Debugging

### Logs

**Development**:
```bash
# Application logs
npm run dev

# Database logs
npm run db:studio
```

**Production**:
- View logs in Vercel Dashboard
- Set up Sentry for error tracking
- Use DataDog/New Relic for APM

### Common Issues

#### Issue: Database Connection Fails
```bash
# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

#### Issue: Build Fails on Vercel
- Check environment variables are set
- Ensure Node version matches (package.json: `"node": ">=20.0.0"`)
- Check build logs for specific errors

#### Issue: AI Provider Returns Errors
- Verify API key is correct
- Check rate limits (most providers have limits)
- Test API key directly with curl:
```bash
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

---

## Performance Optimization

### Enable Caching

1. **Set up Redis** (optional, recommended for production):
```bash
# Using Upstash (serverless Redis)
# 1. Sign up at https://upstash.com
# 2. Create Redis database
# 3. Add to .env:
REDIS_URL=redis://default:password@host:port
```

2. **Configure caching**:
```typescript
// src/lib/server/cache/redis.ts
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!
});
```

### Database Query Optimization

**Use indexes**:
```sql
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_created_at ON chats(created_at DESC);
```

**Analyze slow queries**:
```sql
EXPLAIN ANALYZE
SELECT * FROM chats WHERE user_id = 'xxx' ORDER BY created_at DESC LIMIT 10;
```

### CDN Configuration

Cloudflare is automatically configured with Vercel. To optimize:
1. Go to Cloudflare Dashboard
2. Enable "Auto Minify" for JS/CSS/HTML
3. Enable "Brotli" compression
4. Set "Browser Cache TTL" to 4 hours
5. Enable "Always Online"

---

## Security Checklist

Before going live:

### Application Security
- [ ] All environment variables set (no hardcoded secrets)
- [ ] HTTPS enabled (force redirect)
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Rate limiting active
- [ ] Input validation on all forms
- [ ] SQL injection prevention (using Drizzle ORM)
- [ ] XSS prevention (DOMPurify active)
- [ ] CSRF protection enabled
- [ ] Session security (httpOnly, secure, sameSite cookies)

### Infrastructure Security
- [ ] Database has strong password
- [ ] Database connections encrypted (SSL)
- [ ] API keys stored securely (environment variables)
- [ ] Regular backups enabled
- [ ] Monitoring and alerting configured
- [ ] 2FA enabled on all admin accounts

### Compliance
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] GDPR compliance (if serving EU users)
- [ ] Cookie consent banner (if required)
- [ ] Data retention policy defined

---

## Go-Live Checklist

### Pre-Launch (1 week before)
- [ ] All features tested
- [ ] Performance tests passed (<2s response time)
- [ ] Load testing completed (can handle expected traffic)
- [ ] Security audit completed
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Domain configured and SSL active
- [ ] Email sending works
- [ ] Payment processing tested (test mode)
- [ ] Admin dashboard functional
- [ ] Documentation complete

### Launch Day
- [ ] Switch Stripe to live mode
- [ ] Update OAuth redirect URLs (production domain)
- [ ] Verify all environment variables
- [ ] Test critical user flows
- [ ] Monitor error rates
- [ ] Announce launch (ProductHunt, social media, email list)

### Post-Launch (first week)
- [ ] Monitor uptime (should be >99.9%)
- [ ] Check error rates (<0.1%)
- [ ] Respond to user feedback
- [ ] Fix critical bugs immediately
- [ ] Monitor server costs
- [ ] Track key metrics (signups, conversions)

---

## Maintenance Schedule

### Daily
- Check error logs (Sentry)
- Monitor uptime (UptimeRobot)
- Review new user signups
- Check payment failures

### Weekly
- Review analytics (users, revenue, churn)
- Update dependencies (if needed)
- Backup database manually (in addition to automatic)
- Review support tickets
- Plan next week's features

### Monthly
- Security update all dependencies
- Review and optimize database queries
- Analyze costs (hosting, AI providers)
- Review and update documentation
- Conduct security scan (OWASP ZAP)
- Team retrospective (what went well, what to improve)

### Quarterly
- Security audit (comprehensive)
- Performance review (load testing)
- User research (surveys, interviews)
- Roadmap planning
- Legal review (ToS, Privacy Policy updates)

---

## Getting Help

### Resources
- **Documentation**: `/docs` folder in repo
- **Community**: Discord server (create one)
- **Support**: support@weaveai.com
- **Issues**: GitHub Issues tab

### Common Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build

# Database
npm run db:push          # Push schema changes
npm run db:studio        # Open Drizzle Studio
npm run db:migrate       # Run migrations
npm run db:seed          # Seed initial data

# Testing
npm test                 # Run all tests
npm run test:unit        # Unit tests only
npm run test:e2e         # E2E tests only

# Code Quality
npm run check            # Type checking
npm run lint             # Lint code
npm run format           # Format code

# Deployment
git push origin main     # Auto-deploys to Vercel
vercel                   # Deploy to Vercel manually
```

---

**Next Steps**: Follow the "30-Minute Deployment" guide above to get your WeaveAI instance live!

**Questions?** Open an issue on GitHub or contact support.
