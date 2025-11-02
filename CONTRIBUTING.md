# Contributing to WeaveAI Enterprise

First off, thank you for considering contributing to WeaveAI Enterprise! It's people like you that make this project such a great tool.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

### Our Pledge

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

## Getting Started

### Prerequisites
- Node.js 20+ installed
- PostgreSQL 15+ or Neon account
- Git installed
- Code editor (VS Code recommended)

### Local Setup

1. **Fork the repository**
   ```bash
   # Click "Fork" button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/weaveai-enterprise.git
   cd weaveai-enterprise
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/weaveai-enterprise.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

6. **Initialize database**
   ```bash
   npm run db:push
   ```

7. **Start development server**
   ```bash
   npm run dev
   ```

## Development Process

### 1. Create a Branch

Always create a new branch for your work:

```bash
# Update main branch
git checkout main
git pull upstream main

# Create new branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### Branch Naming Convention
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests
- `chore/` - Maintenance tasks

Examples:
- `feature/chat-folders`
- `fix/stripe-webhook-handling`
- `docs/api-documentation`

### 2. Make Changes

- Write clear, commented code
- Follow our [coding standards](#coding-standards)
- Test your changes thoroughly
- Update documentation if needed

### 3. Test Your Changes

```bash
# Run type checking
npm run check

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format
```

### 4. Commit Your Changes

Follow our [commit message guidelines](#commit-messages):

```bash
git add .
git commit -m "feat: add folder organization for chats"
```

### 5. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 6. Create Pull Request

- Go to your fork on GitHub
- Click "Compare & pull request"
- Fill out the PR template
- Link any related issues

## Coding Standards

### TypeScript

**Use strict typing:**
```typescript
// ✅ Good
function getUserById(id: string): Promise<User | null> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

// ❌ Bad
function getUserById(id: any): Promise<any> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}
```

**Avoid `any` type:**
```typescript
// ✅ Good
interface ApiResponse<T> {
  data: T;
  error?: string;
}

// ❌ Bad
function handleResponse(response: any) {
  // ...
}
```

### Svelte Components

**Use Svelte 5 Runes:**
```svelte
<script lang="ts">
  // ✅ Good - Svelte 5 Runes
  let count = $state(0);
  let doubled = $derived(count * 2);

  function increment() {
    count++;
  }
</script>

<!-- ❌ Bad - Svelte 4 style (deprecated) -->
<script lang="ts">
  import { writable } from 'svelte/store';

  let count = writable(0);
</script>
```

**Component structure:**
```svelte
<script lang="ts">
  // 1. Imports
  import { Button } from '$lib/components/ui';
  import { userStore } from '$lib/stores';

  // 2. Props
  interface Props {
    title: string;
    onClick?: () => void;
  }
  let { title, onClick }: Props = $props();

  // 3. Local state
  let isLoading = $state(false);

  // 4. Derived state
  let displayTitle = $derived(title.toUpperCase());

  // 5. Functions
  async function handleClick() {
    isLoading = true;
    await onClick?.();
    isLoading = false;
  }
</script>

<!-- Template -->
<div class="component">
  <h2>{displayTitle}</h2>
  <Button {onclick}={handleClick} disabled={isLoading}>
    {isLoading ? 'Loading...' : 'Click me'}
  </Button>
</div>

<!-- Styles -->
<style>
  .component {
    /* Prefer TailwindCSS classes in template */
    /* Only use <style> for truly component-specific styles */
  }
</style>
```

### File Structure

**Organize by feature:**
```
src/lib/
├── server/
│   ├── services/
│   │   └── chat/
│   │       ├── chat.service.ts
│   │       ├── message.service.ts
│   │       └── index.ts
│   └── repositories/
│       └── chat.repository.ts
```

**Index files for exports:**
```typescript
// src/lib/components/chat/index.ts
export { default as ChatInterface } from './ChatInterface.svelte';
export { default as ChatSidebar } from './ChatSidebar.svelte';
export { default as ChatMessage } from './ChatMessage.svelte';
```

### Naming Conventions

**Files:**
- Components: `PascalCase.svelte` (e.g., `ChatInterface.svelte`)
- Services: `kebab-case.service.ts` (e.g., `user-auth.service.ts`)
- Repositories: `kebab-case.repository.ts` (e.g., `user.repository.ts`)
- Utilities: `kebab-case.ts` (e.g., `date-formatter.ts`)

**Variables:**
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `MAX_RETRIES`)
- Variables: `camelCase` (e.g., `userName`)
- Private properties: `_camelCase` (e.g., `_internalState`)

**Functions:**
- Functions: `camelCase` (e.g., `getUserById`)
- Classes: `PascalCase` (e.g., `UserService`)
- Types/Interfaces: `PascalCase` (e.g., `UserProfile`)

### Comments

**Write meaningful comments:**
```typescript
// ✅ Good - Explains why
// Use exponential backoff to avoid overwhelming the API during high error rates
const retryDelay = Math.min(1000 * Math.pow(2, attempt), 30000);

// ❌ Bad - States the obvious
// Multiply 1000 by 2 to the power of attempt
const retryDelay = 1000 * Math.pow(2, attempt);
```

**Document complex logic:**
```typescript
/**
 * Calculates prorated subscription amount when upgrading/downgrading.
 *
 * Takes into account:
 * - Days remaining in current billing period
 * - Difference between old and new plan prices
 * - Credits from unused time on current plan
 *
 * @param currentPlan - User's current subscription plan
 * @param newPlan - Plan user wants to switch to
 * @param daysRemaining - Days left in current billing period
 * @returns Amount to charge (or credit if negative)
 */
function calculateProration(
  currentPlan: Plan,
  newPlan: Plan,
  daysRemaining: number
): number {
  // Implementation...
}
```

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

### Examples

```bash
# Simple feature
git commit -m "feat: add chat folder organization"

# Bug fix with scope
git commit -m "fix(auth): prevent duplicate email verification emails"

# Breaking change
git commit -m "feat(api)!: change chat endpoint response format

BREAKING CHANGE: The /api/chats endpoint now returns data in a different format.
See migration guide in docs/migrations/v2.md"

# With body and footer
git commit -m "feat(billing): add proration for plan changes

- Calculate prorated amount based on days remaining
- Credit unused time from current plan
- Apply credit to next invoice

Closes #123"
```

### Rules

1. **Use imperative mood**: "add feature" not "added feature"
2. **No period at the end**: "feat: add feature" not "feat: add feature."
3. **Limit subject to 50 characters**
4. **Wrap body at 72 characters**
5. **Reference issues**: Use "Closes #123" or "Fixes #456"

## Pull Request Process

### Before Submitting

- [ ] Code follows our style guidelines
- [ ] Self-review performed
- [ ] Comments added for complex logic
- [ ] Documentation updated (if needed)
- [ ] Tests added/updated and passing
- [ ] Type checking passes (`npm run check`)
- [ ] No linting errors (`npm run lint`)

### PR Title

Follow commit message convention:
```
feat: add chat folder organization
fix: resolve Stripe webhook race condition
docs: update API documentation
```

### PR Description

Use this template:

```markdown
## Description
Brief description of what this PR does.

## Motivation
Why is this change needed? What problem does it solve?

## Changes
- List of changes made
- Another change
- One more change

## Testing
How was this tested?

## Screenshots (if applicable)
Add screenshots to demonstrate UI changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Migrations provided (if needed)

## Related Issues
Closes #123
Relates to #456
```

### Review Process

1. **Automated checks must pass**:
   - Type checking
   - Linting
   - Tests
   - Build

2. **Code review**:
   - At least one approval required
   - Address all feedback
   - Discussion encouraged

3. **Merge**:
   - Squash commits (for cleaner history)
   - Update CHANGELOG.md (for significant changes)

## Testing

### Unit Tests

Test individual functions and services:

```typescript
// tests/unit/services/user.service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { UserService } from '$lib/server/services/user.service';

describe('UserService', () => {
  it('should throw error if user not found', async () => {
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(null)
    };
    const service = new UserService(mockRepo);

    await expect(service.getUser('non-existent')).rejects.toThrow('User not found');
  });
});
```

### Integration Tests

Test API endpoints:

```typescript
// tests/integration/api/chats.test.ts
import { describe, it, expect } from 'vitest';
import { createAuthenticatedRequest } from '../helpers';

describe('POST /api/v1/chats', () => {
  it('should create new chat', async () => {
    const response = await createAuthenticatedRequest()
      .post('/api/v1/chats')
      .send({ title: 'New Chat' });

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty('id');
  });
});
```

### E2E Tests

Test user flows:

```typescript
// tests/e2e/signup.test.ts
import { test, expect } from '@playwright/test';

test('user can sign up', async ({ page }) => {
  await page.goto('/register');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'SecurePass123!');
  await page.click('button[type=submit]');

  await expect(page).toHaveURL('/dashboard');
});
```

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- user.service.test.ts

# Watch mode
npm test -- --watch

# Coverage
npm run test:coverage
```

## Documentation

### Code Documentation

- **TSDoc for functions/classes**:
```typescript
/**
 * Uploads a file to cloud storage.
 *
 * @param file - File to upload
 * @param options - Upload options
 * @returns URL of uploaded file
 * @throws {StorageError} If upload fails
 */
async function uploadFile(
  file: File,
  options: UploadOptions
): Promise<string> {
  // Implementation
}
```

### README Updates

- Keep README.md up to date
- Add new features to feature list
- Update screenshots if UI changes
- Update installation steps if needed

### API Documentation

- Document new endpoints in `/docs/api/`
- Include examples
- Specify request/response formats
- Note any breaking changes

## Questions?

- **General questions**: [GitHub Discussions](https://github.com/OWNER/weaveai-enterprise/discussions)
- **Bug reports**: [GitHub Issues](https://github.com/OWNER/weaveai-enterprise/issues)
- **Security issues**: Email security@weaveai.com (do not open public issue)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to WeaveAI Enterprise! 🚀
