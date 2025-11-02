<div align="center">
  <img src="https://cdn.weaveai.cc/weaveai-logo-dark.png" width="260" alt="WeaveAI Logo" />
</div>

# WeaveAI

A comprehensive multimodal AI platform that provides unified access to 65+ AI models from 9 different providers. Seamlessly switch between text, image, and video generation models while maintaining full conversation history and file management.

## Features

### 🤖 **AI Model Support (65+ Models)**

- **Text Generation**: 32+ models via OpenRouter (Claude, GPT, Gemini, Llama, DeepSeek, Grok, Qwen, Kimi, Mistral, GLM)
- **Image Generation**: 25+ models (DALL-E, GPT Image, Imagen, Grok-2-Image, Stable Diffusion, FLUX, Kling, Luma Photon, Alibaba Wan)
- **Video Generation**: 8+ models (Google Veo, Alibaba Wan, Kling AI, Luma Ray)
- **Image Editing**: Advanced editing with OpenAI models
- **Function Calling**: 2 tools (Deep Research, Think Longer) with 32+ model support

### 💬 **Advanced Chat Features**

- **Multimodal Conversations**: Upload images and text files in conversations
- **Streaming Support**: Real-time responses (backend implemented)
- **Chat History Management**: Full CRUD operations with persistent storage
- **Model Switching**: Change models mid-conversation with protection dialogs
- **URL-Based Routing**: Clean URLs for individual chats (`/chat/{id}`)

### 🎨 **Creative Capabilities**

- **Image Generation**: Create images with natural language prompts
- **Video Generation**: Generate videos up to 1 minute with customizable settings
- **Image Editing**: Modify existing images with AI assistance
- **File Management**: Upload, store, and manage generated content

### 🔐 **Authentication & User Management**

- **Authentication**: Complete Auth.js integration with email/password + OAuth (Google, Apple, X, Facebook)
- **Email Verification**: 24-hour token system with automatic social auth verification
- **Password Reset**: Secure token-based password reset with rate limiting
- **Account Settings**: 5 dedicated pages (Profile, Account, Billing, Usage, Privacy)
- **Guest Access**: Limited access for non-logged users (10 messages, restricted models)
- **Responsive Design**: Mobile-friendly UI with collapsible sidebar
- **Dark/Light Theme**: Complete theming with automatic preference detection
- **Internationalization**: English and German language support

### 💳 **Billing & Subscriptions**

- **Stripe Integration**: Complete checkout and subscription management
- **Multi-Tier Plans**: Configurable pricing plans via admin dashboard
- **Usage Tracking**: Advanced tracking with dual reset schedules (12-hour for free, billing period for paid)
- **Payment Management**: User-facing billing portal and payment history
- **Admin Controls**: Subscription management and analytics

### 🛡️ **Security Features**

- **Comprehensive Security Stack**: 9-layer security architecture
  - DOMPurify XSS prevention
  - Rate limiting & brute force protection
  - Security headers (CSP, HSTS, X-Frame-Options)
  - bcrypt password hashing (12 rounds)
  - Session security hardening
  - Security event monitoring & logging
- **Bot Protection**: Cloudflare Turnstile integration
- **GDPR Compliance**: Marketing consent and secure account deletion

### ⚙️ **Admin Dashboard**

- **User Management**: View, edit, and manage user accounts
- **Analytics**: Visual charts for user growth and subscription metrics
- **System Settings**: Configure AI models, OAuth providers, cloud storage, mailing
- **Billing Management**: Manage pricing plans and view payment history
- **Security Monitoring**: Track security events and system health
- **Demo Mode**: Environment-controlled read-only demonstration mode

### 📁 **File Management & Storage**

- **Cloud Storage**: Cloudflare R2 integration with 3-tier fallback system
- **Local Fallback**: Automatic fallback to local storage
- **Database Tracking**: Complete metadata tracking for all media
- **Admin Configuration**: Visual admin interface for storage settings

## Tech Stack

### Frontend

- **SvelteKit 2.x** with **Svelte 5.x** (Runes mode)
- **TailwindCSS 4.x** for styling
- **shadcn-svelte** component library (powered by bits-ui)
- **Vite** build tool with TypeScript

### Backend & Database

- **PostgreSQL** with **PostgreSQL.js**
- **Drizzle ORM** for database operations
- **Auth.js** for SvelteKit with Drizzle adapter
- **Authentication**: Email/password + OAuth (Google, Apple, X, Facebook)
- **Stripe** for payment processing and subscription management
- **Nodemailer** for transactional emails with SMTP integration

### Cloud Services & Integrations

- **Cloudflare R2**: S3-compatible object storage with 3-tier fallback
- **Cloudflare Turnstile**: Bot protection for registration and forms
- **Stripe Checkout**: Payment processing and billing management

### Additional Tools

- **Paraglide JS**: Internationalization with English and German support
- **LayerChart + D3**: Interactive charts for admin analytics
- **highlight.js**: Code syntax highlighting in chat
- **DOMPurify**: XSS protection and input sanitization

### AI Integration

Multi-provider architecture with direct API access:

#### **OpenRouter Integration (32 Text Models)**

- **Anthropic**: Claude Opus 4, Sonnet 4, Sonnet 3.7, Haiku 3.5
- **OpenAI**: GPT-4.1, GPT-4.1 Mini/Nano, GPT-o3 Mini, GPT-o1, GPT-4o
- **Meta**: Llama 4 Maverick, Llama 4 Scout
- **Google**: Gemini 2.5 Flash Lite/Pro
- **DeepSeek**: R1, V3 (free tiers available)
- **xAI**: Grok 4, Grok 3, Grok 3 Mini
- **Qwen**: Qwen3 Coder, Thinking, Instruct (some free)
- **Kimi**: K2, K2 (free)
- **Mistral**: Nemo, Small 3.2
- **ZAI**: GLM 4.5, GLM 4.5 Air, GLM 4.5 Air (free)

#### **Google Gemini Direct (8 Models)**

- **Image Generation**: Gemini 2.0 Flash Image, Imagen 4/3/Ultra
- **Video Generation**: Veo 3, Veo 2

#### **OpenAI Direct (3 Models)**

- **Image Generation/Editing**: GPT Image 1, DALL-E 3, DALL-E 2

#### **xAI Direct (1 Model)**

- **Image Generation**: Grok-2-Image

#### **Stability AI Direct (6 Models)**

- **Image Generation**: Stable Image Ultra/Core, Stable Diffusion 3.5 (Large, Large Turbo, Medium, Flash)

#### **Black Forest Labs Direct (4 Models)**

- **Image Generation**: FLUX.1 Kontext Pro/Max, FLUX.1.1 Pro/Ultra

#### **Kling AI Direct (3 Models)**

- **Image Generation**: Kling v2
- **Video Generation**: Kling v2 Master, v2.1 Master

#### **Luma Labs Direct (4 Models)**

- **Image Generation**: Photon-1, Photon Flash-1
- **Video Generation**: Ray-2, Ray Flash-2

#### **Alibaba Direct (4 Models)**

- **Image Generation**: Wan 2.2 T2I Flash, Wan 2.2 T2I Plus
- **Video Generation**: Wan 2.2 T2V Plus, Wan 2.2 I2V Plus

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd weaveai
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Configure your `.env` file with the following variables:

   **Core & Database** (Required):

   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/database_name
   AUTH_SECRET=your_auth_secret_key  # Generate with: npx auth secret
   PUBLIC_ORIGIN=https://your-domain.com
   NODE_ENV=production
   ```

   **AI Provider API Keys**:

   ```env
   OPENROUTER_API_KEY=your_openrouter_api_key
   GEMINI_API_KEY=your_google_gemini_api_key
   OPENAI_API_KEY=your_openai_api_key
   XAI_API_KEY=your_xai_api_key
   STABILITYAI_API_KEY=your_stabilityai_api_key
   BFL_API_KEY=your_blackforestlabs_api_key
   ALIBABA_API_KEY=your_alibaba_api_key
   LUMALABS_API_KEY=your_lumalabs_api_key
   KLING_API_ACCESS_KEY=your_kling_api_access_key
   KLING_API_SECRET_KEY=your_kling_api_secret_key
   ```

   **OAuth Providers** (Optional):

   ```env
   AUTH_GOOGLE_ID=your_google_client_id
   AUTH_GOOGLE_SECRET=your_google_client_secret
   AUTH_APPLE_ID=your_apple_client_id
   AUTH_APPLE_SECRET=your_apple_client_secret
   AUTH_TWITTER_ID=your_twitter_client_id
   AUTH_TWITTER_SECRET=your_twitter_client_secret
   AUTH_FACEBOOK_ID=your_facebook_app_id
   AUTH_FACEBOOK_SECRET=your_facebook_app_secret
   ```

   **Stripe Billing**:

   ```env
   PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_key
   STRIPE_SECRET_KEY=sk_test_key
   STRIPE_WEBHOOK_SECRET=whsec_key
   ```

   **SMTP Email Configuration** (Optional - can be configured via admin dashboard):

   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   FROM_EMAIL=noreply@your-domain.com
   FROM_NAME=AI Models Platform
   ```

   **Cloudflare R2 Storage** (Optional - fallback to local storage):

   ```env
   R2_ACCOUNT_ID=your_cloudflare_account_id
   R2_ACCESS_KEY_ID=your_r2_access_key_id
   R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
   R2_BUCKET_NAME=your_r2_bucket_name
   R2_PUBLIC_URL=https://your-bucket.r2.cloudflarestorage.com
   ```

   **Cloudflare Turnstile** (Optional - bot protection):

   ```env
   TURNSTILE_SITE_KEY=your_turnstile_site_key
   TURNSTILE_SECRET_KEY=your_turnstile_secret_key
   ```

   **Demo Mode** (Optional):

   ```env
   DEMO_MODE=false  # Set to 'true' to enable read-only demonstration mode
   ```

4. **Set up the database**

   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## Available Scripts

### Development

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build
```

### Type Checking

```bash
npm run check            # Run type checking once
npm run check:watch      # Run type checking in watch mode
```

### Database Operations

```bash
npm run db:push          # Push schema changes to database
npm run db:migrate       # Run database migrations
npm run db:studio        # Open Drizzle Studio for database management
```

### Internationalization

```bash
npm run machine-translate # Translate i18n messages via Inlang
```

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/                        # shadcn-svelte UI components
│   │   ├── ChatInterface.svelte       # Main chat interface
│   │   ├── ChatSidebar.svelte         # Chat history sidebar
│   │   ├── FileUpload.svelte          # File upload component
│   │   └── chat-state.svelte.ts       # Chat state management
│   ├── ai/
│   │   ├── providers/                 # AI provider implementations
│   │   │   ├── openrouter.ts          # 32 text models
│   │   │   ├── google-gemini.ts       # Image/video generation
│   │   │   ├── openai.ts              # DALL-E, GPT Image
│   │   │   ├── xai.ts                 # Grok-2-Image
│   │   │   ├── stability.ts           # Stable Diffusion
│   │   │   ├── bfl.ts                 # FLUX models
│   │   │   ├── kling.ts               # Kling image/video
│   │   │   ├── lumalabs.ts            # Photon/Ray models
│   │   │   └── alibaba.ts             # Wan image/video
│   │   ├── tools/                     # Function calling tools
│   │   │   ├── deep-research.ts
│   │   │   └── think-longer.ts
│   │   ├── types.ts                   # AI type definitions
│   │   └── index.ts                   # Provider exports
│   ├── server/
│   │   ├── db/                        # Database config & schema
│   │   ├── email.ts                   # Nodemailer service
│   │   ├── email-verification.ts      # Email verification tokens
│   │   ├── password-reset.ts          # Password reset service
│   │   ├── storage.ts                 # Cloudflare R2 integration
│   │   ├── stripe.ts                  # Stripe billing
│   │   ├── usage-tracking.ts          # Usage tracking service
│   │   ├── admin-settings.ts          # Admin configuration
│   │   ├── turnstile.ts               # Bot protection
│   │   ├── rate-limiting.ts           # Rate limiting
│   │   ├── security-headers.ts        # Security headers
│   │   ├── security-monitoring.ts     # Security logging
│   │   ├── session-security.ts        # Session hardening
│   │   └── sys-email-templates/       # Email templates
│   ├── utils/
│   │   ├── sanitization.ts            # XSS prevention
│   │   ├── password-validation.ts     # Password security
│   │   ├── email-validation.ts        # Email validation
│   │   └── error-handling.ts          # Error utilities
│   ├── constants/
│   │   ├── guest-limits.ts            # Guest user config
│   │   └── demo-mode.ts               # Demo mode config
│   └── hooks/                         # Svelte hooks
├── routes/
│   ├── +layout.svelte                 # Root layout
│   ├── +page.svelte                   # New chat interface
│   ├── chat/[id]/                     # Individual chat pages
│   ├── library/                       # Media gallery
│   ├── settings/                      # User settings
│   │   ├── profile/
│   │   ├── account/
│   │   ├── billing/
│   │   ├── usage/
│   │   └── privacy/
│   ├── admin/                         # Admin dashboard
│   │   ├── users/                     # User management
│   │   ├── analytics/                 # Visual analytics
│   │   ├── payments/                  # Payment history
│   │   ├── subscriptions/             # Subscription management
│   │   └── settings/                  # System settings
│   │       ├── general/
│   │       ├── branding/
│   │       ├── oauth-providers/
│   │       ├── ai-models/
│   │       ├── plans/
│   │       ├── payment-methods/
│   │       ├── cloud-storage/
│   │       ├── security/
│   │       └── mailing/
│   ├── login/                         # Authentication
│   ├── register/
│   ├── verify-email/                  # Email verification
│   ├── reset-password/                # Password reset
│   │   └── [token]/
│   ├── checkout/                      # Stripe checkout
│   └── api/                           # API endpoints
│       ├── chat/                      # Text chat
│       ├── chat-multimodal/           # Multimodal chat
│       ├── image-generation/          # Image generation
│       ├── video-generation/          # Video generation
│       ├── image-edit/                # Image editing
│       ├── images/                    # Image management
│       ├── videos/                    # Video management
│       ├── chats/                     # Chat CRUD
│       ├── library/                   # Media library
│       ├── models/                    # Model capabilities
│       ├── admin/                     # Admin APIs
│       ├── stripe/                    # Stripe webhooks
│       ├── billing/                   # Billing management
│       ├── verify-email/[token]/      # Email verification
│       └── delete-account/            # Account deletion
├── paraglide/                         # i18n runtime (auto-generated)
├── static/
│   └── uploads/                       # Local file storage
├── auth.ts                            # Auth.js configuration
└── hooks.server.ts                    # Enhanced middleware
```

## Key Components

### Database Schema

**Authentication Tables**:

- **users**: User accounts with planTier, subscriptionStatus, stripeCustomerId, emailVerified timestamp, marketingConsent
- **accounts**: OAuth provider connections
- **sessions**: Active user sessions
- **verificationTokens**: 24-hour email verification tokens
- **passwordResetTokens**: 24-hour password reset tokens with rate limiting
- **authenticators**: WebAuthn authenticator credentials

**Content Tables**:

- **chats**: Full conversation history with JSON message storage, multimodal support, pinning
- **images**: Image metadata with cloud/local storage tracking, MIME types, user/chat links
- **videos**: Video metadata with storage location, file sizes, timestamps

**Billing Tables**:

- **pricingPlans**: Configurable subscription plans with usage limits
- **subscriptions**: Stripe subscription data with status tracking
- **paymentHistory**: Complete payment audit trail
- **usageTracking**: Usage quotas with 12-hour reset support via lastResetAt field

**Admin Tables**:

- **adminSettings**: Encrypted system configuration (SMTP, storage, security settings)

**Features**:

- GDPR compliance (marketingConsent field)
- Cascade deletes for data integrity
- Performance indexes on createdAt fields
- Automatic timestamps

### UI Features

- **Chat Interface**: Full-featured chat with markdown rendering, syntax highlighting, and guest user restrictions
- **Sidebar**: Chat history navigation with search, pinning, and management
- **Model Selector**: Height-limited dropdown with provider grouping, capability indicators, and locked state for guests
- **File Upload**: Drag-and-drop interface for images and documents
- **Media Library**: Paginated gallery for viewing and managing generated images/videos at `/library`
- **User Settings**: 5 dedicated settings pages (Profile, Account, Billing, Usage, Privacy)
- **Admin Dashboard**: Comprehensive admin interface with analytics charts, user management, and system configuration
- **Responsive Layout**: Mobile-optimized with collapsible sidebar
- **Theme Toggle**: Dark/light mode with system preference detection
- **Internationalization**: Language switcher for English and German support

### Model Capabilities

Comprehensive capability system:

- **Text Generation**: Conversational AI, coding assistance, analysis
- **Image Generation**: Create images from text prompts with various styles
- **Video Generation**: Generate short videos with customizable duration and resolution
- **Image Editing**: Modify existing images with AI assistance
- **Multimodal**: Handle mixed text, image, and file inputs
- **Streaming**: Real-time response generation (backend ready)

## Development Notes

- Uses **Svelte 5 Runes mode** exclusively (`$state`, `$derived`, `$effect`)
- Follows **shadcn-svelte** component patterns for consistency
- Database operations use **Drizzle ORM** with PostgreSQL.js
- **TailwindCSS 4.x** with extensive CSS custom properties for theming
- TypeScript throughout with strict type checking

## Current Status

### ✅ Completed Features

**Core Infrastructure**:

- SvelteKit 2.x with Svelte 5 Runes mode, TypeScript, TailwindCSS 4.x
- PostgreSQL with Drizzle ORM and comprehensive database schema
- 344 TypeScript/Svelte files with strict type checking

**AI Integration** (65+ Models):

- 32+ text models via OpenRouter with streaming backend
- 25+ image generation models across 7 providers
- 8+ video generation models
- Image editing capabilities (OpenAI)
- Function calling backend (2 tools: Deep Research, Think Longer)
- Multimodal conversations with file uploads

**Authentication & Security**:

- Complete Auth.js integration with email/password + 4 OAuth providers (Google, Apple, X, Facebook)
- Email verification system (24-hour tokens, automatic social auth verification)
- Password reset flow (secure tokens, rate limiting)
- 9-layer comprehensive security stack (DOMPurify, rate limiting, security headers, bcrypt, session hardening, monitoring)
- Cloudflare Turnstile bot protection
- GDPR compliance with marketing consent and secure deletion

**User Management**:

- 5 dedicated account settings pages (Profile, Account, Billing, Usage, Privacy)
- Guest user access system (10 message limit, restricted models, conversion-focused UI)
- Internationalization (English/German via Paraglide JS)

**Billing & Subscriptions**:

- Complete Stripe integration (checkout, webhooks, portal)
- Multi-tier configurable pricing plans
- Advanced usage tracking with dual reset schedules (12-hour free, billing period paid)
- Payment history and subscription management
- Admin billing dashboard

**Admin Dashboard**:

- User management with detailed views
- Visual analytics (LayerChart + D3) for growth and subscriptions
- System settings (AI models, OAuth, storage, security, mailing)
- Pricing plan management
- Payment history tracking
- Demo mode (environment-controlled read-only access)

**Storage & Media**:

- Cloudflare R2 cloud storage with 3-tier fallback system
- Local storage fallback
- Media library with pagination at `/library`
- Complete metadata tracking for images/videos

**Email System**:

- Nodemailer transactional emails
- Template-based system with variable substitution
- Admin-configurable SMTP settings
- Welcome emails and password reset notifications

**Chat Features**:

- Full CRUD operations for chats
- Chat history with pinning support
- URL routing (`/chat/{id}`)
- Model switching mid-conversation
- Message storage with multimodal support

### 🚧 In Progress

- Frontend streaming UI for real-time message display
- Function calling UI integration (backend complete)
- Advanced chat features (search, folders, export)

### 📋 Planned

- Testing framework (unit, integration, E2E)
- Performance optimizations (virtualization, lazy loading)
- Additional AI providers (RunwayML, Pika Labs, ElevenLabs)
- Audio generation capabilities
- Enhanced analytics and reporting

## API Endpoints

### Chat & AI Generation

- `POST /api/chat` - Text-based conversations with streaming support and guest validation
- `POST /api/chat-multimodal` - Multimodal conversations with file uploads
- `POST /api/image-generation` - Generate images with 25+ models
- `POST /api/video-generation` - Generate videos with 8+ models
- `POST /api/image-edit` - Edit existing images with OpenAI models
- `GET /api/models` - List all models with capabilities and guest/demo restrictions

### Chat Management

- `GET /api/chats` - List user's chat history
- `GET /api/chats/[id]` - Retrieve specific chat with messages
- `PUT /api/chats/[id]` - Update chat (rename, etc.)
- `DELETE /api/chats/[id]` - Delete chat and associated content
- `POST /api/chats/[id]/pin` - Pin/unpin chat for quick access

### Media & File Management

- `POST /api/images` - Upload images to cloud/local storage
- `GET /api/images/[id]` - Retrieve generated images
- `GET /api/videos/[id]` - Retrieve generated videos
- `GET /api/library` - Paginated media gallery with filters
- `POST /api/files/text` - Extract text from uploaded files

### User Management & Authentication

- `GET /api/verify-email/[token]` - Verify email with 24-hour token
- `POST /api/delete-account` - Secure account deletion with GDPR compliance
- Form actions in `/settings/account` for email verification resend
- Form actions in `/reset-password` for password reset flow

### Billing & Subscriptions (Stripe)

- `POST /api/stripe/create-checkout-session` - Create Stripe checkout
- `POST /api/stripe/webhook` - Handle Stripe webhook events
- `POST /api/stripe/create-portal-session` - Customer billing portal
- `GET /api/stripe/session-status` - Check checkout session status
- `POST /api/stripe/update-subscription` - Modify subscription
- `GET /api/billing` - User billing information and history
- `GET /api/pricing-plans` - Available pricing plans

### Admin APIs (Protected)

- `GET /api/admin/analytics` - User growth and subscription metrics
- `GET /api/admin/plans/*` - Manage pricing plans (CRUD operations)
- `POST /api/admin/seed-pricing-plans` - Seed initial pricing plans
- `POST /api/admin/sync-subscriptions` - Sync Stripe subscriptions with database
- Form actions in `/admin/settings/*` for system configuration (OAuth, AI models, storage, security, mailing)

## Security Best Practices

This project implements a comprehensive 9-layer security architecture:

### Security Layers

1. **Input Sanitization & XSS Prevention** (`src/lib/utils/sanitization.ts`)

   - DOMPurify integration for HTML sanitization
   - Context-aware sanitization for different input types
   - Email and error message sanitization

2. **Enhanced Password Security** (`src/lib/utils/password-validation.ts`)

   - OWASP and NIST compliant password policies
   - bcrypt hashing with 12 rounds
   - Common password detection

3. **RFC-Compliant Email Validation** (`src/lib/utils/email-validation.ts`)

   - Full RFC 5322 compliance
   - Disposable email detection
   - Suspicious pattern analysis

4. **Rate Limiting & Brute Force Protection** (`src/lib/server/rate-limiting.ts`)

   - Progressive delays with exponential backoff
   - Per-operation limits (login: 5/15min, password reset: 3/hour, email verification: 6/hour)
   - IP-based tracking

5. **Bot Protection** (`src/lib/server/turnstile.ts`)

   - Cloudflare Turnstile integration
   - Admin-configurable with environment fallback
   - Registration endpoint protection

6. **Security Headers Middleware** (`src/lib/server/security-headers.ts`)

   - Content Security Policy (CSP)
   - HTTP Strict Transport Security (HSTS)
   - X-Frame-Options, X-Content-Type-Options
   - Referrer Policy

7. **Session Security Hardening** (`src/lib/server/session-security.ts`)

   - Secure cookies (httpOnly, sameSite, secure)
   - Production cookie prefixes (**Secure-, **Host-)
   - JWT encryption
   - CSRF protection

8. **Security Event Monitoring** (`src/lib/server/security-monitoring.ts`)

   - 25+ security event types tracked
   - Data masking for sensitive information
   - Alert thresholds for suspicious activity
   - Statistical analysis of security events

9. **Standardized Error Handling** (`src/lib/utils/error-handling.ts`)
   - Generic error messages to prevent information disclosure
   - Consistent response format
   - Sanitized error logging

### Additional Security Features

- SQL injection prevention via Drizzle ORM parameterized queries
- Encrypted storage for sensitive admin settings
- HTTPS enforcement in production
- Cascade deletes for data integrity
- Automatic session cleanup

### Security Monitoring

Access security events and analytics:

```typescript
import { securityMonitor } from "$lib/server/security-monitoring";

// Get recent security events
const events = securityMonitor.getRecentEvents(100, "login_failure");

// Get security statistics
const stats = securityMonitor.getSecurityStats(24); // Last 24 hours
```

### Security Checklist

**Pre-Deployment**:

- [ ] Verify all environment variables are set
- [ ] Confirm HTTPS is configured in production
- [ ] Test rate limiting functionality
- [ ] Validate OAuth provider configurations
- [ ] Review security header implementation

**Post-Deployment**:

- [ ] Monitor security event logs
- [ ] Review authentication metrics
- [ ] Test password reset flows
- [ ] Verify email verification works
- [ ] Check session timeout behavior

**Regular Maintenance**:

- [ ] Review security logs weekly
- [ ] Update dependencies monthly
- [ ] Audit authentication flows quarterly
- [ ] Review and update security policies annually

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development Guidelines

### Code Style & Architecture

- **Svelte 5 Runes Mode**: Use `$state`, `$derived`, `$effect` exclusively (no legacy stores)
- **TypeScript**: Maintain strict mode compliance across all files
- **Component Library**: Follow shadcn-svelte patterns for consistency
- **Database**: Use Drizzle ORM with parameterized queries for security
- **State Management**: Import from `$app/state` instead of `$app/stores`

### Security Requirements

- Always sanitize user input using utilities from `src/lib/utils/sanitization.ts`
- Use standardized error handling from `src/lib/utils/error-handling.ts`
- Log security events using SecurityLogger for authentication operations
- Validate sessions using `validateSession` for protected routes
- Never expose sensitive information in error messages

### Internationalization

- Use Paraglide JS message functions: `m['category.key']()`
- Structure messages into logical categories
- Test translations in both English and German

### Testing & Documentation

- Test all AI integrations thoroughly across providers
- Document new API endpoints in this README
- Add inline comments for complex business logic
- Update CLAUDE.md for significant architectural changes

### Performance Considerations

- Use session caching to prevent N+1 queries
- Implement proper indexes for database queries
- Optimize component re-renders with Svelte 5 fine-grained reactivity
- Consider lazy loading for large components

## License

This project is licensed under the MIT License - see the LICENSE file for details.
