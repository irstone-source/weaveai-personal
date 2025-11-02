# SYNERGIA: Complete Functional Specification

**Document Version:** 1.0
**Last Updated:** October 2025
**Classification:** Internal - Engineering Reference
**Maintained By:** Engineering Team

---

## Document Purpose

This functional specification serves as the comprehensive engineering reference for SYNERGIA. It details every feature, API endpoint, database schema, integration requirement, and technical implementation across all four core systems.

**Target Audience:**
- Engineering team (primary)
- Product designers (UX specifications)
- QA team (testing requirements)
- External contractors (integration partners)

**Document Structure:**
- **Part 1:** System Architecture & Foundation
- **Part 2:** Feature Specifications (4 Core Systems)
- **Part 3:** APIs, Data Models, & Integrations
- **Part 4:** Security, Compliance, & Operations
- **Part 5:** Appendices & Reference Materials

---

## Table of Contents

### Part 1: System Architecture & Foundation
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Database Architecture](#3-database-architecture)
4. [Authentication & Authorization](#4-authentication--authorization)

### Part 2: Feature Specifications
5. [Client Portal](#5-client-portal)
6. [Performance Engine](#6-performance-engine)
7. [Collaboration Hub](#7-collaboration-hub)
8. [Strategic Orchestration](#8-strategic-orchestration)

### Part 3: APIs, Data Models, & Integrations
9. [REST API Specification](#9-rest-api-specification)
10. [WebSocket API](#10-websocket-api)
11. [Integration Architecture](#11-integration-architecture)
12. [AI & Machine Learning](#12-ai--machine-learning)

### Part 4: Security, Compliance, & Operations
13. [Security Architecture](#13-security-architecture)
14. [Compliance Requirements](#14-compliance-requirements)
15. [Testing & QA](#15-testing--qa)
16. [Deployment & DevOps](#16-deployment--devops)

### Part 5: Appendices
17. [Complete Database Schema](#17-complete-database-schema)
18. [API Endpoint Reference](#18-api-endpoint-reference)
19. [Error Codes & Handling](#19-error-codes--handling)
20. [Glossary](#20-glossary)

---

# Part 1: System Architecture & Foundation

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE LAYER                      │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Web App    │  │  Mobile Web  │  │  Email UI    │          │
│  │  (SvelteKit) │  │  (Responsive)│  │  (Templates) │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼──────────────────┐
│         │     APPLICATION LAYER (SvelteKit)   │                   │
│         │                  │                  │                   │
│  ┌──────▼──────────────────▼──────────────────▼────────┐         │
│  │           API Router & Middleware                     │         │
│  │  - Rate Limiting  - Auth  - CORS  - Validation      │         │
│  └──────┬────────────────────────────────────┬──────────┘         │
│         │                                     │                   │
│  ┌──────▼───────┐  ┌────────────┐  ┌────────▼─────────┐         │
│  │  Business    │  │  WebSocket  │  │  Background      │         │
│  │  Logic       │  │  Server     │  │  Jobs (Cron)     │         │
│  └──────┬───────┘  └─────┬──────┘  └────────┬─────────┘         │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼──────────────────┐
│         │      DATA & SERVICES LAYER          │                   │
│         │                  │                  │                   │
│  ┌──────▼─────┐  ┌────────▼────┐  ┌─────────▼────┐  ┌─────────┐│
│  │ PostgreSQL │  │  Pinecone   │  │   Redis      │  │  Neo4j  ││
│  │ (Relational│  │  (Vector    │  │   (Cache)    │  │ (Graph) ││
│  │   Data)    │  │   Memory)   │  │              │  │         ││
│  └────────────┘  └─────────────┘  └──────────────┘  └─────────┘│
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            External Services & Integrations              │    │
│  │  OpenAI • Gemini • LiveKit • Deepgram • Nylas           │    │
│  │  Slack • Linear • Stripe • AWS S3                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
```

---

### 1.2 Architectural Principles

**1. Separation of Concerns**
- UI Layer: Pure presentation (Svelte components)
- API Layer: Business logic + validation (SvelteKit server)
- Data Layer: Persistence + caching (PostgreSQL + Redis)

**2. Stateless Architecture**
- API servers are stateless (session state in Redis)
- Horizontal scaling ready (add more server instances)
- WebSocket connections managed separately (sticky sessions)

**3. API-First Design**
- All features exposed via REST/WebSocket APIs
- Mobile app and 3rd-party integrations can use same APIs
- GraphQL considered for future (currently REST for simplicity)

**4. Event-Driven**
- Critical operations emit events (e.g., `task.completed`, `comment.created`)
- Event handlers trigger side effects (AI analysis, notifications, integrations)
- Enables async processing (doesn't block user requests)

**5. Fail-Safe**
- Graceful degradation (if OpenAI is down, fallback to Gemini)
- Retry logic for external APIs (exponential backoff)
- Circuit breakers prevent cascade failures

---

### 1.3 Component Architecture

**Frontend Components (Svelte 5):**

```
src/lib/components/
├── ui/                    # shadcn-svelte base components
│   ├── button/
│   ├── input/
│   ├── card/
│   └── ...
├── chat/                  # AI chat interface
│   ├── ChatInterface.svelte
│   ├── MessageList.svelte
│   ├── InputBox.svelte
│   └── AgentSelector.svelte
├── client-portal/         # Client Portal components
│   ├── ProjectTimeline.svelte
│   ├── GuestAuth.svelte
│   └── CommentThread.svelte
├── performance/           # Performance Engine
│   ├── CapabilityHeatmap.svelte
│   ├── GrowthTrendChart.svelte
│   └── SkillsGapAnalysis.svelte
├── collaboration/         # Collaboration Hub
│   ├── VideoCall.svelte
│   ├── LiveTranscript.svelte
│   └── UnifiedTimeline.svelte
├── strategic/             # Strategic Orchestration
│   ├── ThreeHorizons.svelte
│   ├── ConstellationChat.svelte
│   └── ScenarioModeling.svelte
└── shared/                # Shared utilities
    ├── FileUpload.svelte
    ├── NotificationCenter.svelte
    └── SearchBar.svelte
```

**Backend Services (SvelteKit):**

```
src/lib/server/
├── auth/                  # Authentication
│   ├── lucia.ts           # Lucia Auth setup
│   ├── guest.ts           # Guest/magic link auth
│   └── permissions.ts     # RBAC logic
├── db/                    # Database
│   ├── schema.ts          # Drizzle schema
│   ├── migrations/        # Migration files
│   └── queries/           # Complex queries
├── ai/                    # AI services
│   ├── openai.ts          # OpenAI client
│   ├── gemini.ts          # Gemini client
│   ├── agents.ts          # Agent orchestration
│   └── prompts/           # Prompt templates
├── memory/                # Vector memory
│   ├── pinecone-memory.ts
│   └── context-retrieval.ts
├── integrations/          # External integrations
│   ├── linear.ts
│   ├── slack.ts
│   ├── nylas.ts
│   └── crm.ts
├── video/                 # Video services
│   ├── livekit.ts
│   └── transcription.ts
├── performance/           # Performance Engine
│   ├── capability-detector.ts
│   ├── recommendations.ts
│   └── analytics.ts
├── strategic/             # Strategic Orchestration
│   ├── constellation.ts
│   ├── three-horizons.ts
│   └── scenario-modeling.ts
└── utils/                 # Utilities
    ├── email.ts
    ├── cache.ts
    └── queue.ts
```

---

### 1.4 Data Flow Patterns

**Pattern 1: User Action → API → Database → Response**

```typescript
// User clicks "Create Project"
// 1. Frontend sends POST request
fetch('/api/projects', {
  method: 'POST',
  body: JSON.stringify({ title: 'New Website', ... })
})

// 2. API route validates and saves
export async function POST({ request, locals }) {
  const data = await request.json()

  // Validate
  const projectSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    dueDate: z.date().optional()
  })
  const validated = projectSchema.parse(data)

  // Save to database
  const project = await db.insert(projects).values({
    ...validated,
    userId: locals.user.id,
    createdAt: new Date()
  }).returning()

  // Emit event (for side effects)
  await emitEvent('project.created', { project })

  return json(project)
}

// 3. Event handler runs async
eventHandlers.on('project.created', async ({ project }) => {
  // AI analyzes required skills
  await detectRequiredSkills(project)

  // Create Linear issue if integration enabled
  if (await hasLinearIntegration(project.userId)) {
    await syncToLinear(project)
  }
})

// 4. Frontend updates UI
const newProject = await response.json()
projects = [...projects, newProject]
```

**Pattern 2: Real-Time Updates (WebSocket)**

```typescript
// User joins video call → WebSocket connection
const ws = new WebSocket(`wss://synergia.ai/ws/room/${roomId}`)

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'join', roomId, userId }))
}

// Server broadcasts to all participants
ws.on('message', (data) => {
  const message = JSON.parse(data)

  if (message.type === 'transcript') {
    // Update live transcript UI
    transcripts = [...transcripts, message.text]
  }
})
```

**Pattern 3: Background Jobs (Cron)**

```typescript
// Run every 5 minutes: Sync Linear issues
cron.schedule('*/5 * * * *', async () => {
  const integrations = await getActiveLinearIntegrations()

  for (const integration of integrations) {
    await syncLinearIssues(integration.userId, integration.teamId)
  }
})

// Run daily at 9am: Send performance insights
cron.schedule('0 9 * * *', async () => {
  const teams = await getAllActiveTeams()

  for (const team of teams) {
    const atRisk = await identifyAtRiskTeamMembers(team.id)
    if (atRisk.length > 0) {
      await sendPerformanceAlert(team.managerId, atRisk)
    }
  }
})
```

---

## 2. Technology Stack

### 2.1 Frontend

**Framework: SvelteKit 5**
- **Version:** 5.0+ (latest)
- **Why Svelte:** 40% smaller bundle size vs. React, 30% faster rendering
- **Why SvelteKit:** Full-stack framework with SSR, API routes, file-based routing

**Reactive System: Svelte 5 Runes**
```typescript
// Old Svelte 4 way
let count = 0
$: doubled = count * 2

// New Svelte 5 Runes way
let count = $state(0)
let doubled = $derived(count * 2)

// Effect (side effect when state changes)
$effect(() => {
  console.log('Count changed to:', count)
})
```

**UI Components: shadcn-svelte**
- Pre-built accessible components (buttons, inputs, dialogs, etc.)
- Fully customizable with Tailwind
- Copy-paste approach (no npm package dependency)

**Styling: TailwindCSS 4**
- **Version:** 4.0+ (latest with native CSS engine)
- **Config:** Custom theme colors, fonts (Inter), spacing
- **Plugins:** @tailwindcss/typography for rich text

**State Management:**
- **Local state:** Svelte 5 `$state` (component-level)
- **Global state:** Svelte stores (`writable`, `readable`)
- **Server state:** TanStack Query (for React) → Svelte-query alternative

**Form Handling:**
- **Validation:** Zod schemas (type-safe, runtime validation)
- **Library:** Superforms (SvelteKit-native form handling)

**Charts & Visualizations:**
- **Option 1:** D3.js (custom, flexible)
- **Option 2:** Chart.js (simpler, less code)
- **Decision:** Use D3 for custom (Gantt chart), Chart.js for standard (line, bar)

---

### 2.2 Backend

**Server Framework: SvelteKit**
- API routes at `src/routes/api/`
- Server-side rendering (SSR) for SEO
- Edge-ready (can deploy to Vercel Edge)

**Database ORM: Drizzle**
```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const client = postgres(process.env.DATABASE_URL)
export const db = drizzle(client)

// Type-safe queries
const users = await db.query.users.findMany({
  where: eq(users.email, 'user@example.com'),
  with: { projects: true } // Join relationship
})
```

**Authentication: Lucia**
```typescript
import { Lucia } from 'lucia'
import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle'

const adapter = new DrizzlePostgreSQLAdapter(db, sessionTable, userTable)

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === 'production'
    }
  }
})
```

**Caching: Redis (via Upstash)**
```typescript
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

// Cache expensive queries
export async function getCachedTeamCapabilities(teamId: string) {
  const cached = await redis.get(`team:${teamId}:capabilities`)
  if (cached) return cached

  const data = await db.query.capabilities.findMany(/* ... */)
  await redis.setex(`team:${teamId}:capabilities`, 600, JSON.stringify(data))

  return data
}
```

**Background Jobs: BullMQ (future)**
```typescript
import { Queue, Worker } from 'bullmq'

const emailQueue = new Queue('emails', { connection: redis })

// Add job
await emailQueue.add('send-welcome', {
  email: 'user@example.com',
  template: 'welcome'
})

// Process job
const worker = new Worker('emails', async (job) => {
  await sendEmail(job.data.email, job.data.template)
}, { connection: redis })
```

---

### 2.3 Database

**Primary Database: PostgreSQL (Neon)**
- **Why Neon:** Serverless Postgres with auto-scaling
- **Version:** PostgreSQL 16+
- **Connection:** Via postgres.js (native driver, faster than pg)

**Vector Database: Pinecone**
- **Purpose:** Store conversation embeddings for semantic search
- **Index:** Cosine similarity, 1536 dimensions (OpenAI text-embedding-3-small)

**Graph Database: Neo4j (future, Month 7+)**
- **Purpose:** Context graph (relationships between entities)
- **Use case:** "Show me all emails, Slack threads, and meetings related to Project X"

**Cache: Redis (Upstash)**
- **Purpose:** Cache expensive queries, rate limiting, session storage

---

### 2.4 External Services

**AI Models:**
| Service | Model | Use Case | Cost |
|---------|-------|----------|------|
| OpenAI | gpt-4o | Strategic reasoning, structured output | $5/1M tokens input |
| OpenAI | gpt-4o-mini | Fast queries, skill extraction | $0.15/1M tokens |
| Google | gemini-2.0-flash-exp | Low-latency chat responses | $0.075/1M tokens |
| OpenAI | text-embedding-3-small | Vector embeddings for memory | $0.02/1M tokens |
| Deepgram | nova-2 | Live transcription | $0.0043/minute |

**Infrastructure:**
| Service | Purpose | Cost |
|---------|---------|------|
| Vercel | Hosting (SvelteKit app) | $20/month (Pro plan) |
| Neon | PostgreSQL database | $19/month (Launch plan) |
| Upstash Redis | Caching | $10/month (Pay-as-you-go) |
| AWS S3 | File storage | ~$5/month (for 100GB) |
| LiveKit | WebRTC infrastructure | $0-$50/month (<50 participants) |

**Integrations:**
| Service | Purpose | Cost |
|---------|---------|------|
| Stripe | Payments | 2.9% + $0.30 per transaction |
| Nylas | Email (Gmail, Outlook) | $9/month per mailbox |
| Slack (Bolt.js) | Slack integration | Free (use Slack API) |
| Linear | Issue tracking sync | Free (use Linear API) |
| Merge.dev | Unified CRM API | $500/month (10K API calls) |

---

### 2.5 Development Tools

**Code Editor Extensions:**
- Cursor AI (AI-assisted coding)
- Svelte for VS Code (syntax highlighting)
- Tailwind CSS IntelliSense
- Prettier (code formatting)
- ESLint (linting)

**Version Control:**
- GitHub (primary)
- Branch strategy: main → develop → feature branches
- PR reviews required before merge

**CI/CD:**
- GitHub Actions (run tests on push)
- Vercel (auto-deploy on push to main)

**Monitoring:**
- Sentry (error tracking)
- PostHog (analytics, feature flags)
- Vercel Analytics (page performance)

---

## 3. Database Architecture

### 3.1 Schema Overview

**31 Total Tables:**

**Core Tables (10):**
- `users` - User accounts
- `sessions` - Auth sessions (Lucia)
- `accounts` - OAuth accounts (Google, GitHub)
- `verification_tokens` - Email verification
- `password_reset_tokens` - Password resets
- `magic_link_tokens` - Guest authentication
- `subscriptions` - Stripe subscriptions
- `teams` - Team/organization entities
- `team_members` - User-team relationships
- `invitations` - Team invites

**Client Portal Tables (6):**
- `projects` - Projects (tasks, client work)
- `project_access` - Guest permissions per project
- `tasks` - Individual tasks within projects
- `comments` - Comments on projects/tasks
- `attachments` - File uploads linked to projects
- `linear_integrations` - Linear OAuth connections

**Performance Engine Tables (4):**
- `capabilities` - User skill proficiencies
- `capability_data_points` - Historical capability measurements
- `team_metrics` - Aggregate team health metrics
- `goals` - User/team OKRs and goals

**Collaboration Hub Tables (7):**
- `video_rooms` - LiveKit room metadata
- `video_participants` - Join/leave tracking
- `transcripts` - Deepgram transcription lines
- `communication_threads` - Unified timeline entries
- `email_integrations` - Nylas OAuth connections
- `slack_integrations` - Slack OAuth connections
- `crm_integrations` - CRM OAuth connections (via Merge.dev)

**Strategic Orchestration Tables (4):**
- `strategic_plans` - Three Horizons plans
- `scenarios` - What-if scenario modeling
- `resource_allocations` - Project staffing recommendations
- `constellation_queries` - AI PM query history

---

### 3.2 Core Schema (Detailed)

**users table:**
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT 'user_' || gen_random_uuid(), -- user_abc123
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  password_hash TEXT, -- NULL for OAuth-only users
  name TEXT,
  avatar_url TEXT,
  role TEXT CHECK (role IN ('user', 'admin', 'guest')) DEFAULT 'user',
  is_guest BOOLEAN DEFAULT FALSE,
  invited_by TEXT REFERENCES users(id),

  -- Subscription
  stripe_customer_id TEXT UNIQUE,
  subscription_status TEXT CHECK (subscription_status IN (
    'active', 'canceled', 'incomplete', 'incomplete_expired',
    'past_due', 'trialing', 'unpaid'
  )) DEFAULT 'incomplete',
  plan_tier TEXT CHECK (plan_tier IN ('free', 'starter', 'pro', 'advanced')) DEFAULT 'free',
  subscription_ends_at TIMESTAMP,

  -- Preferences
  memory_mode TEXT CHECK (memory_mode IN ('persistent', 'humanized')) DEFAULT 'humanized',
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);
```

**sessions table (Lucia):**
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,

  -- Session metadata
  ip_address TEXT,
  user_agent TEXT,
  last_activity_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

**projects table:**
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  -- Project info
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN (
    'backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'
  )) DEFAULT 'todo',
  priority TEXT CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'no_priority')),

  -- Dates
  start_date TIMESTAMP,
  due_date TIMESTAMP,
  completed_at TIMESTAMP,

  -- Estimates
  estimated_hours INTEGER,
  actual_hours INTEGER,
  estimated_value NUMERIC, -- For CRM deal value

  -- External integrations
  external_id TEXT, -- Linear issue ID
  external_source TEXT CHECK (external_source IN ('linear', 'native')),
  crm_deal_id TEXT, -- CRM deal ID (Salesforce, HubSpot, etc.)

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_team_id ON projects(team_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_external_id ON projects(external_id);
```

**project_access table (Guest Permissions):**
```sql
CREATE TABLE project_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Permission level
  role TEXT CHECK (role IN ('owner', 'editor', 'viewer')) DEFAULT 'viewer',

  -- Audit
  granted_by TEXT REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_access_project_id ON project_access(project_id);
CREATE INDEX idx_project_access_user_id ON project_access(user_id);
```

---

### 3.3 Performance Engine Schema

**capabilities table:**
```sql
CREATE TABLE capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Skill info
  skill_name TEXT NOT NULL, -- e.g., "React", "Python", "Figma"
  category TEXT CHECK (category IN (
    'programming', 'design', 'marketing', 'management', 'soft_skill'
  )),

  -- Proficiency metrics
  proficiency INTEGER CHECK (proficiency >= 0 AND proficiency <= 100),
  growth_velocity NUMERIC, -- % change over last 90 days
  confidence TEXT CHECK (confidence IN ('low', 'medium', 'high')),

  -- Dates
  last_practiced TIMESTAMP,
  first_detected TIMESTAMP DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, skill_name)
);

CREATE INDEX idx_capabilities_user_id ON capabilities(user_id);
CREATE INDEX idx_capabilities_skill_name ON capabilities(skill_name);
CREATE INDEX idx_capabilities_proficiency ON capabilities(proficiency DESC);
```

**capability_data_points table:**
```sql
CREATE TABLE capability_data_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id UUID NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,

  -- Measurement
  proficiency INTEGER NOT NULL CHECK (proficiency >= 0 AND proficiency <= 100),
  source TEXT CHECK (source IN (
    'task_completion', 'peer_feedback', 'code_commit', 'self_reported', 'ai_inferred'
  )),

  -- Context
  metadata JSONB, -- { taskId: 'abc', complexity: 'high', ... }

  -- Timestamp
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_capability_data_points_capability_id ON capability_data_points(capability_id);
CREATE INDEX idx_capability_data_points_recorded_at ON capability_data_points(recorded_at DESC);
```

---

### 3.4 Database Migrations

**Migration Strategy:**
- **Tool:** Drizzle Kit (`drizzle-kit generate`, `drizzle-kit push`)
- **Workflow:**
  1. Edit `src/lib/server/db/schema.ts`
  2. Run `npm run db:generate` → Creates migration SQL file
  3. Run `npm run db:push` → Applies migration to database
  4. Commit migration file to git

**Example Migration:**
```sql
-- Migration: 0001_add_crm_deal_id_to_projects.sql
ALTER TABLE projects ADD COLUMN crm_deal_id TEXT;
CREATE INDEX idx_projects_crm_deal_id ON projects(crm_deal_id);
```

**Rollback Strategy:**
- Keep migrations in git
- If migration fails, create new migration to undo changes
- Never delete migration files (history must be preserved)

---

## 4. Authentication & Authorization

### 4.1 Authentication Flows

**Flow 1: Email/Password Sign Up**
```
1. User enters email + password
2. Server hashes password (bcrypt, 12 rounds)
3. Create user record
4. Send verification email with token
5. User clicks link → Verify email → Create session
```

**Flow 2: OAuth (Google, GitHub)**
```
1. User clicks "Sign in with Google"
2. Redirect to Google OAuth consent screen
3. Google redirects back with code
4. Exchange code for access token
5. Fetch user info from Google
6. Create/update user record
7. Create session
```

**Flow 3: Magic Link (Guest Authentication)**
```
1. Agency invites client (email address)
2. Generate magic link token (random, expires 24h)
3. Send email with link
4. Client clicks link → Token validated
5. Create guest session (limited to assigned projects)
```

---

### 4.2 Authorization (RBAC)

**Roles:**
| Role | Capabilities |
|------|-------------|
| **guest** | View assigned projects only |
| **user** | Full access to own data, create projects, invite guests |
| **admin** | Access all users, modify billing, delete accounts |

**Permission Matrix:**

| Action | Guest | User | Admin |
|--------|-------|------|-------|
| View own projects | ✅ | ✅ | ✅ |
| View team projects | ❌ | ✅ | ✅ |
| Create projects | ❌ | ✅ | ✅ |
| Invite guests | ❌ | ✅ | ✅ |
| Delete projects | ❌ | ✅ (own) | ✅ (all) |
| Access Performance Engine | ❌ | ✅ | ✅ |
| Manage billing | ❌ | ✅ (own) | ✅ (all) |
| Access admin panel | ❌ | ❌ | ✅ |

**Implementation:**

```typescript
// Middleware: Check permissions
export async function requirePermission(
  user: User,
  resource: 'project' | 'team' | 'admin',
  action: 'read' | 'write' | 'delete'
) {
  if (user.role === 'admin') return true // Admins can do anything

  if (user.role === 'guest') {
    // Guests can only read assigned projects
    if (resource === 'project' && action === 'read') {
      return await hasProjectAccess(user.id, resourceId)
    }
    return false
  }

  if (user.role === 'user') {
    // Users can read/write their own resources
    return await ownsResource(user.id, resource, resourceId)
  }

  return false
}

// Usage in API route
export async function DELETE({ params, locals }) {
  const canDelete = await requirePermission(locals.user, 'project', 'delete')
  if (!canDelete) {
    throw error(403, 'Forbidden')
  }

  await db.delete(projects).where(eq(projects.id, params.id))
  return json({ success: true })
}
```

---

# Part 2: Feature Specifications

## 5. Client Portal

### 5.1 Feature Overview

**Purpose:** Zero-cost client portal for agencies to give clients real-time project visibility.

**Value Proposition:**
- Agencies save $500-$2000/month vs. ClientPortal.io, Copilot, Proposify
- Clients see real-time updates (no manual status reports)
- Built on Linear's free agent system (no per-seat cost for clients)

**User Stories:**
1. **As an agency owner,** I want to invite clients to view project status so I don't have to send manual updates.
2. **As a client,** I want to see project timeline and milestones so I know if we're on track.
3. **As a client,** I want to comment on tasks so I can give feedback directly.
4. **As an agency team member,** I want client comments routed to the right person so I don't miss important feedback.

---

### 5.2 Feature: Linear Integration

**Epic:** Connect agency's Linear workspace and sync issues bidirectionally.

**User Flow:**
```
1. User goes to Settings → Integrations
2. Click "Connect Linear"
3. OAuth redirect to Linear
4. User authorizes SYNERGIA to access their workspace
5. User selects which Linear team(s) to sync
6. SYNERGIA imports all issues from selected team
7. Sync runs every 5 minutes (webhook + cron)
```

**Technical Specifications:**

**OAuth Flow:**
```typescript
// src/routes/api/integrations/linear/auth/+server.ts

export async function GET({ url, locals }) {
  const code = url.searchParams.get('code')

  if (!code) {
    // Redirect to Linear OAuth
    const authUrl = `https://linear.app/oauth/authorize?${new URLSearchParams({
      client_id: process.env.LINEAR_CLIENT_ID,
      redirect_uri: `${process.env.PUBLIC_URL}/api/integrations/linear/auth`,
      response_type: 'code',
      scope: 'read,write'
    })}`

    throw redirect(302, authUrl)
  }

  // Exchange code for token
  const tokenResponse = await fetch('https://api.linear.app/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: process.env.LINEAR_CLIENT_ID,
      client_secret: process.env.LINEAR_CLIENT_SECRET,
      redirect_uri: `${process.env.PUBLIC_URL}/api/integrations/linear/auth`,
      code
    })
  })

  const { access_token } = await tokenResponse.json()

  // Store integration
  await db.insert(linearIntegrations).values({
    userId: locals.user.id,
    accessToken: access_token,
    createdAt: new Date()
  })

  // Start initial sync
  await syncLinearIssues(locals.user.id)

  throw redirect(302, '/settings/integrations?success=true')
}
```

**Sync Logic:**
```typescript
// src/lib/server/integrations/linear.ts

import { LinearClient } from '@linear/sdk'

export async function syncLinearIssues(userId: string) {
  const integration = await db.query.linearIntegrations.findFirst({
    where: eq(linearIntegrations.userId, userId)
  })

  if (!integration) throw new Error('No Linear integration found')

  const client = new LinearClient({ accessToken: integration.accessToken })

  // Fetch all issues (paginated)
  let hasMore = true
  let cursor = null

  while (hasMore) {
    const response = await client.issues({
      first: 100,
      after: cursor,
      filter: { team: { id: { eq: integration.teamId } } }
    })

    // Upsert issues
    for (const issue of response.nodes) {
      await db.insert(projects).values({
        userId,
        externalId: issue.id,
        externalSource: 'linear',
        title: issue.title,
        description: issue.description,
        status: mapLinearStatus(issue.state.name),
        priority: mapLinearPriority(issue.priority),
        dueDate: issue.dueDate,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt
      }).onConflictDoUpdate({
        target: [projects.externalId],
        set: {
          title: issue.title,
          description: issue.description,
          status: mapLinearStatus(issue.state.name),
          updatedAt: new Date()
        }
      })
    }

    hasMore = response.pageInfo.hasNextPage
    cursor = response.pageInfo.endCursor
  }
}

function mapLinearStatus(linearStatus: string): ProjectStatus {
  const mapping: Record<string, ProjectStatus> = {
    'Backlog': 'backlog',
    'Todo': 'todo',
    'In Progress': 'in_progress',
    'In Review': 'in_review',
    'Done': 'done',
    'Canceled': 'cancelled'
  }

  return mapping[linearStatus] || 'todo'
}
```

**Webhook Listener:**
```typescript
// src/routes/api/webhooks/linear/+server.ts

export async function POST({ request }) {
  const payload = await request.json()

  // Verify webhook signature
  const signature = request.headers.get('linear-signature')
  if (!verifyLinearWebhook(payload, signature)) {
    throw error(401, 'Invalid signature')
  }

  // Handle event
  switch (payload.type) {
    case 'Issue':
      if (payload.action === 'create' || payload.action === 'update') {
        await handleIssueUpdate(payload.data)
      } else if (payload.action === 'remove') {
        await handleIssueDelete(payload.data.id)
      }
      break
  }

  return json({ success: true })
}

async function handleIssueUpdate(issue: LinearIssue) {
  // Find which user's integration this belongs to
  const integration = await db.query.linearIntegrations.findFirst({
    where: eq(linearIntegrations.teamId, issue.team.id)
  })

  if (!integration) return

  // Update project in database
  await db.insert(projects).values({
    userId: integration.userId,
    externalId: issue.id,
    externalSource: 'linear',
    title: issue.title,
    // ... rest of fields
  }).onConflictDoUpdate({ /* ... */ })
}
```

**Acceptance Criteria:**
- ✅ User can connect Linear workspace via OAuth
- ✅ All issues from selected team are imported within 60 seconds
- ✅ Status changes in Linear appear in SYNERGIA within 5 minutes
- ✅ Bi-directional sync: Changes in SYNERGIA reflect in Linear
- ✅ Error handling: If Linear API is down, retry with exponential backoff

---

### 5.3 Feature: Guest Authentication

**Epic:** Allow agencies to invite clients (guests) who can view projects without full account.

**User Flow:**
```
1. Agency user views project detail page
2. Clicks "Invite Client"
3. Enters client email
4. Client receives email with magic link
5. Client clicks link → Lands on project timeline page
6. Client can view project + leave comments
7. No password required (magic link re-sent on each visit)
```

**Technical Specifications:**

**Invitation Flow:**
```typescript
// src/routes/api/projects/[id]/invite/+server.ts

export async function POST({ params, request, locals }) {
  const { email } = await request.json()

  // Validate permissions
  const canInvite = await requirePermission(locals.user, 'project', 'write')
  if (!canInvite) throw error(403, 'Forbidden')

  // Check if guest already exists
  let guest = await db.query.users.findFirst({
    where: eq(users.email, email)
  })

  if (!guest) {
    // Create guest user
    guest = await db.insert(users).values({
      email,
      role: 'guest',
      isGuest: true,
      invitedBy: locals.user.id,
      emailVerified: true // Guests don't need email verification
    }).returning()[0]
  }

  // Grant project access
  await db.insert(projectAccess).values({
    projectId: params.id,
    userId: guest.id,
    role: 'viewer',
    grantedBy: locals.user.id
  }).onConflictDoNothing() // Ignore if already exists

  // Generate magic link token
  const token = generateSecureToken(32) // Crypto-random
  await db.insert(magicLinkTokens).values({
    userId: guest.id,
    token,
    projectId: params.id,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  })

  // Send email
  await sendEmail({
    to: email,
    subject: `${locals.user.name} invited you to view ${projectTitle}`,
    template: 'guest-invite',
    data: {
      inviterName: locals.user.name,
      projectTitle,
      magicLink: `${process.env.PUBLIC_URL}/auth/magic?token=${token}`
    }
  })

  return json({ success: true, guestId: guest.id })
}
```

**Magic Link Authentication:**
```typescript
// src/routes/auth/magic/+server.ts

export async function GET({ url, cookies }) {
  const token = url.searchParams.get('token')

  if (!token) throw error(400, 'Token required')

  // Verify token
  const magicLink = await db.query.magicLinkTokens.findFirst({
    where: eq(magicLinkTokens.token, token)
  })

  if (!magicLink) throw error(404, 'Invalid token')
  if (magicLink.usedAt) throw error(400, 'Token already used')
  if (new Date() > magicLink.expiresAt) throw error(400, 'Token expired')

  // Mark token as used
  await db.update(magicLinkTokens)
    .set({ usedAt: new Date() })
    .where(eq(magicLinkTokens.id, magicLink.id))

  // Create session
  const session = await lucia.createSession(magicLink.userId, {
    isGuest: true,
    projectId: magicLink.projectId
  })

  // Set session cookie
  const sessionCookie = lucia.createSessionCookie(session.id)
  cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes)

  // Redirect to project
  throw redirect(302, `/projects/${magicLink.projectId}`)
}
```

**Permission Middleware:**
```typescript
// src/lib/server/auth/permissions.ts

export async function canViewProject(userId: string, projectId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId)
  })

  if (user.role === 'admin') return true

  // Check if user owns project
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId)
  })

  if (project.userId === userId) return true

  // Check if user has explicit access (guest or team member)
  const access = await db.query.projectAccess.findFirst({
    where: and(
      eq(projectAccess.projectId, projectId),
      eq(projectAccess.userId, userId)
    )
  })

  return !!access
}

// Use in load function
export async function load({ params, locals }) {
  if (!await canViewProject(locals.user.id, params.id)) {
    throw error(403, 'You do not have permission to view this project')
  }

  const project = await getProject(params.id)
  return { project }
}
```

**Acceptance Criteria:**
- ✅ Agency user can invite guest by email
- ✅ Guest receives email with magic link within 30 seconds
- ✅ Guest can access project without creating password
- ✅ Guest cannot access other projects (permission check)
- ✅ Magic link expires after 24 hours
- ✅ Magic link can only be used once

---

### 5.4 Feature: Project Timeline (Gantt Chart)

**Epic:** Visualize project tasks in Gantt chart format with milestones and progress tracking.

**User Flow:**
```
1. User/guest navigates to project detail page
2. Timeline tab shows Gantt chart of tasks
3. Tasks displayed as horizontal bars (start date → due date)
4. Dependencies shown as arrows between tasks
5. Milestones shown as diamonds
6. Progress bar shows % complete
```

**Technical Specifications:**

**Data Model:**
```typescript
interface TimelineTask {
  id: string
  title: string
  startDate: Date
  dueDate: Date
  progress: number // 0-100
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'
  assignee?: { name: string, avatar: string }
  dependencies: string[] // Array of task IDs this task depends on
  isMilestone: boolean
}

interface TimelineData {
  tasks: TimelineTask[]
  startDate: Date // Earliest task start
  endDate: Date // Latest task due date
}
```

**Backend API:**
```typescript
// src/routes/api/projects/[id]/timeline/+server.ts

export async function GET({ params, locals }) {
  // Permission check
  if (!await canViewProject(locals.user.id, params.id)) {
    throw error(403, 'Forbidden')
  }

  // Fetch tasks
  const tasks = await db.query.tasks.findMany({
    where: eq(tasks.projectId, params.id),
    with: {
      assignee: { columns: { name: true, avatarUrl: true } },
      dependencies: true
    },
    orderBy: [tasks.startDate]
  })

  // Calculate progress
  const timelineData: TimelineData = {
    tasks: tasks.map(task => ({
      id: task.id,
      title: task.title,
      startDate: task.startDate,
      dueDate: task.dueDate,
      progress: calculateTaskProgress(task),
      status: task.status,
      assignee: task.assignee,
      dependencies: task.dependencies.map(d => d.dependsOnTaskId),
      isMilestone: task.isMilestone
    })),
    startDate: tasks[0]?.startDate || new Date(),
    endDate: tasks[tasks.length - 1]?.dueDate || new Date()
  }

  return json(timelineData)
}

function calculateTaskProgress(task: Task): number {
  if (task.status === 'done') return 100
  if (task.status === 'in_review') return 90
  if (task.status === 'in_progress') return 50
  return 0
}
```

**Frontend Component:**
```svelte
<!-- src/lib/components/client-portal/ProjectTimeline.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import * as d3 from 'd3'

  interface Props {
    projectId: string
    isGuest: boolean
  }

  let { projectId, isGuest }: Props = $props()

  let timelineData = $state<TimelineData | null>(null)
  let svgElement: SVGSVGElement

  onMount(async () => {
    const response = await fetch(`/api/projects/${projectId}/timeline`)
    timelineData = await response.json()

    if (timelineData) {
      renderGanttChart(timelineData)
    }
  })

  function renderGanttChart(data: TimelineData) {
    const width = 1000
    const height = data.tasks.length * 40 + 50
    const margin = { top: 20, right: 20, bottom: 30, left: 200 }

    // Scales
    const xScale = d3.scaleTime()
      .domain([data.startDate, data.endDate])
      .range([margin.left, width - margin.right])

    const yScale = d3.scaleBand()
      .domain(data.tasks.map(t => t.title))
      .range([margin.top, height - margin.bottom])
      .padding(0.2)

    // SVG setup
    const svg = d3.select(svgElement)
      .attr('width', width)
      .attr('height', height)

    // Draw tasks as bars
    svg.selectAll('.task-bar')
      .data(data.tasks)
      .join('rect')
      .attr('class', 'task-bar')
      .attr('x', d => xScale(d.startDate))
      .attr('y', d => yScale(d.title))
      .attr('width', d => xScale(d.dueDate) - xScale(d.startDate))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => getStatusColor(d.status))
      .attr('rx', 4)

    // Draw progress bars (inside task bars)
    svg.selectAll('.progress-bar')
      .data(data.tasks)
      .join('rect')
      .attr('class', 'progress-bar')
      .attr('x', d => xScale(d.startDate))
      .attr('y', d => yScale(d.title))
      .attr('width', d => (xScale(d.dueDate) - xScale(d.startDate)) * (d.progress / 100))
      .attr('height', yScale.bandwidth())
      .attr('fill', 'rgba(0, 0, 0, 0.2)')
      .attr('rx', 4)

    // Draw milestones as diamonds
    svg.selectAll('.milestone')
      .data(data.tasks.filter(t => t.isMilestone))
      .join('polygon')
      .attr('points', d => {
        const x = xScale(d.dueDate)
        const y = yScale(d.title) + yScale.bandwidth() / 2
        const size = 10
        return `${x},${y-size} ${x+size},${y} ${x},${y+size} ${x-size},${y}`
      })
      .attr('fill', '#ff6b6b')

    // X-axis (dates)
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(10))

    // Y-axis (task names)
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale))
  }

  function getStatusColor(status: string): string {
    return {
      'backlog': '#e2e8f0',
      'todo': '#cbd5e1',
      'in_progress': '#fbbf24',
      'in_review': '#60a5fa',
      'done': '#10b981'
    }[status] || '#94a3b8'
  }
</script>

<div class="timeline-container">
  <div class="header">
    <h2>Project Timeline</h2>
    {#if timelineData}
      <div class="legend">
        <span><span class="dot backlog"></span> Backlog</span>
        <span><span class="dot todo"></span> Todo</span>
        <span><span class="dot in_progress"></span> In Progress</span>
        <span><span class="dot in_review"></span> In Review</span>
        <span><span class="dot done"></span> Done</span>
      </div>
    {/if}
  </div>

  {#if timelineData}
    <svg bind:this={svgElement}></svg>
  {:else}
    <div class="loading">Loading timeline...</div>
  {/if}
</div>

<style>
  .timeline-container {
    padding: 2rem;
    background: white;
    border-radius: 8px;
  }

  .legend {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
  }

  .dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 4px;
  }

  .dot.backlog { background: #e2e8f0; }
  .dot.todo { background: #cbd5e1; }
  .dot.in_progress { background: #fbbf24; }
  .dot.in_review { background: #60a5fa; }
  .dot.done { background: #10b981; }
</style>
```

**Acceptance Criteria:**
- ✅ Gantt chart renders all tasks correctly
- ✅ Progress bars show accurate completion %
- ✅ Milestones displayed as diamonds
- ✅ Dependencies shown as arrows (nice-to-have, v2)
- ✅ Mobile-responsive (horizontal scroll)
- ✅ Loading state shown while fetching data

---

### 5.5 Feature: Client Feedback Loop (Comments)

**Epic:** Allow clients to comment on tasks/projects, with AI routing comments to correct team member.

**User Flow:**
```
1. Guest views project timeline
2. Clicks on a task
3. Task detail modal opens
4. Guest types comment and clicks "Post"
5. Comment appears immediately in UI
6. AI determines which team member should be notified
7. Team member receives email notification
8. Team member replies in SYNERGIA or via email
```

**Technical Specifications:**

**Comment Model:**
```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE, -- NULL = comment on project
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Content
  content TEXT NOT NULL,

  -- Threading
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,

  -- Notifications
  mentioned_user_ids TEXT[], -- Users @mentioned in comment
  notified_user_ids TEXT[], -- Users AI decided to notify

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comments_project_id ON comments(project_id);
CREATE INDEX idx_comments_task_id ON comments(task_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_parent_comment_id ON comments(parent_comment_id);
```

**Create Comment API:**
```typescript
// src/routes/api/comments/+server.ts

export async function POST({ request, locals }) {
  const { projectId, taskId, content, parentCommentId } = await request.json()

  // Validate schema
  const schema = z.object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid().optional(),
    content: z.string().min(1).max(10000),
    parentCommentId: z.string().uuid().optional()
  })
  const validated = schema.parse({ projectId, taskId, content, parentCommentId })

  // Permission check
  if (!await canViewProject(locals.user.id, validated.projectId)) {
    throw error(403, 'Forbidden')
  }

  // Extract @mentions
  const mentionedUsers = await extractMentions(validated.content)

  // AI determines who to notify
  const notifiedUsers = await determineNotificationRecipients(
    validated.projectId,
    validated.taskId,
    validated.content,
    locals.user
  )

  // Create comment
  const comment = await db.insert(comments).values({
    projectId: validated.projectId,
    taskId: validated.taskId,
    userId: locals.user.id,
    content: validated.content,
    parentCommentId: validated.parentCommentId,
    mentionedUserIds: mentionedUsers.map(u => u.id),
    notifiedUserIds: notifiedUsers.map(u => u.id)
  }).returning()[0]

  // Send notifications (async, don't block response)
  Promise.all([
    ...mentionedUsers.map(user => sendCommentNotification(user, comment, 'mention')),
    ...notifiedUsers.map(user => sendCommentNotification(user, comment, 'ai_routed'))
  ])

  // Emit event for WebSocket broadcast
  await emitEvent('comment.created', { comment, projectId: validated.projectId })

  return json(comment)
}

async function determineNotificationRecipients(
  projectId: string,
  taskId: string | null,
  content: string,
  author: User
): Promise<User[]> {
  // Get project team
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      owner: true,
      teamMembers: true
    }
  })

  // If task specified, notify task assignee
  if (taskId) {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { assignee: true }
    })

    if (task.assignee && task.assignee.id !== author.id) {
      return [task.assignee]
    }
  }

  // Otherwise, use AI to determine best recipient
  const teamMembers = [project.owner, ...project.teamMembers]

  const prompt = `
    Comment on project "${project.title}":
    "${content}"

    Team members:
    ${teamMembers.map(m => `- ${m.name} (${m.role})`).join('\n')}

    Who should be notified about this comment? Consider:
    - Comment urgency and sentiment
    - Team member roles and expertise
    - Who would be best suited to respond

    Return JSON: { "notify": ["User Name 1", "User Name 2"], "reasoning": "..." }
  `

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  })

  const result = JSON.parse(response.choices[0].message.content)

  // Match names to actual users
  const notifyUsers = teamMembers.filter(member =>
    result.notify.some(name => member.name.toLowerCase().includes(name.toLowerCase()))
  )

  // Always include project owner as fallback
  if (notifyUsers.length === 0) {
    notifyUsers.push(project.owner)
  }

  return notifyUsers
}

async function sendCommentNotification(user: User, comment: Comment, type: 'mention' | 'ai_routed') {
  const project = await getProject(comment.projectId)
  const commenter = await getUser(comment.userId)

  await sendEmail({
    to: user.email,
    subject: type === 'mention'
      ? `${commenter.name} mentioned you in ${project.title}`
      : `New comment on ${project.title}`,
    template: 'comment-notification',
    data: {
      commenterName: commenter.name,
      commenterAvatar: commenter.avatarUrl,
      comment: comment.content,
      projectTitle: project.title,
      projectUrl: `${process.env.PUBLIC_URL}/projects/${project.id}`,
      replyUrl: `${process.env.PUBLIC_URL}/projects/${project.id}#comment-${comment.id}`
    }
  })

  // Also create in-app notification
  await db.insert(notifications).values({
    userId: user.id,
    type: type === 'mention' ? 'mention' : 'comment',
    title: type === 'mention'
      ? `${commenter.name} mentioned you`
      : `New comment from ${commenter.name}`,
    content: comment.content,
    linkTo: `/projects/${project.id}#comment-${comment.id}`
  })
}
```

**Frontend Component:**
```svelte
<!-- src/lib/components/client-portal/CommentThread.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { websocketStore } from '$lib/stores/websocket'

  interface Props {
    projectId: string
    taskId?: string
  }

  let { projectId, taskId }: Props = $props()

  let comments = $state<Comment[]>([])
  let newCommentText = $state('')
  let isSubmitting = $state(false)

  onMount(async () => {
    // Fetch initial comments
    const response = await fetch(`/api/comments?projectId=${projectId}${taskId ? `&taskId=${taskId}` : ''}`)
    comments = await response.json()

    // Subscribe to real-time updates
    const ws = websocketStore.connect(projectId)
    ws.on('comment.created', (data) => {
      if (data.projectId === projectId && (!taskId || data.comment.taskId === taskId)) {
        comments = [...comments, data.comment]
      }
    })
  })

  async function handleSubmit(e: Event) {
    e.preventDefault()

    if (!newCommentText.trim()) return

    isSubmitting = true

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          taskId,
          content: newCommentText
        })
      })

      const comment = await response.json()
      comments = [...comments, comment]
      newCommentText = ''
    } catch (error) {
      console.error('Failed to post comment:', error)
      alert('Failed to post comment. Please try again.')
    } finally {
      isSubmitting = false
    }
  }
</script>

<div class="comment-thread">
  <h3>Comments ({comments.length})</h3>

  <div class="comments-list">
    {#each comments as comment}
      <div class="comment">
        <img src={comment.user.avatarUrl} alt={comment.user.name} class="avatar" />
        <div class="comment-body">
          <div class="comment-header">
            <strong>{comment.user.name}</strong>
            {#if comment.user.isGuest}
              <span class="badge">Client</span>
            {/if}
            <span class="timestamp">{formatRelativeTime(comment.createdAt)}</span>
          </div>
          <p class="comment-content">{comment.content}</p>
        </div>
      </div>
    {/each}
  </div>

  <form onsubmit={handleSubmit} class="comment-form">
    <textarea
      bind:value={newCommentText}
      placeholder="Add a comment..."
      rows="3"
      disabled={isSubmitting}
    ></textarea>
    <button type="submit" disabled={isSubmitting || !newCommentText.trim()}>
      {isSubmitting ? 'Posting...' : 'Post Comment'}
    </button>
  </form>
</div>

<style>
  .comment-thread {
    padding: 1.5rem;
    background: white;
    border-radius: 8px;
  }

  .comments-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 1rem 0;
    max-height: 400px;
    overflow-y: auto;
  }

  .comment {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 6px;
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    background: #3b82f6;
    color: white;
    font-size: 0.75rem;
    border-radius: 12px;
  }

  .comment-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  textarea {
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-family: inherit;
    resize: vertical;
  }

  button {
    align-self: flex-end;
    padding: 0.5rem 1rem;
    background: #000;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
```

**Acceptance Criteria:**
- ✅ Users can post comments on projects and tasks
- ✅ Comments appear in real-time for all viewers
- ✅ AI correctly identifies who to notify (>80% accuracy in testing)
- ✅ Email notifications sent within 30 seconds
- ✅ @mentions work correctly
- ✅ Thread nesting works (reply to comment)

---

## 6. Performance Engine

*[Due to length constraints, I'm summarizing the remaining sections. The full specification would include similar depth for Performance Engine, Collaboration Hub, Strategic Orchestration, and all remaining sections]*

### 6.1 Feature Overview

**Purpose:** Capability-first measurement system that tracks team growth, not just task completion.

**Key Features:**
- Capability detection from task completion, code commits, peer feedback
- Growth trajectory visualization (skill proficiency over time)
- Team health metrics (burnout detection, stagnation alerts)
- AI recommendations for project staffing based on capabilities
- Skills gap analysis

---

## 7. Collaboration Hub

### 7.1 Feature Overview

**Purpose:** Native video/audio with AI meeting assistant, plus unified communication timeline.

**Key Features:**
- LiveKit-powered video conferencing (10-50 participants)
- Live transcription via Deepgram
- AI meeting assistant (pre-meeting brief, action item detection, summary generation)
- Email integration (Nylas)
- Slack integration (Bolt.js)
- CRM bi-directional sync (Merge.dev)
- Unified timeline showing all communication in one view

---

## 8. Strategic Orchestration

### 8.1 Feature Overview

**Purpose:** AI Strategic PM (Constellation) that understands Three Horizons planning and optimizes resource allocation.

**Key Features:**
- Three Horizons planning framework
- Constellation AI PM (natural language strategic queries)
- Resource allocation optimizer (recommend optimal team composition)
- Scenario modeling ("What if we hire 2 engineers?")
- Portfolio optimization for multi-project teams

---

# Part 3: APIs, Data Models, & Integrations

## 9. REST API Specification

### 9.1 API Design Principles

**1. RESTful Conventions:**
- GET: Retrieve resources
- POST: Create resources
- PUT/PATCH: Update resources
- DELETE: Delete resources

**2. URL Structure:**
```
/api/{resource}              # Collection
/api/{resource}/{id}         # Single item
/api/{resource}/{id}/{sub}   # Sub-resource
```

**3. Response Format:**
```json
{
  "data": { /* resource */ },
  "error": null,
  "meta": {
    "timestamp": "2025-10-27T12:00:00Z",
    "requestId": "req_abc123"
  }
}
```

**4. Error Format:**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this resource",
    "details": {}
  }
}
```

---

### 9.2 Core Endpoints

*[Full API reference would include 50+ endpoints - here's a sample]*

**Projects API:**

```
GET    /api/projects                    # List user's projects
POST   /api/projects                    # Create project
GET    /api/projects/{id}               # Get project details
PATCH  /api/projects/{id}               # Update project
DELETE /api/projects/{id}               # Delete project
GET    /api/projects/{id}/timeline      # Get Gantt chart data
POST   /api/projects/{id}/invite        # Invite guest to project
```

**Comments API:**

```
GET    /api/comments?projectId={id}     # List comments
POST   /api/comments                    # Create comment
PATCH  /api/comments/{id}               # Edit comment
DELETE /api/comments/{id}               # Delete comment
```

**Performance API:**

```
GET    /api/performance/capabilities?userId={id}  # Get user capabilities
GET    /api/performance/team-overview?teamId={id} # Team metrics
POST   /api/performance/analyze-task              # Trigger capability detection
GET    /api/performance/recommendations?projectId={id} # Get staffing recommendations
```

---

## 10. WebSocket API

### 10.1 Connection Protocol

```typescript
// Connect
const ws = new WebSocket('wss://synergia.ai/ws')

// Authenticate
ws.send(JSON.stringify({
  type: 'auth',
  token: sessionToken
}))

// Subscribe to room
ws.send(JSON.stringify({
  type: 'subscribe',
  room: 'project:abc123'
}))

// Receive events
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)

  switch (message.type) {
    case 'comment.created':
      // Handle new comment
      break
    case 'transcript':
      // Handle live transcript
      break
    case 'task.updated':
      // Handle task update
      break
  }
}
```

---

## 11. Integration Architecture

### 11.1 Integration Patterns

**Pattern 1: OAuth-based (Linear, Slack, Gmail)**
```
1. User clicks "Connect {Service}"
2. Redirect to OAuth provider
3. Provider redirects back with code
4. Exchange code for access token
5. Store token in database
6. Use token for API calls
```

**Pattern 2: API Key (OpenAI, Deepgram)**
```
1. Store API key in environment variables
2. Include in HTTP headers for all requests
3. Rotate keys monthly for security
```

**Pattern 3: Webhook Listeners (Linear, Stripe)**
```
1. Register webhook URL with provider
2. Provider POSTs events to our endpoint
3. Verify webhook signature
4. Process event async (don't block response)
```

---

# Part 4: Security, Compliance, & Operations

## 13. Security Architecture

### 13.1 Security Layers

**1. Network Security:**
- HTTPS only (redirect HTTP → HTTPS)
- TLS 1.3 minimum
- HSTS headers (force HTTPS)
- CDN with DDoS protection (Cloudflare)

**2. Authentication Security:**
- bcrypt password hashing (12 rounds)
- Session tokens (cryptographically random)
- OAuth 2.0 for 3rd-party auth
- Magic links (single-use, 24h expiry)

**3. Authorization Security:**
- Role-based access control (RBAC)
- Row-level security (users can only access their data)
- API rate limiting (100 requests/minute per IP)

**4. Data Security:**
- PostgreSQL encryption at rest
- Pinecone encryption at rest
- S3 server-side encryption
- Database backups encrypted

---

## 14. Compliance Requirements

**GDPR:**
- User data deletion endpoint (`DELETE /api/users/me`)
- Data export endpoint (`GET /api/users/me/export`)
- Cookie consent banner
- Privacy policy and terms of service

**SOC 2 Type II (future):**
- Security audits (annual)
- Penetration testing (quarterly)
- Employee background checks
- Incident response plan

---

## 15. Testing & QA

### 15.1 Testing Strategy

**Unit Tests:**
- All business logic functions
- Utility functions
- Target: 80% code coverage

**Integration Tests:**
- API endpoints end-to-end
- Database queries
- External API integrations (mocked)

**E2E Tests:**
- Critical user flows (signup, create project, invite guest)
- Playwright for browser automation
- Run on every PR

---

## 16. Deployment & DevOps

### 16.1 Deployment Pipeline

```
1. Developer pushes to feature branch
2. GitHub Actions runs tests
3. If tests pass, create PR
4. Code review required
5. Merge to main
6. Vercel auto-deploys to production
7. Sentry monitors for errors
```

---

# Part 5: Appendices

## 17. Complete Database Schema

*[Full schema with all 31 tables - reference to Section 3]*

---

## 18. API Endpoint Reference

*[Complete list of 50+ API endpoints with request/response examples]*

---

## 19. Error Codes & Handling

**HTTP Status Codes:**
- 200: Success
- 201: Created
- 400: Bad Request (validation error)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (not authorized)
- 404: Not Found
- 429: Rate Limit Exceeded
- 500: Internal Server Error

**Custom Error Codes:**
```typescript
enum ErrorCode {
  INVALID_TOKEN = 'INVALID_TOKEN',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTEGRATION_ERROR = 'INTEGRATION_ERROR',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR'
}
```

---

## 20. Glossary

**Agent:** Specialized AI persona with custom system prompt and temperature (e.g., Code Expert, Creative Brainstormer)

**Capability:** Skill + proficiency level + growth trajectory (e.g., "React - Advanced (85/100), +15% in 3 months")

**Constellation:** AI Strategic PM that understands Three Horizons planning and provides strategic recommendations

**Guest:** Client user with read-only access to assigned projects (authenticated via magic link)

**Horizon:** Planning timeframe in Three Horizons framework (H1: 0-12 months, H2: 1-3 years, H3: 3+ years)

**Magic Link:** Single-use authentication URL for guest users (expires in 24 hours)

**Proficiency:** 0-100 score representing skill level (0: No experience, 50: Competent, 100: Expert)

**Unified Timeline:** Chronological view of all communication (emails, Slack, meetings, tasks, comments) in one place

---

**End of Functional Specification**

---

**Next Steps:**
1. Engineers review specification and provide feedback
2. Break down features into development tickets (Linear issues)
3. Begin Month 1 implementation (Client Portal)

**Document Maintenance:**
- Update after each feature ships
- Version control in git
- Review quarterly for accuracy